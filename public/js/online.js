// Client for the relay server. Emits: rooms, joined, peer-joined, peer-left, chat, packet, status, error.
export class Online extends EventTarget {
  ws = null; slot = -1; room = null;

  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  #json(o) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }

  connect(url, nick) {
    this.ws?.close();
    this.#emit('status', 'conectando');
    const ws = this.ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { this.#emit('status', 'conectado'); this.#json({ t: 'nick', nick }); };
    ws.onclose = () => { this.room = null; this.slot = -1; this.#emit('status', 'desconectado'); };
    ws.onerror = () => this.#emit('error', 'connection');
    ws.onmessage = e => {
      if (e.data instanceof ArrayBuffer) {
        const b = new Uint8Array(e.data);
        return this.#emit('packet', { from: b[0], data: b.subarray(1) });
      }
      const m = JSON.parse(e.data);
      if (m.t === 'joined') { this.room = m.room; this.slot = m.slot; }
      if (m.t === 'left') { this.room = null; this.slot = -1; }
      this.#emit(m.t, m);
    };
  }
  disconnect() { this.ws?.close(); }
  list() { this.#json({ t: 'list' }); }
  create(name, password, priv) { this.#json({ t: 'create', name, password, private: priv }); }
  join(room, password) { this.#json({ t: 'join', room, password }); }
  leave() { this.#json({ t: 'leave' }); }
  chat(text) { this.#json({ t: 'chat', text }); }
  /** Send a binary game packet to every other player in the room. */
  send(data) { if (this.room && this.ws?.readyState === 1) this.ws.send(data); }
}
