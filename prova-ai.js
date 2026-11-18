// =====================================================================
// prova-ai.js - controlla chiave e collegamento AI da terminale
//   node prova-ai.js "una città sommersa con le luci accese"
//
// Stampa: bibbia generata + validata, un turno di prova, latenza, token.
// =====================================================================
const ponta = require("./ponte.js");
const M = require("./motore.js");

async function main() {
  const cfg = ponta.configurazione(__dirname);
  console.log("provider:", cfg.provider, "| modello:", cfg.modello, "| jsonMode:", cfg.jsonMode);
  if (!cfg.attivo) {
    console.log("\nAI non configurata.");
    console.log('Metti la chiave in config.json (campo "chiave") oppure nella variabile DEEPSEEK_API_KEY.');
    console.log("Con la chiave configurata: node server.js");
    process.exit(2);
  }

  const idea = process.argv.slice(2).join(" ") || "un bosco di vetro dove gli alberi ricordano";
  const bibbia = M.nuovaBibbia(idea, "Tester");
  const { stato } = M.creaPartita({ bibbia });

  // ---------------------------------------------------------- 1) bibbia
  console.log("\nIDEA:", idea);
  console.log("--- 1/2 bibbia del mondo ---");
  try {
    const r = await ponta.chiedi(ponta.messaggiBibbia({ idea, nome: "Tester" }), {
      cfg,
      timeoutMs: 20000,
      maxTokens: 950,
      temperatura: 0.95,
    });
    console.log("latenza:", r.ms, "ms | token:", r.usage ? r.usage.completion_tokens : "?");
    console.log(JSON.stringify(r.contenutoJSON, null, 2));

    const pulita = M.sanificaBibbia(r.contenutoJSON, bibbia);
    console.log("\n→ dopo la validazione del motore:");
    console.log("  generata:", pulita.generata, "| ambiente:", pulita.ambiente);
    console.log("  luogo:", pulita.luogoInizio && pulita.luogoInizio.nome);
    console.log(
      "  scena iniziale:",
      pulita.scenaIniziale
        ? pulita.scenaIniziale.oggetti.length + " oggetti, " + pulita.scenaIniziale.png.length + " creature"
        : "vuota"
    );
    console.log("  palette:", JSON.stringify(pulita.palette));
  } catch (e) {
    console.log("ERRORE bibbia:", e.message);
    process.exit(1);
  }

  // ----------------------------------------------------------- 2) turno
  console.log("\n--- 2/2 turno di prova ---");
  const comando = "guardo intorno e cerco qualcosa di utile";
  try {
    const r = await ponta.chiedi(
      ponta.messaggiTurno({
        bibbia: M.bibbiaCompatta(bibbia),
        stato: M.statoCompatto(stato),
        storia: [],
        comando,
      }),
      { cfg, timeoutMs: 20000, maxTokens: 700 }
    );
    console.log("latenza:", r.ms, "ms | token:", r.usage ? r.usage.total_tokens : "?");
    const risposta = M.validaRispostaAI(r.contenutoJSON);
    if (!risposta) {
      console.log("\nFORMATO NON VALIDO: il gioco userebbe il simulatore locale.");
      console.log("testo grezzo:", String(r.contenuto || "").slice(0, 400));
      process.exit(1);
    }
    console.log("\nnarrazione:", risposta.narrazione);
    console.log("effetti proposti:", JSON.stringify(risposta.effetti));
    const esito = M.applicaEffetti(stato, risposta.effetti);
    console.log("effetti accettati:", esito.cambi.length ? esito.cambi.join(" · ") : "(nessuno)");
    console.log("effetti rifiutati:", esito.rifiutati.length ? JSON.stringify(esito.rifiutati) : "(nessuno)");
    console.log("\nOK: il turno è valido e il motore lo ha applicato.");
  } catch (e) {
    console.log("ERRORE turno:", e.message);
    process.exit(1);
  }
}

main();
