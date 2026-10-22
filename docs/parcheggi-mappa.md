# Parcheggi: mappa e destinazione

La sezione riusa il catalogo del Comune già incluso nell'app: nessuna disponibilità di posti in tempo reale, né tariffe ricavate per deduzione. Gratuiti significa tipologia indicata dal Comune, non posti attualmente disponibili.

Mappa iniziale con tutti i parcheggi del catalogo e selezione diretta. I punti hanno un'area interattiva di 44 px e possono essere attivati da tastiera. La scheda scorre internamente e il pulsante di navigazione resta visibile. La vista Elenco mantiene accessibili tutti i risultati anche senza mappa o sfondo.

La ricerca usa esclusivamente parcheggi, attività e sedi di eventi geolocalizzati già presenti nel catalogo. I parcheggi nei risultati sono esplicitamente denominati come tali per evitare di confonderli con monumenti omonimi. Non è una ricerca di tutti gli indirizzi di Verona. In caso di assenza di un luogo si può scegliere un punto sulla mappa, o spostarla e confermare il centro tramite un pulsante.

Vicino a me richiede il permesso solo su azione dell'utente, ha timeout, gestione del rifiuto e controllo dei risultati fuori tempo dopo chiusura o cambio destinazione. Le coordinate non vengono salvate. Sull'anteprima Wi-Fi HTTP si propone la scelta manuale o la versione HTTPS. La mappa carica normalmente tile OpenStreetMap; i percorsi Google Maps si aprono solo premendo i rispettivi collegamenti.

Distanze in linea d'aria, ordinamento crescente dal punto e raggio di 1,5 o 3 km. Da un evento restano il punto dell'evento, il filtro di distanza e il percorso a piedi dal parcheggio.

## Autobus dal parcheggio

Ogni scheda offre Autobus nelle vicinanze. Il pannello riusa l’indice ufficiale ATV già incluso nell’app, con cache condivisa agli eventi. Mostra fino a cinque fermate entro 400, 800 o 1200 metri in linea d’aria, ordinate per distanza. Nella data coperta esclude le fermate senza partenze programmate; fuori copertura indica che le linee presenti non confermano il servizio.

Gli orari si aprono con linea, codice fermata e giorno precompilati. I percorsi vengono caricati su richiesta e aperti soltanto quando una variante contiene lo stesso codice fermata; la mappa evidenzia quel punto. Il tracciato OSM rimane indicativo. Il percorso a piedi ha origine nel parcheggio e destinazione nella fermata scelta.

Chiusura, errori di caricamento, cambio data e cambio raggio non alterano la mappa parcheggi. Le risposte tardive vengono ignorate. Nessun arrivo in tempo reale o tempo di cammino viene ricavato dalla distanza geometrica.
