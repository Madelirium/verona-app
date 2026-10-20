# Eventi salvati: prossimi e passati

I Salvati hanno due viste: Prossimi (calendario) ed Eventi passati (elenco dal più recente). Un evento resta prossimo per tutta la data finale, anche quando la fonte contiene un orario di fine. Passa nello storico all’inizio della data successiva, nel fuso Europe/Rome. Un evento dal 19 al 22 passa nei passati quando inizia il 23; la data di salvataggio non conta.

Un timer raggiunge la prossima mezzanotte locale, calcolando anche i cambi di ora. Alla ripresa della scheda viene comunque ricontrollata la data. Non occorre riavviare il server; a browser chiuso il calcolo avviene alla successiva apertura.

Le preferenze restano in `verona-events-v1`. Una copia dei dati degli eventi salvati è conservata in `verona-saved-snapshots-v1`, migrando i preferiti già esistenti ancora presenti nel catalogo. Le fonti aggiornate hanno precedenza sulla copia locale. Gli eventi rimossi dal catalogo restano consultabili grazie alla copia. Non è possibile ricostruire eventi già scomparsi prima dell’introduzione dello storico se non è disponibile alcuna copia.

La rimozione esplicita dai Salvati elimina anche la copia storica dell’evento. Le presenze confermate sono mantenute; nel dettaglio di un evento passato non si propone una nuova conferma. Nessuna sincronizzazione con altri dispositivi. Cancellare i dati del browser elimina lo storico. Se il browser impedisce il salvataggio, compare un messaggio che lo storico è disponibile solo durante la visita.

Verifiche: transizione alle 00:00 Europe/Rome, eventi di più giorni, eventi futuri salvati prima, orari di fine nello stesso giorno, cambio di ora (23/25 ore), copie persistenti dopo la rimozione dal catalogo e cancellazione esplicita. Verifica mobile a 320 px.
