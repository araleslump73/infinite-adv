// =====================================================================
// prova-motore.js - test del motore senza AI e senza browser
//   node prova-motore.js
// =====================================================================
const M = require("./motore.js");
const SVG_SCENA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><rect width="960" height="540" fill="#202630"/></svg>';
const SVG_ELEMENTO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#c8a060"/></svg>';

let ok = 0;
let ko = 0;

function controlla(nome, condizione, extra) {
  if (condizione) {
    ok++;
    console.log("  ok   " + nome);
  } else {
    ko++;
    console.log("  FAIL " + nome + (extra ? " → " + JSON.stringify(extra) : ""));
  }
}

function invarianti(stato) {
  const L = stato.luoghi[stato.luogo];
  const problemi = [];
  if (!L) problemi.push("luogo inesistente");
  for (const l of Object.values(stato.luoghi)) {
    for (const d of Object.keys(l.uscite)) {
      const dest = stato.luoghi[l.uscite[d]];
      if (!dest) problemi.push(`uscita rotta ${l.id}.${d}`);
      else if (dest.uscite[Object.keys({ nord: "sud", sud: "nord", est: "ovest", ovest: "est", su: "giu", giu: "su" }).find((k) => ({ nord: "sud", sud: "nord", est: "ovest", ovest: "est", su: "giu", giu: "su" })[k] === d)] !== l.id)
        problemi.push(`uscita non reciproca ${l.id}.${d}`);
    }
  }
  if (stato.giocatore.vita.attuale > stato.giocatore.vita.massima) problemi.push("vita oltre il massimo");
  if (stato.giocatore.energia.attuale < 0) problemi.push("energia negativa");
  if (stato.giocatore.vita.attuale <= 0 && !stato.finito) problemi.push("vita a zero senza fine");
  return problemi;
}

// Il dado di "cerca" usa lo stesso seme del motore: i test scelgono un nome
// che sicuramente riesce o fallisce, così non dipendono dalla fortuna.
function nomeCaso(stato, difficolta, base, riuscito) {
  const p = M.probabilitaDifficolta(difficolta);
  for (let i = 0; i < 1000; i++) {
    const nome = base + " " + i;
    const seme = [stato.turno, stato.luogo, nome.toLowerCase(), 0].join("|");
    if ((M.rng(seme)() < p) === riuscito) return nome;
  }
  return base;
}

console.log("1. creazione partita: solo la stanza iniziale, il mondo cresce dopo");
{
  const { bibbia, stato } = M.creaPartita({ idea: "una torre di ossa", nome: "Tester" });
  controlla("una sola stanza all'inizio", Object.keys(stato.luoghi).length === 1, Object.keys(stato.luoghi).length);
  controlla("nessuna uscita preconfezionata", Object.keys(stato.luoghi.l0.uscite).length === 0);
  controlla("stanza visitata e giocatore al suo interno", stato.luoghi.l0.visitato === true && stato.luogo === "l0");
  controlla("invarianti dello stato", invarianti(stato).length === 0, invarianti(stato));
  controlla("bozza senza generi statici", !bibbia.genere && bibbia.generata === false, bibbia);
}

console.log("2. bibbia dell'AI: validata e applicata alla stanza iniziale");
{
  const base = M.nuovaBibbia("una torre di ossa", "Ada");
  const grezza = {
    titolo: "La Torre di Ossa",
    tono: "cupo, lento, ossessivo",
    ambientazione: "Una torre fatta di ossa che scricchiolano.",
    obiettivo: "Scoprire chi ha costruito la torre.",
    ambiente: "caverna",
    palette: { cielo: "#101820", parete: "#3a2a2a", pavimento: "#4a3a30", accento: "#c98a4a", sbagliato: "#fff" },
    luogoInizio: {
      nome: "Ingresso della Torre",
      descrizione: "Ossa ovunque, e un odore dolce.",
      svg: SVG_SCENA,
      visuale: {
        architettura: "rovinata",
        materiale: "osso",
        luce: "fredda",
        dettagli: ["ossa", "colonne", "inventato"],
        palette: { cielo: "#101820", parete: "#3a2a2a", pavimento: "#4a3a30", accento: "#c98a4a" },
      },
    },
    scenaIniziale: {
      oggetti: [
        {
          nome: "pergamena",
          descrizione: "Ingiallita.",
          svg: SVG_ELEMENTO,
          aspetto: { forma: "foglio", materiale: "osso", colore: "#ddd2b0", accento: "#9b7750", dettagli: ["rune"] },
        },
        { nome: "chiave", descrizione: "Tiepida." },
        { nome: "terzo oggetto", descrizione: "Non deve passare." },
      ],
      png: [
        { nome: "lupo nero", descrizione: "Ringhia.", ostile: true, aspetto: { archetipo: "quadrupede", parti: { occhi: "fessura", nOcchi: 2 } }, svg: SVG_ELEMENTO },
        { nome: "creatura senza aspetto", descrizione: "", ostile: false, aspetto: { archetipo: "drago" } },
      ],
    },
  };
  const bibbia = M.sanificaBibbia(grezza, base);
  controlla("bibbia generata riconosciuta", bibbia.generata === true);
  controlla("ambiente valido accettato", bibbia.ambiente === "caverna", bibbia.ambiente);
  controlla("palette ripulita (chiavi ignote via)", bibbia.palette && !bibbia.palette.sbagliato && Object.keys(bibbia.palette).length === 4, bibbia.palette);
  controlla("luogo iniziale con nome e descrizione", bibbia.luogoInizio.nome === "Ingresso della Torre" && bibbia.luogoInizio.descrizione.length > 5);

  const partita = M.creaPartita({ bibbia });
  const stanza = partita.stato.luoghi.l0;
  controlla("la stanza iniziale usa i dati dell'AI", stanza.nome === "Ingresso della Torre" && stanza.ambiente === "caverna");
  controlla("SVG AI di sfondo e oggetti conservati", stanza.svg === SVG_SCENA && stanza.oggetti[0].svg === SVG_ELEMENTO && stanza.png[0].svg === SVG_ELEMENTO);
  controlla("al massimo 2 oggetti in scena", stanza.oggetti.length === 2, stanza.oggetti.map((o) => o.nome));
  controlla("al massimo 2 creature in scena", stanza.png.length === 2);
  controlla("creatura con aspetto conservata", !!stanza.png[0].aspetto && stanza.png[0].aspetto.archetipo === "quadrupede");
  controlla(
    "aspetto invalido → ricetta completa di ripiego",
    stanza.png[1].aspetto &&
      stanza.png[1].aspetto.archetipo === "quadrupede" &&
      typeof stanza.png[1].aspetto.parti.nOcchi === "number" &&
      !!stanza.png[1].aspetto.comportamento.moto,
    stanza.png[1].aspetto
  );
  controlla("palette della stanza dalla bibbia", stanza.palette && stanza.palette.accento === "#c98a4a");
  controlla("ricetta visiva del luogo sanificata", stanza.visuale && stanza.visuale.architettura === "rovinata" && stanza.visuale.dettagli.length === 2, stanza.visuale);
  controlla("ricetta oggetto conservata nella scena", stanza.oggetti[0].aspetto && stanza.oggetti[0].aspetto.forma === "foglio", stanza.oggetti[0].aspetto);
  controlla("invarianti dopo la bibbia AI", invarianti(partita.stato).length === 0, invarianti(partita.stato));

  const invalida = M.sanificaBibbia(
    { titolo: "", ambiente: "pianeta", palette: { cielo: "blu", parete: "#zzz" }, scenaIniziale: { oggetti: "no", png: 42 } },
    M.nuovaBibbia("x", "Ada")
  );
  controlla("bibbia AI vuota/errata → valori scartati", invalida.ambiente === null && invalida.palette === null && invalida.scenaIniziale === null);
  controlla("bibbia AI errata non è 'generata'", invalida.generata === false);

  const oggettoNonValido = M.sanificaRicettaOggetto({
    forma: "laser",
    materiale: "inventato",
    colore: "rosso",
    dettagli: ["inventato"],
    scala: 99,
  });
  controlla("ricetta oggetto non valida rifiutata", oggettoNonValido === null);
  const oggettoLimitato = M.sanificaRicettaOggetto({
    forma: "sfera",
    dettagli: ["rune", "incisioni", "spine", "pulsante", "inventato"],
    luminosita: 8,
    scala: 8,
  });
  controlla("ricetta oggetto limitata e filtrata", oggettoLimitato.luminosita === 1 && oggettoLimitato.scala === 1.6 && oggettoLimitato.dettagli.length === 3);
  const luogoNonValido = M.sanificaRicettaLuogo({
    architettura: "città impossibile",
    materiale: "inventato",
    luce: "ultravioletta",
    dettagli: ["inventato"],
    palette: { cielo: "blu", parete: "#zzzzzz" },
  });
  controlla("ricetta luogo non valida rifiutata", luogoNonValido === null);
  const luogoLimitato = M.sanificaRicettaLuogo({
    architettura: "naturale",
    dettagli: ["archi", "colonne", "radici", "ossa", "statue"],
  });
  controlla("ricetta luogo limita i dettagli ammessi", luogoLimitato.dettagli.length === 4 && luogoLimitato.dettagli.includes("ossa"));
}

