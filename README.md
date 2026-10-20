> Giochi online: Briscola e Forza 4, tavoli amichevoli e ranked con Elo. Il motore gira su Node/Render e i dati dei giochi su Supabase. [Configurazione](docs/giochi-render-supabase.md). Eseguire `npm ci` prima dei test.

# Verona — prime fonti eventi

Prototipo locale dell'importazione da Comune di Verona e Veronafiere. Richiede Node.js 22 o successivo, senza dipendenze esterne.

```powershell
npm run import:events
npm test
npm start
```

Anteprima: http://127.0.0.1:4173. Per scegliere una data iniziale diversa impostare `EVENTS_FROM` nel formato `YYYY-MM-DD`; il valore predefinito è il giorno corrente a Roma.

Per usare il prototipo da un telefono sulla stessa rete Wi-Fi, eseguire `npm run start:lan` e aprire l'indirizzo stampato dal comando. Il server si lega all'indirizzo IPv4 della scheda Wi-Fi, senza pubblicazione su Internet. Il computer deve restare acceso e il processo in esecuzione. L'indirizzo può cambiare quando si cambia rete. I salvati sul telefono sono separati da quelli del computer.

Il calendario include già i dati nel file `public/index.html`: non richiede importazioni o richieste alle API dal browser. Si può aprire anche direttamente quel file. `npm run build` rigenera il calendario dai dati locali senza accedere a Internet. L’agenda mostra una settimana con conteggi e l’elenco del giorno, lasciando fissi intestazione e navigazione. Il nome del mese apre il selettore mensile: sfogliarlo e chiuderlo non cambia la data finché non si sceglie un giorno. Frecce, Home ed End permettono anche la navigazione da tastiera. Le schede hanno due azioni: Salva e Dettagli; nei dettagli di un evento salvato si può confermare o annullare la presenza e rimuovere l’appuntamento. Ricerca e fonte si applicano esplicitamente dal pannello; chiuderlo annulla le modifiche. Il ritorno dalla mappa conserva vista, giorno, ricerca, fonte e posizione della lista. I salvati usano la memoria di questo browser, senza account o prenotazioni; la persistenza non è condivisa fra dispositivi.

## Scopri e interazione mobile

La vista iniziale è Home, con sei servizi, un collegamento al calendario di oggi, una proposta tratta dagli eventi con luogo controllato e una pubblicazione comunale. Eventi, Notizie e Comune, Autobus ed Esplora sono attivi; Persone e Il mio quartiere sono indicati come in preparazione e aprono una presentazione della funzionalità prevista. I conteggi provengono dal catalogo e i programmi personali dai salvati del browser. Nessuna notizia o informazione sui trasporti simulata.

## Esplora

Mappa interattiva e lista delle attività, con ricerca per nome e indirizzo, categorie, preferiti, dettagli, orari quando presenti, sito, telefono e indicazioni esterne. La prima raccolta contiene 1.480 punti OpenStreetMap nel centro e nelle zone limitrofe di Verona, nel rettangolo `[45.425, 10.975, 45.455, 11.02]`. Non copre tutta la città o la provincia e non include ogni esercizio: si importano solo punti nominati, senza dedurre attività mancanti.

`npm run import:places` aggiorna il catalogo tramite Overpass e rigenera l'HTML. Non viene eseguita una query per ogni visitatore. Per il prototipo si estraggono solo nodi, evitando le geometrie complesse che hanno causato timeout; il normalizzatore supporta anche i centri di altre geometrie per futuri ampliamenti. `data/places.json` conserva i campi normalizzati e l'attribuzione ODbL. In caso di errore, conserva il precedente catalogo, indicando che l'aggiornamento non è riuscito. Gli aggiornamenti restano manuali.

