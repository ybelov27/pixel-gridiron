// League structure: career creation, schedule, standings, sims, playoffs, difficulty.
import { RNG, clamp, lerp } from './rng.js';
import { TEAM_DATA, COACH_FIRST, LAST } from './data.js';
import { makePlayer, buildLineup, unitRating, POSITIONS, SLOTS, makeRegularPlayer, TRAITS, CELEBS } from './players.js';

export const WEEKS = 16;
export const SAVE_VERSION = 1;
export const DIFFS = ['EASY', 'MEDIUM', 'HARD', 'EXTREME'];
// harder games pay more: coaching credits and XP multipliers per difficulty
export const DIFF_MULT = { EASY: { cc: 0.75, xp: 0.9 }, MEDIUM: { cc: 1, xp: 1 }, HARD: { cc: 1.5, xp: 1.15 }, EXTREME: { cc: 2, xp: 1.3 } };
// per-difficulty knobs, interpolated by continuous level (difficulty + dynamic offset)
const DK = {
  sim: [-0.08, 0, 0.05, 0.1],      // opponent drive strength
  assist: [0.85, 0.6, 0.35, 0.1],   // throw aim assist
  react: [0.14, 0, -0.05, -0.09],  // defender reaction delay delta (s)
  spd: [-0.7, 0, 0.35, 0.7],       // defender speed delta (yd/s)
  contest: [-0.12, 0, 0.07, 0.14], // contested-catch / tackle edge for defense
  cpu: [-0.3, 0, 0.25, 0.5],       // CPU team rating bonus vs user
};
export function diffLevel(c) {
  const base = DIFFS.indexOf(c.settings.difficulty);
  return clamp(base + (c.settings.dynamic ? c.dyn : 0), 0, 3.6);
}
export function diffParams(c) {
  const v = diffLevel(c), out = {};
  for (const k in DK) {
    const a = DK[k], i = Math.min(2, Math.floor(v));
    out[k] = lerp(a[i], a[i + 1], v - i);
  }
  return out;
}

export function rngOf(c) { const r = new RNG(1); r.s = c.rng; return r; }
export function saveRng(c, r) { c.rng = r.s; }
export const newId = (c) => c.nextId++;

export function genRoster(c, rng, rating) {
  // 9-10 stars spread over offense and defense, always better than a regular
  const roster = [];
  const chosen = ['QB', 'RB', 'WR', 'WR', rng.pick(['TE', 'OL']), 'K', 'DL', 'LB', 'DB', rng.pick(['DL', 'DB', 'LB'])];
  if (rng.chance(0.5)) chosen.push(rng.pick(['WR', 'OL', 'DL']));
  for (const pos of chosen) {
    const st = clamp(Math.round((rating + rng.range(-0.6, 0.9)) * 2) / 2, 1.5, rating < 2.2 ? 3 : 3.5);
    roster.push(makePlayer(rng, pos, st, { id: newId(c) }));
  }
  return roster;
}

