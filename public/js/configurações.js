// ===================== REINICIO DO SALDO =====================
function abrirReinicio() {
  document.getElementById("menureinicio").style.display = "flex";
}

function fecharReinicio() {
  document.getElementById("menureinicio").style.display = "none";
}

// ===================== METAS =====================
function abrirMetas() {
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
    const lines = e.target.result.split("\n").filter(l => l.trim());
    csvData = [];
    const preview = document.getElementById("csv-preview");
    preview.innerHTML = "";
    const header = lines[0].split(",");
    let html = "<table class='w-full text-xs text-left'><thead class='text-slate-400'>";
    header.forEach(h => { html += `<th class="px-2 py-1">${h.trim()}</th>`; });
    html += "</thead><tbody>";
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
      if (cols.length < 4) continue;
      csvData.push({ data: cols[0], descricao: cols[1], valor: parseFloat(cols[2]), tipo: cols[3] });
      html += `<tr class="border-t border-slate-100">`;
      cols.forEach(c => { html += `<td class="px-2 py-1 text-slate-600">${c}</td>`; });
      html += `</tr>`;
    }
    html += "</tbody></table>";
    preview.innerHTML = html;
    preview.classList.remove("hidden");
  };
  reader.readAsText(file);
}

function confirmarImportacao() {
  if (csvData.length === 0) {
    alert("Selecione um arquivo CSV primeiro.");
    return;
  }
  const transacoes = JSON.parse(localStorage.getItem("transacoes")) || [];
  csvData.forEach(t => {
    transacoes.push({ data: t.data, descricao: t.descricao, valor: t.valor, tipo: t.tipo });
  });
  localStorage.setItem("transacoes", JSON.stringify(transacoes));
  alert(csvData.length + " transações importadas com sucesso!");
  fecharImportar();
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

    updateRangeDisplay(rangeInput.value);
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
