// =====================================================================
// ai.js - lato browser: server locale oppure Firebase + chiave autorizzata
//
// - sul sito statico autentica l'invito e legge la chiave AI dal database
// - con il server locale usa gli endpoint /api/...
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
  let modalita = "";
  let database = null;
  let configurazioneAI = null;
  const CHIAVE_STATISTICHE = "avventura.statisticheAI";
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
    if (modalita === "firebase") {
      try {
        return Ponte.riepilogoStatistiche(leggiStatistiche(), Ponte.configurazione({ provider: "deepseek", modello: info.modello }).costoTokenPerMilione);
      } catch (e) {
        console.warn("[statistiche AI] non disponibili:", e.message);
        return null;
      }
    }
    if (modalita !== "server") return null;
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
    const hostLocale =
      typeof location !== "undefined" &&
      (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "[::1]");
    if (hostLocale) {
      try {
        const r = await fetch("ai-stato.json?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          modalita = "server";
          info.modalita = "server";
          info.ai = Boolean(d.ai);
          info.provider = d.provider || "";
          info.modello = d.modello || "";
          info.limite = d.limite || 0;
          info.motivo = d.ai ? "" : d.motivo || "AI non configurata nel server locale";
          return info;
        }
      } catch (e) {
        // Il sito statico non espone ai-stato.json.
      }
    }

    try {
      if (!root.firebase || !root.firebase.initializeApp) throw new Error("Firebase SDK non caricato");
      const cfgRisposta = await fetch("/__/firebase/init.json", { cache: "no-store" });
      if (!cfgRisposta.ok) throw new Error("Configurazione Firebase non trovata");
      const firebaseCfg = await cfgRisposta.json();
      if (!firebaseCfg.databaseURL && firebaseCfg.projectId) {
        firebaseCfg.databaseURL = "https://" + firebaseCfg.projectId + "-default-rtdb.europe-west1.firebasedatabase.app";
      }
      if (!root.firebase.apps.length) root.firebase.initializeApp(firebaseCfg);
      const auth = root.firebase.auth();
      const credenziali = await auth.signInAnonymously();
      database = root.firebase.database();
      const uid = credenziali.user.uid;
      const membro = database.ref("members/" + uid);
      let codice = "";
      try {
        codice = root.localStorage.getItem("avventura.codiceInvito") || "";
      } catch (e) {
        codice = "";
      }

      async function verificaCodice(valore) {
        const normalizzato = String(valore || "").trim().toLowerCase().replace(/[.$#\[\]\/]/g, "_").slice(0, 64);
        if (!normalizzato) return false;
        await membro.set(normalizzato);
        await database.ref("gate").once("value");
        codice = normalizzato;
        try {
          root.localStorage.setItem("avventura.codiceInvito", codice);
        } catch (e) {
          /* il codice è riutilizzabile anche senza memoria locale */
        }
        return true;
      }

      function chiediCodice() {
        return new Promise((resolve) => {
          const overlay = document.createElement("div");
          overlay.className = "ai-invito";
          const scheda = document.createElement("section");
          scheda.className = "ai-invito-scheda";
          const titolo = document.createElement("h2");
          titolo.textContent = "Accesso amici";
          const descrizione = document.createElement("p");
          descrizione.textContent = "Inserisci il codice invito di Tavolo Amici per attivare l'AI. La chiave AI è condivisa e visibile a tutti gli invitati.";
          const form = document.createElement("form");
          const campo = document.createElement("input");
          campo.type = "password";
          campo.autocomplete = "current-password";
          campo.maxLength = 64;
          campo.placeholder = "Codice invito";
          campo.setAttribute("aria-label", "Codice invito");
          const errore = document.createElement("p");
          errore.className = "ai-invito-errore";
          errore.setAttribute("aria-live", "polite");
          const entra = document.createElement("button");
          entra.type = "submit";
          entra.className = "primario";
          entra.textContent = "Entra";
          const locale = document.createElement("button");
          locale.type = "button";
          locale.className = "fantasma";
          locale.textContent = "Continua senza AI";
          let finito = false;
          const chiudi = (valore) => {
            if (finito) return;
            finito = true;
            overlay.remove();
            resolve(valore);
          };
          form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            errore.textContent = "";
            entra.disabled = true;
            try {
              if (!await verificaCodice(campo.value)) {
                errore.textContent = "Inserisci il codice invito.";
                entra.disabled = false;
                return;
              }
              chiudi(true);
            } catch (e) {
              if (/permission/i.test(String(e.code || e.message || e))) {
                errore.textContent = "Codice non valido o regole Firebase non ancora configurate.";
              } else {
                errore.textContent = "Firebase non raggiungibile: " + String(e.message || e).slice(0, 100);
              }
              entra.disabled = false;
              campo.select();
            }
          });
          locale.addEventListener("click", () => chiudi(false));
          form.append(campo, errore, entra);
          scheda.append(titolo, descrizione, form, locale);
          overlay.append(scheda);
          document.body.append(overlay);
          campo.focus();
        });
      }

      if (codice) {
        try {
          await verificaCodice(codice);
        } catch (e) {
          if (!/permission/i.test(String(e.code || e.message || e))) throw e;
          codice = "";
          try {
            root.localStorage.removeItem("avventura.codiceInvito");
          } catch (x) {
            /* niente */
          }
        }
      }
      if (!codice) codice = (await chiediCodice()) ? "verificato" : "";
      if (!codice) throw new Error("Serve un codice invito valido per leggere la chiave AI.");

      const chiaveSnap = await database.ref("avventuraAI/deepseek/apiKey").once("value");
      const chiave = chiaveSnap.val();
      if (typeof chiave !== "string" || !chiave.trim()) {
        throw new Error("Chiave AI non configurata in Firebase: avventuraAI/deepseek/apiKey.");
      }
      const cfgAI = Ponte.configurazione({
        provider: "deepseek",
        modello: "deepseek-flash",
        chiave: chiave.trim(),
        ragionamento: false,
      });
      if (!cfgAI.attivo) throw new Error("Configurazione AI incompleta in Firebase.");
      configurazioneAI = cfgAI;
      modalita = "firebase";
      info.modalita = "firebase";
      info.ai = true;
      info.provider = cfgAI.provider;
      info.modello = cfgAI.modello;
      info.limite = 0;
      info.motivo = "";
    } catch (e) {
      info.ai = false;
      info.motivo = e && e.message ? e.message : "Firebase o AI non disponibili";
    }
    return info;
  }

  function leggiStatistiche() {
    try {
      const s = JSON.parse(root.localStorage.getItem(CHIAVE_STATISTICHE) || "null");
      return s && typeof s === "object" ? s : Ponte.nuoveStatistiche();
    } catch (e) {
      return Ponte.nuoveStatistiche();
    }
  }

  function registraChiamata(r) {
    if (!r || !r.chiamata) return;
    const s = leggiStatistiche();
    s.chiamate++;
    s.msTotale += r.chiamata.ms || 0;
    if (r.errore) s.errori++;
    Ponte.registraUso(s, r.chiamata.usage);
    try {
      root.localStorage.setItem(CHIAVE_STATISTICHE, JSON.stringify(s));
    } catch (e) {
      console.warn("[statistiche AI] impossibile salvare:", e.message);
    }
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
    if (modalita === "firebase") {
      try {
        const r = await Ponte.generaBibbia(dati, configurazioneAI);
        registraChiamata(r);
        return r.risposta && r.risposta.fonte === "ai" ? r.risposta : null;
      } catch (e) {
        console.warn("[nuovo-gioco] AI non disponibile:", e.message);
        return null;
      }
    }
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
    if (modalita === "firebase") {
      try {
        const esito = await Ponte.generaTurno(dati, configurazioneAI);
        ultimaLatenza = Math.round(performance.now() - iniziato);
        registraChiamata(esito);
        if (!esito.risposta || esito.risposta.fonte !== "ai") {
          registraEsito(false);
          return null;
        }
        registraEsito(true);
        if (ultimaLatenza < CACHE_SOLO_VELOCI_MS) inCache(chiave, esito.risposta);
        return esito.risposta;
      } catch (e) {
        console.warn("[turno] AI non disponibile:", e.message);
        registraEsito(false);
        return null;
      }
    }
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
