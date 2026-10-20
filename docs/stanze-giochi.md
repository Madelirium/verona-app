# Stanze pubbliche e private

In **Giochi**, scegliere Briscola o Forza 4. **Stanze in attesa** apre un pannello con le stanze pubbliche del gioco selezionato, nome dell'ospite e pulsante **Entra**. Non serve un soprannome per consultare l'elenco; per entrare è richiesto un nome da 1 a 24 caratteri nel pannello. Chiuderlo senza entrare non crea una partita e non modifica il soprannome del modulo principale.

Quando si crea una partita, **Chi può entrare?** propone inizialmente **Privata · solo con codice o link**. Scegliendo **Pubblica**, il proprio soprannome e la disponibilità della stanza sono visibili alle altre persone che consultano quel gioco. La schermata di attesa indica la visibilità scelta. Le stanze private restano completamente escluse dall'elenco e si raggiungono come prima tramite codice o link.

Il pannello si aggiorna ogni cinque secondi finché è aperto e offre anche **Aggiorna**. Mostra solo stanze pubbliche, in attesa di un secondo giocatore, il cui ospite ha contattato il server negli ultimi 12 secondi. Una breve disconnessione nasconde temporaneamente la stanza, che ricompare quando l'ospite riprende la connessione. L'elenco mostra al massimo le 100 stanze più recenti, con conteggio totale se ne esistono di più. L'intestazione, il soprannome e le azioni restano visibili mentre scorre solo l'elenco.

L'ingresso è verificato dal server al momento della richiesta: due ingressi contemporanei ammettono solo la prima persona. Se una stanza viene occupata o chiusa dopo essere comparsa nell'elenco, il pannello segnala il problema e aggiorna le disponibilità. Una stanza occupata, chiusa o scaduta non viene elencata. Leggere l'elenco non prolunga la vita delle stanze.

## API e dati

`POST /api/briscola/list` e `POST /api/forza4/list` accettano un oggetto JSON vuoto, senza token. Restituiscono `game`, `total` e `rooms`. Ogni voce contiene soltanto `code`, `hostName`, `game` e `createdAt`. Non vengono pubblicati token, mani, carte né dati di stanze private.

`create` accetta `visibility: "private" | "public"`; se omessa, il valore è `private`. La risposta autenticata include la visibilità della stanza. L'ingresso continua a usare `join`, senza introdurre un percorso che eviti i controlli sul posto libero. Configurazione di hosting e limiti restano quelli del servizio dei giochi.

Test automatici per entrambi i giochi: impostazione privata iniziale, esclusione delle stanze private e occupate, ospiti scollegati, riconnessione, chiusura, scadenza, limite dell'elenco, assenza di dati riservati e ingresso concorrente. Collaudo con due browser: creazione privata/pubblica, elenco, soprannome richiesto, ingresso diretto, aggiornamento automatico, posto già occupato, chiusura senza ingresso e layout a 320, 375, 430 e 1.024 px.
