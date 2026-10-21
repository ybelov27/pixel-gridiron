// Headless tests: node tests/run.mjs
import assert from 'node:assert/strict';
import { RNG } from '../src/rng.js';
import { throwError, PlaySim, flightOf, maxThrow } from '../src/play.js';
import { PLAYS } from '../src/playbook.js';
import { buildLineup, makePlayer } from '../src/players.js';
import { newCareer, diffParams, userGameThisWeek } from '../src/league.js';
import { Match } from '../src/match.js';
import * as O from '../src/office.js';
import { status, startSeason, simUserGame, simRound, finishUserGame, resumableGame } from '../src/flow.js';
import { serialize, deserialize } from '../src/save.js';

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  -', name); } catch (e) { console.error('FAIL-', name, '\n', e); process.exitCode = 1; } };

// ---------------------------------------------------------------- 1. accuracy spread
test('5-star QB throws are much tighter than 1-star', () => {
  const miss = (acc) => {
    const rng = new RNG(42); let s = 0;
    for (let i = 0; i < 4000; i++) {
      const e = throwError(rng, acc, 30, false);
      const lat = Math.sin(e.ang) * (30 + e.d), lon = Math.cos(e.ang) * (30 + e.d) - 30;
      s += Math.hypot(lat, lon);
    }
    return s / 4000;
  };
  const five = miss(10), one = miss(2);
  console.log(`      mean miss @30yd: 5-star ${five.toFixed(2)} yd, 1-star ${one.toFixed(2)} yd`);
  assert.ok(one > five * 4, 'expected 1-star spread >= 4x the 5-star spread');
});

// play-level: run passes to the open WR in the full sim with each QB
function qbPlayer(acc) { const p = makePlayer(new RNG(7), 'QB', 3, { id: 999 }); p.attrs.ACC = acc; p.attrs.ARM = 8; return p; }
function runPass(acc, seed, bullet) {
  const rng = new RNG(seed);
  const lu = buildLineup([qbPlayer(acc)]);
  const play = PLAYS.find((p) => p.name === 'FOUR VERTS');
  const sim = new PlaySim({ play, lineup: lu, defRating: 2.5, losX: 40, ballY: 26.67, diff: { sim: 0, react: 0, spd: 0, contest: 0, cpu: 0 }, rng });
  sim.snap();
  let thrown = false;
  for (let i = 0; i < 60 * 12 && !sim.done; i++) {
    if (!thrown && sim.t > 1.6 && sim.canThrow()) {
      const r = sim.WR[0]; const d = Math.hypot(r.x - sim.QB.x, r.y - sim.QB.y), T = flightOf(d, bullet).T; sim.throwTo(r.x + r.vx * T * 0.9, r.y + r.vy * T * 0.9, bullet); thrown = true;
    }
    sim.update(1 / 60);
  }
  return sim.result;
}
test('ratings change completion % and INTs in the live sim', () => {
  const tally = (acc) => { let c = 0, int = 0, n = 0; for (let s = 1; s <= 300; s++) { const r = runPass(acc, s, false); if (!r || !r.thrown) continue; n++; if (r.receiver) c++; if (r.kind === 'int') int++; } return { pct: c / n, int: int / n, n }; };
  const a = tally(10), b = tally(2);
  console.log(`      5-star: ${(a.pct * 100).toFixed(0)}% comp, ${(a.int * 100).toFixed(1)}% int | 1-star: ${(b.pct * 100).toFixed(0)}% comp, ${(b.int * 100).toFixed(1)}% int`);
  assert.ok(a.pct > b.pct + 0.15, 'elite QB should complete clearly more');
  assert.ok(b.int > 0, 'bad throws should produce interceptions');
});
test('lob vs bullet differ in flight time and contested outcomes', () => {
  let lobT = 0, bulT = 0, lobBreak = 0, bulBreak = 0;
  for (let s = 1; s <= 200; s++) {
    const r1 = runPass(8, s, false), r2 = runPass(8, s, true);
    if (r1 && (r1.kind === 'int' || /BROKEN|DEFLECT/.test(r1.msg))) lobBreak++;
    if (r2 && (r2.kind === 'int' || /BROKEN|DEFLECT/.test(r2.msg))) bulBreak++;
  }
  lobT = flightOf(25, false).T; bulT = flightOf(25, true).T;
  console.log(`      25yd flight: lob ${lobT.toFixed(2)}s, bullet ${bulT.toFixed(2)}s | defended: lob ${lobBreak}, bullet ${bulBreak}`);
  assert.ok(lobT > bulT * 1.6);
  assert.ok(lobBreak > bulBreak, 'defenders should get to lobs more often');
});

