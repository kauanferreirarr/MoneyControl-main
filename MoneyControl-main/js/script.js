document.addEventListener("DOMContentLoaded", () => {
  // Elementos do DOM
  const saldoEl = document.getElementById("saldo-atual");
  const gastosEl = document.getElementById("gastos-atual");
  const inputValor = document.getElementById("valor");
  const inputDescricao = document.getElementById("descricao");
  const btnAdicionarDespesa = document.getElementById("ad-dispesas");
  const btnAdicionarSaldo = document.getElementById("ad-saldo");
  const botoesSugestivos = document.querySelectorAll(".butoes-sugestivos button");
  const historicoContainer = document.getElementById("historico");
  const historicoList = document.getElementById("historico-list");

  // Funções de formatação
  function parseBRToNumber(text) {
    if (!text) return 0;
    const cleaned = String(text).replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function formatBR(n) {
    return "R$ " + n.toFixed(2).replace(".", ",");
  }

  // Estado inicial
  let saldo = parseBRToNumber(saldoEl?.textContent);
  let gastos = parseBRToNumber(gastosEl?.textContent);

  function atualizarTela() {
    saldoEl.textContent = formatBR(saldo);
    gastosEl.textContent = formatBR(gastos);
  }

  function mesmaData(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function formatarDataTransacao(d) {
    const agora = new Date();
    const minutos = String(d.getMinutes()).padStart(2, "0");
    if (mesmaData(d, agora)) {
      return `hoje, ${d.getHours()}h:${minutos}`;
    }
    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    if (mesmaData(d, ontem)) {
      return `ontem, ${d.getHours()}h:${minutos}`;
    }
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  // Ajusta altura do histórico
  function ajustarAlturaHistorico() {
    const itens = historicoList.querySelectorAll("li");
    const alturaBase = 64;
    const novaAltura = Math.min(400, 80 + itens.length * alturaBase);
    historicoContainer.style.height = novaAltura + "px";
    historicoContainer.scrollTop = historicoContainer.scrollHeight;
  }

  // Cria item no histórico
  function criarHistorico(descricao, valor, isDespesa) {
    const li = document.createElement("li");
    li.style.wordBreak = "break-word";

    const div = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "medio-text";
    h3.textContent = descricao;
    const p = document.createElement("p");
    p.className = "litle-text";
    p.textContent = formatarDataTransacao(new Date());
    div.appendChild(h3);
    div.appendChild(p);

    const span = document.createElement("span");
    span.className = "medio-text " + (isDespesa ? "red" : "green");
    span.textContent = formatBR(valor);

    li.appendChild(div);
    li.appendChild(span);
    historicoList.appendChild(li);

    // Linha separadora
    const separator = document.createElement("div");
    separator.className = "linha";
    historicoList.appendChild(separator);

    ajustarAlturaHistorico();
  }

  // Sugestões
  botoesSugestivos.forEach((btn) => {
    btn.addEventListener("click", () => {
      inputDescricao.value = btn.textContent.trim();
      inputDescricao.focus();
    });
  });

  // Adicionar transação
  function handleAdd(isDespesa, ev) {
    if (ev) ev.preventDefault();
    const raw = String(inputValor.value || "").replace(",", ".").trim();
    const valor = parseFloat(raw);
    const descricao = inputDescricao.value.trim() || (isDespesa ? "Despesa" : "Depósito");

    if (isNaN(valor) || valor <= 0) {
      alert("Insira um valor válido (maior que 0).");
      return;
    }

    if (isDespesa) {
      gastos += valor;
      saldo -= valor;
    } else {
      saldo += valor;
    }

    criarHistorico(descricao, valor, isDespesa);
    atualizarTela();

    inputDescricao.value = "";
    inputValor.value = "";
    inputValor.focus();
  }

  btnAdicionarDespesa.addEventListener("click", (e) => handleAdd(true, e));
  btnAdicionarSaldo.addEventListener("click", (e) => handleAdd(false, e));

  // Inicialização
  atualizarTela();
  ajustarAlturaHistorico();
});

 // Menu toggle functionality
        document.addEventListener('DOMContentLoaded', function() {
            const menuButton = document.getElementById('menuButton');
            const closeButton = document.getElementById('closeButton');
            const overlay = document.getElementById('overlay');
            const sidebar = document.getElementById('sidebar');
            
            // Open menu
            menuButton.addEventListener('click', () => {
                overlay.classList.add('active');
                sidebar.classList.add('active');
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            });
            
            // Close menu
            function closeMenu() {
                overlay.classList.remove('active');
                sidebar.classList.remove('active');
                document.body.style. scrolling
            }
            
            closeButton.addEventListener('click', closeMenu);
            overlay.addEventListener('click', closeMenu);
            
            // Category buttons functionality
            const categoryButtons = document.querySelectorAll('.butoes-sugestivos button');
            const descriptionInput = document.getElementById('descricao');
            
            categoryButtons.forEach(button => {
                button.addEventListener('click', () => {
                    descriptionInput.value = button.textContent.trim();
                });
            });
        });

let lastScroll = 0;
const topo = document.getElementById('topo');
const topo1 = document.getElementById('menuButton')

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > lastScroll) {
    // descendo a página → esconde
    topo.style.top = '-100px'; // ajusta conforme a altura do topo
  } else {
    // subindo a página → mostra
    topo.style.top = '0';
  }

  lastScroll = currentScroll;
});


