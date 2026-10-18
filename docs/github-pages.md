# Pubblicazione su GitHub Pages

Il sito funziona senza il computer locale: il frontend include il catalogo e la logica dell'applicazione. Le tessere della mappa e i portali esterni richiedono connessione Internet.

1. Caricare questo progetto in un repository GitHub dedicato.
2. Aprire Settings → Pages → Build and deployment e scegliere **GitHub Actions** come Source.
3. Effettuare un push su `main` o `master`, oppure avviare manualmente il workflow **Pubblica Verona su GitHub Pages** dalla sezione Actions.
4. Attendere la conclusione del job deploy. L'indirizzo del sito è mostrato nell'environment `github-pages` e in Settings → Pages.

Il workflow rigenera il frontend, esegue i test e pubblica soltanto `index.html`, la licenza Leaflet e `.nojekyll`. Il sito supporta il percorso di un repository Pages senza dipendere da `/data` o da un server Node.

Il workflow include la raccolta automatica dei soli **eventi** da Comune e Veronafiere ogni giorno alle **04:17 UTC** (05:17 in inverno, 06:17 in estate a Verona). La pianificazione diventa operativa quando questo file viene caricato sul branch predefinito del repository; GitHub può ritardare le esecuzioni e disattivare le pianificazioni dei repository pubblici dopo 60 giorni senza attività. Una visita all'app non avvia l'importazione. ATV, notizie del Comune e luoghi mantengono aggiornamenti manuali. Gli orari ATV sono gestiti come raccolte stagionali, senza richieste giornaliere.

Da Actions → **Pubblica Verona su GitHub Pages** → Run workflow, la raccolta eventi è attiva per impostazione predefinita; quella ATV è disattivata e si può scegliere solo per un avvio manuale. Un normale push pubblica invece i dati già salvati, senza richieste alle fonti. Non serve un computer acceso per le esecuzioni su GitHub.

La raccolta ha tre tentativi per problemi temporanei di rete, mantiene le singole ricorrenze, aggiorna gli identificativi esistenti ed elimina i duplicati per identificativo. Una fonte vuota, incompleta o con un calo superiore al 70% rispetto ai precedenti eventi ancora futuri non sostituisce i dati di quella fonte: occorre verificare il rapporto. Gli eventi non più presenti non vengono automaticamente etichettati come cancellati. I salvati restano associati all'identificativo: una modifica all'inizio di una ricorrenza può produrre un identificativo diverso.

Se una sola fonte eventi fallisce, pubblica l'altra con i dati precedenti conservati e un avviso nell'app. Se fallisce tutta la raccolta eventi ma riesce quella ATV, o viceversa, pubblica la categoria riuscita e mantiene i dati precedenti dell'altra con avviso. Se nessuna raccolta richiesta riesce, il workflow fallisce e non sostituisce il sito pubblico. L'ultima data riuscita è distinta dall'ultimo tentativo nelle informazioni dell'app (ⓘ). Un rapporto è conservato fra gli artifact di Actions per 14 giorni. La UI segnala anche raccolte più vecchie di 48 ore.

Il job salva esclusivamente `data/events.json`, `data/import-report.json`, `data/bus.json` e `data/bus-import-report.json` nel repository con il token automatico di GitHub (permesso `contents: write`); non richiede token personali. Le regole del branch devono consentire questo aggiornamento. Il commit automatico non avvia una nuova pipeline: il medesimo workflow genera e distribuisce il sito aggiornato. Un push concorrente può far fallire il salvataggio: non viene forzato né sovrascritto il lavoro altrui, e si può rilanciare il workflow. Il report è incorporato nello stesso catalogo e sostituito atomicamente con esso.

Per ATV si aggiornano separatamente feriale, serale, festivo e RSS. Una fonte fallita conserva dati e data dell'ultimo successo; una raccolta vuota o un calo anomalo delle schede non li cancella. Con `npm run import:bus -- --allow-partial` si possono pubblicare aggiornamenti parziali con avviso. I rapporti sono negli artifact `rapporti-fonti`. Le prove UI usano schede e pubblicazioni ATV reali congelate, per non dipendere dalla rotazione del feed. Il frontend rimane privo di arrivi in tempo reale e non deduce gli avvisi attivi dalla sola data di pubblicazione.

Il collaudo online del 18 ottobre 2026 ha confermato la raccolta eventi dai server GitHub; tutte e quattro le fonti ATV hanno invece restituito HTTP 403 dal runner, mentre la raccolta locale era riuscita. L'aggiornamento ATV non viene più tentato dalla pianificazione giornaliera: si usano raccolte locali manuali. Non vengono aggirati i blocchi; per una sincronizzazione ATV affidabile occorre un canale autorizzato o una fonte ufficiale accessibile dai server.

In locale: `npm run import:events`. Il frontend viene rigenerato anche in caso di errore parziale per mostrare dati conservati e avvisi. Il comando termina con errore se una fonte fallisce; `npm run import:events -- --allow-partial` consente invece il successo con una fonte aggiornata. I test UI usano una piccola raccolta reale congelata del 17 ottobre 2026, separata dal catalogo corrente, per non fallire quando le date passano.

Salvati, scelte degli eventi e quartiere restano nel browser di ciascun dispositivo. Non si trasferiscono automaticamente dall'anteprima Wi-Fi all'indirizzo Pages, né fra telefoni diversi. La prima visita al sito pubblico parte quindi senza le preferenze dell'anteprima locale.

Con GitHub Free, Pages è disponibile per repository pubblici: il codice caricato diventa consultabile. Le condizioni di utilizzo delle fonti, le sedi e gli aggiornamenti dei contenuti restano da verificare prima di promuovere il servizio al pubblico. La pubblicazione serve inizialmente come anteprima del progetto.

## Raccolta stagionale dei PDF ATV

`npm run snapshot:bus-pdfs` scarica, su richiesta, i PDF delle 38 schede urbane del catalogo locale. Il 18 ottobre 2026 sono stati acquisiti 38 file su 38. I PDF sono conservati in `.local/atv-timetables/` per impronta SHA-256: file di stagioni diverse non si sovrascrivono. La cartella è esclusa da Git e non distribuita al telefono. `data/bus-timetable-snapshots.json` registra URL ufficiale, scheda, data, dimensione e impronta; l’inventario iniziale comprende anche il numero di pagine. Il download è distinto dall’estrazione delle tabelle: il procedimento ora produce `data/bus-timetables.json`, incorporato nell’app per consultare gli orari. Direzioni, giorni, note e colonne sono verificati con i controlli documentati in `docs/orari-atv.md`. La raccolta non include l’intera rete extraurbana né un archivio di stagioni future. Gli avvisi, essendo variabili, mantengono l’indicazione di raccolta vecchia oltre 48 ore; alle schede degli orari questa soglia non viene applicata.
