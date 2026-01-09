
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
    // 1. Abre o modal
    document.getElementById("menumetas").style.display = "flex";

    // 2. Pega o valor que o main.js deixou guardado no localStorage
    const valorGuardado = localStorage.getItem('valorMeta') || 0;

    // 3. Joga direto na tela
    const display = document.getElementById('display-value');
    const range = document.getElementById('limit-range');
    const manual = document.getElementById('manual-input');

    if (display) display.textContent = Number(valorGuardado).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    if (range) range.value = valorGuardado;
    if (manual) manual.value = valorGuardado;
    
    console.log("Valor carregado do LocalStorage:", valorGuardado);
}

function fecharMetas() {
  document.getElementById("menumetas").style.display = "none";
}

// --- CONFIGURAÇÕES DE NOTIFICAÇÕES (configurações.js) ---

// --- ELEMENTOS ---
const chk50 = document.getElementById('chk50');
const chk80 = document.getElementById('chk80');
const chk100 = document.getElementById('chk100');
const chkNone = document.getElementById('chkNone');
const btnSalvarNotif = document.getElementById('btn-salvar-nofif');

const noLimitCheckbox = document.getElementById('no-limit');
const rangeInput = document.getElementById('range-input'); // Certifique-se que esse ID existe no HTML
const displayValue = document.getElementById('display-value');

// --- LÓGICA DOS CHECKBOXES (NOTIFICAÇÕES) ---

// Quando clica em "Desativar notificações"
chkNone.addEventListener('change', () => {
    if (chkNone.checked) {
        chk50.checked = false;
        chk80.checked = false;
        chk100.checked = false;
    }
});

// Quando clica em qualquer porcentagem (50, 80 ou 100)
[chk50, chk80, chk100].forEach(chk => {
    chk.addEventListener('change', () => {
        if (chk.checked) {
            chkNone.checked = false; // Desmarca o "Desativar" automaticamente
        }
    });
});

// --- SALVAR E CARREGAR NOTIFICAÇÕES ---

function carregarNotificacoes() {
    const data = JSON.parse(localStorage.getItem('notificacoes')) || {
        chk50: true, chk80: true, chk100: true, chkNone: false
    };
    chk50.checked = data.chk50;
    chk80.checked = data.chk80;
    chk100.checked = data.chk100;
    chkNone.checked = data.chkNone;
}

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

// --- LÓGICA DE LIMITE/META ---
async function salvarMeta() {
    console.log("1. Função salvarMeta iniciada");
    
    const noLimitCheckbox = document.getElementById('no-limit');
    const manualInput = document.getElementById('manual-input');
    const rangeInput = document.getElementById('limit-range');

    let valorParaSalvar = null;
    if (!noLimitCheckbox.checked) {
        valorParaSalvar = parseFloat(manualInput.value || rangeInput.value);
        if (isNaN(valorParaSalvar) || valorParaSalvar < 0) {
            alert("Por favor, insira um valor válido.");
            return;
        }
    }
    console.log("2. Valor processado:", valorParaSalvar);
    try {
        // BUSCA INSTÂNCIA SE SEGURANÇA
        let database = window.db;
        let authInstancia = window.auth;

        // Se as globais falharem, tentamos importar e pegar a instância ativa
        if (!database) {
            console.log("Tentando recuperação de emergência do Firebase...");
            const { getFirestore } = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js");
            const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js");
            const { getApp } = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js");
            
            try {
                const app = getApp();
                database = getFirestore(app);
                authInstancia = getAuth(app);
            } catch(e) {
                console.error("Firebase ainda não inicializado no sistema.");
            }
        }

        const usuarioLogado = authInstancia?.currentUser;
        console.log("3. Verificando Firebase:", { database: !!database, user: !!usuarioLogado });

        if (database && usuarioLogado) {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js");
            const userRef = doc(database, "usuarios", usuarioLogado.uid);
            
            console.log("4. Gravando no Firebase para o UID:", usuarioLogado.uid);
            await updateDoc(userRef, { 
                limiteMensal: valorParaSalvar 
            });
            
            // ATUALIZA O LOCALSTORAGE TAMBÉM
            if (valorParaSalvar === null) localStorage.removeItem('valorMeta');
            else localStorage.setItem('valorMeta', valorParaSalvar.toString());

            alert("✅ Limite salvo com sucesso!");
            location.reload(); // Recarrega para o main.js ler o valor novo
        } else {
            alert("❌ Erro: O sistema ainda está carregando os dados do usuário. Aguarde 2 segundos e tente novamente.");
        }

    } catch (error) {
        console.error("❌ Erro fatal:", error);
        alert("Erro técnico: " + error.message);
    }
}

