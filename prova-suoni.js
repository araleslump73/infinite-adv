"use strict";

const assert = require("node:assert/strict");

function parametro() {
  return {
    value: 0,
    setValueAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.value = v; },
  };
}

class AudioFinto {
  constructor() {
    AudioFinto.ultimo = this;
    this.state = "suspended";
    this.currentTime = 0;
    this.sampleRate = 1000;
    this.destination = {};
    this.toni = [];
  }
  resume() { this.state = "running"; return Promise.resolve(); }
  createGain() { return { gain: parametro(), connect() {} }; }
  createOscillator() {
    const o = { frequency: parametro(), connect() {}, start() {}, stop() {} };
    this.toni.push(o);
    return o;
  }
  createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
  createBuffer(_canali, campioni) {
    const dati = new Float32Array(campioni);
    return { getChannelData: () => dati };
  }
  createBiquadFilter() { return { frequency: parametro(), Q: parametro(), connect() {} }; }
}

const ambiente = { AudioContext: AudioFinto };
global.self = ambiente;
require("./suoni.js");
const suoni = ambiente.Suoni;

suoni.sblocca();
const audio = AudioFinto.ultimo;
assert.equal(audio.state, "running", "sblocca l'audio dopo un gesto dell'utente");

suoni.nuovaPartita("Un sentiero tranquillo");
assert.equal(audio.toni.length, 3, "riproduce il cue di tranquillità");

suoni.turno({
  comando: "vai nord",
  narrazione: "Il sentiero resta tranquillo.",
  luogoPrima: "bosco",
  luogoDopo: "radura",
  esito: { cambi: [] },
});
assert.equal(audio.toni.length, 5, "un cambio di luogo riproduce passi senza ripetere l'atmosfera");

suoni.turno({
  comando: "attacco il mostro",
  narrazione: "La creatura arretra.",
  luogoPrima: "radura",
  luogoDopo: "radura",
  esito: { cambi: [] },
});
assert.equal(audio.toni.length, 6, "un comando d'attacco riproduce il cue d'attacco");

suoni.impostaAttivi(false);
suoni.turno({
  comando: "vai est",
  narrazione: "Un'ombra ti spaventa.",
  luogoPrima: "radura",
  luogoDopo: "grotta",
  esito: { cambi: [] },
});
assert.equal(audio.toni.length, 6, "l'interruttore disattiva i suoni");

suoni.impostaAttivi(true);
suoni.turno({
  comando: "aspetto",
  narrazione: "Un'ombra ti spaventa.",
  luogoPrima: "grotta",
  luogoDopo: "grotta",
  esito: { cambi: [] },
});
assert.equal(audio.toni.length, 7, "riconosce e riproduce un cue di paura");

console.log("prove suoni: 6 superate");
