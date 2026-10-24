// App del simulatore: menu, partita in 3D con tabellone, regia, cronaca, statistiche, replay dei gol.
import { Sim, DT, SCHEMES } from '../core/sim.js';
import { readTeam } from '../core/team.js';
import { TVRenderer, contrast } from './render3d.js';
import { MatchStats } from './stats.js';
import { Recorder, Player as ReplayPlayer } from './replay.js';
import { PRESETS, lineupFor, loadCustom, saveCustom } from './teams.js';
import { MatchAudio } from './audio.js';
import { Commentary } from './commentary.js';
import { summarize } from './headless.js';
import { initTour } from './tourui.js';
import { matchSeed } from './tournament.js';
import { shotMap, ratingsTable, fmtVote, voteClass } from './views.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clone = o => JSON.parse(JSON.stringify(o));
const SPEEDS = [0.5, 1, 2, 4, 8, 16], CAMS = [['tv', 'TV'], ['alto', 'Alto'], ['segui', 'Segui'], ['porta', 'Porta']];
const ROLE = { Goalkeeper: 'POR', Defender: 'DIF', Midfielder: 'CEN', Forward: 'ATT' };
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.3 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM15 9.4l1.4-1.4 2.6 2.6 2.6-2.6L23 9.4 20.4 12l2.6 2.6-1.4 1.4-2.6-2.6-2.6 2.6-1.4-1.4 2.6-2.6z"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM4 15h2v3h3v2H4zm14 0h2v5h-5v-2h3z"/></svg>',
};

// ---------------------------------------------------------------- menu

const MENU_KEY = 'calcio7.menu';
function loadMenu() {
  let m = null; try { m = JSON.parse(localStorage.getItem(MENU_KEY)); } catch { /* niente */ }
  return { perTeam: 7, half: 25, seed: '', autoReplay: true, commentary: true, captions: true, teams: [clone(PRESETS[0]), clone(PRESETS[1])], ...m };
}
function saveMenu() { try { localStorage.setItem(MENU_KEY, JSON.stringify(cfg)); } catch { /* niente */ } }

const cfg = loadMenu();
let custom = loadCustom();

const shirtSvg = k => `<svg viewBox="0 0 64 64" class="kit-svg" aria-hidden="true">
  <path d="M20 6l-14 8 5 12 6-3v31h30V23l6 3 5-12-14-8c-2 4-6 6-12 6s-10-2-12-6z" fill="${k.shirt}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
  <path d="M17 54h30v6H17z" fill="${k.shorts}"/></svg>`;

