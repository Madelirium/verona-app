# Aggiornamento e validità dei dati

Il pannello ⓘ mostra separatamente raccolta recente, raccolta incompleta, dati non aggiornati, catalogo periodico e validità degli orari ATV. Una raccolta recente non certifica l'apertura di un luogo o la mancata cancellazione di un evento.

Eventi e notizie usano una soglia di 48 ore, controllando anche l'ultimo successo delle singole fonti. Luoghi e attività restano cataloghi periodici: non vengono dichiarati scaduti dopo due giorni. Le date di pubblicazione delle notizie non vengono interpretate come date di fine validità.

Per ATV conta l'intervallo dichiarato dall'archivio, inclusi entrambi i giorni estremi, nel fuso Europe/Rome. Negli ultimi sette giorni compare un avviso discreto nella mappa; dopo la scadenza resta disponibile il collegamento alla fonte. Le date storiche coperte sono consultabili esplicitamente, ma non vengono utilizzate come partenze di oggi. Il controllo si aggiorna alla mezzanotte italiana e al ritorno nell'app.

`npm run check:data` stampa il rapporto dei cataloghi. Il workflow Pages lo esegue prima di preparare il sito e aggiunge warning e riepilogo alla pubblicazione. Un archivio scaduto non blocca la pubblicazione delle altre sezioni; un file illeggibile o JSON non valido interrompe invece il controllo.

Questo controllo **non scarica né rinnova automaticamente il NeTEx**. Il rinnovo resta tramite la procedura di importazione ufficiale, con controllo di fonte, versione, calendari e confronto dei campioni. Il prossimo intervento deve rendere tale procedura ripetibile prima della scadenza; non è stato introdotto un download da endpoint non verificati.

Verifiche: casi di confine alla mezzanotte di Roma, intervalli invalidi, fonte vecchia con raccolta globale recente, fallimento parziale, timestamp mancanti/futuri e cataloghi statici. Il frontend viene sempre rigenerato con `npm run build`.
