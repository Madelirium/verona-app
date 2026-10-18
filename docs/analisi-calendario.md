# Analisi del calendario

18 ottobre 2026. Esame dei sorgenti, degli stili, dei test e del catalogo incorporato. Non sono state modificate le funzionalità. Le valutazioni dimensionali derivano dal CSS; manca una verifica visiva e assistiva su dispositivi reali.

## Direzione consigliata

Privilegiare un'**agenda giornaliera con selettore settimanale**, conservando il mese in un pannello dedicato. Il calendario deve aiutare prima a scegliere cosa fare e poi a esplorare le date. La dashboard della Home resta invariata.

L'intestazione, i controlli della data e la navigazione inferiore restano fissi; scorre soltanto l'elenco degli eventi. È coerente con il vincolo di una sola schermata da app.

## Situazione attuale

- Catalogo incorporato: 964 appuntamenti riconducibili a 99 URL di manifestazioni/serie, raccolto il 17 ottobre. Gli URL non garantiscono la deduplicazione fra fonti differenti.
- Il 18 ottobre risultano 12 appuntamenti, uno per ciascuna delle 12 serie coinvolte: 10 comunali e 2 Veronafiere. È un conteggio del catalogo, non una verifica che tutti si svolgano effettivamente a Verona o siano confermati.
- Nove dei 12 appuntamenti del giorno hanno un punto utilizzabile sulla mappa; due non hanno una sede testuale importata. La mappa non può sostituire l'elenco completo.
- La griglia mensile precede l'elenco del giorno. Sul telefono i titoli nei giorni sono nascosti e compare un piccolo indicatore.
- Ricerca e fonte sono condivise con Scopri; nello stesso pannello compaiono anche periodo e selezione editoriale, esplicitamente limitati alla vista Scopri.
- Mi interessa, Partecipo, rimozione e persistenza locale esistono già. La mappa e il dettaglio sono collegati.

## Problemi e interventi

### 1. Il mese occupa spazio senza mostrare abbastanza informazione

La griglia richiede 4–6 righe e lascia meno spazio all'elenco. Su mobile il giorno mostra un indicatore, ma non permette di distinguere chiaramente una giornata con pochi eventi da una molto piena.

Proposta: una settimana selezionabile e l'agenda come vista iniziale. Pulsanti Oggi, Cambia data e Mappa. Il mese rimane disponibile in un pannello con spazio adeguato, annullamento e scelta esplicita. Non cambiare data al semplice passaggio di mese nel pannello.

### 2. Le aree di tocco dei giorni sono piccole

Il CSS prevede altezze minime di 38 px, ridotte a 30 e 26 px sugli schermi bassi. Con larghezza 320 px, i margini attuali lasciano meno di 44 px per colonna. Questo non rispetta l'obiettivo di almeno 44 px del progetto.

Una settimana deve quindi avere larghezza utile dedicata, con margini ridotti; non basta aumentare l'altezza dei giorni nella griglia attuale. Sette controlli da 44 px richiedono almeno 308 px prima di spazi e bordi. Evitare di sovrapporre le aree di tocco per farle entrare.

La soglia di 44 px è il requisito del progetto, non il minimo generale di WCAG 2.2 AA: quest'ultimo prevede 24 px con condizioni ed eccezioni. Non va confusa la verifica del requisito interno con una dichiarazione di conformità WCAG.

### 3. Il cambio di data interrompe il contesto

I pulsanti precedente/successivo selezionano sempre il giorno 1 del mese. Entrando nei salvati si sceglie ogni volta il primo appuntamento futuro secondo il giorno di fine: si può perdere la data che si stava consultando e includere appuntamenti già conclusi nelle ore precedenti della stessa giornata.

Proposta: mantenere separati il mese in esplorazione e la data confermata; ricordare il punto di consultazione tra passaggi di sezione. Alla prima apertura dei salvati mostrare il prossimo programma effettivamente futuro, ma non riposizionare a ogni rientro. Per gli eventi con orari noti usare anche l'ora di fine; per quelli con sola data non inventare un orario.

### 4. I salvati meritano una lettura per appuntamenti futuri

Oggi usano essenzialmente lo stesso mese con un filtro. Chi salva più date deve spostarsi tra giorni per ricostruire i propri programmi.

Proposta: mantenere la voce Salvati nella navigazione inferiore, con elenco delle prossime date, diviso per giorno e stato. Un appuntamento passato rimane consultabile in una parte separata. L'export verso il calendario del telefono è una fase successiva, utile solo con date, orari e sedi abbastanza affidabili.

### 5. Le schede hanno troppe azioni allo stesso livello

Una scheda può avere link esterno, Dettagli, Mi interessa, Partecipo e Rimuovi. Le azioni si distribuiscono su più righe e riducono il numero di eventi leggibili sullo schermo.

Proposta: mostrare subito ora o indicazione di orario mancante, titolo, sede e stato personale. Due accessi principali: Dettagli e salvataggio. Il dettaglio contiene cambio di stato, rimozione, mappa e fonte. Lo stato selezionato resta indicato anche con testo e spunta.

