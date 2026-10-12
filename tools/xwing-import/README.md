# Content importer

Ship stats, maneuver dials, point costs, upgrade slots and weapon values come from the
community **xwing-data** set (first edition): https://github.com/guidokessels/xwing-data.
Names, ability wording and art are original and live in `catalog/<batch>.js` (one file per batch so
separate chats can work in parallel; shared vocabulary maps are in `maps.js`).

## Rebuild the generated data

```
git clone --depth 1 https://github.com/guidokessels/xwing-data /tmp/xwing-data
node tools/xwing-import/build.mjs /tmp/xwing-data            # every batch
node tools/xwing-import/build.mjs /tmp/xwing-data league     # only gen/league.js
```

This rewrites `src/data/gen/<batch>.js` (committed; never edit by hand) and `gen/originals-static.js`.
`gen/index.js` merges the batches. The dataset files are parsed as JSON, never executed.
Each generated file also carries the original names (ORIGINALS) for the in-game display toggle.

## Add a ship, pilot or upgrade

1. Find its numeric `id` in the dataset (`data/ships.js`, `data/pilots.js`, `data/upgrades.js`).
2. Add an entry to the matching table in your batch's `catalog/<batch>.js` with our `id`, `name` and
   (for abilities) `text` in our own words. Weapons also get a `weapon: { cost, spend, discard, turret }`
   block; bombs/mines get `ordnance: '<token id>'` (+ `mine: true` or `keep: true`).
3. Run the build.
4. If it has an ability, implement it in `src/engine/cards/*.js` under the same id
   (hook reference at the top of `src/engine/hooks.js`). New ships also need art in
   `src/render/shipArt.js`.
5. `node tests/run.mjs` — the card simulation drafts every card at random, so a broken card shows up there.

The build understands every first-edition small-ship maneuver (including loops, Tallon rolls,
reverse and stationary) and maps actions/arcs via `maps.js`.
