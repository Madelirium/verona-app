# Navigazione e ritorno ai contenuti

La prova aggiunge una gestione comune in `public/navigation.js`, inclusa alla fine del frontend generato.

- I salvataggi e gli aggiornamenti degli elenchi conservano scorrimento e focus tramite chiavi stabili. Se una scheda scompare, il focus passa al controllo vicino o al contenitore dell’elenco vuoto.
- I dettagli ritrovano il controllo di apertura anche se la scheda è stata ricreata in background.
- Indietro chiude prima l’ultimo dialogo aperto. I pannelli annidati si chiudono uno alla volta. Il cambio tra pannelli alternativi, come Auto/Autobus/A piedi, non crea tappe superflue.
- Chiudere i filtri senza confermarli continua ad annullare la bozza. Non viene introdotto il focus automatico su input o ricerche.
- Indietro e Avanti tra sezioni ripristinano ricerca, filtri, data e posizione negli elenchi nella sessione corrente. I pulsanti di ritorno esplicito usano la cronologia quando corrisponde alla destinazione indicata; conservano il precedente comportamento quando la destinazione è diversa.
- Avanti non riapre un dialogo già chiuso con contenuti o mappe potenzialmente obsoleti. Dopo un ricaricamento si recupera la sezione delle precedenti voci, senza ripristinare i vecchi dialoghi o pretendere di conservare in memoria il DOM del documento precedente.
- Le voci cronologia contengono solo identificativi e nome della vista: input, riferimenti DOM e copie delle scelte di navigazione rimangono nella memoria della scheda. Gli URL OAuth non vengono sostituiti o riscritti da questo modulo.

Verifiche: test di focus, rimozione dell’ultima notizia, aggiornamento periodico, dettagli ricreati, ricerca/data/scorrimento, Escape, bozza dei filtri, pannelli annidati, cambio rapido di schermata, Avanti dopo la chiusura, voci di un documento precedente e ritorno alla Home. Prova nel browser su layout mobile con salvataggio/rimozione, ricerca e Indietro, servizi/farmacie e dettagli evento/trasporti.

La modifica è disponibile nell’anteprima locale. La pubblicazione non fa parte di questa prova.
