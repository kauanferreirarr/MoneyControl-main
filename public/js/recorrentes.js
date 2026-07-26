// recorrentes.js - Gerenciamento de Transações Recorrentes

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

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
let dadosUsuario = null;

let notyf;
try {
  notyf = window.Notyf
    ? new Notyf({ duration: 3500, position: { x: "right", y: "top" } })
    : { success: m => console.log(m), error: m => console.error(m) };
} catch {
  notyf = { success: m => console.log(m), error: m => console.error(m) };
}

function formatBR(n) {
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function renderLista() {
  const list = document.getElementById("rec-list");
  const empty = document.getElementById("rec-empty");
  list.innerHTML = "";

  const recorrentes = dadosUsuario?.recorrentes || [];

  if (recorrentes.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  recorrentes.forEach((rec, index) => {
    const isDespesa = rec.tipo === "despesa";
    const cor = isDespesa ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600";
    const valorCor = isDespesa ? "text-rose-500" : "text-emerald-500";
    const sinal = isDespesa ? "-" : "+";
    const icon = isDespesa
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;

    const item = document.createElement("div");
    item.className = "rec-item";
    item.innerHTML = `
      <div class="rec-icon ${cor}">${icon}</div>
      <div class="rec-info">
        <p class="rec-nome">${rec.descricao}</p>
        <p class="rec-detalhe">Dia ${rec.dia} de cada mês</p>
      </div>
      <span class="rec-valor ${valorCor}">${sinal} ${formatBR(rec.valor)}</span>
      <button class="rec-delete-btn w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors" title="Excluir" data-index="${index}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 hover:text-rose-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll(".rec-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.index);
      await excluirRecorrencia(idx);
    });
  });
}

async function salvarRecorrencia(dados) {
  if (!currentUser) return;
  const userRef = doc(db, "usuarios", currentUser.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const atual = snap.data().recorrentes || [];
  const nova = [...atual, { id: uid(), ...dados }];

  await updateDoc(userRef, { recorrentes: nova });
  dadosUsuario.recorrentes = nova;
  renderLista();
}

async function excluirRecorrencia(index) {
  if (!currentUser) return;
  const userRef = doc(db, "usuarios", currentUser.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const atual = snap.data().recorrentes || [];
  atual.splice(index, 1);

  await updateDoc(userRef, { recorrentes: atual });
  dadosUsuario.recorrentes = atual;
  renderLista();
  notyf.success("Recorrência excluída!");
}

// Modal
const modal = document.getElementById("modal-rec");
const btnAdd = document.getElementById("btn-add-rec");
const btnClose = document.getElementById("modal-rec-close");
const btnCancel = document.getElementById("modal-rec-cancel");
const btnSave = document.getElementById("modal-rec-save");
const tipoBtns = document.querySelectorAll(".rec-tipo-btn");
let tipoSelecionado = "despesa";

tipoBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tipoBtns.forEach(b => {
      b.classList.remove("bg-white", "text-rose-600", "text-emerald-600", "shadow-sm");
      b.classList.add("text-slate-600");
    });
    tipoSelecionado = btn.dataset.tipo;
    btn.classList.add("bg-white", "shadow-sm");
    btn.classList.remove("text-slate-600");
    btn.classList.add(tipoSelecionado === "despesa" ? "text-rose-600" : "text-emerald-600");
  });
});

function openModal() {
  document.getElementById("rec-desc").value = "";
  document.getElementById("rec-valor").value = "";
  document.getElementById("rec-dia").value = "1";
  document.getElementById("modal-rec-title").textContent = "Nova Recorrência";
  modal.classList.add("active");
}

function closeModal() {
  modal.classList.remove("active");
}

btnAdd.addEventListener("click", openModal);
btnClose.addEventListener("click", closeModal);
btnCancel.addEventListener("click", closeModal);
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

btnSave.addEventListener("click", async () => {
  const desc = document.getElementById("rec-desc").value.trim();
  const valor = parseFloat(document.getElementById("rec-valor").value);
  const dia = parseInt(document.getElementById("rec-dia").value);

  if (!desc) { notyf.error("Preencha a descrição!"); return; }
  if (!valor || valor <= 0) { notyf.error("Preencha um valor válido!"); return; }
  if (!dia || dia < 1 || dia > 31) { notyf.error("Dia inválido!"); return; }

  await salvarRecorrencia({ descricao: desc, valor, tipo: tipoSelecionado, dia, ativo: true });
  closeModal();
  notyf.success("Recorrência criada!");
});

// Auth
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      dadosUsuario = snap.data();
    } else {
      dadosUsuario = { recorrentes: [] };
    }
    renderLista();

    const nome = dadosUsuario.nome || "Usuário";
    const userNameEl = document.querySelector(".user-name");
    const userEmailEl = document.querySelector(".user-email");
    const userPhotoEl = document.getElementById("user-photo");
    const userInitialsEl = document.getElementById("user-initials");
    if (userNameEl) userNameEl.textContent = nome;
    if (userEmailEl) userEmailEl.textContent = user.email;
    const userPhoto = dadosUsuario.foto || null;
    if (userPhoto && userPhotoEl) {
      userPhotoEl.src = userPhoto;
      userPhotoEl.classList.remove("hidden");
      if (userInitialsEl) userInitialsEl.classList.add("hidden");
    } else if (userInitialsEl) {
      userInitialsEl.textContent = nome.split(" ").map(n => n.charAt(0)).join("").substring(0, 2).toUpperCase();
    }
  } else {
    window.location.href = "login.html";
  }
});

// Sidebar
const menuButton = document.getElementById("menuButton");
const closeButton = document.getElementById("closeButton");
const overlay = document.getElementById("overlay");
const sidebar = document.getElementById("sidebar");

menuButton.addEventListener("click", () => {
  overlay.classList.add("active");
  sidebar.classList.add("active");
  document.body.style.overflow = "hidden";
});

function closeSidebar() {
  overlay.classList.remove("active");
  sidebar.classList.remove("active");
  document.body.style.overflow = "";
}

closeButton.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

// Logout
const menuSair = document.getElementById("menu-sair");
if (menuSair) {
  menuSair.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (currentUser) {
        await signOut(auth);
        currentUser = null;
        window.location.href = "login.html";
      }
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  });
}
