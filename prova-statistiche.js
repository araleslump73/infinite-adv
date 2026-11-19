// prova-statistiche.js - conteggio token e stima dei costi senza chiamate AI reali
const assert = require("assert");
const ponte = require("./ponte.js");

ponte.configurazione = () => ({
  costoTokenPerMilione: { input: 0.3, output: 1.2, valuta: "USD" },
});

const { server: serverHttp, statistiche, registraUso, datiStatistiche } = require("./server.js");

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

const prezziCache = { input: 0.3, inputCache: 0.006, output: 1.2, valuta: "USD" };
{
  const s = ponte.nuoveStatistiche();
  ponte.registraUso(s, {
    prompt_tokens: 1000, completion_tokens: 100,
    prompt_cache_hit_tokens: 800, prompt_cache_miss_tokens: 200,
  });
  let r = ponte.riepilogoStatistiche(s, prezziCache);
  assert.strictEqual(r.tokenTotali, 1100);
  assert.strictEqual(r.tokenIngressoCacheHit, 800);
  assert.strictEqual(r.tokenIngressoCacheMiss, 200);
  assert.strictEqual(r.tokenIngressoCacheNonRilevata, 0);
  assert.ok(Math.abs(r.costoStimato - 0.0001848) < 1e-12);
  assert.strictEqual(r.costoStimatoSenzaCache, 0.00042);
  assert.strictEqual(r.cacheScontata, true);

  ponte.registraUso(s, {
    prompt_tokens: 100, completion_tokens: 10,
    prompt_tokens_details: { cached_tokens: 60 },
  });
  r = ponte.riepilogoStatistiche(s, prezziCache);
  assert.strictEqual(r.tokenIngressoCacheHit, 860);
  assert.strictEqual(r.tokenIngressoCacheMiss, 240);
  assert.strictEqual(r.tokenIngressoCacheNonRilevata, 0);

  for (const dettagli of [
    { prompt_cache_hit_tokens: 90, prompt_cache_miss_tokens: 30 },
    { prompt_cache_hit_tokens: -1, prompt_cache_miss_tokens: 101 },
    { prompt_tokens_details: { cached_tokens: 101 } },
    {},
  ]) {
    ponte.registraUso(s, { prompt_tokens: 100, completion_tokens: 10, ...dettagli });
  }
  r = ponte.riepilogoStatistiche(s, prezziCache);
  assert.strictEqual(r.tokenIngressoCacheHit, 860);
  assert.strictEqual(r.tokenIngressoCacheNonRilevata, 400);
  assert.ok(Math.abs(r.costoStimato - ((1500 - 860) * 0.3 + 860 * 0.006 + 150 * 1.2) / 1e6) < 1e-12);

  const senzaPrezzoCache = ponte.riepilogoStatistiche(s, { input: 0.3, output: 1.2 });
  assert.strictEqual(senzaPrezzoCache.costoStimato, senzaPrezzoCache.costoStimatoSenzaCache);
  assert.strictEqual(senzaPrezzoCache.cacheScontata, false);
}
{
  const precedente = {
    chiamate: 1, errori: 0, msTotale: 12, tokenTotali: 120,
    tokenIngresso: 100, tokenUscita: 20, tokenSenzaRipartizione: 0, chiamateSenzaUso: 0,
  };
  ponte.registraUso(precedente, {
    prompt_tokens: 100, completion_tokens: 20,
    prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 20,
  });
  const r = ponte.riepilogoStatistiche(precedente, prezziCache);
  assert.strictEqual(r.tokenTotali, 240);
  assert.strictEqual(r.tokenIngressoCacheNonRilevata, 100);
  assert.ok(Math.abs(r.costoStimato - (120 * 0.3 + 80 * 0.006 + 40 * 1.2) / 1e6) < 1e-12);
}
{
  const s = ponte.nuoveStatistiche();
  ponte.registraUso(s, { total_tokens: 10, prompt_cache_hit_tokens: 8, prompt_cache_miss_tokens: 2 });
  assert.strictEqual(ponte.riepilogoStatistiche(s, prezziCache).costoStimato, null);
}
console.log("Cache provider: DeepSeek/OpenAI, dati mancanti o incoerenti e conteggi precedenti verificati.");

