# Autobus: mappa e singole corse

Aggiornamento del 21 ottobre 2026. Questa nota descrive il risultato finale delle prove precedenti.

- Autobus si apre sulla mappa nella schermata principale, con navigazione globale fissa. Titolo e pulsanti superiori della sezione sono rimossi per recuperare spazio.
- Una tendina ricercabile per numero o destinazione seleziona la linea. La tastiera si attiva solo toccando il campo di ricerca. La lente apre la ricerca delle fermate.
- Il menu laterale raccoglie Alla fermata, Percorso completo, Elenco e servizi e Opzioni. Dall'elenco si torna alla mappa conservando il contesto compatibile con i filtri.
- Le fermate sono raggruppate ai livelli di zoom cittadini. La cache evita di ricostruire l'indice a ogni spostamento, invalidandosi al cambio di dati o filtri.
- La scheda fermata dispone di tre dimensioni e permette di scorrere fino a trenta partenze, anche da compatta. L'aggiornamento periodico mantiene la posizione nell'elenco.
- Toccando una partenza si apre la sequenza delle fermate di quella corsa ufficiale, dalla salita in avanti, con ricerca della destinazione, orari e minuti dalla partenza. Gli arrivi usano il campo di arrivo quando disponibile, altrimenti il passaggio programmato.
- L'identità della corsa, la data di servizio e l'indice della fermata distinguono varianti, fermate ripetute e corse dopo mezzanotte.

Gli orari sono programmati, senza ritardi in tempo reale. I tracciati OSM restano indicativi e possono essere assenti per alcune linee; in quel caso rimangono disponibili fermate e orari ufficiali.

Verifica locale: 288 test superati; controlli visivi e flussi su schermi da 320 e 390 px, ricerca, annullamento, scelta linea, ritorno elenco/mappa e consultazione della corsa.
