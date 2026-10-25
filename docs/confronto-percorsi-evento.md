# Come raggiungerci: confronto automatico

Il pulsante del dettaglio evento apre un solo pannello con GPS, giorno/ora di partenza e due alternative, “A piedi e mezzi” e “Auto”. La richiesta di posizione parte dal clic dell’utente; rifiuto, errore o timeout consentono di scegliere una fermata ATV per nome/codice oppure un punto sulla mappa. Le coordinate non entrano in localStorage, analytics o link dell’app; sono inviate al fornitore per il calcolo. La navigazione esterna contiene origine e destinazione.

- Piedi: OSRM foot di FOSSGIS, geometria pedonale verificata, distanza e durata.
- Auto: OSRM car verso un parcheggio del catalogo comunale entro 5 km dalla sede, più camminata finale. Si verificano fino a tre candidati, preselezionati per tempo geometrico di guida più camminata, poi ordinati sul tempo totale realmente calcolato; in assenza di parcheggi entro 5 km si calcola verso la sede. Traffico, ricerca posto e disponibilità parcheggi non sono inclusi.
- Autobus: corse dirette ATV nel giorno selezionato, salita/discesa consentite, fino a otto fermate entro 800 m dall’origine, linee comuni alle fermate di destinazione entro 800 m (massimo dodici). Si verificano le camminate di quattro combinazioni salita/discesa; si includono due minuti per salire e l’attesa dalla partenza richiesta. Risultati ordinati per arrivo alla sede, senza dichiarare ottimalità globale. Corse con cambi e ritardi in tempo reale non sono compresi. Risultati incompleti sono segnalati.

La mappa auto/piedi usa le geometrie del servizio; il bus mostra un collegamento indicativo tra fermate ufficiali e camminate reali. Il dettaglio riutilizza il viaggio ATV con i tempi verificati. Date fuori copertura, ore ambigue al cambio legale/solare e partenze trascorse non generano conferme inventate.

Le richieste dei due profili condividono una coda, almeno 1,1 secondi tra gli avvii, cache soltanto in memoria per cinque minuti, timeout di quindici secondi e annullamento delle richieste obsolete. Riapertura o cambio evento non riutilizzano la partenza del pannello chiuso. Titolo e azioni restano fissi; scorre soltanto il centro del pannello.

Il servizio pubblico è adatto a uso leggero: prima di aumentare il traffico serve un fornitore dimensionato o un’istanza dedicata. Non richiede modifiche al server giochi né chiavi nel frontend.

Fonti: [servizio, privacy e policy FOSSGIS](https://routing.openstreetmap.de/about.html), [attribuzione OpenStreetMap](https://www.openstreetmap.org/copyright).

## Quando conviene il bus

La scheda “A piedi e mezzi” presenta una sola proposta: se il percorso pedonale è entro 1,2 km e 15 minuti, non avvia la ricerca autobus. Altrimenti confronta bus e camminata dall’identica partenza. Il bus è proposto solo se risparmia almeno 5 minuti e il 20% del tempo pedonale, riduce almeno del 30% i metri a piedi e non richiede una camminata di accesso superiore a metà del percorso pedonale diretto (massimo 1 km). Le camminate verificate ai capolinea sono inoltre limitate a 1 km per salire e 1,2 km per raggiungere la sede. Se il diretto a piedi non è calcolabile, un bus con entrambe le camminate verificate può essere proposto senza dichiarare un risparmio non verificato. “Altri autobus e orari” mantiene la ricerca manuale disponibile.

Il pannello parcheggi degli eventi parte da 5 km, con opzioni 1,5 / 3 / 5 km. Il miglior percorso auto è il più breve per tempo totale tra i candidati effettivamente verificati; non si dichiara ottimalità su tutto il catalogo né disponibilità di posti.
