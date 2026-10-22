# Notizie, validità e scadenze personali

La dashboard mantiene la griglia attuale. Il riquadro comunale sceglie una pubblicazione pertinente: scadenze vicine, zona scelta e informazioni di mobilità/servizi. Esclude termini conclusi, revoche riconosciute e riferimenti stagionali esplicitamente precedenti. Le notizie senza scadenza vengono proposte in home solo se pubblicate negli ultimi 14 giorni; la raccolta completa resta accessibile in Notizie.

## Validità distinta dalla pubblicazione

Il filtro «Stato della comunicazione» distingue scadenze aperte, scadenze/pubblicazioni concluse, validità da verificare, notizie informative e revoche/annullamenti espliciti nel titolo. Nessun avviso diventa automaticamente attivo solo perché pubblicato recentemente.

Il campo comunale `dead_line` è conservato come fine pubblicazione, separato dal termine operativo. I termini operativi sono estratti da titolo, sintesi e corpo della fonte, solo con espressione esplicita e data completa di anno. Non vengono inventati anni o orari. Date discordanti, proroghe multiple e orari non univoci richiedono verifica. L'evidenza testuale è mostrata nei dettagli.

La scadenza con ora termina all'istante indicato nel fuso Europe/Rome; senza ora rimane aperta per tutto il giorno. Il frontend aggiorna gli stati ogni minuto e al ritorno nella scheda, senza ricaricare i dati dalla rete. Un dettaglio rimasto aperto non consente di aggiungere una scadenza già conclusa.

L'importatore riusa le risorse comunali già lette per le immagini. Se il dettaglio non è disponibile, usa solo titolo/sintesi e segnala il limite. Restano validi i meccanismi precedenti di conservazione dei dati quando una fonte fallisce. La pianificazione GitHub esistente include l'arricchimento al prossimo aggiornamento, dopo la pubblicazione del codice.

## Agenda

«Aggiungi scadenza alla mia agenda» salva una scelta locale separata dai preferiti degli eventi e dai segnalibri delle notizie. Le scadenze appaiono nel giorno corretto, nei conteggi della settimana/mese e nei programmi personali. Non prevedono «Partecipo», prenotazioni o invio di domande. Le concluse compaiono in «Passati». È disponibile l'esportazione ICS, senza sincronizzazione automatica o notifiche push.

Lo snapshot personale resta disponibile se la pubblicazione sparisce dalla raccolta. Se la stessa fonte cambia e fornisce una nuova scadenza, l'agenda usa il valore corrente. Se non fornisce più un termine verificabile, conserva l'ultima data salvata con avviso di ricontrollo. Una revoca pubblicata in un articolo separato non viene automaticamente collegata al bando originale.

## Verifica

Test su data con/senza ora, scadenza esatta e mezzanotte italiana, cambio d'ora, anno mancante, termini discordanti, campo fine pubblicazione, errori del dettaglio, filtri annullabili, rilevanza della zona, persistenza, rimozione, agenda e conclusione senza ricaricare. Dati e frontend vengono rigenerati localmente; nessuna pubblicazione GitHub è eseguita da questo intervento.
