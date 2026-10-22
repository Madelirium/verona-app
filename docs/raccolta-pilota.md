# Raccolta e isole ecologiche: prova locale

Accesso da **Il mio quartiere → Rifiuti e raccolta**. Dopo la conferma della zona compare un richiamo nella home. Nessuna assegnazione automatica dal quartiere: il volantino distingue anche intervalli di civici.

## Percorso semplificato

La voce ora si chiama **Rifiuti e raccolta**, con due scelte: **Quando ritirano** e **Dove portare**. La zona si sceglie da tre pulsanti grandi con nome e colore, poi si conferma dopo aver letto giorni e verifica di via/civico. Non sono necessari tendine o checkbox. Tornare indietro o annullare la modifica conserva la scelta salvata.

Chi non conosce il colore usa **Trova la mia zona**: scrive almeno due lettere del nome, sceglie una via suggerita, inserisce il civico e conferma la zona proposta. Il PDF delle vie e il collegamento alle altre zone AMIA restano come aiuto quando la risposta non è certa.

### Ricerca per indirizzo

`data/waste.json → addressIndex` contiene un indice fattuale originale di **107 denominazioni di vie e 114 associazioni via/zona**, trascritto dall'allegato ufficiale e confrontato visivamente con la pagina renderizzata. Il testo del PDF non è estraibile: non si tratta di importazione automatica/OCR. Metadati: collegamento al documento, controllo del 22 ottobre 2026 e impronta SHA-256 del documento controllato. Non vengono distribuiti il PDF, le immagini, l'impaginazione o i testi integrali del volantino; non attribuiamo all'allegato AMIA la licenza generale del sito comunale.

- Nome scelto esplicitamente dai suggerimenti; la ricerca ignora maiuscole, accenti e punteggiatura ma non assegna una via per somiglianza.
- Civico obbligatorio. Gli intervalli espliciti sono inclusivi: Tiberghien 1–38, Giordano Corsini 7–13. Nessuna estrapolazione oltre gli estremi.
- Le sei vie ripetute in più zone (Adamello, Aldo Fedeli, Monte Tesoro, Dolomiti, Monte Bianco e Unità d'Italia) richiedono verifica manuale **per qualsiasi civico**: gli intervalli di una zona non vengono sottratti implicitamente dalle altre.
- Bernini Buri contiene un limite descritto con un sottopasso: richiede verifica. Numeri con lettere, barre o formati non standard richiedono verifica, senza arrotondamenti.
- Vie/civici fuori indice non sono classificati come prive di servizio: sono fuori copertura della prova.
- Ricerca e indirizzo restano in memoria durante il pannello e si cancellano alla chiusura; nel browser viene salvato soltanto il codice della zona confermata, come prima. Nessuna geocodifica o invio dell'indirizzo a servizi esterni.

Il calendario mostra una prossima raccolta in evidenza, due successive e le altre dentro **Vedi tutti i giorni**. Fonti e rimozione della preferenza sono in **Informazioni sul servizio**. I centri di raccolta presentano un solo collegamento principale **Come arrivare**, con le informazioni aggiuntive espandibili. Controlli da almeno 48 px, testi principali 18–28 px e scorrimento interno al pannello.

## Copertura verificata il 22 ottobre 2026

Il [comunicato del Comune del 30 gennaio 2026](https://www.comune.verona.it/Novita/Comunicati/NUOVI-GIORNI-PER-LA-RACCOLTA-DIFFERENZIATA-IN-CIRCOSCRIZIONE-7) indica, dal 2 febbraio:

| Zona C7 | Carta | Plastica e metalli |
|---|---|---|
| Marrone | Mercoledì | Giovedì |
| Gialla | Venerdì | Martedì |
| Rossa | Lunedì | Sabato |

Solo le vie interessate dal comunicato. Non sono disponibili in questa prova tutte le frazioni, gli orari di esposizione o le eccezioni festive. L'interfaccia lo dichiara e rimanda alle istruzioni AMIA. Il termine del 31 dicembre 2026 è un limite editoriale cautelativo, non una scadenza dichiarata dal Comune: dal 2027 non si generano altre date.

La prima ipotesi San Massimo è stata sostituita con questa fonte comunale: le [condizioni AMIA](https://www.amiavr.it/Terms) limitano la ripubblicazione dei materiali. Non distribuiamo PDF, immagini, loghi, impaginazione o testi integrali AMIA. La fonte comunale dichiara [CC BY 4.0 salvo eccezioni](https://www.comune.verona.it/Note-legali); il catalogo conserva attribuzione e collegamenti agli originali, distinguendo l'indice fattuale derivato dall'allegato di terzi. Eventuali ampliamenti richiedono verifica della fonte e dei diritti specifici.

Le due schede originali delle isole ecologiche Basso Acquar e Mattarana riportano fatti essenziali (indirizzi e orari ordinari), con collegamento alla [fonte AMIA](https://www.amiavr.it/URP/Isole-ecologiche). Non attribuiamo ai materiali AMIA una licenza aperta. Le indicazioni usano l'indirizzo, senza coordinate stimate. Aperture festive e condizioni di accesso vanno controllate sul sito ufficiale.

## Implementazione e manutenzione

- `data/waste.json`: dati curati manualmente, provenienza, copertura, versione e limiti.
- `scripts/waste.mjs`: validazione build, scelte persistenti e ricorrenze civili senza assunzioni di orario.
- `public/waste.js` / `public/waste.css`: pannello accessibile con scorrimento interno, scelta esplicita e collegamenti ufficiali.
- `verona-waste-v1`: preferenza locale separata da quartiere, eventi e scadenze. Una versione diversa richiede nuova conferma. Nessuna posizione o indirizzo personale viene salvato.
- Aggiornamento manuale: ricontrollare comunicazione, variazioni e orari; aggiornare catalogo/versione, eseguire test e build prima della distribuzione. Non è presente un feed AMIA né una sincronizzazione automatica.

La prova funziona con l'hosting statico esistente, senza backend, API key o nuove dipendenze. Gli avvisi festivi non devono essere dedotti dall'assenza di comunicazioni. La home si rinnova al cambio del giorno di Roma; il pannello già aperto si rinnova senza interrompere una modifica in corso.
