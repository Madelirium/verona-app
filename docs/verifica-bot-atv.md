# Verifica estesa del bot ATV

Verifica del 18 ottobre 2026 su due fermate e due date.

| Fermata | Data di servizio | Linea | Passaggi | Primo | Ultimo |
| --- | --- | --- | --- | --- | --- |
| VIA SANTINI B (1974) | 2026-10-19 | 24 | 40 | 05:30 | 20:30 |
| VIA SANTINI A (1973) | 2026-10-19 | 24 | 38 | 05:46 | 20:23 |
| VIA SANTINI B (1974) | 2026-10-25 | 96 | 28 | 06:38 | 20:08 |

I 106 passaggi sono conservati in [bus-stop-trials.json](../data/bus-stop-trials.json), con date, istanti, codici corsa, destinazioni e indicazione di dato programmato. Il file è sperimentale e non viene caricato dal frontend. I secondi restituiti dal servizio sono mantenuti nel JSON; la tabella riporta ore e minuti.

## Controlli effettuati

La raccolta suddivide le finestre con almeno 20 risultati, conserva le corse simultanee distinte e deduplica gli stessi passaggi ai confini. Una prima scansione usa finestre di otto ore; la verifica ne usa quattro. Se differiscono, una terza scansione ne usa due e viene confrontata con la seconda. Sono conservati anche gli esiti iniziali discordanti. Il risultato rimane incompleto se le ultime scansioni non coincidono, se una risposta è errata o se si esaurisce il budget di richieste.

Nei due nuovi casi la prima scansione aveva omesso rispettivamente sette corse per Santini A e una per Santini B festiva. Le scansioni successive a quattro e due ore hanno restituito gli stessi 38 e 28 passaggi. La causa delle prime risposte parziali non è accertata: non si assume che basti una prima richiesta. Non è stata usata l'unione di elenchi discordanti per dichiarare superata la verifica.

Il 25 ottobre la giornata italiana dura 25 ore: il bot determina separatamente la mezzanotte iniziale e quella successiva in Europe/Rome. Tutte le finestre, compresa l'ultima ora, sono state interrogate. Sono presenti test anche sul giorno di 23 ore.

## Riprodurre le prove

```powershell
node scripts/collect-bus-stop-day.mjs --stop=1973 --date=2026-10-19 --verify
node scripts/collect-bus-stop-day.mjs --stop=1974 --date=2026-10-25 --verify
```

Ogni esecuzione usa una cartella distinta in research/stop-days/, ignorata da Git, con risposte originali, rapporti e CSV. Le richieste sono sequenziali, distanziate di 1,5 secondi, con un budget di 24 chiamate per scansione; non viene avviata alcuna raccolta massiva. Gli errori HTTP arrestano la scansione, senza percorsi alternativi o retry automatici.

## Limiti prima dell'integrazione

Due scansioni coerenti interrogano la stessa fonte e non certificano da sole la completezza rispetto a tutte le corse effettivamente previste. Il confronto visivo completo con il portale resta aperto: durante la prova il cambio di data e ora lasciava risultati precedenti nell'interfaccia. Solo il campione mattutino di Santini B del 19 ottobre era stato verificato visivamente. Per questo tutti i campioni mantengono complete=false. Le prove non validano altri giorni, vacanze scolastiche, festività o l'intera stagione. Nessun orario è stato interpolato e nessun dato già in uso nell'app è stato sostituito.

Fonti dirette: [Santini A 1973](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops/1973?systemId=OTP_NE&businessCode=ATV), [Santini B 1974](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops/1974?systemId=OTP_NE&businessCode=ATV). La data è una selezione del portale e non è codificata nel collegamento.

## Verifica aggiuntiva dei singoli passaggi

Il [confronto con il dettaglio ufficiale delle corse](confronto-orari-atv.md) ha verificato tutti i 106 passaggi: coincidono identificativo corsa, linea, codice fermata, destinazione e istante programmato, compresi i secondi. Questo controllo conferma i dati raccolti; la completezza dell'elenco giornaliero e il confronto visivo integrale rimangono da verificare.
