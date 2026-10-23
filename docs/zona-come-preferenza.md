# Zona come preferenza condivisa

Il quartiere non è più uno dei servizi della Home. La dashboard conserva Eventi, Autobus, Notizie e Comune, Servizi utili ed Esplora, che occupa l'ultima riga. Le preferenze esistenti sono conservate.

Al primo accesso senza scelta precedente viene proposta una zona di interesse, con Scegli quartiere e Salta. Non si richiede geolocalizzazione. La domanda non viene ripetuta dopo il primo accesso; il segnale viene conservato in `verona-area-welcome-v1`. Il quartiere usa ancora `verona-district-v1`. Memoria bloccata: la scelta rimane utilizzabile per la visita e viene indicato il limite.

Il pulsante Impostazioni nell'intestazione apre il riepilogo della zona, la scelta/modifica/rimozione, le Notizie della zona e il calendario AMIA. Il selettore non applica le bozze prima della conferma; chiuderlo riporta al controllo di origine. Nessun account richiesto.

Notizie mantiene Tutte e La mia zona. Senza scelta spiega che il filtro è facoltativo. L'associazione ai contenuti resta basata sui riferimenti a quartiere e circoscrizione già presenti nei dati: copertura parziale, senza nuove deduzioni geografiche.

Nei filtri del calendario, La mia zona riusa la stessa scelta con `districtMatch`. Il filtro è disabilitato senza quartiere. La selezione iniziale resta Tutte le zone e provincia. Rimuovere il quartiere annulla un eventuale filtro La mia zona attivo, evitando risultati vuoti dovuti a una preferenza rimossa.

La zona AMIA è indipendente: nessuna scelta di quartiere modifica il calendario della raccolta. Il cestino in Home apre il calendario e il suo selettore esistente.

L'implementazione storica della schermata quartiere resta interna per compatibilità, senza collegamento tra i servizi. Non sono state aggiunte API o dipendenze.

Verifica: build rigenerata; 408 test superati, inclusi primo accesso, Salta e riapertura, annullamento, persistenza, filtro eventi, rimozione, separazione AMIA e memoria bloccata. Verificati nel browser impostazioni, selettore e notizie della zona a 320 e 390 px. Il primo accesso è stato provato su un'origine locale temporanea separata, senza cancellare le preferenze dell'anteprima Wi-Fi.

Modifiche locali, pubblicazione separata.
