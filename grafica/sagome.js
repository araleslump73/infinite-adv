// =====================================================================
// grafica/sagome.js - sagome disegnate a mano, in dati SVG
//
// Sono path veri (curvature, non cerchi incollati) con un riquadro di
// riferimento 100×100: (50,100) = piedi a terra, (50,0) = cima.
// Il motore le riempie sul canvas con Path2D, le colora con la tinta
// della creatura e ci mette sopra occhi e ornamenti.
//
// "ancore" dice dove attaccare gli elementi (occhi, bocca, coda…):
// coordinate nel riquadro 100×100.
// =====================================================================
(function (root) {
  "use strict";

  const SAGOME = {
    bipede: {
      corpo:
        "M50 26 C36 27 31 38 29 52 C27 68 25 86 22 100 L38 100 C39 84 41 72 44 63 C46 76 47 88 47 100 L53 100 C53 88 54 76 56 63 C59 72 61 84 62 100 L78 100 C75 86 73 68 71 52 C69 38 64 27 50 26 Z",
      testa: "M50 6 C56 6 61 11 61 18 C61 25 56 30 50 30 C44 30 39 25 39 18 C39 11 44 6 50 6 Z",
      tratti: [
        { d: "M32 33 C29 45 29 57 31 67", spessore: 7 },
        { d: "M68 33 C71 45 71 57 69 67", spessore: 7 },
        { d: "M45 27 C46 32 54 32 55 27", spessore: 3 },
      ],
      ancore: { occhi: [[45, 17], [55, 17]], bocca: [50, 24], sommita: [50, 3], testa: [50, 20], dorso: [50, 38], coda: [30, 70] },
    },

    quadrupede: {
      corpo:
        "M20 48 C24 35 38 29 54 31 C64 32 70 36 75 41 L82 46 L75 52 C69 60 58 64 48 64 L32 64 C26 64 22 58 20 48 Z",
      testa: "M74 37 C82 32 92 35 96 42 C98 48 93 55 84 55 C79 55 76 49 74 37 Z",
      tratti: [
        { d: "M36 62 L35 84 L33 96", spessore: 6 },
        { d: "M45 63 L45 86 L44 96", spessore: 6 },
        { d: "M57 63 L58 84 L59 96", spessore: 6 },
        { d: "M66 62 L68 84 L69 96", spessore: 6 },
        { d: "M22 46 C14 44 10 38 12 31", spessore: 4 },
        { d: "M80 33 L84 24 L89 34", spessore: 3 },
      ],
      ancore: { occhi: [[84, 42], [89, 44]], bocca: [93, 50], sommita: [84, 28], testa: [85, 45], dorso: [50, 34], coda: [17, 42] },
    },

    insettoide: {
      corpo:
        "M8 58 C6 48 14 40 24 40 C32 40 38 45 41 51 C45 43 53 39 61 41 C69 43 73 49 73 56 C73 65 66 71 57 71 L28 71 C17 71 10 66 8 58 Z",
      testa:
        "M69 50 C75 45 85 47 89 53 C91 59 85 66 77 66 C72 66 70 59 69 50 Z",
      tratti: [
        { d: "M30 68 L24 84 L20 94", spessore: 3.5 },
        { d: "M40 70 L37 86 L35 96", spessore: 3.5 },
        { d: "M50 70 L50 87 L50 97", spessore: 3.5 },
        { d: "M60 69 L62 85 L64 96", spessore: 3.5 },
        { d: "M14 54 L4 58 L1 70", spessore: 3.5 },
        { d: "M66 52 L70 44 L68 36", spessore: 2.5 },
        { d: "M74 52 L80 45 L84 37", spessore: 2.5 },
        { d: "M88 58 C92 62 92 67 88 70", spessore: 2.5 },
        { d: "M84 62 C87 66 86 70 82 73", spessore: 2.5 },
      ],
      ancore: { occhi: [[76, 54], [81, 53], [86, 54]], bocca: [88, 61], sommita: [58, 40], testa: [79, 56], dorso: [55, 46], coda: [8, 58] },
    },

    fluttuante: {
      corpo: "M50 20 C66 20 78 33 78 48 C78 63 66 76 50 76 C34 76 22 63 22 48 C22 33 34 20 50 20 Z",
      testa: "",
      tratti: [
        { d: "M38 74 C34 84 34 90 36 96", spessore: 4 },
        { d: "M44 76 C42 86 42 92 44 98", spessore: 4 },
        { d: "M50 77 C50 88 50 94 50 99", spessore: 4 },
        { d: "M56 76 C58 86 58 92 56 98", spessore: 4 },
        { d: "M62 74 C66 84 66 90 64 96", spessore: 4 },
      ],
      ancore: { occhi: [[43, 44], [57, 44], [50, 55]], bocca: [50, 62], sommita: [50, 14], testa: [50, 42], dorso: [50, 52], coda: [50, 74] },
    },
  };

  const Sagome = { SAGOME };
  if (typeof module !== "undefined" && module.exports) module.exports = Sagome;
  root.Sagome = Sagome;
})(typeof self !== "undefined" ? self : this);
