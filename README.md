# Circus Maximus

A simple 3D Roman chariot racing game for the browser, designed first for phones held in landscape. You steer by tilting the phone, or by holding the left or right side of the screen; on desktop, use the arrow keys or A/D. See [PLAN.md](PLAN.md) for the design and milestones.

Play it at <https://sjmurdoch.github.io/chariot-racing/>. Every push to `main` that passes CI is published there automatically.

The game is played in landscape. On Android and desktop it goes full screen and locks to landscape when the race starts. iPhone Safari can do neither, so on an iPhone tap Share, then **Add to Home Screen**, and launch it from there for full screen. On any phone, holding it upright pauses the race and asks you to turn it sideways.

Once opened, the game keeps a copy of itself and works offline. When a new version is published, the start screen offers **New version: tap to update** the next time you open the app or come back to it.

## Development

Requires Node.js 24 or later and [uv](https://docs.astral.sh/uv/).

```bash
npm install
```

```bash
uv sync
```

```bash
uv run playwright install chromium webkit
```

Run the development server:

```bash
npm run dev
```

Run all tests (unit tests, Python lint, production build, then end-to-end tests in Chromium and WebKit):

```bash
npm test
```

## Configuration

Game settings live in [config/game.toml](config/game.toml). Each setting can be overridden in two other ways, using consistent names:

| Source | When | Example |
|---|---|---|
| `config/game.toml` | defaults | `[race]` `laps = 7` |
| Environment variable `CHARIOT_<TABLE>_<KEY>` | build time | `CHARIOT_RACE_LAPS=3 npm run build` |
| URL query parameter `<table>.<key>` | runtime | `?race.laps=3` |

Later sources win. A value of the wrong type, or an unknown setting name, produces a warning (at build time, or in the browser console) and the earlier value is kept.

## Debug overlay

The debug overlay shows the build (commit, branch and build time), frame rate, draw calls, race state, screen size, GPU and any settings changed from the defaults. Open it in any of these ways:

- press the backtick key (`` ` ``)
- tap the screen with three fingers
- add `?debug.overlay=1` to the URL

The commit is embedded at build time: from `GITHUB_SHA` when built by GitHub Actions, or from git locally, with `-dirty` added when there are uncommitted changes. Include the overlay in bug reports, for example as a screenshot.
