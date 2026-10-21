# Pixel Gridiron

Pixel Gridiron is an original retro arcade-football and team-management game. It runs on HTML5 Canvas with plain JavaScript ES modules: no frameworks, no build step and no CDNs, so it works fully offline.
The game recreates the loop of a classic mobile retro-football title. Everything in it is original: the name, the pixel art drawn in code, the bitmap font, the Web Audio sounds, and every team, city and player name.

## Play it

**https://ybelov27.github.io/pixel-gridiron/**

It plays in landscape on iPhone, iPad, Android and desktop.

**Add it to your Home Screen.** On iPhone or iPad, open the link in Safari (or Chrome), tap **Share → Add to Home Screen → Add**, then launch it from the icon. It runs fullscreen and keeps working offline. The **+ HOME SCREEN** button on the title screen (and in MENU) shows these steps. On Android and desktop Chrome, the same button becomes a one-tap **INSTALL APP**. The Home Screen app keeps its own save, separate from the browser tab. To move a career over, use MENU → Export Save in the browser, then Import Save in the app.

**It always autosaves.** The game saves after every menu action and every game, before every snap and every opponent drive, every 15 seconds, and whenever you switch away from or close the app. If you leave mid-game, the Hub (or CONTINUE on the title screen) offers **RESUME** with the quarter, clock, score, down and stats intact. The pause menu also has **SAVE & EXIT**. The game fills the whole screen at a crisp integer pixel scale and keeps the HUD clear of the notch.

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
| Kick return | Tap to bring it out of the end zone (or wait for a touchback), then swipe to juke | Space, then WASD |
| Juke | Swipe up / down | W / S, ↑ / ↓ |
| Stutter (slow) | Swipe back | A / ← |
| Dive | Swipe forward | D / → |
| Field goal | Behind-the-kicker view: tap to lock aim, tap again for power | Space |
| Extra point (PAT) | Side-on view on the field: tap to lock aim, tap again for power | Space |
| Timeout | `TO` button (stops between-play runoff) | T |
| Pause / sim rest of game | `II` button | Esc / P |
| Skip message or opponent drive | Tap | Space |

The play is chosen for you. Before the snap, each receiver's route is drawn as a dotted line with direction chevrons and an arrowhead (a yellow stop bar marks routes that settle, such as curls and hitches). Throws get aim assist that pulls the ball toward the receiver you're leading: strong on Easy, off on Extreme. A lob arcs high, so defenders have time to converge. A bullet is flat and fast but slightly less accurate. A star icon marks your star players.

## What's in it

- **Look:** a chunky outlined 5×7 pixel font, outlined player sprites with helmet stripes and run cycles, crowd stands that bounce on big plays, end zones with team names, a midfield logo, a scoreboard HUD, a TOUCHDOWN banner with confetti, screen shake, dust, floating yardage, and weather (snow late in the season at cold-weather stadiums, rain) and night games.
- **Skills:** every star has a signature skill (CANNON, SNIPER, BURNER, SURE HANDS, BULLDOZER, BALL HAWK, BIG LEG…) that boosts one attribute, shown on the player card. Non-star depth players are real named individuals with their own ratings.
- **Injuries:** stars can get hurt during a game on tackles, sacks and defensive drives. A banner announces it, a backup takes over, and the player misses real weeks (Rehab shortens it).
- **Ratings:** every player has an overall rating (OVR, 40–99). It shows over skill players and defenders on the field, and in the roster, player cards, free agency and the draft.
- **On field:** 11 v 11 side-scrolling field. Routes, man and deep-zone coverage with reaction lag, a pass rush against your OL, sacks, catches, drops, deflections and interceptions. When a pass is in the air, every nearby receiver and defender breaks toward the landing spot. Also playable kickoff returns, hand-offs, jukes, stutters, dives, broken tackles, fumbles, safeties, out of bounds, 26 auto-selected plays, a FG/PAT aim and power mini-game with wind, punts, kickoffs, onside kicks, 2-point tries and 4th-down decisions. Opponent drives are simulated as a ticker.
- **Rules:** selectable 1/2/3-minute quarters, a clock that stops on incompletions, out of bounds, scores and turnovers, a 6-second runoff between plays, 3 timeouts per half, and OT (see Known deviations).
- **Management:** 32 fictional teams in 2 conferences of 4 divisions each, a 16-game season, and a 12-team playoff ending in the Pixel Bowl. Your roster holds up to 12 star players, each with 4 position attributes, a star rating and potential, XP and skill points, morale, condition, injuries, contracts, and season and career stats. You earn coaching credits and spend them on Stadium, Training and Rehab upgrades (which decay each offseason), OC/DC hires, meetings, rest, extensions, free agents and cap raises. There's a $200M salary cap, a 3-round draft with scouting fuzz, free agency, re-signing, trades and releases, press conferences and events, an owner job-security meter with firing and new job offers, and Easy/Medium/Hard/Extreme difficulty plus an optional dynamic difficulty.

See [RESEARCH.md](RESEARCH.md) for the design rules and every ASSUMED number.

## Publishing updates

GitHub Pages caches files for 10 minutes. Before pushing, stamp the build so browsers fetch the new code immediately:

```bash
node tools/stamp.mjs
```

This writes an import map into `index.html` that points every module at `file.js?v=<content hash>`, and it bumps the service worker cache. Pushing to `main` redeploys the site within a couple of minutes.

## Tests

```bash
node tests/run.mjs
node tests/render.mjs
```

`tests/render.mjs` stubs out the canvas and runs every drawing path (all menus, full games with kicks and returns, weather, night) to catch runtime errors in rendering code.

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
sw.js, manifest.webmanifest, icons/   installable offline app (icons made by tools/make-icons.mjs)
tests/                Node tests + browser smoke driver
```

`package.json` contains only `{"type":"module"}`, so Node treats the sources as ES modules. Nothing gets installed.

## Known deviations from the original

- **Overtime** follows the 2010–2021 NFL rule. A TD on the first possession wins, otherwise both teams get the ball, then it's sudden death. Regular-season OT is one period and can end tied, while playoff OT repeats until someone wins.
- **CPU teams** have only offense and defense ratings, not full rosters. When you're hired by a new club, it gets a generated roster that fits its ratings.
- **Punt returns** and interception/fumble returns are resolved automatically (a random 0–15 yards). Kickoff returns are playable.
- **The draft** shows a fresh 7-player pool each round. CPU teams don't draft from your pool.
- **Defense** is never playable, as in the original. Your defensive stars collect tackles, sacks and INTs from the drive simulation.
- **Economy numbers** (CC rewards and costs, salaries, decay) are best guesses, marked ASSUMED in RESEARCH.md.
- **Menus** are laid out in a 384×216 area centred on screen. On iPad and wider phones the background fills the rest.
- **No multiplayer** and no exhibition mode.
