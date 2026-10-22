// Live play simulation in world yards. x: 0..120 (user's goal line at 10, opponent goal line at 110). y: 0..FW.
import { clamp } from './rng.js';
import { ROUTES } from './playbook.js';
import { eff } from './players.js';

export const FW = 53.33;
export const spdOf = (v) => 4.75 + v * 0.55;  // SPD 2 ~5.9 yd/s (lineman), 5 ~7.5, 8 ~9.2, 10 ~10.3
// arm strength sets how far a QB can throw (weak ~28 yd, average ~38, elite ~58) and how fast the ball gets there
export const maxThrow = (arm) => 18 + arm * 4;
const RAD = Math.PI / 180;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Throw error model: lower accuracy -> wider angular and distance spread.
export function throwError(rng, acc, d, bullet) {
  const miss = Math.max(0.25, 10.5 - acc);          // acc 10 -> 0.5, acc 8 -> 2.5, acc 3 -> 7.5
  const angSd = miss * 0.5 * (bullet ? 1.2 : 1) * (1 + d / 80) * RAD;
  const dSd = miss * 0.14 * (1 + d / 60);
  return { ang: rng.gauss() * angSd, d: rng.gauss() * dSd };
}
// ball flight: lob is slow and high, bullet fast and flat
export function flightOf(d, bullet, arm = 5) {
  const zip = 1.1 - arm * 0.02; // arm 10 -> 10% faster, arm 2 -> 6% slower
  return bullet ? { T: (0.12 + d / 34) * zip, peak: 0.5 + d * 0.035 } : { T: (0.35 + d / 22) * zip, peak: 1.5 + d * 0.2 };
}

// linemen are heavy and slow to change direction; skill players are quick
function bodyOf(e, role) {
  const big = role === 'OL' || role === 'DL' || role === 'BLK';
  e.mass = big ? 1.7 : role === 'LB' || role === 'TE' ? 1.25 : 1;
  e.acc = big ? 17.6 : role === 'QB' ? 22 : (e.side === 'def' ? 27.5 : 24.2) + (e.p.attrs.SPD || 4) * 1;
}
export function makeDefender(rating, i, rng) {
  const a = (k) => clamp(Math.round(rating * 2 + rng.gauss() * 1.2), 1, 10);
  const spd = clamp(Math.round(rating * 1.7 + rng.gauss() * 1.2), 1, 10); // average defenders are average-speed
  return { regular: true, id: null, pos: 'D', attrs: { SPD: spd, TKL: a(), COV: a(), RSH: a(), STR: a() }, condition: 100, morale: 70, stars: rating, skin: i % 4 };
}

export class PlaySim {
  constructor(o) {
    this.o = o;
    this.wx = o.weather === 'rain' ? 0.05 : o.weather === 'snow' ? 0.06 : 0; // slick ball
    if (o.mode === 'return') return this.setupReturn(o);
    const { play, lineup, defRating, losX, ballY, diff, rng } = o;
    this.play = play; this.rng = rng; this.diff = diff; this.los = losX; this.by = ballY;
    this.t = 0; this.started = false; this.done = false; this.endTimer = 0; this.result = null;
    this.ball = { state: 'held', x: 0, y: 0, z: 1.5 }; this.carrier = null; this.carrierKind = null;
    this.handed = false; this.thrown = false; this.events = [];
    this.ents = [];
    const los = losX, by = ballY;
    const f = play.f;
    const add = (side, role, p, x, y) => {
      const e = { side, role, p, x, y: clamp(y, 1.5, FW - 1.5), vx: 0, vy: 0, stun: 0, cd: 0, trail: [], anim: 0, down: false, route: null, wp: 0, dir: null, star: !p.regular };
      e.spd = spdOf(side === 'off' ? eff(p, 'SPD') : eff(p, 'SPD') + 0) + (side === 'def' ? diff.spd : 0);
      bodyOf(e, role);
      this.ents.push(e); return e;
    };
    // offense
    this.OL = lineup.OL.map((p, i) => add('off', 'OL', p, los - 0.6, by + (i - 2) * 1.3));
    const qbX = f === 'under' ? los - 1.2 : f === 'pistol' ? los - 4 : los - 5;
    this.QB = add('off', 'QB', lineup.QB[0], qbX, by);
    const rbPos = { shotgun: [los - 5, by + 1.6], pistol: [los - 7, by], under: [los - 6.5, by], trips: [los - 5, by - 1.6], empty: [los - 0.8, by - 8] }[f];
    this.RB = add('off', 'RB', lineup.RB[0], rbPos[0], rbPos[1]);
    this.WR = [
      add('off', 'WR1', lineup.WR[0], los - 0.8, by - 17),
      add('off', 'WR2', lineup.WR[1], los - 0.8, by + 18),
      add('off', 'WR3', lineup.WR[2], los - 0.8, f === 'trips' ? by + 11 : f === 'empty' ? by + 10 : by - 10),
    ];
    this.TE = add('off', 'TE', lineup.TE[0], los - 0.8, by + 4.2);
    this.dropX = f === 'under' ? los - 7 : los - 6.5;
    // routes
    this.receivers = [...this.WR, this.TE, this.RB];
    for (const r of this.receivers) {
      const key = r.role.startsWith('WR') ? r.role : r.role;
      const spec = play.r[key];
      if (spec && typeof spec === 'object' && 'run' in spec) {
        const g = spec.run;
        r.run = true; r.delay = spec.delay || 0;
        r.route = [{ x: los - 2.2, y: by + g * 0.4 }, { x: los + 1, y: by + g }, { x: los + 80, y: by + g }];
      } else if (spec && ROUTES[spec]) {
        const R = ROUTES[spec];
        const inS = r.y < by ? 1 : -1;
        r.route = R.pts.map(([fw, lat]) => ({ x: r.x + fw, y: clamp(r.y + lat * inS, 1, FW - 1) }));
        r.stopAtEnd = !!R.stop; r.screen = !!R.screen;
        r.delay = R.screen ? 0.4 : 0;
      } else {
        r.block = true;
        r.route = [{ x: los - 1.2, y: r.y }];
        r.stopAtEnd = true;
      }
    }
    this.hasRun = !!this.RB.run;
    // defense
    const dr = defRating;
    const D = (i) => makeDefender(dr, i, rng);
    this.DL = [-3, -1, 1, 3].map((dy, i) => add('def', 'DL', D(i), los + 1, by + dy * 1.1));
    this.LB = [-5, 0, 5].map((dy, i) => add('def', 'LB', D(i + 4), los + 5, by + dy));
    this.CB = [add('def', 'CB', D(7), los + 6, this.WR[0].y), add('def', 'CB', D(8), los + 6, this.WR[1].y)];
    this.S = [add('def', 'S', D(9), los + 12, by - 8), add('def', 'S', D(10), los + 12, by + 8)];
    this.defs = this.ents.filter((e) => e.side === 'def');
    // assignments
    this.CB[0].man = this.WR[0]; this.CB[1].man = this.WR[1]; this.S[0].man = this.WR[2];
    this.LB[0].man = this.TE.block ? null : this.TE; this.LB[2].man = (this.RB.block || this.RB.run) ? null : this.RB;
    this.S[1].deep = true;
    for (const d of this.defs) d.react = clamp(0.236 - eff(d.p, 'COV') * 0.0145 + diff.react + (o.ocStars || 0) * 0.015, 0.05, 0.6);
    // pass rush: DL i vs OL pair, center helps the middle two
    const pair = [0, 1, 3, 4];
    const olAvg = this.OL.reduce((s, e) => s + eff(e.p, 'BLK') + eff(e.p, 'STR') * 0.5, 0) / 5;
    this.DL.forEach((d, i) => {
      d.ol = this.OL[pair[i]];
      const blk = eff(d.ol.p, 'BLK') * 0.7 + olAvg * 0.3 / 1.5;
      d.hold = clamp(3.4 + (blk - eff(d.p, 'RSH')) * 0.2 + rng.range(-0.5, 0.8) + (i === 1 || i === 2 ? 0.35 : 0) - diff.contest * 2, 0.9, 6);
      d.engaged = true; d.pairX = los;
    });
    this.blitz = rng.chance(0.12 + diff.contest);
    if (this.blitz) { this.LB[1].rush = true; this.LB[1].hold = 1.1 + rng.range(0, 0.6); }
    this.ball.x = this.QB.x; this.ball.y = this.QB.y;
  }

