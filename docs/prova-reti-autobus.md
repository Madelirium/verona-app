# Prova della navigazione per rete

Prova locale del 21 ottobre 2026. Barra stabile Tutte / Urbane / Extraurbane e viste Linee / Fermate / Avvisi. Il selettore della rete rimane visibile anche negli avvisi; le linee senza classificazione restano in Tutte oppure nel filtro Altre linee e servizi.

La ricerca mantiene il testo passando da Linee a Fermate e tra reti. Fermate permette di consultare anche senza ricerca: mostra le prime 20 fermate in ordine alfabetico, con conteggio e invito a restringere nome/codice. Fermate e relative linee rispettano rete, servizio e filtro preferiti.

La stella accanto alla mappa attiva Solo le mie linee nelle viste Linee e Fermate. I preferiti sono gli stessi nelle due reti, rimangono salvati sul dispositivo e non si cancellano quando una rete non ha risultati. Negli avvisi sono conservati i controlli dedicati alle proprie linee e agli avvisi generali.

Gli avvisi sono filtrati per almeno una linea della rete scelta. Le comunicazioni generali o senza numero rimangono visibili: non vengono attribuite arbitrariamente a una rete. Restano pubblicazioni recenti con validità da verificare.

La mappa generale propone solo i tracciati coerenti con rete e filtri. Per le extraurbane attualmente prive di geometria mostra uno stato esplicito; non ripiega sulle urbane. Tornando a Tutte recupera le scelte salvate, compresa una selezione intenzionalmente vuota. Il filtraggio temporaneo di una rete non cancella la selezione mappa salvata.

Controlli della rete alti almeno 44 px, navigazione in basso e scorrimento interno. Verifica a 320×640: circa 237 px per i risultati e nessun overflow orizzontale della pagina. La distinzione della rete aggiunge una riga rispetto alla prima prova, compensata in parte raggruppando contatore, preferiti e mappa.

Test UI: indipendenza rete/vista, ricerca, avvisi generali e specifici, preferiti condivisi, assenza di tracciati extraurbani e ripristino della selezione mappa. Prova browser a 320 px di catalogo, Fermate, Avvisi e stato mappa senza percorsi. Nessuna pubblicazione GitHub in questo passaggio.
