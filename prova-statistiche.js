// prova-statistiche.js - conteggio token e stima dei costi senza chiamate AI reali
const assert = require("assert");
const ponte = require("./ponte.js");

ponte.configurazione = () => ({
  costoTokenPerMilione: { input: 0.3, output: 1.2, valuta: "USD" },
});

const { statistiche, registraUso, datiStatistiche } = require("./server.js");

registraUso({ prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 });
assert.strictEqual(statistiche.tokenTotali, 150);
assert.strictEqual(statistiche.tokenIngresso, 120);
assert.strictEqual(statistiche.tokenUscita, 30);
assert.strictEqual(datiStatistiche().costoStimato, 0.000072);

registraUso({ total_tokens: 10 });
assert.strictEqual(statistiche.tokenTotali, 160);
assert.strictEqual(statistiche.tokenSenzaRipartizione, 10);
assert.strictEqual(datiStatistiche().costoStimato, null);

registraUso(null);
assert.strictEqual(statistiche.chiamateSenzaUso, 1);
assert.strictEqual(datiStatistiche().costoStimato, null);

console.log("Statistiche AI: conteggio e stima verificati.");
