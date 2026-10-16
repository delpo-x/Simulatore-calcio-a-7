# pes-web-shell

Generic browser shell + relay server. No game included: bring your own core.

- `npm install && npm start` -> http://localhost:8080 (static + WebSocket relay at /ws)
- `npm test` -> relay tests
- Football core (original, clean-room): `public/core/`; `node public/core/sim.test.js` -> simulation tests
- Game tests (declarative, `tests/game/*.json`; targets in `config/`): `npm run test:game [-- --full]` -> `reports/test-game.md`; `npm run matches -- --games 200 --players 7` -> AI-vs-AI match recorder
- Planning map for the engine: `wayfinder/MAP.md` (glossary: `CONTEXT.md`)
- Core contract: see `public/js/core.js`. Set a module URL in the launcher ("Ruta del núcleo").
- Relay protocol: JSON control messages (nick, list, create, join, leave, chat); binary frames are forwarded to the other room members with a 1-byte sender-slot prefix. Empty rooms are deleted after 15 min, max 4 players.
