// =====================================================================
// prova-server-finto.js - server di prova: serve il gioco e finge un'AI
// lenta o che sbaglia, per verificare il ritorno al motore locale.
//
//   MODO=lento  node prova-server-finto.js     (risponde dopo 7 s)
//   MODO=rotto  node prova-server-finto.js     (effetti non validi)
//   MODO=nulla  node prova-server-finto.js     (HTTP 500 sempre)
//   poi apri http://localhost:8099
// =====================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORTA = Number(process.env.PORTA || 8099);
const MODO = process.env.MODO || "lento";
const RADICE = __dirname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

const RISPOSTE = {
  lento: {
    fonte: "ai",
    narrazione: "NARRAZIONE_IN_RITARDO: arriva dopo il timeout, non deve cambiare lo stato.",
    effetti: [{ op: "crea_oggetto", oggetto: { nome: "oggetto fantasma", descrizione: "Mai esistito." } }],
    ms: 7000,
  },
  rotto: {
    fonte: "ai",
    narrazione: "Narrazione con effetti impossibili.",
    effetti: [
      { op: "esplodi", n: 99 },
      { op: "vai", luogo: "un-luogo-che-non-esiste" },
      { op: "danno", n: 40 },
      { op: "cura", n: 1 },
    ],
  },
};

http
  .createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/ai-stato.json") {
      const corpo = JSON.stringify({ ai: true, provider: "finto", modello: "finto-" + MODO, motivo: "", limite: 999, versione: 1 });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(corpo);
    }
    if (url === "/api/turno" || url === "/api/nuovo-gioco") {
      req.resume();
      return req.on("end", () => {
        if (MODO === "nulla") {
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end('{"errore":"guasto simulato"}');
        }
        const attesa = MODO === "lento" && url === "/api/turno" ? 7000 : 0;
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          if (url === "/api/nuovo-gioco") return res.end(JSON.stringify({ fonte: "ai", bibbia: {}, ms: 1 }));
          res.end(JSON.stringify(RISPOSTE[MODO] || RISPOSTE.rotto));
        }, attesa);
      });
    }
    const rel = url === "/" ? "index.html" : url.replace(/^\/+/, "");
    const file = path.resolve(RADICE, rel);
    if (!file.startsWith(RADICE)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (e, d) => {
      if (e) {
        res.writeHead(404);
        return res.end("non trovato");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(d);
    });
  })
  .listen(PORTA, () => console.log("server finto (" + MODO + ") su http://localhost:" + PORTA));