Leaflet 1.9.4 è incluso localmente nel file generato: JS e CSS sono verificati con gli hash pubblicati nella documentazione ufficiale, e la licenza BSD-2-Clause è conservata in `public/vendor/leaflet.LICENSE`. `node scripts/fetch-map-assets.mjs` ripristina i file della libreria. La mappa si inizializza solo quando si apre Esplora e usa le tessere OSM online, con attribuzione visibile e cache ordinaria del browser; non preleva mappe per uso offline. La lista e le schede sono incorporate nell'HTML. In assenza di connessione per le strade, resta disponibile la lista. Nessuna geolocalizzazione dell'utente viene richiesta.

I dati sono della community, non schede rivendicate dagli esercenti. Gli orari sono mostrati nella notazione originale della fonte: non si calcola lo stato “aperto adesso”. Contatti, aperture e accessibilità vanno confermati con l'attività. Fonte/licenza: https://www.openstreetmap.org/copyright. Prima di un lancio pubblico, definire fornitore cartografico e aggiornamento del catalogo in base al traffico previsto.

## Autobus

La sezione ha tre viste: **Le mie linee / Tutte / Avvisi**. Alla prima apertura mostra i preferiti se presenti, altrimenti Tutte. Le schede separano le direzioni esplicitamente indicate da ATV e offrono un accesso diretto al PDF; i percorsi completi si consultano nel pannello dei dettagli. Il servizio feriale, serale o festivo si sceglie sopra l'elenco, senza dedurre il servizio del giorno.

Gli avvisi distinguono le proprie linee, le altre e le comunicazioni generali o prive di numeri riconosciuti; queste ultime rimangono nella selezione personale, perché potrebbero riguardare il viaggio. Il riconoscimento gestisce anche titoli come `LINEE 32-80-SC01- dall' 8/10`. Si parla di pubblicazioni recenti, non di deviazioni certamente attive. Le ricerche di linee e avvisi sono separate e il filtro di servizio non nasconde gli avvisi. **Altro → Notizie ATV** apre un pannello con ricerca indipendente sull'intero feed, comprese le comunicazioni aziendali. In Altro si trovano anche i servizi esterni e lo stato delle fonti.

`npm run import:bus` importa le schede urbane feriali, serali e festive di Verona e il feed RSS ATV. Il catalogo contiene 38 schede (24 feriali, 5 serali e 9 festive), con percorso sintetico e 13 avvisi di servizio presenti nella risposta RSS. Il pulsante **Orari** consulta dentro l’app le tabelle estratte dai PDF della raccolta stagionale: direzione, servizio e fermata, con note e validità della fonte. Il PDF resta un riferimento secondario. Sono orari programmati, non dati in tempo reale. Le fermate delle tabelle non sono considerate un elenco completo di tutte le fermate della rete. Procedura e controlli: `docs/orari-atv.md`.

La sezione è disponibile dalla Home: ricerca per numero o località nel percorso, filtro per servizio, preferiti separati per scheda, dettaglio con PDF e fonte, e avvisi associati ai numeri di linea espliciti nel titolo. Gli avvisi non sono automaticamente considerati ancora attivi. Il feed contiene solo le pubblicazioni più recenti, non l'archivio completo delle deviazioni. L'extraurbano e la ricerca ufficiale per fermate sono raggiungibili tramite collegamenti esterni.

I dati sono incorporati nell'HTML e i preferiti rimangono nel browser. Gli importatori decodificano la codifica dichiarata da ATV, ritentano gli errori temporanei e conservano i dati precedenti delle fonti che falliscono, con data dell'ultimo successo per fonte. Un fallimento totale non cambia la data della raccolta riuscita; fonti vuote o con un calo anomalo non cancellano le schede precedenti. `npm run import:bus` rigenera l'HTML anche in caso di problemi; con `-- --allow-partial` ammette il successo parziale. ATV viene aggiornato solo manualmente: il workflow giornaliero riguarda gli eventi. `npm run snapshot:bus-pdfs` conserva localmente i PDF ufficiali come raccolta stagionale, con data e SHA-256 nel registro `data/bus-timetable-snapshots.json`; l’estrazione verificata è in `data/bus-timetables.json`. Prima di un impiego pubblico continuativo occorre verificare con ATV le condizioni di riutilizzo. Il dettaglio delle fonti è in `docs/atv-data.md`.