// ---------------------------------------------------------------- 2. headless full match
export function autopilot(m, maxSteps = 60 * 60 * 40) {
  const dt = 1 / 60; let thrown = false; let steps = 0; const seen = new Set();
  while (m.phase !== 'final' && steps++ < maxSteps) {
    seen.add(m.phase);
    if (m.phase === 'presnap') { m.snap(); thrown = false; }
    else if (m.phase === 'choice') { const o = m.options.find((x) => !x.disabled); o.fn(); }
    else if (m.phase === 'kick') { const k = m.kick; if (k.stage === 'aim' && Math.abs(k.ang) < 1.5) k.tap(); else if (k.stage === 'power' && k.power > 0.85 && k.pdir > 0) k.tap(); }
    else if (m.phase === 'live') {
      const p = m.play;
      if (p.canHandoff() && p.play.type === 'run') p.handoff();
      else if (!thrown && p.canThrow() && p.t > 1.5) {
        const r = p.receivers.filter((x) => !x.block && !x.run).sort((a, b) => Math.min(...p.defs.map((d) => Math.hypot(d.x - b.x, d.y - b.y))) - Math.min(...p.defs.map((d) => Math.hypot(d.x - a.x, d.y - a.y))))[0];
        if (r) { const bl = steps % 3 === 0, T = flightOf(Math.hypot(r.x - p.QB.x, r.y - p.QB.y), bl).T; p.throwTo(r.x + r.vx * T, r.y + r.vy * T, bl); thrown = true; }
      }
      if (p.carrier && steps % 40 === 0) p.juke(steps % 80 ? 1 : -1);
    }
    m.update(dt);
  }
  return { steps, seen };
}
test('a full 4-quarter game completes with sane scores', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const c = newCareer({ seed, teamId: seed, qlen: 2 });
    startSeason(c);
    const g = userGameThisWeek(c);
    const m = new Match(c, g);
    const { steps, seen } = autopilot(m);
    assert.equal(m.phase, 'final', 'game did not finish');
    assert.ok(m.q >= 4);
    assert.ok(seen.has('opp') && seen.has('live'));
    const res = m.result();
    console.log(`      seed ${seed}: ${res.us}-${res.them}${res.ot ? ' OT' : ''} (${(steps / 60 / 60).toFixed(1)} sim-min, phases ${[...seen].join(',')})`);
    assert.ok(res.us >= 0 && res.them >= 0 && res.us < 120 && res.them < 100);
    const sum = finishUserGame(c, g, res);
    assert.ok(sum.cc >= 1);
  }
});
test('overtime resolves', () => {
  const c = newCareer({ seed: 99, teamId: 3, qlen: 1 });
  startSeason(c); c.phase = 'regular';
  const m = new Match(c, userGameThisWeek(c));
  // fast-forward to the end of regulation, tied
  m.q = 4; m.clock = 0.01; m.score = { u: 10, o: 10 };
  autopilot(m);
  assert.equal(m.phase, 'final');
  assert.ok(m.q >= 5, 'should have gone to OT');
});