console.log("2b. ripiego locale: il mondo si apre a mano a mano");
{
  const { bibbia, stato } = M.creaPartita({ idea: "un deserto di vetro", nome: "Nora" });
  const r = M.comando("vai nord", stato, bibbia);
  controlla("vai nord senza uscita → crea un passaggio", r.effetti.length === 1 && r.effetti[0].op === "crea_luogo" && r.effetti[0].entra === true, r.effetti);
  M.applicaEffetti(stato, r.effetti);
  controlla("passaggio applicato e giocatore spostato", Object.keys(stato.luoghi).length === 2 && stato.luogo !== "l0");
  controlla("uscita di ritorno presente", Object.values(stato.luoghi[stato.luogo].uscite).includes("l0"));
  controlla("invarianti dopo il passaggio", invarianti(stato).length === 0, invarianti(stato));
  const indietro = M.comando("vai sud", stato, bibbia);
  controlla("si torna indietro con vai sud", indietro.effetti[0].op === "vai" && indietro.effetti[0].luogo === "l0", indietro.effetti);
}

console.log("\n3. il motore rifiuta gli effetti non ammessi");
{
  const { stato } = M.creaPartita({ idea: "test rifiuti" });
  const esito = M.applicaEffetti(stato, [
    { op: "esplodi", n: 99 },
    { op: "danno", n: 999 },
    { op: "vai", luogo: "un-luogo-che-non-esiste" },
    { op: "prendi", oggetto: "spada delle stelle" },
  ]);
  controlla("4 rifiuti su 4 effetti non validi", esito.rifiutati.length === 4, esito.rifiutati.map((r) => r.op + ":" + r.motivo));
  const direzioneLibera = ["nord", "est", "sud", "ovest"].find((d) => !stato.luoghi[stato.luogo].uscite[d]);
  const nomeSigillo = nomeCaso(stato, "facile", "sigillo", true);
  const esito2 = M.applicaEffetti(stato, [
    {
      op: "crea_luogo",
      nome: "Cripta",
      descrizione: "Una cripta buia.",
      direzione: direzioneLibera,
      ambiente: "foresta",
      meteo: "lucciole",
      svg: SVG_SCENA,
      visuale: {
        architettura: "sacra",
        materiale: "pietra",
        luce: "buia",
        dettagli: ["archi"],
        palette: { cielo: "#101820", parete: "#302b36" },
      },
      scena: {
        oggetti: [{
          nome: "seme lunare",
          descrizione: "Un seme di luce fredda.",
          svg: SVG_ELEMENTO,
          aspetto: { forma: "sfera", materiale: "energia", colore: "#394d72", accento: "#b1d5ff", dettagli: ["pulsante"] },
        }],
        png: [],
      },
    },
    {
      op: "cerca",
      difficolta: "facile",
      oggetto: {
        nome: nomeSigillo,
        descrizione: "Un disco di metallo.",
        svg: SVG_ELEMENTO,
        aspetto: { forma: "anello", materiale: "metallo", colore: "#777777", accento: "#ffcc66", dettagli: ["simboli"] },
      },
      seRiesce: "Il disco è lì.",
      seFallisce: "Solo polvere.",
    },
    {
      op: "crea_png",
      png: { nome: "custode", descrizione: "Una figura immobile.", ostile: false, svg: SVG_ELEMENTO },
    },
    { op: "imposta_flag", chiave: "test", valore: true },
    { op: "imposta_flag", chiave: "altro" },
    { op: "cura", n: 2 },
  ]);
  controlla("secondo blocco: nessun rifiuto", esito2.rifiutati.length === 0, esito2.rifiutati);
  controlla("6 effetti per turno al massimo", M.applicaEffetti(stato, new Array(9).fill({ op: "cura", n: 1 })).cambi.length <= M.MAX_EFFETTI);
  controlla("flag impostato", stato.flag.test === true && stato.flag.altro === true);
  controlla("nuovo luogo creato e raggiungibile", !!stato.luoghi[stato.luoghi[stato.luogo].uscite[direzioneLibera]]);
  const nuovoLuogo = stato.luoghi[stato.luoghi[stato.luogo].uscite[direzioneLibera]];
  controlla("crea_luogo conserva ambiente, meteo e visuale", nuovoLuogo.ambiente === "foresta" && nuovoLuogo.meteo === "lucciole" && nuovoLuogo.visuale.architettura === "sacra", nuovoLuogo);
  controlla("crea_luogo conserva SVG di sfondo e oggetti", nuovoLuogo.svg === SVG_SCENA && nuovoLuogo.oggetti[0].svg === SVG_ELEMENTO);
  controlla("crea_luogo conserva la ricetta degli oggetti", nuovoLuogo.oggetti[0].aspetto && nuovoLuogo.oggetti[0].aspetto.forma === "sfera", nuovoLuogo.oggetti[0]);
  controlla("cerca conserva la ricetta", stato.luoghi[stato.luogo].oggetti[0].aspetto && stato.luoghi[stato.luogo].oggetti[0].aspetto.forma === "anello");
  controlla("cerca e crea_png conservano SVG AI", stato.luoghi.l0.oggetti[0].svg === SVG_ELEMENTO && stato.luoghi.l0.png[0].svg === SVG_ELEMENTO);
  controlla("cerca riuscito restituisce il finale scelto", esito2.aggiunta === "Il disco è lì.", esito2.aggiunta);
  controlla("vita non supera il massimo", stato.giocatore.vita.attuale <= stato.giocatore.vita.massima);
  controlla("un turno per ogni chiamata (3)", stato.turno === 3, stato.turno);
  controlla("invarianti dopo gli effetti", invarianti(stato).length === 0, invarianti(stato));
}

