// resetgastos.js

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

// ======================================================
// CALCULA GASTOS DO MÊS BASEADO NO HISTÓRICO
// ======================================================
function calcularGastosDoMes(transacoes = [], dataReinicio) {
  if (!dataReinicio) return 0;

  const hoje = new Date();

  let inicioPeriodo;
  if (hoje.getDate() >= dataReinicio) {
    inicioPeriodo = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      dataReinicio,
      0, 0, 0
    );
  } else {
    inicioPeriodo = new Date(
      hoje.getFullYear(),
      hoje.getMonth() - 1,
      dataReinicio,
      0, 0, 0
    );
  }

  let total = 0;

  transacoes.forEach(t => {
    if (t.tipo !== "despesa") return;

    const data = new Date(t.data);
    if (data >= inicioPeriodo) {
      total += Number(t.valor) || 0;
    }
  });

  return total;
}

// ======================================================
// ATUALIZA GASTOS NO FIRESTORE (SEM TOCAR NO SALDO)
// ======================================================
async function atualizarGastosDoMes(userRef) {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const dados = snap.data();

  const gastosCalculados = calcularGastosDoMes(
    dados.transacoes || [],
    Number(dados.dataReinicio)
  );

  await updateDoc(userRef, {
    gastos: gastosCalculados
  });

  const gastosEl = document.getElementById("gastos-atual");
  if (gastosEl) {
    gastosEl.textContent = formatBR(gastosCalculados);
  }

  console.log(
    "[resetgastos] gastos corrigidos pelo histórico:",
    gastosCalculados
  );
}

// ======================================================
// VERIFICA RESET NO DIA CERTO (SEM ZERAR NADA NA MARRA)
// ======================================================
async function verificarResetMensal(userRef) {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const dados = snap.data();
  if (!dados.dataReinicio) return;

  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const ultimoReset = dados.ultimoReset || "";

  const chaveHoje =
    `${hoje.getFullYear()}-${hoje.getMonth()}-${diaHoje}`;

  if (
    diaHoje === Number(dados.dataReinicio) &&
    ultimoReset !== chaveHoje
  ) {
    await atualizarGastosDoMes(userRef);

    await updateDoc(userRef, {
      ultimoReset: chaveHoje
    });

    console.log("[resetgastos] reset mensal aplicado corretamente");

    if (Notification.permission === "granted") {
      new Notification("MoneyControl", {
        body: "Gastos do mês recalculados automaticamente.",
        icon: "../assets/logo.png"
      });
    }
  }
}

// ======================================================
// LOGIN → CORRIGE A CAGADA AUTOMATICAMENTE
// ======================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userRef = doc(db, "usuarios", user.uid);

  // 1️⃣ Corrige gastos (caso tenham sido zerados)
  await atualizarGastosDoMes(userRef);

  // 2️⃣ Verifica se hoje é dia de reinício
  await verificarResetMensal(userRef);
});
