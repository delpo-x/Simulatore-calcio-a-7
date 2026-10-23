# Simulatore calcio a 7

Simulatore di partite di calcio a 7 (clean-room, originale): due squadre IA si affrontano, senza controllo umano. Si guarda la partita in 3D con grafica televisiva, oppure nella vista di debug, e si misura il comportamento con test numerici.

Sotto c'è una shell browser con relay WebSocket (`pes-web-shell`), lasciata com'è: non fa parte del simulatore (ora in `shell.html`).

## Online

L'app è pubblicata su GitHub Pages: https://delpo-x.github.io/Simulatore-calcio-a-7/ (aggiornata a ogni push su `main` dal workflow `.github/workflows/pages.yml`, che copia `public/` sul ramo `gh-pages`). Dal telefono si può aggiungere alla schermata Home e funziona anche offline dopo la prima apertura.

## Avvio in locale

```bash
npm install
npm start
```

Poi apri http://localhost:8080/ (app) oppure http://localhost:8080/debug.html (vista di debug). Funziona su computer e telefono.

## Guida all'app

**Menu.** Per ogni lato scegli una squadra predefinita (nomi inventati) o una tua. Puoi cambiare nome, sigla, colori di maglia, calzoncini, calzettoni e portiere, modulo e livello (8–20), poi **Salva**: la squadra resta nel browser. **Carica file squadra** legge un file JSON con giocatori e attributi (esempio: `public/app/esempio-squadra.json`). Opzioni: giocatori per squadra (solo il 7 è tarato), durata di un tempo (25 minuti è il regolamentare), seme (vuoto = casuale; stesso seme e stesse squadre = stessa partita), replay automatico dei gol. Se le maglie si somigliano, gli ospiti usano la seconda maglia.

**Partita.** In alto il tabellone (sigle, punteggio, tempo, 1T/INT/2T/FIN). In basso la regia:

| Pulsante | Tasto | Cosa fa |
|---|---|---|
| Pausa | Spazio | ferma e riprende |
| 0,5× … 16× | 1–6 | velocità |
| +1′ | | avanza di un minuto di gioco |
| Fine | | simula il resto della partita |
| TV / Alto / Segui / Porta | C | telecamera |
| Dati | S | cronaca, statistiche con mappa dei tiri, voti, formazioni, tattica |
| Audio | M | pubblico, fischio, calci, esultanza (sintetizzati, nessun file audio) |
| Schermo intero | F | |
| | R | replay dell'ultimo gol |
| | Esc | chiude replay o pannello |

Gol, cartellini, rigori, fuorigioco, intervallo e fine compaiono come grafiche in sovrimpressione. La telecronaca testuale (tiri, parate, assist, lanci, recuperi, ingressi in area, falli, angoli; circa 3 frasi al minuto) scorre nella cronaca e come sottotitolo sopra la regia; si attiva o disattiva nella scheda Cronaca. Dopo ogni gol parte il replay (se attivo e a velocità fino a 4×); nella cronaca si tocca un gol per rivederlo. A fine partita: risultato, marcatori, migliore in campo, mappa dei tiri, statistiche principali, seme, **Rivedi i gol**, **Pagelle**, **Rigioca**, **Menu**.

**Tattica.** Nella scheda Tattica del pannello Dati, per ciascuna squadra e anche a partita in corso: modulo, pressing (basso/medio/alto), linea difensiva (bassa/media/alta), ampiezza e ritmo. Le squadre restano guidate dall'IA; cambia solo la disposizione. Un cambio di modulo riassegna i posti in ordine (portiere, difesa, centrocampo, attacco) e finisce nella cronaca. Sono scelte di gioco, non tarate: le statistiche di riferimento valgono con i valori predefiniti (pressing medio, linea media, ampiezza e ritmo normali).

**Voti e mappa dei tiri.** Ogni giocatore ha un voto da 4 a 10 (a mezzi punti), provvisorio durante la partita: base 6, +1 il primo gol e +0,7 i successivi, +0,6 l'assist (ultimo passaggio riuscito al marcatore entro 8 s), tiri in porta, passaggi (riusciti contro persi, a saldo zero intorno al 70%), palloni recuperati rispetto alla media, falli e cartellini in negativo, ±0,3 per vittoria o sconfitta. Il portiere guadagna con le parate (presa entro 2,5 s da un tiro in porta) e perde con i gol subiti; porta inviolata +0,5 al portiere e +0,3 ai difensori. Il migliore in campo è il voto più alto (a parità, gol e assist). La mappa mostra da dove è partito ogni tiro: pieno = gol, anello = in porta, sbiadito = fuori. I gol nati da un passaggio o da un tocco compaiono sulla mappa ma non tra i tiri, come nel registratore. I pesi sono scelte del progetto, non tarate su dati reali.

Le statistiche dell'app (tiri, tiri in porta, passaggi, possesso) si calcolano come nel registratore `tools/lib/matches.mjs`.

**Torneo.** Dal menu, **Torneo**: scegli da 3 a 8 squadre (predefinite o salvate), il formato (campionato solo andata, campionato andata e ritorno, coppa a eliminazione diretta) e la durata del tempo. Il torneo ha calendario (o tabellone), classifica (3 punti per vittoria, a parità differenza reti, gol fatti, nome), marcatori e media voti, e resta nel browser. Ogni partita si può **guardare** (poi si torna al torneo) o **simulare** senza grafica in un worker; ci sono anche **Simula giornata** e **Simula tutto**. Lo stesso torneo dà lo stesso risultato guardando o simulando. In coppa, un pareggio si decide ai rigori: la lotteria usa un modello statistico del progetto (circa 78% di rigori segnati), non la fisica della partita; con un numero di squadre non potenza di 2 le prime del sorteggio passano il primo turno.