console.log("\n3b. rimuovi: ciò che esce di scena sparisce dallo stato (e quindi dalla grafica)");
{
  const { stato } = M.creaPartita({ idea: "una cava di larve", nome: "Tester" });
  const L = stato.luoghi.l0;
  M.applicaEffetti(stato, [{ op: "crea_png", png: { nome: "larva", descrizione: "Si muove.", ostile: false, svg: SVG_ELEMENTO } }]);
  L.oggetti.push({ nome: "guscio", descrizione: "Vuoto.", tipo: "oggetto", svg: SVG_ELEMENTO, aspetto: null, moto: null, piano: null });
  controlla("creatura e oggetto in scena", L.png.some((p) => p.nome === "larva") && L.oggetti.some((o) => o.nome === "guscio"));
  const esito = M.applicaEffetti(stato, [{ op: "rimuovi", png: "larva" }, { op: "rimuovi", oggetto: "guscio" }]);
  controlla("rimuovi accettato", esito.rifiutati.length === 0, esito.rifiutati);
  controlla("creatura e oggetto spariti dallo stato", !L.png.some((p) => p.nome === "larva") && !L.oggetti.some((o) => o.nome === "guscio"));
  controlla("rimuovi segnala i cambi", esito.cambi.length === 2, esito.cambi);
  const manca = M.applicaEffetti(stato, [{ op: "rimuovi", png: "larva" }, { op: "rimuovi" }]);
  controlla("rimuovi rifiuta nomi assenti e bersaglio mancante", manca.rifiutati.length === 2, manca.rifiutati);
}

console.log("\n3c. attacco locale: la creatura abbattuta esce dalla scena");
{
  const { bibbia, stato } = M.creaPartita({ idea: "un nido", nome: "Tester" });
  const L = stato.luoghi.l0;
  M.applicaEffetti(stato, [{ op: "crea_png", png: { nome: "larva", descrizione: "Si muove.", ostile: true, svg: SVG_ELEMENTO } }]);
  L.png[0].vita = 1;
  stato.giocatore.energia.attuale = 40;
  const comandi = ["attacca larva", "colpisco la larva", "attacco la larva", "mena la larva", "uccido la larva", "sparo alla larva", "aggredisco la larva", "attacca ancora la larva"];
  for (const c of comandi) {
    if (!L.png.length) break;
    M.applicaEffetti(stato, M.comando(c, stato, bibbia).effetti);
  }
  controlla("la creatura abbattuta dal motore locale sparisce", L.png.length === 0, L.png.map((p) => p.nome + ":" + p.vita));
}