// --- SISTEMA DE NOTIFICAÇÃO REAL ---
// Chame esta função sempre que o valor gasto total do usuário mudar
// --- SISTEMA DE NOTIFICAÇÃO ATUALIZADO ---
function verificarEAlertar(valorGastoTotal) {
    const metaStr = localStorage.getItem('valorMeta');
    const config = JSON.parse(localStorage.getItem('notificacoes'));

    // Se não tiver meta ou se as notificações estiverem desativadas, para aqui
    if (!metaStr || !config || config.chkNone) return;

    const meta = parseFloat(metaStr);
    if (meta <= 0) return; // Evita divisão por zero

    const porcentagemGasta = Math.floor((valorGastoTotal / meta) * 100);
    
    console.log(`📊 Checagem de gastos: ${porcentagemGasta}% de R$ ${meta}`);

    // Lógica de Gatilhos (Trigger)
    // 1. Caso 100% ou mais
    if (porcentagemGasta >= 100 && config.chk100) {
        alert(`🚨 ALERTA: Você atingiu ${porcentagemGasta}% da sua meta! (Limite: R$ ${meta})`);
    } 
    // 2. Caso entre 80% e 99%
    else if (porcentagemGasta >= 80 && config.chk80) {
        alert(`⚠️ ATENÇÃO: Você já gastou ${porcentagemGasta}% da sua meta.`);
    } 
    // 3. Caso entre 50% e 79% (Só avisa se o chk50 estiver marcado)
    else if (porcentagemGasta >= 50 && config.chk50) {
        alert(`ℹ️ AVISO: Você atingiu ${porcentagemGasta}% dos seus gastos planejados.`);
    }
}

// --- FUNÇÕES DE INTERFACE ---

function abrirNotifCard() { document.getElementById("notifcard").style.display = "flex"; }
function fecharNotifCard() { document.getElementById("notifcard").style.display = "none"; }

function fecharMetas() { document.getElementById("menumetas").style.display = "none"; }

// Inicialização
carregarNotificacoes();

