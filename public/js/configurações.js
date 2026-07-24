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
    window._notyf.error("Nenhuma transacao para exportar.");
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

function lerArquivo(input) {
  const file = input.files[0];
  if (!file) return;

  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf") {
    lerPDF(file);
  } else {
    lerCSVArquivo(file);
  }
}

function lerCSVArquivo(file) {
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
    } else if (contentStart.includes("data,hora,tipo")) {
      bancoDetectado = "PicPay";
      csvData = parsePicPayCSV(lines);
    } else if (contentStart.includes(";")) {
      bancoDetectado = "Banco Inter";
      csvData = parseInterCSV(lines);
    } else {
      csvData = parseGenericoCSV(lines);
    }

    exibirPreview(bancoDetectado);
  };
  reader.readAsText(file);
}

async function lerPDF(file) {
  const preview = document.getElementById("csv-preview");
  preview.innerHTML = "<div class='text-xs text-slate-400 mb-2'>Lendo PDF...</div>";
  preview.classList.remove("hidden");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textoCompleto = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items.filter(item => item.str.trim());
      if (items.length === 0) continue;

      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 3) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      let lastY = items[0].transform[5];
      let linha = "";
      for (const item of items) {
        const y = item.transform[5];
        if (Math.abs(y - lastY) > 3) {
          textoCompleto += linha.trim() + "\n";
          linha = "";
        }
        linha += (linha && !linha.endsWith(" ") ? " " : "") + item.str;
        lastY = y;
      }
      if (linha.trim()) textoCompleto += linha.trim() + "\n";
    }

    textoCompleto = textoCompleto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    csvData = [];
    let bancoDetectado = "Desconhecido";

    const textoLower = textoCompleto.toLowerCase();

    if (textoLower.includes("mercado pago") || textoLower.includes("mercadopago")) {
      bancoDetectado = "Mercado Pago";
      csvData = parseMercadoPagoPDF(textoCompleto);
    } else if (textoLower.includes("picpay")) {
      bancoDetectado = "PicPay";
      csvData = parsePicPayPDF(textoCompleto);
    } else if (textoLower.includes("nubank") || textoLower.includes("nu pagamentos") || textoLower.includes("nu investimentos")) {
      bancoDetectado = "Nubank";
      csvData = parseNubankPDF(textoCompleto);
    } else if (textoLower.includes("inter") && (textoLower.includes("banco inter") || textoLower.includes("bancointer"))) {
      bancoDetectado = "Banco Inter";
      csvData = parseInterPDF(textoCompleto);
    } else if (textoLower.includes("itau") || textoLower.includes("itaú") || textoLower.includes("banco itaú")) {
      bancoDetectado = "Itaú";
      csvData = parseItauPDF(textoCompleto);
    } else if (textoLower.includes("banco do brasil") || textoLower.includes("bb ") || textoLower.includes("brasil")) {
      bancoDetectado = "Banco do Brasil";
      csvData = parseBBPDF(textoCompleto);
    } else if (textoLower.includes("bradesco") || textoLower.includes("banco bradesco")) {
      bancoDetectado = "Bradesco";
      csvData = parseBradescoPDF(textoCompleto);
    } else {
      bancoDetectado = "Desconhecido";
      csvData = parseGenericoPDF(textoCompleto);
    }

    exibirPreview(bancoDetectado);
  } catch (err) {
    console.error("Erro ao ler PDF:", err);
    preview.innerHTML = "<div class='text-xs text-red-500 mb-2'>Erro ao ler PDF. Verifique se o arquivo e valido.</div>";
    preview.classList.remove("hidden");
  }
}

