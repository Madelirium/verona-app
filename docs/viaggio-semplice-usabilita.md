# Viaggio verso un evento: primo intervento di semplificazione

Il riepilogo presenta quattro azioni numerate: raggiungere la fermata, salire sul bus, scendere, raggiungere l’evento o la destinazione del ritorno. La prima informazione è l’arrivo stimato completo, se disponibile, oppure la discesa programmata dal bus con camminata da verificare.

Le stime personali sono esplicitamente riconoscibili. Una verifica delle camminate aggiorna il riepilogo quando si torna indietro; cambiando fermata, una vecchia stima non viene applicata alla nuova discesa.

Le fermate intermedie, la modifica della discesa e il collegamento a Google Maps si trovano in sezioni espandibili. Le azioni fisse sono «Altri autobus» e «Vedi il ritorno»; nel ritorno rimane «Altri ritorni». Il comando in alto mostra «Indietro».

Verifica locale: 510 test automatici superati, build completata, prova andata/ritorno con dati reali Porta Nuova–Gran Guardia. A 320 px non compare scorrimento orizzontale e le azioni fisse misurano 48 px; il comando Indietro misura almeno 44 px. Anteprima su http://127.0.0.1:4177/.

Questo intervento riguarda il riepilogo; il percorso iniziale di ricerca mantiene ancora diversi pannelli. Il passo successivo è semplificare la scelta di partenza e orario e confrontare le proposte nello stesso formato. Occorre poi una prova con persone reali di diversa familiarità digitale: le verifiche tecniche non dimostrano da sole l’usabilità nella fascia 50–70 anni.

## Secondo intervento: ingresso e ricerca guidata

Problemi osservati: l’evento apriva prima le indicazioni a piedi, poi la mappa autobus, poi il modulo; la posizione chiedeva di scegliere la fermata prima di conoscere le corse utili; il pulsante di ricerca poteva restare sotto lo scorrimento; la modifica poteva mostrare il modulo fuori vista.

Il comando fisso nel dettaglio evento è ora «Vai in autobus» e apre direttamente partenza e orario. Auto, mappa e indicazioni a piedi rimangono disponibili come azione secondaria. Se la sede non è confermata non si propone una ricerca con coordinate inventate.

La posizione si richiede solo al clic. Dopo il rilevamento, «Mostra autobus» confronta fino a cinque fermate con servizio entro 2 km, senza imporre una scelta manuale. La ricerca resta limitata alle corse senza cambi e non garantisce copertura di ogni itinerario. Il modulo permette sempre di scrivere una fermata: questa azione cancella il punto GPS dalla ricerca corrente. Non si attiva il servizio pedonale senza l’opzione esplicita e la relativa informativa.

La ricerca conserva partenza e orario al rientro; «Modifica ricerca» riporta il modulo all’inizio senza mettere a fuoco un campo di testo. Per eventi su più giorni il giorno è modificabile e invalida le corse precedenti, mantenendo la partenza. Date esterne all’evento, all’archivio o senza sede utilizzabile sono rifiutate con spiegazione. Gli eventi di un giorno mostrano la data nel contesto, senza un selettore superfluo.

Il pulsante di ricerca e l’annullamento restano in una barra fissa. I campi misurano almeno 48 px e il testo degli input 18 px. Nessuna corsa trovata offre «Cerca partenze successive» oppure «Cambia la partenza». Errori di caricamento mantengono il comando di riprova e dichiarano risultati incompleti.

Verifica: 514 test completi superati; dopo la correzione dello scorrimento è stato rieseguito e superato anche il test specifico di modifica/ripristino. Build completata. Browser a 320 e 390 px: nessuno scorrimento orizzontale, ricerca fissa raggiungibile, focus iniziale su Indietro. Provato percorso manuale reale Porta Nuova D1 → fermata alternativa D2 → evento Gran Guardia → ritorno. Geolocalizzazione, rifiuto, timeout e risposte tardive sono verificati con test automatici; non è stata acquisita la posizione personale nel browser. Non è stata eseguita una certificazione WCAG completa.

## Prova con persone reali

Coinvolgere 5–6 persone fra 50 e 70 anni con familiarità digitale diversa, usando il loro telefono e senza istruzioni sui pulsanti. Chiedere: trovare un evento e raggiungerlo; spiegare quando si arriva all’evento e dove si scende; modificare la partenza; trovare il ritorno; proseguire con posizione negata o nessuna corsa.

Per ciascun compito registrare completamento autonomo, aiuti richiesti, errori, ritorni indietro e interpretazione degli orari. Chiedere alla fine «Come hai capito a che ora arriverai?». Una confusione fra discesa dal bus e arrivo all’evento è un problema prioritario anche se il compito sembra completato. Correggere i problemi ricorrenti e ripetere la prova prima di dichiarare l’esperienza semplice per la fascia interessata.

Nessuna pubblicazione effettuata. La configurazione del servizio pedonale online rimane distinta dalla prova locale.