## Notizie e Comune

La sezione ha ricerca sempre visibile e tre viste: Tutte, La mia zona e Salvate. La zona è condivisa con Il mio quartiere e usa sia le circoscrizioni esplicite sia i nomi dei quartieri riconosciuti nei testi. La scelta resta facoltativa; le pubblicazioni senza zona rimangono in Tutte. Argomento e tipo Notizia/Avviso si selezionano nel pannello Filtri: solo Applica modifica i risultati, mentre chiusura e annullamento mantengono i filtri precedenti. Ogni filtro applicato si può rimuovere dal riepilogo visibile. Le etichette degli argomenti sono più descrittive, ma la classificazione automatica sottostante non è stata modificata.

Le schede separano tipo, data di pubblicazione, argomento e zona, con azioni Dettagli e Salva. Il dettaglio conserva il titolo ufficiale e la sintesi e raccoglie i metadati in Fonte e aggiornamento. La data di pubblicazione non viene trattata come periodo di validità: non sono ancora calcolati scadenze, urgenza o stato attivo. Stati vuoti e filtri senza risultati hanno azioni di recupero; senza catalogo è disponibile la fonte ufficiale. Il contenuto scorre internamente al viewport e la navigazione resta visibile.

`npm run import:news` legge le prime due pagine pubbliche di Notizie e Avvisi del Comune di Verona, importando le pubblicazioni degli ultimi 90 giorni. È una raccolta recente, non l'archivio completo. Memorizza titolo, sintesi della pagina indice, data, link originale e data di raccolta in `data/news.json`, senza foto, allegati o dati degli autori. Il dettaglio dell'app rimanda alla fonte per il testo integrale. Il processo rigenera anche l'HTML, mantenendo i dati incorporati e disponibili sul Wi-Fi senza richieste dal telefono alle fonti.

Gli identificativi comunali rimuovono i duplicati fra le pagine. Se una fonte fallisce, mantiene le sue schede precedenti e registra il problema in `data/news-import-report.json`; la schermata mostra l'aggiornamento incompleto. Gli argomenti sono assegnati dall'app con regole testuali, non sono classificazioni ufficiali né indicatori d'urgenza. Le circoscrizioni vengono assegnate solo se esplicite nel titolo o nella sintesi. Il filtro per zona non include le schede prive di tale indicazione.

La sezione consente di distinguere notizie e avvisi, cercare, filtrare e salvare in localStorage con chiave distinta dagli eventi. Non identifica automaticamente scadenze, validità corrente o revoche: verificare il documento originale. Gli aggiornamenti sono manuali; non è stato attivato alcun processo ricorrente. I dati comunali sono attribuiti secondo CC BY 4.0, salvo eccezioni segnalate dalla fonte.

Scopri presenta schede con swipe tramite Pointer Events, pulsanti equivalenti, dettagli in un dialogo nativo e annullamento dell'ultima scelta. Destra salva una specifica occorrenza; sinistra scarta la serie di appuntamenti. Una serie già salvata non viene riproposta nella scoperta finché contiene un appuntamento salvato futuro. I filtri consentono di scegliere fonte, testo e periodo. Le scelte sopravvivono al ricaricamento quando il browser consente localStorage.

Il primo gruppo è una selezione di tre manifestazioni comunali con luoghi controllati sulle fonti: Hostaria, Soffitte in Piazza e Nachleben. Le integrazioni editoriali sono in `data/editorial.json`, associate al link originale e, quando necessario, alla data. La build le unisce ai dati senza modificare il catalogo importato. Questo controllo del luogo non equivale a una conferma in tempo reale dell'evento. Nel catalogo completo le altre schede restano indicate come da verificare. Le copertine sono composizioni CSS per categoria, senza fotografie di terzi.