test('kickoff returns produce realistic field position', () => {
  const lu = buildLineup([]);
  const res = { n: 0, yd: 0, td: 0, tb: 0, fum: 0 };
  for (let s = 1; s <= 400; s++) {
    const sim = new PlaySim({ mode: 'return', lineup: lu, defRating: 2.3, diff: { sim: 0, react: 0, spd: 0, contest: 0, cpu: 0 }, rng: new RNG(s) });
    if (s % 2) sim.returnBall();
    for (let i = 0; i < 60 * 30 && !sim.done; i++) { if (sim.carrier && i % 50 === 0) sim.juke(i % 100 ? 1 : -1); sim.update(1 / 60); }
    const r = sim.result; assert.ok(r, 'return produced no result');
    res.n++;
    if (r.kind === 'td') res.td++; else if (r.kind === 'touchback') res.tb++; else if (r.kind === 'fumble') res.fum++; else res.yd += r.x - 10;
  }
  const live = res.n - res.td - res.tb - res.fum;
  console.log(`      ${res.n} kicks: avg start yd ${(res.yd / live).toFixed(1)}, TD ${res.td}, touchbacks ${res.tb}, fumbles ${res.fum}`);
  assert.ok(res.yd / live > 15 && res.yd / live < 40, 'average return should land between own 15 and 40');
  assert.ok(res.td / res.n < 0.06, 'return TDs should be rare');
});

