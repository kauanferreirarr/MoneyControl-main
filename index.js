// ==================================================================
//                      DIAGNÓSTICO E SETUP
// ==================================================================
console.log(">>> [BOOT] Iniciando script index.js...");

const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

console.log(">>> [BOOT] Bibliotecas carregadas.");

// Configuração CORS
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// ==================================================================
//                      FIREBASE SETUP COM LOGS
// ==================================================================
let serviceAccount;
const dbEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
let db;

console.log(">>> [FIREBASE] Verificando variável de ambiente...");

if (!dbEnv) {
    // Esse log será crucial se o problema for a variável vazia.
    console.error(">>> [ERRO CRÍTICO] Variável FIREBASE_SERVICE_ACCOUNT está VAZIA ou INDEFINIDA. Isso pode causar erro 500.");
    // NOTA: Em produção, um throw Error aqui causaria 500. Se a sua rota está causando 500, 
    // é bem provável que a linha original "throw new Error(...)" esteja sendo atingida.
} else {
    try {
        serviceAccount = JSON.parse(dbEnv);
        console.log(">>> [FIREBASE] Variável encontrada e JSON parseado. Project ID: " + serviceAccount.project_id);
        
        // Verifica se já foi inicializado (necessário em ambiente serverless)
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('>>> [FIREBASE] Admin SDK inicializado com sucesso.');
        } else {
            console.log('>>> [FIREBASE] Admin SDK já estava ativo.');
        }

        db = admin.firestore();
        console.log('>>> [FIRESTORE] Conexão estabelecida.');

    } catch (e) {
        console.error(">>> [ERRO FIREBASE FATAL] Falha ao inicializar: " + e.message);
        console.error("Verifique se o JSON da variável de ambiente está correto e minificado.");
    }
}

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração do Multer
const upload = multer({ dest: '/tmp/uploads/' });

// ==================================================================
//                      FUNÇÕES AUXILIARES (Parsers do CSV)
//                      (RESTITUIDAS NA ÍNTEGRA)
// ==================================================================

// --- 1. Parser para CSV do Banco Inter (Delimitador: Ponto e Vírgula) ---
function parseInter(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0;
        
        fs.createReadStream(filePath)
          .pipe(csv({ 
              separator: ';', 
              headers: false, 
              skipLines: 0 
          }))
          .on('data', (row) => {
                rowCount++;
                
                if (rowCount <= 5) {
                    return; 
                }
                
                const data_lancamento = row[0];
                const descricaoCompleta = row[2] ? row[2].trim() : 'Transação Inter';
                let valor_str = row[3]; 
                
                let valor_numerico;
                try {
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) {
                    return; 
                }
                
                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(\d{3}\.\d{3}|\d{11}|Conta|Agência|\s*$))/i;
                const match = descricaoCompleta.match(regex);
                
                let descricaoSimplificada = descricaoCompleta; 
                
                if (match && match[1] && match[2]) {
                    const tipo = match[1].trim(); 
                    const nome = match[2].trim(); 
                    descricaoSimplificada = `${tipo} - ${nome}`;
                } else if (descricaoCompleta.includes('Débito Automático') || descricaoCompleta.includes('Pagamento de Boleto')) {
                    descricaoSimplificada = descricaoCompleta.split('-')[0].trim();
                }

                const transacao = {
                    data: data_lancamento,
                    descricao: descricaoSimplificada, 
                    valor: valor_numerico, 
                    fonte: 'Banco Inter', 
                    referencia_bancaria: null 
                };
                
                transacoesNormalizadas.push(transacao);
          })
          .on('end', () => {
              fs.unlinkSync(filePath); 
              resolve(transacoesNormalizadas);
          })
          .on('error', (error) => {
              fs.unlinkSync(filePath); 
              reject(error);
          });
    });
}

// --- 2. Parser para CSV do Nubank (Delimitador: Vírgula) ---
function parseNubank(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0;

        fs.createReadStream(filePath)
            .pipe(csv({
                separator: ',',
                headers: false,
                skipLines: 0
            }))
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

                descricaoSimplificada = descricaoSimplificada
                    .replace(/compra com débito\s*-\s*/i, '')
                    .replace(/compra no crédito\s*-\s*/i, '')
                    .trim();

                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(?:\d{3}\.\d{3}|NU PAGAMENTOS|Conta|Ag[eê]ncia|IP|\d{2,}|\w{2}$|\s*$))/i;
                const match = descricaoSimplificada.match(regex);

                if (match && match[1] && match[2]) {
                    const tipo = match[1].trim();
                    const nome = match[2].trim();
                    descricaoSimplificada = `${tipo} - ${nome}`;
                } else {
                    const partes = descricaoSimplificada.split(' - ');
                    if (partes.length >= 2) {
                        descricaoSimplificada = partes[0] + ' - ' + partes[1];
                    }
                }

                const lastSep = descricaoSimplificada.lastIndexOf(' - ');
                const pedacoFinal = descricaoSimplificada.slice(lastSep + 3);

                if (lastSep !== -1 && pedacoFinal.length <= 20 && /[A-Za-z]{2,}/.test(pedacoFinal)) {
                    descricaoSimplificada = descricaoSimplificada.slice(0, lastSep);
                }

                if (!descricaoSimplificada) descricaoSimplificada = 'Transação Nubank';

                const transacao = {
                    data: data_lancamento ? data_lancamento.trim() : null,
                    descricao: descricaoSimplificada,
                    valor: valor_numerico,
                    fonte: 'Nubank',
                    referencia_bancaria: identificador_unico ? identificador_unico.trim() : null
                };

                transacoesNormalizadas.push(transacao);
            })
            .on('end', () => {
                fs.unlinkSync(filePath);
                resolve(transacoesNormalizadas);
            })
            .on('error', (error) => {
                fs.unlinkSync(filePath);
                reject(error);
            });
    });
}