La navigazione mobile è in basso con area sicura; i layout più ampi si attivano progressivamente. Il gesto orizzontale lascia libero lo scorrimento verticale. Il progetto mantiene il vincolo mobile first in `AGENTS.md`. I test eseguono la logica in un DOM simulato: coprono le scelte, la persistenza, i filtri, i gesti e l'annullamento, ma non sostituiscono un controllo visivo su dispositivi reali.

La presentazione segue ora il vincolo di una sola schermata da app: altezza `100dvh`, larghezza massima 480 px anche sul desktop, nessuno scorrimento della pagina. La scheda Scopri si adatta allo spazio verticale; titoli e informazioni sintetiche rimandano ai dettagli completi. Ricerca e filtri si aprono dal pulsante in alto; fonti e note dal pulsante informazioni. Nel calendario scorre solo l'elenco giornaliero. Altezza ridotta e aree sicure hanno regole dedicate.

## Funzionamento

La Home mantiene la dashboard con sei servizi subito visibili, evento in evidenza, collegamento alle notizie e accesso ai programmi salvati. La prova “Oggi per te” è stata rimossa su preferenza dell’utente.

La Home contiene “Permessi ZTL” al posto di “Persone”. La scheda apre un pannello con collegamento esterno a https://permessi.mobilita.comune.verona.it/, informazioni ZTL e assistenza sul sito del Comune. Indirizzo verificato il 17 ottobre 2026: il portale reindirizza a `/ar/v2`; il dominio di ingresso è mantenuto per seguire eventuali cambi di percorso. Richieste e autenticazione si svolgono sul servizio ufficiale, senza acquisire credenziali o dati delle pratiche nell'app.

### Il mio quartiere

La Home apre una sezione attiva con scelta di uno dei 23 quartieri o di un'intera circoscrizione. L'associazione alle otto circoscrizioni e i collegamenti alle pagine istituzionali sono verificati sulle due pagine dell'[Ufficio Decentramento](https://www.comune.verona.it/Amministrazione/Aree-amministrative-e-Direzioni/Ufficio-Decentramento) e conservati in `scripts/districts.mjs`. La scelta si applica alla conferma, può essere annullata o rimossa e persiste con chiave `verona-district-v1`. Non richiede geolocalizzazione.

Notizie, Avvisi ed Eventi riutilizzano i cataloghi esistenti senza modificare i filtri delle altre sezioni. I salvataggi restano condivisi con Notizie e calendario personale. Le notizie sono associate a una zona solo per riferimenti espliciti alla circoscrizione o nomi interi di quartieri nel titolo/sintesi; gli eventi per riferimenti nella sede. Il pannello mostra il motivo dell'associazione. Un riferimento esplicito alla circoscrizione vale anche per i quartieri che ne fanno parte, mentre la menzione di un singolo quartiere non viene estesa agli altri. Le associazioni sono automatiche, possono essere incomplete o inesatte e non costituiscono una verifica geografica. Gli eventi mantengono le singole occorrenze future.

La scheda “Dal Comune” raccoglie separatamente le pubblicazioni prive di zona riconosciuta, senza presentarle come riferite all'intera città o al quartiere scelto. La raccolta iniziale resta limitata alle pubblicazioni già importate: gli stati vuoti non indicano assenza di iniziative sul territorio. Non sono attivati post pubblici dei residenti o notifiche. Schermata fissa, lista interna scorrevole, scelta zona e dettagli in modali. I test verificano annullamento, cambio zona, persistenza, stati vuoti, numeri di commissione, separazione delle zone e salvataggi condivisi; il controllo visivo su dispositivi reali resta da effettuare.

