# Calendario rinnovato — prova locale

Implementazione del 21 ottobre 2026, successiva all'analisi del calendario. Nessuna pubblicazione GitHub in questo passaggio.

## Navigazione e aspetto

Selettore settimanale bianco più compatto, spostamento settimana nella barra del mese e scorciatoie Oggi / Domani / Weekend. Il mese resta un pannello; la navigazione principale resta in basso. Solo l'elenco interno scorre. I cuori sui giorni indicano i salvati, anche nel mese, con etichette accessibili.

Il weekend mostra sabato e domenica raggruppati per data, con conteggio degli eventi distinti. La domenica si usa il weekend corrente, comprensivo del sabato. Le frecce mantengono la modalità weekend spostandola di una settimana. La mappa ha ora anche un intervallo Due giorni e conserva modalità e filtri tornando al calendario.

Schede con orario evidente, titolo apribile, sede in due righe, miniatura da 68 px quando disponibile, categoria e prezzo noto. Le immagini mantengono una riga di attribuzione e i crediti completi nei dettagli. Nessun grande spazio vuoto per immagini assenti; nessuna mappa caricata in ogni scheda della lista.

## Organizzazione del giorno

Raggruppamento Mattina / Pomeriggio / Sera e gruppo distinto per periodi e orari da verificare. L'ordinamento usa gli istanti reali, correggendo il caso 10:00 +02:00 prima di 09:00 a Roma (10:00 +03:00).

Per oggi Da adesso nasconde solo gli eventi conclusi con orario finale noto; quelli già iniziati ma non terminati rimangono visibili. Se la fine non è nota, l'app non inventa una conclusione. Tutta la giornata è sempre recuperabile. Il contatore e i giorni descrivono l'intera raccolta giornaliera; il pulsante in fondo indica gli appuntamenti nascosti nella vista Da adesso.

La vista attiva si aggiorna ogni minuto e quando la pagina torna visibile, senza interrompere dettagli, selettore mese o filtri in bozza. La scelta Oggi segue il cambio di data a Roma; una data diversa scelta dall'utente non viene sostituita arbitrariamente.

Un suggerimento compatto dentro l'elenco propone il prossimo evento con orario e posizione disponibile tra i risultati filtrati, riportando data e ora. Non rappresenta popolarità, disponibilità o consiglio editoriale verificato. Non viene mostrato nei Salvati o per eventi ormai iniziati.

## Filtri

Ricerca e fonte esistenti, più categoria della fonte, fascia oraria, gratuità esplicitamente dichiarata e circoscrizione ricavata dalla sede. Categorie e zone sconosciute non vengono inventate. Le fasce non attribuiscono un orario quotidiano a una rassegna di più giorni. Un prezzo condizionato non viene trasformato in gratuito per tutti.

Le scelte hanno una bozza annullabile, possono essere azzerate e vengono mostrate come etichette rimovibili. Questi nuovi filtri riguardano Calendario, Salvati e relativa mappa; non alterano silenziosamente la selezione della vista Scopri. Ricerca testuale già disponibile per località della provincia; il filtro delle zone usa le otto circoscrizioni, non geocodifica nuovi indirizzi.

Gli stati vuoti distinguono risultati filtrati e raccolta assente; propongono rimozione dei filtri e data successiva quando disponibile. La data successiva tiene conto anche di periodi già iniziati.

## Programma personale ed esportazione

Salvataggio, conferma di presenza, snapshot sul dispositivo e storico dal giorno dopo la data finale sono preservati. Nei Salvati vengono segnalati orari sovrapposti solo per appuntamenti con inizio e fine noti nello stesso giorno. Periodi stagionali, date senza orario e durate mancanti non generano falsi conflitti.

Nei dettagli è disponibile l'esportazione del singolo evento in `.ics`. Le date con orario sono convertite in UTC; quelle senza orario usano date civili con fine esclusiva. Testi con virgole, punti e virgola, nuove righe e UTF-8 sono gestiti con escaping e folding delle righe. Fonte di riferimento del formato: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

Il file è generato solo premendo il pulsante e si importa con l'app calendario del dispositivo. Non è un abbonamento e le modifiche future non si sincronizzano. Formato e percorso JavaScript di generazione verificati nei test; l'importazione nell'app nativa del telefono richiede una prova sul dispositivo. Il browser integrato non ha restituito l'evento di download al controllo automatico; il clic non ha prodotto errori JavaScript.

## Verifica

Test su ordinamento con offset diversi, eventi con durata mancante, weekend e cambio anno/ora, filtri combinati e annullamento, mappa, salvati nel mese, sovrapposizioni e generazione ICS/errori del browser. Prova browser di calendario a 320 e 390 px, weekend, mappa Due giorni con 21 appuntamenti, filtri categoria/fascia e dettagli con esportazione.

La raccolta eventi e le sue note di aggiornamento restano visibili: questo intervento non importa nuove fonti e non certifica cancellazioni o disponibilità dei biglietti. Le integrazioni con mappe, indicazioni e autobus rimangono nei dettagli.
