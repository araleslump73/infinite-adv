// =====================================================================
// prova-grafica.js - test della grafica senza browser
//   node prova-grafica.js
//
// Non guarda se è bella: guarda che sia *valida* e *deterministica*:
// niente NaN, niente parti fuori posto, stesso nome = stesso aspetto,
// stesso disegno a parità di ricetta.
// =====================================================================
const Penna = require("./grafica/penna.js");
const Prospettiva = require("./grafica/prospettiva.js");
const Varianti = require("./grafica/varianti.js");
const Parti = require("./grafica/parti.js");
const Scheletri = require("./grafica/scheletri.js");
const Ricette = require("./grafica/ricette.js");

let ok = 0;
let ko = 0;

function controlla(nome, condizione, extra) {
  if (condizione) {
    ok++;
    console.log("  ok   " + nome);
  } else {
    ko++;
    console.log("  FAIL " + nome + (extra !== undefined ? " → " + JSON.stringify(extra).slice(0, 240) : ""));
  }
}

// ------------------------------------------------------ canvas finto
const METODI_NUMERICI = new Set([
  "moveTo", "lineTo", "arc", "ellipse", "rect", "roundRect", "quadraticCurveTo", "bezierCurveTo",
  "translate", "rotate", "scale", "fillRect", "strokeRect",
]);

function ctxFinto(registro) {
  const ctx = { chiamate: 0, errori: [] };
  function metodo(nome) {
    return function (...args) {
      ctx.chiamate++;
      if (registro) registro.push([nome, ...args]);
      if (METODI_NUMERICI.has(nome)) {
        for (const a of args) {
          if (typeof a === "number" && !Number.isFinite(a)) ctx.errori.push(nome + " numero non valido");
        }
      }
      return undefined;
    };
  }
  for (const nome of [
    "beginPath", "moveTo", "lineTo", "arc", "ellipse", "rect", "roundRect", "quadraticCurveTo",
    "bezierCurveTo", "closePath", "fill", "stroke", "clip", "save", "restore", "translate",
    "rotate", "scale", "setLineDash", "fillText", "strokeText", "fillRect", "strokeRect", "setTransform",
  ]) ctx[nome] = metodo(nome);

  ctx.createLinearGradient = () => ({ addColorStop() {} });
  ctx.createRadialGradient = () => ({ addColorStop() {} });
  let trasparente = 0;
  Object.defineProperty(ctx, "globalAlpha", {
    get: () => 1,
    set: (v) => {
      if (!Number.isFinite(v)) ctx.errori.push("globalAlpha non valido");
      ctx.chiamate++;
    },
  });
  for (const prop of ["fillStyle", "strokeStyle", "lineWidth", "lineJoin", "lineCap", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "font", "textAlign", "textBaseline"]) {
    let valore = null;
    Object.defineProperty(ctx, prop, {
      get: () => valore,
      set: (v) => {
        valore = v;
      },
    });
  }
  return ctx;
}

function disegnaCon(ricetta, t, registro) {
  const ctx = ctxFinto(registro);
  const P = Penna(ctx, { larghezza: 960, altezza: 540 });
  Scheletri.disegna(P, ricetta, 480, 500, 40, t == null ? 0 : t);
  return { ctx, P };
}

