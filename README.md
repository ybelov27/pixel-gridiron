# Pixel Gridiron

Pixel Gridiron is an original retro arcade-football and team-management game. It runs on HTML5 Canvas with plain JavaScript ES modules: no frameworks, no build step and no CDNs, so it works fully offline.
The game recreates the loop of a classic mobile retro-football title. Everything in it is original: the name, the pixel art drawn in code, the bitmap font, the Web Audio sounds, and every team, city and player name.

## Run it

Serve the folder from any static server, then open http://localhost:8000.

```bash
python3 -m http.server 8000
```

```bash
npx serve -l 8000 .
```

ES modules don't load from `file://`, so you need a server. Your career autosaves to `localStorage` after every game and every menu action. Settings has **Export save** (downloads a JSON file) and **Import save**, and you can also import from the title screen.

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Snap | Tap/click the field | Space / Enter |
| Pass | Press anywhere and drag **backward** to aim (slingshot), release to throw. Drag length sets distance, capped by Arm Strength | – |
| Bullet pass | Second finger tap, or right-click while aiming (a right-button drag starts as a bullet) | B / Shift while aiming |
| QB scramble | Drag **forward** and release | – |
| Hand-off | Tap the RB inside the flashing ring | H |
| Juke | Swipe up / down | W / S, ↑ / ↓ |
| Stutter (slow) | Swipe back | A / ← |
| Dive | Swipe forward | D / → |
| Field goal / PAT | Tap once to lock aim, tap again to lock power | Space |
| Timeout | `TO` button (stops between-play runoff) | T |
| Pause / sim rest of game | `II` button | Esc / P |
| Skip message or opponent drive | Tap | Space |

The play is chosen for you, and each receiver's route is drawn as a dotted line before the snap. A lob arcs high, so defenders have time to converge. A bullet is flat and fast but slightly less accurate. A star icon marks your star players.

## What's in it

- **On field:** 11 v 11 side-scrolling field. Routes, man and deep-zone coverage with reaction lag, a pass rush against your OL, sacks, catches, drops, deflections and interceptions. Also hand-offs, jukes, stutters, dives, broken tackles, fumbles, safeties, out of bounds, 26 auto-selected plays, a FG/PAT aim and power mini-game with wind, punts, kickoffs, onside kicks, 2-point tries and 4th-down decisions. Opponent drives are simulated as a ticker.
- **Rules:** selectable 1/2/3-minute quarters, a clock that stops on incompletions, out of bounds, scores and turnovers, a 6-second runoff between plays, 3 timeouts per half, and OT (see Known deviations).
- **Management:** 32 fictional teams in 2 conferences of 4 divisions each, a 16-game season, and a 12-team playoff ending in the Pixel Bowl. Your roster holds up to 12 star players, each with 4 position attributes, a star rating and potential, XP and skill points, morale, condition, injuries, contracts, and season and career stats. You earn coaching credits and spend them on Stadium, Training and Rehab upgrades (which decay each offseason), OC/DC hires, meetings, rest, extensions, free agents and cap raises. There's a $200M salary cap, a 3-round draft with scouting fuzz, free agency, re-signing, trades and releases, press conferences and events, an owner job-security meter with firing and new job offers, and Easy/Medium/Hard/Extreme difficulty plus an optional dynamic difficulty.

See [RESEARCH.md](RESEARCH.md) for the design rules and every ASSUMED number.

## Tests

```bash
node tests/run.mjs
```

The Node tests use no dependencies. They cover:

- the throw-error spread for a 5-star vs a 1-star QB, and completion and INT rates in the live play sim
- lob vs bullet flight time and how often each gets defended
- complete headless 4-quarter games driven by an autopilot, plus overtime
- two full seasons: playoffs, draft, re-signing, a forced firing and a new hire
- an exact JSON save round-trip, and a check that the same save produces the same future (seeded RNG)
- front-office rule checks (cap, roster limit, CC)

`tests/browser-smoke.js` plays a whole game in the browser through the real input layer, using synthetic mouse and touch PointerEvents. To run it, open the game, start a game, and run this in the console:

```js
(await import('/tests/browser-smoke.js')).playOneGame({ log: true })
```

## Project layout

```
index.html            canvas + module entry
src/main.js           60 FPS fixed-timestep loop, scene/modal dispatch
src/gfx.js            384x216 canvas, integer device-pixel scaling, bitmap font, sprites
src/input.js          pointer (mouse+touch) + keyboard -> internal coords
src/ui.js, app.js     immediate-mode buttons, scene/modal/toast state
src/audio.js          Web Audio SFX synth
src/rng.js            seeded mulberry32 RNG (state saved with the career)
src/data.js           invented teams/names
src/players.js        attributes, stars, lineups, salaries
src/play.js           live play simulation
src/playbook.js       routes + 26 plays + situational play picker
src/match.js          game rules, clock, kicks, opponent drives, OT
src/league.js         career, schedule, standings, sims, playoffs, difficulty
src/office.js         economy, facilities, staff, contracts, draft, FA, events, job security
src/flow.js           season flow shared by UI and tests
src/save.js           localStorage + JSON export/import
src/scenes/game.js    on-field rendering + gesture handling
src/scenes/menus.js   every menu screen
tests/                Node tests + browser smoke driver
```

`package.json` contains only `{"type":"module"}`, so Node treats the sources as ES modules. Nothing gets installed.

## Known deviations from the original

- **Overtime** follows the 2010–2021 NFL rule. A TD on the first possession wins, otherwise both teams get the ball, then it's sudden death. Regular-season OT is one period and can end tied, while playoff OT repeats until someone wins.
- **CPU teams** have only offense and defense ratings, not full rosters. When you're hired by a new club, it gets a generated roster that fits its ratings.
- **Kickoff and punt returns** are resolved automatically. You don't control the returner, and interception and fumble returns are a random 0–15 yards.
- **The draft** shows a fresh 7-player pool each round. CPU teams don't draft from your pool.
- **Defense** is never playable, as in the original. Your defensive stars collect tackles, sacks and INTs from the drive simulation.
- **Economy numbers** (CC rewards and costs, salaries, decay) are best guesses, marked ASSUMED in RESEARCH.md.
- **Scaling** uses integer device-pixel multiples, so some screens show a letterbox margin.
- **No multiplayer** and no exhibition mode.