C'è anche un comportamento da chiarire: premere Mi interessa quando lo stato è Partecipo lo riporta a Mi interessa. Il controllo non dice esplicitamente che sta modificando una presenza già confermata. È preferibile una scelta di stato chiaramente nominata, con Rimuovi distinta.

### 6. La mappa perde il filtro personale al ritorno

L'apertura dai salvati attiva correttamente la selezione dei propri eventi. Il pulsante di ritorno però apre sempre il calendario generale. Si perde il contesto di partenza.

Proposta: conservare vista, data e filtri prima di entrare nella mappa, e ripristinarli tornando indietro. Continuare a mostrare quanti appuntamenti non sono mappabili. Non aggiungere punti dedotti da un titolo o da una sede ambigua.

### 7. Gli indicatori nel mese sono poco coerenti

La legenda distingue Comune e Veronafiere con due colori, ma il marcatore visibile del giorno è unico e non riflette quella distinzione. Sugli schermi bassi la legenda scompare.

Proposta: usare un conteggio semplice oppure un indicatore dei propri appuntamenti, con un significato esplicito. La fonte rimane nelle schede. Oggi, selezione e presenza di salvati devono distinguersi anche per forma, contorno o testo; non soltanto per colore.

### 8. Filtri e stati vuoti possono essere più pratici

Il pannello comune è corretto nel dichiarare i campi limitati a Scopri, ma costringe comunque a leggere opzioni non pertinenti al calendario. Le modifiche sono immediate anche se si chiude senza conferma. L'assenza di risultati offre soltanto una frase.

Proposta: pannello specifico con ricerca e fonte; eventuale zona condivisa con Il mio quartiere, chiarendo che la copertura territoriale è parziale. Mostrare i filtri attivi e una rimozione rapida. Applicazione esplicita e annullamento coerenti con la nuova sezione Notizie. Negli stati vuoti offrire Rimuovi filtri, Prossimo giorno con eventi o Scopri eventi, a seconda della causa.

## Organizzazione dell'agenda

Per il giorno scelto distinguere:

- Appuntamenti con ora di inizio riferita a quel giorno, ordinati per ora.
- Manifestazioni che proseguono da giorni precedenti, con intervallo chiaro; non riutilizzare automaticamente il primo orario come apertura di ogni giornata.
- Appuntamenti con orario non indicato. Una data senza ora non autorizza l'etichetta Tutto il giorno.

Una modalità Da adesso può essere utile per oggi, purché sia facoltativa e visibile. Non eliminare silenziosamente gli eventi passati dalla consultazione storica.

## Prima versione consigliata

| Priorità | Modifica | Risultato |
| --- | --- | --- |
| Prima | Agenda con settimana e mese in pannello | Più spazio agli eventi e giorni più comodi da toccare |
| Prima | Schede compatte con stato evidente | Più facile confrontare gli appuntamenti |
| Prima | Rientro dalla mappa e navigazione senza salti | Continuità tra viste |
| Prima | Filtri pertinenti e stati vuoti con azioni | Nessun vicolo cieco |
| Successiva | Salvati organizzati per prossime date e stato | Programma personale più utile |
| Successiva | Esportazione calendario e promemoria verificati | Utilità sul telefono oltre la consultazione |

Non aggiungerei tutte le funzioni contemporaneamente: la prima prova dovrebbe concentrarsi su selezione della data e agenda, preservando gli attuali salvataggi.

## Verifiche da eseguire durante l'implementazione

- Telefoni da 320, 375 e 430 px; altezza ridotta; testo ingrandito; aree sicure.
- Oggi, fine mese, dicembre/gennaio, febbraio e anno bisestile; fuso Europe/Rome e cambio ora.
- Eventi di più giorni, con sola data, già conclusi oggi e senza sede o coordinate.
- Cambio mese annullato, filtro annullato, zero risultati e passaggi calendario → mappa → calendario/salvati.
- Mi interessa, conferma presenza, annullamento presenza e rimozione, compreso ricaricamento con localStorage non disponibile.
- Tastiera e lettori di schermo: data annunciata, focus mantenuto dopo il render, spostamento tra giorni e ritorno dal pannello. I bottoni attuali si attivano con la tastiera, ma non implementano la navigazione tra date tramite frecce del pattern di griglia.

I test esistenti coprono già parte dei salvataggi, delle sovrapposizioni e del passaggio dicembre/gennaio; non sostituiscono queste verifiche su UI e dispositivi reali.

## Riferimenti

- Sorgenti: `public/calendar.js`, `public/calendar.template.html`, catalogo incorporato in `public/index.html`, `scripts/calendar.test.mjs`.
- [W3C: Date Picker Dialog Example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/): riferimento per interazione e gestione del focus, non codice da adottare senza test.
- [W3C: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): distinzione fra dimensione minima AA e requisito touch del progetto.
