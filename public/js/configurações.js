// ===================== REINICIO DO SALDO =====================
function abrirReinicio() {
  document.getElementById("menureinicio").style.display = "flex";
}

function fecharReinicio() {
  document.getElementById("menureinicio").style.display = "none";
}

// ===================== METAS =====================
async function abrirMetas() {
  if (window.getLimiteMensal) {
    const limite = await window.getLimiteMensal();
    const rangeInput = document.getElementById("limit-range");
    const displayValue = document.getElementById("display-value");
    const manualInput = document.getElementById("manual-input");
    const noLimit = document.getElementById("no-limit");
    if (rangeInput) rangeInput.value = limite;
    if (displayValue) displayValue.textContent = limite;
    if (manualInput) manualInput.value = limite;
    if (noLimit) {
      noLimit.checked = false;
      rangeInput.disabled = false;
      manualInput.disabled = false;
      rangeInput.style.opacity = "1";
      manualInput.style.opacity = "1";
    }
    const pct = (limite / (rangeInput?.max || 2000)) * 100;
    if (rangeInput) rangeInput.style.background = `linear-gradient(to right, #6366F1 ${pct}%, #E0E0E0 ${pct}%)`;
  }
  document.getElementById("menumetas").style.display = "flex";
}

function fecharMetas() {
  document.getElementById("menumetas").style.display = "none";
}

// ===================== NOTIFICACOES =====================
function abrirNotifCard() {
  document.getElementById("notifcard").style.display = "flex";
}

function fecharNotifCard() {
  document.getElementById("notifcard").style.display = "none";
}

