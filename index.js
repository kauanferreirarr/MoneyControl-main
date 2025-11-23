// ==================================================================
//                      IMPORTS E SETUP FIREBASE
// ==================================================================
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// --- 1. CONFIGURAÇÃO PARA SERVIR O SITE (FRONTEND) ---
// Define a pasta 'public' como a origem dos arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Configuração CORS permissiva para Vercel
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// 🔥 CONFIGURAÇÃO FIREBASE ADMIN SDK
let serviceAccount;
try {
    const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJsonString) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT não encontrado nas variáveis de ambiente.");
    }

    serviceAccount = JSON.parse(serviceAccountJsonString);

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('[FIREBASE] Admin SDK inicializado com sucesso.');
    } else {
        console.log('[FIREBASE] Admin SDK já estava inicializado.');
    }
} catch (e) {
    if (!/already exists/i.test(e.message)) {
        console.error('[FIREBASE ERRO FATAL] Falha na inicialização:', e.message);
    }
}
const db = admin.firestore();

// --- Middlewares ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração do Multer (Pasta temporária do Vercel)
const upload = multer({ dest: '/tmp/uploads/' });

// ==================================================================
//                      FUNÇÕES AUXILIARES (Parsers do CSV)
// ==================================================================

// --- 1. Parser para CSV do Banco Inter ---
function parseInter(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0;
        
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';', headers: false }))
          .on('data', (row) => {
                rowCount++;
                if (rowCount <= 5) return; 
                
                const data_lancamento = row[0];
                const descricaoCompleta = row[2] ? row[2].trim() : 'Transação Inter';
                let valor_str = row[3]; 
                
                let valor_numerico;
                try {
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) { return; }
                
                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(\d{3}\.\d{3}|\d{11}|Conta|Agência|\s*$))/i;
                const match = descricaoCompleta.match(regex);
                let descricaoSimplificada = descricaoCompleta; 
                
                if (match && match[1] && match[2]) {
                    descricaoSimplificada = `${match[1].trim()} - ${match[2].trim()}`;
                } else if (descricaoCompleta.includes('Débito Automático') || descricaoCompleta.includes('Pagamento de Boleto')) {
                    descricaoSimplificada = descricaoCompleta.split('-')[0].trim();
                }

                transacoesNormalizadas.push({
                    data: data_lancamento,
                    descricao: descricaoSimplificada, 
                    valor: valor_numerico, 
                    fonte: 'Banco Inter', 
                    referencia_bancaria: null 
                });
          })
          .on('end', () => { fs.unlinkSync(filePath); resolve(transacoesNormalizadas); })
          .on('error', (error) => { fs.unlinkSync(filePath); reject(error); });
    });
}

// --- 2. Parser para CSV do Nubank ---
function parseNubank(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0;

        fs.createReadStream(filePath)
            .pipe(csv({ separator: ',', headers: false }))
            .on('data', (row) => {
                rowCount++;
                if (rowCount === 1) return;

                const data_lancamento = row[0];
                let valor_str = row[1];
                const identificador_unico = row[2];
                const descricaoCompleta = row[3];
                let valor_numerico = parseFloat(valor_str);

                if (!data_lancamento || isNaN(valor_numerico)) return;

                let descricaoSimplificada = descricaoCompleta ? descricaoCompleta.trim() : 'Transação Nubank';
                descricaoSimplificada = descricaoSimplificada.replace(/compra com débito\s*-\s*/i, '').replace(/compra no crédito\s*-\s*/i, '').trim();

                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(?:\d{3}\.\d{3}|NU PAGAMENTOS|Conta|Ag[eê]ncia|IP|\d{2,}|\w{2}$|\s*$))/i;
                const match = descricaoSimplificada.match(regex);

                if (match && match[1] && match[2]) {
                    descricaoSimplificada = `${match[1].trim()} - ${match[2].trim()}`;
                } else {
                    const partes = descricaoSimplificada.split(' - ');
                    if (partes.length >= 2) descricaoSimplificada = partes[0] + ' - ' + partes[1];
                }

                const lastSep = descricaoSimplificada.lastIndexOf(' - ');
                const pedacoFinal = descricaoSimplificada.slice(lastSep + 3);
                if (lastSep !== -1 && pedacoFinal.length <= 20 && /[A-Za-z]{2,}/.test(pedacoFinal)) {
                    descricaoSimplificada = descricaoSimplificada.slice(0, lastSep);
                }
                if (!descricaoSimplificada) descricaoSimplificada = 'Transação Nubank';

                transacoesNormalizadas.push({
                    data: data_lancamento ? data_lancamento.trim() : null,
                    descricao: descricaoSimplificada,
                    valor: valor_numerico,
                    fonte: 'Nubank',
                    referencia_bancaria: identificador_unico ? identificador_unico.trim() : null
                });
            })
            .on('end', () => { fs.unlinkSync(filePath); resolve(transacoesNormalizadas); })
            .on('error', (error) => { fs.unlinkSync(filePath); reject(error); });
    });
}

