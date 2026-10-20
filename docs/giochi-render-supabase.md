# Giochi su Render, dati su Supabase

## Stato del 20 ottobre 2026

Le migrazioni `20261020125426` e `20261020130120` sono applicate e registrate nel
progetto Supabase Verona. Verificati sul servizio reale: permessi delle quattro
tabelle, accesso negato al browser, API HTTPS del backend e recupero dello stato.

Render Free è attivo a https://verona-games.onrender.com, servizio
`srv-dbbmmr0ae00c739b945g`, regione Frankfurt, Node 24, controllo `/healthz`.
Il backend conferma `storage: supabase`. Collaudo HTTPS riuscito: ranked attivo,
accesso anonimo ranked negato, CORS per GitHub Pages, creazione e ingresso in un
tavolo privato Forza 4, mossa e recupero dello stato. Il solo tavolo di prova è
stato chiuso. Nessuna chiave privata è nel repository. La chiave backend è stata sostituita con `render_verona` e la precedente
`default` è stata revocata. La sostituzione finale su Render è stata completata
manualmente dall'utente. Dopo il nuovo deploy sono stati verificati su HTTPS
creazione, ingresso e recupero delle stanze Briscola e Forza 4, una mossa Forza 4,
accesso ai salvataggi Supabase e disponibilità ranked. I tavoli privati di prova
sono stati chiusi. La chiave precedente era comparsa nell'output tecnico della
sessione, senza essere pubblicata nel codice.

Il ramo di rilascio è `codex/games-cloud-storage` di `Madelirium/verona-app`,
separato dagli altri lavori locali. Rilascio isolato: 182 test superati e flusso
completo da due browser mobili con PostgreSQL. L'Actions variable
`BRISCOLA_API_URL` collega il frontend Pages all'origine Render sopra indicata.
Il frontend è pubblicato su https://madelirium.github.io/verona-app/ con build
GitHub Pages riuscito. Una partita ranked tra due account Google reali resta un collaudo manuale:
Google è verificato sul sito e il flusso ranked è collaudato con utenti di test.

Gli advisor non segnalano avvisi sui nuovi oggetti. Gli avvisi di esecuzione pubblica
della funzione interna RLS sono risolti dalla seconda migrazione; resta l'avviso
preesistente sulla protezione password compromesse, non modificata dal lavoro sui giochi.

Il motore Node decide mosse, carte, turni e risultati. Supabase conserva l'accesso
Google già configurato, i profili giocatore, Elo, storico e stato dei giochi.
GitHub Pages può continuare a ospitare l'interfaccia. Preferiti e altre scelte
personali dell'app rimangono locali: questo intervento riguarda i giochi.

## 1. Preparare Supabase

Nel progetto Verona aprire SQL Editor ed eseguire
[`supabase/migrations/20261020125426_games_cloud_storage.sql`](../supabase/migrations/20261020125426_games_cloud_storage.sql).
È una migrazione additiva e ripetibile: non elimina tabelle esistenti.
Applicare anche `supabase/migrations/20261020130120_restrict_internal_rls_trigger.sql`
se si prepara un nuovo ambiente: toglie i permessi browser a una funzione interna
di tipo event trigger, quando presente, lasciando invariati trigger e proprietario.

Crea nello schema `verona_private`:

- `game_runtime`: checkpoint con revisione per amichevoli Briscola, amichevoli
  Forza 4 e ranked. Comprende mazzo, mani, token, coda, conferme e timer.
- `player_profiles`: ID Supabase e soprannome pubblico dopo il primo risultato.
- `game_ratings`: Elo, partite e vittorie per gioco.
- `game_results`: esiti con partecipanti, motivo, data e variazioni Elo.

Le funzioni `verona_games_load` e `verona_games_commit` sono chiamabili solo da
`service_role`. Schema privato, RLS abilitata, nessun permesso ai ruoli del browser.
Non esporre `verona_private` fra gli schemi della Data API. È normale che queste
tabelle non siano interrogabili dal frontend con la publishable key.

