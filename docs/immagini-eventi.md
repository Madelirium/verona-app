# Immagini degli eventi

Prima integrazione per gli eventi del Comune di Verona. L'importatore legge il riferimento `image` della scheda e recupera la risorsa attraverso l'API ufficiale `content/read/{id}`. Ogni immagine viene letta una sola volta per importazione, anche quando l'evento ha più ricorrenze. Un errore della risorsa immagine non elimina gli appuntamenti.

Vengono accettate immagini JPEG, PNG o WebP con licenza esplicitamente dichiarata CC BY 4.0, senza licenza proprietaria aggiuntiva. Gli URL devono usare HTTPS e appartenere al Comune o al percorso del suo archivio OpenCity. Nome, didascalia, autore, licenza, dimensioni e fonte rimangono nei dati. Nella prova sono incluse anche le immagini con autore esattamente “Comune di Verona” e metadato esplicito “Licenza sconosciuta”, secondo la richiesta dell’utente: conservano `rightsStatus: unverified`, il metadato originale e la dicitura “Fonte immagine: Comune di Verona · Licenza non specificata”, senza collegamento o attribuzione CC BY. L’attribuzione non è una conferma del permesso di riutilizzo. Le altre immagini senza licenza riconosciuta producono la grafica di riserva. Veronafiere e conversione di locandine PDF non sono comprese nella prova.

L'app mostra un'anteprima senza ritaglio in Scopri, una miniatura nel calendario e l'immagine completa nei dettagli, con crediti e collegamenti alla licenza e alla risorsa originale. Le immagini vengono caricate dai server della fonte, senza copiarle nel repository; occorre una connessione. In caso di errore rimangono i testi e le azioni dell'evento. Le date, i filtri e le scelte dell'utente non dipendono dalle immagini.

`npm run import:events` aggiorna anche questi dati. La pianificazione GitHub esistente userà il nuovo importatore quando il codice verrà pubblicato. Non è stata aggiunta una pianificazione distinta.

Controlli: `npm run build` e `npm test`. I test verificano URL e licenze, attribuzione, risorse ripetute, isolamento dei fallimenti e visualizzazione con immagine assente o non raggiungibile.

Prestazioni: le anteprime utilizzano il servizio ufficiale `flyimg.opencityitalia.it` già usato dal Comune, con formato automatico e lato massimo di 180 px per le miniature, 640 px per Scopri e 1200 px nei dettagli. Le miniature hanno caricamento differito, la copertina visibile priorità alta. Il collegamento all’immagine originale conserva il file alla risoluzione della fonte. Le versioni ridotte sfruttano la cache HTTP del servizio; nessun download degli originali è necessario per aprire una scheda.

## Notizie e avvisi del Comune

`npm run import:news` recupera anche i riferimenti alle immagini dalle risorse ufficiali delle pubblicazioni. Riusa le stesse regole per URL, licenze e crediti degli eventi, leggendo ogni risorsa una sola volta per importazione. Un errore della foto non elimina la notizia. Nelle sezioni Notizie e Quartiere le schede hanno anteprime da 640 px caricate al bisogno, in una fascia separata sopra il titolo senza ritagli; nei dettagli la foto completa è ridimensionata a 1200 px, con accesso all’originale. Le schede senza immagine mantengono il layout testuale. Questa modifica riguarda le pubblicazioni comunali, non il feed ATV.
