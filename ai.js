// =====================================================================
// ai.js - lato browser: parla con il server locale (/api/...)
//
// - sa se l'AI è configurata (GET /api/stato)
// - rifinisce la bibbia all'inizio (POST /api/nuovo-gioco)
// - chiede un turno (POST /api/turno) con timeout breve
// - mette in cache le azioni ripetute con lo stesso stato
//
// Se il server non c'è (pagina aperta come file) tutto resta in locale.
// =====================================================================
(function (root) {
  "use strict";

  // più lungo dell'attesa mostrata dal gioco (6 s): così la risposta in ritardo
  // può almeno aggiungere una riga di colore, senza toccare lo stato
  // livello di grafica: più dettaglio = più token e risposte più lente.
  // I tempi sono di poco più lunghi di quelli del server (ponte.js LIVELLI).
  const LIVELLI = {
    testo: { turno: 32000, bibbia: 47000 },
    base: { turno: 32000, bibbia: 57000 },
    avanzata: { turno: 82000, bibbia: 112000 },
  };
  const CHIAVE_LIVELLO = "avventura.livelloGrafica";
  let livello = "avanzata";
  try {
    const salvato = root.localStorage && root.localStorage.getItem(CHIAVE_LIVELLO);
    if (LIVELLI[salvato]) livello = salvato;
  } catch (e) {
    /* localStorage non disponibile */
  }

  function impostaLivello(v) {
    if (!LIVELLI[v]) return livello;
    livello = v;
    try {
      root.localStorage.setItem(CHIAVE_LIVELLO, v);
    } catch (e) {
      /* niente */
    }
    return livello;
  }
  const CACHE_MAX = 40;
  const CACHE_TTL = 90000;
  // una risposta così lenta è ormai "vecchia": il gioco ha già deciso in locale
  // e non va riusata per un comando successivo
  const CACHE_SOLO_VELOCI_MS = 5000;

  const info = { ai: false, provider: "", modello: "", motivo: "", limite: 0 };
  const cache = new Map();
  let ultimaLatenza = 0;
  let fallimenti = 0;

  // se il server non c'è (o risponde sempre male) si smette di provarci:
  // il gioco passa in modalità essenziale senza attese inutili
  function registraEsito(ok) {
    if (ok) {
      fallimenti = 0;
      return;
    }
    fallimenti++;
    if (fallimenti >= 2 && info.ai) {
      info.ai = false;
      info.motivo = "server AI non raggiungibile: modalità essenziale";
    }
  }

  async function post(url, dati, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const risposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
        signal: ctrl.signal,
      });
      if (!risposta.ok) throw new Error("HTTP " + risposta.status);
      return await risposta.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function statistiche() {
    if (typeof location !== "undefined" && !/^https?:$/.test(location.protocol)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const risposta = await fetch("/api/statistiche?t=" + Date.now(), {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!risposta.ok) throw new Error("HTTP " + risposta.status);
      const dati = await risposta.json();
      if (!dati || typeof dati !== "object") throw new Error("risposta statistiche non valida");
      return dati;
    } finally {
      clearTimeout(timer);
    }
  }

  async function inizializza() {
    // aperta come file (doppio clic): non c'è nessun server da interrogare
    if (typeof location !== "undefined" && !/^https?:$/.test(location.protocol)) {
      info.ai = false;
      info.motivo = "pagina aperta come file: manca il server locale";
      return info;
    }
    try {
      // file statici, rigenerato da server.js a ogni avvio: nessuna richiesta a endpoint assenti
      const r = await fetch("ai-stato.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      info.ai = Boolean(d.ai);
      info.provider = d.provider || "";
      info.modello = d.modello || "";
      info.limite = d.limite || 0;
      info.motivo = d.ai ? "" : d.motivo || "AI non configurata sul server (manca la chiave)";
    } catch (e) {
      info.ai = false;
      info.motivo = "server non raggiungibile: si gioca in locale";
    }
    return info;
  }

  function chiaveCache(dati) {
    const s = dati.stato || {};
    const l = s.luogo || {};
    const g = s.giocatore || {};
    return JSON.stringify([
      String(dati.comando || "").toLowerCase().trim(),
      dati.livello,
      l.id,
      l.ritocchi,
      l.nome,
      l.oggetti,
      l.png,
      g.vita,
      g.energia,
      g.inventario,
    ]);
  }

  function daCache(chiave) {
    const voce = cache.get(chiave);
    if (!voce) return null;
    if (Date.now() - voce.t > CACHE_TTL) {
      cache.delete(chiave);
      return null;
    }
    return Object.assign({}, voce.risposta, { daCache: true, ms: 0 });
  }

  function inCache(chiave, risposta) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(chiave, { t: Date.now(), risposta });
  }

  async function bibbia(dati) {
    if (!info.ai) return null;
    dati = Object.assign({ livello }, dati);
    try {
      const r = await post("/api/nuovo-gioco", dati, LIVELLI[dati.livello].bibbia);
      const ok = Boolean(r && r.fonte === "ai");
      registraEsito(ok);
      return ok ? r : null;
    } catch (e) {
      registraEsito(false);
      return null;
    }
  }

  async function turno(dati) {
    if (!info.ai) return null;
    dati = Object.assign({ livello }, dati);
    const chiave = chiaveCache(dati);
    const salvata = daCache(chiave);
    if (salvata) return salvata;
    const iniziato = performance.now();
    try {
      const r = await post("/api/turno", dati, LIVELLI[dati.livello].turno);
      ultimaLatenza = Math.round(performance.now() - iniziato);
      if (!r || r.fonte !== "ai") {
        registraEsito(false);
        return null;
      }
      registraEsito(true);
      if (ultimaLatenza < CACHE_SOLO_VELOCI_MS) inCache(chiave, r);
      return r;
    } catch (e) {
      registraEsito(false);
      return null;
    }
  }

  root.AI = {
    LIVELLI,
    impostaLivello,
    get livello() {
      return livello;
    },
    inizializza,
    bibbia,
    turno,
    statistiche,
    info,
    get latenza() {
      return ultimaLatenza;
    },
    svuotaCache() {
      cache.clear();
    },
  };
})(typeof self !== "undefined" ? self : this);
