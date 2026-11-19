// =====================================================================
// server.js - server locale senza dipendenze
//   1. serve i file del gioco (index.html, *.js, *.css)
//   2. POST /api/nuovo-gioco  -> l'AI rifinisce la bibbia del mondo
//   3. POST /api/turno        -> l'AI propone narrazione + effetti
//   4. GET  /api/stato        -> dice al browser se l'AI è pronta
//   5. GET  /api/statistiche  -> token e stima dei costi dall'avvio
//
// La chiave API resta qui, mai nel browser.
// Avvio: node server.js    poi  http://localhost:8080
// =====================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const ponte = require("./ponte.js");

const PORTA = Number(process.env.PORTA || 8080);
const RADICE = __dirname;
const MAX_CHIAMATE = 600; // tetto per processo, evita bollette a sorpresa

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const statistiche = {
  chiamate: 0,
  errori: 0,
  msTotale: 0,
  tokenTotali: 0,
  tokenIngresso: 0,
  tokenUscita: 0,
  tokenSenzaRipartizione: 0,
  chiamateSenzaUso: 0,
};

function cfg() {
  return ponte.configurazione(RADICE);
}

function registraUso(uso) {
  if (!uso || typeof uso !== "object") {
    statistiche.chiamateSenzaUso++;
    return;
  }
  const ingresso = uso.prompt_tokens;
  const uscita = uso.completion_tokens;
  const dettagliValidi =
    Number.isFinite(ingresso) && ingresso >= 0 && Number.isFinite(uscita) && uscita >= 0;
  const totaleUso = uso.total_tokens;
  const totaleValido = Number.isFinite(totaleUso) && totaleUso >= 0;
  if (!dettagliValidi && !totaleValido) {
    statistiche.chiamateSenzaUso++;
    return;
  }

  if (dettagliValidi) {
    statistiche.tokenIngresso += ingresso;
    statistiche.tokenUscita += uscita;
  }
  if (totaleValido) {
    statistiche.tokenTotali += totaleUso;
    if (!dettagliValidi) statistiche.tokenSenzaRipartizione += totaleUso;
  } else if (dettagliValidi) {
    statistiche.tokenTotali += ingresso + uscita;
  }
}

function datiStatistiche() {
  const prezzi = cfg().costoTokenPerMilione;
  const costoStimato =
    prezzi && statistiche.tokenSenzaRipartizione === 0 && statistiche.chiamateSenzaUso === 0
      ? (statistiche.tokenIngresso * prezzi.input + statistiche.tokenUscita * prezzi.output) / 1_000_000
      : null;
  return {
    chiamate: statistiche.chiamate,
    errori: statistiche.errori,
    msMedio: statistiche.chiamate ? Math.round(statistiche.msTotale / statistiche.chiamate) : 0,
    tokenTotali: statistiche.tokenTotali,
    tokenIngresso: statistiche.tokenIngresso,
    tokenUscita: statistiche.tokenUscita,
    tokenSenzaRipartizione: statistiche.tokenSenzaRipartizione,
    chiamateSenzaUso: statistiche.chiamateSenzaUso,
    costoStimato,
    valuta: prezzi ? prezzi.valuta : null,
  };
}

function statoAI() {
  const c = cfg();
  return {
    ai: c.attivo,
    provider: c.provider,
    modello: c.modello,
    jsonMode: c.jsonMode,
    motivo: c.attivo ? "" : "AI non configurata sul server (manca la chiave in config.json)",
    chiamate: statistiche.chiamate,
    limite: MAX_CHIAMATE,
    limiti: Object.fromEntries(Object.entries(ponte.LIVELLI).map(([k, l]) => [k, { turnoMs: l.timeoutTurno, bibbiaMs: l.timeoutBibbia }])),
    versione: 1,
  };
}

// il browser legge questo file statico: niente richieste a endpoint che non
// esistono quando la pagina viene servita da un semplice server di file
function scriviStatoAI() {
  try {
    fs.writeFileSync(path.join(RADICE, "ai-stato.json"), JSON.stringify(statoAI(), null, 2) + "\n");
  } catch (e) {
    /* niente: il gioco funziona lo stesso */
  }
}

function json(ris, codice, dati) {
  const corpo = JSON.stringify(dati);
  ris.writeHead(codice, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(corpo) });
  ris.end(corpo);
}

