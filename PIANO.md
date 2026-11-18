# Piano: Avventura Infinita (gioco testuale con AI, poi grafico)

Obiettivo: un'avventura testuale in cui l'utente sceglie all'inizio ambientazione e tipo di gioco
(es. "fantasy tipo Lo Hobbit"), poi si muove e scrive le azioni in linguaggio naturale; un'AI
narra e modifica il mondo in 1-2 secondi, ma il gioco resta solido e giocabile anche senza AI.

Tecnologia:
- HTML + CSS + JS puro per la parte visibile (`index.html`, `stile.css`, `vista_testo.js`).
- `motore.js`: stato del mondo, regole deterministiche, simulatore locale di riserva.
- `server.js`: Node senza dipendenze, serve i file e fa da ponte AI (`/api/nuovo-gioco`, `/api/turno`).
  La chiave sta nel server, mai nel browser (stesso schema già collaudato in `gioco3`).
- Provider predefinito DeepSeek `deepseek-chat` (veloce, economico); altri provider compatibili OpenAI.
- Stato in JSON puro, senza riferimenti al disegno: così la fase grafica si aggiunge come
  seconda "vista" sopra lo stesso motore.

Finito quando:
- `verifica-web` dà ESITO OK: creazione partita, 5 turni, nessun errore JS;
- risposta media per turno < 2,5 s con AI, < 50 ms con simulatore locale;
- l'AI non può rompere il gioco: ogni effetto è validato dal motore (numeri, esistenza di luoghi/oggetti);
- con la chiave mancante o l'AI che sbaglia il formato la partita continua in locale.

## Architettura (chi decide cosa)

Tre strati, con responsabilità separate:

1. `bibbia` — creata una sola volta all'inizio (AI o preset locale): titolo, genere, tono,
   ambientazione, luogo di partenza, personaggi, obiettivo, lessico (armi, magia, tech…).
   Viene compattata in ~200 token e diventa il prefisso fisso del prompt (riusabile in cache).
2. `stato` — la verità del mondo, solo dati: giocatore (vita, energia, inventario, abilità),
   luoghi (id, nome, descrizione breve, uscite, oggetti, x/y sulla mappa), PNG, flag, tempo.
3. `motore` — applica solo operazioni di una lista chiusa (`vai`, `prendi`, `parla`, `danno`,
   `cura`, `crea_oggetto`, `crea_luogo`, `imposta_flag`, `fine`), controlla i prerequisiti,
   tira i dadi dove serve e rifiuta il resto. L'AI non scrive mai nello stato direttamente.

L'AI quindi non è un "game master onnipotente": propone testo + effetti, il motore li esegue.
Questo tiene le regole coerenti, accorcia il prompt e riduce la latenza.

Turno (una sola chiamata):
```
browser: POST /api/turno {bibbiaCompatta, statoCompatto, ultimi 6 scambi, comando}
AI:      {narrazione, effetti:[...], stato?}   (≤ 6 effetti, ≤ 400 token)
motore:  valida → applica → nuova scena + log
```