function exibirPreview(bancoDetectado) {
  const preview = document.getElementById("csv-preview");
  let html = "<div class='text-xs font-semibold text-violet-600 mb-2'>Banco detectado: " + bancoDetectado + "</div>";
  html += "<table class='w-full text-xs text-left'><thead class='text-slate-400'>";
  html += "<th class='px-2 py-1'>Data</th><th class='px-2 py-1'>Descricao</th><th class='px-2 py-1'>Valor</th><th class='px-2 py-1'>Tipo</th>";
  html += "</thead><tbody>";
  csvData.forEach(t => {
    html += `<tr class="border-t border-slate-100">`;
    html += `<td class="px-2 py-1 text-slate-600">${t.data || ''}</td>`;
    html += `<td class='px-2 py-1 text-slate-600'>${t.descricao || ''}</td>`;
    html += `<td class="px-2 py-1 text-slate-600">${t.valor}</td>`;
    html += `<td class="px-2 py-1 text-slate-600">${t.tipo || ''}</td>`;
    html += `</tr>`;
  });
  html += "</tbody></table>";
  preview.innerHTML = html;
  preview.classList.remove("hidden");
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

function parsePicPayCSV(lines) {
  const transacoes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    fields.push(current.trim());

    if (fields.length < 5) continue;

    const dataRaw = fields[0];
    const tipo = fields[2];
    const origem = fields[3];
    const valorRaw = fields[4];

    if (!dataRaw || !tipo || !valorRaw) continue;

    const dateMatch = dataRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) continue;
    const data = dateMatch[3] + "/" + dateMatch[2] + "/" + dateMatch[1];

    let valorLimpo = valorRaw
      .replace(/R\$\s*/g, "")
      .replace(/\u2212/g, "-")
      .trim();
    const valor = parseValorBR(valorLimpo);
    if (isNaN(valor) || valor === 0) continue;

    const descricao = tipo + (origem ? " - " + origem : "");

    const tipoTransacao = /enviad[oa]|compra|pagamento/i.test(tipo) ? "despesa" : "entrada";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: tipoTransacao,
      fonte: "PicPay"
    });
  }
  return transacoes;
}

function parsePicPayPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  const meses = {
    janeiro: "01", fevereiro: "02", marco: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08",
    setembro: "09", outubro: "10", novembro: "11", dezembro: "12"
  };

  const regexHora = /^\d{2}:\d{2}\s/;
  const regexData = /(\d{1,2})\s+de\s+(\w+)\s+(\d{4})/;
  const regexValor = /[+\u2212-]R\$\s*([\d.,]+)/;

  let dataAtual = null;

  for (let idx = 0; idx < linhas.length; idx++) {
    const linha = linhas[idx];

    if (linha.includes("Documento emitido")) continue;
    if (linha.includes("Hora Tipo Valor")) continue;
    if (linha.includes("CPF:")) continue;
    if (/^Kauan/i.test(linha)) continue;

    const dateMatch = linha.match(regexData);
    if (dateMatch && linha.includes("Saldo")) {
      const mesNum = meses[dateMatch[2].toLowerCase()];
      if (mesNum) {
        dataAtual = dateMatch[1].padStart(2, "0") + "/" + mesNum + "/" + dateMatch[3];
      }
      continue;
    }

    if (!regexHora.test(linha)) continue;

    const valorMatch = linha.match(regexValor);
    if (!valorMatch) continue;

    const antesValor = linha.substring(0, linha.indexOf(valorMatch[0]));
    const tipo = antesValor.replace(/^\d{2}:\d{2}\s+/, "").trim();

    const valor = parseValorBR(valorMatch[1]);
    if (isNaN(valor) || valor === 0) continue;

    const posValor = linha.indexOf(valorMatch[0]) + valorMatch[0].length;
    let descricao = linha.substring(posValor).trim();

    for (let j = idx + 1; j < linhas.length && j <= idx + 3; j++) {
      const proxima = linhas[j];
      if (regexHora.test(proxima)) break;
      if (regexData.test(proxima) && proxima.includes("Saldo")) break;
      if (proxima.includes("Documento emitido")) break;
      if (proxima.includes("Hora Tipo Valor")) break;
      if (proxima.includes("CPF:")) break;
      if (/^Kauan/i.test(proxima)) break;
      descricao += (descricao ? " " : "") + proxima;
    }

    descricao = descricao
      .replace(/\s*Com\s*saldo(\s*\+?\s*cart[aã]o)?\s*$/i, "")
      .replace(/\s*Com\s*cart[aã]o\s*$/i, "")
      .trim();

    if (!descricao) descricao = tipo;

    transacoes.push({
      data: dataAtual,
      descricao: tipo + " - " + descricao,
      valor: valor,
      tipo: /enviad[oa]|compra|pagamento|guardado/i.test(tipo) ? "despesa" : "entrada",
      fonte: "PicPay"
    });
  }
  return transacoes;
}

// ===================== PARSERS PDF =====================

function parseNubankPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  for (const linha of linhas) {
    const regexData = /(\d{2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+\d{4}|\d{2}\/\d{2}\/\d{4})/i;
    const matchData = linha.match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const valorRegex = /(-?\d[\d.,]*\d)/;
    const matchValor = linha.match(valorRegex);
    if (!matchValor) continue;

    const valor = parseValorBR(matchValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha.replace(matchData[0], "").replace(matchValor[0], "").trim();
    descricao = descricao.replace(/\s+/g, " ").replace(/^-/, "").trim();
    if (!descricao) descricao = "Transacao Nubank";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Nubank"
    });
  }
  return transacoes;
}

function parseInterPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  for (const linha of linhas) {
    const regexData = /(\d{2}\/\d{2}\/\d{4})/;
    const matchData = linha.match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const valorRegex = /(-?\d[\d.,]*\d)/;
    const matchValor = linha.match(valorRegex);
    if (!matchValor) continue;

    const valor = parseValorBR(matchValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha.replace(matchData[0], "").replace(matchValor[0], "").trim();
    descricao = descricao.replace(/\s+/g, " ").replace(/^-/, "").trim();
    if (!descricao) descricao = "Transacao Inter";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Banco Inter"
    });
  }
  return transacoes;
}

function parseItauPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  for (const linha of linhas) {
    const regexData = /(\d{2}\/\d{2}\/\d{4})/;
    const matchData = linha.match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const valorRegex = /(-?\d[\d.,]*\d)/;
    const matchValor = linha.match(valorRegex);
    if (!matchValor) continue;

    const valor = parseValorBR(matchValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha.replace(matchData[0], "").replace(matchValor[0], "").trim();
    descricao = descricao.replace(/\s+/g, " ").replace(/^-/, "").trim();
    if (!descricao) descricao = "Transacao Itau";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Itau"
    });
  }
  return transacoes;
}

function parseBBPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  for (const linha of linhas) {
    const regexData = /(\d{2}\/\d{2}\/\d{4})/;
    const matchData = linha.match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const valorRegex = /(-?\d[\d.,]*\d)/;
    const matchValor = linha.match(valorRegex);
    if (!matchValor) continue;

    const valor = parseValorBR(matchValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha.replace(matchData[0], "").replace(matchValor[0], "").trim();
    descricao = descricao.replace(/\s+/g, " ").replace(/^-/, "").trim();
    if (!descricao) descricao = "Transacao BB";

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

function parseBradescoPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  for (const linha of linhas) {
    const regexData = /(\d{2}\/\d{2}\/\d{4})/;
    const matchData = linha.match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const valorRegex = /(-?\d[\d.,]*\d)/;
    const matchValor = linha.match(valorRegex);
    if (!matchValor) continue;

    const valor = parseValorBR(matchValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha.replace(matchData[0], "").replace(matchValor[0], "").trim();
    descricao = descricao.replace(/\s+/g, " ").replace(/^-/, "").trim();
    if (!descricao) descricao = "Transacao Bradesco";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "Bradesco"
    });
  }
  return transacoes;
}

function parseGenericoPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);

  for (const linha of linhas) {
    const regexData = /(\d{2}\/\d{2}\/\d{4})/;
    const matchData = linha.match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const valorRegex = /(-?\d[\d.,]*\d)/;
    const matchValor = linha.match(valorRegex);
    if (!matchValor) continue;

    const valor = parseValorBR(matchValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha.replace(matchData[0], "").replace(matchValor[0], "").trim();
    descricao = descricao.replace(/\s+/g, " ").replace(/^-/, "").trim();
    if (!descricao) descricao = "Transacao";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: valor < 0 ? "despesa" : "entrada",
      fonte: "PDF"
    });
  }
  return transacoes;
}