async function verificaCacheBrowser() {
  const fs = require("fs");
  const vm = require("vm");
  let chiamate = 0;
  const contesto = vm.createContext({
    console, AbortController, setTimeout, clearTimeout,
    performance: { now: () => 0 },
    fetch: async (url) => {
      chiamate++;
      return {
        ok: true,
        json: async () =>
          String(url).includes("svg-oggetto")
            ? { fonte: "ai", svg: "<svg viewBox='0 0 100 100'></svg>" }
            : { fonte: "ai", narrazione: "La scena non cambia.", effetti: [] },
      };
    },
  });
  vm.runInContext(fs.readFileSync(require.resolve("./ai.js"), "utf8"), contesto);
  const AI = contesto.AI;
  AI.info.ai = true;
  const dati = {
    comando: "leggo ABC",
    bibbia: { titolo: "Faro", obiettivo: "Trova la nave" },
    stato: { turno: 1, luogo: { id: "l0", atmosfera: { luce: 0.5 }, uscite: [] }, flag: [] },
    storia: [],
  };
  await AI.turno(dati);
  assert.strictEqual((await AI.turno(dati)).daCache, true);
  assert.strictEqual(chiamate, 1);
  const varianti = [
    (d) => { d.bibbia.obiettivo = "Salva il guardiano"; },
    (d) => { d.stato.turno++; },
    (d) => { d.stato.flag.push("obiettivoRaggiunto"); },
    (d) => { d.stato.luogo.atmosfera.luce = 0.1; },
    (d) => { d.stato.luogo.uscite.push("nord"); },
    (d) => { d.storia.push({ comando: "parlo", narrazione: "Il codice e' ABC." }); },
    (d) => { d.comando = "leggo abc"; },
  ];
  for (const cambia of varianti) {
    const variante = JSON.parse(JSON.stringify(dati));
    cambia(variante);
    const r = await AI.turno(variante);
    assert.notStrictEqual(r.daCache, true);
  }
  assert.strictEqual(chiamate, 1 + varianti.length);
  const svg = await AI.svgOggetto({ nome: "chiave", descrizione: "Di bronzo.", livello: "avanzata" });
  assert.strictEqual(svg.svg, "<svg viewBox='0 0 100 100'></svg>");
  assert.strictEqual(chiamate, 2 + varianti.length);
  console.log("Cache browser: riuso solo con bibbia, stato, cronologia e azione identici.");
}

async function verificaGenerazioneSvgPonte() {
  const fetchOriginale = global.fetch;
  global.fetch = async (url, richiesta) => {
    assert.ok(String(url).endsWith("/chat/completions"));
    const body = JSON.parse(richiesta.body);
    assert.strictEqual(body.max_tokens, 3000);
    assert.ok(body.messages[0].content.includes("0 0 100 100"));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ svg: "<svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='8'/></svg>" }) } }],
          usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
        }),
    };
  };
  try {
    const esito = await ponte.generaSvgOggetto(
      { livello: "avanzata", nome: "chiave", descrizione: "Di bronzo." },
      { attivo: true, baseUrl: "https://example.test/v1", modello: "test", jsonMode: true, temperatura: 0.7, chiave: "test" }
    );
    assert.strictEqual(esito.errore, false);
    assert.strictEqual(esito.risposta.fonte, "ai");
    assert.strictEqual(esito.chiamata.usage.total_tokens, 200);
  } finally {
    global.fetch = fetchOriginale;
  }

  const configOriginale = ponte.configurazione;
  const generaOriginale = ponte.generaSvgOggetto;
  ponte.configurazione = () => ({ attivo: true });
  ponte.generaSvgOggetto = async () => ({
    chiamata: { ms: 5, usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } },
    errore: false,
    risposta: { fonte: "ai", svg: "<svg viewBox='0 0 100 100'></svg>" },
  });
  try {
    const chiamatePrima = statistiche.chiamate;
    await new Promise((resolve) => serverHttp.listen(0, "127.0.0.1", resolve));
    const porta = serverHttp.address().port;
    const rispostaHttp = await fetch(`http://127.0.0.1:${porta}/api/svg-oggetto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ livello: "avanzata", nome: "chiave" }),
    });
    const risposta = await rispostaHttp.json();
    await new Promise((resolve, reject) => serverHttp.close((errore) => errore ? reject(errore) : resolve()));
    assert.strictEqual(risposta.fonte, "ai");
    assert.strictEqual(statistiche.chiamate, chiamatePrima + 1);
  } finally {
    if (serverHttp.listening) {
      serverHttp.closeAllConnections();
      await new Promise((resolve) => serverHttp.close(resolve));
    }
    ponte.configurazione = configOriginale;
    ponte.generaSvgOggetto = generaOriginale;
  }
  console.log("Generazione SVG differita: formato, endpoint browser, usage e statistiche server verificati.");
}

verificaCacheBrowser().then(verificaGenerazioneSvgPonte).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
