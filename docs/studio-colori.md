# Studio cromatico per Verona

18 ottobre 2026 · Proposta progettuale, non test di gradimento con utenti.

## La decisione proposta

Consiglio **Blu e oro**: fondo quasi neutro ma caldo, superfici avorio, blu profondo per le azioni e una quantità limitata di giallo dorato. Mantiene il richiamo gialloblù richiesto senza trasformare tutta la schermata in una superficie colorata. La dashboard con i sei servizi rimane riconoscibile.

Non cercherei un ulteriore compromesso tra “più saturo” e “più pallido” applicato a ogni elemento. Separerei i ruoli: una superficie può essere tenue mentre il pulsante che contiene resta deciso. Questa è la differenza centrale rispetto alle prove precedenti.

La raccomandazione è un giudizio di progetto fondato sulle preferenze emerse e sulla struttura dell'app. I rapporti di contrasto sono misurabili; il carattere invitante e il gradimento richiedono una prova con persone reali. Nessuna palette garantisce più download o più utilizzo.

## Perché le prove non hanno convinto

- **Blu scuro con tutti i pulsanti gialli:** molto colore in aree ampie e ripetute. Nella mia valutazione, la dashboard assume un carattere più energico e vicino a un'identità sportiva; i sei servizi richiamano tutti l'attenzione con la stessa intensità.
- **Crema e blu polvere:** i testi avevano contrasto sufficiente, ma la distinzione tra superficie, elemento interattivo e stato selezionato risultava visivamente meno netta. Una UI può rispettare il contrasto del testo e sembrare comunque poco incisiva.
- **Giallo caldo esteso e blu più forte:** i pulsanti diventano riconoscibili, ma sfondo ed elementi interattivi occupano entrambi un ruolo cromatico dominante. È difficile stabilire una priorità.
- **Terracotta iniziale:** richiama un immaginario urbano e materico, ma differenziare molti servizi con colori autonomi indebolisce la coerenza. Rimane una valida alternativa se si vuole abbandonare il gialloblù.

Queste osservazioni derivano dagli stili e dalla gerarchia della schermata. Non equivalgono a una valutazione visiva certificata su dispositivi o a uno studio percettivo sperimentale.

## Tre direzioni confrontabili

Le anteprime mantengono disposizione, testi e controlli uguali: cambia il sistema cromatico, così il confronto non viene confuso da un nuovo layout.

| Direzione | Carattere cercato | Vantaggio | Compromesso |
| --- | --- | --- | --- |
| **Blu e oro** | Chiaro, deciso, accogliente | Tiene il gialloblù e lascia respirare i contenuti | Il giallo è un accento, non il colore prevalente |
| **Sabbia e blu** | Più caldo e solare | Fondo più caratterizzato, pulsanti ancora ben definiti | Le superfici contengono più giallo; da provare soprattutto negli elenchi lunghi |
| **Pietra e terracotta** | Urbano, caldo, materico | Identità meno legata all'immaginario sportivo | Si allontana dalla preferenza gialloblù |

## Palette consigliata: Blu e oro

| Ruolo | Colore | Impiego |
| --- | --- | --- |
| Sfondo | `#F6F5F0` | Guscio dell'app, pagine, spazi tra le schede |
| Superficie | `#FFFEFA` | Schede, elenchi, modali e navigazione |
| Testo principale | `#1E2D43` | Titoli, contenuti e informazioni essenziali |
| Testo secondario | `#586777` | Fonte, data e descrizioni di supporto |
| Azione principale | `#254F78` | CTA, collegamenti e icone interattive |
| Azione premuta/hover | `#1C3D5D` | Feedback sul pulsante primario |
| Testo sul primario | `#FFFFFF` | Etichette dei pulsanti blu |
| Accento oro | `#E9BF50` | Piccoli segni di identità ed evidenziazioni |
| Fondo caldo evidenziato | `#F8E9BC` | Evento in evidenza, senza testo bianco |
| Selezione tenue | `#E7EEF5` | Tab attiva o salvataggio già effettuato |
| Contorno funzionale | `#7D8D9B` | Bordi necessari per riconoscere campi di input |
| Separatore decorativo | `#D6DCE1` | Divisioni tra superfici; non sostituisce il contorno funzionale |

Per la direzione Sabbia e blu: fondo `#FAEFCD`, superficie `#FFFCF2`, primario `#315D85`, testo `#26374C`, accento `#D4A436`.

Per Pietra e terracotta: fondo `#F6F1EA`, superficie `#FFFDFA`, primario `#8E443B`, testo `#342B29`, accento `#D0A650`.

## Come distribuire il colore

La maggior parte della schermata dovrebbe restare chiara. Il blu definisce l'interazione; l'oro introduce calore e riconoscibilità. Non propongo percentuali rigide: dipendono dal contenuto visibile e dalla sezione.

**Home.** Una scheda di servizio in blu pieno può dare un punto d'ingresso agli eventi. Gli altri cinque servizi restano pulsanti chiari con etichette e icone blu. Non sono disabilitati: mantengono area di tocco, stato premuto e focus. L'evento in evidenza usa il fondo caldo. La navigazione attiva usa un fondo azzurro tenue e testo blu; non deve competere con l'azione principale.