// --- 3. Parser para CSV do Itaú ---
function parseItau(filePath) {
    return new Promise((resolve, reject) => {
        const transacoes = [];
        let rowCount = 0;

        fs.createReadStream(filePath)
        .pipe(csv({ separator: ';', headers: false }))
        .on('data', (row) => {
            rowCount++;
            if (rowCount === 1) return;

            const data = row[0];
            const historico = row[2]?.trim() || "Transação Itaú";
            let valorStr = row[4];
            const tipo = row[5]; 

            if (!valorStr) return;
            let valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));
            if (isNaN(valor)) return;

            if (tipo === 'D') valor = -Math.abs(valor);
            if (tipo === 'C') valor = Math.abs(valor);

            transacoes.push({
                data: data, 
                descricao: historico,
                valor: valor,
                fonte: "Itaú",
                referencia_bancaria: row[3] || null
            });
        })
        .on('end', () => { fs.unlinkSync(filePath); resolve(transacoes); })
        .on('error', (err) => { fs.unlinkSync(filePath); reject(err); });
    });
}

// ==================================================================
//                      FUNÇÃO DE SALVAMENTO NO FIRESTORE
// ==================================================================
function formatarEcalcularTotais(transacoes) {
    let totalSaldoChange = 0;
    let totalGastosIncrease = 0;
    
    const transacoesFormatadas = transacoes.map(t => {
        let dataObj;
        if (t.data.includes('/')) {
             const [dia, mes, ano] = t.data.split('/');
             dataObj = new Date(`${ano}-${mes}-${dia}T03:00:00Z`); 
        } else if (t.data.includes('-')) {
             dataObj = new Date(`${t.data}T03:00:00Z`);
        } else {
             dataObj = new Date();
        }
        const timestamp = dataObj.getTime(); 

        let tipo;
        let valorParaArray = Math.abs(t.valor); 
        
        if (t.valor < 0) {
            tipo = "despesa";
            totalGastosIncrease += valorParaArray; 
        } else {
            tipo = "entrada";
        }
        totalSaldoChange += t.valor;

        return {
            descricao: t.descricao, 
            valor: valorParaArray, 
            tipo: tipo,
            data: timestamp,
            fonte: t.fonte || 'Extrato CSV'
        };
    });
    
    return { transacoesFormatadas, totalSaldoChange, totalGastosIncrease };
}

async function salvarTransacoesNoFirestoreArray(userId, transacoesNormalizadas) {
    if (!userId) throw new Error('ID do usuário obrigatório.');

    const ARTIFACT_ID = 'moneycontrol-e0c85'; 
    const userRef = db.collection('artifacts').doc(ARTIFACT_ID).collection('users').doc(userId); 

    const { transacoesFormatadas, totalSaldoChange, totalGastosIncrease } = formatarEcalcularTotais(transacoesNormalizadas);

    transacoesFormatadas.sort((a, b) => b.data - a.data); 

    try {
        await userRef.update({
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        });
    } catch (e) {
        if (e.code === 5 || e.message.includes("no document to update")) {
            console.warn(`[Firestore] Criando documento para ${userId}.`);
        } else {
            console.error(`[Firestore] Erro contadores ${userId}:`, e.message);
        }
    }

    const CHUNK_SIZE = 250; 
    let totalSalvo = 0;

    for (let i = 0; i < transacoesFormatadas.length; i += CHUNK_SIZE) {
        const chunk = transacoesFormatadas.slice(i, i + CHUNK_SIZE);
        await userRef.set({
            transacoes: admin.firestore.FieldValue.arrayUnion(...chunk),
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        }, { merge: true });

        totalSalvo += chunk.length;
    }
    return totalSalvo;
}


// ==================================================================
//                      ROTAS DA API
// ==================================================================

// 🔥 CORREÇÃO IMPORTANTE: Adicionei a barra "/" antes de "api"
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, erro: 'Nenhum arquivo enviado.' });
        }

        const filePath = req.file.path;
        const userId = req.body.user_id; 

        if (!userId) {
            fs.unlinkSync(filePath); 
            return res.status(401).json({ success: false, erro: 'ID do usuário não fornecido.' });
        }

        let dados;
        let bancoDetectado = 'Não Reconhecido';
        const fileContentStart = fs.readFileSync(filePath, 'utf-8').substring(0, 400);

        if (fileContentStart.includes('Data;Data de Balancete') || fileContentStart.includes('Histórico;Documento;Valor')) {
            dados = await parseItau(filePath);
            bancoDetectado = 'Itaú';
        } else if (fileContentStart.includes('Data,Valor,Identificador,Descrição')) {
            dados = await parseNubank(filePath);
            bancoDetectado = 'Nubank';
        } else if (fileContentStart.includes(';')) {
            dados = await parseInter(filePath);
            bancoDetectado = 'Banco Inter';
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, erro: 'Banco não reconhecido.' });
        }

        console.log(`--- DADOS (${bancoDetectado}): ${dados.length} ---`);
        const totalSalvo = await salvarTransacoesNoFirestoreArray(userId, dados);

        res.json({
            success: true, 
            mensagem: `Extrato processado com sucesso!`,
            transacoes_salvas: totalSalvo, 
            banco: bancoDetectado,
        });

    } catch (error) {
        console.error('Erro:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, erro: 'Erro interno.', detalhe: error.message });
    }
});

// --- 2. ROTA DE FALLBACK (PEGA-TUDO) ---
// Se o usuário tentar acessar qualquer página (ex: /config.html) e não for API, entrega o arquivo.
// Se nada for encontrado, entrega o index.html (bom para Single Page Apps).
app.get('*', (req, res) => {
    const fileRequest = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(fileRequest) && fs.lstatSync(fileRequest).isFile()) {
         res.sendFile(fileRequest);
    } else {
         res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

module.exports = app;