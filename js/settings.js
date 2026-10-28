const KEY = 'shell-settings';
export const DEFAULTS = {
  volume: 80, skipIntro: false, language: 'es', download: 'stream', touch: false,
  renderer: 'webgl2', fps: '30', scale: '1', smooth: false,
  ini: '; engine options\n', commentary: 'es', coreUrl: '', nick: '', server: '',
};

export function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

// Map of setting key -> element id.
const IDS = { volume: 's-volume', skipIntro: 's-skipIntro', language: 's-language', download: 's-download',
  touch: 's-touch', renderer: 's-renderer', fps: 's-fps', scale: 's-scale', smooth: 's-smooth', ini: 's-ini',
  commentary: 'commentary', coreUrl: 'core-url', nick: 'o-nick', server: 'o-server' };

export function bind(settings, onChange = () => {}) {
  for (const [key, id] of Object.entries(IDS)) {
    const el = document.getElementById(id);
    const isBool = el.type === 'checkbox';
    if (isBool) el.checked = !!settings[key]; else el.value = settings[key];
    el.addEventListener('change', () => {
      settings[key] = isBool ? el.checked : el.value;
      save(settings); onChange(key, settings[key]);
    });
  }
}
