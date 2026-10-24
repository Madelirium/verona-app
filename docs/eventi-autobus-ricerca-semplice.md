# Eventi e autobus: ricerca più semplice

Prova locale del 24 ottobre 2026. Non pubblicata.

## Cambiamento

Nel percorso Evento → Come arrivare → Autobus → Trova una corsa diretta, la ricerca e i risultati diventano due momenti distinti. Dopo una ricerca riuscita, il modulo si chiude e lascia visibili evento, giorno, fermata scelta e criterio orario. «Modifica ricerca» riapre i campi senza perdere la scelta e permette di tornare ai risultati. Se cambia un criterio, i risultati precedenti vengono rimossi. Con zero risultati o errori il modulo resta disponibile.

Si mostrano tre corse alla volta; «Altre corse» ne rivela altre tre, senza nuove richieste di rete. L’ordine continua a essere quello del motore esistente (partenza crescente, oppure arrivo più vicino al limite scelto). Nessuna corsa è etichettata arbitrariamente come migliore. La ricerca resta limitata a dodici risultati; non è un elenco di tutte le possibilità con cambi.

Le schede hanno testo più leggibile e un’unica azione principale, «Vedi viaggio». Gli orari di salita e discesa precedono i nomi delle fermate. Il collegamento pedonale Google Maps è nel riepilogo del viaggio, dove è chiaro da quale fermata inizia. Il calcolo pedonale integrato resta la precedente prova locale, senza attivazione sul dominio pubblico.

Il codice fermata esatto precede le corrispondenze parziali. La selezione esplicita della fermata è sempre richiesta: non si sceglie automaticamente un lato della strada.

## Accessibilità e verifiche

Contesto e pulsante di modifica restano fuori dal contenuto scorrevole. Una sola area principale scorre nel pannello. Pulsanti da almeno 44 px, campi da 16 px, stato di espansione del modulo esposto alle tecnologie assistive. Il focus passa ai risultati dopo la ricerca e alla prima nuova scheda dopo «Altre corse». Nessuna tastiera aperta automaticamente entrando nella ricerca.

482 test completi superati; nuove verifiche su paginazione progressiva, modifica e annullamento della modifica, invalidazione dei risultati dopo cambio criterio, stato vuoto, ricerca per codice esatto e accesso pedonale dal riepilogo. Prova nel browser con dati reali. Non è una validazione con partecipanti anziani o turisti.

## Prossimi interventi

Verificare questa prova con utenti prima di estendere il modello alle altre viste autobus. Restano da decidere il fornitore pubblico per il percorso a piedi e il calcolo dell’arrivo alla sede comprensivo della camminata. Questa modifica non cambia il significato di «Arriva entro»: il termine riguarda ancora la fermata.

## Pubblicazione

Rilascio online richiesto dall’utente il 24 ottobre 2026: inclusi ricerca semplificata e localizzazione della partenza autobus. Il calcolo pedonale FOSSGIS resta limitato alla prova locale.
