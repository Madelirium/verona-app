# Meteo ARPAV

La Home include un accesso compatto alle previsioni. Il pannello mostra le aree 14 (Verona e pedemontana) e 15 (Area del Garda), con data e ora del bollettino, periodi mattina/pomeriggio/giornata, cielo, intervalli di temperatura originali e probabilità di precipitazione. Non sono osservazioni in tempo reale. Le temperature mancanti non diventano zero.

Fonte documentata: https://www.arpa.veneto.it/dati-ambientali/open-data/dati-arpav-in-formato-xml

Feed verificato con HTTP 200 e `Access-Control-Allow-Origin: *` il 22 ottobre 2026:
https://www.arpa.veneto.it/risorse/data-bollettini/meteo/bollettini/it/xml/bollettino_widget.xml

La richiesta avviene direttamente dal browser, senza credenziali, API key, geolocalizzazione o backend. Il feed viene letto all’avvio, all’apertura del meteo, al ritorno alla Home e alla riattivazione della scheda sulla Home; una cache locale di un’ora evita richieste ripetute. Il pulsante Aggiorna forza un nuovo tentativo. La scelta dell’area resta sul dispositivo.

Il caricamento scade dopo 12 secondi. Se fallisce, conserva il bollettino precedente e segnala i dati salvati. Bollettini anteriori a ieri, futuri o senza previsioni ancora pertinenti non mostrano temperature nella Home. L’XML viene verificato con DOMParser, rifiutando errori XML, DTD, entità e schemi incompleti. I dati sono resi come testo, mai HTML.

Licenza dichiarata dalla pagina ARPAV: CC BY 4.0. Il pannello attribuisce la fonte, collega la licenza e dichiara l’adattamento della presentazione.

Le allerte non sono derivate dalle previsioni. Il pannello offre un collegamento ai bollettini ufficiali del CFD Veneto, senza dichiarare livelli o assenza di allerte:
https://www.regione.veneto.it/it_IT/web/protezione-civile/cfd

Sorgente frontend: `public/weather.js`, incorporato da `scripts/build-calendar.mjs`. Nessuna modifica alla pianificazione GitHub Actions. Verifiche: feed reale nel browser, cambio Verona/Garda, dispositivi 320/390 px, persistenza/cache, scadenza, errore e chiusura.


## Anteprima negli eventi

Il dettaglio dell’evento aggiunge un’anteprima solo se il bollettino è valido e copre giorno e fascia pertinenti. Gli intervalli termici restano quelli originali. I periodi sono mattina o pomeriggio/sera, non previsioni puntuali all’ora di inizio. Gli eventi senza orario usano le fasce disponibili del giorno. Per eventi di più giorni, si usa il giorno selezionato nel calendario se ancora pertinente, oppure il primo giorno futuro/in corso; la data è sempre mostrata. Le fine note già trascorse e il giorno finale a mezzanotte non generano previsioni improprie.

L’associazione automatica iniziale copre solo Verona: richiede coordinate compatibili con l’area urbana (filtro prudenziale, non confine amministrativo) e una sede esplicitamente a Verona, CAP cittadino o revisione editoriale confermata. Diciture generiche di provincia, itinerari, sedi varie, posizioni mancanti o disabilitate non vengono associate. Garda e altri comuni non sono associati automaticamente senza una verifica territoriale dedicata.

Il tocco apre il pannello filtrato per evento, giorno e fascia; Tutti i giorni conserva l’area temporanea. La preferenza della Home rimane invariata finché l’utente non sceglie espressamente un’altra area dal selettore. La chiusura ritorna all’evento. Gli aggiornamenti del feed aggiornano l’anteprima aperta; la chiusura dei dettagli elimina il riferimento alla scheda precedente. Nessuna nuova API o richiesta dedicata per singolo evento.
