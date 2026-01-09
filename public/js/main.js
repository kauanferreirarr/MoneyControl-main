// main.js (arquivo completo pronto pra colar)

// =========================== IMPORTS FIREBASE ===========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment,
  collection, 
  query,
  where,
  orderBy,
  getDocs 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// =========================== FIREBASE CONFIG ===========================
const firebaseConfig = {
  apiKey: "AIzaSyAFqvulIgDvpk7ukasWMeEpq_BFUCt94Lo",
  authDomain: "moneycontrol-e0c85.firebaseapp.com",
  projectId: "moneycontrol-e0c85",
  storageBucket: "moneycontrol-e0c85.firebasestorage.app",
  messagingSenderId: "1059412393084",
  appId: "1:1059412393084:web:1d0b058345372277709df9",
  measurementId: "G-HJKNFEJV9P"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence);

// main.js
window.db = db;   // Torna o banco de dados acessível globalmente
window.auth = auth; // Torna o auth acessível globalmente

let currentUser = null;
let notyf;

(function initNotyfSafe() {
  try {
    if (window && window.Notyf) {
      notyf = new Notyf({
        duration: 3500,
        position: { x: "right", y: "top" },
        types: [
          {
            type: "warning",
            background: "#facc15",
            icon: {
              className: "notyf__icon--warning",
              tagName: "i"
            }
          },
          {
            type: "error",
            background: "#ef4444",
            icon: {
              className: "notyf__icon--error",
              tagName: "i"
            }
          }
        ]
      });

      notyf.warning = (msg) =>
        notyf.open({ type: "warning", message: msg });

      notyf.error = (msg) =>
        notyf.open({ type: "error", message: msg });

    } else {
      notyf = {
        success: (m) => alert("✅ " + m),
        error: (m) => alert("❌ " + m),
        warning: (m) => alert("⚠️ " + m)
      };
    }
  } catch (e) {
    notyf = {
      success: (m) => alert("✅ " + m),
      error: (m) => alert("❌ " + m),
      warning: (m) => alert("⚠️ " + m)
    };
  }
})();




// Variável global para não repetir o alerta da MESMA porcentagem
let ultimaPorcentagemNotificada = 0;

function checarLimite(gastos, limite) {
    const g = parseFloat(gastos);
    const l = parseFloat(limite);

    if (!l || l <= 0) {
        ultimaPorcentagemNotificada = 0;
        return;
    }

    const porcentagemReal = Math.floor((g / l) * 100);

    // Se a porcentagem não mudou desde o último gasto, não faz nada (evita spam)
    if (porcentagemReal === ultimaPorcentagemNotificada) return;

    // Busca configurações
    const storage = localStorage.getItem('notificacoes');
    const notifConfig = storage ? JSON.parse(storage) : { chk50: true, chk80: true, chk100: true, chkNone: false };

    // Se o usuário desativou tudo, sai fora
    if (notifConfig.chkNone) return;

    let disparar = false;
    let tipoMsg = ""; // warning ou error

    // Lógica de Gatilhos Dinâmicos
    if (porcentagemReal >= 100 && notifConfig.chk100) {
        disparar = true;
        tipoMsg = "error";
    } else if (porcentagemReal >= 80 && notifConfig.chk80) {
        disparar = true;
        tipoMsg = "error";
    } else if (porcentagemReal >= 50 && notifConfig.chk50) {
        disparar = true;
        tipoMsg = "warning";
    }

    if (disparar) {
        ultimaPorcentagemNotificada = porcentagemReal; // Salva que já avisamos sobre essa % específica
        
        const mensagem = `Você atingiu ${porcentagemReal}% do seu limite mensal!`;
        
        if (tipoMsg === "error") {
            notyf.error(`🚨 ${mensagem}`);
        } else {
            notyf.warning(`ℹ️ ${mensagem}`);
        }
        
        console.log(`Notificação disparada: ${porcentagemReal}%`);
    }
}
// No local do main.js onde você processa o extrato ou saldo:
function atualizarInterface(gastosTotais) {
    // 1. Pega o limite que salvamos no configuracoes.js
    const limiteSalvo = localStorage.getItem('valorMeta');
    const limiteNumerico = limiteSalvo ? parseFloat(limiteSalvo) : 0;

    // 2. Chama a sua função de checar (que já usa o localStorage para as chk50, etc)
    checarLimite(gastosTotais, limiteNumerico);

    // ... restante da sua lógica de animar saldo, etc.
}

