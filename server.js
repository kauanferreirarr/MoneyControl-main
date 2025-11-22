// ==================================================================
//                      IMPORTS E SETUP FIREBASE
// ==================================================================
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin'); // 👈 Adicionado para interagir com o Firestore

const app = express();
const port = 3000;

// 🔥 CONFIGURAÇÃO FIREBASE ADMIN SDK (Assumindo que sua chave está aqui)
// Substitua o caminho abaixo para o seu arquivo de chave.
const serviceAccount = require('./moneycontrol-e0c85-firebase-adminsdk-fbsvc-37f9cf34e0.json'); 
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('[FIREBASE] Admin SDK inicializado.');
} catch (e) {
    if (!/already exists/i.test(e.message)) {
        console.error('[FIREBASE ERRO FATAL] Falha na inicialização:', e.message);
    }
}
const db = admin.firestore();

// --- Middlewares para receber o user_id (via FormData) ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração do Multer
const upload = multer({ dest: 'uploads/' }); 

// ==================================================================
//                   FUNÇÕES AUXILIARES (Parsers do CSV)
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
                
                // Mapeamento baseado nas colunas: [0]Data, [1]Histórico, [2]Descrição, [3]Valor
                const data_lancamento = row[0];
                // const historico = row[1]; // Não usado no formato final
                const descricao = row[2];
                let valor_str = row[3]; 
                
                let valor_numerico;
                try {
                    // Normaliza: Troca vírgula (,) por ponto (.) e converte para float
                    // O valor no CSV do Inter já vem negativo para despesas
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) {
                    return; 
                }

                const transacao = {
                    data: data_lancamento, // Ex: 22/11/2025
                    descricao: descricao ? descricao.trim() : 'Transação Inter',
                    valor: valor_numerico, // Valor com sinal
                    fonte: 'Banco Inter', // Adicionado para rastreamento
                    referencia_bancaria: null 
                };
                
                transacoesNormalizadas.push(transacao);
          })
          .on('end', () => {
              fs.unlinkSync(filePath); // Limpa o arquivo temporário
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
                
                // Pula a primeira linha, que é o cabeçalho
                if (rowCount === 1) return; 

                // Mapeamento baseado no ÍNDICE (0)Data, (1)Valor, (2)Identificador, (3)Descrição
                const data_lancamento = row[0];
                let valor_str = row[1]; 
                const identificador_unico = row[2];
                const descricao = row[3];

                let valor_numerico = parseFloat(valor_str);
                
                if (!data_lancamento || isNaN(valor_numerico)) return;

                const transacao = {
                    data: data_lancamento ? data_lancamento.trim() : null, // Ex: 2025-11-22
                    descricao: descricao ? descricao.trim() : 'Transação Nubank',
                    valor: valor_numerico, // Valor com sinal
                    fonte: 'Nubank', // Adicionado para rastreamento
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

// ==================================================================
//                   FUNÇÃO DE SALVAMENTO NO FIRESTORE
// ==================================================================

/**
 * Formata as transações para o formato de array do frontend e calcula os totais.
 * @param {Array<object>} transacoes - Transações normalizadas do parser.
 * @returns {{transacoesFormatadas: Array<object>, totalSaldoChange: number, totalGastosIncrease: number}}
 */
function formatarEcalcularTotais(transacoes) {
    let totalSaldoChange = 0;
    let totalGastosIncrease = 0;
    const transacoesFormatadas = transacoes.map(t => {
        // --- 1. CONVERTE DATA PARA TIMESTAMP ---
        let dataObj;
        if (t.data.includes('/')) {
             // Formato DD/MM/AAAA (Inter)
             const [dia, mes, ano] = t.data.split('/');
             // Cria a data no formato ISO, para evitar problemas de fuso horário
             dataObj = new Date(`${ano}-${mes}-${dia}T00:00:00.000Z`);
        } else if (t.data.includes('-')) {
             // Formato AAAA-MM-DD (Nubank)
             dataObj = new Date(`${t.data}T00:00:00.000Z`);
        } else {
             // Se não for um formato reconhecido, usa a data atual
             dataObj = new Date();
        }
        const timestamp = dataObj.getTime(); 

        // --- 2. DETERMINA O TIPO E VALOR PARA O ARRAY ---
        let tipo;
        // O valor que vai para o array é sempre POSITIVO (abs)
        // O sinal é dado pelo campo 'tipo' (despesa/entrada)
        let valorParaArray = Math.abs(t.valor); 
        
        if (t.valor < 0) {
            tipo = "despesa";
            totalGastosIncrease += valorParaArray; // Soma o valor positivo aos gastos
        } else {
            tipo = "entrada";
        }

        // --- 3. SOMA PARA O CÁLCULO DO SALDO ---
        totalSaldoChange += t.valor;

        return {
            descricao: t.descricao,
            valor: valorParaArray, // Valor POSITIVO para o array do Firestore
            tipo: tipo,
            data: timestamp,
            fonte: t.fonte || 'Extrato CSV'
        };
    });
    
    return { transacoesFormatadas, totalSaldoChange, totalGastosIncrease };
}


/**
 * 🎯 Função que faz o mesmo que o código do seu frontend, mas no servidor.
 * Atualiza o 'saldo' e 'gastos' usando FieldValue.increment
 * Adiciona as transações ao array 'transacoes' usando FieldValue.arrayUnion.
 */
async function salvarTransacoesNoFirestoreArray(userId, transacoesNormalizadas) {
    if (!userId) throw new Error('ID do usuário obrigatório.');

    // 1. Formata e calcula os totais de ajuste
    const { transacoesFormatadas, totalSaldoChange, totalGastosIncrease } = formatarEcalcularTotais(transacoesNormalizadas);

    const userRef = db.collection('usuarios').doc(userId);
    
    // 2. Atualização dos campos de Saldo e Gastos
    console.log(`[Firestore] Atualizando totais: Saldo +${totalSaldoChange.toFixed(2)}, Gastos +${totalGastosIncrease.toFixed(2)}`);

    try {
        await userRef.update({
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        });
    } catch (e) {
        // Se o documento não existir, pode falhar.
        console.warn(`[Firestore] Documento do usuário ${userId} pode não existir. Tentando criar/salvar apenas array.`);
    }

    // 3. Adiciona todas as transações ao array 'transacoes'
    // O arrayUnion tem um limite (cerca de 300 elementos). Se o CSV for muito grande, precisamos dividir.
    const CHUNK_SIZE = 250; 
    let totalSalvo = 0;

    for (let i = 0; i < transacoesFormatadas.length; i += CHUNK_SIZE) {
        const chunk = transacoesFormatadas.slice(i, i + CHUNK_SIZE);

        await userRef.update({
             transacoes: admin.firestore.FieldValue.arrayUnion(...chunk)
        });
        totalSalvo += chunk.length;
    }
    
    console.log(`[Firestore] ${totalSalvo} transações adicionadas ao array do usuário.`);
    return totalSalvo;
}


// ==================================================================
//                       ROTA PRINCIPAL
// ==================================================================

app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
        }

        const filePath = req.file.path;
        
        // 1. OBTENÇÃO DO USER ID
        const userId = req.body.user_id; // O ID deve vir como um campo no FormData
        if (!userId) {
            fs.unlinkSync(filePath); 
            return res.status(401).json({ erro: 'ID do usuário não fornecido na requisição.' });
        }

        let dados;
        let bancoDetectado = 'Não Reconhecido';

        // 2. LÓGICA DE DETECÇÃO E PARSING
        const fileContentStart = fs.readFileSync(filePath, 'utf-8').substring(0, 200);

        if (fileContentStart.includes(';')) {
            dados = await parseInter(filePath); 
            bancoDetectado = 'Banco Inter';
        } else if (fileContentStart.includes('Data,Valor,Identificador,Descrição')) {
            dados = await parseNubank(filePath);
            bancoDetectado = 'Nubank';
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ 
                erro: 'Formato CSV de banco não reconhecido ou incompatível.',
                detalhe: 'O arquivo não parece ser um extrato do Inter ou Nubank com a estrutura esperada.'
            });
        }
        
        console.log(`--- DADOS DO EXTRATO NORMALIZADOS (${bancoDetectado} - ${dados.length} transações) ---`);
        dados.forEach(item => {
            // O console log que você queria (agora com o formato final)
            console.log(item);
        });
        console.log("--------------------------------------");
        
        // 3. SALVAR NO FIRESTORE (AÇÃO PRINCIPAL)
        const totalSalvo = await salvarTransacoesNoFirestoreArray(userId, dados);


        // 4. Retorno para o Front-end
        res.json({
            mensagem: `Extrato do ${bancoDetectado} processado e ${totalSalvo} transações salvas!`,
            total_transacoes: totalSalvo,
            banco: bancoDetectado,
        });

    } catch (error) {
        console.error('Erro interno ao processar CSV:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
            erro: 'Erro interno no servidor durante o processamento do arquivo.',
            detalhe: error.message 
        });
    }
});


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});