// Riassunto rapido dell'ultimo rapporto di npm run matches (uso interno di taratura).
import fs from 'node:fs';
const f = fs.readdirSync('reports').filter(x => x.startsWith('matches-7v7')).sort().pop(), r = JSON.parse(fs.readFileSync(`reports/${f}`));
console.log(JSON.stringify(r.riepilogo, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
