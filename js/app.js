import * as Settings from './settings.js';
import * as Store from './storage.js';
import { Input, BUTTONS } from './input.js';
import { Online } from './online.js';
import { DemoCore } from './core.js';

const $ = id => document.getElementById(id);
const settings = Settings.load();
const input = new Input();
const online = new Online();
let core = null;

// ---- log ----
const logEl = $('log');
const log = msg => { logEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`; logEl.scrollTop = logEl.scrollHeight; };

// ---- tabs ----
const TABS = [['general', 'General'], ['graphics', 'Gráficos'], ['saves', 'Partidas'], ['online', 'Online'],
  ['data', 'Datos'], ['chat', 'Chat'], ['log', 'Log'], ['advanced', 'Avanzado']];
const tabsEl = document.querySelector('.tabs');
for (const [id, label] of TABS) {
  const b = document.createElement('button');
  b.textContent = label; b.setAttribute('role', 'tab'); b.dataset.tab = id;
  b.onclick = () => showTab(id);
  tabsEl.append(b);
}
function showTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.dataset.tab !== id);
  tabsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id));
}
showTab('general');

// ---- settings ----
Settings.bind(settings, key => {
  if (key === 'smooth') $('screen').classList.toggle('smooth', settings.smooth);
  if (key === 'touch') buildTouch();
});
$('screen').classList.toggle('smooth', settings.smooth);
if (!settings.nick) { settings.nick = 'Player' + Math.floor(Math.random() * 1000); $('o-nick').value = settings.nick; }
if (!settings.server) { settings.server = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host || 'localhost:8080'}/ws`; $('o-server').value = settings.server; }

// ---- launcher ----
$('btn-start').onclick = async () => {
  if (core) { core.stop(); core = null; }
  $('stage').hidden = false;
  const old = $('screen'); old.replaceWith(old.cloneNode()); // fresh canvas: a context type can't be swapped
  const host = { canvas: $('screen'), settings, input, online, files: Store, log, commentary: settings.commentary };
  try {
    let Core = DemoCore;
    if (settings.coreUrl !== 'demo') Core = (await import(/* @vite-ignore */ settings.coreUrl || '/core/index.js')).default;
    core = new Core(host);
    await core.start();
    $('btn-start').textContent = 'Reiniciar';
  } catch (e) { log(`core error: ${e.message}`); alert(`No se pudo iniciar el núcleo: ${e.message}`); }
};
$('btn-full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : $('stage').requestFullscreen?.() || document.documentElement.requestFullscreen();

// ---- touch controls ----
const TOUCH_LAYOUT = { up: [8, 30], down: [8, 70], left: [2, 50], right: [14, 50], triangle: [86, 30], cross: [86, 70], square: [80, 50], circle: [92, 50], l: [2, 4], r: [92, 4], select: [38, 90], start: [54, 90] };
function buildTouch() {
  const el = $('touch'); el.innerHTML = ''; el.hidden = !settings.touch;
  for (const b of BUTTONS) {
    const btn = document.createElement('button');
    btn.textContent = { up: '▲', down: '▼', left: '◀', right: '▶', cross: '✕', circle: '○', square: '□', triangle: '△' }[b] || b.toUpperCase();
    btn.style.left = TOUCH_LAYOUT[b][0] + '%'; btn.style.top = TOUCH_LAYOUT[b][1] + '%';
    const set = d => e => { e.preventDefault(); input.setTouch(0, b, d); };
    btn.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, set(false));
    el.append(btn);
  }
}
buildTouch();

// ---- controls dialog ----
const dlg = $('dlg-controls');
function renderMap() {
  const p = Number($('map-player').value), t = $('map-table'); t.innerHTML = '';
  for (const b of BUTTONS) {
    const tr = t.insertRow(); tr.insertCell().textContent = b;
    const btn = document.createElement('button');
    btn.textContent = input.maps[p][b] || '—';
    btn.onclick = () => {
      btn.textContent = 'pulsa tecla…';
      const h = e => { e.preventDefault(); e.stopPropagation(); input.maps[p][b] = e.code === 'Escape' ? undefined : e.code; input.persist(); removeEventListener('keydown', h, true); renderMap(); };
      addEventListener('keydown', h, true);
    };
    tr.insertCell().append(btn);
  }
}
$('btn-controls').onclick = () => { renderMap(); dlg.showModal(); };
$('map-player').onchange = renderMap;
$('map-close').onclick = () => dlg.close();
$('map-auto').onclick = () => { input.autoConfigure(Number($('map-player').value)); renderMap(); };
$('map-save').onclick = () => Store.download(new Blob([input.exportMaps()], { type: 'application/json' }), 'mapping.json');
$('map-load').onclick = () => $('map-file').click();
$('map-file').onchange = async e => {
  try { input.importMaps(await e.target.files[0].text()); renderMap(); } catch (err) { alert(err.message); }
  e.target.value = '';
};

