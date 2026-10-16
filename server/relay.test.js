import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createRelay } from './relay.js';

const relay = await createRelay({ port: 0, emptyTtl: 100 });
const url = `ws://localhost:${relay.port}/ws`;

function client() {
  const ws = new WebSocket(url);
  const q = []; const waiters = [];
  ws.on('message', (d, bin) => {
    const m = bin ? { bin: d } : JSON.parse(d.toString());
    const w = waiters.shift(); w ? w(m) : q.push(m);
  });
  ws.next = (pred = () => true) => new Promise(res => {
    const tryNext = m => pred(m) ? res(m) : waiters.push(tryNext);
    const take = () => { const m = q.shift(); if (m) tryNext(m); else waiters.push(tryNext); };
    take();
  });
  ws.json = o => ws.send(JSON.stringify(o));
  return new Promise(r => ws.on('open', () => r(ws)));
}

const a = await client(), b = await client();
a.json({ t: 'create', name: 'T', password: 'x' });
const ja = await a.next(m => m.t === 'joined');
assert.equal(ja.slot, 0);

b.json({ t: 'join', room: ja.room.id, password: 'bad' });
assert.equal((await b.next(m => m.t === 'error')).error, 'bad-password');
b.json({ t: 'join', room: ja.room.id, password: 'x' });
assert.equal((await b.next(m => m.t === 'joined')).slot, 1);

a.send(Buffer.from([9, 8, 7]));
const pkt = await b.next(m => m.bin);
assert.deepEqual([...pkt.bin], [0, 9, 8, 7]);

a.json({ t: 'chat', text: 'hi' });
assert.equal((await b.next(m => m.t === 'chat')).text, 'hi');

a.close(); b.close();
await new Promise(r => setTimeout(r, 400));
assert.equal(relay.rooms.size, 0, 'empty room swept');
await relay.close();
console.log('relay tests ok');
