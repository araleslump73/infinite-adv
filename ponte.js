// =====================================================================
// ponte.js - collegamento con l'AI (DeepSeek, OpenAI, Ollama, ...)
//
// Usato da server.js (che lo espone al browser) e da prova-ai.js.
// Nessuna dipendenza esterna: solo fetch di Node 18+.
// La chiave API resta qui, mai nella pagina.
// =====================================================================
const fs = require("fs");
const path = require("path");

const PRESET = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    // deepseek-flash è il modello più economico e più veloce (0,30 $/M input, 1,20 $/M output)
    modello: "deepseek-flash",
    variabileChiave: "DEEPSEEK_API_KEY",
    jsonMode: true,
    temperatura: 0.9,
    ragionamento: false, // niente "thinking": -1,7 s per turno e molti meno token
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    modello: "gpt-4o-mini",
    variabileChiave: "OPENAI_API_KEY",
    jsonMode: true,
    temperatura: 0.9,
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    modello: "llama3.2",
    variabileChiave: "",
    jsonMode: true,
    temperatura: 0.9,
  },
};

const COSTI_NOTI = {
  "deepseek/deepseek-flash": { input: 0.3, output: 1.2, valuta: "USD" },
};

function costoTokenConfigurato(config, provider, modello) {
  const c = config && config.costoTokenPerMilione;
  if (
    c &&
    typeof c === "object" &&
    Number.isFinite(c.input) &&
    c.input >= 0 &&
    Number.isFinite(c.output) &&
    c.output >= 0
  ) {
    return {
      input: c.input,
      output: c.output,
      valuta: typeof c.valuta === "string" && /^[A-Z]{3}$/.test(c.valuta) ? c.valuta : "USD",
    };
  }
  return COSTI_NOTI[provider + "/" + modello] || null;
}

function configurazione(radice) {
  const cartella = radice || __dirname;
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(cartella, "config.json"), "utf8"));
  } catch (e) {
    cfg = {};
  }
  const nome = String(cfg.provider || process.env.AI_PROVIDER || "deepseek").toLowerCase();
  const preset = PRESET[nome] || {
    baseUrl: "",
    modello: "",
    variabileChiave: "AI_API_KEY",
    jsonMode: true,
    temperatura: 0.9,
  };
  const baseUrl = (process.env.AI_BASE_URL || cfg.baseUrl || preset.baseUrl || "").replace(/\/+$/, "");
  const modello = process.env.AI_MODEL || cfg.modello || preset.modello || "";
  const chiave =
    process.env.AI_API_KEY ||
    (preset.variabileChiave ? process.env[preset.variabileChiave] : "") ||
    cfg.chiave ||
    "";
  return {
    provider: nome,
    baseUrl,
    modello,
    chiave,
    temperatura: typeof cfg.temperatura === "number" ? cfg.temperatura : preset.temperatura,
    jsonMode: cfg.jsonMode !== undefined ? Boolean(cfg.jsonMode) : preset.jsonMode && !/reasoner/i.test(modello),
    // ragionamento: false = pensiero disattivato (risposte più rapide ed economiche)
    ragionamento: cfg.ragionamento !== undefined ? Boolean(cfg.ragionamento) : preset.ragionamento !== false,
    costoTokenPerMilione: costoTokenConfigurato(cfg, nome, modello),
    attivo: Boolean(baseUrl && modello && (chiave || nome === "ollama")),
  };
}

// estrae il JSON anche se il modello lo incornicia con ```json ... ```
function estraiJSON(testo) {
  if (typeof testo !== "string") return null;
  let t = testo.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const inizio = t.indexOf("{");
  const fine = t.lastIndexOf("}");
  if (inizio < 0 || fine <= inizio) return null;
  const candidato = t.slice(inizio, fine + 1);
  try {
    return JSON.parse(candidato);
  } catch (e) {
    return null;
  }
}

