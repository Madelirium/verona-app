# Orari ATV dentro l’app

Raccolta manuale del 18 ottobre 2026: 38 schede urbane (24 feriali, 5 serali, 9 festive), 107 pagine PDF, 200 tabelle e 50.516 celle con un orario. Le date di inizio validità sono quelle riportate dai singoli documenti e non vengono uniformate. Non è un catalogo completo della rete extraurbana, né un feed in tempo reale.

## Consultazione

Il pulsante **Orari** della scheda apre un pannello interno: direzione, servizio indicato dalla tabella e fermata. La pagina principale resta ferma; scorre l’elenco degli orari. Le scelte si conservano nel browser per ciascuna scheda e vengono ignorate se non esistono più nella raccolta.

Il servizio scolastico o delle vacanze è scelto esplicitamente: non si deducono automaticamente festività o giorni scolastici. Gli orari serali oltre mezzanotte sono ordinati dopo quelli della sera e indicati come giorno successivo. Le fermate ripetute delle circolari restano due passaggi distinti. Il PDF originale rimane un collegamento secondario sotto **Validità, note e fonte**, senza essere caricato per consultare gli orari interni.

## Estrazione manuale

1. `npm run snapshot:bus-pdfs` conserva i documenti in `.local/atv-timetables/` e registra le impronte in `data/bus-timetable-snapshots.json`.
2. Con Python e `pdfplumber` disponibili, eseguire `python scripts/extract-bus-timetables.py`.
3. Eseguire `python scripts/test_extract_bus_timetables.py`, quindi `npm run build` e `npm test`.
4. Controllare gli errori in `data/bus-timetables.json`, confrontare con i PDF i casi nuovi e provare l’app prima di pubblicare.

Il frontend e la pipeline Pages leggono il JSON già estratto: non richiedono Python, i PDF o richieste ATV. La raccolta rimane stagionale e manuale.

## Controlli e limiti

L’estrattore usa coordinate del testo: intestazioni delle corse, righe delle fermate e colonne. Non usa OCR, interpolazione o modelli generativi per inventare celle. Mantiene i buchi e le barre di passaggio come assenza di un orario. Le note di corsa sono separate dai nomi delle fermate e sono disponibili nel pannello. Ogni pagina deve avere esattamente tanti orari associati alle fermate quanti token orari riconosciuti nella fonte; righe o simboli non riconosciuti impediscono la pubblicazione della scheda.

La generazione controlla dimensioni delle matrici, formato delle ore, conteggi, URL e impronte rispetto al registro delle copie PDF. Un nuovo documento con impronta diversa richiede una nuova estrazione. Una scheda importata con un URL PDF diverso non riutilizza automaticamente la vecchia tabella.

I casi particolari del campione iniziale sono stati confrontati con le pagine renderizzate: colonna singola finale della 12; codice alfanumerico e codice mancante della 63; colonna finale senza codice nella 91 festiva; ora sovrastampata nella 98. Dove manca il codice originale viene memorizzato `null`, conservando l’orario senza attribuirgli un codice inventato. Il testo sovrastampato viene normalizzato solo quando ogni carattere è duplicato a coppie e il risultato è un’ora valida. Le regole per colonne senza codice sono limitate ai formati effettivamente verificati.

Le verifiche automatiche non certificano modifiche di servizio successive al PDF, errori presenti nell’originale, cancellazioni, ritardi o la completezza di tutte le fermate. La data di raccolta e la validità del documento rimangono consultabili.