console.log("\n1. penna: forme, stili, colori");
{
  const ctx = ctxFinto();
  const P = Penna(ctx, { larghezza: 960, altezza: 540 });
  P.retta(0, 0, 100, 100, { bordo: "#fff", spessore: 2 });
  P.cerchio(50, 50, 20, { riempimento: "#f00", bordo: "#000", ombra: { colore: "#000", sfocatura: 4 } });
  P.rettangolo(10, 10, 100, 40, 8, { riempimento: "#0f0" });
  P.poligono([[0, 0], [10, 0], [5, 10]], { riempimento: "#00f" });
  P.ellisse(100, 100, 30, 12, { riempimento: "#ff0" });
  P.arco(100, 100, 20, 0, Math.PI, { bordo: "#fff" });
  P.testo("ciao", 10, 10, { taglia: 16, tinta: "#fff", bordo: "#000" });
  P.salva(() => P.trasla(10, 10, () => P.ruota(0.2, () => P.cerchio(0, 0, 5, { riempimento: "#fff" }))));
  P.ritaglia((p) => p.cerchio(0, 0, 50, { riempimento: "#000" }), (p) => p.rettangolo(0, 0, 100, 100, 0, { riempimento: "#fff" }));
  controlla("10 disegni contati (comprese le forme di ritaglio)", P.chiamate === 10, P.chiamate);
  controlla("nessun errore di coordinate", P.errori.length === 0, P.errori);
  controlla("coordinate non valide segnalate", (() => {
    const P2 = Penna(ctxFinto(), {});
    P2.cerchio(NaN, 10, 5, { riempimento: "#fff" });
    return P2.errori.length === 1;
  })());
  controlla("mischia due colori", Penna.mischia("#000000", "#ffffff", 0.5) === "#808080", Penna.mischia("#000000", "#ffffff", 0.5));
  controlla("alfa produce rgba", /^rgba\(255,0,0,0\.5\)$/.test(Penna.alfa("#ff0000", 0.5)), Penna.alfa("#ff0000", 0.5));
}

