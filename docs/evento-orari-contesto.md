# Evento e orari della fermata

24 ottobre 2026. Secondo intervento locale dopo la verifica UX evento/trasporti. Nessuna pubblicazione e nessuna modifica a servizi o dati di produzione.

## Comportamento

- Sia i pulsanti delle linee nell'elenco delle fermate vicine all'evento, sia i popup sulla mappa passano agli orari una copia minima del riferimento all'evento: titolo, date originali e giorno scelto. Non vengono inviati a servizi esterni.
- La schermata mostra Orari della fermata, un riferimento compatto e apribile all'evento con data/orario, e Linea … · Partenze da … . La spiegazione espandibile distingue partenze dalla fermata selezionata e itinerario per raggiungere l'evento.
- La freccia di ritorno è denominata Torna alle fermate dell'evento; il pannello sottostante conserva evento, giorno e contenuto. Nessuna duplicazione dei pannelli esistenti.
- Cambiare la data del servizio non cambia il giorno scelto per l'evento: un messaggio segnala la differenza. Tornando al giorno originale il messaggio scompare.
- Il contesto resta disponibile in caso di errore di caricamento, riprova o data fuori dalla copertura dell'archivio. Una normale apertura di Autobus non eredita il riferimento all'evento precedente.
- Il selettore completo indica Fermata di partenza. Non sono aggiunti calcoli di arrivo, suggerimenti di direzione o garanzie di raggiungere l'evento.

Sorgenti: `public/event-bus.js`, `public/bus-official.js`, `public/calendar.template.html`, `public/bus-catalog.css`. Frontend rigenerato in `public/index.html` e service worker tramite `npm run build`.

## Verifiche

453 test complessivi superati. Tre nuovi test verificano accesso da elenco e popup, contesto/orario/fermata, ritorno, separazione delle date, rimozione del riferimento nella consultazione normale, errore e riprova e fuori copertura.

Prova nel browser con Poeti Sociali, 24 ottobre 2026, Gran Guardia, fermata Piazza Bra Arena A, linea 11: riferimento e orario visibili, cambio data al 25 ottobre con messaggio e zero partenze della 11 coerenti con l'archivio; ritorno all'elenco fermate del 24 e riapertura degli orari con data originale. Verificata la spiegazione apribile.

Schermi simulati: 320×640, 390×844 e 430×844. Nessuna eccedenza orizzontale del documento negli stati misurati. A 320 px l'elenco resta scorrevole anche con avviso di data diversa; il riferimento espanso ha altezza limitata e scorrimento interno. A 390/430 px rimangono rispettivamente circa 281/302 px per l'elenco nello stato normale osservato.

Non verificati qui telefoni fisici, screen reader e testo al 200%. Restano da progettare la scelta effettiva della fermata di salita verso l'evento, la verifica della direzione e l'eventuale confronto dell'arrivo con l'inizio dell'evento. Il riepilogo di una corsa e della destinazione scelta continua a descrivere soltanto quella corsa; non dimostra da solo di raggiungere l'evento.