// === FUNÇÕES AUXILIARES ===
function formatBR(n) {
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}


function animarSaldo(element, valorFinal) {
  let valorAtual = 0;
  const incremento = valorFinal / 50;
  const intervalo = setInterval(() => {
    valorAtual += incremento;
    if (valorAtual >= valorFinal) {
      valorAtual = valorFinal;
      clearInterval(intervalo);
    }
    element.textContent = "R$ " + valorAtual.toFixed(2).replace(".", ",");
  }, 15);
}



function formatarDataTransacao(timestamp){
  const data = new Date(timestamp);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if(data.toDateString() === hoje.toDateString()){
    return "Hoje " + data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if(data.toDateString() === ontem.toDateString()){
    return "Ontem " + data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return data.toLocaleDateString('pt-BR') + " " + data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


//Função de Resetar Automatico//
async function verificarResetMensal(dadosUsuario, userRef) {
  if (!dadosUsuario.dataReinicio) return;

  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  const chaveMesAtual = `${ano}-${mes}`;
  const ultimoReset = dadosUsuario.ultimoReset || null;

  // não é o dia configurado
  if (diaHoje !== Number(dadosUsuario.dataReinicio)) return;

  // já processou este mês
  if (ultimoReset === chaveMesAtual) return;

  try {
    const transacoes = dadosUsuario.transacoes || [];

    let totalGastos = 0;

    transacoes.forEach(t => {
      if (!t || !t.data) return;

      const data = t.data.seconds
        ? new Date(t.data.seconds * 1000)
        : new Date(t.data);

      if (isNaN(data.getTime())) return;

      if (
        data.getMonth() === mes &&
        data.getFullYear() === ano &&
        String(t.tipo).toLowerCase() === "despesa"
      ) {
        totalGastos += Number(t.valor) || 0;
      }
    });

    await updateDoc(userRef, {
      gastos: totalGastos,
      ultimoReset: chaveMesAtual
    });

    const gastosEl = document.getElementById("gastos-atual");
    if (gastosEl) {
      gastosEl.textContent = totalGastos.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }

    console.log("[resetMensal] mês processado corretamente ✅");

    // ⚠️ notificação só funciona se a aba estiver ativa
    if (
      document.visibilityState === "visible" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("MoneyControl", {
        body: "Seus gastos do mês foram atualizados.",
        icon: "../assets/logo.png"
      });
    }

  } catch (err) {
    console.error("[resetMensal] erro:", err);
  }
}



// main.js - NOVO BLOCO (antes da sua função carregarDados)

// Função segura para parsear datas DD/MM/AAAA (Usada para ordenação)
const parseDateToSort = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Converte para YYYY-MM-DD para o objeto Date (Formato seguro)
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return new Date(0); // Retorna uma data inicial para não quebrar a ordenação
};


// [1] BUSCAR EXTRATO DA COLEÇÃO 'transacoes'
async function buscarTransacoesExtrato(uid) {
  try {
    // É ESSENCIAL que collection, query, where, orderBy, getDocs estejam importados!
    const q = query(
      collection(db, "transacoes"),
      where("user_id", "==", uid),
      // Ordenamos pela data de criação no servidor (mais seguro)
      orderBy("criado_em", "desc") 
    );

    const querySnapshot = await getDocs(q);
    let transacoesCarregadas = [];
    querySnapshot.forEach((doc) => {
      transacoesCarregadas.push(doc.data());
    });
    
    return transacoesCarregadas;
  } catch (e) {
    console.error("Erro ao buscar transações externas:", e);
    return [];
  }
}

// === FIRESTORE ===
async function carregarDados(uid) {
    const userRef = doc(db, "usuarios", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, { saldo: 0, gastos: 0, transacoes: [], nome: "Usuário" });
        return carregarDados(uid);
    }

    const dados = snap.data();

    // 1. SINCRONIZAÇÃO DA META (FIREBASE -> UI -> LOCALSTORAGE)
    const displayValueEl = document.getElementById('display-value');
    const rangeInputEl = document.getElementById('limit-range');
    const manualInputEl = document.getElementById('manual-input');
    const noLimitCheckbox = document.getElementById('no-limit');

    console.log("📊 Dados brutos do Firebase:", dados); // LOG 1: Ver o que veio do banco

    if (dados.limiteMensal !== undefined) {
    const limiteBanco = dados.limiteMensal || 0;
    console.log("🎯 Valor do Limite extraído:", limiteBanco); // LOG 2: Ver o valor processado

    // Localiza os elementos
    const displayValueEl = document.getElementById('display-value');
    const rangeInputEl = document.getElementById('limit-range');
    const manualInputEl = document.getElementById('manual-input');

    console.log("🔍 Elementos encontrados:", {
        display: !!displayValueEl,
        range: !!rangeInputEl,
        manual: !!manualInputEl
    }); // LOG 3: Ver se o JS achou os campos no HTML

    // 1. Injeta o valor no texto (O que o usuário vê primeiro)
    if (displayValueEl) {
        displayValueEl.textContent = Number(limiteBanco).toLocaleString("pt-BR", {
            minimumFractionDigits: 2 
        });
        console.log("✅ Texto atualizado no display-value");
    }

    // 2. Injeta no Slider
    if (rangeInputEl) {
        rangeInputEl.value = limiteBanco;
        const percentage = (limiteBanco / rangeInputEl.max) * 100;
        rangeInputEl.style.background = `linear-gradient(to right, var(--color-primary) ${percentage}%, #E0E0E0 ${percentage}%)`;
    }

    // 3. Injeta no Input de digitar
    if (manualInputEl) {
        manualInputEl.value = limiteBanco;
    }

    // Sincroniza o LocalStorage
    localStorage.setItem('valorMeta', limiteBanco);
    } else {
        console.warn("⚠️ O campo 'limiteMensal' não existe para este usuário no Firebase!");
    }
    if (dados.limiteMensal) {
    localStorage.setItem('valorMeta', dados.limiteMensal); // Salva no "estoque"
    }

    

    // 2. RESETS E INTERFACE PRINCIPAL
    await verificarResetMensal(dados, userRef);

    const saldoAtualEl = document.getElementById("saldo-atual");
    const gastosAtualEl = document.getElementById("gastos-atual");
    const historicoEl = document.querySelector("#historico ul");

    if (saldoAtualEl) animarSaldo(saldoAtualEl, dados.saldo);
    if (gastosAtualEl) {
        animarSaldo(gastosAtualEl, dados.gastos);
        // Dispara a checagem de limites (Notificações)
        atualizarInterface(dados.gastos);
    }

    // 3. RENDERIZAÇÃO DO HISTÓRICO (ORDENADO)
    if (historicoEl) {
        historicoEl.innerHTML = "";
        const transacoesOrdenadas = (dados.transacoes || []).slice().sort((a, b) => b.data - a.data);

        transacoesOrdenadas.forEach((t, index) => {
            const li = document.createElement("li");
            const originalIndex = dados.transacoes.findIndex(
                (originalT) => originalT.data === t.data && originalT.descricao === t.descricao && originalT.valor === t.valor
            );

            li.setAttribute('data-index', originalIndex !== -1 ? originalIndex : -1);
            
            li.innerHTML = `
                <div>
                    <h3 class="medio-text">${t.descricao}</h3>
                    <p>${formatarDataTransacao(t.data)}</p>
                </div>
                <span class="medio-text ${t.tipo === "despesa" ? "red" : "green"}">${formatBR(t.valor)}</span>
                <div class="delete-icon" style="display:none; cursor:pointer;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </div>
            `;
            historicoEl.appendChild(li);

            if (index < transacoesOrdenadas.length - 1) {
                const separator = document.createElement("div");
                separator.className = "linha";
                historicoEl.appendChild(separator);
            }
        });
    }
    
    setupTransactionItems();
}

// Função para preencher o modal de metas com o que já está no LocalStorage ou Firebase
function sincronizarModalMetas() {
    const limiteSalvo = localStorage.getItem('valorMeta') || 0;
    
    console.log("🔄 Sincronizando campos do modal com o valor:", limiteSalvo);

    const displayValue = document.getElementById('display-value');
    const rangeInput = document.getElementById('limit-range');
    const manualInput = document.getElementById('manual-input');

    if (displayValue) {
        displayValue.textContent = Number(limiteSalvo).toLocaleString("pt-BR", {
            minimumFractionDigits: 2 
        });
    }

    if (rangeInput) {
        rangeInput.value = limiteSalvo;
        // Atualiza a cor da barra
        const percentage = (limiteSalvo / rangeInput.max) * 100;
        rangeInput.style.background = `linear-gradient(to right, var(--color-primary) ${percentage}%, #E0E0E0 ${percentage}%)`;
    }

    if (manualInput) {
        manualInput.value = limiteSalvo;
    }
}
// Torna a função global para o outro arquivo enxergar
// No topo ou meio do main.js, mas fora de outras funções
window.spon_sincronizarModalMetas = function() {
    const limiteSalvo = localStorage.getItem('valorMeta') || 0;
    const displayValue = document.getElementById('display-value');
    const rangeInput = document.getElementById('limit-range');
    const manualInput = document.getElementById('manual-input');

    if (displayValue) displayValue.textContent = Number(limiteSalvo).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    if (rangeInput) rangeInput.value = limiteSalvo;
    if (manualInput) manualInput.value = limiteSalvo;
    
    console.log("🔄 Valores injetados no modal vindo do LocalStorage:", limiteSalvo);
};

function carregarHistoricoDeTransacoes(userId) {
    // Escuta a mesma coleção que o server.js está salvando agora
    const transacoesRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'transacoes');
    
    // Ordena por data (a mais recente primeiro)
    const q = query(transacoesRef, orderBy('data', 'desc')); 

    // onSnapshot cria a conexão em tempo real
    return onSnapshot(q, (snapshot) => {
        const transacoes = [];
        let totalGastos = 0;

        snapshot.forEach((doc) => {
            const transacao = doc.data();
            transacoes.push({ id: doc.id, ...transacao });
            
            if (transacao.tipo === 'Despesa') {
                // Calcula gastos acumulados, usando o valor absoluto
                totalGastos += Math.abs(transacao.valor);
            }
        });

        // Dispara um evento customizado para que o script.js (UI) saiba que os dados mudaram.
        const event = new CustomEvent('transactionsUpdated', { 
            detail: { 
                transactions: transacoes, 
                totalGastos: totalGastos 
            } 
        });
        document.dispatchEvent(event);

        // Atualiza os gastos na tela principal com o valor recalculado
        const gastosEl = document.getElementById('gastos-atual');
        if (gastosEl) {
            gastosEl.textContent = formatBR(totalGastos);
        }
        
        console.log(`[Firestore Listener] ${transacoes.length} transações carregadas/atualizadas em tempo real.`);
    }, (error) => {
        console.error("Erro ao carregar transações:", error);
    });
}

