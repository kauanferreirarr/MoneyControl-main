const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const port = 3000;

// Configuração do Multer para lidar com o upload, salvando em uma pasta temporária 'uploads/'
const upload = multer({ dest: 'uploads/' }); 

// --- Função de Normalização do CSV (Parser) ---
function parseAndNormalizeCsv(filePath) {
    return new Promise((resolve, reject) => {
        const transacoesNormalizadas = [];
        let rowCount = 0;
        
        // O seu CSV usa ponto e vírgula (;) como delimitador
        fs.createReadStream(filePath)
          .pipe(csv({ 
              separator: ';', 
              headers: false, 
              skipLines: 0 
          }))
          .on('data', (row) => {
                rowCount++;
                
                // Ignoramos as 4 linhas de cabeçalho do banco e a linha do nome das colunas (Total de 5 linhas para ignorar)
                if (rowCount <= 5) {
                    return; 
                }
                
                // O objeto 'row' vem com chaves numéricas
                const data_lancamento = row[0];
                const historico = row[1];
                const descricao = row[2];
                let valor_str = row[3]; // Ex: "-20,00"
                
                // Normaliza o valor (troca vírgula por ponto e converte para número)
                let valor_numerico;
                try {
                    valor_numerico = parseFloat(valor_str.replace(',', '.'));
                } catch (e) {
                    return; 
                }

                const transacao = {
                    data: data_lancamento,
                    historico: historico ? historico.trim() : '',
                    descricao: descricao ? descricao.trim() : '',
                    valor: valor_numerico,
                };
                
                transacoesNormalizadas.push(transacao);
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


// --- Rota de Processamento (/processar_extrato) ---
app.post('/processar_extrato', upload.single('arquivo_extrato'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
        }

        const filePath = req.file.path;
        
        // Processa e normaliza o CSV
        const dados = await parseAndNormalizeCsv(filePath);
        
        // SAÍDA PARA TESTE (CONSOLE LOG)
        console.log("--- DADOS DO EXTRATO NORMALIZADOS ---");
        dados.forEach(item => {
            console.log(item);
        });
        console.log("--------------------------------------");
        
        // Retorno (A ser substituído pela lógica de inserção no banco de dados)
        res.json({
            mensagem: 'Arquivo processado com sucesso! Dados no console do servidor.',
            total_transacoes: dados.length,
            dados_para_debug: dados.slice(0, 5) 
        });

    } catch (error) {
        console.error('Erro ao processar CSV:', error);
        res.status(500).json({ erro: 'Erro interno ao processar o arquivo.' });
    }
});


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});