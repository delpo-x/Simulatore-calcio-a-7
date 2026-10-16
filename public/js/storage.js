// Browser-side file store (IndexedDB) for save/option files, with zip import/export.
const DB = 'shell-files', STORE = 'files';

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'path' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out.result);
    t.onerror = () => rej(t.error);
  });
};

export const putFile = (path, data) => tx('readwrite', s => s.put({ path, data, size: data.byteLength, mtime: Date.now() }));
export const getFile = path => tx('readonly', s => s.get(path));
export const listFiles = () => tx('readonly', s => s.getAll());
export const deleteFile = path => tx('readwrite', s => s.delete(path));
export const clearAll = () => tx('readwrite', s => s.clear());

const clean = p => p.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(x => x && x !== '..').join('/');

export async function importZip(file) {
  const zip = await JSZip.loadAsync(file);
  let n = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    await putFile(clean(entry.name), await entry.async('arraybuffer'));
    n++;
  }
  return n;
}

export async function importFiles(fileList) {
  let n = 0;
  for (const f of fileList) {
    await putFile(clean(f.webkitRelativePath || f.name), await f.arrayBuffer());
    n++;
  }
  return n;
}

export async function exportZip() {
  const zip = new JSZip();
  for (const f of await listFiles()) zip.file(f.path, f.data);
  return zip.generateAsync({ type: 'blob' });
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
