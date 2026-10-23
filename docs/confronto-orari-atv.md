# Confronto degli orari estratti con il dettaglio ufficiale delle corse

## Esito del controllo

Controllo concluso il 2026-10-18T16:07:08.087Z: **106 passaggi su 106 corrispondono**, senza differenze nei campi verificati.

| Fermata | Data di servizio | Linea | Passaggi corrispondenti |
| --- | --- | --- | --- |
| 1974 | 2026-10-19 | 24 | 40/40 |
| 1973 | 2026-10-19 | 24 | 38/38 |
| 1974 | 2026-10-25 | 96 | 28/28 |

Il [rapporto dettagliato](../data/bus-stop-trip-verification.json) conserva l'esito per ogni corsa; i [campioni](../data/bus-stop-trials.json) riportano la verifica aggiuntiva. I campioni mantengono complete=false e dailyCoverageCertified=false: è confermata la correttezza dei passaggi osservati, non l'assenza di altre corse.

## Metodo

Il 18 ottobre 2026 il portale è stato controllato sia nel browser integrato sia in Chrome. Cambiando data e ora, la lista dei passaggi non si è aggiornata in modo affidabile: i campi selezionati e le corse visualizzate non corrispondevano. Lo screenshot di questa anomalia è conservato localmente in `research/atv-lista-non-aggiornata.png`. Questo comportamento impedisce di dichiarare completato il confronto visivo integrale dell'elenco giornaliero.

Aprendo invece il collegamento **Dettaglio corsa** di una corsa corrente, il portale mostra l'intera successione delle fermate con gli orari. È stato verificato nel client pubblico che questo dettaglio usa `GetFermateCorsa2`, mentre l'elenco per fermata usa `GetArriviPartenzePalina2`.

Il confronto automatico interroga il dettaglio di ogni corsa già raccolta, usando giorno di servizio, identificativo originale della corsa e codice del capolinea presenti nelle risposte originali. Verifica:

- stesso identificativo corsa e stessa linea;
- stessa fermata mediante codice ufficiale;
- stessa destinazione finale;
- identico istante programmato di partenza dalla fermata, compresi data e secondi.

Le occorrenze ripetute della stessa fermata restano distinte. Il controllo usa `OrarioPartenzaProgrammato`, senza sostituirlo con l'orario live. Le risposte originali, il manifest e il rapporto progressivo sono conservati in `research/trip-check/`, ignorata da Git.

## Riproduzione

```powershell
node scripts/verify-bus-stop-trips.mjs research/trip-check/manifest.json
```

Il manifest contiene soltanto passaggi già raccolti e relativi codici originali. Ogni esecuzione crea una cartella distinta, distanzia le richieste di 1,5 secondi e termina su errori HTTP o di rete. Il comando non importa nuovi orari nell'app e non avvia la ricerca di ulteriori fermate o corse.

## Interpretazione

Questo confronto verifica che i passaggi raccolti siano presenti anche nel dettaglio ufficiale delle rispettive corse. Entrambi i servizi appartengono alla stessa fonte: non è una certificazione indipendente dell'intero esercizio. Non prova da solo l'assenza di ulteriori corse omesse dall'elenco per fermata. La completezza dell'elenco giornaliero e il confronto visivo integrale rimangono quindi da verificare, così come la copertura di altre date e dell'intera rete.

Fonti: [fermata Santini B 1974](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops/1974?systemId=OTP_NE&businessCode=ATV), [fermata Santini A 1973](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops/1973?systemId=OTP_NE&businessCode=ATV). Il dettaglio corsa si apre dai collegamenti del portale; il collegamento interno copiato e ricaricato direttamente ha restituito un errore 404 e non viene proposto come collegamento pubblico funzionante.
