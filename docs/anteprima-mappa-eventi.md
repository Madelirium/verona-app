# Anteprima mappa nei dettagli evento

Prova locale del 21 ottobre 2026. Aprendo la scheda di un evento da Scopri, calendario, Home, quartiere o mappa, sotto il luogo viene mostrata una piccola mappa con il punto dell'evento. Si usa la stessa funzione di validazione delle coordinate della mappa generale: gli eventi senza coordinate utilizzabili o contrassegnati come ambigui non ricevono una posizione inventata.

Anteprima Leaflet/OSM alta 160 px, limitata al 25% del viewport. Spostamento, zoom touch, rotella e tastiera sono disabilitati nell'anteprima per mantenere lo scorrimento verticale della scheda. Il pulsante “Vedi sulla mappa” apre la vista completa con l'evento selezionato; le indicazioni restano disponibili anche se la libreria o lo sfondo della preview non si caricano.

Si inizializza la mappa solo dopo l'apertura del dialog. Alla chiusura, anche con Escape, o passando a un altro evento viene rimossa l'istanza precedente. I completamenti tardivi delle tessere di una vecchia preview non aggiornano quella successiva. Non vengono caricati percorsi autobus o richiesti permessi di posizione per la preview.

Verifiche: eventi con coordinate, sede ambigua, libreria assente, errore delle tessere, apertura di un secondo evento e pulizia alla chiusura. Verificato in browser Gruppo di cammino, Borgo Trento, a 390 e 320 px: marker sul luogo, tessere caricate e nessun overflow orizzontale. Nessuna pubblicazione GitHub in questo passaggio.
