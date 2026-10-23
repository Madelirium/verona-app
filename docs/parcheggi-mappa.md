# Parcheggi: mappa e destinazione

## Revisione del flusso: scheda compatta e informazioni

Sulla mappa la selezione mostra nome, tipologia, eventuale distanza e il pulsante Informazioni e servizi. Il comando Portami qui resta separato e visibile. Indirizzo e azioni secondarie sono nel dettaglio, evitando che la scheda copra inutilmente la mappa. In Elenco restano anche indirizzo e metadati completi.

Il nuovo pannello Informazioni e servizi mostra indirizzo, tipologia comunale, contatto telefonico se interpretabile senza ambiguità e sito del catalogo. Tariffe, orari e posti liberi non sono presenti nel dataset: questo viene dichiarato esplicitamente e si rinvia al sito indicato. Un contatto assente non produce un numero fittizio; testi ambigui rimangono testo consultabile.

Con una destinazione o un evento, il pannello aggiunge il riepilogo Dal parcheggio alla destinazione, distanza in linea d’aria e collegamento al percorso a piedi. Non ricava minuti di cammino dalla distanza. Il collegamento Fermate e linee vicine riusa il pannello ATV esistente. Chiuderlo riporta al dettaglio; chiudere il dettaglio ripristina il pulsante sulla scheda selezionata. L’azione per raggiungere il parcheggio resta fissa sotto il contenuto scorrevole.

Verifica: build rigenerata; 402 test superati (13 relativi ai parcheggi), con controllo di telefoni, dati mancanti, origini/destinazioni distinte, passaggio mappa/elenco e ritorno senza alterare preferenze. Controllo browser a 320 × 740 e 390 × 844, apertura della scheda da tastiera e ritorno dal pannello autobus. Nessuna nuova API o dipendenza, nessun cambiamento al catalogo dati. Pubblicazione non inclusa.

La sezione riusa il catalogo del Comune già incluso nell'app: nessuna disponibilità di posti in tempo reale, né tariffe ricavate per deduzione. Gratuiti significa tipologia indicata dal Comune, non posti attualmente disponibili.

Mappa iniziale con tutti i parcheggi del catalogo e selezione diretta. I punti hanno un'area interattiva di 44 px e possono essere attivati da tastiera. La scheda scorre internamente e il pulsante di navigazione resta visibile. La vista Elenco mantiene accessibili tutti i risultati anche senza mappa o sfondo.

La ricerca usa esclusivamente parcheggi, attività e sedi di eventi geolocalizzati già presenti nel catalogo. I parcheggi nei risultati sono esplicitamente denominati come tali per evitare di confonderli con monumenti omonimi. Non è una ricerca di tutti gli indirizzi di Verona. In caso di assenza di un luogo si può scegliere un punto sulla mappa, o spostarla e confermare il centro tramite un pulsante.

Vicino a me richiede il permesso solo su azione dell'utente, ha timeout, gestione del rifiuto e controllo dei risultati fuori tempo dopo chiusura o cambio destinazione. Le coordinate non vengono salvate. Sull'anteprima Wi-Fi HTTP si propone la scelta manuale o la versione HTTPS. La mappa carica normalmente tile OpenStreetMap; i percorsi Google Maps si aprono solo premendo i rispettivi collegamenti.

Distanze in linea d'aria, ordinamento crescente dal punto e raggio di 1,5 o 3 km. Da un evento restano il punto dell'evento, il filtro di distanza e il percorso a piedi dal parcheggio.

## Autobus dal parcheggio

Ogni scheda offre Autobus nelle vicinanze. Il pannello riusa l’indice ufficiale ATV già incluso nell’app, con cache condivisa agli eventi. Mostra fino a cinque fermate entro 400, 800 o 1200 metri in linea d’aria, ordinate per distanza. Nella data coperta esclude le fermate senza partenze programmate; fuori copertura indica che le linee presenti non confermano il servizio.

Gli orari si aprono con linea, codice fermata e giorno precompilati. I percorsi vengono caricati su richiesta e aperti soltanto quando una variante contiene lo stesso codice fermata; la mappa evidenzia quel punto. Il tracciato OSM rimane indicativo. Il percorso a piedi ha origine nel parcheggio e destinazione nella fermata scelta.

Chiusura, errori di caricamento, cambio data e cambio raggio non alterano la mappa parcheggi. Le risposte tardive vengono ignorate. Nessun arrivo in tempo reale o tempo di cammino viene ricavato dalla distanza geometrica.
