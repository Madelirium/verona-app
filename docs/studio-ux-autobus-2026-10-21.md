# Studio UX/UI Autobus — residenti, anziani e turisti

21 ottobre 2026. Revisione della versione pubblicata dopo l'introduzione della mappa di tutte le fermate. Questo documento aggiorna l'analisi precedente: catalogo unico, ricerca fermate, prossime partenze e distinzione delle reti sono già presenti. Nessuna modifica al frontend o pubblicazione durante questo studio.

## 1. Direzione progettuale

La sezione deve rispondere prima a tre domande: **da quale fermata parto, verso dove va l'autobus, quando passa?** La linea e la mappa aiutano a rispondere; il loro catalogo completo rimane accessibile come percorso alternativo.

La base attuale è valida: 141 linee ufficiali, 4.287 fermate con coordinate e servizi di salita nell'indice, orari dentro l'app, ricerca per nome e codice, preferiti di linea e integrazione con gli eventi. Il miglioramento principale riguarda l'organizzazione delle decisioni e la coerenza delle schermate. Il livello successivo richiede una scheda fermata condivisa, direzioni evidenti, favoriti di fermata e un'interfaccia meno densa.

## 2. Metodo e limiti

Esaminati i sorgenti di catalogo, mappa e orari e la versione online `https://madelirium.github.io/verona-app/`. La prova Wi-Fi non rispondeva durante questo studio; le misure visuali sono quindi della versione pubblicata. Percorsi riprodotti a 320×640, 390×844 e 430×840 CSS px, con profilo browser esistente. Non sono stati cancellati preferiti o impostazioni dell'utente.

Verificati: catalogo iniziale; ricerche Arena, train station e 24; consultatore della linea 24; elenco/mappa; fermata 1974 Via Santini B e scelta della linea 24; dimensioni dei contenitori, caratteri, colori e focus dopo il ridisegno del pannello.

È una revisione esperta con evidenze riproducibili, non uno studio già svolto con utenti anziani o turisti. Non sono stati verificati su dispositivo reale tastiera virtuale, VoiceOver/TalkBack, testo al 200%, pulsante Indietro Android, rete mobile lenta o autorizzazione alla posizione. Le proposte restano ipotesi da validare con questi test. Nessuna certificazione WCAG viene dichiarata.

Evidenze locali: `.local/ux-autobus/misure.json`, `autobus-390.png`, `mappa-320.png`.

## 3. Riscontri attuali

| Riscontro osservato | Evidenza | Conseguenza UX |
|---|---|---|
| Molte scelte prima dei risultati | Ricerca/Filtri, Tutte/Urbane/Extraurbane, Linee/Fermate/Avvisi, stella/Mappa/Info | Il primo accesso richiede di capire l'organizzazione del servizio prima di trovare una partenza |
| Spazio utile limitato sui telefoni piccoli | Lista alta circa 237 px a 320×640; 406 px a 390×844; 402 px a 430×840 | A 320 px si vede circa una scheda e una parte della successiva |
| Azioni ripetute sulle linee | Titolo della scheda e Partenze aprono gli stessi orari; seguono Mappa e fermate e Dettagli | Aumentano pulsanti e dubbi sulla differenza fra le azioni |
| Testi secondari piccoli | Titolo linea 15 px, metadati 12 px, azioni 13 px; informazioni di servizio anche a 11 px | Leggibilità da migliorare, soprattutto all'aperto e per persone con vista ridotta |
| Ricerca nominale già utile | Arena restituisce cinque fermate; 1974 trova Via Santini B | Funzione da conservare; non serve ricostruirla da zero |
| Ricerca internazionale assente nel caso provato | train station restituisce zero linee e zero fermate | Un turista deve conoscere il nome italiano o un numero di linea |
| Fermate omonime difficili da distinguere | Arena mostra più punti, lettere A/B/C e due record chiamati Piazza Bra Arena B con codici differenti | Nome e lettera da soli non spiegano quale punto e direzione scegliere |
| Troppi punti nella vista iniziale della mappa | 4.287 fermate nel catalogo; a zoom cittadino i cerchi si sovrappongono; mappa alta circa 251 px a 320×640 | La disponibilità di tutti i punti non equivale alla facilità di selezione |
| Esperienza della fermata diversa tra ricerca e mappa | Dalla ricerca compaiono subito tre partenze di una linea preselezionata; dalla mappa si sceglie una linea e poi Orari | Stesso oggetto, due comportamenti e passaggi diversi |
| Focus perso scegliendo una linea | Dopo il clic sulla 24 dalla fermata 1974, `document.activeElement` è BODY senza id | Chi usa tastiera o lettore di schermo perde il riferimento al controllo |
| Pannello selezionato da scorrere | Altezza interna 190 px, contenuto 227 px nel caso misurato | L'azione principale deve restare prima delle spiegazioni e il ritorno deve essere evidente |
| Selettori sempre presenti anche con contesto noto | Il consultatore mostra linea, fermata, data e verso; a 320 px i risultati occupano circa 167 px | Il nome della linea e della fermata potrebbero diventare riepilogo, lasciando più spazio agli orari |

