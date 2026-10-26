# Ricerca autobus estesa — 25 ottobre 2026

Corretto il caso Duomo–ex campo di Montorio: il limite di 800 metri escludeva Ponte Florio B (circa 846 metri in linea d’aria) e il limite delle cinque fermate GPS escludeva San Fermo, servita dalla 98.

Le fermate vicine all’evento vengono cercate prima entro 800 metri, poi entro 1,5 e 2 km se non ci sono risultati. Il pianificatore considera tutte le fermate GPS entro 2 km e tutte le alternative entro 300 metri dalla fermata selezionata manualmente. Gli arrivi e il ritorno consentono fermate entro 2 km dalla destinazione. Distanze e messaggi indicano i limiti della ricerca e la necessità di verificare il percorso pedonale. Per il GPS, senza verifica pedonale, una soglia ottimistica di accesso (distanza in linea d’aria a 2 m/s più due minuti per salire) esclude partenze impossibili; non conferma la raggiungibilità delle restanti.

Restano corse senza cambi. Le camminate complete vengono confermate soltanto dove il servizio pedonale è disponibile e la verifica riesce. La posizione GPS resta temporanea. Nessuna modifica al layout a viewport o alle modalità di pubblicazione.

Regressioni sui dati reali: evento del 25 ottobre, Ponte Florio e 98 da San Fermo; controllo GPS Duomo alle 11:20 e conservazione delle fermate oltre le prime cinque; stato vuoto con limite esplicito. Sorgenti rigenerati con npm run build.

Verifica finale: 287 test su calendario, corse dirette, indice fermate e pianificazione superati. Build completata. La suite generale ha incontrato blocchi dell’ambiente su connessioni localhost (EACCES) e rinomina di file temporanei (EPERM); il problema di ordine nella scheda ritorno emerso durante quella prova è stato corretto e verificato nella suite mirata. Modifica locale, non pubblicata.

Rilascio del 26 ottobre 2026: correzioni riportate sull’ultima versione master preservando i successivi aggiornamenti dell’app. Build rigenerata e suite completa: 551 test superati. Pubblicazione tramite workflow GitHub Pages.
