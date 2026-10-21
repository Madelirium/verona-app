# Analisi del calendario

Analisi del 21 ottobre 2026 su sorgenti locali e applicazione Wi-Fi, senza modifiche all'interfaccia. Flussi esaminati: calendario giornaliero, cambio giorno nella settimana, selettore mensile, filtri, schede evento e collegamento ai salvati. Viewport osservati: 390×844 e 320×640.

## Valutazione

Il calendario è una base di consultazione ordinata, ma aiuta poco a scegliere e organizzare un'uscita. Le schede hanno gerarchia quasi identica, la navigazione richiede molti passaggi e gli eventi iniziati, quelli ancora da iniziare e le attività distribuite su più giorni non sono separati visivamente. “Spoglio” descrive soprattutto la scarsa varietà e utilità delle informazioni: aggiungere riquadri o cambiare colore da solo aumenterebbe la densità.

Conservare il calendario bianco richiesto dall'utente, sfondo pietra, blu per giorno selezionato e azioni principali. Conservare guscio 100dvh, navigazione in basso, scorrimento interno, mese e filtri in pannelli. Non introdurre una pagina lunga o una grande copertina fissa sopra l'elenco.

## Riscontri concreti

| Riscontro | Implicazione | Intervento |
| --- | --- | --- |
| Il selettore settimanale è alto 173 px nei viewport osservati | Tre livelli di navigazione prima degli eventi | Riunire mese e spostamento settimana; mantenere giorni grandi e mese in pannello |
| A 320×640 l'elenco ha circa 208 px disponibili; la prima scheda è alta circa 248 px | Non si vede neppure tutta la prima scheda | Ridurre ripetizioni e metadati tecnici nelle schede; recuperare spazio sopra la lista |
| Il giorno osservato ha 13 appuntamenti, ma l'apertura parte dalle 08:30 indipendentemente dall'ora corrente | Poco aiuto a chi decide cosa fare adesso | Sezione prossimi appuntamenti; eventi già iniziati consultabili separatamente |
| La fonte e i crediti immagine ricorrono in ogni scheda | Le informazioni di servizio competono con titolo, luogo e orario | Crediti compatti e leggibili, dettagli completi nel pannello, rispettando le attribuzioni necessarie |
| Filtri visibili nel pannello: testo e fonte | La scelta per interesse, momento e costo richiede leggere tutte le schede | Categorie e fascia oraria; gratuito e zona solo dove il dato è disponibile |
| Conteggi della settimana e puntino del mese indicano eventi, senza distinguere quelli salvati | La griglia aiuta a esplorare, meno a organizzarsi | Un secondo segnale per giorni con programmi salvati; legenda testuale |
| Il selettore mensile mostra giorni senza dati come “0 eventi” | Può sembrare assenza di iniziative in città | Stati espliciti “Nessun evento raccolto” e “Nessun risultato con questi filtri” |
| Giorni settimanali misurati a 320 px: circa 44×69 px; nessun overflow della pagina | Buona base di accessibilità da conservare | Recuperare spazio riducendo duplicazioni, senza rimpicciolire i giorni |

Le immagini sono già presenti come miniature. Il problema non è la loro assenza generalizzata: servono impaginazione coerente e un fallback compatto per le schede senza foto.

## Correzione prioritaria: ordinamento

Caso reale del 23 ottobre, nell'archivio locale:

- Gruppo di cammino: `2026-10-23T08:30:00+02:00`, visualizzato 08:30 a Roma.
- Ginnasticamente. La ginnastica per menti attive: `2026-10-23T10:00:00+02:00`, visualizzato 10:00.
- Tai Chi: `2026-10-23T10:00:00+03:00`, visualizzato 09:00.

L'elenco osservato presenta 08:30, 10:00, 09:00. `renderAgenda` usa `startsAt.localeCompare`, che non confronta gli istanti effettivi quando cambiano gli offset. Ordinare i timestamp per gli eventi con orario e trattare separatamente le date senza orario. Non cambiare silenziosamente l'orario della fonte: l'offset +03:00 è anche un dato da verificare con l'importatore/fonte, distinto dall'errore certo di ordinamento.

Gli eventi estesi su più giorni sono ordinati con una priorità separata; se si introducono fasce Mattina/Pomeriggio/Sera, devono diventare un gruppo distinto, non essere collocati arbitrariamente in una fascia. Per una mostra l'ora del primo giorno non dimostra l'apertura quotidiana.

## Esperienza proposta

Prima si sceglie quando, poi si riconosce rapidamente cosa vale la pena aprire. La schermata mantiene una sola colonna con queste parti:

1. Intestazione breve: data o mese, azione Oggi e accesso alla mappa. Navigazione settimanale compatta, sette giorni con conteggio e indicazione salvati.
2. Scorciatoie Oggi / Domani / Weekend, senza aggiungere una nuova fila alta in ogni configurazione: possono condividere la barra del periodo o stare nei filtri quando lo spazio non basta.
3. Titolo del giorno con numero di eventi e numero salvati, quando presenti. Per oggi, accesso rapido alle prossime attività.
4. Lista interna con sezioni temporali chiare. Eventuali suggerimenti compaiono dentro la lista, senza sottrarle spazio fisso.

La scelta Weekend deve avere una logica esplicita: mostrare sabato e domenica raggruppati per data, non aprire soltanto il sabato fingendo di rappresentare l'intero fine settimana. Se oggi è domenica, chiarire se si sta mostrando il fine settimana corrente o quello successivo.

