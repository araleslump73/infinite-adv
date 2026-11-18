// =====================================================================
// streaming.js - leggere la narrazione mentre l'AI la scrive
//
// L'AI risponde con un JSON. Per mostrare il testo mentre arriva bisogna
// estrarre il valore di "narrazione" da un JSON incompleto: qui c'è un
// piccolo scanner tollerante (gestisce anche le sequenze di escape).
// =====================================================================

// Testo della narrazione disponibile finora in un JSON (anche troncato).
function narrazioneParziale(testo) {
  const s = String(testo || "");
  const chiave = s.indexOf('"narrazione"');
  if (chiave < 0) return "";
  const duepunti = s.indexOf(":", chiave);
  if (duepunti < 0) return "";
  const apertura = s.indexOf('"', duepunti + 1);
  if (apertura < 0) return "";

  let out = "";
  let i = apertura + 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') break;
    if (c !== "\\") {
      out += c;
      i++;
      continue;
    }
    // sequenza di escape
    const e = s[i + 1];
    if (e === undefined) break; // troncata a metà: si aspetta il resto
    if (e === "n") { out += "\n"; i += 2; continue; }
    if (e === "t") { out += "\t"; i += 2; continue; }
    if (e === "r") { out += "\r"; i += 2; continue; }
    if (e === "b") { out += "\b"; i += 2; continue; }
    if (e === "f") { out += "\f"; i += 2; continue; }
    if (e === '"' || e === "\\" || e === "/") { out += e; i += 2; continue; }
    if (e === "u") {
      const codice = s.slice(i + 2, i + 6);
      if (codice.length < 4) break;
      const n = parseInt(codice, 16);
      if (!Number.isFinite(n)) { i += 2; continue; }
      out += String.fromCharCode(n);
      i += 6;
      continue;
    }
    out += e;
    i += 2;
  }
  return out;
}

// Legge uno stream SSE (OpenAI-compatibile) e restituisce il contenuto completo.
async function leggiStream(risposta, onDelta, limiteMs) {
  const lettore = risposta.body.getReader();
  const decoder = new TextDecoder();
  const iniziato = Date.now();
  let buffer = "";
  let contenuto = "";
  let usage = null;
  let motivoFine = null;

  for (;;) {
    if (limiteMs && Date.now() - iniziato > limiteMs) {
      try { await lettore.cancel(); } catch (e) {}
      throw new Error("stream troppo lungo");
    }
    const { done, value } = await lettore.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let taglio;
    while ((taglio = buffer.indexOf("\n\n")) >= 0) {
      const blocco = buffer.slice(0, taglio);
      buffer = buffer.slice(taglio + 2);
      for (const riga of blocco.split("\n")) {
        if (!riga.startsWith("data:")) continue;
        const dati = riga.slice(5).trim();
        if (!dati || dati === "[DONE]") continue;
        let evento;
        try {
          evento = JSON.parse(dati);
        } catch (e) {
          continue;
        }
        if (evento.usage) usage = evento.usage;
        const scelta = evento.choices && evento.choices[0];
        if (!scelta) continue;
        const pezzo = (scelta.delta && scelta.delta.content) || "";
        if (pezzo) {
          contenuto += pezzo;
          if (onDelta) onDelta(narrazioneParziale(contenuto), contenuto);
        }
        if (scelta.finish_reason) motivoFine = scelta.finish_reason;
      }
    }
  }
  return { contenuto, usage, motivoFine };
}

module.exports = { narrazioneParziale, leggiStream };