// === PERFIL ===
async function carregarNomeUsuario(uid) {
  const userRef = doc(db, "usuarios", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const dados = snap.data();
  const nome = dados.nome || "Usuário";

  const userNameEl = document.querySelector(".user-name");
  const userEmailEl = document.querySelector(".user-email");
  const userAvatarEl = document.querySelector(".user-avatar");

  if (userNameEl) userNameEl.textContent = nome;
  if (userEmailEl && currentUser) userEmailEl.textContent = currentUser.email;
  if (userAvatarEl) {
    const iniciais = nome.split(' ').map(n => n.charAt(0)).join('').substring(0,2).toUpperCase();
    userAvatarEl.textContent = iniciais;
  }
}

async function atualizarNomeUsuario(uid, novoNome) {
  const userRef = doc(db, "usuarios", uid);
  await updateDoc(userRef, { nome: novoNome });
  await carregarNomeUsuario(uid);
}



// === APAGAR TRANSAÇÃO ===
async function apagarTransacao(uid, transacaoIndex) {
  const userRef = doc(db, "usuarios", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;

  const dados = snap.data();
  const transacoes = [...(dados.transacoes || [])];
  if (transacaoIndex < 0 || transacaoIndex >= transacoes.length) return false;

  const t = transacoes[transacaoIndex];
  let novoSaldo = dados.saldo;
  let novosGastos = dados.gastos;

  if(t.tipo === "despesa"){
    novoSaldo += Number(t.valor);
    // garante que gastos nunca fiquem negativos
    novosGastos = Math.max(0, dados.gastos - Number(t.valor));
  } else if(t.tipo === "entrada"){
    novoSaldo -= Number(t.valor);
  }


  transacoes.splice(transacaoIndex, 1);
  await updateDoc(userRef, { transacoes, saldo: novoSaldo, gastos: novosGastos });
  await carregarDados(uid);
  return true;
}

// === LOGIN / REGISTRO ===
const btnLogin = document.getElementById("btn-login");
const btnRegistrar = document.getElementById("btn-registrar");
const feedback = document.getElementById("feedback");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

if (btnLogin) {
  btnLogin.addEventListener("click", async (e) => {
    e.preventDefault(); // garante que o form NÃO faça reload
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("password").value.trim();

    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      currentUser = cred.user;
      console.log("Login OK:", currentUser.uid);
      notyf.success("Login efetuado!");
      // redireciona manualmente (se quiser)
      window.location.href = "index.html";
    } catch (err) {
      console.error("Erro login:", err);
      feedback.textContent = err.message || "Erro ao logar";
      feedback.style.color = "red";
      notyf.error(err.message || "Erro ao logar");
    }
  });
}

if (btnRegistrar) {
  btnRegistrar.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("password").value.trim();

    if (!email || !senha) {
      feedback.textContent = "Digite email e senha válidos!";
      feedback.style.color = "red";
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      currentUser = cred.user;
      // cria doc do usuário com limiteMensal = null por padrão
      await setDoc(doc(db, "usuarios", currentUser.uid), { saldo: 0, gastos: 0, transacoes: [], nome: "Usuário", limiteMensal: null });
      notyf.success("Conta criada! Redirecionando...");
      window.location.href = "index.html";
    } catch (err) {
      console.error("Erro registrar:", err);
      feedback.textContent = err.message || "Erro ao criar conta";
      feedback.style.color = "red";
      notyf.error(err.message || "Erro ao criar conta");
    }
  });
}