export function genRegulars(rng) {
  const out = {};
  for (const pos of POSITIONS) out[pos] = Array.from({ length: SLOTS[pos] + 1 }, (_, i) => makeRegularPlayer(rng, pos, i));
  return out;
}
// bring older saves up to date: named regulars and a skill for every star
export function migrateCareer(c) {
  const rng = rngOf(c);
  if (!c.regulars) c.regulars = genRegulars(rng);
  c.music ||= { owned: ['fanfare'], equipped: 'fanfare' };
  // older careers used invented clubs: rename them to the real team in the same slot (records and ratings stay)
  c.teams.forEach((t, i) => { const d = TEAM_DATA[i]; Object.assign(t, { city: d[0], name: d[1], abbr: d[2], c1: d[3], c2: d[4] }); });
  const fix = (p) => { if (p && !p.trait && TRAITS[p.pos]) p.trait = rng.pick(TRAITS[p.pos])[0]; if (p && !p.celeb) p.celeb = rng.pick(CELEBS); };
  c.roster.forEach(fix);
  Object.values(c.regulars).flat().forEach((p) => { if (!p.celeb) p.celeb = rng.pick(CELEBS); }); (c.freeAgents || []).forEach(fix); (c.draft?.pool || []).forEach(fix);
  saveRng(c, rng);
  return c;
}
export function newCareer(o) {
  const seed = o.seed ?? (Date.now() & 0x7fffffff);
  const rng = new RNG(seed);
  const c = {
    version: SAVE_VERSION, seed, rng: 0, nextId: 1, year: 1, week: 0, phase: 'preseason', stage: null,
    settings: { qlen: o.qlen ?? 2, difficulty: o.difficulty ?? 'MEDIUM', dynamic: o.dynamic ?? true, sound: true },
    dyn: 0, coach: { name: o.coachName || `${rng.pick(COACH_FIRST)} ${rng.pick(LAST)}`, wins: 0, losses: 0, ties: 0, titles: 0, teams: [] },
    cc: 10, fan: 50, job: 60, cap: 200, music: { owned: ['fanfare'], equipped: 'fanfare' },
    facilities: { stadium: 2, training: 2, rehab: 2 },
    coords: { oc: null, dc: null }, coordPool: null,
    teams: [], userTeamId: o.teamId ?? 0, roster: [], schedule: [], playoffs: null,
    news: [], history: [], freeAgents: [], draft: null, expiring: [], offers: null, pending: [], lastSummary: null,
  };
  c.teams = TEAM_DATA.map((d, i) => ({
    id: i, city: d[0], name: d[1], abbr: d[2], c1: d[3], c2: d[4], conf: Math.floor(i / 16), div: Math.floor(i / 4) % 4,
    off: Math.round(rng.range(1.3, 2.9) * 10) / 10, def: Math.round(rng.range(1.3, 2.9) * 10) / 10, w: 0, l: 0, t: 0, pf: 0, pa: 0,
  }));
  if (o.random) c.userTeamId = rng.int(0, 31);
  const ut = c.teams[c.userTeamId];
  c.roster = o.draftStart ? [] : genRoster(c, rng, 1.9); // a modest squad: you build it up
  c.regulars = genRegulars(rng);
  if (o.draftStart) { c.stage = 'draft'; c.draft = { kind: 'initial', round: 1, rounds: 10, pool: [], picks: [] }; }
  c.coach.teams.push(ut.abbr);
  c.schedule = genSchedule(rng);
  saveRng(c, rng);
  addNews(c, `WELCOME, COACH ${c.coach.name}! THE ${ut.city} ${ut.name} ARE YOURS.`);
  return c;
}
export function addNews(c, s) { c.news.unshift(`Y${c.year} ` + s); if (c.news.length > 40) c.news.length = 40; }
export const userTeam = (c) => c.teams[c.userTeamId];
export const teamName = (t) => `${t.city} ${t.name}`;

export function genSchedule(rng) {
  const weeks = [];
  const played = new Set();
  const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const divRounds = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  for (let rep = 0; rep < 2; rep++) for (const r of divRounds) {
    const wk = [];
    for (let d = 0; d < 8; d++) for (const [x, y] of r) {
      const a = d * 4 + x, b = d * 4 + y;
      played.add(key(a, b));
      wk.push(rep ? { h: b, a } : { h: a, a: b });
    }
    weeks.push(wk);
  }
  for (let w = 0; w < WEEKS - 6; w++) {
    let wk = null;
    for (let tries = 0; tries < 400 && !wk; tries++) {
      const ids = rng.shuffle([...Array(32).keys()]);
      const used = new Set(); const out = [];
      let ok = true;
      for (const a of ids) {
        if (used.has(a)) continue;
        const b = ids.find((x) => x !== a && !used.has(x) && !played.has(key(a, x)) && Math.floor(x / 4) !== Math.floor(a / 4));
        if (b === undefined) { ok = false; break; }
        used.add(a); used.add(b);
        out.push(rng.chance(0.5) ? { h: a, a: b } : { h: b, a });
      }
      if (ok) wk = out;
    }
    if (!wk) wk = weeks[w % 6].map((g) => ({ h: g.a, a: g.h })); // fallback (never seen in practice)
    wk.forEach((g) => played.add(key(g.h, g.a)));
    weeks.push(wk);
  }
  // spread division games across the season
  const order = rng.shuffle([...Array(WEEKS).keys()]);
  return order.map((i) => weeks[i].map((g) => ({ ...g, hs: null, as: null, ot: false })));
}

