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

// Configuração CORS permissiva para Vercel
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// 🔥 CONFIGURAÇÃO FIREBASE ADMIN SDK
// Esta parte depende da sua variável de ambiente FIREBASE_SERVICE_ACCOUNT estar com o JSON MINIFICADO.
let serviceAccount;
try {
    const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJsonString) {
        // Gera um erro que será capturado pelo Vercel, ajudando na depuração
        throw new Error("FIREBASE_SERVICE_ACCOUNT não encontrado nas variáveis de ambiente.");
    }

    serviceAccount = JSON.parse(serviceAccountJsonString);

    // Inicialização. O try/catch é crucial para lidar com re-invocações de funções serverless.
    // getApps() verifica se a aplicação já foi inicializada, evitando o erro "already exists".
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('[FIREBASE] Admin SDK inicializado com sucesso.');
    } else {
        console.log('[FIREBASE] Admin SDK já estava inicializado.');
    }
} catch (e) {
    // Ignora erro se o Firebase já foi inicializado (a verificação acima já ajuda)
    if (!/already exists/i.test(e.message)) {
        console.error('[FIREBASE ERRO FATAL] Falha na inicialização:', e.message);
        console.error('Verifique se a variável FIREBASE_SERVICE_ACCOUNT está preenchida corretamente (minificada) no Vercel.');
        // Em um ambiente de produção real, você poderia decidir se quer parar o processo aqui.
    }
}
const db = admin.firestore();

// --- Middlewares para receber o user_id (via FormData) e JSON no corpo ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração do Multer. O Vercel/Lambda só permite escrita na pasta /tmp/
const upload = multer({ dest: '/tmp/uploads/' });

// ==================================================================
//                      FUNÇÕES AUXILIARES (Parsers do CSV)
// ==================================================================

// --- 1. Parser para CSV do Banco Inter (Delimitador: Ponto e Vírgula) ---
function parseInter(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0;
        
        fs.createReadStream(filePath)
          .pipe(csv({ 
              separator: ';', // <-- Delimitador Ponto e Vírgula
              headers: false, 
              skipLines: 0 
          }))
          .on('data', (row) => {
                rowCount++;
                
                // Ignora as 5 primeiras linhas (cabeçalhos do extrato)
                if (rowCount <= 5) {
                    return; 
                }
                
                const data_lancamento = row[0];
                const descricaoCompleta = row[2] ? row[2].trim() : 'Transação Inter';
                let valor_str = row[3]; 
                
                let valor_numerico;
                try {
                    // Normaliza: Troca vírgula (,) por ponto (.) e converte para float
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) {
                    return; 
                }
                
                // Lógica de simplificação de descrição (robusta, boa!)
                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(\d{3}\.\d{3}|\d{11}|Conta|Agência|\s*$))/i;
                const match = descricaoCompleta.match(regex);
                
                let descricaoSimplificada = descricaoCompleta; // Fallback
                
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
              fs.unlinkSync(filePath); // Limpa o arquivo temporário (CRÍTICO em Serverless)
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

                if (rowCount === 1) return; // Pula a primeira linha (cabeçalho)

                const data_lancamento = row[0];
                let valor_str = row[1];
                const identificador_unico = row[2];
                const descricaoCompleta = row[3];

                let valor_numerico = parseFloat(valor_str);

                if (!data_lancamento || isNaN(valor_numerico)) return;

                // 🔮 INÍCIO DA LIMPEZA DE DESCRIÇÃO (Lógica avançada, muito bom!)
                let descricaoSimplificada = descricaoCompleta
                    ? descricaoCompleta.trim()
                    : 'Transação Nubank';

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
                // 🔮 FIM DA LIMPEZA DE DESCRIÇÃO

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

            if (rowCount === 1) return; // Ignora cabeçalho

            const data = row[0];             // Data
            const historico = row[2]?.trim() || "Transação Itaú";
            let valorStr = row[4];
            const tipo = row[5];             // D ou C

            if (!valorStr) return;

            // Normaliza valor
            let valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));
            if (isNaN(valor)) return;

            // Aplica sinal conforme D/C
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
        // --- 1. CONVERTE DATA PARA TIMESTAMP ---
        let dataObj;
        if (t.data.includes('/')) {
             const [dia, mes, ano] = t.data.split('/');
             // Importante: forçar UTC ou fuso horário para evitar problemas de dia
             dataObj = new Date(`${ano}-${mes}-${dia}T03:00:00Z`); 
        } else if (t.data.includes('-')) {
             dataObj = new Date(`${t.data}T03:00:00Z`);
        } else {
             dataObj = new Date();
        }
        const timestamp = dataObj.getTime(); 

        // --- 2. DETERMINA O TIPO E VALOR PARA O ARRAY ---
        let tipo;
        let valorParaArray = Math.abs(t.valor); 
        
        if (t.valor < 0) {
            tipo = "despesa";
            totalGastosIncrease += valorParaArray; 
        } else {
            tipo = "entrada";
        }

        // --- 3. SOMA PARA O CÁLCULO DO SALDO ---
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

/**
 * Salva as transações formatadas no Firestore usando FieldValue.arrayUnion 
 * e incrementa os contadores usando FieldValue.increment.
 */
