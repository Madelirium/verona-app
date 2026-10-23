# Collegamento eventi e autobus

Nel dettaglio di un evento, “Come arrivare in autobus” apre un pannello con data dell’evento, mappa e le tre fermate ufficiali più vicine entro 800 metri. Le fermate sono distinte per codice, anche quando condividono il nome (ad esempio due lati della strada). Le distanze sono in linea d’aria, senza stime inventate dei minuti a piedi. Il collegamento esterno apre il percorso pedonale dalla fermata all’evento.

Le coordinate provengono dalla scheda evento già presente nel catalogo; `mapDisabled` e coordinate mancanti impediscono di suggerire una fermata. Non viene effettuato un abbinamento tramite il nome del luogo.

L’indice di prossimità è generato durante `npm run build` dalle 141 linee validate di `data/bus-official/`. Usa solo passaggi con salita consentita e un calendario binario per linea/fermata. Viene salvato come `public/bus-official/stops.json` (circa 864 kB), caricato solo quando si apre il pannello e riutilizzato nella visita. Il normale avvio dell’app non scarica l’indice o tutti gli orari.

La data iniziale è il giorno dell’evento oppure oggi se è una manifestazione ancora in corso. Per eventi su più giorni si può cambiare data. Ogni pulsante di linea apre il pannello orari con data e codice fermata preselezionati. Le destinazioni si consultano negli orari; questo non è un pianificatore di itinerari, non dimostra l’arrivo prima dell’inizio e non propone automaticamente l’ultimo autobus di ritorno.

Le linee mostrate nella validità dell’archivio sono quelle con partenze nel giorno di servizio scelto. Una fermata vicina senza partenze in quel giorno rimane visibile con uno stato esplicito. Per date fuori validità vengono mostrate le linee note con avviso che il servizio del giorno non è verificabile. Nessun dato in tempo reale.

Il pannello ha altezza limitata al viewport, intestazione e data fisse, scorrimento interno della mappa e delle tre schede. I pulsanti sono alti almeno 44 px; il flusso è disponibile anche senza gesti touch. Mappa controllata a 320 px.

## Schede delle fermate sulle mappe delle linee

Mappa ed elenco Fermate usano la stessa funzione per i contenuti. Rimossi il collegamento “Fermata originale OpenStreetMap” e il testo “Orari non associati a questo punto”. Il codice appare come “Fermata …”. Con codice numerico e linea presente nell’archivio ufficiale, il pulsante apre gli orari di quella fermata. Se non c’è un’associazione precisa e non è disponibile il fallback PDF, si apre la consultazione della linea chiedendo esplicitamente di scegliere la fermata, senza inventare un abbinamento. Le attribuzioni OSM della mappa e il collegamento alla fonte generale del percorso restano presenti.

Verifica browser: Social Run del 26 ottobre, fermate Via Piccoli 1525/1526 a circa 50/80 m, linea 62; da 1525 si aprono 25 partenze programmate del 26 ottobre. Linea 24, popup Santini 1974: accesso diretto a 40 partenze del 20 ottobre, senza il vecchio messaggio. Test automatici su distanze, limite di ricerca, calendari 24/96, data preselezionata, assenza di coordinate, errori e annullamento durante il caricamento.

Prova locale: nessuna pubblicazione GitHub di questo intervento.

## Anteprima automatica sulla mappa delle linee

Aprendo un punto si caricano automaticamente tre prossime partenze, con orario e destinazione, senza aprire un altro pannello. Si usa il fuso Europe/Rome e vengono considerate anche le corse notturne provenienti dal giorno di servizio precedente. Se oggi non ci sono più corse, la ricerca prosegue nei sei giorni di servizio successivi coperti dall’archivio; gli orari del giorno seguente sono marcati “Domani”. Non sono arrivi in tempo reale. Fuori validità compare un avviso invece di riutilizzare orari scaduti.

“Tutti gli orari” resta disponibile per il calendario completo. Nella scheda compatta non viene ripetuto il collegamento Google Maps, disponibile nell’elenco Fermate. Il titolo della mappa è stato accorciato per lasciare spazio alle partenze sui telefoni piccoli. Il caricamento parte all’apertura del popup, non per tutte le fermate del percorso: richieste concorrenti della stessa linea sono condivise e riutilizzano la cache esistente. Il pannello non modifica le scelte salvate nel consultatore completo degli orari.

## Linee colorate nella mappa dell’evento

La mappa mostra ora i tracciati OSM delle linee che servono le fermate entro 800 metri, con un colore distinto per ciascuna delle prime otto linee (priorità ai tracciati disponibili e poi alla vicinanza). L’elenco sottostante conserva le tre fermate più vicine. Vengono disegnate soltanto varianti che contengono esattamente un codice di fermata vicino associato alla linea: nessun percorso viene inventato collegando semplicemente due punti. I tracciati possono essere indicativi o non aggiornati alle deviazioni; il calendario ATV conferma il servizio della linea nel giorno scelto, non certifica ogni variante OSM.

Le fermate lungo i percorsi sono cliccabili e aprono gli orari con codice e data mantenuti. La legenda permette di isolare una linea; “Percorsi completi” allarga l’inquadratura, “Vicino all’evento” ritorna alle fermate della zona. Il segnaposto con stella e scritta Evento resta sempre presente e ha priorità visiva sui tracciati e sulle fermate.

La legenda scorre al proprio interno in orizzontale con pulsanti accessibili da tastiera e alti almeno 44 px; la pagina non scorre orizzontalmente. Mappa più alta, scorrimento verticale limitato al pannello. I file dei percorsi sono scaricati per linea solo su richiesta, riutilizzando la cache delle mappe autobus. Errori di una linea o geometrie mancanti lasciano utilizzabili fermate e orari e sono segnalati. Le risposte arrivate dopo chiusura/cambio data non sostituiscono la vista corrente.
