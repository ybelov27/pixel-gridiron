# SPEC: Pixel Gridiron (original brief)

You are building a browser game that faithfully recreates the gameplay, pacing and management loop of "Retro Bowl" (New Star Games, 2020). Match the mechanics and feel as closely as possible, but use an ORIGINAL name ("Pixel Gridiron"), original pixel art drawn in code, original sounds (Web Audio), and invented team/city/player names. Do not copy any Retro Bowl assets, logos, text or trademarks.

## Phase 0: research first (do this before writing code)
1. Search the web and read: the Retro Bowl fandom wiki (positions, attributes, front office, draft, morale), the official @retro_bowl control tips, gameplay videos/reviews, and changelogs (e.g. APKMirror "What's new" notes for OT rules, onside kicks, kickoff returns).
2. Write RESEARCH.md summarizing: controls, play flow, scoring/OT rules, clock rules, attribute lists per position, star/rating scale, morale/condition/injury rules, coaching credits sources & costs, facilities, coordinators, draft, free agency, contracts/salary cap, press conferences, season length/playoffs, difficulty (incl. dynamic difficulty), and the GM job-security system.
3. Mark anything unconfirmed as "ASSUMED" with your best guess. Then build to spec.

## Tech requirements
- Pure HTML5 Canvas + vanilla JavaScript (ES modules). No frameworks, no build step, no external CDNs. It must work fully offline.
- Folder structure: index.html, /src (modules), /README.md, /RESEARCH.md.
- Run locally with either `python3 -m http.server 8000` or `npx serve .`, then open http://localhost:8000. Document both in README.
- Fixed internal resolution (e.g. 320x180 or 384x216), integer-scaled with image-rendering: pixelated; letterboxed; works landscape on desktop & mobile.
- Input: mouse AND touch (pointer events). Keyboard alternatives for juke/dive.
- 60 FPS fixed-timestep game loop; deterministic seeded RNG for sims.
- Save/load the whole career to localStorage (autosave after every game and menu action), with export/import save as JSON.

## On-field gameplay (offense + special teams only)
View: side-scrolling field, offense moving left→right, camera follows ball, yard lines and numbers, end zones, line of scrimmage + first-down marker. 11 v 11 on screen; your stars visually distinct (e.g. star icon above head).

Pre-snap:
- The game AUTO-SELECTS a play (formation + routes). The player does not pick. Draw each receiver's route as a dotted line before the snap. Tap/click to snap.
- Build a playbook of ~25 plays (slants, outs, posts, fades, curls, screens, RB dives, play-action) chosen weighted by down/distance/field position.

Passing (slingshot):
- After snap, press-drag BACKWARD from anywhere; an aim arrow shows direction, drag length = power. Release to throw.
- Default throw = lob (arcing, shadow on ground, ball height simulated). Right-click or second-finger tap while aiming toggles BULLET (flat, fast, less time for defenders but harder to place).
- Accuracy rating adds random error to the throw; Arm Strength caps max distance.
- Catch resolution: ball arrival vs receiver Catching + defender proximity → catch / drop / deflection / interception. Defenders converge on ball in the air.
- Sack if QB holds too long (pass-rush timer reduced by OL ratings).
- Drag FORWARD and release = QB scramble/run.

Running (any ball carrier):
- Tap the RB (highlighted circle) to hand off. Carrier auto-runs forward.
- Swipe up/down (or W/S, ↑/↓) = side-step juke. Swipe back (A/←) = stutter/slow. Swipe forward (D/→) = dive (gains a little, protects vs fumble).
- Tackles: defenders pursue with Speed; break-tackle chance from Strength vs Tackling; fumble chance reduced by diving before contact.
- Out of bounds stops clock; sideline at top/bottom of field.

Special teams:
- Field goals / PATs: two-tap or drag kick with an aim + power meter, wind arrow, Kicker Accuracy/Leg strength affect wobble and range.
- After TD: choose PAT (1) or 2-point try from the 2-yard line.
- 4th down prompt: Go for it / Punt / Field goal. Punts auto-resolved by Kicker leg.
- Kickoffs: auto, with onside-kick option when trailing late.
- Safeties possible.

