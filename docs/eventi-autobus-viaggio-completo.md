# Eventi e autobus: viaggio completo — prova del 24 ottobre 2026

Tutti e cinque gli interventi sono implementati nella prova locale. Nessuna pubblicazione GitHub eseguita in questa fase. Nessun account esterno creato e nessun piano a pagamento attivato.

## 1. Contesto e navigazione

Il viaggio conserva evento, giorno, direzione, fermata iniziale, vincolo orario e scopo andata/ritorno. Cambiando discesa, intestazione, indicazioni pedonali e distanza vengono ricostruite dalla scelta attuale. Gli avvisi appaiono prima delle fermate quando la nuova scelta supera il limite o allontana dalla sede. Il riferimento iniziale rimane distinto dal punto di salita alternativo. Alla chiusura della ricerca vengono conservati in memoria, per sei eventi/giornate, fermata e criteri; il GPS non viene inserito in questa memoria. Il giorno selezionato nel calendario viene trasmesso ai mezzi.

## 2. Fermate utili

La ricerca considera la fermata scelta e fino a quattro alternative entro 300 m. Ogni alternativa mostra nome/codice e distanza in linea d’aria dal riferimento scelto; non sostituisce silenziosamente il campo di partenza. Una corsa fisica viene proposta una sola volta anche se passa da più fermate vicine. Sono sempre richiesti salita e discesa consentite nello stesso viaggio ufficiale.

Caso verificato nel browser: D1 (2017) → Poeti Sociali, 24 ottobre entro le 17:00, trova le partenze da D2 (2018), indicando circa 10 m in linea d’aria e la direzione del bus. Il precedente stato senza risultati è superato senza far scegliere casualmente un’altra fermata.

## 3. Camminate, anticipo e puntualità stimata

Nella sezione «Camminate e anticipo» si può richiedere esplicitamente la verifica di entrambe le camminate. Il calcolo considera il punto GPS, se scelto, oppure la fermata inizialmente indicata; camminata fino al bus; due minuti per salire; corsa programmata; camminata finale; anticipo richiesto da 0 a 60 minuti. Se si indica solo una fermata, non viene inventato un percorso da casa.

Le richieste pedonali sono limitate ai punti unici di cinque fermate di salita e sei di discesa, serializzate e riutilizzate dalla cache temporanea. La ricerca può essere annullata. Gli arrivi mostrati sono arrotondati verso l’alto e le ore consigliate per partire verso il basso. Le soluzioni non più raggiungibili o incompatibili con l’anticipo vengono escluse quando le camminate sono note. Le soluzioni con errori del fornitore restano esplicitamente non verificate. Non sono comprese soppressioni o ritardi in tempo reale, né viene garantita l’accessibilità per mobilità ridotta.

Nel riepilogo «Camminate e arrivo alla destinazione» permette di ricalcolare anche dopo un cambio di fermata. È sempre possibile una stima personale dei minuti: in tal caso il calcolo è locale e dichiarato non verificato. La mappa mostra i soli tratti pedonali e i punti di salita/discesa/destinazione, senza disegnare un falso percorso autobus rettilineo.

Caso reale verificato: dalla ricerca D1 verso Gran Guardia, limite alla sede 17:00 e anticipo 10 minuti, sono proposte corse precedenti a quella con sola discesa 16:57; compaiono ora consigliata per partire a piedi e arrivo stimato alla sede.

### Servizio pedonale pubblico: predisposto, non attivato

In locale resta disponibile il profilo foot FOSSGIS, solo su richiesta e con limiti/cache. Sul sito pubblico, senza configurazione, rimangono Google Maps e stime personali; non viene contattato automaticamente il servizio di prova.

È pronto il proxy Node `/api/walking-route` con:

- chiave del fornitore solo sul backend (`WALKING_API_KEY`);
- CORS su origini esatte (`WALKING_ALLOWED_ORIGINS`), niente credenziali browser;
- validazione coordinate veronesi e lunghezza, corpo limitato, timeout;
- limite condiviso di frequenza, 500 richieste upstream al giorno, cache in memoria di 15 minuti;
- risposte normalizzate e nessuna restituzione della chiave o di errori sensibili;
- nessun log applicativo delle coordinate. Rivedere anche log e politiche dell’hosting e del fornitore prima di attivare.

Per attivarlo, dopo verifica delle condizioni d’uso commerciali, attribuzione, cache e quote del proprio account:

1. Impostare `WALKING_API_KEY` e le origini autorizzate sul backend Node.
2. Impostare `WALKING_API_URL=https://HOST-BACKEND/api/walking-route` nel build del frontend e nella variabile GitHub omonima.
3. Rigenerare e verificare il sito. La chiave non deve entrare nelle variabili del frontend.

Il limite giornaliero interno è prudenziale e non sostituisce la verifica del piano effettivo. Nessun servizio esterno è stato configurato o distribuito automaticamente.

Documentazione primaria:

- [Migrazione ufficiale HeiGIT](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912): endpoint nuovo `api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson`.
- [FAQ openrouteservice](https://giscience.github.io/openrouteservice/frequently-asked-questions): chiave condivisa da custodire lato server.
- [FOSSGIS](https://routing.openstreetmap.de/about.html): profilo foot, attribuzione, massimo una richiesta al secondo e divieto di uso pesante.

## 4. Sede per giornata e rinnovo dell’archivio

Il modello supporta `occurrences[YYYY-MM-DD]` con `location`, `coordinates`, `verified: true`, eventuali `startsAt` e `endsAt`. Un indirizzo diverso o una giornata priva di verifica non eredita il punto di un’altra sede. I blocchi editoriali esistenti restano rispettati; non sono state inventate coordinate mancanti. La precisione di tutte le sedi del catalogo non è stata certificata da questo intervento.

Il nuovo comando `python scripts/refresh-atv-netex.py` scarica una risorsa ufficiale come candidato; `--input FILE.gz` permette la verifica offline. Non sostituisce i dati installati. Controlla profilo e riferimenti, validità, calendari, coordinate, permessi, conteggi, duplicati e cali anomali di linee/corse. A sette giorni dalla scadenza dell’archivio installato richiede attenzione con esito non riuscito nel controllo.

Il workflow `atv-archive-check.yml` è predisposto per controllo settimanale e avvio manuale: conserva rapporto e manifest fra gli artefatti, senza pubblicare il candidato. Diventerà operativo solo dopo la pubblicazione del codice.

`python scripts/refresh-atv-netex.py --apply` è l’applicazione esplicita: valida, conserva copie di ripristino in `.local/atv-renewal/backup`, sostituisce i soli file sorgente previsti e lancia build/test. Se falliscono, ripristina i dati precedenti e rigenera il frontend. I test con campioni congelati possono richiedere revisione quando cambia la stagione: il rollback evita aggiornamenti silenziosi. Il comando non effettua commit, push o deploy.

Verifica offline effettuata sull’archivio attuale: 141 linee, 6.360 definizioni di corsa, validità 18 ottobre–17 novembre 2026, impronta invariata. Non è una nuova acquisizione di dati più recenti. La licenza specifica di riutilizzo del dataset rimane da chiarire con il fornitore.

## 5. Ritorno

«Prepara il ritorno» conserva il riferimento iniziale e propone data e uscita dalla sede; se la fine non è disponibile chiede un orario. Considera fino a cinque fermate entro 800 m dalla sede e destinazioni entro 500 m dal punto iniziale. Si possono verificare entrambe le camminate, rispettando anche l’ora in cui si vuole lasciare l’evento. Il riepilogo è etichettato come ritorno.

Sono supportate corse con arrivo nel giorno successivo, entro la validità dell’archivio, e vengono mostrate le date. Le ore ambigue o inesistenti nel cambio d’ora vengono escluse. Non sono stati aggiunti viaggi con cambi. Per partenze dopo mezzanotte si seleziona il giorno successivo.

## Verifiche e limiti

Esito finale: 508 test Node superati e 4 test Python superati. Build completata con 1.346 appuntamenti. Verificato nel browser anche il passaggio andata → ritorno → riepilogo, correggendo l’apertura sotto un pannello già attivo. A 320 px la larghezza della pagina resta 320 px e i controlli principali misurano almeno 44 px. Anteprima locale su http://127.0.0.1:4177/; nessuna pubblicazione effettuata in questo intervento.

Test automatici del motore, del proxy, dei nuovi flussi UI, di annullamento e risposte tardive, memoria senza GPS, vincoli dopo cambio discesa, ritorno oltre mezzanotte e calcolo dei margini. Test Python del rinnovo, incluso ripristino dei file dopo un errore di build.

Prova nel browser con fermate/corse reali e dati pubblici di Porta Nuova/Gran Guardia, senza acquisizione del GPS personale. Layout progettato per 320–430 px con scorrimento interno. Non è un test con partecipanti reali anziani o turisti e non certifica i tempi effettivi del servizio ATV.
