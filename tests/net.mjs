// Two online clients sharing one ordered log: dials stay secret until both commit,
// and both clients end with identical states.
import assert from 'node:assert/strict';
import { Session } from '../src/net/session.js';
import { LocalTransport } from '../src/net/transports.js';
import { PRESET_SQUADS } from '../src/data/presets.js';
import { botAction } from '../src/ai/simpleBot.js';
import { waitingOn } from '../src/engine/index.js';

const tick = () => new Promise(r => setTimeout(r, 0));

export async function runNetTest(games = 20) {
  for (let g = 0; g < games; g++) {
    const t = new LocalTransport(`net-${g}`, { persist: false });
    const A = new Session(t, 'p1'), B = new Session(t, 'p2');
    await t.append({ kind: 'host', faction: 'league', name: 'A', squad: PRESET_SQUADS.league.duo.ships, obstacles: true, seed: 500 + g });
    await t.append({ kind: 'join', faction: 'dominion', name: 'B', squad: PRESET_SQUADS.dominion.swarm.ships });
    await tick();
    let rng = g + 1; const r = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 3000 && !A.state.winner; i++) {
      // secrecy: while planning, neither state holds the other's dials before both committed
      if (A.state.phase === 'planning') {
        const committed = A.state.playerOrder.every(p => A.hasCommitted(p));
        if (!committed) assert.deepEqual(A.state.dials, {});
      }
      for (const s of [A, B]) {
        const st = s.state;
        if (st.phase === 'planning' && s.hasCommitted(s.me)) continue;
        const act = botAction(st, s.me, r);
        if (act) await s.act(act);
      }
      await tick(); await tick();
      if (A.state.round > 40) break;
    }
    const a = structuredClone(A.state), b = structuredClone(B.state);
    delete a.events; delete b.events;
    assert.deepEqual(a, b, `desync in game ${g}`);
    assert.ok(A.state.winner || A.state.round > 40, `game ${g} stalled in ${A.state.phase} waiting on ${waitingOn(A.state)}`);
  }
  return games;
}
