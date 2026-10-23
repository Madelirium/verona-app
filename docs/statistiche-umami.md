# Statistiche di utilizzo — account collegato, pubblicazione in attesa

Il 23 ottobre 2026 l’utente ha creato l’account Umami e autorizzato esplicitamente l’aggiunta del sito. Creato “Verona in Tasca” per `veronaintasca.it` nell’area EU. Website ID pubblico: `c2c1d914-c8cf-49e1-a33f-c6234f91ac74`; script ufficiale: `https://cloud.umami.is/script.js`.

Configurazione aggiunta a `.env` locale e preparata in `.local/analytics-public-vars.json` per le tre variabili pubbliche di pubblicazione. La build locale contiene ora il collegamento, ma il dominio Wi-Fi è escluso e non carica il tracker. Nessun aggiornamento pubblicato o statistica utente inviata. Nessuna nuova dipendenza.

## Attivazione quando sarà disponibile l’account

1. Account e sito già configurati. Dashboard: https://cloud.umami.is/analytics/eu/websites/c2c1d914-c8cf-49e1-a33f-c6234f91ac74 . Il piano iniziale proposto è Hobby: verificare condizioni e quote nel proprio account.
2. Codice pubblico già recuperato dalla finestra **Tracking code**. Non servono password, token API o altre credenziali segrete.
3. Completare l’informativa del titolare, tempi di conservazione, condizioni/DPA del fornitore ed eventuali trasferimenti prima dell’attivazione. Il link alla privacy di Umami presente nelle Impostazioni non sostituisce l’informativa del titolare. Questa preparazione tecnica non costituisce una verifica legale di conformità.
4. Impostare nelle GitHub Actions **Variables** (non Secrets):
   - `ANALYTICS_ENABLED=true`
   - `ANALYTICS_UMAMI_WEBSITE_ID`: ID pubblico UUID fornito dalla dashboard
   - `ANALYTICS_UMAMI_SCRIPT_URL`: URL HTTPS `/script.js` fornito da Umami Cloud
5. Rigenerare e pubblicare. Verificare la ricezione nella dashboard con un consenso di prova sul sito pubblico; poi verificare revoca e assenza di eventi senza consenso. La prova reale di ricezione è ancora da fare.

Il frontend è predisposto per Umami Cloud, non per un host arbitrario: URL diversi da sottodomini `umami.is` vengono rifiutati dalla build. Nessuna chiave segreta nel browser. Il sito resta su GitHub Pages e l’archivio delle statistiche appartiene al servizio Umami, non a Pages.

## Scelta dell’utente e limiti delle misure

Scelta facoltativa nelle Impostazioni, disattivata inizialmente, persistita localmente e revocabile. Nessun banner che impedisca l’uso dei servizi. Il tracker viene caricato solo dopo il consenso, sul dominio pubblico HTTPS, senza DNT/GPC attivo e con rete disponibile. Localhost, indirizzi Wi-Fi e altri domini sono esclusi.

Le statistiche rappresenteranno **solo gli utenti che accettano e i cui browser consentono le richieste**, non il totale dei visitatori. Nessun recupero delle azioni precedenti al consenso, nessuna coda offline. Le statistiche storiche non vengono cancellate automaticamente con la revoca; cessano i nuovi invii. I visitatori calcolati dal fornitore sono stime, non persone identificate.

## Misure preparate

Visualizzazioni virtuali `/home`, `/discover`, `/calendar`, `/saved`, `/news`, `/bus`, `/explore`, `/eventmap`, `/district`, `/games`. Ripetere il rendering della stessa sezione non genera una nuova visualizzazione. La navigazione a ritroso passa per lo stesso collegamento.

| Evento | Significato |
| --- | --- |
| `event_open` | Apertura effettiva dei dettagli evento |
| `event_saved` | Nuovo “Mi interessa”, anche da Scopri |
| `event_participation` | Passaggio a “Partecipo” |
| `news_open` | Apertura notizia |
| `bus_timetable_open` | Apertura pannello orari ufficiali |
| `bus_journey_open` | Apertura riepilogo viaggio |
| `travel_open` | Apertura pannello “Come arrivare” a piedi |
| `pharmacies_open` | Apertura farmacie |
| `waste_open` | Apertura raccolta |
| `parking_open` | Apertura pannello parcheggi |
| `weather_open` | Apertura meteo |

I conteggi delle aperture dei pannelli non equivalgono a operazioni completate, prenotazioni o viaggi effettuati. Niente impression o clic dello spazio pubblicitario dimostrativo. Conteggi per singola linea/evento, provenienze delle campagne, errori e pubblicità reale sono interventi successivi, non inclusi ora.

## Minimizzazione

Payload costruiti esplicitamente con ID pubblico del sito, dominio, percorso virtuale, titolo generico della sezione, eventuale lingua e nome evento da lista fissa. Non vengono inviati valori di ricerca, nomi degli eventi, fermate, indirizzi, coordinate, account, identificatori utenti, codici stanza, query string, frammenti URL o referrer. Nessun `identify`, replay, heatmap o tracciamento automatico dei clic. Un filtro `before-send` rimuove ulteriori proprietà e respinge operazioni non ammesse.

Questo non rende la connessione anonima: Umami e i suoi fornitori ricevono necessariamente IP e dati tecnici di connessione; modalità di identificazione dei visitatori, localizzazione approssimata e log dipendono dal fornitore. Vanno considerati nella configurazione privacy.

## Verifica

Test con tracker simulato: nessuna richiesta senza consenso/configurazione, esclusione locale e DNT/GPC, revoca, dati sanitizzati, nomi evento ammessi, aperture non duplicate, errori script/storage e salvataggi effettivi. Nessun dato di prova inviato al fornitore.

Browser mobile: sezione Impostazioni visibile, casella disabilitata con stato “non configurato”; nessun tracker presente nel DOM locale. La dashboard remota e l’installazione reale dello script saranno verificabili solo dopo l’account.

Documentazione: https://docs.umami.is/docs/tracker-functions e https://docs.umami.is/docs/tracker-configuration.
