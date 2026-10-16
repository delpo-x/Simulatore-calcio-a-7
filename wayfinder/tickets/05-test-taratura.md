---
status: closed
type: grilling
blocked-by: []
assignee: claude (sessione corrente)
---

## Question

Come si misura e si tara la simulazione? Decidere: quali metriche registrare (tempo di passaggio, velocità di tiro, distanza di controllo, gol e tiri per partita IA contro IA), un registratore di partite in Node senza grafica, e il formato dei "test di gioco" per sottosistema. Output: formato dei test e lista metriche.

## Resolution

Approvata dall'utente ("procedi come suggerito").

Misura di partenza (motore attuale, 7 contro 7, 5 partite da 2 × 25 min in Node): circa 128 000 passi/s, cioè circa 2000 volte il tempo reale (una partita da 50 minuti in circa 1,5 s); circa 74 gol a partita contro il bersaglio provvisorio di 7–10, perché i parametri dei ticket chiusi non sono ancora applicati.

- **Registratore**: `node tools/run-matches.mjs --games 200 --players 7 --seed 1`, senza grafica. Scrive un JSON con le statistiche per partita e un riepilogo (medie, minimi, massimi, deviazione standard), più un file di eventi (gol, tiri, falli, passaggi) per il debug.
- **Test di gioco**: file dichiarativi JSON con `id`, sottosistema, scenario, misura, valore atteso, tolleranza e numero di prove. Due tipi: micro (scenario controllato: lancio di palla, sprint di 40 m, contrasti) e macro (partite IA contro IA).
- **Parametri**: un unico `params.json` versionato con i valori iniziali di tutti i ticket chiusi; il motore lo legge all'avvio e ogni report salva l'impronta del file.
- **Tolleranze**: micro, una prova deterministica, ±3%; probabilità (contrasti, falli, errori di passaggio), 10 000 prove, ±1 punto percentuale; macro, 200 partite con seed da 1 a 200, risultato = media con deviazione standard.
- **Taratura**: prima manuale, con un report delle differenze rispetto ai bersagli; poi una ricerca semplice (un parametro alla volta) solo per i parametri che nessun ticket ha deciso (probabilità di tiro dell'IA, tasso di falli).
- **Esito**: `npm run test:game` fallisce se un test micro o di probabilità è fuori tolleranza; i test macro sui bersagli segnaposto danno solo un avviso finché non arrivano dati reali.
- **Bersagli reali**: in un `targets.json` sostituibile; quando arrivano i dati del girone (o di `calibration.ts`) gli avvisi diventano errori.
- **Vista di debug**: il registratore salva posizioni di giocatori e palla a 10 Hz e la vista 3D esistente le rilegge (play, pausa, un passo). Nient'altro.
- **Prestazioni**: almeno 1000 volte il tempo reale a 7 contro 7 e 200 volte a 11 contro 11, verificato nel report.

Metriche per sottosistema (ognuna con id, valore atteso e tolleranza, ripresa dai test dei ticket chiusi): palla (tempo e velocità di arrivo di passaggi, tiro, rotolamento, lob); movimento (sprint su 40 m, accelerazione, virata, stamina, distanza palla); contrasti e falli (percentuale di successo, di falli, giallo, rosso); IA (errore dei passaggi, tiri, gol, possesso, passaggi per minuto); attributi (differenza di tempo con Velocità diversa, errori per attributo); formazioni (somme delle linee, distanze iniziali, scalatura); riprese (distanze regolamentari rispettate).