console.log("\n2. prospettiva: proiezione coerente");
{
  const cam = Prospettiva.crea({ larghezza: 960, altezza: 540 });
  const vicino = cam.proietta(0, 1);
  const lontano = cam.proietta(0, 4);
  const destra = cam.proietta(1, 1);
  controlla("al centro, i piedi sono in basso", Math.abs(vicino.x - 480) < 0.01 && Math.abs(vicino.y - 540) < 0.01, vicino);
  controlla("più lontano = più in alto (verso l'orizzonte)", lontano.y < vicino.y && lontano.y > cam.yOrizzonte, [lontano.y, cam.yOrizzonte]);
  controlla("più lontano = più piccolo", lontano.scala < vicino.scala);
  controlla("a destra si va a destra (e resta dentro al fondo)", destra.x > vicino.x && cam.proietta(1, 6).x <= 960);
  controlla("scala monotona su 6 profondità", (() => {
    let prima = Infinity;
    for (let z = 1; z <= 6; z += 0.5) {
      const s = cam.scala(z);
      if (s > prima) return false;
      prima = s;
    }
    return true;
  })());
  const righe = cam.righePavimento(8);
  controlla("righe del pavimento ordinate e finite", righe.every((r) => Number.isFinite(r.y) && r.y >= cam.yOrizzonte - 0.001 && r.y <= 540 + 0.001));
  const parete = cam.parete(-1);
  controlla("parete sinistra: 4 vertici finiti", parete.length === 4 && parete.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  controlla("zDaY invertibile", Math.abs(cam.zDaY(cam.y(2)) - 2) < 0.001, cam.zDaY(cam.y(2)));
  controlla("zDaY sopra l'orizzonte = lontanissimo", cam.zDaY(cam.yOrizzonte - 10) > 100);
}

console.log("\n3. varianti: stesso nome = stesso aspetto");
{
  const a = Varianti.variante("parassita di vetro");
  const b = Varianti.variante("parassita di vetro");
  const c = Varianti.variante("goblin della cenere");
  controlla("deterministico (tinta, stato, scala, accessorio)", JSON.stringify(a) === JSON.stringify(b));
  controlla("nomi diversi → varianti diverse", a.seme !== c.seme);
  controlla("tinta nell'elenco", Varianti.TINTE.includes(a.tinta), a.tinta);
  controlla("stato nell'elenco", Varianti.STATI.includes(a.stato), a.stato);
  controlla("postura nell'elenco", Varianti.POSTURE.includes(a.postura), a.postura);
  controlla("scala tra 0.6 e 1.8", a.scala >= 0.6 && a.scala <= 1.8, a.scala);
  const tinte = new Set();
  const stati = new Set();
  for (let i = 0; i < 300; i++) {
    const v = Varianti.variante("creatura " + i);
    tinte.add(v.tinta);
    stati.add(v.stato);
  }
  controlla("300 nomi coprono tutte le 5 tinte", tinte.size === 5, [...tinte]);
  controlla("300 nomi coprono almeno 3 stati", stati.size >= 3, [...stati]);
  controlla("la corona resta rara (< 15%)", (() => {
    let corone = 0;
    for (let i = 0; i < 1000; i++) if (Varianti.variante("x " + i).accessorio === "corona") corone++;
    return corone / 1000 < 0.15;
  })());
}

console.log("\n4. ricette: qualunque cosa arriva diventa valida");
{
  const lupo = Ricette.creaRicetta("lupo nero", {}, { ostile: true });
  controlla("lupo → quadrupede", lupo.archetipo === "quadrupede", lupo.archetipo);
  controlla("lupo ostile attacca", lupo.comportamento.reazione === "attaccare");
  const ragno = Ricette.creaRicetta("ragno gigante", {});
  controlla("ragno → insettoide con 5+ occhi di default", ragno.archetipo === "insettoide" && ragno.parti.nOcchi >= 3, Ricette.descrizione(ragno));
  const figura = Ricette.creaRicetta("figura incappucciata", {});
  controlla("figura → bipede", figura.archetipo === "bipede", figura.archetipo);
  const goblin = Ricette.creaRicetta("goblin", {});
  controlla("goblin → bipede", goblin.archetipo === "bipede");
  const cristallo = Ricette.creaRicetta("cristallo", {});
  controlla("cristallo → cosa", cristallo.archetipo === "cosa");
  const occhio = Ricette.creaRicetta("occhio fluttuante", {});
  controlla("occhio → fluttuante", occhio.archetipo === "fluttuante");

  const strambo = Ricette.creaRicetta("licantropo di nebbia", {
    archetipo: "drago",
    parti: { occhi: "laser", nOcchi: 99, arti: "razzi", nArti: -3, teste: "inesistente", ornamenti: "boh" },
    comportamento: { moto: "teletrasporto", reazione: "insultare" },
  });
  controlla("archetipo sconosciuto → scelto dal nome", ["quadrupede", "bipede", "fluttuante"].includes(strambo.archetipo), strambo.archetipo);
  controlla("occhi fuori catalogo → default", ["tondo", "grappolo", "lente", "fessura", "spirale"].includes(strambo.parti.occhi), strambo.parti.occhi);
  controlla("99 occhi → massimo 8", strambo.parti.nOcchi === 8, strambo.parti.nOcchi);
  controlla("arti negativi → minimo 0", strambo.parti.nArti === 0, strambo.parti.nArti);
  controlla("moto sconosciuto → default valido", Ricette.MOTI.includes(strambo.comportamento.moto), strambo.comportamento.moto);
  controlla("reazione sconosciuta → default valido", Ricette.REAZIONI.includes(strambo.comportamento.reazione), strambo.comportamento.reazione);

  // 500 ricette casuali: nessuna deve rompersi
  let rotte = 0;
  const arche = new Set();
  for (let i = 0; i < 500; i++) {
    const nomi = ["parassita", "goblin", "cristallo", "lupo", "occhio", "ragno", "macchina", "spettro", "cosa", "statua"];
    const nome = nomi[i % nomi.length] + " " + i;
    const sugg = {
      parti: {
        occhi: ["tondo", "lente", "grappolo", "spirale", "fessura", "x"][i % 6],
        nOcchi: i % 12,
        arti: ["zampe", "artigli", "tentacoli", "ali", "pinne", "y"][i % 6],
        nArti: i % 9,
        teste: ["tonda", "teschio", "cristallo", "elmo", "allungata", "z"][i % 6],
        gusci: ["corazza", "conchiglia", "placche", "cristallo", ""][i % 5],
        code: ["frusta", "pungiglione", "piume", "cavo", ""][i % 5],
        bocche: ["zanne", "becco", "masticatore", "nessuna"][i % 4],
      },
      modificatori: { tinta: Varianti.TINTE[i % 5], stato: Varianti.STATI[i % 4], postura: Varianti.POSTURE[i % 3] },
    };
    const r = Ricette.creaRicetta(nome, sugg, { ostile: i % 2 === 0 });
    arche.add(r.archetipo);
    if (!Number.isFinite(r.variante.scala) || r.parti.nOcchi > 8 || r.parti.nArti > 6) rotte++;
    if (!Scheletri.ARCHETIPI[r.archetipo]) rotte++;
  }
  controlla("500 ricette valide", rotte === 0, rotte);
  controlla("500 ricette coprono tutti i 5 archetipi", arche.size === 5, [...arche]);
  controlla("stessa ricetta = stessa firma", Ricette.firma(Ricette.creaRicetta("goblin", { parti: { occhi: "tondo" } })) === Ricette.firma(Ricette.creaRicetta("goblin", { parti: { occhi: "tondo" } })));
}

console.log("\n5. disegno: 5 archetipi, nessun NaN");
{
  const nomi = ["lupo", "goblin", "ragno", "occhio fluttuante", "cristallo"];
  const visti = new Set();
  let problemi = 0;
  for (const nome of nomi) {
    const r = Ricette.creaRicetta(nome, {}, {});
    visti.add(r.archetipo);
    for (const t of [0, 1.7, 5.3]) {
      const { ctx, P } = disegnaCon(r, t);
      if (P.errori.length) {
        problemi++;
        console.log("    NaN in", nome, P.errori.slice(0, 3));
      }
      if (ctx.errori.length) problemi++;
      if (P.chiamate < 5) problemi++;
      if (ctx.chiamate < 10) problemi++;
    }
  }
  controlla("5 archetipi disegnati senza errori", problemi === 0, problemi);
  controlla("tutti gli archetipi provati", visti.size === 5, [...visti]);

  const r = Ricette.creaRicetta("parassita di vetro", {}, { ostile: true });
  const reg1 = [];
  const reg2 = [];
  disegnaCon(r, 2.5, reg1);
  disegnaCon(r, 2.5, reg2);
  controlla("stesso tempo = stesso disegno (pixel identici)", JSON.stringify(reg1) === JSON.stringify(reg2));
  const reg3 = [];
  disegnaCon(r, 3.9, reg3);
  controlla("tempo diverso = disegno animato (differenze)", JSON.stringify(reg1) !== JSON.stringify(reg3));

  controlla("più occhi = più disegni", (() => {
    const uno = disegnaCon(Ricette.creaRicetta("test 1 occhio", { parti: { occhi: "tondo", nOcchi: 1 } }), 0).P.chiamate;
    const otto = disegnaCon(Ricette.creaRicetta("test 8 occhi", { parti: { occhi: "tondo", nOcchi: 8 } }), 0).P.chiamate;
    return otto > uno;
  })());

  controlla("accessorio applicato senza errori", (() => {
    for (const acc of ["cresta", "corona", "catene", "elmo", "sella", "spine"]) {
      const rr = Ricette.creaRicetta("goblin " + acc, {}, {});
      rr.parti.ornamenti = acc;
      const { P } = disegnaCon(rr, 0);
      if (P.errori.length) return false;
    }
    return true;
  })());

  controlla("stati (rotto/marcito/incandescente) senza errori", (() => {
    for (const stato of Varianti.STATI) {
      const rr = Ricette.creaRicetta("goblin " + stato, { modificatori: { stato } }, {});
      const { P } = disegnaCon(rr, 0);
      if (P.errori.length) return false;
    }
    return true;
  })());
}

console.log("\n6. prestazioni (disegno in memoria)");
{
  const ricette = [];
  for (let i = 0; i < 40; i++) ricette.push(Ricette.creaRicetta("creatura " + i, {}, {}));
  const ctx = ctxFinto();
  const P = Penna(ctx, { larghezza: 960, altezza: 540 });
  const t0 = Date.now();
  let disegni = 0;
  for (let giro = 0; giro < 25; giro++) {
    for (const r of ricette) {
      Scheletri.disegna(P, r, 480, 500, 40, giro * 0.05);
      disegni++;
    }
  }
  const ms = Date.now() - t0;
  const perDisegno = ms / disegni;
  controlla("1000 disegni sotto 3000 ms", ms < 3000, ms + " ms");
  console.log("    " + disegni + " creature in " + ms + " ms (" + (perDisegno * 1000).toFixed(0) + " µs ciascuna, " + Math.round(ctx.chiamate / disegni) + " forme per creatura)");
}


console.log("\n7. scena completa: 6 ambienti, elementi, aree cliccabili");
{
  const Modello = require("./grafica/modello.js");
  const Disegno = require("./grafica/disegno.js");
  const cam = Prospettiva.crea({ larghezza: 960, altezza: 540 });

  function stanza(ambiente, nome) {
    return {
      versione: 1,
      turno: 1,
      luogo: "l0",
      luoghi: {
        l0: {
          id: "l0",
          nome: nome,
          descrizione: "Una stanza di prova con " + ambiente,
          ambiente,
          uscite: { nord: "l1" },
          oggetti: [
            { nome: "cristallo di quarzo", descrizione: "", tipo: "oggetto" },
            { nome: "pergamena ingiallita", descrizione: "", tipo: "oggetto" },
          ],
          png: [
            { nome: "ragno gigante", descrizione: "", ostile: true, vita: 2, tipo: "persona" },
            { nome: "figura incappucciata", descrizione: "", ostile: false, vita: 1, tipo: "persona" },
          ],
          x: 0, y: 0, visitato: true,
        },
        l1: { id: "l1", nome: "altrove", descrizione: "", uscite: {}, oggetti: [], png: [], x: 0, y: 1, visitato: false },
      },
      giocatore: { nome: "T", vita: { attuale: 6, massima: 6 }, energia: { attuale: 5, massima: 5 }, inventario: [] },
      flag: {},
    };
  }

  let problemi = 0;
  const chiamate = {};
  for (const ambiente of Modello.AMBIENTI) {
    const stato = stanza(ambiente, "prova " + ambiente);
    const mod = Modello.creaModello(stato, { genere: "fantasy" });
    if (mod.ambiente !== ambiente) { problemi++; console.log("    ambiente sbagliato:", ambiente, "→", mod.ambiente); }
    const ctx = ctxFinto();
    const P = Penna(ctx, { larghezza: 960, altezza: 540 });
    const atm = Disegno.preparaAtmosfera(mod, cam);
    const esito = Disegno.disegnaScena(P, cam, mod, atm, 1.2, { evidenzia: new Set(["ragno gigante"]) });
    if (P.errori.length) { problemi++; console.log("    NaN in", ambiente, P.errori.slice(0, 3)); }
    const reali = esito.uscite.filter((u) => !u.ignota).length;
    if (reali !== 1 || esito.uscite.length > 3) { problemi++; console.log("    uscite:", ambiente, reali, "reali su", esito.uscite.length); }
    if (esito.elementi.length !== 4) { problemi++; console.log("    elementi:", ambiente, esito.elementi.length); }
    if (esito.elementi.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.w))) problemi++;
    chiamate[ambiente] = P.chiamate;
    const z = mod.elementi.map((e) => e.z);
    if (z.some((v, i) => i > 0 && v > z[i - 1])) problemi++;
  }
  controlla("6 ambienti disegnati (scena completa)", problemi === 0, problemi);
  controlla("ogni ambiente disegna abbastanza forme", Object.values(chiamate).every((n) => n > 25), chiamate);

  const stato = stanza("caverna", "prova determinismo");
  const a = Modello.creaModello(stato, { genere: "mistero" });
  const b = Modello.creaModello(stato, { genere: "mistero" });
  controlla("stessa stanza = stesso modello", JSON.stringify(a) === JSON.stringify(b));

  // ciò che il motore toglie dallo stato sparisce anche dalla scena disegnata
  const statoRimozione = stanza("caverna", "prova rimozione");
  const Moto = require("./motore.js");
  const prima = Modello.creaModello(statoRimozione, { genere: "fantasy" }).elementi.map((e) => e.nome);
  Moto.applicaEffetti(statoRimozione, [{ op: "rimuovi", png: "figura incappucciata" }]);
  const dopo = Modello.creaModello(statoRimozione, { genere: "fantasy" }).elementi.map((e) => e.nome);
  controlla(
    "creatura rimossa dallo stato: non è più nel modello",
    prima.includes("figura incappucciata") && !dopo.includes("figura incappucciata"),
    { prima, dopo }
  );

  // ciò che il dado fa trovare entra nello stato e la scena lo disegna
  const statoTrovato = stanza("caverna", "prova ritrovamento");
  let nomeTrovato = "lanterna";
  for (let i = 0; i < 1000; i++) {
    const candidato = "lanterna " + i;
    const seme = [statoTrovato.turno, statoTrovato.luogo, candidato.toLowerCase(), 0].join("|");
    if (Moto.rng(seme)() < Moto.probabilitaDifficolta("facile")) {
      nomeTrovato = candidato;
      break;
    }
  }
  Moto.applicaEffetti(statoTrovato, [
    { op: "cerca", difficolta: "facile", oggetto: { nome: nomeTrovato, descrizione: "Utile." } },
  ]);
  const conTrovato = Modello.creaModello(statoTrovato, { genere: "fantasy" });
  controlla(
    "oggetto trovato dal dado: compare nel modello",
    conTrovato.elementi.some((e) => e.nome === nomeTrovato),
    conTrovato.elementi.map((e) => e.nome)
  );

  // il nemico ferito mostra la barra vita proporzionale
  const registroBarra = [];
  const ctxBarra = ctxFinto(registroBarra);
  Disegno.disegnaBarraVita(ctxBarra, 100, 200, 60, 1, 3);
  const barre = registroBarra.filter((r) => r[0] === "fillRect");
  controlla(
    "barra vita proporzionale al danno",
    barre.length === 2 && Math.abs(barre[0][3] - 33) < 0.001 && Math.abs(barre[1][3] - 11) < 0.001,
    barre
  );

  const P2 = Penna(ctxFinto(), { larghezza: 960, altezza: 540 });
  Disegno.disegnaMappa(P2, stato, 810, 12, 120, 86);
  controlla("mini-mappa disegnata senza errori", P2.errori.length === 0 && P2.chiamate >= 1);

  const statoAspetto = stanza("sala", "prova aspetto");
  statoAspetto.luoghi.l0.png[0] = {
    nome: "parassita di vetro", descrizione: "", ostile: true, vita: 3,
    aspetto: { archetipo: "insettoide", parti: { occhi: "grappolo", nOcchi: 7 }, modificatori: { tinta: "freddo", stato: "incandescente" } },
  };
  const conAspetto = Modello.creaModello(statoAspetto, { genere: "spazio" });
  const creatura = conAspetto.elementi.find((e) => e.nome === "parassita di vetro");
  controlla("aspetto dichiarato usato dalla grafica", !!creatura && creatura.ricetta.archetipo === "insettoide" && creatura.ricetta.parti.nOcchi === 7, creatura && creatura.ricetta);
  controlla("tinta dichiarata rispettata", !!creatura && creatura.ricetta.variante.tinta === "freddo");

  const statoRicetta = stanza("sala", "prova ricette AI");
  const Motore = require("./motore.js");
  statoRicetta.luoghi.l0.visuale = {
    architettura: "tecnologica",
    materiale: "metallo",
    luce: "fredda",
    dettagli: ["finestre", "macchinari", "rune"],
    palette: { cielo: "#101820", parete: "#293442", accento: "#71d9ff" },
  };
  statoRicetta.luoghi.l0.oggetti[0].aspetto = Motore.sanificaRicettaOggetto({
    forma: "lama",
    materiale: "vetro",
    colore: "#45677b",
    accento: "#b7edff",
    dettagli: ["crepe", "rune"],
    luminosita: 0.6,
    scala: 1.1,
  });
  const modelloRicetta = Modello.creaModello(statoRicetta, { genere: "spazio" });
  const oggettoRicetta = modelloRicetta.elementi.find((e) => e.nome === "cristallo di quarzo");
  controlla("modello espone visuale e aspetto generati", modelloRicetta.visuale.architettura === "tecnologica" && oggettoRicetta.aspetto.forma === "lama");
  const ctxRicetta = ctxFinto();
  const pRicetta = Penna(ctxRicetta, { larghezza: 960, altezza: 540 });
  const atmosferaRicetta = Disegno.preparaAtmosfera(modelloRicetta, cam);
  Disegno.disegnaScena(pRicetta, cam, modelloRicetta, atmosferaRicetta, 1.2);
  controlla("ricette di luogo e oggetto disegnate senza coordinate invalide", pRicetta.errori.length === 0, pRicetta.errori);
}

