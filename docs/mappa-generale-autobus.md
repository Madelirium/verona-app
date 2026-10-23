# Mappa generale autobus

Accesso da Autobus → Mappa delle linee. Il pannello affianca la lista esistente e permette di confrontare fino a sei linee con percorsi OSM e fermate colorate. Sono selezionabili solo le linee con geometrie già disponibili nel progetto, non tutte le 141 linee degli orari ufficiali.

Alla prima apertura si usano le linee preferite che hanno un tracciato; in assenza di preferite viene mostrato un gruppo iniziale 11/12/13. Le successive scelte, compresa una selezione intenzionalmente svuotata, sono conservate in `verona-bus-network-v1`. Il pulsante stella richiama le preferite attuali; non inventa mappe per quelle prive di geometria.

Aggiunta e rimozione di linee dalla legenda, controllo Inquadra tutto, geolocalizzazione su richiesta. La posizione dal telefono richiede HTTPS come nelle altre mappe. Vista Fermate alternativa alla mappa, con ricerca per nome o codice e accesso tramite tastiera. Vedi sulla mappa apre il punto richiesto.

Nel punto sulla mappa si caricano automaticamente le tre prossime partenze programmate della linea selezionata. Se passano più linee, una selezione all’interno del riquadro cambia la linea e aggiorna orari e destinazioni. Tutti gli orari apre il consultatore completo. Le risposte tardive di una linea precedente non sovrascrivono gli orari della scelta attuale.

Geometrie caricate solo per le linee selezionate e condivise con la cache delle altre mappe. Errori di un tracciato sono segnalati e si possono ritentare senza perdere le altre linee. Chiusura durante il caricamento e selezioni successive invalidano gli aggiornamenti della vista precedente.

Le varianti OSM sono indicative e non certificano deviazioni o servizio effettivo in una data. Per gli orari si usa l’archivio ufficiale e la sua validità. Non ci sono posizioni o ritardi live.

Verifiche: selezione iniziale/preferite, aggiunta e rimozione, limite sei linee, selezione vuota persistente, ricerca fermata, annullamento del caricamento e cambio rapido di linea negli orari. Prova browser: tre linee iniziali, aggiunta della 24, ricerca 1104 (Stradone Maffei), accesso al punto e cambio tra 11 e 12; controlli e mappa verificati a 320 px. Implementazione locale, non ancora pubblicata su GitHub.
