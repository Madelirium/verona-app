# Analisi della sezione Notizie e Comune

18 ottobre 2026. Analisi del codice, del catalogo incorporato nell'app e delle pagine ufficiali del Comune. Nessuna modifica all'interfaccia in questa analisi. Il controllo non comprende una prova visiva sul telefono o osservazioni di utilizzo con utenti.

## Valutazione

La sezione ha già una base utile: fonti riconoscibili, data di pubblicazione, sintesi, ricerca, argomenti, filtro per circoscrizione, salvataggi persistenti e accesso al documento originale. Il contenuto scorre internamente, con navigazione e intestazione fisse, coerentemente con il vincolo mobile first.

Il miglioramento principale è trasformare un elenco cronologico in un servizio che aiuti a rispondere a quattro domande: **che cosa cambia, chi riguarda, quando e cosa posso fare**. Non basta aggiungere fotografie o etichette di urgenza.

## Riscontri sul catalogo attuale

| Osservazione | Riscontro |
| --- | --- |
| Ultima raccolta | 17 ottobre 2026, ore 12:12 circa, Europe/Rome |
| Pubblicazioni | 61: 48 notizie e 13 avvisi |
| Copertura dichiarata | Prime due pagine di ciascuna fonte, ultimi 90 giorni; non archivio completo |
| Date di pubblicazione effettive | Dal 22 luglio al 16 ottobre 2026 |
| Categoria generica “Dal Comune” | 28 su 61 |
| Circoscrizione esplicita | 5 su 61 |
| Zona riconosciuta anche per nome di quartiere | 7 su 61 |
| Titoli oltre 90 caratteri | 14 su 61 |
| Sintesi sotto 80 caratteri | 16 su 61; la brevità non implica da sola un problema |

I conteggi riguardano l'istantanea incorporata nell'app, non l'intero patrimonio informativo comunale. La zona è ricavata da testo e sintesi: una zona assente non significa che la notizia riguardi tutta Verona.

## Problemi prioritari

### 1. Pubblicazione e validità sono due cose diverse

L'app conserva `publishedOn` e la data di raccolta, ma non un periodo di validità, una scadenza o un'indicazione di revoca. Una notizia pubblicata recentemente può riguardare un evento già passato; una pubblicata tempo prima può essere ancora utile.

Esempio concreto: le ispezioni sulla tangenziale sono pubblicate il 16 ottobre e riguardano il 19–22 ottobre. Il comunicato sul Giro del Veneto riguarda invece il 14 ottobre, pur rimanendo nell'elenco consultabile il 18. Oggi l'interfaccia non tratta diversamente queste situazioni.

Proposta: distinguere data di pubblicazione, eventuale periodo interessato e scadenza, mostrandoli solo quando sono supportati chiaramente dalla fonte. Un contenuto senza informazioni sufficienti mantiene lo stato **validità non determinata**. Non identificare automaticamente “attivo”, “urgente” o “scaduto” dalla sola anzianità della notizia.

### 2. “Avviso” non equivale a “urgente”

La pagina Avvisi comprende bandi, concorsi e opportunità per cittadini e imprese. La distinzione attuale è una distinzione della fonte, non una classificazione dell'impatto sulla vita quotidiana. Anche alcune comunicazioni di mobilità compaiono nella pagina Notizie.

Proposta: conservare il tipo originale come informazione, ma organizzare l'esplorazione anche per argomento. Un'eventuale evidenza deve avere un motivo esplicito e una durata verificata. Rosso riservato a messaggi che lo richiedano realmente, non a tutte le schede importate dagli Avvisi.

### 3. Le categorie hanno poco potere di orientamento

Il classificatore assegna una singola categoria tramite parole chiave. Quasi metà del catalogo ricade in “Dal Comune”, che descrive già la provenienza di tutti i contenuti. L'ordine delle regole può privilegiare una parola rispetto al tema principale: non è una classificazione ufficiale.

Proposta: usare argomenti comprensibili e stabili, per esempio Mobilità, Servizi e uffici, Scuola e famiglie, Contributi e opportunità, Vita cittadina. Consentire più temi dove utile, senza moltiplicare etichette nella scheda. Lasciare un residuo “Altre comunicazioni” e indicare l'assegnazione automatica nei dettagli. Validare la classificazione con un campione reale prima di cambiare tutto il catalogo.

### 4. La personalizzazione geografica è ancora debole

Notizie filtra per `area`, quindi solo per circoscrizioni esplicite. Il mio quartiere usa anche i nomi dei quartieri e riconosce altri due contenuti. I due punti di accesso possono quindi restituire risultati diversi per la stessa zona.

Proposta: riutilizzare lo stesso criterio territoriale e la stessa zona già scelta. La vista “La mia zona” deve spiegare perché una pubblicazione è inclusa. Le comunicazioni senza zona restano consultabili in Tutte, senza essere presentate come sicuramente cittadine o pertinenti al quartiere. Non aprire automaticamente una lista quasi vuota come vista iniziale.

### 5. Ricerca e filtri sono poco visibili

La ricerca è dentro il pannello filtri, accessibile da un'icona nell'intestazione generale. Un punto segnala filtri attivi, ma non quali. La scheda mostra alternativamente la circoscrizione o l'argomento: quando c'è la prima, il secondo scompare.

Inoltre i campi applicano le variazioni subito: chiude il pannello anche il pulsante “Mostra notizie”, ma la chiusura con × non annulla i cambiamenti. Non è necessariamente errato, però il comportamento va reso coerente e comprensibile.

Proposta: ricerca sempre visibile nella sezione; riepilogo sintetico dei filtri con rimozione; argomento e zona distinti. Per il pannello scegliere un comportamento unico: applicazione esplicita con annullamento, oppure aggiornamento immediato chiaramente dichiarato.