  // ----- controls -----
  snap() { this.started = true; this.events.push('snap'); }
  canHandoff() { return this.started && this.hasRun && !this.handed && !this.thrown && !this.carrier && dist(this.QB, this.RB) < 2.8 && this.t < 2.5; }
  handoff() {
    if (!this.canHandoff()) return false;
    this.handed = true; this.setCarrier(this.RB, 'rush'); this.events.push('handoff');
    return true;
  }
  canThrow() { return this.started && !this.thrown && !this.handed && !this.carrier && !this.done && this.QB.x < this.los; }
  aimTarget(dxScreen, dyScreen, SX, SY) {
    // slingshot: target opposite of drag vector
    const qb = this.QB;
    let tx = qb.x + dxScreen * 3.4 / SX, ty = qb.y + dyScreen * 2.6 / SY;
    const d = Math.hypot(tx - qb.x, ty - qb.y), m = maxThrow(eff(qb.p, 'ARM'));
    if (d > m) { tx = qb.x + (tx - qb.x) * m / d; ty = qb.y + (ty - qb.y) * m / d; }
    return { x: tx, y: ty, d: Math.min(d, m), max: m };
  }
  throwTo(tx, ty, bullet) {
    if (!this.canThrow()) return false;
    const qb = this.QB;
    // aim assist: pull the target toward where the receiver you were leading will be
    const assist = this.diff.assist ?? 0;
    if (assist > 0) {
      const T0 = flightOf(Math.hypot(tx - qb.x, ty - qb.y), bullet, eff(qb.p, 'ARM')).T;
      let best = null, bd = 5;
      for (const r of this.receivers) {
        if (r.block || r.run) continue;
        const px = r.x + r.vx * T0, py = r.y + r.vy * T0, dd = Math.hypot(px - tx, py - ty);
        if (dd < bd) { bd = dd; best = { x: px, y: py }; }
      }
      if (best) { tx += (best.x - tx) * assist; ty += (best.y - ty) * assist; }
    }
    const d0 = Math.hypot(tx - qb.x, ty - qb.y);
    const err = throwError(this.rng, eff(qb.p, 'ACC'), d0, bullet);
    const ang = Math.atan2(ty - qb.y, tx - qb.x) + err.ang;
    const d = Math.max(2, d0 + err.d);
    const fl = flightOf(d, bullet, eff(qb.p, 'ARM'));
    this.thrown = true;
    this.ball = { state: 'air', x0: qb.x, y0: qb.y, x1: qb.x + Math.cos(ang) * d, y1: qb.y + Math.sin(ang) * d, t: 0, T: fl.T, peak: fl.peak, bullet, x: qb.x, y: qb.y, z: 2 };
    // placement error (behind / high / off-line) makes the catch harder even if the receiver gets there
    this.ball.err = Math.hypot(this.ball.x1 - tx, this.ball.y1 - ty);
    this.passer = qb.p; this.throwT = this.t;
    this.events.push('throw');
    // intended receivers break to the ball
    const L = { x: this.ball.x1, y: this.ball.y1 };
    // everyone in the area breaks toward where the ball will come down
    const rs = this.receivers.filter((r) => !r.block && !(r.run)).sort((a, b) => dist(a, L) - dist(b, L));
    rs.forEach((r, i) => { const d = dist(r, L); if (d < (i < 2 ? 16 : 25)) { r.toBall = true; r.toBallAt = this.t + 0.22 + i * 0.08; r.toBallLead = i < 2; } });
    for (const dd of this.defs) {
      if (dd.engaged || dd.rush || dd.role === 'DL') continue;
      const d = dist(dd, L);
      if (d < 25) dd.toBallAt = this.t + dd.react + (bullet ? 0.27 : 0.35) + Math.max(0, d - (bullet ? 6 : 11)) * 0.02;
    }
    return true;
  }
  scramble() {
    if (!this.canThrow()) return false;
    this.setCarrier(this.QB, 'qb'); this.events.push('scramble'); return true;
  }
  juke(dir) {
    const c = this.carrier; if (!c || c.cd2 > 0 || c.diveT > 0) return;
    c.jukeT = 0.28; c.jukeDir = dir; c.cd2 = 0.35; c.runT = (c.runT || 0) + 0.25; this.events.push('juke');
    // a defender closing in can bite on the fake and stumble (but won't fall for it twice in a row)
    const agility = eff(c.p, 'SPD');
    for (const d of this.defs) {
      if (d.stun > 0 || d.held || (d.role === 'DL' && d.engaged) || (d.fakedT || -9) > this.t - 1.5) continue;
      const dd = dist(d, c), closing = (c.x - d.x) * d.vx + (c.y - d.y) * d.vy > 0;
      if (dd < 2.6 && closing && this.rng.chance(clamp(0.4 + (agility - eff(d.p, 'TKL')) * 0.05 - this.diff.contest, 0.2, 0.75))) {
        d.stun = 0.55; d.cd = 0.8; d.fakedT = this.t; this.events.push('miss');
      }
    }
  }
  stutter() { const c = this.carrier; if (!c || c.cd2 > 0 || c.diveT > 0) return; c.slowT = 0.3; c.cd2 = 0.4; }
  dive() { const c = this.carrier; if (!c || c.diveT > 0) return; c.diveT = 0.35; c.diving = true; this.events.push('dive'); }

