# Farmacie di turno

## Revisione dell’esperienza di consultazione

Accesso diretto anche da Home → Servizi utili → Farmacie di turno. L’intestazione separa numero di farmacie, termine preciso del turno e data di raccolta del catalogo. Il periodo completo resta in Fonti e aggiornamento. Chiama e Indicazioni sono le azioni principali, con nomi accessibili riferiti alla singola farmacia. Il turno non dimostra apertura dello sportello: resta visibile l’invito a telefonare.

Il selettore comprende Verona, tutta la provincia e i nomi di comuni/località presenti nei PDF del catalogo. La ricerca testuale continua a cercare nome, indirizzo e località. Non è un elenco di tutte le farmacie ordinarie della provincia: vengono mostrati soltanto i turni attivi.

Vicino a me richiede il permesso soltanto premendo il pulsante. Su HTTPS usa la posizione per ordinare tutte le farmacie del turno in provincia; mantiene la ricerca testuale eventualmente attiva. Le distanze sono in linea d’aria, senza minuti di percorrenza stimati. Le farmacie prive di coordinate restano in fondo, con indirizzo e telefono e distanza non disponibile. Distanza × rimuove l’ordinamento. Le coordinate non sono salvate e vengono rimosse chiudendo il pannello. Errori, rifiuti, timeout e risposte tardive dopo cambio ricerca o chiusura sono gestiti. Nell’anteprima Wi-Fi HTTP si propone la ricerca manuale, senza chiedere una posizione che il browser non può fornire.

I punti mappa hanno un’area di attivazione di 44 px e accesso da tastiera. La mappa segnala sempre la copertura parziale. Gli aggiornamenti periodici con gli stessi risultati conservano scorrimento e focus delle azioni; il passaggio al turno successivo aggiorna i risultati. La chiusura rimuove la mappa e annulla richieste pendenti.

Verifica della revisione: build rigenerata, 411 test superati (sei sui flussi UI farmacie). Controlli nel browser a 320 × 740 e 390 × 844, scelta di Legnago, alternativa manuale in HTTP, selezione del punto da tastiera e popup. Geolocalizzazione provata con coordinate simulate nei test, senza acquisire la posizione reale dell’utente. Nessun nuovo import di dati, API o dipendenza. Modifica locale, non ancora pubblicata.

Accesso: **Esplora → categoria Farmacie → Farmacie di turno**. Le schede delle farmacie del catalogo OpenStreetMap contengono anche il collegamento ai turni. Catalogo delle attività e calendario ufficiale restano distinti: la presenza su OSM e gli orari ordinari non dimostrano che una farmacia sia di turno.

## Fonti e significato

