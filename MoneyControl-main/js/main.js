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
  increment
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

let currentUser = null;
let notyf;
(function initNotyfSafe() {
  try {
    if (window && window.Notyf) {
      notyf = new Notyf({
        duration: 3500,
        position: { x: "right", y: "top" }
      });
    } else {
      notyf = {
        success: (m) => { console.log("[notyf success]", m); alert("✅ " + m); },
        error: (m) => { console.log("[notyf error]", m); alert("❌ " + m); },
        warning: (m) => { console.log("[notyf warn]", m); alert("⚠️ " + m); }
      };
    }
  } catch (e) {
    console.error("Erro inicializando Notyf (fallback ativado):", e);
    notyf = {
      success: (m) => alert("✅ " + m),
      error: (m) => alert("❌ " + m),
      warning: (m) => alert("⚠️ " + m)
    };
  }
})();

// === FUNÇÕES AUXILIARES ===
function formatBR(n) {
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}


let ultimaNotificacaoNivel = null;

function checarLimite(gastos, limite) {
  if (!limite || limite <= 0) {
    ultimaNotificacaoNivel = null;
    return;
  }

  const porcentagem = (gastos / limite) * 100;
  let nivel = 0;

  if (porcentagem >= 100) nivel = 100;
  else if (porcentagem >= 80) nivel = 80;
  else if (porcentagem >= 50) nivel = 50;

  if (ultimaNotificacaoNivel === nivel) return;

  // Carrega configuração salva
  const notifConfig = JSON.parse(localStorage.getItem('notificacoes')) || {};
  
  if ((nivel === 50 && notifConfig.chk50) ||
      (nivel === 80 && notifConfig.chk80) ||
      (nivel === 100 && notifConfig.chk100)) {
    if (nivel === 50) notyf.error("Você atingiu 50% do seu limite mensal!");
    else if (nivel === 80) notyf.error("Cuidado! 80% do limite mensal atingido!");
    else if (nivel === 100) notyf.error("Limite mensal atingido! Pare de gastar!");
  }

  ultimaNotificacaoNivel = nivel;
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

  const diaHoje = new Date().getDate(); // pega o dia do mês atual
  const ultimoReset = dadosUsuario.ultimoReset || 0; // último reset feito

  if (diaHoje === Number(dadosUsuario.dataReinicio) && ultimoReset !== diaHoje) {
    try {
      await updateDoc(userRef, {
        gastos: 0, // zera gastos
        ultimoReset: diaHoje, // marca que já fez reset
      });

      const gastosEl = document.getElementById("gastos-atual");
      if (gastosEl) gastosEl.textContent = "R$ 0,00";

      console.log("[resetMensal] Gastos zerados automaticamente no dia certo!");

      // 🔔 Notificação aqui
      if (Notification.permission === "granted") {
        new Notification("MoneyControl", {
          body: "Seus gastos foram resetados automaticamente hoje.",
          icon: "../assets/logo.png"// opcional, coloca um ícone se quiser
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            new Notification("MoneyControl", {
              body: "Seus gastos foram resetados automaticamente hoje.",
              icon: "../assets/logo.png",
            });
          }
        });
      }

    } catch (err) {
      console.error("[resetMensal] erro ao resetar automaticamente:", err);
    }
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

  // AQUI: só chama depois de pegar os dados
  await verificarResetMensal(dados, userRef);


  const limiteInput = document.getElementById("limit-range");
  const displayValue = document.getElementById("display-value");
 
  // Carregar valor do banco
    if(limiteInput && displayValue){
      if(dados.limiteMensal !== undefined){
      limiteInput.value = dados.limiteMensal; // atualiza input
      displayValue.textContent = Number(dados.limiteMensal).toLocaleString("pt-BR", {minimumFractionDigits: 2});
    }

    // Atualiza display quando o usuário mexe na barra
    limiteInput.addEventListener("input", () => {
      displayValue.textContent = Number(limiteInput.value).toLocaleString("pt-BR", {minimumFractionDigits: 2});
    });
  }

  const saldoAtualEl = document.getElementById("saldo-atual");
  const gastosAtualEl = document.getElementById("gastos-atual");
  const historicoEl = document.querySelector("#historico ul");

  if (saldoAtualEl) animarSaldo(saldoAtualEl, dados.saldo);
  if (gastosAtualEl) animarSaldo(gastosAtualEl, dados.gastos);



  

  if (historicoEl) {
    historicoEl.innerHTML = "";
    const transacoes = (dados.transacoes || []).slice().reverse();
    transacoes.forEach((t, index) => {
      const li = document.createElement("li");
      li.setAttribute('data-index', dados.transacoes.length - 1 - index);
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

      if (index < transacoes.length - 1) {
        const separator = document.createElement("div");
        separator.className = "linha";
        historicoEl.appendChild(separator);
      }
    });
  }
  
  setupTransactionItems();
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
      if(!valor || !descricao) return alert("Preencha valor e descrição");

      const userRef = doc(db, "usuarios", currentUser.uid);
      const snap = await getDoc(userRef);
      const dados = snap.data();
      await updateDoc(userRef, {
        saldo: dados.saldo - valor,
        gastos: dados.gastos + valor,
        transacoes: arrayUnion({ descricao, valor, tipo:"despesa", data:Date.now() })
      });
      await carregarDados(currentUser.uid);
      inputValor.value = '';
      inputDescricao.value = '';
      inputValor.focus();



    // chama aqui a checagem de limite
    checarLimite(dados.gastos + valor, dados.limiteMensal);
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
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const dados = snap.data();

      // 🔥 Chama a verificação do reset automático aqui
      await verificarResetMensal(dados, userRef)
      const limiteDoBanco = snap.data().limiteMensal || 0; // valor do banco ou 0
  

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

btnSalvarMeta.addEventListener("click", async () => {
  if (!currentUser) return alert("Usuário não logado!");

  const limiteInput = document.getElementById("limit-range");
  const noLimitCheckbox = document.getElementById("no-limit");
  let limiteMensal = null; // padrão null se não definir limite

  if (!noLimitCheckbox.checked) {
    limiteMensal = parseFloat(limiteInput.value);
    if (isNaN(limiteMensal)) return alert("Valor inválido!");
  }

  const userRef = doc(db, "usuarios", currentUser.uid);

  try {
    await updateDoc(userRef, { limiteMensal: limiteMensal });
    alert("Limite mensal salvo com sucesso!");
  } catch (err) {
    console.error("Erro ao salvar limite:", err);
    alert("Erro ao salvar limite: " + err.message);
  }
});




