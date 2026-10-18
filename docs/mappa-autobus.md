# Mappa autobus: prima prova linea 11

In Autobus, la scheda urbana feriale 11 ha un pulsante Mappa. Il pannello occupa lo spazio del telefono e consente di cambiare variante, vedere il percorso e consultare l'elenco delle fermate con pulsanti accessibili da tastiera. Scorre soltanto l'elenco interno.

## Fonte e limiti

Le otto varianti provengono dalla relazione OpenStreetMap [11344302](https://www.openstreetmap.org/relation/11344302) e dalle sue relazioni figlie. Tracciati e piattaforme sono dati della comunità OSM, raccolti manualmente il 18 ottobre 2026: non costituiscono una verifica dei percorsi attuali ATV. Le geometrie mantengono separati i segmenti stradali originali, senza collegare eventuali vuoti con segmenti inventati.

Il catalogo `data/bus-routes.json` conserva fonte, data di raccolta, ultima modifica della relazione, coordinate e ordine delle fermate. Dati [OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright); cartografia stradale online con attribuzione visibile. Geometrie ed elenco sono incorporati nella build. Se la cartografia non si carica rimane disponibile l'elenco.

Il collegamento agli orari ATV richiede nome identico, fermata univoca nella variante e una sola chiave nella tabella della direzione associata. Nomi abbreviati, corsie non identificate o nomi ripetuti non vengono abbinati. Gli orari della fermata comprendono tutte le varianti della linea nella direzione selezionata: il sistema non associa le singole corse alla variante OSM. Il servizio scolastico, di vacanza o del sabato va scelto esplicitamente. Nessun dato in tempo reale.

## Aggiornamento manuale

`npm run import:bus-routes` legge il gruppo e le relazioni figlie dall'API pubblica OSM, controlla identità della linea e coordinate, salva il catalogo soltanto a importazione completa e rigenera il frontend. Non è previsto un aggiornamento automatico. `-- --cached` rielabora le risposte locali in `research/bus-map/`, cartella ignorata da Git, per sviluppo.

`npm test` verifica geometrie, rifiuto di dati incompleti, associazioni ambigue, apertura degli orari dalla fermata, cambio variante, ritorno al pannello e funzionamento dell'elenco in assenza della mappa.