async function chiedi(messaggi, opzioni) {
  const opt = opzioni || {};
  const cfg = opt.cfg || configurazione();
  if (!cfg.attivo) throw new Error("AI non configurata: manca la chiave in config.json");
  const corpo = {
    model: cfg.modello,
    messages: messaggi,
    temperature: typeof opt.temperatura === "number" ? opt.temperatura : cfg.temperatura,
    max_tokens: opt.maxTokens || 450,
    stream: false,
  };
  if (cfg.jsonMode && opt.json !== false) corpo.response_format = { type: "json_object" };
  // DeepSeek V4.1 Flash: senza questo parametro "pensa" per ~2 s in più
  if (cfg.ragionamento === false) corpo.thinking = { type: "disabled" };

  const iniziato = Date.now();
  const intestazioni = { "Content-Type": "application/json" };
  if (cfg.chiave) intestazioni.Authorization = "Bearer " + cfg.chiave;

  async function invia(conJsonMode) {
    const c = Object.assign({}, corpo);
    if (!conJsonMode) delete c.response_format;
    const risposta = await fetch(cfg.baseUrl + "/chat/completions", {
      method: "POST",
      headers: intestazioni,
      body: JSON.stringify(c),
      signal: AbortSignal.timeout(opt.timeoutMs || 9000),
    });
    const testo = await risposta.text();
    if (!risposta.ok) {
      const err = new Error("AI ha risposto " + risposta.status + ": " + testo.slice(0, 300));
      err.stato = risposta.status;
      err.risposta = testo;
      throw err;
    }
    let dati;
    try {
      dati = JSON.parse(testo);
    } catch (e) {
      throw new Error("risposta non JSON da " + cfg.baseUrl + ": " + testo.slice(0, 200));
    }
    const contenuto = dati.choices && dati.choices[0] && dati.choices[0].message && dati.choices[0].message.content;
    return { contenuto, usage: dati.usage || null, ms: Date.now() - iniziato };
  }

  try {
    const r = await invia(corpo.response_format !== undefined);
    return Object.assign(r, { contenutoJSON: estraiJSON(r.contenuto) });
  } catch (e) {
    // alcuni endpoint/modelli rifiutano response_format: si riprova senza
    const rifiutaJsonMode = e.stato === 400 || e.stato === 422 || e.stato === 404;
    if (corpo.response_format && rifiutaJsonMode) {
      const r = await invia(false);
      return Object.assign(r, { contenutoJSON: estraiJSON(r.contenuto), ripetutoSenzaJsonMode: true });
    }
    throw e;
  }
}

// ------------------------------------------------------------ prompt
// Tre livelli di grafica: il giocatore sceglie quanto spendere in token.
//  - testo:    nessun SVG, solo narrazione (costa meno)
//  - base:     SVG semplici a tinte piatte
//  - avanzata: SVG ricchi con sfumature, profondità e un primo piano separato
const LIVELLI = {
  testo: { maxTurno: 1500, maxBibbia: 1800, timeoutTurno: 30000, timeoutBibbia: 45000 },
  base: { maxTurno: 6000, maxBibbia: 7000, timeoutTurno: 30000, timeoutBibbia: 55000 },
  avanzata: { maxTurno: 12000, maxBibbia: 14000, timeoutTurno: 80000, timeoutBibbia: 110000 },
};
const LIVELLO_PREDEFINITO = "avanzata";

function livelloValido(v) {
  return Object.prototype.hasOwnProperty.call(LIVELLI, v) ? v : LIVELLO_PREDEFINITO;
}

const REGOLE_SVG_COMUNI = `Usa SVG statico, senza script, animazioni, CSS, filtri, testo, immagini, link o riferimenti esterni.
Usa solo coordinate assolute, senza transform; colori in esadecimale a 3 o 6 cifre, oppure none.
Ogni SVG deve essere autonomo, con xmlns="http://www.w3.org/2000/svg" e viewBox esattamente quello richiesto.
Non inserire il fondale negli SVG degli oggetti/creature, e non inserire oggetti o creature nello sfondo.
Non scrivere mai codice o markup SVG fuori dalle stringhe JSON.`;