// === RESET SENHA ===
const btnReset = document.getElementById("btn-reset");
const modal = document.getElementById("modal-reset");
const closeModal = document.getElementById("close-modal");
const modalMsg = document.getElementById("modal-msg");

if(btnReset){
  btnReset.addEventListener("click", async () => {
    const email = emailInput.value;
    if(!email){
      feedback.textContent = "Digite seu email para redefinir a senha";
      feedback.style.color = "red";
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      modalMsg.textContent = "Email de reset enviado! Verifique sua caixa de entrada.";
      modal.style.display = "block";
    } catch(err){
      modalMsg.textContent = "Erro ao enviar email: " + err.message;
      modal.style.display = "block";
    }
  });
}

if(closeModal){
  closeModal.addEventListener("click", () => { modal.style.display = "none"; });
}
window.addEventListener("click", (e) => { if(e.target === modal){ modal.style.display = "none"; } });

// === TROCAR NOME ===
const formTrocarNome = document.getElementById('form-trocar-nome');
if (formTrocarNome){
  formTrocarNome.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const inputNovoNome = document.getElementById('novo-nome');
    const novoNome = inputNovoNome.value.trim();
    if (!novoNome) return alert('Digite um nome válido');
    if (currentUser) await atualizarNomeUsuario(currentUser.uid, novoNome);
    document.getElementById('modal-trocar-nome').classList.remove('active');
    document.body.style.overflow = '';
  });
}

