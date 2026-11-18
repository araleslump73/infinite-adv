// =====================================================================
// motore.js - il cuore del gioco: dati, regole, parser locale
//
// Non disegna nulla e non chiama nessuna AI.
// Contiene:
//   - creazione della partita (bibbia + stato) senza AI
//   - l'elenco chiuso di operazioni che l'AI puo' proporre
//   - il validatore che applica le operazioni allo stato
//   - il parser dei comandi in italiano (gioco senza AI)
//
// Usabile nel browser (window.Motore) e in Node (require("./motore.js")).
// =====================================================================
(function (root) {
  "use strict";

  const VERSIONE = 1;
  const MAX_EFFETTI = 6;
  const MAX_STORIA = 6;

  // ---------------------------------------------------------------- caso
  function rng(seed) {
    let a = 0;
    for (let i = 0; i < String(seed).length; i++) a = (a * 31 + String(seed).charCodeAt(i)) | 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const tra = (rnd, n) => Math.floor(rnd() * n);
  const scegli = (rnd, arr) => arr[tra(rnd, arr.length)];
  const forse = (rnd, p) => rnd() < p;

  // ------------------------------------------------------------- bibbia
  // La bibbia nasce SEMPRE dall'AI (vedi ponte.js): qui c'è solo la bozza
  // minima di emergenza, senza generi predefiniti e senza mondi preconfezionati.
  function nuovaBibbia(idea, nomeGiocatore) {
    const testo = String(idea || "").trim();
    return {
      titolo: testo ? testo.slice(0, 60) : "Avventura senza nome",
      tono: "",
      ambientazione: testo,
      obiettivo: "",
      luogoInizioNome: "",
      ambiente: null,
      meteo: null,
      palette: null,
      luogoInizio: null,
      scenaIniziale: null,
      generata: false,
      giocatoreNome: (nomeGiocatore || "").trim() || "Viandante",
    };
  }

  const AMBIENTI = ["caverna", "foresta", "sala", "corridoio", "esterno", "nave"];
  // atmosfera: l'AI può sceglierla, il motore accetta solo questi valori
  const METEO = ["nessuno", "polvere", "lucciole", "pioggia", "neve", "cenere", "scintille", "nebbia"];

  function testoPulito(v, max) {
    return String(v == null ? "" : v).replace(/[\r\n]+/g, " ").replace(/[\s]+/g, " ").trim().slice(0, max || 300);

  }

  function svgAI(v) {
    return typeof v === "string" && v.length <= 32000 ? v : null;
  }

  function coloreValido(c) {
    return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : null;
  }

  // effetti di scena scelti dall'AI: il programma li applica sopra gli SVG
  const MOTI_CAMERA = ["fermo", "oscilla", "ondeggia", "tremola", "respira"];
  const MOTI_ELEMENTO = ["fermo", "fluttua", "oscilla", "pulsa", "tremola"];

  function numeroIn(v, min, max) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
  }

  function motoElemento(v) {
    return MOTI_ELEMENTO.includes(v) && v !== "fermo" ? v : null;
  }

  // profondità di oggetti e creature nella scena
  const PIANI = ["primo", "medio", "fondo"];
  const MAX_RITOCCHI = 4;
  function pianoElemento(v) {
    return PIANI.includes(v) ? v : null;
  }

  function sanificaAtmosfera(g) {
    if (!g || typeof g !== "object") return null;
    const a = {};
    const luce = numeroIn(g.luce, 0.1, 1);
    if (luce !== null && luce < 1) a.luce = luce;
    for (const [chiave, max] of [["sfocatura", 6], ["nebbia", 1], ["vignetta", 1], ["sfarfallio", 1]]) {
      const n = numeroIn(g[chiave], 0, max);
      if (n) a[chiave] = n;
    }
    const tinta = coloreValido(g.tinta);
    if (tinta) {
      const i = numeroIn(g.intensitaTinta, 0, 0.6);
      a.tinta = tinta;
      a.intensitaTinta = i === null ? 0.25 : i;
    }
    if (MOTI_CAMERA.includes(g.movimento) && g.movimento !== "fermo") {
      const amp = numeroIn(g.ampiezza, 0, 1);
      const vel = numeroIn(g.velocita, 0.2, 3);
      a.movimento = g.movimento;
      a.ampiezza = amp === null ? 0.4 : amp;
      a.velocita = vel === null ? 1 : vel;
    }
    const f = g.fonte;
    if (f && typeof f === "object") {
      const x = numeroIn(f.x, 0, 960);
      const y = numeroIn(f.y, 0, 540);
      const r = numeroIn(f.raggio, 40, 600);
      if (x !== null && y !== null) a.fonte = { x, y, raggio: r === null ? 200 : r };
    }
    return Object.keys(a).length ? a : null;
  }

  // l'AI indica solo ciò che cambia; 0, "fermo" o luce 1 spengono l'effetto
  function unisciAtmosfera(attuale, grezza) {
    const nuova = Object.assign({}, attuale || {}, sanificaAtmosfera(grezza) || {});
    const g = grezza || {};
    for (const k of ["sfocatura", "nebbia", "vignetta", "sfarfallio"]) if (Number(g[k]) === 0) delete nuova[k];
    if (Number(g.luce) >= 1) delete nuova.luce;
    if (Number(g.intensitaTinta) === 0) {
      delete nuova.tinta;
      delete nuova.intensitaTinta;
    }
    if (g.movimento === "fermo") {
      delete nuova.movimento;
      delete nuova.ampiezza;
      delete nuova.velocita;
    }
    if (g.fonte === null) delete nuova.fonte;
    return Object.keys(nuova).length ? nuova : null;
  }

  function sanificaPalette(grezza) {
    if (!grezza || typeof grezza !== "object") return null;
    const p = {};
    for (const chiave of ["cielo", "parete", "pavimento", "accento"]) {
      const c = coloreValido(grezza[chiave]);
      if (c) p[chiave] = c;
    }
    return Object.keys(p).length >= 2 ? p : null;
  }

  const FORME_OGGETTO = ["sfera", "cristallo", "blocco", "anello", "lama", "fiala", "foglio", "contenitore", "organica", "irregolare"];
  const MATERIALI = ["metallo", "pietra", "legno", "vetro", "osso", "tessuto", "energia", "organico"];
  const DETTAGLI_OGGETTO = ["rune", "incisioni", "crepe", "venature", "catene", "spine", "simboli", "pulsante"];
  const ARCHITETTURE = ["naturale", "costruita", "rovinata", "vegetale", "tecnologica", "sacra", "organica", "aperta"];
  const LUCI = ["buia", "fredda", "calda", "diffusa", "controluce", "pulsante"];
  const DETTAGLI_LUOGO = ["archi", "colonne", "radici", "stalattiti", "cristalli", "finestre", "macchinari", "rovine", "acqua", "fiamme", "rune", "catene", "funghi", "ossa", "specchi", "tende", "scale", "statue"];

  function sanificaRicettaOggetto(grezza) {
    if (!grezza || typeof grezza !== "object") return null;
    if (!FORME_OGGETTO.includes(grezza.forma)) return null;
    const dettagli = Array.isArray(grezza.dettagli)
      ? [...new Set(grezza.dettagli.filter((d) => DETTAGLI_OGGETTO.includes(d)))].slice(0, 3)
      : [];
    const n = Number(grezza.luminosita);
    const scala = Number(grezza.scala);
    return {
      forma: grezza.forma,
      materiale: MATERIALI.includes(grezza.materiale) ? grezza.materiale : "pietra",
      colore: coloreValido(grezza.colore) || "#85877f",
      accento: coloreValido(grezza.accento) || "#d4cda9",
      dettagli,
      luminosita: Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0,
      scala: Number.isFinite(scala) ? Math.max(0.65, Math.min(1.6, scala)) : 1,
    };
  }

  function sanificaRicettaLuogo(grezza) {
    if (!grezza || typeof grezza !== "object") return null;
    const dettagli = Array.isArray(grezza.dettagli)
      ? [...new Set(grezza.dettagli.filter((d) => DETTAGLI_LUOGO.includes(d)))].slice(0, 4)
      : [];
    const ricetta = {
      architettura: ARCHITETTURE.includes(grezza.architettura) ? grezza.architettura : null,
      materiale: MATERIALI.includes(grezza.materiale) ? grezza.materiale : null,
      luce: LUCI.includes(grezza.luce) ? grezza.luce : null,
      dettagli,
      palette: sanificaPalette(grezza.palette),
    };
    return ricetta.architettura || ricetta.materiale || ricetta.luce || dettagli.length || ricetta.palette ? ricetta : null;
  }

  function sanitizzaScena(grezza) {
    if (!grezza || typeof grezza !== "object") return null;
    const oggetti = [];
    for (const o of (Array.isArray(grezza.oggetti) ? grezza.oggetti : []).slice(0, 2)) {
      if (o && o.nome) {
        oggetti.push({
          nome: testoPulito(o.nome, 60),
          descrizione: testoPulito(o.descrizione, 200) || "Non lo conosci.",
          tipo: "oggetto",
          aspetto: sanificaRicettaOggetto(o.aspetto),
          svg: svgAI(o.svg),
          moto: motoElemento(o.moto),
          piano: pianoElemento(o.piano),
        });
      }
    }
    const png = [];
    for (const p of (Array.isArray(grezza.png) ? grezza.png : []).slice(0, 2)) {
      if (!p || !p.nome) continue;
      png.push({
        nome: testoPulito(p.nome, 60),
        descrizione: testoPulito(p.descrizione, 200) || "Ti guarda senza dire nulla.",
        ostile: Boolean(p.ostile),
        vita: 3,
        tipo: "persona",
        aspetto: completaAspetto(testoPulito(p.nome, 60), "persona", p.aspetto, Boolean(p.ostile)),
        svg: svgAI(p.svg),
        moto: motoElemento(p.moto),
        piano: pianoElemento(p.piano),
      });
    }
    return oggetti.length || png.length ? { oggetti, png } : null;
  }

  // Prende il JSON dell'AI e restituisce una bibbia sicura da usare.
  function oggettoInScena(o) {
    return { nome: o.nome, descrizione: o.descrizione, tipo: "oggetto", aspetto: o.aspetto || null, svg: o.svg || null, moto: o.moto || null, piano: o.piano || null };
  }

  function pngInScena(p) {
    return {
      nome: p.nome,
      descrizione: p.descrizione,
      ostile: Boolean(p.ostile),
      vita: p.vita || 3,
      tipo: "persona",
      aspetto: p.aspetto || null,
      svg: p.svg || null,
      moto: p.moto || null,
      piano: p.piano || null,
    };
  }

  function sanificaBibbia(grezza, base) {
    const b = Object.assign({}, base || nuovaBibbia(""));
    const g = grezza && typeof grezza === "object" ? grezza : {};
    b.titolo = testoPulito(g.titolo, 70) || b.titolo;
    b.tono = testoPulito(g.tono, 90) || b.tono;
    b.ambientazione = testoPulito(g.ambientazione, 500) || b.ambientazione;
    b.obiettivo = testoPulito(g.obiettivo, 220) || b.obiettivo;
    b.ambiente = AMBIENTI.includes(g.ambiente) ? g.ambiente : b.ambiente;
    b.meteo = METEO.includes(g.meteo) ? g.meteo : b.meteo;
    b.palette = sanificaPalette(g.palette) || b.palette;

    const luogo = g.luogoInizio && typeof g.luogoInizio === "object" ? g.luogoInizio : null;
    const nomeLuogo = testoPulito(luogo && luogo.nome, 70);
    if (nomeLuogo) {
      b.luogoInizio = {
        nome: nomeLuogo,
        descrizione: testoPulito(luogo.descrizione, 500),
        visuale: sanificaRicettaLuogo(luogo.visuale),
        svg: svgAI(luogo.svg),
        primoPiano: svgAI(luogo.primoPiano),
        atmosfera: sanificaAtmosfera(luogo.atmosfera),
      };
      b.luogoInizioNome = nomeLuogo;
    } else if (testoPulito(g.luogoInizioNome, 70)) {
      b.luogoInizioNome = testoPulito(g.luogoInizioNome, 70);
    }
    b.visuale = sanificaRicettaLuogo(g.visuale) || (luogo && sanificaRicettaLuogo(luogo.visuale)) || null;

    b.scenaIniziale = sanitizzaScena(g.scenaIniziale) || b.scenaIniziale;
    b.generata = Boolean(b.titolo && (b.ambiente || b.luogoInizio || b.scenaIniziale));
    return b;
  }

  const VETTORI = { nord: [0, -1], sud: [0, 1], est: [1, 0], ovest: [-1, 0], su: [2, 0], giu: [-2, 0] };
  const OPPOSTI = { nord: "sud", sud: "nord", est: "ovest", ovest: "est", su: "giu", giu: "su" };

  // Unica stanza all'inizio: il mondo cresce con l'AI (crea_luogo),
  // oppure, se l'AI manca, con il ripiego locale minimo.
  function stanzaIniziale(bibbia) {
    const nome = (bibbia.luogoInizio && bibbia.luogoInizio.nome) || bibbia.luogoInizioNome || "Il punto di partenza";
    const descrizione =
      (bibbia.luogoInizio && bibbia.luogoInizio.descrizione) ||
      bibbia.ambientazione ||
      "Ti guardi intorno: non riconosci questo posto.";
    const scena = bibbia.scenaIniziale || { oggetti: [], png: [] };
    return {
      id: "l0",
      nome: nome,
      descrizione: descrizione,
      svg: bibbia.luogoInizio && svgAI(bibbia.luogoInizio.svg),
      primoPiano: (bibbia.luogoInizio && svgAI(bibbia.luogoInizio.primoPiano)) || null,
      atmosfera: (bibbia.luogoInizio && bibbia.luogoInizio.atmosfera) || null,
      uscite: {},
      oggetti: (scena.oggetti || []).map(oggettoInScena),
      png: (scena.png || []).map(pngInScena),
      ambiente: bibbia.ambiente || null,
      meteo: bibbia.meteo || null,
      palette: bibbia.palette || null,
      visuale: bibbia.visuale || (bibbia.luogoInizio && bibbia.luogoInizio.visuale) || null,
      x: 0,
      y: 0,
      visitato: true,
    };
  }

  function creaPartita(opzioni) {
    const opt = opzioni || {};
    const bibbia = opt.bibbia || nuovaBibbia(opt.idea, opt.nome);
    const luoghi = opt.luoghi || { l0: stanzaIniziale(bibbia) };
    const stato = {
      versione: VERSIONE,
      turno: 0,
      bibbiaTitolo: bibbia.titolo,
      giocatore: {
        nome: bibbia.giocatoreNome,
        vita: { attuale: 6, massima: 6 },
        energia: { attuale: 5, massima: 5 },
        inventario: [],
        abilita: ["Osservare", "Parlare"],
      },
      luogo: "l0",
      luoghi,
      flag: {},
      cronaca: [],
      finito: null,
    };
    return { bibbia, stato };
  }

  // ------------------------------------------------------- operazioni
  // Elenco chiuso: tutto il resto viene rifiutato dal motore.
  // -------------------------------------------------------- descrizioni
  function elencoNomi(nomi) {
    if (!nomi.length) return "";
    if (nomi.length === 1) return nomi[0];
    return nomi.slice(0, -1).join(", ") + " e " + nomi[nomi.length - 1];
  }

  function descriviLuogo(stato) {
    const L = stato.luoghi[stato.luogo];
    const parti = [];
    parti.push("**" + L.nome + ".** " + L.descrizione);
    if (L.oggetti.length) parti.push("Vedi: " + elencoNomi(L.oggetti.map((o) => o.nome)) + ".");
    if (L.png.length) {
      parti.push(
        L.png
          .map((p) => p.nome + " è qui" + (p.ostile ? ", e non sembra amichevole" : "") + ". " + p.descrizione)
          .join(" ")
      );
    }
    const direzioni = Object.keys(L.uscite);
    parti.push(direzioni.length ? "Uscite: " + direzioni.join(", ") + "." : "Non vedi vie d'uscita: prova a indicare una direzione.");
    return parti.join(" ");
  }

  function trovaOggetto(stato, nome) {
    const idx = stato.luoghi[stato.luogo].oggetti.findIndex((o) => o.nome === nome);
    return idx >= 0 ? idx : -1;
  }

  function trovaPng(stato, nome) {
    const idx = stato.luoghi[stato.luogo].png.findIndex((p) => p.nome === nome);
    return idx >= 0 ? idx : -1;
  }

  // --------------------------------------------------- stato per l'AI
  function statoCompatto(stato) {
    const L = stato.luoghi[stato.luogo];
    const flag = Object.keys(stato.flag).filter((k) => stato.flag[k]);
    return {
      turno: stato.turno,
      luogo: {
        id: L.id,
        nome: L.nome,
        descrizione: L.descrizione,
        ambiente: L.ambiente || undefined,
        meteo: L.meteo || undefined,
        visuale: L.visuale || undefined,
        atmosfera: L.atmosfera || undefined,
        ritocchi: L.ritocchi && L.ritocchi.length ? L.ritocchi.map((r) => r.nome) : undefined,
        uscite: Object.keys(L.uscite).map((d) => d + "→" + stato.luoghi[L.uscite[d]].nome),
        oggetti: L.oggetti.map((o) => o.nome),
        png: L.png.map((p) => p.nome + (p.ostile ? " (ostile)" : "")),
      },
      giocatore: {
        nome: stato.giocatore.nome,
        vita: stato.giocatore.vita.attuale + "/" + stato.giocatore.vita.massima,
        energia: stato.giocatore.energia.attuale + "/" + stato.giocatore.energia.massima,
        inventario: stato.giocatore.inventario.map((o) => o.nome),
      },
      flag,
      luoghiVisitati: Object.values(stato.luoghi).filter((l) => l.visitato).map((l) => l.nome),
    };
  }

  function bibbiaCompatta(bibbia) {
    return {
      titolo: bibbia.titolo,
      tono: bibbia.tono,
      ambientazione: bibbia.ambientazione,
      obiettivo: bibbia.obiettivo,
      ambiente: bibbia.ambiente || undefined,
      meteo: bibbia.meteo || undefined,
      palette: bibbia.palette || undefined,
      visuale: bibbia.visuale || (bibbia.luogoInizio && bibbia.luogoInizio.visuale) || undefined,
      giocatore: bibbia.giocatoreNome,
    };
  }

  const OPS = {
    vai(a) {
      return typeof a.luogo === "string" && a.luogo ? null : "luogo mancante";
    },
    prendi(a) {
      return typeof a.oggetto === "string" && a.oggetto ? null : "oggetto mancante";
    },
    parla(a) {
      return typeof a.png === "string" && a.png ? null : "png mancante";
    },
    danno(a) {
      return Number.isFinite(Number(a.n)) && Number(a.n) > 0 && Number(a.n) <= 4 ? null : "danno fuori scala (1-4)";
    },
    cura(a) {
      return Number.isFinite(Number(a.n)) && Number(a.n) > 0 && Number(a.n) <= 4 ? null : "cura fuori scala (1-4)";
    },
    energia(a) {
      return Number.isFinite(Number(a.n)) && Math.abs(Number(a.n)) <= 3 ? null : "energia fuori scala (-3..3)";
    },
    crea_oggetto(a) {
      return a.oggetto && a.oggetto.nome ? null : "oggetto senza nome";
    },
    crea_luogo(a) {
      return a.nome && a.direzione && VETTORI[a.direzione] ? null : "luogo senza nome o direzione";
    },
    crea_png(a) {
      return a.png && a.png.nome ? null : "png senza nome";
    },
    imposta_flag(a) {
      return typeof a.chiave === "string" && a.chiave ? null : "flag senza chiave";
    },
    atmosfera(a) {
      return a.atmosfera && typeof a.atmosfera === "object" ? null : "atmosfera mancante";
    },
    ritocco(a) {
      if (typeof a.nome !== "string" || !a.nome.trim()) return "ritocco senza nome";
      return a.rimuovi === true || typeof a.svg === "string" ? null : "ritocco senza svg";
    },
    ridisegna(a) {
      return typeof a.elemento === "string" && a.elemento && typeof a.svg === "string" ? null : "ridisegna senza elemento o svg";
    },
    fine(a) {
      return a.esito ? null : "fine senza esito";
    },
  };

  // L'AI può descrivere l'aspetto di un PNG. Il motore non lo interpreta:
  // lo ripulisce (vocabolario chiuso, limiti numerici) e lo conserva.
  // Se manca o è sbagliato, la grafica sceglie una sagoma dal nome.
  const ASPETTO = {
    archetipi: ["bipede", "quadrupede", "insettoide", "fluttuante", "cosa"],
    parti: {
      teste: ["tonda", "teschio", "allungata", "cristallo", "elmo"],
      occhi: ["tondo", "lente", "fessura", "grappolo", "spirale"],
      bocche: ["nessuna", "zanne", "becco", "masticatore"],
      arti: ["zampe", "artigli", "tentacoli", "ali", "pinne"],
      code: ["", "pungiglione", "frusta", "piume", "cavo"],
      gusci: ["", "corazza", "conchiglia", "placche", "cristallo"],
      ornamenti: ["", "cresta", "corona", "catene", "elmo", "sella", "spine"],
    },
    moti: ["fermo", "strisciare", "camminare", "volare", "pulsare"],
    reazioni: ["nessuna", "seguire", "fuggire", "attaccare"],
    tinte: ["base", "caldo", "freddo", "malato", "metallo"],
    stati: ["integro", "rotto", "marcito", "incandescente"],
    posture: ["fermo", "piegato", "sospeso"],
  };

  // ---------------------------------------------------- ricetta visiva
  // Formato UNICO con cui l'AI descrive una creatura. Il motore lo completa
  // sempre: se l'AI dimentica un campo, si usa il valore di ripiego dedotto
  // dal nome. Così il motore SVG riceve sempre la stessa struttura.
  const CHIAVI_ARCHETIPO = [
    ["cosa", /cristallo|altare|statua|macchina|console|forziere|baule|albero|fungo|pozzanghera|porta|lanterna|pergamena|relitto|torre|colonna|totem|monolite|robot|terminal|ossa|cranio|teschio/i],
    ["insettoide", /ragno|insetto|scaraf|formica|parassita|larva|vespa|mantide|crostaceo|sciame|spora|zecca|verme|cimice|granchio/i],
    ["bipede", /goblin|orco|uomo|figura|guardia|cavaliere|gigante|troll|spettro|elfo|nano|cultista|soldato|sacerdote|mercante|bambin|donna|vecchio|strega|mago|re|regina|fantasma|vagabondo|guardiano|sussurratore/i],
    ["fluttuante", /occhio|spirito|nuvola|sfera|medusa|nebbia|drone|fiamma|fuoco|ombra|vapora|bolla|aura|lucciola/i],
    ["quadrupede", /lupo|cane|bestia|orso|cavallo|felino|gatto|ratto|volpe|capra|cervo|serpe|drago|cinghiale|leone|tigre/i],
  ];

  const PARTI_RIPIEGO = {
    bipede: { teste: "tonda", occhi: "tondo", nOcchi: 2, bocche: "nessuna", arti: "zampe", nArti: 2, code: "", gusci: "", ornamenti: "" },
    quadrupede: { teste: "allungata", occhi: "tondo", nOcchi: 2, bocche: "zanne", arti: "zampe", nArti: 4, code: "frusta", gusci: "", ornamenti: "" },
    insettoide: { teste: "teschio", occhi: "grappolo", nOcchi: 5, bocche: "masticatore", arti: "artigli", nArti: 6, code: "pungiglione", gusci: "corazza", ornamenti: "spine" },
    fluttuante: { teste: "", occhi: "spirale", nOcchi: 3, bocche: "nessuna", arti: "tentacoli", nArti: 4, code: "", gusci: "", ornamenti: "" },
    cosa: { teste: "cristallo", occhi: "lente", nOcchi: 1, bocche: "nessuna", arti: "", nArti: 0, code: "", gusci: "placche", ornamenti: "" },
  };

  const COMPORTAMENTI_RIPIEGO = {
    insettoide: { moto: "strisciare", reazione: "seguire" },
    quadrupede: { moto: "camminare", reazione: "fuggire" },
    bipede: { moto: "camminare", reazione: "nessuna" },
    fluttuante: { moto: "volare", reazione: "seguire" },
    cosa: { moto: "fermo", reazione: "nessuna" },
  };

  function archetipoDaNome(nome, tipo) {
    const testo = String(nome || "") + " " + String(tipo || "");
    for (const [archetipo, re] of CHIAVI_ARCHETIPO) if (re.test(testo)) return archetipo;
    return "quadrupede";
  }

  function intero(v, min, max, difetto) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return difetto;
    return Math.max(min, Math.min(max, n));
  }

  // sempre lo stesso formato, sempre completo
  function completaAspetto(nome, tipo, grezzo, ostile) {
    const a = sanificaAspetto(grezzo) || {};
    const archetipo = ASPETTO.archetipi.includes(a.archetipo) ? a.archetipo : archetipoDaNome(nome, tipo);
    const base = PARTI_RIPIEGO[archetipo];
    const p = a.parti || {};
    const parti = {
      teste: p.teste || base.teste,
      occhi: p.occhi || base.occhi,
      nOcchi: intero(p.nOcchi, 0, 8, base.nOcchi),
      bocche: p.bocche || base.bocche,
      arti: p.arti || base.arti,
      nArti: intero(p.nArti, 0, 6, base.nArti),
      code: p.code == null ? base.code : p.code,
      gusci: p.gusci == null ? base.gusci : p.gusci,
      ornamenti: p.ornamenti == null ? base.ornamenti : p.ornamenti,
    };
    const c = a.comportamento || {};
    const comportamento = {
      moto: c.moto || (ostile ? "camminare" : COMPORTAMENTI_RIPIEGO[archetipo].moto),
      reazione: c.reazione || (ostile ? "attaccare" : COMPORTAMENTI_RIPIEGO[archetipo].reazione),
    };
    const m = a.modificatori || {};
    return {
      archetipo,
      parti,
      comportamento,
      modificatori: {
        tinta: m.tinta || "base",
        stato: m.stato || "integro",
        postura: m.postura || "fermo",
        scala: Number.isFinite(Number(m.scala)) ? Math.max(0.6, Math.min(1.8, Number(m.scala))) : 1,
      },
    };
  }

    function sanificaAspetto(grezzo) {
    if (!grezzo || typeof grezzo !== "object") return null;
    const a = {};
    if (ASPETTO.archetipi.includes(grezzo.archetipo)) a.archetipo = grezzo.archetipo;

    const parti = {};
    const sorgente = grezzo.parti && typeof grezzo.parti === "object" ? grezzo.parti : {};
    for (const categoria of Object.keys(ASPETTO.parti)) {
      if (ASPETTO.parti[categoria].includes(sorgente[categoria])) parti[categoria] = sorgente[categoria];
    }
    for (const [chiave, max] of [["nOcchi", 8], ["nArti", 6]]) {
      const n = Math.round(Number(sorgente[chiave]));
      if (Number.isFinite(n)) parti[chiave] = Math.max(0, Math.min(max, n));
    }
    if (Object.keys(parti).length) a.parti = parti;

    const comp = grezzo.comportamento && typeof grezzo.comportamento === "object" ? grezzo.comportamento : {};
    const comportamento = {};
    if (ASPETTO.moti.includes(comp.moto)) comportamento.moto = comp.moto;
    if (ASPETTO.reazioni.includes(comp.reazione)) comportamento.reazione = comp.reazione;
    if (Object.keys(comportamento).length) a.comportamento = comportamento;

    const mod = grezzo.modificatori && typeof grezzo.modificatori === "object" ? grezzo.modificatori : {};
    const modificatori = {};
    if (ASPETTO.tinte.includes(mod.tinta)) modificatori.tinta = mod.tinta;
    if (ASPETTO.stati.includes(mod.stato)) modificatori.stato = mod.stato;
    if (ASPETTO.posture.includes(mod.postura)) modificatori.postura = mod.postura;
    const scala = Number(mod.scala);
    if (Number.isFinite(scala)) modificatori.scala = Math.max(0.6, Math.min(1.8, scala));
    if (Object.keys(modificatori).length) a.modificatori = modificatori;

    return Object.keys(a).length ? a : null;
  }

  function pulisciNome(v) {
    return String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, 80);
  }

  function ora() {
    return new Date().toISOString();
  }

  function applicaEffetti(stato, effetti) {
    const cambi = [];
    const rifiutati = [];
    const lista = Array.isArray(effetti) ? effetti.slice(0, MAX_EFFETTI) : [];
    if (!lista.length) {
      // un turno senza effetti è comunque un turno che passa
      stato.turno += 1;
      return { cambi, rifiutati: [] };
    }

    for (const eff of lista) {
      if (!eff || typeof eff !== "object") {
        rifiutati.push({ op: "?", motivo: "effetto non valido" });
        continue;
      }
      const op = String(eff.op || "");
      const fn = OPS[op];
      if (!fn) {
        rifiutati.push({ op, motivo: "operazione non ammessa" });
        continue;
      }
      const a = eff;
      const problema = fn(a);
      if (problema) {
        rifiutati.push({ op, motivo: problema });
        continue;
      }
      const L = stato.luoghi[stato.luogo];

      if (op === "vai") {
        const dest = stato.luoghi[a.luogo] || Object.values(stato.luoghi).find((l) => l.nome === a.luogo);
        const idUscita = Object.keys(L.uscite).find((d) => L.uscite[d] === (dest && dest.id));
        if (!dest || !idUscita) {
          rifiutati.push({ op, motivo: `"${pulisciNome(a.luogo)}" non è raggiungibile da qui` });
          continue;
        }
        stato.luogo = dest.id;
        if (!dest.visitato) {
          dest.visitato = true;
          cambi.push(`nuovo luogo: ${dest.nome}`);
        }
      } else if (op === "prendi") {
        const nome = pulisciNome(a.oggetto);
        const idx = trovaOggetto(stato, nome);
        if (idx < 0) {
          rifiutati.push({ op, motivo: `"${nome}" non è qui` });
          continue;
        }
        const [oggetto] = L.oggetti.splice(idx, 1);
        stato.giocatore.inventario.push(oggetto);
        cambi.push(`preso: ${oggetto.nome}`);
      } else if (op === "parla") {
        const nome = pulisciNome(a.png);
        const idx = trovaPng(stato, nome);
        if (idx < 0) {
          rifiutati.push({ op, motivo: `"${nome}" non è qui` });
          continue;
        }
        L.png[idx].haParlato = true;
        if (a.rimuove === true) L.png.splice(idx, 1);
        cambi.push(`parlato con: ${nome}`);
      } else if (op === "danno") {
        const n = Math.min(4, Math.max(1, Math.round(Number(a.n))));
        stato.giocatore.vita.attuale -= n;
        cambi.push(`vita -${n}`);
        if (stato.giocatore.vita.attuale <= 0) {
          if (!stato.flag.ultimaSperanza) {
            stato.flag.ultimaSperanza = true;
            stato.giocatore.vita.attuale = 2;
            stato.giocatore.energia.attuale = 1;
            stato.luogo = "l0";
            cambi.push("ultima possibilità: torni al punto di partenza");
          } else {
            stato.finito = { esito: "sconfitta", testo: "Non ti rialzi questa volta." };
            cambi.push("fine: sconfitta");
          }
        }
      } else if (op === "cura") {
        const n = Math.min(4, Math.max(1, Math.round(Number(a.n))));
        const g = stato.giocatore.vita;
        g.attuale = Math.min(g.massima, g.attuale + n);
        cambi.push(`vita +${n}`);
      } else if (op === "energia") {
        const n = Math.round(Number(a.n));
        const e = stato.giocatore.energia;
        e.attuale = Math.max(0, Math.min(e.massima, e.attuale + n));
        cambi.push(`energia ${n >= 0 ? "+" : ""}${n}`);
      } else if (op === "crea_oggetto") {
        if (L.oggetti.length >= 6) {
          rifiutati.push({ op, motivo: "troppi oggetti in scena" });
          continue;
        }
        L.oggetti.push({
          nome: pulisciNome(a.oggetto.nome),
          descrizione: pulisciNome(a.oggetto.descrizione || "Non sai bene cosa sia."),
          tipo: "oggetto",
          aspetto: sanificaRicettaOggetto(a.oggetto.aspetto),
          svg: svgAI(a.oggetto.svg),
          moto: motoElemento(a.oggetto.moto),
          piano: pianoElemento(a.oggetto.piano),
        });
        cambi.push(`appare: ${pulisciNome(a.oggetto.nome)}`);
      } else if (op === "crea_luogo") {
        if (L.uscite[a.direzione] || Object.keys(stato.luoghi).length >= 24) {
          rifiutati.push({ op, motivo: "uscita occupata o mondo pieno" });
          continue;
        }
        const id = "n" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        const v = VETTORI[a.direzione];
        const scena = sanitizzaScena(a.scena) || { oggetti: [], png: [] };
        const visuale = sanificaRicettaLuogo(a.visuale);
        const nuovo = {
          id,
          nome: pulisciNome(a.nome),
          descrizione: pulisciNome(a.descrizione || "Un luogo che non conoscevi."),
          svg: svgAI(a.svg),
          primoPiano: svgAI(a.primoPiano),
          atmosfera: sanificaAtmosfera(a.atmosfera),
          uscite: { [OPPOSTI[a.direzione]]: L.id },
          oggetti: (scena.oggetti || []).map(oggettoInScena),
          png: (scena.png || []).map(pngInScena),
          ambiente: AMBIENTI.includes(a.ambiente) ? a.ambiente : null,
          meteo: METEO.includes(a.meteo) ? a.meteo : null,
          palette: sanificaPalette(a.palette) || (visuale && visuale.palette) || null,
          visuale,
          x: L.x + v[0],
          y: L.y + v[1],
          visitato: false,
        };
        stato.luoghi[id] = nuovo;
        L.uscite[a.direzione] = id;
        cambi.push(`nuovo passaggio verso: ${nuovo.nome}`);
        if (a.entra === true) {
          nuovo.visitato = true;
          stato.luogo = id;
          cambi.push(`sei in: ${nuovo.nome}`);
        }
      } else if (op === "crea_png") {
        if (L.png.length >= 4) {
          rifiutati.push({ op, motivo: "troppa gente in scena" });
          continue;
        }
        const ostile = Boolean(a.png.ostile);
        const aspetto = completaAspetto(pulisciNome(a.png.nome), "persona", a.png.aspetto, ostile);
        L.png.push({
          nome: pulisciNome(a.png.nome),
          descrizione: pulisciNome(a.png.descrizione || "Ti guarda senza dire nulla."),
          ostile,
          vita: ostile ? 3 : 1,
          tipo: "persona",
          aspetto,
          svg: svgAI(a.png.svg),
          moto: motoElemento(a.png.moto),
          piano: pianoElemento(a.png.piano),
        });
        cambi.push(`compare: ${pulisciNome(a.png.nome)}`);
      } else if (op === "atmosfera") {
        L.atmosfera = unisciAtmosfera(L.atmosfera, a.atmosfera);
        cambi.push("l'atmosfera cambia");
      } else if (op === "ritocco") {
        // variazione dello sfondo: uno strato trasparente sopra quello
        // esistente, così l'AI non deve ridisegnare tutto il luogo
        const nome = pulisciNome(a.nome);
        const lista = (L.ritocchi || []).filter((r) => r.nome !== nome);
        if (a.rimuovi === true) {
          L.ritocchi = lista;
          cambi.push("sparisce: " + nome);
          continue;
        }
        const svg = svgAI(a.svg);
        if (!svg) {
          rifiutati.push({ op, motivo: "svg del ritocco non valido" });
          continue;
        }
        lista.push({ nome, svg });
        L.ritocchi = lista.slice(-MAX_RITOCCHI);
        cambi.push("cambia la scena: " + nome);
      } else if (op === "ridisegna") {
        const nome = pulisciNome(a.elemento);
        const el = L.oggetti.find((o) => o.nome === nome) || L.png.find((p) => p.nome === nome);
        const svg = svgAI(a.svg);
        if (!el || !svg) {
          rifiutati.push({ op, motivo: el ? "svg non valido" : `"${nome}" non è qui` });
          continue;
        }
        el.svg = svg;
        cambi.push("cambia aspetto: " + nome);
      } else if (op === "imposta_flag") {
        stato.flag[pulisciNome(a.chiave)] = a.valore === undefined ? true : a.valore;
        cambi.push(`flag: ${pulisciNome(a.chiave)}`);
      } else if (op === "fine") {
        stato.finito = { esito: pulisciNome(a.esito) || "fine", testo: pulisciNome(a.testo || "") };
        cambi.push("fine della partita");
      }
    }

    stato.turno += 1;
    return { cambi, rifiutati };
  }

  function validaRispostaAI(dati) {
    if (!dati || typeof dati !== "object") return null;
    const narrazione = typeof dati.narrazione === "string" ? dati.narrazione.trim() : "";
    const effetti = Array.isArray(dati.effetti) ? dati.effetti : [];
    if (!narrazione && !effetti.length) return null;
    return { narrazione, effetti, fonte: "ai" };
  }

  // ------------------------------------------------------ parser locale
  const INTENTI = [
    ["inventario", /^(i|inv|inventario|zaino|cosa ho|oggetti|borsa)\b/i],
    ["aiuto", /^(aiuto|help|comandi|\?|cosa posso fare)\b/i],
    ["aspetta", /^(aspetta|attendi|riposa|riposo|dormo|dormi|recupero)\b/i],
    ["guarda", /^(guarda|guardo|osserva|osservo|esamina|esamino|cerca|cerco|ispeziona|ispeziono|vedo|cosa vedo|dove sono)\b/i],
    ["inventario", /^(mostra|elenca)\s+(lo\s+)?(zaino|inventario)\b/i],
    ["vai", /^(vai|vado|muoviti|muovimi|cammina|entra|entrare|prosegui|procedi|dirigiti|torna|scappa|fuggi)\b/i],
    ["prendi", /^(prendi|prendo|raccogli|raccolgo|afferra|afferro|pigila|rubo|porto via)\b/i],
    ["parla", /^(parla|parlo|chiedo|domando|saluto|saluta|dialogo|convinc|minacc|grido|urlo|dico)\b/i],
    ["attacca", /^(attacca|attacco|colpisco|colpire|combatto|uccido|ammazzo|sparo|mena|difendimi)\b/i],
    ["usa", /^(usa|uso|apro|apri|leggo|leggi|bevo|mangio|accendo|premo|spingo|tocco|bacio|disegno)\b/i],
    ["guarda", /^(mi\s+)?(guardo\s+intorno|guard[oa]\s+in\s+giro)/i],
  ];

  const DIREZIONI_PAROLE = {
    nord: ["nord", "n", "avanti", "dritto", "settentrione"],
    sud: ["sud", "s", "indietro", "meridione"],
    est: ["est", "e", "destra", "oriente"],
    ovest: ["ovest", "o", "sinistra", "occidente"],
    su: ["sali", "salire", "sopra", "sù", "scale", "salgo"],
    giu: ["scendi", "scendere", "sotto", "giù", "basso", "scendo"],
  };

  function direzioneDa(testo) {
    const t = testo.toLowerCase();
    for (const dir of Object.keys(DIREZIONI_PAROLE)) {
      for (const p of DIREZIONI_PAROLE[dir]) {
        if (new RegExp("(^|\\s)" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)").test(t)) return dir;
      }
    }
    return null;
  }

  function intentoDa(comando) {
    const t = comando.trim();
    for (const [nome, re] of INTENTI) if (re.test(t)) return nome;
    return null;
  }

  // cerca il nome più simile citato nel comando
  function trovaCitato(comando, nomi) {
    const t = comando.toLowerCase();
    let migliore = null;
    let punteggio = 0;
    for (const nome of nomi) {
      const n = nome.toLowerCase();
      if (t.includes(n)) return nome;
      const parole = n.split(/\s+/).filter((p) => p.length > 3);
      const hit = parole.filter((p) => t.includes(p.slice(0, Math.max(4, p.length - 1)))).length;
      if (parole.length && hit / parole.length > punteggio) {
        punteggio = hit / parole.length;
        migliore = nome;
      }
    }
    return punteggio >= 0.5 ? migliore : null;
  }

  function comando(testo, stato, bibbia) {
    const cmd = String(testo || "").trim();
    const L = stato.luoghi[stato.luogo];
    const rnd = rng(cmd + "|" + stato.turno + "|" + stato.luogo);
    if (!cmd) return { narrazione: "", effetti: [], fonte: "locale" };
    if (stato.finito) {
      return { narrazione: "La storia è finita. Inizia una nuova partita per continuare.", effetti: [], fonte: "locale" };
    }

    const intento = intentoDa(cmd);
    const direzione = direzioneDa(cmd);

    if (intento === "aiuto") {
      return {
        narrazione:
          "Puoi scrivere quello che vuoi. Comandi utili: **guarda**, **vai nord/sud/est/ovest**, " +
          "**prendi <oggetto>**, **parla con <nome>**, **attacca <nome>**, **inventario**, **aspetta**.",
        effetti: [],
        fonte: "locale",
      };
    }

    if (intento === "inventario") {
      const inv = stato.giocatore.inventario.map((o) => o.nome);
      return {
        narrazione: inv.length
          ? `Hai con te: ${elencoNomi(inv)}. Vita ${stato.giocatore.vita.attuale}/${stato.giocatore.vita.massima}, energia ${stato.giocatore.energia.attuale}/${stato.giocatore.energia.massima}.`
          : "Le tue tasche sono vuote.",
        effetti: [],
        fonte: "locale",
      };
    }

    if (intento === "aspetta") {
      const r = forse(rnd, 0.5) ? 2 : 1;
      return {
        narrazione: scegli(rnd, [
          "Ti fermi un momento. Il mondo intorno sembra respirare.",
          "Resti immobile, in ascolto. Nulla si muove, per ora.",
          "Recuperi il fiato e ti guardi le mani.",
        ]),
        effetti: [
          { op: "energia", n: r },
          { op: "cura", n: 1 },
        ],
        fonte: "locale",
      };
    }

    if (intento === "guarda") {
      const dettagli = [];
      const citato = trovaCitato(cmd, [...L.oggetti.map((o) => o.nome), ...L.png.map((p) => p.nome)]);
      if (citato && /\b(esamina|esamino|osserva|osservo|guardo bene|ispeziona)/i.test(cmd)) {
        const o = L.oggetti.find((x) => x.nome === citato);
        const p = L.png.find((x) => x.nome === citato);
        const cosa = o || p;
        return {
          narrazione: `${cosa.nome}: ${cosa.descrizione}`,
          effetti: [],
          fonte: "locale",
        };
      }
      if (citato) dettagli.push(`Ti soffermi su ${citato}.`);
      return { narrazione: [descriviLuogo(stato), ...dettagli].join(" "), effetti: [], fonte: "locale" };
    }

    if (intento === "vai" || direzione) {
      const dir = direzione || null;
      const chiavi = Object.keys(L.uscite);

      // dove non c'è ancora un'uscita, il ripiego locale apre un passaggio
      // essenziale. Di norma è l'AI a inventarlo (crea_luogo), meglio.
      if (dir && !L.uscite[dir]) {
        // nomi neutri: il ripiego locale non inventa mondi "statici", apre solo un varco
        const neutri = { nord: "passaggio a nord", sud: "passaggio a sud", est: "passaggio a est", ovest: "passaggio a ovest", su: "scala verso l'alto", giu: "scala verso il basso" };
        const nome = neutri[dir] || ("passaggio a " + dir);
        return {
          narrazione: scegli(rnd, [
            "Il passaggio non era segnato, ma c'era: ti ci infili e lo spazio cambia intorno a te.",
            "Sposti il velo di polvere e trovi un varco. Oltre, l'aria sa di qualcosa di nuovo.",
            "Prosegui dove prima sembrava non esserci niente, e il mondo si apre.",
          ]),
          effetti: [
            {
              op: "crea_luogo",
              nome: nome,
              descrizione: scegli(rnd, [
                "Un luogo che nessuno ha ancora descritto.",
                "Luce incerta, odore sconosciuto, nessuna traccia di passaggi recenti.",
                "Tutto qui sembra in attesa di essere nominato.",
              ]),
              direzione: dir,
              entra: true,
            },
          ],
          fonte: "locale",
        };
      }

      if (!chiavi.length) {
        return {
          narrazione: "Da qui non si vede nessuna via. Prova a indicare una direzione: nord, sud, est o ovest.",
          effetti: [],
          fonte: "locale",
        };
      }
      let scelta = dir;
      if (!scelta) {
        const nomeCitato = trovaCitato(cmd, Object.values(stato.luoghi).map((l) => l.nome));
        if (nomeCitato) {
          const destinazione = Object.values(stato.luoghi).find((l) => l.nome === nomeCitato);
          const uscita = chiavi.find((d) => L.uscite[d] === destinazione.id);
          if (uscita) scelta = uscita;
        }
      }
      if (!scelta || !L.uscite[scelta]) {
        return {
          narrazione: `Da qui puoi andare verso: ${chiavi.join(", ")}. (Hai scritto "${cmd.trim()}", ma non capisco verso dove.)`,
          effetti: [],
          fonte: "locale",
        };
      }
      const dest = stato.luoghi[L.uscite[scelta]];
      return {
        narrazione: forse(rnd, 0.5)
          ? `Vai verso ${scelta}.`
          : `Ti muovi verso ${scelta}, con ${scegli(rnd, ["cautela", "decisione", "una certa apprensione"])}.`,
        effetti: [{ op: "vai", luogo: dest.id }],
        fonte: "locale",
      };
    }

    if (intento === "prendi") {
      const nome = trovaCitato(cmd, L.oggetti.map((o) => o.nome));
      if (!nome) {
        if (!L.oggetti.length) return { narrazione: "Non c'è niente da prendere qui.", effetti: [], fonte: "locale" };
        return {
          narrazione: `Puoi prendere: ${elencoNomi(L.oggetti.map((o) => o.nome))}. Quale?`,
          effetti: [],
          fonte: "locale",
        };
      }
      return {
        narrazione: scegli(rnd, [
          `Prendi ${nome} e te lo metti in tasca.`,
          `Allunghi la mano e afferri ${nome}.`,
        ]),
        effetti: [{ op: "prendi", oggetto: nome }],
        fonte: "locale",
      };
    }

    if (intento === "parla") {
      const nome = trovaCitato(cmd, L.png.map((p) => p.nome));
      if (!nome) {
        return { narrazione: L.png.length ? `Con chi? Ci sono: ${elencoNomi(L.png.map((p) => p.nome))}.` : "Non c'è nessuno con cui parlare.", effetti: [], fonte: "locale" };
      }
      const p = L.png.find((x) => x.nome === nome);
      const effetti = [{ op: "parla", png: nome }];
      let testo;
      if (p.ostile) {
        testo = scegli(rnd, [
          `Parli a ${nome}, ma la risposta è un ringhio. La distanza tra voi si accorcia.`,
          `${nome} inclina la testa, poi fa un passo verso di te.`,
        ]);
        effetti.push({ op: "danno", n: 1 });
      } else {
        testo = scegli(rnd, [
          `${nome} ti ascolta e mormora qualcosa sul ${scegli(rnd, ["passato", "bosco", "denaro", "nord"])}. Poi indica una direzione.`,
          `${nome} annuisce lentamente. "Non sei il primo che passa di qui", dice.`,
        ]);
        effetti.push({ op: "imposta_flag", chiave: "incontrato:" + nome.toLowerCase(), valore: true });
        effetti.push({ op: "energia", n: 1 });
      }
      return { narrazione: testo, effetti, fonte: "locale" };
    }

    if (intento === "attacca") {
      const nome = trovaCitato(cmd, L.png.map((p) => p.nome));
      if (!nome) {
        return { narrazione: "Non c'è nessuno da attaccare qui.", effetti: [], fonte: "locale" };
      }
      const p = L.png.find((x) => x.nome === nome);
      if (stato.giocatore.energia.attuale <= 0) {
        return { narrazione: "Sei troppo esausto per combattere. Prova ad aspettare un momento.", effetti: [], fonte: "locale" };
      }
      const tiro = 1 + tra(rnd, 6) + (stato.giocatore.inventario.some((o) => /spada|ascia|pugnale|rivoltella|pistola|taglierino|bastone/i.test(o.nome)) ? 2 : 0);
      const effetti = [{ op: "energia", n: -1 }];
      if (tiro >= 4) {
        effetti.push({ op: "parla", png: nome, rimuove: p.vita <= 2 });
        if (p.vita > 2) {
          p.vita -= 2;
          effetti.push({ op: "danno", n: 1 });
        }
        return {
          narrazione: `Colpisci ${nome} (tiro ${tiro}). ${p.vita > 2 ? "Barcolla ma resta in piedi." : "Cede e sparisce tra le ombre."}`,
          effetti,
          fonte: "locale",
        };
      }
      effetti.push({ op: "danno", n: 1 });
      return { narrazione: `Tenti di colpire ${nome} (tiro ${tiro}), ma va male: ti ferisce.`, effetti, fonte: "locale" };
    }

    if (intento === "usa") {
      const citato = trovaCitato(cmd, [...L.oggetti.map((o) => o.nome), ...stato.giocatore.inventario.map((o) => o.nome)]);
      if (!citato) {
        return { narrazione: "Non trovi nulla del genere qui intorno.", effetti: [], fonte: "locale" };
      }
      return {
        narrazione: scegli(rnd, [
          `Usi ${citato}, ma non succede niente di evidente.`,
          `Maneggi ${citato} con attenzione. Il mondo resta in attesa.`,
        ]),
        effetti: [],
        fonte: "locale",
      };
    }

    // comando libero non riconosciuto: il mondo risponde comunque qualcosa
    return {
      narrazione: scegli(rnd, [
        `Provi a "${cmd.trim()}", ma intorno a te nulla cambia.`,
        `Nessuno sembra reagire a "${cmd.trim()}". Forse serve un gesto più concreto.`,
        `Ci pensi su. "${cmd.trim()}" suona bene, ma il mondo non si muove.`,
      ]),
      effetti: [],
      fonte: "locale",
    };
  }

  // "ultima riga" del turno: riassunto meccanico per il giocatore
  function riassuntoCambi(esito) {
    if (!esito || !esito.cambi || !esito.cambi.length) return "";
    return esito.cambi.join(" · ");
  }

  const Motore = {
    VERSIONE,
    MAX_EFFETTI,
    MAX_STORIA,
    AMBIENTI,
    METEO,
    rng,
    nuovaBibbia,
    sanificaBibbia,
    sanificaPalette,
    sanificaRicettaOggetto,
    sanificaRicettaLuogo,
    sanificaAtmosfera,
    unisciAtmosfera,
    MOTI_CAMERA,
    MOTI_ELEMENTO,
    PIANI,
    FORME_OGGETTO,
    MATERIALI,
    DETTAGLI_OGGETTO,
    ARCHITETTURE,
    LUCI,
    DETTAGLI_LUOGO,
    creaPartita,
    stanzaIniziale,
    descriviLuogo,
    statoCompatto,
    bibbiaCompatta,
    applicaEffetti,
    validaRispostaAI,
    comando,
    sanificaAspetto,
    completaAspetto,
    archetipoDaNome,
    ASPETTO,
    riassuntoCambi,
    elencoNomi,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Motore;
  root.Motore = Motore;
})(typeof self !== "undefined" ? self : this);
