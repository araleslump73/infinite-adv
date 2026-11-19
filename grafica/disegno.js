// =====================================================================
// grafica/disegno.js - compone la scena: ambiente, elementi, atmosfera
//
// Ordine di disegno = dal fondo alla camera (gli elementi sono già
// ordinati per z nel modello). Restituisce le aree cliccabili, così
// vista_grafica sa cosa c'è sotto il puntatore.
// =====================================================================
(function (root) {
  "use strict";

  const req = (n) => (typeof require === "function" && typeof module !== "undefined" ? require(n) : null);
  const PennaIstantanea = root.Penna || req("./penna.js");
  const Ambienti = root.Ambienti || req("./ambienti.js");
  const Oggetti = root.Oggetti || req("./oggetti.js");
  const Scheletri = root.Scheletri || req("./scheletri.js");
  const Effetti = root.Effetti || req("./effetti.js");
  const SvgAI = root.SvgAI || req("./svg-ai.js");
  const alfa = (c, a) => PennaIstantanea.alfa(c, a);

  function preparaAtmosfera(mod, cam) {
    return Effetti.prepara(mod.meteo, null, cam.larghezza, cam.altezza, mod.seme);
  }

  // --------------------------------------------------------- sfondo
  function disegnaSfondo(P, cam, mod, t) {
    return Ambienti.disegna(P, cam, mod, t);
  }

  // ------------------------------------------------------- elementi
  function etichetta(P, cam, testo, x, y, colore, evidenzia) {
    const stretto = cam.larghezza < 700;
    const taglia = Math.max(9, Math.round(cam.altezza * (stretto ? 0.0135 : 0.0148)));
    // niente etichette sotto il bordo della scena o sopra l'header
    y = Math.max(taglia * 2.4, Math.min(y - (stretto ? 10 : 0), cam.altezza - taglia * 3));
    const opacita = evidenzia ? 0.95 : 0.4;
    const breve = testo.length > 28 ? testo.slice(0, 26) + "…" : testo;
    // piastra scura dietro: leggibile anche su pareti chiare o scintillii
    const stima = P.misuraTesto(breve, { taglia: taglia * (evidenzia ? 1.12 : 1), peso: evidenzia ? "700" : "500" });
    const larg = stima + 12;
    const alt = taglia * 1.5;
    P.rettangolo(x - larg / 2, y - alt * 0.78, larg, alt, alt / 2, {
      riempimento: alfa("#05070a", evidenzia ? 0.6 : 0.32),
      opacita: 1,
    });
    P.testo(breve, x, y, {
      taglia: taglia * (evidenzia ? 1.12 : 1),
      allinea: "center",
      tinta: alfa(colore, opacita),
      bordo: alfa("#000000", 0.55 * opacita),
      spessore: 3,
      peso: evidenzia ? "700" : "500",
    });
  }

  function disegnaElementi(P, cam, mod, t, opzioni) {
    const o = opzioni || {};
    const evidenzia = o.evidenzia || new Set();
    const aree = [];
    const p = mod.palette;

    const stretto = cam.larghezza < 700;
    const fattore = stretto ? 0.62 : 1; // elementi un po' più piccoli sul telefono
    // sul telefono il testo copre quasi metà schermo: gli elementi restano
    // nella fascia visibile, appoggiati su una linea poco sopra il pannello
    const limitePiedi = stretto ? cam.altezza * 0.44 : cam.altezza + 10;
    let posizione = 0;
    for (const el of mod.elementi) {
      const scalino = (posizione++ % 3) * (stretto ? 26 : 15);
      const x = cam.x(el.slot, el.z);
      const yBase = Math.min(cam.y(el.z), limitePiedi);
      const evidenziato = evidenzia.has(el.nome.toLowerCase());

      if (el.genere === "oggetto") {
        const hPx = cam.altezzaElemento(el.z, el.h) * fattore;
        const s = hPx * 0.8;
        Oggetti.disegna(P, el.aspetto, x, yBase, s, t, p.accento, el.seme);
        const yAlto = yBase - hPx * 1.05;
        if (evidenziato) {
          const pulsa = 0.5 + 0.5 * Math.sin(t * 3);
          P.ellisse(x, yAlto + hPx * 0.15, s * 1.5, s * 1.5, {
            riempimento: alfa(p.accento, 0.06 + pulsa * 0.06),
            bordo: alfa(p.accento, 0.5 + pulsa * 0.3),
            spessore: 2,
          });
        }
        etichetta(P, cam, el.nome, x, yAlto - scalino, p.accento, evidenziato);
        aree.push({ tipo: "elemento", nome: el.nome, x: x - hPx * 0.6, y: yAlto, w: hPx * 1.2, h: hPx * 1.4 });
      } else {
        const archetipo = Scheletri.ARCHETIPI[el.ricetta.archetipo] ? el.ricetta.archetipo : "quadrupede";
        const hPx = cam.altezzaElemento(el.z, el.h) * fattore;
        const s = hPx / Scheletri.ARCHETIPI[archetipo].altezza;
        const respiro = 1 + Math.sin(t * 1.6 + el.seme * 0.01) * 0.01;

        if (evidenziato) {
          const pulsa = 0.5 + 0.5 * Math.sin(t * 3.2);
          P.ellisse(x, yBase - hPx * 0.35, hPx * 0.62, hPx * 0.55, {
            riempimento: alfa(el.ostile ? "#e06767" : p.accento, 0.05 + pulsa * 0.05),
            bordo: alfa(el.ostile ? "#e06767" : p.accento, 0.35 + pulsa * 0.35),
            spessore: 2,
          });
        }

        Scheletri.disegna(P, el.ricetta, x, yBase, s * respiro, t);

        // barra vita dei nemici feriti
        if (el.ostile && el.vita != null && el.vita < el.vitaMax) {
          const larg = hPx * 0.5;
          const yBarra = yBase - hPx - 10;
          P.rettangolo(x - larg / 2, yBarra, larg, 4, 2, { riempimento: "rgba(0,0,0,0.55)" });
          P.rettangolo(x - larg / 2, yBarra, larg * Math.max(0, el.vita / el.vitaMax), 4, 2, { riempimento: "#d25560" });
        }

        etichetta(P, cam, el.nome, x, yBase - hPx - 6 - scalino, el.ostile ? "#e89999" : p.accento, evidenziato);
        aree.push({ tipo: "elemento", nome: el.nome, x: x - hPx * 0.5, y: yBase - hPx, w: hPx, h: hPx * 1.1 });
      }
    }
    return aree;
  }

  // ------------------------------------------------------ atmosfera
  function disegnaAtmosfera(P, cam, mod, atmosfera, t, opzioni) {
    const o = opzioni || {};
    Effetti.disegna(P, atmosfera, cam, mod.palette.nebbia, t, o);
    if (o.lampo && o.lampo.intensita > 0.01) Effetti.lampo(P, o.lampo.colore, o.lampo.intensita);
    if (o.dissolvenza > 0.01) P.rettangolo(0, 0, cam.larghezza, cam.altezza, 0, { riempimento: alfa("#000000", Math.min(1, o.dissolvenza)) });
  }

  // --------------------------------------------------------- scena
  function disegnaScena(P, cam, mod, atmosfera, t, opzioni) {
    const sfondo = disegnaSfondo(P, cam, mod, t);
    const areeElementi = disegnaElementi(P, cam, mod, t, opzioni);
    disegnaAtmosfera(P, cam, mod, atmosfera, t, opzioni);
    return { uscite: sfondo.uscite, elementi: areeElementi };
  }

  // barra vita dei nemici feriti: il danno subito si vede anche in scena
  function disegnaBarraVita(ctx, x, y, larghezzaElemento, vita, vitaMax) {
    const larg = Math.max(24, larghezzaElemento * 0.55);
    const quota = Math.max(0, Math.min(1, vita / Math.max(1, vitaMax)));
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - larg / 2, y, larg, 4);
    ctx.fillStyle = "#d25560";
    ctx.fillRect(x - larg / 2, y, larg * quota, 4);
  }

  function disegnaElementiSvg(ctx, cam, mod, t, opzioni) {
    const aree = [];
    const o = opzioni || {};
    // la scena non è più coperta dal testo: gli elementi poggiano sul fondo
    const fattore = 1;
    const limitePiedi = cam.altezza + 10;
    const Atm = root.Atmosfera || req("./atmosfera.js");

    for (const el of mod.elementi || []) {
      if (!SvgAI.valida(el.svg, "elemento")) continue;
      const yBase = Math.min(cam.y(el.z), limitePiedi);
      const altezza = cam.altezzaElemento(el.z, el.h) * fattore;
      const larghezza = altezza * (el.genere === "oggetto" ? 0.78 : 0.9);
      // vicino alla camera gli slot laterali si allargano: si resta nell'inquadratura
      // e fuori dai bordi, dove il primo piano disegna la sua cornice
      const margine = larghezza / 2 + cam.larghezza * 0.16;
      const x = Math.min(cam.larghezza - margine, Math.max(margine, cam.x(el.slot, el.z)));
      const area = {
        tipo: "elemento",
        nome: el.nome,
        x: x - larghezza / 2,
        y: yBase - altezza,
        w: larghezza,
        h: altezza,
      };
      const immagine = SvgAI.immagine(el.svg, "elemento");
      if (immagine) {
        const m = o.movimento === false ? null : Atm.motoElemento(el.moto, t || 0, el.seme, altezza);
        if (m) {
          ctx.save();
          ctx.translate(x + m.dx, yBase - altezza / 2 + m.dy);
          if (m.rot) ctx.rotate(m.rot);
          if (m.scala !== 1) ctx.scale(m.scala, m.scala);
          ctx.drawImage(immagine, -larghezza / 2, -altezza / 2, larghezza, altezza);
          ctx.restore();
        } else {
          ctx.drawImage(immagine, area.x, area.y, area.w, area.h);
        }
      }
      if (el.genere === "creatura" && el.ostile && el.vita != null && el.vita > 0 && el.vita < el.vitaMax) {
        disegnaBarraVita(ctx, x, area.y - Math.max(6, altezza * 0.05), larghezza, el.vita, el.vitaMax);
      }
      aree.push(area);
    }
    return aree;
  }

  // ------------------------------------------------------- mini-mappa
  function disegnaMappa(P, stato, x, y, w, h) {
    const visitati = Object.values(stato.luoghi).filter((l) => l.visitato);
    P.rettangolo(x, y, w, h, 8, { riempimento: "rgba(8,12,16,0.72)", bordo: "rgba(255,255,255,0.12)", spessore: 1 });
    if (!visitati.length) return;
    const xs = visitati.map((l) => l.x);
    const ys = visitati.map((l) => l.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const colonne = Math.max(1, maxX - minX + 1);
    const righe = Math.max(1, maxY - minY + 1);
    const cella = Math.min((w - 16) / colonne, (h - 16) / righe, 16);
    const offX = x + (w - cella * colonne) / 2;
    const offY = y + (h - cella * righe) / 2;
    for (const l of visitati) {
      const cx = offX + (l.x - minX) * cella;
      const cy = offY + (l.y - minY) * cella;
      const attuale = l.id === stato.luogo;
      P.rettangolo(cx + 2, cy + 2, cella - 4, cella - 4, 3, {
        riempimento: attuale ? "rgba(217,164,65,0.9)" : "rgba(160,180,200,0.35)",
        bordo: attuale ? "rgba(255,230,170,0.9)" : "rgba(160,180,200,0.2)",
        spessore: 1,
      });
    }
  }

  const Disegno = {
    preparaAtmosfera,
    disegnaSfondo,
    disegnaElementi,
    disegnaAtmosfera,
    disegnaScena,
    disegnaElementiSvg,
    disegnaBarraVita,
    disegnaMappa,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Disegno;
  root.Disegno = Disegno;
})(typeof self !== "undefined" ? self : this);
