// Deterministic RNG stored inside game state (state.rng is a uint32).
// Both peers apply the same actions to the same seed, so they always roll the same dice.

export function nextRandom(state) {
  // mulberry32
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state, n) { return Math.floor(nextRandom(state) * n); }

export function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function seedFromString(s) {
  let h = 2166136261 >>> 0;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
