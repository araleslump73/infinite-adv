// =====================================================================
// grafica/prospettiva.js - la sola matematica "3D" del progetto
//
// Una stanza è un diorama visto in prima persona:
//   slot  = posizione orizzontale, da -1 (sinistra) a +1 (destra)
//   z     = profondità, 1 = vicino alla camera, 4+ = fondo
//
// Da (slot, z) a pixel:
//   scala = focale / z                (più lontano = più piccolo)
//   x     = centro + slot * larghezza * 0.42 / z
//   piedi = orizzonte + (altezza - orizzonte) / z
//
// Tutto qui è puro: nessun canvas, testabile in Node.
// =====================================================================
(function (root) {
  "use strict";

  function crea(opzioni) {
    const op = opzioni || {};
    const W = op.larghezza || 960;
    const H = op.altezza || 540;
    const orizzonte = op.orizzonte == null ? 0.52 : op.orizzonte;
    const focale = op.focale == null ? 0.85 : op.focale;
    const apertura = op.apertura == null ? 0.56 : op.apertura;
    const Z_MIN = op.zMin || 1;
    const Z_MAX = op.zMax || 6;
    const zonaOrizzonte = Math.max(48, H * 0.06);

    const cam = {
      larghezza: W,
      altezza: H,
      Z_MIN,
      Z_MAX,
      focale,
      orizzonte,
      yOrizzonte: H * orizzonte,
      centro: W / 2,
      zonaOrizzonte,
    };

    // ------------------------------------------------ proiezione
    cam.x = function (slot, z) {
      const zz = Math.max(Z_MIN, z);
      return cam.centro + slot * (W * apertura) / zz;
    };

    cam.y = function (z) {
      const zz = Math.max(Z_MIN, z);
      return cam.yOrizzonte + (H - cam.yOrizzonte) / zz;
    };

    cam.scala = function (z) {
      return focale / Math.max(Z_MIN, z);
    };

    // altezza in pixel di un elemento alto h "unità" (h=1 ≈ mezza schermata a z=1)
    cam.altezzaElemento = function (z, h) {
      return (h == null ? 0.5 : h) * H * cam.scala(z);
    };

    cam.proietta = function (slot, z, h) {
      return {
        x: cam.x(slot, z),
        y: cam.y(z),
        scala: cam.scala(z),
        h: cam.altezzaElemento(z, h),
      };
    };

    // ------------------------------------------------ soffitto e pareti
    // altezza (in unità) delle pareti sopra il pavimento
    cam.altezzaParete = op.altezzaParete == null ? 0.9 : op.altezzaParete;

    cam.tetto = function (z) {
      return cam.y(z) - cam.altezzaParete * H * cam.scala(z);
    };

    // poligono della parete laterale: lato = -1 sinistra, +1 destra
    cam.parete = function (lato, zVicino, zLontano) {
      const zv = zVicino == null ? Z_MIN : zVicino;
      const zl = zLontano == null ? Z_MAX + 2 : zLontano;
      return [
        [cam.x(lato, zv), cam.tetto(zv)],
        [cam.x(lato, zl), cam.tetto(zl)],
        [cam.x(lato, zl), cam.y(zl)],
        [cam.x(lato, zv), cam.y(zv)],
      ];
    };

    // fondo della stanza (sotto l'orizzonte)
    cam.fondoStanza = function (zLontano) {
      const zl = zLontano == null ? Z_MAX + 2 : zLontano;
      return [
        [cam.x(-1, zl), cam.tetto(zl)],
        [cam.x(1, zl), cam.tetto(zl)],
        [cam.x(1, zl), cam.y(zl)],
        [cam.x(-1, zl), cam.y(zl)],
      ];
    };

    // righe del pavimento, geometriche: fitte lontano, larghe vicino
    cam.righePavimento = function (quante, zLontano) {
      const n = quante || 7;
      const zl = zLontano == null ? Z_MAX + 2 : zLontano;
      const righe = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const z = Z_MIN + (zl - Z_MIN) * (t * t);
        righe.push({ z, y: cam.y(z), x1: cam.x(-1, z), x2: cam.x(1, z) });
      }
      return righe;
    };

    // linee che fuggono verso il punto di fuga (per il pavimento "a raggi")
    cam.lineeFuga = function (quante, zLontano) {
      const n = quante || 8;
      const zl = zLontano == null ? Z_MAX + 2 : zLontano;
      const linee = [];
      for (let i = 0; i <= n; i++) {
        const slot = -1 + (2 * i) / n;
        linee.push({
          x1: cam.x(slot, Z_MIN),
          y1: cam.y(Z_MIN),
          x2: cam.x(slot, zl),
          y2: cam.y(zl),
        });
      }
      return linee;
    };

    // dentro la scena? (con margine)
    cam.dentro = function (x, y, margine) {
      const m = margine || 0;
      return x >= -m && x <= W + m && y >= -m && y <= H + m;
    };

    // quanto è lontano un punto sullo schermo → z approssimato (per click sulle porte)
    cam.zDaY = function (y) {
      const dy = y - cam.yOrizzonte;
      if (dy <= 0.001) return 999;
      return (H - cam.yOrizzonte) / dy;
    };

    return cam;
  }

  const Prospettiva = { crea };
  if (typeof module !== "undefined" && module.exports) module.exports = Prospettiva;
  root.Prospettiva = Prospettiva;
})(typeof self !== "undefined" ? self : this);
