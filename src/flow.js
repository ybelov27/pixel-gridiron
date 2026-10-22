// Season flow shared by the UI and the headless tests (no DOM).
import { clamp } from './rng.js';
import { rngOf, saveRng, recordResult, simOtherGames, simGame, teamRatings, userGameThisWeek, seedPlayoffs, advancePlayoffs,
  addNews, WEEKS, userTeam, diffParams, teamName, userEliminated, ROUND_NAMES } from './league.js';
import { postGame, weekly, genFreeAgents, coordPool } from './office.js';
import { checkGame, checkCareer } from './achievements.js';
import { buildLineup } from './players.js';

export function startSeason(c) {
  c.phase = 'regular'; c.week = 0;
  coordPool(c);
  if (!c.freeAgents.length) genFreeAgents(c);
  addNews(c, `REGULAR SEASON ${c.year} KICKS OFF.`);
}
// what the hub should offer next
export function status(c) {
  if (c.phase === 'preseason') return c.stage === 'draft' ? 'off:draft' : 'start';
  if (c.phase === 'regular') return 'play';
  if (c.phase === 'playoffs') {
    if (c.playoffs.champion !== null) return 'review';
    return userGameThisWeek(c) ? 'play' : 'simround';
  }
  return 'off:' + c.stage;
}
export function opponentOf(c, g) { return c.teams[g.h === c.userTeamId ? g.a : g.h]; }

// quick box-score style stats for a simulated user game
function simStats(c, rng, us) {
  const lu = buildLineup(c.roster, c.regulars), st = {};
  const add = (p, k, v) => { if (!p.id) return; (st[p.id] ||= {}); st[p.id][k] = (st[p.id][k] || 0) + v; };
  const tds = Math.floor(us / 7), fg = Math.floor((us % 7) / 3);
  const qb = lu.QB[0], rb = lu.RB[0];
  const pyds = Math.round(rng.range(140, 260) + qb.stars * 20), ratt = rng.int(14, 24);
  add(qb, 'patt', rng.int(24, 36)); add(qb, 'pcmp', rng.int(15, 24)); add(qb, 'pyds', pyds);
  add(rb, 'ratt', ratt); add(rb, 'ryds', Math.round(ratt * rng.range(3, 5.5)));
  const recs = [...lu.WR, ...lu.TE];
  let left = pyds;
  recs.forEach((r, i) => { const y = i === recs.length - 1 ? left : Math.round(left * rng.range(0.25, 0.45)); left -= y; add(r, 'rec', rng.int(2, 7)); add(r, 'recyds', y); });
  for (let i = 0; i < tds; i++) {
    if (rng.chance(0.65)) { add(qb, 'ptd', 1); add(rng.pick(recs), 'rectd', 1); } else add(rb, 'rtd', 1);
  }
  add(lu.K[0], 'fgm', fg); add(lu.K[0], 'fga', fg + (rng.chance(0.2) ? 1 : 0)); add(lu.K[0], 'xpm', tds); add(lu.K[0], 'xpa', tds);
  for (const p of [...lu.DL, ...lu.LB, ...lu.DB]) { add(p, 'tkl', rng.int(1, 6)); if (p.pos === 'DL' && rng.chance(0.3)) add(p, 'sck', 1); if (p.pos === 'DB' && rng.chance(0.12)) add(p, 'dint', 1); }
  if (rng.chance(0.3)) add(qb, 'pint', 1);
  return st;
}
export function simUserGame(c) {
  c.inGame = null;
  const g = userGameThisWeek(c);
  const rng = rngOf(c);
  const dp = diffParams(c);
  const opp = opponentOf(c, g);
  const me = teamRatings(c, c.userTeamId), them = { off: opp.off + dp.cpu, def: opp.def + dp.cpu };
  const home = g.h === c.userTeamId;
  const r = simGame(rng, home ? me : them, home ? them : me, c.phase !== 'playoffs', g.neutral ? 0 : 0.15);
  const us = home ? r.a : r.b, th = home ? r.b : r.a;
  const stats = simStats(c, rng, us);
  saveRng(c, rng);
  return finishUserGame(c, g, { us, them: th, ot: r.ot, stats, oppId: opp.id });
}
export function finishUserGame(c, g, res) {
  c.inGame = null;
  const home = g.h === c.userTeamId;
  const playoff = c.phase === 'playoffs';
  const round = playoff ? c.playoffs.round : -1;
  recordResult(c, g, home ? res.us : res.them, home ? res.them : res.us, res.ot);
  const opp = c.teams[res.oppId];
  const won = res.us > res.them;
  addNews(c, `${won ? 'WIN' : res.us === res.them ? 'TIE' : 'LOSS'} ${res.us}-${res.them} ${home ? 'VS' : 'AT'} ${opp.abbr}${res.ot ? ' (OT)' : ''}${playoff ? ' - ' + ROUND_NAMES[round] : ''}`);
  const rng = rngOf(c);
  if (playoff) simOtherGames(c, c.playoffs.rounds[round], rng, false);
  else simOtherGames(c, c.schedule[c.week], rng, true);
  saveRng(c, rng);
  const sum = postGame(c, { ...res, playoff, title: playoff && round === 3 && won });
  weekly(c);
  advance(c);
  checkGame(c, res);
  sum.opp = opp.abbr; sum.ot = res.ot; sum.round = playoff ? ROUND_NAMES[round] : `WEEK ${c.phase === 'regular' ? c.week : WEEKS}`;
  return sum;
}
function advance(c) {
  if (c.phase === 'regular') {
    c.week++;
    if (c.week >= WEEKS) {
      seedPlayoffs(c); c.phase = 'playoffs';
      const inP = c.playoffs.seeds.some((s) => s.includes(c.userTeamId));
      addNews(c, inP ? 'YOU MADE THE PLAYOFFS!' : 'SEASON OVER - MISSED THE PLAYOFFS.');
    }
  } else if (c.phase === 'playoffs') {
    advancePlayoffs(c);
    if (c.playoffs.champion !== null) addNews(c, `${teamName(c.teams[c.playoffs.champion])} ARE PIXEL BOWL CHAMPIONS.`);
  }
}
// the saved mid-game snapshot, if it belongs to this week's game
export function resumableGame(c) {
  const g = userGameThisWeek(c), s = c.inGame;
  if (!g || !s || s.h !== g.h || s.a !== g.a || s.phase !== c.phase || s.week !== c.week || s.round !== (c.playoffs ? c.playoffs.round : -1)) return null;
  return { g, snap: s.snap };
}
export function simRound(c) {
  const rng = rngOf(c);
  simOtherGames(c, c.playoffs.rounds[c.playoffs.round], rng, false);
  saveRng(c, rng);
  weekly(c);
  advance(c);
  checkCareer(c);
}
export { userEliminated };
