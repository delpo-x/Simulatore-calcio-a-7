# Calcio a 7: regole del gioco e formazioni parametriche

Riassunto di riferimento sul calcio a 7. Le righe marcate **[dato del progetto]** vengono dal regolamento che hai fornito e che il progetto usa già (`src/domain/setPieceSchemes.ts`). Il resto riprende le regole generalmente in uso nel calcio a 7 amatoriale e giovanile italiano e **non sostituisce il regolamento della tua lega**: FIGC (settore giovanile), CSI e UISP differiscono su più punti. Dove il valore cambia da lega a lega c'è **[verifica]**.

## 1. Regole e riprese del gioco

| Tema | Regola | Note |
|---|---|---|
| Giocatori | 7 per squadra: portiere e 6 di movimento. Minimo 4 giocatori per giocare [dato del progetto] | Sotto i 4 la partita non si gioca |
| Sostituzioni | Illimitate. Un giocatore sostituito può rientrare [dato del progetto] | Il sostituto entra quando l'uscente è fuori [verifica] |
| Durata | 2 tempi da 25 minuti [dato del progetto] | Intervallo di 5-10 minuti [verifica] |
| Timeout | Uno per tempo per ogni squadra, chiamabile solo da chi ha il possesso del pallone [dato del progetto] | |
| Calcio d'inizio | Dal centro, a inizio tempo e dopo ogni gol; avversari a circa 6 m | |
| Rimessa laterale | Con le mani, dalla linea laterale a palla ferma. Palla in gioco subito, nessuna distanza minima per gli avversari. La rimessa lunga è consentita [dato del progetto] | Nel simulatore la rimessa lunga si tratta come un angolo, con una sponda possibile |
| Rinvio dal fondo | Il portiere rimette in gioco con mani o piedi; gli avversari restano fuori dall'area finché il pallone non è in gioco | In alcune leghe il rinvio deve uscire dall'area [verifica] |
| Calcio d'angolo | Dall'arco d'angolo, avversari a circa 5-6 m [dato del progetto]. Il gol diretto è valido | |
| Falli | Punizione diretta per spinta, sgambetto, trattenuta, tocco di mano. Indiretta per gioco pericoloso, ostruzione e retropassaggio al portiere con le mani | Contatto più severo che nell'11 contro 11 [verifica] |
| Sanzioni | Ammonizione (giallo). Cartellino rosso: espulsione per tutta la partita. Cartellino azzurro: 5 minuti fuori. Giallo + azzurro nella stessa partita = rosso [dato del progetto] | Il motore modella rosso e secondo giallo (espulsione fino a fine partita); non l'azzurro né la regola giallo + azzurro |
| Fuorigioco | Solo nell'area piccola [dato del progetto]. Fuori dall'area piccola un attaccante non è mai in fuorigioco | Alcuni tornei non lo applicano affatto [verifica] |
| Rigore | Dal dischetto, circa 8 m dalla porta [dato del progetto]; solo il portiere in difesa | |
| Calci di punizione | Pallone fermo, barriera a 6 m [dato del progetto]. Diretta: gol valido. Indiretta: serve un secondo tocco | |
| Retropassaggio al portiere | Il portiere non può prendere con le mani un pallone passato volontariamente con il piede da un compagno | Punizione indiretta [verifica] |
| Gol | Il pallone supera interamente la linea di porta, tra i pali e sotto la traversa | |

## 2. Formazioni parametriche

Nel simulatore una formazione è una stringa `difensori-centrocampisti-attaccanti` con somma 6 (7 meno il portiere). L'idea si estende a qualsiasi numero di giocatori: `n` titolari, un portiere, `n - 1` di movimento divisi in tre linee, almeno uno per linea (salvo schemi a due linee, come il 2-2).

### 2.1 Schemi per numero di giocatori

| Giocatori | Di movimento | Schemi tipici | Note |
|---|---|---|---|
| 5 (calcetto) | 4 | 1-2-1, 2-2, 1-1-2, 2-1-1 | Il rombo (1-2-1) è il più diffuso |
| 6 | 5 | 2-2-1, 2-1-2, 1-3-1, 3-1-1 | |
| **7** | **6** | **2-3-1, 3-2-1, 2-2-2, 3-1-2, 1-3-2, 1-4-1** | Il 2-3-1 è il più bilanciato; il 3-2-1 è più prudente |
| 8 | 7 | 3-3-1, 3-2-2, 2-4-1, 2-3-2 | |
| 9 | 8 | 3-3-2, 3-4-1, 2-4-2, 4-3-1 | |
| 11 | 10 | 4-4-2, 4-3-3, 3-5-2, 4-2-3-1 | Il 4-2-3-1 ha quattro linee: fuori dallo schema a tre linee del simulatore |

