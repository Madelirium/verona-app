# Coordinate dalle sedi ufficiali degli eventi

L’importazione legge i riferimenti `takes_place_in` della scheda evento comunale. Se mancano coordinate valide e c’è una sola sede ufficiale, recupera la risorsa `place` tramite il suo identificativo nell’API del Comune e legge `has_address`. Non cerca corrispondenze per nome e non usa servizi di geocodifica.

Una sede viene richiesta una sola volta per importazione, anche quando serve più eventi o ricorrenze. Le coordinate già presenti sull’evento hanno precedenza. Eventi con più sedi, riferimenti incompleti, esclusione esplicita dalla mappa o punti fuori dall’area ammessa restano senza un nuovo punto assegnato. Il guasto di una sede non blocca il resto della raccolta: viene segnalato nel log e l’evento resta consultabile nell’elenco.

I punti recuperati conservano fonte, URL della sede, identificativo, data del controllo e precisione `venue`: rappresentano la sede, non l’ingresso esatto né il percorso a piedi. La descrizione del luogo comprende nome e indirizzo ufficiali.

Il flusso è integrato in `npm run import:events`, prima del recupero delle immagini. I JSON generati contengono le coordinate: l’app statica su GitHub Pages non chiama l’API comunale durante l’utilizzo, non richiede API key o un nuovo backend. L’automazione esistente utilizzerà la nuova logica dopo la pubblicazione dei sorgenti.

Caso verificato: Poeti Sociali rimanda alla sede 6654, Palazzo della Gran Guardia. La scheda evento aveva coordinate 0,0; la sede ufficiale indica 45.43831, 10.991876, Piazza Bra 3. Il punto è recuperato automaticamente per le singole date.

Importazione reale del 23 ottobre 2026: entrambe le fonti aggiornate con successo, 1.346 appuntamenti complessivi. Il recupero delle sedi ha aggiunto punti a 267 ricorrenze in 10 sedi distinte. La correzione manuale di Poeti Sociali è stata rimossa: ora usa il dato del nuovo importatore. I dati e il frontend sono locali, non ancora pubblicati.

Fonti: [evento](https://www.comune.verona.it/Vivere-il-comune/Eventi/Poeti-Sociali.-Pace-volto-dell-umano), [sede](https://www.comune.verona.it/Vivere-il-comune/Luoghi/Palazzo-della-Gran-Guardia), [risorsa ufficiale](https://www.comune.verona.it/api/opendata/v2/content/read/6654).

I test coprono il passaggio parser → sede → evento, il riuso per ricorrenze, le sedi multiple, i riferimenti malformati, il rispetto di coordinate dirette ed esclusioni, le risposte con identità errata, i punti non validi e il recupero parziale dopo errori di rete.

Verifica finale: build riuscita e 427 test superati. Prova nel browser a 390×844 e 320×740: Poeti Sociali localizzato senza override editoriale; ludoteca in Circoscrizione 4 con mappa, indicazioni a piedi e fermate di Via Mantovana recuperate correttamente. Il pannello parcheggi mostra lo stato vuoto previsto nella zona, senza inventare disponibilità. Immagini locali: `.local/sedi-eventi-automatiche.png` e `.local/poeti-sede-automatica-320.png`.
