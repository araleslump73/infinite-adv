// =====================================================================
// grafica/parti.js - catalogo delle parti riutilizzabili
//
// Ogni parte è una funzione (P, o) che disegna intorno a (o.x, o.y) con
// unità o.s (≈ raggio del corpo). Nessuna parte è una creatura: sono pezzi
// che gli scheletri montano nelle prese.
//
// Unità: tutto è proporzionale a o.s, così la stessa parte va bene per
// un parassita minuscolo e per un golem.
// =====================================================================
(function (root) {
  "use strict";

  const COLORI = {
    base: { corpo: "#4c5a66", scuro: "#253038", chiaro: "#7e939f", luce: "#d6ecf5" },
    caldo: { corpo: "#7a4b32", scuro: "#3d2417", chiaro: "#b9784f", luce: "#ffd8a1" },
    freddo: { corpo: "#3a5872", scuro: "#1b2b3a", chiaro: "#6d93b4", luce: "#cfeaff" },
    malato: { corpo: "#5d6433", scuro: "#2f3319", chiaro: "#8c9a52", luce: "#e2f58d" },
    metallo: { corpo: "#4e5560", scuro: "#282c33", chiaro: "#8b95a3", luce: "#e6eef7" },
  };

  function colori(tinta) {
    return COLORI[tinta] || COLORI.base;
  }

  // colore con trasparenza, senza dipendere da altri moduli
  function alfa(colore, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(colore || ""));
    if (!m) return colore;
    const n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + Math.max(0, Math.min(1, a)) + ")";
  }

  // ------------------------------------------------------------ occhi
  const OCCHI = {
    lente(P, o) {
      P.ellisse(o.x, o.y, o.s * 0.26, o.s * 0.17, { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) });
      P.ellisse(o.x + o.s * 0.05 * o.verso, o.y, o.s * 0.07, o.s * 0.14, { riempimento: o.scuro });
    },
    tondo(P, o) {
      P.cerchio(o.x, o.y, o.s * 0.2, { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) });
      P.cerchio(o.x, o.y, o.s * 0.09, { riempimento: o.scuro });
      P.cerchio(o.x - o.s * 0.05, o.y - o.s * 0.05, o.s * 0.03, { riempimento: "#ffffff" });
    },
    fessura(P, o) {
      P.ellisse(o.x, o.y, o.s * 0.22, o.s * 0.1, { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) });
      P.rettangolo(o.x - o.s * 0.03, o.y - o.s * 0.1, o.s * 0.06, o.s * 0.2, o.s * 0.03, { riempimento: o.scuro });
    },
    grappolo(P, o) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + o.seme * 0.001;
        P.cerchio(o.x + Math.cos(a) * o.s * 0.16, o.y + Math.sin(a) * o.s * 0.13, o.s * 0.07, {
          riempimento: o.luce,
          bordo: o.scuro,
          spessore: Math.max(1, o.s * 0.03),
        });
      }
    },
    spirale(P, o) {
      P.cerchio(o.x, o.y, o.s * 0.19, { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) });
      P.percorso(
        () => {
          const cx = o.x;
          const cy = o.y;
          for (let i = 0; i <= 22; i++) {
            const a = (i / 22) * Math.PI * 2.4;
            const r = (i / 22) * o.s * 0.15;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (i === 0) P.ctx.moveTo(x, y);
            else P.ctx.lineTo(x, y);
          }
        },
        { bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) }
      );
    },
  };

  // ------------------------------------------------------------ teste
  const TESTE = {
    teschio(P, o) {
      P.ellisse(o.x, o.y, o.s * 0.42, o.s * 0.36, { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) });
      P.ellisse(o.x, o.y + o.s * 0.28, o.s * 0.26, o.s * 0.16, { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) });
    },
    tonda(P, o) {
      P.cerchio(o.x, o.y, o.s * 0.4, { riempimento: o.corpo, bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) });
    },
    allungata(P, o) {
      P.ellisse(o.x, o.y - o.s * 0.05, o.s * 0.3, o.s * 0.42, { riempimento: o.corpo, bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) });
    },
    cristallo(P, o) {
      P.poligono(
        [
          [o.x, o.y - o.s * 0.5],
          [o.x + o.s * 0.3, o.y - o.s * 0.05],
          [o.x + o.s * 0.18, o.y + o.s * 0.3],
          [o.x - o.s * 0.18, o.y + o.s * 0.3],
          [o.x - o.s * 0.3, o.y - o.s * 0.05],
        ],
        { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.04), ombra: { colore: o.luce, sfocatura: o.s * 0.3, dx: 0, dy: 0 } }
      );
    },
    elmo(P, o) {
      P.percorso(
        () => {
          P.ctx.arc(o.x, o.y + o.s * 0.05, o.s * 0.4, Math.PI, Math.PI * 2);
          P.ctx.lineTo(o.x + o.s * 0.4, o.y + o.s * 0.25);
          P.ctx.lineTo(o.x - o.s * 0.4, o.y + o.s * 0.25);
          P.ctx.closePath();
        },
        { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) }
      );
      P.rettangolo(o.x - o.s * 0.3, o.y + o.s * 0.02, o.s * 0.6, o.s * 0.08, o.s * 0.04, { riempimento: o.scuro });
    },
  };

  // ------------------------------------------------------------- arti
  const ARTI = {
    zampe(P, o) {
      for (const lato of [-1, 1]) {
        const x = o.x + lato * o.s * 0.34;
        P.percorso(
          () => {
            P.ctx.moveTo(x, o.y - o.s * 0.2);
            P.ctx.lineTo(x + lato * o.s * 0.12, o.y + o.s * 0.3);
            P.ctx.lineTo(x + lato * o.s * 0.3, o.y + o.s * 0.62);
          },
          { bordo: o.scuro, spessore: Math.max(1.5, o.s * 0.14) }
        );
      }
    },
    artigli(P, o) {
      for (let i = -1; i <= 1; i++) {
        P.poligono(
          [
            [o.x + i * o.s * 0.16, o.y],
            [o.x + i * o.s * 0.16 + o.s * 0.06, o.y + o.s * 0.3],
            [o.x + i * o.s * 0.16 - o.s * 0.06, o.y + o.s * 0.26],
          ],
          { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) }
        );
      }
    },
    tentacoli(P, o) {
      for (let i = -2; i <= 2; i++) {
        const oscillazione = Math.sin(o.t * 1.6 + i * 0.7 + o.seme * 0.01) * o.s * 0.12;
        P.percorso(
          () => {
            P.ctx.moveTo(o.x + i * o.s * 0.13, o.y);
            P.ctx.quadraticCurveTo(
              o.x + i * o.s * 0.2 + oscillazione,
              o.y + o.s * 0.35,
              o.x + i * o.s * 0.28 + oscillazione,
              o.y + o.s * 0.66
            );
          },
          { bordo: o.chiaro, spessore: Math.max(1.5, o.s * 0.09) }
        );
      }
    },
    ali(P, o) {
      const battito = 0.75 + Math.sin(o.t * 6 + o.seme * 0.01) * 0.25;
      for (const lato of [-1, 1]) {
        P.poligono(
          [
            [o.x + lato * o.s * 0.2, o.y - o.s * 0.1],
            [o.x + lato * o.s * 1.1, o.y - o.s * 0.75 * battito],
            [o.x + lato * o.s * 1.05, o.y + o.s * 0.15],
            [o.x + lato * o.s * 0.3, o.y + o.s * 0.15],
          ],
          { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03), opacita: 0.75 }
        );
      }
    },
    pinne(P, o) {
      for (const lato of [-1, 1]) {
        P.poligono(
          [
            [o.x + lato * o.s * 0.2, o.y],
            [o.x + lato * o.s * 0.75, o.y + o.s * 0.25],
            [o.x + lato * o.s * 0.2, o.y + o.s * 0.35],
          ],
          { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) }
        );
      }
    },
  };

  // ------------------------------------------------------------- code
  const CODE = {
    pungiglione(P, o) {
      P.percorso(
        () => {
          P.ctx.moveTo(o.x, o.y);
          P.ctx.quadraticCurveTo(o.x + o.s * 0.5, o.y - o.s * 0.2, o.x + o.s * 0.75, o.y - o.s * 0.65);
        },
        { bordo: o.corpo, spessore: Math.max(1.5, o.s * 0.1) }
      );
      P.poligono(
        [
          [o.x + o.s * 0.75, o.y - o.s * 0.65],
          [o.x + o.s * 0.9, o.y - o.s * 0.95],
          [o.x + o.s * 0.62, o.y - o.s * 0.85],
        ],
        { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) }
      );
    },
    frusta(P, o) {
      const onda = Math.sin(o.t * 2 + o.seme * 0.01) * o.s * 0.12;
      P.percorso(
        () => {
          P.ctx.moveTo(o.x, o.y);
          P.ctx.bezierCurveTo(o.x + o.s * 0.6, o.y - o.s * 0.4, o.x + o.s * 0.9, o.y + o.s * 0.2 + onda, o.x + o.s * 1.25, o.y - o.s * 0.35 + onda);
        },
        { bordo: o.corpo, spessore: Math.max(1.5, o.s * 0.08) }
      );
    },
    piume(P, o) {
      for (let i = 0; i < 3; i++) {
        const a = -0.5 + i * 0.35;
        P.poligono(
          [
            [o.x, o.y],
            [o.x + Math.cos(a) * o.s * 0.9, o.y + Math.sin(a) * o.s * 0.9],
            [o.x + Math.cos(a) * o.s * 0.7, o.y + Math.sin(a) * o.s * 0.7 + o.s * 0.12],
          ],
          { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.02) }
        );
      }
    },
    cavo(P, o) {
      P.percorso(
        () => {
          P.ctx.moveTo(o.x, o.y);
          P.ctx.quadraticCurveTo(o.x + o.s * 0.35, o.y + o.s * 0.25, o.x + o.s * 0.7, o.y - o.s * 0.05);
        },
        { bordo: o.chiaro, spessore: Math.max(1, o.s * 0.06), tratteggio: [o.s * 0.12, o.s * 0.1] }
      );
      P.rettangolo(o.x + o.s * 0.68, o.y - o.s * 0.12, o.s * 0.14, o.s * 0.14, o.s * 0.03, { riempimento: o.luce });
    },
  };

  // ------------------------------------------------------------ gusci
  const GUSCI = {
    corazza(P, o) {
      for (let riga = 0; riga < 3; riga++) {
        const y = o.y - o.s * 0.25 + riga * o.s * 0.24;
        P.rettangolo(o.x - o.s * 0.5, y, o.s, o.s * 0.2, o.s * 0.09, {
          riempimento: riga % 2 ? o.chiaro : o.corpo,
          bordo: o.scuro,
          spessore: Math.max(1, o.s * 0.04),
        });
      }
    },
    conchiglia(P, o) {
      P.cerchio(o.x, o.y, o.s * 0.45, { riempimento: o.corpo, bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) });
      for (let i = 1; i <= 3; i++) {
        P.arco(o.x, o.y, o.s * 0.45 * (i / 4), Math.PI * 0.2, Math.PI * 1.6, { bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) });
      }
    },
    placche(P, o) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        P.cerchio(o.x + Math.cos(a) * o.s * 0.4, o.y + Math.sin(a) * o.s * 0.3, o.s * 0.2, {
          riempimento: o.chiaro,
          bordo: o.scuro,
          spessore: Math.max(1, o.s * 0.03),
        });
      }
    },
    cristallo(P, o) {
      for (let i = -1; i <= 1; i++) {
        P.poligono(
          [
            [o.x + i * o.s * 0.22, o.y + o.s * 0.1],
            [o.x + i * o.s * 0.22 + o.s * 0.1, o.y - o.s * 0.4],
            [o.x + i * o.s * 0.22 + o.s * 0.22, o.y + o.s * 0.1],
          ],
          { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03), opacita: 0.85 }
        );
      }
    },
  };

  // -------------------------------------------------------- ornamenti
  const ORNAMENTI = {
    cresta(P, o) {
      for (let i = -2; i <= 2; i++) {
        P.poligono(
          [
            [o.x + i * o.s * 0.14, o.y],
            [o.x + i * o.s * 0.14 + o.s * 0.04, o.y - o.s * 0.3 + Math.abs(i) * o.s * 0.05],
            [o.x + i * o.s * 0.14 + o.s * 0.12, o.y],
          ],
          { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.02) }
        );
      }
    },
    corona(P, o) {
      P.rettangolo(o.x - o.s * 0.34, o.y, o.s * 0.68, o.s * 0.12, o.s * 0.04, { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) });
      for (let i = 0; i < 4; i++) {
        P.poligono(
          [
            [o.x - o.s * 0.34 + i * o.s * 0.18, o.y],
            [o.x - o.s * 0.25 + i * o.s * 0.18, o.y - o.s * 0.22],
            [o.x - o.s * 0.16 + i * o.s * 0.18, o.y],
          ],
          { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.02) }
        );
      }
    },
    catene(P, o) {
      for (let i = 0; i < 4; i++) {
        P.cerchio(o.x + i * o.s * 0.16, o.y + (i % 2 ? o.s * 0.05 : 0), o.s * 0.07, {
          bordo: o.chiaro,
          spessore: Math.max(1, o.s * 0.04),
        });
      }
    },
    elmo(P, o) {
      P.percorso(
        () => {
          P.ctx.arc(o.x, o.y, o.s * 0.34, Math.PI, Math.PI * 2);
          P.ctx.closePath();
        },
        { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) }
      );
      P.rettangolo(o.x - o.s * 0.26, o.y, o.s * 0.52, o.s * 0.07, o.s * 0.03, { riempimento: o.scuro });
    },
    sella(P, o) {
      P.rettangolo(o.x - o.s * 0.3, o.y - o.s * 0.12, o.s * 0.6, o.s * 0.16, o.s * 0.08, { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) });
      P.percorso(
        () => {
          P.ctx.moveTo(o.x - o.s * 0.18, o.y + o.s * 0.04);
          P.ctx.lineTo(o.x - o.s * 0.22, o.y + o.s * 0.4);
          P.ctx.moveTo(o.x + o.s * 0.18, o.y + o.s * 0.04);
          P.ctx.lineTo(o.x + o.s * 0.22, o.y + o.s * 0.4);
        },
        { bordo: o.scuro, spessore: Math.max(1, o.s * 0.04) }
      );
    },
    spine(P, o) {
      for (let i = -2; i <= 2; i++) {
        P.poligono(
          [
            [o.x + i * o.s * 0.15, o.y],
            [o.x + i * o.s * 0.15 + o.s * 0.05, o.y - o.s * 0.3],
            [o.x + i * o.s * 0.15 + o.s * 0.1, o.y],
          ],
          { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.02) }
        );
      }
    },
  };

  // ----------------------------------------------------------- bocche
  const BOCCHE = {
    zanne(P, o) {
      for (const lato of [-1, 1]) {
        P.poligono(
          [
            [o.x + lato * o.s * 0.14, o.y],
            [o.x + lato * o.s * 0.1, o.y + o.s * 0.2],
            [o.x + lato * o.s * 0.03, o.y],
          ],
          { riempimento: "#f2f6fa", bordo: o.scuro, spessore: Math.max(1, o.s * 0.02) }
        );
      }
    },
    becco(P, o) {
      P.poligono(
        [
          [o.x - o.s * 0.12, o.y - o.s * 0.02],
          [o.x + o.s * 0.3, o.y + o.s * 0.06],
          [o.x - o.s * 0.1, o.y + o.s * 0.14],
        ],
        { riempimento: o.luce, bordo: o.scuro, spessore: Math.max(1, o.s * 0.03) }
      );
    },
    masticatore(P, o) {
      for (const lato of [-1, 1]) {
        P.poligono(
          [
            [o.x + lato * o.s * 0.06, o.y],
            [o.x + lato * o.s * 0.26, o.y + o.s * 0.06],
            [o.x + lato * o.s * 0.12, o.y + o.s * 0.16],
          ],
          { riempimento: o.chiaro, bordo: o.scuro, spessore: Math.max(1, o.s * 0.02) }
        );
      }
    },
    nessuna() {},
  };

  const CATALOGO = {
    occhi: OCCHI,
    teste: TESTE,
    arti: ARTI,
    code: CODE,
    gusci: GUSCI,
    ornamenti: ORNAMENTI,
    bocche: BOCCHE,
  };

  const NOMI = {};
  for (const categoria of Object.keys(CATALOGO)) {
    NOMI[categoria] = Object.keys(CATALOGO[categoria]);
  }

  // dettagli condivisi da tutte le creature: crepe, muffa, bagliore
  function dettagli(P, o) {
    if (o.stato === "rotto") {
      P.percorso(
        () => {
          P.ctx.moveTo(o.x - o.s * 0.3, o.y - o.s * 0.5);
          P.ctx.lineTo(o.x - o.s * 0.05, o.y - o.s * 0.2);
          P.ctx.lineTo(o.x - o.s * 0.18, o.y + o.s * 0.1);
          P.ctx.lineTo(o.x + o.s * 0.12, o.y + o.s * 0.45);
        },
        { bordo: o.scuro, spessore: Math.max(1, o.s * 0.05) }
      );
    } else if (o.stato === "marcito") {
      for (let i = 0; i < 4; i++) {
        const a = o.seme * 0.01 + i * 1.7;
        P.cerchio(o.x + Math.cos(a) * o.s * 0.32, o.y + Math.sin(a) * o.s * 0.34, o.s * 0.07, {
          riempimento: o.scuro,
          opacita: 0.75,
        });
      }
    } else if (o.stato === "incandescente") {
      P.ellisse(o.x, o.y, o.s * 0.62, o.s * 0.7, {
        riempimento: alfa(o.luce, 0.16),
        bordo: alfa(o.luce, 0.5),
        spessore: Math.max(1, o.s * 0.05),
      });
    }
  }

  const Parti = { COLORI, colori, CATALOGO, NOMI, dettagli };
  if (typeof module !== "undefined" && module.exports) module.exports = Parti;
  root.Parti = Parti;
})(typeof self !== "undefined" ? self : this);