export function userOffRating(c) { return unitRating(buildLineup(c.roster, c.regulars), 'off') + (c.coords.oc?.stars || 0) * 0.12; }
export function userDefRating(c) { return unitRating(buildLineup(c.roster, c.regulars), 'def') + (c.coords.dc?.stars || 0) * 0.15; }
export function teamRatings(c, id) {
  if (id === c.userTeamId) return { off: userOffRating(c), def: userDefRating(c) };
  const t = c.teams[id];
  return { off: t.off, def: t.def };
}
export function syncUserTeamRatings(c) {
  const t = userTeam(c);
  t.off = Math.round(userOffRating(c) * 10) / 10; t.def = Math.round(userDefRating(c) * 10) / 10;
}

// One simulated possession. Ratings on the star scale; startYard from the offense's goal (0-100).
export function driveOutcome(rng, off, def, startYard, mod = 0) {
  const d = (off - def) * 0.07 + mod;
  const f = clamp((startYard - 25) / 75, -0.3, 1);
  let pTD = clamp(0.16 + d + f * 0.35, 0.03, 0.85);
  let pFG = clamp(0.14 + f * 0.12 + d * 0.3, 0.04, 0.3);
  let pTO = clamp(0.11 - d * 0.4, 0.03, 0.25);
  let pDN = 0.05;
  let pP = Math.max(0.05, 1 - pTD - pFG - pTO - pDN);
  const tot = pTD + pFG + pTO + pDN + pP;
  let r = rng.next() * tot;
  let res;
  if ((r -= pTD) < 0) res = 'TD'; else if ((r -= pFG) < 0) res = 'FG'; else if ((r -= pTO) < 0) res = 'TO'; else if ((r -= pDN) < 0) res = 'DOWNS'; else res = 'PUNT';
  let endYard;
  if (res === 'TD') endYard = 100;
  else if (res === 'FG') endYard = rng.int(Math.max(startYard, 55), 88);
  else if (res === 'PUNT') endYard = rng.int(startYard, Math.max(startYard, Math.min(startYard + 35, 65)));
  else endYard = clamp(startYard + rng.int(0, 50), startYard, 95);
  if (res === 'FG' && endYard < startYard) endYard = startYard;
  const plays = Math.max(3, Math.round((endYard - startYard) / rng.range(5, 9)) + rng.int(0, 2));
  return { res, endYard, plays, startYard };
}

// Whole-game sim between rating sets. Returns {a, b, ot}.
export function simGame(rng, A, B, allowTie = true, homeAdv = 0.15) {
  let a = 0, b = 0;
  const drives = rng.int(9, 11);
  const pts = (res) => res === 'TD' ? 6 + (rng.chance(0.94) ? 1 : 0) : res === 'FG' ? 3 : 0;
  for (let i = 0; i < drives; i++) {
    a += pts(driveOutcome(rng, A.off + homeAdv, B.def, rng.int(15, 40)).res);
    b += pts(driveOutcome(rng, B.off, A.def + homeAdv, rng.int(15, 40)).res);
  }
  let ot = false;
  if (a === b) {
    ot = true;
    for (let k = 0; k < 6 && a === b; k++) {
      const ra = driveOutcome(rng, A.off, B.def, 25).res, rb = driveOutcome(rng, B.off, A.def, 25).res;
      if (ra === 'TD' && k === 0) { a += 6; break; }
      a += pts(ra); if (a !== b && rb !== 'TD') break;
      b += pts(rb);
      if (allowTie && k === 0 && a === b) break;
    }
    if (!allowTie && a === b) (rng.chance(0.5) ? a += 3 : b += 3);
  }
  return { a, b, ot };
}

export function recordResult(c, g, hs, as, ot = false) {
  g.hs = hs; g.as = as; g.ot = ot;
  if (c.phase === 'playoffs') return; // playoff games don't touch the regular-season table
  const H = c.teams[g.h], A = c.teams[g.a];
  H.pf += hs; H.pa += as; A.pf += as; A.pa += hs;
  if (hs > as) { H.w++; A.l++; } else if (as > hs) { A.w++; H.l++; } else { H.t++; A.t++; }
}

