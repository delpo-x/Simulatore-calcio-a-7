# Simulatore calcio a 7

Simulatore di partite di calcio a 7 (clean-room, originale): due squadre IA si affrontano, senza controllo umano. Si osserva la partita in una vista 3D di debug e si misura il comportamento con test numerici.

Sotto c'è una shell browser con relay WebSocket (`pes-web-shell`), lasciata com'è: non fa parte del simulatore.

## Avvio

```bash
npm install
npm start
```

Poi apri http://localhost:8080/debug.html.

## Vista di debug

Partita IA contro IA con campo 3D. Dalla barra in alto: numero di giocatori (5–11, il 7 è il caso principale), seme, velocità (1×, 3×, 10×, 30×), Riavvia, Pausa, +60 s. In basso i contatori: falli, gialli, azzurri, rossi, retropassaggi, ostruzioni, gioco pericoloso, trattenuta del portiere, proteste, fuorigioco. In alto il punteggio e il tempo; compare INDIRETTA quando la punizione è indiretta.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run test:game` | Test di gioco (micro e macro). Scrive `reports/test-game.md`. Richiede alcuni minuti. Opzione `-- --full` per la versione completa. |
| `npm run matches -- --games 200 --players 7` | Registratore: gioca partite IA contro IA e stampa le statistiche (gol, tiri, passaggi, possesso, falli, cartellini). |
| `npm run stress -- --games 40` | Prova di robustezza: partite con semi casuali a 5, 6, 7, 8, 9, 10 e 11 giocatori; segnala valori non finiti, giocatori fuori dal campo, palla ferma oltre 20 s e partite che non finiscono. Esce con 1 se trova problemi. |
| `node public/core/sim.test.js` | Test della simulazione. |
| `npm test` | Test del relay. |

## Regole modellate (calcio a 7)

Campo 50 × 30 m, porta 6 × 2 m, 2 tempi da 25 minuti, senza sostituzioni.

- Falli, ammonizione, espulsione, rigore, punizione, angolo, rinvio, rimessa.
- Cartellino azzurro: 5 minuti fuori, poi rientro. Nasce da un fallo o da proteste.
- Punizione indiretta per: retropassaggio al portiere, portiere che trattiene la palla oltre 6 s, gioco pericoloso (avversario addosso al portiere in possesso), ostruzione, fuorigioco.
- Fuorigioco solo nell'area piccola avversaria (6 × 12 m): valore scelto dal progetto, non verificato su un regolamento ufficiale. Si disattiva con `regole.fuorigioco_attivo` = 0.

Il regolamento CSI ufficiale non è stato trovato: durata dell'azzurro, retropassaggio e rinvio nell'area seguono le scelte del progetto.

## Integrazione continua

`.github/workflows/test.yml` esegue a ogni push i test del relay, della simulazione, `npm run test:game` e una prova di robustezza ridotta; il rapporto dei test viene salvato come artefatto.

## Parametri e taratura

Tutti i valori regolabili stanno in `config/params.json` (letti da `npm run test:game` e `npm run matches`; i valori in `public/core/sim.js` sono i predefiniti del browser). Solo il formato a 7 è tarato: gli altri (5–11) funzionano ma i numeri sono indicativi (a 5 e 6 giocatori molti gol, a 10 e 11 pochi). I bersagli statistici sono in `config/targets.json`: gol 4–6, tiri in porta 9–13, passaggi 67–73%, possesso ~50%, ~8 falli e ~1 giallo a partita.

## Squadre e attributi

Giocatori con attributi 1–20 (velocità, passaggi, finalizzazione, portiere, ecc.), ruoli e piede. File squadra: vedi `public/core/team.js` (`readTeam`). Senza file, i giocatori sono neutri.

## Struttura

- `public/core/`: motore (`sim.js`, `team.js`, `params.js`, `render.js`).
- `public/debug.html`: vista di debug.
- `tests/game/*.json` e `tools/`: test dichiarativi e registratore di partite.
- `wayfinder/`: mappa, ticket e decisioni di progetto (`MAP.md`; glossario in `CONTEXT.md`).
- `server/`, `public/js/`: shell e relay (non usati dal simulatore).

## Relay (shell)

JSON per i messaggi di controllo (nick, list, create, join, leave, chat); i frame binari sono inoltrati agli altri membri della stanza con un prefisso di 1 byte per lo slot del mittente. Stanze vuote eliminate dopo 15 minuti, massimo 4 giocatori.
