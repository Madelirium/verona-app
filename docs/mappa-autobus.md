# Mappe autobus pubblicate

Ripristino del 20 ottobre 2026: il rilascio pubblico precedente conteneva soltanto
8 varianti della linea 11. Il catalogo locale comprende invece 121 varianti per
30 delle 38 schede linea, raccolte il 18 ottobre da OpenStreetMap.

Ogni scheda coperta mostra il pulsante Mappa; il pannello offre varianti, percorso
e lista delle fermate. L'indice è incorporato nel frontend, mentre geometrie e
fermate vengono generate in public/bus-routes/ e caricate solo aprendo la linea.
Un download fallito consente di chiudere e riprovare. La selezione della variante
viene conservata durante la visita.

I percorsi OSM sono indicativi e non certificano deviazioni o servizio attuale.
Gli orari da PDF sono collegati solo con direzione e nome univoco verificati;
i nomi simili restano proposte, senza associazioni automatiche. I link esterni
aprono la fonte OSM o la posizione, senza importare dati Google.

Fonte e licenza: OpenStreetMap contributors, ODbL. Il catalogo completo, le fonti
e il rapporto di importazione sono conservati in data/bus-routes.json,
data/bus-route-sources.json e data/bus-route-import-report.json.
