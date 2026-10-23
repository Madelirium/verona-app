# Briscola privata a due

Accesso da **Giochi** nella navigazione inferiore. Un giocatore crea la stanza con un soprannome (massimo 24 caratteri); l'altro usa il codice di sei caratteri o il link d'invito. Nessun account. Il codice invita, mentre un token casuale privato conserva il posto nel browser: non è incluso nel link né esposto all'avversario.

## Prova locale e Wi-Fi

Eseguire `npm run build`, poi `npm start` oppure `npm run start:lan`. Due browser o telefoni devono usare lo stesso server. Per provare due persone sullo stesso computer, usare due profili o una finestra privata: due schede nello stesso profilo condividono il posto salvato. Aprire direttamente `public/index.html` non avvia il servizio multiplayer.

## Pubblicazione Internet

Il servizio è incluso in `scripts/serve.mjs`, senza dipendenze aggiuntive. GitHub Pages pubblica il frontend statico e non esegue il servizio Node. Questa modifica non pubblica un nuovo server.

Per distribuire insieme frontend e servizio su un host Node 22 o successivo:

```powershell
npm run build
$env:HOST='0.0.0.0'
$env:PORT='8080'
npm start
```

Usare un dominio HTTPS tramite il servizio di hosting o un reverse proxy. Per mantenere il frontend su Pages e distribuire separatamente il servizio:

1. Impostare sul backend `BRISCOLA_ALLOWED_ORIGIN` all'origine esatta del frontend, ad esempio `https://nome.github.io` (senza percorso del repository).
2. Impostare la variabile Actions del repository `BRISCOLA_API_URL` all'origine HTTPS del backend, senza barra finale, e rigenerare/pubblicare il sito. Il workflow passa già la variabile alle build, incluse quelle degli importatori.
3. Provare creazione, invito, partita e riconnessione da due dispositivi esterni alla rete locale.

Per una build manuale, impostare `BRISCOLA_API_URL` nell'ambiente prima di `npm run build`. Il valore è pubblico, non una credenziale. Senza variabile il browser usa il server della stessa origine.

## Comportamento e limiti della prima versione

Il server mescola le 40 carte con il generatore casuale di Node, decide turni, prese e punteggi e invia a ciascun giocatore solo la propria mano. La carta di briscola visibile resta in fondo al mazzo; il vincitore della presa pesca per primo. Dopo ogni presa il server attende 1,2 secondi per permetterne la lettura. Il pannello Ultima presa conserva carte, vincitore e punti anche dopo la carta successiva. Una versione per mossa rifiuta richieste duplicate o basate su uno stato precedente.

Aggiornamento ogni 2,5 secondi. Una breve interruzione di rete mantiene il posto e ritenta la connessione. La sessione può essere ripresa nello stesso browser, anche dopo ricaricamento, se la memoria locale è disponibile. Non c'è recupero se si cancellano i dati del browser o si perde il token. L'uscita richiede conferma e chiude la stanza per entrambi; al termine si può chiedere una rivincita mantenendo codice e posti, con consenso di entrambi e possibilità di annullare la richiesta. Ogni incontro ha un identificativo distinto e la versione della stanza continua a crescere.

Le stanze restano **in memoria in un singolo processo**, massimo 1.000, ed expirono dopo 30 minuti senza richieste valide dei giocatori. Il riavvio del server interrompe tutte le partite. Non usare più repliche senza introdurre una memoria condivisa. Queste regole descrivono le amichevoli. La modalità separata [Classificate · Elo](ranked.md) introduce account verificati, matchmaking e classifica; resta da attivare dopo il completamento del login Google. Non sono presenti chat, scommesse o posta in gioco. Per un lancio con traffico elevato serviranno gestione della capacità e limiti per client dietro il proxy: le richieste senza identità valida hanno un limite di 240 al minuto per indirizzo di connessione; i giocatori autenticati hanno una quota di 300 richieste per posto, separata dagli altri utenti sullo stesso indirizzo. La configurazione dei proxy per il traffico anonimo resta da definire sull’hosting scelto.

Verifica automatica: regole delle prese, 30 partite complete, 40 carte uniche e 120 punti per partita, mani nascoste, autenticazione, mosse fuori turno e duplicate, stanza occupata, scadenza, chiusura, CORS e limiti dei payload. Verifica browser con due sessioni distinte: invito, mosse, ricaricamento, annullamento dell'uscita e chiusura; layout a 320, 375, 430 e 1.024 px.

## Briscola in tre e quattro

Nelle stanze amichevoli si sceglie la capienza prima di creare il tavolo: 2, 3 o 4.
La distribuzione parte soltanto a capienza raggiunta. In tre si gioca individualmente
con 39 carte, togliendo il due di denari; vince il punteggio più alto, con eventuale
parità. In quattro si gioca a coppie: posti 1 e 3 contro 2 e 4. I posti seguono
l’ordine d’ingresso; il turno prosegue in senso antiorario da un posto al successivo.
Le carte degli altri, compreso il compagno, restano nascoste. Chi prende pesca per
primo, seguito dagli altri nell’ordine di gioco. La rivincita richiede tutti i voti;
uscire chiude il tavolo per tutti, previa conferma. Le ranked restano a due.

La capienza, i posti e le prese sono nel checkpoint già salvato su Supabase: non
sono necessarie nuove tabelle o migrazioni. I checkpoint preesistenti senza capienza
sono interpretati come partite a due. Gli avvisi WebSocket restano per stanza.
