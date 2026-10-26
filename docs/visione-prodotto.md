# Verona in Tasca — visione di prodotto

Riferimento condiviso del 26 ottobre 2026, ricavato dalla visione espressa
dall'utente nella chat di coordinamento. Questo documento definisce la
direzione del prodotto; non certifica funzionalità già sviluppate o pubblicate.

## Decisione aggiornata: indicazioni e ciclabili

Il 26 ottobre l'utente ha approvato la semplificazione: la scheda evento apre
le mappe del dispositivo per scegliere il percorso, senza selettore iniziale.
Il sistema gestisce la predefinita dove supportato; su desktop si apre la mappa
web. Google Maps e Mappe di Apple restano come alternative in “Altre mappe”.
Si sospende lo sviluppo del calcolo interno dei percorsi. Restano
utili fermate, linee e orari autobus come servizio consultabile. Le ciclabili
sono una semplice mappa separata nei Servizi, senza integrazione negli eventi
o navigazione. Questa decisione sostituisce le precedenti proposte di estendere
il motore con cambi e confronti automatici. Implementazione e verifica locale
sono descritte in `mappe-esterne-e-ciclabili.md`.

## Missione e pubblico

Rendere Verona più accessibile e facile da vivere: aiutare le persone a scoprire
le opportunità della città, capire dove si trovano e raggiungerle facilmente.
Riunire progressivamente i servizi utili del Comune e della vita cittadina in
un'esperienza semplice, giovane ed elegante.

Il primo pubblico sono le persone che vivono, studiano e lavorano a Verona.
L'estensione ai turisti è una fase successiva. La completezza dei servizi è
una direzione di crescita, da raggiungere mantenendo chiare le azioni principali.

Il prodotto offre anche agli esercenti locali la possibilità di farsi conoscere
e promuovere attività, iniziative e offerte pertinenti alla vita della città.

## Esperienza principale

Il percorso da rendere eccellente è:

**Scopro qualcosa che mi interessa → capisco quando e dove → scelgo come
arrivarci → salvo o apro le indicazioni.**

La scheda evento deve rispondere con chiarezza a titolo, data, orario, sede,
costo quando noto e condizioni di accesso. La mobilità usa la sede corretta
per la data selezionata e rende comprensibili camminata, attesa, autobus,
eventuali cambi e percorso auto con parcheggio.

Le informazioni confermate devono distinguersi da quelle mancanti o da
verificare. Una ricerca senza risultati non dimostra l'assenza di un servizio.
L'accessibilità fisica dei luoghi va indicata quando supportata da fonti
verificate; la semplicità dell'interfaccia è un requisito di base per tutti.

## Direzione visiva e d'uso

- Mobile first e rispetto del guscio 100dvh previsto da AGENTS.md.
- Navigazione inferiore sempre disponibile; dettagli e filtri in pannelli.
- Aspetto giovane, curato e leggibile, con testi brevi e azioni riconoscibili.
- Poche scelte iniziali, approfondimenti progressivi e contesto conservato
  quando si torna da una scheda, da una mappa o da un servizio.
- Accesso ai servizi di base immediato; il login Google rimane facoltativo
  secondo la scelta già confermata dall'utente.

## Proposte di prodotto da discutere

Le seguenti proposte traducono la visione in lavoro possibile: non sono ancora
decisioni di implementazione o di prezzo.

### Primo ciclo: scoperta e arrivo

1. Migliorare la scoperta con poche scelte comprensibili: oggi, fine settimana,
   vicino a me oppure una zona scelta. Conservare ricerca e filtri approfonditi.
2. Rendere coerenti la scheda evento, la sede del giorno e l'azione Come arrivare.
3. Mostrare A piedi e Autobus come alternative distinte, con tempi completi e
   camminata esplicita; ampliare progressivamente la ricerca delle fermate utili.
4. Verificare il flusso completo su telefono e confrontare i percorsi con il
   protocollo dei due collaudatori indipendenti.

