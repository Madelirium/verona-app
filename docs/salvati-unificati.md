# Salvati: raccolta unica

Prova locale, 22 ottobre 2026. Nessun nuovo backend o account richiesto.

La voce Salvati ora apre una raccolta dedicata: Eventi e scadenze, Notizie,
Luoghi, Autobus. Una tendina con conteggi evita una barra con troppe schede.
La ricerca riguarda la categoria selezionata e si azzera cambiando categoria.
I filtri e la data del calendario non nascondono più gli appuntamenti salvati.

Eventi e scadenze sono raggruppati per giorno, con tutti i prossimi programmi
visibili nell'elenco. I conclusi hanno una vista separata. Gli eventi passano
tra i conclusi dal giorno successivo alla data finale, mantenendo la precedente
logica; le scadenze seguono validità, ora limite ed eventuale revoca.
La conferma presenza e la rimozione dell'evento si gestiscono nei dettagli.

Si riutilizzano gli archivi locali esistenti e i pannelli dei singoli servizi.
Le preferenze ATV provenienti da PDF e archivio ufficiale sono riunite per numero
di linea. Nessun salvataggio viene cancellato da un cambiamento di catalogo.
Eventi e scadenze conservano gli snapshot già previsti; notizie e luoghi assenti
dal catalogo corrente sono segnalati come non disponibili e le preferenze restano.
La sincronizzazione tra dispositivi non è inclusa.

Navigazione: ricerca, categoria, vista Prossimi/Conclusi, posizione e focus
si ripristinano tornando da un pannello o con Indietro tra sezioni.
Guscio a viewport, navigazione fissa e scorrimento del solo elenco.

Verifica automatica: aggregazione su date diverse, indipendenza dai filtri,
archivio, rimozione mirata e persistenza, deduplicazione ATV, riferimenti assenti,
ritorno da dettagli e sezioni, ordine tra eventi/scadenze e conteggio Home.
