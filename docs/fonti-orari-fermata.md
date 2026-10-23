# Orari ATV per singola fermata: verifica del 18 ottobre 2026

Il sito ATV rimanda al portale pubblico Ticket Bus Verona/myCicero per consultare orari e percorsi con tutte le fermate. La Carta della mobilità ATV conferma anche la consultazione dei transiti tramite QR code alle fermate.

## Caso verificato: Via Santini

Nel portale, cercando Verona e Santini, sono presenti due fermate distinte: VIA SANTINI A, codice 1973, e VIA SANTINI B, codice 1974. Il codice 1974 corrisponde al riferimento della fermata OSM esaminata sulla linea 24.

Pagina diretta osservata aprendo “Mostra tutti i passaggi”: [VIA SANTINI B 1974](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops/1974?systemId=OTP_NE&businessCode=ATV).

Selezionando nel calendario **19/10/2026**, ora **00:00**, linea **24**, il portale mostra fra i primi passaggi **05:30, 05:50, 06:10, 06:26, 06:48, 07:08, 07:28, 07:38, 07:48**, destinazione **PIAZZA RIGHETTI, Verona**. Sono esempi di orari programmati per quella data, non una tabella completa né dati validi per ogni giorno. La pagina al 18/10/2026 mostra invece la linea festiva 96: il giorno di servizio è determinante.

Verifica effettuata nell'interfaccia pubblica, senza accesso a un account. Screenshot locale ignorato da Git: `research/santini-1974-orari-ufficiali.png`. La data e la linea sono selezioni dell'interfaccia e non sono codificate nel collegamento diretto.

## Conseguenza per l'app

I PDF già importati non consentono di completare da soli tutti gli orari per fermata. Il portale contiene gli orari mancanti ed espone un collegamento diretto alla fermata verificata. Questa verifica non costituisce ancora un'importazione nell'app, né dimostra che esista un feed aperto o un'API documentata e autorizzata al riutilizzo massivo. Un eventuale importatore deve verificare accesso, formato, aggiornamento, condizioni di riutilizzo e associazione di codici, direzioni e calendari prima di estendere il risultato ad altre fermate. Nessuna stima fra fermate intermedie è stata usata.

Fonti: [portale ATV](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops), [Carta della mobilità ATV](https://www.atv.verona.it/flex/cm/pages/ServeAttachment.php/L/IT/D/1%252Fc%252F0%252FD.76bba50e109ae87c245b/P/BLOB%3AID%3D161/E/pdf?mode=inline).

## Prova di estrazione ripetibile

Il client pubblico carica gli orari con `GetArriviPartenzePalina2`, tramite il proxy myCicero. Il dettaglio richiede una finestra di 8 ore e configura un massimo di 20 risultati. Questi sono parametri del client osservato, non una garanzia documentata di copertura del servizio.

Comandi locali:

```powershell
node scripts/inspect-bus-stop-source.mjs
node scripts/inspect-bus-stop-source.mjs --probe
```

Il primo comando censisce i codici nelle mappe locali senza rete. Il secondo esegue **una sola richiesta** di calibrazione su Santini 1974 il 19 ottobre 2026, dalle 00:00 alle 08:00. Il rapporto è salvato in `research/bus-stop-extraction-report.json`, ignorato da Git; non sostituisce alcun dato dell'app. Il campione è datato e dovrà essere aggiornato con una nuova verifica dell'interfaccia se il servizio non conserva quella data.

Inventario del 18 ottobre: 121 varianti, 30 linee, 4.965 occorrenze, **1.155 codici numerici distinti**, una occorrenza senza codice numerico e un codice riferito a più oggetti OSM. Sono candidati: nessun abbinamento OSM/ATV viene dichiarato verificato dal solo codice. Questo inventario non copre necessariamente tutte le fermate urbane ed extraurbane.

La prova diretta ha restituito inizialmente risposte HTTP 200 senza passaggi e, successivamente, due passaggi programmati della linea 24, alle **07:38:41 e 07:48:41**, con destinazione Piazza Righetti, identificativi corsa e coordinate della fermata. Non riproduce i nove passaggi del campione dell'interfaccia. Anche il cambio d'ora nel portale non ha prodotto una lista visibilmente aggiornata. La causa della discrepanza non è stata individuata: **estrazione completa non convalidata**. Il comando termina con un errore se il campione non corrisponde, senza avviare altre richieste.

## Procedura per passare alla raccolta completa

1. Riprodurre un campione corrente del portale, verificando giorno, fermata, linea, destinazione e natura programmata del dato; confrontare anche una finestra successiva.
2. Verificare nome e coordinate dei codici candidati nell'anagrafica ufficiale, conservando conflitti e mancati abbinamenti. Per l'intera rete serve un elenco ufficiale completo, non il solo catalogo delle mappe attuali.
3. Raccogliere per **data di servizio**, coprendo tutta la giornata in Europe/Rome, compresi cambio d'ora e corse oltre mezzanotte. Un lunedì non rappresenta automaticamente tutti i feriali: vacanze scolastiche, festività ed eccezioni devono rimanere distinguibili.
4. Suddividere le finestre che raggiungono il limite di risultati, con sovrapposizione ai confini e deduplicazione tramite fermata, corsa e istante. Un intervallo ancora saturo alla risoluzione minima rimane incompleto; una risposta vuota non certifica da sola assenza di servizio.
5. Limitare frequenza e volume, conservare fonte, risposta originale, data di raccolta e rapporto di copertura. Interrompere su errori o limitazioni, senza sostituire i dati validi precedenti con una raccolta parziale.
6. Prima di una distribuzione estesa verificare disponibilità di un feed GTFS/NeTEx e condizioni di riutilizzo con ATV/gestore. Il fatto che il client sia pubblico non dimostra una licenza di redistribuzione massiva.

Solo dopo questi controlli va collegato un nuovo dataset alle fermate nell'app. Gli orari ricavati dai PDF restano disponibili e non vengono interpolati per riempire i punti mancanti.

## Aggiornamento: prova su una giornata

La prova successiva ha raccolto 40 passaggi del 19 ottobre per Santini 1974, includendo tutti i nove orari del campione. Una seconda scansione su finestre di quattro ore ha restituito le stesse corse. È quindi superata la precedente mancata riproduzione del campione in questa esecuzione, senza aver accertato la causa delle risposte iniziali parziali. Il confronto visivo integrale e la copertura di altre date restano da convalidare. Risultati, limiti e comandi sono in [prova-bot-santini.md](prova-bot-santini.md).

## Aggiornamento: festivo e direzione opposta

La [verifica estesa](verifica-bot-atv.md) aggiunge 38 passaggi di Santini A 1973 il 19 ottobre e 28 passaggi festivi della linea 96 a Santini B il 25 ottobre, gestendo la giornata di 25 ore. In entrambi i casi sono servite tre scansioni perché la prima aveva omesso alcune corse. Le ultime due coincidono; il confronto visivo integrale rimane da completare. I dati sono salvati come prove sperimentali, senza sostituire gli orari nell'app.
