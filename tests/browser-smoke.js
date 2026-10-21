// In-browser end-to-end smoke test. With the game open, run in the devtools console:
//   (await import('/tests/browser-smoke.js')).playOneGame({ log: true })
// It drives the real input layer with synthetic mouse + touch PointerEvents, at whatever screen size the game is using.
const pg = window.__pg;
const cv = document.getElementById('c');
let nextId = 10;
function client(ix, iy) { const r = cv.getBoundingClientRect(); return { clientX: r.left + ix / cv.width * r.width, clientY: r.top + iy / cv.height * r.height }; }
function ev(type, ix, iy, o = {}) {
  cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: o.id ?? 1, pointerType: o.pt || 'mouse', button: o.button ?? 0, buttons: o.buttons ?? (type === 'pointerup' ? 0 : 1), isPrimary: !o.secondary, ...client(ix, iy) }));
}
function click(ix, iy, pt = 'mouse') { const id = pt === 'touch' ? nextId++ : 1; ev('pointerdown', ix, iy, { id, pt }); pg.tick(0.05); ev('pointerup', ix, iy, { id, pt }); pg.tick(0.05); }
// click a button drawn on the last frame, by label (regexp) or index from the end
export function press(match, pt = 'touch') {
  const bs = pg.UI.buttons.filter((b) => b.onClick && (typeof match === 'number' ? true : match.test(b.label)));
  const b = typeof match === 'number' ? bs[bs.length - 1 - match] : bs[0];
  if (!b) return false;
  click(b.x + b.w / 2, b.y + b.h / 2, pt); return true;
}
function drag(x0, y0, x1, y1, o = {}) {
  const id = o.pt === 'touch' ? nextId++ : 1;
  ev('pointerdown', x0, y0, { id, pt: o.pt, button: o.button ?? 0, buttons: o.button === 2 ? 2 : 1 });
  for (let i = 1; i <= 6; i++) { ev('pointermove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6, { id, pt: o.pt, buttons: o.button === 2 ? 2 : 1 }); pg.tick(1 / 60); }
  if (o.secondFinger) { const id2 = nextId++; ev('pointerdown', cv.width - 40, cv.height - 30, { id: id2, pt: 'touch', secondary: true }); ev('pointerup', cv.width - 40, cv.height - 30, { id: id2, pt: 'touch', secondary: true }); }
  ev('pointerup', x1, y1, { id, pt: o.pt, button: o.button ?? 0 }); pg.tick(1 / 60);
}

export function playOneGame({ maxSec = 2000, log = false } = {}) {
  const app = pg.app;
  const stats = { snaps: 0, throws: 0, touch: 0, bullets: 0, handoffs: 0, jukes: 0, kicks: 0, choices: 0, returns: 0, phases: new Set() };
  let lastThrowPlay = null, t = 0;
  while (t < maxSec) {
    const sc = app.scene;
    if (!sc.m) break;
    const m = sc.m; stats.phases.add(m.phase);
    const midX = cv.width / 2, midY = Math.round((sc.FT + sc.fieldB) / 2);
    if (m.phase === 'presnap') { click(midX, midY, stats.snaps % 2 ? 'touch' : 'mouse'); stats.snaps++; }
    else if (m.phase === 'live') {
      const p = m.play;
      if (p.mode === 'return') {
        if (!p.decided && p.ball.state !== 'kick') { click(midX, midY, 'touch'); stats.returns++; }
        else if (p.carrier && Math.random() < 0.05) { drag(midX, midY, midX, midY + (Math.random() < 0.5 ? -20 : 20), { pt: 'touch' }); stats.jukes++; }
        else pg.tick(1 / 20);
      } else if (p.canHandoff() && p.play.type === 'run') { click(sc.sx(p.RB.x), sc.sy(p.RB.y) - 7); stats.handoffs++; }
      else if (p.canThrow() && p.t > 1.4 && lastThrowPlay !== p) {
        lastThrowPlay = p;
        const recs = p.receivers.filter((r) => !r.block && !r.run);
        const sep = (r) => Math.min(...p.defs.map((d) => Math.hypot(d.x - r.x, d.y - r.y)));
        const r = recs.sort((a, b) => sep(b) - sep(a))[0];
        const T = 0.35 + Math.hypot(r.x - p.QB.x, r.y - p.QB.y) / 22;
        const tx = r.x + r.vx * T * 0.9, ty = r.y + r.vy * T * 0.9;
        const dx = (tx - p.QB.x) * 8 / 2.6, dy = (ty - p.QB.y) * sc.SY / 2.0;
        const kind = stats.throws % 3; // 0 mouse lob, 1 touch (+2nd finger bullet), 2 right-button bullet
        const x0 = Math.min(cv.width - 20, midX + 60), y0 = midY;
        if (kind === 0) drag(x0, y0, x0 - dx, y0 - dy);
        else if (kind === 1) { drag(x0, y0, x0 - dx, y0 - dy, { pt: 'touch', secondFinger: stats.throws % 2 === 0 }); stats.touch++; }
        else { drag(x0, y0, x0 - dx, y0 - dy, { button: 2 }); stats.bullets++; }
        stats.throws++;
      } else if (p.carrier && Math.random() < 0.05) {
        drag(midX, midY, midX, midY + (Math.random() < 0.5 ? -20 : 20), { pt: 'touch' }); stats.jukes++;
      } else pg.tick(1 / 20);
    } else if (m.phase === 'choice') { pg.tick(1 / 60); const o = m.options.find((x) => !x.disabled); press(new RegExp('^' + o.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')); stats.choices++; }
    else if (m.phase === 'kick') {
      const k = m.kick;
      if ((k.stage === 'aim' && Math.abs(k.ang) < 1.5) || (k.stage === 'power' && k.power > 0.85 && k.pdir > 0)) { click(midX, midY + 30); if (k.stage === 'flight') stats.kicks++; }
      else pg.tick(1 / 60);
    } else if (m.phase === 'final') { pg.tick(1 / 60); press(/CONTINUE/); break; }
    else pg.tick(0.25);
    t += 0.1;
  }
  const res = { scene: app.scene.constructor.name, ...stats, phases: [...stats.phases].join(','), summary: app.career.lastSummary && `${app.career.lastSummary.us}-${app.career.lastSummary.them}` };
  if (log) console.log(res);
  return res;
}
