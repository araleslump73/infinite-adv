// =====================================================================
// grafica/svg-ai.js - validatione stretta e caricamento degli SVG AI.
//
// Sono ammessi solo tracciati e forme SVG statiche: niente script, stili,
// riferimenti esterni, filtri, animazioni o elementi incorporati.
// =====================================================================
(function (root) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const TAG = new Set(["svg", "g", "defs", "linearGradient", "radialGradient", "stop", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
  const GRADIENTI = new Set(["linearGradient", "radialGradient"]);
  const FORMA = ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity"];
  const ATTR = {
    svg: new Set(["viewBox", "width", "height", "preserveAspectRatio"]),
    g: new Set(["opacity"]),
    defs: new Set([]),
    linearGradient: new Set(["id", "x1", "y1", "x2", "y2", "gradientUnits"]),
    radialGradient: new Set(["id", "cx", "cy", "r", "fx", "fy", "gradientUnits"]),
    stop: new Set(["offset", "stop-color", "stop-opacity"]),
    path: new Set(["d", "stroke-linecap", "stroke-linejoin", ...FORMA]),
    rect: new Set(["x", "y", "width", "height", "rx", "ry", ...FORMA]),
    circle: new Set(["cx", "cy", "r", ...FORMA]),
    ellipse: new Set(["cx", "cy", "rx", "ry", ...FORMA]),
    line: new Set(["x1", "y1", "x2", "y2", "stroke-linecap", ...FORMA]),
    polyline: new Set(["points", "stroke-linecap", "stroke-linejoin", ...FORMA]),
    polygon: new Set(["points", "stroke-linecap", "stroke-linejoin", ...FORMA]),
  };
  // gli elementi dei gradienti stanno solo dove devono stare
  const GENITORE = { linearGradient: "defs", radialGradient: "defs", stop: "gradiente" };
  const MAX_SVG = 32000;
  const MAX_NODI = 400;
  const MAX_PROFONDITA = 12;
  const viewBoxPerTipo = {
    scena: { testo: "0 0 960 540", larghezza: 960, altezza: 540 },
    elemento: { testo: "0 0 100 100", larghezza: 100, altezza: 100 },
  };
  const validati = new Map();
  const immagini = new Map();
  const segnalati = new Set();
  // SVG validi ma che il browser non riesce a caricare: non si riprova a ogni fotogramma
  const falliti = new Set();

  function segnalaSvgNonValido(grezzo) {
    const chiave = typeof grezzo === "string" ? grezzo : "<svg mancante>";
    if (segnalati.has(chiave)) return;
    segnalati.add(chiave);
    console.warn("[grafica-ai] SVG mancante o non valido: elemento omesso.");
  }

  function numeroValido(testo, min, max) {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(testo)) return false;
    const n = Number(testo);
    return Number.isFinite(n) && n >= min && n <= max;
  }

  function listaNumeriValida(testo, pari) {
    if (typeof testo !== "string" || testo.length > 10000) return false;
    const numeri = testo.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) || [];
    const separato = testo.replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, "").replace(/[\s,]/g, "");
    return (
      numeri.length >= (pari ? 4 : 2) &&
      (!pari || numeri.length % 2 === 0) &&
      !separato &&
      numeri.every((n) => numeroValido(n, -2000, 2000))
    );
  }

  function percorsoValido(d) {
    if (typeof d !== "string" || !d.length || d.length > 12000) return false;
    const resto = d
      .replace(/[MmLlHhVvCcSsQqTtAaZz]/g, "")
      .replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, "")
      .replace(/[\s,]/g, "");
    if (resto) return false;
    const numeri = d.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) || [];
    return numeri.length >= 2 && numeri.every((n) => numeroValido(n, -2000, 2000));
  }

  function percentualeONumero(valore) {
    const m = /^(.*)%$/.exec(valore);
    return m ? numeroValido(m[1], -1000, 1000) : numeroValido(valore, -2000, 2000);
  }

  function attributoValido(nome, valore, elemento) {
    if (nome === "fill" || nome === "stroke") {
      return valore === "none" || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(valore) || /^url\(#[A-Za-z][\w-]{0,30}\)$/.test(valore);
    }
    if (nome === "id") return /^[A-Za-z][\w-]{0,30}$/.test(valore);
    if (nome === "gradientUnits") return valore === "userSpaceOnUse" || valore === "objectBoundingBox";
    if (nome === "stop-color") return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(valore);
    if (nome === "offset") return percentualeONumero(valore);
    if (["stop-opacity", "fill-opacity", "stroke-opacity"].includes(nome)) return numeroValido(valore, 0, 1);
    if (GRADIENTI.has(elemento) && ["x1", "y1", "x2", "y2", "cx", "cy", "r", "fx", "fy"].includes(nome)) {
      return percentualeONumero(valore) && !(nome === "r" && valore.trim().startsWith("-"));
    }
    if (nome === "stroke-linecap") return ["butt", "round", "square"].includes(valore);
    if (nome === "stroke-linejoin") return ["miter", "round", "bevel"].includes(valore);
    if (nome === "d") return percorsoValido(valore);
    if (nome === "points") return listaNumeriValida(valore, true);
    if (nome === "opacity") return numeroValido(valore, 0, 1);
    if (nome === "stroke-width") return numeroValido(valore, 0, 100);
    if (["width", "height", "r", "rx", "ry"].includes(nome)) return numeroValido(valore, 0, 2000);
    if (["x", "y", "cx", "cy", "x1", "y1", "x2", "y2"].includes(nome)) return numeroValido(valore, -2000, 2000);
    return false;
  }

  function serializzaElemento(documento, sorgente, contatore, profondita, genitore) {
    if (sorgente.nodeType === 3) return sorgente.nodeValue.trim() ? null : documento.createTextNode("");
    if (sorgente.nodeType !== 1) return null;
    if (profondita > MAX_PROFONDITA || contatore.nodi >= MAX_NODI) return null;
    if (sorgente.namespaceURI !== NS || !TAG.has(sorgente.localName)) return null;
    contatore.nodi++;

    const nome = sorgente.localName;
    const richiesto = GENITORE[nome];
    if (richiesto && !(richiesto === "gradiente" ? GRADIENTI.has(genitore) : genitore === richiesto)) return null;
    const destinazione = documento.createElementNS(NS, nome);
    for (const attr of Array.from(sorgente.attributes)) {
      if (nome === "svg" && attr.name === "xmlns" && attr.value === NS) continue;
      if (attr.namespaceURI || !ATTR[nome].has(attr.name)) return null;
      if (nome === "svg" && attr.name === "viewBox") continue;
      if (nome === "svg" && ["width", "height", "preserveAspectRatio"].includes(attr.name)) continue;
      if (!attributoValido(attr.name, attr.value, nome)) return null;
      destinazione.setAttribute(attr.name, attr.value);
    }

    for (const figlio of Array.from(sorgente.childNodes)) {
      if (figlio.nodeType === 8) continue;
      const copia = serializzaElemento(documento, figlio, contatore, profondita + 1, nome);
      if (!copia) return null;
      destinazione.appendChild(copia);
    }
    return destinazione;
  }

  function valida(grezzo, tipo) {
    if (typeof grezzo !== "string") {
      segnalaSvgNonValido(grezzo);
      return null;
    }
    const configurazione = viewBoxPerTipo[tipo];
    if (!configurazione || grezzo.length > MAX_SVG) {
      segnalaSvgNonValido(grezzo);
      return null;
    }
    const chiave = tipo + "\n" + grezzo;
    if (validati.has(chiave)) return validati.get(chiave);

    let risultato = null;
    try {
      if (/<!DOCTYPE|<!ENTITY/i.test(grezzo) || typeof DOMParser !== "function" || typeof XMLSerializer !== "function") {
        throw new Error("SVG non supportato");
      }
      const documento = new DOMParser().parseFromString(grezzo, "image/svg+xml");
      const sorgente = documento.documentElement;
      if (
        documento.doctype ||
        !sorgente ||
        sorgente.localName !== "svg" ||
        sorgente.namespaceURI !== NS ||
        sorgente.getAttribute("viewBox") !== configurazione.testo ||
        documento.getElementsByTagName("parsererror").length
      ) {
        throw new Error("SVG non valido");
      }
      const contatore = { nodi: 0 };
      const pulito = serializzaElemento(documento, sorgente, contatore, 0, null);
      if (!pulito) throw new Error("SVG contiene elementi non ammessi");
      pulito.setAttribute("xmlns", NS);
      pulito.setAttribute("viewBox", configurazione.testo);
      pulito.setAttribute("width", String(configurazione.larghezza));
      pulito.setAttribute("height", String(configurazione.altezza));
      risultato = new XMLSerializer().serializeToString(pulito);
    } catch (e) {
      risultato = null;
    }

    if (validati.size >= 128) validati.delete(validati.keys().next().value);
    validati.set(chiave, risultato);
    if (!risultato) segnalaSvgNonValido(grezzo);
    return risultato;
  }

  function immagine(grezzo, tipo) {
    const svg = valida(grezzo, tipo);
    if (!svg) return null;
    if (falliti.has(svg)) return null;
    let voce = immagini.get(svg);
    if (voce) return voce.pronta ? voce.immagine : null;
    if (typeof Image !== "function" || typeof Blob !== "function" || !URL.createObjectURL) return null;

    const imm = new Image();
    voce = { immagine: imm, pronta: false };
    immagini.set(svg, voce);
    if (immagini.size > 96) immagini.delete(immagini.keys().next().value);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    imm.onload = () => {
      voce.pronta = true;
      URL.revokeObjectURL(url);
    };
    imm.onerror = () => {
      URL.revokeObjectURL(url);
      immagini.delete(svg);
      falliti.add(svg);
      if (!segnalati.has(grezzo)) {
        segnalati.add(grezzo);
        console.warn("[grafica-ai] SVG AI non caricabile: elemento omesso.");
      }
    };
    imm.src = url;
    return null;
  }

  function fallita(grezzo, tipo) {
    const svg = valida(grezzo, tipo);
    return Boolean(svg && falliti.has(svg));
  }

  root.SvgAI = { valida, immagine, fallita };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SvgAI;
})(typeof self !== "undefined" ? self : this);
