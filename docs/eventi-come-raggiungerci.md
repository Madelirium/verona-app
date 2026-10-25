# Eventi e mobilità: prima versione del planner

## Esperienza

La scheda evento mostra titolo, immagine compatta con attribuzione visibile, data, luogo e accesso con riferimenti visivi. Le descrizioni lunghe sono espandibili; prenotazione e condizioni di accesso restano visibili. Gestione del salvato, locandina completa, crediti estesi ed esportazione .ics sono raccolti in sezioni secondarie. Salvare o confermare la presenza non prenota posti o biglietti.

L’azione principale è «Come raggiungerci»: mappa con la sede, giorno dell’evento e scelta fra piedi, auto e autobus. Piedi e auto aprono collegamenti a Google Maps con il mezzo corretto; i parcheggi rimangono un’opzione. Non si richiede il GPS dell’app per aprire questi collegamenti.

Autobus mantiene la ricerca esistente, con posizione o fermata, giorno e orario. I risultati mostrano una mappa fissa sopra l’elenco, riducibile per lasciare più spazio alle proposte. L’intestazione di ciascuna proposta è un pulsante: selezionandola si aggiornano linea evidenziata, orari e fermate. «Vedi viaggio» apre il riepilogo completo; direzione e dettagli ulteriori sono espandibili. Modifica e annullamento mantengono i controlli già introdotti.

## Precisione e limiti

I punti delle fermate e gli orari provengono dalle chiamate della corsa dell’archivio ATV. La geometria proviene da OSM ed è sempre indicata come orientativa. Si mostra un tracciato solo quando include salita e discesa nel loro ordine: questo controllo non dimostra che variante e percorso della specifica corsa coincidano. Si disegna l’itinerario OSM disponibile, non un segmento sintetizzato dai punti delle fermate. In assenza di corrispondenza o con errore di caricamento rimangono punti e orari, senza linee inventate.

Il planner autobus cerca ancora corse senza cambi. Non sono introdotti ritardi in tempo reale o disponibilità dei parcheggi. Le camminate automatiche online richiedono la configurazione separata del fornitore già predisposta. La ricerca per via/indirizzo non è inclusa: richiede un geocoder idoneo e configurato. Il campo corrente cerca fermate. Non sono creati account o servizi a pagamento.

## Verifiche

518 test completi superati. Dopo l’ultimo affinamento dell’intestazione sono stati rieseguiti i test mirati di ricerca, planner e mappa. Build rigenerata. I test verificano anche geometrie in direzione opposta o incomplete, risposta tardiva dopo chiusura, opzioni calendario secondarie e mantenimento delle condizioni di accesso.

Prova nel browser il 25 ottobre 2026: dettaglio Poeti Sociali alla Gran Guardia, modalità piedi/auto, parcheggi, ricerca da Porta Nuova D1 e proposta dalla D2; selezione reale fra linee 95, 93 e 91; mappa aggiornata dalla 95 alla 93 con orari differenti. Verificati 390 e 320 px, assenza di scorrimento orizzontale e riduzione della mappa. Non è una certificazione di accessibilità né una prova con partecipanti reali.

Anteprima locale http://127.0.0.1:4177/. Nessuna pubblicazione online eseguita in questo intervento.
