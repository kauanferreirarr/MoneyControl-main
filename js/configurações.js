document.addEventListener("DOMContentLoaded", () => {
  const menuReinicio = document.getElementById("menureinicio");
  const configItem = document.querySelector(".config-item");
  const btnBack = menuReinicio.querySelector(".btn-back");
  const selectDia = document.getElementById("dia-reinicio");
  const diasGrid = document.querySelector(".dias-grid");
  const btnSalvar = menuReinicio.querySelector(".btn-salvar");

  // 1. Último botão inicia com 30
  const botoes = diasGrid.querySelectorAll(".dia");
  const ultimo = botoes[botoes.length - 1];
  ultimo.textContent = "30";

  // 2. Abrir card
  configItem.addEventListener("click", () => {
    menuReinicio.style.display = "flex";
  });

  // 3. Fechar card
  btnBack.addEventListener("click", (e) => {
    e.preventDefault();
    menuReinicio.style.display = "none";
  });

  // 4. Função para ativar apenas o botão clicado
  function ativarBotaoClicado(btn) {
    botoes.forEach(b => b.classList.remove("ativo"));
    btn.classList.add("ativo");
  }

  // 5. Clique nos botões de sugestão
  diasGrid.addEventListener("click", (e) => {
    if (e.target.classList.contains("dia")) {
      // ativa o botão clicado
      ativarBotaoClicado(e.target);

      // atualiza select mas sem disparar change
      selectDia.value = e.target.textContent;

      // reseta último botão para 30 se for diferente
      ultimo.textContent = "30";
    }
  });

  // 6. Seleção no dropdown
  selectDia.addEventListener("change", () => {
    const valor = selectDia.value;
    let encontrado = false;

    botoes.forEach(btn => {
      if (btn.textContent === valor) {
        ativarBotaoClicado(btn);
        encontrado = true;
      }
    });

    // Se não existe, substitui o último botão
    if (!encontrado) {
      ultimo.textContent = valor;
      ativarBotaoClicado(ultimo);
    }
  });

  // 7. Salvar
  btnSalvar.addEventListener("click", () => {
    alert("Salvo com sucesso!");
  });
});

function abrirMetas() {
  document.getElementById("menumetas").style.display = "flex";
}

function fecharMetas() {
  document.getElementById("menumetas").style.display = "none";
}

function salvarMeta() {
  const valor = document.getElementById("meta-valor").value;
  if (!valor || valor <= 0) {
    alert("Defina um valor válido para a meta.");
    return;
  }
  alert("Meta de gastos salva: R$ " + valor);
  fecharMetas();
}

// --- JAVASCRIPT PARA O CARD DE METAS (Colocar em js/configurações.js ou similar) ---

// Função para abrir o modal de metas (sugestão de link no HTML)
function abrirMetas() {
  document.getElementById("menumetas").style.display = "flex";
}

function abrirexport() {
  document.getElementById("menuexport").style.display = "flex";
}

function fecharexport() {
  document.getElementById("menuexport").style.display = "none";
}


// Função para fechar o modal de metas
function fecharMetas() {
  document.getElementById("menumetas").style.display = "none";
}

document.addEventListener('DOMContentLoaded', () => {
  const rangeInput = document.getElementById('limit-range');
  const displayValue = document.getElementById('display-value');
  const manualInput = document.getElementById('manual-input');
  const noLimitCheckbox = document.getElementById('no-limit');
  
  if (!rangeInput || !displayValue || !manualInput) return;

  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();

  // Função para atualizar valor e barra
  function updateRangeDisplay(value) {
    displayValue.textContent = value;
    const percentage = (value / rangeInput.max) * 100;
    rangeInput.style.background = `linear-gradient(to right, ${primaryColor} ${percentage}%, #E0E0E0 ${percentage}%)`;
    manualInput.value = value;
  }

  // Slider
  rangeInput.addEventListener('input', () => {
    updateRangeDisplay(rangeInput.value);
  });

  // Input number
  manualInput.addEventListener('input', () => {
    let val = manualInput.value;
    if (val < 0) val = 0;
    if (val > 10000) val = 10000;
    rangeInput.value = val;
    updateRangeDisplay(val);
  });

  // Checkbox "Não definir limite"
  noLimitCheckbox.addEventListener('change', () => {
    const disabled = noLimitCheckbox.checked;
    rangeInput.disabled = disabled;
    manualInput.disabled = disabled;
    displayValue.textContent = disabled ? 'Sem limite' : rangeInput.value;
    rangeInput.style.opacity = disabled ? '0.5' : '1';
    manualInput.style.opacity = disabled ? '0.5' : '1';
  });

  // Inicializa
  updateRangeDisplay(rangeInput.value);
});

// Salvar meta
function salvarMeta() {
  const semLimite = document.getElementById('no-limit').checked;
  const limite = document.getElementById('display-value').textContent;

  if (semLimite) {
    alert('Meta de gastos removida!');
  } else {
    alert(`Meta de gastos salva: R$ ${limite}`);
  }
  fecharMetas();
}

// Funções de abrir/fechar modal
function abrirMetas() {
  document.getElementById("menumetas").style.display = "flex";
}

function fecharMetas() {
  document.getElementById("menumetas").style.display = "none";
}

// --- CONFIGURAÇÕES DE NOTIFICAÇÕES (configurações.js) ---

// Elementos
const chk50 = document.getElementById('chk50');
const chk80 = document.getElementById('chk80');
const chk100 = document.getElementById('chk100');
const chkNone = document.getElementById('chkNone');
const btnSalvarNotif = document.getElementById('btn-salvar-nofif');

// Carrega estado salvo
function carregarNotificacoes() {
  const data = JSON.parse(localStorage.getItem('notificacoes')) || {
    chk50: true,
    chk80: true,
    chk100: true,
    chkNone: false
  };

  chk50.checked = data.chk50;
  chk80.checked = data.chk80;
  chk100.checked = data.chk100;
  chkNone.checked = data.chkNone;

  atualizarDesativar();
}

// Atualiza o estado do "Desativar notificações"
function atualizarDesativar() {
  if (chkNone.checked) {
    chk50.checked = false;
    chk80.checked = false;
    chk100.checked = false;
  } else if (!chk50.checked && !chk80.checked && !chk100.checked) {
    chkNone.checked = true;
  }
}

// Event listeners para comportamento automático
chkNone.addEventListener('change', atualizarDesativar);
[chk50, chk80, chk100].forEach(chk => {
  chk.addEventListener('change', atualizarDesativar);
});

// Salvar estado quando clicar no botão
btnSalvarNotif.addEventListener('click', () => {
  const data = {
    chk50: chk50.checked,
    chk80: chk80.checked,
    chk100: chk100.checked,
    chkNone: chkNone.checked
  };
  localStorage.setItem('notificacoes', JSON.stringify(data));
  alert('Configurações de notificações salvas!');
  fecharNotifCard();
});

// Inicializa os checkboxes na carga da página
carregarNotificacoes();

// Funções de abrir/fechar card
function abrirNotifCard() {
  document.getElementById("notifcard").style.display = "flex";
}

function fecharNotifCard() {
  document.getElementById("notifcard").style.display = "none";
}

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