async function salvarTransacoesNoFirestoreArray(userId, transacoesNormalizadas) {
    if (!userId) throw new Error('ID do usuário obrigatório.');

    // ATENÇÃO: O ID do artefato ('moneycontrol-e0c85') está hardcoded. 
    // Em um ambiente Canvas, isso geralmente viria de uma variável de ambiente ou global.
    const ARTIFACT_ID = 'moneycontrol-e0c85'; 
    const userRef = db.collection('artifacts').doc(ARTIFACT_ID).collection('users').doc(userId); 

    // 1. Formata e calcula os totais
    const { transacoesFormatadas, totalSaldoChange, totalGastosIncrease } =
        formatarEcalcularTotais(transacoesNormalizadas);

    // 2. Ordenação (Opcional, mas útil para arrayUnion)
    transacoesFormatadas.sort((a, b) => b.data - a.data); 

    // 3. Tenta atualizar os totais (saldo e gastos) usando INCREMENT (Atomicidade)
    try {
        await userRef.update({
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        });
    } catch (e) {
        // Ignora se o documento não existir (será criado no passo 4)
        if (e.code === 5 || e.message.includes("no document to update")) {
            console.warn(`[Firestore] Documento do usuário ${userId} não existe. Será criado no próximo passo.`);
        } else {
            console.error(`[Firestore] Erro ao atualizar contadores para ${userId}:`, e.message);
        }
    }

    // 4. Adição ao array 'transacoes' (Usa set com merge para ser seguro tanto na criação quanto na atualização)
    const CHUNK_SIZE = 250; // Limite seguro para o arrayUnion
    let totalSalvo = 0;

    for (let i = 0; i < transacoesFormatadas.length; i += CHUNK_SIZE) {
        const chunk = transacoesFormatadas.slice(i, i + CHUNK_SIZE);

        // Usamos set com merge: true. Se o documento já existe, ele adiciona as transações.
        // Se não existe, ele o cria e adiciona as transações E os contadores (com o incremento inicial).
        await userRef.set({
            transacoes: admin.firestore.FieldValue.arrayUnion(...chunk),
            // Inclui os contadores iniciais caso o documento esteja sendo criado
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        }, { merge: true }); // O merge é CRUCIAL

        totalSalvo += chunk.length;
    }

    console.log(`[Firestore] ${totalSalvo} transações adicionadas/atualizadas para o usuário.`);
    return totalSalvo;
}


// ==================================================================
//                      ROTAS DA API
// ==================================================================

// Rota de Sanidade (Health Check) - Resolve o "Cannot GET /"
app.get('/', (req, res) => {
    // Isso é o que você está vendo no seu navegador
    res.json({"success":true,"mensagem":"API de Processamento de Extrato está online e funcionando.","endpoints":["POST /processar_extrato"]});
});

// Rota Principal para Upload e Processamento
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                erro: 'Nenhum arquivo enviado.' 
            });
        }

        const filePath = req.file.path;

        // 1. PEGAR USER ID (Essencial para saber onde salvar no Firestore)
        const userId = req.body.user_id; 
        if (!userId) {
            fs.unlinkSync(filePath); 
            return res.status(401).json({ 
                success: false, 
                erro: 'ID do usuário não fornecido na requisição.' 
            });
        }

        let dados;
        let bancoDetectado = 'Não Reconhecido';

        // 2. DETECÇÃO E PARSING DO BANCO
        // Lê apenas o início do arquivo para detecção rápida
        const fileContentStart = fs.readFileSync(filePath, 'utf-8').substring(0, 400);

        // Lógica de detecção de banco (Itaú, Nubank, Inter)
        if (
            fileContentStart.includes('Data;Data de Balancete;Histórico;Documento;Valor;Débito/Crédito') ||
            fileContentStart.includes('Histórico;Documento;Valor;Débito/Crédito')
        ) {
            dados = await parseItau(filePath);
            bancoDetectado = 'Itaú';

        } else if (fileContentStart.includes('Data,Valor,Identificador,Descrição')) {
            dados = await parseNubank(filePath);
            bancoDetectado = 'Nubank';

        } else if (fileContentStart.includes(';')) {
            // Tentativa de Inter ou outros bancos com ;
            dados = await parseInter(filePath);
            bancoDetectado = 'Banco Inter';

        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                success: false,
                erro: 'Formato CSV de banco não reconhecido.',
                detalhe: 'O arquivo não parece ser Itaú, Inter ou Nubank.'
            });
        }

        console.log(`--- DADOS NORMALIZADOS (${bancoDetectado}): ${dados.length} transações ---`);

        // 3. SALVAR NO FIRESTORE
        const totalSalvo = await salvarTransacoesNoFirestoreArray(userId, dados);

        // Resposta de SUCESSO
        res.json({
            success: true, 
            mensagem: `Extrato do ${bancoDetectado} processado e ${totalSalvo} transações salvas!`,
            transacoes_salvas: totalSalvo, 
            banco: bancoDetectado,
        });

    } catch (error) {
        console.error('Erro interno ao processar CSV:', error);

        // Garante a limpeza do arquivo temporário em caso de falha (CRÍTICO)
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // Resposta de ERRO
        res.status(500).json({
            success: false, 
            erro: 'Erro interno no servidor durante o processamento do arquivo.',
            detalhe: error.message
        });
    }
});


// Exporta o app Express para a Vercel
module.exports = app;