// ---------------------------------------------------------------- 3. two seasons + save round trip
function runCareer(c, seasons, forceFire) {
  const startYear = c.year; let guard = 0; let fired = false; let drafted = 0;
  while (c.year < startYear + seasons && guard++ < 5000) {
    const st = status(c);
    if (st === 'start') startSeason(c);
    else if (st === 'play') simUserGame(c);
    else if (st === 'simround') simRound(c);
    else if (st === 'review') O.startOffseason(c);
    else if (st === 'off:awards') { if (forceFire && c.year === startYear + 1) c.job = 0; O.jobReview(c); }
    else if (st === 'off:fired') { fired = true; O.acceptOffer(c, c.offers[0]); }
    else if (st === 'off:resign') {
      for (const id of c.expiring.slice()) { const p = c.roster.find((x) => x.id === id); if (p) O.resignPlayer(c, p); }
      O.finishResign(c);
    } else if (st === 'off:draft') {
      const p = c.draft.pool.find((x) => x.salary <= O.capRoom(c));
      if (p && c.roster.length < 12 && !O.draftPick(c, p)) drafted++; else O.nextDraftRound(c);
    } else if (st === 'off:fa') { if (c.freeAgents[0]) O.signFA(c, c.freeAgents[0]); O.newSeason(c); }
    while (c.pending.length) O.applyChoice(c, c.pending[0], 0);
  }
  return { fired, drafted, guard };
}
test('two full seasons: playoffs, draft, re-sign, firing/hiring, save round-trip', () => {
  const c = newCareer({ seed: 2024, teamId: 5, qlen: 2 });
  const team0 = c.userTeamId;
  const r = runCareer(c, 2, true);
  assert.equal(c.year, 3); assert.equal(c.phase, 'preseason');
  assert.equal(c.history.length, 2);
  assert.ok(r.fired, 'forced low job security should fire the coach');
  assert.notEqual(c.userTeamId, team0);
  assert.ok(r.drafted >= 1, 'should have drafted at least one rookie');
  for (const h of c.history) assert.ok(h.w + h.l + h.t === 16, 'each season has 16 games');
  for (const t of c.teams) assert.equal(t.w + t.l + t.t, 0);
  console.log(`      history: ${c.history.map((h) => `Y${h.year} ${h.team} ${h.w}-${h.l}-${h.t} ${h.result}`).join(' | ')}`);
  // round trip
  const s = serialize(c), c2 = deserialize(s);
  assert.deepEqual(c2, JSON.parse(s));
  assert.equal(serialize(c2), s);
  // reloaded career keeps playing deterministically identical to the original
  const a = JSON.parse(s), b = JSON.parse(s);
  runCareer(a, 1, false); runCareer(b, 1, false);
  assert.equal(serialize(a), serialize(b), 'same save -> same future (seeded RNG)');
  assert.equal(a.year, 4);
});
test('a game in progress survives closing the app and resumes where it left off', () => {
  const c = newCareer({ seed: 77, teamId: 9, qlen: 2 });
  startSeason(c);
  const g = userGameThisWeek(c);
  const m = new Match(c, g);
  m.onCheckpoint = (s) => { c.inGame = { h: g.h, a: g.a, phase: c.phase, week: c.week, round: -1, snap: s }; };
  // play until the second quarter, then "close the app"
  autopilot(m, 60 * 60 * 3);
  let guard = 0;
  while (m.q < 2 && m.phase !== 'final' && guard++ < 60 * 60 * 20) { if (m.phase === 'presnap') m.snap(); else if (m.phase === 'choice') m.options.find((x) => !x.disabled).fn(); else if (m.phase === 'kick') m.kick.tap(); m.update(1 / 60); }
  assert.ok(c.inGame, 'checkpoints should be recorded');
  const before = c.inGame.snap;
  const reloaded = deserialize(serialize(c));          // app killed and reopened
  const r = resumableGame(reloaded);
  assert.ok(r, 'the saved game should be resumable');
  const m2 = Match.resume(reloaded, r.g, r.snap);
  assert.equal(m2.q, before.q); assert.deepEqual(m2.score, before.score); assert.equal(m2.down, before.down);
  autopilot(m2);
  assert.equal(m2.phase, 'final');
  assert.ok(m2.score.u >= before.score.u && m2.score.o >= before.score.o);
  finishUserGame(reloaded, r.g, m2.result());
  assert.equal(reloaded.inGame, null, 'finishing clears the snapshot');
  console.log(`      saved at Q${before.q} ${before.score.u}-${before.score.o}, finished ${m2.score.u}-${m2.score.o}`);
});
test('old saves get named regulars and player skills on load', () => {
  const c = newCareer({ seed: 3, teamId: 1 });
  delete c.regulars; c.roster.forEach((p) => delete p.trait);
  const c2 = deserialize(serialize(c));
  assert.ok(c2.regulars && c2.regulars.QB.length >= 2 && c2.regulars.QB[0].last);
  assert.ok(c2.roster.every((p) => p.trait));
  const lu = buildLineup(c2.roster, c2.regulars);
  assert.ok(Object.values(lu).flat().every((p) => p.last && p.last !== 'REGULAR'), 'every lineup slot is a named player');
});
test('every QB can throw deep; arm strength adds zip', () => {
  assert.ok(maxThrow(2) >= 55);
  assert.ok(flightOf(40, false, 10).T < flightOf(40, false, 2).T);
});
test('deserialize rejects garbage', () => {
  assert.throws(() => deserialize('{"hello":1}'));
  assert.throws(() => deserialize('not json'));
});
test('front office rules: cap, roster limit, CC', () => {
  const c = newCareer({ seed: 5, teamId: 0 });
  c.cc = 0;
  assert.equal(O.upgradeFacility(c, 'stadium'), 'NOT ENOUGH CC');
  c.cc = 100; assert.equal(O.upgradeFacility(c, 'stadium'), null); assert.equal(c.facilities.stadium, 3);
  c.cap = O.capUsed(c) + 1;
  O.genFreeAgents(c); const fa = c.freeAgents.sort((x, y) => y.salary - x.salary)[0];
  assert.equal(O.signFA(c, fa), 'NOT ENOUGH CAP ROOM');
  const capBefore = c.cap; assert.equal(O.raiseCap(c), null); assert.equal(c.cap, capBefore + 10);
  while (c.roster.length < 12) c.roster.push({ ...c.roster[0], id: c.nextId++ });
  c.cap = 9999; assert.equal(O.signFA(c, c.freeAgents[0]), 'ROSTER FULL (12 STARS)');
});
console.log(`\n${passed} tests passed${process.exitCode ? ' - SOME FAILED' : ''}`);
