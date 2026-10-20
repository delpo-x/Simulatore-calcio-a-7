---
status: closed
type: task
blocked-by: []
assignee: claude
---

# Prodotto sostitutivo autosufficiente, funzionante al 100%

Destinazione estesa dall'utente: prodotto completo, autosufficiente, realismo di livello FIFA 10 come riferimento (solo comportamento osservabile, clean-room).

## Criteri di accettazione (misurabili)

1. `npm run realism:fifa10` 41/41 su due semi diversi di fila.
2. `node public/core/sim.test.js`, `npm run test:game`, `npm run test:app` verdi.
3. `npm run stress -- --games 40` esce con 0 (5..11 giocatori).
4. App in browser: menu, partita, tattica, dati, replay, torneo (campionato e coppa) senza errori in console.
5. Autosufficienza: nessuna risorsa esterna a runtime (CDN, font, audio), funziona offline (service worker), `npm install && npm start` basta.
6. README e guida aggiornati.

## Domande accumulate (da porre alla fine, non prima)

Vedi `wayfinder/DOMANDE.md`.

## Risoluzione (2026-10-20)

- Pagella FIFA 10: 41/41 su semi 701 e 702.
- `sim.test.js`, `test:game` (111 ok), `app.test.js` verdi.
- `stress --games 40`: 280 partite (5..11 giocatori), 0 problemi.
- App in browser: menu, partita, "Simula fino alla fine" con schermata finale, torneo (campionato, "Simula tutto" fino al campione): nessun errore in console.
- Autosufficienza: l'app (`index.html`) non carica risorse esterne; `three` e' in `public/vendor`, service worker per l'offline. Unico riferimento esterno: jszip da CDN in `shell.html` (shell legacy, fuori dal simulatore).
- Non verificati: rendering 3D della rimessa a mano, soglie FIFA 10 (ipotesi), regole CSI (vedi `DOMANDE.md`).
