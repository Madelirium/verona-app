# Aggiornamento di notizie e avvisi

Il workflow Pages esegue ogni giorno eventi, notizie e avvisi del Comune. La raccolta ATV rimane manuale. Dal comando manuale del workflow si possono scegliere separatamente eventi, notizie e ATV.

La raccolta notizie legge le prime due pagine di ciascuna fonte, per pubblicazioni degli ultimi 90 giorni: non è un archivio completo. Le date sulle schede indicano la pubblicazione del contenuto, mentre la data della raccolta indica quando è stato controllato il catalogo.

Se una fonte fallisce, conserva i suoi contenuti precedenti e la data del suo ultimo successo. Il catalogo segnala l'aggiornamento parziale. Se tutte le fonti falliscono, non avanza la data dell'ultimo aggiornamento riuscito. Il flag `--allow-partial` accetta solo raccolte con almeno una fonte riuscita.

I rapporti includono lo stato di ogni fonte e sono conservati come artefatti GitHub per 14 giorni. Prima della pubblicazione vengono eseguiti i test; se tutte le raccolte richieste falliscono, il sito precedente rimane online.

L'orario pianificato è 04:17 UTC; l'avvio effettivo dipende dalla coda GitHub Actions. Aprire l'app non avvia una raccolta. La copia locale non riceve gli aggiornamenti pubblicati su GitHub: va aggiornata tramite gli script di importazione o sincronizzando i cataloghi.