// === LOGOUT ===
const menuSair = document.getElementById("menu-sair");
if(menuSair){
  menuSair.addEventListener("click", async (e)=>{
    e.preventDefault();
    try {
      if(currentUser){
        await signOut(auth);
        currentUser = null;
        window.location.href = "/login.html";
      }
    } catch(err){
      console.error("Erro ao sair:", err);
    }
  });
}

// === TRANSAÇÕES E BOTÕES DE ADICIONAR ===
document.addEventListener('DOMContentLoaded', ()=>{
  const btnAddDespesa = document.getElementById("ad-dispesas");
  const btnAddSaldo = document.getElementById("ad-saldo");
  const inputValor = document.getElementById("valor");
  const inputDescricao = document.getElementById("descricao");

  if(btnAddDespesa){
      btnAddDespesa.addEventListener("click", async ()=>{
        if(!currentUser) return alert("Usuário não logado!");
        
        const valor = parseFloat(inputValor.value.replace(",", "."));
        const descricao = inputDescricao.value.trim() || "Despesa";
        
        if(!valor || isNaN(valor)) return alert("Preencha um valor válido");

        const userRef = doc(db, "usuarios", currentUser.uid);
        const snap = await getDoc(userRef);
        const dados = snap.data();
        
        // Pega o limite do banco ou do localStorage como plano B
        const limite = dados.limiteMensal || localStorage.getItem('valorMeta') || 0;
        const novosGastos = (Number(dados.gastos) || 0) + valor;

        await updateDoc(userRef, {
          saldo: (Number(dados.saldo) || 0) - valor,
          gastos: novosGastos,
          transacoes: arrayUnion({ descricao, valor, tipo:"despesa", data:Date.now() })
        });

        // 1. Limpa campos e recarrega UI
        inputValor.value = '';
        inputDescricao.value = '';
        await carregarDados(currentUser.uid);

        // 2. CHAMA A NOTIFICAÇÃO (Garantindo que os valores são números)
        console.log(`Verificando: Gasto ${novosGastos} de Limite ${limite}`);
        checarLimite(novosGastos, limite);
      });
  }

  if(btnAddSaldo){
    btnAddSaldo.addEventListener("click", async ()=>{
      if(!currentUser) return alert("Usuário não logado!");
      const valor = parseFloat(inputValor.value.replace(",", "."));
      const descricao = inputDescricao.value.trim() || "Depósito";
      if(!valor) return alert("Preencha um valor válido");

      const userRef = doc(db, "usuarios", currentUser.uid);
      const snap = await getDoc(userRef);
      const dados = snap.data();
      await updateDoc(userRef, {
        saldo: dados.saldo + valor,
        transacoes: arrayUnion({ descricao, valor, tipo:"entrada", data:Date.now() })
      });
      await carregarDados(currentUser.uid);
      inputValor.value = '';
      inputDescricao.value = '';
      inputValor.focus();
    });
  }
});