### 6. Le schede non espongono ancora l'utilità concreta

Titoli lunghi e metadati compatti occupano spazio, mentre la sintesi talvolta è molto generica. Il dettaglio ripete il testo dell'indice e aggiunge soprattutto note e collegamenti. Non contiene attualmente il testo completo o i dati operativi della pagina di dettaglio.

Proposta: mantenere il titolo ufficiale nel dettaglio e, dove curato, affiancargli una sintesi pratica separata e riconoscibile. Non riscrivere automaticamente obblighi, requisiti o scadenze senza controllo. Evidenziare quando disponibili zona, periodo e azione utile. Il collegamento alla fonte rimane sempre accessibile.

## Struttura mobile proposta

Guscio da app invariato, senza una pagina lunga da scorrere:

1. Intestazione **Notizie e Comune**, con accesso ai filtri.
2. Campo ricerca visibile, alto almeno 44 px e con testo da 16 px.
3. Tre viste: **Tutte · La mia zona · Salvate**. Il tipo Notizia/Avviso diventa un filtro, mantenendo il dato originale sulle schede.
4. Un elenco interno scorrevole. Se esistono contenuti realmente verificati da mettere in evidenza, al massimo uno o due all'inizio dello stesso elenco, senza sottrarre spazio fisso al contenuto.
5. Dettaglio e filtri in pannelli modali; la navigazione in basso resta sempre disponibile.

Userei la palette Blu e oro: testo scuro, CTA blu, oro per evidenze limitate. Metadati leggibili, titoli ben separati, nessun codice cromatico come unico indicatore di stato. Immagini solo quando utili e riutilizzabili: non sono una priorità per questa sezione.

## Esempio di scheda migliorata

**Mobilità · Tangenziale T4–T9**

Titolo breve curato: “Ispezioni ai ponti: corsie ridotte dal 19 al 22 ottobre”.

Sintesi: tra Porta Nuova e Verona Nord, corsia di sorpasso chiusa a turno; la circolazione rimane garantita.

Informazioni distinte: periodo 19–22 ottobre 2026, fonte Comune, pubblicazione 16 ottobre. Azioni: **Dettagli** e **Salva**; il dettaglio conserva titolo e collegamento ufficiali. Prima di trattare il periodo come dato strutturato, verificarlo sulla pagina completa.

Questa è una proposta editoriale basata sul comunicato consultato, non una scheda già inserita nell'app.

## Priorità di sviluppo

| Fase | Intervento | Cosa risolve |
| --- | --- | --- |
| Prima | Ricerca visibile, filtri comprensibili, schede più leggibili | Migliora subito l'accesso ai contenuti esistenti |
| Prima | Stesso filtro territoriale del Mio quartiere | Elimina differenze tra sezioni e valorizza la zona già scelta |
| Successiva | Periodi, scadenze e aggiornamenti verificati per un piccolo gruppo di comunicazioni utili | Distingue contenuti attuali, futuri e conclusi senza inferenze rischiose |
| Successiva | Argomenti e ordinamento trasparenti, con eventuale evidenza curata | Riduce il rumore e rende comprensibili le priorità |
| Dopo | Aggiornamenti automatici, controllo degli errori e gestione delle modifiche | Permette un uso continuativo affidabile |
| Dopo | Condivisione e promemoria solo per scadenze verificate | Aumenta l'utilità dei salvataggi |

Non attiverei subito notifiche generiche o un sistema di importanza basato soltanto su parole chiave.

## Dati da aggiungere quando si arricchiscono le fonti

Tenere separati: data di pubblicazione, aggiornamento dichiarato dalla fonte, momento dell'ultimo controllo riuscito, periodo interessato e scadenza. Per le informazioni temporali conservare provenienza e precisione; per le zone conservare il motivo dell'associazione. La priorità editoriale deve essere distinta dal tipo della fonte e scadere quando non più pertinente.

L'importatore attuale legge due pagine per fonte e non importa i banner del sito. Ampliare la finestra temporale o aggiornare più spesso, da solo, non garantisce di raccogliere tutte le comunicazioni importanti. Vanno individuate le fonti necessarie per ciascun servizio e gestiti aggiornamenti, contenuti rimossi, errori e periodi senza nuove pubblicazioni. Il sito pubblico su Pages usa oggi l'ultima raccolta salvata: non aggiorna le fonti quando si apre l'app.

## Come valutare il risultato

Provare, con contenuti reali, a trovare una modifica alla viabilità, distinguere pubblicazione e periodo interessato, cercare una comunicazione del proprio quartiere, salvare una notizia e azzerare i filtri. Includere titoli lunghi, zero risultati e validità sconosciuta. Verificare leggibilità a 320–430 px e con testo ingrandito. Confrontare la comprensione e le esitazioni, non soltanto l'aspetto delle schede.

## Fonti e file esaminati

- `public/calendar.js`, `public/calendar.template.html`, `scripts/news.mjs`, `scripts/import-news.mjs`, `scripts/districts.mjs`, `data/news.json`, payload incorporato in `public/index.html`.
- [Notizie del Comune](https://www.comune.verona.it/Novita/Notizie).
- [Avvisi del Comune](https://www.comune.verona.it/Novita/Avvisi).
- [Comunicato sulle ispezioni della tangenziale](https://www.comune.verona.it/Novita/Notizie/Ispezioni-ai-ponti-sulla-Tangenziale-T4-T9-da-lunedi-19-a-giovedi-22-ottobre-restringimenti-di-carreggiata).
- [Provvedimenti per il Giro del Veneto](https://www.comune.verona.it/Novita/Notizie/Giro-del-Veneto-2026-provvedimenti-viabilistici).
