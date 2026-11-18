// =====================================================================
// suoni.js - brevi cue sintetizzati con Web Audio, senza file esterni.
// =====================================================================
(function (root) {
  "use strict";

  let audio = null;
  let master = null;
  let attivi = true;
  let sbloccoSegnalato = false;
  let audioNonDisponibile = false;
  let ultimoTonoAtmosfera = "";

  function avvisaAudio(messaggio, errore) {
    if (sbloccoSegnalato) return;
    sbloccoSegnalato = true;
    console.warn("[suoni] " + messaggio, errore ? errore.message : "");
  }

  function contesto() {
    if (audioNonDisponibile) return null;
    const Costruttore = root.AudioContext || root.webkitAudioContext;
    if (!Costruttore) return null;
    if (!audio) {
      try {
        audio = new Costruttore();
        master = audio.createGain();
        master.gain.value = attivi ? 0.16 : 0;
        master.connect(audio.destination);
      } catch (e) {
        audioNonDisponibile = true;
        avvisaAudio("Audio non disponibile:", e);
        return null;
      }
    }
    return audio;
  }

  function sblocca() {
    if (!attivi) return;
    try {
      const ctx = contesto();
      if (!ctx) {
        avvisaAudio("Web Audio non è supportato da questo browser.");
        return;
      }
      if (ctx.state !== "suspended") return;
      const ripresa = ctx.resume();
      if (ripresa && typeof ripresa.catch === "function") {
        ripresa.catch((e) => avvisaAudio("Audio non disponibile:", e));
      }
    } catch (e) {
      avvisaAudio("Audio non disponibile:", e);
    }
  }

  function nota(frequenza, ritardo, durata, forma, volume, finale) {
    if (!attivi) return;
    const ctx = contesto();
    if (!ctx) return;
    const inizio = ctx.currentTime + ritardo;
    const oscillatore = ctx.createOscillator();
    const guadagno = ctx.createGain();
    oscillatore.type = forma;
    oscillatore.frequency.setValueAtTime(frequenza, inizio);
    if (finale) oscillatore.frequency.exponentialRampToValueAtTime(Math.max(1, finale), inizio + durata);
    guadagno.gain.setValueAtTime(0.0001, inizio);
    guadagno.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), inizio + Math.min(0.025, durata / 3));
    guadagno.gain.exponentialRampToValueAtTime(0.0001, inizio + durata);
    oscillatore.connect(guadagno);
    guadagno.connect(master);
    oscillatore.start(inizio);
    oscillatore.stop(inizio + durata + 0.01);
  }

  function fruscio(ritardo, durata, volume, frequenza, tipo) {
    if (!attivi) return;
    const ctx = contesto();
    if (!ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * durata));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const dati = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) dati[i] = (Math.random() * 2 - 1) * (1 - i / n);

    const sorgente = ctx.createBufferSource();
    const filtro = ctx.createBiquadFilter();
    const guadagno = ctx.createGain();
    const inizio = ctx.currentTime + ritardo;
    sorgente.buffer = buffer;
    filtro.type = tipo || "lowpass";
    filtro.frequency.value = frequenza;
    filtro.Q.value = 0.7;
    guadagno.gain.setValueAtTime(0.0001, inizio);
    guadagno.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), inizio + Math.min(0.02, durata / 3));
    guadagno.gain.exponentialRampToValueAtTime(0.0001, inizio + durata);
    sorgente.connect(filtro);
    filtro.connect(guadagno);
    guadagno.connect(master);
    sorgente.start(inizio);
    sorgente.stop(inizio + durata + 0.01);
  }

  function passi() {
    nota(92, 0, 0.12, "sine", 0.18, 54);
    fruscio(0, 0.09, 0.06, 180, "lowpass");
    nota(76, 0.2, 0.13, "sine", 0.14, 48);
    fruscio(0.2, 0.1, 0.05, 160, "lowpass");
  }

  function attacco() {
    nota(230, 0, 0.28, "sawtooth", 0.12, 58);
    fruscio(0, 0.23, 0.12, 900, "lowpass");
  }

  function difesa() {
    nota(760, 0, 0.12, "triangle", 0.12, 390);
    nota(1140, 0.015, 0.16, "sine", 0.07, 820);
  }

  function mistero() {
    nota(392, 0, 0.42, "sine", 0.075);
    nota(587, 0.16, 0.52, "sine", 0.06);
    nota(784, 0.38, 0.62, "sine", 0.045);
  }

  function felicita() {
    [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.095, 0.22, "sine", 0.08));
  }

  function tensione() {
    nota(110, 0, 0.7, "triangle", 0.1, 98);
    nota(116, 0.08, 0.64, "sawtooth", 0.035, 104);
    nota(220, 0.25, 0.35, "sine", 0.04, 207);
  }

  function paura() {
    nota(294, 0, 0.55, "sine", 0.12, 62);
    fruscio(0.04, 0.42, 0.06, 520, "lowpass");
  }

  function tranquillita() {
    nota(261, 0, 0.62, "sine", 0.055);
    nota(392, 0.2, 0.7, "sine", 0.045);
    nota(523, 0.42, 0.8, "sine", 0.035);
  }

  const ATMOSFERE = [
    ["paura", /paur|terr|spavent|angosci|rabbrivid|agghiacc|incubo/],
    ["felicita", /felic|gioi|sorrid|risata|vittoria|trionf|festeg|esult/],
    ["tensione", /pericol|tension|minacci|allarm|ansia|insegu|imminent|urgente/],
    ["mistero", /mister|enigma|segreto|ombra|sussurr|ignoto|inquietant|stran[oa]/],
    ["tranquillita", /calm|pace|tranquill|seren|quiet|placid|ripos/],
  ];

  const SUONI = { mistero, felicita, tensione, paura, tranquillita };

  function atmosfera(testo) {
    const t = String(testo || "").toLowerCase();
    for (const [nome, re] of ATMOSFERE) if (re.test(t)) return nome;
    return "";
  }

  function turno(dati) {
    if (!attivi) return;
    const d = dati || {};
    const comando = String(d.comando || "").toLowerCase();
    const testo = String(d.narrazione || "").toLowerCase();
    const cambi = (d.esito && d.esito.cambi) || [];
    if (d.luogoPrima && d.luogoPrima !== d.luogoDopo) {
      passi();
    } else if (/\b(attacc|colp|pugn|sferz|ferisc|combatt|spara|spar[oa]|calci|mord)/.test(comando)) {
      attacco();
    } else if (/\b(difend|par[oa]|schiv|blocch)/.test(comando) || cambi.some((c) => /^vita -\d/.test(c))) {
      difesa();
    }

    const tono = atmosfera(testo);
    if (tono && tono !== ultimoTonoAtmosfera) SUONI[tono]();
    ultimoTonoAtmosfera = tono;
  }

  function impostaAttivi(valore) {
    attivi = Boolean(valore);
    if (master && audio) master.gain.setTargetAtTime(attivi ? 0.16 : 0, audio.currentTime, 0.025);
  }

  root.Suoni = { sblocca, impostaAttivi, turno, nuovaPartita: (testo) => { ultimoTonoAtmosfera = ""; const tono = atmosfera(testo); if (tono) { SUONI[tono](); ultimoTonoAtmosfera = tono; } } };
})(typeof self !== "undefined" ? self : this);
