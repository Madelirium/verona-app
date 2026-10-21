# Prova UX Autobus — scheda fermata condivisa

Prima iterazione locale dello studio UX del 21 ottobre 2026. Nessuna pubblicazione online in questo passaggio.

## Cambiamenti

- Ricerca ed esplorazione della mappa usano lo stesso componente della fermata, con scelta esplicita della linea se ne passano più di una. Non viene selezionato arbitrariamente il primo numero.
- Direzione tratta dalle corse ufficiali, ore grandi e prossime tre partenze programmate. Se la prima corsa è in un giorno successivo viene spiegata l'assenza di altre partenze oggi e mostrata la data della corsa. Le linee senza servizio nel giorno sono marcate Altri giorni quando il calendario è noto.
- Nella mappa le partenze compaiono direttamente dopo la scelta della linea. I pulsanti conservano la propria identità e il focus durante caricamenti, errori e aggiornamenti dei tracciati.
- Le partenze si rinnovano ogni minuto usando la linea già in cache; il timer viene annullato alla chiusura. Non è un aggiornamento degli orari dalla fonte né un servizio in tempo reale.
- Orari del giorno apre l'intera giornata con fermata e linea già impostate. Il riepilogo compatto sostituisce i due selettori già noti; Cambia linea o fermata li rende nuovamente disponibili.
- Dalla ricerca si chiude il dialog della fermata prima di aprire gli orari: la freccia o Escape riapre la stessa fermata/linea e ripristina il focus. La mappa conserva il proprio contesto sottostante.
- Schede delle linee con titolo a 16 px, suggerimento visibile Orari e fermate e rimozione del pulsante Partenze duplicato. Azioni secondarie a 48 px e caratteri più leggibili nella scheda fermata.

## Verifiche

Test su scelta esplicita, destinazione, identità dei pulsanti, risposta tardiva di un'altra linea, apertura degli orari con codice e ritorno, aggiornamento dalla cache e cancellazione del timer. Restano coperti errori di rete, archivio fuori validità, mappe senza tracciato e confronto delle linee.

Prova browser con Via Santini B, codice 1974, linee 24/96: ricerca, scelta 24, destinazione Piazza Righetti, tre partenze, giornata completa e ritorno; stesso flusso dalla mappa. Controllo su telefono da 320 px del focus e dell'assenza di overflow orizzontale. UI verificata anche a 430 px.

## Iterazioni successive

Questa prova implementa la prima priorità dello studio. Preferiti di fermata, Vicino a me come ingresso principale, raggruppamento dei punti sulla mappa, inglese e riorganizzazione completa della schermata iniziale restano interventi successivi. Il layout della mappa mantiene un pannello più alto per ospitare le partenze: il contenuto scorre internamente, senza aggiungere uno scroll della pagina.
