---
status: closed
type: prototype
blocked-by: []
assignee: claude (sessione corrente)
---

## Question

Quale fisica della palla usa la simulazione? Decidere: massa, resistenza dell'aria, attrito di rotolamento sull'erba, rimbalzo, velocità e altezza tipiche di passaggio rasoterra, passaggio alto e tiro. Si confrontano i valori del motore con ordini di grandezza del calcio reale; l'utente giudica se i numeri sono accettabili. Output: tabella di parametri con valori iniziali e test misurabili (per esempio "un passaggio rasoterra di 20 m arriva in X secondi"), link al prototipo.

Prototipo: `wayfinder/prototypes/ball-trajectories.mjs`.

## Resolution

L'utente ha accettato i bersagli proposti qui sotto come specifica della fisica della palla. Test di gioco: (1) passaggio rasoterra v0 = 18 m/s: 20 m in circa 1.3 s, velocità di arrivo circa 12 m/s; (2) tiro pieno: 25–32 m/s sui primi 30 m; (3) rotolamento libero: decelerazione circa 1–2 m/s²; (4) passaggio alto: atterra a 20–30 m dopo 1.2–1.6 s, con un solo rimbalzo corto. Da applicare in `public/core/sim.js` in fase di esecuzione; il prototipo `wayfinder/prototypes/ball-trajectories.mjs` è il banco di prova.

## Esito del prototipo

Con i parametri attuali (resistenza a terra 0.9/s più decelerazione 1.5 m/s²) un passaggio rasoterra da 23 m/s scende a 12.9 m/s dopo 10 m e arriva a 20 m con 1.0 m/s dopo 2.5 s: la palla rallenta troppo. Il passaggio alto da 20 m/s con vy 7 tocca terra a 25 m dopo 1.4 s e rimbalza 3 volte fino a 56 m (rimbalzi troppo lunghi). Il tiro pieno da 32 m/s resta tra 25 e 30 m/s sui primi 30 m: plausibile.

Bersagli proposti (ordini di grandezza del calcio reale, da conoscenza generale, non verificati qui): passaggio rasoterra con v0 = 18 m/s copre 20 m in circa 1.3 s arrivando a circa 12 m/s; tiro pieno tra 25 e 32 m/s; rotolamento libero con decelerazione di circa 1–2 m/s²; passaggio alto che atterra a 20–30 m dopo 1.2–1.6 s con un rimbalzo corto.
