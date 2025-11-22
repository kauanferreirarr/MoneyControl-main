// ==================================================================
//                      IMPORTS E SETUP INICIAL
// ==================================================================
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin'); 

// 🔥 CHAVE DE SERVIÇO: Garanta que este arquivo esteja no mesmo diretório!
const serviceAccount = require('./moneycontrol-e0c85-firebase-adminsdk-fbsvc-37f9cf34e0.json'); 

const app = express();
const port = 3000;

// --- Middlewares ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

// --- Configuração do Multer para upload de arquivos ---
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } 
});


// ==================================================================
//             🔥 INICIALIZAÇÃO FIREBASE (ADMIN SDK) 🔥
// ==================================================================
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('[FIREBASE] Admin SDK inicializado com sucesso.');
} catch (e) {
    // Evita erro se for chamado mais de uma vez (em ambientes de desenvolvimento)
    if (!/already exists/i.test(e.message)) {
        console.error('[FIREBASE ERRO FATAL] Falha na inicialização:', e.message);
        // Em um app real, você pararia o servidor aqui.
    }
}


const db = admin.firestore();

// ID do projeto MoneyControl
const APP_ID = 'moneycontrol-e0c85'; 


// ==================================================================
//                   FUNÇÕES AUXILIARES
// ==================================================================

/**
 * Normaliza uma transação do formato Nubank para o formato universal.
 * @param {object} transacao - O objeto de transação do Nubank.
 * @returns {object} - Objeto de transação normalizado.
 */
function normalizarNubank(transacao) {
    const valor = parseFloat(transacao.Valor.replace(',', '.'));
    return {
        data: transacao.Data,
        descricao: transacao.Descrição,
        valor: valor,
        tipo: valor > 0 ? 'Receita' : 'Despesa',
        fonte: 'Nubank',
        identificador: transacao.Identificador
    };
}

/**
 * Normaliza uma transação do formato Itaú para o formato universal.
 * @param {object} transacao - O objeto de transação do Itaú.
 * @returns {object} - Objeto de transação normalizado.
 */
function normalizarItau(transacao) {
    // Detecta se o separador é ';' ou ',' e trata o formato de milhar/decimal
    const valorRaw = String(transacao.Valor).replace(/\./g, '').replace(/,/g, '.');
    let valor = parseFloat(valorRaw);

    // Ajusta o sinal com base na coluna Débito/Crédito
    if (transacao['Débito/Crédito'] === 'D' && valor > 0) {
        valor = -valor;
    } else if (transacao['Débito/Crédito'] === 'C' && valor < 0) {
        valor = Math.abs(valor); 
    }

    return {
        data: transacao.Data,
        descricao: transacao.Histórico,
        valor: valor,
        tipo: valor > 0 ? 'Receita' : 'Despesa',
        fonte: 'Itau',
        documento: transacao.Documento
    };
}

/**
 * Processa o arquivo CSV e normaliza os dados.
 * @param {string} filePath - Caminho para o arquivo CSV temporário.
 * @returns {Promise<Array<object>>} - Array de transações normalizadas.
 */
function parseAndNormalizeCsv(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let delimiter = ','; // Padrão CSV

        // Detectar o delimitador (vamos assumir Nubank=, e Itau=;)
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent.includes(';')) {
            delimiter = ';';
        }

        fs.createReadStream(filePath)
            .pipe(csv({ separator: delimiter }))
            .on('data', (data) => {
                // Heurística para determinar o formato (Nubank ou Itaú)
                if (data.Identificador && data.Data && data.Valor) {
                    // Formato Nubank
                    transacoesNormalizadas.push(normalizarNubank(data));
                } else if (data.Histórico && data['Débito/Crédito'] && data.Valor) {
                    // Formato Itaú
                    transacoesNormalizadas.push(normalizarItau(data));
                }
            })
            .on('end', () => {
                // Limpamos o arquivo temporário
                fs.unlinkSync(filePath); 
                resolve(transacoesNormalizadas);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}


/**
 * Salva as transações processadas no Firestore, associadas ao ID do usuário.
 * @param {string} userId - O ID do usuário logado.
 * @param {Array<object>} transacoes - Array de transações normalizadas.
 */
async function salvarTransacoesNoBancoDeDados(userId, transacoes) {
    if (!userId) {
        throw new Error('ID do usuário é obrigatório para salvar transações.');
    }

    // Caminho: /artifacts/{appId}/users/{userId}/transacoes_bancarias
    const caminhoTransacoes = db.collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId)
        .collection('transacoes_bancarias');

    console.log(`[Firestore] Salvando ${transacoes.length} transações para o usuário: ${userId}`);
    
    // Usar um Batch para garantir que todas as escritas sejam atômicas
    const batch = db.batch();
    let contador = 0;

    for (const transacao of transacoes) {
        // 🔥 CORREÇÃO DO ERRO DE CAMINHO:
        // Chamamos .doc() sem argumentos para que o Firestore gere um ID seguro
        const novoDocRef = caminhoTransacoes.doc(); 
        batch.set(novoDocRef, transacao);
        contador++;
    }

    // A operação 'commit' é onde o primeiro erro de credencial estava ocorrendo
    await batch.commit(); 
    
    console.log(`[Firestore] Sucesso! ${contador} transações salvas.`);
    return contador;
}


// ==================================================================
//                       ROTA PRINCIPAL
// ==================================================================

// --- Rota de Processamento (/processar_extrato) ---
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        // 1. VALIDAÇÃO DO ARQUIVO
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
        }

        const filePath = req.file.path;
        
        // 2. OBTENÇÃO DO USER ID
        const userId = req.body.user_id;

        if (!userId) {
            fs.unlinkSync(filePath); 
            return res.status(401).json({ erro: 'ID do usuário não fornecido na requisição.' });
        }
        
        console.log(`[Servidor] Requisição recebida. User ID: ${userId}`);

        // 3. PROCESSA E NORMALIZA O CSV
        const dados = await parseAndNormalizeCsv(filePath);
        
        console.log(`[Servidor] Arquivo processado. ${dados.length} transações encontradas.`);

        // 4. SALVAR NO FIRESTORE
        const totalSalvo = await salvarTransacoesNoBancoDeDados(userId, dados);
        
        // 5. RESPOSTA DE SUCESSO
        res.status(200).json({
            mensagem: `Arquivo processado e ${totalSalvo} transações salvas com sucesso no Firestore!`,
            total_transacoes: totalSalvo,
            usuario: userId
        });

    } catch (error) {
        console.error('Erro geral ao processar CSV e salvar no banco:', error);

        // Tenta garantir que o arquivo temporário seja apagado em caso de falha
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ 
            erro: 'Erro interno ao processar o arquivo.', 
            detalhe: error.message 
        });
    }
});


// ==================================================================
//                     INICIALIZAÇÃO DO SERVIDOR
// ==================================================================
app.listen(port, () => {
    console.log(`Servidor MoneyControl rodando em http://localhost:${port}`);
    console.log('Aguardando upload de extratos CSV...');
});