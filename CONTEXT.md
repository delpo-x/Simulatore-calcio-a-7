# Glossario

**Core**: modulo ES caricato dallo shell che esegue una partita (`start`/`stop`). Quello di calcio è `public/core/index.js`.

**Shell**: la pagina con lanciatore, impostazioni, mandi, salvataggi. Non contiene il gioco.

**Simulazione**: logica della partita a passo fisso (60 al secondo), deterministica, senza grafica.

**Clean-room**: sviluppo da specifiche di comportamento osservabile, senza copiare codice, asset o dati di un altro prodotto.

**Possesso**: stato in cui un giocatore porta la palla.

**Parametro di sensazione**: valore numerico regolabile che determina come "si sente" il gioco (velocità, accelerazione, forza di tiro).

**Test di gioco**: verifica concreta e misurabile su un parametro di sensazione (per esempio il tempo di un passaggio di 20 m).

**Amichevole**: partita singola, contro IA o in locale. L'unica modalità nel perimetro.

**Sostituzione**: cambio a gioco fermo (infortunio o a tempo, al massimo 3 per squadra). Il subentrato prende lo slot e l'id dell'uscito; le statistiche dell'uscito restano in una pagella a parte (`MatchStats.left`).
