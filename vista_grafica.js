// =====================================================================
// vista_grafica.js - la scena a tutto schermo
//
// Legge lo stato tramite grafica/modello.js, lo disegna sul canvas che
// riempie la finestra e ascolta l'evento "turno" emesso da vista_testo.js.
//
// Non applica nessuna regola: clic e tasti diventano comandi testuali
// ("vai nord", "esamino l'amuleto") che passano dalla stessa pipeline
// dell'AI. Una sola verità, due modi di guardarla.
// =====================================================================
(function (root) {
  "use strict";

  const G = {
    pronta: false,
    attiva: false,
    larg: 960,
    alt: 540,
    dpr: 1,
    modello: null,
    atmosfera: null,
    elementi: [],
    sfondo: null, // canvas fuori schermo con la stanza statica
    sfondoPronto: false,
    t: 0,
    inizio: 0,
    dissolvenza: 0,
    lampo: null,
    scossa: 0,
    evidenzia: new Map(),
    ultimoTurno: null,
    fps: 0,
    chiamate: 0,
    ultimoFrame: 0,
    caricamento: null, // testo mostrato mentre l'AI inventa il mondo
    effetti: true, // particelle, scosse, lampi
    // movimento della visuale e degli elementi: spento per chi chiede meno animazioni
    movimento: !(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches),
    camera: null,
    particelleRidotte: false,
    fpsBassoDa: 0,
  };

  let canvas = null;
  let ctx = null;
  let P = null;
  let cam = null;

  const ora = () => performance.now();

  // ------------------------------------------------------- ponti
  function api() {
    return root.Avventura || null;
  }
  function stato() {
    const a = api();
    return a ? a.stato() : null;
  }
  function bibbia() {
    const a = api();
    return a ? a.bibbia() : null;
  }

  // --------------------------------------------------- preparazione
  function misura() {
    if (!canvas) return { w: 0, h: 0 };
    const r = canvas.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }

  function impostaDimensioni(w, h) {
    if (w < 120 || h < 120) return false;
    // la scena è sempre un palco 16:9 (come gli SVG dell'AI) che "copre" il
    // riquadro: niente deformazioni, si taglia un po' sopra e sotto
    const s = Math.max(w / 16, h / 9);
    G.vistaW = w;
    G.vistaH = h;
    G.larg = Math.round(16 * s);
    G.alt = Math.round(9 * s);
    G.offX = (w - G.larg) / 2;
    G.offY = (h - G.alt) * 0.55;
    G.dpr = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.round(w * G.dpr);
    canvas.height = Math.round(h * G.dpr);
    ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return false;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, G.offX * G.dpr, G.offY * G.dpr);
    P = Penna(ctx, { larghezza: G.larg, altezza: G.alt });
    // su schermi stretti la scena si "allarga": gli elementi non si ammassano al centro
    cam = Prospettiva.crea({ larghezza: G.larg, altezza: G.alt, apertura: G.larg < 700 ? 0.92 : 0.56 });
    G.sfondoPronto = false;
    return true;
  }

  function preparaCanvas() {
    canvas = document.getElementById("canvas-scena");
    if (!canvas) return false;
    const { w, h } = misura();
    if (!w || !h) return false;
    return impostaDimensioni(w, h);
  }

  // quando la finestra cambia, la scena si adatta (nessuna distorsione)
  function ridimensiona() {
    if (!canvas || !G.pronta) return;
    if (document.body.classList.contains("solo-testo")) return;
    const { w, h } = misura();
    if (!w || !h) return;
    if (Math.abs(w - G.vistaW) < 3 && Math.abs(h - G.vistaH) < 3) return;
    impostaDimensioni(w, h);
    if (G.modello) {
      G.atmosfera = Disegno.preparaAtmosfera(G.modello, cam);
      G.sfondoPronto = false;
    }
  }

  function ricostruisci(conDissolvenza) {
    const st = stato();
    const bb = bibbia();
    if (!st || !bb || !cam) return;
    const vecchioId = G.modello ? G.modello.id : null;
    G.modello = Modello.creaModello(st, bb);
    G.atmosfera = Disegno.preparaAtmosfera(G.modello, cam);
    if (conDissolvenza && vecchioId !== G.modello.id) G.dissolvenza = 1;
    G.sfondoPronto = false;
  }

  // la stanza statica si disegna una volta sola su un canvas fuori schermo:
  // nel loop è un solo drawImage, anche a 1920×1080
  function preparaSfondo() {
    if (G.sfondoPronto || !G.modello || !ctx) return;
    // prima si aspetta che tutte le immagini siano pronte, poi si sostituisce
    // lo sfondo: così non resta mai un fotogramma vuoto (lampeggio)
    const valido = SvgAI.valida(G.modello.svg, "scena");
    const immagine = valido ? SvgAI.immagine(G.modello.svg, "scena") : null;
    if (valido && !immagine && !SvgAI.fallita(G.modello.svg, "scena")) return;
    // i ritocchi (variazioni comunicate dall'AI) si fondono con lo sfondo;
    // quelli non validi si saltano, quelli ancora in caricamento si aspettano
    const strati = [immagine];
    for (const r of G.modello.ritocchi || []) {
      if (!SvgAI.valida(r.svg, "scena") || SvgAI.fallita(r.svg, "scena")) continue;
      const imm = SvgAI.immagine(r.svg, "scena");
      if (!imm) return;
      strati.push(imm);
    }
    if (preparaPrimoPiano() === false) return;
    if (!G.sfondo) G.sfondo = document.createElement("canvas");
    const lw = Math.round(G.larg * G.dpr);
    const lh = Math.round(G.alt * G.dpr);
    if (G.sfondo.width !== lw || G.sfondo.height !== lh) {
      G.sfondo.width = lw;
      G.sfondo.height = lh;
    }
    const c2 = G.sfondo.getContext("2d");
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, G.sfondo.width, G.sfondo.height);
    c2.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    if (!immagine) strati.length = 0;
    const sfoca = Atmosfera.sfocaturaPx(G.modello.atmosfera, G.larg);
    if (sfoca && typeof c2.filter === "string") {
      // si disegna più grande: la sfocatura non lascia bordi trasparenti
      c2.filter = "blur(" + sfoca.toFixed(1) + "px)";
      for (const s of strati) c2.drawImage(s, -sfoca * 2, -sfoca * 2, G.larg + sfoca * 4, G.alt + sfoca * 4);
      c2.filter = "none";
    } else {
      for (const s of strati) c2.drawImage(s, 0, 0, G.larg, G.alt);
    }
    G.sfondoPronto = true;
  }

  // primo piano (solo grafica avanzata): canvas a parte, disegnato sopra gli
  // elementi con una parallasse più forte. Ritorna false se non ancora pronto.
  function preparaPrimoPiano() {
    const sorgente = G.modello.primoPiano;
    if (!sorgente || !SvgAI.valida(sorgente, "scena") || SvgAI.fallita(sorgente, "scena")) {
      G.primoPronto = false;
      return null;
    }
    const imm = SvgAI.immagine(sorgente, "scena");
    if (!imm) return false;
    if (!G.primo) G.primo = document.createElement("canvas");
    G.primo.width = Math.round(G.larg * G.dpr);
    G.primo.height = Math.round(G.alt * G.dpr);
    const c3 = G.primo.getContext("2d");
    c3.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    c3.clearRect(0, 0, G.larg, G.alt);
    // leggermente fuori fuoco: è vicinissimo alla camera
    if (typeof c3.filter === "string") c3.filter = "blur(" + Math.max(0.8, G.larg / 900).toFixed(1) + "px)";
    c3.drawImage(imm, 0, 0, G.larg, G.alt);
    c3.filter = "none";
    G.primoPronto = true;
    return true;
  }

  // ------------------------------------------------------- animazioni
  function aggiornaAtmosfera(dt) {
    const t = G.t;
    if (G.dissolvenza > 0) G.dissolvenza = Math.max(0, G.dissolvenza - dt * 2.2);
    if (G.lampo) {
      G.lampo.intensita = Math.max(0, G.lampo.intensita - dt * 2.4);
      if (G.lampo.intensita <= 0) G.lampo = null;
    }
    if (G.scossa > 0) G.scossa = Math.max(0, G.scossa - dt * 6);
    for (const [nome, scadenza] of G.evidenzia) if (scadenza < t) G.evidenzia.delete(nome);
  }

  // ------------------------------------------------------- caricamento
  // mentre l'AI inventa il mondo la scena non esiste ancora: si mostra
  // vuota: ogni segno visibile deve provenire da un SVG AI.
  function disegnaCaricamento() {
    ctx.clearRect(0, 0, G.larg, G.alt);
  }

  // ---------------------------------------------------------- disegno
  function disegna() {
    if (!P) return;
    if (!G.modello) {
      disegnaCaricamento();
      return;
    }
    const t = G.t;
    preparaSfondo();

    const a = G.modello.atmosfera;
    const mov = G.movimento ? Atmosfera.movimentoCamera(a, t) : { dx: 0, dy: 0, rot: 0, zoom: 1 };
    let zoom = mov.zoom;
    let sx = 0;
    let sy = 0;
    if (G.scossa > 0 && G.movimento) {
      sx = (Math.random() - 0.5) * 16 * G.scossa;
      sy = (Math.random() - 0.5) * 10 * G.scossa;
      zoom = Math.max(zoom, 1.03);
    }
    G.camera = mov;

    ctx.clearRect(0, 0, G.larg, G.alt);
    const cx = G.larg / 2;
    const cy = G.alt / 2;
    // parallasse: lo sfondo si muove meno, il primo piano di più
    const camera = (k, margine) => {
      ctx.save();
      ctx.translate(cx + (mov.dx + sx) * k, cy + (mov.dy + sy) * k);
      if (mov.rot) ctx.rotate(mov.rot * k);
      const z = Math.max(1, 1 + (zoom - 1) * k) * (margine || 1);
      if (z !== 1) ctx.scale(z, z);
      ctx.translate(-cx, -cy);
    };
    camera(0.6, zoom > 1 ? 1 + (zoom - 1) * 0.5 : 1);
    if (G.sfondo) ctx.drawImage(G.sfondo, 0, 0, G.larg, G.alt);
    ctx.restore();
    camera(1);
    G.elementi = Disegno.disegnaElementiSvg(ctx, cam, G.modello, t, { movimento: G.movimento });
    ctx.restore();
    if (G.primo && G.primoPronto) {
      camera(1.5, 1.04);
      ctx.drawImage(G.primo, 0, 0, G.larg, G.alt);
      ctx.restore();
    }

    Atmosfera.sovrapponi(ctx, a, G.larg, G.alt, t, { movimento: G.movimento });
    if (G.lampo && G.lampo.intensita > 0.01) {
      ctx.fillStyle = Atmosfera.rgba(G.lampo.colore, G.lampo.intensita);
      ctx.fillRect(0, 0, G.larg, G.alt);
    }
    if (G.dissolvenza > 0.01) {
      ctx.fillStyle = Atmosfera.rgba("#000000", Math.min(1, G.dissolvenza));
      ctx.fillRect(0, 0, G.larg, G.alt);
    }
  }

  function ciclo(adesso) {
    if (!G.attiva) return;
    requestAnimationFrame(ciclo);
    const dt = Math.min(0.05, (adesso - (G.ultimoFrame || adesso)) / 1000);
    G.ultimoFrame = adesso;
    G.t = (adesso - G.inizio) / 1000;
    G.fps = G.fps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;

    // se il disegno arranca, le particelle si riducono da sole
    if (G.fps < 40) {
      if (!G.fpsBassoDa) G.fpsBassoDa = adesso;
      else if (adesso - G.fpsBassoDa > 2000 && !G.particelleRidotte) G.particelleRidotte = true;
    } else {
      G.fpsBassoDa = 0;
      if (G.fps > 55) G.particelleRidotte = false;
    }

    aggiornaAtmosfera(dt);

    const prima = P.chiamate;
    disegna();
    G.chiamate = P.chiamate - prima;

    if (G.dissolvenza < 0.001) G.dissolvenza = 0;
    esportaStato();
  }

  function esportaStato() {
    root.__scena = {
      attiva: G.attiva,
      stanza: G.modello ? G.modello.nome : null,
      ambiente: G.modello ? G.modello.ambiente : null,
      meteo: G.modello ? G.modello.meteo : null,
      elementi: G.elementi.map((e) => e.nome),
      dettagli: (G.modello ? G.modello.elementi : []).map((e) =>
        e.svg ? e.nome + ":svg-ai" : e.nome + ":senza-svg"
      ),
      elementiAree: G.elementi.map((e) => ({ nome: e.nome, x: e.x, y: e.y, w: e.w, h: e.h })),
      atmosfera: G.modello ? G.modello.atmosfera : null,
      primoPiano: Boolean(G.primoPronto),
      ritocchi: G.modello ? (G.modello.ritocchi || []).map((r) => r.nome) : [],
      piani: (G.modello ? G.modello.elementi : []).map((e) => e.nome + ":" + (e.piano || "-") + ":" + e.z.toFixed(2)),
      camera: G.camera,
      evidenziati: [...G.evidenzia.keys()],
      fps: Math.round(G.fps),
      forme: G.chiamate,
      dissolvenza: Number(G.dissolvenza.toFixed(2)),
      lampo: G.lampo ? Number(G.lampo.intensita.toFixed(2)) : 0,
      schermo: { larghezza: G.larg, altezza: G.alt },
      caricamento: Boolean(G.caricamento),
      effetti: G.effetti,
      particelleRidotte: G.particelleRidotte,
    };
  }

  // ------------------------------------------------------------ turno
  function suTurno(ev) {
    const d = ev.detail || {};
    if (!stato()) return;
    const narrazione = String(d.narrazione || (d.risposta && d.risposta.narrazione) || "").toLowerCase();
    ricostruisci(Boolean(d.luogoPrima && d.luogoPrima !== d.luogoDopo));

    const scadenza = G.t + 2.6;
    for (const el of G.modello.elementi) {
      const nome = el.nome.toLowerCase();
      const radice = nome.split(/\s+/).filter((w) => w.length > 3)[0] || nome;
      if (narrazione.includes(nome) || (radice && narrazione.includes(radice))) G.evidenzia.set(nome, scadenza);
    }

    const cambi = (d.esito && d.esito.cambi) || [];
    for (const c of cambi) {
      if (/^vita -\d/.test(c)) {
        G.lampo = { colore: "#c0323f", intensita: G.effetti ? 0.42 : 0.2 };
        G.scossa = G.effetti ? 1 : 0;
      } else if (/^vita \+\d/.test(c)) {
        G.lampo = { colore: "#4ed08a", intensita: 0.2 };
      } else if (/^fine/.test(c)) {
        G.lampo = { colore: "#000000", intensita: 0.55 };
      }
    }
    G.ultimoTurno = d;
  }

  function suPartita() {
    G.caricamento = null;
    // il canvas può non essere ancora dimensionato (partita caricata da un salvataggio)
    if (!G.pronta) {
      if (!preparaCanvas()) return;
      G.pronta = true;
    }
    G.evidenzia.clear();
    G.lampo = null;
    G.scossa = 0;
    G.dissolvenza = 1;
    G.sfondoPronto = false;
    ridimensiona();
    ricostruisci(false);
  }

  // ------------------------------------------------------------ input
  function coordinate(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * G.vistaW - G.offX,
      y: ((ev.clientY - r.top) / r.height) * G.vistaH - G.offY
    };
  }

  function dentro(area, x, y) {
    return x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
  }

  function bersaglio(x, y) {
    for (const a of G.elementi) if (dentro(a, x, y)) return a;
    return null;
  }

  function comando(ev) {
    if (!G.attiva) return;
    const a = api();
    if (!a || a.inCorso() || !stato() || stato().finito) return;
    const { x, y } = coordinate(ev);
    const b = bersaglio(x, y);
    if (!b) return;
    a.esegui("esamino " + b.nome);
  }

  function punta(ev) {
    if (!G.attiva) return;
    const { x, y } = coordinate(ev);
    const b = bersaglio(x, y);
    canvas.style.cursor = b ? "pointer" : "default";
    canvas.title = b ? b.nome : "";
  }

  const TASTI = {
    ArrowUp: "nord",
    ArrowDown: "sud",
    ArrowLeft: "ovest",
    ArrowRight: "est",
    w: "nord",
    s: "sud",
    a: "ovest",
    d: "est",
    W: "nord",
    S: "sud",
    A: "ovest",
    D: "est",
  };

  function suTasto(ev) {
    if (!G.attiva) return;
    const a = api();
    if (!a || a.inCorso() || !stato() || stato().finito) return;
    const attivo = document.activeElement;
    if (attivo && (attivo.tagName === "INPUT" || attivo.tagName === "TEXTAREA")) return;
    const dir = TASTI[ev.key];
    if (dir) {
      ev.preventDefault();
      a.esegui("vai " + dir);
    }
  }

  // ------------------------------------------------------- accensione
  function accendi() {
    document.body.classList.add("scena-si");
    if (G.attiva) return;
    if (!G.pronta) {
      if (!preparaCanvas()) return;
      G.pronta = true;
    }
    G.attiva = true;
    G.ultimoFrame = ora();
    if (!G.inizio) G.inizio = ora();
    ridimensiona();
    if (!G.modello) ricostruisci(false);
    requestAnimationFrame(ciclo);
  }

  function spegni() {
    G.attiva = false;
    document.body.classList.remove("scena-si");
    esportaStato();
  }

  function collega() {
    document.addEventListener("turno", suTurno);
    document.addEventListener("partita", suPartita);
    canvas.addEventListener("click", comando);
    canvas.addEventListener("mousemove", punta);
    document.addEventListener("keydown", suTasto);
    if (typeof ResizeObserver === "function") {
      let programmato = 0;
      new ResizeObserver(() => {
        if (programmato) return;
        programmato = requestAnimationFrame(() => {
          programmato = 0;
          ridimensiona();
        });
      }).observe(canvas.parentElement);
    }
    root.addEventListener("resize", ridimensiona);
  }

  function init() {
    canvas = document.getElementById("canvas-scena");
    if (!canvas) return;
    // attenzione: all'avvio la schermata di gioco è nascosta, quindi il canvas
    // non ha ancora una dimensione. Si prepara quando la partita comincia.
    G.inizio = ora();
    collega();
    const avvia = () => {
      if (!document.body.classList.contains("solo-testo")) accendi();
    };
    document.addEventListener("partita", avvia);
    if (stato() && !document.body.classList.contains("solo-testo")) accendi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  function caricamento(testo) {
    G.caricamento = testo || "L'AI sta inventando il mondo";
    accendi();
  }

  root.VistaGrafica = { accendi, spegni, ricostruisci, caricamento, stato: () => G, esporta: () => root.__scena };
})(typeof self !== "undefined" ? self : this);