  setCarrier(e, kind) {
    this.carrier = e; this.carrierKind = kind; this.ball.state = 'carried';
    if (kind !== 'rush') e.route = null;
    e.toBall = false; e.cd2 = 0; e.jukeT = 0; e.slowT = 0; e.diveT = 0;
    for (const d of this.defs) d.pursueAt = this.t + d.react * (d.role === 'S' || d.role === 'CB' ? 1.6 : 1) + this.rng.range(0, 0.15);
  }

  // ----- simulation -----
  update(dt) {
    if (this.mode === 'return') return this.updateReturn(dt);
    if (this.mode === 'intret') return this.updateIntReturn(dt);
    if (!this.started) return;
    if (this.done) return;
    if (this.result) { this.endTimer -= dt; this.settle(dt); if (this.ball.state === 'loose') this.ballUpdate(dt); this.animate(dt); if (this.endTimer <= 0) this.done = true; return; }
    this.t += dt;
    const qb = this.QB;
    // QB dropback
    if (!this.carrier || this.carrier !== qb) {
      if (!this.thrown && !this.handed) {
        let tx = this.dropX, ty = this.by;
        if (this.play.type !== 'pass' && this.t < 0.7) { tx = this.los - 2.4; }
        if (this.play.type === 'pa' && this.t > 1.1 && this.t < 1.7) { tx = this.dropX; ty = this.by + (this.RB.route ? -1 : 0); }
        this.moveTo(qb, tx, ty, 6, dt);
      } else this.moveTo(qb, qb.x, qb.y, 0, dt);
    }
    // receivers
    for (const r of this.receivers) {
      if (r === this.carrier) continue;
      if (r.toBall && this.ball.state === 'air' && this.t >= r.toBallAt) {
        // time the run to meet the ball (catch in stride) instead of waiting at the spot
        const left = Math.max(0.05, this.ball.T - this.ball.t), dd = Math.hypot(this.ball.x1 - r.x, this.ball.y1 - r.y);
        this.moveTo(r, this.ball.x1, this.ball.y1, Math.min(r.spd, Math.max(dd / left, r.spd * 0.75)), dt); continue;
      }
      if (r.run && (this.handed || this.thrown || this.t > 2.5)) {
        // decoy / lead block: jog forward into traffic
        if (r !== this.carrier) { this.moveTo(r, r.x + 1, r.y, this.handed ? 0 : 3, dt); continue; }
      }
      if (this.t < (r.delay || 0)) continue;
      this.followRoute(r, dt);
    }
    // carrier
    if (this.carrier) this.runCarrier(this.carrier, dt);
    // line
    for (const d of this.DL) this.lineUpdate(d, dt);
    // defenders
    for (const d of this.defs) {
      if (d.stun > 0) { d.stun -= dt; d.vx = d.vy = 0; continue; }
      if (d.role === 'DL' && d.engaged) continue;
      if (this.carrier && this.t >= (d.pursueAt ?? 0)) { this.pursueLane(d, this.carrier, dt); continue; }
      if (this.ball.state === 'air' && d.toBallAt !== undefined && this.t >= d.toBallAt) { this.moveTo(d, this.ball.x1, this.ball.y1, d.spd * 0.9, dt); continue; }
      if (d.role === 'DL' || d.rush) {
        if (d.rush && this.t < d.hold) { this.moveTo(d, this.los + 1, d.y, 2, dt); continue; }
        this.pursue(d, this.carrier || qb, dt, 0.9); continue;
      }
      this.cover(d, dt);
    }
    for (const e of this.ents) { if (e.cd > 0) e.cd -= dt; if (e.cd2 > 0) e.cd2 -= dt; }
    this.separate();
    // ball
    this.ballUpdate(dt);
    if (!this.result) this.contacts();
    this.animate(dt);
    if (this.t > 20 && !this.result) this.end({ kind: 'tackle', x: (this.carrier || qb).x, y: (this.carrier || qb).y, msg: 'WHISTLE' });
  }
  animate(dt) {
    for (const e of this.ents) {
      const sp = Math.hypot(e.vx, e.vy);
      e.anim += dt * (sp > 0.5 ? sp * 1.6 : 0);
      e.trail.push(e.x, e.y); if (e.trail.length > 80) e.trail.splice(0, 2);
    }
    if (this.ball.state === 'carried' && this.carrier) { this.ball.x = this.carrier.x + 0.3; this.ball.y = this.carrier.y; this.ball.z = 1.2; }
    else if (this.ball.state === 'held') { this.ball.x = this.QB.x + 0.3; this.ball.y = this.QB.y; this.ball.z = 1.6; }
  }
  moveTo(e, tx, ty, spd, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    const ramp = Math.min(1, 0.45 + this.t * 1.4);
    const s = Math.min(spd * ramp, d / dt);
    const vx = d > 1e-4 ? dx / d * s : 0, vy = d > 1e-4 ? dy / d * s : 0;
    // momentum: velocity changes at most `acc` yd/s^2, so hard cuts take time and pursuers can overrun
    let ax = vx - e.vx, ay = vy - e.vy;
    const am = Math.hypot(ax, ay), lim = (e.acc || 28.6) * dt;
    if (am > lim) { ax *= lim / am; ay *= lim / am; }
    e.vx += ax; e.vy += ay;
    e.x += e.vx * dt; e.y += e.vy * dt;
  }
  // bodies don't pass through each other; defenders running into blockers get slowed
  separate() {
    const E = this.ents, n = E.length;
    for (let i = 0; i < n; i++) {
      const a = E[i]; if (a.down) continue;
      for (let j = i + 1; j < n; j++) {
        const b = E[j]; if (b.down) continue;
        if (a === this.carrier || b === this.carrier || a === this.returner || b === this.returner) continue; // tackles handle the ball carrier
        if ((a.ol === b && a.engaged) || (b.ol === a && b.engaged) || a.target === b || b.target === a) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), R = a.side === b.side && !a.engaged && !b.engaged ? 0.9 : 0.62;
        if (d >= R || d < 1e-6) continue;
        const ma = a.mass || 1, mb = b.mass || 1, push = R - d, nx = dx / d, ny = dy / d;
        a.x -= nx * push * mb / (ma + mb); a.y -= ny * push * mb / (ma + mb);
        b.x += nx * push * ma / (ma + mb); b.y += ny * push * ma / (ma + mb);
        if (a.side !== b.side) { const df = a.side === 'def' ? a : b; df.vx *= 0.82; df.vy *= 0.82; }
      }
    }
  }
  followRoute(r, dt) {
    if (!r.route) return;
    if (r.wp < r.route.length) {
      const p = r.route[r.wp];
      const sp = r.block ? 3 : r.spd;
      this.moveTo(r, p.x, p.y, sp, dt);
      const prev0 = r.wp > 0 ? r.route[r.wp - 1] : r.start || (r.start = { x: r.x, y: r.y });
      const past = (p.x - r.x) * (p.x - prev0.x) + (p.y - r.y) * (p.y - prev0.y) < 0;
      if (Math.hypot(p.x - r.x, p.y - r.y) < 1.0 || past) {
        const prev = r.wp > 0 ? r.route[r.wp - 1] : null;
        if (prev) { const L = Math.hypot(p.x - prev.x, p.y - prev.y) || 1; r.dir = { x: (p.x - prev.x) / L, y: (p.y - prev.y) / L }; }
        else { const L = Math.hypot(r.vx, r.vy) || 1; r.dir = { x: r.vx / L, y: r.vy / L }; }
        r.wp++;
      }
    } else if (!r.stopAtEnd && r.dir) {
      let ny = r.y + r.dir.y * 3;
      if (ny < 2 || ny > FW - 2) r.dir = { x: 1, y: 0 };
      this.moveTo(r, r.x + r.dir.x * 3, clamp(r.y + r.dir.y * 3, 1.5, FW - 1.5), r.spd, dt);
    } else {
      // route finished: keep working into open space instead of standing still
      let nd = null, best = 99;
      for (const d of this.defs) { const dd = dist(d, r); if (dd < best) { best = dd; nd = d; } }
      let tx = r.x, ty = r.y + (this.QB.y - r.y) * 0.05;
      if (nd && best < 6) { const k = (6 - best) / 6; tx += (r.x - nd.x) / (best || 1) * 2 * k; ty += (r.y - nd.y) / (best || 1) * 2.5 * k; }
      else ty += Math.sin(this.t * 2 + r.x) * 1.2;
      this.moveTo(r, tx, clamp(ty, 2, FW - 2), 3.2, dt);
    }
  }
  cover(d, dt) {
    const qb = this.QB;
    if (d.man) {
      const m = d.man;
      // trail technique: chase where the receiver was `react` seconds ago (reaction lag -> separation on breaks)
      const back = Math.round(d.react * 60) * 2;
      const n = m.trail.length;
      let px = m.x, py = m.y;
      if (n > back + 2) { px = m.trail[n - back - 2]; py = m.trail[n - back - 1]; }
      const cushion = m.x < this.los + 3 ? 3 : d.role === 'S' ? 1 : 0;
      const sp = d.spd * (0.86 + eff(d.p, 'COV') * 0.012);
      this.moveTo(d, px + cushion, py, sp, dt);
    } else if (d.deep) {
      const deep = this.receivers.filter((r) => !r.block && !r.run).sort((a, b) => b.x - a.x)[0];
      const tx = Math.max(this.los + 12, (deep ? deep.x : this.los) + 5);
      const ty = deep ? (deep.y + this.by) / 2 : this.by;
      this.moveTo(d, tx, ty, d.spd * 0.9, dt);
    } else {
      // zone / spy underneath
      const tx = this.los + (d.role === 'LB' ? 5 : 8);
      this.moveTo(d, tx, d.y + (qb.y - d.y) * 0.5, d.spd * 0.6, dt);
    }
  }
  // team pursuit: the closest few attack the ball, the rest keep their lanes and close gradually,
  // deep safeties stay in front as the last line - no 11-man swarm
  pursueLane(d, c, dt) {
    if (!this._rankT || this._rankT !== this.t) {
      this._rankT = this.t;
      const free = this.defs.filter((x) => x.stun <= 0 && !x.held).sort((a, b) => dist(a, c) - dist(b, c));
      free.forEach((x, i) => { x.rank = i; });
    }
    if (d.lane === undefined) d.lane = d.y;
    const dd = dist(d, c);
    if ((d.rank ?? 0) < 3 || dd < 4) return this.pursue(d, c, dt);
    const lead = clamp(dd / d.spd * 1.15, 0, 1.6);
    let tx = c.x + c.vx * lead, ty = c.y + c.vy * lead;
    const keep = clamp((dd - 4) / 14, 0, 0.7);            // far away: hold the lane; close: converge
    ty += (d.lane - ty) * keep;
    if (d.role === 'S' || d.role === 'CB') tx = Math.max(tx, c.x + Math.min(10, dd * 0.6)); // stay in front
    this.moveTo(d, tx, clamp(ty, 1, FW - 1), d.spd, dt);
  }
  pursue(d, c, dt, mult = 1) {
    const dd = dist(d, c);
    const lead = clamp(dd / d.spd * 1.15, 0, 1.6); // take an angle: aim where the runner will be
    this.moveTo(d, c.x + c.vx * lead, c.y + c.vy * lead, d.spd * mult, dt);
  }
  lineUpdate(d, dt) {
    const ol = d.ol;
    if (d.engaged) {
      const target = this.carrier || this.QB;
      const pushing = this.t > 0.25;
      if (pushing) d.pairX = Math.max(target.x + 1.2, d.pairX - 0.55 * dt);
      ol.x = d.pairX - 0.45; d.x = d.pairX + 0.45; d.y += (ol.y - d.y) * Math.min(1, dt * 8);
      d.vx = -0.5; ol.vx = -0.5;
      // run plays: engaged DL can arm-tackle a carrier who runs past
      if (this.t >= d.hold) { d.engaged = false; d.stun = 0.15; ol.vx = 0; }
    } else if (ol) { this.moveTo(ol, ol.x, ol.y, 0, dt); }
    for (const o of this.OL) if (!this.DL.some((x) => x.ol === o)) {
      // center: help block nearest unblocked rusher
      const free = this.defs.find((x) => (x.rush || (x.role === 'DL' && !x.engaged)) && dist(x, o) < 3);
      if (free && !free.picked) { free.picked = true; free.stun = 0.8; }
      if (!this.carrier) this.moveTo(o, Math.max(this.QB.x + 2, o.x - 0.3), o.y, 1, dt);
    }
  }
  // stamina: full speed for a couple of seconds (longer with STA), then the runner fades
  staminaOf(c) {
    const fresh = 5 + eff(c.p, 'STA') * 0.4;            // STA 5 -> ~7 s at full speed
    return clamp(1 - Math.max(0, (c.runT || 0) - fresh) * 0.07, 0, 1);
  }
  runCarrier(c, dt) {
    c.runT = (c.runT || 0) + dt;
    c.stam = this.staminaOf(c);
    const base = spdOf(eff(c.p, 'SPD')) * (0.9 + 0.1 * c.stam);
    let vx = base, vy = 0;
    if (c.run && c.route && c.wp < 2) {
      // follow the run path through the line first
      const p = c.route[c.wp];
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dt * 7);
      c.vx += (dx / d * base - c.vx) * k; c.vy += (dy / d * base - c.vy) * k;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (d < 1.2 || c.x >= p.x + 0.2) c.wp++;
      return this.boundsCheck(c);
    }
    // gentle auto-avoidance; the user does the real jukes
    for (const d of this.defs) {
      const dx = d.x - c.x, dy = d.y - c.y, dd = Math.hypot(dx, dy);
      if (dx > -1 && dx < 5 && dd < 5 && d.stun <= 0) vy -= Math.sign(dy || 1) * base * 0.22 * (1 - dd / 5);
    }
    if (c.y < 2.5) vy += 1.5; if (c.y > FW - 2.5) vy -= 1.5;
    if (c.jukeT > 0) { c.jukeT -= dt; vy = c.jukeDir * 10; vx = base * 0.85; }
    else if (c.slowT > 0) { c.slowT -= dt; vx = base * 0.6; vy = 0; }
    if (c.diveT > 0) {
      c.diveT -= dt; vx = 8; vy = 0;
      if (c.diveT <= 0) { c.down = true; return this.end({ kind: 'tackle', x: c.x, y: c.y, msg: 'DIVE!' }); }
    }
    const k = c.jukeT > 0 || c.diveT > 0 ? 1 : Math.min(1, dt * 6);
    c.vx += (vx - c.vx) * k; c.vy += (vy - c.vy) * k;
    // runners carry their speed through cuts: blending directions must not bleed off pace
    if (!(c.slowT > 0)) {
      const want = Math.hypot(vx, vy) * 0.98, have = Math.hypot(c.vx, c.vy);
      if (have > 0.5 && have < want) { c.vx *= want / have; c.vy *= want / have; }
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    this.boundsCheck(c);
  }
  boundsCheck(c) {
    if (this.result) return;
    if (c.x >= 110 && c.y > 0 && c.y < FW) return this.end({ kind: 'td', x: c.x, y: c.y, msg: 'TOUCHDOWN!' });
    if (c.y <= 0 || c.y >= FW) {
      if (c.x < 10) return this.end(this.mode === 'return' ? { kind: 'touchback', x: 10, y: c.y, msg: 'TOUCHBACK' } : { kind: 'safety', x: c.x, y: c.y, msg: 'SAFETY!' });
      return this.end({ kind: 'oob', x: c.x, y: clamp(c.y, 0, FW), msg: 'OUT OF BOUNDS', stop: true });
    }
  }
  contacts() {
    const c = this.carrier || (this.ball.state === 'held' ? this.QB : null);
    if (!c) return;
    for (const d of this.defs) {
      if (d.stun > 0 || d.cd > 0) continue;
      const armTackle = d.role === 'DL' && d.engaged;
      if (armTackle && !(this.carrier && this.carrier !== this.QB)) continue;
      if (d.role === 'DL' && d.engaged && this.t < 0.2) continue;
      const r = armTackle ? 1.0 : 0.9;
      if (dist(d, c) > r) continue;
      if (!this.carrier && !(d.role === 'DL' || d.rush) && this.t < 1.2) continue; // coverage players don't tackle QB early
      const cs = eff(c.p, 'STR') || 3, ct = eff(d.p, 'TKL');
      let pMiss = 0.17 + (cs - ct) * 0.045 - this.diff.contest * 0.5;
      if (c.jukeT > 0) pMiss += 0.42 + eff(c.p, 'SPD') * 0.02;
      if (armTackle) pMiss += 0.25;
      if (this.carrierKind === 'rec' || this.carrierKind === 'kr') pMiss += 0.06 + eff(c.p, 'SPD') * 0.008; // open-field runners are slippery
      if (c.diving) pMiss = 0;
      pMiss = clamp(pMiss, c.diving ? 0 : 0.03, 0.8);
      if (this.rng.chance(pMiss)) { d.stun = 0.7; d.cd = 1; this.events.push('miss'); continue; }
      // tackle
      c.down = true; this.tackler = d; d.lunge = true;
      const sack = !this.carrier && c === this.QB;
      let pF = c.diving ? 0 : 0.008 + (ct - cs) * 0.003 + this.diff.contest * 0.02 + (sack ? 0.04 : 0) + this.wx * 0.2;
      if (this.rng.chance(Math.max(0, pF))) {
        const lost = this.rng.chance(0.55);
        return this.end({ kind: lost ? 'fumble' : 'tackle', x: c.x, y: c.y, msg: lost ? 'FUMBLE! LOST' : 'FUMBLE! RECOVERED', stop: lost, sack, fumble: true });
      }
      if (c.x < 10) return this.end(this.mode === 'return' ? { kind: 'touchback', x: 10, y: c.y, msg: 'TOUCHBACK' } : { kind: 'safety', x: c.x, y: c.y, msg: 'SAFETY!' });
      // forward progress: a runner at speed falls forward; a head-on hit stops him short
      const headOn = d.vx < -2 && c.vx > 0;
      const fall = sack ? 0 : clamp(c.vx * (headOn ? 0.04 : 0.13), -0.5, headOn ? 0.4 : 1.6);
      c.fallTo = c.x + fall;
      if (!sack && c.fallTo >= 110 && c.y > 0 && c.y < FW && this.mode !== 'return') return this.end({ kind: 'td', x: 110.2, y: c.y, msg: 'TOUCHDOWN! (STRETCHED IT OUT)' });
      return this.end({ kind: 'tackle', x: c.fallTo, y: c.y, msg: sack ? 'SACKED!' : 'TACKLED', sack });
    }
  }
  ballUpdate(dt) {
    const b = this.ball;
    if (b.state === 'air') {
      b.t += dt;
      const u = Math.min(1, b.t / b.T);
      b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u;
      b.z = 2 + (1.3 - 2) * u + 4 * b.peak * u * (1 - u);
      if (u >= 1) this.resolveCatch();
    } else if (b.state === 'loose') {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vz -= 30 * dt; b.z = Math.max(0, b.z + b.vz * dt);
      if (b.z <= 0) {
        if (Math.abs(b.vz) > 2) { b.vz = Math.abs(b.vz) * 0.45; b.vx *= 0.7; b.vy *= 0.7; b.vx += (this.rng.next() - 0.5) * 2; } // odd football bounce
        else { b.vz = 0; const f = Math.max(0, 1 - dt * 3); b.vx *= f; b.vy *= f; }                                         // roll to a stop
      }
    }
  }
  resolveCatch() {
    const b = this.ball, L = { x: b.x1, y: b.y1 };
    const outB = L.y <= 0 || L.y >= FW || L.x > 120;
    const recs = this.receivers.filter((r) => !r.block && !(r.run && !this.thrown)).map((r) => [r, dist(r, L)]).sort((a, b) => a[1] - b[1]);
    const defs = this.defs.filter((d) => d.stun <= 0).map((d) => [d, dist(d, L)]).sort((a, b) => a[1] - b[1]);
    const [R, dR] = recs[0] || [null, 99], [Dd, dD] = defs[0] || [null, 99];
    const cat = R ? eff(R.p, 'CAT') : 0, cov = Dd ? eff(Dd.p, 'COV') : 0;
    const rIn = R && dR <= 2.0 + cat * 0.05, dIn = Dd && dD <= 1.6 + cov * 0.03;
    const rng = this.rng;
    // pressure: 0 = wide open, 1 = blanketed
    const pressure = clamp((2.4 - dD) / 1.75, 0, 1); // bodies can't overlap, so ~0.65 yd is full contact
    this.lastCatch = { dR, dD, rIn, dIn, pressure };
    if (outB) return this.incomplete('INCOMPLETE - OUT');
    if (rIn) {
      const pCatch = clamp(0.87 - this.wx + cat * 0.02 - dR * 0.1 - Math.min(0.4, (b.err || 0) * 0.08) - pressure * (0.22 + this.diff.contest) - (b.bullet && b.T < 0.5 ? 0.05 : 0), 0.06, 0.97);
      if (rng.chance(pCatch)) return this.catchBy(R);
      if (pressure > 0.6 && rng.chance((pressure - 0.6) * 0.45 + cov * 0.005 + this.diff.contest * 0.3)) return this.intercept(Dd);
      return this.incomplete(pressure > 0.35 ? 'BROKEN UP!' : 'DROPPED!', true);
    }
    if (dIn) {
      if (rng.chance(clamp(0.24 + cov * 0.025 + this.diff.contest - dD * 0.12, 0.08, 0.55))) return this.intercept(Dd);
      return this.incomplete('DEFLECTED!', true);
    }
    return this.incomplete('INCOMPLETE');
  }
  catchBy(r) {
    this.receiver = r.p; this.events.push('catch');
    this.setCarrier(r, 'rec');
    this.boundsCheck(r);
  }
  intercept(d) {
    this.events.push('int');
    // the defender returns it toward our end zone; our players chase him down
    this.mode = 'intret'; this.returner = d; this.thrown = true; this.carrier = null;
    this.ball = { state: 'carried', x: d.x, y: d.y, z: 1.2 };
    d.stun = 0; d.vx = -2; d.runT = 0; this.intT = 0;
    for (const e of this.ents) if (e.side === 'off') e.chaseAt = this.t + 0.25 + this.rng.range(0, 0.35);
  }
  updateIntReturn(dt) {
    if (this.result) { this.endTimer -= dt; this.settle(dt); if (this.ball.state === 'loose') this.ballUpdate(dt); this.animate(dt); if (this.endTimer <= 0) this.done = true; return; }
    this.t += dt; this.intT += dt;
    const r = this.returner;
    const sp = spdOf(eff(r.p, 'SPD')) * 0.95;
    let vy = 0;
    for (const e of this.ents) {
      if (e.side !== 'off') continue;
      const dx = r.x - e.x, dy = e.y - r.y, dd = Math.hypot(dx, dy);
      if (dx > -1 && dx < 6 && dd < 6) vy -= Math.sign(dy || 1) * sp * 0.25 * (1 - dd / 6); // cut away from tacklers ahead
    }
    if (r.y < 2.5) vy += 1.5; if (r.y > FW - 2.5) vy -= 1.5;
    r.vx += (-sp - r.vx) * Math.min(1, dt * 5); r.vy += (vy - r.vy) * Math.min(1, dt * 6);
    r.x += r.vx * dt; r.y += r.vy * dt;
    this.ball.x = r.x - 0.3; this.ball.y = r.y;
    for (const e of this.ents) {
      if (e === r) continue;
      if (e.side === 'off') { if (this.t >= (e.chaseAt || 0)) this.pursue(e, r, dt, e.role === 'OL' ? 0.85 : 1); }
      else this.moveTo(e, e.x - 2, e.y, 3, dt); // blockers escort loosely
      if (e.cd > 0) e.cd -= dt;
    }
    const spot = (kind, msg) => this.end({ kind, x: r.x, y: clamp(r.y, 0, FW), msg, stop: true, interceptor: r, pick6: kind === 'pick6' });
    if (r.x <= 10) return spot('pick6', 'PICK SIX!');
    if (r.y <= 0 || r.y >= FW) return spot('int', 'INTERCEPTED! (OUT)');
    for (const e of this.ents) {
      if (e.side !== 'off' || e.cd > 0 || Math.hypot(e.x - r.x, e.y - r.y) > 0.9) continue;
      if (this.rng.chance(e.role === 'OL' ? 0.35 : 0.25)) { e.cd = 1; e.stun = 0.5; this.events.push('miss'); continue; }
      r.down = true; this.tackler = e; e.lunge = true;
      return spot('int', 'INTERCEPTED!');
    }
    this.animate(dt);
    if (this.intT > 12) spot('int', 'INTERCEPTED!');
  }
  incomplete(msg, deflect = false) {
    const b = this.ball;
    this.events.push(deflect ? 'deflect' : 'drop');
    this.ball = { state: 'loose', x: b.x1, y: b.y1, z: 1.3, vx: (this.rng.next() - 0.5) * 6, vy: (this.rng.next() - 0.5) * 6, vz: deflect ? 6 : 0, t: 0 };
    this.end({ kind: 'incomplete', x: this.los, y: this.by, msg, stop: true });
  }
  end(r) {
    if (this.result) return;
    r.yards = r.kind === 'incomplete' || r.kind === 'int' || r.kind === 'pick6' ? 0 : r.x - this.los;
    r.carrierKind = this.carrierKind; r.carrier = this.carrier?.p || (r.sack ? this.QB.p : null);
    r.passer = this.passer || null; r.receiver = this.receiver || null; r.thrown = this.thrown; r.time = this.t;
    if (r.kind === 'td' || r.kind === 'safety') r.stop = true;
    this.result = r; this.endTimer = r.kind === 'td' ? 1.2 : 0.8;
    this.events.push(r.kind === 'td' ? 'td' : r.kind === 'incomplete' ? 'whistle' : 'tackle');
    for (const e of this.ents) if (e !== this.carrier) { e.vx *= 0.3; e.vy *= 0.3; }
  }
  // after the whistle: tacklers finish their lunge, everyone else coasts to a stop
  settle(dt) {
    const tk = this.tackler, c = this.returner || this.carrier || this.QB;
    if (tk && c && tk.lunge) {
      const d = dist(tk, c);
      if (d > 0.45) { tk.x += (c.x - tk.x) * Math.min(1, dt * 10); tk.y += (c.y - tk.y) * Math.min(1, dt * 10); }
      else { tk.lunge = false; tk.down = true; }
    }
    for (const e of this.ents) {
      if (e === tk) continue;
      if (e === c && c.fallTo !== undefined) { c.x += (c.fallTo - c.x) * Math.min(1, dt * 8); c.vx *= 0.8; c.vy *= 0.8; continue; }
      const k = e === c ? (this.result.kind === 'td' ? 0.93 : 0.6) : 0.9;
      e.vx *= k; e.vy *= k; e.x += e.vx * dt; e.y += e.vy * dt;
    }
  }
  // ---------------- kickoff return ----------------
  setupReturn(o) {
    const { lineup, defRating, diff, rng } = o;
    this.mode = 'return'; this.rng = rng; this.diff = diff; this.play = { name: 'KICKOFF RETURN', type: 'return', f: 'return' };
    this.t = 0; this.started = true; this.done = false; this.endTimer = 0; this.result = null;
    this.events = []; this.ents = []; this.handed = false; this.thrown = false; this.carrier = null; this.carrierKind = null;
    this.los = 10; this.by = FW / 2;
    const add = (side, role, p, x, y) => {
      const e = { side, role, p, x, y: clamp(y, 1.5, FW - 1.5), vx: 0, vy: 0, stun: 0, cd: 0, trail: [], anim: 0, down: false, star: !p.regular };
      e.spd = spdOf(eff(p, 'SPD')) + (side === 'def' ? diff.spd * 0.6 : 0);
      bodyOf(e, role);
      this.ents.push(e); return e;
    };
    // the fastest skill player returns it
    const cands = [...lineup.RB, ...lineup.WR].sort((a, b) => (b.attrs.SPD || 0) - (a.attrs.SPD || 0));
    this.landX = 10 + rng.range(-6, 7); this.landY = FW / 2 + rng.range(-9, 9);
    this.KR = add('off', 'KR', cands[0], this.landX - 4, this.landY);
    const blockers = [...lineup.OL, ...lineup.TE, ...lineup.WR.slice(1), lineup.RB[0] === cands[0] ? lineup.WR[0] : lineup.RB[0]].slice(0, 10);
    this.blk = blockers.map((p, i) => add('off', 'BLK', p, 24 + (i % 2) * 6 + rng.range(0, 3), 5 + i * (FW - 10) / 9));
    this.defs = [];
    for (let i = 0; i < 11; i++) {
      const d = add('def', 'COV', makeDefender(defRating, i, rng), 74 + rng.range(-1, 1), 3 + i * (FW - 6) / 10);
      d.react = 0.1; d.lane = d.y; this.defs.push(d);
    }
    // each blocker picks the coverage man in his lane
    const free = this.defs.slice();
    for (const b of this.blk) { free.sort((a, c) => Math.abs(a.y - b.y) - Math.abs(c.y - b.y)); b.target = free.shift(); }
    this.receivers = [];
    this.QB = this.KR; // renderers/helpers that reference QB fall back to the returner
    this.ball = { state: 'kick', x0: 75, y0: FW / 2, x1: this.landX, y1: this.landY, t: 0, T: 2.4, peak: 16, x: 75, y: FW / 2, z: 0.5 };
    this.awaitReturn = false; this.decided = false;
  }
  returnBall() { // user taps to bring it out of the end zone
    if (this.mode !== 'return' || this.decided) return false;
    this.decided = true; this.wantReturn = true;
    if (this.awaitReturn) { this.awaitReturn = false; this.setCarrier(this.KR, 'kr'); }
    return true;
  }
  updateReturn(dt) {
    if (this.done) return;
    if (this.result) { this.endTimer -= dt; this.settle(dt); if (this.ball.state === 'loose') this.ballUpdate(dt); this.animate(dt); if (this.endTimer <= 0) this.done = true; return; }
    this.t += dt;
    const b = this.ball, kr = this.KR;
    if (b.state === 'kick') {
      b.t += dt; const u = Math.min(1, b.t / b.T);
      b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u; b.z = 0.5 + 4 * b.peak * u * (1 - u) + (1.3 - 0.5) * u;
      this.moveTo(kr, b.x1, b.y1, kr.spd, dt);
      if (u >= 1) {
        this.events.push('catch');
        if (b.x1 < 10 && !this.wantReturn) { this.awaitReturn = true; this.awaitUntil = this.t + 1.1; b.state = 'carried'; this.carrier = null; }
        else this.setCarrier(kr, 'kr');
      }
    }
    if (this.awaitReturn) {
      this.moveTo(kr, kr.x, kr.y, 0, dt);
      if (this.t >= this.awaitUntil) { kr.down = true; this.decided = true; return this.end({ kind: 'touchback', x: 10, y: kr.y, msg: 'TOUCHBACK', stop: true }); }
    }
    if (this.carrier) this.runCarrier(this.carrier, dt);
    // blockers: run at their man, then hold him up
    for (const bl of this.blk) {
      const d = bl.target;
      if (!d) continue;
      if (d.held && d.stun > 0) { bl.x = d.x - 0.7; bl.y += (d.y - bl.y) * Math.min(1, dt * 8); bl.vx = -0.3; continue; }
      if (d.held && d.stun <= 0) { d.held = false; bl.target = null; continue; }
      this.moveTo(bl, d.x - 0.6, d.y, bl.spd * 0.95, dt);
      if (dist(bl, d) < 1.1) {
        d.held = true;
        d.stun = clamp(1.0 + (eff(bl.p, 'STR') + (eff(bl.p, 'BLK') || 3) - eff(d.p, 'STR') * 2) * 0.12 + this.rng.range(-0.3, 0.9) - this.diff.contest * 2, 0.4, 2.8);
      }
    }
    if (!this.carrier && !this.awaitReturn) {
      // lone returner fielding the ball: blockers have already set up, keep everyone moving
    }
    // coverage: sprint down their lanes, then converge on the ball / carrier
    for (const d of this.defs) {
      if (d.stun > 0) { d.stun -= dt; if (!d.held) { d.vx = d.vy = 0; } continue; }
      const tgt = this.carrier || kr;
      if (Math.abs(d.x - tgt.x) > 18) this.moveTo(d, tgt.x, d.lane + (tgt.y - d.lane) * 0.35, d.spd, dt);
      else this.pursueLane(d, tgt, dt);
    }
    for (const e of this.ents) { if (e.cd > 0) e.cd -= dt; if (e.cd2 > 0) e.cd2 -= dt; }
    this.separate();
    if (this.carrier && !this.result) this.contacts();
    this.animate(dt);
    if (this.t > 25 && !this.result) this.end({ kind: 'tackle', x: (this.carrier || kr).x, y: kr.y, msg: 'WHISTLE' });
  }

}
