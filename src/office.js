// Front office: economy, facilities, coordinators, contracts, draft, free agency, press events, job security, offseason.
import { clamp } from './rng.js';
import { COACH_FIRST, LAST, FIRST } from './data.js';
import { makePlayer, starsOf, salaryFor, xpForLevel, addStats, newStats, MAX_STARS, ATTRS, buildLineup, POSITIONS, displayName } from './players.js';
import { rngOf, saveRng, addNews, userTeam, newId, genSchedule, seedPlayoffs, pct, genRoster, syncUserTeamRatings, ROUND_NAMES, userEliminated, teamName, WEEKS } from './league.js';

export const COSTS = { meet: 1, rest: 1, capRaise: 5, capStep: 10 };
export const capUsed = (c) => Math.round(c.roster.reduce((s, p) => s + p.salary, 0) * 10) / 10;
export const capRoom = (c) => Math.round((c.cap - capUsed(c)) * 10) / 10;
export const facilityCost = (lvl) => 4 * (Math.floor(lvl) + 1);
export const extendCC = (p) => 1 + Math.floor(p.stars / 2);
export const faCC = (p) => Math.ceil(p.stars * 2);
export function askSalary(p) {
  const base = salaryFor(p.stars, p.age);
  return Math.round(base * (1.15 - (p.morale ?? 60) / 400) * 10) / 10;
}
function spend(c, n) { if (c.cc < n) return false; c.cc -= n; return true; }

// ---------- coordinators ----------
export function coordPool(c) {
  if (c.coordPool && c.coordPool.year === c.year) return c.coordPool;
  const rng = rngOf(c);
  const gen = (role) => [1, 2, 3, 4, 5].map((s) => ({ role, stars: clamp(s + (rng.chance(0.3) ? -1 : 0), 1, 5), name: `${rng.pick(COACH_FIRST)} ${rng.pick(LAST)}` }))
    .map((x) => ({ ...x, cost: 3 * x.stars }));
  c.coordPool = { year: c.year, oc: gen('oc'), dc: gen('dc') };
  saveRng(c, rng);
  return c.coordPool;
}
export function hireCoord(c, role, cand) {
  if (!spend(c, cand.cost)) return 'NOT ENOUGH CC';
  c.coords[role] = { name: cand.name, stars: cand.stars };
  c.coordPool[role] = c.coordPool[role].filter((x) => x !== cand);
  addNews(c, `HIRED ${cand.stars}-STAR ${role.toUpperCase()} ${cand.name}.`);
  syncUserTeamRatings(c);
  return null;
}
export function fireCoord(c, role) {
  if (!c.coords[role]) return;
  addNews(c, `FIRED ${role.toUpperCase()} ${c.coords[role].name}.`);
  c.coords[role] = null; syncUserTeamRatings(c);
}

// ---------- facilities / boosts ----------
export function upgradeFacility(c, key) {
  const lvl = c.facilities[key];
  if (lvl >= 5) return 'MAXED';
  if (!spend(c, facilityCost(lvl))) return 'NOT ENOUGH CC';
  c.facilities[key] = Math.min(5, Math.floor(lvl) + 1);
  addNews(c, `${key.toUpperCase()} UPGRADED TO ${c.facilities[key]} STARS.`);
  return null;
}
export function raiseCap(c) {
  if (!spend(c, COSTS.capRaise)) return 'NOT ENOUGH CC';
  c.cap += COSTS.capStep; return null;
}
export function meetPlayer(c, p) {
  if (!spend(c, COSTS.meet)) return 'NOT ENOUGH CC';
  p.morale = clamp(p.morale + 20, 0, 100); if (p.morale >= 50) p.tradeReq = false; return null;
}
export function restPlayer(c, p) {
  if (p.condition >= 100) return 'ALREADY FRESH';
  if (!spend(c, COSTS.rest)) return 'NOT ENOUGH CC';
  p.condition = clamp(p.condition + 35, 0, 100); return null;
}
export function spendPoint(p, attr) {
  if (p.skillPts <= 0) return 'NO SKILL POINTS';
  if (p.attrs[attr] >= 10) return 'MAXED';
  p.attrs[attr]++;
  if (starsOf(p) > p.pot) { p.attrs[attr]--; return 'AT POTENTIAL'; }
  p.skillPts--; p.stars = starsOf(p); return null;
}