// ---- saves ----
async function refreshSaves() {
  const files = await Store.listFiles(), ul = $('save-list'); ul.innerHTML = '';
  let total = 0;
  for (const f of files) {
    total += f.size;
    const li = document.createElement('li'); li.textContent = `${f.path} (${f.size} B)`;
    const del = document.createElement('button'); del.textContent = 'Borrar';
    del.onclick = async () => { await Store.deleteFile(f.path); refreshSaves(); };
    li.append(del); ul.append(li);
  }
  $('data-info').textContent = `${files.length} archivos, ${(total / 1024).toFixed(1)} KB almacenados`;
}
$('btn-upload-zip').onclick = () => $('save-upload-zip').click();
$('btn-upload-dir').onclick = () => $('save-upload').click();
$('save-upload-zip').onchange = async e => { for (const f of e.target.files) log(`zip: ${await Store.importZip(f)} archivos`); e.target.value = ''; refreshSaves(); };
$('save-upload').onchange = async e => { log(`carpeta: ${await Store.importFiles(e.target.files)} archivos`); e.target.value = ''; refreshSaves(); };
$('btn-download-saves').onclick = async () => Store.download(await Store.exportZip(), 'savedata.zip');
$('btn-clear-data').onclick = async () => { if (confirm('¿Borrar todos los datos almacenados?')) { await Store.clearAll(); refreshSaves(); } };
refreshSaves();

// ---- online ----
$('btn-connect').onclick = () => online.connect(settings.server, settings.nick);
online.addEventListener('status', e => { $('o-status').textContent = e.detail; log(`online: ${e.detail}`); });
online.addEventListener('error', e => log(`online error: ${e.detail.error ?? e.detail}`));
online.addEventListener('rooms', e => {
  const ul = $('room-list'); ul.innerHTML = '';
  if (!e.detail.rooms.length) ul.innerHTML = '<li>Sin salas públicas</li>';
  for (const r of e.detail.rooms) {
    const li = document.createElement('li');
    li.textContent = `${r.name} ${r.locked ? '🔒' : ''} ${r.players}/${r.max}`;
    const b = document.createElement('button'); b.textContent = 'Unirse';
    b.onclick = () => online.join(r.id, r.locked ? prompt('Contraseña') : '');
    li.append(b); ul.append(li);
  }
});
const inRoom = v => { $('btn-leave-room').hidden = !v; $('btn-create-room').hidden = v; };
online.addEventListener('joined', e => { inRoom(true); log(`sala "${e.detail.room.name}", slot ${e.detail.slot}`); });
online.addEventListener('left', () => inRoom(false));
online.addEventListener('status', e => { if (e.detail === 'desconectado') inRoom(false); });
online.addEventListener('peer-joined', e => log(`jugador entró (slot ${e.detail.slot}: ${e.detail.nick})`));
online.addEventListener('peer-left', e => log(`jugador salió (slot ${e.detail.slot})`));
$('btn-create-room').onclick = () => online.create($('o-room-name').value || `${settings.nick}'s room`, $('o-room-pass').value, $('o-room-priv').checked);
$('btn-leave-room').onclick = () => online.leave();

// ---- chat ----
const chatLog = $('chat-log');
online.addEventListener('chat', e => { chatLog.append(Object.assign(document.createElement('div'), { textContent: `${e.detail.nick}: ${e.detail.text}` })); chatLog.scrollTop = chatLog.scrollHeight; });
$('chat-form').onsubmit = e => { e.preventDefault(); const v = $('chat-input').value.trim(); if (v) online.chat(v); $('chat-input').value = ''; };
