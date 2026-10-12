# Content importer

Ship stats, maneuver dials, point costs, upgrade slots and weapon values come from the
community **xwing-data** set (first edition): https://github.com/guidokessels/xwing-data.
Names, ability wording and art are original and live in `catalog.js`.

## Rebuild the generated data

```
git clone --depth 1 https://github.com/guidokessels/xwing-data /tmp/xwing-data
node tools/xwing-import/build.mjs /tmp/xwing-data
```

This rewrites `src/data/gen/content.js` (committed; never edit it by hand). The dataset files
are parsed as JSON, never executed.

## Add a ship, pilot or upgrade

1. Find its numeric `id` in the dataset (`data/ships.js`, `data/pilots.js`, `data/upgrades.js`).
2. Add an entry to the matching table in `catalog.js` with our `id`, `name` and (for abilities) `text`
   in our own words. Weapons also get a `weapon: { cost, spend, discard, turret }` block.
3. Run the build.
4. If it has an ability, implement it in `src/engine/cards/*.js` under the same id
   (hook reference at the top of `src/engine/hooks.js`). New ships also need art in
   `src/render/shipArt.js`.
5. `node tests/run.mjs` — the card simulation drafts every card at random, so a broken card shows up there.

Dial codes the build understands: straight, bank, turn, reverse (K) turn. Ships that use
other maneuvers (sloops, tallon rolls, stationary, reverse) will fail the build until
`BEARING` in `build.mjs` and the engine's templates support them.
