# La mia posizione

Le mappe di Esplora, eventi e linea 11 hanno un pulsante ◎, con area di tocco 44 × 44 px e nome accessibile “Mostra la mia posizione sulla mappa”. La posizione viene richiesta soltanto al tocco tramite `navigator.geolocation.getCurrentPosition`, con alta precisione, timeout di 12 secondi e senza riuso della posizione in cache del browser (`maximumAge: 0`). Non sono usati `watchPosition` o salvataggi della posizione in localStorage.

Una rilevazione valida aggiorna punto blu e cerchio di accuratezza su tutte le mappe già inizializzate. Si ricentra soltanto la mappa da cui è partita la richiesta, se è ancora visibile. I livelli della posizione sono indipendenti da quelli di eventi e attività, quindi non vengono cancellati cambiando filtri. La posizione rimane nella memoria della pagina finché si ricarica o viene negato un nuovo permesso. Un rifiuto del permesso rimuove i punti già mostrati. Un timeout mantiene l'ultima rilevazione e segnala che il nuovo tentativo non è riuscito.

Il pannello segnala il margine di precisione e, per Esplora, l'eventuale posizione fuori dall'area coperta dal catalogo. La posizione non modifica automaticamente filtri o zona selezionata: in Esplora occorre premere Cerca qui per cercare nell'area appena visualizzata. Le mappe usano cartografia online, per cui il fornitore delle tile riceve le consuete richieste relative all'area visualizzata.

La geolocalizzazione richiede un contesto sicuro: HTTPS oppure localhost/loopback dove consentito dal browser. L'anteprima Wi-Fi su HTTP con indirizzo LAN non soddisfa questo requisito e mostra un messaggio esplicativo. Non vengono aggirati i blocchi del browser. La versione GitHub Pages in HTTPS supporterà la funzione dopo la pubblicazione del codice; restano necessari permesso del browser e localizzazione del dispositivo.

Fonti: [Geolocation.getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

Verifiche automatiche: richiesta soltanto al tocco, accuratezza e livelli condivisi, assenza di persistenza della posizione, HTTP non sicuro, permesso negato, timeout, coordinate non valide e risposta ricevuta dopo il cambio schermata. La rilevazione reale dipende da dispositivo e browser e richiede una prova manuale.
