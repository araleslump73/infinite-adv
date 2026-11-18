// =====================================================================
// grafica/ambienti.js - le stanze
//
// Ogni ambiente disegna: fondo, parete di fondo, pareti laterali,
// pavimento in prospettiva, qualche elemento caratteristico e le uscite.
//
// Restituisce le aree cliccabili delle uscite, così vista_grafica può
// trasformare un clic sulla porta nel comando "vai nord".
// =====================================================================
(function (root) {
  "use strict";

  const PennaIstantanea = (typeof require === "function" && typeof module !== "undefined" && !root.Penna) ? require("./penna.js") : root.Penna;
  const alfa = (c, a) => PennaIstantanea.alfa(c, a);
  const mischia = (a, b, t) => PennaIstantanea.mischia(a, b, t);

  const PALETTE = {
    caverna: { cielo1: "#080c10", cielo2: "#131c24", parete: "#1b242d", pareteScura: "#0e141a", pavimento: "#2a3542", pavimentoAlt: "#222c37", accento: "#6fd3c7", nebbia: "#7fb0c4" },
    foresta: { cielo1: "#0d1712", cielo2: "#1c2f22", parete: "#1f3a2a", pareteScura: "#0f1f16", pavimento: "#2d4231", pavimentoAlt: "#26382a", accento: "#a8e06a", nebbia: "#9fd6a0" },
    sala: { cielo1: "#0b0a0e", cielo2: "#1e1c24", parete: "#2b2a33", pareteScura: "#15141a", pavimento: "#3a3642", pavimentoAlt: "#302d38", accento: "#d9a441", nebbia: "#c9b48a" },
    corridoio: { cielo1: "#090d12", cielo2: "#161d25", parete: "#242b33", pareteScura: "#11161c", pavimento: "#2f3841", pavimentoAlt: "#28313a", accento: "#7fb7d9", nebbia: "#a8c4d6" },
    esterno: { cielo1: "#16243a", cielo2: "#0a1018", parete: "#1a2530", pareteScura: "#0d141b", pavimento: "#2b2f36", pavimentoAlt: "#242830", accento: "#c9d6e2", nebbia: "#8fa6ba" },
    nave: { cielo1: "#070b12", cielo2: "#101a26", parete: "#1b2430", pareteScura: "#0c131b", pavimento: "#232d39", pavimentoAlt: "#1c2530", accento: "#59d2ff", nebbia: "#7ab6d6" },
  };

  function palette(ambiente) {
    return PALETTE[ambiente] || PALETTE.caverna;
  }

  // piccolo caso deterministico per la stanza: stessi arredi ogni volta
  function caso(seme) {
    let a = (seme >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --------------------------------------------------------- sfondo
  function cielo(P, cam, p) {
    const g = P.gradiente(0, 0, 0, cam.altezza, [
      [0, p.cielo1],
      [0.55, p.cielo2],
      [1, p.cielo1],
    ]);
    P.rettangolo(0, 0, cam.larghezza, cam.altezza, 0, { riempimento: g });
  }

  function texturePareti(P, cam, p) {
    // fasce verticali appena visibili: danno consistenza alla parete
    for (let i = 0; i < 7; i++) {
      const slot = -1 + (2 * i) / 6;
      P.retta(cam.x(slot, cam.Z_MAX + 2), cam.tetto(cam.Z_MAX + 2), cam.x(slot, 1.05), cam.altezza * 1.02, {
        bordo: alfa(p.parete, 0.35),
        spessore: 1,
      });
    }
  }

  function pareti(P, cam, p) {
    // parete di fondo (la più lontana)
    const zl = cam.Z_MAX + 2;
    const fondo = cam.fondoStanza(zl);
    P.poligono(fondo, {
      riempimento: P.gradiente(0, cam.tetto(zl), 0, cam.y(zl), [
        [0, mischia(p.parete, "#000000", 0.35)],
        [1, mischia(p.parete, "#000000", 0.1)],
      ]),
    });
    // pareti laterali, quasi nere per dare profondità
    P.poligono(cam.parete(-1), {
      riempimento: P.gradiente(cam.x(-1, cam.Z_MIN), 0, cam.x(-1, zl), 0, [
        [0, p.pareteScura],
        [1, mischia(p.pareteScura, "#000000", 0.4)],
      ]),
    });
    P.poligono(cam.parete(1), {
      riempimento: P.gradiente(cam.x(1, 1), 0, cam.x(1, zl), 0, [
        [0, p.pareteScura],
        [1, mischia(p.pareteScura, "#000000", 0.4)],
      ]),
    });
  }

  function pavimento(P, cam, p) {
    const zl = cam.Z_MAX + 2;
    const yFondo = cam.y(zl);
    P.poligono(
      [
        [cam.x(-1, 1), cam.altezza],
        [cam.x(1, 1), cam.altezza],
        [cam.x(1, zl), yFondo],
        [cam.x(-1, zl), yFondo],
      ],
      {
        riempimento: P.gradiente(0, cam.altezza, 0, yFondo, [
          [0, p.pavimento],
          [1, mischia(p.pavimento, p.cielo1, 0.7)],
        ]),
      }
    );
    // righe trasversali
    for (const riga of cam.righePavimento(7, zl)) {
      P.retta(riga.x1, riga.y, riga.x2, riga.y, { bordo: alfa(p.pavimentoAlt, 0.85), spessore: Math.max(1, 3 / riga.z) });
    }
    // linee che fuggono
    for (const linea of cam.lineeFuga(8, zl)) {
      P.retta(linea.x1, linea.y1, linea.x2, linea.y2, { bordo: alfa(p.pavimentoAlt, 0.6), spessore: 1 });
    }
    // pozza di luce davanti alla camera: alza la scena e dà un punto di appoggio
    P.ellisse(cam.larghezza / 2, cam.altezza * 0.985, cam.larghezza * 0.42, cam.altezza * 0.2, {
      riempimento: P.gradienteRadiale(cam.larghezza / 2, cam.altezza * 0.95, cam.larghezza * 0.42, [
        [0, alfa("#ffffff", 0.1)],
        [0.6, alfa("#ffffff", 0.04)],
        [1, alfa("#ffffff", 0)],
      ]),
    });
    // velo di nebbia sul fondo: nasconde il taglio del pavimento
    P.rettangolo(0, yFondo - cam.altezza * 0.12, cam.larghezza, cam.altezza * 0.2, 0, {
      riempimento: P.gradiente(0, yFondo - cam.altezza * 0.12, 0, yFondo + cam.altezza * 0.08, [
        [0, alfa(p.nebbia, 0)],
        [1, alfa(p.nebbia, 0.16)],
      ]),
    });
  }

  // -------------------------------------------------------- arredi
  const ARREDI = {
    caverna(P, cam, p, rnd, t) {
      const zl = cam.Z_MAX + 1.4;
      for (let i = 0; i < 6; i++) {
        const slot = -1 + rnd() * 2;
        const z = zl - rnd() * 1.2;
        const x = cam.x(slot, z);
        const yT = cam.tetto(z);
        const alt = (0.08 + rnd() * 0.16) * cam.altezza * cam.scala(z);
        P.poligono(
          [
            [x - alt * 0.3, yT],
            [x, yT + alt],
            [x + alt * 0.3, yT],
          ],
          { riempimento: mischia(p.parete, "#000000", 0.2), bordo: alfa(p.cielo1, 0.5), spessore: 1 }
        );
      }
      // pozzanghere
      for (let i = 0; i < 3; i++) {
        const z = 1.6 + rnd() * 2.2;
        const x = cam.x(-0.8 + rnd() * 1.6, z);
        const y = cam.y(z);
        P.ellisse(x, y, cam.larghezza * 0.09 * cam.scala(z) * 2.2, cam.larghezza * 0.02 * cam.scala(z) * 2.2, {
          riempimento: alfa(p.nebbia, 0.14),
          bordo: alfa(p.nebbia, 0.22),
          spessore: 1,
        });
      }
    },
    foresta(P, cam, p, rnd, t) {
      const zl = cam.Z_MAX + 1.2;
      for (let i = 0; i < 7; i++) {
        const slot = i % 2 === 0 ? -0.95 + rnd() * 0.3 : 0.65 + rnd() * 0.3;
        const z = 1.8 + rnd() * 3.6;
        const x = cam.x(slot, z);
        const y = cam.y(z);
        const alt = cam.altezza * cam.scala(z) * (0.9 + rnd() * 0.5);
        P.rettangolo(x - alt * 0.03, y - alt, alt * 0.06, alt, 2, { riempimento: mischia(p.pareteScura, "#000000", 0.25) });
        const oscillazione = Math.sin(t * 0.8 + i) * alt * 0.02;
        P.ellisse(x + oscillazione, y - alt, alt * 0.32, alt * 0.18, {
          riempimento: alfa(mischia(p.parete, "#000000", 0.15), 0.9),
        });
      }
      // frasche in primo piano
      P.poligono(
        [
          [0, cam.altezza],
          [cam.larghezza * 0.06, cam.altezza * 0.62],
          [cam.larghezza * 0.14, cam.altezza * 0.7],
          [cam.larghezza * 0.2, cam.altezza],
        ],
        { riempimento: alfa(p.pareteScura, 0.9) }
      );
    },
    sala(P, cam, p, rnd, t) {
      const zl = cam.Z_MAX + 0.6;
      for (const lato of [-1, 1]) {
        for (const z of [2.2, 3.6, 5.0]) {
          const x = cam.x(lato, z);
          const y = cam.y(z);
          const alt = cam.altezza * cam.scala(z) * 0.78;
          const larg = alt * 0.16;
          P.rettangolo(x - larg, y - alt, larg * 2, alt, 3, {
            riempimento: mischia(p.parete, "#ffffff", 0.08),
            bordo: alfa(p.pareteScura, 0.8),
            spessore: 1,
          });
          P.rettangolo(x - larg * 1.6, y - alt - alt * 0.06, larg * 3.2, alt * 0.07, 2, { riempimento: mischia(p.parete, "#ffffff", 0.16) });
        }
      }
      // tappeto che porta al fondo
      P.poligono(
        [
          [cam.larghezza * 0.42, cam.altezza],
          [cam.larghezza * 0.58, cam.altezza],
          [cam.x(0.18, zl), cam.y(zl)],
          [cam.x(-0.18, zl), cam.y(zl)],
        ],
        { riempimento: alfa(p.accento, 0.14) }
      );
      // lampadario
      for (let i = 0; i < 3; i++) {
        const z = 2.4 + i * 1.4;
        const x = cam.x(0, z);
        const y = cam.tetto(z) + cam.altezza * cam.scala(z) * 0.12;
        P.cerchio(x, y, cam.altezza * cam.scala(z) * 0.035, {
          riempimento: "#ffd88a",
          ombra: { colore: alfa(p.accento, 0.9), sfocatura: 30 * cam.scala(z), dx: 0, dy: 0 },
        });
      }
    },
    corridoio(P, cam, p, rnd, t) {
      const zl = cam.Z_MAX + 1.6;
      // archi che si allontanano
      for (let i = 0; i < 5; i++) {
        const z = 1.4 + i * 0.9;
        const x = cam.x(0, z);
        const y = cam.y(z);
        const alt = cam.altezza * cam.scala(z) * 0.8;
        P.poligono(
          [
            [cam.x(-1, z), y],
            [cam.x(-1, z), cam.tetto(z)],
            [x, cam.tetto(z) - alt * 0.18],
            [cam.x(1, z), cam.tetto(z)],
            [cam.x(1, z), y],
          ],
          { bordo: alfa(p.parete, 0.9), spessore: Math.max(1, 6 / z) }
        );
      }
      // tubi a parete
      for (const lato of [-1, 1]) {
        P.retta(cam.x(lato, 1.2), cam.tetto(1.2) + 18, cam.x(lato, zl), cam.tetto(zl) + 4, {
          bordo: alfa(p.accento, 0.25),
          spessore: 3,
        });
      }
    },
    esterno(P, cam, p, rnd, t) {
      const zl = cam.Z_MAX + 1.2;
      // montagne lontane
      for (let strato = 0; strato < 2; strato++) {
        const yBase = cam.yOrizzonte + 6 + strato * 10;
        const punti = [[0, yBase + 60]];
        const passo = cam.larghezza / 6;
        for (let i = 0; i <= 6; i++) {
          const h = (12 + rnd() * 46) * (1 - strato * 0.3);
          punti.push([i * passo, yBase - h]);
        }
        punti.push([cam.larghezza, yBase + 60]);
        P.poligono(punti, { riempimento: alfa(mischia(p.parete, p.cielo1, 0.35 + strato * 0.25), 0.95) });
      }
      // nebbia bassa
      P.rettangolo(0, cam.yOrizzonte - 4, cam.larghezza, cam.altezza * 0.16, 0, {
        riempimento: P.gradiente(0, cam.yOrizzonte - 4, 0, cam.yOrizzonte + cam.altezza * 0.16, [
          [0, alfa(p.nebbia, 0.05)],
          [1, alfa(p.nebbia, 0.28)],
        ]),
      });
    },
    nave(P, cam, p, rnd, t) {
      const zl = cam.Z_MAX + 1.4;
      // pannelli della parete di fondo
      const y = cam.y(zl);
      const yT = cam.tetto(zl);
      const larg = cam.x(1, zl) - cam.x(-1, zl);
      for (let i = 0; i < 4; i++) {
        P.rettangolo(cam.x(-1, zl) + (larg / 4) * i + 3, yT + 6, larg / 4 - 6, y - yT - 12, 3, {
          riempimento: mischia(p.parete, "#000000", 0.08 + (i % 2) * 0.05),
          bordo: alfa(p.pareteScura, 0.9),
          spessore: 1,
        });
      }
      // oblò con le stelle
      const x = cam.x(0.62, 3.2);
      const yy = cam.y(3.2) - cam.altezza * cam.scala(3.2) * 0.42;
      const r = cam.altezza * cam.scala(3.2) * 0.1;
      P.cerchio(x, yy, r, {
        riempimento: "#04070c",
        bordo: alfa(p.accento, 0.7),
        spessore: Math.max(1, r * 0.12),
        ombra: { colore: alfa(p.accento, 0.5), sfocatura: 16, dx: 0, dy: 0 },
      });
      for (let i = 0; i < 9; i++) {
        P.cerchio(x - r * 0.7 + rnd() * r * 1.4, yy - r * 0.7 + rnd() * r * 1.4, Math.max(0.6, r * 0.035), {
          riempimento: "#dff1ff",
          opacita: 0.5 + rnd() * 0.5,
        });
      }
      // strisce di avvertimento sul pavimento
      for (let i = 0; i < 4; i++) {
        const z = 2 + i * 0.8;
        P.retta(cam.x(-0.5, z), cam.y(z), cam.x(0.5, z), cam.y(z), { bordo: alfa("#e0b23a", 0.22), spessore: 4 / z });
      }
    },
  };

  function coloreMateriale(materiale, p) {
    if (materiale === "metallo" || materiale === "vetro" || materiale === "energia") return mischia(p.parete, p.accento, 0.48);
    if (materiale === "legno" || materiale === "osso" || materiale === "tessuto" || materiale === "organico") {
      return mischia(p.parete, p.pavimento, 0.58);
    }
    return mischia(p.parete, "#000000", 0.12);
  }

  function disegnaDettaglio(P, cam, nome, slot, z, colore, accento) {
    const x = cam.x(slot, z);
    const y = cam.y(z);
    const h = cam.altezzaElemento(z, 0.9);
    const w = Math.max(3, cam.larghezza * 0.045 / z);
    const bordo = alfa(colore, 0.8);
    const tenue = alfa(accento, 0.55);
    const vertice = [
      [x - w, y],
      [x, y - h],
      [x + w, y],
    ];

    if (nome === "colonne" || nome === "statue" || nome === "ossa" || nome === "rovine") {
      const rotta = nome === "rovine";
      P.rettangolo(x - w * 0.58, y - h * (rotta ? 0.65 : 0.85), w * 1.16, h * (rotta ? 0.65 : 0.85), w * 0.12, {
        riempimento: alfa(colore, 0.72), bordo, spessore: 1,
      });
      P.rettangolo(x - w * 0.9, y - h * (rotta ? 0.68 : 0.9), w * 1.8, h * 0.08, 1, {
        riempimento: alfa(accento, 0.48), bordo,
      });
      if (nome === "ossa") {
        P.cerchio(x, y - h * 0.55, w * 0.58, { bordo: tenue, spessore: Math.max(1, w * 0.14) });
      }
    } else if (nome === "archi" || nome === "finestre" || nome === "specchi") {
      P.rettangolo(x - w, y - h * 0.84, w * 2, h * 0.84, w * 0.42, {
        riempimento: alfa(colore, nome === "archi" ? 0.24 : 0.56), bordo: tenue, spessore: Math.max(1, w * 0.12),
      });
      if (nome !== "archi") {
        P.retta(x, y - h * 0.78, x, y - h * 0.05, { bordo: tenue, spessore: Math.max(1, w * 0.08) });
        P.retta(x - w * 0.82, y - h * 0.45, x + w * 0.82, y - h * 0.45, { bordo: tenue, spessore: Math.max(1, w * 0.08) });
      }
    } else if (nome === "radici" || nome === "catene" || nome === "tende") {
      for (let i = -1; i <= 1; i++) {
        const x1 = x + i * w * 0.45;
        P.poligono([
          [x1, y - h],
          [x1 + w * 0.2, y - h * 0.58],
          [x1 - w * 0.15, y - h * 0.28],
          [x1 + w * 0.18, y],
        ], { bordo: nome === "tende" ? tenue : bordo, spessore: Math.max(1, w * 0.12) }, false);
      }
    } else if (nome === "acqua") {
      P.ellisse(x, y - h * 0.08, w * 2.4, h * 0.08, {
        riempimento: alfa(accento, 0.18), bordo: tenue, spessore: 1,
      });
    } else if (nome === "macchinari" || nome === "rune" || nome === "scale") {
      P.rettangolo(x - w, y - h * 0.72, w * 2, h * 0.72, 1, {
        riempimento: alfa(colore, 0.78), bordo: tenue, spessore: 1,
      });
      for (let i = 0; i < 3; i++) {
        const yy = y - h * (0.58 - i * 0.17);
        P.retta(x - w * 0.65, yy, x + w * 0.65, yy, { bordo: tenue, spessore: Math.max(1, w * 0.08) });
      }
    } else {
      P.poligono(vertice, { riempimento: alfa(colore, 0.76), bordo, spessore: 1 });
      if (nome === "stalattiti") {
        P.poligono([[x - w, y - h * 0.65], [x, y], [x + w, y - h * 0.65]], {
          riempimento: alfa("#05070a", 0.65),
        });
      } else if (nome === "funghi") {
        P.ellisse(x, y - h * 0.68, w * 1.25, h * 0.18, { riempimento: alfa(accento, 0.65), bordo, spessore: 1 });
      } else if (nome === "fiamme") {
        P.ellisse(x, y - h * 0.5, w * 0.3, h * 0.35, { riempimento: alfa(accento, 0.7) });
      } else if (nome === "cristalli") {
        P.retta(x, y - h * 0.85, x, y - h * 0.12, { bordo: tenue, spessore: Math.max(1, w * 0.12) });
      }
    }
  }

  function disegnaVisuale(P, cam, visuale, seme, p) {
    if (!visuale) return;
    const colore = coloreMateriale(visuale.materiale, p);
    const dettagli = Array.isArray(visuale.dettagli) ? visuale.dettagli.slice(0, 4) : [];
    const posizioni = [-0.83, 0.8, -0.55, 0.52];
    const struttura = {
      naturale: "stalattiti",
      costruita: "colonne",
      rovinata: "rovine",
      vegetale: "radici",
      tecnologica: "macchinari",
      sacra: "archi",
      organica: "funghi",
    }[visuale.architettura];
    if (struttura) disegnaDettaglio(P, cam, struttura, -0.72, 5.3, colore, p.accento);
    for (let i = 0; i < dettagli.length; i++) {
      const offset = ((seme >>> (i * 3)) & 3) * 0.1;
      disegnaDettaglio(P, cam, dettagli[i], posizioni[i], 4.5 + i * 0.35 + offset, colore, p.accento);
    }
    if (visuale.luce === "calda" || visuale.luce === "pulsante") {
      P.ellisse(cam.centro, cam.y(cam.Z_MAX + 1.5), cam.larghezza * 0.12, cam.altezza * 0.08, {
        riempimento: alfa(p.accento, visuale.luce === "calda" ? 0.12 : 0.08),
      });
    } else if (visuale.luce === "buia") {
      P.rettangolo(0, 0, cam.larghezza, cam.altezza, 0, { riempimento: "rgba(0,0,0,0.14)" });
    } else if (visuale.luce === "controluce") {
      P.ellisse(cam.centro, cam.y(cam.Z_MAX + 1), cam.larghezza * 0.08, cam.altezza * 0.06, {
        riempimento: alfa("#ffffff", 0.12),
      });
    } else if (visuale.luce === "fredda") {
      P.rettangolo(0, 0, cam.larghezza, cam.altezza, 0, { riempimento: "rgba(90,150,230,0.045)" });
    } else if (visuale.luce === "diffusa") {
      P.rettangolo(0, 0, cam.larghezza, cam.altezza, 0, { riempimento: "rgba(230,235,240,0.035)" });
    }
  }

  // -------------------------------------------------------- uscite
  function uscite(P, cam, m, p) {
    const note = (m.uscite || []).map((u) => ({ direzione: u.direzione, ignota: false }));
    const ignote = (m.vieIgnote || []).map((d) => ({ direzione: d, ignota: true }));
    const lista = note.concat(ignote);
    const cliccabili = [];
    const n = lista.length;
    for (let i = 0; i < n; i++) {
      const u = lista[i];
      const z = n > 3 ? 3.9 : 3.55;
      const slot = n === 1 ? 0 : -0.66 + (1.32 * i) / (n - 1);
      const x = cam.x(slot, z);
      const yBase = cam.y(z);
      const alt = cam.altezza * cam.scala(z) * 0.92;
      const larg = alt * 0.4;

      const opacita = u.ignota ? 0.45 : 1;
      // luce che filtra oltre l'apertura (spenta per le direzioni non esplorate)
      P.ellisse(x, yBase - alt * 0.45, larg * 1.5, alt * 0.75, {
        riempimento: alfa(p.accento, u.ignota ? 0.03 : 0.07),
        bordo: alfa(p.accento, u.ignota ? 0.1 : 0.18),
        spessore: 1,
      });
      // arco scuro
      P.percorso(
        () => {
          P.ctx.moveTo(x - larg, yBase);
          P.ctx.lineTo(x - larg, yBase - alt * 0.62);
          P.ctx.quadraticCurveTo(x, yBase - alt * 1.12, x + larg, yBase - alt * 0.62);
          P.ctx.lineTo(x + larg, yBase);
          P.ctx.closePath();
        },
        {
          riempimento: P.gradiente(0, yBase - alt, 0, yBase, [
            [0, alfa(mischia(p.cielo1, "#000000", 0.3), opacita)],
            [1, alfa(p.accento, u.ignota ? 0.05 : 0.22)],
          ]),
          bordo: u.ignota ? undefined : alfa(p.parete, 0.95),
          spessore: Math.max(1, alt * 0.05),
          tratteggio: u.ignota ? [alt * 0.07, alt * 0.06] : undefined,
          opacita: opacita,
        }
      );
      // soglia illuminata
      if (!u.ignota) {
        P.ellisse(x, yBase, larg * 2.1, alt * 0.09, {
          riempimento: P.gradienteRadiale(x, yBase, larg * 2.1, [
            [0, alfa(p.accento, 0.3)],
            [1, alfa(p.accento, 0)],
          ]),
        });
      }
      P.retta(x - larg, yBase, x + larg, yBase, {
        bordo: alfa(p.accento, u.ignota ? 0.25 : 0.7),
        spessore: Math.max(1, alt * 0.035),
        tratteggio: u.ignota ? [alt * 0.05, alt * 0.05] : undefined,
      });
      // etichetta della direzione
      // su schermi stretti l'etichetta sale: il dpad occupa la parte bassa
      const salita = cam.larghezza < 700 ? 1.42 : 1.1;
      if (cam.larghezza >= 700) P.testo(u.ignota ? u.direzione + "?" : u.direzione, x, yBase - alt * salita, {
        taglia: Math.max(11, Math.round(alt * 0.15)),
        allinea: "center",
        tinta: alfa("#ffffff", u.ignota ? 0.5 : 0.9),
        bordo: alfa("#000000", 0.6),
        spessore: 3,
        peso: "600",
      });
      cliccabili.push({ direzione: u.direzione, ignota: u.ignota, x: x - larg * 1.2, y: yBase - alt * 1.15, w: larg * 2.4, h: alt * 1.2 });
    }
    return cliccabili;
  }

  // -------------------------------------------------------- ambiente
  function disegna(P, cam, m, t) {
    // la palette può arrivare dall'AI (bibbia o crea_luogo): sostituisce quella dell'ambiente
    const ambiente = m.visuale && m.visuale.architettura === "aperta" ? "esterno" : m.ambiente;
    const p = Object.assign({}, palette(ambiente), m.palette || {});
    const rnd = caso(m.seme || 1);
    cielo(P, cam, p);
    if (ambiente !== "esterno") {
      pareti(P, cam, p);
      if (ambiente !== "foresta") texturePareti(P, cam, p);
    }
    pavimento(P, cam, p);
    (ARREDI[ambiente] || ARREDI.caverna)(P, cam, p, rnd, t);
    disegnaVisuale(P, cam, m.visuale, m.seme || 1, p);
    // vignetta: scurisce i bordi e concentra lo sguardo
    P.rettangolo(0, 0, cam.larghezza, cam.altezza, 0, {
      riempimento: P.gradienteRadiale(cam.larghezza / 2, cam.altezza * 0.55, cam.larghezza * 0.62, [
        [0, "rgba(0,0,0,0)"],
        [0.55, "rgba(0,0,0,0.08)"],
        [1, "rgba(0,0,0,0.55)"],
      ]),
    });
    const cliccabili = uscite(P, cam, m, p);
    return { uscite: cliccabili, palette: p };
  }

  const Ambienti = { PALETTE, palette, disegna, disegnaVisuale };
  if (typeof module !== "undefined" && module.exports) module.exports = Ambienti;
  root.Ambienti = Ambienti;
})(typeof self !== "undefined" ? self : this);
