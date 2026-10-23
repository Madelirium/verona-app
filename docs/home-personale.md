# Home: Oggi per te

La dashboard conserva cinque servizi principali: il quartiere è ora una preferenza modificabile dalle impostazioni e condivisa da Notizie e filtri eventi. Il riquadro personale mostra al massimo tre contenuti, senza ripetere la stessa categoria.

Meteo e raccolta occupano una riga compatta a due colonne, con controlli alti almeno 48 px. Il meteo usa emoji decorative (sole, nuvole, pioggia, neve, temporali, nebbia) e conserva l’etichetta Max: è una previsione ARPAV, non una temperatura attuale. Dati scaduti o assenti usano un simbolo neutro. L’etichetta accessibile mantiene area e descrizione meteo completa.

Il cestino apre il calendario. Mostra tutti i materiali della prossima data disponibile e distingue oggi, domani o la data successiva. Per le zone con calendario giornaliero indica Esponi, rispettando il giorno di esposizione del dataset. Senza zona offre Scegli zona; un calendario scaduto indica Da aggiornare. La raccolta non viene ripetuta in Oggi per te.

## Scelta dei contenuti

- Scadenza salvata o della zona entro sette giorni: priorità più alta.
- Prossimo evento salvato ancora valido.
- Prima linea preferita disponibile nel catalogo, con accesso a fermate e orari programmati.
- Notizia della zona recente, eventuale scadenza più lontana e contenuti generali come alternative.
- Senza evento salvato viene proposta un'idea tra gli eventi verificati.

Le scelte usano le preferenze locali già presenti. Non introducono account, sincronizzazione o nuovi servizi esterni. Gli orari degli autobus restano programmati; non sono informazioni in tempo reale. Una zona con calendario scaduto mostra un invito a consultare AMIA, senza riproporre giorni o orari scaduti.

Ogni voce apre il dettaglio esistente. Le modifiche della zona aggiornano subito la Home. Focus e scorrimento vengono conservati tornando dai pannelli e durante gli aggiornamenti periodici.

## Verifica

- Build del frontend completata.
- Suite completa dopo la riga compatta: 404 test superati, con casi su priorità, azioni, assenza di preferenze, validità del calendario, icone meteo, materiali e conservazione del contesto.
- Controllo nel browser a 390 × 844 e 320 × 740: navigazione inferiore visibile, scorrimento interno dei suggerimenti, apertura e chiusura del dettaglio evento.
- A 320 px le icone dei servizi affiancano il testo per evitare titoli tagliati.

Modifica preparata in locale; pubblicazione separata.
