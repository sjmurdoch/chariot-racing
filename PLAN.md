# Roman Chariot Racing — Design Plan

## Vision

A simple, pick-up-and-play 3D chariot race in the Circus Maximus. The primary platform is iPhone (12 or newer) in landscape, and it also works on desktop. It runs in the browser and as an offline PWA hosted on GitHub Pages. First priority is fun and simplicity; second priority is historical correctness.

## Decisions

| Topic | Decision |
|---|---|
| Core loop | Steering is the only control. The racing line decides the winner: cutting tight around the turning posts (*metae*) saves distance but risks a crash. Slipstreaming behind rivals gives a speed boost; bumping rivals sideways adds tactics. |
| Crashes | Hitting the spina or the wall stops the chariot and knocks it clear, pointing away from what it hit; it then accelerates back to speed (about 4 seconds). Hitting wreckage (*naufragia*) will work the same way. |
| Race length | 7 laps (historical), on a compressed track tuned for about 2 minutes per race. |
| Field | 4 chariots: the player plus 3 AI rivals, one per faction (Red/*Russata*, White/*Albata*, Blue/*Veneta*, Green/*Prasina*). The player picks a faction. |
| Progression | Quick race plus a table of local best times and placings, stored in `localStorage`. Difficulty levels for the AI. No career mode yet. |
| Orientation | Landscape only, full screen. Lock to landscape and go full screen where the browser allows (Android, desktop, iPad). iPhone Safari allows neither, so on iPhone full screen comes from adding the game to the Home Screen, and a rotate prompt pauses the race in portrait. |
| Controls | Tilt (DeviceOrientation, with the iOS permission prompt and calibration on start). Alternative: hold the left or right half of the screen. Desktop: arrow keys and A/D. |
| Minimum device | iPhone 12 (A14) at a steady 60 fps. |
| Art | Stylized low-poly, built in code (no external model assets), warm Mediterranean palette. |
| Camera | Driver's view: first person from the chariot, looking over the four horses. |
| Awareness | Faction-coloured arrows at the screen edges for nearby rivals, plus stereo-panned hoof and wheel sounds. |
| Audio | Sound effects only, generated with Web Audio: crowd (swelling at the turns and finish), hooves, wheels, crashes. No music. |
| Setting | Circus Maximus, early Imperial period (1st–2nd century AD), four-horse chariots (*quadrigae*). |
| History in the game | Built into the world: dolphin and egg lap counters on the central barrier (*spina*), staggered starting gates (*carceres*), the start signalled by dropping a white cloth (*mappa*), the obelisk on the spina, anticlockwise racing, and a palm branch for the winner. A historical fact shows on the loading and between-race screens. Each fact is checked against a cited source before it goes in. |
| Language | English interface with Latin touches (faction names, "VICTOR!", Roman-numeral lap numbers). |

## Technical approach

- **Stack:** TypeScript, Three.js, built with Vite. `vite-plugin-pwa` supplies the service worker and manifest.
- **Deploy:** a GitHub Actions workflow builds and publishes to GitHub Pages. Asset paths are relative so the game works under a `/repo-name/` subpath.
- **Configuration:** game tuning (speeds, lap count, AI skill, crash penalty) lives in `config/game.toml`, parsed at build time. Each setting can be overridden by a `VITE_`-prefixed environment variable at build time and by a URL query parameter at runtime (for example `?laps=2&debug=1`), using the same names.
- **Architecture:** a pure, deterministic simulation (track geometry, chariot physics, AI, collisions, race state) kept separate from rendering, input and audio. That separation keeps the game logic unit-testable without a browser.
- **Performance budget (iPhone 12):**
  - under 100 draw calls; static scenery merged and crowds instanced
  - no realtime shadows, only baked or blob shadows
  - device pixel ratio capped at 2
  - fixed-timestep simulation
  - under 2 MB total download
- **Testing:**
  - Vitest for simulation and game-logic unit tests.
  - Playwright end-to-end tests using the Python API, managed with uv in `tests/e2e/`. They cover the start screen, keyboard and touch steering, completing a race (with a short-race config override), and offline loading after the service worker installs.
  - The full suite runs before every commit and in CI.

## Milestones

Each milestone is a small, playable, tested increment.

1. ✅ **Scaffold:** Vite + TypeScript + Three.js project, an empty scene, TOML config loading, Vitest and the Playwright (uv) harness, CI running the tests.
2. ✅ **Track:** a stadium-shaped track generated in code, with the spina, the metae and sand. A camera driving a fixed racing line around it. (Both ends are semicircular for now; the flatter carceres end arrives with the starting gates in milestone 6. A plain obelisk is already on the spina.)
3. ✅ **Steering:** the chariot has its own heading, so the player must steer round each turn or run wide into the wall. The player's chariot with forward speed and lateral steering. Keyboard, touch-halves and tilt input (with permission prompt and calibration). Driver's-view camera. Also added: a tap-to-race start screen, a debug overlay with the embedded commit, and publishing to GitHub Pages from CI.
4. ✅ **Core loop:** distance advantage from the inside line; a crash at the spina or the wall stops the chariot and knocks it clear, then it accelerates back up to speed; races start from a standstill; laps counted in Roman numerals with a race clock; finish detection, pulling up after the line, and a finish screen with the time, crashes and Race again.
5. **Rivals:** 3 AI chariots following racing lines with personality and skill levels. Slipstreaming, side bumping, wreckage. Edge indicators.
6. **Race flow:** start screen (faction and difficulty), staggered carceres with the mappa drop, dolphin and egg lap counters, results with the palm branch, local best times.
7. **Presentation:** horses with simple animation, crowd stands, obelisk, Web Audio sound effects, Latin touches in the interface.
8. **PWA and deploy:** service worker and offline test still to do. Done early: GitHub Pages workflow, manifest (full screen, landscape), icons, full screen and landscape lock where supported, and a rotate prompt that pauses the race in portrait.
9. **History and polish:** sourced historical facts, an About screen, a performance pass on a real iPhone, tuning for fun.

## Open items

- Name of the game.
- Exact compressed track proportions, to be tuned during playtesting in milestone 4.
- Sources for the historical facts, to be collected and checked in milestone 9.
- Tilt steering is tested with simulated sensor events only. The direction depends on how iOS reports `window.orientation`, so check on a real iPhone in both landscape directions that turning the phone clockwise steers right; `tilt.invert` reverses it if not. Tune `tilt.full_lock` and `steering.response` on the device at the same time.
- Scenery dimensions are placeholders to check against sources in milestone 9: obelisk height (24 m), meta cone height (6 m), spina width (12 m, chosen for gameplay).
