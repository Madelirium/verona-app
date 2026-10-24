# Percorso pedonale dall’autobus all’evento — prova locale

Implementazione del 24 ottobre 2026, non pubblicata. Accesso: evento → Come arrivare → Autobus → Trova una corsa diretta → Vedi viaggio → Percorso a piedi.

## Risultato e confini

Il pannello mostra il tragitto pedonale su mappa, distanza instradata, durata stimata, totale autobus + camminata e arrivo stimato nei pressi della sede. I punti blu e rosso distinguono fermata e sede. La ricerca «Arriva entro» continua a filtrare l’arrivo alla fermata: non filtra automaticamente tutti i risultati in base alla camminata. Nessun cambio o ritardo in tempo reale è calcolato.

Prova reale: Piazza Bra Arena B (168) → Gran Guardia, risposta HTTP 200: 136,4 m, 109,1 secondi, 8 punti. Nell’interfaccia: circa 2 minuti. Corsa ufficiale 53 del 24 ottobre, Porta Nuova D2 16:35 → Arena B 16:40: totale stimato 7 minuti, arrivo vicino alla sede 16:42. La distanza in linea d’aria era circa 110 m. Gli ultimi accessi possono non essere rappresentati dalla rete pedonale; non è verificata l’accessibilità per mobilità ridotta.

## Fonti verificate

- FOSSGIS: https://routing.openstreetmap.de/about.html — profilo pedonale, limite di una richiesta al secondo, attribuzione OpenStreetMap, collegamento per correggere la mappa, registrazione di dati tecnici delle richieste. Endpoint ricavato dalla configurazione ufficiale: https://raw.githubusercontent.com/fossgis-routing-server/osrm-frontend/master/src/leaflet_options.js . Protocollo: https://project-osrm.org/docs/v5.24.0/api/ . Test CORS: risposta con Access-Control-Allow-Origin: *.
- Condizioni complete FOSSGIS: https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/ — pagina bloccata da protezione Anubis durante la ricerca. L’idoneità commerciale e le condizioni complete non sono state confermate. Per questo la prova è limitata a localhost e indirizzi privati della rete locale e non viene attivata sul dominio pubblico.
- openrouteservice: https://openrouteservice.org/ e https://giscience.github.io/openrouteservice/getting-started — candidato per una futura integrazione pubblica, richiede account e API key. Le quote numeriche correnti e le condizioni di produzione devono ancora essere confermate. Nessun account o servizio a pagamento è stato attivato.

## Comportamento tecnico

Solo un clic esplicito avvia il calcolo per il viaggio selezionato. Nessuna raccolta massiva di percorsi. Coda seriale con intervallo minimo di 1.100 ms, cache in memoria di 15 minuti (massimo 30 percorsi), timeout di 15 secondi e nessun tentativo automatico. Coordinate ammesse nell’area veronese e distanza in linea d’aria massima 2 km. Validazione di geometria, punti di aggancio, distanza e durata. Nessun identificatore visitatore, cookie o posizione GPS viene inviato dalla funzione; il fornitore riceve comunque la normale richiesta di rete e le coordinate pubbliche di fermata e sede.

Alla chiusura si annulla la richiesta e i risultati tardivi vengono ignorati. In caso di errore si può riprovare oppure aprire Google Maps. Senza libreria cartografica rimangono disponibili tempi e distanza. Il calcolo dell’arrivo gestisce il cambio di giorno e rifiuta orari locali ambigui o inesistenti nel cambio d’ora.

## Verifiche

Test automatici su cache, limiti di frequenza, dati non validi, annullamento, errori, data/ora, isolamento dal dominio pubblico e flussi del pannello. Verifica nel browser con dati reali e larghezze emulate di 390 e 320 px; non si tratta di un test su telefono fisico o con partecipanti. Build rigenerata. Nessuna pubblicazione GitHub.

## Rilascio del codice

Il 24 ottobre 2026 il codice della prova viene incluso nel rilascio GitHub insieme alle corse dirette. Il controllo del dominio continua a disattivare il calcolo pedonale sul sito pubblico: online resta disponibile Google Maps. Nessuna attivazione pubblica di FOSSGIS è inclusa.