**Notizie e quartiere.** Il contenuto deve occupare il primo piano. Fondo chiaro, titoli scuri, metadati leggibili. “Avviso” viene scritto e identificato con un'etichetta: non basta cambiarne il colore e non va confuso con un'emergenza. Evitare una grande superficie gialla per ogni pubblicazione.

**Calendario.** Il giorno selezionato combina contorno e stato accessibile. Il giorno di oggi ha anche un'indicazione testuale accessibile. Mi interessa e Partecipo conservano etichette esplicite e spunta. Oro e blu non devono essere l'unico modo di distinguere due stati.

**Modali e moduli.** Una CTA blu per il passo principale; azioni secondarie chiare con bordo e testo blu; chiusura semplice ma evidente. I placeholder non sostituiscono le etichette. Le cornici dei campi devono restare distinguibili dalla superficie.

**Mappa.** I colori del marchio non sostituiscono automaticamente quelli degli stati o delle categorie. Marker, legenda e dettaglio devono usare la stessa associazione. Un cambiamento cromatico richiede anche etichette o simboli per non affidare l'informazione al solo colore.

## Contrasti e accessibilità

Riferimento operativo: almeno **4,5:1** per il testo normale e **3:1** per il testo grande nelle condizioni previste da WCAG. Per icone e parti di controllo necessarie a identificazione e stato, verificare il requisito non testuale di **3:1** contro i colori adiacenti pertinenti. Non ogni bordo decorativo deve raggiungere tale soglia.

| Abbinamento | Blu e oro | Sabbia e blu | Pietra e terracotta |
| --- | ---: | ---: | ---: |
| Testo principale / sfondo | 12,73:1 | 10,55:1 | 12,27:1 |
| Testo secondario / superficie | 5,75:1 | 5,88:1 | 5,89:1 |
| Testo bianco / pulsante primario | 8,51:1 | 6,92:1 | 6,91:1 |
| Testo scuro / accento oro | 7,96:1 | 5,29:1 | 6,07:1 |
| Contorno funzionale / superficie | 3,38:1 | 3,46:1 | 3,51:1 |

Il dettaglio delle **33 coppie** esaminate e i valori non arrotondati sono in `color-palettes.json`. Tutte passano la soglia assegnata. I valori riportati in tabella sono arrotondati solo per lettura; il giudizio pass/fail usa il valore completo.

Questo non certifica l'accessibilità dell'intera applicazione. Non copre tutte le combinazioni effettive della cascata CSS, trasparenze, overlay cartografici, impostazioni di sistema, dimensioni del testo o gestione del focus.

**Abbinamento da evitare:** testo bianco sull'oro. Per tutte le tre proposte non raggiunge 4,5:1. L'oro deve avere testo scuro, oppure essere un elemento decorativo senza testo sovrapposto.

## Il colore da solo non risolve tutto

Nell'app esistono numerose etichette da 9–11 px. Anche un ottimo contrasto non le rende automaticamente comode da leggere. Valuterei testi principali da 15–16 px e metadati da 12–13 px, riducendo informazioni duplicate anziché comprimendole. Sono obiettivi di progetto da verificare con i vincoli della schermata, non soglie WCAG obbligatorie.

Gli stati non disponibili non dovrebbero sembrare link utilizzabili. Le azioni selezionate devono avere testo/spunta oltre al colore. Un focus visibile e coerente è necessario per la tastiera; sul telefono servono aree di tocco di almeno 44 px secondo il requisito del progetto.

Prima di applicare la palette consoliderei inoltre i token CSS: nomi come `primary`, `on-primary`, `surface`, `text` e `border-control` devono mantenere lo stesso significato. Le prove hanno lasciato nomi riferiti a tinte precedenti e più override; continuare ad aggiungerne aumenterebbe il rischio di stati incoerenti.

## Verifica proposta prima della scelta finale

1. Confrontare le tre palette sulla stessa dashboard e sullo stesso telefono, a luminosità normale. Evitare confronti basati soltanto su campioni di colore.
2. Aprire un evento, salvarlo, individuare un avviso, riconoscere la tab attiva e chiudere una modale. Osservare esitazioni e lettura delle azioni, senza suggerire dove toccare.
3. Provare anche notizie con titolo lungo, calendario pieno, stato vuoto e input con focus, a 320, 375 e 430 px, oltre a testo ingrandito.
4. Raccogliere separatamente “cosa sembra più invitante” e “dove capisco prima cosa fare”. Un piccolo gruppo di residenti e visitatori può individuare problemi, ma non dimostrare un aumento dei download.
5. Applicare la scelta all'app solo dopo averla valutata come insieme; verificare poi i colori effettivamente renderizzati su tutte le sezioni.

## Fonti

- [W3C, WCAG 2.2: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): contrasto del testo, soglie e limiti della misurazione.
- [W3C, Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): componenti, icone e stati.
- [W3C, Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): informazione non affidata esclusivamente al colore.
- [Designers Italia, Colori](https://designers.italia.it/design-system/fondamenti/colori/): organizzazione e uso coerente dei colori nell'interfaccia.
- [Material Design 3, Color roles](https://m3.material.io/styles/color/the-color-system): separazione tra ruoli di superficie, contenuto e azione.

La scelta specifica di blu, oro e terracotta è una proposta per questo progetto; non viene presentata dalle fonti come una palette obbligatoria o ufficiale di Verona.