Defense (simulated):
- When opponent has the ball, show a short text ticker/animation of their drive. Outcome probabilities driven by your defensive stars' ratings + Defensive Coordinator stars vs. opponent strength and difficulty: TD, FG, punt, turnover, turnover on downs. Consume realistic clock time.

Rules & clock:
- Selectable quarter length (1, 2 or 3 minutes). Clock runs on plays in bounds, stops on incompletions/out of bounds/scores. Two-minute warning not required.
- Overtime: coin flip; implement modern-style OT (both teams get a possession unless first possession scores a TD; mark as ASSUMED if research differs).
- HUD: score, quarter, clock, down & distance, ball position, timeouts (3/half).

## Front office / management
- 32 fictional teams in 2 conferences / 4 divisions each. Pick or randomize team.
- Season: regular season + playoff bracket → championship game ("Pixel Bowl").
- Star players: max ~12 on roster. Unfilled positions are generic 1-star-ish "regular" players. Positions: QB, RB, WR, TE, OL, K, DL, LB, DB.
- Each star: name, age, position, star rating (0.5–5), potential stars, 4 position-specific attributes (e.g. QB: Accuracy, Arm, Speed, Stamina), XP/level-ups (spend points on attributes), salary, contract years, Morale, Condition (fatigue), injury status/weeks out, season & career stats.
- Coaching Credits (CC): earned after each game based on result + fan rating; spent on: facility upgrades (Stadium, Training, Rehab), hiring/firing Offensive & Defensive Coordinators (1–5 stars), morale boosts, condition boosts, contract extensions, raising the salary cap.
- Facilities decay slightly each season; Stadium raises fan rating/CC income, Training speeds XP, Rehab speeds injury recovery and condition recovery.
- Salary cap starting at $200M; enforce it on signings/extensions.
- Draft: 3 rounds each offseason; you see a prospect pool with scouting (stars + potential, some fuzz); other teams don't steal your picks.
- Free agency: expensive high-star players; signing costs cap + CC.
- Contracts expire → re-sign or lose. Unhappy players may demand trades/leave.
- Press conferences/events: periodic multiple-choice prompts (player complaints, media questions) that change morale and fan rating.
- Job security: owner/fan approval meter; bad seasons can get you fired, then you take an offer from another team (career continues).
- Difficulty: Easy / Medium / Hard / Extreme + optional dynamic difficulty that scales with your success.
- Screens: Title, New Career, Team Hub (next game, standings, news), Roster, Player card, Front Office, Draft, Free Agents, Schedule, Standings, Playoffs, Season Awards/History, Settings (quarter length, difficulty, sound).

## Art & audio
- 8/16-bit look: small sprite players (~8x12 px) drawn procedurally per team colors, chunky pixel font (draw your own bitmap font), green field with stripes.
- Simple Web Audio SFX: snap, throw, catch, tackle thud, crowd swell on TD, whistle.

## Build order (show a runnable build after each step)
1. Loop, renderer, field + camera, input layer.
2. One hard-coded play: snap, slingshot throw, catch, tackle, down tracking.
3. Running game, juke/dive, fumbles, sacks.
4. Full game: playbook, clock, scoring, kicks, simulated defense, OT.
5. Season structure, standings, playoffs.
6. Roster, ratings, XP, morale/condition/injuries.
7. Front office economy, facilities, coordinators, draft, free agency, contracts.
8. Press events, job security, difficulty, save/load, polish, SFX.

## Acceptance checklist
- Runs offline from a local static server with zero console errors.
- A full 4-quarter game is playable start to finish with mouse and with touch.
- Lob vs bullet behave noticeably differently; interceptions happen on bad throws.
- Ratings measurably change outcomes (test: 5-star vs 1-star QB accuracy spread).
- Can play 2+ full seasons, draft, re-sign, get fired/hired, and reload the save.
- README lists controls, how to run, and known deviations from the original.