document.addEventListener('DOMContentLoaded', () => {
    // ESTE É O INÍCIO DO SEU CÓDIGO
    // ... [Seu código existente aqui, como inicialização do Firebase e outras funções] ...

    // --- VARIÁVEIS PARA LÓGICAS DE FORMULÁRIO ---
    const fileInput = document.getElementById('csv-file-input');
    const fileLabel = document.querySelector('.label-customizado');
    const formExtrato = document.getElementById('form-extrato-csv');
    // ATENÇÃO: Verifique se a variável 'currentUser' está definida no seu código.
    // Ela é usada para chamar carregarDados(currentUser.uid)
    
    // Captura o conteúdo HTML original do label (incluindo a imagem)
    const defaultLabelContent = fileLabel ? fileLabel.innerHTML : '';

    // =========================================================
    // 1. LÓGICA DE ATUALIZAÇÃO DO RÓTULO DE ARQUIVO (Feedback visual)
    // =========================================================
    if (fileInput && fileLabel) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                
                // Atualiza o conteúdo do rótulo
                fileLabel.innerHTML = `
                    <img src="assets/papel.png" width="50px" height="50px" alt="papel">
                    Arquivo selecionado: 
                    <span class="file-name-display">${fileName}</span>
                `;
                
                fileLabel.classList.add('file-selected');
                
            } else {
                // Se o arquivo for deselecionado, volta ao texto padrão
                fileLabel.innerHTML = defaultLabelContent;
                fileLabel.classList.remove('file-selected');
            }
        });
    }

    // =========================================================
    // 2. LÓGICA DE SUBMISSÃO ASSÍNCRONA (Mensagens Otimizadas)
    // =========================================================

    if (formExtrato && typeof Swal !== 'undefined') {
        formExtrato.addEventListener('submit', async (e) => {
            
            e.preventDefault(); 

            if (!fileInput || fileInput.files.length === 0) {
                Swal.fire('Atenção', 'Por favor, selecione um arquivo de extrato (.csv) para enviar.', 'warning');
                return;
            }

            const formData = new FormData(formExtrato);
            
            // SweetAlert de carregamento com timer
            Swal.fire({
                title: 'Processando Extrato...', // Título simples
                text: 'Aguarde um momento. Estamos lendo e salvando suas transações.', // Texto menos técnico
                timer: 1500,
                timerProgressBar: true,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const response = await fetch(formExtrato.action, {
                    method: 'POST',
                    body: formData,
                });

                // Lógica para AGUARDAR o tempo restante do timer
                if (Swal.getTimerLeft() > 0) {
                    await new Promise(resolve => setTimeout(resolve, Swal.getTimerLeft()));
                }
                
                // --- Leitura de Resposta Mais Robusta ---
                let result;
                let responseText = await response.text(); 

                try {
                    result = JSON.parse(responseText); 
                } catch (jsonError) {
                    // ERRO ESPECÍFICO: Resposta do servidor não é JSON (ex: erro HTML interno no Node.js)
                    Swal.close();
                    Swal.fire({
                        title: 'Falha no Servidor!',
                        html: `O servidor não conseguiu nos dar uma resposta clara após o processamento.
                                <p>Tente novamente mais tarde ou verifique se o arquivo CSV está no formato correto. (Código: 500)</p>`,
                        icon: 'error'
                    });
                    console.error("ERRO ESPECÍFICO (JSON Inválido):", responseText);
                    return;
                }
                // ------------------------------------------

                Swal.close(); // Fecha o carregamento

                // 4. Verifica o status da operação
                if (response.ok && result.success) {
                    Swal.fire({
                        title: 'Sucesso Total! ✨',
                        html: `Seu extrato foi salvo! Foram adicionadas ${result.transacoes_salvas} novas transações ao seu histórico.`,
                        icon: 'success'
                    }).then(() => {
                        // Recarrega os dados (Verifique se 'currentUser' está definido)
                        if (typeof carregarDados === 'function' && typeof currentUser !== 'undefined' && currentUser) {
                            carregarDados(currentUser.uid); 
                        }
                    });
                    
                    // Limpar o formulário e resetar o label
                    formExtrato.reset();
                    if (fileLabel) {
                        fileLabel.innerHTML = defaultLabelContent;
                        fileLabel.classList.remove('file-selected');
                    }

                } else {
                    // Trata erros retornados pelo servidor (ex: arquivo mal formatado, user_id faltando)
                    Swal.fire({
                        title: 'Arquivo Inválido 📄',
                        text: result.erro || result.detalhe || result.message || 'O formato do arquivo enviado não foi reconhecido pelo sistema. Por favor, verifique se é um extrato CSV válido do seu banco.',
                        icon: 'warning'
                    });
                }
            } catch (error) { 
                // 🛑 BLOCO DE ERRO FATAL (Problemas de Rede/Conexão)
                console.error("ERRO FATAL INESPERADO (Copie esta mensagem):", error);
                
                Swal.fire({
                    title: 'Falha na Conexão 🔌',
                    text: 'Não foi possível se comunicar com o servidor. Verifique sua conexão com a internet ou tente novamente em alguns instantes.',
                    icon: 'error'
                });
            }
        }); 
    }

    // ... [Restante do seu código DOMContentLoaded] ...

}); // Fim do DOMContentLoaded);