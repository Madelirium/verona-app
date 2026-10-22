# Parcheggi collegati agli eventi

Nella scheda dell'evento, **Parcheggi vicini** apre un pannello con mappa, evento evidenziato e parcheggi ordinati per distanza. I filtri permettono di scegliere 1,5 o 3 km e la tipologia indicata dal dataset (libero/a pagamento). La lista resta utilizzabile senza Leaflet o senza sfondo cartografico.

Le distanze sono in linea d'aria. Le indicazioni Google Maps aprono separatamente il tragitto in auto verso il parcheggio e quello a piedi dal parcheggio all'evento. Non vengono ricavati tempi a piedi, prezzi, accessibilità, apertura o disponibilità in tempo reale. Gli accessi e le limitazioni ZTL vanno verificati prima di partire.

## Fonte

- [Dataset Comune di Verona](https://www.comune.verona.it/Amministrazione/Documenti-e-dati/Dataset/Parcheggi-a-Verona).
- [CSV ufficiale](https://www.comune.verona.it/customexport/dataset-csv_resource-10720).
- CC BY 4.0. La raccolta del 21 ottobre 2026 contiene 17 punti: elenco dei principali parcheggi, non censimento completo della provincia.
- Il campo «Sito web» è quello fornito dal Comune: non certifica il contenuto attuale della pagina o le tariffe. I parametri di tracciamento vengono rimossi.

## Aggiornamento locale

`npm run import:parking` legge il CSV, valida lo schema e tutte le coordinate, salva `data/parking.json` e rigenera il frontend. Il comando non pubblica online.

Una risposta vuota, una variazione dello schema, identificativi duplicati, coordinate non plausibili o una riduzione superiore al 50% interrompono l'importazione. Se esiste un catalogo precedente, viene conservato con la data dell'ultimo successo e un indicatore di errore dell'ultimo tentativo. Il pannello ⓘ mostra lo stato della raccolta.

Il nuovo importatore è manuale: nessun aggiornamento periodico dei parcheggi è stato attivato su GitHub. Gli eventi e le notizie conservano la loro pianificazione esistente.

## Verifiche

Parsing CSV con virgolette e virgole nei campi; gestione di risposte incomplete; distanza e ordinamento su punti reali; filtri; evento senza posizione precisa; zona non coperta; indicazioni distinte auto/piedi; permanenza della scheda evento e dei salvati; selezione sulla mappa e rimozione della mappa alla chiusura. Verifica visuale su schermi da telefono.
