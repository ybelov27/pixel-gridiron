// Headless render test: stubs the canvas/DOM so every draw path (field, HUD, kicks, returns, menus) runs in Node
// and any runtime error in drawing code fails the test.  node tests/render.mjs
import assert from 'node:assert/strict';
const calls = { n: 0 };
const ctx = new Proxy({}, {
  get(t, k) { if (k in t) return t[k]; return (...a) => { calls.n++; }; },
  set(t, k, v) { t[k] = v; return true; },
});
const mkCanvas = () => ({ width: 300, height: 150, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 844, height: 390 }), addEventListener() {}, focus() {}, setPointerCapture() {} });
globalThis.window = globalThis;
Object.assign(globalThis, {
  innerWidth: 844, innerHeight: 390, devicePixelRatio: 3,
  addEventListener() {}, getComputedStyle: () => ({ paddingTop: '0px', paddingRight: '47px', paddingBottom: '21px', paddingLeft: '47px' }),
  matchMedia: () => ({ matches: false }), requestAnimationFrame() {}, performance: globalThis.performance,
  document: { createElement: () => mkCanvas(), body: { appendChild() {} }, getElementById: () => mkCanvas(), addEventListener() {}, documentElement: {} },
});
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 }, configurable: true });
const G = await import('../src/gfx.js');
G.initCanvas(mkCanvas());
const { app } = await import('../src/app.js');
const S = await import('../src/scenes/menus.js');
const { GameScene } = await import('../src/scenes/game.js');
const { Match } = await import('../src/match.js');
const { newCareer, userGameThisWeek } = await import('../src/league.js');
const { startSeason, simUserGame } = await import('../src/flow.js');
const O = await import('../src/office.js');

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok  -', name); } catch (e) { console.error('FAIL-', name, '\n', e); process.exitCode = 1; } };

test(`drawn at ${G.W}x${G.H} logical (scale ${G.SCALE}, safe L${G.SAFE.l}/R${G.SAFE.r})`, () => {
  assert.ok(G.W >= G.BW && G.H >= G.BH);
});
test('every menu screen draws', () => {
  const c = newCareer({ seed: 7, teamId: 4 }); app.career = c;
  const draw = (sc) => { app.scene = sc; sc.draw(); };
  draw(new S.TitleScene()); draw(new S.NewCareerScene()); draw(new S.HubScene());
  startSeason(c); draw(new S.HubScene());
  for (const K of ['RosterScene', 'OfficeScene', 'FAScene', 'ScheduleScene', 'StandingsScene', 'PlayoffsScene', 'HistoryScene', 'NewsScene', 'SettingsScene']) draw(new S[K]());
  const o = new S.OfficeScene(); o.tab = 1; draw(o); o.tab = 2; draw(o);
  draw(new S.PlayerScene(c.roster[0], 'roster', () => {}));
  const s = simUserGame(c); draw(new S.PostGameScene(s));
  while (c.phase === 'regular') simUserGame(c);
  draw(new S.PlayoffsScene());
});
test('full games draw every frame type (field, aim, kicks, returns, defense, final)', () => {
  for (const seed of [11, 12, 13]) {
    const c = newCareer({ seed, teamId: seed % 32 }); app.career = c; startSeason(c);
    const m = new Match(c, userGameThisWeek(c));
    const sc = new GameScene(m, () => {}); app.scene = sc;
    const seen = new Set(); let steps = 0, thrown = null;
    while (m.phase !== 'final' && steps++ < 60 * 60 * 30) {
      seen.add(m.phase + (m.play && m.play.mode === 'return' ? ':return' : ''));
      if (m.phase === 'presnap') m.snap();
      else if (m.phase === 'choice') m.options.find((x) => !x.disabled).fn();
      else if (m.phase === 'kick') { const k = m.kick; if (k.stage === 'aim' && Math.abs(k.ang) < 1.5) k.tap(); else if (k.stage === 'power' && k.power > 0.85 && k.pdir > 0) k.tap(); }
      else if (m.phase === 'live') {
        const p = m.play;
        if (p.mode === 'return') { if (!p.decided) p.returnBall(); if (p.carrier && steps % 30 === 0) p.juke(steps % 60 ? 1 : -1); }
        else if (p.canHandoff() && p.play.type === 'run') p.handoff();
        else if (thrown !== p && p.canThrow() && p.t > 1.0) {
          sc.g = { kind: 'aim', id: 1, x0: 300, y0: 120, x: 260, y: 125, bullet: false };   // draw the aim preview once
          sc.draw();
          sc.g = null;
          const r = p.receivers.filter((x) => !x.block && !x.run)[0]; p.throwTo(r.x + 6, r.y, steps % 2 === 0); thrown = p;
        }
        if (p.carrier && steps % 25 === 0) p.juke(1);
        if (p.carrier && steps % 97 === 0) p.dive();
      }
      sc.update(1 / 60);
      if (steps % 3 === 0) sc.draw();
    }
    sc.draw();
    sc.paused = true; sc.draw(); sc.paused = false;
    assert.equal(m.phase, 'final');
    console.log(`      seed ${seed}: ${m.score.u}-${m.score.o}, phases ${[...seen].join(',')}, ${calls.n} draw calls`);
  }
});
test('weather, night and kick view draw', () => {
  const c = newCareer({ seed: 21, teamId: 2 }); app.career = c; startSeason(c);
  for (const [w, night] of [['snow', true], ['rain', false]]) {
    const m = new Match(c, userGameThisWeek(c)); m.weather = w; m.night = night;
    const sc = new GameScene(m, () => {});
    for (let i = 0; i < 300; i++) { if (m.phase === 'presnap') m.snap(); sc.update(1 / 60); if (i % 5 === 0) sc.draw(); }
    m.startKick('fg', 40); for (let i = 0; i < 200; i++) { if (i === 30 || i === 70) m.kick.tap(); sc.update(1 / 60); sc.draw(); }
  }
});
console.log(`\n${passed} render tests passed${process.exitCode ? ' - SOME FAILED' : ''}`);