const ISTRUZIONI_SVG = {
  base: `La grafica viene mostrata SOLO dagli SVG che produci tu: non contare su disegni di ripiego del programma.
Sono ammessi solo gli elementi svg, g, path, rect, circle, ellipse, line, polyline, polygon (niente gradienti).
${REGOLE_SVG_COMUNI}
Mantieni gli SVG concisi (idealmente meno di 7000 caratteri ciascuno), validi e ben formati.`,
  avanzata: `La grafica viene mostrata SOLO dagli SVG che produci tu: non contare su disegni di ripiego del programma.
GRAFICA AVANZATA: illustrazioni ricche, curate e d'atmosfera, non schematiche.
Elementi ammessi: svg, g, defs, linearGradient, radialGradient, stop, path, rect, circle, ellipse, line, polyline, polygon.
Gradienti: dentro <defs>, con id brevi (lettere, cifre, - o _), usati come fill="url(#id)" o stroke="url(#id)";
attributi dei gradienti: x1 y1 x2 y2 / cx cy r fx fy, gradientUnits; stop con offset, stop-color, stop-opacity.
Ammessi anche opacity, fill-opacity e stroke-opacity per velature, ombre e riflessi.
${REGOLE_SVG_COMUNI}
Sfondo (960x540): costruiscilo a strati dal lontano al vicino (cielo o soffitto, sfondo lontano, piano medio, terreno vicino),
con prospettiva, luce coerente (zone illuminate e ombre), sfumature e almeno 25-40 forme di dettaglio. Lascia libera la fascia
centrale bassa (y 300-520) da oggetti grandi: lì il programma posa oggetti e creature.
Primo piano ("primoPiano", 960x540, fondo TRASPARENTE): pochi elementi scuri vicinissimi alla camera lungo i bordi
(rami, rocce, colonne, cornici di finestra, cavi, foglie) che incorniciano la scena; il centro deve restare vuoto.
Oggetti e creature (100x100): volumi con luce e ombra (gradienti), contorni leggibili, 10-30 forme.
Limiti: sfondo sotto 20000 caratteri, primo piano sotto 6000, ogni oggetto/creatura sotto 8000. SVG validi e ben formati.`,
};

const SCHEMA_SVG_SCENA = `"svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 960 540\\"><rect width=\\"960\\" height=\\"540\\" fill=\\"#202630\\"/></svg>"`;
const SCHEMA_PRIMO_PIANO = `"primoPiano":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 960 540\\"><path d=\\"M0 0 L120 0 L60 540 L0 540 Z\\" fill=\\"#0a0d10\\"/></svg>"`;
const SCHEMA_PIANO = `"piano":"primo|medio|fondo"`;
const SCHEMA_SVG_ELEMENTO = `"svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 100 100\\"><path d=\\"M20 80 L50 15 L80 80 Z\\" fill=\\"#c8a060\\"/></svg>","moto":"fermo|fluttua|oscilla|pulsa|tremola",${SCHEMA_PIANO}`;
const SCHEMA_ATMOSFERA = `"atmosfera":{"luce":0.5,"sfocatura":0,"tinta":"#3050a0","intensitaTinta":0.2,"nebbia":0,"vignetta":0.4,"sfarfallio":0,"movimento":"fermo|oscilla|ondeggia|tremola|respira","ampiezza":0.3,"velocita":1,"fonte":{"x":480,"y":200,"raggio":220}}`;
const ISTRUZIONI_ATMOSFERA = `Effetti di scena: li applica il programma sopra i tuoi SVG. Sceglili tu in base a ciò che racconta il testo:
- "atmosfera" del luogo: luce 0.1-1 (1 = piena luce, 0.2 = quasi buio); sfocatura 0-6 (foschia, sogno, vista annebbiata);
  tinta "#rrggbb" con intensitaTinta 0-0.6; nebbia 0-1 (sale dal basso); vignetta 0-1 (bordi scuri);
  sfarfallio 0-1 (luce instabile: neon, fiamme, guasti);
  movimento della visuale: fermo, oscilla (drone, nave che rolla), ondeggia (barca, vertigine), tremola (scosse, motori), respira (calma);
  ampiezza 0-1 e velocita 0.2-3 del movimento;
  fonte: punto luminoso facoltativo nelle coordinate 960x540 dello sfondo (lanterna, finestra, schermo) che rischiara il buio intorno.
- "moto" di oggetti e creature: fermo, fluttua, oscilla, pulsa, tremola.
- "piano" di oggetti e creature: primo (vicino, grande), medio, fondo (lontano, piccolo). Distribuiscili su piani diversi.
- Ometti i campi che non servono: una scena normale non ha bisogno di effetti.`;

