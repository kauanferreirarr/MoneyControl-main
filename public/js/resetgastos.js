import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// === CONFIG FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyAFqvulIgDvpk7ukasWMeEpq_BFUCt94Lo",
  authDomain: "moneycontrol-e0c85.firebaseapp.com",
  projectId: "moneycontrol-e0c85",
  storageBucket: "moneycontrol-e0c85.firebasestorage.app",
  messagingSenderId: "1059412393084",
  appId: "1:1059412393084:web:1d0b058345372277709df9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= UTIL =================
function normalizarData(data) {
  if (!data) return null;

  // Timestamp Firestore
  if (typeof data === "object" && data.seconds) {
    return new Date(data.seconds * 1000);
  }

  // String ou Date
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

// ============ RECALCULA GASTOS ============
async function recalcularGastosDoMes(userRef) {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const dados = snap.data();
  const transacoes = dados.transacoes || [];

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let totalGastos = 0;

  transacoes.forEach(t => {
    const data = normalizarData(t.data);
    if (!data) return;

    if (
      data.getMonth() === mesAtual &&
      data.getFullYear() === anoAtual &&
      String(t.tipo).toLowerCase() === "despesa"
    ) {
      totalGastos += Number(t.valor) || 0;
    }
  });

  await updateDoc(userRef, {
    gastos: totalGastos
  });

  const gastosEl = document.getElementById("gastos-atual");
  if (gastosEl) {
    gastosEl.textContent = totalGastos.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  console.log("[resetMensal] gastos recalculados:", totalGastos);
}

// ============ RESET MENSAL ============
async function verificarResetMensal(userRef) {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const dados = snap.data();
  const hoje = new Date();

  if (!dados.dataReinicio) return;

  const diaHoje = hoje.getDate();
  const ultimoReset = dados.ultimoReset;

  if (diaHoje === Number(dados.dataReinicio) && ultimoReset !== diaHoje) {
    await updateDoc(userRef, {
      ultimoReset: diaHoje
    });

    await recalcularGastosDoMes(userRef);

    console.log("[resetMensal] reset aplicado no dia correto");
  }
}

// ============ INIT ============
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userRef = doc(db, "usuarios", user.uid);

  // ✅ corrige IMEDIATAMENTE (resolve a cagada já feita)
  await recalcularGastosDoMes(userRef);

  // ✅ depois cuida do reset mensal
  await verificarResetMensal(userRef);
});