// ---------- contracts ----------
export function extendPlayer(c, p, years = 3) {
  if (p.morale < 30 || p.tradeReq) return `${p.last} REFUSES TO TALK`;
  const ask = askSalary(p);
  if (capRoom(c) + p.salary < ask) return 'NOT ENOUGH CAP ROOM';
  if (!spend(c, extendCC(p))) return 'NOT ENOUGH CC';
  p.salary = ask; p.years = (p.years > 0 ? p.years : 0) + years; p.morale = clamp(p.morale + 8, 0, 100);
  addNews(c, `${displayName(p)} SIGNED ${years} YEARS AT $${ask}M.`);
  return null;
}
export function releasePlayer(c, p) {
  c.roster = c.roster.filter((x) => x !== p);
  c.expiring = c.expiring.filter((id) => id !== p.id);
  addNews(c, `RELEASED ${p.pos} ${displayName(p)}.`);
  syncUserTeamRatings(c);
}
export function tradePlayer(c, p) {
  const gain = Math.max(1, Math.round(p.stars * (p.age < 30 ? 1 : 0.6)));
  c.roster = c.roster.filter((x) => x !== p);
  c.cc += gain;
  const rng = rngOf(c);
  const t = c.teams[(c.userTeamId + rng.int(1, 31)) % 32];
  saveRng(c, rng);
  addNews(c, `TRADED ${displayName(p)} TO ${t.abbr} FOR ${gain} CC.`);
  c.roster.forEach((x) => x.morale = clamp(x.morale - 1, 0, 100));
  syncUserTeamRatings(c);
  return gain;
}

// ---------- free agents ----------
export function genFreeAgents(c, n = 8) {
  const rng = rngOf(c);
  c.freeAgents = [];
  for (let i = 0; i < n; i++) {
    const pos = rng.pick(POSITIONS);
    const p = makePlayer(rng, pos, rng.pick([2.5, 3, 3, 3.5, 3.5, 4, 4.5]), { id: newId(c), age: rng.int(25, 32), years: rng.int(1, 3) });
    p.salary = Math.round(p.salary * 1.2 * 10) / 10;
    c.freeAgents.push(p);
  }
  saveRng(c, rng);
}
export function signFA(c, p) {
  if (c.roster.length >= MAX_STARS) return 'ROSTER FULL (12 STARS)';
  if (capRoom(c) < p.salary) return 'NOT ENOUGH CAP ROOM';
  if (!spend(c, faCC(p))) return 'NOT ENOUGH CC';
  c.freeAgents = c.freeAgents.filter((x) => x !== p);
  c.roster.push(p); p.morale = 75;
  addNews(c, `SIGNED FREE AGENT ${p.pos} ${displayName(p)} ($${p.salary}M).`);
  syncUserTeamRatings(c);
  return null;
}

