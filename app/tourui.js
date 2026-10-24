// Schermata del torneo: creazione, calendario, classifica, marcatori, voti, partite guardate o simulate.
import { FORMATS, MIN_TEAMS, MAX_TEAMS, createTournament, nextMatch, roundOf, record, champion, standings, scorers, ratingTable, matchSeed, compactResult, allMatches, roundDone } from './tournament.js';
import { shootout } from './headless.js';
import { esc, fmtVote, voteClass } from './views.js';

const KEY = 'calcio7.torneo';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = T => { try { if (T) localStorage.setItem(KEY, JSON.stringify(T)); else localStorage.removeItem(KEY); } catch { /* memoria del browser non disponibile */ } };

let worker = null, seq = 0;
const pending = new Map();
function viaWorker(job) {
  return new Promise((resolve, reject) => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => { const p = pending.get(data.id); if (!p) return; pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data); };
        worker.onerror = () => { for (const p of pending.values()) p.reject(new Error('worker')); pending.clear(); worker = null; };
      }
      const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage({ ...job, id });
    } catch (err) { reject(err); }
  });
}

/** Partita simulata senza grafica: in un worker, o (se non disponibile) sul thread principale. */
async function simulate(T, m) {
  const job = { home: T.teams[m.home], away: T.teams[m.away], opts: { perTeam: T.perTeam, half: T.half, seed: matchSeed(T, m) }, cup: T.format === 'cup' };
  try { return await viaWorker(job); } catch {
    const h = await import('./headless.js'), sum = h.playMatch(job.home, job.away, job.opts);
    return { sum, so: job.cup && sum.score[0] === sum.score[1] ? h.shootout(job.home, job.away, job.opts) : null };
  }
}