La mappa eventi si apre da Scopri, dal calendario o dal dettaglio di un evento con coordinate. Consente giorno singolo, 7 o 30 giorni, ricerca/fonte e filtro per i propri eventi. Raggruppa nello stesso punto gli appuntamenti, mantenendo una selezione separata per ciascuna data, e colora i punti secondo Mi interessa/Partecipo. I dettagli condividono il salvataggio nel browser e offrono indicazioni stradali esterne. Il calendario resta il percorso alternativo accessibile per tutti gli appuntamenti.

L'importatore conserva esclusivamente coordinate dirette nel campo geo del Comune, con controllo numerico e geografico; non geocodifica titoli o nomi delle sedi. Sono punti indicati dalla fonte, non sedi confermate per ogni data. Le integrazioni editoriali possono escludere punti ambigui con mapDisabled: inizialmente Soffitte in Piazza e Nachleben. Gli appuntamenti senza coordinate utilizzabili restano nel calendario, con conteggio separato sulla mappa. Veronafiere non dispone attualmente di posizioni importate. Le tessere cartografiche richiedono Internet.

- Comune: API JSON impiegata dal calendario pubblico, tutte le pagine, singole occorrenze con gli orari modificati quando presenti. Esclude gli appuntamenti conclusi prima della data iniziale.
- Veronafiere: lettura del calendario Italia dell'anno corrente e successivo se disponibile. Mantiene le date senza inventare orari, prezzi o sede. Il calendario comprende eventi fuori provincia: ogni scheda richiede verifica geografica.
- Identificativi stabili per fonte e occorrenza; rimozione dei duplicati della stessa fonte. Il riconoscimento dello stesso evento fra fonti diverse resta da implementare, per evitare unioni erronee.
- Tutti gli eventi rimangono bozze. Nessuna pubblicazione automatica, foto o descrizione estesa importata. Il Comune indica CC BY 4.0 salvo eccezioni; per Veronafiere il riutilizzo va verificato prima della pubblicazione. Nessuna affiliazione dichiarata con le fonti.
- `data/events.json` contiene solo i campi necessari alle schede, senza metadati degli autori del sito. `data/import-report.json` riporta successi ed errori. Se una fonte fallisce, conserva i precedenti dati di quella fonte e restituisce un codice di errore.
- Gli eventi assenti al successivo aggiornamento non sono automaticamente considerati cancellati. Annullamenti, luoghi e condizioni d'accesso richiedono controllo sulla fonte.

In locale si aggiorna con `npm run import:events`. È predisposta anche una raccolta giornaliera su GitHub, che diventerà attiva dopo il caricamento del workflow sul branch predefinito: dettagli in `docs/github-pages.md`. Date riuscite per fonte e avvisi di raccolta incompleta sono visibili in ⓘ. Il report viene incorporato nel catalogo; una fonte in errore conserva i dati precedenti e una raccolta totalmente fallita non cambia la data dell’ultimo successo. Prima di un uso continuativo, concordare l'accesso ai dati con le fonti; il robots.txt comunale limita la scansione delle API. L'accessibilità tecnica non costituisce un accordo per la sincronizzazione.

## Prossimi passi

Revisione delle sedi e dei diritti di riutilizzo; gestione delle cancellazioni e degli aggiornamenti; archivio delle schede approvate; costruzione della sezione Eventi con swipe e calendario personale.

La prima prova della mappa autobus riguarda la linea 11: varianti OpenStreetMap, fermate e collegamenti prudenti alle tabelle ATV. Dettagli in [docs/mappa-autobus.md](docs/mappa-autobus.md).


Le immagini degli eventi del Comune sono importate con autore e licenza, con anteprime e locandine complete nei dettagli: [docs/immagini-eventi.md](docs/immagini-eventi.md).

## Aggiornamento Eventi e Autobus

- [Mappa generale delle linee e fermate](docs/mappa-generale-autobus.md).
- [Autobus vicini agli eventi e percorsi colorati](docs/eventi-autobus.md).
- [Orari programmati ufficiali ATV](docs/orari-ufficiali-app.md).
- [Prossimi eventi salvati e storico locale](docs/salvati-storico.md).
