> Aggiornamento 19 ottobre: [orari ufficiali integrati nella prova locale](orari-ufficiali-app.md) per tutte le 141 linee. Le indicazioni precedenti sull’integrazione ancora da fare descrivono lo stato storico. Nessuna nuova pubblicazione su GitHub.

# Verifica del file ufficiale ATV NeTEx

Controllo offline del **19 ottobre 2026** sul file scaricato dal [NAP/CCISS, risorsa ATV livello 2](https://www.cciss.it/nap/mmtis/public/catalog/Asset/204401). Il [rapporto JSON](../data/atv-netex-validation.json) conserva impronta del file, metadati, conteggi, confronti e corse aggiuntive.

## Esito

Il file permette di ricostruire le corse programmate per data. I riferimenti di tutte le 6.360 definizioni di corsa a linea, pattern, punti del percorso, fermate e calendari sono stati risolti. I 109 calendari binari hanno lunghezza coerente con l'intervallo dichiarato. Il controllo applica anche gli intervalli dei singoli oggetti, non soltanto quello del contenitore.

| Campione già controllato sul portale | Passaggi nel campione | Passaggi NeTEx | Mancanti o aggiuntivi |
| --- | --- | --- | --- |
| Santini B 1974, linea 24, 19 ottobre | 40 | 40 | Nessuno |
| Santini A 1973, linea 24, 19 ottobre | 38 | 38 | Nessuno |
| Santini B 1974, linea 96, 25 ottobre | 28 | 28 | Nessuno |

**106 passaggi su 106 coincidono per linea, codice fermata, identificativo corsa e istante, compresi i secondi.** Il confronto verifica anche l'assenza di ulteriori passaggi negli stessi tre elenchi ricostruiti dal file. La corrispondenza riguarda il file pubblicato il 18 ottobre; non è un controllo live effettuato al momento della lettura dell'app.

## Linea 24, settimana 19–25 ottobre

| Giorno | Corse programmate attive nel file | Codici fermata distinti | Osservazioni di fermata |
| --- | --- | --- | --- |
| Lunedì 19 | 87 | 95 | 3.447 |
| Martedì 20 | 87 | 95 | 3.447 |
| Mercoledì 21 | 87 | 95 | 3.447 |
| Giovedì 22 | 87 | 95 | 3.447 |
| Venerdì 23 | 87 | 95 | 3.447 |
| Sabato 24 | 59 | 93 | 2.556 |
| Domenica 25 | 0 | 0 | 0 |

Questi sono orari programmati secondo i calendari del dataset, non una garanzia che tutte le corse vengano effettuate. Lo zero domenicale riguarda esclusivamente la **linea 24**, non il servizio ATV nel suo complesso: il campione della 96 festiva è presente e coincide con il portale. Le osservazioni includono i punti di arrivo, che non vanno presentati come nuove partenze; i permessi di salita/discesa sono conservati nei pattern.

## Nove corse che Santini non intercettava

Il vecchio campione conteneva 78 corse della 24 del 19 ottobre. Tutte sono presenti nel NeTEx. Il file ne descrive **altre nove**, attive per la stessa data:

- Quattro corse **Stazione Porta Nuova B3 → Santa Lucia**, alle 05:36, 05:57, 07:43 e 13:25.
- Due corse **Stazione Porta Nuova B3 → Caselle**, alle 06:23 e 11:50.
- Tre corse **Santa Lucia → Stazione Porta Nuova**, alle 09:05, 13:45 e 14:47, con arrivo su D1 o D2 secondo la corsa.

Nessuna delle nove attraversa Santini A o B. Questo spiega perché il campione di Santini era corretto ma non descriveva l'intera linea. Il file aggiunge anche il codice **2017, Stazione Porta Nuova D1**, non presente nei 94 codici dei dettagli precedentemente raccolti. La corrispondenza con gli eventuali codici OSM rimane una verifica distinta: non sono state rinominate fermate per somiglianza.

## Metodo e riproduzione

```powershell
python scripts/check-atv-netex.py
python -m unittest discover -s scripts -p test_check_atv_netex.py
```

Il primo comando legge soltanto il file GZIP già salvato in `research/atv-netex-l2-checked.gz`, i campioni in `data/bus-stop-trials.json` e il piano precedente della 24. Scrive il rapporto di verifica, senza richieste di rete e senza modificare i dati utilizzati dal frontend. Richiede Python con database dei fusi orari disponibile per `Europe/Rome`.

Il calendario usa `UicOperatingPeriod.ValidDayBits`: un carattere per ciascun giorno, collegato alle corse tramite `DayTypeAssignment` e `DayTypeRef`. Non deduce il servizio soltanto da “feriale” o “festivo”. Riferimento tecnico primario: [elementi comuni NeTEx, UicOperatingPeriod](https://normes.transport.data.gouv.fr/normes/netex/elements_communs/).

Gli orari sono interpretati in `Europe/Rome`, con gli scostamenti di giorno espliciti. Il controllo non riusa indiscriminatamente l'offset `+02:00` presente nei limiti del file dopo il ritorno all'ora solare. Per le 19.791 osservazioni della 24 nel periodo verificato non sono emerse ore locali ambigue. Se un orario cade nell'ora ripetuta del cambio stagionale, il verificatore conserva entrambe le possibilità e non dichiara un confronto univoco; le ore inesistenti vengono rifiutate.

**Otto test Python passano**, coprendo calendario inclusivo, bit mancanti, riferimenti in avanti e mancanti, identificativi duplicati, permessi di salita, cambio d'ora, scostamenti oltre mezzanotte e confronto bidirezionale dei campioni.

## Cosa rimane prima dell'integrazione

La validità dichiarata del file è **18 ottobre–17 novembre 2026**: non va usato automaticamente per date successive. Il verificatore supporta la struttura osservata di questo archivio; non è un validatore XSD completo né un importatore universale NeTEx. Altre forme di assegnazione calendario non ancora supportate vengono rifiutate.

La ricostruzione settimanale della 24 e il confronto dei tre campioni sono riusciti. Restano l'esportazione nel formato dell'app, la consultazione per data sulla mappa, gli stati per date fuori validità e la gestione dei successivi aggiornamenti del file. Le condizioni specifiche di riutilizzo rimangono da verificare come indicato in [feed-atv.md](feed-atv.md).

Per proseguire conviene importare il file ufficiale, mantenendo il bot per fermata come strumento di confronto o eventuale ripiego. Non è stato avviato un altro lotto di interrogazioni per fermata e non è stato pubblicato alcun aggiornamento su GitHub.
