// =====================================================================
// grafica/atmosfera.js - effetti di scena scelti dall'AI
//
// Non disegna oggetti né ambienti: modifica come si vedono gli SVG
// dell'AI (luce, sfocatura, tinta, nebbia, vignetta, sfarfallio) e
// muove la visuale o i singoli elementi. Senza atmosfera non fa nulla.
// =====================================================================
(function (root) {
  "use strict";

  const LARG_SVG = 960;

  function rgba(hex, a) {
    const h = String(hex || "#000000").replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16) || 0;
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + Math.max(0, Math.min(1, a)) + ")";
  }

  // rumore morbido in [-1, 1]: abbastanza irregolare da non sembrare un'onda
  function rumore(t, seme) {
    const s = seme || 0;
    return (Math.sin(t * 1.7 + s) + Math.sin(t * 2.9 + s * 1.3) * 0.6 + Math.sin(t * 4.3 + s * 0.7) * 0.4) / 2;
  }

  function movimentoCamera(a, t) {
    const fermo = { dx: 0, dy: 0, rot: 0, zoom: 1 };
    if (!a || !a.movimento) return fermo;
    const amp = a.ampiezza == null ? 0.4 : a.ampiezza;
    const w = 2 * Math.PI * 0.35 * (a.velocita || 1);
    // un po' di margine: con lo zoom i bordi dello sfondo non si vedono mai
    const margine = 1 + 0.09 * amp;
    switch (a.movimento) {
      case "oscilla": // drone in volo stazionario: un otto morbido
        return { dx: amp * 14 * Math.sin(w * t), dy: amp * 7 * Math.sin(2 * w * t), rot: amp * 0.02 * Math.sin(w * 0.8 * t), zoom: margine };
      case "ondeggia": // barca, vertigine
        return { dx: amp * 6 * Math.sin(w * 0.5 * t + 2), dy: amp * 10 * Math.sin(w * 0.6 * t + 1), rot: amp * 0.045 * Math.sin(w * 0.6 * t), zoom: margine };
      case "tremola": // scosse, motori
        return { dx: amp * 5 * rumore(t * w * 5, 1), dy: amp * 4 * rumore(t * w * 5, 7), rot: amp * 0.004 * rumore(t * w * 4, 3), zoom: margine };
      case "respira":
        return { dx: 0, dy: amp * 3 * Math.sin(w * 0.5 * t), rot: 0, zoom: 1 + amp * 0.025 * (1 + Math.sin(w * 0.5 * t)) };
      default:
        return fermo;
    }
  }

  function motoElemento(moto, t, seme, altezza) {
    const h = altezza || 100;
    const f = ((seme || 0) % 628) / 100;
    switch (moto) {
      case "fluttua":
        return { dx: 0, dy: -h * 0.05 * (1 + Math.sin(t * 1.6 + f)), rot: 0, scala: 1 };
      case "oscilla":
        return { dx: h * 0.02 * Math.sin(t * 1.3 + f), dy: 0, rot: 0.12 * Math.sin(t * 2 + f), scala: 1 };
      case "pulsa":
        return { dx: 0, dy: 0, rot: 0, scala: 1 + 0.05 * Math.sin(t * 3 + f) };
      case "tremola":
        return { dx: h * 0.015 * Math.sin(t * 37 + f), dy: h * 0.01 * Math.sin(t * 29 + f), rot: 0, scala: 1 };
      default:
        return null;
    }
  }

  // luce instabile: per lo più accesa, con cali improvvisi
  // (niente lampi regolari: un calo periodico e netto sembra uno stroboscopio)
  function sfarfallio(a, t) {
    if (!a || !a.sfarfallio) return 0;
    const lieve = Math.max(0, rumore(t * 2.2, 2)) * 0.16;
    // ogni ~1,7 s c'è una probabilità su tre di un calo breve e sfumato
    const slot = Math.floor(t / 1.7);
    const caso = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
    const fase = (t / 1.7 - slot - 0.3) / 0.12; // calo lungo ~0,2 s
    const calo = caso > 0.66 && fase > 0 && fase < 1 ? Math.sin(fase * Math.PI) * 0.32 : 0;
    return a.sfarfallio * Math.min(0.45, lieve + calo);
  }

  function sfocaturaPx(a, larghezza) {
    if (!a || !a.sfocatura) return 0;
    return a.sfocatura * (larghezza / LARG_SVG);
  }

  // sovrapposizioni sopra tutta la scena (coordinate del canvas)
  function sovrapponi(ctx, a, w, h, t, opzioni) {
    if (!a) return;
    const o = opzioni || {};
    const k = w / LARG_SVG;
    const kY = h / 540;
    ctx.save();

    if (a.tinta) {
      ctx.fillStyle = rgba(a.tinta, a.intensitaTinta == null ? 0.25 : a.intensitaTinta);
      ctx.fillRect(0, 0, w, h);
    }

    if (a.nebbia) {
      const g = ctx.createLinearGradient(0, h, 0, h * 0.3);
      g.addColorStop(0, rgba("#c3ccd6", a.nebbia * 0.8));
      g.addColorStop(1, rgba("#c3ccd6", 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const buio = Math.min(0.92, (a.luce == null ? 0 : 1 - a.luce) + (o.movimento === false ? 0 : sfarfallio(a, t)));
    if (buio > 0.001) {
      if (a.fonte) {
        const x = a.fonte.x * k;
        const y = a.fonte.y * kY;
        const r = (a.fonte.raggio || 200) * k;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.45, rgba("#000000", buio * 0.3));
        g.addColorStop(1, rgba("#000000", buio));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // alone caldo della sorgente
        const alone = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
        alone.addColorStop(0, rgba(a.tinta || "#ffd9a0", 0.16 * buio));
        alone.addColorStop(1, rgba(a.tinta || "#ffd9a0", 0));
        ctx.fillStyle = alone;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = rgba("#000000", buio);
        ctx.fillRect(0, 0, w, h);
      }
    }

    if (a.vignetta) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, rgba("#000000", a.vignetta * 0.85));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  const Atmosfera = { rgba, movimentoCamera, motoElemento, sfarfallio, sfocaturaPx, sovrapponi };
  if (typeof module !== "undefined" && module.exports) module.exports = Atmosfera;
  root.Atmosfera = Atmosfera;
})(typeof self !== "undefined" ? self : this);