Usare sul backend una chiave Supabase **secret** (`sb_secret_...`), configurata
come `SUPABASE_SECRET_KEY`. Non inserirla in HTML, GitHub Actions variables pubbliche,
URL o repository, e non copiarla in chat. Nel browser resta solo la publishable key.
Riferimenti: [chiavi Supabase](https://supabase.com/docs/guides/getting-started/api-keys),
[permessi delle funzioni](https://supabase.com/docs/guides/database/functions).

Con le variabili backend configurate si può eseguire `npm run games:check-cloud`:
verifica RPC e accesso negato al ruolo pubblico senza modificare dati. La verifica
locale non crea da sola tabelle nel progetto cloud.

## 2. Preparare Render

Il file [`render.yaml`](../render.yaml) descrive un Web Service Node 24, piano Free,
regione Frankfurt, avvio `npm start`, build `npm ci && npm run build` e health check
`/healthz`. Render imposta la porta; il server ascolta su `0.0.0.0`.
Non serve un disco persistente Render: in modalità Supabase il motore non scrive
classifiche o partite sul filesystem locale.

Configurare nell'ambiente del servizio:

| Variabile | Valore |
|---|---|
| `GAME_STORAGE` | `supabase` |
| `RANKED_ENABLED` | `true` |
| `SUPABASE_AUTH_ENABLED` | `true` |
| `SUPABASE_AUTH_METHOD` | `google` |
| `SUPABASE_URL` | URL del progetto Verona |
| `SUPABASE_PUBLISHABLE_KEY` | Chiave pubblica del progetto |
| `SUPABASE_SECRET_KEY` | Chiave segreta, soltanto su Render |
| `BRISCOLA_ALLOWED_ORIGIN` | `https://madelirium.github.io` |

Il server si ferma all'avvio se la modalità Supabase è scelta ma chiave, migrazione
o accesso al database mancano. Non ripiega silenziosamente su memoria o SQLite.
Per un ambiente di sviluppo locale è ancora possibile `GAME_STORAGE=memory`.
La migrazione dei risultati di un eventuale vecchio file SQLite richiede un'importazione
separata: attivare Supabase non importa né sovrascrive automaticamente quei dati.

Il repository remoto usato per la pubblicazione deve contenere tutti i sorgenti
dei giochi, la migrazione e `package-lock.json`; non basta il solo `public/index.html`.
Non pubblicare insieme lavori locali non pertinenti. Il login pubblicato il 20 ottobre
è un rilascio distinto: non prova che i giochi siano già sul repository remoto.

## 3. Collegare GitHub Pages

Dopo che Render ha assegnato l'URL HTTPS, impostare la Actions variable
`BRISCOLA_API_URL` alla sua origine, ad esempio `https://NOME.onrender.com`, senza
barra finale. Il workflow passa già questo valore al build. Rigenerare/pubblicare
il frontend. Le variabili URL e publishable key per il login restano quelle esistenti.
La secret key non deve essere inviata al workflow Pages.

Si può provare prima direttamente il frontend servito da Render: senza
`BRISCOLA_API_URL` usa la stessa origine del backend. Per effettuare il login
da quell'indirizzo aggiungerlo ai redirect consentiti di Supabase Auth; il sito
GitHub Pages mantiene invece il percorso OAuth già verificato.

## 4. Collaudo reale

1. `/healthz` risponde con `storage: "supabase"`.
2. Un browser anonimo non può leggere gli archivi tramite RPC.
3. Due account Google creano una sfida ranked, accettano e giocano.
4. Riavviare solo il servizio Node durante il test: carte, posti e versione devono
   tornare uguali, entro i limiti dei timer assoluti.
5. Concludere una partita e verificare un solo esito e una sola variazione Elo per
   ciascun giocatore. Provare anche abbandono e le stanze amichevoli con codice.

Render Free può andare in pausa e impiegare circa un minuto a ripartire; i dati
su Supabase restano, ma **non viene sospeso il tempo delle mosse**. Un'interruzione
oltre il tempo disponibile può quindi concludere una ranked per timeout. Le scadenze
sono riconciliate alla richiesta successiva, senza un job periodico.

La prima versione salva checkpoint aggregati e usa polling: valutare traffico,
latenza, proxy e limiti HTTP prima di aumentare i partecipanti. Un guasto Supabase
impedisce di confermare mosse; nessun salvataggio viene simulato come riuscito.
Predisporre backup/export del database e una politica per lo storico prima del
lancio pubblico. I backup non sono creati automaticamente da questo codice.

Test locali: `npm ci`, `npm test`, `npm run build`. PGlite è una dipendenza solo di
test; il server di produzione usa le API HTTPS Supabase senza SDK o dipendenze npm.

## Aggiornamenti immediati dei turni

Il server offre `/api/games/updates` su WebSocket. Il browser invia il token nel
primo messaggio, mai nell’URL. La sottoscrizione è autorizzata dal normale handler
della partita; le notifiche sono limitate alla propria stanza e contengono solo
un avviso di cambiamento, senza carte, token o altri dati privati. Sono emesse
soltanto dopo il salvataggio confermato, anche per le ranked. La mossa continua
a essere validata e salvata prima di essere mostrata come riuscita.

Con il canale attivo, il controllo periodico di sicurezza passa da 2,5 a 8 secondi;
una notifica anticipa subito il recupero dello stato. Con canale interrotto o non
supportato torna il polling da 2,5 secondi, con riconnessione e backoff sugli errori.
Le scadenze ranked continuano a essere controllate e il conto alla rovescia locale
si aggiorna ogni secondo. La pausa Briscola usa il tempo residuo comunicato dal
server: una presa già conclusa non aggiunge altri 1,1 secondi.

Le notifiche WebSocket appartengono al singolo processo Render. Su più istanze
il polling resta la protezione per gli eventi di altri processi; per aggiornamenti
immediati tra istanze occorrerà un canale condiviso. I dati restano su Supabase.
