# Bot ATV: salvataggio, ripresa e riuso delle corse

Aggiornamento del 19 ottobre 2026. Questi comandi sono manuali: non avviano un servizio continuo e non pubblicano dati nell'app.

## Raccolta per fermata

```powershell
node scripts/collect-bus-stop-day.mjs --stop=1974 --date=2026-10-19 --verify
```

Il comando stampa `runId` e salva il lavoro in `research/stop-days/CODICE/DATA/ID/`. Per riprenderlo, ripetere gli stessi parametri aggiungendo `--resume=ID`, sostituendo ID con quello stampato. Anche l'opzione `--verify` deve corrispondere all'esecuzione originale.

Ogni risposta valida viene salvata subito in una cache locale. Se il processo si interrompe durante una scansione, ripetendola il bot legge le finestre già salvate e richiede quelle mancanti. Le fasi completate sono registrate nel checkpoint e non vengono rieseguite. Un processo interrotto lascia un blocco recuperabile quando il relativo processo non esiste più; un lavoro ancora in esecuzione non può essere aperto una seconda volta.

Baseline, verifica e conferma hanno cache separate: il confronto a quattro ore non riusa le risposte della scansione a otto ore. Le richieste di rete restano sequenziali e distanziate; quelle lette dal disco non richiedono attese. Il rapporto indica `networkRequests`, `cacheHits` e se si tratta di una ripresa.

La ripresa ricostruisce lo stesso esperimento e conserva anche risposte vuote formalmente valide. Per interrogare nuovamente la fonte dopo risposte parziali o variazioni del servizio, avviare una nuova esecuzione senza `--resume`; riprendere quella precedente non trasforma i dati salvati in dati aggiornati.

## Verifica delle corse

```powershell
node scripts/verify-bus-stop-trips.mjs research/trip-check/manifest.json
```

Il manifest elenca passaggi già raccolti e relativi codici del capolinea. La cache dei dettagli è condivisa in `.local/atv-bot/trips-v1/`, con chiavi distinte per giorno di servizio, identificativo corsa, parametri della richiesta e versione del client. Una risposta contiene tutte le fermate della corsa: viene riutilizzata per i passaggi della stessa corsa con gli stessi parametri. Date o capolinea diversi restano separati.

Il comando ricalcola il confronto per ciascun passaggio; i soli esiti già corrispondenti vengono registrati come completati. Per riprendere, usare lo stesso manifest e `--resume=ID` con l'identificativo stampato. Cambiare il manifest, il suo ordine o i parametri di un lavoro esistente viene rifiutato.

Per aggiornare le risposte dalla fonte:

```powershell
node scripts/verify-bus-stop-trips.mjs research/trip-check/manifest.json --fresh
```

`--fresh` crea una nuova verifica e aggiorna ciascun dettaglio necessario una volta. Anche un lavoro iniziato con `--fresh` può essere ripreso: usare soltanto `--resume=ID`; il checkpoint conserva l'impostazione originale e la data di avvio. Non aggiungere `--fresh` al comando di ripresa. I dettagli già aggiornati durante quel lavoro possono essere riutilizzati.

Un confronto letto dalla cache conferma la coerenza con lo snapshot salvato, non un nuovo controllo della fonte. I contatori separano rete, cache e risultati recuperati dal checkpoint.

## Riutilizzare le risposte delle prove precedenti

```powershell
node scripts/import-bus-trip-cache.mjs research/trip-check/manifest.json research/trip-check/2026-10-18T16-04-22.363Z/report.json
```

L'importazione ricontrolla ciascuna risposta originale `response-N.json` rispetto al manifest e al rapporto precedente. Conserva data originaria, provenienza e impronta del contenuto; non spaccia lo snapshot precedente per una nuova raccolta. Una risposta più vecchia non sostituisce una cache più recente. Non effettua richieste di rete.

## Protezioni

- Salvataggi JSON tramite file temporaneo e rinomina, per mantenere il precedente file se la scrittura fallisce.
- Blocco del singolo lavoro contro avvii concorrenti e controllo dei parametri alla ripresa.
- Hash dei contenuti per rilevare file alterati o danneggiati. Errori di cache espliciti, senza sostituzioni silenziose.
- Errori HTTP, di rete o risposte applicative non valide non vengono messi in cache come dati riusciti. Gli errori HTTP fermano il processo; nessun aggiramento o retry di rete automatico.
- Il token pubblico generato dal portale è usato nella richiesta ma non viene conservato nelle chiavi o nei metadati della cache.
- I dati già pubblicati nell'app non vengono modificati da questi comandi. La completezza degli elenchi giornalieri rimane una verifica separata.

## Prove eseguite

Sono state importate 106 risposte reali già scaricate il 18 ottobre. Il nuovo verificatore ha confrontato 106 passaggi su 106 con **zero richieste di rete**; riprendendo quel lavoro ha recuperato tutti i 106 esiti dal checkpoint, ancora senza rete. È stata verificata anche la ripresa della raccolta Santini B, riutilizzando le due scansioni reali già salvate: 40 passaggi, zero nuove richieste.

I test automatici simulano un'interruzione tra richieste, controllano la ripresa delle sole parti mancanti, verificano due fermate usando un unico dettaglio corsa e coprono cache danneggiate, errori HTTP, aggiornamento esplicito e manifest discordanti. L'intera suite comprende **140 test superati**. Queste prove del salvataggio non costituiscono una nuova raccolta dal portale e non estendono il campione a tutta la linea 24.
