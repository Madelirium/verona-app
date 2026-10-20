# Accesso facoltativo con Google

## Pubblicazione HTTPS del 20 ottobre 2026

Sito: https://madelirium.github.io/verona-app/
Il login Google facoltativo è pubblicato e verificato sul sito reale: accesso,
ritorno al percorso /verona-app/, sessione dopo ricarica, logout e uso senza account.
Layout controllato a 320 px. Workflow Pages #9 completato con successo sul commit
4cb29c5; build e 135 test della versione pubblica superati.
La pubblicazione aggiunge il login alla versione già online e conserva i dati
remoti aggiornati. Gli altri lavori locali su autobus e giochi non fanno parte
di questo rilascio. I salvati restano locali al browser/origine: quelli dell’anteprima
HTTP non vengono trasferiti automaticamente al sito HTTPS.


Verona resta consultabile senza account, compresi salvataggi locali e giochi amichevoli.
La modalità [Classificate · Elo](ranked.md) richiede invece un account verificato dal server.
Il pannello Account contiene “Continua con Google” e “Continua senza account”.
Non si inviano codici email; non servono SMTP o un dominio acquistato per la prova.
I preferiti restano sul dispositivo: la sincronizzazione non è ancora implementata.

## Progetti e stato

- Supabase: **Verona**, Free, West EU (Ireland), riferimento `ryoqmcnuwhbwyforatla`.
  [Apri progetto](https://supabase.com/dashboard/project/ryoqmcnuwhbwyforatla).
- Google Cloud: **Verona**, ID `wise-sandbox-512207-e1`.
  [Configurazione Google](https://console.cloud.google.com/auth/overview?project=wise-sandbox-512207-e1).
- Google Auth Platform: nome app Verona, pubblico esterno in modalità test,
  email assistenza e contatto autorizzati dall’utente. Branding completato e norme
  Google accettate con conferma esplicita dell’utente.
- Il client “Verona web” è stato creato dall’utente, che ha trasferito le credenziali
  nel provider Google di Supabase. Il provider è verificato come Enabled, con
  Skip nonce checks e Allow users without an email disattivati.
- Site URL Supabase: `http://127.0.0.1:4173/`. Redirect consentiti verificati:
  `http://127.0.0.1:4173/` e `http://localhost:4173/`, senza wildcard.
- `.env` locale contiene esclusivamente URL e chiave publishable; Git lo ignora.
  `SUPABASE_AUTH_METHOD=google`, `SUPABASE_AUTH_ENABLED=true` per anteprima locale e sito pubblico.
  Nessuna password o client secret va nel frontend o nel repository.

## Completamento Google Auth Platform

1. Completare il branding Google, verificando nome, email assistenza e contatto.
   Accettazione delle condizioni e creazione/inserimento di nuove credenziali
   richiedono l’intervento o la conferma dell’utente nel browser.
2. Creare un client OAuth di tipo **Applicazione web**, nome “Verona web”.
3. Impostare l’origine JavaScript locale `http://localhost:4173`.
   Se si usa `127.0.0.1`, aggiungere anche `http://127.0.0.1:4173`.
4. Aggiungere come URI di reindirizzamento Google, esattamente:

   ```text
   https://ryoqmcnuwhbwyforatla.supabase.co/auth/v1/callback
   ```

5. Copiare client ID e client secret **solo nel provider Google di Supabase**,
   abilitarlo e salvare. Non attivare “Skip nonce checks” o utenti senza email.
6. Nelle URL Configuration Supabase impostare Site URL e consentire i ritorni esatti
   `http://localhost:4173/` e, se usato, `http://127.0.0.1:4173/`.
   Per il sito pubblico usare il suo effettivo URL HTTPS, compreso il percorso:
   non occorre acquistare un dominio. Non usare wildcard ampie.
7. Il progetto Google è ancora External / Testing e richiede solo email e profilo.
   Google documenta un’eccezione per i soli scope di identità di Sign in with Google:
   non occorre inserire ogni utente nella lista tester. L’aggiunta di altri scope
   richiederà una nuova valutazione di audience e verifica.
   Fonte: https://support.google.com/cloud/answer/15549945?hl=en
8. Impostare `SUPABASE_AUTH_ENABLED=true`, eseguire `npm run build` e `npm start`.
   Verificare accesso, annullamento, ripristino dopo ricarica, logout e rete assente.

## Implementazione

`public/auth.js` separa adattatore Supabase e interfaccia. Il flusso Google usa
OAuth PKCE S256: verifier casuale crittografico in sessionStorage, challenge SHA256
inviata a Supabase, callback con codice monouso scambiato per una sessione.
Il verifier è valido dieci minuti, vincolato al percorso/origine e rimosso al ritorno.
I parametri di callback vengono rimossi dalla cronologia; nessun token nell’URL.
Serve HTTPS, oppure localhost/127.0.0.1 per lo sviluppo; accesso da file o HTTP LAN
non supportato. Non viene avviato alcun accesso senza un clic dell’utente.

La sessione viene verificata col server al ripristino e rinnovata prima della scadenza.
Il logout revoca la sessione corrente, conserva i preferiti locali e permette di
riprovare in caso di errore di rete. Su dispositivi condivisi i salvati locali
rimangono consultabili anche senza account.
Le operazioni OTP sono mantenute solo nell’adattatore per una futura estensione;
il pannello corrente offre esclusivamente Google.

Il build carica `.env` dalla radice; le variabili già nell’ambiente hanno precedenza.
`.env.example` documenta i valori. Il workflow Pages legge URL, publishable key e
flag di attivazione dalle Actions variables; il metodo è Google. Le variabili
del repository sono configurate e il deploy HTTPS è completato. Il Site URL
Supabase è https://madelirium.github.io/verona-app/; lo stesso ritorno esatto
è nell’allowlist, insieme ai due indirizzi locali. L’origine JavaScript Google
include https://madelirium.github.io; la callback rimane su Supabase.

Una migrazione richiederà trasferimento dei dati, mappatura degli ID e nuovo accesso;
le sessioni non sono automaticamente trasferibili. Per i dati personali serviranno
tabelle e policy RLS per utente prima di collegarle alla UI. Lo stato di login del
browser non autorizza le API Node o le partite.

## Verifiche

Test automatici: challenge PKCE, verifica del ritorno, rifiuto di callback estranee,
scadenza, annullamento, memoria bloccata, logout, rinnovo e conservazione dei salvati.
Le risposte HTTP dei test sono simulate. La prova reale del 20 ottobre ha completato
il consenso Google autorizzato con soli nome/foto profilo ed email, il ritorno a Verona
e il ripristino della sessione dopo ricarica. Anche il logout reale e l’assenza
di sessione alla ricarica successiva sono verificati. Il pannello è
verificato a 320 e 430 px, con uso senza account e chiusura da tastiera.

Fonti: [Google con Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