// ===================== EXPORTAR =====================
function exportarHistorico() {
  const transacoes = JSON.parse(localStorage.getItem("transacoes")) || [];
  if (transacoes.length === 0) {
    alert("Nenhuma transação para exportar.");
    return;
  }
  let csv = "Data,Descrição,Valor,Tipo\n";
  transacoes.forEach(t => {
    csv += `${t.data},"${t.descricao}",${t.valor},${t.tipo}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico_moneycontrol.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ===================== IMPORTAR =====================
let csvData = [];

function abrirImportar() {
  csvData = [];
  const preview = document.getElementById("csv-preview");
  if (preview) { preview.innerHTML = ""; preview.classList.add("hidden"); }
  const input = document.getElementById("input-csv");
  if (input) input.value = "";
  document.getElementById("menuimportar").style.display = "flex";
}

function fecharImportar() {
  document.getElementById("menuimportar").style.display = "none";
}

function lerCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const lines = content.split("\n").filter(l => l.trim());
    csvData = [];
    const preview = document.getElementById("csv-preview");
    preview.innerHTML = "";

    const contentStart = content.substring(0, 500);
    let bancoDetectado = "Desconhecido";

    if (contentStart.includes("Data;Data de Balancete") || contentStart.includes("Histórico;Documento;Valor")) {
      bancoDetectado = "Itaú";
      csvData = parseItauCSV(lines);
    } else if (contentStart.includes("Data,Valor,Identificador")) {
      bancoDetectado = "Nubank";
      csvData = parseNubankCSV(lines);
    } else if (contentStart.includes('"Lan') && contentStart.includes('"Valor"')) {
      bancoDetectado = "Banco do Brasil";
      csvData = parseBBCSV(lines);
    } else if (contentStart.includes("Crédito") && contentStart.includes("Débito")) {
      bancoDetectado = "Bradesco";
      csvData = parseBradescoCSV(lines);
    } else if (contentStart.includes(";")) {
      bancoDetectado = "Banco Inter";
      csvData = parseInterCSV(lines);
    } else {
      csvData = parseGenericoCSV(lines);
    }

    let html = "<div class='text-xs font-semibold text-violet-600 mb-2'>Banco detectado: " + bancoDetectado + "</div>";
    html += "<table class='w-full text-xs text-left'><thead class='text-slate-400'>";
    html += "<th class='px-2 py-1'>Data</th><th class='px-2 py-1'>Descrição</th><th class='px-2 py-1'>Valor</th><th class='px-2 py-1'>Tipo</th>";
    html += "</thead><tbody>";
    csvData.forEach(t => {
      html += `<tr class="border-t border-slate-100">`;
      html += `<td class="px-2 py-1 text-slate-600">${t.data || ''}</td>`;
      html += `<td class="px-2 py-1 text-slate-600">${t.descricao || ''}</td>`;
      html += `<td class="px-2 py-1 text-slate-600">${t.valor}</td>`;
      html += `<td class="px-2 py-1 text-slate-600">${t.tipo || ''}</td>`;
      html += `</tr>`;
    });
    html += "</tbody></table>";
    preview.innerHTML = html;
    preview.classList.remove("hidden");
  };
  reader.readAsText(file);
}

function parseInterCSV(lines) {
  const transacoes = [];
  let rowCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].split(";");
    rowCount++;
    if (rowCount <= 5) continue;

    const data_lancamento = row[0] ? row[0].trim() : null;
    const descricaoCompleta = row[2] ? row[2].trim() : "Transação Inter";
    let valor_str = row[3];

    if (!data_lancamento || !valor_str) continue;

    let valor_numerico;
    try {
      valor_numerico = parseFloat(valor_str.replace(",", "."));
    } catch (e) { continue; }
    if (isNaN(valor_numerico)) continue;

    const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(\d{3}\.\d{3}|\d{11}|Conta|Agência|\s*$))/i;
    const match = descricaoCompleta.match(regex);
    let descricaoSimplificada = descricaoCompleta;
    if (match && match[1] && match[2]) {
      descricaoSimplificada = match[1].trim() + " - " + match[2].trim();
    } else if (descricaoCompleta.includes("Débito Automático") || descricaoCompleta.includes("Pagamento de Boleto")) {
      descricaoSimplificada = descricaoCompleta.split("-")[0].trim();
    }

    transacoes.push({
      data: data_lancamento,
      descricao: descricaoSimplificada,
      valor: valor_numerico,
      tipo: valor_numerico < 0 ? "despesa" : "entrada",
      fonte: "Banco Inter"
    });
  }
  return transacoes;
}

function parseNubankCSV(lines) {
  const transacoes = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const data_lancamento = row[0] ? row[0].trim() : null;
    let valor_str = row[1];
    const descricaoCompleta = row[3] ? row[3].trim() : "";
    let valor_numerico = parseFloat(valor_str);

    if (!data_lancamento || isNaN(valor_numerico)) continue;

    let descricaoSimplificada = descricaoCompleta || "Transação Nubank";
    descricaoSimplificada = descricaoSimplificada.replace(/compra com débito\s*-\s*/i, "").replace(/compra no crédito\s*-\s*/i, "").trim();

    const regex = /^(.*?)\s*-\s*([^-]+?)(?=\s*-\s*(?:\d{3}\.\d{3}|NU PAGAMENTOS|Conta|Ag[eê]ncia|IP|\d{2,}|\w{2}$|\s*$))/i;
    const match = descricaoSimplificada.match(regex);
    if (match && match[1] && match[2]) {
      descricaoSimplificada = match[1].trim() + " - " + match[2].trim();
    } else {
      const partes = descricaoSimplificada.split(" - ");
      if (partes.length >= 2) descricaoSimplificada = partes[0] + " - " + partes[1];
    }

    const lastSep = descricaoSimplificada.lastIndexOf(" - ");
    const pedacoFinal = descricaoSimplificada.slice(lastSep + 3);
    if (lastSep !== -1 && pedacoFinal.length <= 20 && /[A-Za-z]{2,}/.test(pedacoFinal)) {
      descricaoSimplificada = descricaoSimplificada.slice(0, lastSep);
    }
    if (!descricaoSimplificada) descricaoSimplificada = "Transação Nubank";

    transacoes.push({
      data: data_lancamento,
      descricao: descricaoSimplificada,
      valor: valor_numerico,
      tipo: valor_numerico < 0 ? "despesa" : "entrada",
      fonte: "Nubank"
    });
  }
  return transacoes;
}

function parseItauCSV(lines) {
  const transacoes = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(";");
    const data = row[0] ? row[0].trim() : null;
    const historico = row[2] ? row[2].trim() : "Transação Itaú";
    let valorStr = row[4];
    const tipo = row[5] ? row[5].trim() : null;

    if (!data || !valorStr) continue;

    let valor = parseFloat(valorStr.replace(".", "").replace(",", "."));
    if (isNaN(valor)) continue;

    if (tipo === "D") valor = -Math.abs(valor);
    if (tipo === "C") valor = Math.abs(valor);

    transacoes.push({
      data: data,
      descricao: historico,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Itaú"
    });
  }
  return transacoes;
}

function parseBBCSV(lines) {
  const transacoes = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const data = row[0] ? row[0].trim().replace(/"/g, "") : null;
    const lancamento = row[1] ? row[1].trim().replace(/"/g, "") : "Transação BB";
    const detalhes = row[2] ? row[2].trim().replace(/"/g, "") : "";
    let valorStr = row[4] ? row[4].trim().replace(/"/g, "") : null;

    if (!data || !valorStr) continue;
    if (data === "00/00/0000") continue;

    let valor = parseFloat(valorStr.replace(".", "").replace(",", "."));
    if (isNaN(valor)) continue;

    let descricao = lancamento;
    if (detalhes && detalhes.length > 3) {
      const nomeMatch = detalhes.match(/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+(.+)/);
      if (nomeMatch) {
        descricao = lancamento + " - " + nomeMatch[1].trim();
      }
    }

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Banco do Brasil"
    });
  }
  return transacoes;
}

function parseBradescoCSV(lines) {
  const transacoes = [];
  for (let i = 2; i < lines.length; i++) {
    const row = lines[i].split(";");
    const data = row[0] ? row[0].trim() : null;
    const historico = row[1] ? row[1].trim() : "Transação Bradesco";
    const creditoStr = row[3] ? row[3].trim() : "";
    const debitoStr = row[4] ? row[4].trim() : "";

    if (!data) continue;

    let valor = 0;
    if (creditoStr && creditoStr !== " ") {
      valor = parseFloat(creditoStr.replace(/\./g, "").replace(",", "."));
    } else if (debitoStr && debitoStr !== " ") {
      valor = -Math.abs(parseFloat(debitoStr.replace(/\./g, "").replace(",", ".")));
    }

    if (isNaN(valor)) continue;

    transacoes.push({
      data: data,
      descricao: historico,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Bradesco"
    });
  }
  return transacoes;
}

function parseGenericoCSV(lines) {
  const transacoes = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 4) continue;
    const valor = parseFloat(cols[2]);
    if (isNaN(valor)) continue;
    transacoes.push({
      data: cols[0],
      descricao: cols[1],
      valor: valor,
      tipo: cols[3] || (valor < 0 ? "despesa" : "entrada"),
      fonte: "CSV"
    });
  }
  return transacoes;
}

async function confirmarImportacao() {
  if (csvData.length === 0) {
    alert("Selecione um arquivo CSV primeiro.");
    return;
  }
  if (!window.importarTransacoesCSV) {
    alert("Erro: Firebase ainda não carregado. Tente novamente em alguns instantes.");
    return;
  }
  try {
    const totalSalvo = await window.importarTransacoesCSV(csvData);
    alert(totalSalvo + " transações importadas com sucesso!");
    fecharImportar();
  } catch (err) {
    console.error("Erro na importação:", err);
    alert("Erro ao importar: " + (err.message || "Verifique se você está logado."));
  }
}

// ===================== PERFIL =====================
let fotoBase64 = null;

function abrirPerfil() {
  const fotoEl = document.getElementById("perfil-foto");
  const iniciaisEl = document.getElementById("perfil-iniciais");
  const nomeInput = document.getElementById("input-nome-perfil");
  const emailInput = document.getElementById("input-email-perfil");

  const nome = localStorage.getItem("userName") || "Usuário";
  const email = localStorage.getItem("userEmail") || "";
  fotoBase64 = localStorage.getItem("userPhoto");

  nomeInput.value = nome;
  emailInput.value = email;

  if (fotoBase64) {
    fotoEl.src = fotoBase64;
    fotoEl.classList.remove("hidden");
    iniciaisEl.classList.add("hidden");
  } else {
    fotoEl.classList.add("hidden");
    iniciaisEl.classList.remove("hidden");
    iniciaisEl.textContent = nome.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
  }

  document.getElementById("menuperfil").style.display = "flex";
}

function fecharPerfil() {
  document.getElementById("menuperfil").style.display = "none";
}

function carregarFoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("A foto deve ter no máximo 2MB.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    fotoBase64 = e.target.result;
    const fotoEl = document.getElementById("perfil-foto");
    const iniciaisEl = document.getElementById("perfil-iniciais");
    fotoEl.src = fotoBase64;
    fotoEl.classList.remove("hidden");
    iniciaisEl.classList.add("hidden");
  };
  reader.readAsDataURL(file);
}

function salvarPerfil() {
  const nome = document.getElementById("input-nome-perfil").value.trim();
  if (!nome) {
    alert("Digite um nome válido.");
    return;
  }

  localStorage.setItem("userName", nome);

  if (fotoBase64 && window.salvarFotoFirebase) {
    window.salvarFotoFirebase(fotoBase64).catch(err => {
      console.error("Erro ao salvar foto no Firebase:", err);
    });
  }

  alert("Perfil atualizado com sucesso!");
  fecharPerfil();
}

// ===================== DOM READY =====================
document.addEventListener("DOMContentLoaded", () => {

  // --- Reinicio: botoes de dia ---
  const diasGrid = document.querySelector(".dias-grid");
  const selectDia = document.getElementById("dia-reinicio");
  const menuReinicio = document.getElementById("menureinicio");

  if (diasGrid && selectDia) {
    const botoes = diasGrid.querySelectorAll(".day-btn");

    function ativarBotao(btn) {
      botoes.forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
    }

    diasGrid.addEventListener("click", (e) => {
      if (e.target.classList.contains("day-btn")) {
        ativarBotao(e.target);
        selectDia.value = e.target.textContent;
      }
    });

    selectDia.addEventListener("change", () => {
      botoes.forEach(btn => {
        if (btn.textContent === selectDia.value) {
          ativarBotao(btn);
        }
      });
    });

    menuReinicio.querySelector(".btn-salvar").addEventListener("click", () => {
      const dia = selectDia.value;
      if (!dia) {
        alert("Selecione um dia.");
        return;
      }
      localStorage.setItem("diaReinicio", dia);
      if (window.salvarDataReinicio) window.salvarDataReinicio(dia);
      alert("Dia de reinício salvo: dia " + dia);
      fecharReinicio();
    });

    const diaSalvo = localStorage.getItem("diaReinicio");
    if (diaSalvo) {
      selectDia.value = diaSalvo;
      botoes.forEach(btn => {
        if (btn.textContent === diaSalvo) ativarBotao(btn);
      });
    }

    // Carregar do Firestore se disponível
    if (window.carregarDataReinicio) {
      window.carregarDataReinicio().then((dia) => {
        if (dia) {
          selectDia.value = String(dia);
          botoes.forEach(btn => {
            if (btn.textContent === String(dia)) ativarBotao(btn);
          });
        }
      });
    }
  }

  // --- Fechar reinicio pelo botao voltar ---
  const btnBackReinicio = menuReinicio ? menuReinicio.querySelector("a[href='config.html']") : null;
  if (btnBackReinicio) {
    btnBackReinicio.addEventListener("click", (e) => {
      e.preventDefault();
      fecharReinicio();
    });
  }

  // --- Metas: range + input ---
  const rangeInput = document.getElementById("limit-range");
  const displayValue = document.getElementById("display-value");
  const manualInput = document.getElementById("manual-input");
  const noLimitCheckbox = document.getElementById("no-limit");

  if (rangeInput && displayValue && manualInput) {
    function updateRangeDisplay(value) {
      displayValue.textContent = value;
      const pct = (value / rangeInput.max) * 100;
      rangeInput.style.background = `linear-gradient(to right, #6366F1 ${pct}%, #E0E0E0 ${pct}%)`;
      manualInput.value = value;
    }

    rangeInput.addEventListener("input", () => updateRangeDisplay(rangeInput.value));

    manualInput.addEventListener("input", () => {
      let val = Math.min(Math.max(manualInput.value, 0), 10000);
      rangeInput.value = val;
      updateRangeDisplay(val);
    });

    if (noLimitCheckbox) {
      noLimitCheckbox.addEventListener("change", () => {
        const disabled = noLimitCheckbox.checked;
        rangeInput.disabled = disabled;
        manualInput.disabled = disabled;
        displayValue.textContent = disabled ? "Sem limite" : rangeInput.value;
        rangeInput.style.opacity = disabled ? "0.5" : "1";
        manualInput.style.opacity = disabled ? "0.5" : "1";
      });
    }
  }

  // --- Salvar meta ---
  const btnSalvarMeta = document.getElementById("btn-salvar-meta");
  if (btnSalvarMeta) {
    btnSalvarMeta.addEventListener("click", () => {
      const semLimite = document.getElementById("no-limit").checked;
      const limite = document.getElementById("display-value").textContent;
      if (semLimite) {
        localStorage.removeItem("metaGastos");
        alert("Meta de gastos removida!");
      } else {
        localStorage.setItem("metaGastos", limite);
        alert("Meta de gastos salva: R$ " + limite);
      }
      fecharMetas();
    });
  }

  // --- Notificacoes ---
  const chk50 = document.getElementById("chk50");
  const chk80 = document.getElementById("chk80");
  const chk100 = document.getElementById("chk100");
  const chkNone = document.getElementById("chkNone");
  const btnSalvarNotif = document.getElementById("btn-salvar-nofif");

  if (chk50 && chk80 && chk100 && chkNone) {
    function carregarNotificacoes() {
      const data = JSON.parse(localStorage.getItem("notificacoes")) || {
        chk50: true, chk80: true, chk100: true, chkNone: false
      };
      chk50.checked = data.chk50;
      chk80.checked = data.chk80;
      chk100.checked = data.chk100;
      chkNone.checked = data.chkNone;
    }

    function atualizarDesativar() {
      if (chkNone.checked) {
        chk50.checked = false;
        chk80.checked = false;
        chk100.checked = false;
      } else if (!chk50.checked && !chk80.checked && !chk100.checked) {
        chkNone.checked = true;
      }
    }

    chkNone.addEventListener("change", atualizarDesativar);
    [chk50, chk80, chk100].forEach(chk => chk.addEventListener("change", atualizarDesativar));

    if (btnSalvarNotif) {
      btnSalvarNotif.addEventListener("click", () => {
        localStorage.setItem("notificacoes", JSON.stringify({
          chk50: chk50.checked, chk80: chk80.checked,
          chk100: chk100.checked, chkNone: chkNone.checked
        }));
        alert("Configurações de notificações salvas!");
        fecharNotifCard();
      });
    }

    carregarNotificacoes();
  }
});
