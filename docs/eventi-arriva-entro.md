# Corse dirette: Arriva entro

24 ottobre 2026. Versione locale, non pubblicata. Il filtro usa l'archivio ufficiale già presente; nessun servizio o dato di produzione modificato.

## Flusso

In Evento → Come arrivare → Autobus → Da dove parti? si sceglie la fermata, poi **Parti dalle** oppure **Arriva entro**. Un solo campo orario è visibile per volta. La modalità già selezionata non svuota i risultati se viene toccata di nuovo.

Quando l'evento ha un inizio futuro noto e il giorno scelto è quello dell'inizio, Arriva entro viene proposto con quell'ora, nel fuso Europe/Rome. Se l'evento è già iniziato resta inizialmente Parti dalle; l'ora originale rimane disponibile passando ad Arriva entro, ma un termine trascorso viene segnalato. Non viene ipotizzato un nuovo orario di inizio per eventi senza ora o per giorni successivi di manifestazioni su più giorni.

**Il termine riguarda la fermata vicina, non l'ingresso all'evento.** L'indicazione è visibile accanto al campo e collegata tramite aria-describedby. La camminata non è inclusa; il collegamento per verificarla e la distanza in linea d'aria restano nelle schede. Anche il riepilogo mantiene l'ora di arrivo richiesta.

## Ricerca

- Il limite viene controllato su ogni possibile fermata di discesa prima di scegliere la più vicina all'evento. Se la fermata più vicina arriva tardi, una più lontana entro 800 metri può comunque essere proposta.
- Entro 17:00 significa entro 17:00:00: un arrivo alle 17:00:01 non viene incluso. Gli orari di arrivo disponibili hanno precedenza sui passaggi usati come ripiego.
- Le corse ammesse sono ordinate per arrivo decrescente, dalla più vicina al termine; a parità si preferisce la partenza più tarda. Il limite di 12 risultati è applicato dopo filtro e ordinamento.
- Le partenze già trascorse restano escluse; sono conservati i controlli di data civile, permessi di salita/discesa, stessa corsa, giorno di servizio e cambio d'ora. Un termine ambiguo nel cambio d'ora non produce suggerimenti interpretati arbitrariamente.
- Cambiare modalità o orario svuota i risultati e invalida le risposte precedenti. Cambiare modalità durante il caricamento dell'indice non lascia bloccata la ricerca della fermata.
- Un termine assente, non valido o già trascorso ha un messaggio specifico. Lo stato vuoto permette di cambiare ora o tornare a Parti dalle; gli errori di caricamento mantengono la distinzione tra ricerca incompleta e assenza di corse nei dati disponibili.

## Verifiche

Suite completa: **467 test superati**. Cinque nuovi test coprono confine al secondo, ordinamento prima del limite, fermata alternativa ammissibile, offset dopo mezzanotte, termine ambiguo nel cambio d'ora, proposta dell'inizio futuro, assenza di un orario deducibile, termine passato, stato vuoto e cambio modalità durante il caricamento. Dopo l'ultima rifinitura del riepilogo e dei riferimenti accessibili sono stati rieseguiti con successo i sei test UI relativi alle corse dirette e ad Arriva entro.

Prova nel browser: Poeti Sociali, 24 ottobre, partenza Stazione Porta Nuova D2. Il termine 09:00 è segnalato come trascorso. Impostando 17:00 la ricerca propone arrivi 16:57, 16:54, 16:44 e così via, tutti entro il termine e in ordine decrescente. Nessun dato di evento è stato alterato per la prova. La proposta automatica per un evento futuro è verificata tramite test con orologio controllato.

Su 320×640 il documento misura 320 px senza eccedenza orizzontale; pannello e guscio misurano entrambi 589 px. Il corpo interno scorre, mantenendo visibile il ritorno. Verifica anche su 390×844. Non sono stati eseguiti test con persone, telefoni fisici o screen reader reali.

Resta da calcolare e verificare il percorso pedonale prima di promettere un arrivo in tempo all'evento. Non sono inclusi cambi o ritardi in tempo reale.
