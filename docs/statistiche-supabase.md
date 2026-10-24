# Contatori aggregati Supabase

Implementazione del 24 ottobre 2026. Provider alternativo a Umami, mai due tracker contemporaneamente. Nessun nuovo pacchetto dell'app.

Stato verificato: migrazione applicata al progetto Verona (`ryoqmcnuwhbwyforatla`, regione eu-west-1), funzione `usage-count` versione 1 attiva. Richiesta valida HTTP 204 e incremento reale confermato; richieste con campo extra, chiave errata e origine estranea respinte rispettivamente con 400/401/403. Dato di prova rimosso dopo verifica, senza lasciare conteggi simulati. Permessi RPC: anon e authenticated esclusi, service_role autorizzato. Frontend configurato sul nuovo provider; la pubblicazione GitHub Pages usa le quattro variabili pubbliche ANALYTICS_* documentate sotto. La raccolta sul dispositivo resta subordinata alla scelta nelle impostazioni.

Verifiche locali: 445 test superati, inclusi test di contatori atomici, limiti, conservazione, permessi e dati trasmessi dal browser. Advisor Supabase: RLS senza policy sulle tabelle private è intenzionale, accesso esclusivamente server. Resta l'avviso Auth già presente sulla [protezione da password compromesse](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), indipendente da questi contatori. Non sono state cambiate le impostazioni di autenticazione dei giochi.

## Funzionamento e limiti

`public/analytics.js` riutilizza gli hook delle sezioni, delle finestre dei servizi e dei salvataggi. Invia soltanto `{section, action}`, con elenchi chiusi. Nessun identificatore di persona/sessione, contenuto, quartiere, coordinate, URL o ricerca. Nessuna coda offline né ritentativo automatico: i conteggi sono indicativi, possono perdere richieste e non misurano visitatori unici. Navigazioni ripetute nella stessa sezione senza lasciarla non incrementano il totale.

Attivazione nelle impostazioni, esclusione di anteprime, DNT e GPC; un precedente rifiuto resta valido. Prima versione facoltativa: la forma aggregata del database da sola non dimostra un'esenzione dal consenso. La scelta è salvata localmente, senza creare un identificatore remoto. La revoca blocca le nuove richieste, ma non può ritirare una richiesta già partita.

Supabase riceve inevitabilmente IP e intestazioni della connessione: questo codice non li registra né li usa per correlare le richieste, ma non elimina i log operativi del fornitore. Informativa, accordo con il fornitore e impostazioni dei log vanno gestiti dal titolare. Non presentare questa soluzione come assenza assoluta di trattamento di dati personali.

## Backend

Funzione `usage-count`, con controllo della chiave pubblica di progetto nel corpo del gestore. `verify_jwt=false` è necessario per le moderne chiavi publishable, che non sono JWT. Non richiede login e non trasmette token di account. Le chiavi segrete restano nelle variabili server fornite da Supabase.

Solo origini pubbliche previste, POST JSON massimo 160 byte, dati sconosciuti rifiutati. CORS e chiave pubblica non fermano un bot che simula un browser: i conteggi non sono prova commerciale di audience. Quota globale di 100.000 incrementi/giorno, atomica nel database; non limita il numero delle invocazioni Edge fatturabili. Monitorare le quote del piano Supabase e limitare l'endpoint a monte se aumenta il traffico abusivo. Nessuna promessa di costi nulli oltre i limiti del piano.

Tabelle private con RLS, senza policy anon/authenticated; RPC SECURITY INVOKER eseguibile soltanto dal ruolo server. Incremento atomico, data Europe/Rome determinata dal database. Due tabelle: totali per sezione/azione e quota totale giornaliera. Pulizia oltre 90 giorni alla successiva richiesta accettata; in assenza di traffico non è una cancellazione temporizzata. Per scadenza rigorosa aggiungere un job amministrativo dedicato.

## Configurazione del frontend

```dotenv
ANALYTICS_ENABLED=true
ANALYTICS_PROVIDER=supabase
ANALYTICS_SUPABASE_ENDPOINT=https://PROJECT.supabase.co/functions/v1/usage-count
ANALYTICS_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Usare le stesse variabili pubbliche nel workflow Pages. Non inserire una secret o service_role key. Build tramite `npm run build`; il cambio provider richiede pubblicazione del frontend. La semplice distribuzione della funzione non attiva la raccolta sui dispositivi.

## Consultare i risultati

Dal SQL Editor amministrativo del progetto Supabase, non dal browser pubblico:

```sql
select day, section, action, total
from verona_private.usage_daily
order by day desc, total desc;

select section, action, sum(total) as total
from verona_private.usage_daily
where day >= (now() at time zone 'Europe/Rome')::date - 6
group by section, action
order by total desc;
```

Non c'è ancora una dashboard dedicata ai contatori. Quella di Umami non visualizza questi dati. Disattivazione generale: `ANALYTICS_ENABLED=false` e nuova build/pubblicazione.

Riferimento verificato: [chiavi moderne, variabili Edge e autenticazione](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