async function apagarTransacaoAnimada(uid, index) {
  const items = document.querySelectorAll('#historico li');
  const item = items[index];
  if (!item) return;

  // Adiciona a classe de animação
  item.classList.add('sumindo');

  // Espera o tempo da animação e então remove do Firestore
  setTimeout(async () => {
    if (currentUser) await apagarTransacao(currentUser.uid, index);
  }, 400); // 400ms = tempo da animação
}



document.addEventListener('DOMContentLoaded', function() {
            const menuButton = document.getElementById('menuButton');
            const closeButton = document.getElementById('closeButton');
            const overlay = document.getElementById('overlay');
            const sidebar = document.getElementById('sidebar');
            
            // Open menu
            menuButton.addEventListener('click', () => {
                overlay.classList.add('active');
                sidebar.classList.add('active');
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            });
            
            // Close menu
            function closeMenu() {
                overlay.classList.remove('active');
                sidebar.classList.remove('active');
                document.body.style.overflow = ''; // Enable scrolling
            }
            
            closeButton.addEventListener('click', closeMenu);
            overlay.addEventListener('click', closeMenu);
            
            // Category buttons functionality
            const categoryButtons = document.querySelectorAll('.butoes-sugestivos button');
            const descriptionInput = document.getElementById('descricao');
            
            categoryButtons.forEach(button => {
                button.addEventListener('click', () => {
                    descriptionInput.value = button.textContent.trim();
                });
            });
            
            // === FUNCIONALIDADE DE TROCAR NOME ===
            // Elementos do modal
            const modalTrocarNome = document.getElementById('modal-trocar-nome');
            const btnFecharModal = document.querySelector('.close-modal');
            const formTrocarNome = document.getElementById('form-trocar-nome');
            const inputNovoNome = document.getElementById('novo-nome');
            
            // Botão "Mudar Nome" no menu lateral
            const btnMudarNome = document.querySelector('.menu-link[data-action="mudar-nome"]');
            
            // Abrir modal ao clicar no botão "Mudar Nome"
            if (btnMudarNome) {
                btnMudarNome.addEventListener('click', (e) => {
                    e.preventDefault();
                    modalTrocarNome.classList.add('active');
                    document.body.style.overflow = 'hidden'; // Impedir rolagem
                    
                    // Preencher o campo com o nome atual, se existir
                    const userNameEl = document.querySelector('.user-name');
                    if (userNameEl) {
                        inputNovoNome.value = userNameEl.textContent;
                    }
                });
            }
            
            // Fechar modal ao clicar no botão X
            if (btnFecharModal) {
                btnFecharModal.addEventListener('click', () => {
                    modalTrocarNome.classList.remove('active');
                    document.body.style.overflow = ''; // Permitir rolagem
                });
            }
            
            // Fechar modal ao clicar fora dele
            modalTrocarNome.addEventListener('click', (e) => {
                if (e.target === modalTrocarNome) {
                    modalTrocarNome.classList.remove('active');
                    document.body.style.overflow = ''; // Permitir rolagem
                }
            });
            
            // Processar o formulário de troca de nome
            if (formTrocarNome) {
                formTrocarNome.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const novoNome = inputNovoNome.value.trim();
                    
                    if (!novoNome) {
                        alert('Por favor, digite um nome válido.');
                        return;
                    }
                    
                    try {
                        // Aqui você chamaria a função atualizarNomeUsuario do seu main.js
                        // Como estamos no HTML, vamos simular a atualização para demonstração
                        const userNameEl = document.querySelector('.user-name');
                        const userAvatarEl = document.querySelector('.user-avatar');
                        
                        if (userNameEl) {
                            userNameEl.textContent = novoNome;
                        }
                        
                        if (userAvatarEl) {
                            const iniciais = novoNome.split(' ')
                                .map(nome => nome.charAt(0))
                                .join('')
                                .substring(0, 2)
                                .toUpperCase();
                            userAvatarEl.textContent = iniciais;
                        }
                        
                        alert('Nome atualizado com sucesso!');
                        modalTrocarNome.classList.remove('active');
                        document.body.style.overflow = ''; // Permitir rolagem
                    } catch (error) {
                        console.error("Erro ao atualizar nome:", error);
                        alert('Erro ao atualizar o nome. Tente novamente.');
                    }
                });
            }
        });
