# Fermata di partenza tramite posizione — prova locale

24 ottobre 2026. Nel percorso autobus verso un evento, «Usa la mia posizione» affianca la ricerca manuale della fermata di partenza. La richiesta al dispositivo parte solo al clic. Nessuna modifica alla localizzazione delle altre sezioni.

L’app confronta le coordinate con l’indice ufficiale già caricato e propone fino a cinque fermate entro 2 km, ordinate per distanza in linea d’aria, con servizio nell’indice per il giorno scelto. La prima è indicata come «Più vicina». La scelta rimane esplicita: lato della strada, direzione e presenza di una corsa diretta verso l’evento vanno ancora verificati. Non si promette una corsa diretta per ogni fermata suggerita.

Le coordinate GPS non vengono persistite né inviate dalla funzione a un server di ricerca o al fornitore pedonale. Non si riutilizza né aggiorna la posizione globale delle mappe. Il browser/sistema operativo gestisce l’acquisizione della posizione. Una precisione oltre 200 m produce un avviso; oltre 2 km la posizione viene rifiutata come troppo approssimativa. Distanza non pedonale e assenza di fermate vicine sono esplicitate.

Permesso negato, timeout, browser senza geolocalizzazione e dati invalidi lasciano disponibile la ricerca manuale. HTTP su un indirizzo Wi-Fi privato non consente normalmente la posizione: l’interfaccia spiega di usare HTTPS o cercare per nome. Localhost è trattato dal browser come contesto attendibile. Nessuna attivazione pubblica o pubblicazione GitHub inclusa in questa modifica.

Le risposte successive alla scrittura manuale, a una ricerca delle corse, alla selezione di una fermata o alla chiusura del pannello vengono ignorate. Il pulsante torna disponibile per riprovare.

Verifiche automatiche: richiesta solo al clic, ordine per distanza, esclusione di fermate inattive, scelta esplicita, nessuna persistenza GPS, HTTP, rifiuto, timeout, coordinate non valide, precisione insufficiente, zona senza fermate e risposte tardive. Nel browser locale è stato verificato il pulsante e il recupero dal timeout: l’ambiente non ha fornito una posizione reale. Le proposte di fermata sono state verificate con coordinate controllate nei test, non con un’acquisizione GPS reale.

## Pubblicazione

Rilascio online richiesto dall’utente il 24 ottobre 2026: inclusi ricerca semplificata e localizzazione della partenza autobus. Il calcolo pedonale FOSSGIS resta limitato alla prova locale.
