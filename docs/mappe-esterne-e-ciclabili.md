# Indicazioni esterne e mappa ciclabile

Consegna locale del 26 ottobre 2026.

“Come raggiungerci” apre direttamente le mappe del dispositivo. I link
contengono solo le coordinate pubbliche della sede per la giornata scelta:
la partenza non viene richiesta né trasmessa da Verona in Tasca. Mezzo, orario
e navigazione vengono gestiti nell'app esterna o nel relativo sito.

Android usa un intent generico `geo`, senza imporre un'app: il sistema usa il
gestore configurato o propone la sua scelta. Il fallback dei browser compatibili
apre Google Maps sul web. iPhone/iPad usa il collegamento Apple Maps gestito
dal sistema; la scelta della navigazione predefinita dipende da versione,
regione e app installate. Desktop apre Google Maps nel browser.
Non è possibile leggere dalla web app quale navigatore sia predefinito.
Il percorso Android apre il punto sulla mappa, da cui scegliere le indicazioni.

“Altre mappe”, sotto la mappa del luogo, mantiene due collegamenti espliciti
come alternativa. La precedente preferenza interna non viene più letta né
scritta: valgono le impostazioni del dispositivo, dove supportate.
Chiudere il pannello alternativo riporta al dettaglio senza perdere evento o giorno.
Le sedi non confermate non generano link di navigazione.

La build non incorpora più `public/event-travel.js` e il suo confronto
automatico A piedi / Autobus / Auto. Il codice storico e i test restano nei
sorgenti come riferimento; il servizio autobus continua a offrire fermate,
linee, mappe e orari.

In Servizi utili → Ciclabili si consulta CyclOSM, una cartografia ciclabile
pronta basata su OpenStreetMap. Sono disponibili zoom, spostamento, ritorno
al centro di Verona, legenda originale e apertura della mappa completa.
Il pannello non richiede GPS e non calcola itinerari. Copertura e chiusure
possono non essere aggiornate; non è una certificazione comunale della rete.
La data di ciascun tratto non è disponibile. Non vengono conservate copie
dei dati ciclabili né scaricate mappe offline.

Fonti e formati:

- https://developers.google.com/maps/documentation/urls/get-started
- https://developer.apple.com/documentation/mapkit/unified-map-urls
- https://www.cyclosm.org/
- https://www.cyclosm.org/legend.html

Verifiche: build di 1.307 eventi sui dati online aggiornati, 562 test del pacchetto di rilascio superati. Provate le
aperture web reali di Google e Apple con le coordinate dell'evento, ritorno
con Escape e focus ripristinato. I test verificano il collegamento generico
Android con fallback, iPhone/iPad, sede del giorno, assenza di GPS e memoria.
Verificato il pannello a 320 px senza scorrimento orizzontale, link principali
alti 56 px; mappa ciclabile caricata realmente. Restano da provare su dispositivi
fisici iPhone e Android i passaggi alle rispettive app native: la prova browser
non certifica quei passaggi.

Pacchetto di rilascio preparato il 26 ottobre 2026 sulla versione online aggiornata; pubblicazione tramite GitHub Pages.
