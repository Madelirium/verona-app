# Come arrivare agli eventi

Nei dettagli degli eventi geolocalizzati, un solo pulsante sostituisce gli accessi separati a mappa, indicazioni, autobus e parcheggi. L’anteprima del luogo resta nei dettagli.

La barra Autobus / Auto / A piedi passa tra le viste esistenti senza aggiungere modali intermedi. La vista a piedi mostra la sede e apre Google Maps per il calcolo del tragitto. Le viste autobus e parcheggi riutilizzano dati, filtri, mappe e collegamenti agli orari già presenti. La data autobus si conserva nei cambi di mezzo della stessa visita. La chiusura riporta ai dettagli dell’evento.

Nessuna posizione viene richiesta all’apertura. Non vengono calcolati tempi a piedi, itinerari interni o disponibilità dei parcheggi in tempo reale. Senza coordinate attendibili si invita a verificare la sede nel programma ufficiale. Le viste rimangono utilizzabili senza sfondo cartografico e i risultati autobus arrivati dopo il cambio di mezzo vengono ignorati.

Sorgente: `public/event-travel.js`, incluso dal generatore del frontend. Verificare a 320 e 390 px: cambio mezzo, chiusura, data autobus, assenza di coordinate e catalogo parcheggi indipendente.
