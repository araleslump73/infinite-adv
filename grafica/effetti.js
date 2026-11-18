// =====================================================================
// grafica/effetti.js - atmosfera: polvere, lucciole, pioggia, scintille
//
// Partecelle senza stato: la posizione è una funzione del tempo. Niente
// array da aggiornare, niente memoria, e il disegno è sempre lo stesso
// a parità di tempo (utile per i test).
// =====================================================================
(function (root) {
  "use strict";

  const PennaIstantanea = (typeof require === "function" && typeof module !== "undefined" && !root.Penna) ? require("./penna.js") : root.Penna;
  const alfa = (c, a) => PennaIstantanea.alfa(c, a);

  function caso(seme) {
    let a = (seme >>> 0) || 7;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // valori fissi per ogni particella, calcolati una volta per stanza
  function prepara(tipo, quante, larghezza, altezza, seme) {
    const rnd = caso(seme);
    const lista = [];
    const n = quante || { polvere: 34, lucciole: 22, pioggia: 60, scintille: 26, nebbia: 8 }[tipo] || 20;
    for (let i = 0; i < n; i++) {
      lista.push({
        x: rnd() * larghezza,
        y: rnd() * altezza,
        r: 0.6 + rnd() * 2.2,
        v: 0.4 + rnd() * 1.6,
        fase: rnd() * Math.PI * 2,
        opacita: 0.25 + rnd() * 0.55,
      });
    }
    return { tipo, lista, larghezza, altezza };
  }

  function disegna(P, atmosfera, cam, colore, t, opzioni) {
    if (!atmosfera || !atmosfera.lista.length) return;
    const o = opzioni || {};
    const { tipo, lista, larghezza, altezza } = atmosfera;
    const tempo = t || 0;
    // modalità ridotta: metà particelle, niente nebbia
    const passo = o.ridotti ? 2 : 1;
    if (o.ridotti && tipo === "nebbia") return;
    for (let i = 0; i < lista.length; i += passo) {
      const p = lista[i];
      let x = p.x;
      let y = p.y;
      let r = p.r;
      let opacita = p.opacita;

      if (tipo === "polvere") {
        y = (p.y + tempo * 8 * p.v) % altezza;
        x = p.x + Math.sin(tempo * 0.5 + p.fase) * 12;
      } else if (tipo === "lucciole") {
        y = (p.y + Math.sin(tempo * 0.4 + p.fase) * 26 - tempo * 4 * p.v + altezza * 2) % altezza;
        x = p.x + Math.cos(tempo * 0.35 + p.fase) * 20;
        opacita = 0.2 + 0.8 * Math.abs(Math.sin(tempo * 0.9 + p.fase));
        r = p.r * 1.6;
      } else if (tipo === "pioggia") {
        y = (p.y + tempo * 320 * p.v) % (altezza + 40);
        x = (p.x + tempo * 60 * p.v) % larghezza;
      } else if (tipo === "scintille") {
        y = (p.y - tempo * 26 * p.v + altezza * 3) % altezza;
        x = p.x + Math.sin(tempo * 1.4 + p.fase) * 10;
        opacita = 0.15 + 0.85 * Math.abs(Math.sin(tempo * 1.7 + p.fase));
      } else if (tipo === "nebbia") {
        x = (p.x + tempo * 6 * p.v) % larghezza;
        y = p.y + Math.sin(tempo * 0.25 + p.fase) * 8;
        r = 60 + p.r * 40;
        opacita = 0.03 + p.opacita * 0.05;
      }

      if (tipo === "pioggia") {
        P.retta(x, y, x + 3, y + 14 * p.v, { bordo: alfa(colore, 0.28 * p.opacita), spessore: 1 });
      } else if (tipo === "nebbia") {
        P.ellisse(x, y, r * 1.6, r * 0.5, { riempimento: alfa(colore, opacita) });
      } else {
        P.cerchio(x, y, r, {
          riempimento: alfa(colore, opacita),
          ombra: tipo === "lucciole" || tipo === "scintille" ? { colore: alfa(colore, 0.8), sfocatura: 10, dx: 0, dy: 0 } : undefined,
        });
      }
    }
  }

  // lampo a tutto schermo (danno, cura, ingresso in scena)
  function lampo(P, colore, intensita) {
    if (intensita <= 0.01) return;
    P.rettangolo(0, 0, P.larghezza, P.altezza, 0, { riempimento: alfa(colore, Math.min(0.5, intensita)) });
  }

  const Effetti = { prepara, disegna, lampo };
  if (typeof module !== "undefined" && module.exports) module.exports = Effetti;
  root.Effetti = Effetti;
})(typeof self !== "undefined" ? self : this);
