# Verona

L'applicazione deve essere sviluppata **mobile first**, come richiesto dall'utente.

L'utente richiede un'esperienza **stile app su un'unica schermata**, non una pagina da scorrere: guscio alto quanto il viewport (`100dvh`), scheda centrale che occupa lo spazio disponibile e navigazione sempre in basso, anche sul desktop. Filtri, dettagli e informazioni si aprono in pannelli modali. Per calendari ed elenchi lunghi, far scorrere solo il contenuto interno, mantenendo visibili intestazione e navigazione.

- Progettare prima il layout per telefoni da 320–430 px; aggiungere colonne e adattamenti per tablet e desktop con breakpoint progressivi.
- Usare controlli principali con area di tocco di almeno 44 px, testo leggibile senza zoom e campi di input di almeno 16 px.
- Rispettare le aree sicure del dispositivo, evitare scorrimento orizzontale e mantenere accessibili le azioni principali.
- Affiancare sempre pulsanti e accesso da tastiera ai gesti touch. Lo swipe orizzontale non deve impedire lo scorrimento verticale.
- Verificare i flussi con dati reali, includendo stati vuoti, annullamento e persistenza delle scelte.

Il frontend distribuibile è `public/index.html`, generato da `public/calendar.template.html`, `public/calendar.js` e dai dati locali tramite `npm run build`. Modificare i sorgenti e rigenerare il file prima di consegnare.