function parseMercadoPagoPDF(texto) {
  const transacoes = [];
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l);
  const regexData = /(\d{2}-\d{2}-\d{4})/;
  const regexValor = /R\$\s*(-?[\d.,]+)/;

  for (let idx = 0; idx < linhas.length; idx++) {
    const matchData = linhas[idx].match(regexData);
    if (!matchData) continue;

    const data = normalizarData(matchData[1]);
    const linha = linhas[idx];

    const valorMatches = [...linha.matchAll(/R\$\s*(-?[\d.,]+)/g)];
    if (valorMatches.length < 2) continue;

    const valor = parseValorBR(valorMatches[0][1]);
    if (isNaN(valor) || valor === 0) continue;

    let descricao = linha
      .replace(matchData[0], "")
      .replace(/R\$\s*-?[\d.,]+/g, "")
      .replace(/\b(\d{11,})\b/g, "")
      .trim()
      .replace(/\s+/g, " ");

    for (let j = idx + 1; j < linhas.length && j <= idx + 3; j++) {
      const proxima = linhas[j];
      if (regexData.test(proxima)) break;
      if (regexValor.test(proxima)) break;
      if (/^\d{11,}$/.test(proxima)) break;
      if (proxima.includes("Saldo") || proxima.includes("Periodo") || proxima.includes("DETALHE")) break;
      descricao += (descricao ? " " : "") + proxima;
    }

    descricao = descricao
      .replace(/Liber[a-z]*\s*de\s*dinheiro/gi, "Transferencia recebida")
      .replace(/Pagamento\s+com\s+C[oó]digo\s+QR\s*Pix/gi, "Pagamento QR Pix")
      .replace(/Pagamento\s+com\s+C[oó]digo\s+QR/gi, "Pagamento QR")
      .replace(/Pix\s+enviado\s*/gi, "Pix enviado ")
      .replace(/\s+/g, " ")
      .trim();

    if (!descricao) descricao = "Transacao Mercado Pago";

    transacoes.push({
      data: data,
      descricao: descricao,
      valor: valor,
      tipo: /enviad[oa]|transfer[eê]ncia/i.test(descricao) ? "despesa" : "entrada",
      fonte: "Mercado Pago"
    });
  }
  return transacoes;
}

function normalizarData(dataStr) {
  const meses = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };
  dataStr = dataStr.replace(".", "").toLowerCase();

  const matchMes = dataStr.match(/(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/);
  if (matchMes) {
    return matchMes[1] + "/" + meses[matchMes[2]] + "/" + matchMes[3];
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) return dataStr;

  if (/^\d{2}-\d{2}-\d{4}$/.test(dataStr)) return dataStr.replace(/-/g, "/");

  return dataStr;
}

function parseValorBR(valorStr) {
  let limpo = valorStr.replace(/\s/g, "");
  const negativo = limpo.startsWith("-");
  limpo = limpo.replace("-", "");

  if (limpo.includes(",") && limpo.includes(".")) {
    if (limpo.lastIndexOf(",") > limpo.lastIndexOf(".")) {
      limpo = limpo.replace(/\./g, "").replace(",", ".");
    } else {
      limpo = limpo.replace(",", "");
    }
  } else if (limpo.includes(",")) {
    limpo = limpo.replace(",", ".");
  }

  const valor = parseFloat(limpo);
  return negativo ? -Math.abs(valor) : valor;
}

async function confirmarImportacao() {
  console.log("confirmarImportacao chamado, csvData length:", csvData.length);
  if (!csvData || csvData.length === 0) {
    window._notyf?.error("Selecione um arquivo CSV ou PDF primeiro.");
    return;
  }
  if (!window.importarTransacoesCSV) {
    window._notyf?.error("Erro: Firebase ainda nao carregado. Tente novamente em alguns instantes.");
    return;
  }
  try {
    const totalSalvo = await window.importarTransacoesCSV(csvData);
    window._notyf?.success(totalSalvo + " transacoes importadas com sucesso!");
    fecharImportar();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('mc_cache_') || key === 'transacoes')) {
        localStorage.removeItem(key);
      }
    }
    setTimeout(() => { window.location.href = "index.html"; }, 800);
  } catch (err) {
    console.error("Erro na importacao:", err);
    window._notyf?.error("Erro ao importar: " + (err.message || "Verifique se voce esta logado."));
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
    window._notyf.error("A foto deve ter no maximo 2MB.");
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
    window._notyf.error("Digite um nome valido.");
    return;
  }

  localStorage.setItem("userName", nome);

  if (fotoBase64 && window.salvarFotoFirebase) {
    window.salvarFotoFirebase(fotoBase64).catch(err => {
      console.error("Erro ao salvar foto no Firebase:", err);
    });
  }

  window._notyf.success("Perfil atualizado com sucesso!");
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
        window._notyf.error("Selecione um dia.");
        return;
      }
      localStorage.setItem("diaReinicio", dia);
      if (window.salvarDataReinicio) window.salvarDataReinicio(dia);
      window._notyf.success("Dia de reinicio salvo: dia " + dia);
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
        window._notyf.success("Meta de gastos removida!");
      } else {
        localStorage.setItem("metaGastos", limite);
        window._notyf.success("Meta de gastos salva: R$ " + limite);
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
        window._notyf.success("Configuracoes de notificacoes salvas!");
        fecharNotifCard();
      });
    }

    carregarNotificacoes();
  }
});
