// ==================================================================
//                      IMPORTS E SETUP FIREBASE
// ==================================================================
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const port = 3000;

// 🔥 CONFIGURAÇÃO FIREBASE ADMIN SDK
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
                const descricaoCompleta = row[2] ? row[2].trim() : 'Transação Inter';
                let valor_str = row[3]; 
                
                let valor_numerico;
                try {
                    // Normaliza: Troca vírgula (,) por ponto (.) e converte para float
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) {
                    return; 
                }
                
                // 🎯 INÍCIO DA CORREÇÃO DE NOME LONGO (INTER)
                // Regex para pegar a primeira parte (Tipo de Transação) e o nome que vem antes de um CNPJ/CPF ou conta.
                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(\d{3}\.\d{3}|\d{11}|Conta|Agência|\s*$))/i;
                const match = descricaoCompleta.match(regex);
                
                let descricaoSimplificada = descricaoCompleta; // Fallback
                
                if (match && match[1] && match[2]) {
                    const tipo = match[1].trim(); // Ex: Transferência Recebida
                    const nome = match[2].trim(); // Ex: Vitoria Silva Dias
                    descricaoSimplificada = `${tipo} - ${nome}`;
                } else if (descricaoCompleta.includes('Débito Automático') || descricaoCompleta.includes('Pagamento de Boleto')) {
                    // Trata casos mais simples que podem falhar no regex, pegando só a primeira parte.
                    descricaoSimplificada = descricaoCompleta.split('-')[0].trim();
                }
                // 🎯 FIM DA CORREÇÃO DE NOME LONGO

                const transacao = {
                    data: data_lancamento, // Ex: 22/11/2025
                    descricao: descricaoSimplificada, // <--- USA A VERSÃO SIMPLIFICADA
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

                // Pula a primeira linha (cabeçalho do Nubank)
                if (rowCount === 1) return;

                // Mapeamento baseado no índice
                const data_lancamento = row[0];
                let valor_str = row[1];
                const identificador_unico = row[2];
                const descricaoCompleta = row[3];

                let valor_numerico = parseFloat(valor_str);

                if (!data_lancamento || isNaN(valor_numerico)) return;

                // -------------------------------
                //  🔮 INÍCIO DA LIMPEZA DE DESCRIÇÃO
                // -------------------------------

                let descricaoSimplificada = descricaoCompleta
                    ? descricaoCompleta.trim()
                    : 'Transação Nubank';

                // 1. Remove prefixos comuns chatos do Nubank
                descricaoSimplificada = descricaoSimplificada
                    .replace(/compra com débito\s*-\s*/i, '')
                    .replace(/compra no crédito\s*-\s*/i, '')
                    .trim();

                // 2. Regex para cortar tudo após o nome
                // Captura: TIPO - NOME
                // Corta antes de CPF, CNPJ, contas, cidades, estados etc.
                const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(?:\d{3}\.\d{3}|NU PAGAMENTOS|Conta|Ag[eê]ncia|IP|\d{2,}|\w{2}$|\s*$))/i;
                const match = descricaoSimplificada.match(regex);

                if (match && match[1] && match[2]) {
                    const tipo = match[1].trim();
                    const nome = match[2].trim();
                    descricaoSimplificada = `${tipo} - ${nome}`;
                } else {
                    // fallback: se tiver 2 partes, pega só as duas primeiras
                    const partes = descricaoSimplificada.split(' - ');
                    if (partes.length >= 2) {
                        descricaoSimplificada = partes[0] + ' - ' + partes[1];
                    }
                }

                // Se ainda restar lixo tipo "São Paulo", corta
                const lastSep = descricaoSimplificada.lastIndexOf(' - ');
                const pedacoFinal = descricaoSimplificada.slice(lastSep + 3);

                if (lastSep !== -1 && pedacoFinal.length <= 20 && /[A-Za-z]{2,}/.test(pedacoFinal)) {
                    descricaoSimplificada = descricaoSimplificada.slice(0, lastSep);
                }

                if (!descricaoSimplificada) descricaoSimplificada = 'Transação Nubank';

                // -------------------------------
                //  🔮 FIM DA LIMPEZA DE DESCRIÇÃO
                // -------------------------------

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

            // Ignora cabeçalho
            if (rowCount === 1) return;

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
            descricao: t.descricao, // Usa a descrição já simplificada pelo parser
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
 */
async function salvarTransacoesNoFirestoreArray(userId, transacoesNormalizadas) {
    if (!userId) throw new Error('ID do usuário obrigatório.');

    // 1. Formata e calcula os totais
    const { transacoesFormatadas, totalSaldoChange, totalGastosIncrease } =
        formatarEcalcularTotais(transacoesNormalizadas);

    // 2. ORDENAÇÃO REAL E FUNCIONAL
    // Esta linha garante que SEMPRE fiquem do MAIS NOVO para o MAIS ANTIGO (DEC)
    transacoesFormatadas.sort((a, b) => b.data - a.data); // ✅ OK: b - a garante ordem decrescente (novo primeiro)

    const userRef = db.collection('usuarios').doc(userId);

    // 3. Atualização dos totais (saldo e gastos)
    console.log(`[Firestore] Atualizando totais: Saldo +${totalSaldoChange.toFixed(2)}, Gastos +${totalGastosIncrease.toFixed(2)}`);

    try {
        await userRef.update({
            saldo: admin.firestore.FieldValue.increment(totalSaldoChange),
            gastos: admin.firestore.FieldValue.increment(totalGastosIncrease),
        });
    } catch (e) {
        console.warn(`[Firestore] Documento do usuário ${userId} pode não existir. Criando apenas array.`);
    }

    // 4. Adição ao array 'transacoes'
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
//                       ROTA PRINCIPAL (LIMPA)
// ==================================================================
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
        }

        const filePath = req.file.path;

        // 1. PEGAR USER ID
        const userId = req.body.user_id; 
        if (!userId) {
            fs.unlinkSync(filePath); 
            return res.status(401).json({ erro: 'ID do usuário não fornecido na requisição.' });
        }

        let dados;
        let bancoDetectado = 'Não Reconhecido';

        // 2. DETECÇÃO E PARSING DO BANCO
        const fileContentStart = fs.readFileSync(filePath, 'utf-8').substring(0, 400);

        // Itaú
        if (
            fileContentStart.includes('Data;Data de Balancete;Histórico;Documento;Valor;Débito/Crédito') ||
            fileContentStart.includes('Histórico;Documento;Valor;Débito/Crédito')
        ) {
            dados = await parseItau(filePath);
            bancoDetectado = 'Itaú';

        // Nubank
        } else if (fileContentStart.includes('Data,Valor,Identificador,Descrição')) {
            dados = await parseNubank(filePath);
            bancoDetectado = 'Nubank';

        // Inter (usa ;)
        } else if (fileContentStart.includes(';')) {
            dados = await parseInter(filePath);
            bancoDetectado = 'Banco Inter';

        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                erro: 'Formato CSV de banco não reconhecido.',
                detalhe: 'O arquivo não parece ser Itaú, Inter ou Nubank.'
            });
        }

        console.log(`--- DADOS NORMALIZADOS (${bancoDetectado}) ---`);
        dados.forEach(item => console.log(item));
        console.log("--------------------------------------");

        // 3. SALVAR NO FIRESTORE
        // A ordenação é feita aqui para garantir que o array 'transacoes'
        // no Firestore tenha o item mais recente no índice 0.
        const totalSalvo = await salvarTransacoesNoFirestoreArray(userId, dados);

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