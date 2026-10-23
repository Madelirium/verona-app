# Correzioni dopo la prova UX — 23 ottobre 2026

## Orari accessibili dagli eventi

Le partenze del consultatore ufficiale e delle anteprime fermata sono pulsanti. La dicitura “Fermate e arrivo” esplicita l’azione: apre la corsa esatta nell’archivio ATV, dalla fermata di salita in avanti. Scegliendo un arrivo si apre il riepilogo già usato dalla mappa autobus, con orari programmati, durata e fermate intermedie.

Il ritorno alle partenze conserva data, fermata, direzione e contesto dell’evento. Nessuna nuova richiesta a servizi di pianificazione e nessuna stima di ritardi in tempo reale.

## Orari e accesso agli eventi

`eventWhen` mostra anche l’ora di fine, quando successiva all’inizio e disponibile, nel fuso Europe/Rome. Gli eventi senza orario restano date; quelli su più giorni riportano la fine sulla rispettiva data.

Il parser del Comune importa `is_accessible_for_free` e `cost_notes`. Solo la dichiarazione esplicita di gratuità diventa prezzo zero: l’assenza del flag non significa evento a pagamento. Le condizioni testuali restano visibili nel dettaglio, comprese prenotazione, riduzioni e limiti. Nessun importo viene dedotto dalla descrizione.

Aggiornati i soli campi di accesso di 898 eventi locali, associando l’URL ufficiale alle schede dell’API comunale: 670 risultano gratuiti e 263 contengono note di accesso; i gruppi possono sovrapporsi. Non è un aggiornamento generale di tutti i feed. I prossimi import useranno gli stessi campi automaticamente. Per “Corso di bridge” i dati ora mostrano ingresso gratuito e 15:30–17:30.

## Verifica

- Frontend rigenerato con `npm run build`.
- 415 test superati, inclusi i nuovi casi su gratuità, condizioni, fuso e cambio ora, partenze cliccabili, scelta dell’arrivo e ritorno agli orari.
- Prova nel browser a 390×844 e 320×740: calendario → corso di bridge → autobus → linea 24, fermata 1706 → corsa → arrivo Santini B → riepilogo → altre partenze → evento.
- Immagini di verifica in `.local/ux-fix-evento.png`, `.local/ux-fix-autobus.png` e `.local/ux-fix-viaggio-320.png`.

Modifiche e dati disponibili nell’anteprima locale; pubblicazione GitHub non eseguita.
