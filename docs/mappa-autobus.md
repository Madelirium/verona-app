# Mappe autobus ATV

La raccolta del 18 ottobre 2026 contiene 121 varianti per 30 delle 38 schede locali: 21 urbane feriali e 9 festive. Gli identificativi iniziali sono elencati in `data/bus-route-sources.json`, ricavati dalla [pagina OSM di Verona](https://wiki.openstreetmap.org/wiki/Verona/Trasporti_pubblici). I membri delle relazioni route_master vengono verificati contro l’API OSM attuale, senza assumere che l’elenco wiki sia aggiornato. Per la 74 il gruppo indicato nel wiki contiene un riferimento incoerente: vengono controllate separatamente le due relazioni della linea. I riferimenti eliminati non sono ripristinati come percorsi attuali.

Non sono stati trovati tracciati nell’elenco verificato per le schede 20, 53, 63 e serali 81–85. Questo non dimostra che manchino in tutte le fonti OSM: richiedono una ricerca successiva. Il rapporto `data/bus-route-import-report.json` distingue linee importate, non elencate, errori e dati precedenti conservati.

## Uso nell’app

La scheda di ogni linea disponibile ha il pulsante Mappa. Il pannello consente di cambiare variante e usare mappa o elenco ordinato delle fermate. Direzione e numero della linea sono visibili. La posizione personale usa il pulsante ◎ con consenso al tocco e richiede HTTPS o localhost. I tracciati sono indicativi e non certificano il servizio attuale o le deviazioni ATV.

Le piattaforme puntuali usano le coordinate OSM. Per piattaforme rappresentate come aree viene usato il centro del rettangolo che le contiene, segnalato nel dato come `positionKind: platform-area`; non abilita associazioni automatiche agli orari. I segmenti stradali rimangono separati: non si inventano collegamenti nei vuoti.

## Confronto fermate

`data/bus-stop-comparison.json` conserva un confronto per ogni occorrenza di fermata nelle varianti: nome e posizione OSM, direzione ATV associata, corrispondenza esatta oppure nomi simili da verificare e collegamenti alla fonte e alla posizione su Google Maps. I conteggi includono ripetizioni della stessa fermata in varianti differenti.

Per le altre linee la direzione viene associata solo con almeno tre nomi esatti univoci e ordine concordante almeno al 90%, senza una seconda direzione concorrente con concordanza superiore al 60%. Per la 11 resta la corrispondenza di direzione già esaminata. In assenza di prove sufficienti la mappa resta disponibile e gli orari non vengono collegati automaticamente. Le somiglianze testuali sono soltanto proposte e non equivalgono a corrispondenze fisiche o corsie verificate. Il controllo di posizione, lato della strada e corsia rimane necessario per gli abbinamenti dubbi.

Non è stato eseguito un confronto automatico con il catalogo Google. Il collegamento **Apri posizione in Google Maps** apre le coordinate OSM in un servizio esterno per consultazione manuale; non afferma che Google confermi nome, presenza o direzione della fermata. Non viene importato o copiato alcun dato Google. Un’integrazione API richiederebbe un progetto dedicato e la verifica delle [condizioni di Google Places](https://developers.google.com/maps/documentation/places/web-service/policies), comprese quelle applicabili nell’area economica europea.

Il collegamento agli orari richiede nome identico e univoco nella variante e nella tabella della direzione associata. Dal pulsante **Orari di questa fermata** si mostrano subito gli orari separati per servizio; i campi di fermata e direzione già noti sono nascosti. Il filtro del servizio rimane opzionale. Il pannello comprende le altre varianti della linea nella stessa direzione e non deduce il calendario scolastico del giorno. Gli orari derivano dai PDF, che non elencano necessariamente tutte le fermate.

## Caricamento e aggiornamento

Il frontend incorpora soltanto l’indice dei percorsi. La build genera file per linea in `public/bus-routes/`, ignorati da Git e ricreati in fase di pubblicazione. La geometria e le fermate vengono caricate soltanto aprendo una linea e mantenute in memoria durante la visita. Il server locale e GitHub Pages servono questi file; il workflow pubblica anche questa directory. Un download non riuscito mostra un messaggio e permette di ritentare, lasciando gli orari accessibili dalla scheda.

`npm run import:bus-routes` aggiorna manualmente i tracciati; `-- --cached` rielabora le risposte locali ignorate da Git in `research/bus-map/`. Gli import falliti conservano le varianti precedenti ove disponibili e le loro date. Non è previsto aggiornamento automatico. `npm run build` e `npm test` controllano catalogo, direzioni, ambiguità, collegamenti agli orari, caricamento per linea e recupero dagli errori.

Fonte dati: [OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright). La cartografia stradale richiede connessione e mantiene l’attribuzione alla fonte.

## Pubblicazione del 20 ottobre 2026

Il ripristino delle 121 varianti per 30 schede linea è ora pubblicato su GitHub Pages (commit 07506f7). Verificati tutti i 30 file cartografici online, le mappe delle linee 12 e 24 su schermi da 320 e 390 px, cambio variante, elenco fermate e recupero da errore di rete. La pubblicazione conserva gli aggiornamenti WebSocket dei giochi e il login Google. Il rilascio isolato supera 191 test; gli sviluppi locali successivi sugli orari ufficiali rimangono distinti.