console.log("\n3d. cerca: il dado decide e ripetere non aiuta");
{
  const { stato } = M.creaPartita({ idea: "un mercato", nome: "Tester" });
  const L = stato.luoghi.l0;
  controlla(
    "difficoltà → probabilità (ignota = media)",
    M.probabilitaDifficolta("facile") === 0.7 &&
      M.probabilitaDifficolta("media") === 0.45 &&
      M.probabilitaDifficolta("difficile") === 0.2 &&
      M.probabilitaDifficolta("quasi-impossibile") === 0.05 &&
      M.probabilitaDifficolta("impossibile") === 0 &&
      M.probabilitaDifficolta("inventata") === 0.45
  );

  const buono = nomeCaso(stato, "facile", "borsa", true);
  const esito = M.applicaEffetti(stato, [
    { op: "cerca", difficolta: "facile", oggetto: { nome: buono, descrizione: "Utile." }, seRiesce: "La trovi.", seFallisce: "Niente." },
    { op: "cerca", difficolta: "facile", oggetto: { nome: "corda" }, seRiesce: "La trovi.", seFallisce: "Niente." },
  ]);
  controlla("oggetto trovato quando il dado passa", L.oggetti.some((o) => o.nome === buono), L.oggetti.map((o) => o.nome));
  controlla("una sola ricerca per turno", esito.rifiutati.some((r) => /una sola ricerca/.test(r.motivo)), esito.rifiutati);
  controlla("esito.aggiunta riporta il finale scelto", esito.aggiunta === "La trovi.", esito.aggiunta);

  const cattivo = nomeCaso(stato, "facile", "corda", false);
  const mancato = M.applicaEffetti(stato, [
    { op: "cerca", difficolta: "facile", oggetto: { nome: cattivo, descrizione: "Inutile." }, seRiesce: "La trovi.", seFallisce: "Solo polvere." },
  ]);
  controlla("ricerca fallita: nessun oggetto", !L.oggetti.some((o) => o.nome === cattivo));
  controlla(
    "ricerca fallita: finale di fallimento ed esito",
    mancato.aggiunta === "Solo polvere." && mancato.cambi.some((c) => c.startsWith("niente:")),
    [mancato.aggiunta, mancato.cambi]
  );
  const trovato = esito.oggettiTrovati.find((x) => x.oggetto.nome === buono);
  controlla("ritrovamento in scena segnala l'asset da generare dopo il dado", !!trovato && trovato.idLuogo === stato.luogo);
  controlla(
    "SVG differito applicato solo all'oggetto ancora presente",
    !!trovato &&
      M.aggiornaSvgOggetto(stato, trovato.idLuogo, trovato.oggetto, SVG_ELEMENTO) &&
      trovato.oggetto.svg === SVG_ELEMENTO &&
      !M.aggiornaSvgOggetto(stato, trovato.idLuogo, {}, SVG_ELEMENTO)
  );
  controlla("i tentativi sullo stesso nome si accumulano", L.cercati[cattivo.toLowerCase()] === 1, L.cercati);

  const impossibile = M.applicaEffetti(stato, [{ op: "cerca", difficolta: "impossibile", oggetto: { nome: "cristallo cosmico" } }]);
  controlla(
    "difficoltà impossibile: mai trovato",
    !L.oggetti.some((o) => o.nome === "cristallo cosmico") && impossibile.cambi.some((c) => c.includes("impossibile")),
    impossibile.cambi
  );

  for (let i = 0; i < 6 && (L.trovati || 0) < M.MAX_TROVATI_LUOGO; i++) {
    const nome = nomeCaso(stato, "facile", "cimelio " + i, true);
    M.applicaEffetti(stato, [{ op: "cerca", difficolta: "facile", oggetto: { nome } }]);
  }
  const oltre = M.applicaEffetti(stato, [{ op: "cerca", difficolta: "facile", oggetto: { nome: "ultima cosa" } }]);
  controlla("massimo due ritrovamenti per stanza", L.trovati === M.MAX_TROVATI_LUOGO, L.trovati);
  controlla("oltre il tetto la ricerca è rifiutata", oltre.rifiutati.some((r) => /più nulla/.test(r.motivo)), oltre.rifiutati);

  const vecchio = M.applicaEffetti(stato, [{ op: "crea_oggetto", oggetto: { nome: "spada regalata" } }]);
  controlla("crea_oggetto non è più ammesso", vecchio.rifiutati.some((r) => /usa cerca/.test(r.motivo)), vecchio.rifiutati);
}

console.log("\n3d bis. ricerca con raccolta: l'oggetto entra davvero nello zaino");
{
  const { stato } = M.creaPartita({ idea: "una grotta", nome: "Tester" });
  const L = stato.luoghi.l0;
  const lama = nomeCaso(stato, "facile", "lama", true);
  const riuscita = M.applicaEffetti(stato, [{
    op: "cerca",
    difficolta: "facile",
    raccogli: true,
    oggetto: { nome: lama, descrizione: "Una lama nella parete.", svg: SVG_ELEMENTO },
    seRiesce: "Strappi la lama dalla parete e la raccogli.",
    seFallisce: "Non riesci a staccare nulla.",
  }]);
  const oggetto = stato.giocatore.inventario.find((o) => o.nome === lama);
  controlla(
    "ricerca riuscita: oggetto nello zaino, non nella scena",
    !!oggetto && oggetto.svg === SVG_ELEMENTO &&
      !L.oggetti.some((o) => o.nome === lama) &&
      M.statoCompatto(stato).giocatore.inventario.includes(lama) &&
      riuscita.oggettiTrovati.length === 0,
    { inventario: stato.giocatore.inventario, scena: L.oggetti }
  );
  controlla(
    "la narrazione e il log confermano la raccolta riuscita",
    riuscita.aggiunta === "Strappi la lama dalla parete e la raccogli." &&
      riuscita.cambi.includes(`preso: ${lama}`) && L.trovati === 1,
    riuscita
  );

  const mancata = nomeCaso(stato, "facile", "scheggia", false);
  const fallita = M.applicaEffetti(stato, [{
    op: "cerca", difficolta: "facile", raccogli: true,
    oggetto: { nome: mancata }, seRiesce: "La raccogli.", seFallisce: "Non si stacca.",
  }]);
  controlla(
    "ricerca fallita: nessun oggetto e nessuna raccolta",
    !stato.giocatore.inventario.some((o) => o.nome === mancata) &&
      !L.oggetti.some((o) => o.nome === mancata) &&
      fallita.aggiunta === "Non si stacca." &&
      !fallita.cambi.some((c) => c.startsWith("preso:")),
    fallita
  );

  const errata = M.applicaEffetti(stato, [{
    op: "cerca", difficolta: "facile", raccogli: "true", oggetto: { nome: "chiave" },
  }]);
  controlla(
    "raccogli non booleano viene rifiutato",
    errata.rifiutati.some((r) => /raccogli/.test(r.motivo)) &&
      !L.oggetti.some((o) => o.nome === "chiave") &&
      !stato.giocatore.inventario.some((o) => o.nome === "chiave"),
    errata
  );

  const senzaNome = M.applicaEffetti(stato, [{
    op: "cerca", difficolta: "facile", raccogli: true, oggetto: { nome: "  <>  " },
  }]);
  controlla(
    "un oggetto senza nome valido non entra nello zaino",
    senzaNome.rifiutati.some((r) => /senza nome/.test(r.motivo)) &&
      stato.giocatore.inventario.every((o) => o.nome),
    senzaNome
  );

  const secondo = nomeCaso(stato, "facile", "pietra", true);
  const senzaFinale = M.applicaEffetti(stato, [{
    op: "cerca", difficolta: "facile", raccogli: true, oggetto: { nome: secondo },
  }]);
  controlla(
    "senza finale personalizzato il testo conferma la raccolta",
    senzaFinale.aggiunta === "Lo trovi e lo raccogli." &&
      stato.giocatore.inventario.some((o) => o.nome === secondo),
    senzaFinale
  );

  const limite = M.applicaEffetti(stato, [{
    op: "cerca", difficolta: "facile", raccogli: true, oggetto: { nome: "altra lama" },
  }]);
  controlla(
    "la raccolta rispetta il limite di ritrovamenti",
    limite.rifiutati.some((r) => /più nulla/.test(r.motivo)) &&
      !stato.giocatore.inventario.some((o) => o.nome === "altra lama"),
    limite
  );

  const { stato: scoperta } = M.creaPartita({ idea: "un'altra grotta" });
  const nome = nomeCaso(scoperta, "facile", "bastone", true);
  M.applicaEffetti(scoperta, [{
    op: "cerca", difficolta: "facile", raccogli: false, oggetto: { nome },
  }]);
  const inScena = scoperta.luoghi.l0.oggetti.some((o) => o.nome === nome) &&
    !scoperta.giocatore.inventario.some((o) => o.nome === nome);
  M.applicaEffetti(scoperta, [{ op: "prendi", oggetto: nome }]);
  controlla(
    "senza raccolta il ritrovamento resta in scena finché non viene preso",
    inScena && !scoperta.luoghi.l0.oggetti.some((o) => o.nome === nome) &&
      scoperta.giocatore.inventario.some((o) => o.nome === nome)
  );
}

