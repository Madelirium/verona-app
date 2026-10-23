# Raccolta controllata della linea 24

Aggiornamento del 19 ottobre 2026. Periodo predisposto: **19–25 ottobre 2026**, con date di servizio distinte. Nessun risultato viene esteso automaticamente all'intera stagione.

## Inventario e corse già disponibili

Il piano in [bus-line-24-plan.json](../data/bus-line-24-plan.json) riunisce i codici della mappa e quelli dei dettagli ufficiali già raccolti:

| Fonte | Risultato |
| --- | --- |
| Mappa OSM | 4 varianti, 92 codici distinti |
| Dettagli ufficiali osservati | 78 corse del 19 ottobre, 94 codici distinti |
| Unione dei candidati | 96 codici da considerare |
| Controlli fermata/giorno pianificati | 96 × 7 = 672 |

I dettagli delle 78 corse contengono **3.290 osservazioni di fermata**: non sono 3.290 fermate distinte o altrettante corse. Sono conservati sequenza, codice, coordinate ufficiali, orario programmato e data di servizio. L'ultima fermata è etichettata come **arrivo**, senza presentarla come una nuova partenza. Le occorrenze ripetute della stessa fermata non vengono fuse. Sono osservate anche corse brevi e varianti per Stazione Porta Nuova e Quadrante Europa.

Differenze da mantenere visibili:

- Solo OSM fra i dati osservati: **374** (Via Città di Nimes), **2019** (Stazione Porta Nuova).
- Solo dettagli ufficiali fra i dati osservati: **1993**, **2020**, **2491**, **2502**.

I codici non vengono sostituiti o accorpati per somiglianza del nome. Un codice presente soltanto nella mappa non viene dichiarato inesistente nel servizio; potrebbe semplicemente non comparire nelle corse campionate. Il confronto `code-and-position` richiede stesso codice e distanza entro 150 metri, senza certificare equivalenza dei nomi o attualità di tutte le geometrie OSM.

## Primo lotto eseguito

Il lavoro `2026-10-19T07-37-32.366Z` ha completato due osservazioni fermata/giorno: Santini A 1973 e Santini B 1974 il 19 ottobre. Le ultime scansioni coincidono e i passaggi della linea 24 sono stati confrontati con il dettaglio corsa. Il giorno 20 è iniziato ma resta parziale. **670 controlli fermata/giorno restano da completare**; i dati della settimana non sono pronti per essere presentati come un archivio completo.

Il primo avvio si è arrestato dopo 5 richieste perché la fonte conteneva un passaggio live. Aggiunta la lettura del programmato dal dettaglio corsa, la ripresa ha effettuato 60 nuove richieste, riusando 95 risposte dalla cache, e si è fermata al limite. Il rapporto `networkRequests` descrive l'ultimo avvio, non la somma di tutti gli avvii precedenti. Le date e la provenienza delle risposte salvate rimangono conservate: un dettaglio riutilizzato non viene dichiarato appena scaricato.

Per i passaggi live il bot cerca soltanto `OrarioPartenzaProgrammato` nel dettaglio ufficiale, verificando corsa, linea, destinazione e codice fermata. Se la fermata ricorre più volte, richiede anche un numero di sequenza che renda univoca l'occorrenza. Il tempo originale e la sua natura live sono conservati separatamente. In assenza di un programmato non ambiguo il lavoro si interrompe.

## Comandi

Preparazione offline dal catalogo OSM e dalla cache delle corse:

```powershell
npm run prepare:bus-line -- --line=24 --from=2026-10-19
```

Primo lotto, con un massimo di 60 richieste di rete per avvio:

```powershell
npm run collect:bus-line -- --line=24 --max-requests=60
```

Ripresa del lavoro già eseguito:

```powershell
npm run collect:bus-line -- --line=24 --max-requests=60 --resume=2026-10-19T07-37-32.366Z
```

Il processo non resta in esecuzione al raggiungimento del limite. Per continuare occorre un nuovo avvio esplicito. Il piano viene congelato nel lavoro e il suo hash viene controllato: non rigenerare il piano corrente prima di riprendere un lavoro esistente. Un piano aggiornato richiede una nuova esecuzione.

Risposte, checkpoint e rapporti sono in `research/line-batch/24/ID/`, ignorata da Git. Per ciascuna osservazione sono conservate baseline, verifica, eventuale conferma e confronti dei dettagli. Le scansioni usano cache separate e richieste sequenziali distanziate. Errori HTTP o di rete interrompono il lotto, senza aggiramenti o retry automatici; il limite di richieste è condiviso anche con il download dei dettagli corsa.

## Copertura e limiti

`observed-and-checked` indica che due scansioni finali coincidono e i passaggi osservati della 24 hanno un dettaglio coerente. Non certifica l'assenza di altre corse. `no-line-observed` significa che la 24 non compare nei risultati, senza attestare assenza di servizio: una domenica con passaggi della 96 non viene trasformata in un orario della 24. Gli altri stati mantengono esplicite discordanze e interruzioni.

I dettagli permettono di riusare gli orari di molte fermate scaricando una corsa una sola volta. I controlli pianificati per ciascuna fermata e data servono anche a cercare corse o varianti non ancora intercettate. Restano da completare l'elenco giornaliero, il periodo pianificato e l'integrazione mobile nella mappa dell'app. I file sperimentali non sono caricati dal frontend e non è stata effettuata una pubblicazione su GitHub.