// === MENU DE CONTEXTO / DELETE TRANSAÇÃO ===
function setupTransactionItems(){
  const items = document.querySelectorAll('#historico li');
  items.forEach((item)=>{
    const index = parseInt(item.getAttribute('data-index'));
    const valueSpan = item.querySelector('span');
    const deleteIcon = item.querySelector('.delete-icon');

    if (valueSpan && deleteIcon){
      deleteIcon.onclick = async () => { if(currentUser) await apagarTransacao(currentUser.uid, index); };
    }

    item.oncontextmenu = (e) => {
      e.preventDefault();
      items.forEach(i => {
        i.classList.remove('selected-for-delete');
        const v = i.querySelector('span');
        const d = i.querySelector('.delete-icon');
        if(v && d){ v.style.display=''; d.style.display='none'; }
      });
      item.classList.add('selected-for-delete');
      if(valueSpan && deleteIcon){
        valueSpan.style.display = 'none';
        deleteIcon.style.display = 'flex';
      }
    };
  });
}

// === DETECTA USUÁRIO LOGADO ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // ===================================
        // NOVO: PREENCHE O CAMPO OCULTO COM O UID
        // ===================================
        const inputUidExtrato = document.getElementById('user-uid-input');
        if (inputUidExtrato) {
            inputUidExtrato.value = user.uid;
            console.log(`UID do usuário (${user.uid}) preenchido no formulário de extrato.`);
        }
        // ===================================
        
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const dados = snap.data();

            // 🔥 Chama a verificação do reset automático aqui
            await verificarResetMensal(dados, userRef)
            const limiteDoBanco = snap.data().limiteMensal || 0; // valor do banco ou 0
            
            // Sincroniza LocalStorage com Banco ao logar
            localStorage.setItem('valorMeta', limiteDoBanco);
        
            // Agora atualiza os inputs
            const rangeInput = document.getElementById('limit-range');
            const manualInput = document.getElementById('manual-input');
            const displayValue = document.getElementById('display-value');

            if (rangeInput && manualInput && displayValue) {
                rangeInput.value = limiteDoBanco;
                manualInput.value = limiteDoBanco;
                displayValue.textContent = limiteDoBanco;

                // Atualiza a barra do slider (aquela cor)
                const primaryColor = getComputedStyle(document.documentElement)
                                            .getPropertyValue('--color-primary').trim();
                const percentage = (limiteDoBanco / rangeInput.max) * 100;
                rangeInput.style.background = `linear-gradient(to right, ${primaryColor} ${percentage}%, #E0E0E0 ${percentage}%)`;
            }
        }
        
        await carregarDados(user.uid);
        await carregarNomeUsuario(user.uid);

        if (
            window.location.href.includes("login.html") ||
            window.location.href.includes("registrar.html")
        ) {
            window.location.href = "index.html";
        }
    } else {
        if (
            !window.location.href.includes("login.html") &&
            !window.location.href.includes("registrar.html")
        ) {
            window.location.href = "login.html";
        }
    }
});


const btnSalvarMeta = document.getElementById("btn-salvar-meta");




