# Vector Aces

Tactical two-player starfighter dogfights in the browser: secretly dial in maneuvers, fly them
with precise templates, then trade fire through arcs and range bands with custom dice.

- **Play on one screen:** open the page, pick squads, *Start battle*.
- **Play online with a friend:** see [docs/ONLINE.md](docs/ONLINE.md) (GitHub Pages + free Firebase).

## Run locally
```
python3 -m http.server 8080     # then open http://localhost:8080
node tests/run.mjs              # rules + simulation + network-sync tests
```

## Developing
Start with [CONTEXT.md](CONTEXT.md). The work is split into independent workstreams in
[docs/WORKSTREAMS.md](docs/WORKSTREAMS.md) so each chat or contributor only loads the files it needs.
Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Rules status: [docs/RULES_COVERAGE.md](docs/RULES_COVERAGE.md).