console.log("\n3e. combattimento: una creatura ostile non sparisce viva");
{
  const { stato } = M.creaPartita({ idea: "una cripta", nome: "Tester" });
  const L = stato.luoghi.l0;
  M.applicaEffetti(stato, [{ op: "crea_png", png: { nome: "guardiano", descrizione: "Pietra.", ostile: true, svg: SVG_ELEMENTO } }]);
  controlla("creatura ostile con vita piena", L.png[0].vita === 3 && L.png[0].vitaMax === 3, L.png[0]);

  const vivo = M.applicaEffetti(stato, [{ op: "rimuovi", png: "guardiano" }]);
  controlla("rimuovi su nemico vivo rifiutato", vivo.rifiutati.some((r) => /ferisci/.test(r.motivo)) && L.png.length === 1, vivo.rifiutati);

  const primo = M.applicaEffetti(stato, [{ op: "ferisci", png: "guardiano", n: 2 }]);
  controlla(
    "ferisci scala la vita",
    L.png[0].vita === 1 && primo.cambi.some((c) => c.startsWith("ferito:")) && primo.aggiunta === "",
    [L.png[0].vita, primo.cambi]
  );
  const ancoraVivo = M.applicaEffetti(stato, [{ op: "rimuovi", png: "guardiano" }]);
  controlla("ferito ma vivo: non sparisce", ancoraVivo.rifiutati.length === 1 && L.png.length === 1, ancoraVivo.rifiutati);

  const finale = M.applicaEffetti(stato, [{ op: "ferisci", png: "guardiano", n: 2 }]);
  controlla(
    "a vita zero la creatura esce di scena",
    L.png.length === 0 && finale.cambi.some((c) => c === "abbattuto: guardiano"),
    finale.cambi
  );
  controlla("ferisci su creatura assente rifiutato", M.applicaEffetti(stato, [{ op: "ferisci", png: "guardiano", n: 1 }]).rifiutati.length === 1);

  M.applicaEffetti(stato, [{ op: "crea_png", png: { nome: "mercante", descrizione: "Passa.", ostile: false, svg: SVG_ELEMENTO } }]);
  const uscito = M.applicaEffetti(stato, [{ op: "rimuovi", png: "mercante" }]);
  controlla(
    "una creatura non ostile può uscire di scena",
    uscito.rifiutati.length === 0 && !L.png.some((p) => p.nome === "mercante")
  );
}

console.log("\n3f. la vittoria non si chiede");
{
  const { stato } = M.creaPartita({ idea: "prova vittoria", nome: "Tester" });
  const presto = M.applicaEffetti(stato, [{ op: "fine", esito: "vittoria", testo: "Ho vinto." }]);
  controlla("vittoria al primo turno rifiutata", presto.rifiutati.length === 1 && !stato.finito, presto.rifiutati);

  stato.turno = M.MIN_TURNI_VITTORIA;
  const stessoTurno = M.applicaEffetti(stato, [
    { op: "imposta_flag", chiave: "obiettivoRaggiunto", valore: true },
    { op: "fine", esito: "vittoria", testo: "Ora." },
  ]);
  controlla(
    "flag e vittoria nello stesso turno non bastano",
    stessoTurno.rifiutati.length === 1 && !stato.finito,
    stessoTurno.rifiutati
  );

  stato.turno = M.MIN_TURNI_VITTORIA + 1;
  const tardi = M.applicaEffetti(stato, [{ op: "fine", esito: "vittoria", testo: "Fine." }]);
  controlla(
    "vittoria matura accettata",
    tardi.rifiutati.length === 0 && stato.finito && stato.finito.esito === "vittoria",
    { finito: stato.finito, rifiutati: tardi.rifiutati }
  );
}

console.log("\n4. 40 comandi di fila: nessuna eccezione, stato sempre valido");
{
  const { bibbia, stato } = M.creaPartita({ idea: "castello di cenere", nome: "Bilbo" });
  const comandi = [
    "guarda", "inventario", "aspetta", "vai nord", "vai est", "vai sud", "vai ovest",
    "prendi tutto", "parla con nessuno", "attacca", "usa la spada", "aspetta", "nord", "est",
    "sud", "ovest", "guarda intorno", "aspetta", "aspetta", "inventario", "aiuto",
    "cammino verso nord", "raccolgo l'amuleto", "parlo con il goblin", "attacco il goblin",
    "aspetta", "aspetta", "aspetta", "aspetta", "vai a caso", "xyzzy", "", "guardo bene il muro",
    "mi guardo intorno", "bevo dalla fonte", "salto nel vuoto", "canto una canzone", "corro",
    "aspetta", "guardo lo zaino",
  ];
  let errori = 0;
  let turni = 0;
  for (const cmd of comandi) {
    try {
      const r = M.comando(cmd, stato, bibbia);
      if (typeof r.narrazione !== "string") errori++;
      M.applicaEffetti(stato, r.effetti);
      turni++;
      const problemi = invarianti(stato);
      if (problemi.length) {
        console.log("    stato rotto dopo '" + cmd + "':", problemi);
        errori++;
      }
    } catch (e) {
      errori++;
      console.log("    eccezione su '" + cmd + "':", e.message);
    }
  }
  controlla(`${comandi.length} comandi eseguiti, ${errori} errori`, errori === 0);
  controlla("turno contato", stato.turno === turni, stato.turno + " vs " + turni);
  controlla("almeno un luogo visitato in più", Object.values(stato.luoghi).filter((l) => l.visitato).length > 1);
}

