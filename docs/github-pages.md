# Pubblicazione su GitHub Pages

Il sito funziona senza il computer locale: il frontend include il catalogo e la logica dell'applicazione. Le tessere della mappa e i portali esterni richiedono connessione Internet.

1. Caricare questo progetto in un repository GitHub dedicato.
2. Aprire Settings → Pages → Build and deployment e scegliere **GitHub Actions** come Source.
3. Effettuare un push su `main` o `master`, oppure avviare manualmente il workflow **Pubblica Verona su GitHub Pages** dalla sezione Actions.
4. Attendere la conclusione del job deploy. L'indirizzo del sito è mostrato nell'environment `github-pages` e in Settings → Pages.

Il workflow rigenera il frontend, esegue i test e pubblica soltanto `index.html`, la licenza Leaflet e `.nojekyll`. Il sito supporta il percorso di un repository Pages senza dipendere da `/data` o da un server Node.

Il workflow include la raccolta automatica degli **eventi** da Comune e Veronafiere e delle **schede e pubblicazioni ATV** ogni giorno alle **04:17 UTC** (05:17 in inverno, 06:17 in estate a Verona). La pianificazione diventa operativa quando questo file viene caricato sul branch predefinito del repository; GitHub può ritardare le esecuzioni e disattivare le pianificazioni dei repository pubblici dopo 60 giorni senza attività. Una visita all'app non avvia l'importazione. Notizie del Comune e luoghi mantengono i propri aggiornamenti manuali.

Da Actions → **Pubblica Verona su GitHub Pages** → Run workflow, le opzioni di raccolta eventi e ATV sono attive per impostazione predefinita e si possono scegliere separatamente. Un normale push pubblica invece i dati già salvati, senza richieste alle fonti. Non serve un computer acceso per le esecuzioni su GitHub.

La raccolta ha tre tentativi per problemi temporanei di rete, mantiene le singole ricorrenze, aggiorna gli identificativi esistenti ed elimina i duplicati per identificativo. Una fonte vuota, incompleta o con un calo superiore al 70% rispetto ai precedenti eventi ancora futuri non sostituisce i dati di quella fonte: occorre verificare il rapporto. Gli eventi non più presenti non vengono automaticamente etichettati come cancellati. I salvati restano associati all'identificativo: una modifica all'inizio di una ricorrenza può produrre un identificativo diverso.

Se una sola fonte fallisce, pubblica l'altra con i dati precedenti conservati e un avviso nell'app. Se entrambe falliscono, il workflow fallisce e non sostituisce il sito pubblico. L'ultima data riuscita è distinta dall'ultimo tentativo nelle informazioni dell'app (ⓘ). Un rapporto è conservato fra gli artifact di Actions per 14 giorni. La UI segnala anche raccolte più vecchie di 48 ore.

Il job salva esclusivamente `data/events.json`, `data/import-report.json`, `data/bus.json` e `data/bus-import-report.json` nel repository con il token automatico di GitHub (permesso `contents: write`); non richiede token personali. Le regole del branch devono consentire questo aggiornamento. Il commit automatico non avvia una nuova pipeline: il medesimo workflow genera e distribuisce il sito aggiornato. Un push concorrente può far fallire il salvataggio: non viene forzato né sovrascritto il lavoro altrui, e si può rilanciare il workflow. Il report è incorporato nello stesso catalogo e sostituito atomicamente con esso.

Per ATV si aggiornano separatamente feriale, serale, festivo e RSS. Una fonte fallita conserva dati e data dell'ultimo successo; una raccolta vuota o un calo anomalo delle schede non li cancella. Con `npm run import:bus -- --allow-partial` si possono pubblicare aggiornamenti parziali con avviso; il fallimento di tutte e quattro le fonti ferma la pubblicazione. Anche un fallimento totale della raccolta eventi ferma la pipeline. I rapporti sono negli artifact `rapporti-fonti`. Le prove UI usano schede e pubblicazioni ATV reali congelate, per non dipendere dalla rotazione del feed. Il frontend rimane privo di arrivi in tempo reale e non deduce gli avvisi attivi dalla sola data di pubblicazione.

In locale: `npm run import:events`. Il frontend viene rigenerato anche in caso di errore parziale per mostrare dati conservati e avvisi. Il comando termina con errore se una fonte fallisce; `npm run import:events -- --allow-partial` consente invece il successo con una fonte aggiornata. I test UI usano una piccola raccolta reale congelata del 17 ottobre 2026, separata dal catalogo corrente, per non fallire quando le date passano.

Salvati, scelte degli eventi e quartiere restano nel browser di ciascun dispositivo. Non si trasferiscono automaticamente dall'anteprima Wi-Fi all'indirizzo Pages, né fra telefoni diversi. La prima visita al sito pubblico parte quindi senza le preferenze dell'anteprima locale.

Con GitHub Free, Pages è disponibile per repository pubblici: il codice caricato diventa consultabile. Le condizioni di utilizzo delle fonti, le sedi e gli aggiornamenti dei contenuti restano da verificare prima di promuovere il servizio al pubblico. La pubblicazione serve inizialmente come anteprima del progetto.
