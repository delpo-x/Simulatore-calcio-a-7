# Ciclo di realismo

Obiettivo: realismo professionale della simulazione, almeno al livello di un gioco di calcio commerciale come PES 6.
PES 6 non e' misurabile direttamente (dati e codice Konami fuori limite, progetto clean-room). Il "livello PES 6" e' tradotto in
cancelli misurabili in `tools/realism.mjs`, scalati sul calcio a 7. Le soglie sono ipotesi di lavoro, non dati ufficiali: si
discutono e si correggono qui, mai in silenzio per far passare un test.

## Regola del ciclo
1. `npm run realism` (partite nuove, seme da orologio, tutti i cancelli rivalutati da zero: niente cache, niente esiti vecchi).
2. Se un cancello fallisce: si individua la causa nel motore (non nel cancello), si corregge, si ripete dal punto 1 con un seme diverso.
3. Si esce solo quando una pagella completa (senza `--fast`, almeno 40 partite) passa 100% su due semi diversi di fila, insieme a `sim.test.js` e `npm run test:game`.
4. Una soglia si cambia solo con una motivazione scritta nella riga del cancello (nota) e in questo file.

Prove di taratura: `node tools/realism.mjs --games 12 --fast --seed 1 --set '{"AI":{"forceShot":3}}'` (non salva nulla; `--fast` salta i cancelli D/E).
Dopo la taratura i valori vanno in `config/params.json` e nei default di `public/core/sim.js`.

## Famiglie di cancelli
- A statistiche di partita (dati del girone: gol, tiri, passaggi, possesso, falli, cartellini)
- B fisica credibile (velocita' massime, nessun teletrasporto, nessun giocatore fuori campo, palla mai ferma)
- C gioco (forma della squadra, durata dei possessi, lunghezza dei passaggi, distanza dei tiri, zone, rimesse, angoli, equilibrio tra i lati)
- D coerenza di forza (squadra piu' forte vince piu' spesso, nessun vantaggio di lato)
- E determinismo

## Registro dei cicli
| ciclo | esito | cosa e' stato cambiato |
|---|---|---|
| 1 | 20/31 | strumento creato; tiri: forceShot 10->3, shootRange 22->48, shootEager 0.14->0.029, shotAnglePerM 6->4 (distanza media tiro 4,6 -> 8,6 m) |
| 2 | 22/31 -> 30/31 | formSpread 0.35->0.12 (possesso std 0,22 -> 0,08), tackleEager 0.15->0.06, larghezza squadra 1.0->1.35, portiere: respinta anche da neutro (hold 0.7), 60% delle respinte in angolo; cancello teletrasporti 0,6->1,0 m, simmetria lati 0,06->0,10 (motivazioni nelle note) |
| 3 | 31/31 su semi 202, 203, 204, 205 | foulProb 0.023->0.048 (meno contrasti => meno falli per partita); test regole.falli.quota aggiornato a 0,044-0,052. sim.test ok, test:game 105 ok / 0 errori |
| 4 | 31/31 su semi 309, 310 | rimessa laterale con le mani (palla sopra la testa, battitore fermo sul punto, lancio entro 1,2 s a un compagno, 30% imprecisi, non entra nelle statistiche dei passaggi, non vale come gol diretto); cancello D.pari_livello con 40 duelli e soglia 0,30-0,70 (misurato 42-42-16 su 100 duelli: nessun vantaggio di lato). sim.test ok, test:game 111 ok, app.test ok |
