// =====================================================================
// grafica/oggetti.js - disegno procedurale dalle ricette visive dell'AI
//
// Non cerca il nome in un catalogo: interpreta forma, materiale, colori
// e dettagli validati dal motore. Le primitive consentono anche un
// ripiego generico per vecchi salvataggi o partite senza AI.
// =====================================================================
(function (root) {
  "use strict";

  const PennaIstantanea = (typeof require === "function" && typeof module !== "undefined" && !root.Penna)
    ? require("./penna.js")
    : root.Penna;

  function poligono(P, punti, colore, bordo, spessore) {
    P.poligono(punti, { riempimento: colore, bordo, spessore });
  }

  function disegna(P, ricetta, x, y, s, t, coloreBase, seme) {
    const r = ricetta && ricetta.forma ? ricetta : {
      forma: "irregolare",
      materiale: "pietra",
      colore: coloreBase || "#85877f",
      accento: "#d4cda9",
      dettagli: [],
      luminosita: 0,
      scala: 1,
    };
    const scala = Math.max(0.65, Math.min(1.6, Number(r.scala) || 1));
    const misura = s * scala;
    const colore = r.colore || coloreBase || "#85877f";
    const accento = r.accento || PennaIstantanea.mischia(colore, "#ffffff", 0.45);
    const scuro = PennaIstantanea.mischia(colore, "#000000", 0.58);
    const spessore = Math.max(1, misura * 0.055);
    const x0 = x;
    const y0 = y - misura * 0.72;

    P.ellisse(x, y - misura * 0.05, misura * 0.66, misura * 0.14, {
      riempimento: "rgba(0,0,0,0.42)",
    });

    switch (r.forma) {
      case "sfera":
        P.cerchio(x0, y0, misura * 0.52, { riempimento: colore, bordo: scuro, spessore });
        P.ellisse(x0 - misura * 0.14, y0 - misura * 0.18, misura * 0.16, misura * 0.1, {
          riempimento: accento,
          opacita: 0.7,
        });
        break;
      case "cristallo":
        poligono(P, [
          [x0, y0 - misura * 0.72], [x0 + misura * 0.36, y0 - misura * 0.15],
          [x0 + misura * 0.24, y0 + misura * 0.46], [x0 - misura * 0.24, y0 + misura * 0.46],
          [x0 - misura * 0.36, y0 - misura * 0.15],
        ], colore, accento, spessore);
        P.retta(x0, y0 - misura * 0.62, x0, y0 + misura * 0.37, { bordo: accento, spessore: spessore * 0.8 });
        break;
      case "blocco":
      case "contenitore":
        P.rettangolo(x0 - misura * 0.48, y0 - misura * 0.48, misura * 0.96, misura * 0.9, misura * 0.08, {
          riempimento: colore, bordo: scuro, spessore,
        });
        P.retta(x0 - misura * 0.42, y0 - misura * 0.12, x0 + misura * 0.42, y0 - misura * 0.12, {
          bordo: accento, spessore: spessore * 0.8,
        });
        break;
      case "anello":
        P.cerchio(x0, y0, misura * 0.38, { bordo: accento, spessore: Math.max(2, misura * 0.16) });
        P.cerchio(x0, y0, misura * 0.18, { bordo: scuro, spessore: Math.max(1, misura * 0.05) });
        break;
      case "lama":
        poligono(P, [
          [x0 - misura * 0.16, y0 + misura * 0.5], [x0 - misura * 0.1, y0 - misura * 0.24],
          [x0 + misura * 0.14, y0 - misura * 0.76], [x0 + misura * 0.18, y0 + misura * 0.28],
          [x0 + misura * 0.03, y0 + misura * 0.48],
        ], colore, accento, spessore);
        P.retta(x0 - misura * 0.34, y0 + misura * 0.36, x0 + misura * 0.32, y0 + misura * 0.36, {
          bordo: scuro, spessore: Math.max(2, misura * 0.08),
        });
        break;
      case "fiala":
        P.rettangolo(x0 - misura * 0.15, y0 - misura * 0.7, misura * 0.3, misura * 0.28, misura * 0.04, {
          riempimento: accento, bordo: scuro, spessore,
        });
        P.ellisse(x0, y0 + misura * 0.02, misura * 0.36, misura * 0.46, {
          riempimento: PennaIstantanea.mischia(colore, accento, 0.28), bordo: scuro, spessore,
        });
        break;
      case "foglio":
        poligono(P, [
          [x0 - misura * 0.43, y0 - misura * 0.52], [x0 + misura * 0.28, y0 - misura * 0.52],
          [x0 + misura * 0.43, y0 - misura * 0.36], [x0 + misura * 0.43, y0 + misura * 0.49],
          [x0 - misura * 0.43, y0 + misura * 0.49],
        ], colore, scuro, spessore);
        for (let i = 0; i < 3; i++) {
          P.retta(x0 - misura * 0.28, y0 - misura * 0.2 + i * misura * 0.2, x0 + misura * 0.28, y0 - misura * 0.2 + i * misura * 0.2, {
            bordo: accento, spessore: Math.max(1, misura * 0.035),
          });
        }
        break;
      case "organica":
        P.ellisse(x0, y0, misura * 0.43, misura * 0.56, { riempimento: colore, bordo: scuro, spessore });
        P.cerchio(x0, y0 - misura * 0.06, misura * 0.12, { riempimento: accento });
        break;
      default: {
        const n = Number(seme) >>> 0;
        const varia = (i) => 0.72 + (((n >>> (i * 3)) & 7) / 30);
        const punti = [];
        for (let i = 0; i < 7; i++) {
          const angolo = -Math.PI / 2 + (Math.PI * 2 * i) / 7;
          const raggio = misura * varia(i) * (i % 2 ? 0.42 : 0.52);
          punti.push([x0 + Math.cos(angolo) * raggio, y0 + Math.sin(angolo) * raggio]);
        }
        poligono(P, punti, colore, scuro, spessore);
        P.cerchio(x0, y0, misura * 0.1, { riempimento: accento });
      }
    }

    if (r.materiale === "metallo") {
      P.retta(x0 - misura * 0.22, y0 - misura * 0.34, x0 + misura * 0.2, y0 - misura * 0.38, {
        bordo: PennaIstantanea.alfa("#ffffff", 0.68), spessore: Math.max(1, misura * 0.045),
      });
    } else if (r.materiale === "vetro" || r.materiale === "energia") {
      P.ellisse(x0 - misura * 0.14, y0 - misura * 0.22, misura * 0.11, misura * 0.2, {
        riempimento: PennaIstantanea.alfa("#ffffff", 0.38),
      });
    } else if (r.materiale === "legno") {
      for (let i = 0; i < 2; i++) {
        P.retta(x0 - misura * 0.24, y0 + misura * (i * 0.16), x0 + misura * 0.24, y0 + misura * (i * 0.16), {
          bordo: PennaIstantanea.alfa(scuro, 0.55), spessore: Math.max(1, misura * 0.025),
        });
      }
    } else if (r.materiale === "pietra" || r.materiale === "osso") {
      P.poligono([
        [x0 - misura * 0.08, y0 - misura * 0.2],
        [x0 + misura * 0.03, y0 - misura * 0.04],
        [x0 - misura * 0.02, y0 + misura * 0.12],
      ], { bordo: PennaIstantanea.alfa(scuro, 0.72), spessore: Math.max(1, misura * 0.03) }, false);
    } else if (r.materiale === "tessuto" || r.materiale === "organico") {
      P.retta(x0 - misura * 0.2, y0 - misura * 0.18, x0 + misura * 0.14, y0 + misura * 0.2, {
        bordo: PennaIstantanea.alfa(accento, 0.6), spessore: Math.max(1, misura * 0.03),
      });
    }

    const dettagli = Array.isArray(r.dettagli) ? r.dettagli.slice(0, 3) : [];
    for (let i = 0; i < dettagli.length; i++) {
      const ox = x0 + (i - (dettagli.length - 1) / 2) * misura * 0.16;
      const oy = y0 + ((i % 2) ? misura * 0.16 : -misura * 0.18);
      disegnaDettaglio(P, dettagli[i], ox, oy, misura, accento, scuro, i);
    }

    const luce = Math.max(0, Math.min(1, Number(r.luminosita) || 0));
    if (luce > 0) {
      P.ellisse(x0, y0, misura * 0.56, misura * 0.62, {
        riempimento: PennaIstantanea.alfa(accento, luce * 0.1),
        bordo: PennaIstantanea.alfa(accento, luce * 0.35),
        spessore: Math.max(1, misura * 0.025),
      });
    }
    return r.forma;
  }

  function disegnaDettaglio(P, dettaglio, x, y, s, colore, scuro, indice) {
    const k = indice % 2 ? -1 : 1;
    if (dettaglio === "crepe") {
      P.poligono([[x, y - s * 0.15], [x - s * 0.05, y], [x + s * 0.02, y + s * 0.05], [x - s * 0.03, y + s * 0.16]], {
        bordo: scuro, spessore: Math.max(1, s * 0.04),
      }, false);
    } else if (dettaglio === "catene") {
      P.cerchio(x, y, s * 0.09, { bordo: colore, spessore: Math.max(1, s * 0.035) });
      P.cerchio(x + s * 0.1 * k, y + s * 0.12, s * 0.07, { bordo: colore, spessore: Math.max(1, s * 0.03) });
    } else if (dettaglio === "spine") {
      P.poligono([[x - s * 0.08, y + s * 0.08], [x, y - s * 0.13], [x + s * 0.08, y + s * 0.08]], {
        riempimento: colore, bordo: scuro, spessore: Math.max(1, s * 0.025),
      });
    } else if (dettaglio === "pulsante") {
      P.cerchio(x, y, s * 0.07, { riempimento: colore, bordo: scuro, spessore: Math.max(1, s * 0.025) });
    } else {
      const tratto = dettaglio === "venature" ? colore : scuro;
      P.retta(x - s * 0.12, y, x + s * 0.12, y + s * 0.02 * k, { bordo: tratto, spessore: Math.max(1, s * 0.035) });
      if (dettaglio === "rune" || dettaglio === "simboli") {
        P.retta(x, y - s * 0.1, x, y + s * 0.1, { bordo: colore, spessore: Math.max(1, s * 0.035) });
      } else if (dettaglio === "incisioni") {
        P.retta(x - s * 0.08, y - s * 0.07, x + s * 0.08, y - s * 0.07, { bordo: tratto, spessore: Math.max(1, s * 0.025) });
      }
    }
  }

  const Oggetti = { disegna, disegnaDettaglio };
  if (typeof module !== "undefined" && module.exports) module.exports = Oggetti;
  root.Oggetti = Oggetti;
})(typeof self !== "undefined" ? self : this);
