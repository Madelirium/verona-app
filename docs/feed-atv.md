# Feed ATV e archivio ufficiale NeTEx

Verifica del **19 ottobre 2026**, in sola lettura. Nessuna raccolta massiva avviata, nessun dato dell'app sostituito e nessuna pubblicazione su GitHub.

## Risultato principale

È stato individuato e scaricato un archivio ufficiale ATV tramite il **National Access Point italiano del CCISS**, fornito dal **Regional Access Point del Veneto**. Questo supera la precedente verifica che non aveva ancora confermato un download strutturato utilizzabile per gli orari.

- [Fornitore RAP Veneto](https://www.cciss.it/nap/mmtis/public/catalog/Organisation/2040).
- [Catalogo NeTEx livello 2](https://www.cciss.it/nap/mmtis/public/catalog/Dataset/6161).
- [Risorsa IT-ITH3-ATV, livello 2](https://www.cciss.it/nap/mmtis/public/catalog/Asset/204401).
- [Download dell'ultima risorsa validata](https://www.cciss.it/nap/mmtis/public/api/v1/download/blob/Asset/204401/checkedResource).

Il collegamento ha risposto HTTP 200 senza account, con tipo `application/gzip` e nome `IT-ITH3-ATV_L2.xml.gz`. Dimensione del file verificato: **6.731.621 byte**. La copia originale è conservata in `research/atv-netex-l2-checked.gz`, ignorata da Git.

Lettura preliminare del contenuto XML:

| Campo | Riscontro |
| --- | --- |
| Operatore | Azienda Trasporti Verona S.p.A. |
| Produttore della pubblicazione | RAPVeneto |
| PublicationTimestamp | 2026-10-18T02:47:56.000+02:00 |
| Versione del CompositeFrame | 11044 |
| Intervallo dichiarato del CompositeFrame | 18 ottobre – 17 novembre 2026 |
| Line | 141 |
| ScheduledStopPoint | 4.303 |
| ServiceJourney | 6.360 |
| TimetabledPassingTime | 195.849 |
| DayType | 109 |

Questi conteggi descrivono gli oggetti XML del file scaricato. Le 6.360 definizioni di corsa non significano 6.360 corse in ogni singolo giorno: occorre applicare calendari, assegnazioni dei tipi di giorno, eccezioni e intervalli dei singoli oggetti. L'intervallo del contenitore non dimostra che ogni linea o corsa operi per tutti i giorni dell'intervallo.

Sono presenti sia **Santini B 1974** sia **Santini A 1973**, con coordinate ufficiali coerenti con quelle già osservate sul portale. È presente la linea **24_ATV**, denominata `QUINZANO - S.LUCIA - CASELLE`, con **146 oggetti ServiceJourney** associati. Il primo oggetto esaminato è `700_1988019_ATV`, da Piazza Righetti a Stazione Porta Nuova B3, con 24 elementi di passaggio. Non è ancora stata completata la ricostruzione dei riferimenti o la selezione delle corse attive per data.

## Feed avvisi RSS

- [Pagina RSS ATV](https://www.atv.verona.it/flex/cm/pages/ServeBLOB.php/L/IT/IDPagina/436).
- [Feed RSS ufficiale](https://www.atv.verona.it/flex/cm/pages/ServeFeed.php/L/IT/fmt/rss20/feed/pages%3A2).

Il feed è già usato dall'importatore dell'app (`busFeed` in `scripts/bus.mjs`). La nuova verifica ha restituito HTTP 200 e 20 elementi; il filtro del progetto ne ha riconosciuti 15 come possibili avvisi di servizio. Non è un conteggio ufficiale di deviazioni attive. Sono presenti pubblicazioni del 19 ottobre relative alle linee 121/229 e 41. Le descrizioni dei singoli elementi sono vuote: titolo, data e collegamento sono disponibili direttamente nel feed, mentre per il testo integrale rimane la pagina della notizia. È incluso anche contenuto aziendale estraneo al servizio.

## Aggiornamenti in tempo reale

L'archivio NeTEx esaminato descrive dati **programmati**, non posizioni live o ritardi. Le pagine istituzionali documentano il ruolo di NeTEx e SIRI nell'infrastruttura RAP/NAP, ma in questa verifica non è stato individuato un endpoint pubblico documentato di ATV per GTFS-Realtime o SIRI con modalità d'accesso confermate. L'assenza di un collegamento trovato non dimostra che tale servizio non esista.

Riferimento istituzionale: [NAP multimodale](https://www.cciss.it/nap/mmtis/public/static/multimodal). Le API usate dal portale myCicero sono un'altra fonte tecnica già osservata nel progetto, ma non costituiscono un feed documentato per sviluppatori terzi.

## Conseguenza per il progetto

**Verifica successiva completata:** il [confronto NeTEx](verifica-netex-atv.md) ricostruisce i calendari e riproduce esattamente i 106 passaggi dei campioni. Per la linea 24 individua 87 corse nei feriali e 59 il sabato della settimana 19–25 ottobre, comprese nove corse feriali che non attraversano Santini e non erano nel precedente campione. È ora confermata la fattibilità tecnica dell'importazione per questa struttura di dati; l'integrazione nel frontend resta da fare. I paragrafi seguenti descrivono il percorso di valutazione originario.

Prima di proseguire con altri lotti di interrogazioni per fermata, verificare l'importazione di questo archivio ufficiale. Può evitare gran parte delle richieste e fornire direttamente i calendari che mancano alla raccolta per date campione. Il lavoro già fatto resta utile come campione di confronto per codici fermata, orari e corse.

Il prossimo passo è ricostruire i riferimenti fra linee, journey pattern, fermate, passing times e calendari, poi confrontare il risultato per la linea 24 con i campioni già verificati. Vanno controllati aggiornamento della risorsa, intervalli, cambio d'ora ed eventuali condizioni specifiche di riutilizzo. Nella scheda pubblica e nella lettura preliminare dell'XML non è stata individuata una licenza esplicita: l'accesso tecnico senza login non viene presentato come prova di una licenza aperta specifica.

Non è ancora stato sostituito l'importatore dell'app con NeTEx. Il controllo svolto riguarda disponibilità e contenuto preliminare del file, non una certificazione completa del dataset.
