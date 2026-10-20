# Orari ATV ufficiali nell’app

Archivio acquisito il 19 ottobre 2026 e incluso nel rilascio Eventi e Autobus per GitHub Pages.

## Consultazione

In **Autobus → Orari ufficiali · tutte le linee** sono disponibili tutte le 141 linee del file NeTEx. Il pulsante **Orari** delle schede passa alla stessa consultazione. Si sceglie data del servizio, fermata identificata dal codice ufficiale e, facoltativamente, destinazione. Nei punti OSM con codice numerico si apre direttamente quel codice: se manca nella linea ufficiale, l’app lo segnala senza scegliere una fermata simile.

Ogni linea è un file caricato su richiesta e riutilizzato durante la visita. Non sono incorporati gli 11 MB di orari nella pagina iniziale. Le scelte di fermata e destinazione vengono ricordate sul dispositivo; la data riparte da oggi. Le tabelle PDF precedenti rimangono nei sorgenti e come fallback per linee non presenti nell’archivio; i collegamenti ai PDF ATV restano nei dettagli della linea.

Calendari applicati alle date effettive, comprese eccezioni e limiti di validità. Le partenze sono filtrate con `ForBoarding`: gli arrivi ai capolinea di sola discesa non sono presentati come partenze. Gli scostamenti dopo mezzanotte rimangono riferiti alla data del servizio scelta. Nessun ritardo o posizione live.

## Copertura della copia importata

- Pubblicazione RAP Veneto del 18 ottobre 2026, versione 11044.
- Validità: **18 ottobre–17 novembre 2026**. Fuori intervallo l’app indica dati non validi; non presume assenza di autobus.
- 141 linee, 6.360 definizioni di corsa, 195.849 passaggi programmati.
- 4.303 fermate conservate: 4.301 referenziate nelle corse e due senza corse associate in questa copia, conservate in `unassignedStops` nel manifest. Non vengono inventati orari per queste ultime.
- I dati includono anche linee scolastiche/speciali presenti nella fonte; presenza nel catalogo non garantisce che abbiano servizio per ogni data.
- Tutti i 106 passaggi dei tre campioni originali coincidono anche nei file esportati.
- Linea 24: 87 corse lun–ven, 59 sabato 24 ottobre, nessuna corsa della 24 domenica 25 nel file. Altre linee festive, come la 96, restano distinte.

## Riproduzione

Importatore Python standard library: `scripts/import-atv-netex.py`, basato sul parser e sui calendari verificati di `scripts/check-atv-netex.py`.

1. Salvare il gzip ufficiale in `research/atv-netex-l2-checked.gz`.
2. Eseguire `python scripts/import-atv-netex.py` con Python e database timezone Europe/Rome disponibili.
3. Eseguire `npm run build` e `npm test`.

L’importatore blocca una copia discordante con i campioni di riferimento attuali. Per una nuova stagione va aggiornato consapevolmente anche il campione: non eliminare il controllo per aggirare differenze reali. Non è stato attivato un aggiornamento periodico o un nuovo bot di interrogazioni per fermata.

Il build verifica ogni asset (versione, riferimenti, date, coordinate e ordine dei passaggi) e lo copia da `data/bus-official/` a `public/bus-official/`. Le cartelle pubbliche generate sono escluse da Git; il workflow Pages ora include anche questi asset quando si pubblicherà.

## Verifiche e limiti

Test automatici sui 141 file, su tutti i conteggi, sui campioni e su dati alterati; test UI per accesso dalle schede e dalla mappa, data scaduta, assenza di servizio, recupero degli errori e annullamento durante il caricamento. Parser con test su cambio d’ora e riferimenti. Layout verificato a 320 px con scorrimento interno e controlli accessibili.

Fonte: [risorsa ATV nel NAP](https://www.cciss.it/nap/mmtis/public/catalog/Asset/204401), distribuita da RAP Veneto. L’accesso tecnico pubblico è verificato; una licenza esplicita di riutilizzo non è stata confermata. Questa integrazione non costituisce una certificazione operativa dell’intera rete. Le geometrie delle mappe restano OSM e possono differire dalle fermate dell’archivio; non vengono create associazioni tramite somiglianza dei nomi.
