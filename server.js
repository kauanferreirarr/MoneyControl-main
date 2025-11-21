const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Configuração do Multer para lidar com o upload, salvando em uma pasta temporária
const upload = multer({ dest: 'uploads/' }); 

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
                const historico = row[1];
                const descricao = row[2];
                let valor_str = row[3]; 
                
                let valor_numerico;
                try {
                    // Normaliza: Troca vírgula (,) por ponto (.) e converte para float
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) {
                    return; 
                }

                const transacao = {
                    data: data_lancamento,
                    descricao: descricao ? descricao.trim() : '',
                    valor: valor_numerico,
                    // Não tem identificador único no Inter para usar como chave de duplicidade
                    referencia_bancaria: null 
                };
                
                transacoesNormalizadas.push(transacao);
          })
          .on('end', () => {
              fs.unlinkSync(filePath); // Limpa o arquivo temporário
              resolve(transacoesNormalizadas);
          })
          .on('error', (error) => {
              // Limpa o arquivo mesmo em caso de erro
              fs.unlinkSync(filePath); 
              reject(error);
          });
    });
}

// --- 2. Parser para CSV do Nubank (Delimitador: Vírgula) ---
// --- 2. Parser para CSV do Nubank (Delimitador: Vírgula, CORRIGIDO) ---
function parseNubank(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0; // Contador para pular o cabeçalho
        
        fs.createReadStream(filePath)
          .pipe(csv({ 
              separator: ',', // <-- Continua Vírgula
              headers: false,  // <-- MUDANÇA: Não usa os nomes do cabeçalho
              skipLines: 0 
          }))
          .on('data', (row) => {
                rowCount++;
                
                // Pula a primeira linha, que é o cabeçalho 'Data,Valor,Identificador,Descrição'
                if (rowCount === 1) {
                    return; 
                }

                // Mapeamento baseado no ÍNDICE (0, 1, 2, 3)
                const data_lancamento = row[0];
                let valor_str = row[1]; 
                const identificador_unico = row[2];
                const descricao = row[3];

                // Normaliza o valor (já usa ponto, mas garante que é float)
                let valor_numerico = parseFloat(valor_str);
                
                // Se a linha não for válida (Ex: final do arquivo), pular
                if (!data_lancamento || isNaN(valor_numerico)) return;

                const transacao = {
                    data: data_lancamento ? data_lancamento.trim() : null,
                    descricao: descricao ? descricao.trim() : '',
                    valor: valor_numerico,
                    referencia_bancaria: identificador_unico ? identificador_unico.trim() : null
                };
                
                transacoesNormalizadas.push(transacao);
          })
          .on('end', () => {
              fs.unlinkSync(filePath); 
              resolve(transacoesNormalizadas);
          })
          .on('error', (error) => {
              // Garante a limpeza do arquivo temporário mesmo em erro
              fs.unlinkSync(filePath); 
              reject(error);
          });
    });
}


// --- Rota Principal de Processamento ---
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
        }

        const filePath = req.file.path;
        let dados;
        let bancoDetectado = 'Não Reconhecido';

        // Lemos o início do arquivo para detecção do banco
        // O encoding 'utf-8' é importante para a leitura
        const fileContentStart = fs.readFileSync(filePath, 'utf-8').substring(0, 200);

        // --- LÓGICA DE DETECÇÃO ---
        if (fileContentStart.includes(';')) {
            // Se encontrar ponto e vírgula e a palavra 'Saldo', é provável que seja Inter
            dados = await parseInter(filePath); 
            bancoDetectado = 'Banco Inter';
        } else if (fileContentStart.includes('Data,Valor,Identificador,Descrição')) {
            // Se encontrar o cabeçalho exato do Nubank
            dados = await parseNubank(filePath);
            bancoDetectado = 'Nubank';
        } else {
            // Se não reconhecer o formato, cancela e informa o usuário
            fs.unlinkSync(filePath);
            return res.status(400).json({ 
                erro: 'Formato CSV de banco não reconhecido ou incompatível.',
                detalhe: 'O arquivo não parece ser um extrato do Inter ou Nubank com a estrutura esperada.'
            });
        }
        // -------------------------

        // 3. Saída para teste (Console Log)
        console.log(`--- DADOS DO EXTRATO NORMALIZADOS (${bancoDetectado} - ${dados.length} transações) ---`);
        dados.forEach(item => {
            console.log(item);
        });
        console.log("--------------------------------------");
        
        // 4. Retorno para o Front-end
        res.json({
            mensagem: `Extrato do ${bancoDetectado} processado com sucesso!`,
            total_transacoes: dados.length,
            dados_para_debug: dados.slice(0, 5) 
        });

    } catch (error) {
        console.error('Erro interno ao processar CSV:', error);
        // Garante que o arquivo temporário seja limpo, mesmo em erro
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ erro: 'Erro interno no servidor durante o processamento do arquivo.' });
    }
});


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});