// ---------- draft ----------
const ROUND_Q = [[1.5, 3, 3, 5], [1, 2.5, 2.5, 4.5], [0.5, 2, 2, 4]];
export function genDraftRound(c) {
  const rng = rngOf(c);
  const [s0, s1, p0, p1] = ROUND_Q[c.draft.round - 1];
  c.draft.pool = [];
  for (let i = 0; i < 7; i++) {
    const pos = rng.pick(POSITIONS);
    const st = Math.round(rng.range(s0, s1) * 2) / 2;
    const p = makePlayer(rng, pos, st, { id: newId(c), age: rng.int(21, 23), years: 3, rookie: true, morale: 75 });
    p.pot = clamp(Math.round(rng.range(Math.max(p0, p.stars), p1) * 2) / 2, p.stars, 5);
    p.salary = Math.round((1 + p.stars * 0.8) * 10) / 10;
    const fz = rng.pick([0.5, 0.5, 1]);
    p.scout = { stars: clamp(p.stars + rng.pick([-0.5, 0, 0, 0.5]), 0.5, 5), potLo: clamp(p.pot - rng.pick([0, 0.5, fz]), 0.5, 5), potHi: clamp(p.pot + rng.pick([0, 0.5, fz]), 0.5, 5) };
    c.draft.pool.push(p);
  }
  saveRng(c, rng);
}
export function draftPick(c, p) {
  if (c.roster.length >= MAX_STARS) return 'ROSTER FULL - RELEASE A STAR FIRST';
  if (capRoom(c) < p.salary) return 'NOT ENOUGH CAP ROOM';
  delete p.scout;
  c.roster.push(p);
  addNews(c, `DRAFTED ${p.pos} ${displayName(p)} IN ROUND ${c.draft.round}.`);
  c.draft.picks.push(p.id);
  nextDraftRound(c);
  return null;
}
export function nextDraftRound(c) {
  c.draft.round++;
  if (c.draft.round > 3) { c.stage = 'fa'; c.draft.pool = []; genFreeAgents(c, 10); }
  else genDraftRound(c);
}

// ---------- per-game economy ----------
export function postGame(c, info) {
  // info: {us, them, playoff, title, stats: {id: statobj}, oppId}
  const rng = rngOf(c);
  const won = info.us > info.them, tie = info.us === info.them;
  const sum = { cc: 0, xp: [], injuries: [], levelUps: [], won, tie, us: info.us, them: info.them };
  let cc = won ? 3 : tie ? 2 : 1;
  cc += Math.floor(c.fan / 34) + Math.floor(c.facilities.stadium / 2.5);
  if (info.playoff) cc += 2;
  if (info.title) cc += 5;
  c.cc += cc; sum.cc = cc;
  const margin = info.us - info.them;
  c.fan = clamp(c.fan + (won ? 3 : tie ? 0 : -3) + (margin >= 17 ? 2 : margin <= -17 ? -2 : 0) + (c.facilities.stadium - 2.5) * 0.4, 0, 100);
  const opp = c.teams[info.oppId], me = userTeam(c);
  const upset = (opp.off + opp.def) - (me.off + me.def);
  c.job = clamp(c.job + (won ? 2 : tie ? 0 : -2) + (won && upset > 0.5 ? 1 : 0) + (!won && !tie && upset < -0.5 ? -1 : 0) + (info.title ? 10 : 0), 0, 100);
  if (won) { c.coach.wins++; } else if (tie) c.coach.ties++; else c.coach.losses++;
  c.dyn = clamp(c.dyn + (won ? 0.05 + (margin >= 14 ? 0.05 : 0) : tie ? 0 : -0.08), -0.5, 1);
  const lu = buildLineup(c.roster);
  const starters = new Set(Object.values(lu).flat().filter((p) => !p.regular));
  const trainF = 0.6 + c.facilities.training * 0.2;
  for (const p of c.roster) {
    const st = info.stats[p.id];
    const played = starters.has(p);
    if (played) {
      const s = st || {};
      if (st) { addStats(p.season, st); addStats(p.career, st); }
      p.season.gp++; p.career.gp++;
      let xp = 15 + (s.pyds || 0) / 8 + (s.ptd || 0) * 12 - (s.pint || 0) * 6 + (s.ryds || 0) / 3 + (s.rtd || 0) * 15 + (s.recyds || 0) / 3 + (s.rectd || 0) * 15
        + (s.tkl || 0) * 4 + (s.sck || 0) * 12 + (s.dint || 0) * 15 + (s.fgm || 0) * 8 + (won ? 10 : 0);
      const isOff = ['QB', 'RB', 'WR', 'TE', 'OL'].includes(p.pos);
      const coord = isOff ? c.coords.oc : ['DL', 'LB', 'DB'].includes(p.pos) ? c.coords.dc : null;
      xp = Math.max(5, Math.round(xp * trainF * (1 + 0.06 * (coord?.stars || 0))));
      p.xp += xp; sum.xp.push([p, xp]);
      while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; p.skillPts++; sum.levelUps.push(p); }
      const sta = p.attrs.STA ?? 5;
      p.condition = clamp(p.condition - (18 + (10 - sta) * 2.2), 5, 100);
      const pInj = 0.025 + (100 - p.condition) / 100 * 0.08;
      if (rng.chance(pInj)) {
        const w = Math.max(1, Math.ceil(rng.int(1, 6) * (1.15 - c.facilities.rehab * 0.1)));
        p.injury = w; sum.injuries.push([p, w]);
        addNews(c, `${p.pos} ${displayName(p)} INJURED (${w} WK).`);
      }
    } else if (!p.injury) p.morale = clamp(p.morale - 2, 0, 100);
    p.morale = clamp(p.morale + (won ? 3 : tie ? 0 : -3), 0, 100);
  }
  // press conference
  if (rng.chance(0.4)) c.pending.push(makeEvent(c, rng, 'press'));
  saveRng(c, rng);
  syncUserTeamRatings(c);
  c.lastSummary = { ...sum, xp: sum.xp.map(([p, x]) => [displayName(p), x]), injuries: sum.injuries.map(([p, w]) => [displayName(p), w]), levelUps: sum.levelUps.map(displayName) };
  return c.lastSummary;
}
export function weekly(c) {
  const rng = rngOf(c);
  const rec = 25 + c.facilities.rehab * 6;
  for (const p of c.roster) {
    p.condition = clamp(p.condition + rec, 0, 100);
    if (p.injury > 0) { p.injury--; if (!p.injury) addNews(c, `${displayName(p)} IS BACK FROM INJURY.`); }
    if (p.morale < 25 && !p.tradeReq && rng.chance(0.25)) {
      p.tradeReq = true;
      c.pending.push(makeEvent(c, rng, 'trade', p));
    }
  }
  if (rng.chance(0.12) && c.pending.length === 0) c.pending.push(makeEvent(c, rng, 'random'));
  saveRng(c, rng);
}

