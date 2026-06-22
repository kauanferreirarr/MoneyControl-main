
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
  arrayUnion 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// === CONFIG FIREBASE ===
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

// Mantém usuário logado
setPersistence(auth, browserLocalPersistence);

let currentUser = null;


// === FIRESTORE ===
async function carregarDados(uid) {
  const userRef = doc(db, "usuarios", uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    await setDoc(userRef, { saldo: 0, gastos: 0, transacoes: [], nome: "Usuário" });
    return carregarDados(uid);
  }

  const dados = snap.data();

  const saldoAtualEl = document.getElementById("saldo-atual");
  const gastosAtualEl = document.getElementById("gastos-atual");
  const historicoEl = document.querySelector("#historico ul");



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

// resetMensal.js
// resetMensal.js
// IMPORTS: assume que main.js exporta `auth` e `db`
document.addEventListener('DOMContentLoaded', () => {
  const menuReinicio = document.getElementById('menureinicio');
  const btnSalvar = menuReinicio?.querySelector('.btn-salvar');
  const selectDia = document.getElementById('dia-reinicio');

  let currentUser = null;

  // 1) Observa login
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    currentUser = user;
    await carregarDataReinicio(); // marca botão assim que tiver user
  });

  // 2) Lê do Firestore e atualiza UI
  async function carregarDataReinicio() {
    if (!currentUser) return;
    const userRef = doc(db, 'usuarios', currentUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // garante documento e campo padrão
      await setDoc(userRef, { saldo: 0, gastos: 0, transacoes: [], nome: "Usuário", dataReinicio: 30 }, { merge: true });
      return carregarDataReinicio();
    }

    const dados = snap.data();
    // se veio string ou number, força número; fallback 30
    const diaSalvo = Number(dados.dataReinicio) || 30;
    console.log('[resetMensal] diaSalvo (BD) =', dados.dataReinicio, '=>', diaSalvo);

    marcarBotaoAtivo(diaSalvo);
  }

  // 3) Marca o botão certo — pega os botões NA HORA (evita NodeList stale)
  function marcarBotaoAtivo(dia) {
    const botoes = Array.from(document.querySelectorAll('.dias-grid .dia'));
    if (botoes.length === 0) {
      console.warn('[resetMensal] nenhum botão .dia encontrado no DOM');
    }
    botoes.forEach(btn => {
      const texto = (btn.textContent || '').trim();
      const numero = parseInt(texto, 10);
      if (!Number.isNaN(numero) && numero === dia) {
        btn.classList.add('ativo');
      } else {
        btn.classList.remove('ativo');
      }
    });

    // sincroniza select (se existir)
    if (selectDia) selectDia.value = String(dia);
  }

  // 4) Delegation: clique em qualquer botão .dia (funciona mesmo se DOM mudar)
  document.addEventListener('click', async (e) => {
    const el = e.target;
    if (!el || !el.classList) return;
    if (el.classList.contains('dia')) {
      const texto = (el.textContent || '').trim();
      const valor = parseInt(texto, 10);
      if (Number.isNaN(valor)) return;
      // UI imediata
      marcarBotaoAtivo(valor);

      // salva no BD
      if (currentUser) {
        try {
          const userRef = doc(db, 'usuarios', currentUser.uid);
          await updateDoc(userRef, { dataReinicio: valor });
          console.log('[resetMensal] salvo dataReinicio =', valor);
        } catch (err) {
          console.error('[resetMensal] erro ao salvar dataReinicio:', err);
        }
      }
    }
  });

  // 5) Change no select também salva + marca botões
  if (selectDia) {
    selectDia.addEventListener('change', async () => {
      const valor = Number(selectDia.value) || 30;
      marcarBotaoAtivo(valor);
      if (currentUser) {
        try {
          const userRef = doc(db, 'usuarios', currentUser.uid);
          await updateDoc(userRef, { dataReinicio: valor });
          console.log('[resetMensal] salvo dataReinicio (select) =', valor);
        } catch (err) {
          console.error('[resetMensal] erro ao salvar dataReinicio (select):', err);
        }
      }
    });
  }

  // 6) Botão salvar (só zera gastos)
  if (btnSalvar) {
    btnSalvar.addEventListener('click', async () => {
      if (!currentUser) return alert('Usuário não logado!');
      try {
        const userRef = doc(db, 'usuarios', currentUser.uid);
        const gastosEl = document.getElementById('gastos-atual');
        if (gastosEl) gastosEl.textContent = 'R$ 0,00';
        menuReinicio.style.display = 'none';
        alert('Gastos do mês reiniciados com sucesso!');
      } catch (err) {
        console.error('[resetMensal] erro ao resetar gastos:', err);
        alert('Erro ao resetar gastos!');
      }
    });
  }

  // 7) Se o card for aberto por clique (ex.: .config-item), reler o BD e marcar botão
  //    (útil se o menu é gerado/alterado depois)
  document.addEventListener('click', (e) => {
    const openedBy = e.target.closest('.config-item');
    if (openedBy) {
      // dar um micro-delay pra DOM renderizar se necessário
      setTimeout(() => {
        if (currentUser) carregarDataReinicio();
      }, 50);
    }
  });
});