function leggiCorpo(req, limite) {
  return new Promise((resolve, reject) => {
    let dati = "";
    req.on("data", (pezzo) => {
      dati += pezzo;
      if (dati.length > (limite || 120000)) {
        reject(new Error("richiesta troppo grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(dati ? JSON.parse(dati) : {});
      } catch (e) {
        reject(new Error("JSON non valido nel corpo della richiesta"));
      }
    });
    req.on("error", reject);
  });
}

// --------------------------------------------------------- statico
function fileStatica(url) {
  const pulito = decodeURIComponent(url.split("?")[0]);
  const relativo = pulito === "/" ? "index.html" : pulito.replace(/^\/+/, "");
  const destinazione = path.resolve(RADICE, relativo);
  if (!destinazione.startsWith(RADICE)) return null;
  const consentiti = new Set([".html", ".js", ".css", ".json", ".png", ".svg", ".ico", ".txt", ".md"]);
  if (!consentiti.has(path.extname(destinazione).toLowerCase())) return null;
  if (path.basename(destinazione) === "config.json") return null; // la chiave non esce mai dal server
  return destinazione;
}

function serviFile(req, res) {
  const percorso = fileStatica(req.url);
  if (!percorso) return json(res, 404, { errore: "non trovato" });
  fs.readFile(percorso, (err, dati) => {
    if (err) return json(res, 404, { errore: "non trovato" });
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(percorso).toLowerCase()] || "application/octet-stream",
      "Content-Length": dati.length,
      "Cache-Control": "no-cache",
    });
    res.end(dati);
  });
}

// ------------------------------------------------------------- AI
function sanificaTesto(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 300);
}

async function nuovoGioco(corpo) {
  const conf = cfg();
  if (!conf.attivo) return { fonte: "locale", motivo: "AI non configurata" };
  if (statistiche.chiamate >= MAX_CHIAMATE) {
    return { fonte: "locale", motivo: "limite di chiamate AI raggiunto per questa sessione" };
  }
  try {
    const r = await ponte.generaBibbia(corpo, conf);
    if (r.chiamata) {
      statistiche.chiamate++;
      statistiche.msTotale += r.chiamata.ms;
      registraUso(r.chiamata.usage);
    }
    if (r.errore) statistiche.errori++;
    return r.risposta;
  } catch (e) {
    statistiche.errori++;
    console.warn("[nuovo-gioco] AI non disponibile:", e.message);
    return { fonte: "locale", motivo: e.message.slice(0, 200) };
  }
}

async function turno(corpo) {
  const conf = cfg();
  if (!conf.attivo) return { fonte: "locale", motivo: "AI non configurata" };
  if (statistiche.chiamate >= MAX_CHIAMATE) {
    return { fonte: "locale", motivo: "limite di chiamate AI raggiunto per questa sessione" };
  }
  const comando = sanificaTesto(corpo.comando, 300);
  if (!comando) return { fonte: "locale", motivo: "comando vuoto" };

  try {
    const r = await ponte.generaTurno(Object.assign({}, corpo, { comando }), conf);
    if (r.chiamata) {
      statistiche.chiamate++;
      statistiche.msTotale += r.chiamata.ms;
      registraUso(r.chiamata.usage);
    }
    if (r.errore) statistiche.errori++;
    return r.risposta;
  } catch (e) {
    statistiche.errori++;
    console.warn("[turno] AI non disponibile:", e.message);
    return { fonte: "locale", motivo: e.message.slice(0, 200) };
  }
}

// ----------------------------------------------------------- server
const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  // registro essenziale: serve a capire se il browser sta davvero arrivando
  if (url !== "/ai-stato.json" && url !== "/api/statistiche") {
    console.log(new Date().toLocaleTimeString("it-IT") + "  " + req.method + " " + url + "  da " + (req.socket.remoteAddress || "?"));
  }

  if (req.method === "GET" && url === "/api/stato") {
    const dati = statoAI();
    scriviStatoAI();
    return json(res, 200, dati);
  }

  if (req.method === "GET" && url === "/api/statistiche") {
    return json(res, 200, datiStatistiche());
  }

  if (req.method === "POST" && (url === "/api/turno" || url === "/api/nuovo-gioco")) {
    let corpo;
    try {
      corpo = await leggiCorpo(req);
    } catch (e) {
      return json(res, 400, { errore: e.message });
    }
    const risposta = url === "/api/turno" ? await turno(corpo) : await nuovoGioco(corpo);
    return json(res, 200, risposta);
  }

  if (req.method === "GET") return serviFile(req, res);
  return json(res, 405, { errore: "metodo non permesso" });
});

// spegnendo il server il file dice "AI non pronta": se poi la pagina viene
// aperta da un altro server di file, non prova a chiamare API che non esistono
function spegni() {
  try {
    fs.writeFileSync(path.join(RADICE, "ai-stato.json"), JSON.stringify(Object.assign(statoAI(), { ai: false, motivo: "server spento" }), null, 2) + "\n");
  } catch (e) {}
  process.exit(0);
}
process.on("SIGINT", spegni);
process.on("SIGTERM", spegni);

if (require.main === module) {
  scriviStatoAI();
  server.listen(PORTA, () => {
    const c = cfg();
    console.log("Avventura Infinita su http://localhost:" + PORTA);
    console.log(
      c.attivo
        ? "AI pronta: " + c.provider + " · " + c.modello
        : "AI non configurata (manca la chiave in config.json): si gioca in locale."
    );
  });
}

module.exports = { server, turno, nuovoGioco, statistiche, registraUso, datiStatistiche };
