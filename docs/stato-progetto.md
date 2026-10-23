> Aggiornamento 19 ottobre: [orari ufficiali integrati nella prova locale](orari-ufficiali-app.md) per tutte le 141 linee. Le indicazioni precedenti sull’integrazione ancora da fare descrivono lo stato storico. Nessuna nuova pubblicazione su GitHub.

# Verona — stato del progetto

Aggiornamento del **19 ottobre 2026**. Questo documento riepiloga lo stato del workspace locale; non certifica una nuova pubblicazione online.

**Nuova fonte prioritaria:** è stato trovato e scaricato un [archivio ufficiale ATV NeTEx tramite NAP/CCISS](feed-atv.md), pubblicato il 18 ottobre e con validità dichiarata 18 ottobre–17 novembre. Contiene 141 linee, 4.303 fermate e 6.360 definizioni di corsa. Prima di proseguire con altri lotti per fermata, verificare l'importazione di questo archivio e confrontarla con i campioni raccolti. Le prove del bot descritte sotto rimangono valide come verifiche dei campioni, non come unica strada di acquisizione dei dati.

**Verifica NeTEx riuscita:** [calendari e confronto dei campioni](verifica-netex-atv.md) completati offline. I tre elenchi restituiscono gli stessi 106 passaggi; la 24 ha 87 corse programmate per ciascun feriale del 19–23 ottobre, 59 il 24 e nessuna il 25 secondo il file. Nove corse feriali non attraversano Santini, spiegando il limite del precedente campione di 78 corse. Passano anche 8 nuovi test Python specifici del verificatore. Il prossimo sviluppo prioritario è l'esportazione NeTEx nel formato dell'app e la consultazione per data, invece di proseguire il lotto da 672 interrogazioni pianificate.

## Prodotto e scelte confermate

Assistente locale per residenti e visitatori di Verona, con esperienza mobile first: guscio alto quanto il viewport (`100dvh`), navigazione inferiore sempre visibile, contenuti che scorrono internamente e dettagli/filtri in modali. La Home mantiene la dashboard dei servizi preferita dall'utente. Palette pietra, blu e accenti giallo/oro; calendario bianco.

Sono presenti Eventi, Notizie e Comune, Autobus, Esplora, Il mio quartiere e accesso esterno ai Permessi ZTL. La funzione Persone/compagnia per attività è rimandata.

## Funzioni disponibili nel progetto locale

| Sezione | Funzioni e dati presenti | Limiti principali |
| --- | --- | --- |
| Eventi | 951 appuntamenti locali importati, scoperta tramite swipe e pulsanti, calendario, salvati, conferma personale della presenza, immagini e mappa | Luoghi e disponibilità dipendono dalle fonti; confermare la presenza nell'app non è una prenotazione |
| Notizie e Comune | 61 pubblicazioni importate, ricerca, filtri, immagini quando disponibili, salvati e collegamenti alle fonti | Raccolta recente, non archivio completo; validità degli avvisi non dedotta dalla data di pubblicazione |
| Autobus | 38 schede orarie stagionali estratte dai PDF, preferiti, avvisi ATV e mappe OSM per 30 schede con 121 varianti | Il PDF non elenca tutte le fermate; abbinamenti ambigui non ricevono orari automaticamente; nessun arrivo in tempo reale |
| Esplora | Mappa e lista di 1.480 punti OSM, categorie, ricerca, preferiti, dettagli e indicazioni | Copertura limitata al centro e alle zone vicine; non rappresenta tutte le attività di Verona o provincia |
| Il mio quartiere | Scelta di quartiere/circoscrizione, notizie ed eventi associati, preferenza conservata nel browser | Associazioni testuali potenzialmente incomplete; nessun social dei residenti attivo |
| Permessi ZTL | Collegamento al portale ufficiale e informazioni utili | Pratiche e accesso avvengono sul servizio esterno |

I salvati sono locali al browser: non è presente una sincronizzazione fra dispositivi. La posizione sulle mappe viene richiesta soltanto su azione dell'utente; su telefono richiede un contesto sicuro, normalmente HTTPS. Le tessere cartografiche richiedono connessione.

## Bot per gli orari delle singole fermate

Il metodo è stato provato su due fermate e due date:

| Fermata | Giorno di servizio | Linea | Passaggi raccolti e confermati nel dettaglio corsa |
| --- | --- | --- | --- |
| Santini B, 1974 | 19 ottobre 2026 | 24 | 40 |
| Santini A, 1973 | 19 ottobre 2026 | 24 | 38 |
| Santini B, 1974 | 25 ottobre 2026 | 96 | 28 |

**106 passaggi su 106 coincidono** con il dettaglio ufficiale per identificativo corsa, linea, fermata, destinazione e istante programmato, compresi i secondi. Le scansioni finali ripetute coincidono. È gestita anche la giornata di 25 ore del cambio d'ora.

La prima risposta del servizio può essere parziale: è successo in entrambe le nuove prove. Il bot suddivide le finestre sature, confronta raccolte successive, conserva gli esiti discordanti e termina su errori. Ogni esecuzione ha una cartella separata con risposte originali e rapporti.

**La correttezza dei passaggi raccolti è verificata; la completezza dell'elenco giornaliero resta aperta.** La lista del portale non si è aggiornata in modo affidabile cambiando data e ora, impedendo il confronto visivo integrale. I dati conservano `complete: false` e non sono ancora utilizzati dal frontend.

Riferimenti: [confronto ufficiale delle corse](confronto-orari-atv.md), [verifica estesa](verifica-bot-atv.md), [campioni raccolti](../data/bus-stop-trials.json), [esiti dei 106 confronti](../data/bus-stop-trip-verification.json).

## Come useremo il bot

È uno script del progetto da eseguire quando occorre raccogliere o aggiornare gli orari. Non deve restare sempre acceso. Il flusso previsto è raccolta, controllo, salvataggio dei file, build e pubblicazione. L'app pubblicata consulta i dati salvati e non richiede che il PC dell'utente sia acceso.

L'impostazione concordata è aggiornare gli orari programmati al cambio stagionale o in caso di variazioni note. Una settimana di date precise non verrà trasformata automaticamente in un calendario valido per tutta la stagione. Avvisi e dati in tempo reale richiedono processi separati.

## Lavoro ancora da fare

1. **Completato:** salvataggio, ripresa e riuso dei dettagli corsa. I 106 passaggi sono stati ricontrollati dallo snapshot senza rete; istruzioni e limiti in [bot-atv-ripresa.md](bot-atv-ripresa.md). Restano da predisporre il coordinamento e i rapporti di un lotto su tutta la linea.
2. **Piano predisposto:** 92 codici OSM e 94 codici nelle corse ufficiali osservate, per un'unione di 96 candidati. Le differenze rimangono esplicite e non vengono risolte con abbinamenti forzati. Dettagli in [raccolta-linea-24.md](raccolta-linea-24.md).
3. **Primo lotto eseguito:** periodo pianificato 19–25 ottobre; completati due controlli fermata/giorno sui 672 previsti, con ripresa del giorno successivo salvata al limite di richieste. I 78 dettagli già acquisiti descrivono 3.290 osservazioni su 94 codici fermata. Restano da completare periodo e controlli di copertura: non è una raccolta settimanale completa.
4. Collegare nell'app soltanto i dati verificati: fermata sulla mappa, giorno selezionato, passaggi, fonte e validità. Conservare i riferimenti ai PDF e al portale per i casi non coperti.
5. Dopo la prova pratica, valutare l'estensione alle altre linee. Prima della pubblicazione estesa dei nuovi dati verificare le condizioni di riutilizzo delle fonti.

## Verifica e pubblicazione

Al momento di questo aggiornamento **147 test Node passano**. Il frontend distribuibile è `public/index.html`, generato da `public/calendar.template.html`, `public/calendar.js` e dai dati mediante `npm run build`.

Il repository configurato è [Madelirium/verona-app](https://github.com/Madelirium/verona-app); l'indirizzo dell'app pubblicata è [madelirium.github.io/verona-app](https://madelirium.github.io/verona-app/). L'ultimo commit locale è `217f755`, ma ci sono modifiche e nuovi file successivi non ancora inclusi in un commit. Questo aggiornamento della documentazione non effettua commit, push o deploy. Il workspace locale contiene quindi lavoro più recente dell'ultimo commit; non si deve presumere che sia già online.

Gli aggiornamenti eventi hanno un workflow giornaliero nel progetto. La raccolta degli orari ATV resta manuale e non è stata avviata una raccolta massiva di tutta la rete.