Le misure si riferiscono allo stato e ai testi osservati, senza tastiera virtuale. Non sono tempi medi né prove statistiche sull'usabilità.

## 4. Priorità dei problemi

**P1 — prima della prossima revisione dell'interfaccia**

1. Una sola scheda fermata, indipendente dal punto di ingresso, con direzione e prossime partenze.
2. Ripristino del focus e comandi di ritorno coerenti dopo cambio linea, caricamento e chiusura.
3. Riduzione delle righe di comando e delle azioni duplicate; testo principale più grande.
4. Distinzione fra servizio di oggi, altri giorni, dato fuori validità e tracciato mancante.

**P2 — completamento dell'esperienza**

5. Fermate preferite e recenti, con linea e verso; accesso volontario a Vicino a me.
6. Mappa con raggruppamento dei punti e scelta esplicita fra fermate vicinissime.
7. Inglese per i flussi essenziali e alias verificati per nomi turistici.
8. Avvisi pertinenti nella scheda della fermata/linea, con data e validità comprensibili.

**P3 — ottimizzazione e funzioni successive**

9. Dati e componenti caricati solo quando servono, ricerca indicizzata e cache coerente con la versione dell'archivio.
10. Luoghi turistici collegati a fermate vicine; un eventuale pianificatore con cambi è un progetto distinto, che richiede dati, algoritmo e validazione propri.

Le priorità sono giudizi progettuali basati sull'impatto e sulla frequenza plausibile, non frequenze misurate tramite analytics.

## 5. Architettura della schermata proposta

Conservare guscio `100dvh`, pietra, blu, navigazione principale e scorrimento del contenuto interno. Non aggiungere altre voci alla barra globale già densa. Ridurre invece i livelli della sezione.

Schema indicativo, non una schermata già implementata:

```text
Autobus                              IT / EN
[ Cerca fermata o linea…                 ]
[ Vicino a me ]          [ Elenco | Mappa ]

       Fermate       Linee       Avvisi
─────────────────────────────────────────
Le mie fermate / Recenti
[ Via Santini B                         ]
[ 24 → Piazza Righetti                  ]
[ Prossime partenze programmate         ]

Risultati / fermate vicine
          contenuto che scorre
─────────────────────────────────────────
         navigazione principale
```

La vista iniziale consigliata è Fermate. Con preferiti mostra prima quelli; senza preferiti né posizione presenta ricerca e azione Vicino a me, senza scaricare sull'utente l'intero elenco alfabetico. Linee rimane a un tocco per chi conosce il numero. Elenco e Mappa sono due rappresentazioni della stessa selezione, con ricerca e filtri conservati.

Tutte/Urbane/Extraurbane passa nel pannello Filtri, con una sola etichetta visibile quando un filtro è attivo. Non obbligare un turista a conoscere la classificazione della rete. Servizio feriale/serale/festivo non deve sembrare una verifica di circolazione oggi: la data degli orari è la fonte per questa risposta.

La posizione si richiede solo su azione esplicita. Rifiuto, precisione bassa o connessione assente lasciano disponibile la ricerca manuale. Mostrare la distanza in linea d'aria se è l'unica calcolata; minuti a piedi richiedono un percorso pedonale attendibile. La posizione attuale non deve diventare un dato da salvare per consultare gli orari.

## 6. Una sola scheda fermata

La scheda deve conservare lo stesso ordine da ricerca, mappa, preferiti ed evento:

