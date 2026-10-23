# Dettaglio evento: prova con azioni sempre disponibili

Il pannello usa un’altezza massima di 94dvh: intestazione e barra inferiore restano visibili, mentre scorre solo `detail-content`. I due comandi principali sono Salva evento e Come arrivare. Ogni pulsante ha altezza minima di 48 px; sono rispettate le aree sicure inferiori.

Data, luogo e condizioni di accesso precedono mappa e approfondimenti. La descrizione viene mostrata quando presente, senza aggiungere un testo generico ripetuto. Il programma ufficiale resta raggiungibile; l’immagine con i suoi crediti è inizialmente chiusa e si apre su richiesta. Le immagini dei dettagli usano il caricamento differito.

Per un evento già salvato il comando diventa Gestisci: porta ai controlli di presenza e rimozione. La presenza non viene proposta per gli eventi passati. Salvataggio, conferma e rimozione mantengono le precedenti regole di persistenza e il ritorno all’elenco. L’esportazione .ics resta nel contenuto del pannello.

Come arrivare riutilizza il pannello esistente Autobus/Auto/A piedi. Per sedi non localizzabili il pulsante non compare e viene spiegato perché non si possono suggerire fermate o parcheggi. Nessun tracciato viene inventato.

Verifica finale: 374 test superati. Prove nel browser a 320×740 e 390×844, con immagine aperta e contenuto scorrevole, barra azioni visibile, salvataggio/gestione/rimozione e ritorno dai trasporti al dettaglio. Il salvataggio temporaneo usato per la prova è stato rimosso senza alterare gli altri preferiti.

Modifiche in locale, non ancora pubblicate su GitHub. Fonti: public/calendar.js, public/calendar.template.html e public/event-detail.css; frontend rigenerato con npm run build.
