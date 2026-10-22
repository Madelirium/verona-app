# Esplora per bisogni

Un solo accesso «Cosa cerchi?» nella barra di Esplora apre luoghi/attività, parcheggi, farmacie di turno, isole ecologiche, ricerca nelle vicinanze ed eventi. Il collegamento Eventi preesistente è nel menu; non sono aggiunti pulsanti nella Home.

I servizi riutilizzano i rispettivi pannelli e dataset. Le farmacie ordinarie di OpenStreetMap rimangono distinte dai turni verificati. Le isole ecologiche aprono direttamente la scheda «Dove portare». La chiusura dei servizi conserva ricerca, categoria, preferiti e area selezionata di Esplora.

La ricerca testuale riconosce richieste semplici relative a parcheggi, farmacie e rifiuti e propone un pulsante per aprire il servizio. Non cambia automaticamente sezione o filtri durante la digitazione. Evita un doppio accesso ai turni quando il pulsante della categoria Farmacie è già visibile.

«Vicino a me» offre posizione del dispositivo (su richiesta) e scelta manuale della zona. Con la posizione valida, filtra il catalogo entro 1 km effettivo e ordina per distanza in linea d’aria. Mantiene categoria e preferiti, indica le distanze nell’elenco e include il punto di partenza nell’inquadratura. Non promette percorsi o tempi a piedi. Se la precisione supera 1 km invita a scegliere una zona manuale.

Nell’anteprima Wi-Fi HTTP, senza permesso, senza mappa o quando la posizione fallisce, restano consultabili catalogo e servizi. La scelta manuale usa «Cerca qui» per filtrare l’area visibile, distinta dal filtro circolare di 1 km. «Ripristina» rimuove entrambi i filtri geografici. Nessuna richiesta automatica di posizione, nessuna persistenza della posizione. Un risultato arrivato dopo annullamento non modifica mappa o filtro.

Nessun nuovo endpoint o raccolta dati. Sorgenti: `public/explore-needs.js` e funzioni Esplora/localizzazione esistenti in `public/calendar.js`. Verifiche a 320/390 px, accessi e ritorno dai servizi, ricerca suggerita, filtri, raggio, ordinamento, errore Wi-Fi, risposta tardiva e stato vuoto.