console.log("\n5. morte: ultima possibilità, poi sconfitta");
{
  const { stato } = M.creaPartita({ idea: "prova morte" });
  M.applicaEffetti(stato, [{ op: "danno", n: 4 }, { op: "danno", n: 4 }]);
  controlla("ultima speranza attiva, tornato all'inizio", stato.flag.ultimaSperanza === true && stato.luogo === "l0");
  controlla("vita riportata a 2", stato.giocatore.vita.attuale === 2);
  M.applicaEffetti(stato, [{ op: "danno", n: 4 }]);
  controlla("seconda morte = fine partita", stato.finito && stato.finito.esito === "sconfitta");
  const r = M.comando("vai nord", stato, M.creaPartita({ idea: "prova morte" }).bibbia);
  controlla("dopo la fine i comandi sono rifiutati", r.effetti.length === 0);
}

console.log("\n6. validazione delle risposte AI e stato compatto");
{
  const { stato, bibbia } = M.creaPartita({ idea: "prova ai" });
  controlla("risposta senza narrazione → scartata", M.validaRispostaAI({}) === null);
  controlla("risposta valida accettata", !!M.validaRispostaAI({ narrazione: "Ciao", effetti: [] }));
  controlla(
    "risposta rumorosa ripulita",
    M.validaRispostaAI({ narrazione: "x", effetti: [], extra: 1 }).extra === undefined
  );
  const s = M.statoCompatto(stato);
  controlla("stato compatto piccolo (< 700 caratteri)", JSON.stringify(s).length < 700, JSON.stringify(s).length);
  controlla("bibbia compatta piccola (< 500 caratteri)", JSON.stringify(M.bibbiaCompatta(bibbia)).length < 500);
  console.log("    esempio stato compatto:", JSON.stringify(s).slice(0, 220) + "…");
}

console.log("\n6b. comandi informativi senza chiamata AI");
{
  const informativi = ["aiuto", "help", "comandi", "?", "cosa posso fare?", "inventario", "I", "inv", "zaino", "mostra lo zaino", "elenca inventario."];
  for (const cmd of informativi) controlla(`"${cmd}" è solo informativo`, M.comandoInformativo(cmd));
  const narrativi = ["cosa ho trovato?", "inventario e poi apro la porta", "guarda", "cerco una chiave", "parla con Ada"];
  for (const cmd of narrativi) controlla(`"${cmd}" può richiedere l'AI`, !M.comandoInformativo(cmd));
}