// pezzi di schema che dipendono dal livello
function pezzi(livello) {
  if (livello === "testo") {
    return {
      grafica: `La grafica è DISATTIVATA: non produrre mai SVG, né i campi "svg", "primoPiano", "atmosfera", "moto" o "piano".`,
      atmosfera: "",
      scena: "",
      luogo: "",
      elemento: "",
      opAtmosfera: "",
      regoleGrafica: "",
    };
  }
  const avanzata = livello === "avanzata";
  return {
    grafica: ISTRUZIONI_SVG[livello],
    atmosfera: ISTRUZIONI_ATMOSFERA,
    scena: "," + SCHEMA_SVG_SCENA + (avanzata ? "," + SCHEMA_PRIMO_PIANO : ""),
    luogo: "," + SCHEMA_SVG_SCENA + (avanzata ? "," + SCHEMA_PRIMO_PIANO : "") + "," + SCHEMA_ATMOSFERA,
    elemento: "," + SCHEMA_SVG_ELEMENTO,
    opAtmosfera: `\n{"op":"atmosfera","atmosfera":{"luce":0.2,"sfarfallio":0.6}}   (cambia gli effetti del luogo attuale: indica solo i campi che cambiano; 0, "fermo" o luce 1 li spengono)
{"op":"ritocco","nome":"porta sfondata","svg":"<svg viewBox=\\"0 0 960 540\\" fondo trasparente, SOLO la parte che cambia>"}   (variazione dello sfondo del luogo attuale; stesso nome = sostituisce)
{"op":"ritocco","nome":"porta sfondata","rimuovi":true}   (toglie un ritocco)
{"op":"ridisegna","elemento":"<nome esatto di un oggetto o creatura presente>","svg":"<svg viewBox=\\"0 0 100 100\\">"}   (solo se il suo aspetto cambia davvero)`,
    regoleGrafica: `
- Se il giocatore va dove non c'è un'uscita, crea il luogo con crea_luogo e il suo SVG di sfondo${avanzata ? " e il suo primo piano" : ""}.
- Ogni nuova creatura e ogni nuovo oggetto devono includere il proprio SVG. Ogni nuovo luogo deve includere il proprio SVG di sfondo.
- La grafica dei luoghi e degli elementi già esistenti è SALVATA dal programma: quando il giocatore torna in un luogo già visitato
  (o resta dove è) NON ridisegnarla e non rimandare SVG. Comunica solo le differenze, e solo se il testo le descrive:
  atmosfera per luce ed effetti, ritocco per un dettaglio dello sfondo che cambia (piccolo SVG trasparente), ridisegna per un elemento che cambia aspetto.
  In STATO ATTUALE, "ritocchi" elenca le variazioni già applicate al luogo.
- Le immagini devono corrispondere al testo e agli elementi descritti; lo sfondo non deve contenere oggetti o creature separati.
- Ogni nuovo luogo deve avere la sua "atmosfera" coerente con la descrizione; se nel turno cambiano luce o stabilità (buio, esplosione, nebbia, scossa) usa l'operazione atmosfera.`,
  };
}

function istruzioniTurno(livello) {
  const p = pezzi(livelloValido(livello));
  return `Sei il narratore di un gioco di ruolo testuale in italiano.
Rispondi SOLO con un oggetto JSON valido, senza markdown, in questo formato:
{"narrazione": "...", "effetti": [...]}

${p.grafica}

${p.atmosfera}

Operazioni ammesse negli effetti (massimo 6, solo quelle necessarie):
{"op":"vai","luogo":"<nome esatto di un'uscita>"}
{"op":"prendi","oggetto":"<nome esatto di un oggetto presente in scena>"}
{"op":"parla","png":"<nome esatto di un personaggio presente>"}
{"op":"danno","n":1}  {"op":"cura","n":1}  {"op":"energia","n":-1}   (n intero, danno/cura 1-4, energia -3..3)
{"op":"crea_oggetto","oggetto":{"nome":"...","descrizione":"..."${p.elemento}}}
{"op":"crea_luogo","nome":"...","descrizione":"...","direzione":"nord|sud|est|ovest",
             "ambiente":"caverna|foresta|sala|corridoio|esterno|nave",
             "meteo":"nessuno|polvere|lucciole|pioggia|neve|cenere|scintille|nebbia","entra":true${p.luogo},
             "scena":{"oggetti":[{"nome":"...","descrizione":"..."${p.elemento}}],
                      "png":[{"nome":"...","descrizione":"...","ostile":false${p.elemento}}]}}
{"op":"crea_png","png":{"nome":"...","descrizione":"...","ostile":true${p.elemento}}}
{"op":"imposta_flag","chiave":"...","valore":true}${p.opAtmosfera}
{"op":"fine","esito":"vittoria|sconfitta|epilogo","testo":"..."}

Regole:
- narrazione: 2-4 frasi, seconda persona singolare, coerente con genere e tono.
- Non inventare luoghi, oggetti o personaggi che non esistono: per aggiungerli usa crea_luogo, crea_oggetto, crea_png.
- Se il giocatore va dove non c'è un'uscita, crea il luogo con crea_luogo.${p.regoleGrafica}
- Seleziona un'azione direzionale riconoscibile anche se l'uscita non è disegnata in modo esplicito.
- Non decidere mai la morte del giocatore: usa solo danno (1-4), il motore gestisce il resto.
- Se l'azione non cambia nulla usa "effetti": [].
- Nessun testo fuori dal JSON.`.replace(/\n{3,}/g, "\n\n");
}

