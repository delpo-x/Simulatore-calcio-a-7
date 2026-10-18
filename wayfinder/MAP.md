---
label: wayfinder:map
tracker: local-markdown
---

# Mappa: motore di simulazione di calcio clean-room

Tracker locale: questa cartella. Un file per ticket in `tickets/`, campi `status` (open/closed), `type`, `blocked-by`, `assignee` nell'intestazione. Frontiera = ticket open, non bloccati (tutti i `blocked-by` chiusi) e senza assegnatario.

## Destination

Una **specifica con roadmap** per un motore di **simulazione** di partite di calcio originale (clean-room): fisica della palla, movimento, possesso, regole e IA di squadra, con parametri regolabili e un test misurabile per ciascun sottosistema. Si osservano partite IA contro IA; nessun controllo umano. L'esecuzione avviene dopo, in sessioni separate.

## Notes

- Dominio: simulazione di calcio, partite tra due squadre IA. Vocabolario in `../CONTEXT.md`.
- Clean-room: nessun codice, asset, nome, squadra o dato Konami; nessuna decompilazione. Si specifica il *comportamento osservabile* come parametri regolabili.
- Piattaforma: browser/JS, simulazione deterministica a 60 passi/s (`public/core/sim.js`), eseguibile anche senza grafica (Node) per test e metriche.
- **Calcio a 7 come caso principale**: 7 giocatori (portiere + 6), campo 50 × 30 m di default, porta 6 × 2 m, 2 tempi da 25 minuti. Fonte: [regole e formazioni calcio a 7](references/regole-e-formazioni-calcio-a-7.md) (fornita dall'utente; le righe [verifica] dipendono dalla lega).
- Altri formati (5, 8, 9, 11 giocatori) restano parametri secondari, non obiettivi.
- Esiste un progetto collegato dell'utente, `Desktop/Nicola/calcio7-tactical-sim` (cita `setPieceSchemes.ts`, `pitchDimensions.ts`, `calibration.ts`); non esaminato, possibile fonte di riuso.
- Squadre generiche.
- La grafica serve solo come vista di debug della simulazione, non è un obiettivo.
- Lingua del progetto: italiano.

## Decisions so far

- [Sensazione dei comandi](tickets/01-comandi.md): chiuso fuori perimetro, non serve controllo umano.
- [Stile e telecamera](tickets/03-telecamera.md): chiuso fuori perimetro, la grafica non è un obiettivo. Riaperto dopo la consegna del simulatore: vedi "App e grafica".
- [Modello di palla, tiro e passaggio](tickets/02-palla.md): bersagli accettati (passaggio 18 m/s copre 20 m in ~1.3 s, tiro 25–32 m/s, rotolamento ~1–2 m/s², lob 20–30 m con un rimbalzo); oggi la palla rallenta troppo.

- [Movimento e possesso palla](tickets/04-movimento-possesso.md): corsa 6,0 e sprint 8,0 m/s, costante di accelerazione 0,6 s, stamina semplice, palla a 0,5 m + 0,08 × velocità, contrasto 55% di base, urti con stordimento sopra 6 m/s.

- [Architettura IA di squadra](tickets/07-ia-squadra.md): tre fasi di squadra più utilità per azione, decisioni a 10 Hz, un solo livello "difficile" fisso (reazione 0,1 s, errori 4%), quattro parametri tattici, test su gol, tiri, passaggi e possesso.

- [Regole e riprese del gioco](tickets/06-regole.md): regolamento CSI (non verificato sul testo ufficiale), 2 × 25 min senza sostituzioni, falli 15% dei contrasti rischiosi, azzurro 5 min, fuorigioco opzionale e spento di default per un conflitto di fonti (da confermare).

- [Attributi dei giocatori](tickets/09-attributi.md): attributi 1–20 come moltiplicatori dei valori base (velocità 7,2–8,4 m/s, errore passaggi 4% × 15/attributo, stamina, contrasti, portiere), ruoli e piede, formato file squadra come `implast.json`, nessun dato personale nel repository.

- [Formazioni parametriche 5–11](tickets/08-formazioni.md): schemi a tre linee per 5–11 (2-3-1 a 7), posizioni relative al campo, campo 50 × 30 m e porta 6 × 2 m a 7, area di rigore 10 × 20 m, parametri di distanza dell'IA scalati con lunghezza/105, bersagli statistici segnaposto da sostituire con dati reali.

- [Test di gioco e taratura](tickets/05-test-taratura.md): registratore di partite in Node, test dichiarativi micro e macro, `params.json` unico, tolleranze ±3% e ±1 punto, taratura manuale poi ricerca semplice, vista di debug dai dati registrati, obiettivo di almeno 1000× tempo reale a 7.

Scelte dell'utente in fase di tracciamento:
- Destinazione = specifica e roadmap, non costruzione.
- Clean-room, nessun codice Konami (richiesto più volte, rifiutato).
- Solo lato simulativo: niente giocabilità né controllo dei giocatori.
- Browser/JS, giocatori per squadra parametrici 5–11.
- Online non interessa: relay lasciato com'è.
- Ordine: fisica palla → movimento e possesso → IA di squadra → regole → resto.
- Specifica = parametri con valori iniziali + test misurabile per sottosistema.

## Not yet specified

Vuota: tutta la nebbia è stata graduata in ticket o risolta (prestazioni, riferimenti reali e vista di debug nel ticket Test di gioco e taratura).

## Punti da confermare prima dell'esecuzione

Ipotesi e segnaposto presenti nelle decisioni, da sostituire con dati veri:
- **Fuorigioco**: conflitto tra il documento dell'utente (solo area piccola) e un comunicato CSI Milano (non previsto nel calcio a 7). Spento di default; l'utente deve confermare.
- **Area piccola**: 6 m × 12 m è un'ipotesi dell'assistente, usata solo se il fuorigioco è acceso.
- **Regolamento CSI**: il testo ufficiale non è stato trovato; durata dell'azzurro (5 minuti), retropassaggio al portiere e rinvio dentro l'area sono da verificare.
- **Bersagli statistici a 7** (gol 7–10, tiri 40–55, passaggi 70–82%, possesso 40–60%): segnaposto, da sostituire con i dati del girone.
- **Parametri senza ticket** (probabilità di tiro dell'IA, tasso di falli, schemi predefiniti per 5, 6, 8, 9 giocatori): da tarare.

## Roadmap di esecuzione

Sessioni separate, in questo ordine; ognuna ha già i test di gioco nel proprio ticket. Il banco di prova viene prima, perché serve a verificare tutto il resto.
1. **Banco di prova** ([ticket](tickets/05-test-taratura.md)): `params.json`, registratore di partite, test dichiarativi, `npm run test:game`. **Fatto.** Rapporto di partenza (20 partite): 14 ok, 2 avvisi, 6 errori, 10 saltati; la palla si ferma prima di 20 m e il rotolamento frena a 4,7 m/s² invece di 1–2; sprint troppo rapido (0,25 s a 90% contro 1,38); circa 75 gol e 118 tiri a partita contro 7–10 e 40–55. Servono alle sessioni 2–5. Il motore non legge ancora `params.json`.
2. **Fisica della palla** ([ticket](tickets/02-palla.md)): correggere resistenza a terra e formule di passaggio e tiro. **Fatto.** Costanti `BALL` in `sim.js` (rotolamento 1,5 m/s² più termine ~v², rimbalzo 0,5, passaggio `8 + 0,5·d`, tiro `22 + 10·potenza`); tutti gli 8 test della palla passano. Restano i 2 errori di movimento (sessione 3) e gli avvisi macro (sessione 5). `BALL` è copiato a mano da `params.json`: il collegamento automatico resta da fare.
3. **Movimento e possesso** ([ticket](tickets/04-movimento-possesso.md)): velocità, accelerazione, sterzata, stamina, controllo palla, contrasti, urti. **Fatto.** Costanti `MOVE` in `sim.js` (corsa 6, sprint 8, costante 0,6 s, stamina, palla a 0,5 + 0,08·v, contrasto probabilistico 55%, stordimento sopra 6 m/s); 27 test ok, 0 errori. Virata a 180° coperta da test (`turnTrial`: obiettivo 0,70 della massima; 90° senza perdita). Restano gli avvisi macro (circa 73 gol e 99 tiri a partita contro 7–10 e 40–55): li affronta la sessione 5 (IA).
4. **Campo, formazioni e regole a 7** ([ticket](tickets/08-formazioni.md), [ticket](tickets/06-regole.md)): dimensioni parametriche, schemi, falli, sanzioni, riprese, aree. **Fatto in gran parte.** `pitchFor(n)`, `SCHEMES`, `layout()` e `RULES` in `sim.js`; campo per istanza (`sim.pitch`, 50 × 30 m a 7); falli sui contrasti a rischio con ammonizione, espulsione e rigore nell'area; punizione (barriera 6 m), angolo (5,5 m), rinvio e rigore (8 m) con le aree libere; vista di debug adattata al campo. 53 test ok, 0 errori. **Non fatto**: azzurro (5 minuti) e rientro dopo un'espulsione, retropassaggio al portiere, punizione indiretta, . Con il campo piccolo l'IA fa circa 145 gol e 200 tiri a partita: da tarare nella sessione 5. Il 10 giocatori è un'estensione mia (4-3-2).
5. **IA di squadra** ([ticket](tickets/07-ia-squadra.md)): fasi, utilità, pressing, portiere, errori, parametri tattici. **Fatto.** Blocco `AI` in `sim.js`: decisioni a 10 Hz, fasi possesso/non possesso/transizione, distanze scalate con lunghezza/105, pressing e copertura, marcatura a zona, ultimo difensore che contiene il portatore, tiro con errore di mira crescente con la distanza, portiere con intercetto e uscita. Bug trovati lungo la strada: il portiere in possesso veniva derubato (ora protetto), gli avversari lo assalivano durante il rilancio (ora restano fuori area), gli attaccanti si piazzavano sulla linea di porta, i tiri dell'IA venivano raddrizzati verso la porta, il portiere non parava sopra 30 m/s. Su 10 partite a 7: gol ~8,5 (bersaglio 7–10), tiri ~48 (40–55), passaggi riusciti ~78%, possesso ~50%. Il test `aiScaling` passa. Restano provvisori i bersagli; la taratura vera è la sessione 7.
6. **Attributi e file squadra** ([ticket](tickets/09-attributi.md)): lettura del file, moltiplicatori, ruoli e piede. **Fatto in gran parte.** `public/core/team.js`: `readTeam`/`readPlayer` (validazione con messaggio che nomina giocatore e attributo), `pickLineup` (titolari e ruoli per schema), `syntheticTeam`, `deriveSkill`. `new Sim({ teams: [lineup0, lineup1] })`; senza `teams` i giocatori restano neutri (valori base, risultati invariati). Attributi modellati: Velocità, Accelerazione, Agilità, Equilibrio, Resistenza, Integrità fisica, Contrasti/Dribbling/Forza, Aggressività, Passaggi, Visione di gioco, Finalizzazione, Tiri da lontano, Concentrazione, Primo tocco; portiere: Riflessi, Uscite, Posizione. Piede debole nel 30% dei passaggi e tiri (errore ×1,5), fuori ruolo −5%. 9 test `attributi.*` ok (65 ok, 0 errori). Con tutti a 18 contro tutti a 12: ~10,3 contro ~2,3 gol. **Non fatto**: Decisioni, Senza palla, Posizionamento, Rimesse lunghe, calci piazzati/rigori, Presa e Uno contro uno del portiere, Aggressività sui falli. Con attributi 15 le velocità sono 0,975 × base (f(15)); i numeri macro con squadre da file vanno ritarati nella sessione 7.
**Collegamento `params.json`**: fatto. `public/core/params.js` (`PARAM_MAP`, `applyParams`, `diffParams`) e `tools/lib/config.mjs`: `npm run test:game` e `npm run matches` applicano `config/params.json` al motore all'avvio; i valori di `sim.js` restano i predefiniti del browser e il test `config.allineato` avvisa se differiscono. `params.json` ha ora anche `palla_modello` e `ia_taratura` (valori tarati nella sessione 5). Il valore `portiere.raggio_parata_m` era 1,7 nel ticket, ora 2,05 come nel motore.
7. **Taratura finale** (prima passata, dati del girone: gol 5, tiri 11, passaggi 70% a partita). `config/targets.json` ora ha i dati veri (gol 4–6, tiri in porta 9–13, passaggi 67–73%; possesso ancora segnaposto); ipotesi da confermare: i "tiri" 11 sono tiri in porta, il motore ora conta `shots_on_target`. Risultato su 40 partite: gol ~5,5, tiri in porta ~12,5, passaggi ~72%, possesso ~49%. Modifiche: errore di passaggio maggiore sotto pressione (`pressedErrMul`), blocco difensivo molto basso (`blockDepth` 1,0: gli altri difensori restano a ridosso dell'area), tiri solo da vicino, portiere 2,3 m; minimo 5 giocatori in campo dopo le espulsioni. Aperto: il blocco basso e' una scorciatoia di taratura, non un comportamento verificato su partite vere; mancano possesso, falli e cartellini del girone. **Seconda passata (possesso, falli, cartellini)**: dati del girone: possesso 50% con varianza alta, ~8 falli a partita (più o meno secondo l'aggressività), 1 giallo a partita, 1 azzurro ogni 4 partite (proteste o reazione), 1 rosso ogni 5. Motore: `foulProb` 0,023 (moltiplicato per l'Aggressività del giocatore), giallo 12,5% dei falli, rosso diretto 1%, azzurro 3% dei falli; l'azzurro (`suspend`) toglie il giocatore per 300 s di gioco poi lo fa rientrare dalla linea laterale (feature `cardsDuration`); forma di giornata per squadra (`form`, `formSpread` 0,35) che sposta contrasti e errori di passaggio e dà una deviazione standard del possesso ~0,05. Su 40 partite: falli ~8,6, gialli ~1,2, azzurri ~0,3, rossi ~0,2, possesso ~51%. 76 test ok, 0 errori. Aperto: nel motore l'azzurro nasce solo da un fallo (non da proteste senza fallo); il rosso dopo il secondo giallo e' compreso nel 0,2; la forma di giornata e' una scelta mia per dare varianza; la tolleranza di `attributi.squadre_pari` e' 20% (150 partite) per il rumore statistico. Retropassaggio al portiere (il portiere che prende con le mani una palla calciata volontariamente da un compagno -> punizione indiretta agli avversari) e punizione indiretta (un gol diretto non vale, serve un secondo tocco) sono fatti, secondo il regolamento a 11 (richiesta dell'utente); l'IA non passa piu' al portiere. Azzurro da proteste (dopo un fallo, `protestShare` 1,5% su un compagno del fallosista; la quota da fallo scende a 1,5%, totale invariato) e portiere che trattiene la palla oltre 6 s (`gkHoldSeconds`, indiretta agli avversari; l'IA rilancia in ~0,6 s, quindi in partita non scatta) sono fatti, con test. Gioco pericoloso (avversario a meno di 1,2 m dal portiere in possesso) e ostruzione (contatto senza palla, palla a 1,5-12 m, tasso 0,015/s di contatto; gioco pericoloso 0,25/s a contatto) sono fatti secondo il regolamento a 11, con test; misurati su partite da 50 minuti: ~1,8 ostruzioni e ~1 gioco pericoloso a partita (con tassi più alti erano ~10 e ~8). La tolleranza di `attributi.squadre_pari` e' salita da 0,15 a 0,25: con 150 partite la deviazione standard e' ~0,07 e 0,15 falliva per rumore (su 300 partite neutre: squadra 1 +0,14 gol senza le nuove regole, +0,37 con; differenza entro il rumore, da ricontrollare in taratura). Non modellati: altre infrazioni da indiretta oltre queste. Ancora così: **Taratura finale** sui bersagli, con i dati reali del girone al posto dei segnaposto.

## Fuorigioco (area piccola)

Attivo di default (`regole.fuorigioco_attivo` = 1), solo nell'area piccola avversaria (6 × 12 m, ipotesi confermata dall'utente come valore da usare): chi è nell'area piccola quando un compagno calcia e tocca per primo la palla è in fuorigioco → indiretta agli avversari. Esenti angolo, rinvio e rimessa. Misurato: ~0,2 fuorigiochi a partita. Test `regole.fuorigioco.*`.

## Bias tra le squadre (risolto)

Su 600 partite neutre la squadra 1 vinceva 277 volte contro 217 e tirava il 24% di più (gol +0,26, z ≈ −2,9), anche prima delle regole nuove. Causa: ordine fisso di aggiornamento dei giocatori in `step()`; la squadra aggiornata per seconda vedeva già le posizioni nuove dell'altra. Invertendo l'ordine il vantaggio passava alla squadra 0. Ora l'ordine alterna a ogni passo (`ordered()`): tiri 6,720 contro 6,717 su 300 partite, gol entro 1σ su altre 300. Restano ordini fissi nei contrasti e nei recuperi in `stepBall()`: nessun effetto misurabile, da ricontrollare se compare un nuovo scarto.

## Robustezza

`npm run stress` (280 partite, 40 per formato da 5 a 11, semi 5000+): nessun blocco, valore non finito o giocatore fuori campo. Il primo giro ha trovato un difetto: `keepAway` (distanza minima su angolo e punizione) poteva spingere un difensore a oltre 4 m fuori dal campo; ora la posizione è limitata al campo. Gol medi per partita (non tarati fuori dal 7): 5 → 13,0, 6 → 11,4, 7 → 6,3, 8 → 3,9, 9 → 2,2, 10 → 1,7, 11 → 1,1.

## Ritocco dopo l'ordine alternato

Con l'ordine di aggiornamento alternato i tiri in porta erano 14,4 a partita (bersaglio 9–13). `shootEager`, `shootRange` e `forceShot` non incidono (il tiro forzato scatta entro `minScaled` = 3 m e domina). `laneWidth` sì: 1,2 → 1,6 m dà su 40 partite gol 4,97 e tiri in porta 11,6; 2,0 e 2,5 scendono a ~10,9 e gol ~4,7.

## Tiri fuori dallo specchio

Prima l'IA mirava al centro della porta con un errore piccolo (3° + 1°/m) e quasi tutti i tiri erano da 3–5 m: 11,6 tiri e 11,55 in porta a partita. Ora mira a un palo (`shotMargin` 0,5 m dentro, quello lontano dal portiere nel 70% dei casi, `shotFarPost`), errore base 7° (`shotAngle`) e più tiri da fuori (`shootEager` 0,2). Su 40 partite: gol 4,63, tiri 14,7, in porta 10,7 (73%). Il bersaglio dei tiri totali (12–20) è un'ipotesi mia, non un dato del girone. Senza più tiri da fuori i tiri in porta scendevano sotto 9; con tiri da fuori ancora più frequenti i gol scendevano sotto 4 (il tiro sostituisce l'azione che arrivava a tu per tu).

## Calcio d'inizio

Prima il battitore partiva palla al piede verso la porta: 6 gol su 213 (2,8%) entro 10 s dall'inizio o dalla ripresa, 2 entro 6 s. Ora `resetPositions` segna `setKind` = `kickoff` e l'IA del battitore passa a un compagno (miglior passaggio, altrimenti il più vicino). Su 40 partite (semi 9000+): 0 gol entro 10 s, gol 5,15, tiri in porta 12,7, passaggi 71%, possesso 50%. Test `regole.calcio_inizio.passaggio`.

## App e grafica

Dopo la consegna del motore l'utente ha chiesto interfaccia e grafica: 3D low-poly in stile televisivo, menu e scelta squadre, tabellone e statistiche dal vivo, regia (velocità, pausa, avanti, telecamere), replay dei gol, computer e telefono; la vista di debug resta separata. `public/index.html` + `public/app/` (la vecchia shell è in `shell.html`). Il motore ha ora l'intervallo (stato `half`, 3 s, poi batte la squadra 1) e eventi più ricchi (`goal.scorer`, `foul.player`, `offside.player`, `passOk/passLost.team`). Le statistiche dell'app seguono `tools/lib/matches.mjs`. Squadre predefinite con nomi e cognomi inventati. Rendering misurato ~1,3 ms per fotogramma (GTX 1050 Ti, 1024 × 768). Pubblicata su GitHub Pages (ramo `gh-pages` scritto dal workflow `pages.yml`; il primo push sul ramo da un account utente ha attivato Pages), installabile con manifest e service worker. Audio sintetizzato con Web Audio in `public/app/audio.js` (pubblico che segue la posizione della palla, fischio su falli e infrazioni, inizio, intervallo e fine, calci, esultanza ai gol, "ooh" sui tiri fuori); i suoni dei singoli episodi solo fino a 2×. Telecronaca testuale in `public/app/commentary.js`: osserva passaggi, tiri e possesso (avvolge `passTo`, `shoot`, `giveBall` senza cambiare la partita: stesso hash con e senza), frasi a priorità con intervalli minimi (bassa 20 s, media 8 s), circa 160 frasi in 50 minuti. Eventi `dangerous` e `obstruction` ora con `player`.

Voti, migliore in campo e mappa dei tiri: `MatchStats` tiene le statistiche per giocatore (passaggi dal `lastPass` della simulazione, come gli eventi `passOk/passLost`; parata = il portiere avversario prende la palla entro 2,5 s da un tiro in porta; recupero = palla tolta all'altra squadra in gioco, esclusi portiere e riprese; assist = ultimo passaggio riuscito al marcatore entro 8 s). Voto 4-10 a mezzi punti, pesi scelti dal progetto (README). Su 20 partite: media 6,1, quasi tutti tra 5 e 7,5, 10 a chi segna 4 gol. Circa 1,3 gol a partita non nascono da `shoot` (passaggio o tocco in porta): sulla mappa dal punto dell'ultimo tocco, non tra i tiri. `headless.js` gioca una partita senza grafica (2,4 s per 50 minuti in Node); test in `public/app/app.test.js` (`npm run test:app`, anche in CI).

## Ritmo e realismo (segnalazioni dell'utente dopo la prova)

L'utente ha segnalato: giocatori che non tirano, reti delle porte invisibili, fischi in area piccola, posizioni a caso o tutti in area, gioco troppo veloce, mai lanci lunghi. Misure sul motore prima della modifica, a 7 contro 7: 1.100 passaggi a partita (mediana 9,5 m), la palla fuori ogni 7 s (240 rimesse laterali, 170 rinvii dal fondo), solo 9-15 tiri. Cause: la distanza di tiro dell'IA, scalata sul campo da 105 m, valeva 6,7 m; il portatore correva verso la linea di porta (obiettivo x = porta) e usciva dal fondo senza tirare; i compagni non andavano incontro al passaggio e la palla scorreva fino alla linea laterale (circa 75 passaggi a partita); nessun lancio alto.

Modifiche: portata di tiro 22 (scalati, circa 10 m) con tiri più imprecisi da lontano (`shotAnglePerM` 5); il portatore si ferma a 3 m dalla porta (scalati) e tira; `interceptor()` manda a prendere la palla calciata a terra chi ci arriva prima (anche il destinatario); lancio lungo (`lobTo`, volo 1,2-2,2 s come il lob tarato) su un compagno avanzato e libero, rinvii lunghi del portiere (`keeperLong`) e spazzata sotto pressione nella propria metà; la palla alta è inseguita verso il punto di atterraggio (`ballSpot`); meno passaggi (`passBase` 0,03) e più conduzione e contrasti, con 0,8 s di protezione a chi ha appena vinto la palla; corsa a 4,5 m/s (lo scatto resta 8, come nei test) e rallentamento all'arrivo sul punto; fallo meno probabile (0,008) e ancora meno nella propria area; portiere con raggio di parata 1,3 m. Il lanciatore del lob e i rigori usano `aimShot`. Passaggi per partita 310, tiri 25, possesso della palla a un giocatore 80%. Nell'app: velocità 0,5× e reti più grosse.

## Out of scope

- Codice, asset, nomi, loghi, squadre e giocatori Konami o reali. Protetti; non rientra nella destinazione clean-room.
- Decompilazione o analisi binaria di PES6.
- Controllo umano, schema dei tasti, giocabilità, modalità a 2 giocatori ([ticket](tickets/01-comandi.md)).
- (Grafica, telecamera, animazioni, interfaccia, replay e audio ora fatti: vedi "App e grafica".)
- Gioco online (relay, lockstep, rollback).
- Campionati, editor, allenamento, carriera.

## Tickets

| Ticket | Tipo | Stato | Bloccato da |
|---|---|---|---|
| [Sensazione dei comandi](tickets/01-comandi.md) | grilling | chiuso, fuori perimetro | - |
| [Modello di palla, tiro e passaggio](tickets/02-palla.md) | prototype | chiuso | - |
| [Stile e telecamera](tickets/03-telecamera.md) | prototype | fatto (app 3D) | - |
| [Movimento e possesso palla](tickets/04-movimento-possesso.md) | grilling | chiuso | - |
| [Test di gioco e taratura](tickets/05-test-taratura.md) | grilling | chiuso | - |
| [Regole e riprese del gioco](tickets/06-regole.md) | grilling | chiuso | - |
| [Attributi dei giocatori](tickets/09-attributi.md) | grilling | chiuso | - |
| [Architettura IA di squadra](tickets/07-ia-squadra.md) | grilling | chiuso | - |
| [Formazioni parametriche 5–11](tickets/08-formazioni.md) | grilling | chiuso | - |

## Vista di debug

`public/debug.html` (si apre dal server `npm start`, http://localhost:8080/debug.html): partita IA contro IA con 3D, scelta di giocatori (5–11), seme, velocità fino a 30×, pausa, +60 s e contatori di falli, cartellini e retropassaggi. Verificata nel browser a 7 e a 11 giocatori (campo, aree, porte, indiretta). Il retropassaggio scatta solo se un compagno calcia verso il proprio portiere; l'IA evita quei passaggi (circa 3 casi a partita restano).

## Attributi restanti (sessione 7)
Modellati: Decisioni (rumore sul punteggio di `bestPass`, 0,25 a 10 -> 0,15 a 20), Senza palla (spinta di appoggio x nScale), Posizionamento (errore fisso di posizione 0,8*15/Pos m), Calci punizione / Rigori (errore di tiro su calcio piazzato), portiere Presa (probabilita' di trattenere 0,70+0,02(P-15), altrimenti respinta) e Uno contro uno (raggio x nScale entro 10 m scalati). Non modellati: Rimesse lunghe. Giocatori neutri (senza attributi) invariati nei valori base. Test: formule in `tests/game/attributi.json` (scenario `skillFormula`). Da tarare con squadre reali: effetto della respinta del portiere sui gol.

## Torneo (sessione 8)
Campionato (andata, o andata e ritorno, metodo del cerchio) e coppa a eliminazione diretta tra 3 e 8 squadre. Logica in `public/app/tournament.js` (test in `app.test.js`), interfaccia in `public/app/tourui.js`, partite simulate in `public/app/worker.js` (con ripiego sul thread principale). Il seme di ogni partita dipende dal torneo e dalla partita: guardare o simulare dà lo stesso risultato. Rigori di coppa: modello statistico `penaltyChance` (circa 78%), perché il portiere fisico sul dischetto parava quasi tutto (le parate sono tarate sull'azione). Scelte del progetto, non verificate su regolamenti ufficiali: punti 3/1/0, spareggio per differenza reti e gol fatti, sorteggio della coppa con turno di riposo ai primi sorteggiati. Il torneo si salva in `localStorage` (`calcio7.torneo`).
