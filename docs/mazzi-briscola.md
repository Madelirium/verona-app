# Scelta personale del mazzo

Il pulsante **Mazzo**, nella sala giochi e al tavolo Briscola, apre due anteprime:
Essenziale (le carte precedenti) e Veneto illustrato (il set fornito dall'utente).
La selezione viene applicata solo con **Usa questo mazzo**. Annulla, chiusura ed
Escape lasciano la scelta precedente. Si può cambiare anche durante una partita.

La preferenza è locale al browser (`verona-briscola-deck-v1`); non modifica
stanza, turni, carte ricevute o mazzo degli altri giocatori. Senza accesso alla
memoria resta valida per la visita corrente. Se un'immagine non si carica viene
mostrata la corrispondente carta Essenziale, con lo stesso nome accessibile.

Le 40 immagini WebP sono ritagliate dai quattro fogli dello ZIP
`carte_briscola_venete_set_completo.zip`, fornito dall'utente. Preparazione:
`python scripts/prepare-briscola-deck.py percorso-allo-zip` (richiede Pillow).
L'archivio non contiene indicazioni di licenza; non si attribuisce una licenza
o un autore non verificati. I disegni originali sono mantenuti: il sette di
coppe del foglio fornito raffigura cinque coppe, per questo i valori e i semi
sono sempre identificati anche da un'etichetta esplicita.

Le immagini sono servite dal server locale e incluse nella cartella assets
pubblicata da Pages. Il worker conserva offline quelle già visualizzate;
le carte non viste richiedono connessione o usano la grafica Essenziale.
