# Prova Autobus con mappa principale

Prova locale del 21 ottobre 2026, successiva alla scheda fermata condivisa. Nessuna pubblicazione GitHub in questo passaggio.

## Esperienza

Entrando in Autobus la mappa occupa il contenuto centrale dell'app. Intestazione e navigazione globale rimangono fuori dalla mappa e sempre visibili. Il pulsante Elenco e servizi apre il catalogo e gli avvisi precedenti; il ritorno alla mappa conserva fermata, linea e contesto, se ancora coerenti con i filtri scelti. Il precedente confronto di linee resta nelle Opzioni.

La ricerca sulla mappa propone linee e fermate distinguendole esplicitamente. La ricerca 24 propone la linea; 1974 propone Via Santini B con codice. La selezione di una linea carica il suo percorso e le fermate, anche senza scegliere prima un punto. I servizi senza geometria conservano i punti ufficiali e uno stato esplicito. La scelta di un punto presenta le sue linee, con il calendario di servizio degli orari.

A zoom cittadino i punti vicini sono raggruppati in cerchi numerati con area di tocco di 44 px e nome accessibile. La selezione ingrandisce l'area; a zoom maggiore ricompaiono i singoli punti. Il raggruppamento riguarda solo la rappresentazione: nessun codice fermata viene fuso o eliminato. Due punti coincidenti restano consultabili anche attraverso ricerca ed elenco.

## Scheda della fermata

La scheda si sovrappone alla mappa senza ridimensionarla. Le tre dimensioni sono:

- Compatta: nome/codice, scelta della linea oppure prima partenza e direzione; lascia spazio al percorso.
- Partenze: linee, prossime corse e accesso agli orari del giorno, con scorrimento interno.
- Dettagli: usa quasi tutto il contenuto centrale, conservando la navigazione esterna; lo sfondo mappa non riceve input quando coperto.

Espandi e Riduci sono disponibili senza gesti. Un trascinamento sul bordo dei comandi può cambiare dimensione, con soglia e annullamento; non intercetta lo scorrimento delle partenze. Se la scelta di una linea nasconde i pulsanti nella modalità compatta, il focus passa al comando Espandi, evitando di perderlo. I comandi al limite mantengono il focus e dichiarano aria-disabled.

Alla fermata riporta al punto selezionato; Percorso completo inquadra le geometrie disponibili tenendo conto dello spazio della scheda. Il nome della fermata rimane presente. Le attribuzioni cartografiche sono lasciate visibili sotto la scheda. I controlli dello zoom appartengono allo sfondo cartografico e rimangono sotto pannelli e ricerca.

## Posizione e dati

Vicino a me riusa la geolocalizzazione già presente, su richiesta esplicita. Su HTTP via Wi-Fi il browser non la consente: la ricerca manuale e la mappa restano disponibili. La versione HTTPS è necessaria sul telefono per richiedere la posizione. Non sono stati richiesti nuovi permessi durante la prova automatica.

La mappa usa l'archivio ufficiale già importato e le geometrie esistenti. Non introduce orari in tempo reale, navigazione con cambi, nuove classificazioni o percorsi mancanti. Le linee preferite non restringono implicitamente il primo accesso alla mappa; i filtri espliciti del catalogo restano rispettati. Tutte le fermate nelle Opzioni ripristina la rete completa nella vista principale.

## Verifica

Test su ingresso senza dialogo modale, uscita dalla sezione e ritorno al punto, alternativa del catalogo, filtri cambiati, ricerca con disambiguazione linea/fermata, tre dimensioni e gestione del gesto, conservazione dei codici nei gruppi, focus quando un pulsante diventa nascosto. Conservate le verifiche su tempi, cache, risposte fuori ordine, errori e geometrie non disponibili.

Prova browser a 390×844 e 320×640: ricerca 1974, linea 24, percorso colorato, prima partenza, espansione e riduzione, navigazione sempre visibile e assenza di overflow orizzontale della pagina. A 390 px, nel caso verificato, il contenitore cartografico è alto circa 601 px e la scheda compatta circa 182 px. Le misure sono del viewport e dei testi provati, non una garanzia per ogni impostazione di ingrandimento.
