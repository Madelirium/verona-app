# Analisi della sezione Autobus

Analisi del 21 ottobre 2026 sui sorgenti locali e sulla versione pubblicata in GitHub Pages. Nessuna modifica all'interfaccia durante questa analisi.

## Valutazione

La base è utile: orari ufficiali consultabili nell'app, mappe con partenze nei punti, preferiti, avvisi e collegamento agli eventi. Il limite principale è la frammentazione dei percorsi: elenco schede, consultatore orari, mappa della linea, mappa generale e dettagli richiedono scelte ripetute. La priorità è ridurre il lavoro necessario per trovare una partenza.

## Evidenze osservate

| Aspetto | Riscontro | Implicazione |
| --- | --- | --- |
| Spazio su telefono | A 390×844 la lista è alta circa 318 px; a 320×640 circa 145 px | Troppi controlli fissi prima del contenuto; sul telefono piccolo si vede circa una scheda |
| Cataloghi | “Tutte” mostra 38 schede; il selettore degli orari contiene 141 linee; la mappa generale ne propone 30 | La parola “Tutte” non chiarisce la copertura e una linea può sembrare assente |
| Ricerca | “1974” nella ricerca principale restituisce zero schede | Non esiste un accesso unico alle fermate per nome o codice |
| Orari | Linea 24, fermata 1974, 21 ottobre: 40 partenze, lista aperta dalle 05:30 | L'elenco giornaliero non porta automaticamente alla prossima corsa |
| Selezione fermata | Il consultatore usa una lunga select alfabetica con nomi maiuscoli e codici | Difficile trovare una fermata su telefono, specialmente con nomi uguali |
| Direzione | Le destinazioni del filtro sono prese da tutte le corse della linea | Alcune possono non avere partenze dalla fermata e data scelte |
| Schede | Tre azioni, oltre a scheda cliccabile e stella; “Percorso e avvisi” apre lo stesso dettaglio del corpo | Azioni duplicate e densità visiva elevata |
| Mappa | Al primo accesso tre linee, 258 fermate e tutte le varianti; colore assegnato in base alla posizione nella selezione | Molti punti; rimuovendo una linea può cambiare il colore delle altre |
| Legenda mappa | Le pillole servono direttamente a rimuovere le linee | Manca un'azione distinta per selezionare/evidenziare una linea senza eliminarla |
| Accessibilità di base | Nei controlli misurati della mappa pulsanti/select di 44 px; focus visibile nel CSS, dialog nominati e alternativa “Fermate” | Buona base da conservare; la mappa canvas richiede un elenco equivalente |
| Layout | Nel caso provato a 320 px la pagina non supera la larghezza del viewport | Nessun overflow orizzontale della pagina osservato; la legenda scorre internamente |

Le misure sono riferite a questi viewport, prima dell'apertura della tastiera. Non costituiscono un audit completo con lettore di schermo o una certificazione WCAG.

## Proposta di esperienza

Conservare guscio a tutta altezza, sfondo pietra, blu per le azioni e navigazione in basso. La sezione deve avere una sola ricerca: “Cerca linea o fermata”. Risultati raggruppati per Linee e Fermate, con codice e località per distinguere gli omonimi. Caricare l'indice delle fermate quando serve e applicare filtri e limite ai risultati, senza scaricare tutti gli orari.

Sotto la ricerca: Le mie / Linee / Avvisi, e un accesso compatto alla mappa. Filtri di servizio, fonti, collegamenti esterni e informazioni secondarie in un pannello. I preferiti dovrebbero includere anche fermata e direzione: è più utile riaprire “Via Santini B → Piazza Righetti” che ricompilare i campi della linea 24.

La scheda di linea mostra numero, capolinea/destinazioni leggibili e una stella. Un'unica apertura porta a un pannello coerente con viste Partenze / Fermate / Mappa. L'eventuale avviso rimane un collegamento esplicito alla comunicazione pertinente.

La scheda di fermata mostra nome e codice, direzione e prossime partenze delle linee selezionate. “Vicino a me” è un'azione volontaria con alternativa manuale; il rifiuto della posizione non deve impedire la ricerca. Non si tratta di un pianificatore di viaggio con cambi.

## Priorità 1 — Logica di consultazione

1. Unificare il catalogo usando le 141 linee ufficiali come base. Arricchirle con schede e percorsi quando presenti; distinguere “orari disponibili” da “mappa disponibile”. Non inventare classificazioni urbano/extraurbano quando mancano metadati verificati.
2. Aggiungere ricerca di fermate per nome e codice, indipendente dall'elenco di schede e dalle linee già selezionate sulla mappa.
3. Per oggi aprire sulle prossime partenze; consentire “Tutta la giornata”. Per una data futura mostrare il giorno completo. Gestire esplicitamente ieri/dopo mezzanotte e calendario Europe/Rome.
4. Filtrare le destinazioni in base alle partenze effettive della fermata nella data scelta; rendere visibile la direzione prima di scegliere una corsa. Se una scelta salvata non è più valida, spiegarlo e offrire un ripristino.
5. Se non ci sono altre partenze oggi, dirlo prima di mostrare quelle di domani o dei giorni successivi, con data esplicita. La ricerca attuale della preview copre fino a sei giorni successivi: il messaggio vuoto deve descrivere questa finestra, non l'intero archivio.
6. Distinguere sempre archivio fuori validità, errore di rete, fermata non associata e assenza di servizio. Per l'archivio attuale il limite è il 17 novembre 2026. La schermata principale deve segnalare una copia scaduta anche prima di aprire gli orari.