1. Nome leggibile e codice secondario; pulsante testuale Salva fermata.
2. Data, inizialmente Oggi; modifica in un pannello compatto.
3. Linee con **numero e destinazione**, non solo il numero. Le destinazioni devono derivare dalle corse della fermata nella data scelta.
4. Prossime partenze, con ora assoluta grande e indicazione **Orario programmato**.
5. Azioni Orari del giorno, Percorso sulla mappa, Avvisi, in ordine coerente.

Con molte linee, mostrare un riepilogo chiaro e una scelta esplicita; non scegliere silenziosamente il primo numero come se fosse la risposta alla domanda dell'utente. Se alcune linee sono ancora in caricamento, indicare che l'elenco è parziale. Il verso non va dedotto dalle lettere A/B o dalla vicinanza di due coordinate.

Selezionando una linea sulla mappa, mostrare le prossime partenze nello stesso pannello. Orari del giorno espande il dettaglio e non richiede di selezionare di nuovo la fermata. Se linea e fermata sono già note, sostituire le lunghe select con un riepilogo e un pulsante Cambia; data e verso restano immediatamente comprensibili.

Preferiti: salvare fermata + linea + destinazione, permettendo anche una fermata generica per chi usa più linee. Mostrare nome/codice prima di confermare la rimozione e offrire Annulla. La preferenza resta sul dispositivo finché non esiste una sincronizzazione esplicitamente implementata.

Ritorno: usare un pannello con stati interni e un comando Indietro, evitando dialoghi sovrapposti per fermata, linea e orari. Tornando alla mappa ripristinare fermata, zoom e filtri; tornando all'elenco ripristinare ricerca e scorrimento. Il focus deve tornare a un controllo ancora esistente. Provare separatamente anche Indietro del telefono.

## 7. Mappa leggibile

Conservare tutti i dati, ma graduare la loro rappresentazione:

- A zoom ampio usare gruppi con il numero di fermate; toccando un gruppo si ingrandisce o si sceglie dall'elenco.
- A zoom ravvicinato separare i punti. Due fermate opposte o quasi coincidenti rimangono record distinti, con codice e verso quando verificato.
- Su tocco ambiguo aprire una breve lista delle fermate vicine al punto; evitare che la tolleranza del canvas scelga arbitrariamente quella disegnata per ultima.
- Evidenziare sempre la fermata scelta, anche quando viene mostrato tutto il percorso. Offrire Torna alla fermata e Percorso completo con significato esplicito.
- Identificare le linee con numero oltre al colore. Nel confronto assegnare un colore stabile per linea; separare Evidenzia da Rimuovi.
- Spostare Confronta linee fra le funzioni secondarie; mantenere facile l'esplorazione semplice richiesta dall'utente.
- Ridurre i movimenti automatici durante la digitazione: aggiornare dopo una breve pausa o un comando Cerca, senza spostare continuamente il punto osservato.
- Se manca la geometria, conservare fermate e orari. Selezionare una direzione OSM non prova che la variante sia in servizio nella data scelta.

La mappa attuale usa già canvas, disegna le fermate nell'area visibile e carica il solo file della linea richiesta: sono basi efficienti da mantenere. L'elenco equivalente resta essenziale per chi non può o non vuole usare la mappa.

## 8. Accessibilità, stile e lingua

### Anziani e leggibilità

Usare una base comoda per tutti: testi principali 16–18 px, titoli di contenuto 18–22 px e ore 26–32 px sono obiettivi progettuali, non dimensioni minime imposte dalle WCAG. Ridurre note ripetute e maiuscole; mantenere nomi ufficiali e acronimi in una rappresentazione leggibile. Etichette visibili come Le mie fermate sono più chiare della sola stella.

