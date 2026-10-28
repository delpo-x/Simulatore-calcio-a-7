# Piano "AAA": dal simulatore a un prodotto da console

Audit del 28/10/2026 sullo stato attuale (Three.js r170, renderer procedurale, audio sintetizzato).

## Dove siamo

| Area | Oggi | Livello AAA |
|---|---|---|
| Giocatori | primitive fuse, animazione procedurale per rotazioni | mesh con scheletro, animazioni catturate e fuse tra loro, piedi piantati a terra |
| Luce e immagine | luce diretta + emisfero, ACES, ombre PCF | post-processing (bloom, occlusione ambientale, profondita' di campo nei replay, color grading), riflessi |
| Stadio | tribune e pubblico come texture piatte | pubblico in 3D che reagisce, stadio modellato, LOD |
| Camera e regia | TV, tattica, dal fondo; replay del gol | regia televisiva con stacchi, inquadrature ravvicinate, replay da piu' angoli, slow motion |
| Presentazione | HUD essenziale, menu a schede | intro pre-partita, ingresso squadre, grafiche animate (formazioni, gol, statistiche), esultanze |
| Audio | sintesi Web Audio | registrazioni reali di pubblico e cori, impatti realistici, telecronaca parlata |
| Prestazioni | nessun budget, nessun preset | 60 fps stabili, preset di qualita', misure automatiche |

Limite onesto: senza motion capture, modellatori e registrazioni non si arriva a un gioco AAA del 2026. Si puo' arrivare a qualcosa che *si percepisce* AAA (immagine, regia, ritmo, suono): questo e' il piano.

## Fasi (una alla volta, verifica a schermo, conferma)

### A. Fondamenta: prestazioni e misure
- Contatore fps, tempo per frame e draw call in debug; budget 60 fps a 1080p su GPU entry (GT 1030).
- Preset di qualita' (Basso/Medio/Alto/Ultra): risoluzione interna, ombre, effetti, densita' di pioggia e neve.
- Risoluzione dinamica: se il frame supera il budget, scende la risoluzione interna.

### B. Immagine
- Post-processing: bloom su fari e riflessi, SSAO leggero, vignettatura, color grading per meteo e ora, antialiasing (SMAA/FXAA).
- Erba vera: fili in instancing vicino alla camera, segni del tagliaerba piu' netti, normal map.
- Materiali PBR per maglie (tessuto), pelle e palla; riflessi ambientali dal cielo.

### C. Giocatori e animazione
- Corpo piu' umano: proporzioni, mesh levigata, piu' varieta' di volti e capelli.
- Animazione: fusione tra camminata, corsa e scatto per velocita'; piedi piantati (IK delle gambe) contro lo scivolamento; caricamento e accompagnamento dei calci; corsa in curva con inclinazione.
- Esultanze dopo il gol (scivolata in ginocchio, abbraccio di squadra), proteste, saluto finale.

### D. Regia televisiva
- Camera principale che anticipa l'azione e stringe sul tiro.
- Stacchi automatici: primi piani su falli, cartellini, sostituzioni e calci piazzati.
- Replay da 3 angoli con slow motion e profondita' di campo; replay anche delle occasioni, non solo dei gol.

### E. Presentazione
- Intro: panoramica dello stadio, ingresso delle squadre, formazioni animate, fischio d'inizio.
- Grafiche animate: tabellone che entra, banner del gol con il marcatore, statistiche all'intervallo e a fine partita.
- Menu con transizioni e anteprima 3D delle maglie.

### F. Audio
- Pubblico da registrazioni a licenza libera, a strati (brusio, cori, applausi, fischi, boati), che reagisce all'azione.
- Calci, rimbalzi, pali e contrasti da campioni reali.
- Telecronaca parlata per i momenti chiave (frasi registrate o sintesi vocale).

### G. Stadio e pubblico
- Pubblico 3D in instancing con animazioni (in piedi sui gol, sciarpe), bandiere.
- Stadio modellato, panchine con staff, raccattapalle, arbitro e assistenti.

## Ordine consigliato
A, B, D, C, E, F, G. Prima le prestazioni, perche' ogni fase dopo costa frame; poi immagine e regia, che danno il salto percepito piu' grande per lavoro speso.
