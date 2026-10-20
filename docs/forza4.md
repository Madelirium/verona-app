# Forza 4 online

In **Giochi**, il selettore permette di scegliere **Briscola** o **Forza 4**. Ogni gioco conserva una sessione distinta nel browser. Cambiare gioco lascia disponibile la stanza precedente finché non scade; selezionandolo nuovamente si riprende la partita. La scelta del gioco persiste al ricaricamento. Durante il recupero dal server viene mostrato lo stato di caricamento.

Due persone entrano con soprannome e codice privato di sei caratteri. Il link con parametro `?forza4=CODICE` apre il gioco corretto e precompila il codice. Non ci sono account. Un token privato conserva il posto nello stesso browser, come per la briscola.

Il tabellone ha sette colonne e sei righe. Il server sorteggia il primo turno, applica la gravità, impedisce mosse fuori turno, colonne piene, indici non validi e richieste duplicate. Vince una linea di almeno quattro pedine in orizzontale, verticale o diagonale. Se le 42 caselle si riempiono senza vincitore, il risultato è pareggio. Alla conclusione si può chiedere una rivincita mantenendo codice e posti: il server avvia il nuovo incontro solo con due consensi. Si può annullare la propria richiesta o tornare ai giochi chiudendo la stanza con conferma.

La colonna si seleziona toccando il tabellone oppure con due pulsanti freccia. Una corsia evidenziata e, durante il proprio turno, una pedina semitrasparente mostrano dove cadrà la mossa. Il tocco seleziona soltanto: si gioca premendo **Lascia cadere**, con la pedina del proprio colore. I tre pulsanti hanno area di almeno 44 × 44 px anche a 320 px. Se la colonna è piena il lancio è disabilitato; si può scegliere un'altra colonna. Le frecce permettono di preparare una selezione anche durante il turno avversario.

Da tastiera, sul tabellone, Freccia sinistra/destra e Home/End selezionano la colonna; Invio o Spazio giocano. I pulsanti restano raggiungibili con Tab. I colori sono affiancati dai simboli ● e ○ e dalle descrizioni delle caselle; l'ultima pedina e la linea vincente sono evidenziate. Una breve animazione segnala una nuova pedina e rispetta la preferenza di movimento ridotto. Le regole e la conferma dell'uscita sono pannelli modali. La navigazione inferiore resta visibile.

## Avvio e pubblicazione

`npm run build`, poi `npm start` o `npm run start:lan`. Per provare due persone sullo stesso computer usare profili distinti o una finestra privata. Il servizio si trova in `/api/forza4/` e usa la stessa configurazione di hosting e CORS della briscola, inclusi `BRISCOLA_API_URL` e `BRISCOLA_ALLOWED_ORIGIN`: non occorre un secondo server.

Come per la briscola, GitHub Pages da solo non ospita il multiplayer. Il servizio Node deve essere pubblicato e collegato al frontend per giocare da reti diverse. [Configurazione del servizio](briscola.md).

Le stanze risiedono nella memoria di un singolo processo e si perdono al riavvio; scadono dopo 30 minuti senza richieste valide. Il polling è ogni 2,5 secondi. Il cambio di gioco sospende gli aggiornamenti della stanza precedente su quel browser; un altro giocatore ancora collegato la mantiene attiva. Una breve disconnessione avvia la riconnessione automatica. Cancellare la sessione dal browser non consente di recuperare il proprio posto con il solo codice.

## Verifiche

Test delle quattro direzioni, dei bordi, delle linee più lunghe di quattro, della gravità e delle colonne piene; vittorie tramite servizio, pareggio in 42 mosse, rientro, mosse rifiutate e protezione dell'accesso. Prova HTTP con due identità e stanze separate dalla briscola. Collaudo browser con due giocatori, cambio gioco e sessioni distinte, link, vittoria, evidenziazione, ricaricamento, regole e annullamento/chiusura. Layout verificato a 320, 375, 430 e 1.024 px.

La modalità separata [Classificate · Elo](ranked.md) richiede un account verificato, abbina gli avversari e registra il risultato sul server. Nelle ranked non è prevista la rivincita nello stesso tavolo. Rimane disattivata finché Google e server persistente non sono pronti.
