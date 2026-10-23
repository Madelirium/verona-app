# Identità Verona in Tasca — prova locale

Integrati i materiali forniti dall’utente, mantenendo i colori originali rosso, nero e bianco. La palette pietra e blu dell’interfaccia rimane invariata.

- Intestazione: logo orizzontale senza payoff, ricavato da `Immagine ChatGPT 23 ott 2026, 20_50_29-2.png`. WebP da circa 19 KB.
- Icone: simbolo bianco su quadrato rosso da `Immagine ChatGPT 23 ott 2026, 20_50_31-4.png`, in formati 32, 180, 192 e 512 px.
- Condivisione: immagini originali degli inviti a Briscola e Forza 4, adattate a 1200 × 630 px, circa 200 KB ciascuna.
- Anteprima generale: logo orizzontale con payoff su fondo bianco.

Gli originali in Downloads non sono stati modificati. I derivati sono in `public/assets/brand/`.

## Collegamenti e distribuzione

`npm run build` genera anche il manifest e le pagine statiche `/inviti/briscola/` e `/inviti/forza4/`. Queste espongono metadati Open Graph dedicati e rimandano all’app conservando il codice stanza. I vecchi link con parametri `briscola` e `forza4` continuano a funzionare. Nessun ingresso automatico nella partita.

Il workflow Pages include i nuovi file. Questa prova non è stata pubblicata: le anteprime social con URL assoluti su veronaintasca.it saranno disponibili dopo la pubblicazione e dipenderanno anche dalla cache della piattaforma di condivisione.

Il manifest configura nome, colori e icone; non introduce un service worker né il funzionamento offline.

## Verifica

- Build completata, 430 test superati.
- Controllo visivo in browser a 390 × 844 e 320 × 740 px, home e calendario.
- Invito Forza 4 locale: reindirizzamento alla schermata di ingresso con codice precompilato verificato, senza inviare richieste di ingresso.
- Test automatici di entrambi gli inviti, percorsi base locale e GitHub Pages, codici non validi, manifest, dimensioni e peso degli asset.
