# Prova bot ATV: Via Santini B, fermata 1974

Prova eseguita il 18 ottobre 2026. Giornata interrogata: **19 ottobre 2026**, fuso Europe/Rome.

## Risultato

Raccolti **40 passaggi programmati**, tutti della linea 24 verso Piazza Righetti. Primo passaggio 05:30, ultimo 20:30. Gli istanti originali conservano anche i secondi (:41); la tabella riporta ore e minuti come il portale. Nessun dato è stato inserito nel frontend.

La scansione su finestre di otto ore, suddividendo quelle con almeno 20 risultati, ha richiesto 5 chiamate. La verifica su finestre di quattro ore ha richiesto 6 chiamate e restituito le stesse 40 corse, senza differenze negli identificativi e negli istanti. I nove passaggi del campione iniziale del portale sono tutti presenti. La suddivisione ha recuperato anche il passaggio delle 15:30, escluso dalla prima risposta limitata a 20 risultati.

**Limite della verifica:** la seconda scansione usa lo stesso servizio, quindi dimostra coerenza fra le richieste, non una certificazione indipendente di completezza. L'interfaccia ricaricata ha mantenuto una lista della precedente data/ora dopo il cambio dei campi: il confronto visivo integrale della giornata non è concluso. Le precedenti risposte vuote o parziali non hanno ancora una causa accertata. Il rapporto mantiene complete=false. Nessuna conclusione sugli altri giorni o sull'intera rete.

## Ripetere la prova

```powershell
node scripts/collect-santini-day.mjs
node scripts/collect-santini-day.mjs --verify
```

Le risposte originali e i rapporti sono in research/santini-day/, ignorata da Git. Fermata, data e campione sono intenzionalmente fissi per questo esperimento. Il bot interrompe le richieste su risposte HTTP non valide; finestre sature vengono suddivise entro un budget massimo di 24 richieste. Non sono previsti tentativi per aggirare limitazioni.

## Passaggi estratti

| Ora | Linea | Codice corsa |
| --- | --- | --- |
| 05:30 | 24 | ATV#1:700_1992062 |
| 05:50 | 24 | ATV#1:700_1992060 |
| 06:10 | 24 | ATV#1:700_1992061 |
| 06:26 | 24 | ATV#1:700_1992237 |
| 06:48 | 24 | ATV#1:700_1992238 |
| 07:08 | 24 | ATV#1:700_1992239 |
| 07:28 | 24 | ATV#1:700_1992081 |
| 07:38 | 24 | ATV#1:700_1992063 |
| 07:48 | 24 | ATV#1:700_1992093 |
| 08:08 | 24 | ATV#1:700_1992094 |
| 08:28 | 24 | ATV#1:700_1992097 |
| 08:38 | 24 | ATV#1:700_1992222 |
| 08:48 | 24 | ATV#1:700_1992098 |
| 09:08 | 24 | ATV#1:700_1992099 |
| 09:28 | 24 | ATV#1:700_1992082 |
| 09:56 | 24 | ATV#1:700_1992236 |
| 10:26 | 24 | ATV#1:700_1992240 |
| 10:56 | 24 | ATV#1:700_1992241 |
| 11:26 | 24 | ATV#1:700_1992242 |
| 11:56 | 24 | ATV#1:700_1992243 |
| 12:26 | 24 | ATV#1:700_1992244 |
| 12:48 | 24 | ATV#1:700_1992235 |
| 13:08 | 24 | ATV#1:700_1992084 |
| 13:28 | 24 | ATV#1:700_1992083 |
| 13:48 | 24 | ATV#1:700_1992089 |
| 14:08 | 24 | ATV#1:700_1992100 |
| 14:28 | 24 | ATV#1:700_1992095 |
| 14:48 | 24 | ATV#1:700_1992087 |
| 15:08 | 24 | ATV#1:700_1992088 |
| 15:30 | 24 | ATV#1:700_1992086 |
| 16:00 | 24 | ATV#1:700_1992245 |
| 16:30 | 24 | ATV#1:700_1992246 |
| 17:00 | 24 | ATV#1:700_1992247 |
| 17:30 | 24 | ATV#1:700_1992248 |
| 18:00 | 24 | ATV#1:700_1992101 |
| 18:30 | 24 | ATV#1:700_1992085 |
| 19:00 | 24 | ATV#1:700_1992091 |
| 19:30 | 24 | ATV#1:700_1992092 |
| 20:00 | 24 | ATV#1:700_1992096 |
| 20:30 | 24 | ATV#1:700_1992090 |

Fonte: [portale ufficiale ATV/myCicero, Santini 1974](https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops/1974?systemId=OTP_NE&businessCode=ATV). Data e ora sono selezioni dell'interfaccia e non sono codificate nel link.
