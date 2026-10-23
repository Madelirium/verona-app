# Esplora: mappa e azioni essenziali

Prova locale del 22 ottobre 2026, senza nuova pubblicazione.

La mappa recupera spazio: ricerca e Filtri condividono una riga; categoria
dettagliata e Solo preferiti sono nel pannello Filtri e servizi. Mappa ed Elenco
mantengono gli stessi risultati. Tutti, Mangiare, Negozi e Servizi sono le scelte
rapide: usano esclusivamente le categorie già presenti nel catalogo OSM.

- Mangiare: Bar e caffè + Ristoranti (587 luoghi nel catalogo attuale).
- Negozi: Negozi + Artigiani (803).
- Servizi: Servizi + Farmacie (83).
- Tutti comprende anche Sport (7); il filtro dettagliato resta disponibile.

Il catalogo non comprende ancora una raccolta dedicata a musei o parchi.
Non vengono create categorie Visitare o All'aperto prive di copertura adeguata.
La copertura resta centro e zone limitrofe, con 1.480 luoghi al momento della prova.

Vicino a me apre la scelta tra posizione del telefono e zona manuale. Nessuna
richiesta di posizione parte da sola. Si riutilizzano il raggio di 1 km e le
distanze in linea d'aria, senza presentarle come percorso pedonale. L'anteprima
Wi-Fi HTTP offre la scelta manuale; la posizione sul telefono richiede HTTPS.
Il controllo di posizione duplicato dentro Leaflet è nascosto in Esplora;
la gestione della posizione rimane disponibile tramite Vicino a me.

Il popup di un luogo offre dettagli e indicazioni; la scheda usa contenuto
scorrevole con intestazione e azioni Salva/Come arrivare sempre visibili.
La distanza compare solo quando esiste un punto di riferimento. Indicazioni
apre Google Maps con le coordinate del luogo. Orari e accessibilità restano
informazioni OSM da verificare, senza dedurre uno stato Aperto adesso.

Mostra sulla mappa funziona anche dai Salvati: apre Esplora e, se i filtri
escludono il luogo, li ripristina per rendere visibile il punto richiesto.
Indietro conserva ricerca, categoria, preferiti, raggio/zona ed elenco.

Verifiche: gruppi di categorie, filtri combinati, stato vuoto, pannelli,
salvataggio e memoria non disponibile, indicazioni, ritorno dai Salvati e
conservazione del contesto geografico con Indietro. Frontend rigenerato con
npm run build. Prove mobile con dati reali a 320 e 390 px.