Controlli almeno 44×44 px come richiesto dal progetto, preferibilmente 48–56 px per le azioni principali e con spazi adeguati. Il criterio WCAG 2.2 AA 2.5.8 ha una soglia di 24×24 con eccezioni; 44×44 appartiene al criterio potenziato AAA 2.5.5. Non confondere la soglia dello standard con il nostro obiettivo più comodo. [Target minimo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [target potenziato](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

Conservare pietra e blu. Contrasti calcolati sulle coppie CSS campionate: bianco su blu `#254f78` circa **8,51:1**; secondario `#586777` su pietra `#eeeae2` circa **4,83:1**; testo `#1e2d43` su superficie `#fffefa` circa **13,77:1**. Queste coppie superano 4,5:1, ma non rappresentano un controllo di tutti gli stati, bordi, icone o sovrapposizioni della mappa. Aumentare la leggibilità non richiede un'altra sostituzione della palette. [Contrasto WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Provare testo al 200% senza perdita di informazioni o azioni e reflow a larghezza equivalente di 320 CSS px. Il guscio fisso deve lasciare spazio al contenuto e consentire lo scorrimento interno anche con testo ingrandito; mappe e parti realmente bidimensionali hanno condizioni specifiche. [Resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Il W3C collega molte esigenze delle persone anziane a quelle già trattate dall'accessibilità: vista, motricità, comprensione e uso delle tecnologie assistive. Questo sostiene una progettazione inclusiva comune; non implica che tutte le persone anziane abbiano le stesse capacità. [WAI e utenti anziani](https://www.w3.org/WAI/older-users/).

### Turisti

Inglese almeno per ricerca, fermata, direzione, data, orari, errori, posizione e ritorno. Conservare i nomi propri italiani, affiancando descrizioni riconoscibili: Porta Nuova — train station. Gli alias turistici devono essere verificati e disambiguati; un luogo trovato può suggerire fermate vicine, non automaticamente una linea da prendere da qualsiasi origine.

Arena già funziona perché compare nei nomi ufficiali: questo caso va preservato. Train station non funziona nel caso provato: aggiungere alias a Porta Nuova e Porta Vescovo con scelta esplicita, senza interpretarlo sempre come una sola stazione.

Aggiornare la lingua dichiarata del documento o del contenuto tradotto in modo coerente per la pronuncia dei lettori di schermo. Tradurre messaggi ed etichette accessibili, non soltanto i pulsanti. [Lingua della pagina](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html).

Aiuto Biglietti e come salire in posizione secondaria, con collegamenti e informazioni ufficiali verificate. Evitare tariffe o regole di validazione non mantenute. Non dichiarare una fermata accessibile, un attraversamento sicuro o un mezzo a pianale ribassato senza dati attendibili.

### Tastiera e annunci

Correggere il focus perso dopo il ridisegno: aggiornare i nodi esistenti o ritrovare il controllo per chiave stabile fermata/linea. Annunciare caricamento e numero di risultati con messaggi brevi; evitare la rilettura dell'intero elenco a ogni carattere. Provare Tab, Shift+Tab, Escape, lettore di schermo e ritorno dalla scheda alla lista. Colore, numero, testo e forma devono collaborare. [Uso del colore](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

## 9. Stati che devono essere comprensibili

| Stato | Messaggio/azione proposta |
|---|---|
| Nessun'altra corsa oggi | Oggi non ci sono altre partenze. Mostra il prossimo giorno coperto, con data esplicita |
| Servizio domani | Domani, giovedì …, ore …; non lasciare soltanto l'ora |
| Data fuori archivio | Orari non disponibili per questa data. Consulta ATV; non presentare il vecchio giorno come attuale |
| Rete non disponibile | Impossibile caricare gli orari. Riprova; mantenere fermata e scelta |
| Tracciato assente | Percorso non disponibile. Fermate e orari restano consultabili |
| Posizione negata | Cerca una fermata per nome o codice; la consultazione continua |
| Pochi risultati per filtri | Mostrare i filtri applicati e Rimuovi filtri, anche con soli preferiti attivi |
| Avviso | Pubblicato il …; usare In corso solo se la validità è verificata |

L'archivio corrente copre 18 ottobre–17 novembre 2026 e non è in tempo reale. La raccolta giornaliera di eventi/notizie non aggiorna automaticamente l'archivio degli autobus. Anche una preview delle prossime tre corse può arrivare ai giorni seguenti: la data deve restare evidente.

## 10. Efficienza tecnica

Misure sui file locali non compressi: pagina distribuibile circa **3,50 MB**, indice fermate **0,864 MB**, 141 file degli orari in totale **11,08 MB**, singola linea più grande **0,511 MB**. Sono dimensioni su disco; non sono tempi di caricamento né byte effettivi trasferiti con compressione HTTP.

Interventi consigliati:

1. Conservare il caricamento su richiesta e la cache delle singole linee; evitare di scaricarle tutte per aprire una fermata con molti servizi.
2. Preparare risultati di ricerca normalizzati e insiemi fermata→linee una volta per versione/filtri, riducendo ricostruzioni ripetute durante pan e input.
3. Separare gli aggiornamenti dei punti da quelli delle polilinee: uno spostamento della mappa non dovrebbe ricreare ogni percorso già caricato.
4. Introdurre una breve attesa sulla ricerca e protezioni contro risposte tardive, conservando quelle già presenti.
5. Valutare un indice compatto delle partenze per fermata, generato dallo stesso archivio, con calendario e destinazioni. Prima misurare dimensioni e correttezza: non duplicare ogni corsa per ogni giorno indiscriminatamente.
6. Spostare progressivamente dati e moduli non necessari all'avvio fuori dal grande HTML, con asset versionati e invalidazione coerente tramite l'impronta dell'archivio.
7. Valutare cache offline solo con indicazione chiara della validità; il possesso di dati salvati non li rende aggiornati. Nessuna promessa offline finché il flusso non è implementato e provato.

Per giudicare velocità serviranno prove su telefono di fascia media, rete mobile limitata e primo accesso distinto dalle visite con cache. Non sono stati raccolti benchmark di tali condizioni durante questo studio.

## 11. Sequenza di implementazione

| Fase | Consegna | Complessità relativa | Criterio di riuscita |
|---|---|---|---|
| 1 | Scheda fermata unica, focus, testi e azioni semplificate | Media | Da mappa e ricerca si vedono gli stessi orari, senza compilare di nuovo i campi |
| 2 | Accesso Fermate, preferiti di fermata, recenti e Vicino a me | Media | Una fermata salvata si riapre con una sola azione dalla sezione |
| 3 | Gruppi sulla mappa, disambiguazione dei punti e ritorno alla fermata | Media | Si distingue una fermata da quella opposta senza dover colpire un punto minuscolo |
| 4 | Inglese, alias e aiuto ai turisti | Media | Un turista completa la ricerca della stazione senza conoscere il nome italiano |
| 5 | Indici, separazione asset e cache misurata | Da stimare dopo benchmark | Riduzione verificata di richieste/lavoro UI senza risultati incompleti o vecchi |

Partirei dalla fase 1: riduce subito i passaggi e crea un componente riusabile per mappa, eventi, preferiti e ricerca. Poi riorganizzerei la schermata iniziale, evitando di sommare un'altra barra o un altro pannello a quelli esistenti.

## 12. Validazione con persone reali

Primo ciclo qualitativo suggerito: sei persone con esigenze diverse, per esempio due anziani con familiarità digitale differente, due visitatori non italofoni e due residenti. La composizione è un piano di reclutamento, non una ricerca già eseguita né una garanzia di rappresentatività.

Compiti senza suggerire i pulsanti:

1. Trovare la prossima partenza da Via Santini B verso Piazza Righetti.
2. Distinguere due fermate vicine in Piazza Bra e verificare la direzione.
3. Cercare una stazione ferroviaria in inglese e scegliere quale stazione serve.
4. Consultare un giorno festivo e capire una data non coperta dall'archivio.
5. Salvare una fermata, ritrovarla dopo la riapertura e rimuoverla per errore usando Annulla.
6. Proseguire con la posizione negata, una mappa senza sfondo o un errore di caricamento.

Registrare riuscita senza aiuto, scelte errate di direzione, numero di ritorni, tempo alla prima partenza pertinente e comprensione di Orario programmato. Confrontare vecchio e nuovo ordine dei prototipi tra partecipanti per ridurre l'effetto di apprendimento. Non promettere una percentuale di miglioramento prima del confronto.

Accettazione tecnica: 320–430 px, testo al 200%, tastiera virtuale aperta, focus stabile, almeno 44 px sui controlli, alternativa completa alla mappa, date di Roma e servizi dopo mezzanotte, stato persistente e risposte fuori ordine. Obiettivo di spazio a 320×640: almeno 280 px iniziali per i risultati se compatibile con testo e controlli accessibili; con zoom e tastiera la priorità è mantenere tutte le funzioni raggiungibili, non una quota rigida di pixel.
