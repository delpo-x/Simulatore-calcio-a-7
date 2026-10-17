// Pezzi di interfaccia condivisi: mappa dei tiri, pagelle.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Mappa dei tiri (SVG) vista dall'alto: la squadra di casa attacca a destra. Pieno = gol, anello = in porta, sbiadito = fuori. */
export function shotMap(shots, pitch, colors) {
  const { hx, hz, areaDepth: ad, areaWidth: aw, goalHalf: gh } = pitch, m = 2.2;
  const line = 'fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".25"';
  const area = s => `<rect x="${s > 0 ? hx - ad : -hx}" y="${-aw / 2}" width="${ad}" height="${aw}" ${line}/><rect x="${s > 0 ? hx : -hx - 1.2}" y="${-gh}" width="1.2" height="${2 * gh}" fill="rgba(255,255,255,.8)"/>`;
  const dots = [...shots].sort((a, b) => a.goal - b.goal || a.on - b.on).map(s => { // i gol sopra gli altri tiri
    const c = colors[s.team];
    if (s.goal) return `<circle cx="${s.x.toFixed(2)}" cy="${s.z.toFixed(2)}" r="1.05" fill="${c}" stroke="#fff" stroke-width=".35"/>`;
    if (s.on) return `<circle cx="${s.x.toFixed(2)}" cy="${s.z.toFixed(2)}" r=".8" fill="rgba(0,0,0,.25)" stroke="${c}" stroke-width=".4"/>`;
    return `<circle cx="${s.x.toFixed(2)}" cy="${s.z.toFixed(2)}" r=".6" fill="${c}" opacity=".45"/>`;
  }).join('');
  return `<svg class="shotmap" viewBox="${-hx - m} ${-hz - m} ${2 * (hx + m)} ${2 * (hz + m)}" role="img" aria-label="Mappa dei tiri">
    <rect x="${-hx}" y="${-hz}" width="${2 * hx}" height="${2 * hz}" fill="#1f6b3a" ${line.replace('fill="none" ', '')}/>
    <line x1="0" y1="${-hz}" x2="0" y2="${hz}" ${line}/><circle cx="0" cy="0" r="${Math.min(6, hz / 2.5)}" ${line}/>${area(1)}${area(-1)}${dots}</svg>
    <div class="sm-legend"><span><i class="sm-goal"></i>Gol</span><span><i class="sm-on"></i>In porta</span><span><i class="sm-off"></i>Fuori</span></div>`;
}

/** Classe di colore del voto. */
export const voteClass = v => v >= 7.5 ? 'v-hi' : v >= 6 ? 'v-ok' : v >= 5.5 ? 'v-mid' : 'v-lo';
export const fmtVote = v => (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',');

/** Tabella delle pagelle di una squadra: righe { num, name, gk, rating, goals, assists, shots, onTarget, passOk, passLost, saves, yellow, red, blue, own }. */
export function ratingsTable(rows, { head = '', color = '#fff', best = -1 } = {}) {
  const ev = r => [r.goals ? `<span title="Gol">⚽${r.goals > 1 ? `×${r.goals}` : ''}</span>` : '', r.own ? '<span title="Autogol" class="og">AG</span>' : '', r.assists ? `<span title="Assist">A${r.assists > 1 ? `×${r.assists}` : ''}</span>` : '',
    r.yellow ? '<span class="card yellow"></span>' : '', r.blue ? '<span class="card blue"></span>' : '', r.red ? '<span class="card red"></span>' : ''].join('');
  const extra = r => r.gk ? `${r.saves} parat${r.saves === 1 ? 'a' : 'e'}` : `${r.shots} tir${r.shots === 1 ? 'o' : 'i'} · ${r.passOk + r.passLost ? Math.round(100 * r.passOk / (r.passOk + r.passLost)) : 0}% pass.`;
  return `<div class="rt"><div class="rt-head" style="--c:${color}">${head}</div><ul>${rows.map(r => `
    <li${r.id === best ? ' class="best"' : ''}><span class="num">${r.num || ''}</span><span class="nm">${esc(r.name)}${r.id === best ? ' <b class="motm" title="Migliore in campo">★</b>' : ''}<small>${extra(r)}</small></span><span class="ev">${ev(r)}</span><span class="vote ${voteClass(r.rating)}">${fmtVote(r.rating)}</span></li>`).join('')}</ul></div>`;
}