console.log("\n7. descrizione della scena");
{
  const { stato } = M.creaPartita({ idea: "prova scena" });
  const d = M.descriviLuogo(stato);
  controlla("descrizione non vuota e cita le uscite", d.length > 40 && /Uscite|vie d'uscita/.test(d));
  console.log("    " + d.replace(/\*\*/g, "").slice(0, 200) + "…");
}


console.log("Ricetta visiva: sempre lo stesso formato completo");
{
  const chiavi = (o) => Object.keys(o).sort().join(",");
  const attese = {
    radice: "archetipo,comportamento,modificatori,parti",
    parti: "arti,bocche,code,gusci,nArti,nOcchi,occhi,ornamenti,teste",
    comportamento: "moto,reazione",
    modificatori: "postura,scala,stato,tinta",
  };
  const nomi = ["goblin", "lupo", "ragno", "occhio", "cristallo", "sconosciuto xyz", ""];
  let problemi = 0;
  for (let i = 0; i < 200; i++) {
    const nome = nomi[i % nomi.length] + " " + i;
    const grezzo = i % 3 === 0 ? null : { archetipo: ["bipede", "drago", "insettoide"][i % 3], parti: { occhi: ["tondo", "laser"][i % 2], nOcchi: i % 12 } };
    const r = M.completaAspetto(nome, "persona", grezzo, i % 2 === 0);
    if (chiavi(r) !== attese.radice) problemi++;
    if (chiavi(r.parti) !== attese.parti) problemi++;
    if (chiavi(r.comportamento) !== attese.comportamento) problemi++;
    if (chiavi(r.modificatori) !== attese.modificatori) problemi++;
    if (!M.ASPETTO.archetipi.includes(r.archetipo)) problemi++;
    if (r.parti.nOcchi < 0 || r.parti.nOcchi > 8) problemi++;
    if (r.parti.nArti < 0 || r.parti.nArti > 6) problemi++;
    if (!M.ASPETTO.tinte.includes(r.modificatori.tinta)) problemi++;
    if (!M.ASPETTO.moti.includes(r.comportamento.moto)) problemi++;
  }
  controlla("200 ricette: stessa struttura, valori nei limiti", problemi === 0, problemi);
  const lupo = M.completaAspetto("lupo nero", "persona", null, true);
  controlla("nome riconosciuto senza aspetto", lupo.archetipo === "quadrupede", lupo.archetipo);
  controlla("ostile → reazione attaccare", lupo.comportamento.reazione === "attaccare");
  const parassita = M.completaAspetto("parassita", "persona", { archetipo: "insettoide", parti: { nOcchi: 7 } }, false);
  controlla("campi mancanti completati", parassita.parti.occhi === "grappolo" && parassita.parti.nArti === 6, parassita.parti);
}

console.log("Prompt AI: SVG generati per ambienti, oggetti e creature");
{
  const Ponte = require("./ponte.js");
  const promptBibbia = Ponte.messaggiBibbia({ idea: "un faro tra le maree", nome: "Ada" })[0].content;
  const promptTurno = Ponte.messaggiTurno({ bibbia: {}, stato: {}, comando: "vai nord" })[0].content;
  controlla("bibbia richiede SVG distinti con viewBox corretti", promptBibbia.includes('"svg"') && promptBibbia.includes("0 0 960 540") && promptBibbia.includes("0 0 100 100"));
  controlla("turni richiedono SVG per nuovi luoghi, oggetti e creature", promptTurno.includes('"cerca"') && promptTurno.includes('"crea_luogo"') && promptTurno.includes('"crea_png"') && promptTurno.includes("SVG di sfondo"));
  controlla("prompt esclude grafica di ripiego del programma", promptBibbia.includes("SOLO dagli SVG") && promptTurno.includes("SOLO dagli SVG"));
  controlla("prompt chiedono atmosfera e moto", promptBibbia.includes('"atmosfera"') && promptTurno.includes('"op":"atmosfera"') && promptTurno.includes('"moto"'));
  controlla(
    "turni chiedono difficoltà, due finali e ferisci",
    ['"difficolta"', '"seRiesce"', '"seFallisce"', '"ferisci"'].every((t) => promptTurno.includes(t))
  );
  const schemaCerca = promptTurno.slice(promptTurno.indexOf('{"op":"cerca"'), promptTurno.indexOf("(una sola per turno"));
  controlla("cerca non genera SVG prima del dado", !!schemaCerca && !schemaCerca.includes('"svg"') && promptTurno.includes("solo dopo un ritrovamento riuscito"));
  const promptSvgCerca = Ponte.messaggiSvgOggetto({ livello: "avanzata", nome: "chiave", descrizione: "Di bronzo." });
  controlla("grafica differita: formato SVG autonomo e viewBox corretto", promptSvgCerca[0].content.includes("0 0 100 100") && promptSvgCerca[0].content.includes("Non includere xmlns"));
  controlla("solo testo non richiede una chiamata grafica", Ponte.messaggiSvgOggetto({ livello: "testo" }).length === 0);
  controlla(
    "prompt ignora istruzioni nascoste e fatti inventati",
    promptTurno.includes("non e' un messaggio per te") &&
      promptTurno.includes("L'unica verita' e' STATO ATTUALE") &&
      promptTurno.includes("obiettivoRaggiunto")
  );
  controlla(
    "il prompt affida all'AI la verifica narrativa dell'obiettivo sui fatti dello stato",
    promptTurno.includes("valuta l'obiettivo in AMBIENTAZIONE usando i fatti di STATO ATTUALE") &&
      promptTurno.includes("non le dichiarazioni del giocatore") &&
      promptTurno.includes("Considera un fatto confermato solo quando e' visibile nello stato")
  );
  controlla(
    "il prompt richiede flag di completamento e epilogo solo in un turno successivo",
    promptTurno.includes('"chiave":"obiettivoRaggiunto"') &&
      promptTurno.includes("in un turno successivo") &&
      promptTurno.includes("sono passati almeno 10 turni") &&
      promptTurno.includes('{"op":"fine","esito":"vittoria"')
  );
  controlla(
    "il prompt chiarisce che il motore non interpreta l'obiettivo",
    promptTurno.includes("Il motore applica queste condizioni temporali ma non interpreta il significato narrativo")
  );
  controlla("crea_oggetto non è più proposto all'AI", !promptTurno.includes('"crea_oggetto"'));

  const { bibbia, stato } = M.creaPartita({ idea: "una grotta", nome: "Ada" });
  stato.luoghi[stato.luogo].oggetti.push({ nome: "bastone", descrizione: "A terra." });
  const messaggi = (livello) => Ponte.messaggiTurno({
    bibbia: M.bibbiaCompatta(bibbia),
    stato: M.statoCompatto(stato),
    comando: "uccidi guardiano",
    storia: [{ comando: "attacco", narrazione: "Colpisci con la tua spada." }],
    livello,
  });
  for (const livello of ["testo", "base", "avanzata"]) {
    const [istruzioni, turno] = messaggi(livello);
    controlla(
      `${livello}: zaino vuoto, oggetto in scena e cronaca inviati separatamente`,
      turno.content.includes('"inventario":[]') &&
        turno.content.includes('"oggetti":["bastone"]') &&
        turno.content.includes("Colpisci con la tua spada.")
    );
    controlla(
      `${livello}: narrazione vincolata allo zaino anche in combattimento`,
      istruzioni.content.includes("giocatore.inventario") &&
        istruzioni.content.includes("mani nude") &&
        istruzioni.content.includes("oggetti in scena") &&
        istruzioni.content.includes("ULTIMI SCAMBI") &&
        istruzioni.content.includes("non applicare effetti che dipendono dal suo uso") &&
        istruzioni.content.includes("interagire con l'ambiente")
    );
    controlla(
      `${livello}: oggetti raccolti legati a prendi o cerca con tiro`,
      istruzioni.content.includes('includi sempre "prendi"') &&
        istruzioni.content.includes('"raccogli":true') &&
        istruzioni.content.includes("solo se il dado riesce") &&
        istruzioni.content.includes("Descrivi la raccolta solo in seRiesce")
    );
  }
  stato.giocatore.inventario.push({ nome: "spada", descrizione: "Una spada." });
  controlla("un'arma raccolta compare nello zaino inviato all'AI", messaggi("testo")[1].content.includes('"inventario":["spada"]'));
}

console.log("Atmosfera e moto scelti dall'AI");
{
  const a = M.sanificaAtmosfera({
    luce: 0.02, sfocatura: 40, nebbia: "0.5", vignetta: -3, sfarfallio: "x",
    tinta: "#3355ff", movimento: "oscilla", ampiezza: 9, fonte: { x: 2000, y: 100 }, extra: "<script>",
  });
  controlla("valori fuori limite riportati nei limiti", a.luce === 0.1 && a.sfocatura === 6 && a.nebbia === 0.5 && a.ampiezza === 1 && a.fonte.x === 960, a);
  controlla("valori nulli o non validi scartati", !("vignetta" in a) && !("sfarfallio" in a) && !("extra" in a), a);
  controlla("predefiniti per tinta, velocità e raggio", a.intensitaTinta === 0.25 && a.velocita === 1 && a.fonte.raggio === 200, a);
  controlla("atmosfera vuota o neutra → null", M.sanificaAtmosfera({ luce: 1, movimento: "fermo", tinta: "rosso" }) === null && M.sanificaAtmosfera("buio") === null);
  const unita = M.unisciAtmosfera(a, { sfocatura: 0, movimento: "fermo", luce: 1, sfarfallio: 0.7 });
  controlla("0, fermo e luce 1 spengono; il resto resta", !unita.sfocatura && !unita.movimento && !unita.luce && unita.sfarfallio === 0.7 && unita.nebbia === 0.5, unita);

  const { stato } = M.creaPartita({ idea: "prova atmosfera" });
  const nomeLanterna = nomeCaso(stato, "facile", "lanterna", true);
  const esito = M.applicaEffetti(stato, [
    { op: "atmosfera", atmosfera: { luce: 0.3, movimento: "tremola" } },
    { op: "cerca", difficolta: "facile", oggetto: { nome: nomeLanterna, descrizione: "Oscilla.", svg: SVG_ELEMENTO, moto: "oscilla" } },
    { op: "crea_png", png: { nome: "spettro", descrizione: "Galleggia.", svg: SVG_ELEMENTO, moto: "volare" } },
  ]);
  const L = stato.luoghi[stato.luogo];
  controlla("op atmosfera applicata al luogo corrente", esito.rifiutati.length === 0 && L.atmosfera.luce === 0.3 && L.atmosfera.movimento === "tremola", L.atmosfera);
  controlla("moto valido conservato, moto sconosciuto scartato", L.oggetti[0].moto === "oscilla" && !L.png[0].moto, [L.oggetti[0].moto, L.png[0].moto]);
  controlla("stato compatto include l'atmosfera", M.statoCompatto(stato).luogo.atmosfera.luce === 0.3);

  const Atmosfera = require("./grafica/atmosfera.js");
  const fermo = Atmosfera.movimentoCamera(null, 3);
  controlla("senza atmosfera la visuale è ferma", fermo.dx === 0 && fermo.dy === 0 && fermo.rot === 0 && fermo.zoom === 1, fermo);
  let finiti = true;
  for (const mov of M.MOTI_CAMERA) {
    for (let t = 0; t < 20; t += 0.37) {
      const m = Atmosfera.movimentoCamera({ movimento: mov, ampiezza: 1, velocita: 3 }, t);
      if (![m.dx, m.dy, m.rot, m.zoom].every(Number.isFinite) || m.zoom < 1) finiti = false;
    }
  }
  controlla("movimento della visuale sempre finito e con zoom ≥ 1", finiti);
}

console.log("Livelli di grafica nei prompt");
{
  const Ponte = require("./ponte.js");
  const turno = (livello) => Ponte.messaggiTurno({ bibbia: {}, stato: {}, comando: "guarda", livello })[0].content;
  const bibbia = (livello) => Ponte.messaggiBibbia({ idea: "x", livello })[0].content;
  controlla("solo testo: nessuno schema SVG", !turno("testo").includes('"svg":"<svg') && !bibbia("testo").includes('"svg":"<svg'));
  controlla("base: SVG senza primo piano né gradienti", turno("base").includes('"svg":"<svg') && !turno("base").includes('"primoPiano":"<svg') && !turno("base").includes("linearGradient, radialGradient"));
  controlla("avanzata (predefinita): primo piano, gradienti e piani", turno(undefined) === turno("avanzata") && bibbia("avanzata").includes('"primoPiano":"<svg') && turno("avanzata").includes("radialGradient") && turno("avanzata").includes('"piano"'));
  controlla("livello sconosciuto → avanzata, con più token", Ponte.livelloValido("ultra") === "avanzata" && Ponte.LIVELLI.avanzata.maxTurno > Ponte.LIVELLI.base.maxTurno && Ponte.LIVELLI.testo.maxTurno < Ponte.LIVELLI.base.maxTurno);
  controlla("tornando in un luogo si chiedono solo le variazioni", turno("base").includes("NON ridisegnarla") && turno("base").includes('"op":"ritocco"') && turno("base").includes('"op":"ridisegna"') && !turno("testo").includes('"op":"ritocco"'));
}

console.log("Piani, primo piano e variazioni della grafica");
{
  const { stato } = M.creaPartita({ idea: "prova piani" });
  M.applicaEffetti(stato, [
    { op: "crea_luogo", nome: "Serra", descrizione: "Vetri.", direzione: "nord", entra: true, svg: SVG_SCENA, primoPiano: SVG_SCENA },
  ]);
  const nomeVaso = nomeCaso(stato, "facile", "vaso", true);
  M.applicaEffetti(stato, [
    { op: "crea_png", png: { nome: "giardiniere", descrizione: "Pota.", svg: SVG_ELEMENTO, piano: "fondo" } },
    { op: "cerca", difficolta: "facile", oggetto: { nome: nomeVaso, descrizione: "Crepato.", svg: SVG_ELEMENTO, piano: "vicinissimo" } },
  ]);
  const L = stato.luoghi[stato.luogo];
  controlla("primo piano del luogo conservato", L.primoPiano === SVG_SCENA);
  controlla("piano valido conservato, sconosciuto scartato", L.png[0].piano === "fondo" && !L.oggetti[0].piano, [L.png[0].piano, L.oggetti[0].piano]);
  const Modello = require("./grafica/modello.js");
  const mod = Modello.creaModello(stato, {});
  const zGiardiniere = mod.elementi.find((e) => e.nome === "giardiniere").z;
  controlla("il piano di fondo allontana l'elemento", zGiardiniere > 3 && mod.primoPiano === SVG_SCENA, zGiardiniere);

  const SVG_CREPA = SVG_SCENA.replace("#202630", "#ff0000");
  let e = M.applicaEffetti(stato, [
    { op: "ritocco", nome: "vetro rotto", svg: SVG_SCENA },
    { op: "ritocco", nome: "vetro rotto", svg: SVG_CREPA },
    { op: "ritocco", nome: "senza svg" },
    { op: "ridisegna", elemento: nomeVaso, svg: SVG_ELEMENTO.replace("#c8a060", "#000000") },
    { op: "ridisegna", elemento: "fantasma", svg: SVG_ELEMENTO },
  ]);
  controlla("ritocco con lo stesso nome sostituisce", L.ritocchi.length === 1 && L.ritocchi[0].svg === SVG_CREPA, L.ritocchi);
  controlla("ridisegna cambia solo l'elemento indicato", L.oggetti[0].svg.includes("#000000") && L.png[0].svg === SVG_ELEMENTO);
  controlla("ritocco senza svg e ridisegna di elementi assenti rifiutati", e.rifiutati.length === 2, e.rifiutati);
  controlla("stato per l'AI elenca i ritocchi senza SVG", JSON.stringify(M.statoCompatto(stato).luogo.ritocchi) === '["vetro rotto"]' && !JSON.stringify(M.statoCompatto(stato)).includes("<svg"));
  M.applicaEffetti(stato, [{ op: "ritocco", nome: "vetro rotto", rimuovi: true }]);
  controlla("ritocco rimosso", L.ritocchi.length === 0);
  M.applicaEffetti(stato, Array.from({ length: 6 }, (_, i) => ({ op: "ritocco", nome: "r" + i, svg: SVG_SCENA })));
  controlla("al massimo 4 ritocchi per luogo", L.ritocchi.length === 4 && L.ritocchi[0].nome === "r2", L.ritocchi.map((r) => r.nome));
}

console.log(`\n==== ${ok} ok, ${ko} falliti ====`);
process.exit(ko ? 1 : 0);
