# Classificate e matchmaking — prima versione

Briscola e Forza 4 hanno una modalità ranked separata dai tavoli amichevoli.
Solo gli account Supabase con email verificata possono accedere alle API ranked.
L'interfaccia usa il login Google esistente; non crea un secondo sistema di account.
La modalità è **disabilitata per impostazione predefinita** finché il backend non è
configurato. Il login Google è stato verificato separatamente (vedere [login](login.md)).
L'integrazione Supabase/Render dei giochi richiede migrazione e configurazione dei
servizi reali: i test locali non equivalgono a una pubblicazione online.

## Regole

- Elo iniziale 1000, separato per gioco. Formula classica con K=32, risultato 1/0,5/0.
  Con Elo uguali: vittoria +16, sconfitta −16, pareggio 0; la somma resta costante.
- Soprannome pubblico da 1 a 24 caratteri; l'email non compare in classifica e non
  viene salvata nel database ranked. Gli ID account sono conservati solo sul server.
- Primi cinque incontri indicati come piazzamento; la formula resta identica.
- Una sola ricerca o partita attiva per account, anche tra schede e giochi diversi.
- Abbinamento per gioco e vicinanza Elo: tolleranza iniziale ±100, +50 ogni 15 secondi
  per entrambi i giocatori, massimo ±600. Priorità alla coda più vecchia e, tra i suoi
  avversari compatibili, a quello con Elo più vicino. Non ci si può abbinare da soli.
- La ricerca richiede aggiornamenti entro 20 secondi. Trovato un avversario, entrambi
  devono accettare entro 30 secondi. Annullamento e mancata conferma non cambiano Elo.
  Il server non rimette automaticamente in coda il giocatore rimasto senza avversario.
- Dopo entrambe le conferme, 90 secondi per ogni mossa. Il timer riparte solo dopo
  una mossa valida: aggiornamenti, riconnessioni e richieste rifiutate non lo estendono.
  Non c'è pausa automatica per disconnessione: riconnettersi entro il tempo rimanente.
- Abbandono o tempo scaduto valgono una sconfitta. Nessuna rivincita ranked nello
  stesso tavolo; tornare alla sala giochi e cercare di nuovo un avversario.
- Il server decide carte, turni, vittorie e variazioni Elo. Il browser non può inviare
  un risultato da registrare. Risultato unico per match ID e aggiornamento delle due
  valutazioni nella stessa transazione del salvataggio della partita. Gli esiti già
  registrati non si contano due volte. SQLite resta disponibile solo come modalità locale.
- Classifica dei primi 50 per gioco, popolata dopo il primo incontro concluso.

## Configurazione del server

Node **22.13 o superiore**, consigliato Node 24. Le API sono in `/api/ranked/`.
Usano lo stesso `BRISCOLA_API_URL` e `BRISCOLA_ALLOWED_ORIGIN` delle amichevoli.
Ogni chiamata protetta verifica il bearer token con `/auth/v1/user` di Supabase;
non usa l'ID inviato dal browser, né si limita a decodificare il JWT. La verifica del
login usa la publishable key; l'archivio remoto usa invece una secret key **solo sul
backend**. Verifica coerente con [getUser di Supabase](https://supabase.com/docs/reference/javascript/auth-getuser).

Variabili del backend (anche da `.env`, mai pubblicare quel file):

```dotenv
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_AUTH_ENABLED=true
RANKED_ENABLED=true
GAME_STORAGE=supabase
SUPABASE_SECRET_KEY=sb_secret_...
```

Applicare prima la [migrazione](../supabase/migrations/20261020125426_games_cloud_storage.sql), poi
configurare Render seguendo la [guida di pubblicazione](giochi-render-supabase.md).
Per la prova locale con `GAME_STORAGE=memory`, il percorso SQLite predefinito è
`.local/ranked.sqlite`, ignorato da Git. Non viene caricato automaticamente in Supabase.
Il server si avvia con `npm start`; dopo modifiche frontend eseguire `npm run build`.

## Persistenza e limiti prima del lancio

Con `GAME_STORAGE=supabase`, stanze amichevoli, code, conferme, partite, profili
giocatore, valutazioni e risultati sono su PostgreSQL. Carte, token dei tavoli e
checkpoint non sono leggibili dal browser: schema privato, RLS e RPC solo backend.
Il server ricarica lo stato prima di applicare una richiesta e conferma solo dopo
il commit. Il controllo della revisione impedisce sovrascritture concorrenti.
Una scrittura fallita non viene confermata e non produce un aggiornamento solo locale.

Al riavvio si recupera la partita conservando token, carte e versione. **I timer
continuano durante le interruzioni del server**: una mossa scaduta viene riconciliata
alla prima richiesta successiva e può assegnare una sconfitta. Proposte e ricerche
scadono secondo le regole sopra; non restano valide indefinitamente solo perché salvate.
Risultati finiti recuperabili per 30 minuti; Elo e storico rimangono nel database.
Con `GAME_STORAGE=memory`, invece, il riavvio interrompe le partite e soltanto Elo
e risultati SQLite rimangono se il file locale sopravvive. Non usare questa modalità
su Render Free. GitHub Pages da solo non esegue il motore.

Questa prima integrazione usa un checkpoint per ciascun gioco amichevole e uno
per il matchmaking ranked. Le richieste aggiornano anche la presenza dei giocatori;
quindi il polling causa letture/scritture remote. È una base per una beta contenuta,
non una soluzione collaudata per 1000 giocatori simultanei. Prima di crescere servono
checkpoint per singola partita, presenza separata, misure di carico e valutazione
del passaggio a WebSocket. Il controllo concorrente è verificato fra due istanze,
ma il rilascio iniziale resta a una sola istanza Render.

Massimo iniziale 1000 account tra ricerca e partita, limite HTTP 600 richieste al
minuto per indirizzo di connessione. Non è una garanzia di carico supportato: prima
del lancio verificare hosting, proxy, account dietro NAT, costi delle verifiche
Supabase, carico reale e monitoraggio. Nessuna gestione anti-collusione tra account
diversi o prevenzione degli abbinamenti ripetuti: necessarie prima di premi o
competizioni. Non sono previsti premi, denaro o posta in gioco.

## Verifica

`node --test scripts/ranked.test.mjs`: Elo, duplicati, coda scaduta, conferma,
annullamento, controlli sugli account, mosse, Briscola completa, Forza 4, abbandono,
timeout, persistenza dopo riapertura e default disabilitato.
`node --test scripts/game-persistence.test.mjs` esegue la migrazione su PostgreSQL
in WASM (PGlite), verifica i permessi anon/authenticated, i contratti HTTP/RPC,
Briscola completa, Forza 4, concorrenza, riavvii e rollback. Le API Auth sono
simulate nei test dei giochi. La prova sul progetto Supabase e su Render reale
va eseguita dopo aver collegato e configurato i servizi.
