# Mappa delle fermate ufficiali — 21 ottobre 2026

La mappa generale Autobus si apre sulle fermate dell'indice ufficiale ATV, indipendentemente dalla disponibilità dei tracciati OSM. Nell'archivio attuale sono consultabili 4.287 fermate con coordinate e almeno una linea con servizio di salita. Si rispettano rete, preferiti e tipo di scheda scelti nella sezione Autobus. Le linee di una fermata rappresentano l'archivio, non una garanzia di passaggio oggi; il consultatore ufficiale permette la verifica per data.

Toccando una fermata si apre un pannello con nome, codice e pulsanti delle linee. Selezionando una linea si carica solo il suo tracciato, si evidenziano le fermate ufficiali della linea e si apre l'accesso agli orari della fermata selezionata. I tracciati restano OSM indicativi, comprensivi delle varianti raccolte; non sono posizioni in tempo reale. Se manca un tracciato vengono mostrate le fermate ufficiali senza inventare collegamenti tra i punti.

La ricerca accetta nome o codice; in mappa inquadra i risultati. L'elenco accessibile mostra le prime 80 corrispondenze e invita a restringere la ricerca. I controlli e il pulsante degli orari hanno almeno 44 px. Le fermate usano un renderer canvas distinto, sopra i percorsi, con tolleranza al tocco; vengono disegnate solo quelle nell'area visibile e nei suoi margini. La selezione si azzera con Tutte le fermate, senza cancellare il confronto di linee salvato in precedenza.

Confronta linee conserva la funzione precedente: fino a sei percorsi colorati, preferiti e selezione persistente. Il pannello della fermata usa scorrimento interno; a 320×640 resta visibile una mappa di circa 250 px, senza scroll della pagina. Il controllo geolocalizzazione già esistente rimane disponibile e richiede HTTPS sul telefono.

Verificati ricerca della fermata 1974 Via Santini (24 e 96), tocco diretto sulla fermata 7292 Via del Fante e percorso della 72, fallback extraurbano 130 senza geometria, errore e retry dell'indice, risposta tardiva dopo chiusura e regressioni del confronto linee. Modifica preparata in locale, da pubblicare insieme al prossimo aggiornamento richiesto.
