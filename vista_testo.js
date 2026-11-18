// =====================================================================
// vista_testo.js - la parte visibile: menu iniziale, log narrativo,
// pannello di stato, comandi, salvataggio.
//
// Regola: qui non si decide nulla del mondo. Il motore applica gli effetti,
// questa vista mostra il risultato.
// =====================================================================
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CHIAVE_SALVATAGGIO = "avventura-infinita/v1";
  // quanto aspettare l'AI prima di andare avanti: dipende dal livello di grafica
  // (la grafica avanzata produce SVG molto più lunghi)
  function attesaAI() {
    const l = window.AI && AI.LIVELLI && AI.LIVELLI[AI.livello];
    return l ? l.turno - 2000 : 30000;
  }

  const S = {
    bibbia: null,
    stato: null,
    storia: [],
    inCorso: false,
    ai: false,
    // numero d'ordine dell'azione: serve a ignorare risposte AI ormai vecchie
    token: 0,
  };

  const finitori = [];

  // API minima per la vista grafica: nessuno legge S direttamente
  window.Avventura = {
    esegui: (testo) => esegui(testo),
    stato: () => S.stato,
    bibbia: () => S.bibbia,
    inCorso: () => S.inCorso,
  };

  // ------------------------------------------------------- utilità
  function markdown(testo) {
    return String(testo)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  function vicinoAlFondo() {
    const log = $("log");
    return log.scrollHeight - log.scrollTop - log.clientHeight < 140;
  }

  function scorri(forza) {
    const log = $("log");
    if (forza || vicinoAlFondo()) log.scrollTop = log.scrollHeight;
  }

  function completaAnimazioni() {
    while (finitori.length) finitori.pop()();
  }

  function scrivi(el, testo) {
    const html = markdown(testo);
    // durante l'animazione niente asterischi a vista: il grassetto arriva alla fine
    const piano = testo.replace(/\*/g, "");
    let i = 0;
    let timer = null;
    const passo = Math.max(2, Math.ceil(piano.length / 90));
    function fine() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
      el.innerHTML = html;
      const idx = finitori.indexOf(fine);
      if (idx >= 0) finitori.splice(idx, 1);
      scorri(true);
    }
    finitori.push(fine);
    timer = setInterval(() => {
      i += passo;
      if (i >= piano.length) return fine();
      el.textContent = piano.slice(0, i);
    }, 16);
  }

  function nuovaVoce(classe) {
    const div = document.createElement("div");
    div.className = "voce " + classe;
    $("log").appendChild(div);
    // il testo nuovo resta sempre in vista: la lettura riparte dal fondo
    scorri(true);
    return div;
  }

  function logComando(cmd) {
    const d = nuovaVoce("comando");
    d.textContent = cmd;
  }

  function logSistema(testo) {
    const d = nuovaVoce("sistema");
    d.textContent = testo;
  }

  function logNarrazione(testo, anima) {
    const d = nuovaVoce("narrazione");
    const p = document.createElement("p");
    d.appendChild(p);
    if (anima) scrivi(p, testo);
    else p.innerHTML = markdown(testo);
    return d;
  }

  function logDettaglio(testo) {
    const d = nuovaVoce("dettaglio");
    d.textContent = testo;
  }

  function logEsito(cambi, rifiutati) {
    const d = nuovaVoce("esito");
    if (cambi) d.appendChild(document.createTextNode(cambi));
    if (rifiutati && rifiutati.length) {
      if (cambi) d.appendChild(document.createTextNode(" · "));
      const s = document.createElement("span");
      s.className = "rifiutato";
      s.textContent = "scartato: " + rifiutati.map((r) => r.op).join(", ");
      d.appendChild(s);
    }
    scorri();
  }

  function mostraAttesa() {
    const d = nuovaVoce("attesa");
    const span = document.createElement("span");
    span.textContent = "il mondo pensa";
    const punti = document.createElement("span");
    punti.className = "punti";
    d.appendChild(span);
    d.appendChild(punti);
    return d;
  }

  // ------------------------------------------------------- pannello
  function barra(el, valore, massimo) {
    el.style.width = Math.max(0, Math.min(100, (valore / massimo) * 100)) + "%";
  }

  async function aggiornaStatisticheAI() {
    const el = $("statistiche-ai");
    let s;
    try {
      s = await AI.statistiche();
    } catch (e) {
      el.textContent = "Statistiche AI non disponibili";
      el.title = "Errore nel recupero delle statistiche: " + e.message;
      return;
    }
    if (!s) {
      el.textContent = "Statistiche disponibili dal server";
      el.title = "Avvia il server del gioco per visualizzare token e costo.";
      return;
    }

    const token = Number.isFinite(s.tokenTotali)
      ? new Intl.NumberFormat("it-IT").format(s.tokenTotali)
      : "n/d";
    const costoValido = Number.isFinite(s.costoStimato);
    const costo = costoValido
      ? s.costoStimato.toLocaleString("it-IT", {
          minimumFractionDigits: s.costoStimato > 0.01 ? 2 : 5,
          maximumFractionDigits: 6,
        }) +
        " " +
        (s.valuta || "USD")
      : "costo n/d";

    el.textContent = "Token totali " + token + " · " + (costoValido ? "~" : "") + costo;
    el.title =
      "Totale dall'avvio del server. Costo indicativo con le tariffe configurate, senza sconti cache." +
      (s.tokenSenzaRipartizione
        ? " Alcuni token non hanno il dettaglio ingresso/uscita."
        : "") +
      (s.chiamateSenzaUso ? " Alcune chiamate non hanno restituito i dati di utilizzo." : "") +
      (!costoValido && !s.tokenSenzaRipartizione && !s.chiamateSenzaUso
        ? " Tariffe non configurate per questo modello."
        : "");
  }

  function aggiornaHUD() {
    const st = S.stato;
    if (!st) return;
    const L = st.luoghi[st.luogo];
    $("luogo-nome").textContent = L.nome;
    const nomeDi = (d) => (st.luoghi[L.uscite[d]] ? st.luoghi[L.uscite[d]].nome : "");
    const uscite = Object.keys(L.uscite);
    $("luogo-uscite").textContent = uscite.length
      ? uscite.map((d) => (nomeDi(d) ? d + " → " + nomeDi(d) : d)).join(" · ")
      : "nessuna uscita nota: prova una direzione";

    // bussola: oro = uscita nota, tratteggio = da esplorare
    document.querySelectorAll("#dpad button").forEach((b) => {
      const d = b.dataset.dir;
      const nota = Boolean(L.uscite[d]);
      b.classList.toggle("nota", nota);
      b.title = nota ? "vai " + d + (nomeDi(d) ? " → " + nomeDi(d) : "") : d + ": da esplorare";
    });

    const g = st.giocatore;
    barra($("barra-vita"), g.vita.attuale, g.vita.massima);
    barra($("barra-energia"), g.energia.attuale, g.energia.massima);
    $("vita-num").textContent = g.vita.attuale + "/" + g.vita.massima;
    $("energia-num").textContent = g.energia.attuale + "/" + g.energia.massima;
    $("hud").classList.toggle("ferito", g.vita.attuale > 0 && g.vita.attuale / g.vita.massima <= 0.34);

    const inv = $("inventario");
    inv.innerHTML = "";
    if (!g.inventario.length) {
      const li = document.createElement("li");
      li.className = "vuoto";
      li.textContent = "vuoto";
      inv.appendChild(li);
    } else {
      for (const o of g.inventario) {
        const li = document.createElement("li");
        li.textContent = o.nome;
        li.title = (o.descrizione ? o.descrizione + " · " : "") + "clic: aggiungi al comando";
        li.tabIndex = 0;
        li.onclick = () => aggiungiAlComando(o.nome);
        li.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            aggiungiAlComando(o.nome);
          }
        };
        inv.appendChild(li);
      }
    }

    $("obiettivo").textContent = S.bibbia.obiettivo || "";
    $("obiettivo").parentElement.hidden = !S.bibbia.obiettivo;
    disegnaMappa(st, $("mappa"));
    $("latenza").textContent =
      "turno " + st.turno + " · " + (S.ai ? "AI " + (AI.info.modello || "") : "simulatore locale");
  }

  // l'oggetto dello zaino entra nella frase che si sta scrivendo ("uso" + chiave)
  function aggiungiAlComando(nome) {
    const campo = $("comando");
    if (campo.disabled) return;
    const v = campo.value.replace(/\s+$/, "");
    campo.value = (v ? v + " " : "uso ") + nome + " ";
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }

  // mappa SVG: luoghi visitati con simbolo, nome e contenuto; le uscite note
  // ancora da esplorare compaiono come "?". I nomi vengono dall'AI: solo textContent.
  const SIMBOLI_AMBIENTE = { caverna: "⛰", foresta: "🌲", sala: "🏛", corridoio: "🚪", esterno: "☀", nave: "⚓" };
  const NS_SVG = "http://www.w3.org/2000/svg";
  const CELLA_X = 132;
  const CELLA_Y = 92;
  const NODO_W = 112;
  const NODO_H = 64;

  function nodoSvg(tag, attributi, genitore) {
    const n = document.createElementNS(NS_SVG, tag);
    for (const k in attributi) n.setAttribute(k, attributi[k]);
    if (genitore) genitore.appendChild(n);
    return n;
  }

  function testoSvg(genitore, classe, x, y, testo) {
    const t = nodoSvg("text", { class: classe, x, y }, genitore);
    t.textContent = testo;
    return t;
  }

  function posizioniMappa(st) {
    const visitati = Object.values(st.luoghi).filter((l) => l.visitato);
    const ids = new Set(visitati.map((l) => l.id));
    for (const l of visitati) for (const d in l.uscite) if (st.luoghi[l.uscite[d]]) ids.add(l.uscite[d]);
    // prima i visitati, così un "?" non ruba la cella a un luogo conosciuto
    const ordine = [...ids].sort((a, b) => Number(!st.luoghi[a].visitato) - Number(!st.luoghi[b].visitato));
    const occupate = new Set();
    const pos = {};
    for (const id of ordine) {
      const l = st.luoghi[id];
      let x = Number(l.x) || 0;
      let y = Number(l.y) || 0;
      // su/giù possono finire su celle già usate: si scivola a destra
      for (let i = 0; occupate.has(x + "," + y) && i < 20; i++) x += 1;
      occupate.add(x + "," + y);
      pos[id] = { x, y };
    }
    return pos;
  }

  // nome su massimo due righe, misurato davvero: non esce mai dal riquadro
  function scriviNome(g, x, y, nome, larghezza) {
    const t = nodoSvg("text", { class: "m-nome", x, y }, g);
    const misura = (s) => {
      t.textContent = s;
      const w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
      return w ? w : s.length * 6.2;
    };
    const parole = String(nome || "").split(/\s+/).filter(Boolean);
    const righe = [];
    let riga = "";
    while (parole.length && righe.length < 2) {
      const prova = riga ? riga + " " + parole[0] : parole[0];
      if (misura(prova) <= larghezza) {
        riga = prova;
        parole.shift();
      } else if (!riga) {
        riga = parole.shift();
        righe.push(riga);
        riga = "";
      } else {
        righe.push(riga);
        riga = "";
      }
    }
    if (riga && righe.length < 2) righe.push(riga);
    if (parole.length && righe.length) righe[righe.length - 1] += " " + parole.join(" ");
    // tronca con "…" ogni riga che resta troppo larga
    for (let i = 0; i < righe.length; i++) {
      let s = righe[i];
      if (misura(s) <= larghezza) continue;
      while (s.length > 1 && misura(s + "…") > larghezza) s = s.slice(0, -1);
      righe[i] = s.replace(/\s+$/, "") + "…";
    }
    t.textContent = "";
    const y0 = righe.length > 1 ? -6 : 0;
    righe.forEach((r, i) => {
      const ts = nodoSvg("tspan", { x, dy: i === 0 ? y0 : 13 }, t);
      ts.textContent = r;
    });
  }

  function disegnaMappa(st, contenitore) {
    contenitore.textContent = "";
    if (!st) return;
    const pos = posizioniMappa(st);
    const ids = Object.keys(pos);
    if (!ids.length) {
      const p = document.createElement("p");
      p.className = "vuota";
      p.textContent = "Nessun luogo esplorato.";
      contenitore.appendChild(p);
      return;
    }
    const xs = ids.map((id) => pos[id].x);
    const ys = ids.map((id) => pos[id].y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const larg = (Math.max(...xs) - minX + 1) * CELLA_X;
    const alt = (Math.max(...ys) - minY + 1) * CELLA_Y;
    const centro = (id) => ({
      x: (pos[id].x - minX) * CELLA_X + CELLA_X / 2,
      y: (pos[id].y - minY) * CELLA_Y + CELLA_Y / 2,
    });

    // scala fissa: si rimpicciolisce un po' se serve, ma non si ingrandisce mai
    const cw = Math.max(160, contenitore.clientWidth || 300);
    const ch = Math.max(100, contenitore.clientHeight || 200);
    const s = Math.max(0.74, Math.min(1, cw / larg, ch / alt));
    const vw = cw / s;
    const vh = ch / s;
    const qui = centro(st.luogo);
    const limita = (v, min, max) => Math.max(min, Math.min(max, v));
    // se la mappa non ci sta, resta centrata sul luogo attuale
    const ox = larg <= vw ? (vw - larg) / 2 : limita(vw / 2 - qui.x, vw - larg, 0);
    const oy = alt <= vh ? (vh - alt) / 2 : limita(vh / 2 - qui.y, vh - alt, 0);

    const svg = nodoSvg("svg", {
      viewBox: `0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}`,
      role: "img",
      "aria-label": "Mappa dei luoghi",
    });
    contenitore.appendChild(svg);
    const defs = nodoSvg("defs", {}, svg);
    const griglia = nodoSvg("pattern", { id: "m-griglia", width: 24, height: 24, patternUnits: "userSpaceOnUse" }, defs);
    nodoSvg("circle", { cx: 1, cy: 1, r: 1, class: "m-punto" }, griglia);
    const grad = nodoSvg("linearGradient", { id: "m-grad", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    nodoSvg("stop", { offset: "0", "stop-color": "#1b2633" }, grad);
    nodoSvg("stop", { offset: "1", "stop-color": "#111821" }, grad);
    const gradQui = nodoSvg("linearGradient", { id: "m-grad-qui", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    nodoSvg("stop", { offset: "0", "stop-color": "#3d2f12" }, gradQui);
    nodoSvg("stop", { offset: "1", "stop-color": "#21190a" }, gradQui);
    nodoSvg("rect", { width: "100%", height: "100%", fill: "url(#m-griglia)" }, svg);

    // quando ci si sposta la mappa torna sul luogo attuale (lo zoom resta)
    if (VM.luogo !== st.luogo) {
      VM.luogo = st.luogo;
      VM.dx = 0;
      VM.dy = 0;
    }
    const mondo = nodoSvg("g", {}, svg);
    VM.disegno = { mondo, vw, vh, ox, oy, s, larg, alt };
    applicaVistaMappa();
    const linee = nodoSvg("g", {}, mondo);
    const fatti = new Set();
    for (const id of ids) {
      const l = st.luoghi[id];
      if (!l.visitato) continue;
      for (const d in l.uscite) {
        const altro = l.uscite[d];
        if (!pos[altro]) continue;
        const chiave = [id, altro].sort().join("|");
        if (fatti.has(chiave)) continue;
        fatti.add(chiave);
        const a = centro(id);
        const b = centro(altro);
        const ignoto = !st.luoghi[altro].visitato;
        if (d === "su" || d === "giu") {
          // scale: arco sopra la riga, così non attraversa altri riquadri
          const mx = (a.x + b.x) / 2;
          const my = Math.min(a.y, b.y) - NODO_H / 2 - 14;
          nodoSvg("path", { class: "m-via scala" + (ignoto ? " ignota" : ""), d: `M${a.x} ${a.y - NODO_H / 2}Q${mx} ${my - 14} ${b.x} ${b.y - NODO_H / 2}`, fill: "none" }, linee);
          nodoSvg("circle", { class: "m-scala", cx: mx, cy: my, r: 8 }, linee);
          testoSvg(linee, "m-verticale", mx, my, "⇅");
          continue;
        }
        nodoSvg("line", { class: "m-via" + (ignoto ? " ignota" : ""), x1: a.x, y1: a.y, x2: b.x, y2: b.y }, linee);
      }
    }

    const corrente = st.luoghi[st.luogo];
    const direzioneVerso = {};
    for (const d in corrente.uscite) direzioneVerso[corrente.uscite[d]] = d;
    const W = NODO_W;
    const H = NODO_H;

    for (const id of ids) {
      const l = st.luoghi[id];
      const c = centro(id);
      const eQui = id === st.luogo;
      const dir = direzioneVerso[id];
      const g = nodoSvg(
        "g",
        { class: "m-nodo" + (eQui ? " qui" : "") + (l.visitato ? "" : " ignoto") + (dir ? " vicino" : "") },
        mondo
      );
      const titolo = nodoSvg("title", {}, g);
      titolo.textContent = (l.visitato ? l.nome : "luogo da esplorare") + (dir ? " · clic: vai " + dir : "");
      nodoSvg("rect", { class: "m-box", x: c.x - W / 2, y: c.y - H / 2, width: W, height: H, rx: 10 }, g);
      if (!l.visitato) {
        testoSvg(g, "m-ignoto", c.x, c.y, "?");
      } else {
        nodoSvg("circle", { class: "m-badge", cx: c.x - W / 2 + 15, cy: c.y - H / 2 + 14, r: 10 }, g);
        testoSvg(g, "m-simbolo", c.x - W / 2 + 15, c.y - H / 2 + 15, SIMBOLI_AMBIENTE[l.ambiente] || "◇");
        const segni = [];
        if ((l.oggetti || []).length) segni.push(["ogg", "◆"]);
        if ((l.png || []).some((p) => !p.ostile)) segni.push(["amico", "☺"]);
        if ((l.png || []).some((p) => p.ostile)) segni.push(["ostile", "☠"]);
        segni.forEach(([classe, simbolo], i) =>
          testoSvg(g, "m-segno " + classe, c.x + W / 2 - 11 - i * 14, c.y - H / 2 + 14, simbolo)
        );
        scriviNome(g, c.x, c.y + 13, l.nome, W - 12);
      }
      if (dir) {
        g.addEventListener("click", (ev) => {
          if (ev.detail > 1) return;
          if (!S.inCorso) esegui("vai " + dir);
        });
      }
    }
  }

  // ------------------------------------- mappa: trascina, zoom, ricentra
  const VM = { dx: 0, dy: 0, zoom: 1, luogo: null, disegno: null };
  const ZOOM_MAPPA = [0.4, 2.5];

  function applicaVistaMappa() {
    const d = VM.disegno;
    if (!d) return;
    const cx = d.vw / 2;
    const cy = d.vh / 2;
    // la mappa non può sparire del tutto fuori dal riquadro
    const lim = (v, centro, dim, vista) => {
      const max = dim / 2 + (vista / 2 - 30) / VM.zoom;
      const c = Math.max(centro - max, Math.min(centro + max, v + dim / 2));
      return c - dim / 2;
    };
    VM.dx = lim(d.ox + VM.dx, cx, d.larg, d.vw) - d.ox;
    VM.dy = lim(d.oy + VM.dy, cy, d.alt, d.vh) - d.oy;
    const tx = d.ox + VM.dx;
    const ty = d.oy + VM.dy;
    d.mondo.setAttribute(
      "transform",
      `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${VM.zoom.toFixed(3)}) translate(${(tx - cx).toFixed(1)} ${(ty - cy).toFixed(1)})`
    );
  }

  (function interazioneMappa() {
    const el = $("mappa");
    if (!el) return;
    let presa = null;
    let trascinato = false;

    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || !VM.disegno) return;
      presa = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, dx: VM.dx, dy: VM.dy };
      trascinato = false;
    });
    el.addEventListener("pointermove", (ev) => {
      if (!presa || ev.pointerId !== presa.id) return;
      const mx = ev.clientX - presa.x;
      const my = ev.clientY - presa.y;
      if (!trascinato && Math.hypot(mx, my) < 5) return;
      if (!trascinato) {
        trascinato = true;
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* puntatore non più attivo */
        }
        el.classList.add("trascina");
      }
      const k = VM.disegno.s * VM.zoom;
      VM.dx = presa.dx + mx / k;
      VM.dy = presa.dy + my / k;
      applicaVistaMappa();
    });
    const lascia = (ev) => {
      if (!presa || ev.pointerId !== presa.id) return;
      presa = null;
      el.classList.remove("trascina");
    };
    el.addEventListener("pointerup", lascia);
    el.addEventListener("pointercancel", lascia);
    // dopo un trascinamento il rilascio non deve contare come clic su un luogo
    el.addEventListener(
      "click",
      (ev) => {
        if (!trascinato) return;
        trascinato = false;
        ev.stopPropagation();
        ev.preventDefault();
      },
      true
    );

    el.addEventListener(
      "wheel",
      (ev) => {
        const d = VM.disegno;
        if (!d) return;
        ev.preventDefault();
        const nuovo = Math.max(ZOOM_MAPPA[0], Math.min(ZOOM_MAPPA[1], VM.zoom * Math.exp(-ev.deltaY * 0.0015)));
        if (nuovo === VM.zoom) return;
        // lo zoom resta fermo sul punto sotto il cursore
        const r = el.getBoundingClientRect();
        const q = { x: (ev.clientX - r.left) / d.s, y: (ev.clientY - r.top) / d.s };
        const cx = d.vw / 2;
        const cy = d.vh / 2;
        const wx = (q.x - cx) / VM.zoom + cx - (d.ox + VM.dx);
        const wy = (q.y - cy) / VM.zoom + cy - (d.oy + VM.dy);
        VM.zoom = nuovo;
        VM.dx = (q.x - cx) / nuovo + cx - wx - d.ox;
        VM.dy = (q.y - cy) / nuovo + cy - wy - d.oy;
        applicaVistaMappa();
      },
      { passive: false }
    );

    el.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      VM.dx = 0;
      VM.dy = 0;
      VM.zoom = 1;
      applicaVistaMappa();
    });
  })();

  // la mappa si ridisegna quando il riquadro cambia dimensione
  if (typeof ResizeObserver !== "undefined") {
    let ultima = "";
    new ResizeObserver((voci) => {
      const r = voci[0].contentRect;
      const chiave = Math.round(r.width) + "x" + Math.round(r.height);
      if (chiave === ultima || !S.stato) return;
      ultima = chiave;
      disegnaMappa(S.stato, $("mappa"));
    }).observe($("mappa"));
  }
  // ------------------------------------------------------- partita
  function mostraBadge() {
    const badge = $("badge-ai");
    if (S.ai) {
      badge.className = "badge ai";
      badge.textContent = "AI · " + (AI.info.modello || AI.info.provider || "pronta");
    } else {
      badge.className = "badge locale";
      badge.textContent = "AI · locale";
    }
    badge.title = AI.info.motivo || (S.ai ? "narrazione generata dall'AI" : "simulatore locale");
  }

  function notaInizio() {
    const nota = $("nota-ai");
    if (S.ai) {
      nota.className = "nota";
      nota.textContent =
        "AI pronta (" + (AI.info.provider || "?") + " · " + (AI.info.modello || "?") + "): genera SVG per ambienti, oggetti e creature. Senza SVG valido, la grafica resta vuota.";
    } else {
      nota.className = "nota avviso";
      nota.textContent =
        "AI non disponibile (" + (AI.info.motivo || "?") + "). Senza AI il mondo resta essenziale: " +
        "la grafica AI richiede una chiave in config.json e «node server.js».";
    }
    if (localStorage.getItem(CHIAVE_SALVATAGGIO)) {
      nota.textContent += " C'è una partita salvata: menu «Partita» › «Carica salvataggio».";
    }
  }

  async function iniziaPartita() {
    const idea = ($("idea").value || "").trim();
    const nome = ($("nome").value || "").trim() || "Viandante";
    const bottone = $("btn-inizia");

    if (!idea) {
      $("nota-ai").className = "nota avviso";
      $("nota-ai").textContent = "Scrivi prima che avventura vuoi vivere: è la traccia da cui nasce tutto il resto.";
      $("idea").focus();
      return;
    }

    bottone.disabled = true;
    bottone.textContent = "L'AI inventa il mondo…";

    // la scena appare subito, con la schermata di attesa: niente menu congelato
    $("schermata-inizio").hidden = true;
    $("schermata-gioco").hidden = false;
    $("log").innerHTML = "";
    logSistema("L'AI sta inventando l'avventura e generando la grafica SVG: «" + idea + "»");
    abilitaComandi(false);
    if (window.VistaGrafica) window.VistaGrafica.caricamento("L'AI sta inventando il mondo");

    let bibbia = Motore.nuovaBibbia(idea, nome);
    let fonte = "essenziale";
    let ms = 0;

    if (S.ai) {
      try {
        const r = await AI.bibbia({ idea, nome });
        if (r && r.bibbia) {
          bibbia = Motore.sanificaBibbia(r.bibbia, bibbia);
          if (bibbia.generata) {
            fonte = "ai";
            ms = r.ms || 0;
          }
        }
      } catch (e) {
        /* resta la bozza minima */
      }
    }

    const partita = Motore.creaPartita({ bibbia });
    S.bibbia = partita.bibbia;
    S.stato = partita.stato;
    S.storia = [];

    $("log").innerHTML = "";
    logSistema("«" + S.bibbia.titolo + "»" + (S.bibbia.tono ? " · " + S.bibbia.tono : ""));
    if (S.bibbia.ambientazione) logSistema(S.bibbia.ambientazione);
    if (S.bibbia.obiettivo) logSistema("Obiettivo: " + S.bibbia.obiettivo);
    logSistema(
      fonte === "ai"
        ? "Mondo generato dall'AI in " + ms + " ms; regole e validazione del motore locale."
        : "AI non disponibile: mondo essenziale. Le stanze si apriranno man mano che ti muovi."
    );
    Suoni.nuovaPartita(S.bibbia.tono + " " + S.bibbia.ambientazione);
    logNarrazione(Motore.descriviLuogo(S.stato), true);
    aggiornaHUD();
    aggiornaStatisticheAI();
    abilitaComandi(true);
    document.dispatchEvent(new CustomEvent("partita", { detail: { motivo: "nuova" } }));
    $("comando").focus();
    bottone.disabled = false;
    bottone.textContent = "Inizia l'avventura";
  }

  function abilitaComandi(attivo) {
    $("comando").disabled = !attivo;
    $("btn-agisci").disabled = !attivo;
    document.querySelectorAll("#dpad button, .scorciatoie button").forEach((b) => (b.disabled = !attivo));
  }

  // ------------------------------------------------------- menu Partita
  function apriMenu(apri) {
    const tendina = $("menu-tendina");
    const aperto = apri === undefined ? tendina.hidden : apri;
    tendina.hidden = !aperto;
    $("btn-menu").setAttribute("aria-expanded", String(aperto));
  }

  function applicaRisposta(risposta, comando, latenzaMs) {
    const luogoPrima = S.stato.luogo;
    const esito = Motore.applicaEffetti(S.stato, risposta.effetti);
    const testo = (risposta.narrazione || "").trim() || "Il mondo resta in silenzio, come se aspettasse.";
    Suoni.turno({
      comando,
      narrazione: testo,
      luogoPrima,
      luogoDopo: S.stato.luogo,
      esito,
    });
    logNarrazione(testo, true);
    if (S.stato.luogo !== luogoPrima) logNarrazione(Motore.descriviLuogo(S.stato), true);
    if (esito.cambi.length || esito.rifiutati.length) logEsito(esito.cambi.join(" · "), esito.rifiutati);

    S.storia.push({ comando, narrazione: testo });
    if (S.storia.length > Motore.MAX_STORIA) S.storia = S.storia.slice(-Motore.MAX_STORIA);

    if (latenzaMs) {
      $("latenza").textContent =
        "ultimo turno: " + latenzaMs + " ms · " + (AI.info.modello || "AI");
    }
    aggiornaHUD();
    aggiornaStatisticheAI();
    autosalva();

    // la grafica ascolta questo evento: nessun accoppiamento diretto
    document.dispatchEvent(
      new CustomEvent("turno", {
        detail: {
          luogoPrima,
          luogoDopo: S.stato.luogo,
          narrazione: testo,
          risposta,
          esito,
        },
      })
    );

    if (S.stato.finito) mostraFine();
  }

  function mostraFine() {
    abilitaComandi(false);
    const d = nuovaVoce("fine");
    const p = document.createElement("p");
    p.innerHTML = markdown(
      (S.stato.finito.esito === "sconfitta" ? "**La tua storia finisce qui.** " : "**Fine.** ") +
        (S.stato.finito.testo || "")
    );
    d.appendChild(p);
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Nuova avventura";
    b.className = "primario";
    b.onclick = nuovaPartita;
    d.appendChild(b);
    scorri(true);
  }

  async function esegui(testo) {
    const cmd = String(testo || "").trim();
    if (!S.stato || S.inCorso || S.stato.finito || !cmd) return;
    Suoni.sblocca();
    const mio = ++S.token;
    completaAnimazioni();
    logComando(cmd);
    $("comando").value = "";
    S.inCorso = true;
    abilitaComandi(false);

    // risposta del motore locale: pronta subito, è la rete di sicurezza
    const locale = Motore.comando(cmd, S.stato, S.bibbia);

    if (!S.ai) {
      applicaRisposta(locale, cmd, 0);
      S.inCorso = false;
      if (!S.stato.finito) abilitaComandi(true);
      return;
    }

    const attesa = mostraAttesa();
    const promessa = AI.turno({
      bibbia: Motore.bibbiaCompatta(S.bibbia),
      stato: Motore.statoCompatto(S.stato),
      storia: S.storia.slice(-Motore.MAX_STORIA),
      comando: cmd,
    }).catch(() => null);

    let risposta = null;
    try {
      risposta = await Promise.race([
        promessa,
        new Promise((r) => setTimeout(() => r("lento"), attesaAI())),
      ]);
    } catch (e) {
      risposta = null;
    }
    attesa.remove();
    const turnoPrima = S.stato.turno;
    const valida = risposta && risposta !== "lento" ? Motore.validaRispostaAI(risposta) : null;

    // nel frattempo il giocatore ha già scritto un'altra azione: questa risposta è vecchia
    if (S.token !== mio) {
      attesa.remove();
      S.inCorso = false;
      return;
    }

    if (valida) {
      applicaRisposta(valida, cmd, risposta.ms);
    } else {
      applicaRisposta(locale, cmd, 0);
      const tipo =
        risposta === "lento" ? "l'AI è lenta (" + attesaAI() + " ms)" : "l'AI non ha risposto bene";
      logSistema(tipo + ": ha deciso il motore locale, lo stato è già aggiornato.");
      // se l'AI arriva dopo, aggiunge solo colore: nessun effetto, nessun cambio di stato
      promessa.then((r) => {
        if (
          r &&
          r.fonte === "ai" &&
          r.narrazione &&
          S.token === mio &&
          !S.stato.finito &&
          S.stato.turno === turnoPrima + 1
        ) {
          logDettaglio("(in ritardo, solo colore) " + r.narrazione);
        }
      });
    }

    S.inCorso = false;
    if (!S.stato.finito) {
      abilitaComandi(true);
      $("comando").focus();
    }
  }

  // -------------------------------------------------------- due viste
  function cambiaVista(forza) {
    const grafica = window.VistaGrafica;
    const soloTesto = document.body.classList.toggle("solo-testo", typeof forza === "boolean" ? forza : undefined);
    if (soloTesto) {
      if (grafica) grafica.spegni();
      $("btn-vista").textContent = "Grafica";
    } else {
      if (grafica) grafica.accendi();
      $("btn-vista").textContent = "Solo testo";
    }
  }

  // livello di grafica: vale dai prossimi luoghi/elementi generati
  function impostaLivello(v) {
    const livello = AI.impostaLivello(v);
    document.querySelectorAll("select.sel-grafica").forEach((s) => (s.value = livello));
    cambiaVista(livello === "testo");
    return livello;
  }

  // ---------------------------------------------------- salvataggio
  function autosalva() {
    try {
      localStorage.setItem(
        CHIAVE_SALVATAGGIO,
        JSON.stringify({ salvatoIl: new Date().toISOString(), bibbia: S.bibbia, stato: S.stato, storia: S.storia })
      );
    } catch (e) {
      /* spazio pieno o localStorage bloccato: si continua senza */
    }
  }

  function salva(annuncia) {
    if (!S.stato) return;
    autosalva();
    if (annuncia) logSistema("Partita salvata in questo browser.");
  }

  function carica() {
    let dati;
    try {
      dati = JSON.parse(localStorage.getItem(CHIAVE_SALVATAGGIO) || "null");
    } catch (e) {
      dati = null;
    }
    if (!dati || !dati.stato || !dati.bibbia) {
      alert("Nessuna partita salvata in questo browser.");
      return;
    }
    S.bibbia = dati.bibbia;
    S.stato = dati.stato;
    S.storia = Array.isArray(dati.storia) ? dati.storia : [];
    $("schermata-inizio").hidden = true;
    $("schermata-gioco").hidden = false;
    $("log").innerHTML = "";
    logSistema("Partita ripresa dal salvataggio del " + new Date(dati.salvatoIl).toLocaleString());
    logNarrazione(Motore.descriviLuogo(S.stato), false);
    aggiornaHUD();
    abilitaComandi(!S.stato.finito);
    document.dispatchEvent(new CustomEvent("partita", { detail: { motivo: "caricata" } }));
    if (S.stato.finito) mostraFine();
    $("comando").focus();
  }

  function esporta() {
    if (!S.stato) return;
    const dati = JSON.stringify(
      { versione: Motore.VERSIONE, esportatoIl: new Date().toISOString(), bibbia: S.bibbia, stato: S.stato, storia: S.storia },
      null,
      2
    );
    const blob = new Blob([dati], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "avventura-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    logSistema("Partita esportata come file JSON.");
  }

  function nuovaPartita() {
    if (S.stato && !S.stato.finito && !confirm("Lasciare la partita in corso e ricominciare?")) return;
    S.stato = null;
    S.bibbia = null;
    S.storia = [];
    S.inCorso = false;
    $("schermata-gioco").hidden = true;
    $("schermata-inizio").hidden = false;
    $("log").innerHTML = "";
    $("btn-inizia").disabled = false;
    $("btn-inizia").textContent = "Inizia l'avventura";
    AI.svuotaCache();
    notaInizio();
    $("idea").focus();
  }

  // ------------------------------------------------------------ avvio
  async function init() {
    await AI.inizializza();
    S.ai = Boolean(AI.info.ai);
    mostraBadge();
    notaInizio();
    aggiornaStatisticheAI();
    if (/^https?:$/.test(location.protocol)) setInterval(aggiornaStatisticheAI, 15000);

    $("btn-inizia").onclick = () => {
      Suoni.sblocca();
      iniziaPartita().catch((e) => {
        console.error(e);
        alert("Errore nella creazione del mondo: " + e.message);
        $("btn-inizia").disabled = false;
        $("btn-inizia").textContent = "Inizia l'avventura";
      });
    };

    $("modulo-comando").onsubmit = (e) => {
      e.preventDefault();
      esegui($("comando").value);
    };

    document.querySelectorAll(".scorciatoie button").forEach((b) => {
      b.onclick = () => esegui(b.dataset.comando);
    });

    // dpad per il tocco
    document.querySelectorAll("#dpad button").forEach((b) => {
      b.onclick = () => {
        esegui("vai " + b.dataset.dir);
        $("comando").focus();
      };
    });

    const chkSuoni = $("chk-suoni");
    if (chkSuoni) {
      chkSuoni.onchange = () => Suoni.impostaAttivi(chkSuoni.checked);
    }

    $("btn-vista").onclick = () => cambiaVista();
    document.querySelectorAll("select.sel-grafica").forEach((s) => {
      s.value = AI.livello;
      s.onchange = () => impostaLivello(s.value);
    });
    if (AI.livello === "testo") cambiaVista(true);
    document.addEventListener("keydown", (e) => {
      const attivo = document.activeElement;
      const inCampo = attivo && (attivo.tagName === "INPUT" || attivo.tagName === "TEXTAREA");
      if (inCampo) return;
      if (e.key === "g" || e.key === "G") cambiaVista();
      else if (e.key === "i" || e.key === "I") esegui("inventario");
      else if (e.key === "?") esegui("aiuto");
    });

    $("btn-nuova").onclick = nuovaPartita;
    $("btn-salva").onclick = () => salva(true);
    $("btn-carica").onclick = carica;
    $("btn-esporta").onclick = esporta;

    $("btn-menu").onclick = (e) => {
      e.stopPropagation();
      apriMenu();
    };
    // le voci del menu lo chiudono; l'interruttore suoni no
    document.querySelectorAll("#menu-tendina > button").forEach((b) => b.addEventListener("click", () => apriMenu(false)));
    document.addEventListener("click", (e) => {
      if (!$("menu-partita").contains(e.target)) apriMenu(false);
    });

    document.querySelectorAll(".esempi button").forEach((b) => {
      b.onclick = () => {
        $("idea").value = b.dataset.idea;
        $("idea").focus();
      };
    });

    $("obiettivo").onclick = () => $("obiettivo").classList.toggle("aperto");

    // Invio o "/" fuori dai campi: si torna a scrivere; Esc nel campo: si torna alla scena
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("menu-tendina").hidden) {
        apriMenu(false);
        $("btn-menu").focus();
        return;
      }
      if ($("schermata-gioco").hidden) return;
      const attivo = document.activeElement;
      if (attivo === $("comando")) {
        if (e.key === "Escape") attivo.blur();
        return;
      }
      const inCampo = attivo && (attivo.tagName === "INPUT" || attivo.tagName === "TEXTAREA" || attivo.tagName === "BUTTON");
      if (!inCampo && (e.key === "Enter" || e.key === "/") && !$("comando").disabled) {
        e.preventDefault();
        $("comando").focus();
      }
    });

    // un clic o un tasto completa il testo che si sta scrivendo
    $("log").addEventListener("click", completaAnimazioni);
    document.addEventListener("keydown", (e) => {
      if (e.target.id !== "comando" && e.key !== "Enter") completaAnimazioni();
    });

    window.addEventListener("resize", () => scorri(true));

    // comandi rapidi digitati senza spazi
    $("comando").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        esegui($("comando").value);
      }
    });

    // link condivisibile per chi vuole provare subito: ?idea=...&auto=1
    try {
      const q = new URLSearchParams(location.search);
      const idea = q.get("idea");
      if (idea) {
        $("idea").value = idea.slice(0, 600);
        if (q.get("auto") === "1") {
          $("btn-inizia").click();
          return;
        }
      }
      const nomeQ = q.get("nome");
      if (nomeQ) $("nome").value = nomeQ.slice(0, 30);
    } catch (e) {
      /* niente parametri: pagina normale */
    }

    $("idea").focus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