// ---------- press conferences & events ----------
const PRESS = [
  { q: 'REPORTER: WHO DESERVES THE CREDIT FOR TODAY?', a: [['THE PLAYERS, ALL OF THEM', { morale: 4 }], ['OUR GAME PLAN', { job: 2, morale: -2 }], ['NO COMMENT', { fan: -2 }]] },
  { q: 'REPORTER: ARE YOU FEELING THE PRESSURE?', a: [['PRESSURE IS A PRIVILEGE', { job: 2, fan: 1 }], ['THE OWNER BACKS ME', { job: -2, morale: 1 }], ['ASK ME AFTER THE SEASON', { fan: -1 }]] },
  { q: 'A RIVAL COACH MOCKED YOUR TEAM ON RADIO.', a: [['FIRE BACK HARD', { morale: 5, fan: 3, job: -2 }], ['TAKE THE HIGH ROAD', { job: 2 }], ['LAUGH IT OFF', { morale: 1 }]] },
  { q: 'REPORTER: IS {P} YOUR MOST IMPORTANT PLAYER?', a: [['ABSOLUTELY', { pmorale: 12, morale: -2 }], ['EVERYONE MATTERS', { morale: 2 }], ['HE HAS WORK TO DO', { pmorale: -10, job: 1 }]] },
  { q: 'FANS ASK: WHEN WILL WE WIN IT ALL?', a: [['THIS YEAR. MARK IT.', { fan: 5, job: -1 }], ['WE ARE BUILDING', { fan: -2, job: 2 }], ['ONE GAME AT A TIME', { fan: 1 }]] },
  { q: '{P} SAYS HE WANTS THE BALL MORE.', a: [['HE WILL GET IT', { pmorale: 15, morale: -3 }], ['EARN IT IN PRACTICE', { pmorale: -10, morale: 2 }], ['WE WILL TALK PRIVATELY', { pmorale: 5 }]] },
];
const RANDOM = [
  { q: 'LOCAL CHARITY ASKS FOR A TEAM VISIT.', a: [['SEND THE TEAM (1 CC)', { cc: -1, fan: 5, morale: 3 }], ['SEND A CHECK', { fan: 1 }], ['DECLINE', { fan: -3 }]] },
  { q: '{P} WAS SEEN OUT LATE BEFORE GAMEDAY.', a: [['FINE HIM', { pmorale: -12, job: 2 }], ['QUIET WORD', { pmorale: -3 }], ['IGNORE IT', { morale: -3, fan: -1 }]] },
  { q: 'THE OWNER WANTS CHEAPER TICKETS.', a: [['CUT PRICES', { fan: 6, job: 1, cc: -1 }], ['KEEP PRICES', { fan: -3, cc: 1 }]] },
  { q: '{P} WANTS A RAISE RIGHT NOW.', a: [['GIVE +$2M', { pmorale: 15, raise: 2 }], ['IN THE OFFSEASON', { pmorale: -8 }], ['NOT HAPPENING', { pmorale: -18, job: 1 }]] },
  { q: 'A SPONSOR OFFERS A DEAL FOR AN AD SHOOT.', a: [['TAKE IT (+2 CC)', { cc: 2, morale: -3 }], ['PLAYERS NEED REST', { morale: 2 }]] },
];
export function makeEvent(c, rng, kind, who = null) {
  const p = who || (c.roster.length ? rng.pick(c.roster) : null);
  if (kind === 'trade') {
    return { title: 'TRADE DEMAND', q: `${p.pos} ${displayName(p)} DEMANDS A TRADE!`, pid: p.id,
      a: [['TRADE HIM (GAIN CC)', { trade: 1 }], ['MEET HIM (1 CC)', { cc: -1, pmorale: 25, clear: 1 }], ['REFUSE', { pmorale: -10 }]] };
  }
  const t = rng.pick(kind === 'press' ? PRESS : RANDOM);
  const name = p ? `${p.pos} ${displayName(p)}` : 'YOUR STAR';
  return { title: kind === 'press' ? 'PRESS CONFERENCE' : 'FRONT OFFICE', q: t.q.replace('{P}', name), pid: p?.id ?? null, a: t.a };
}
export function applyChoice(c, ev, i) {
  const e = ev.a[i][1];
  const p = c.roster.find((x) => x.id === ev.pid);
  let msg = '';
  if (e.cc && e.cc < 0 && c.cc < -e.cc) return 'NOT ENOUGH CC';
  if (e.trade && p) { msg = `TRADED FOR ${tradePlayer(c, p)} CC`; }
  if (e.cc) c.cc += e.cc;
  if (e.fan) c.fan = clamp(c.fan + e.fan, 0, 100);
  if (e.job) c.job = clamp(c.job + e.job, 0, 100);
  if (e.morale) c.roster.forEach((x) => x.morale = clamp(x.morale + e.morale, 0, 100));
  if (p && e.pmorale) p.morale = clamp(p.morale + e.pmorale, 0, 100);
  if (p && e.clear) p.tradeReq = false;
  if (p && e.raise) p.salary = Math.round((p.salary + e.raise) * 10) / 10;
  c.pending.shift();
  return msg || null;
}