// --- 3. Parser para CSV do Itaú (Delimitador: Ponto e Vírgula) ---
function parseItau(filePath) {
    return new Promise((resolve, reject) => {
        const transacoes = [];
        let rowCount = 0;

        fs.createReadStream(filePath)
        .pipe(csv({
            separator: ';',
            headers: false,
            skipLines: 0
        }))
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

            const transacao = {
                data: data, 
                descricao: historico,
                valor: valor,
                fonte: "Itaú",
                referencia_bancaria: row[3] || null
            };

            transacoes.push(transacao);
        })
        .on('end', () => {
            fs.unlinkSync(filePath);
            resolve(transacoes);
        })
        .on('error', (err) => {
            fs.unlinkSync(filePath);
            reject(err);
        });
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
        return { descricao: t.descricao, valor: valorParaArray, tipo: tipo, data: timestamp, fonte: t.fonte || 'Extrato CSV' };
    });
    return { transacoesFormatadas, totalSaldoChange, totalGastosIncrease };
}

async function salvarTransacoesNoFirestoreArray(userId, transacoesNormalizadas) {
    console.log(`>>> [FIRESTORE] Iniciando salvamento para UserID: ${userId}`);
    if (!userId) throw new Error('ID do usuário obrigatório.');
    if (!db) throw new Error('Conexão com Firestore falhou.'); // Checagem de segurança

    // 🔥 FIX: COLEÇÃO CORRETA 'usuarios'
    const userRef = db.collection('usuarios').doc(userId); 
    const { transacoesFormatadas, totalSaldoChange, totalGastosIncrease } = formatarEcalcularTotais(transacoesNormalizadas);
    transacoesFormatadas.sort((a, b) => b.data - a.data); 

    try {
        console.log(">>> [FIRESTORE] Tentando atualizar saldo e gastos...");
        await userRef.update({
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        });
    } catch (e) {
        console.log(">>> [FIRESTORE] Documento não existe ou erro update. Tentando criar/mergear...");
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
    console.log(`>>> [FIRESTORE] Sucesso! ${totalSalvo} transações salvas na coleção 'usuarios'.`);
    return totalSalvo;
}

// ==================================================================
//                      ROTAS DE TESTE E API
// ==================================================================

// ROTA 1: Teste de Sanidade (Health Check)
app.get('/api/ping', (req, res) => {
    console.log(">>> [ROTA] /api/ping acessada.");
    res.json({ 
        status: 'PONG', 
        node_active: true,
        firebase_status: admin.apps.length > 0 ? "Conectado" : "Falha na Inicialização" 
    });
});

// ROTA 2: A rota principal de processamento
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    console.log(">>> [ROTA] /processar_extrato ACESSADA");
    
    try {
        if (!req.file) return res.status(400).json({ success: false, erro: 'Nenhum arquivo enviado.' });
        
        const filePath = req.file.path;
        const userId = req.body.user_id; 

        console.log(">>> [REQ] Body UserID:", userId);

        if (!userId) {
            fs.unlinkSync(filePath); 
            return res.status(401).json({ success: false, erro: 'ID do usuário não fornecido.' });
        }
        
        // Se a inicialização do Firebase falhou, retorna 500
        if (!db) {
             fs.unlinkSync(filePath);
             console.error(">>> [ERRO CRÍTICO] DB não inicializado, retornando 500.");
             return res.status(500).json({ success: false, erro: 'Erro de configuração no servidor (Credenciais Firebase inválidas).' });
        }

        const fileContentStart = fs.readFileSync(filePath, 'utf-8').substring(0, 400);
        console.log(">>> [CSV HEADER] Conteúdo inicial lido.");

        let dados;
        let bancoDetectado = 'Não Reconhecido';

        if (fileContentStart.includes('Data;Data de Balancete') || fileContentStart.includes('Histórico;Documento;Valor')) {
            dados = await parseItau(filePath);
            bancoDetectado = 'Itaú';
        } else if (fileContentStart.includes('Data,Valor,Identificador,Descrição') || fileContentStart.includes('Nubank')) {
            dados = await parseNubank(filePath);
            bancoDetectado = 'Nubank';
        } else if (fileContentStart.includes(';')) {
            dados = await parseInter(filePath);
            bancoDetectado = 'Banco Inter';
        } else {
            console.log(">>> [ERRO] Banco não detectado.");
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, erro: 'Banco não reconhecido.' });
        }

        console.log(`>>> [PARSER] Banco: ${bancoDetectado}, Linhas processadas: ${dados.length}`);
        const totalSalvo = await salvarTransacoesNoFirestoreArray(userId, dados);

        res.json({ success: true, mensagem: `Processado com sucesso!`, transacoes_salvas: totalSalvo, banco: bancoDetectado });

    } catch (error) {
        console.error('>>> [ERRO ROTA]:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, erro: 'Erro interno no servidor.', detalhe: error.message });
    }
});

module.exports = app;