function teamCard(side) {
  const card = $(`.team-card[data-side="${side}"]`), d = cfg.teams[side], n = cfg.perTeam;
  const opts = list => list.map(t => `<option value="${esc(t.id)}"${t.id === d.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
  card.innerHTML = `
    <div class="tc-head" style="--shirt:${esc(d.kit.shirt)}">${shirtSvg(d.kit)}<div><div class="tc-side">${side ? 'Ospiti' : 'Casa'}</div><div class="tc-name">${esc(d.name)}</div></div></div>
    <label>Squadra<select class="f-pick">
      <optgroup label="Predefinite">${opts(PRESETS)}</optgroup>
      ${custom.length ? `<optgroup label="Le tue squadre">${opts(custom)}</optgroup>` : ''}
      ${d.file && !custom.some(c => c.id === d.id) ? `<optgroup label="Da file"><option value="${esc(d.id)}" selected>${esc(d.name)}</option></optgroup>` : ''}
    </select></label>
    <div class="row2">
      <label>Nome<input class="f-name" maxlength="24" value="${esc(d.name)}"></label>
      <label class="short">Sigla<input class="f-short" maxlength="3" value="${esc(d.short)}"></label>
    </div>
    <div class="kit">
      ${[['shirt', 'Maglia'], ['shorts', 'Calzoncini'], ['socks', 'Calzettoni'], ['gk', 'Portiere']].map(([k, l]) => `<label>${l}<input type="color" data-kit="${k}" value="${esc(d.kit[k])}"></label>`).join('')}
    </div>
    <div class="row2">
      <label>Modulo<select class="f-scheme">${SCHEMES[n].map(s => `<option${s === d.scheme ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Livello <output>${d.file ? 'da file' : d.level}</output><input type="range" class="f-level" min="8" max="20" value="${d.level ?? 15}"${d.file ? ' disabled' : ''}></label>
    </div>
    <div class="tc-actions">
      <button class="ghost small f-save">Salva</button>
      ${custom.some(c => c.id === d.id) ? '<button class="ghost small f-del">Elimina</button>' : ''}
      <label class="ghost small file-btn">Carica file squadra<input type="file" accept=".json,application/json" hidden></label>
    </div>
    <div class="tc-msg"></div>`;
  const msg = t => { $('.tc-msg', card).textContent = t; };
  const redraw = () => { saveMenu(); teamCard(side); updateNote(); };
  $('.f-pick', card).onchange = e => { const t = [...PRESETS, ...custom].find(x => x.id === e.target.value); if (t) { cfg.teams[side] = clone(t); redraw(); } };
  $('.f-name', card).oninput = e => { d.name = e.target.value.trim() || 'Squadra'; $('.tc-name', card).textContent = d.name; saveMenu(); };
  $('.f-short', card).oninput = e => { d.short = e.target.value.toUpperCase(); saveMenu(); };
  $('.f-name', card).onchange = () => { if (!d.short) d.short = d.name.slice(0, 3).toUpperCase(); redraw(); };
  $$('[data-kit]', card).forEach(i => { i.oninput = () => { d.kit[i.dataset.kit] = i.value; $('.tc-head', card).innerHTML = $('.tc-head', card).innerHTML.replace(/<svg[\s\S]*?<\/svg>/, shirtSvg(d.kit)); saveMenu(); updateNote(); }; });
  $('.f-scheme', card).onchange = e => { d.scheme = e.target.value; saveMenu(); };
  $('.f-level', card).oninput = e => { d.level = +e.target.value; $('output', card).textContent = d.level; saveMenu(); };
  $('.f-save', card).onclick = () => {
    const mine = d.id?.startsWith('c-') ? d : { ...clone(d), id: `c-${Date.now().toString(36)}` };
    custom = custom.filter(c => c.id !== mine.id).concat(clone(mine)); saveCustom(custom);
    cfg.teams[side] = clone(mine); redraw(); msg('Squadra salvata nel browser.');
  };
  const del = $('.f-del', card);
  if (del) del.onclick = () => { custom = custom.filter(c => c.id !== d.id); saveCustom(custom); cfg.teams[side] = clone(PRESETS[side]); saveMenu(); teamCard(0); teamCard(1); updateNote(); };
  $('input[type=file]', card).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const obj = JSON.parse(await f.text()), t = readTeam(obj);
      cfg.teams[side] = { id: `f-${Date.now().toString(36)}`, name: t.name, short: t.name.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase() || 'SQU', kit: clone(d.kit), level: null, scheme: d.scheme, file: obj };
      redraw();
    } catch (err) { msg(`File non valido: ${err.message}`); }
  };
}

function colorDist(a, b) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) || 0), x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }

/** Maglie delle due squadre; se si confondono, gli ospiti usano la seconda maglia (colori invertiti, oppure bianca o nera). */
function kitsFor(defs) {
  const k0 = { ...defs[0].kit }, k1 = { ...defs[1].kit };
  if (colorDist(k0.shirt, k1.shirt) >= 110) return { kits: [k0, k1], alt: false };
  const c = [k1.shorts, '#ffffff', '#111111'].find(x => colorDist(x, k0.shirt) >= 110) ?? '#ffffff';
  return { kits: [k0, { ...k1, shirt: c, socks: c, shorts: k1.shirt, pattern: 'plain', trim: undefined }], alt: true };
}

function updateNote() {
  const notes = [];
  if (cfg.perTeam !== 7) notes.push(`Il formato a ${cfg.perTeam} funziona ma non è tarato: risultati indicativi.`);
  if (kitsFor(cfg.teams).alt) notes.push(`Maglie simili: ${cfg.teams[1].name} giocherà con la seconda maglia.`);
  $('#menu-note').textContent = notes.join(' ');
}

function initMenu() {
  $('#opt-n').innerHTML = Object.keys(SCHEMES).map(n => `<option value="${n}"${+n === cfg.perTeam ? ' selected' : ''}>${n}${+n === 7 ? ' (tarato)' : ''}</option>`).join('');
  $('#opt-n').onchange = e => {
    cfg.perTeam = +e.target.value;
    for (const t of cfg.teams) if (!SCHEMES[cfg.perTeam].includes(t.scheme)) t.scheme = SCHEMES[cfg.perTeam][0];
    saveMenu(); teamCard(0); teamCard(1); updateNote();
  };
  $('#opt-half').value = String(cfg.half);
  $('#opt-half').onchange = e => { cfg.half = +e.target.value; saveMenu(); };
  $('#opt-seed').value = cfg.seed;
  $('#opt-seed').oninput = e => { cfg.seed = e.target.value.replace(/\D/g, '').slice(0, 9); e.target.value = cfg.seed; saveMenu(); };
  $('#opt-replay').checked = cfg.autoReplay;
  $('#opt-replay').onchange = e => { cfg.autoReplay = e.target.checked; saveMenu(); };
  $('#start').onclick = () => startMatch();
  teamCard(0); teamCard(1); updateNote();
}