// ---------- season end / offseason ----------
function playoffResult(c) {
  const P = c.playoffs;
  if (!P || !P.seeds.some((s) => s.includes(c.userTeamId))) return { text: 'MISSED PLAYOFFS', wins: 0, made: false };
  if (P.champion === c.userTeamId) return { text: 'PIXEL BOWL CHAMPIONS!', wins: 4, made: true, title: true };
  let wins = 0, lost = 'WILD CARD';
  P.rounds.forEach((r, i) => r.forEach((g) => {
    if (g.hs === null) return;
    const mine = g.h === c.userTeamId ? g.hs - g.as : g.a === c.userTeamId ? g.as - g.hs : null;
    if (mine === null) return;
    if (mine > 0) wins++; else lost = ROUND_NAMES[i];
  }));
  return { text: `LOST IN ${lost}`, wins, made: true };
}
export function startOffseason(c) {
  const t = userTeam(c);
  const res = playoffResult(c);
  const champ = c.teams[c.playoffs.champion];
  const score = (p) => p.season.pyds / 25 + p.season.ptd * 4 + p.season.ryds / 10 + p.season.recyds / 10 + (p.season.rtd + p.season.rectd) * 6 + p.season.tkl + p.season.sck * 4 + p.season.dint * 5 + p.season.fgm * 2;
  const mvp = c.roster.slice().sort((a, b) => score(b) - score(a))[0];
  const rng = rngOf(c);
  const fake = () => `${rng.pick(FIRST)[0]}. ${rng.pick(LAST)}`;
  const awards = [
    ['TEAM MVP', mvp ? `${mvp.pos} ${displayName(mvp)}` : '-'],
    ['LEAGUE MVP', rng.chance(res.title ? 0.5 : 0.1) && mvp ? `${displayName(mvp)} (${t.abbr})` : `QB ${fake()} (${rng.pick(c.teams).abbr})`],
    ['OFF. ROOKIE', `${rng.pick(['RB', 'WR', 'QB'])} ${fake()} (${rng.pick(c.teams).abbr})`],
    ['DEF. PLAYER', `${rng.pick(['DL', 'LB', 'DB'])} ${fake()} (${rng.pick(c.teams).abbr})`],
    ['COACH OF YEAR', pct(t) >= 0.75 ? c.coach.name : `${rng.pick(COACH_FIRST)} ${rng.pick(LAST)}`],
  ];
  saveRng(c, rng);
  if (res.title) c.coach.titles++;
  c.history.unshift({ year: c.year, team: t.abbr, w: t.w, l: t.l, t: t.t, result: res.text, champ: champ ? teamName(champ) : '-', mvp: awards[0][1] });
  c.seasonEnd = { res, awards, champ: champ ? teamName(champ) : '-' };
  addNews(c, `${champ ? champ.city + ' ' + champ.name : '?'} WIN PIXEL BOWL ${c.year}!`);
  c.phase = 'offseason'; c.stage = 'awards';
}
export function jobReview(c) {
  const t = userTeam(c), res = c.seasonEnd.res;
  let d = 0;
  d += res.made ? 12 + res.wins * 5 : -8;
  if (res.title) d += 20;
  if (t.w < t.l) d -= 8;
  d += Math.round((pct(t) - 0.5) * 20);
  c.job = clamp(c.job + d, 0, 100);
  const limit = c.settings.difficulty === 'EASY' ? 6 : 12;
  c.seasonEnd.jobDelta = d;
  if (c.job < limit) {
    c.stage = 'fired';
    const rng = rngOf(c);
    const cands = c.teams.filter((x) => x.id !== c.userTeamId).sort((a, b) => (a.off + a.def) - (b.off + b.def)).slice(0, 12);
    c.offers = rng.shuffle(cands).slice(0, 3).map((x) => x.id);
    saveRng(c, rng);
    addNews(c, `COACH ${c.coach.name} FIRED BY ${t.abbr}.`);
  } else {
    prepareResign(c);
  }
}
export function acceptOffer(c, teamId) {
  const old = userTeam(c);
  syncUserTeamRatings(c);
  const rng = rngOf(c);
  c.userTeamId = teamId;
  const t = userTeam(c);
  c.roster = genRoster(c, rng, Math.min(2.4, Math.max(2, (t.off + t.def) / 2 + 0.3)));
  saveRng(c, rng);
  c.cc = Math.floor(c.cc / 2); c.job = 50; c.fan = 45;
  c.facilities = { stadium: rng.int(1, 3), training: rng.int(1, 3), rehab: rng.int(1, 3) };
  c.coords = { oc: null, dc: null };
  c.dyn = Math.min(c.dyn, 0);
  c.coach.teams.push(t.abbr);
  addNews(c, `COACH ${c.coach.name} HIRED BY THE ${t.city} ${t.name}. (LEFT ${old.abbr})`);
  c.offers = null;
  prepareResign(c, true);
}
export function prepareResign(c, fresh = false) {
  const rng = rngOf(c);
  if (!fresh) {
    for (const p of c.roster.slice()) {
      p.age++;
      if (p.age >= 30) for (const k of ATTRS[p.pos]) if (rng.chance((p.age - 29) * 0.12)) p.attrs[k] = Math.max(1, p.attrs[k] - 1);
      p.stars = starsOf(p); p.pot = Math.max(p.pot, p.stars);
      if (p.age >= 30) p.pot = Math.max(p.stars, p.pot - 0.5);
      if (p.age >= 33 && rng.chance((p.age - 32) * 0.25)) {
        c.roster = c.roster.filter((x) => x !== p);
        addNews(c, `${p.pos} ${displayName(p)} RETIRES AT ${p.age}.`);
        continue;
      }
      p.years--; p.injury = 0; p.condition = 100; p.rookie = false;
    }
  }
  for (const k of Object.keys(c.facilities)) c.facilities[k] = Math.max(1, c.facilities[k] - 0.5);
  for (const t of c.teams) if (t.id !== c.userTeamId) {
    t.off = Math.round(clamp(t.off + (2.25 - t.off) * 0.2 + rng.range(-0.45, 0.45), 1, 5) * 10) / 10;
    t.def = Math.round(clamp(t.def + (2.25 - t.def) * 0.2 + rng.range(-0.45, 0.45), 1, 5) * 10) / 10;
  }
  saveRng(c, rng);
  c.expiring = c.roster.filter((p) => p.years <= 0).map((p) => p.id);
  c.stage = 'resign';
}
export function resignPlayer(c, p) {
  if (p.tradeReq || p.morale < 25) return `${p.last} WANTS OUT`;
  const ask = askSalary(p);
  if (capRoom(c) + p.salary < ask) return 'NOT ENOUGH CAP ROOM';
  if (!spend(c, extendCC(p))) return 'NOT ENOUGH CC';
  p.salary = ask; p.years = 3; p.morale = clamp(p.morale + 5, 0, 100);
  c.expiring = c.expiring.filter((id) => id !== p.id);
  addNews(c, `RE-SIGNED ${displayName(p)} (3 YRS, $${ask}M).`);
  return null;
}
export function finishResign(c) {
  for (const id of c.expiring) {
    const p = c.roster.find((x) => x.id === id);
    if (!p) continue;
    c.roster = c.roster.filter((x) => x !== p);
    addNews(c, `${p.pos} ${displayName(p)} LEFT IN FREE AGENCY.`);
  }
  c.roster.forEach((p) => { if (p.tradeReq) p.tradeReq = false; });
  c.expiring = [];
  c.stage = 'draft';
  c.draft = { round: 1, pool: [], picks: [] };
  genDraftRound(c);
}
export function newSeason(c) {
  c.year++; c.week = 0; c.phase = 'preseason'; c.stage = null; c.playoffs = null; c.seasonEnd = null;
  for (const t of c.teams) { t.w = t.l = t.t = t.pf = t.pa = 0; }
  const rng = rngOf(c);
  c.schedule = genSchedule(rng);
  saveRng(c, rng);
  for (const p of c.roster) { p.season = newStats(); p.condition = 100; }
  c.draft = null;
  genFreeAgents(c, 8);
  syncUserTeamRatings(c);
  addNews(c, `SEASON ${c.year} BEGINS.`);
}
export { MAX_STARS, WEEKS };