- [Ordine dei Farmacisti della Provincia di Verona](https://www.ordinefarmacisti.vr.it/turni-farmacie/): PDF pubblici con nome, indirizzo, località, telefono e periodo preciso del servizio di guardia. Indice fattuale derivato con attribuzione, originali non ripubblicati; nessuna licenza aperta dedotta per i PDF.
- [Federfarma Verona](https://www.federfarmaverona.it/) indica [Farmamia Verona](https://farmamiaverona.it/) come servizio per la ricerca aggiornata. Collegamento esterno sempre disponibile. Non è stata individuata/verificata un'API pubblica con licenza di riuso; non si utilizzano endpoint privati.
- Coordinate [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL 1.0: interrogazione pubblica Overpass, solo farmacie. Associazione tramite telefono univoco oppure indirizzo completo (numero e suffisso compresi) e città, anch'essi univoci. Nessuna geocodifica stimata, corrispondenza per solo nome o centroide del comune. Molti indirizzi non hanno un punto associabile: restano disponibili in elenco con indicazioni per indirizzo.

**Di turno non significa sportello sempre aperto.** La fonte non specifica per ogni riga le modalità di accesso: `serviceMode: unspecified`. Non vengono inventati apertura in tempo reale, orari di sportello o reperibilità. L'interfaccia invita a telefonare prima.

## Copertura iniziale

Raccolta del 22 ottobre 2026: sette PDF consecutivi, dal **18 ottobre ore 09:00 al 1° novembre ore 09:00, Europe/Rome**. La variazione dell'ora legale del 25 ottobre è rispettata. Il turno è attivo con inizio incluso e termine escluso; alle 09:00 passa al successivo, senza attendere la mezzanotte.

La prima estrazione è stata confrontata visivamente nelle due impaginazioni dei PDF, oltre al controllo automatico tra telefoni nel testo e righe estratte. Metadati per ogni periodo: URL, impronta SHA-256, orario di raccolta. I file PDF di lavoro restano sotto `.local/pharmacies/`.

## Funzionamento

Elenco iniziale su Verona città, selettore per tutta la provincia e località del catalogo, ricerca testuale, mappa parziale e collegamenti `tel:`/indicazioni. Intestazione e controlli restano visibili; scorre soltanto l'area centrale. La posizione dell’utente è facoltativa, richiesta solo dal pulsante Vicino a me e non salvata.

Il pannello si rinnova al confine del turno, almeno ogni minuto e tornando in primo piano. La mappa conserva lo spostamento dell'utente durante gli aggiornamenti senza cambi di risultati. Alla fine della copertura non ripete i vecchi turni: mostra il percorso verso Farmamia e l'Ordine. Un PDF non riconosciuto o incompleto interrompe l'importazione conservando il catalogo precedente; se falliscono soltanto le coordinate, i turni possono essere importati senza punti mappa.

## Aggiornamento

Il workflow `.github/workflows/pages.yml` include ora le farmacie nella pianificazione quotidiana già usata per eventi e notizie: **04:17 UTC**, con i possibili ritardi del servizio GitHub Actions. È disponibile anche l'opzione manuale `refresh_pharmacies` (attiva per default). Un normale push pubblica i dati salvati, senza richiedere una nuova raccolta. La pianificazione diventa effettiva quando il workflow e tutti i sorgenti necessari vengono pubblicati sul branch predefinito di GitHub; la modifica locale da sola non attiva il servizio online.

Il job prepara Python 3.12 con `actions/setup-python@v6` e installa `scripts/pharmacy-requirements.txt` (pdfplumber 0.11.9, stessa versione verificata localmente). Non sono necessari un PC acceso, chiavi API o un backend per l'importazione su GitHub. Il nuovo calendario viene incluso nella rigenerazione del frontend e nei test prima della distribuzione. I dati e il rapporto vengono conservati nel repository; i rapporti sono anche allegati all'esecuzione per 14 giorni.

Controlli prima di sostituire il catalogo:

- PDF dalla fonte ufficiale, impronta del contenuto e corrispondenza tra date nel nome del file e date stampate;
- righe, colonne e telefoni coerenti; nessun turno sovrapposto;
- un turno valido al momento della raccolta, periodi successivi senza buchi e nessuna riduzione della copertura futura già disponibile;
- avviso nel rapporto se restano meno di 72 ore e l'Ordine non ha ancora pubblicato nuovi periodi.

Se il controllo fallisce, il file `data/pharmacies.json` rimane invariato e `data/pharmacy-import-report.json` registra il problema. Se altre raccolte riescono, il sito può essere pubblicato con le farmacie precedenti; se nessuna raccolta richiesta riesce, il workflow blocca la sostituzione del sito. L'interfaccia continua comunque a escludere i turni scaduti e a offrire Farmamia e l'Ordine come alternative. Non si possono creare automaticamente turni che l'Ordine non ha pubblicato.

I PDF vengono scaricati per confrontarne l'impronta, ma quelli invariati e già estratti con la stessa versione del parser non vengono rielaborati. Le coordinate OSM vengono ricontrollate al massimo una volta a settimana, oppure quando arrivano nuove farmacie: un guasto delle coordinate non impedisce di aggiornare i turni e conserva i punti precedenti. Il rapporto distingue il riuso dall'estrazione effettiva. I test UI usano calendari congelati in `scripts/fixtures/pharmacies.json`, così l'arrivo di nuovi mesi non li rende dipendenti dalle vecchie date.

Comandi per un aggiornamento locale:

```text
npm run import:pharmacies
npm run build
npm test
```

Il lettore PDF usa Python con `pdfplumber`, già disponibile nel runtime locale usato per questa prova. Per altri ambienti occorre predisporlo; `PHARMACY_PYTHON` permette di indicare l'eseguibile Python. `--from=YYYY-MM-DD` seleziona i documenti pubblicati il cui periodo finale raggiunge almeno quel giorno; in assenza dell'opzione usa la data corrente di Roma. Anche con questa opzione la sostituzione richiede un turno valido al momento della raccolta.

File principali: `scripts/pharmacies.mjs` (parsing/validazione), `scripts/pharmacy-refresh.mjs` (raccolta verificabile e rapporto), `scripts/import-pharmacies.mjs`, `scripts/extract-pharmacy-pdf.py`, `data/pharmacies.json`, `public/pharmacies.js`, `public/pharmacies.css`. Il frontend rimane statico, senza credenziali o chiamate al servizio dei turni dal telefono. La mappa carica normalmente le tile OSM; i collegamenti esterni vengono aperti soltanto su azione dell'utente.
