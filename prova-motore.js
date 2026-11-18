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
      op: "crea_oggetto",
      oggetto: {
        nome: "sigillo sconosciuto",
        descrizione: "Un disco di metallo.",
        svg: SVG_ELEMENTO,
        aspetto: { forma: "anello", materiale: "metallo", colore: "#777777", accento: "#ffcc66", dettagli: ["simboli"] },
      },
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
  controlla("crea_oggetto conserva la ricetta", stato.luoghi[stato.luogo].oggetti[0].aspetto && stato.luoghi[stato.luogo].oggetti[0].aspetto.forma === "anello");
  controlla("crea_oggetto e crea_png conservano SVG AI", stato.luoghi.l0.oggetti[0].svg === SVG_ELEMENTO && stato.luoghi.l0.png[0].svg === SVG_ELEMENTO);
  controlla("vita non supera il massimo", stato.giocatore.vita.attuale <= stato.giocatore.vita.massima);
  controlla("un turno per ogni chiamata (3)", stato.turno === 3, stato.turno);
  controlla("invarianti dopo gli effetti", invarianti(stato).length === 0, invarianti(stato));
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
  controlla("turni richiedono SVG per nuovi luoghi, oggetti e creature", promptTurno.includes('"crea_oggetto"') && promptTurno.includes('"crea_luogo"') && promptTurno.includes('"crea_png"') && promptTurno.includes("SVG di sfondo"));
  controlla("prompt esclude grafica di ripiego del programma", promptBibbia.includes("SOLO dagli SVG") && promptTurno.includes("SOLO dagli SVG"));
  controlla("prompt chiedono atmosfera e moto", promptBibbia.includes('"atmosfera"') && promptTurno.includes('"op":"atmosfera"') && promptTurno.includes('"moto"'));
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
  const esito = M.applicaEffetti(stato, [
    { op: "atmosfera", atmosfera: { luce: 0.3, movimento: "tremola" } },
    { op: "crea_oggetto", oggetto: { nome: "lanterna", descrizione: "Oscilla.", svg: SVG_ELEMENTO, moto: "oscilla" } },
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
    { op: "crea_png", png: { nome: "giardiniere", descrizione: "Pota.", svg: SVG_ELEMENTO, piano: "fondo" } },
    { op: "crea_oggetto", oggetto: { nome: "vaso", descrizione: "Crepato.", svg: SVG_ELEMENTO, piano: "vicinissimo" } },
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
    { op: "ridisegna", elemento: "vaso", svg: SVG_ELEMENTO.replace("#c8a060", "#000000") },
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
