// Partite del torneo simulate in background (senza grafica), per non bloccare l'interfaccia.
import { playMatch, shootout } from './headless.js';

onmessage = ({ data: { id, home, away, opts, cup } }) => {
  try {
    const sum = playMatch(home, away, opts), so = cup && sum.score[0] === sum.score[1] ? shootout(home, away, opts) : null;
    postMessage({ id, sum, so });
  } catch (err) { postMessage({ id, error: err.message }); }
};
