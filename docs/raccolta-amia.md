# Calendari AMIA 2026

Fonti: [pagina ufficiale](https://www.amiavr.it/Raccolta-differenziata/I-calendari-del-porta-a-porta), cinque PDF collegati dalla pagina. Controllo: 22 ottobre 2026.

Sono importate le date effettive, anche vuote, dei 365 giorni del 2026 per ogni zona. I materiali sono carta, plastica/metalli, umido e secco. Non si ricavano ricorrenze settimanali: stagioni e festività restano quelle stampate. Gennaio 2027, pur presente nei PDF, non viene incluso in questa versione.

| Zona | Località indicate da AMIA | Esposizione domestica |
|---|---|---|
| Arancio | San Massimo | Giorno indicato, 19–21 |
| Blu | Basse San Michele, San Felice, Valpantena | Sera precedente, dalle 19 |
| Azzurra | Basson, La Sorte, Torricelle | Sera precedente, 19–21 |
| Verde | Mizzole, Montorio, Pigozzo, ZAI Montorio, Ponte Florio | Sera precedente, dalle 19 |
| Viola | Marangona, Parona, Quinzano, ZAI Bassona | Giorno indicato, 19–21 |

Queste indicazioni provengono dalle istruzioni a piè di pagina dei calendari. L'interfaccia mostra la sera di esposizione; la data originaria del calendario resta in `collectionDay`. Per le utenze commerciali valgono le istruzioni specifiche dei PDF, non il promemoria domestico.

La ricerca per via e civico continua a coprire soltanto l'elenco comunale verificato della Circoscrizione 7. Per le nuove zone non viene dedotta un'associazione civico-colore: l'utente controlla il PDF e conferma. Viene salvato solo l'identificativo di zona, senza indirizzo. Le vecchie preferenze restano valide. Le tre zone C7 rimangono limitate a carta e plastica/metalli; non ereditano gli orari degli altri calendari.

`data/waste-calendars.json` contiene dati fattuali derivati, URL, data di controllo e SHA-256 dei PDF. Non è stata verificata una licenza open data AMIA: non redistribuiamo i PDF o le illustrazioni e non attribuiamo loro la licenza della comunicazione comunale. Sono sempre disponibili i collegamenti agli originali. Nessuna API o disponibilità in tempo reale dichiarata.

L'aggiornamento è manuale. Gli avvisi successivi al controllo non sono inclusi. Il verde a pagamento e il calendario ecomobile restano esclusi. Isole ecologiche già presenti nell'app.

## Rigenerazione

Salvare i cinque PDF ufficiali in `.local/waste/ARANCIO.pdf`, `BLU.pdf`, `AZZURRO.pdf`, `VERDE.pdf`, `VIOLA.pdf`. Eseguire `scripts/import-waste-calendars.py` con Python e pdfplumber, poi `npm run build` e `npm test`. Non sono installate dipendenze aggiuntive nell'app.

Il parser legge le colonne e verifica tutti i giorni di ogni mese. Usa l'ordine di pittura del PDF per escludere testo nascosto sotto rettangoli successivi (correzioni di singole celle e vecchio luglio). Blocca l'importazione se mancano date o un materiale non è riconosciuto. La scrittura avviene solo dopo aver completato tutti e cinque i calendari. Le celle campione dei test sono state confrontate con le pagine renderizzate, includendo estate, Natale e celle corrette.
