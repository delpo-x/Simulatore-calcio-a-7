---
status: closed
type: grilling
blocked-by: []
assignee: claude (sessione corrente)
---

## Question

Come è fatta l'IA di squadra? Decidere: architettura (macchine a stati per ruolo, pressing, copertura, smarcamento), cosa decide il portatore (dribbling, passaggio, tiro), comportamento del portiere, come l'IA aiuta il giocatore umano (passaggio assistito, cambio automatico). Output: elenco comportamenti, parametri e livelli di difficoltà candidati.

## Resolution

Architettura decisa (da realizzare in `public/core/sim.js` o moduli collegati, in esecuzione):

- **Struttura**: tre fasi di squadra (possesso, non possesso, transizione dopo palla persa o recuperata). Dentro la fase ogni giocatore sceglie l'azione con un punteggio di utilità; azioni: pressare, coprire, smarcarsi, portare palla, passare, tirare.
- **Frequenza**: decisioni a 10 Hz (ogni 6 passi), con ritardo di reazione. Il fisico del movimento resta a 60 Hz.
- **Senza palla**: pressa il più vicino al portatore; un secondo giocatore pressa se è entro 12 m; gli altri in blocco compatto secondo l'altezza della linea e marcatura a zona; un attaccante resta alto per il contropiede.
- **Con palla**: il portatore valuta dribbling, passaggio, tiro e rinvio (guadagno di posizione meno rischio di intercetto; tiro per distanza e angolo). I compagni cercano appoggi: ampiezza, profondità, distanza minima 8 m tra loro.
- **Portiere**: si piazza sulla bisettrice dell'angolo di tiro a 1,5–3 m dalla linea; esce sui lanci in profondità se arriva per primo; para entro 1,7 m; rinvio al compagno meglio libero.
- **Casualità**: generatore con seed per tutto, più un tasso d'errore regolabile (passaggi sbagliati, tiri fuori misura). Stesso seed = stessa partita.
- **Difficoltà**: un solo livello fisso, "difficile", perché nessun umano gioca contro l'IA. Parametri: ritardo di reazione 0,1 s, tasso d'errore 4%, innesco del pressing a 14 m, propensione al rischio 0,6 su 1 (valori proposti da me, da tarare nel ticket Test e taratura).
- **Parametri tattici di squadra**: altezza della linea difensiva, ampiezza, ritmo (frequenza dei passaggi) e innesco del pressing; modificabili da codice o da un file, per gli esperimenti.
- **Test di gioco** (partite IA contro IA a 11v11): gol totali 2–3,5; tiri totali 20–28; precisione passaggi 75–85%; possesso 40–60% per squadra; nessun giocatore fermo oltre 20 s senza motivo. Per 7v7 si scalano nel ticket Formazioni.