Calendario rimane la consultazione di tutti gli eventi; Salvati resta il programma personale. Nel calendario i salvati sono riconoscibili e gestibili, senza creare un secondo archivio o perdere conferme di partecipazione.

## Schede più interessanti

- Orario evidente, titolo con massimo due o tre righe, luogo breve e miniatura con dimensione coerente.
- Distinguere il nome della sede dall'indirizzo completo, mantenendo quest'ultimo nei dettagli. Non tagliare dati che servono a riconoscere sedi omonime.
- Una categoria utile e prezzo solo quando noto, per esempio Mostra e Gratuito. “Prezzo non indicato” non diventa “Gratuito”. Nessuna distanza senza posizione e coordinate affidabili.
- Salva come azione primaria e scheda/titolo chiaramente apribile da tastiera. Ridurre la duplicazione tra scheda, pulsante Dettagli e altri link.
- Stato Ti interessa / Partecipi riconoscibile, con conferma distinta da acquisto o prenotazione.
- Le nuove preview di mappa e il collegamento agli autobus restano nei dettagli. Non caricare una mappa interattiva per ogni riga del calendario.
- Nessuna grande area vuota quando manca l'immagine: icona o accento discreto coerente con la categoria verificata.

Un solo suggerimento “Un'idea per oggi” può rendere il giorno più invitante, ma deve essere selezionato con criteri comprensibili da eventi realmente disponibili. Non usare “popolare”, partecipanti, disponibilità di biglietti o recensioni senza dati. Evitare di presentare la scelta automatica come consiglio editoriale verificato.

## Logica temporale e qualità delle informazioni

Per oggi distinguere eventi non ancora iniziati, già iniziati e conclusi soltanto quando l'orario finale lo permette. Se l'ora finale manca, non dire “In corso” né “Finito” con certezza. La priorità delle prossime attività deve essere reversibile con Mostra tutta la giornata.

`occursOn` attualmente include ogni giorno tra inizio e fine. Per rassegne, corsi e aperture stagionali questo intervallo può non corrispondere alle singole occorrenze. Mostrare “Nel periodo” e rimandare al programma quando la fonte non fornisce il calendario effettivo. Non inventare aperture quotidiane, giorni feriali o durata.

Due titoli simili, stessa sede e ora possono essere una rassegna e un appuntamento specifico, non necessariamente duplicati. Prima di accorpare servono riferimenti fonte/serie; evitare deduplicazione indiscriminata per titolo.

La copia locale osservata segnala oltre due giorni dall'aggiornamento. Va aggiornato il contenuto con il processo esistente, separatamente dal redesign. Un elenco più bello con eventi non aggiornati non risolve il problema di fiducia. La nota di aggiornamento può essere compatta, con dettagli nel pannello fonti, mantenendo visibili gli errori importanti.

## Filtri e navigazione

Prima iterazione: ricerca accessibile dalla vista, categoria e fascia oraria. Fase successiva: gratuito/prezzo noto, quartiere/località e luoghi raggiungibili in autobus. Usare solo metadati verificati; mostrare esplicitamente quando un evento non ha informazioni sufficienti per un filtro.

Esporre i filtri attivi come etichette rimovibili. Mantenere selezione del giorno, filtri e posizione di scorrimento dopo aver aperto e chiuso un evento o la mappa. La mappa deve usare gli stessi criteri temporali del calendario.

In uno stato vuoto proporre una data successiva con eventi e il reset dei filtri. La data va cercata considerando anche eventuali eventi estesi già iniziati, non soltanto quelli che iniziano dopo il giorno selezionato.

## Ordine consigliato per la prova

**Prima fase:** correzione dell'ordinamento, calendario settimanale più compatto e bianco, schede con migliore gerarchia e raggruppamento per orario, prossime attività di oggi con accesso alla giornata completa. Nessuna nuova fonte e nessun dato inventato.

**Seconda fase:** scorciatoie Domani/Weekend e lista di più giorni, categorie/fasce orarie, indicatori dei salvati sulla settimana e nel mese.

**Terza fase:** suggerimento del giorno dentro la lista, esportazione del singolo evento nel calendario del telefono, individuazione di possibili sovrapposizioni tra eventi salvati solo se durata e orari sono noti. Esportazione calendario non equivale a widget o notifiche automatiche.

## Verifiche per l'implementazione

- Ordine 08:30 / 09:00 / 10:00 nel caso Tai Chi con offset diversi; date senza orario e cambio d'ora Europe/Rome trattati correttamente.
- Eventi di oggi prima e dopo l'ora corrente; nessuna conclusione inventata quando manca l'ora finale.
- Weekend a cavallo di mese, anno e cambio dell'ora; rassegne e appuntamenti ripetuti non contati come occorrenze certe senza fonte.
- Filtri coerenti tra giorni, lista, mappa e schede; vuoti distinti tra assenza di raccolta e assenza di risultati.
- Salvataggio, conferma, rimozione, storico dopo la data finale e persistenza sul dispositivo preservati.
- 320–430 px, tastiera aperta, testo ingrandito, comandi da almeno 44 px e navigazione da tastiera. Conservare almeno una scheda leggibile completa nel viewport piccolo, con margine utile per quella successiva dove possibile.
- Nessun nuovo grande blocco fisso: la varietà visiva deve aumentare lo spazio utile e la leggibilità, non diminuirli.

Questa è un'analisi funzionale e visiva, non una modifica dell'app né un audit completo con tecnologie assistive.