// ---------------------------------------------------------------- partita

let G = null, R = null;

function startMatch(seed, ov = null) {
  const n = ov?.n ?? cfg.perTeam, defs = clone(ov?.defs ?? cfg.teams);
  const schemes = defs.map(d => SCHEMES[n].includes(d.scheme) ? d.scheme : SCHEMES[n][0]);
  let lineups;
  try { lineups = defs.map((d, i) => lineupFor(d, n, schemes[i])); }
  catch (err) { $('#menu-note').textContent = `Impossibile schierare la squadra: ${err.message}`; if (ov) alert(`Impossibile schierare la squadra: ${err.message}`); return; }
  seed = seed ?? (cfg.seed ? +cfg.seed : 1 + Math.floor(Math.random() * 999999999));
  const sim = new Sim({ perTeam: n, seed, halfLength: (ov?.half ?? cfg.half) * 60, schemes, teams: lineups });
  const byTeam = [0, 1].map(t => sim.players.filter(p => p.team === t));
  const info = sim.players.map(p => { const i = byTeam[p.team].indexOf(p), l = lineups[p.team][i]; return { num: l.number, role: ROLE[l.position] ?? '', offRole: l.offRole }; });
  const { kits } = kitsFor(defs);
  G = { ov, sim, defs, kits, schemes, seed, info, stats: new MatchStats(sim), rec: new Recorder(), speed: 1, paused: false, cam: 0, replay: null, queue: [], skipping: false, ended: false, acc: 0, panelT: 0 };
  A.start();
  const kick = sim.kick.bind(sim); sim.kick = (p, dx, dz, sp, ...r) => { if (sounds()) A.kick(sp); return kick(p, dx, dz, sp, ...r); };
  G.cm = new Commentary(sim, { name: id => G.stats.name(id), team: t => defs[t].name });
  G.stats.onShot = (p, on) => { if (!on && sounds()) setTimeout(() => A.roar('ooh'), 350); };
  G.rec.onClip = clip => { if (cfg.autoReplay && !G.skipping && G.speed <= 4 && !G.replay) playClips([clip], true); };

  $('#menu').hidden = true; $('#tour').hidden = true; $('#match').hidden = false; $('#end').hidden = true;
  if (R) R.dispose();
  R = new TVRenderer($('#view'), sim.pitch, { kits, nums: info.map(i => i.num), label: id => `${G.sim.players[id].number ?? G.info[id].num}  ${playerName(id)}` });
  R.setCamera(CAMS[G.cam][0]); R.snap = true;
  for (const side of [0, 1]) {
    const t = $(`.sb-team[data-side="${side}"]`);
    $('i', t).style.background = kits[side].shirt; $('i', t).style.borderColor = kits[side].shorts;
    $('.sb-name', t).textContent = (defs[side].short || defs[side].name.slice(0, 3)).toUpperCase();
    t.title = defs[side].name;
  }
  document.documentElement.style.setProperty('--t0', kits[0].shirt); document.documentElement.style.setProperty('--t1', kits[1].shirt);
  $('#feed').innerHTML = ''; renderLineups(); renderStats();
  setPanel(innerWidth >= 1100);
  hideBanner(); $('#lower').hidden = true;
  updateControls();
  showLower(`${esc(defs[0].name)} <span class="vs-mini">contro</span> ${esc(defs[1].name)}`, 'intro', 3.5);
}

const A = new MatchAudio();
const WHISTLE = new Set(['foul', 'offside', 'backpass', 'gkHold', 'dangerous', 'obstruction']);
/** Suoni dei singoli episodi solo a velocita' normale (a 16x sarebbero un rumore continuo). */
const sounds = () => G && !G.skipping && !G.replay && G.speed <= 2;

function tick() {
  const s = G.sim, before = s.state; s.step();
  const items = G.stats.step(); G.rec.step(s, items);
  if (sounds()) {
    if (before !== 'play' && before !== 'full' && s.state === 'play') A.whistle(1, 0.35); // calcio d'inizio
    if (s.events.some(e => WHISTLE.has(e.t))) A.whistle();
  }
  if (!G.skipping && !G.replay && G.speed <= 4) for (const e of s.events) {
    if (e.t === 'goal') A.roar('goal');
    else if (e.t === 'half') A.whistle(2, 0.45);
    else if (e.t === 'full') A.whistle(3, 0.5);
  }
  if (items.length) onItems(items);
  const lines = G.cm.step();
  if (!G.skipping) for (const l of lines) { addFeed(l); if (cfg.captions && !G.replay) showCaption(l.text); }
}

