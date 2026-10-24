# Corse dirette verso un evento — prima versione locale

24 ottobre 2026. Nessuna pubblicazione online, nuova dipendenza o API a pagamento. La ricerca usa esclusivamente il catalogo ufficiale ATV già raccolto e opera nel browser.

## Come provarla

Evento con posizione → Come arrivare → Autobus → **Da dove parti? Trova una corsa diretta**. Scrivere nome o codice della fermata e scegliere esplicitamente un risultato, controllando il lato della strada. Impostare Partenza dalle e premere Cerca corse.

Sono mostrate fino a 12 partenze, ordinate per orario, con linea, salita, discesa, arrivo o passaggio programmato, durata arrotondata e distanza finale in linea d'aria. Vedi viaggio riutilizza il riepilogo esistente con arrivo già selezionato e fermate intermedie. Il collegamento a Google Maps permette di verificare il tratto finale a piedi.

## Regole e dati

- Salita e discesa devono appartenere alla **stessa corsa ufficiale**, con discesa successiva alla salita. Non è sufficiente che due fermate abbiano lo stesso numero di linea.
- Sono controllati i permessi espliciti di salita e discesa, la data di servizio e gli scostamenti di giorno. Non viene dedotto il permesso di discesa dalla presenza di un orario o dal nome della fermata.
- Per ogni salita viene scelta una fermata della stessa corsa entro 800 metri dall'evento, privilegiando la distanza in linea d'aria minore; a parità viene scelto l'arrivo precedente. Non è una minimizzazione del tempo complessivo del viaggio.
- La prima versione cerca salita e discesa nello stesso giorno civile scelto. Considera i servizi del giorno e dei due giorni precedenti con offset, senza proporre una discesa nel giorno successivo all'evento. Non copre partenze la sera precedente per eventi dopo mezzanotte.
- La ricerca esclude partenze precedenti all'orario richiesto e, per oggi, già trascorse. Il clic su un risultato trascorso invita a ripetere la ricerca.
- Se è presente l'orario di arrivo viene usato quello; altrimenti si mostra il passaggio programmato. La durata deriva dagli orari programmati. Nei giorni del cambio d'ora vengono risolti gli istanti Europe/Rome per calcolare i minuti trascorsi; orari ripetuti, inesistenti o intermedi ambigui sono esclusi. Il riepilogo diretto usa le durate corrette e in questo caso limita la timeline al tratto verificato.
- La scelta di una nuova partenza o un nuovo orario svuota i risultati. Le risposte tardive e i risultati dopo la chiusura vengono ignorati. Si caricano solo le linee associate alla fermata nella data pertinente, con tre caricamenti concorrenti e cache esistente; il tempo limite dei fetch delle linee è di 15 secondi nei browser compatibili.
- Errori di singole linee producono una ricerca dichiarata incompleta e un pulsante Riprova; nessun risultato parziale è descritto come assenza certa di collegamenti.

L'esportazione precedente conservava ForBoarding ma ometteva ForAlighting. `scripts/import-atv-netex.py` ora esporta il permesso di discesa al settimo posto di ogni passaggio e aggiunge `alightingAvailable` al manifest e ai file delle linee. Le 141 linee e le 6.360 corse sono state rigenerate dallo **stesso archivio locale verificato**, senza inventare dati né scaricare una nuova stagione. Il confronto diretto con l'originale conferma tutti i **195.849 permessi**; restano verificati i 106 passaggi di riferimento. Nella scelta manuale dell'arrivo, le fermate con divieto esplicito di discesa non sono selezionabili.

Una futura pubblicazione deve distribuire insieme manifest e file delle linee rigenerati: la build e il caricatore rifiutano un archivio dichiarato completo di permessi con file incompatibili. L'assenza di `alightingAvailable` impedisce questa nuova ricerca e non viene interpretata come assenza di autobus.

## Verifiche

**462 test superati**, inclusi nove nuovi test di ricerca e interfaccia. Casi coperti: ordine e identità della corsa, direzione opposta, servizi inattivi, permessi vietati o sconosciuti, arrivi e passaggi, terminali di sola discesa, offset dopo mezzanotte, cambio d’ora autunnale e primaverile, input non validi, partenza già passata, divieto di unire due corse, scelta esplicita della partenza, riepilogo, rientro, fuori copertura, risposte tardive e raccolta parziale.

Prova nel browser con Poeti Sociali alla Gran Guardia il 24 ottobre: ricerca da Stazione Porta Nuova D2, corsa della linea 53 delle 11:05, arrivo a Piazza Bra Arena B alle 11:10, 3 fermate intermedie e circa 110 metri finali in linea d'aria. Verificato Altre partenze con ritorno ai risultati conservati. Impostando Partenza dalle 23:59 compare lo stato vuoto che non esclude la possibilità di viaggi con cambi.

Prova a 390×844 e 320×640: nessuna eccedenza orizzontale negli stati osservati. A 320 px il pannello e il suo contenuto esterno misurano entrambi 589 px; i risultati lunghi scorrono nel corpo interno, mantenendo disponibile il ritorno. Non verificati telefoni fisici o screen reader.

## Limiti e seguito

Non sono inclusi cambi, ritardi, tempi a piedi, accessibilità fisica delle fermate o garanzia di arrivare prima dell'inizio. Il successivo intervento locale descritto in `eventi-arriva-entro.md` aggiunge il limite di arrivo alla fermata, proposto sull'inizio futuro noto dell'evento; il tratto pedonale resta escluso. Le scelte del viaggio non sono salvate permanentemente. Cambia arrivo apre il selettore generico della corsa; una nuova destinazione manuale non viene rivalutata rispetto all'evento o al limite della ricerca originale.

Prossimo piccolo intervento dopo Arriva entro: verifica del tratto a piedi. Mantenere esplicita l'esclusione degli orari ambigui nel cambio d'ora. Non presentare questa prima versione come un pianificatore completo.

Sorgenti principali: `scripts/direct-bus.mjs` (ricerca pura), `public/event-direct.js` (flusso), template e stili, importatore e validatore ATV. La build incorpora il nuovo modulo e rigenera `public/index.html` e il service worker.