### 2.2 Ruoli per linea (7 contro 7)

| Linea | Ruoli | Compito |
|---|---|---|
| Portiere | Portiere | Para, rimette in gioco, avvia la costruzione dal basso |
| Difesa | Difensore centrale, terzino destro/sinistro | Copertura, marcatura, impostazione |
| Centrocampo | Centrocampista centrale, esterno destro/sinistro, mezzala | Filtro, ampiezza, collegamento |
| Attacco | Punta centrale, seconda punta, ala | Finalizzazione, pressione sul portatore |

Regole di assegnazione per `n` giocatori:
- Con 1 difensore, fa da copertura centrale e il portiere fa da secondo libero.
- Con 2 difensori, due centrali oppure un centrale e un terzino.
- Con 3 difensori, uno centrale e due esterni.
- Con 1 attaccante, l'esterno di centrocampo ripiega in fase di non possesso.
- Con 2 attaccanti, uno si abbassa a legare il gioco.

### 2.3 Dimensioni di campo e porte

| Giocatori | Campo (lunghezza × larghezza) | Porta (larghezza × altezza) |
|---|---|---|
| 5 | 25-42 × 15-25 m | 3 × 2 m |
| 7 | Variabile da campo a campo: tipicamente 40-60 × 25-40 m | 6 × 2 m |
| 8-9 | 60-70 × 40-50 m | 6 × 2 m |
| 11 | 90-120 × 45-90 m (tipico 105 × 68) | 7,32 × 2,44 m |

Le misure del campo sono una variabile della partita (non fissa): il simulatore assume 50 × 30 m per default (`src/domain/pitchDimensions.ts`). Campo corto (40 m o meno) e stretto (meno di 30 m) hanno modificatori propri per pressing, costruzione, cross e falli.

## 3. Scalatura di velocità e statistiche per il 7 contro 7

Questa parte è una **proposta di modellazione**, non una regola ufficiale. Serve a portare in 7 contro 7 i valori noti dell'11 contro 11.

### 3.1 Velocità

Il campo a 7 è circa la metà in lunghezza e larghezza di quello a 11, mentre i giocatori corrono alla stessa velocità fisica. Per mantenere credibili i tempi di gioco (risalire il campo, ripiegare, pressare) conviene ragionare in unità relative:

```
velocità_relativa = velocità_m_s / lunghezza_campo_m
```

- Un giocatore da 8 m/s su 105 m attraversa il campo in circa 13 s; su 50 m lo fa in circa 6 s.
- Contano di più gli scatti brevi e meno la resistenza: i campi piccoli premiano accelerazione e primo passo rispetto alla velocità massima.
- Il pressing rende di più su campo piccolo: nel simulatore è il modificatore `pitchPressingMod` (+4% sotto i 40 m).

### 3.2 Statistiche

| Statistica | Come scalarla dai 90 minuti a 11 |
|---|---|
| Durata | Moltiplicare per `minuti_partita / 90` (2 × 25 = 50 minuti danno 0,56) |
| Passaggi, tocchi, possessi | Contarli per minuto di gioco, non per partita. Con meno giocatori ognuno tocca più palloni |
| Tiri e gol | Più tiri per minuto su campo corto: porta più vicina, meno filtri. Calibrare sul numero di gol del girone, come fa `src/engine/calibration.ts` |
| Falli | A parità di tempo, più falli su campo stretto (+8% nel simulatore) |
| Angoli e rimesse | Più frequenti: la palla esce più spesso su campo piccolo |
| Sforzo fisico | Meno distanza assoluta, più scatti e cambi di direzione per minuto |

### 3.3 Cosa il simulatore già fa e cosa manca

Già presente: campo di default 50 × 30 m, soglie per campo corto e stretto con modificatori su pressing, costruzione, cross e falli, griglia delle zone che passa da 4×3 a 3×2 su campi piccoli, calibrazione della scala dei gol.

Da aggiungere se serve: fuorigioco nell'area piccola, cartellino azzurro (5 minuti fuori), timeout (uno per tempo, solo con il possesso), formazioni per un numero di giocatori diverso da 7.
