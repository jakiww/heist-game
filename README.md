# The Velvet Vault

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/jakiww/heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/jakiww/heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A top-down museum heist game, built for the make.fun bounty **Make the best heist game**. One room, one thief, one velvet door — and a lot of eyes watching.

## The heist

You are the thief in the Velvet Vault, a museum hall after closing time. Cross the room, lift three treasures — the Star of Velvet Diamond, a stack of gold bullion, and the Portrait of the Duchess — then slip out the velvet door before the alarm meter hits 100%.

- **Two patrolling guards** with vision cones. Pillars, display cases and crates block their line of sight — use them as cover.
- **Two sweeping wall cameras** with red vision cones. Their sweep is rhythmic; time your crossing between passes.
- **An alarm meter** that climbs while any guard or camera sees you and falls while you stay hidden. At 100% you are caught.
- **Coin toss** (mouse click, 5 coins): throw one to make the nearest guard walk over and investigate the noise.
- **Scoring**: loot values plus a time bonus for a fast, clean getaway.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move the thief |
| E | Grab loot when standing next to it |
| Mouse click | Throw a coin toward that spot |
| R | Restart the room |
| M | Mute / unmute sound |

## How to play

Serve the `game/` folder with any static HTTP server and open `game/index.html` in a desktop browser. No build step, no network requests — every file the game loads lives under `game/`, and all sounds are synthesized with WebAudio (oscillators, no audio files).

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080
```

Screenshot scenes can be picked with `?scene=cover|sneak|alert|exit`, which places the thief, guards and alarm deterministically for a real render of the same code.

## Tips for a clean getaway

- Watch the sweep: each camera's faint arc shows its full range, so cross between passes.
- Guards investigate a thrown coin — toss one past a guard to open a lane, then move while they walk away.
- The alarm falls fast when you break line of sight; duck behind a pillar or a display case and let it cool down.

## Layout

- `main.ts` — the hand-in program (Node 22, stdlib only): copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts`.
- `game/index.html` — the page; loads the scripts below as classic scripts.
- `game/js/level.js` — the room: walls, cover, loot, guard routes, cameras.
- `game/js/guards.js` — guard patrol, vision cones, line of sight, coin distraction.
- `game/js/cameras.js` — sweeping wall cameras and their vision cones.
- `game/js/audio.js` — WebAudio sound effects (pickup, coin, alarm, caught, win).
- `game/js/input.js` — keyboard movement and mouse coin toss.
- `game/js/main.js` — game state, loop, rendering, HUD, alarm meter, win/lose.
- `game/css/style.css` — page chrome around the canvas.
- `screenshots/` — four real renders of the game in a browser.

## License

MIT — see [LICENSE](LICENSE).
