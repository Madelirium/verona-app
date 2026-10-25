# Come raggiungerci: confronto automatico

Il pulsante del dettaglio evento apre un solo pannello con GPS, giorno/ora di partenza e tre alternative. La richiesta di posizione parte dal clic dell’utente; rifiuto, errore o timeout consentono di scegliere una fermata ATV per nome/codice oppure un punto sulla mappa. Le coordinate non entrano in localStorage, analytics o link dell’app; sono inviate al fornitore per il calcolo. La navigazione esterna contiene origine e destinazione.

- Piedi: OSRM foot di FOSSGIS, geometria pedonale verificata, distanza e durata.
- Auto: OSRM car verso un parcheggio del catalogo comunale vicino alla sede, più camminata finale. Si provano al massimo i due parcheggi più vicini; in assenza di parcheggi si calcola verso la sede. Traffico, ricerca posto e disponibilità parcheggi non sono inclusi.
- Autobus: corse dirette ATV nel giorno selezionato, salita/discesa consentite, fino a otto fermate entro 2 km dall’origine, linee comuni alle fermate di destinazione entro 2 km (massimo dodici). Si verificano le camminate di quattro combinazioni salita/discesa; si includono due minuti per salire e l’attesa dalla partenza richiesta. Risultati ordinati per arrivo alla sede, senza dichiarare ottimalità globale. Corse con cambi e ritardi in tempo reale non sono compresi. Risultati incompleti sono segnalati.

La mappa auto/piedi usa le geometrie del servizio; il bus mostra un collegamento indicativo tra fermate ufficiali e camminate reali. Il dettaglio riutilizza il viaggio ATV con i tempi verificati. Date fuori copertura, ore ambigue al cambio legale/solare e partenze trascorse non generano conferme inventate.

Le richieste dei due profili condividono una coda, almeno 1,1 secondi tra gli avvii, cache soltanto in memoria per cinque minuti, timeout di quindici secondi e annullamento delle richieste obsolete. Riapertura o cambio evento non riutilizzano la partenza del pannello chiuso. Titolo e azioni restano fissi; scorre soltanto il centro del pannello.

Il servizio pubblico è adatto a uso leggero: prima di aumentare il traffico serve un fornitore dimensionato o un’istanza dedicata. Non richiede modifiche al server giochi né chiavi nel frontend.

Fonti: [servizio, privacy e policy FOSSGIS](https://routing.openstreetmap.de/about.html), [attribuzione OpenStreetMap](https://www.openstreetmap.org/copyright).
