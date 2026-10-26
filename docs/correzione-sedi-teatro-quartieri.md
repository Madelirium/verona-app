# Sedi di Il Teatro nei Quartieri 2026

Verifica del 26 ottobre 2026. Fonte: [programma comunale](https://www.comune.verona.it/Vivere-il-comune/Eventi/Il-Teatro-nei-Quartieri-2026), pagina con ultimo aggiornamento dichiarato 20 ottobre 2026. Il programma distingue le sedi per data, mentre il campo generico Luogo riporta San Massimo. Il catalogo importato riutilizza quel campo per tutte le ricorrenze.

## Dati preparati

L’override è limitato a questa fonte in `data/editorial.json`; gli altri override sono conservati. Le cinque date future al 26 ottobre seguono il programma:

| Data | Sede del programma |
|---|---|
| 8 novembre | Teatro S. Giovanni Evangelista, circoscrizione 4 |
| 13 novembre | Teatro Autrora, circoscrizione 6: grafia della fonte, denominazione da verificare |
| 19 novembre | Teatro Camploy, circoscrizione 1 |
| 8 dicembre | Teatro David, circoscrizione 5 |
| 12 dicembre | Teatro San Benedetto, circoscrizione 2 |

Il 25 ottobre a San Massimo è storico, non una data futura. Non è stata ricostruita la programmazione precedente: la pagina ha anche una discrepanza tra introduzione e calendario sulle prime date.

Non sono stati verificati indirizzi, ingressi o coordinate ufficiali per queste sedi: tutti i nuovi punti sono null e l’override ha `mapDisabled: true`. Il nome della sede è confermato dal programma; `occurrences.verified: false` significa che il punto non è verificato, non che il nome sia inventato. `reviewedOn` registra la consultazione. La doppia rappresentazione `locationsByDay` / `occurrences` serve al contratto attuale: la build usa la prima per il testo della scheda, il resolver usa la seconda per impedire pin ereditati.

Orari, identificativi, gratuità e condizioni di prenotazione importati rimangono intatti. Le cinque date e gli intervalli orari sono presenti anche nella pagina ufficiale. Non si certificano accessibilità fisica, disponibilità posti o durata effettiva degli spettacoli.

## Integrazione nella build

In `scripts/build-calendar.mjs`, l’attuale riga:

```js
if(locationsByDay&&!locationsByDay[day])return e;
```

saltava tutto l’override per una data non mappata. Una futura ricorrenza importata poteva quindi ereditare ancora il pin di San Massimo. La build ora applica il seguente ramo per il nuovo contratto con `occurrences`, mantenendo il comportamento precedente per gli altri override:

```js
if(locationsByDay&&!locationsByDay[day]) {
  if(!fields.occurrences)return e;
  return {
    ...e,...fields,locationsByDay,
    location:fields.location||'Sede della giornata da verificare nel programma ufficiale',
    coordinates:null,mapDisabled:true
  };
}
```

La patch è stata integrata nel primo ciclo Eventi/Mobilità e il relativo test è attivo senza marcatore `todo`. Anche una nuova data assente dalla mappa conserva il blocco del punto non verificato.

## Regressioni e consegna

`node --test scripts/event-editorial-theatre.test.mjs` esegue senza scritture il blocco di trasformazione editoriale letto dalla build, sui record reali del catalogo. Copre l’8 novembre, Camploy il 19 novembre, tutte le cinque date, esclusione del 25 ottobre dalla mappa futura e giorno non verificato, compresa una nuova ricorrenza non mappata.

La ricognizione e la preparazione dei dati della chat Eventi non hanno eseguito importazioni globali o pubblicazioni. La sala controllo coordina la rigenerazione e il collaudo del frontend dopo l’integrazione degli altri sorgenti del ciclo.