export function cpuRatings(c, id, rng) {
  const t = c.teams[id];
  const bonus = id === c.userTeamId ? 0 : 0;
  return { off: t.off + bonus, def: t.def + bonus };
}
export function simOtherGames(c, games, rng, allowTie) {
  for (const g of games) {
    if (g.hs !== null || g.h === c.userTeamId || g.a === c.userTeamId) continue;
    const r = simGame(rng, teamRatings(c, g.h), teamRatings(c, g.a), allowTie);
    recordResult(c, g, r.a, r.b, r.ot);
  }
}
export function userGameThisWeek(c) {
  if (c.phase === 'regular') return c.schedule[c.week]?.find((g) => g.h === c.userTeamId || g.a === c.userTeamId) || null;
  if (c.phase === 'playoffs' && c.playoffs) return c.playoffs.rounds[c.playoffs.round]?.find((g) => (g.h === c.userTeamId || g.a === c.userTeamId) && g.hs === null) || null;
  return null;
}

export function pct(t) { const g = t.w + t.l + t.t; return g ? (t.w + t.t * 0.5) / g : 0; }
export function sortTeams(ts) { return ts.slice().sort((x, y) => pct(y) - pct(x) || (y.pf - y.pa) - (x.pf - x.pa) || y.pf - x.pf || x.id - y.id); }
export function divisionTeams(c, conf, div) { return sortTeams(c.teams.filter((t) => t.conf === conf && t.div === div)); }

export const ROUND_NAMES = ['WILD CARD', 'DIVISIONAL', 'CONFERENCE', 'PIXEL BOWL'];
export function seedPlayoffs(c) {
  const seeds = [[], []];
  for (let conf = 0; conf < 2; conf++) {
    const winners = sortTeams([0, 1, 2, 3].map((d) => divisionTeams(c, conf, d)[0]));
    const rest = sortTeams(c.teams.filter((t) => t.conf === conf && !winners.includes(t))).slice(0, 2);
    seeds[conf] = [...winners, ...rest].map((t) => t.id);
  }
  c.playoffs = { seeds, round: 0, rounds: [], champion: null };
  c.playoffs.rounds.push(seeds.flatMap((s, conf) => [mk(s[2], s[5], conf, 3, 6), mk(s[3], s[4], conf, 4, 5)]));
  return c.playoffs;
}
const mk = (h, a, conf, hs, as) => ({ h, a, conf, hseed: hs, aseed: as, hs: null, as: null, ot: false });
const winnerOf = (g) => g.hs > g.as ? { id: g.h, seed: g.hseed } : { id: g.a, seed: g.aseed };
export function advancePlayoffs(c) {
  const P = c.playoffs, cur = P.rounds[P.round];
  if (cur.some((g) => g.hs === null)) return false;
  if (P.round === 3) { P.champion = winnerOf(cur[0]).id; return true; }
  let next = [];
  if (P.round === 0) {
    for (let conf = 0; conf < 2; conf++) {
      const w = cur.filter((g) => g.conf === conf).map(winnerOf).sort((x, y) => x.seed - y.seed);
      const s = P.seeds[conf];
      next.push(mk(s[0], w[1].id, conf, 1, w[1].seed), mk(s[1], w[0].id, conf, 2, w[0].seed));
    }
  } else if (P.round === 1) {
    for (let conf = 0; conf < 2; conf++) {
      const w = cur.filter((g) => g.conf === conf).map(winnerOf).sort((x, y) => x.seed - y.seed);
      next.push(mk(w[0].id, w[1].id, conf, w[0].seed, w[1].seed));
    }
  } else {
    const w = cur.map(winnerOf);
    const [x, y] = sortTeams(w.map((v) => c.teams[v.id]));
    next.push({ ...mk(x.id, y.id, -1, 0, 0), neutral: true });
  }
  P.rounds.push(next); P.round++;
  return true;
}
export function userInPlayoffs(c) {
  if (!c.playoffs) return false;
  const r = c.playoffs.rounds[c.playoffs.round];
  return r.some((g) => (g.h === c.userTeamId || g.a === c.userTeamId));
}
export function userEliminated(c) {
  const P = c.playoffs; if (!P) return true;
  if (!P.seeds.some((s) => s.includes(c.userTeamId))) return true;
  for (const r of P.rounds) for (const g of r) {
    if (g.hs === null) continue;
    if ((g.h === c.userTeamId && g.hs < g.as) || (g.a === c.userTeamId && g.as < g.hs)) return true;
  }
  return false;
}
export { POSITIONS };