/** Pubblico: piu' rumoroso quando la palla e' vicina a una porta. */
function crowdLevel() {
  if (!G || G.paused || G.ended) return G?.ended ? 0.25 : 0.12;
  const s = G.sim, x = Math.abs(s.ball.x) / s.pitch.hx;
  return 0.3 + 0.7 * Math.max(0, Math.min(1, (x - 0.45) / 0.5));
}

const teamName = t => G.defs[t].name;
const playerName = id => G.stats.name(id);
const mmss = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function onItems(items) {
  for (const it of items) {
    addFeed(it);
    if (G.skipping) continue;
    if (it.t === 'goal') showBanner(`<div class="b-kicker">${it.own ? 'Autogol' : 'Gol'}</div><div class="b-big">GOL!</div><div class="b-sub">${esc(playerName(it.player))}${it.own ? ' (aut.)' : ''} · ${esc(teamName(it.team))} · ${it.score[0]}-${it.score[1]}</div>`, it.team, 3);
    else if (it.t === 'yellow') showLower(`<span class="card yellow"></span>${esc(playerName(it.player))} <small>${esc(teamName(it.team))}</small>`, 'card');
    else if (it.t === 'red') showLower(`<span class="card red"></span>${esc(playerName(it.player))} <small>${it.second ? 'seconda ammonizione' : 'espulso'}</small>`, 'card');
    else if (it.t === 'blue') showLower(`<span class="card blue"></span>${esc(playerName(it.player))} <small>${it.protest ? 'proteste, ' : ''}fuori 5 minuti</small>`, 'card');
    else if (it.t === 'offside') showLower(`Fuorigioco · ${esc(playerName(it.player))}`, 'info', 2);
    else if (it.t === 'injury') showLower(`Infortunio · ${esc(playerName(it.player))} <small>${esc(teamName(it.team))}</small>`, 'info', 2.5);
    else if (it.t === 'sub') showLower(`Cambio ${esc(teamName(it.team))}: entra ${esc(playerName(it.player))}, esce ${esc(it.out)}`, 'info', 3);
    else if (it.t === 'penalty') showLower(`Calcio di rigore per ${esc(teamName(it.team))}`, 'info', 2.5);
    else if (it.t === 'half') showBanner(`<div class="b-kicker">Intervallo</div><div class="b-big">${it.score[0]} - ${it.score[1]}</div><div class="b-sub">Fine primo tempo</div>`, -1, 3);
    else if (it.t === 'full') { showBanner(`<div class="b-kicker">Fischio finale</div><div class="b-big">${it.score[0]} - ${it.score[1]}</div>`, -1, 2.5); }
  }
  if (items.some(i => i.t === 'full')) { G.ended = true; updateControls(); if (!G.skipping) setTimeout(() => G?.ended && !G.replay && showEnd(), 2600); }
  refreshPanel();
  if (items.some(i => ['yellow', 'red', 'blue', 'sub'].includes(i.t))) renderLineups();
}

const FEED = {
  goal: it => `<b>${it.own ? 'Autogol' : 'Gol'}</b> ${esc(playerName(it.player))} <span class="sc">${it.score[0]}-${it.score[1]}</span>`,
  yellow: it => `<span class="card yellow"></span>Ammonito ${esc(playerName(it.player))}`,
  red: it => `<span class="card red"></span>Espulso ${esc(playerName(it.player))}${it.second ? ' (doppia ammonizione)' : ''}`,
  blue: it => `<span class="card blue"></span>Cartellino azzurro a ${esc(playerName(it.player))}${it.protest ? ' per proteste' : ''}`,
  offside: it => `Fuorigioco di ${esc(playerName(it.player))}`,
  penalty: it => `Rigore per ${esc(teamName(it.team))}`,
  injury: it => `Infortunio per ${esc(playerName(it.player))}`,
  sub: it => `Cambio ${esc(teamName(it.team))}: entra ${esc(playerName(it.player))}, esce ${esc(it.out)}`,
  half: it => `<b>Fine primo tempo</b> <span class="sc">${it.score[0]}-${it.score[1]}</span>`,
  full: it => `<b>Fine partita</b> <span class="sc">${it.score[0]}-${it.score[1]}</span>`,
  cm: it => esc(it.text),
};

