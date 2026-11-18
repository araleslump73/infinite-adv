// =====================================================================
// grafica/scheletri.js - 5 archetipi con prese, e il disegno finale
//
// L'archetipo decide la struttura (dove vanno testa, occhi, arti, code),
// le parti riempiono le prese. Così "7 occhi e 2 gusci" è legale e
// disegnabile, ma un occhio non finisce sul pavimento.
//
// Unità: s = mezza larghezza del corpo in pixel. Altezza tipica 3-4.5 s.
// y locale: 0 = piedi, negativo = verso l'alto (come il canvas).
// =====================================================================
(function (root) {
  "use strict";

  const Parti = (typeof require === "function" && typeof module !== "undefined") ? require("./parti.js") : root.Parti;
  const CAT = Parti.CATALOGO;
  const Sagome = (typeof require === "function" && typeof module !== "undefined" ? require("./sagome.js") : root.Sagome) || { SAGOME: {} };

  const ARCHETIPI = {
    bipede: { altezza: 4.1, prese: ["teste", "occhi", "bocche", "arti", "code", "gusci", "ornamenti"] },
    quadrupede: { altezza: 2.15, prese: ["teste", "occhi", "bocche", "arti", "code", "gusci", "ornamenti"] },
    insettoide: { altezza: 2.0, prese: ["teste", "occhi", "bocche", "arti", "code", "gusci", "ornamenti"] },
    fluttuante: { altezza: 3.1, prese: ["occhi", "bocche", "arti", "ornamenti"] },
    cosa: { altezza: 3.0, prese: ["teste", "occhi", "ornamenti", "gusci"] },
  };

  function parte(categoria, nome) {
    const gruppo = CAT[categoria];
    if (!gruppo) return null;
    return gruppo[nome] || null;
  }

  // occhi distribuiti sulla testa: 1 al centro, 2 simmetrici, di più ad arco
  function occhi(P, o, quante, raggio, cy) {
    const fn = parte("occhi", o.parti.occhi);
    if (!fn || quante <= 0) return;
    const n = Math.min(8, quante);
    for (let i = 0; i < n; i++) {
      let x;
      let y = cy;
      if (n === 1) x = 0;
      else if (n === 2) x = (i === 0 ? -1 : 1) * raggio * 0.55;
      else {
        const a = -Math.PI * 0.75 + (i / (n - 1)) * Math.PI * 1.5;
        x = Math.cos(a) * raggio * 0.8;
        y = cy + Math.sin(a) * raggio * 0.35;
      }
      fn(P, {
        x: o.x + x,
        y: o.y + y,
        s: o.s * 0.9,
        col: o.col,
        ...o.col,
        scuro: o.col.scuro,
        chiaro: o.col.chiaro,
        luce: o.col.luce,
        t: o.t,
        seme: o.seme,
        verso: o.verso,
      });
    }
  }

  function base(P, o) {
    return {
      x: o.x,
      y: o.y,
      s: o.s,
      scuro: o.col.scuro,
      chiaro: o.col.chiaro,
      luce: o.col.luce,
      corpo: o.col.corpo,
      col: o.col,
      t: o.t,
      seme: o.seme,
      verso: o.verso,
    };
  }

  function disegnaBipede(P, o) {
    const s = o.s;
    const b = base(P, o);
    const d = o.parti;
    const gambe = d.nArti == null ? 2 : Math.max(0, Math.min(2, d.nArti));
    if (gambe) {
      const fn = parte("arti", d.arti) || CAT.arti.zampe;
      fn(P, { ...b, s: s * 1.5, y: -s * 1.15 });
      if (gambe === 1) {
        // una gamba sola: sta su un piedistallo di carne
        P.ellisse(o.x, -s * 1.05, s * 0.42, s * 0.75, { riempimento: o.col.corpo, bordo: o.col.scuro, spessore: s * 0.07 });
      }
    } else {
      P.poligono(
        [
          [-s * 0.45, -s * 0.9],
          [s * 0.45, -s * 0.9],
          [s * 0.2, 0],
          [-s * 0.2, 0],
        ],
        { riempimento: o.col.scuro, opacita: 0.6 }
      );
    }
    // piedi
    for (const lato of [-1, 1]) {
      P.ellisse(o.x + lato * s * 0.3, -s * 0.02, s * 0.2, s * 0.09, {
        riempimento: o.col.scuro,
        bordo: o.col.scuro,
        spessore: 1,
      });
    }
    // mantello dietro al busto: dà una silhouette riconoscibile
    P.poligono(
      [
        [o.x - s * 0.5, -s * 2.7],
        [o.x + s * 0.5, -s * 2.7],
        [o.x + s * 0.78, -s * 0.55],
        [o.x, -s * 0.75],
        [o.x - s * 0.78, -s * 0.55],
      ],
      { riempimento: o.col.scuro, opacita: 0.55 }
    );

    // busto affusolato: largo alle spalle, stretto alla vita
    P.percorso(
      () => {
        P.ctx.moveTo(o.x - s * 0.26, 0);
        P.ctx.quadraticCurveTo(o.x - s * 0.52, -s * 0.7, o.x - s * 0.6, -s * 1.75);
        P.ctx.quadraticCurveTo(o.x - s * 0.62, -s * 2.55, o.x - s * 0.34, -s * 2.72);
        P.ctx.quadraticCurveTo(o.x, -s * 2.86, o.x + s * 0.34, -s * 2.72);
        P.ctx.quadraticCurveTo(o.x + s * 0.62, -s * 2.55, o.x + s * 0.6, -s * 1.75);
        P.ctx.quadraticCurveTo(o.x + s * 0.52, -s * 0.7, o.x + s * 0.26, 0);
        P.ctx.closePath();
      },
      {
        riempimento: o.col.corpo,
        bordo: o.col.scuro,
        spessore: Math.max(1, s * 0.08),
        ombra: { colore: "rgba(0,0,0,0.35)", sfocatura: s * 0.4, dx: 0, dy: s * 0.15 },
      }
    );
    // cintura
    P.rettangolo(o.x - s * 0.42, -s * 1.18, s * 0.84, s * 0.13, s * 0.04, { riempimento: o.col.scuro, opacita: 0.9 });
    P.rettangolo(o.x - s * 0.08, -s * 1.21, s * 0.16, s * 0.19, s * 0.03, { riempimento: o.col.luce, opacita: 0.85 });
    // spalline
    for (const lato of [-1, 1]) {
      P.ellisse(o.x + lato * s * 0.5, -s * 2.62, s * 0.2, s * 0.11, {
        riempimento: o.col.chiaro,
        bordo: o.col.scuro,
        spessore: Math.max(1, s * 0.04),
      });
    }
    if (d.gusci) {
      const g = parte("gusci", d.gusci);
      if (g) g(P, { ...b, y: -s * 2.0, x: o.x - o.verso * s * 0.1, s: s * 0.9 });
    }
    if (d.code) {
      const c = parte("code", d.code);
      if (c) c(P, { ...b, x: o.x - o.verso * s * 0.6, y: -s * 1.75, s: s * 0.9 });
    }
    // braccia davanti al busto, con mani
    if (d.nArti == null || d.nArti >= 2) {
      for (const lato of [-1, 1]) {
        const gomito = -s * 1.95;
        P.percorso(
          () => {
            P.ctx.moveTo(o.x + lato * s * 0.5, -s * 2.55);
            P.ctx.quadraticCurveTo(o.x + lato * s * 0.82, gomito, o.x + lato * s * 0.72, -s * 1.4);
          },
          { bordo: o.col.corpo, spessore: Math.max(1.5, s * 0.18) }
        );
        P.cerchio(o.x + lato * s * 0.72, -s * 1.34, s * 0.13, { riempimento: o.col.chiaro, bordo: o.col.scuro, spessore: Math.max(1, s * 0.04) });
        for (let k = -1; k <= 1; k++) {
          P.retta(o.x + lato * s * 0.72 + k * s * 0.05, -s * 1.24, o.x + lato * s * 0.72 + k * s * 0.05, -s * 1.14, {
            bordo: o.col.scuro,
            spessore: Math.max(1, s * 0.035),
          });
        }
      }
    }
    // collo
    P.rettangolo(o.x - s * 0.16, -s * 3.02, s * 0.32, s * 0.34, s * 0.1, { riempimento: o.col.chiaro, bordo: o.col.scuro, spessore: Math.max(1, s * 0.05) });
    // testa
    const testa = parte("teste", d.teste) || CAT.teste.tonda;
    testa(P, { ...b, y: -s * 3.42, s: s * 1.05 });
    occhi(P, { ...o }, d.nOcchi, s * 1.05, -s * 3.46);
    if (d.bocche && d.bocche !== "nessuna") parte("bocche", d.bocche)(P, { ...b, y: -s * 3.18 });
    if (d.ornamenti) parte("ornamenti", d.ornamenti)(P, { ...b, y: -s * 3.95, s: s * 0.95 });
  }

  // zampa a due segmenti, con "piede"
  function zampa(P, x, yBase, alt, spessore, colore, avanti) {
    P.percorso(
      () => {
        P.ctx.moveTo(x, yBase - alt * 0.62);
        P.ctx.lineTo(x + (avanti ? alt * 0.1 : -alt * 0.08), yBase - alt * 0.28);
        P.ctx.lineTo(x + (avanti ? alt * 0.04 : -alt * 0.03), yBase);
      },
      { bordo: colore, spessore: spessore, opacita: 0.95 }
    );
    P.ellisse(x + (avanti ? alt * 0.04 : -alt * 0.03), yBase, spessore * 0.85, spessore * 0.4, { riempimento: colore });
  }

  function disegnaQuadrupede(P, o) {
    const s = o.s;
    const b = base(P, o);
    const d = o.parti;
    const zampe = Math.max(2, Math.min(6, d.nArti || 4));
    const colZampe = o.col.scuro;
    const passo = Math.sin(o.t * 2.4 + (o.seme % 10)) * s * 0.06;

    // zampe posteriori (dietro al corpo, più scure)
    const fasce = Math.ceil(zampe / 2);
    for (let i = 0; i < fasce; i++) {
      const lato = i % 2 === 0 ? -1 : 1;
      const x = o.x + lato * s * 0.5 - (fasce > 1 ? s * 0.3 * Math.floor(i / 2) : 0);
      zampa(P, x, 0, s * 0.95, Math.max(2, s * 0.16), o.col.scuro, false);
    }

    // coda
    if (d.code) {
      const c = parte("code", d.code);
      if (c) c(P, { ...b, x: o.x - o.verso * s * 0.95, y: -s * 1.15, s: s * 0.85 });
    }

    // corpo affusolato (petto davanti, fianchi dietro)
    P.percorso(
      () => {
        P.ctx.moveTo(o.x + o.verso * s * 0.95, -s * 1.15);
        P.ctx.quadraticCurveTo(o.x + o.verso * s * 0.2, -s * 1.6, o.x - o.verso * s * 0.85, -s * 1.25);
        P.ctx.quadraticCurveTo(o.x - o.verso * s * 1.0, -s * 0.85, o.x - o.verso * s * 0.75, -s * 0.62);
        P.ctx.quadraticCurveTo(o.x, -s * 0.5, o.x + o.verso * s * 0.9, -s * 0.78);
        P.ctx.closePath();
      },
      {
        riempimento: o.col.corpo,
        bordo: o.col.scuro,
        spessore: Math.max(1, s * 0.07),
        ombra: { colore: "rgba(0,0,0,0.32)", sfocatura: s * 0.35, dx: 0, dy: s * 0.12 },
      }
    );
    // macchia chiara sul dorso
    P.ellisse(o.x, -s * 1.32, s * 0.55, s * 0.16, { riempimento: o.col.chiaro, opacita: 0.55 });

    // zampe anteriori (davanti, più chiare), con il passo
    for (let i = 0; i < Math.ceil(zampe / 2); i++) {
      const lato = i % 2 === 0 ? -1 : 1;
      const x = o.x + lato * s * 0.55 + (fasce > 1 ? s * 0.2 * Math.floor(i / 2) : 0) + passo;
      zampa(P, x, 0, s * 1.0, Math.max(2, s * 0.17), o.col.chiaro, true);
    }

    if (d.gusci) parte("gusci", d.gusci)(P, { ...b, y: -s * 1.3, s: s * 0.9 });

    // collo e testa con muso
    const testaX = o.x + o.verso * s * 1.05;
    P.percorso(
      () => {
        P.ctx.moveTo(o.x + o.verso * s * 0.8, -s * 1.35);
        P.ctx.lineTo(testaX - o.verso * s * 0.1, -s * 1.95);
        P.ctx.lineTo(testaX + o.verso * s * 0.12, -s * 1.72);
        P.ctx.closePath();
      },
      { riempimento: o.col.corpo, bordo: o.col.scuro, spessore: Math.max(1, s * 0.05) }
    );
    const testa = parte("teste", d.teste) || CAT.teste.allungata;
    testa(P, { ...b, x: testaX, y: -s * 2.0, s: s * 0.8 });
    // orecchie
    for (const lato of [-1, 1]) {
      P.poligono(
        [
          [testaX + lato * s * 0.18, -s * 2.28],
          [testaX + lato * s * 0.3, -s * 2.55],
          [testaX + lato * s * 0.06, -s * 2.34],
        ],
        { riempimento: o.col.corpo, bordo: o.col.scuro, spessore: Math.max(1, s * 0.04) }
      );
    }
    occhi(P, { ...o, x: testaX }, d.nOcchi, s * 0.75, -s * 2.02);
    // muso
    P.ellisse(testaX + o.verso * s * 0.26, -s * 1.9, s * 0.17, s * 0.12, { riempimento: o.col.chiaro, bordo: o.col.scuro, spessore: Math.max(1, s * 0.03) });
    if (d.bocche && d.bocche !== "nessuna") {
      parte("bocche", d.bocche)(P, { ...b, x: testaX + o.verso * s * 0.22, y: -s * 1.78, s: s * 0.8 });
    }
    if (d.ornamenti) parte("ornamenti", d.ornamenti)(P, { ...b, x: testaX - o.verso * s * 0.1, y: -s * 2.35, s: s * 0.8 });
  }

  function disegnaInsettoide(P, o) {
    const s = o.s;
    const b = base(P, o);
    const d = o.parti;
    const arti = Math.max(2, Math.min(6, d.nArti || 6));

    // ali dietro (se richieste)
    if (d.arti === "ali") parte("arti", "ali")(P, { ...b, x: o.x - o.verso * s * 0.35, y: -s * 1.05, s: s * 0.8 });

    // zampe articolate: 3 per lato (o meno), più scure le posteriori
    for (let i = 0; i < arti; i++) {
      const lato = i % 2 === 0 ? -1 : 1;
      const fila = Math.floor(i / 2);
      const x = o.x + lato * s * 0.3 - fila * s * 0.26 + o.verso * s * 0.35;
      const alt = s * (0.75 + fila * 0.12);
      P.percorso(
        () => {
          P.ctx.moveTo(x, -s * 0.95);
          P.ctx.lineTo(x + lato * s * 0.28, -s * 0.5);
          P.ctx.lineTo(x + lato * s * 0.18, -s * 0.04);
        },
        { bordo: o.col.scuro, spessore: Math.max(1.5, s * 0.1) }
      );
      P.cerchio(x + lato * s * 0.18, -s * 0.04, s * 0.06, { riempimento: o.col.scuro });
      // giunto
      P.cerchio(x + lato * s * 0.28, -s * 0.5, Math.max(1, s * 0.07), { riempimento: o.col.chiaro, bordo: o.col.scuro, spessore: 1 });
    }

    // addome segmentato (dietro)
    for (let i = 2; i >= 0; i--) {
      const cx = o.x - o.verso * s * (0.35 + i * 0.35);
      const r = s * (0.5 - i * 0.09);
      P.ellisse(cx, -s * (0.95 + i * 0.06), r * 1.15, r, {
        riempimento: i === 0 ? o.col.chiaro : o.col.corpo,
        bordo: o.col.scuro,
        spessore: Math.max(1, s * 0.05),
        opacita: i === 2 ? 0.9 : 1,
      });
    }

    // torace
    P.ellisse(o.x + o.verso * s * 0.2, -s * 1.05, s * 0.55, s * 0.42, {
      riempimento: o.col.corpo,
      bordo: o.col.scuro,
      spessore: Math.max(1, s * 0.06),
      ombra: { colore: "rgba(0,0,0,0.3)", sfocatura: s * 0.3, dx: 0, dy: s * 0.1 },
    });

    // gusci/corazza sul torace
    if (d.gusci) parte("gusci", d.gusci)(P, { ...b, x: o.x + o.verso * s * 0.2, y: -s * 1.05, s: s * 0.75 });

    // testa con mandibole
    const testaX = o.x + o.verso * s * 0.85;
    const testaY = -s * 1.25;
    const testa = parte("teste", d.teste) || CAT.teste.teschio;
    testa(P, { ...b, x: testaX, y: testaY, s: s * 0.62 });
    // antenne
    for (const lato of [-1, 1]) {
      P.percorso(
        () => {
          P.ctx.moveTo(testaX + lato * s * 0.12, testaY - s * 0.25);
          P.ctx.quadraticCurveTo(testaX + lato * s * 0.4, testaY - s * 0.75, testaX + lato * s * 0.5, testaY - s * 0.95);
        },
        { bordo: o.col.chiaro, spessore: Math.max(1, s * 0.05) }
      );
      P.cerchio(testaX + lato * s * 0.5, testaY - s * 0.95, Math.max(1, s * 0.05), { riempimento: o.col.chiaro });
    }
    occhi(P, { ...o, x: testaX }, d.nOcchi, s * 0.62, testaY + s * 0.05);
    if (d.bocche && d.bocche !== "nessuna") {
      parte("bocche", d.bocche)(P, { ...b, x: testaX + o.verso * s * 0.18, y: testaY + s * 0.28, s: s * 0.6 });
    }
    if (d.code) parte("code", d.code)(P, { ...b, x: o.x - o.verso * s * 1.05, y: -s * 0.95, s: s * 0.7 });
    if (d.ornamenti) parte("ornamenti", d.ornamenti)(P, { ...b, x: testaX, y: testaY - s * 0.35, s: s * 0.7 });
  }

  function disegnaFluttuante(P, o) {
    const s = o.s;
    const b = base(P, o);
    const d = o.parti;
    const tentacoli = Math.max(0, Math.min(6, d.nArti == null ? 4 : d.nArti));
    if (tentacoli) {
      const fn = parte("arti", d.arti) || CAT.arti.tentacoli;
      fn(P, { ...b, y: -s * 1.0, s: s * 1.1 });
    }
    P.cerchio(o.x, -s * 2.05, s * 0.98, {
      riempimento: o.col.corpo,
      bordo: o.col.scuro,
      spessore: Math.max(1, s * 0.09),
      ombra: { colore: o.col.luce, sfocatura: s * 0.6, dx: 0, dy: 0 },
    });
    P.cerchio(o.x - s * 0.3, -s * 2.4, s * 0.28, { riempimento: o.col.chiaro, opacita: 0.5 });
    occhi(P, { ...o, x: o.x }, d.nOcchi, s * 1.1, -s * 2.05);
    if (d.bocche && d.bocche !== "nessuna") parte("bocche", d.bocche)(P, { ...b, y: -s * 1.55 });
    if (d.ornamenti) parte("ornamenti", d.ornamenti)(P, { ...b, y: -s * 3.05 });
  }

  function disegnaCosa(P, o) {
    const s = o.s;
    const b = base(P, o);
    const d = o.parti;
    // struttura
    P.rettangolo(o.x - s * 0.7, -s * 2.4, s * 1.4, s * 2.4, s * 0.2, {
      riempimento: o.col.corpo,
      bordo: o.col.scuro,
      spessore: Math.max(1, s * 0.08),
      ombra: { colore: "rgba(0,0,0,0.35)", sfocatura: s * 0.4, dx: 0, dy: s * 0.1 },
    });
    P.rettangolo(o.x - s * 0.95, -s * 0.28, s * 1.9, s * 0.28, s * 0.08, { riempimento: o.col.scuro });
    if (d.gusci) parte("gusci", d.gusci)(P, { ...b, y: -s * 1.5 });
    if (d.teste) parte("teste", d.teste)(P, { ...b, y: -s * 2.75, s: s * 0.9 });
    occhi(P, { ...o }, d.nOcchi, s * 0.8, -s * 1.8);
    if (d.ornamenti) parte("ornamenti", d.ornamenti)(P, { ...b, y: -s * 3.0 });
  }

  const DISEGNO = {
    bipede: disegnaBipede,
    quadrupede: disegnaQuadrupede,
    insettoide: disegnaInsettoide,
    fluttuante: disegnaFluttuante,
    cosa: disegnaCosa,
  };

  // ------------------------------------------------------------ disegno
  // ---------------- direzione artistica ----------------
  // Il disegno procedurale, se mostrato "pieno", sembra un pupazzo. In
  // silhouette (scura, controluce, con occhi luminosi) diventa una scelta
  // di stile: leggibile a ogni dimensione e coerente con le stanze buie.
  // miscela due colori #rrggbb (locale: il disegno non dipende da altri moduli)
  function alfa(colore, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(colore || ""));
    if (!m) return colore;
    const n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + Math.max(0, Math.min(1, a)) + ")";
  }

  function miscia(a, b, t) {
    const pa = /^#?([0-9a-f]{6})$/i.exec(String(a || ""));
    const pb = /^#?([0-9a-f]{6})$/i.exec(String(b || ""));
    if (!pa || !pb) return a || b;
    const A = parseInt(pa[1], 16);
    const B = parseInt(pb[1], 16);
    const k = Math.max(0, Math.min(1, t == null ? 0.5 : t));
    const mix = (s) => Math.round(((A >> s) & 255) + ((((B >> s) & 255) - ((A >> s) & 255)) * k));
    return "#" + [16, 8, 0].map((s) => mix(s).toString(16).padStart(2, "0")).join("");
  }

  // Silhouette "controluce": toni medi, non neri (altrimenti su fondo scuro
  // si vedrebbe solo il contorno), occhi e dettagli nel colore d'accento.
  function tavolozzaSilhouette(tinta, accento) {
    const base = Parti.colori(tinta);
    const ombra = "#0d1519";
    return {
      corpo: miscia(base.corpo, ombra, 0.2),
      scuro: miscia(base.scuro, ombra, 0.45),
      chiaro: miscia(base.chiaro, ombra, 0.15),
      luce: accento || base.luce,
    };
  }

  function disegnaCon(P, ricetta, archetipo, s, col, tempo, v, conDettagli) {
    const opz = {
      x: 0,
      y: 0,
      s: s,
      col: col,
      t: tempo,
      seme: v.seme,
      verso: v.verso,
      parti: ricetta.parti,
      stato: v.stato,
    };
    DISEGNO[archetipo](P, opz);
    if (!conDettagli) return;
    Parti.dettagli(P, {
      x: 0,
      y: -s * (ARCHETIPI[archetipo].altezza * 0.45),
      s: s * 1.1,
      scuro: col.scuro,
      chiaro: col.chiaro,
      luce: col.luce,
      corpo: col.corpo,
      stato: v.stato,
      seme: v.seme,
    });
  }

  // disegno "illustrato": sagoma SVG a mano, colorata con la tinta della
  // creatura, con occhi e ornamenti sulle ancore. Attivo solo se il browser
  // sa fare Path2D (in Node i test usano la versione procedurale).
  function disegnaIllustrato(P, ricetta, x, yPiedi, s, t, col, v) {
    const arte = Sagome.SAGOME && Sagome.SAGOME[ricetta.archetipo];
    if (!arte) return false;
    const altezza = ARCHETIPI[ricetta.archetipo] ? ARCHETIPI[ricetta.archetipo].altezza : 2.2;
    const hPx = s * altezza; // altezza in pixel della sagoma
    const unita = hPx / 100; // 1 unità del riquadro 100×100
    const stile = { riempimento: col.corpo, bordo: col.scuro, spessore: Math.max(0.8, 1.6 / unita * 0.5) };
    // il riquadro 100×100 ha i piedi in (50,100): va riportato su (x, yPiedi)
    const posto = { x: x + (v.verso < 0 ? 50 : -50) * unita, y: yPiedi - 100 * unita, s: unita, specchia: v.verso < 0 };

    // tratti dietro al corpo (zampe, braccia, code, antenne)
    for (const tratto of arte.tratti || []) {
      P.forma(tratto.d, { bordo: col.scuro, spessore: tratto.spessore }, posto);
    }
    // corpo (e testa come secondo strato, se prevista)
    P.forma(arte.corpo, stile, posto);
    if (arte.testa) P.forma(arte.testa, stile, posto);

    // occhi e ornamenti sulle ancore
    const ancore = arte.ancore || {};
    const occhiElenco = ancore.occhi || [];
    const n = Math.max(0, Math.min(occhiElenco.length, ricetta.parti.nOcchi == null ? 2 : ricetta.parti.nOcchi));
    for (let i = 0; i < n; i++) {
      const a = occhiElenco[i % occhiElenco.length];
      const ax = x + ((v.verso < 0 ? 100 - a[0] : a[0]) - 50) * unita;
      const ay = yPiedi + (a[1] - 100) * unita;
      P.cerchio(ax, ay, hPx * 0.038, {
        riempimento: col.luce,
        bordo: col.scuro,
        spessore: Math.max(1, unita * 1.2),
        ombra: { colore: col.luce, sfocatura: hPx * 0.06, dx: 0, dy: 0 },
      });
    }
    // coda (specchiata: punta all'indietro rispetto allo sguardo)
    if (ricetta.parti.code && ancore.coda) {
      const a = ancore.coda;
      const cx = x + ((v.verso < 0 ? 100 - a[0] : a[0]) - 50) * unita;
      const cy = yPiedi + (a[1] - 100) * unita;
      P.trasla(cx, cy, () =>
        P.scala(v.verso < 0 ? 1 : -1, 1, () =>
          parte("code", ricetta.parti.code)(P, {
            x: 0, y: 0, s: hPx * 0.2, scuro: col.scuro, chiaro: col.chiaro, luce: col.luce,
            corpo: col.corpo, t: t, seme: v.seme, verso: v.verso,
          })
        )
      );
    }
    // gusci/corazza sul dorso
    if (ricetta.parti.gusci && ancore.dorso) {
      const a = ancore.dorso;
      const gx = x + ((v.verso < 0 ? 100 - a[0] : a[0]) - 50) * unita;
      const gy = yPiedi + (a[1] - 100) * unita;
      parte("gusci", ricetta.parti.gusci)(P, {
        x: gx, y: gy, s: hPx * 0.22, scuro: col.scuro, chiaro: col.chiaro, luce: col.luce,
        corpo: col.corpo, t: t, seme: v.seme, verso: v.verso,
      });
    }
    // testa: solo per le varianti che aggiungono qualcosa (elmo, cristallo)
    if ((ricetta.parti.teste === "elmo" || ricetta.parti.teste === "cristallo") && ancore.testa) {
      const a = ancore.testa;
      const tx = x + ((v.verso < 0 ? 100 - a[0] : a[0]) - 50) * unita;
      const ty = yPiedi + (a[1] - 100) * unita;
      parte("teste", ricetta.parti.teste)(P, {
        x: tx, y: ty, s: hPx * 0.2, scuro: col.scuro, chiaro: col.chiaro, luce: col.luce,
        corpo: col.corpo, t: t, seme: v.seme, verso: v.verso,
      });
    }
    if (ricetta.parti.bocche && ricetta.parti.bocche !== "nessuna" && ancore.bocca) {
      const a = ancore.bocca;
      const bx = x + ((v.verso < 0 ? 100 - a[0] : a[0]) - 50) * unita;
      const by = yPiedi + (a[1] - 100) * unita;
      parte("bocche", ricetta.parti.bocche)(P, {
        x: bx, y: by, s: hPx * 0.16, scuro: col.scuro, chiaro: col.chiaro, luce: col.luce,
        corpo: col.corpo, t: t, seme: v.seme, verso: v.verso,
      });
    }
    if (ricetta.parti.ornamenti && ancore.sommita) {
      const a = ancore.sommita;
      const ox = x + ((v.verso < 0 ? 100 - a[0] : a[0]) - 50) * unita;
      const oy = yPiedi + (a[1] - 100) * unita;
      parte("ornamenti", ricetta.parti.ornamenti)(P, {
        x: ox, y: oy, s: hPx * 0.18, scuro: col.scuro, chiaro: col.chiaro, luce: col.luce,
        corpo: col.corpo, t: t, seme: v.seme, verso: v.verso,
      });
    }
    return true;
  }

  function disegna(P, ricetta, x, yPiedi, s, t, opzioni) {
    const o = opzioni || {};
    const v = ricetta.variante;
    const archetipo = ARCHETIPI[ricetta.archetipo] ? ricetta.archetipo : "quadrupede";
    const tinta = o.tinta || v.tinta;
    const accento = o.accento || null;
    const silhouette = o.stile !== "piena";
    const col = silhouette ? tavolozzaSilhouette(tinta, accento) : Parti.colori(tinta);
    const tempo = t == null ? 0 : t;
    const moto = ricetta.comportamento && ricetta.comportamento.moto;

    const respiro = 1 + Math.sin(tempo * 1.7 + v.fase) * 0.018;
    const sospeso = v.postura === "sospeso" || moto === "volare";
    const bob = sospeso ? Math.sin(tempo * 1.3 + v.fase) * s * 0.16 : 0;
    const striscia = moto === "strisciare" ? Math.sin(tempo * 1.1 + v.fase) * s * 0.1 : 0;
    const scatto =
      moto === "attaccare" || (ricetta.comportamento && ricetta.comportamento.reazione === "attaccare")
        ? Math.pow(Math.max(0, Math.sin(tempo * 1.4 + v.fase)), 12) * s * 0.3
        : 0;
    const inclinazione = (v.postura === "piegato" ? 0.14 * v.verso : 0) + v.sbandamento * 0.7;

    // ombra a terra, morbida
    P.ellisse(x + striscia, yPiedi, s * (1.2 + (sospeso ? 0.2 : 0)), s * 0.2, {
      riempimento: "rgba(0,0,0,0.4)",
      opacita: sospeso ? 0.2 : 0.35,
    });

    const corpoS = s * respiro * v.scala;
    P.trasla(x + striscia, yPiedi + bob - scatto, () => {
      P.ruota(inclinazione, () => {
        const puoIllustrato = o.stile !== "procedurale" && typeof root.Path2D === "function";
        if (puoIllustrato && disegnaIllustrato(P, ricetta, 0, 0, corpoS, tempo, col, v)) return;
        disegnaCon(P, ricetta, archetipo, corpoS, col, tempo, v, !silhouette || Boolean(o.dettagli));
      });
    });
  }

  const Scheletri = { ARCHETIPI, disegna, DISEGNO };
  if (typeof module !== "undefined" && module.exports) module.exports = Scheletri;
  root.Scheletri = Scheletri;
})(typeof self !== "undefined" ? self : this);