## Priorità 2 — Estetica e gerarchia

- Ridurre le righe fisse: eliminare la duplicazione tra accesso esterno in alto, Altro e consultatore separato. Spostare filtri e fonti in pannelli, rispettando le istruzioni mobile first.
- Schede più compatte: numero blu, destinazione principale ben leggibile, servizio in secondo piano; eliminare “Direzione” ripetuto quando la struttura lo rende già chiaro.
- Conservare pietra e superfici chiare, con bordi sottili per separarle. Usare il blu per azione primaria e stato selezionato; l'oro solo come accento. Non cambiare nuovamente tutta la palette.
- Testi informativi di base intorno a 14–16 px; ridurre note tecniche visibili. Codici corsa come `700_1992062` nei dettagli, non accanto a ogni partenza.
- Orari grandi e allineati, destinazione leggibile su più righe; nessuna abbreviazione arbitraria dei nomi ufficiali. Distinguere nome visualizzato e valore originale della fonte.
- Conservare un'area di tocco di almeno 44 px: recuperare spazio riducendo duplicazioni, non rimpicciolendo i controlli.

## Priorità 3 — Mappa

- Separare linea evidenziata e linee di confronto. Rendere più leggere le altre; mostrare i punti soprattutto vicino allo zoom utile e mantenere selezionata la fermata aperta.
- Conservare un colore per ogni linea durante la sessione, indipendentemente dall'ordine della selezione. Integrare numeri sui percorsi e altri segnali visivi: non affidarsi solo al colore.
- Distinguere pressione della pillola per evidenziare e pulsante di rimozione. Evitare che l'unico comportamento della legenda sia cancellare una linea.
- Aprire la fermata in un pannello inferiore interno al dialog con partenze, verso e orari completi. Riduce i problemi dei popup stretti e delle sovrapposizioni con i comandi.
- Filtrare per direzione/variante; non dichiarare attiva oggi una variante OSM senza un collegamento verificato agli orari ufficiali.
- Su errore delle tessere stradali mostrare un messaggio e mantenere l'elenco; senza geometria una linea resta consultabile negli orari.

## Priorità 4 — Avvisi e accessibilità

Gli avvisi attuali sono pubblicazioni raccolte e associate anche tramite i numeri nel titolo. Il conteggio non prova che una deviazione sia attiva. Mostrare “Avviso recente” con data; riservare “In corso” ai casi con periodo di validità verificato. Nei dettagli della linea/fermata mostrare gli avvisi pertinenti e quelli generali, indicando l'incertezza dell'abbinamento.

Verificare contrasto di testi, stati selezionati e controlli. Riferimento: [WCAG contrasto minimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), 4,5:1 per testo normale e 3:1 per testo grande secondo le condizioni del criterio. Numeri, testo o forme devono accompagnare i colori delle linee: [uso del colore](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Provare tutta la consultazione da tastiera: focus iniziale sensato, Escape, ritorno al punto precedente, cambio direzione e risultati annunciati senza interrompere ogni digitazione. Ripristinare il focus sul controllo usato dopo il salvataggio di un preferito, invece di spostarlo genericamente al contenitore. Se la riga viene rimossa, scegliere il controllo successivo coerente.

Verificare 320, 390 e 430 px, testo ingrandito, tastiera aperta e orientamento orizzontale; conservare intestazione e navigazione senza sottrarre tutto lo spazio ai risultati. Il solo vincolo `100dvh` non garantisce l'accessibilità con ingrandimento: [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Sequenza consigliata e criteri di riuscita

Prima iterazione: catalogo unico, ricerca linea/fermata, intestazione compatta, prossime partenze e selezione direzione. Seconda: pannello fermata condiviso tra mappa generale, mappa linea ed eventi; preferiti di fermata. Terza: evidenziazione percorsi e perfezionamento avvisi.

Verifiche concrete prima della consegna:

- Cercare 24, 1974, Santini e una linea presente solo nel catalogo ufficiale; nessun falso “non disponibile” dovuto alle 38 schede.
- Aprire una fermata dalla mappa o da un evento senza doverla selezionare di nuovo.
- Passare da oggi a un festivo e a una data fuori validità con messaggi distinti; nessun orario stimato presentato come ufficiale.
- Mostrare subito le prossime corse per oggi e mantenere accessibili le corse passate del giorno.
- Gestire due fermate omonime, cambi rapidi, caricamenti tardivi, connessione assente e rifiuto della posizione.
- Verificare persistenza e rimozione dei preferiti, annullamento dei pannelli, focus e consultazione equivalente senza usare la mappa.
- A 320×640 puntare ad almeno 250 px per il contenuto principale nella vista iniziale, senza ridurre i controlli sotto 44 px; verificare anche i messaggi di errore e le etichette su più righe.

Questa analisi individua interventi progettuali e problemi osservati. Non introduce arrivi in tempo reale, aggiornamenti automatici dell'archivio o nuove associazioni tra OSM e ATV.