function addFeed(it) {
  const li = document.createElement('li'), side = it.team ?? -1;
  li.className = `f-${it.t}`; li.style.setProperty('--c', side >= 0 ? G.kits[side].shirt : 'transparent');
  li.innerHTML = `<span class="min">${it.min}′</span><span class="txt">${FEED[it.t](it)}</span>${it.t === 'goal' ? '<span class="rp" title="Rivedi">▶</span>' : ''}`;
  if (it.t === 'goal') { li.tabIndex = 0; li.onclick = li.onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter') return; const c = G.rec.clips.find(c => c.item === it); if (c) playClips([c]); }; }
  $('#feed').prepend(li);
}

function renderStats() {
  if (!G) return;
  const head = `<div class="st-head"><span style="--c:${G.kits[0].shirt}">${esc(G.defs[0].name)}</span><span style="--c:${G.kits[1].shirt}">${esc(G.defs[1].name)}</span></div>`;
  $('#stats').innerHTML = head + G.stats.rows().map(([l, a, b, u = '']) => {
    const t = a + b || 1;
    return `<div class="st-row"><div class="st-vals"><b>${a}${u}</b><span>${l}</span><b>${b}${u}</b></div><div class="st-bar"><i style="width:${100 * a / t}%;background:${G.kits[0].shirt}"></i><i style="width:${100 * b / t}%;background:${G.kits[1].shirt}"></i></div></div>`;
  }).join('') + `<h4 class="st-sub">Mappa dei tiri <small>${esc(G.defs[0].name)} attacca a destra</small></h4>${shotMap(G.stats.shotList, G.sim.pitch, G.kits.map(k => k.shirt))}`;
}

/** Righe delle pagelle di una squadra (voti calcolati sul momento: durante la partita sono provvisori). */
function playerRows(t) {
  return [...G.sim.players.filter(p => p.team === t).map(p => ({ id: p.id, num: G.sim.players[p.id].number ?? G.info[p.id].num, name: playerName(p.id), gk: p.gk, rating: G.stats.rating(p.id), ...G.stats.ps[p.id] })), ...G.stats.left.filter(x => x.team === t).map(x => ({ ...x, num: x.num || G.info[x.id].num }))];
}

function renderRatings() {
  if (!G) return;
  const best = G.ended ? G.stats.best() : -1;
  $('#ratings').innerHTML = `<p class="note rt-note">${G.ended ? '★ migliore in campo.' : 'Voti provvisori: cambiano fino al fischio finale.'} Base 6; contano gol, assist, tiri in porta, passaggi, recuperi, parate, gol subiti, falli, cartellini e risultato.</p>`
    + [0, 1].map(t => ratingsTable(playerRows(t), { head: esc(G.defs[t].name), color: G.kits[t].shirt, best })).join('');
}

const TAC = [
  ['press', 'Pressing', [['Basso', 9], ['Medio', 14], ['Alto', 20]]],
  ['line', 'Linea difensiva', [['Bassa', 0.15], ['Media', 0.25], ['Alta', 0.35]]],
  ['width', 'Ampiezza', [['Stretta', 0.85], ['Normale', 1], ['Larga', 1.15]]],
  ['tempo', 'Ritmo', [['Basso', 0.8], ['Normale', 1], ['Alto', 1.25]]],
];
/** Scheda Tattica: modulo, pressing, linea, ampiezza e ritmo di ogni squadra, modificabili anche durante la partita. */
function renderTactics() {
  if (!G) return;
  const s = G.sim, n = G.ov?.n ?? cfg.perTeam;
  $('#tactics').innerHTML = [0, 1].map(t => `<div class="tc" data-t="${t}"><div class="lu-head" style="--c:${G.kits[t].shirt}">${esc(G.defs[t].name)}</div>
    <label>Modulo<select data-k="scheme">${SCHEMES[n].map(m => `<option${m === G.schemes[t] ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
    ${TAC.map(([k, label, opts]) => `<label>${label}<select data-k="${k}">${opts.map(([l, v]) => `<option value="${v}"${Math.abs(s.tac[t][k] - v) < 1e-6 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div>`).join('')
    + '<p class="note">Il cambio vale subito. I giocatori prendono i nuovi posti in questo ordine: portiere, difesa, centrocampo, attacco.</p>';
  $$('#tactics select').forEach(sel => {
    sel.onchange = () => {
      const t = +sel.closest('.tc').dataset.t, k = sel.dataset.k;
      if (k === 'scheme') { G.sim.setScheme(t, sel.value); G.schemes[t] = sel.value; }
      else G.sim.setTactics(t, { [k]: +sel.value });
      const label = k === 'scheme' ? `nuovo modulo ${sel.value}` : `${TAC.find(x => x[0] === k)[1].toLowerCase()}: ${sel.selectedOptions[0].textContent.toLowerCase()}`;
      addFeed({ t: 'cm', min: G.stats.minute(), team: t, text: `${G.defs[t].name}, cambio tattico (${label}).` });
    };
  });
}

function renderLineups() {
  if (!G) return;
  const s = G.sim;
  $('#lineups').innerHTML = [0, 1].map(t => `<div class="lu"><div class="lu-head" style="--c:${G.kits[t].shirt}">${esc(G.defs[t].name)} <small>${G.schemes[t]}</small></div><ul>${
    s.players.filter(p => p.team === t).map(p => {
      const i = G.info[p.id], st = p.blueUntil > s.matchTime ? '<span class="card blue"></span>' : p.out ? '<span class="card red"></span>' : p.yellow ? '<span class="card yellow"></span>' : '';
      return `<li class="${p.out ? 'out' : ''}"><span class="num" style="background:${p.gk ? G.kits[t].gk : G.kits[t].shirt};color:${contrast(p.gk ? G.kits[t].gk : G.kits[t].shirt)}">${i.num}</span><span class="nm">${esc(p.name ?? '')}</span><span class="role">${i.role}${i.offRole ? '*' : ''}</span>${st}</li>`;
    }).join('')}</ul></div>`).join('') + '<p class="note">* fuori ruolo</p>';
}

// ---------------------------------------------------------------- banner

let bannerT = 0, lowerT = 0, captionT = 0;
function showCaption(text) {
  const c = $('#caption'); c.textContent = text; c.hidden = false;
  c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); captionT = 4;
}
function showBanner(html, team, secs) {
  const b = $('#banner'); b.innerHTML = html; b.hidden = false; b.style.setProperty('--c', team >= 0 ? G.kits[team].shirt : '#e8edf5');
  b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); bannerT = secs;
}
function hideBanner() { $('#banner').hidden = true; bannerT = 0; }
function showLower(html, kind, secs = 3) {
  const l = $('#lower'); l.innerHTML = html; l.className = `lower-${kind}`; l.hidden = false;
  l.classList.remove('in'); void l.offsetWidth; l.classList.add('in'); lowerT = secs;
}

// ---------------------------------------------------------------- replay

function playClips(clips, auto = false) {
  if (!clips.length) return;
  G.queue = clips.slice(1); G.replay = new ReplayPlayer(clips[0]); G.replayAuto = auto;
  $('#end').hidden = true; $('#replay-tag').hidden = false; hideBanner();
  R.setCamera('segui'); R.snap = true; R.lastDir = clips[0].item.team === 0 ? 1 : -1;
  showLower(`Replay · ${esc(playerName(clips[0].item.player))} ${clips[0].item.min}′`, 'info', 2.5);
}
function endReplay() {
  if (G.queue.length) return playClips(G.queue);
  G.replay = null; $('#replay-tag').hidden = true;
  R.setCamera(CAMS[G.cam][0]); R.snap = true;
  if (G.ended) showEnd();
}

// ---------------------------------------------------------------- avanzamento rapido

function skipSeconds(sec) {
  if (G.ended || G.replay) return;
  G.skipping = true;
  sec *= G.sim.pace; /* sec: secondi di cronometro */ const target = Math.min(G.sim.matchTime + sec, G.sim.halfLength * 2);
  for (let i = 0; i < sec * 120 && G.sim.matchTime < target && G.sim.state !== 'full'; i++) tick();
  G.skipping = false; R.snap = true; refreshPanel(); renderLineups();
  if (G.ended) setTimeout(showEnd, 300);
}

function runToEnd() {
  if (G.ended || G.replay) return;
  G.skipping = true; $('#busy').hidden = false; $('#lower').hidden = true; hideBanner();
  const g = G, total = g.sim.halfLength * 2, chunk = () => {
    if (G !== g) return;
    const t0 = performance.now();
    while (g.sim.state !== 'full' && performance.now() - t0 < 30) for (let i = 0; i < 300; i++) tick();
    $('#busy .rp-bar i').style.width = `${100 * g.sim.matchTime / total}%`;
    if (g.sim.state !== 'full') return setTimeout(chunk, 0);
    g.skipping = false; $('#busy').hidden = true; R.snap = true; refreshPanel(); renderLineups(); showEnd();
  };
  chunk();
}

// ---------------------------------------------------------------- fine partita

function showEnd() {
  if (!G || G.replay) return;
  const s = G.sim, tl = G.stats.timeline;
  hideBanner(); $('#lower').hidden = true;
  const scorers = t => { const m = new Map(); for (const i of tl) if (i.t === 'goal' && i.team === t) { const k = playerName(i.player) + (i.own ? ' (aut.)' : ''); m.set(k, [...(m.get(k) ?? []), `${i.min}′`]); } return [...m].map(([k, v]) => `${esc(k)} ${v.join(', ')}`).join('<br>'); };
  $('.end-score').innerHTML = [0, 1].map(t => `<div class="es-team" style="--c:${G.kits[t].shirt}"><span class="es-name">${esc(G.defs[t].name)}</span><span class="es-goals">${s.score[t]}</span></div>`).join('<span class="es-dash">-</span>');
  $('.end-scorers').innerHTML = [0, 1].map(t => `<div>${scorers(t) || '&nbsp;'}</div>`).join('');
  const keep = ['Possesso', 'Tiri', 'Tiri in porta', 'Precisione passaggi', 'Falli', 'Ammonizioni'];
  $('.end-stats').innerHTML = G.stats.rows().filter(r => keep.includes(r[0])).map(([l, a, b, u = '']) => `<div><b>${a}${u}</b><span>${l}</span><b>${b}${u}</b></div>`).join('');
  const bid = G.stats.best(), bp = s.players[bid], bx = G.stats.ps[bid], bv = G.stats.rating(bid);
  const facts = [bx.goals && `${bx.goals} gol`, bx.assists && `${bx.assists} assist`, bp.gk && `${bx.saves} parat${bx.saves === 1 ? 'a' : 'e'}`, !bp.gk && bx.recoveries && `${bx.recoveries} palloni recuperati`].filter(Boolean).slice(0, 3).join(' · ');
  $('.end-motm').innerHTML = `<span class="motm-label">Migliore in campo</span><span class="num" style="background:${bp.gk ? G.kits[bp.team].gk : G.kits[bp.team].shirt};color:${contrast(bp.gk ? G.kits[bp.team].gk : G.kits[bp.team].shirt)}">${G.info[bid].num}</span>`
    + `<span class="motm-name">${esc(playerName(bid))}<small>${esc(G.defs[bp.team].name)}${facts ? ` · ${facts}` : ''}</small></span><span class="vote ${voteClass(bv)}">${fmtVote(bv)}</span>`;
  $('.end-map').innerHTML = shotMap(G.stats.shotList, s.pitch, G.kits.map(k => k.shirt));
  let so = null;
  if (G.ov && !G.recorded) { G.recorded = true; G.so = tour.result(G.ov.matchId, summarize(G.stats)); }
  so = G.so;
  $('.end-seed').textContent = `${so ? `Ai rigori ${so.score[0]}-${so.score[1]} · ` : ''}Seme ${G.seed} · ${G.schemes[0]} contro ${G.schemes[1]}`;
  $('#e-again').hidden = !!G.ov; $('#e-menu').textContent = G.ov ? 'Torna al torneo' : 'Menu';
  $('#e-replays').hidden = !G.rec.clips.length;
  $('#end').hidden = false;
}

// ---------------------------------------------------------------- comandi

function updateControls() {
  if (!G) return;
  $('#c-play').innerHTML = G.paused ? ICON.play : ICON.pause; $('#c-play').title = G.paused ? 'Riprendi (spazio)' : 'Pausa (spazio)';
  $('#c-audio').innerHTML = A.muted ? ICON.mute : ICON.sound; $('#c-audio').title = A.muted ? 'Attiva l\'audio (M)' : 'Disattiva l\'audio (M)';
  $('#c-speed').textContent = `${String(G.speed).replace('.', ',')}×`; $('#c-cam').textContent = CAMS[G.cam][1];
  $('#c-skip').disabled = $('#c-end').disabled = G.ended;
  $('#match').classList.toggle('paused', G.paused);
}
function setSpeed(i) { G.speed = SPEEDS[i]; updateControls(); }
function cycleCam() { G.cam = (G.cam + 1) % CAMS.length; if (!G.replay) R.setCamera(CAMS[G.cam][0]); updateControls(); }
function setPanel(open) { $('#panel').classList.toggle('open', open); $('#match').classList.toggle('with-panel', open); if (open) { refreshPanel(); renderLineups(); } }
/** Ridisegna la scheda aperta del pannello che cambia durante la partita. */
function refreshPanel() {
  if (!G || !$('#panel').classList.contains('open')) return;
  const tab = $('#panel [data-tab].on')?.dataset.tab;
  if (tab === 'stats') renderStats(); else if (tab === 'ratings') renderRatings();
}
function showTab(name) {
  $$('#panel [data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  $$('#panel [data-body]').forEach(x => { x.hidden = x.dataset.body !== name; });
  if (name === 'lineups') renderLineups(); else if (name === 'tactics') renderTactics(); else refreshPanel();
}
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
function toMenu() { const toTour = !!G?.ov; A.setCrowd(0); A.suspend(); G = null; R?.dispose(); R = null; $('#match').hidden = true; $('#menu').hidden = toTour; $('#tour').hidden = !toTour; if (toTour) tour.open(); if (document.fullscreenElement) document.exitFullscreen(); teamCard(0); teamCard(1); }

function initControls() {
  $('#c-full').innerHTML = ICON.full;
  if (!document.documentElement.requestFullscreen) $('#c-full').hidden = true;
  $('#c-play').onclick = () => { G.paused = !G.paused; updateControls(); };
  $('#c-speed').onclick = () => setSpeed((SPEEDS.indexOf(G.speed) + 1) % SPEEDS.length);
  $('#c-skip').onclick = () => skipSeconds(60);
  $('#c-end').onclick = runToEnd;
  $('#c-cam').onclick = cycleCam;
  $('#c-panel').onclick = () => setPanel(!$('#panel').classList.contains('open'));
  $('#panel-close').onclick = () => setPanel(false);
  $('#c-full').onclick = toggleFull;
  $('#c-audio').onclick = () => { A.start(); A.setMuted(!A.muted); updateControls(); };
  $('#c-menu').onclick = toMenu;
  $('#rp-skip').onclick = () => { G.queue = []; endReplay(); };
  $$('#panel [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  const cmOpt = () => { $('#feed').classList.toggle('no-cm', !cfg.commentary); if (!cfg.captions) $('#caption').hidden = true; saveMenu(); };
  $('#opt-cm').checked = cfg.commentary; $('#opt-cap').checked = cfg.captions; cmOpt();
  $('#opt-cm').onchange = e => { cfg.commentary = e.target.checked; cmOpt(); };
  $('#opt-cap').onchange = e => { cfg.captions = e.target.checked; cmOpt(); };
  $('#e-replays').onclick = () => playClips(G.rec.clips);
  $('#e-view').onclick = () => { $('#end').hidden = true; };
  $('#e-ratings').onclick = () => { $('#end').hidden = true; setPanel(true); showTab('ratings'); };
  $('#e-again').onclick = () => startMatch(cfg.seed ? +cfg.seed : undefined);
  $('#e-menu').onclick = toMenu;
  $$('[data-open]').forEach(b => b.onclick = () => $(`#${b.dataset.open}`).showModal());
  addEventListener('keydown', e => {
    if (!G || $('#match').hidden || e.target.closest?.('input,select,textarea,dialog')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); $('#c-play').click(); }
    else if (k >= '1' && k <= '6') setSpeed(+k - 1);
    else if (k === 'c') cycleCam();
    else if (k === 's') $('#c-panel').click();
    else if (k === 'f') toggleFull();
    else if (k === 'm') $('#c-audio').click();
    else if (k === 'r') { const c = G.rec.clips.at(-1); if (c && !G.replay) playClips([c]); }
    else if (k === 'escape') { if (G.replay) $('#rp-skip').click(); else setPanel(false); }
    else if (k === '?') $('#help').showModal();
  });
}

// ---------------------------------------------------------------- ciclo

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G && R && !G.skipping) {
    if (G.replay) {
      const v = G.replay.frame(dt);
      if (v) { R.draw(v, dt * G.replay.speed); $('#replay-tag .rp-bar i').style.width = `${100 * G.replay.progress}%`; $('#clock').textContent = mmss(v.t / G.sim.pace); }
      else endReplay();
    } else {
      if (!G.paused && !G.ended) {
        G.acc += dt * G.speed;
        for (let n = 0; G.acc >= DT && n < 1200; n++) { tick(); G.acc -= DT; if (G.replay || G.ended) { G.acc = 0; break; } }
        if (G.acc > DT * 4) G.acc = 0; // dispositivo lento: meglio rallentare che accumulare ritardo
      }
      if (!G.replay) R.draw(G.sim, G.paused ? 0 : dt * Math.min(G.speed, 3));
      $('#clock').textContent = mmss(G.sim.clock());
    }
    const s = G.sim;
    $('#sc0').textContent = s.score[0]; $('#sc1').textContent = s.score[1];
    $('#period').textContent = s.state === 'full' ? 'FIN' : s.state === 'half' ? 'INT' : s.matchTime >= s.halfLength ? '2T' : '1T';
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('#banner').hidden = true;
    if (lowerT > 0 && (lowerT -= dt) <= 0) $('#lower').hidden = true;
    if (captionT > 0 && ((captionT -= dt) <= 0 || G.replay)) { captionT = 0; $('#caption').hidden = true; }
    if ((G.panelT += dt) > 1) { G.panelT = 0; refreshPanel(); }
    if ((G.crowdT = (G.crowdT ?? 0) + dt) > 0.25) { G.crowdT = 0; A.setCrowd(crowdLevel()); }
  }
  requestAnimationFrame(frame);
}

const tour = initTour({
  root: $('#tour-body'), teams: () => [...PRESETS, ...custom], defaultHalf: cfg.half,
  watch: (T, m) => startMatch(matchSeed(T, m), { n: T.perTeam, half: T.half, defs: [T.teams[m.home], T.teams[m.away]], matchId: m.id }),
});
$('#tour-open').onclick = () => { $('#menu').hidden = true; $('#tour').hidden = false; tour.open(); };
$('#t-back').onclick = () => { $('#tour').hidden = true; $('#menu').hidden = false; teamCard(0); teamCard(1); };
initMenu(); initControls(); requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); // installabile e offline (GitHub Pages)
