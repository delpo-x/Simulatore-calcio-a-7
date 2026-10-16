---
status: closed
type: grilling
blocked-by: []
assignee: claude (sessione corrente)
---

Fonte: `wayfinder/references/regole-e-formazioni-calcio-a-7.md` (sezione 1).

## Resolution

Regolamento di riferimento: CSI. Una ricerca sul web non ha trovato il regolamento tecnico ufficiale CSI del calcio a 7: i punti sotto marcati "non verificato" restano ipotesi finché non si ha quel testo.

| Tema | Decisione | Stato |
|---|---|---|
| Durata | 2 tempi da 25 minuti, tempo continuo; niente intervallo, sostituzioni né timeout (non cambiano la fisica) | deciso |
| Calcio d'inizio | dal centro, avversari a 6 m | dal documento |
| Rimessa laterale | con le mani: il giocatore più vicino lancia a un compagno entro 15 m, nessuna distanza minima per gli avversari; la rimessa lunga si tratta come un angolo con sponda possibile | deciso |
| Rinvio dal fondo | il portiere sceglie mani o piedi secondo il punteggio di utilità del ticket IA; avversari fuori dall'area finché la palla non è in gioco; il rinvio può restare dentro l'area | deciso (variante comune) |
| Calcio d'angolo | avversari a 5–6 m, gol diretto valido | dal documento |
| Punizione | barriera a 6 m; diretta: gol valido; indiretta: serve un secondo tocco | dal documento |
| Rigore | dal dischetto a 8 m, solo il portiere in difesa | dal documento |
| Falli | ogni contrasto da dietro, o fallito con contatto, è fallo con probabilità 15%; di questi 10% giallo, 1% rosso, il resto punizione diretta; gioco pericoloso e ostruzione = punizione indiretta | deciso (parametri da tarare) |
| Sanzioni | giallo; rosso = espulsione per tutta la partita; azzurro = 5 minuti fuori (esiste nei tornei CSI; la durata viene dal documento, non l'ho trovata in fonte CSI); giallo + azzurro = rosso | durata non verificata |
| Retropassaggio al portiere | il portiere non può prenderlo con le mani; punizione indiretta | non verificato per CSI (presente in regolamenti giovanili trovati) |
| Fuorigioco | **conflitto di fonti**: il tuo documento lo applica solo nell'area piccola, mentre un comunicato CSI Milano (settembre 2025) dice che nel calcio a 7 la regola non è prevista. Si implementa come modulo opzionale, **spento di default**; se attivato, area piccola 6 m × 12 m davanti a ogni porta (ipotesi mia, il documento non dà la misura) | da confermare dall'utente |
| Gol | il pallone supera interamente la linea di porta, tra i pali e sotto la traversa | dal documento |
| Limite di 6 secondi di possesso del portiere | non adottato (trovato solo nel regolamento FIGC Pulcini) | escluso |

Test di gioco: (1) su 1000 contrasti da dietro i falli sono tra 13% e 17%; (2) dopo un'espulsione o un azzurro la squadra gioca in inferiorità per la durata corretta; (3) con il fuorigioco spento nessuna azione viene fermata per fuorigioco; (4) ogni ripresa da fermo rispetta le distanze (6 m barriera, 5–6 m angolo, 8 m rigore).

Fonti: [comunicato CSI Milano n°3](https://www.csi.milano.it/media/documenti/comunicato-ufficiale-n°3_1758718684.pdf), [Avvenire sul cartellino azzurro CSI](https://www.avvenire.it/idee-e-commenti/calcio-il-csi-e-il-cartellino-azzurro_23569), [regolamento grassroots VCO 2024](https://piemontevda.lnd.it/wp-content/uploads/2024/01/regolamento-grassroots-VCO-2024.pdf).

## Question

Quali regole e riprese si implementano e con che fedeltà? Decidere per: rimessa laterale, rinvio dal fondo, calcio d'angolo, fallo e punizione, fuorigioco, rigore, durata della partita, tempo di gol e riprese. Per ognuna: sì/no/semplificato e come si presenta al giocatore. Output: elenco regole con livello di dettaglio.