Latenza (l'"AI veloce" si costruisce, non si spera):
- una chiamata per turno, `max_tokens` basso, `temperature` ~0.8, niente modello "reasoner";
- stato serializzato compatto (nomi brevi, solo ciò che è in scena + inventario + flag attivi);
- finestra di storia limitata (ultimi 6 scambi, riassunto automatico oltre);
- timeout 6 s → la vista mostra subito la risposta del simulatore locale, e se l'AI arriva dopo
  viene aggiunta come riga di dettaglio (nessun blocco, nessun salto di stato);
- cache locale delle azioni ripetute identiche nello stesso luogo ("guardo", "aspetto"…);
- indicatore "il mondo pensa…" + testo a comparsa, così l'attesa percepita è minore.

Fallback locale (`motore.js`): parser di comandi con sinonimi italiani (vai/nord/entra/guarda/
prendi/parla/attacca/inventario/salva), generatore di luoghi con PRNG seedato e frasi
composte dal lessico della bibbia. Sufficiente per giocare, e serve da rete di sicurezza.

## Passi

- [x] 1. Scheletro: `index.html` + `stile.css` + `vista_testo.js`, log narrativo, input comando,
      pannello stato — verifica: 4 turni nel browser, 0 errori JS.
- [x] 2. Modello dati + `motore.js`: bibbia, stato, 6 luoghi, applicatore di effetti, parser locale —
      verifica: `node prova-motore.js` → 35 ok, 0 falliti (40 comandi di fila, nessuno stato rotto).
- [x] 3. Creazione partita: 3 preset + idea libera, bibbia locale rifinita dall'AI prima di generare
      il mondo — verifica: "faro isolato dove le navi scompaiono" → titolo, tono e obiettivo inventati.
- [x] 4. `ponte.js` + `server.js` + `ai.js`: `/api/nuovo-gioco`, `/api/turno`, preset provider,
      `prova-ai.js` — verifica: turno reale valido in 1,8 s, 829 token, effetto accettato.
- [x] 5. Validazione degli effetti + timeout/fallback — verifica: mock lento (sblocco a 6,1 s, nessuna
      sovrapposizione), mock con effetti impossibili (3 scartati su 4), mock HTTP 500 (si gioca in locale).
- [x] 6. Ritmo: testo a comparsa, cache delle azioni veloci (< 5 s), ultimi 6 scambi, mini-mappa,
      latenza nel pannello — verifica: turno 1→4 con AI reale, latenza ~1,7-2 s.
- [x] 7. Persistenza: autosalvataggio, Salva/Carica, export JSON — verifica: salvataggio al turno 3
      ripreso con luogo, obiettivo e comandi abilitati.
- [x] 8. Rifinitura + README + costo — verifica: ESITO OK, costo ~0,0003 $/turno.

### Scelte cambiate rispetto al piano

- Modello: `deepseek-flash` con `thinking: {"type": "disabled"}` (il piano diceva `deepseek-chat`).
  È il più economico e scende da ~3,2 s a ~1,5 s per turno. Vedi README.
- Streaming: non fatto (servirebbe un parser JSON incrementale). Al suo posto: testo a comparsa
  dopo la risposta e riga "in ritardo, solo colore" se l'AI supera i 6 s.
- Cache: solo per risposte arrivate entro 5 s, così una risposta lenta non può essere riusata
  su un comando successivo (bug trovato e corretto con il mock lento).

## Fase 2 (grafica) — piano dettagliato

Principio: **il motore non diventa grafico**. La grafica è una seconda vista che legge lo stesso
`stato`, tramite un modello visivo intermedio. Regole, AI e testi restano identici; il gioco
continua a funzionare in solo testo (tasto `G` per passare da una vista all'altra).

### Cosa compare a schermo

Layout desktop: canvas 960×540 (una stanza = una schermata, vista dall'alto) a sinistra,
pannello con log narrativo + HUD a destra, barra comandi in basso (input testo + porte cliccabili).

- pavimento a tessere da 32 px con pattern del genere; muri sui lati senza uscita; porte/archi
  etichettati nord/sud/est/ovest sulle uscite;
- giocatore: sprite segnaposto disegnato in codice (16×24, 2 frame di camminata, palette del genere);
- oggetti: icona per `tipo` (forziere, cristallo, pergamena, chiave…) con scintillio periodico;
- PNG: sagoma per `persona`, triangolo per `bestia`, barra vita sopra i nemici, fumetto `!` quando parlano;
- nebbia di guerra: i luoghi non visitati restano scuri; la mini-mappa testuale diventa grafica;
- particelle/metro per genere: lucciole (fantasy), pioggia e nebbia (mistero), polvere e scintille (spazio);
- feedback: flash rosso + numero `-1` sul danno, dissolvenza al cambio stanza, piccolo screen shake,
  testo della narrazione che scorre in sincrono con l'animazione.

### Architettura: 4 file nuovi, una modifica piccola

| file | cosa fa |
|---|---|
| `grafica/modello.js` | `modelloVisivo(stato, bibbia)` → scena pura (tessere, oggetti, png, palette, meteo). Nessun disegno: testabile in Node |
| `grafica/disegno.js` | primitive canvas: tessera, porta, sprite per `tipo`, barre. Nessuna immagine esterna: tutto disegnato, così resta offline |
| `grafica/effetti.js` | particelle, tween, dissolvenze, screen shake (mini motore di animazioni, array riusati) |
| `vista_grafica.js` | loop `requestAnimationFrame`, camera, input (frecce/WASD/tap), collegamento a motore e log |
| `motore.js` (modifica) | campi visivi **opzionali** per luogo (`palette`, `props`, `meteo`) con default derivati da genere + hash del nome; `tipo` nei PNG; `Motore.modelloVisivo`; `crea_luogo`/`crea_png` accettano i campi visivi |

Il renderer non legge mai lo stato grezzo: passa da `modelloVisivo`. Se domani lo stato cambia
forma (o arriva un'altra vista), la grafica non si rompe.

### Integrazione senza riscrivere il flusso attuale

Oggi `vista_testo.js` applica la risposta e aggiorna l'HUD. Aggiungo un event bus minimo:

```js
// in vista_testo.js, dopo Motore.applicaEffetti
document.dispatchEvent(new CustomEvent("turno", { detail: { prima, dopo, esito, risposta } }));
```

`vista_grafica.js` ascolta: se `prima.luogo !== dopo.luogo` → dissolvenza + camera nuova;
oggetti/PNG comparsi → comparsa animata; danno → flash. Nessun accoppiamento diretto, e se il
canvas non c'è (browser vecchio, test) resta la vista testuale.

### AI: utile ma non necessaria, e non una chiamata in più per turno

Quando nasce un luogo o un PNG, `crea_luogo`/`crea_png` possono portare `palette` (3 colori),
`props` (max 3 parole da un vocabolario chiuso) e `meteo` (elenco chiuso: nessuno, nebbia,
pioggia, neve, cenere, lucciole). Il motore valida e scarta i valori non ammessi; un `tipo`
sconosciuto viene disegnato con la forma generica. Costo: zero nella maggior parte dei turni.

### Prestazioni

- stanza disegnata una volta su canvas fuori schermo; ridisegno solo se cambia stanza/oggetti (dirty flag);
- nel loop solo giocatore, particelle e testo: target < 4 ms/frame (misurato e mostrato con F3);
- nessuna allocazione per frame, array di particelle riusati, DPR max 2, `imageSmoothingEnabled = false`;
- se il frame scende sotto 40 fps per 2 s, le particelle si riducono da sole.

### Passi, ciascuno con la sua verifica

- [x] 1. `penna.js` (API di disegno), `prospettiva.js` (proiezione), `varianti.js` (aspetto dal nome)
      + test in Node — verifica: `node prova-grafica.js` → 62 ok, 0 falliti; 1000 creature in ~200 ms.
- [x] 2. Canvas statico in prima persona: 6 ambienti (caverna, foresta, sala, corridoio, esterno, nave),
      pavimento in prospettiva, porte cliccabili, nebbia, vignetta — verifica: `verifica-web` con
      `--clic` sul pulsante di avvio → 960×540, 647 colori, cambia nel tempo, 0 errori JS.
- [x] 3. Bestiario: 5 archetipi con prese, 33 parti, 6 ornamenti, varianti (tinta/stato/postura/scala)
      derivate dal nome — verifica: stesse ricette = stesso disegno; 99 occhi → 8; parti inventate scartate.
- [x] 4. Oggetti e creature in scena: icone per tipo (cristallo, forziere, pergamena…), barre vita,
      etichette, evidenziazione di ciò che la narrazione nomina — verifica: clic sull'oggetto →
      comando `esamino` → l'AI risponde e l'oggetto sparisce dalla scena.
- [x] 5. Input: frecce/WASD, clic sulle porte (diventano `vai nord`…), clic sugli elementi,
      tasto `G` per tornare al solo testo — verifica: 4 spostamenti, `luogo` cambia, stato coerente.
- [x] 6. Ricetta visiva dall'AI: `crea_png` porta `aspetto` (archetipo, parti, comportamento,
      modificatori), il motore lo ripulisce con vocabolario chiuso — verifica: vedi `prova-grafica.js`
      sezione 8 e turno reale con "evoco un parassita di vetro con sette occhi".
- [x] 6b. Avvio generato: bibbia completa dall'AI (ambiente, palette, luogo, scena iniziale) e
      mondo che cresce con `crea_luogo` — verifica: partita "torre di ossa" → stanza "Atrio delle
      Mille Mandibole" con 2 oggetti e 2 creature; "vai nord" → "Corridoio delle Costelle Intrecciate"
      con 3 elementi; 44 test motore verdi.
- [x] 7a. Layout a tutto schermo: canvas che segue la finestra (`ResizeObserver`), testo in
      sovrimpressione con sfumatura, pannello di stato e mini-mappa sovrapposti, header trasparente,
      variante compatta per telefono, schermata di attesa durante la generazione — verifica:
      1024×768, 1440×900 e 420×820 senza distorsioni, 0 errori JS.
- [x] 7b. Rifinitura: dpad touch, interruttore effetti, particelle ridotte automaticamente sotto
      40 fps, etichette con piastrina scura, bipede con mantello/cintura/spalline/mani/piedi,
      scorciatoie `i` e `?`, rispetto di `prefers-reduced-motion`.
- [x] 7c. Creature: sagome controluce con occhi luminosi, quadrupedi/insettoidi ridisegnati
      (muso, orecchie, zampe articolate, addome, antenne); etichette protette dal dpad su schermi
      stretti; meteo scelto dall'AI e validato dal motore.
- [ ] 7d. Restano: lo stile resta "vettoriale piatto" — per illustrazioni più ricche servirebbe un
      generatore di immagini (opt-in, con cache), oppure ancora lavoro sulle proporzioni.
- [ ] 8. Documentazione e screenshot finali; eventuali sfondi dipinti dall'AI in cache (facoltativo).

### Avventura generata, non preconfezionata (cambiamento richiesto)

- Via i 3 preset e i generi statici: la partita nasce da una descrizione libera e da **una chiamata
  all'avvio** che inventa bibbia completa (ambiente, palette, luogo, oggetti, creature).
- Il motore valida tutto (`sanificaBibbia`): niente colori inventati, niente liste infinite, `aspetto`
  ripulito; se manca qualcosa la partita parte con valori di ripiego.
- Il mondo non è più generato in anticipo: la stanza iniziale è l'unica, le altre nascono con
  `crea_luogo` (nome, ambiente, scena, `entra: true`) quando il giocatore si muove.
- Ripiego locale ridotto all'osso: se l'AI manca, si apre un "passaggio a nord/sud/…" neutro.

### Formato visivo unico (richiesta)

L'AI restituisce per ogni creatura la stessa ricetta (`aspetto`: archetipo, 9 campi di parti,
comportamento, 4 modificatori). `Motore.completaAspetto` la valida e la **completa sempre**: valori
fuori elenco scartati, limiti numerici, campi mancanti riempiti con il ripiego dedotto dal nome.
La ricetta completa è salvata nello stato, quindi il motore SVG riceve sempre la stessa struttura.
Test: 200 ricette casuali → struttura identica, 48 test motore verdi.

### Fatto rispetto al piano
- Le sagome non sono 14 famiglie fisse ma **5 scheletri + 33 parti + varianti**: più varietà con meno codice.
- L'aspetto è **derivato dal nome** (hash): la stessa creatura è identica ovunque e dopo un salvataggio.
- La scena **si compone**: ambiente + oggetti + creature + atmosfera, con ordinamento per profondità.
- La stanza statica è disegnata una volta su un canvas fuori schermo: nel loop è un `drawImage`.

### Prossimi passi consigliati
1. Proporzioni e dettaglio delle sagome (bipede su tutte), ombre più morbide, luci colorate per stanza.
2. Dpad per tablet e tap prolungato per "esamina".
3. Sfondi: ricetta di ambiente dall'AI (cielo, orizzonte, vegetazione) prima di pensare a immagini generate.
4. Suoni per ambiente e per evento (danno, raccolta) — piccoli campioni o sintesi WebAudio.

### Cosa non faccio in questa fase

- immagini o sprite generati dall'AI, asset esterni, audio;
- vista isometrica, 3D, illuminazione dinamica;
- combattimento a griglia (resta "scrivi l'azione");
- editor di livelli.

### Tre decisioni da prendere prima del passo 2

1. **Stile**: A) vettoriale pulito (forme morbide, palette per genere) o B) pixel art 16×16?
   Proposta: **A**, si sposa meglio con il testo e si fa in metà tempo.
2. **Scala**: una stanza = una schermata (proposta) o mappa unica scorrevole con più stanze visibili?
3. **Testo**: sempre visibile accanto alla mappa (proposta) o a comparsa sopra il canvas?

## Non faccio (per ora)

- multiplayer, audio, combattimento tattico a turni con griglia;
- immagini generate (sprite disegnati o segnaposto colorati);
- editing manuale del mondo dall'utente.

## Domande aperte

1. Lingua: italiano fisso o selezionabile? (proposta: italiano, con campo lingua nella bibbia)
2. Il giocatore può morire? (proposta: sì, ma con "ultima possibilità" e ripartenza dal luogo)
3. Vuoi il costo stimato per partita mostrato nel README? (proposta: sì, ~1 centesimo per 100 turni)
