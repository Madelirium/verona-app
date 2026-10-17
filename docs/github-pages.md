# Pubblicazione su GitHub Pages

Il sito funziona senza il computer locale: il frontend include il catalogo e la logica dell'applicazione. Le tessere della mappa e i portali esterni richiedono connessione Internet.

1. Caricare questo progetto in un repository GitHub dedicato.
2. Aprire Settings → Pages → Build and deployment e scegliere **GitHub Actions** come Source.
3. Effettuare un push su `main` o `master`, oppure avviare manualmente il workflow **Pubblica Verona su GitHub Pages** dalla sezione Actions.
4. Attendere la conclusione del job deploy. L'indirizzo del sito è mostrato nell'environment `github-pages` e in Settings → Pages.

Il workflow rigenera il frontend, esegue i test e pubblica soltanto `index.html`, la licenza Leaflet e `.nojekyll`. Il sito supporta il percorso di un repository Pages senza dipendere da `/data` o da un server Node.

Gli importatori non vengono eseguiti dal workflow: i dati pubblicati sono l'ultima raccolta salvata nel repository. L'aggiornamento delle fonti va eseguito separatamente e richiede un nuovo push. Non è impostata alcuna sincronizzazione ricorrente.

Salvati, scelte degli eventi e quartiere restano nel browser di ciascun dispositivo. Non si trasferiscono automaticamente dall'anteprima Wi-Fi all'indirizzo Pages, né fra telefoni diversi. La prima visita al sito pubblico parte quindi senza le preferenze dell'anteprima locale.

Con GitHub Free, Pages è disponibile per repository pubblici: il codice caricato diventa consultabile. Le condizioni di utilizzo delle fonti, le sedi e gli aggiornamenti dei contenuti restano da verificare prima di promuovere il servizio al pubblico. La pubblicazione serve inizialmente come anteprima del progetto.
