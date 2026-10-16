// Carica config/params.json, lo applica al motore e conserva le differenze rispetto ai predefiniti di sim.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyParams, diffParams } from '../../public/core/params.js';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'params.json');
export const params = JSON.parse(fs.readFileSync(file, 'utf8'));
export const differences = diffParams(params);
applyParams(params);

/** Test: params.json e predefiniti del motore coincidono. */
export function configSync() {
  return { differences: differences.length, first: differences[0] ? `${differences[0].path}: json ${differences[0].json}, motore ${differences[0].motore}` : '' };
}
