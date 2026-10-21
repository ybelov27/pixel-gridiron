// Player model: attributes, star ratings, lineups, salaries, stats.
import { FIRST, LAST } from './data.js';
import { clamp } from './rng.js';

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'K', 'DL', 'LB', 'DB'];
export const ATTRS = {
  QB: ['ARM', 'ACC', 'SPD', 'STA'], RB: ['SPD', 'STR', 'CAT', 'STA'], WR: ['SPD', 'CAT', 'STR', 'STA'],
  TE: ['CAT', 'STR', 'SPD', 'STA'], OL: ['BLK', 'STR', 'SPD', 'STA'], K: ['LEG', 'ACC', 'CMP', 'STA'],
  DL: ['RSH', 'STR', 'TKL', 'STA'], LB: ['TKL', 'SPD', 'COV', 'STA'], DB: ['COV', 'SPD', 'TKL', 'STA'],
};
export const ATTR_LABEL = { ARM: 'ARM STRENGTH', ACC: 'ACCURACY', SPD: 'SPEED', STA: 'STAMINA', STR: 'STRENGTH', CAT: 'CATCHING',
  BLK: 'BLOCKING', LEG: 'LEG STRENGTH', CMP: 'COMPOSURE', RSH: 'PASS RUSH', TKL: 'TACKLING', COV: 'COVERAGE' };
export const SLOTS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, K: 1, DL: 4, LB: 3, DB: 4 };
export const OFF_POS = ['QB', 'RB', 'WR', 'TE', 'OL'];
export const DEF_POS = ['DL', 'LB', 'DB'];
export const MAX_STARS = 12;

export function starsOf(p) {
  const a = ATTRS[p.pos].map((k) => p.attrs[k]);
  const avg = a.reduce((s, v) => s + v, 0) / a.length;
  return clamp(Math.round(avg) / 2, 0.5, 5);
}
// overall rating 40-99 from the average attribute (1-10)
export function ovr(p) {
  const ks = p.attrs ? Object.keys(p.attrs) : [];
  const keys = p.pos && ATTRS[p.pos] ? ATTRS[p.pos] : ks;
  if (!keys.length) return 50;
  const avg = keys.reduce((s, k) => s + (p.attrs[k] ?? 3), 0) / keys.length;
  return Math.max(40, Math.min(99, Math.round(40 + (avg - 1) * 59 / 9)));
}
export const ovrColor = (v) => v >= 85 ? '#ffd23f' : v >= 72 ? '#3ccf6a' : v >= 58 ? '#f4f4f4' : '#9aa3cf';
export function salaryFor(stars, age = 26) {
  let s = 1 + 1.6 * stars * stars;
  if (age >= 31) s *= 0.8;
  return Math.round(s * 10) / 10;
}
export function newStats() {
  return { gp: 0, patt: 0, pcmp: 0, pyds: 0, ptd: 0, pint: 0, ratt: 0, ryds: 0, rtd: 0, rec: 0, recyds: 0, rectd: 0,
    tkl: 0, sck: 0, dint: 0, fgm: 0, fga: 0, xpm: 0, xpa: 0 };
}
export function xpForLevel(level) { return 100 + level * 40; }

export function makePlayer(rng, pos, stars, o = {}) {
  const age = o.age ?? rng.int(22, 31);
  const attrs = {};
  for (const k of ATTRS[pos]) attrs[k] = clamp(Math.round(stars * 2 + rng.gauss() * 1.1), 1, 10);
  const p = {
    id: o.id, first: rng.pick(FIRST), last: rng.pick(LAST), pos, age, attrs,
    pot: 0, xp: 0, level: 1, skillPts: 0, salary: 0, years: o.years ?? rng.int(1, 4),
    morale: o.morale ?? rng.int(55, 85), condition: 100, injury: 0, skin: rng.int(0, 3),
    season: newStats(), career: newStats(), rookie: !!o.rookie, tradeReq: false,
  };
  p.stars = starsOf(p);
  const youth = clamp((28 - age) / 6, 0, 1);
  p.pot = o.pot ?? clamp(Math.round((p.stars + rng.range(0, 1.2) + youth * rng.range(0.5, 2.5)) * 2) / 2, p.stars, 5);
  if (p.pot < p.stars) p.pot = p.stars;
  p.salary = o.salary ?? salaryFor(p.stars, age);
  return p;
}
const regCache = {};
export function makeRegular(pos, i = 0) {
  const key = pos + i;
  if (regCache[key]) return regCache[key];
  const attrs = {};
  ATTRS[pos].forEach((k, j) => attrs[k] = 3 + ((i + j) % 3 === 0 && j === 3 ? 1 : 0));
  const p = { id: null, regular: true, first: '', last: 'REGULAR', pos, attrs, condition: 100, morale: 70, skin: (i * 3 + pos.length) % 4 };
  p.stars = starsOf(p);
  return (regCache[key] = p);
}
export function displayName(p) { return p.regular ? pos3(p.pos) + ' REG' : `${p.first[0]}. ${p.last}`; }
const pos3 = (p) => p;

// effective attribute after condition and morale
export function eff(p, a) {
  const base = p.attrs[a] ?? 3;
  const cond = p.condition ?? 100, mor = p.morale ?? 70;
  return base * (0.75 + 0.25 * cond / 100) * (0.92 + 0.08 * mor / 100);
}

export function buildLineup(roster) {
  const lu = {};
  for (const pos of POSITIONS) {
    const avail = roster.filter((p) => p.pos === pos && !p.injury).sort((a, b) => b.stars - a.stars);
    lu[pos] = [];
    for (let i = 0; i < SLOTS[pos]; i++) lu[pos].push(avail[i] || makeRegular(pos, i));
  }
  return lu;
}
const OFF_W = { QB: 3, RB: 1, WR: 1, TE: 0.8, OL: 0.5 };
export function unitRating(lu, side) {
  let s = 0, w = 0;
  const poss = side === 'off' ? OFF_POS : DEF_POS;
  for (const pos of poss) for (const p of lu[pos]) {
    const wt = side === 'off' ? OFF_W[pos] : 1;
    const cf = 0.8 + 0.2 * (p.condition ?? 100) / 100;
    s += p.stars * cf * wt; w += wt;
  }
  return s / w;
}
export function addStats(dst, src) { for (const k in src) dst[k] = (dst[k] || 0) + src[k]; }
