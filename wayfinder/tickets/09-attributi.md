---
status: closed
type: grilling
blocked-by: []
assignee: claude (sessione corrente)
---

Fonte: file squadra fornito dall'utente, `C:\Users\nicola.IMPRONTE\Downloads\implast.json` (squadra "Implast": 16 giocatori, ruolo, piede, voto complessivo e 36 attributi da 1 a 20; i portieri hanno attributi propri). Contiene nomi di persone reali: non copiarlo nel repository, usarlo solo come esempio del formato.

## Question

Come gli attributi dei giocatori (scala 1–20) diventano parametri della simulazione? Decidere: quali attributi contano (per esempio Velocita, Accelerazione, Resistenza, Forza, Passaggi, Finalizzazione, Contrasti, Marcatura, Decisioni) e quali si ignorano; come ciascuno modifica i valori base già decisi (velocità di corsa e sprint, accelerazione, stamina, precisione di passaggio e tiro, probabilità di contrasto, ritardo di reazione); come si usano ruolo, ruolo secondario e piede (DX/SX); attributi dei portieri (Riflessi, Presa, Uscite, Posizione, UnoControUno); formato del file squadra letto dal motore (senza giocatori reali nel repository). Output: tabella attributo → parametro con formula e test di gioco.

## Resolution

Approvata dall'utente ("procedi come suggerito"). Valori iniziali, tutti tarabili nel ticket Test e taratura. Nei calcoli `a` è l'attributo da 1 a 20, limitato a quell'intervallo.

Due scale usate:
- **f(a) = 0,90 + 0,015 × (a − 10)** per velocità: da 0,90 (a = 10) a 1,05 (a = 20); limita gli estremi.
- **n(a) = 1 + 0,02 × (a − 15)**: neutra a 15, da 0,90 (a = 10) a 1,10 (a = 20).

| Attributo | Parametro che modifica | Formula |
|---|---|---|
| Velocità | corsa (base 6,0) e sprint (base 8,0 m/s) | base × f(Velocità): sprint 7,2 (a = 10), 7,8 (a = 15), 8,4 (a = 20) m/s |
| Accelerazione | costante di tempo (base 0,6 s) | 0,6 s / f(Accelerazione) |
| Agilità | velocità angolare di sterzata | base × f(Agilità) |
| Equilibrio | perdita di velocità in virata (base 30%) | 30% × 15 / Equilibrio |
| Resistenza | stamina | durata dello sprint = 25 s × Resistenza / 15; recupero = 40 s × 15 / Resistenza |
| Contrasti, Dribbling, Forza | probabilità di contrasto (base 55%) | 0,55 + 0,015 × (Contrasti − 14) − 0,015 × (Dribbling del portatore − 13) + 0,005 × (Forza − Forza del portatore); limitata a 20–85% |
| Aggressività | pressing e falli | innesco del pressing = 14 m × n(Aggressività); probabilità di fallo = 15% × n(Aggressività) |
| Integrità fisica | stordimento negli urti (base 0,3 s) | 0,3 s × 15 / Integrità fisica |
| Passaggi | tasso d'errore del passaggio (base 4%) | 4% × 15 / Passaggi |
| Visione di gioco | scelta del passaggio | peso del guadagno di posizione nell'utilità = 1 + 0,03 × (Visione − 15) |
| Finalizzazione, Tiri da lontano | precisione del tiro | errore angolare base 4° × 15 / attributo; Finalizzazione entro 16 m, Tiri da lontano oltre |
| Decisioni | scelta dell'azione | probabilità di scegliere l'azione migliore = 0,75 + 0,01 × (Decisioni − 10) |
| Concentrazione | ritardo di reazione (base 0,1 s) | 0,1 s × 15 / Concentrazione |
| Senza palla, Posizionamento | smarcamento e disposizione | peso dell'utilità di smarcamento × n(Senza palla); errore di posizione × 15 / Posizionamento |
| Primo tocco | raccolta della palla (base 0,9 m) | 0,9 m × n(Primo tocco) |
| Rimesse lunghe | rimessa laterale (base 15 m) | 15 m × n(Rimesse lunghe) |
| Calci piazzati, Rigori | errore dei tiri da fermo | errore base × 15 / attributo del battitore (il migliore tra Calci di punizione, Calci d'angolo, Rigori) |
| Portiere: Riflessi | raggio di parata (base 1,7 m) | 1,7 m × n(Riflessi) |
| Portiere: Presa | trattenere invece di respingere | 0,70 + 0,02 × (Presa − 15) |
| Portiere: Uscite | distanza di uscita (base 9 m) | 9 m × n(Uscite) |
| Portiere: Posizione | errore sulla bisettrice (base 0,5 m) | 0,5 m × 15 / Posizione |
| Portiere: Uno contro uno | probabilità di parata in uno contro uno | base × n(Uno contro uno) |
| Portiere: Rinvii, Passaggi | precisione del rinvio | errore base × 15 / attributo |
| Portiere: Velocità, Accelerazione, Agilità | movimento | come gli altri giocatori |

Ignorati (nessun modello per ora): Colpi di testa, Elevazione, Coraggio, Carisma, Determinazione, Impegno, Gioco di squadra, Fantasia, Cross, Tecnica, Anticipo, Freddezza, Marcatura, Comunicazione, Eccentricità, Rimesse del portiere, Respinte di pugno e il voto complessivo. Possono tornare quando il motore avrà duelli aerei, cross e marcatura individuale.

Ruoli e piede:
- **Ruolo**: Defender, Midfielder e Forward indicano la linea dello schema; "Wide" indica l'esterno della linea.
- **Ruolo secondario**: giocare in quel ruolo non ha penalità; fuori da ruolo e ruolo secondario i moltiplicatori tecnici (Passaggi, Finalizzazione, Marcatura) si riducono del 5%.
- **Piede**: DX o SX; circa il 30% di passaggi e tiri è col piede debole, con errore × 1,5.

Formato del file squadra (come `implast.json`):
- Campi letti: `position`, `secondaryPosition`, `posLabel`, `foot`, `scouting` (l'insieme completo di attributi, 36 per i giocatori di movimento e 38 per i portieri). Un attributo mancante dà un errore chiaro, mai un valore silenzioso.
- Campi ignorati: `overall`, `number`, `starter`, `matchRoles`, `savedTactics`.
- La formazione si sceglie a parte: uno schema (per esempio 2-3-1) e 7 giocatori.
- Nel repository solo squadre sintetiche d'esempio ("Giocatore 1", ...). I file con persone reali si caricano da percorso o dall'interfaccia e non vengono copiati.

Test di gioco:
1. Sprint su 40 m con Velocità 19 contro Velocità 11: la differenza di tempo è tra 0,5 e 1,0 s.
2. Due squadre con tutti gli attributi a 15: su 200 partite, i gol medi per squadra differiscono meno del 10%.
3. Su 10 000 prove l'errore dei passaggi con Passaggi 11 è 5,5% e con Passaggi 16 è 3,75% (entro ±1 punto percentuale).
4. Un file squadra con un attributo mancante o fuori scala (da 1 a 20) viene rifiutato con un messaggio che nomina giocatore e attributo.
5. Stesso seed e stesso file squadra danno la stessa partita.
