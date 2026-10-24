# Verifica UX: evento, trasporti e salvati

24 ottobre 2026. Primo gruppo locale, nessuna pubblicazione e nessuna modifica ai dati o alle impostazioni di produzione. Fonti principali: `calendar.js`, `event-travel.js`, `event-bus.js`, `parking.js`, `bus-official.js`, `saved.js`, `navigation.js`, template e stili. Il frontend è rigenerato con `npm run build`.

## Risultati osservati e interventi

1. **Errore riprodotto nel browser:** in Come arrivare, toccare nuovamente A piedi faceva sparire la mappa. Il pannello veniva chiuso e riaperto, con inizializzazione Leaflet sul contenitore già occupato e pulizia di chiusura differita. Ora il mezzo già attivo non chiude il pannello; le chiusure accodate non cancellano una nuova apertura. Lo stesso controllo evita di azzerare giorno e filtri di Autobus/Auto.
2. **Problema verificato dal codice e da test riproducibile:** le prime tre fermate erano selezionate prima di escludere quelle senza partenze nel giorno richiesto. Una fermata utile più lontana poteva restare fuori dall'elenco. Ora il filtro del servizio precede il limite; fuori copertura restano consultabili le fermate, con avvertenza che non confermano il servizio.
3. **Attrito osservato nel browser:** passando dalla scheda a Come arrivare sparivano data e orario. Ora sono leggibili nei tre mezzi; negli eventi su più giorni viene indicato il giorno scelto senza estendere arbitrariamente gli orari del primo giorno. Il giorno resta disponibile quando si torna allo stesso evento durante la visita; non viene trasferito a un evento diverso e non è un itinerario salvato permanentemente.
4. **Rischio verificato dal codice:** indice fermate e tracciati non avevano tempo limite per il fetch. Ora nei browser che supportano `AbortSignal.timeout` le richieste hanno limite di 15 secondi, con riutilizzo dei messaggi e dei pulsanti Riprova esistenti. Il limite copre le due risorse del percorso eventi; non costituisce una revisione di tutti i fetch dell'app.
5. **Chiarezza del servizio:** la nota spiega che sono partenze dalle fermate vicine all'evento, non un itinerario dalla posizione dell'utente.

## Funzioni già corrette, conservate

- La scheda distingue interesse, presenza confermata, rimozione e prenotazione/biglietti.
- Autobus → orari precompila fermata e data; le destinazioni e la validità dell'archivio sono consultabili.
- Parcheggi mantiene l'evento come destinazione; informazioni, percorso a piedi verso l'evento, fonte, sito e telefono sono presenti.
- Il catalogo dichiara l'assenza di disponibilità in tempo reale, tariffe e orari di apertura.
- Esistono elenco alternativo alle mappe, scorrimento interno, ritorno ai dettagli e persistenza dei salvati.

## Verifiche eseguite

- Evento reale **Poeti Sociali. “Pace, volto dell'umano”**, Gran Guardia, 24 ottobre 2026, 09:00–20:30: calendario → dettagli → A piedi (anche secondo tocco) → Autobus → Piazza Bra Arena A → linea 11, data 24 ottobre → ritorno → Auto → elenco parcheggi → informazioni Cittadella → Escape → ritorno all'evento → salvataggio → Salvati → ricaricamento → apertura dell'evento ancora salvato.
- Schermi simulati: 390×844 per il percorso, 320×640 per parcheggi ed elenco, 430×844 per la mappa a piedi. Negli stati misurati nessuno scorrimento orizzontale del documento; a 320 px il pannello parcheggi non supera la propria altezza e i pulsanti dei mezzi sono alti 48 px.
- 450 test complessivi superati dopo il primo gruppo; successiva correzione dell'isolamento del giorno tra eventi diversi verificata rieseguendo i cinque test Come arrivare. Cinque nuovi test coprono stesso mezzo, contesto/data, filtro servizio, chiusura accodata, timeout e recupero. I primi tre sono stati eseguiti prima delle correzioni e fallivano.
- La suite esistente verifica anche dati fuori copertura, coordinate assenti, risposte tardive, errori e recupero, permesso di posizione negato/non disponibile, archiviazione dei conclusi e persistenza. Questi casi non sono stati tutti riprodotti manualmente nel browser in questa sessione.

La simulazione è un'ispezione esperta, non una ricerca con partecipanti di 50–65 anni. Non verificati qui: telefoni fisici iOS/Android, screen reader reali, ingrandimento del testo al 200%, rete mobile reale, apertura effettiva di Google Maps e accessibilità fisica dei percorsi. Non sono stati alterati eventi o orari reali per completare la prova.

## Prossimi piccoli interventi

1. **Collegamento autobus e destinazione:** progettare la scelta della partenza solo dopo aver verificato i dati delle corse, senza promettere cambi o tempi a piedi non calcolati. Il successivo intervento locale descritto in `evento-orari-contesto.md` porta titolo e orario dell'evento nella schermata degli orari e chiarisce che sono partenze dalla fermata selezionata; non è ancora un itinerario per l'evento.
2. **Scelta della data per manifestazioni lunghe:** offrire un accesso comune ai tre mezzi, dopo una prova con utenti; ora il controllo esplicito è nel pannello Autobus.
3. **Compatibilità e leggibilità:** sessione dedicata a testo 200%, screen reader e schermi bassi/orizzontali. La misura dei pulsanti dei mezzi non dimostra che ogni controllo dell'app soddisfi il requisito dei 44 px.
4. **Affidabilità di rete:** estendere la gestione dei tempi limite alle altre richieste dei servizi e provare offline e rete lenta con strumenti e dispositivi adatti.
5. **Validazione con persone:** 5–10 partecipanti con compiti concreti, registrando completamento, errori e passaggi che richiedono aiuto. Non aggiungere altre sezioni prima di questa verifica.
