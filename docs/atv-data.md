# Verifica delle fonti ATV — 17 ottobre 2026

Verifica in sola lettura. Nessuna modifica alla sezione Autobus dell'app e nessun contatto inviato ad ATV.

## Fonti verificate

| Fonte | Riscontro | Uso possibile nella prima versione |
| --- | --- | --- |
| [Linee e orari](https://www.atv.verona.it/Linee_e_orari_autobus) | Pagina ufficiale raggiungibile, HTTP 200 | Catalogo dei collegamenti alle fonti urbane ed extraurbane |
| [Orari urbani PDF](https://www.atv.verona.it/orari-urbani/dettaglio-percorsi-orari-pdf) | Pagina ufficiale con collegamenti alle tabelle | Ricerca della linea e apertura dell'orario ufficiale; non equivale a partenze in tempo reale |
| [Mappe urbane](https://www.atv.verona.it/Linee_orari_autobus_urbani_Verona) | Mappe feriali, festive e serali in PDF | Apertura della mappa ufficiale |
| [Località extraurbane](https://tech.atv.verona.it/atv_www/orari_extraurb/orari/atv_localita_A.html) | Indice alfabetico con località e linee | Ricerca per località; l'indice non certifica coordinate delle singole fermate |
| [Deviazioni](https://www.atv.verona.it/linee-orari/deviazioni) | Pagina ufficiale raggiungibile, con avvisi | Avvisi con fonte e data, verificando durata e linee coinvolte |
| [Pagina RSS](https://www.atv.verona.it/flex/cm/pages/ServeBLOB.php/L/IT/IDPagina/436) | Collegamento ufficiale al feed news | Preferibile alla lettura periodica delle pagine per individuare nuove pubblicazioni |
| [Feed RSS](https://www.atv.verona.it/flex/cm/pages/ServeFeed.php/L/IT/fmt/rss20/feed/pages%3A2) | HTTP 200, RSS 2.0; 20 elementi nella risposta esaminata | Titolo, link, identificativo e data di pubblicazione. Le descrizioni osservate sono vuote: per il contenuto serve la scheda originale |
| [Ticket Bus Verona](https://www.atv.verona.it/App_Ticketbus) | ATV dichiara consultazione di orari, percorsi, fermate e avanzamento del mezzo in tempo reale | Collegamento al servizio ufficiale; non prova disponibilità di un'API pubblica per terzi |
| [Portale orari](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops) | Collegato dalla pagina ATV, HTTP 200, applicazione JavaScript | Consultazione esterna di orari e fermate |

Il feed include anche news aziendali e selezioni di personale, quindi non tutti i suoi elementi sono deviazioni. La codifica dichiarata è ISO-8859-1: decodificare correttamente gli accenti prima del parsing, senza assumere UTF-8. Il numero di elementi non rappresenta il totale degli avvisi attivi.

## Cosa non è stato confermato

- Un URL di download ufficiale, aggiornato e documentato per un feed GTFS di ATV.
- Un endpoint pubblico GTFS-Realtime, SIRI o API equivalente con condizioni d'accesso per la nostra app.
- Un dataset aperto completo con coordinate e identificativi stabili delle fermate.
- Una licenza aperta specifica di ATV che autorizzi il riutilizzo di tutte le tabelle, le mappe e i dati dinamici.

La ricerca ha individuato riferimenti secondari a GTFS e documenti regionali che menzionano NeTEx per ATV. Non sono stati considerati prova di un feed attualmente accessibile: non è stato scaricato e validato alcun archivio di rete. Il fatto che un portale mostri dati in tempo reale non autorizza né documenta l'uso delle sue interfacce interne.

## Proposta per l'implementazione

1. Prima versione: linee/località, collegamenti agli orari e alle mappe ufficiali, preferiti e raccolta degli avvisi tramite RSS, mantenendo visibile fonte e data.
2. Separare sempre orari programmati da dati aggiornati in tempo reale; non ricavare conti alla rovescia dai soli PDF.
3. Per fermate vicine, partenze integrate e ricerca di itinerari, ottenere da ATV o dal canale istituzionale indicato un feed strutturato aggiornato, le condizioni di riutilizzo e le eventuali credenziali. Controllare validità del calendario, corse scolastiche, festività e ricorrenze prima di usarlo.

Lettura eseguita tramite richieste HTTP ai siti pubblici. Alcune pagine ATV restituiscono 403 allo strumento di ricerca web, ma le stesse pagine pubbliche hanno risposto 200 al client HTTP locale; non sono stati effettuati accessi con account o aggiramenti di autenticazione.
