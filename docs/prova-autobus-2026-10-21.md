# Prima prova della sezione Autobus

Prototipo locale del 21 ottobre 2026 successivo all'analisi. Nessuna pubblicazione GitHub richiesta in questo passaggio.

- Catalogo unico delle 141 linee ufficiali, integrato con le schede ATV disponibili. Una linea senza scheda resta consultabile; la mappa compare solo dove esiste un percorso.
- Ricerca per linea/destinazione e per nome/codice fermata. L'indice fermate si carica su richiesta, senza scaricare tutti gli orari. Massimo 20 risultati fermata con invito a restringere la ricerca.
- Accesso diretto al pannello fermata con prossime partenze programmate, selezione delle linee, distinzione dei servizi di altri giorni e collegamento agli orari senza ricompilare il codice.
- Filtri in un dialog, ricerca e accesso mappa più compatti. A 320×640 la lista passa da circa 145 a 276 px in altezza; nessuno scorrimento orizzontale della pagina osservato.
- Preferiti per numero anche sulle linee prive di scheda, mantenendo compatibilità con quelli precedenti e gli avvisi.
- Oggi il consultatore apre sulle prossime partenze; “Tutta la giornata” recupera quelle precedenti. Le date diverse da oggi mostrano il servizio completo. Incluse le corse dopo mezzanotte del giorno precedente quando pertinenti.
- Il filtro destinazione usa soltanto i passaggi della fermata nella data scelta. Codici corsa rimossi dalla vista principale degli orari.

Restano i pannelli mappa esistenti; questa iterazione non unifica ancora tutte le mappe in un unico pannello inferiore e non introduce preferiti per singola fermata/direzione. La mappa continua a coprire 30 linee. Nessun dato in tempo reale e nessun nuovo aggiornamento automatico dell'archivio.

Verifiche: 95 test UI, con cinque nuovi casi su catalogo, preferiti, ricerca e risposte tardive, corse dopo mezzanotte e selezione delle prossime partenze. Suite completa: 254 test passati. Verifica browser su ricerca 1974, apertura Via Santini B, linea 24, prossime corse e passaggio alla giornata completa; layout a 320, 390 e 430 px.
