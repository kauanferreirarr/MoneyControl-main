// resetMensal.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { auth, db } from "./main.js"; // ajuste o caminho se necessário

// =======================================================
// UTIL
// =======================================================
function isMesmoMes(dataA, dataB) {
  const a = new Date(dataA);
  const b = new Date(dataB);
  return (
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

// =======================================================
// RESET MENSAL REAL (NÃO ESSA PALHAÇADA DE ZERAR SEM PENSAR)
// =======================================================
async function verificarResetMensal(user, dadosUsuario) {
  if (!dadosUsuario.dataReinicio) return;

  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const diaReinicio = Number(dadosUsuario.dataReinicio);
  const ultimoReset = dadosUsuario.ultimoReset || null;

  // ✅ já resetou hoje? então vaza
  if (
    ultimoReset &&
    new Date(ultimoReset).getDate() === diaHoje &&
    isMesmoMes(ultimoReset, hoje)
  ) {
    return;
  }

  // ✅ só executa no dia certo
  if (diaHoje !== diaReinicio) return;

  console.log("[resetMensal] Dia de reinício detectado.");

  const transacoes = dadosUsuario.transacoes || [];
  const transacoesMesAtual = transacoes.filter(t =>
    t.tipo === "despesa" && isMesmoMes(t.data, hoje)
  );

  let novoValorGastos = 0;

  if (transacoesMesAtual.length > 0) {
    novoValorGastos = transacoesMesAtual.reduce(
      (acc, t) => acc + Number(t.valor || 0),
      0
    );
    console.log("[resetMensal] Gastos recalculados do mês:", novoValorGastos);
  } else {
    console.log("[resetMensal] Nenhuma transação no mês. ZERANDO.");
  }

  try {
    const userRef = doc(db, "usuarios", user.uid);

    await updateDoc(userRef, {
      gastos: novoValorGastos,
      ultimoReset: hoje.toISOString()
    });

    const gastosEl = document.getElementById("gastos-atual");
    if (gastosEl) {
      gastosEl.textContent = `R$ ${novoValorGastos.toFixed(2).replace('.', ',')}`;
    }

    // 🔔 Notificação
    if (Notification.permission === "granted") {
      new Notification("MoneyControl", {
        body: "Seu mês financeiro foi reiniciado corretamente.",
        icon: "../assets/logo.png"
      });
    }

    console.log("[resetMensal] Reset mensal aplicado com sucesso.");
  } catch (err) {
    console.error("[resetMensal] Erro ao aplicar reset mensal:", err);
  }
}

// =======================================================
// OBSERVA LOGIN E DISPARA O RESET
// =======================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const dadosUsuario = snap.data();
    await verificarResetMensal(user, dadosUsuario);
  } catch (err) {
    console.error("[resetMensal] erro geral:", err);
  }
});
