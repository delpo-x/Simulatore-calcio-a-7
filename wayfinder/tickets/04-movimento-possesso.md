---
status: closed
type: grilling
blocked-by: []
assignee: claude (sessione corrente)
---

## Question

Come si muovono i giocatori e come funziona il possesso? Decidere: velocità di corsa e sprint, accelerazione, curva di sterzata, resistenza (stamina sì o no), come la palla segue il portatore (controllo vicino/lontano), come si perde il possesso (contrasto, intercetto), spinta tra giocatori. Output: parametri con valori iniziali e test misurabili.

## Resolution

Parametri decisi (valori iniziali, da applicare in `public/core/sim.js` in esecuzione):

| Parametro | Valore | Test di gioco |
|---|---|---|
| Velocità di corsa / sprint | 6,0 / 8,0 m/s | un giocatore in sprint percorre 40 m in 5,5–6,5 s partendo da fermo |
| Accelerazione | costante di tempo 0,6 s (90% del regime in circa 1,4 s) | da fermo a 90% dello sprint in 1,2–1,6 s |
| Sterzata | 8 rad/s da fermo, 3 rad/s a velocità massima; virata oltre 90° = −30% velocità | inversione a 180° in sprint: velocità residua circa 70% |
| Stamina | serbatoio 0–1; sprint lo consuma in ~25 s, recupero a passo normale in ~40 s; a serbatoio basso velocità massima fino a −15% | sprint continuo 30 s: velocità finale 85% di quella iniziale |
| Controllo palla | distanza palla = 0,5 m + 0,08 × velocità (≈1,1 m in sprint); in sprint più facile da rubare | palla a 1,0–1,2 m davanti al portatore in sprint |
| Contrasto | raggio 1,3 m; successo base 55%, più alto di lato o da dietro, più basso se il portatore è in sprint; esito dal generatore con seed (riproducibile) | su 1000 contrasti frontali al passo la percentuale è 50–60% |
| Intercetto e raccolta | raggio 0,9 m (portiere 1,7 m); palla sotto 1,1 m e sotto 16 m/s (portiere 30 m/s) | portiere ferma un tiro a 28 m/s entro 1,7 m, un giocatore no |
| Urti | distanza minima 0,8 m, si respingono senza perdere velocità; urto con velocità relativa oltre 6 m/s stordisce per 0,3 s il giocatore colpito da dietro | nessuna sovrapposizione stabile sotto 0,8 m; stordimento solo sopra 6 m/s |

Il fallo sul contrasto lo decide il ticket Regole. Giocatori tutti uguali per ora: la differenziazione per attributi è in fumo (Not yet specified).
