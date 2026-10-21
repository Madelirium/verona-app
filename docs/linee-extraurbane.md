# Linee extraurbane nella prova locale

Le linee extraurbane erano già comprese nei 141 file di orari dell'archivio ufficiale. Questa modifica aggiunge accesso rapido “Extraurbane”, etichetta nelle schede e filtro Rete: tutte / urbane / extraurbane / altre linee e servizi. Ricerca di destinazioni, fermate, preferiti e consultazione degli orari usano gli stessi componenti delle altre linee.

La classificazione è salvata in `data/bus-categories.json`: 73 numeri di linea presenti sia nell'archivio NeTEx sia nei collegamenti visibili ai PDF dell'indice ufficiale ATV delle destinazioni extraurbane. Le linee già classificate urbane nelle schede ATV mantengono quella categoria anche quando servono località fuori Verona. Nessuna classificazione desunta soltanto dal numero.

Fonte: https://www.atv.verona.it/orari_linee_bus_extraurbani e relativi indici di località. Il 21 ottobre 2026 sono state lette 21 pagine su 22 collegate; la lettera H restituisce 404 ed è registrata nel report. Collegamenti senza etichetta numerica leggibile non sono usati. La classificazione è quindi parziale: navette, scolastiche e linee non classificate rimangono accessibili in Tutte oppure Altre linee e servizi.

Aggiornamento manuale: `node scripts/update-bus-categories.mjs`, quindi `npm run build`. Lo script interroga tre pagine alla volta; blocca errori diversi dai 404 e coperture inattese. Non scarica nuovi orari, non effettua nuove interrogazioni per ogni apertura dell'app e non modifica i calendari ufficiali.

Le mappe continuano a coprire le 30 linee per cui esiste già una geometria. Alle extraurbane prive di percorso non viene attribuita una mappa fittizia. Gli orari importati mantengono validità 18 ottobre–17 novembre 2026, senza ritardi in tempo reale.

Verifiche: filtro e ripristino, esclusione delle urbane, ricerca San Bonifacio e consultazione reale del file della 130 con codice fermata preselezionato. Prova browser del catalogo extraurbano a 320 px e orari della 130.