export function initTour({ root, teams, defaultHalf = 5, watch, back }) {
  let T = load(), tab = null, busy = '', setup = { name: '', format: 'league', half: defaultHalf, picked: new Set(teams().slice(0, 4).map(t => t.id)) };
  if (T && !T.teams) T = null;

  const dot = i => `<i class="t-dot" style="background:${esc(T.teams[i].kit.shirt)}"></i>`;
  const tn = i => `${dot(i)}${esc(T.teams[i].name)}`;
  const persist = () => save(T);

  function renderSetup() {
    const list = teams();
    root.innerHTML = `<section class="t-card"><h2>Nuovo torneo</h2>
      <div class="t-form">
        <label>Nome<input id="t-name" maxlength="32" placeholder="${esc(FORMATS[setup.format])}" value="${esc(setup.name)}"></label>
        <label>Formato<select id="t-format">${Object.entries(FORMATS).map(([k, v]) => `<option value="${k}"${k === setup.format ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Durata di un tempo<select id="t-half">${[3, 5, 10, 15, 25].map(m => `<option value="${m}"${m === setup.half ? ' selected' : ''}>${m} minuti</option>`).join('')}</select></label>
      </div>
      <h3>Squadre <small>(da ${MIN_TEAMS} a ${MAX_TEAMS}; salva le tue dal menu per aggiungerle qui)</small></h3>
      <div class="t-picks">${list.map(t => `<label class="t-pick"><input type="checkbox" value="${esc(t.id)}"${setup.picked.has(t.id) ? ' checked' : ''}><i class="t-dot" style="background:${esc(t.kit.shirt)}"></i>${esc(t.name)}<small>${t.level ? `liv. ${t.level}` : 'da file'}</small></label>`).join('')}</div>
      <p class="note" id="t-msg"></p>
      <div class="t-actions"><button class="primary" id="t-create">Crea torneo</button>${T ? '<button class="ghost" id="t-cancel">Annulla</button>' : ''}</div></section>`;
    const msg = txt => { root.querySelector('#t-msg').textContent = txt; };
    root.querySelector('#t-name').oninput = e => { setup.name = e.target.value; };
    root.querySelector('#t-format').onchange = e => { setup.format = e.target.value; renderSetup(); };
    root.querySelector('#t-half').onchange = e => { setup.half = +e.target.value; };
    root.querySelectorAll('.t-pick input').forEach(i => { i.onchange = () => { i.checked ? setup.picked.add(i.value) : setup.picked.delete(i.value); }; });
    root.querySelector('#t-create').onclick = () => {
      const chosen = list.filter(t => setup.picked.has(t.id));
      if (chosen.length < MIN_TEAMS || chosen.length > MAX_TEAMS) return msg(`Scegli da ${MIN_TEAMS} a ${MAX_TEAMS} squadre (ora ${chosen.length}).`);
      T = createTournament({ name: setup.name, format: setup.format, teams: chosen, perTeam: 7, half: setup.half, seed: 1 + Math.floor(Math.random() * 999999999) });
      tab = null; persist(); render();
    };
    const c = root.querySelector('#t-cancel'); if (c) c.onclick = render;
  }

  const score = m => m.res ? `<b class="t-sc">${m.res.score[0]}-${m.res.score[1]}</b>${m.res.so ? `<small>rig. ${m.res.so.score[0]}-${m.res.so.score[1]}</small>` : ''}` : '<span class="t-sc t-todo">–</span>';

  function viewCalendar(next) {
    return T.rounds.map(rd => `<div class="t-round"><h4>${esc(rd.name)}</h4>${rd.matches.map(m => `
      <div class="t-match${m === next ? ' next' : ''}"><span class="h">${tn(m.home)}</span>${score(m)}<span class="a">${tn(m.away)}</span></div>`).join('')}
      ${rd.byes?.length ? `<p class="note">Passano il turno: ${rd.byes.map(i => esc(T.teams[i].name)).join(', ')}</p>` : ''}</div>`).join('');
  }

  function viewStandings() {
    const rows = standings(T);
    return `<table class="t-table"><thead><tr><th>#</th><th class="l">Squadra</th><th>G</th><th>V</th><th>N</th><th>S</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th><th>Forma</th></tr></thead><tbody>${rows.map((r, i) => `
      <tr><td>${i + 1}</td><td class="l">${tn(r.team)}</td><td>${r.P}</td><td>${r.V}</td><td>${r.N}</td><td>${r.S}</td><td>${r.GF}</td><td>${r.GS}</td><td>${r.DR > 0 ? '+' : ''}${r.DR}</td><td><b>${r.Pt}</b></td><td class="form">${r.form.map(f => `<span class="f-${f}">${f}</span>`).join('')}</td></tr>`).join('')}</tbody></table>
      <p class="note">3 punti per vittoria, 1 per pareggio; a parità differenza reti, gol fatti, nome.</p>`;
  }

  function viewScorers() {
    const rows = scorers(T).slice(0, 15);
    if (!rows.length) return '<p class="note">Ancora nessun gol.</p>';
    return `<table class="t-table"><thead><tr><th>#</th><th class="l">Giocatore</th><th class="l">Squadra</th><th>Gol</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.name)}</td><td class="l">${tn(r.team)}</td><td><b>${r.goals}</b></td></tr>`).join('')}</tbody></table>`;
  }

  function viewRatings() {
    const rows = ratingTable(T).slice(0, 15);
    if (!rows.length) return '<p class="note">Ancora nessun voto.</p>';
    return `<table class="t-table"><thead><tr><th>#</th><th class="l">Giocatore</th><th class="l">Squadra</th><th>Media</th><th>Gol</th><th>Ass.</th><th>★</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.name)}</td><td class="l">${tn(r.team)}</td><td><span class="vote ${voteClass(r.avg)}">${fmtVote(Math.round(r.avg * 10) / 10)}</span></td><td>${r.goals}</td><td>${r.assists}</td><td>${r.best || ''}</td></tr>`).join('')}</tbody></table>
      <p class="note">Media dei voti; compaiono i giocatori con almeno metà delle partite della loro squadra. ★ = migliore in campo.</p>`;
  }

  function render() {
    if (!T) return renderSetup();
    const next = nextMatch(T), over = !next, league = T.format !== 'cup';
    const tabs = [...(league ? [['cls', 'Classifica']] : []), ['cal', league ? 'Calendario' : 'Tabellone'], ['sc', 'Marcatori'], ['vt', 'Voti']];
    if (!tab || !tabs.some(t => t[0] === tab)) tab = tabs[0][0];
    const rd = next && T.rounds[roundOf(T, next)], left = rd ? rd.matches.filter(m => !m.res).length : 0;
    let head;
    if (over) {
      const c = champion(T);
      head = `<div class="t-champ"><span>${league ? 'Campione' : 'Vincitore della coppa'}</span><b>${tn(c)}</b></div>`;
    } else {
      head = `<div class="t-next"><div class="t-next-l">Prossima partita · ${esc(rd.name)}</div><div class="t-next-m"><span>${tn(next.home)}</span><i>contro</i><span>${tn(next.away)}</span></div>
        <div class="t-actions"><button class="primary" data-a="watch"${busy ? ' disabled' : ''}>Guarda</button><button class="ghost" data-a="sim"${busy ? ' disabled' : ''}>Simula</button>
        ${left > 1 ? `<button class="ghost" data-a="round"${busy ? ' disabled' : ''}>Simula ${league ? 'giornata' : 'turno'}</button>` : ''}<button class="ghost" data-a="all"${busy ? ' disabled' : ''}>Simula tutto</button></div></div>`;
    }
    const body = { cls: viewStandings, cal: () => viewCalendar(next), sc: viewScorers, vt: viewRatings }[tab]();
    root.innerHTML = `<section class="t-card"><div class="t-top"><div><h2>${esc(T.name)}</h2><small>${esc(FORMATS[T.format])} · ${T.teams.length} squadre · tempi da ${T.half} minuti</small></div>
      <div class="t-actions"><button class="ghost small" data-a="new"${busy ? ' disabled' : ''}>Nuovo torneo</button></div></div>
      ${head}<p class="note" id="t-busy">${esc(busy)}</p>
      <div class="tabs t-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}"${k === tab ? ' class="on"' : ''}>${l}</button>`).join('')}</div>
      <div class="t-body">${body}</div></section>`;
    root.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
    root.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => act(b.dataset.a); });
  }

  async function runSims(limit) {
    let done = 0;
    for (let m; (m = nextMatch(T)) && done < limit; done++) {
      busy = `Simulazione di ${T.teams[m.home].name} contro ${T.teams[m.away].name}…`; render();
      const { sum, so } = await simulate(T, m);
      record(T, m.id, compactResult(sum, so)); persist();
    }
    busy = ''; render();
  }

  function act(a) {
    if (busy) return;
    const next = nextMatch(T);
    if (a === 'new') { if (!confirm('Chiudere il torneo in corso e crearne uno nuovo?')) return; T = null; save(null); setup.picked = new Set(teams().slice(0, 4).map(t => t.id)); return render(); }
    if (!next) return;
    if (a === 'watch') watch(T, next);
    else if (a === 'sim') runSims(1);
    else if (a === 'round') runSims(T.rounds[roundOf(T, next)].matches.filter(m => !m.res).length);
    else if (a === 'all') runSims(Infinity);
  }

  return {
    /** Mostra il torneo salvato (o la creazione di uno nuovo). */
    open() { busy = ''; render(); },
    /** Registra l'esito di una partita guardata; restituisce i rigori, se ci sono stati. */
    result(matchId, sum) {
      const m = allMatches(T).find(x => x.id === matchId);
      if (!m || m.res) return m?.res?.so ?? null;
      const so = T.format === 'cup' && sum.score[0] === sum.score[1] ? shootout(T.teams[m.home], T.teams[m.away], { perTeam: T.perTeam, seed: matchSeed(T, m) }) : null;
      record(T, matchId, compactResult(sum, so)); persist();
      return so;
    },
    back,
  };
}
