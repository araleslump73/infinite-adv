// =====================================================================
// grafica/ricette.js - da un nome (e da qualche suggerimento dell'AI) a
// una ricetta di creatura valida: archetipo, parti, comportamento.
//
// Regola: qualunque cosa arrivi viene normalizzata. Se l'AI scrive
// "licantropo di nebbia" con parti inventate, il motore sceglie
// l'archetipo più vicino e riempie le prese valide: si disegna sempre.
// =====================================================================
(function (root) {
  "use strict";

  const Parti = (typeof require === "function" && typeof module !== "undefined") ? require("./parti.js") : root.Parti;
  const Varianti = (typeof require === "function" && typeof module !== "undefined") ? require("./varianti.js") : root.Varianti;

  const MOTI = ["fermo", "strisciare", "camminare", "volare", "pulsare"];
  const REAZIONI = ["nessuna", "seguire", "fuggire", "attaccare"];

  const CHIAVI_ARCHETIPO = [
    ["cosa", /cristallo|altare|statua|macchina|console|forziere|baule|albero|fungo|pozzanghera|porta|lanterna|pergamena|relitto|torre|colonna|totem|monolite|robot|terminal/i],
    ["insettoide", /ragno|insetto|scaraf|formica|parassita|larva|vespa|mantide|crostaceo|sciame|spora|zecca|verme|cimice|granchio/i],
    ["bipede", /goblin|orco|uomo|figura|guardia|cavaliere|gigante|troll|spettro|elfo|nano|cultista|soldato|sacerdote|mercante|bambin|donna|vecchio|strega|mago|re\b|regina|fantasma/i],
    ["fluttuante", /occhio|spirito|nuvola|sfera|medusa|nebbia|drone|fiamma|fuoco|ombra|vapora|bolla|aura|lucciola/i],
    ["quadrupede", /lupo|cane|bestia|orso|cavallo|felino|gatto|ratto|volpe|capra|cervo|serpe|drago|cinghiale|leone|tigre|bestiame/i],
  ];

  const COMPORTAMENTI = {
    insettoide: { moto: "strisciare", reazione: "seguire" },
    quadrupede: { moto: "camminare", reazione: "fuggire" },
    bipede: { moto: "camminare", reazione: "nessuna" },
    fluttuante: { moto: "volare", reazione: "seguire" },
    cosa: { moto: "fermo", reazione: "nessuna" },
  };

  const DEFAULT_PARTI = {
    bipede: { teste: "tonda", occhi: "tondo", nOcchi: 2, bocche: "nessuna", arti: "zampe", nArti: 2, code: "", gusci: "", ornamenti: "" },
    quadrupede: { teste: "allungata", occhi: "tondo", nOcchi: 2, bocche: "zanne", arti: "zampe", nArti: 4, code: "frusta", gusci: "", ornamenti: "" },
    insettoide: { teste: "teschio", occhi: "grappolo", nOcchi: 5, bocche: "masticatore", arti: "artigli", nArti: 6, code: "pungiglione", gusci: "corazza", ornamenti: "spine" },
    fluttuante: { teste: "", occhi: "spirale", nOcchi: 3, bocche: "nessuna", arti: "tentacoli", nArti: 4, code: "", gusci: "", ornamenti: "" },
    cosa: { teste: "cristallo", occhi: "lente", nOcchi: 1, bocche: "nessuna", arti: "", nArti: 0, code: "", gusci: "placche", ornamenti: "" },
  };

  function archetipoDaNome(nome, tipo) {
    const testo = String(nome || "") + " " + String(tipo || "");
    for (const [archetipo, re] of CHIAVI_ARCHETIPO) if (re.test(testo)) return archetipo;
    return "quadrupede";
  }

  function nomeValido(categoria, nome) {
    if (!nome) return "";
    const elenco = Parti.NOMI[categoria] || [];
    return elenco.indexOf(String(nome)) >= 0 ? String(nome) : "";
  }

  function intero(valore, minimo, massimo, difetto) {
    const n = Math.round(Number(valore));
    if (!Number.isFinite(n)) return difetto;
    return Math.max(minimo, Math.min(massimo, n));
  }

  function creaRicetta(nome, sug, extra) {
    sug = sug || {};
    const ex = extra || {};
    const archetipo = Object.prototype.hasOwnProperty.call(DEFAULT_PARTI, sug.archetipo)
      ? sug.archetipo
      : archetipoDaNome(nome, ex.tipo);
    const base = DEFAULT_PARTI[archetipo];
    const parti = {
      teste: nomeValido("teste", sug.parti && sug.parti.teste) || base.teste,
      occhi: nomeValido("occhi", sug.parti && sug.parti.occhi) || base.occhi,
      nOcchi: intero(sug.parti && sug.parti.nOcchi, 0, 8, base.nOcchi),
      bocche: nomeValido("bocche", sug.parti && sug.parti.bocche) || base.bocche,
      arti: nomeValido("arti", sug.parti && sug.parti.arti) || base.arti,
      nArti: intero(sug.parti && sug.parti.nArti, 0, 6, base.nArti),
      code: nomeValido("code", sug.parti && sug.parti.code) || base.code,
      gusci: nomeValido("gusci", sug.parti && sug.parti.gusci) || base.gusci,
      ornamenti: nomeValido("ornamenti", sug.parti && sug.parti.ornamenti) || base.ornamenti,
    };
    // l'accessorio della variante diventa l'ornamento, se non ne è già stato scelto uno
    const varSugg = Object.assign({}, ex.variante, sug.modificatori, sug.variante);
    const variante = Varianti.variante(nome, varSugg);
    if (!parti.ornamenti && variante.accessorio) parti.ornamenti = variante.accessorio;

    const comp = sug.comportamento || {};
    const moto = MOTI.indexOf(String(comp.moto)) >= 0 ? String(comp.moto) : (ex.ostile ? "camminare" : COMPORTAMENTI[archetipo].moto);
    const reazione =
      REAZIONI.indexOf(String(comp.reazione)) >= 0
        ? String(comp.reazione)
        : ex.ostile
          ? "attaccare"
          : COMPORTAMENTI[archetipo].reazione;

    return {
      nome: String(nome || "creatura"),
      archetipo,
      parti,
      comportamento: { moto, reazione },
      variante,
    };
  }

  // descrizione breve, utile nei log e per capire cosa ha "capito" il motore
  function descrizione(ricetta) {
    const p = ricetta.parti;
    const pezzi = [ricetta.archetipo, p.teste || "senza testa", p.nOcchi + " occhi " + p.occhi];
    if (p.nArti) pezzi.push(p.nArti + " " + p.arti);
    if (p.gusci) pezzi.push(p.gusci);
    pezzi.push(ricetta.variante.tinta);
    return pezzi.join(" · ");
  }

  // firma stabile: due ricette identiche hanno la stessa firma (per la cache)
  function firma(ricetta) {
    return Varianti.hash32(JSON.stringify([ricetta.archetipo, ricetta.parti, ricetta.variante.tinta, ricetta.variante.stato, ricetta.variante.postura, ricetta.variante.scala, ricetta.variante.accessorio]));
  }

  const Ricette = { MOTI, REAZIONI, archetipoDaNome, creaRicetta, descrizione, firma, DEFAULT_PARTI, COMPORTAMENTI };
  if (typeof module !== "undefined" && module.exports) module.exports = Ricette;
  root.Ricette = Ricette;
})(typeof self !== "undefined" ? self : this);
