# RESEARCH.md: the gameplay loop of the reference game

This file sums up what I could find about how the reference game (Retro Bowl, New Star Games, 2020) plays. Pixel Gridiron is built to this spec.
**Legal note:** Pixel Gridiron copies none of the reference game's names, art, text or sounds. It uses only general game-design ideas.

## Sources consulted (2026-10-20)

- Wikipedia, "Retro Bowl": you control the offense only. The defense is simulated, though you still draft and sign defensive players. Your GM duties are trades, cuts, free agents, morale, the draft and the press. Coaching credits are the in-game currency, earned by playing. Kickoff returns were added in April 2022, game simulation in October 2022, and an exhibition mode in February 2023.
- TheSixthAxis review (2022): the front office has an Offensive and a Defensive Coordinator that you can upgrade, plus Stadium, Training and Rehab facilities. Coaching points go to upgrades, staff, or player meetings that raise morale. Stadium condition drives fan happiness, and training speeds development.
- APKMirror listing for v1.5.18 (2022). The page was blocked, so this comes from the search summary. It added kickoff returns in the unlimited version, fixed the onside-kick chance, fixed the CPU punting while trailing in overtime, fixed the OT field-goal rules, and made the OT coin flip 50/50 on Extreme.
- The fandom wiki and official control-tip posts returned nothing usable. The control scheme below is common knowledge from gameplay videos, which I could not watch to check it. Mostly ASSUMED.

## Controls

| Action | Reference game | Pixel Gridiron |
|---|---|---|
| Snap | Tap | Tap/click the field, or Space/Enter |
| Pass | Drag back to aim (slingshot), release to throw | Same |
| Lob vs bullet | Default is a lob. A second finger while aiming throws a bullet | Second finger or right-click while aiming toggles bullet. B/Shift does it on the keyboard |
| Hand-off | Tap the running back as he passes the QB | Tap the highlighted RB (or press H) |
| Juke | Swipe up/down | Swipe up/down, W/S, ↑/↓ |
| Dive | Swipe forward | Swipe forward, D/→ |
| Slow / stutter | (ASSUMED) swipe back | Swipe back, A/← |
| QB run | Drag forward and release | Same |

## Play flow

- The game picks the play for you. Routes appear as dotted lines before the snap.
- Your defense is never controlled by the player. Their drive shows up as a quick summary.
- On 4th down you choose to go for it, punt or kick a field goal. After a TD you choose a PAT or a 2-point try. **ASSUMED:** 2-point tries are run from the 2.
- Kickoffs are automatic, with an onside option when trailing late. **ASSUMED:** onside recovery succeeds about 20% of the time.

## Scoring, clock, overtime

- Standard football scoring (TD 6, PAT 1, 2-pt 2, FG 3, safety 2).
- Quarter length is selectable. The game clock runs during plays and stops on incompletions, out-of-bounds plays, scores and turnovers. **ASSUMED:** about 6 game-seconds run off between plays when the clock is running, and a snap ends the runoff early (hurry-up). Each half gives 3 timeouts.
- Overtime starts with a coin flip (50/50, per the changelog). **ASSUMED:** the 2010–2021 NFL rule. Both teams get a possession unless the first possession ends in a TD, then it's sudden death. Regular-season OT is one period and can end tied. Playoff OT repeats until someone wins.

## Players and ratings

- Star players are named and capped at about 12 on the roster. **ASSUMED:** the cap is exactly 12. Other slots are filled by generic 1-star "regular" players.
- Ratings are shown as stars from 0.5 to 5 in half steps, with a separate potential.
- Attributes are per position, on a 1–10 bar scale (ASSUMED for the exact names):
  - QB: Arm, Accuracy, Speed, Stamina
  - RB: Speed, Strength, Catching, Stamina
  - WR: Speed, Catching, Strength, Stamina
  - TE: Catching, Strength, Speed, Stamina
  - OL: Blocking, Strength, Speed, Stamina
  - K: Leg, Accuracy, Composure, Stamina
  - DL: Pass Rush, Strength, Tackling, Stamina
  - LB: Tackling, Speed, Coverage, Stamina
  - DB: Coverage, Speed, Tackling, Stamina
- Players gain XP and level up, and the skill points they earn raise attributes up to their potential. Training facilities speed this up.
- Morale (0–100) is affected by results, press answers, contract talks and meetings. Unhappy players may demand trades or refuse to re-sign.
- Condition (fatigue) drops when a player plays and recovers each week. Rehab speeds recovery. Low condition lowers effective ratings and raises injury risk.
- Injuries last some weeks, and Rehab shortens them.
- Aging: players decline from about 30 and retire around 33–36 (ASSUMED).

## Economy (ASSUMED numbers)

- Coaching Credits (CC) per game: 1 for a loss, 2 for a tie, 3 for a win, plus a fan-rating bonus (0–3) and a Stadium bonus (0–2). Playoff games pay +2 and a title pays +5.
- Starting CC: 10.
- Facilities (Stadium, Training, Rehab) are rated 1–5. Upgrading costs 4 × the next level in CC. Each offseason every facility decays 0.5 (minimum 1).
- Coordinators (OC/DC) are rated 1–5 stars. Hiring costs 3 × stars in CC, and firing is free. The OC boosts offensive XP and route crispness. The DC boosts simulated defense and defensive XP.
- Player meeting: 1 CC for +20 morale. Rest/recovery session: 1 CC for +35 condition.
- Contract extensions cost 1 + ⌊stars/2⌋ CC, plus the asking salary has to fit under the cap.
- Raising the salary cap costs 5 CC per +$10M.
- The salary cap starts at $200M and counts only star players. Salary is roughly $1M + 1.6 × stars² M, so a fresh 10-star roster costs about $120–150M.
- Free agents are higher-star veterans. Signing one costs ⌈stars × 2⌉ CC plus their salary under the cap.
- The draft has 3 rounds each offseason. Each round shows its own prospect list with scouting fuzz (stars ±0.5, potential shown as a range), and no CPU team takes your pick. Rookies sign 3-year cheap deals.

## Press conferences and events

These are multiple-choice prompts after some games and at random weekly events, such as a player complaint, a media question, or a contract or trade demand. The choices move morale (one player or the whole team), the fan rating, and owner approval.

## Season

- 32 teams in 2 conferences with 4 divisions of 4 teams each.
- **ASSUMED:** 16 regular-season games. 6 of them are division games (home and away against each rival), and 10 are against other teams.
- **ASSUMED:** 6 teams per conference make the playoffs: the 4 division winners as seeds 1–4 and 2 wild cards. Seeds 1–2 get a bye. The rounds are Wild Card, Divisional and Conference, then the championship (here, the "Pixel Bowl").

## Difficulty and job security

- Easy / Medium / Hard / Extreme. Difficulty changes defender speed and reaction time, contested-catch odds, how strong the simulated opposing offense is, and CPU team ratings.
- **ASSUMED** dynamic difficulty: an offset that rises after wins (especially blowouts) and falls after losses, clamped to −0.5…+1.0 difficulty steps.
- Owner approval (job security, 0–100) moves with each result relative to expectations and with press answers, and it is judged at season end. Below 15, you're fired. **ASSUMED:** you then pick from 3 job offers at weaker clubs and keep your career history and half your CC.
