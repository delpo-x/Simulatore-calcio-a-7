import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const EMPTY_ROOM_TTL_MS = 15 * 60 * 1000;
const MAX_PLAYERS = 4;
const MAX_PACKET = 64 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

export function createRelay({ port = 8080, emptyTtl = EMPTY_ROOM_TTL_MS } = {}) {
  /** @type {Map<string, {id:string,name:string,priv:boolean,password:string,members:Map<number,any>,emptySince:number|null}>} */
  const rooms = new Map();
  let nextRoom = 1;

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_PACKET });

  const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
  const publicList = () => [...rooms.values()].filter(r => !r.priv).map(summary);
  const summary = r => ({ id: r.id, name: r.name, players: r.members.size, max: MAX_PLAYERS, locked: !!r.password, private: r.priv });
  const broadcastList = () => { for (const c of wss.clients) if (!c.room) send(c, { t: 'rooms', rooms: publicList() }); };

  function leave(ws) {
    const r = ws.room;
    if (!r) return;
    r.members.delete(ws.slot);
    ws.room = null;
    for (const m of r.members.values()) send(m, { t: 'peer-left', slot: ws.slot, players: [...r.members.keys()] });
    if (!r.members.size) r.emptySince = Date.now();
    broadcastList();
  }

  wss.on('connection', ws => {
    ws.room = null; ws.slot = -1; ws.nick = 'Player';
    send(ws, { t: 'rooms', rooms: publicList() });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Relay game packet: prepend sender slot byte, forward to everyone else in the room.
        if (!ws.room) return;
        const out = Buffer.concat([Buffer.from([ws.slot]), data]);
        for (const m of ws.room.members.values()) if (m !== ws && m.readyState === 1) m.send(out, { binary: true });
        return;
      }
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      switch (msg.t) {
        case 'nick': ws.nick = String(msg.nick || 'Player').slice(0, 24); break;
        case 'list': send(ws, { t: 'rooms', rooms: publicList() }); break;
        case 'create': {
          if (ws.room) return send(ws, { t: 'error', error: 'already-in-room' });
          const id = String(nextRoom++);
          const r = { id, name: String(msg.name || `Room ${id}`).slice(0, 32), priv: !!msg.private,
            password: msg.password ? String(msg.password).slice(0, 32) : '', members: new Map(), emptySince: null };
          rooms.set(id, r);
          join(ws, r);
          break;
        }
        case 'join': {
          const r = rooms.get(String(msg.room));
          if (!r) return send(ws, { t: 'error', error: 'no-such-room' });
          if (ws.room) return send(ws, { t: 'error', error: 'already-in-room' });
          if (r.members.size >= MAX_PLAYERS) return send(ws, { t: 'error', error: 'room-full' });
          if (r.password && r.password !== String(msg.password || '')) return send(ws, { t: 'error', error: 'bad-password' });
          join(ws, r);
          break;
        }
        case 'leave': leave(ws); send(ws, { t: 'left' }); send(ws, { t: 'rooms', rooms: publicList() }); break;
        case 'chat':
          if (!ws.room) return;
          for (const m of ws.room.members.values())
            send(m, { t: 'chat', slot: ws.slot, nick: ws.nick, text: String(msg.text || '').slice(0, 200) });
          break;
      }
    });
    ws.on('close', () => leave(ws));
  });

  function join(ws, r) {
    let slot = 0;
    while (r.members.has(slot)) slot++;
    ws.slot = slot; ws.room = r; r.emptySince = null;
    r.members.set(slot, ws);
    send(ws, { t: 'joined', room: summary(r), slot, players: [...r.members.keys()] });
    for (const m of r.members.values()) if (m !== ws) send(m, { t: 'peer-joined', slot, nick: ws.nick, players: [...r.members.keys()] });
    broadcastList();
  }

  const sweep = setInterval(() => {
    let changed = false;
    for (const [id, r] of rooms) {
      if (!r.members.size && r.emptySince && Date.now() - r.emptySince >= emptyTtl) { rooms.delete(id); changed = true; }
    }
    if (changed) broadcastList();
  }, Math.min(30_000, Math.max(50, emptyTtl / 2)));

  return new Promise(resolve => {
    server.listen(port, () => resolve({
      port: server.address().port, rooms,
      close: () => new Promise(done => { clearInterval(sweep); for (const c of wss.clients) c.terminate(); wss.close(() => server.close(done)); }),
    }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await createRelay({ port: Number(process.env.PORT) || 8080 });
  console.log(`relay + static on http://localhost:${port}`);
}