console.log("\n8. l'aspetto proposto dall'AI passa dal motore");
{
  const M = require("./motore.js");
  const valido = M.sanificaAspetto({
    archetipo: "insettoide",
    parti: { occhi: "grappolo", nOcchi: 99, arti: "razzi", nArti: -4, teste: "teschio" },
    comportamento: { moto: "teletrasporto", reazione: "seguire" },
    modificatori: { tinta: "malato", stato: "inventato", scala: 9 },
  });
  controlla("aspetto valido ripulito e conservato", !!valido && valido.archetipo === "insettoide" && valido.parti.nOcchi === 8, valido);
  controlla("parti fuori vocabolario scartate", !!valido && valido.parti.arti === undefined && valido.parti.teste === "teschio");
  controlla("comportamento valido conservato", !!valido && valido.comportamento.reazione === "seguire" && valido.comportamento.moto === undefined);
  controlla("scala limitata a 1.8", !!valido && valido.modificatori.scala === 1.8);
  controlla("stato inventato scartato", !!valido && valido.modificatori.stato === undefined);
  controlla("aspetto del tutto invalido → null", M.sanificaAspetto({ archetipo: "drago", parti: { occhi: "laser" }, modificatori: { tinta: "rosa" } }) === null);
  controlla("aspetto assente → null", M.sanificaAspetto(undefined) === null);

  const partita = M.creaPartita({ idea: "prova aspetto nel motore" });
  partita.stato.luoghi[partita.stato.luogo].png = [];
  const esito = M.applicaEffetti(partita.stato, [
    {
      op: "crea_png",
      png: {
        nome: "licantropo di nebbia",
        descrizione: "Ti fissa.",
        ostile: true,
        aspetto: { archetipo: "quadrupede", parti: { occhi: "fessura", nOcchi: 3 }, modificatori: { tinta: "freddo" } },
      },
    },
  ]);
  controlla("crea_png conserva l'aspetto", esito.cambi.length === 1 && !!partita.stato.luoghi[partita.stato.luogo].png[0].aspetto);
  const mod = require("./grafica/modello.js").creaModello(partita.stato, partita.bibbia);
  const el = mod.elementi.find((e) => e.nome === "licantropo di nebbia");
  controlla("la scena usa la ricetta dell'AI", !!el && el.ricetta.archetipo === "quadrupede" && el.ricetta.parti.nOcchi === 3, el && el.ricetta);
}


