# Autobus: fermata, partenza, destinazione

Prova locale del 23 ottobre 2026. Nessuna pubblicazione GitHub inclusa.

La scheda condivisa della fermata offre Giorno e direzione: un pannello con
data limitata alla validità dell'archivio e destinazioni ricavate dalle corse
ufficiali che consentono la salita alla fermata. Le scelte si applicano soltanto
con Mostra partenze; chiusura e Indietro annullano la bozza.

Per oggi restano le prossime partenze, con eventuale prosecuzione nei sette
giorni coperti. Ogni passaggio nei giorni successivi mantiene la propria data.
Per un'altra data vengono mostrate le partenze di quel giorno civile, incluse
le corse notturne del servizio precedente, senza attribuirle al giorno errato.
La direzione è filtrata prima del limite dei risultati. Cambiare linea azzera
la direzione precedente, conservando il giorno scelto.

Data e direzione sono visibili anche nella scheda compatta. La validità completa
è consultabile nel pannello e nella scheda espansa. Orari del giorno conserva
le scelte quando apre la consultazione ufficiale completa.

Le partenze sono apribili sia dalla mappa sia dalla scheda dell'elenco.
Aprire una partenza mostra esclusivamente le fermate della corsa corrispondente.
Scegli arrivo evidenzia una destinazione e mantiene in vista il riepilogo con
giorno, orario e minuti dalla salita. Viene distinto l'arrivo ufficiale dal
passaggio quando manca un orario di arrivo separato. Cambiare corsa azzera la
destinazione; ricerca, scorrimento e focus sono gestiti nel pannello.

La scheda compatta selezionata lascia una partenza leggibile e scorribile anche
a 320 px. La mappa e i tracciati OSM restano quelli esistenti: nessun tracciato
viene presentato come geometria esatta di una singola corsa e nessun ritardo
in tempo reale viene dedotto dagli orari programmati.

Verifiche: date civili/notturne, filtri prima del limite, data fuori validità,
annullamento, apertura corsa dall'elenco, selezione arrivo, durata, cambio corsa,
Indietro nel pannello annidato e regressioni di navigazione. Prova con Via
Santini B (1974), linea 24, sabato 24 ottobre; ricerca e selezione di Piazza
Righetti. Verifica visiva a 320 e 390 px, frontend rigenerato con npm run build.

## Riepilogo dopo la scelta dell'arrivo

La scelta ora apre un pannello dedicato Il tuo viaggio, con due schede per
salita e destinazione, date e orari completi, durata e numero di fermate
intermedie. La sequenza sottostante termina alla specifica occorrenza scelta:
eventuali fermate successive e ripetizioni ulteriori non entrano nel viaggio.
Il cambio giorno viene conservato e l'orario di passaggio resta distinto
dall'arrivo quando l'archivio non fornisce un arrivo separato.

Cambia arrivo, chiusura e Indietro tornano alla corsa mantenendo ricerca,
scorrimento e selezione. Altre partenze chiude riepilogo e corsa, tornando alla
fermata. Intestazione e azioni sono fisse; riepilogo e fermate scorrono insieme.
Non viene salvata una nuova preferenza e non viene avviata una prenotazione.

Verifiche aggiuntive: tratto limitato all'arrivo, fermate ripetute, passaggio
di mezzanotte, riepilogo e ritorno alla scelta con Indietro. Prova reale sulla
linea 24, Via Santini B → Via Mercantini 20.