I primi tre casi di regressione del confronto del 26 ottobre sono Passione
Teatro, San Massimo e Montorio. Gli artefatti dettagliati, inclusi i dati di
partenza dell'utente, restano in `.local/bot-comparison` e non vanno pubblicati.
Il confronto riguarda i tragitti verso le sedi, non la partecipazione agli eventi.

### Secondo ciclo: servizi quotidiani

Valorizzare ciò che già esiste: farmacie, raccolta, autobus, notizie e scadenze,
con una Home che dia accesso rapido alle necessità ricorrenti. Una possibile
organizzazione per bisogni è Cosa fare, Come muovermi e Servizi utili; prima di
cambiare la navigazione, confrontarla con i flussi attuali e provarla su mobile.

Il catalogo cresce per utilità e affidabilità dei dati, con responsabilità chiare
di aggiornamento e collegamenti ai servizi ufficiali quando l'azione avviene lì.

### Terzo ciclo: attività locali e promozione

Proporre un piccolo pilota con esercenti reali: scheda dell'attività, contatti,
posizione, collegamento a un'iniziativa o promozione e anteprima mobile.
Il contesto può essere la zona scelta o la vicinanza a un evento.

Proposta editoriale: contenuti commerciali chiaramente riconoscibili come
Sponsorizzato, frequenza contenuta e inserzioni coerenti con la schermata.
La promozione non deve modificare l'affidabilità di informazioni civiche,
orari, percorsi o avvisi. In assenza di inserzioni reali, lo spazio può sparire.

Definire con l'utente modalità di inserimento, revisione, durata e prezzo prima
di attivare vendite o pubblicare promozioni di esercenti. La documentazione
`home-compatta-sponsor.md` descrive una precedente prova di ingombro: non
costituisce un sistema commerciale già operativo.

### Evoluzione turistica

Dopo aver consolidato i flussi per i residenti, valutare lingue, orientamento
per chi visita la città, itinerari e informazioni pratiche. Costruire queste
funzioni sugli stessi dati e moduli, mantenendo semplice l'accesso quotidiano.

## Organizzazione e sala di controllo

La chat principale raccoglie obiettivi e priorità, propone interventi e coordina
le dipendenze. Le sei chat create mappano i settori:

| Chat | Responsabilità principale |
|---|---|
| Verona · Mobilità e percorsi | Dati trasporti, motore, alternative e interfaccia dei tragitti |
| Verona · Eventi e luoghi | Scoperta, catalogo, ricorrenze, sedi e dettagli |
| Verona · Servizi locali | Farmacie, raccolta e informazioni di quartiere |
| Verona · Giochi | Briscola, Forza4 e relativi servizi |
| Verona · Funzioni condivise | Guscio, navigazione, account, preferenze, salvati, calendario e PWA |
| Verona · Collaudo e bot | Regressioni, prove mobile e confronto indipendente dei motori |

Una chat aggiuntiva **Attività locali e promozione** è proposta per il momento
in cui si avvia il pilota commerciale. Valuterà esperienza degli esercenti,
schede, contenuti promozionali e gestione delle inserzioni, in coordinamento
con eventi, servizi e componenti condivisi.

I giochi già presenti mantengono il proprio ambito; la priorità del prossimo
ciclo proposta è il percorso Scopri → Evento → Come arrivare.

## Come decidere il prossimo lavoro

Per ogni proposta esplicitare: bisogno del cittadino o dell'esercente,
comportamento atteso, dati necessari, settore responsabile e prova di riuscita.
Un rilascio dovrebbe completare un flusso utile e verificabile.

Le proposte di interfaccia vanno provate anche a 320px, con testo e pulsanti
leggibili, stati vuoti, ritorno dai pannelli e preferenze conservate. Le modifiche
ai sorgenti frontend richiedono la rigenerazione prevista da AGENTS.md.

Questo riferimento affianca la documentazione tecnica. Le vecchie fotografie
dello stato del progetto mantengono valore storico e non vanno interpretate
come inventario aggiornato di tutte le funzioni online.