function messaggiTurno(dati) {
  const storia = (dati.storia || [])
    .map((g) => "> " + String(g.comando).slice(0, 200) + "\n" + String(g.narrazione).replace(/\s+/g, " ").slice(0, 300))
    .join("\n");
  return [
    { role: "system", content: istruzioniTurno(dati.livello) },
    {
      role: "user",
      content:
        "AMBIENTAZIONE: " + JSON.stringify(dati.bibbia) + "\n" +
        "STATO ATTUALE: " + JSON.stringify(dati.stato) + "\n" +
        (storia ? "ULTIMI SCAMBI:\n" + storia + "\n" : "") +
        "AZIONE DEL GIOCATORE: " + String(dati.comando).slice(0, 300),
    },
  ];
}

function istruzioniBibbia(livello) {
  const lv = livelloValido(livello);
  const p = pezzi(lv);
  const vincoliGrafica =
    lv === "testo"
      ? ""
      : `
- lo SVG del luogo deve avere viewBox "0 0 960 540" e disegnare l'intero ambiente senza personaggi o oggetti separati.${lv === "avanzata" ? `
- il primoPiano del luogo deve avere viewBox "0 0 960 540", fondo trasparente e solo elementi vicini lungo i bordi.` : ""}
- ogni SVG di oggetto o creatura deve avere viewBox "0 0 100 100", sfondo trasparente e soggetto centrato e interamente visibile.
- ogni oggetto e creatura deve avere un SVG distinto e coerente con nome e descrizione.`;
  return `Sei l'autore di un gioco di ruolo testuale in italiano.
Devi inventare da zero l'inizio di un'avventura, partendo dalla richiesta del giocatore.
Rispondi SOLO con un oggetto JSON valido, senza markdown, in questo formato:
{"titolo":"...","tono":"...","ambientazione":"...","obiettivo":"...",
 "ambiente":"caverna|foresta|sala|corridoio|esterno|nave",
 "meteo":"nessuno|polvere|lucciole|pioggia|neve|cenere|scintille|nebbia",
 "luogoInizio":{"nome":"...","descrizione":"..."${p.luogo}},
 "scenaIniziale":{"oggetti":[{"nome":"...","descrizione":"..."${p.elemento}}],
                  "png":[{"nome":"...","descrizione":"...","ostile":false${p.elemento}}]}}

${p.grafica}

${p.atmosfera}

Vincoli:
- titolo breve ed evocativo; tono in 5-8 parole; ambientazione 2-3 frasi; obiettivo concreto.
- ambiente: scegli quello che si adatta di più alla richiesta; meteo: una parola sola dall'elenco.
- luogoInizio: nome breve e suggestivo + 2-3 frasi che si possano vedere, non solo sentire.
- scenaIniziale: al massimo 2 oggetti e al massimo 2 creature.${vincoliGrafica}
- Stesso stile della richiesta; nessuna persona reale; tutto in italiano; nessun testo fuori dal JSON.`.replace(/\n{3,}/g, "\n\n");
}

function messaggiBibbia(dati) {
  return [
    { role: "system", content: istruzioniBibbia(dati.livello) },
    {
      role: "user",
      content:
        "RICHIESTA DEL GIOCATORE: " + String(dati.idea || "").slice(0, 600) + "\n" +
        "NOME DEL GIOCATORE: " + String(dati.nome || "Viandante").slice(0, 40),
    },
  ];
}

module.exports = { PRESET, LIVELLI, LIVELLO_PREDEFINITO, livelloValido, configurazione, estraiJSON, chiedi, messaggiTurno, messaggiBibbia };