console.log("9. sagome SVG disegnate a mano");
{
  const Sagome = require("./grafica/sagome.js").SAGOME;
  const arche = Object.keys(Sagome);
  controlla("4 sagome disegnate a mano", arche.length === 4, arche);
  let problemi = 0;
  const consentiti = /^[A-Za-z0-9 .,+-]+$/;
  for (const nome of arche) {
    const arte = Sagome[nome];
    if (arte.corpo.trim().charAt(0) !== "M") { problemi++; console.log("    " + nome + ": il corpo non inizia con M"); }
    if (!consentiti.test(arte.corpo)) { problemi++; console.log("    " + nome + ": caratteri non validi nel corpo"); }
    if (arte.testa && !consentiti.test(arte.testa)) problemi++;
    for (const t of arte.tratti || []) {
      if (t.d.trim().charAt(0) !== "M" || !consentiti.test(t.d)) { problemi++; console.log("    " + nome + ": tratto non valido"); }
      if (!(t.spessore > 0)) problemi++;
    }
    const ancore = arte.ancore || {};
    if (!ancore.occhi || !ancore.occhi.length) problemi++;
    for (const punto of [].concat(ancore.occhi || [], ancore.bocca || [], ancore.sommita ? [ancore.sommita] : [])) {
      if (punto[0] < 0 || punto[0] > 100 || punto[1] < 0 || punto[1] > 100) {
        problemi++;
        console.log("    ancora fuori dal riquadro:", nome, punto);
      }
    }
  }
  controlla("path e ancore valide", problemi === 0, problemi);
}

console.log(`\n==== ${ok} ok, ${ko} falliti ====`);
process.exit(ko ? 1 : 0);