## Vista di debug

Partita IA contro IA con campo 3D. Dalla barra in alto: numero di giocatori (5–11, il 7 è il caso principale), seme, velocità (1×, 3×, 10×, 30×), Riavvia, Pausa, +60 s. In basso i contatori: falli, gialli, azzurri, rossi, retropassaggi, ostruzioni, gioco pericoloso, trattenuta del portiere, proteste, fuorigioco. In alto il punteggio e il tempo; compare INDIRETTA quando la punizione è indiretta.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run test:game` | Test di gioco (micro e macro). Scrive `reports/test-game.md`. Richiede alcuni minuti. Opzione `-- --full` per la versione completa. |
| `npm run matches -- --games 200 --players 7` | Registratore: gioca partite IA contro IA e stampa le statistiche (gol, tiri, passaggi, possesso, falli, cartellini). |
| `npm run stress -- --games 40` | Prova di robustezza: partite con semi casuali a 5, 6, 7, 8, 9, 10 e 11 giocatori; segnala valori non finiti, giocatori fuori dal campo, palla ferma oltre 20 s e partite che non finiscono. Esce con 1 se trova problemi. |
| `node public/core/sim.test.js` | Test della simulazione. |
| `npm run test:app` | Test dei moduli dell'app senza browser (statistiche per giocatore, voti, partita senza grafica). |
| `npm run realism` | Pagella di realismo (31 cancelli: statistiche, fisica, gioco, coerenza di forza, determinismo). Semi nuovi a ogni giro; scrive `reports/realism.md`. `-- --fast` salta i cancelli lenti, `-- --seed N` fissa il seme. |
| `npm run realism:fifa10` | Come sopra con il profilo "FIFA 10" (41 cancelli, soglie scalate sul 7 vs 7). Le soglie sono ipotesi del progetto, nessun dato di terzi. Vedi `wayfinder/LOOP.md`. |
| `npm test` | Test del relay. |
| `npm run test:core` | Test della simulazione (determinismo, partite IA contro IA). |
| `npm run check` | Tutto in sequenza: relay, simulazione, app, test di gioco e prova di robustezza ridotta. È ciò che esegue la CI. |

## Regole modellate (calcio a 7)

Campo 50 × 30 m, porta 6 × 2 m, 2 tempi da 25 minuti sul cronometro, senza sostituzioni. Come in FIFA, il cronometro corre più veloce del tempo di gioco: `partita.passo` = 0,1 (in `config/params.json`), quindi 50 minuti di tabellone sono 5 minuti reali a velocità 1×. Il gioco è tarato per essere denso in quei 5 minuti (circa 5 gol, 20+ tiri, 9–10 angoli, 6 falli).

- Calcio d'inizio (anche dopo ogni gol e a inizio ripresa, intervallo di 3 s): il battitore passa a un compagno.
- Falli, ammonizione, espulsione, rigore, punizione, angolo, rinvio, rimessa.
- Cartellino azzurro: 5 minuti fuori, poi rientro. Nasce da un fallo o da proteste.
- Punizione indiretta per: retropassaggio al portiere, portiere che trattiene la palla oltre 6 s, gioco pericoloso (avversario addosso al portiere in possesso), ostruzione, fuorigioco.
- Fuorigioco solo nell'area piccola avversaria (6 × 12 m): valore scelto dal progetto, non verificato su un regolamento ufficiale. Si disattiva con `regole.fuorigioco_attivo` = 0.

Il regolamento CSI ufficiale non è stato trovato: durata dell'azzurro, retropassaggio e rinvio nell'area seguono le scelte del progetto.

## Integrazione continua

`.github/workflows/test.yml` esegue a ogni push `npm run check` (relay, simulazione, app, `npm run test:game` e una prova di robustezza ridotta); il rapporto dei test viene salvato come artefatto.

## Parametri e taratura

Tutti i valori regolabili stanno in `config/params.json` (letti da `npm run test:game` e `npm run matches`; i valori in `public/core/sim.js` sono i predefiniti del browser). Solo il formato a 7 è tarato: gli altri (5–11) funzionano ma i numeri sono indicativi (a 5 e 6 giocatori molti gol, a 10 e 11 pochi). I bersagli statistici sono in `config/targets.json`: gol 4–6, tiri in porta 9–13 (tiri totali 20–30, ipotesi), passaggi 67–73%, possesso ~50%, ~8 falli e ~1 giallo a partita.

## Squadre e attributi

Giocatori con attributi 1–20 (velocità, passaggi, finalizzazione, portiere, ecc.), ruoli e piede. File squadra: vedi `public/core/team.js` (`readTeam`). Senza file, i giocatori sono neutri.

## Struttura

- `public/core/`: motore (`sim.js`, `team.js`, `params.js`, `render.js`).
- `public/index.html` e `public/app/`: app (menu, torneo `tournament.js` e `tourui.js`, `worker.js`, grafica 3D `render3d.js`, statistiche e voti `stats.js`, mappa dei tiri e pagelle `views.js`, partita senza grafica `headless.js`, replay `replay.js`, squadre `teams.js`, audio `audio.js`, telecronaca `commentary.js`, `main.js`).
- `public/debug.html`: vista di debug.
- `tests/game/*.json` e `tools/`: test dichiarativi e registratore di partite.
- `wayfinder/`: mappa, ticket e decisioni di progetto (`MAP.md`; glossario in `CONTEXT.md`).
- `server/`, `public/js/`, `public/shell.html`: shell e relay (non usati dal simulatore).

## Relay (shell)

JSON per i messaggi di controllo (nick, list, create, join, leave, chat); i frame binari sono inoltrati agli altri membri della stanza con un prefisso di 1 byte per lo slot del mittente. Stanze vuote eliminate dopo 15 minuti, massimo 4 giocatori.
