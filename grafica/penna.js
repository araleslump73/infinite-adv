// =====================================================================
// grafica/penna.js - API di disegno minima sopra Canvas 2D
//
// Non è un motore grafico nuovo: è un vocabolario. Le scene dicono
// "rettangolo arrotondato con bordo oro" invece di parlare di ctx.
//
// Vantaggi: codice leggibile, disegno testabile (contatore + controllo
// dei numeri), backend sostituibile (domani WebGL senza toccare le scene).
//
// stile = { riempimento, bordo, spessore, tratteggio[], opacita, ombra:{colore,sfocatura,dx,dy} }
// =====================================================================
(function (root) {
  "use strict";

  function Penna(ctx, opzioni) {
    const op = opzioni || {};
    const P = {
      ctx: ctx,
      larghezza: op.larghezza || 960,
      altezza: op.altezza || 540,
      chiamate: 0, // quante forme disegnate: serve ai test
      errori: [], // coordinate non valide (dovrebbe restare sempre vuoto)
    };

    // ------------------------------------------------------- helper
    const FAMIGLIA_FONT = op.font || '"Segoe UI", system-ui, sans-serif';

    function valido(...numeri) {
      for (let i = 0; i < numeri.length; i++) {
        if (!Number.isFinite(+numeri[i])) {
          if (P.errori.length < 20) P.errori.push("numero non valido: " + numeri[i]);
          return false;
        }
      }
      return true;
    }

    function applicaStile(stile) {
      const s = stile || {};
      ctx.globalAlpha = s.opacita == null ? 1 : s.opacita;
      if (s.ombra) {
        ctx.shadowColor = s.ombra.colore || "rgba(0,0,0,0.45)";
        ctx.shadowBlur = s.ombra.sfocatura == null ? 8 : s.ombra.sfocatura;
        ctx.shadowOffsetX = s.ombra.dx || 0;
        ctx.shadowOffsetY = s.ombra.dy || 0;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if (ctx.setLineDash) ctx.setLineDash(s.tratteggio || []);
    }

    function riempiTraccia(stile) {
      const s = stile || {};
      if (s.riempimento) {
        ctx.fillStyle = s.riempimento;
        ctx.fill();
      }
      if (s.bordo && (s.spessore == null || s.spessore > 0)) {
        ctx.strokeStyle = s.bordo;
        ctx.lineWidth = s.spessore == null ? 2 : s.spessore;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    function figura(stile, disegna) {
      ctx.save();
      applicaStile(stile);
      ctx.beginPath();
      disegna();
      riempiTraccia(stile);
      ctx.restore();
      P.chiamate++;
    }

    // ------------------------------------------------------- forme
    P.retta = function (x1, y1, x2, y2, stile) {
      if (!valido(x1, y1, x2, y2)) return;
      const s = stile || {};
      figura(
        { bordo: s.bordo || s.riempimento || "#fff", spessore: s.spessore == null ? 1 : s.spessore, tratteggio: s.tratteggio, opacita: s.opacita },
        () => {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
      );
    };

    P.arco = function (cx, cy, r, da, a, stile) {
      if (!valido(cx, cy, r, da, a)) return;
      figura(stile, () => ctx.arc(cx, cy, Math.max(0, r), da, a));
    };

    P.cerchio = function (cx, cy, r, stile) {
      if (!valido(cx, cy, r)) return;
      figura(stile, () => ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2));
    };

    P.ellisse = function (cx, cy, rx, ry, stile, rotazione) {
      if (!valido(cx, cy, rx, ry)) return;
      figura(stile, () => {
        if (ctx.ellipse) ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rotazione || 0, 0, Math.PI * 2);
        else ctx.arc(cx, cy, Math.abs(rx), 0, Math.PI * 2);
      });
    };

    P.rettangolo = function (x, y, w, h, raggio, stile) {
      if (!valido(x, y, w, h)) return;
      const r = Math.max(0, Math.min(raggio || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      figura(stile, () => {
        if (r > 0.5 && ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else if (r > 0.5) {
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
        } else ctx.rect(x, y, w, h);
      });
    };

    P.poligono = function (punti, stile, chiuso) {
      if (!punti || punti.length < 2) return;
      for (let i = 0; i < punti.length; i++) if (!valido(punti[i][0], punti[i][1])) return;
      figura(stile, () => {
        ctx.moveTo(punti[0][0], punti[0][1]);
        for (let i = 1; i < punti.length; i++) ctx.lineTo(punti[i][0], punti[i][1]);
        if (chiuso !== false) ctx.closePath();
      });
    };

    P.percorso = function (disegna, stile) {
      figura(stile, disegna);
    };

    P.testo = function (t, x, y, opzioniTesto) {
      if (!valido(x, y)) return;
      const o = opzioniTesto || {};
      ctx.save();
      ctx.font = (o.peso ? o.peso + " " : "") + (o.taglia || 14) + "px " + (o.font || FAMIGLIA_FONT);
      ctx.textAlign = o.allinea || "left";
      ctx.textBaseline = o.base || "alphabetic";
      ctx.globalAlpha = o.opacita == null ? 1 : o.opacita;
      if (o.bordo) {
        ctx.strokeStyle = o.bordo;
        ctx.lineWidth = o.spessore || 3;
        ctx.lineJoin = "round";
        ctx.strokeText(t, x, y);
      }
      ctx.fillStyle = o.tinta || "#e8eef5";
      ctx.fillText(t, x, y);
      ctx.restore();
      P.chiamate++;
    };

    // ------------------------------------------------- trasformazioni
    P.salva = function (fn) {
      ctx.save();
      try {
        fn(P);
      } finally {
        ctx.restore();
      }
    };

    P.trasla = function (x, y, fn) {
      if (!valido(x, y)) return;
      ctx.save();
      ctx.translate(x, y);
      try {
        fn(P);
      } finally {
        ctx.restore();
      }
    };

    P.ruota = function (rad, fn) {
      if (!valido(rad)) return;
      ctx.save();
      ctx.rotate(rad);
      try {
        fn(P);
      } finally {
        ctx.restore();
      }
    };

    P.scala = function (sx, sy, fn) {
      if (!valido(sx, sy == null ? sx : sy)) return;
      ctx.save();
      ctx.scale(sx, sy == null ? sx : sy);
      try {
        fn(P);
      } finally {
        ctx.restore();
      }
    };

    P.opacita = function (a, fn) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      try {
        fn(P);
      } finally {
        ctx.restore();
      }
    };

    P.ritaglia = function (forma, fn) {
      ctx.save();
      ctx.beginPath();
      forma(P);
      ctx.clip();
      try {
        fn(P);
      } finally {
        ctx.restore();
      }
    };

    // forma da dati SVG: la stessa sintassi dei <path d="...">, riempita
    // sul canvas. Se il browser non ha Path2D (Node, test) non disegna nulla.
    P.forma = function (dati, stile, trasf) {
      if (typeof Path2D !== "function" || !dati) return false;
      const t = trasf || {};
      const s = t.s == null ? 1 : t.s;
      if (!valido(t.x || 0, t.y || 0, s)) return false;
      let percorso;
      try {
        percorso = new Path2D(dati);
      } catch (e) {
        return false;
      }
      ctx.save();
      ctx.translate(t.x || 0, t.y || 0);
      if (t.ruota) ctx.rotate(t.ruota);
      ctx.scale(t.specchia ? -s : s, s);
      applicaStile(stile);
      const st = stile || {};
      if (st.riempimento) {
        ctx.fillStyle = st.riempimento;
        ctx.fill(percorso);
      }
      if (st.bordo && (st.spessore == null || st.spessore > 0)) {
        ctx.strokeStyle = st.bordo;
        ctx.lineWidth = st.spessore == null ? 2 : st.spessore;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke(percorso);
      }
      ctx.restore();
      P.chiamate++;
      return true;
    };

    P.misuraTesto = function (t, opzioniTesto) {
      const o = opzioniTesto || {};
      ctx.save();
      ctx.font = (o.peso ? o.peso + " " : "") + (o.taglia || 14) + "px " + (o.font || FAMIGLIA_FONT);
      let larghezza = 0;
      if (ctx.measureText) larghezza = ctx.measureText(String(t)).width || 0;
      ctx.restore();
      // stima di riserva se il contesto non sa misurare (test in Node)
      return larghezza || String(t).length * (o.taglia || 14) * 0.55;
    };

    P.gradiente = function (x0, y0, x1, y1, tappe) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (const [posizione, colore] of tappe) g.addColorStop(posizione, colore);
      return g;
    };

    P.gradienteRadiale = function (cx, cy, r, tappe) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
      for (const [posizione, colore] of tappe) g.addColorStop(posizione, colore);
      return g;
    };

    P.pulisci = function (colore) {
      ctx.save();
      ctx.setTransform && ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colore || "#0e1116";
      ctx.fillRect(0, 0, P.larghezza, P.altezza);
      ctx.restore();
    };

    return P;
  }

  // ------------------------------------------------------ colori
  function daHex(c) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function aHex(rgb) {
    const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return "#" + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
  }

  Penna.mischia = function (a, b, t) {
    const A = daHex(a);
    const B = daHex(b);
    if (!A || !B) return a;
    const k = Math.max(0, Math.min(1, t == null ? 0.5 : t));
    return aHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
  };

  Penna.alfa = function (colore, a) {
    const c = daHex(colore);
    if (!c) return colore;
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)) + ")";
  };

  Penna.scurisci = function (colore, quanto) {
    return Penna.mischia(colore, "#000000", quanto == null ? 0.3 : quanto);
  };

  Penna.schiarisci = function (colore, quanto) {
    return Penna.mischia(colore, "#ffffff", quanto == null ? 0.3 : quanto);
  };

  Penna.daHex = daHex;

  if (typeof module !== "undefined" && module.exports) module.exports = Penna;
  root.Penna = Penna;
})(typeof self !== "undefined" ? self : this);
