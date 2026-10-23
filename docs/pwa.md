# PWA Verona in Tasca

Implementazione locale, non ancora pubblicata. Nessuna nuova dipendenza.

## Uso

Nelle Impostazioni è presente la sezione di installazione. Nei browser compatibili il pulsante compare quando il browser rende disponibile la richiesta nativa. Su iPhone sono mostrate le istruzioni Safari → Condividi → Aggiungi alla schermata Home. Il browser integrato può non offrire l’installazione.

Servono HTTPS o localhost. Il normale indirizzo Wi-Fi in HTTP non abilita il service worker. Per l’installazione su telefono occorre pubblicare su https://veronaintasca.it.

## Cache e aggiornamenti

- Manifest, icone e logo nei colori forniti; modalità standalone.
- Worker generato da `public/sw.template.js`, versione calcolata dalla pagina, dai metadati e dagli asset essenziali. Il file distribuibile è `public/sw.js`.
- Pagina principale e dati incorporati: prima rete, ripiego sulla copia salvata in caso di errore o dopo 6 secondi. L’avviso identifica la copia salvata anche se il dispositivo dichiara di essere online.
- Dati autobus caricati separatamente: prima rete, ripiego su cache per gli ultimi 40 file consultati. Non vengono scaricate preventivamente tutte le linee.
- API giochi, account, servizi esterni, immagini remote e mappe non sono intercettati. Nessuna cache delle risposte personali o delle navigazioni di login con parametro `code`/`error`; nessuna memorizzazione dei link con codice stanza.
- Un aggiornamento del worker attende. Il pulsante nelle Impostazioni permette di applicarlo esplicitamente e ricarica la schermata, dopo l’avviso di terminare le partite.
- All’attivazione sono eliminate solo le vecchie cache con prefisso `verona-pwa-`. Preferenze e salvati in localStorage non vengono eliminati.

La copia offline contiene dati della pubblicazione salvata, non dati in tempo reale. Non garantisce disponibilità di immagini, mappe o servizi online. La cache può essere rimossa dal browser quando manca spazio.

Il workflow GitHub Pages copia worker, manifest, icone e inviti. Il server locale espone `sw.js` come JavaScript con `Cache-Control: no-store`.

## Verifiche

- Suite completa: 434 test superati; test dedicati su ripiego offline, errori HTTP, sottocartella Pages, esclusione API/login, conservazione della copia valida, attivazione esplicita e pulizia cache.
- Browser: registrazione e preparazione offline confermate nelle Impostazioni; pulsante di aggiornamento provato.
- Navigazione offline reale su localhost pulito: server arrestato, nuova apertura riuscita con avviso “Stai consultando una copia salvata”. Schermata controllata a 390 × 844 px.
- La prima prova su un’origine locale con una versione intermedia del worker si è bloccata. Rimossa l’attesa del nuovo client dalla risposta di navigazione e aggiunto timeout di rete; prova ripetuta con successo su origine pulita.
- Installazione nativa su telefono e comportamento standalone restano da verificare dopo la pubblicazione HTTPS.
