// =====================================================================
// grafica/modello.js - dallo stato del mondo alla scena da disegnare
//
// Il renderer non legge mai lo stato grezzo: legge questo modello.
// Se domani cambia la forma dello stato, cambia solo questo file.
//
// Il modello è deterministico: la stessa stanza produce sempre la stessa
// scena (posizioni, varianti, atmosfera), anche dopo un salvataggio.
// =====================================================================
(function (root) {
  "use strict";

  const req = (n) => (typeof require === "function" && typeof module !== "undefined" ? require(n) : null);
  const Ricette = root.Ricette || req("./ricette.js");
  const Ambienti = root.Ambienti || req("./ambienti.js");
  const Varianti = root.Varianti || req("./varianti.js");
  const Penna = root.Penna || req("./penna.js");

  const AMBIENTI = ["caverna", "foresta", "sala", "corridoio", "esterno", "nave"];

  const CHIAVI_AMBIENTE = [
    ["caverna", /caverna|grotta|cripta|cava|tunnel|sotterran|miniera|abisso|fossa/i],
    ["foresta", /bosco|foresta|selva|radura|albero|giardino|palude|muschio/i],
    ["sala", /sala|salone|teatro|tempio|chiesa|cattedrale|biblioteca|studio|ufficio|stanza/i],
    ["corridoio", /corridoio|scale|ponte|passaggio|galleria|chiostro|atrio/i],
    ["nave", /stiva|modulo|hangar|laboratorio|reattore|stazione|astronave|nave|console|ponte di comando/i],
    ["esterno", /strada|vicolo|piazza|scogliera|sentiero|campo|deserto|riva|porto|mercato|collina/i],
  ];

  const METEO_PER_AMBIENTE = {
    caverna: "polvere",
    foresta: "lucciole",
    sala: "polvere",
    corridoio: "polvere",
    esterno: "nebbia",
    nave: "scintille",
  };

  function ambienteDa(luogo, bibbia) {
    // 1) se il motore/AI l'ha dichiarato, si usa quello
    if (luogo.ambiente && AMBIENTI.includes(luogo.ambiente)) return luogo.ambiente;
    // 2) altrimenti lo si deduce da nome e descrizione
    const testo = String(luogo.nome || "") + " " + String(luogo.descrizione || "");
    for (const [ambiente, re] of CHIAVI_AMBIENTE) if (re.test(testo)) return ambiente;
    // niente indizi nel testo: decide il genere se c'è, altrimenti un interno neutro
    const genere = bibbia && bibbia.genere;
    if (genere) return { fantasy: "foresta", mistero: "esterno", spazio: "nave" }[genere] || "sala";
    return "sala";
  }

  // la palette può arrivare dall'AI (bibbia.luogoInizio / crea_luogo) e
  // sostituisce i colori dell'ambiente mantenendo le tinte di contorno
  function paletteDellaStanza(luogo, ambiente) {
    const base = Ambienti.palette(ambiente);
    const p = (luogo.visuale && luogo.visuale.palette) || luogo.palette;
    if (!p) return base;
    const miscela = (a, b, t) => (Penna && Penna.mischia ? Penna.mischia(a, b, t) : a);
    return {
      cielo1: miscela(base.cielo1, p.cielo || base.cielo1, 0.55),
      cielo2: miscela(base.cielo2, p.cielo || base.cielo2, 0.3),
      parete: p.parete || base.parete,
      pareteScura: miscela(base.pareteScura, p.parete || base.pareteScura, 0.4),
      pavimento: p.pavimento || base.pavimento,
      pavimentoAlt: miscela(base.pavimentoAlt, p.pavimento || base.pavimentoAlt, 0.5),
      accento: p.accento || base.accento,
      nebbia: base.nebbia,
    };
  }

  function meteoDa(ambiente, bibbia) {
    const genere = (bibbia && bibbia.genere) || "fantasy";
    if (ambiente === "esterno" && genere === "mistero") return "pioggia";
    if (ambiente === "foresta" && genere === "spazio") return "scintille";
    return METEO_PER_AMBIENTE[ambiente] || "polvere";
  }

  // posizioni orizzontali: nessun elemento perfettamente al centro, e
  // niente sovrapposizioni fra elementi dello stesso tipo
  function posti(quanti, verso) {
    const base = [-0.85, -0.32, 0.34, 0.86, -0.58, 0.6, 0.02];
    const lista = [];
    for (let i = 0; i < quanti; i++) lista.push(base[i % base.length] * (verso < 0 ? -1 : 1));
    return lista;
  }

  function creaModello(stato, bibbia) {
    const luogo = stato.luoghi[stato.luogo];
    const ambiente = ambienteDa(luogo, bibbia);
    const seme = Varianti.hash32(luogo.id + "|" + luogo.nome);
    const uscite = Object.keys(luogo.uscite).map((direzione) => ({ direzione, verso: luogo.uscite[direzione] }));
    // direzioni ancora senza passaggio: si vedono come archi spenti, e cliccarle
    // chiede all'AI di inventare il luogo (crea_luogo)
    const preferenza = ["nord", "est", "ovest", "sud", "su", "giu"];
    const vieIgnote = preferenza.filter((d) => !luogo.uscite[d]).slice(0, 2);
    const elementi = [];
    // profondità scelta dall'AI (primo/medio/fondo); senza piano resta quella di prima
    const Z_PIANO = { primo: 1.4, medio: 2.2, fondo: 3.4 };
    const profondita = (piano, base, i) => (Z_PIANO[piano] ? Z_PIANO[piano] + i * 0.12 : base);

    const slotOggetti = posti(luogo.oggetti.length, 1);
    luogo.oggetti.forEach((o, i) => {
      elementi.push({
        genere: "oggetto",
        nome: o.nome,
        descrizione: o.descrizione,
        svg: o.svg || null,
        moto: o.moto || null,
        aspetto: o.aspetto || null,
        slot: slotOggetti[i],
        piano: o.piano || null,
        z: profondita(o.piano, 2.05 + i * 0.26, i),
        h: 0.34 + ((seme >> (i * 3)) % 5) * 0.025,
        seme: Varianti.hash32(o.nome),
      });
    });

    const slotPng = posti(luogo.png.length, -1);
    luogo.png.forEach((p, i) => {
      const ricetta = Ricette.creaRicetta(p.nome, p.aspetto || {}, { ostile: p.ostile, tipo: p.tipo });
      elementi.push({
        genere: "creatura",
        nome: p.nome,
        descrizione: p.descrizione,
        ostile: Boolean(p.ostile),
        svg: p.svg || null,
        moto: p.moto || null,
        ricetta,
        slot: slotPng[i],
        piano: p.piano || null,
        z: profondita(p.piano, 2.25 + i * 0.3, i),
        vita: p.vita == null ? 1 : p.vita,
        vitaMax: p.vitaMax || 3,
        h: (ricetta.archetipo === "bipede" ? 0.56 : ricetta.archetipo === "quadrupede" ? 0.46 : ricetta.archetipo === "fluttuante" ? 0.42 : ricetta.archetipo === "cosa" ? 0.44 : 0.42),
        seme: Varianti.hash32(p.nome),
      });
    });

    // dal fondo verso la camera: il disegno è corretto senza z-buffer
    elementi.sort((a, b) => b.z - a.z);

    return {
      id: luogo.id,
      nome: luogo.nome,
      descrizione: luogo.descrizione,
      svg: luogo.svg || null,
      primoPiano: luogo.primoPiano || null,
      ritocchi: Array.isArray(luogo.ritocchi) ? luogo.ritocchi.map((r) => ({ nome: r.nome, svg: r.svg })) : [],
      atmosfera: luogo.atmosfera || null,
      ambiente,
      seme,
      uscite,
      vieIgnote,
      elementi,
      meteo: luogo.meteo || (bibbia && bibbia.meteo) || meteoDa(ambiente, bibbia),
      palette: paletteDellaStanza(luogo, ambiente),
      visuale: luogo.visuale || null,
      varcato: Boolean(luogo.visitato),
    };
  }

  const Modello = { AMBIENTI, ambienteDa, meteoDa, creaModello, posti };
  if (typeof module !== "undefined" && module.exports) module.exports = Modello;
  root.Modello = Modello;
})(typeof self !== "undefined" ? self : this);
