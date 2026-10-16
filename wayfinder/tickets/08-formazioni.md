---
status: closed
type: grilling
blocked-by: []
assignee: claude (sessione corrente)
---

Fonte: `wayfinder/references/regole-e-formazioni-calcio-a-7.md` (sezioni 2 e 3). Caso principale: 7 giocatori.

## Question

Come si adattano formazioni e ruoli da 5 a 11 giocatori? Decidere: schema dei ruoli (portiere, difensori, centrocampisti, attaccanti), formazioni predefinite per ogni numero di giocatori, dimensione del campo e delle porte per 5, 7 e 11, scalatura di velocità e distanze. Output: tabella formazioni per numero di giocatori e regole di scalatura.

## Resolution

Approvata dall'utente ("procedi come suggerito"), con l'area di rigore indicata da lui (10 m × 20 m).

**Schemi** (tre linee: difensori-centrocampisti-attaccanti, somma = giocatori − 1, portiere escluso). Predefinito a 7: 2-3-1. Il 4-2-3-1 e ogni schema a quattro linee sono fuori perimetro.

| Giocatori | Schemi supportati |
|---|---|
| 5 | 1-2-1 (predefinito), 2-2, 1-1-2, 2-1-1 |
| 6 | 2-2-1 (predefinito), 2-1-2, 1-3-1, 3-1-1 |
| 7 | 2-3-1 (predefinito), 3-2-1, 2-2-2, 3-1-2, 1-3-2, 1-4-1 |
| 8 | 3-3-1 (predefinito), 3-2-2, 2-4-1, 2-3-2 |
| 9 | 3-3-2 (predefinito), 3-4-1, 2-4-2, 4-3-1 |
| 11 | 4-4-2 (predefinito), 4-3-3, 3-5-2 |

Per 5–6 e 8–9 il predefinito è la prima voce dell'elenco del documento (scelta mia, da confermare); a 7 è 2-3-1.

**Posizioni base**: relative al campo. Le linee stanno a una frazione della lunghezza dalla propria porta (difesa 25%, centrocampo 50%, attacco 75%); i giocatori di una linea si distribuiscono sulla larghezza. Lo stesso schema vale per ogni misura. Ruoli per linea come nel documento (centrale, terzino, esterno, mezzala, punta, ala). Regole di assegnazione: con 1 difensore fa da copertura centrale e il portiere da secondo libero; con 2 difensori due centrali o un centrale e un terzino; con 3 uno centrale e due esterni; con 1 attaccante l'esterno di centrocampo ripiega senza palla; con 2 attaccanti uno si abbassa a legare il gioco.

**Dimensioni** (parametri della partita, modificabili):

| Giocatori | Campo (m) | Porta (m) |
|---|---|---|
| 5 | 35 × 20 | 3 × 2 |
| 7 | 50 × 30 | 6 × 2 |
| 8–9 | 65 × 45 | 6 × 2 |
| 11 | 105 × 68 | 7,32 × 2,44 |

Aree a 7: area di rigore 10 m di profondità × 20 m di larghezza (dichiarata dall'utente), dischetto a 8 m dalla porta. Area piccola 6 m × 12 m, **ipotesi mia**, usata solo se il fuorigioco viene acceso. Per gli altri formati le aree non sono specificate: scalano in proporzione alla lunghezza del campo.

**Scalatura**: velocità dei giocatori (6 e 8 m/s), raggi di contatto e distanze regolamentari (barriera 6 m, angolo 5–6 m, rigore 8 m) restano fisici e fissi. I parametri di distanza dell'IA si moltiplicano per lunghezza campo / 105, con minimo 3 m: innesco del pressing 14 m, raggio del secondo pressatore 12 m, distanza minima tra compagni 8 m, rimessa laterale 15 m. A 50 m l'innesco del pressing diventa 6,7 m.

**Modificatori per campo piccolo o stretto** (dal documento dell'utente; valori da tarare): innesco del pressing +4% sotto i 40 m di lunghezza; falli +8% sotto i 30 m di larghezza; griglia delle zone 3×2 invece di 4×3 sui campi piccoli.

**Bersagli statistici a 7 contro 7** (segnaposto, partita da 50 minuti; da sostituire con i dati reali del girone o di `calibration.ts`): gol totali 7–10, tiri totali 40–55, precisione passaggi 70–82%, possesso 40–60% per squadra. Le statistiche si contano per minuto di gioco, non per partita.

**Test di gioco**:
1. Per ogni schema elencato la somma delle linee è giocatori − 1; all'inizio nessun giocatore sta a meno di 2 m da un altro né fuori dal campo.
2. Con campo 50 × 30 e campo 105 × 68 le posizioni base, normalizzate, differiscono meno dell'1%.
3. L'innesco del pressing a 50 m di lunghezza è 6,67 m (±0,01); nessuna distanza scalata scende sotto 3 m.
4. Il dischetto (8 m) sta dentro l'area di rigore (10 m).
5. Su 200 partite IA contro IA a 7 di 50 minuti, gol e tiri rientrano nei bersagli segnaposto.
6. Con 5, 6, 8, 9 e 11 giocatori la partita parte e finisce senza errori.
