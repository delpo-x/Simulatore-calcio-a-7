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
- [Stile e telecamera](tickets/03-telecamera.md): chiuso fuori perimetro, la grafica non è un obiettivo.
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
3. **Movimento e possesso** ([ticket](tickets/04-movimento-possesso.md)): velocità, accelerazione, sterzata, stamina, controllo palla, contrasti, urti. **Fatto.** Costanti `MOVE` in `sim.js` (corsa 6, sprint 8, costante 0,6 s, stamina, palla a 0,5 + 0,08·v, contrasto probabilistico 55%, stordimento sopra 6 m/s); 27 test ok, 0 errori. Non coperto da test: la perdita di velocità nella virata a 180°. Restano gli avvisi macro (circa 73 gol e 99 tiri a partita contro 7–10 e 40–55): li affronta la sessione 5 (IA).
4. **Campo, formazioni e regole a 7** ([ticket](tickets/08-formazioni.md), [ticket](tickets/06-regole.md)): dimensioni parametriche, schemi, falli, sanzioni, riprese, aree. **Fatto in gran parte.** `pitchFor(n)`, `SCHEMES`, `layout()` e `RULES` in `sim.js`; campo per istanza (`sim.pitch`, 50 × 30 m a 7); falli sui contrasti a rischio con ammonizione, espulsione e rigore nell'area; punizione (barriera 6 m), angolo (5,5 m), rinvio e rigore (8 m) con le aree libere; vista di debug adattata al campo. 53 test ok, 0 errori. **Non fatto**: azzurro (5 minuti) e rientro dopo un'espulsione, retropassaggio al portiere, punizione indiretta, . Con il campo piccolo l'IA fa circa 145 gol e 200 tiri a partita: da tarare nella sessione 5. Il 10 giocatori è un'estensione mia (4-3-2).
5. **IA di squadra** ([ticket](tickets/07-ia-squadra.md)): fasi, utilità, pressing, portiere, errori, parametri tattici. **Fatto.** Blocco `AI` in `sim.js`: decisioni a 10 Hz, fasi possesso/non possesso/transizione, distanze scalate con lunghezza/105, pressing e copertura, marcatura a zona, ultimo difensore che contiene il portatore, tiro con errore di mira crescente con la distanza, portiere con intercetto e uscita. Bug trovati lungo la strada: il portiere in possesso veniva derubato (ora protetto), gli avversari lo assalivano durante il rilancio (ora restano fuori area), gli attaccanti si piazzavano sulla linea di porta, i tiri dell'IA venivano raddrizzati verso la porta, il portiere non parava sopra 30 m/s. Su 10 partite a 7: gol ~8,5 (bersaglio 7–10), tiri ~48 (40–55), passaggi riusciti ~78%, possesso ~50%. Il test `aiScaling` passa. Restano provvisori i bersagli; la taratura vera è la sessione 7.
6. **Attributi e file squadra** ([ticket](tickets/09-attributi.md)): lettura del file, moltiplicatori, ruoli e piede. **Fatto in gran parte.** `public/core/team.js`: `readTeam`/`readPlayer` (validazione con messaggio che nomina giocatore e attributo), `pickLineup` (titolari e ruoli per schema), `syntheticTeam`, `deriveSkill`. `new Sim({ teams: [lineup0, lineup1] })`; senza `teams` i giocatori restano neutri (valori base, risultati invariati). Attributi modellati: Velocità, Accelerazione, Agilità, Equilibrio, Resistenza, Integrità fisica, Contrasti/Dribbling/Forza, Aggressività, Passaggi, Visione di gioco, Finalizzazione, Tiri da lontano, Concentrazione, Primo tocco; portiere: Riflessi, Uscite, Posizione. Piede debole nel 30% dei passaggi e tiri (errore ×1,5), fuori ruolo −5%. 9 test `attributi.*` ok (65 ok, 0 errori). Con tutti a 18 contro tutti a 12: ~10,3 contro ~2,3 gol. **Non fatto**: Decisioni, Senza palla, Posizionamento, Rimesse lunghe, calci piazzati/rigori, Presa e Uno contro uno del portiere, Aggressività sui falli. Con attributi 15 le velocità sono 0,975 × base (f(15)); i numeri macro con squadre da file vanno ritarati nella sessione 7.
**Collegamento `params.json`**: fatto. `public/core/params.js` (`PARAM_MAP`, `applyParams`, `diffParams`) e `tools/lib/config.mjs`: `npm run test:game` e `npm run matches` applicano `config/params.json` al motore all'avvio; i valori di `sim.js` restano i predefiniti del browser e il test `config.allineato` avvisa se differiscono. `params.json` ha ora anche `palla_modello` e `ia_taratura` (valori tarati nella sessione 5). Il valore `portiere.raggio_parata_m` era 1,7 nel ticket, ora 2,05 come nel motore.
7. **Taratura finale** (prima passata, dati del girone: gol 5, tiri 11, passaggi 70% a partita). `config/targets.json` ora ha i dati veri (gol 4–6, tiri in porta 9–13, passaggi 67–73%; possesso ancora segnaposto); ipotesi da confermare: i "tiri" 11 sono tiri in porta, il motore ora conta `shots_on_target`. Risultato su 40 partite: gol ~5,5, tiri in porta ~12,5, passaggi ~72%, possesso ~49%. Modifiche: errore di passaggio maggiore sotto pressione (`pressedErrMul`), blocco difensivo molto basso (`blockDepth` 1,0: gli altri difensori restano a ridosso dell'area), tiri solo da vicino, portiere 2,3 m; minimo 5 giocatori in campo dopo le espulsioni. Aperto: il blocco basso e' una scorciatoia di taratura, non un comportamento verificato su partite vere; mancano possesso, falli e cartellini del girone. Ancora così: **Taratura finale** sui bersagli, con i dati reali del girone al posto dei segnaposto.

## Out of scope

- Codice, asset, nomi, loghi, squadre e giocatori Konami o reali. Protetti; non rientra nella destinazione clean-room.
- Decompilazione o analisi binaria di PES6.
- Controllo umano, schema dei tasti, giocabilità, modalità a 2 giocatori ([ticket](tickets/01-comandi.md)).
- Grafica, telecamera, animazioni, audio, interfaccia, replay ([ticket](tickets/03-telecamera.md)).
- Gioco online (relay, lockstep, rollback).
- Campionati, editor, allenamento, carriera.

## Tickets

| Ticket | Tipo | Stato | Bloccato da |
|---|---|---|---|
| [Sensazione dei comandi](tickets/01-comandi.md) | grilling | chiuso, fuori perimetro | - |
| [Modello di palla, tiro e passaggio](tickets/02-palla.md) | prototype | chiuso | - |
| [Stile e telecamera](tickets/03-telecamera.md) | prototype | chiuso, fuori perimetro | - |
| [Movimento e possesso palla](tickets/04-movimento-possesso.md) | grilling | chiuso | - |
| [Test di gioco e taratura](tickets/05-test-taratura.md) | grilling | chiuso | - |
| [Regole e riprese del gioco](tickets/06-regole.md) | grilling | chiuso | - |
| [Attributi dei giocatori](tickets/09-attributi.md) | grilling | chiuso | - |
| [Architettura IA di squadra](tickets/07-ia-squadra.md) | grilling | chiuso | - |
| [Formazioni parametriche 5–11](tickets/08-formazioni.md) | grilling | chiuso | - |
