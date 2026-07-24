// gerenciamento.js - Gerenciamento Financeiro

// =========================== IMPORTS FIREBASE ===========================
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
  setDoc
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
let dadosUsuario = null;

// =========================== NOTYF ===========================
let notyf;
try {
  notyf = window.Notyf
    ? new Notyf({ duration: 3500, position: { x: "right", y: "top" } })
    : { success: m => console.log(m), error: m => console.error(m) };
} catch {
  notyf = { success: m => console.log(m), error: m => console.error(m) };
}

// =========================== HELPERS ===========================
function formatBR(n) {
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}

function parseValorElemento(text) {
  if (!text) return 0;
  const cleaned = text.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// =========================== CATEGORY NORMALIZATION ===========================
const CATEGORY_MAP = {
  "Casa": ["aluguel", "condominio", "iptu", "agua", "luz", "eletricidade", "gas encanado", "energia", "telefonia fixa", "internet", "seguro residencial", "manutencao casa", "reforma", "dec"],
  "Transporte": ["combustivel", "gasolina", "etanol", "diezel", "onibus", "bilhete unico", "metro", "uber", "99", "taxi", "estacionamento", "pedagio", "seguro auto", "ipva", "veiculo", "carro", "moto", "aluguel carro"],
  "Alimentacao": ["mercado", "supermercado", "feira", "padaria", "acougue", "hortifruti", "restaurante", "lanchonete", "ifood", "rappi", "deliver", "外卖", "comida", "alimentacao", "open table"],
  "Saude": ["farmacia", "drogaria", "hospital", "clinica", "medico", "dentista", "oftalmologo", "psicologo", "terapia", "exame", "laboratorio", "plano saude", "unimed", "sulamerica", "amil", "bradesco saude", "consulta"],
  "Educacao": ["escola", "faculdade", "universidade", "curso", "aula", "material escolar", "livro didatico", "mensalidade escolar", "colegio", "interneto educacional"],
  "Lazer": ["netflix", "spotify", "amazon prime", "disney", "hbo", "youtube premium", "cinema", "show", "ingresso", "parque", "jogo", "game", "steam", "playstation", "xbox", "nintendo", "lazer", "bar", "balada", "festiva"],
  "Vestuario": ["roupa", "calcado", "tenis", "sapato", "camisa", "calca", "vestido", "zara", "renner", "c&a", "hering", "marisa", "moda"],
  "Tecnologia": ["celular", "iphone", "samsung", "notebook", "computador", "tablet", "ipad", "mouse", "teclado", "monitor", "impressora", "software", "apple store", "google store", "microsoft"],
  "Assinaturas": ["spotify", "netflix", "amazon prime", "disney plus", "hbo max", "youtube premium", "apple music", "deezer", "dropbox", "google one", "icloud", "office 365", "adobe", "assinatura"],
  "Cartao de Credito": ["fatura", "nubank", "itau pessoa", "bradesco pessoa", "santander pessoa", "inter pessoa", "c6 bank", "picpay", "mercadopago", "pagseguro", "credit card", "parcela"],
  "Investimentos": ["corretora", "tesouro", "cdi", "acao", "fundo", "investimento", "poupanca", "cripto", "bitcoin", "binance", "mercado bitcoin"],
  "Viagem": ["passagem", "hotel", "hospedagem", "airbnb", "decolar", "cvc", "azul", "gol", "latam", "viagem", "booking", "trip"],
  "Pets": ["pet", "petshop", "veterinario", "racao", "antipulga", "castracao", "animal"],
  "Doacoes": ["doacao", "caridade", "igreja", "templo", "ongs", "contribuicao"]
};

const CATEGORY_COLORS = {
  "Casa":             { bg: "#E0E7FF", color: "#4F46E5", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' },
  "Transporte":       { bg: "#FEF3C7", color: "#B45309", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>' },
  "Alimentacao":      { bg: "#D1FAE5", color: "#047857", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>' },
  "Saude":            { bg: "#FFE4E6", color: "#BE123C", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>' },
  "Educacao":         { bg: "#EDE9FE", color: "#6D28D9", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>' },
  "Lazer":            { bg: "#E0F2FE", color: "#0369A1", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>' },
  "Vestuario":        { bg: "#FFF7ED", color: "#C2410C", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path></svg>' },
  "Tecnologia":       { bg: "#CCFBF1", color: "#0F766E", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' },
  "Assinaturas":      { bg: "#F3E8FF", color: "#7C3AED", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>' },
  "Cartao de Credito":{ bg: "#FEE2E2", color: "#B91C1C", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>' },
  "Investimentos":    { bg: "#D1FAE5", color: "#047857", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' },
  "Viagem":           { bg: "#DBEAFE", color: "#1D4ED8", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path></svg>' },
  "Pets":             { bg: "#FFEDD5", color: "#9A3412", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>' },
  "Doacoes":          { bg: "#FCE7F3", color: "#BE185D", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>' },
  "Outros":           { bg: "#F1F5F9", color: "#475569", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>' }
};

function normalizarTexto(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function mapearCategoria(descricao) {
  const limpo = normalizarTexto(descricao);
  let melhorCategoria = "Outros";
  let maiorPontuacao = 0;

  for (const [categoria, palavras] of Object.entries(CATEGORY_MAP)) {
    for (const palavra of palavras) {
      const pLimpo = normalizarTexto(palavra);
      if (limpo === pLimpo) return categoria;
      if (limpo.includes(pLimpo) && pLimpo.length > maiorPontuacao) {
        maiorPontuacao = pLimpo.length;
        melhorCategoria = categoria;
      }
      if (pLimpo.includes(limpo) && limpo.length > 2 && limpo.length > maiorPontuacao) {
        maiorPontuacao = limpo.length;
        melhorCategoria = categoria;
      }
    }
  }

  return melhorCategoria;
}

// Green gradient palette for entradas donut
const ENTRADAS_PALETTE = [
  "#059669", "#10B981", "#34D399", "#6EE7B7", "#A7F3D0",
  "#047857", "#0D9488", "#14B8A6", "#2DD4BF", "#5EEAD4"
];

// =========================== STATE ===========================
let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let vistaAtual = "saidas"; // "saidas" | "entradas"

// =========================== CHART INSTANCES ===========================
let chartRosca = null;
let chartBalanca = null;
let chartEvolucao = null;

// =========================== PROCESS DATA ===========================
function processarTransacoes(transacoes, mes, ano) {
  const filtradas = (transacoes || []).filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const saidas = [];
  const entradas = [];

  for (const t of filtradas) {
    const item = { ...t, categoria: mapearCategoria(t.descricao) };
    if (t.tipo === "despesa") saidas.push(item);
    else entradas.push(item);
  }

  return { saidas, entradas, filtradas };
}

function agruparPorCategoria(lista) {
  const mapa = {};
  for (const item of lista) {
    if (!mapa[item.categoria]) mapa[item.categoria] = 0;
    mapa[item.categoria] += Number(item.valor);
  }
  const arr = Object.entries(mapa)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
  return arr;
}

function totalsByMonth(transacoes, ano) {
  const resultado = [];
  for (let m = 0; m < 12; m++) {
    let totalEntradas = 0;
    let totalSaidas = 0;
    for (const t of (transacoes || [])) {
      const td = new Date(t.data);
      if (td.getMonth() === m && td.getFullYear() === ano) {
        if (t.tipo === "despesa") totalSaidas += Number(t.valor);
        else totalEntradas += Number(t.valor);
      }
    }
    resultado.push({ mes: m, ano: ano, label: labelMes(m), entradas: totalEntradas, saidas: totalSaidas });
  }
  return resultado;
}

function labelMes(m) {
  const labels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return labels[m] || "";
}

// =========================== AVAILABILITY ANALYSIS ===========================
let mesesDisponiveis = new Set(); // "ano-mes" keys

function analisarDisponibilidade(transacoes) {
  mesesDisponiveis.clear();
  for (const t of (transacoes || [])) {
    const d = new Date(t.data);
    mesesDisponiveis.add(d.getFullYear() + "-" + d.getMonth());
  }
}

function temDadosNoAno(ano) {
  for (let m = 0; m < 12; m++) {
    if (mesesDisponiveis.has(ano + "-" + m)) return true;
  }
  return false;
}

function temDadosNoAnoAnterior() {
  return temDadosNoAno(anoAtual - 1);
}

function temDadosNoAnoProximo() {
  const anoMax = new Date().getFullYear();
  if (anoAtual >= anoMax) return false;
  return temDadosNoAno(anoAtual + 1);
}

function mesesComDadosNoAno(ano) {
  const resultado = [];
  for (let m = 0; m < 12; m++) {
    resultado.push(mesesDisponiveis.has(ano + "-" + m));
  }
  return resultado;
}

function atualizarDisponibilidade() {
  const disponivel = mesesComDadosNoAno(anoAtual);
  const btns = document.querySelectorAll(".mes-option");

  btns.forEach((btn, i) => {
    if (!disponivel[i]) {
      btn.classList.add("mes-disabled");
      btn.disabled = true;
    } else {
      btn.classList.remove("mes-disabled");
      btn.disabled = false;
    }
  });

  // Disable year arrows
  btnAnoPrev.disabled = !temDadosNoAnoAnterior();
  btnAnoPrev.classList.toggle("ano-nav-disabled", !temDadosNoAnoAnterior());

  btnAnoNext.disabled = !temDadosNoAnoProximo();
  btnAnoNext.classList.toggle("ano-nav-disabled", !temDadosNoAnoProximo());

  // If current month has no data, auto-select nearest available
  if (!disponivel[mesAtual]) {
    let novoMes = -1;
    // Try to find nearest month (closer to current first)
    for (let dist = 1; dist < 12; dist++) {
      if (disponivel[mesAtual + dist]) { novoMes = mesAtual + dist; break; }
      if (mesAtual - dist >= 0 && disponivel[mesAtual - dist]) { novoMes = mesAtual - dist; break; }
    }
    if (novoMes === -1) {
      // No data at all this year, pick first available
      for (let m = 0; m < 12; m++) {
        if (disponivel[m]) { novoMes = m; break; }
      }
    }
    if (novoMes >= 0) {
      mesAtual = novoMes;
      document.querySelectorAll(".mes-option").forEach(b => b.classList.remove("active"));
      const btn = document.querySelector(`.mes-option[data-mes="${novoMes}"]`);
      if (btn) btn.classList.add("active");
      atualizarLabel();
    }
  }
}

// =========================== RENDER: DONUT CHART ===========================
function renderDonut(transacoes) {
  const { saidas, entradas } = processarTransacoes(transacoes, mesAtual, anoAtual);
  const dados = vistaAtual === "saidas" ? saidas : entradas;
  const categorias = agruparPorCategoria(dados);
  const total = categorias.reduce((s, c) => s + c.valor, 0);

  document.getElementById("rosca-total").textContent = formatBR(total);

  const listaEl = document.getElementById("categorias-lista");
  const emptyEl = document.getElementById("analise-empty");

  if (categorias.length === 0) {
    emptyEl.classList.remove("hidden");
    listaEl.innerHTML = "";
    if (chartRosca) { chartRosca.destroy(); chartRosca = null; }
    return;
  }
  emptyEl.classList.add("hidden");

  const labels = categorias.map(c => c.nome);
  const values = categorias.map(c => c.valor);
  const isEntradas = vistaAtual === "entradas";
  const colors = categorias.map((c, i) => {
    if (isEntradas) return ENTRADAS_PALETTE[i % ENTRADAS_PALETTE.length];
    const cat = CATEGORY_COLORS[c.nome] || CATEGORY_COLORS["Outros"];
    return cat.color;
  });

  if (chartRosca) chartRosca.destroy();

  const ctx = document.getElementById("chart-rosca").getContext("2d");
  chartRosca = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 4,
        borderColor: "#FFFFFF",
        hoverBorderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0F172A",
          titleFont: { family: "Inter", weight: "700", size: 13 },
          bodyFont: { family: "Inter", weight: "500", size: 12 },
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${formatBR(val)} (${pct}%)`;
            }
          }
        }
      },
      animation: { animateRotate: true, duration: 800 }
    }
  });

  // Render category list
  listaEl.innerHTML = "";
  for (let i = 0; i < categorias.length; i++) {
    const cat = categorias[i];
    const catStyle = CATEGORY_COLORS[cat.nome] || CATEGORY_COLORS["Outros"];
    const pct = total > 0 ? ((cat.valor / total) * 100).toFixed(1) : 0;
    const item = document.createElement("div");
    item.className = "categoria-item";
    item.innerHTML = `
      <div class="categoria-icon" style="background:${catStyle.bg}; color:${catStyle.color}">
        ${catStyle.icon}
      </div>
      <div class="categoria-info">
        <p class="categoria-nome">${cat.nome}</p>
        <div class="categoria-barra-bg">
          <div class="categoria-barra-fill" style="width:${pct}%;background:${catStyle.color}"></div>
        </div>
      </div>
      <div style="text-align:right">
        <p class="categoria-valor">${formatBR(cat.valor)}</p>
        <p class="categoria-porcentagem">${pct}%</p>
      </div>
    `;
    listaEl.appendChild(item);
  }
}

// =========================== RENDER: META DE GASTOS ===========================
function renderMeta(transacoes) {
  const limiteMensal = dadosUsuario?.limiteMensal;
  const noLimitEl = document.getElementById("meta-no-limit");
  const bannerEl = document.getElementById("meta-status-banner");
  const summaryEl = bannerEl.parentElement;

  if (!limiteMensal || limiteMensal <= 0) {
    noLimitEl.classList.remove("hidden");
    bannerEl.classList.add("hidden");
    document.querySelector(".grid.grid-cols-3")?.classList.add("hidden");
    document.querySelector(".progress-bar-track")?.parentElement?.classList.add("hidden");
    document.getElementById("meta-categorias-breakdown").classList.add("hidden");
    return;
  }

  noLimitEl.classList.add("hidden");
  bannerEl.classList.remove("hidden");
  document.querySelector(".grid.grid-cols-3")?.classList.remove("hidden");
  document.querySelector(".progress-bar-track")?.parentElement?.classList.remove("hidden");
  document.getElementById("meta-categorias-breakdown").classList.remove("hidden");

  const { saidas } = processarTransacoes(transacoes, mesAtual, anoAtual);
  const gastoTotal = saidas.reduce((s, t) => s + Number(t.valor), 0);
  const resta = Math.max(0, limiteMensal - gastoTotal);
  const pct = Math.min(100, (gastoTotal / limiteMensal) * 100);

  document.getElementById("meta-valor").textContent = formatBR(limiteMensal);
  document.getElementById("meta-gasto-valor").textContent = formatBR(gastoTotal);
  document.getElementById("meta-resta-valor").textContent = formatBR(resta);
  document.getElementById("meta-porcentagem").textContent = pct.toFixed(0) + "%";

  // Progress bar
  const bar = document.getElementById("meta-progress-bar");
  bar.style.width = pct + "%";
  bar.className = "progress-bar-fill";
  if (pct >= 100) bar.classList.add("danger");
  else if (pct >= 80) bar.classList.add("warning");

  // Status banner
  bannerEl.className = "rounded-xl px-4 py-3 mb-5 flex items-center gap-3";
  const iconEl = document.getElementById("meta-status-icon");
  const textoEl = document.getElementById("meta-status-texto");
  const detalheEl = document.getElementById("meta-status-detalhe");

  if (pct >= 100) {
    bannerEl.classList.add("status-danger");
    iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    textoEl.textContent = "Limite ultrapassado!";
    detalheEl.textContent = `Voce excedeu ${formatBR(gastoTotal - limiteMensal)} da sua meta`;
  } else if (pct >= 80) {
    bannerEl.classList.add("status-warn");
    iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    textoEl.textContent = "Atencao! Quase no limite";
    detalheEl.textContent = `Resta apenas ${formatBR(resta)} da sua meta`;
  } else {
    bannerEl.classList.add("status-ok");
    iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    textoEl.textContent = "Dentro do orcamento";
    detalheEl.textContent = `Voce ainda tem ${formatBR(resta)} disponivel`;
  }

  // Category breakdown
  const breakdownEl = document.getElementById("meta-categorias-breakdown");
  breakdownEl.innerHTML = "";
  const cats = agruparPorCategoria(saidas);
  const maxVal = cats.length > 0 ? cats[0].valor : 1;

  for (const cat of cats) {
    const catStyle = CATEGORY_COLORS[cat.nome] || CATEGORY_COLORS["Outros"];
    const catPct = gastoTotal > 0 ? ((cat.valor / gastoTotal) * 100).toFixed(0) : 0;
    const row = document.createElement("div");
    row.className = "meta-cat-row";
    row.innerHTML = `
      <span class="meta-cat-label" style="color:${catStyle.color}">${cat.nome}</span>
      <div class="meta-cat-bar-track">
        <div class="meta-cat-bar-fill" style="width:${catPct}%;background:${catStyle.color}"></div>
      </div>
      <span class="meta-cat-value">${formatBR(cat.valor)}</span>
    `;
    breakdownEl.appendChild(row);
  }
}

// =========================== RENDER: BALANCO MENSAL (BAR CHART) ===========================
function renderBalanca(transacoes) {
  const data = totalsByMonth(transacoes, anoAtual);

  const labels = data.map(d => d.label);
  const entradas = data.map(d => d.entradas);
  const saidas = data.map(d => d.saidas);

  if (chartBalanca) chartBalanca.destroy();

  const ctx = document.getElementById("chart-balanca").getContext("2d");
  chartBalanca = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Entradas",
          data: entradas,
          backgroundColor: "rgba(5, 150, 105, 0.85)",
          hoverBackgroundColor: "rgba(5, 150, 105, 1)",
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.65
        },
        {
          label: "Saidas",
          data: saidas,
          backgroundColor: "rgba(239, 68, 68, 0.85)",
          hoverBackgroundColor: "rgba(239, 68, 68, 1)",
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.65
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0F172A",
          titleFont: { family: "Inter", weight: "700", size: 13 },
          bodyFont: { family: "Inter", weight: "500", size: 12 },
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatBR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "Inter", size: 11, weight: "600" },
            color: "#475569"
          }
        },
        y: {
          grid: { color: "#F1F5F9", drawBorder: false },
          ticks: {
            font: { family: "Inter", size: 11, weight: "600" },
            color: "#475569",
            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v
          },
          beginAtZero: true
        }
      },
      animation: { duration: 800, easing: "easeOutQuart" }
    }
  });
}

// =========================== RENDER: EVOLUCAO DOS GASTOS (LINE CHART) ===========================
function renderEvolucao(transacoes) {
  const now = new Date();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const { saidas } = processarTransacoes(transacoes, mesAtual, anoAtual);

  const gastosPorDia = new Array(diasNoMes).fill(0);
  for (const t of saidas) {
    const d = new Date(t.data).getDate() - 1;
    if (d >= 0 && d < diasNoMes) gastosPorDia[d] += Number(t.valor);
  }

  const acumulado = [];
  let soma = 0;
  for (let i = 0; i < diasNoMes; i++) {
    soma += gastosPorDia[i];
    acumulado.push(soma);
  }

  const limiteMensal = dadosUsuario?.limiteMensal || 0;
  const metaIdeal = [];
  if (limiteMensal > 0) {
    const metaDiaria = limiteMensal / diasNoMes;
    for (let i = 0; i < diasNoMes; i++) {
      metaIdeal.push(metaDiaria * (i + 1));
    }
  } else {
    const maxGasto = Math.max(...acumulado, 1);
    for (let i = 0; i < diasNoMes; i++) {
      metaIdeal.push((maxGasto / diasNoMes) * (i + 1));
    }
  }

  const labels = [];
  for (let i = 1; i <= diasNoMes; i++) {
    labels.push(i.toString());
  }

  if (chartEvolucao) chartEvolucao.destroy();

  const ctx = document.getElementById("chart-evolucao").getContext("2d");
  chartEvolucao = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Gasto real",
          data: acumulado,
          borderColor: "#4F46E5",
          backgroundColor: "rgba(79, 70, 229, 0.1)",
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#4F46E5",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 3
        },
        {
          label: "Meta ideal",
          data: metaIdeal,
          borderColor: "#94A3B8",
          borderDash: [6, 4],
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0F172A",
          titleFont: { family: "Inter", weight: "700", size: 13 },
          bodyFont: { family: "Inter", weight: "500", size: 12 },
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            title: (items) => `Dia ${items[0].label}`,
            label: (ctx) => {
              if (ctx.datasetIndex === 0) return ` Acumulado: ${formatBR(ctx.parsed.y)}`;
              return ` Meta: ${formatBR(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "Inter", size: 10, weight: "600" },
            color: "#475569",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 15
          }
        },
        y: {
          grid: { color: "#F1F5F9", drawBorder: false },
          ticks: {
            font: { family: "Inter", size: 11, weight: "600" },
            color: "#475569",
            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v
          },
          beginAtZero: true
        }
      },
      animation: { duration: 800, easing: "easeOutQuart" }
    }
  });
}

// =========================== RENDER ALL ===========================
function renderAll() {
  if (!dadosUsuario) return;
  const transacoes = dadosUsuario.transacoes || [];
  analisarDisponibilidade(transacoes);
  atualizarDisponibilidade();
  renderDonut(transacoes);
  renderMeta(transacoes);
  renderBalanca(transacoes);
  renderEvolucao(transacoes);
}

// =========================== UI INTERACTIONS ===========================

// Toggle Saida/Entrada
document.getElementById("btn-saidas").addEventListener("click", () => {
  vistaAtual = "saidas";
  document.getElementById("btn-saidas").classList.add("active", "bg-white", "text-rose-600", "shadow-sm");
  document.getElementById("btn-saidas").classList.remove("text-slate-600");
  document.getElementById("btn-entradas").classList.remove("active", "bg-white", "text-emerald-600", "shadow-sm");
  document.getElementById("btn-entradas").classList.add("text-slate-600");
  renderAll();
});

document.getElementById("btn-entradas").addEventListener("click", () => {
  vistaAtual = "entradas";
  document.getElementById("btn-entradas").classList.add("active", "bg-white", "text-emerald-600", "shadow-sm");
  document.getElementById("btn-entradas").classList.remove("text-slate-600");
  document.getElementById("btn-saidas").classList.remove("active", "bg-white", "text-rose-600", "shadow-sm");
  document.getElementById("btn-saidas").classList.add("text-slate-600");
  renderAll();
});

// Month & Year Selector
const dropdown = document.getElementById("mes-selector-dropdown");
const btnAnalisar = document.getElementById("btn-analisar");
const mesTexto = document.getElementById("mes-selecionado-texto");
const anoDisplay = document.getElementById("ano-selecionado");
const btnAnoPrev = document.getElementById("btn-ano-prev");
const btnAnoNext = document.getElementById("btn-ano-next");
const mesesNomes = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function atualizarLabel() {
  mesTexto.textContent = mesesNomes[mesAtual] + " " + anoAtual;
}

btnAnalisar.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target) && e.target !== btnAnalisar && !btnAnalisar.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

btnAnoPrev.addEventListener("click", () => {
  anoAtual--;
  anoDisplay.textContent = anoAtual;
  renderAll();
});

btnAnoNext.addEventListener("click", () => {
  const anoMax = new Date().getFullYear();
  if (anoAtual < anoMax) {
    anoAtual++;
    anoDisplay.textContent = anoAtual;
    renderAll();
  }
});

document.querySelectorAll(".mes-option").forEach(btn => {
  btn.addEventListener("click", () => {
    const m = parseInt(btn.dataset.mes);
    mesAtual = m;
    atualizarLabel();
    dropdown.classList.add("hidden");

    document.querySelectorAll(".mes-option").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    renderAll();
  });
});

// Highlight current month/year on load
(function highlightCurrentMonth() {
  const now = new Date();
  const currentMes = now.getMonth();
  const currentAno = now.getFullYear();
  mesAtual = currentMes;
  anoAtual = currentAno;
  anoDisplay.textContent = currentAno;

  const currentBtn = document.querySelector(`.mes-option[data-mes="${currentMes}"]`);
  if (currentBtn) currentBtn.classList.add("active");
  atualizarLabel();
})();

// Sidebar (same logic as index.html)
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

// Top bar scroll
const topo = document.getElementById("topo");
let lastScroll = 0;
window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;
  if (currentScroll > lastScroll && currentScroll > 80) {
    topo.style.top = "-100px";
  } else {
    topo.style.top = "0";
  }
  lastScroll = currentScroll;
});

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

// =========================== FIREBASE AUTH STATE ===========================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    if (
      window.location.href.includes("login.html") ||
      window.location.href.includes("registrar.html")
    ) {
      window.location.href = "index.html";
      return;
    }

    // Load user profile
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, { saldo: 0, gastos: 0, transacoes: [], nome: "Usuario", limiteMensal: null });
      dadosUsuario = { saldo: 0, gastos: 0, transacoes: [], nome: "Usuario", limiteMensal: null };
    } else {
      dadosUsuario = snap.data();
    }

    // Render profile info
    const nome = dadosUsuario.nome || "Usuario";
    const userNameEl = document.querySelector(".user-name");
    const userEmailEl = document.querySelector(".user-email");
    const userPhotoEl = document.getElementById("user-photo");
    const userInitialsEl = document.getElementById("user-initials");

    if (userNameEl) userNameEl.textContent = nome;
    if (userEmailEl) userEmailEl.textContent = user.email;

    const userPhoto = dadosUsuario.foto || null;
    if (userPhoto) {
      if (userPhotoEl) {
        userPhotoEl.src = userPhoto;
        userPhotoEl.classList.remove("hidden");
        if (userInitialsEl) userInitialsEl.classList.add("hidden");
      }
    } else if (userInitialsEl) {
      userInitialsEl.textContent = nome.split(" ").map(n => n.charAt(0)).join("").substring(0, 2).toUpperCase();
    }

    renderAll();
  } else {
    if (
      !window.location.href.includes("login.html") &&
      !window.location.href.includes("registrar.html")
    ) {
      window.location.href = "login.html";
    }
  }
});
