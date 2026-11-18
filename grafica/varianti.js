// =====================================================================
// grafica/varianti.js - l'aspetto deriva dal nome
//
// Stesso nome → stessa variante, sempre: in stanze diverse, dopo un
// salvataggio, in una nuova sessione. È ciò che rende il mondo coerente
// invece di una sequenza di illustrazioni scollegate.
// =====================================================================
(function (root) {
  "use strict";

  const TINTE = ["base", "caldo", "freddo", "malato", "metallo"];
  const STATI = ["integro", "rotto", "marcito", "incandescente"];
  const POSTURE = ["fermo", "piegato", "sospeso"];
  const ACCESSORI = ["", "cresta", "corona", "catene", "elmo", "sella", "spine"];
  const DIREZIONI = ["sinistra", "centro", "destra"];

  function hash32(testo) {
    let h = 2166136261;
    const s = String(testo || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function caso(seme) {
    let a = seme >>> 0 || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // scelta pesata: gli accessori rari restano rari
  function pesca(rnd, elenco, pesi) {
    const totale = pesi.reduce((a, b) => a + b, 0);
    let r = rnd() * totale;
    for (let i = 0; i < elenco.length; i++) {
      r -= pesi[i];
      if (r <= 0) return elenco[i];
    }
    return elenco[elenco.length - 1];
  }

  function variante(nome, forzata) {
    const f = forzata || {};
    const seme = hash32(nome);
    const rnd = caso(seme);
    const v = {
      nome: String(nome || ""),
      seme,
      tinta: f.tinta && TINTE.includes(f.tinta) ? f.tinta : pesca(rnd, TINTE, [3, 2, 2, 1.2, 1.2]),
      stato: f.stato && STATI.includes(f.stato) ? f.stato : pesca(rnd, STATI, [5, 2, 1.6, 0.8]),
      postura: f.postura && POSTURE.includes(f.postura) ? f.postura : pesca(rnd, POSTURE, [4, 2, 1.5]),
      scala: f.scala != null ? Math.max(0.6, Math.min(1.8, Number(f.scala))) : 0.85 + rnd() * 0.4,
      accessorio: f.accessorio != null && ACCESSORI.includes(f.accessorio)
        ? f.accessorio
        : pesca(rnd, ACCESSORI, [6, 1.4, 0.5, 0.7, 0.6, 0.4, 1.0]),
      posizione: f.posizione && DIREZIONI.includes(f.posizione) ? f.posizione : pesca(rnd, DIREZIONI, [1, 1.4, 1]),
      sbandamento: (rnd() - 0.5) * 0.16, // piccola inclinazione, sempre uguale per quel nome
      fase: rnd() * Math.PI * 2, // sfasamento delle animazioni
      verso: rnd() < 0.5 ? -1 : 1,
    };
    return v;
  }

  const Varianti = { TINTE, STATI, POSTURE, ACCESSORI, DIREZIONI, hash32, caso, variante };
  if (typeof module !== "undefined" && module.exports) module.exports = Varianti;
  root.Varianti = Varianti;
})(typeof self !== "undefined" ? self : this);
