# Notizie e Comune: lettura semplificata

Prova locale del 22 ottobre 2026, senza nuova pubblicazione GitHub.

Ricerca e Filtri condividono una riga. Tutte e La mia zona restano le due
viste del flusso; il cambio di quartiere compare soltanto nella vista locale,
quando una zona è già scelta. Senza zona rimane l'invito a sceglierla.
Il comando Salvati apre direttamente la categoria Notizie della raccolta unica,
senza ereditare filtri o ricerca delle comunicazioni.

Le schede danno priorità alla fonte Comune di Verona, alla data esplicitamente
indicata come pubblicazione, al titolo completo e alla miniatura. Le immagini
sono contenute nel riquadro senza tagliare le locandine. Se il caricamento
fallisce, il titolo recupera tutta la larghezza. Sono conservati attribuzione,
caricamento differito e collegamenti all'immagine originale nei dettagli.

Sintesi, argomento e riconoscimento geografico rimangono nel dettaglio.
Non cambia il modello dei dati né l'ordinamento fornito dal catalogo.

Una scadenza riconosciuta riporta giorno ed eventuale ora. Scade oggi dipende
dal giorno di Verona; la conclusione tiene conto dell'ora quando nota.
Pubblicazione scaduta e scadenza conclusa restano concetti distinti.
Un avviso senza termine identificabile mostra Termini da verificare in uno
stile neutro; il tipo Avviso non viene presentato come urgenza.
Nessun termine è dedotto dalla sola data di pubblicazione.

Le informazioni sulla raccolta parziale e sulla classificazione automatica
sono nel pannello Filtri e nella provenienza del dettaglio. Eventuali problemi
di aggiornamento continuano a essere visibili nella schermata principale.

Verifiche: schede e dettagli, stati temporali, immagini fallite, filtri in
bozza, cambio zona, salvataggio condiviso, ritorno con ricerca/filtri/scroll.
Prova con dati reali a 320 e 390 px, compresi salvataggio/rimozione temporanei.
Il frontend distribuibile è rigenerato con npm run build.
