// On-field scene: renders the match, maps pointer/keyboard gestures to play controls.
import * as G from '../gfx.js';
import { rect, frame, text, line, px, panel, playerSprite, drawSprite, starIcon, textWidth, big, bigWidth, ballSprite, shadeColor } from '../gfx.js';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { app } from '../app.js';
import { FW, flightOf } from '../play.js';
import { displayName, ovr, ovrColor } from '../players.js';
import { yardText } from '../match.js';
import { clamp } from '../rng.js';

const SX = 8;                   // px per yard along the field
const HUD_H = 24, STANDS_H = 13, SIDE_H = 7, TIP_H = 12;
const GREEN = ['#2e8b3a', '#349a41'];
const CROWD = ['#ff4d5e', '#fff1e8', '#ffa300', '#29adff', '#7e2553', '#ffd23f', '#83769c', '#f4f4f4', '#3ccf6a'];

export class GameScene {
  constructor(match, onDone) {
    this.m = match; this.onDone = onDone; this.camX = 10 + match.ballYard + 18;
    this.g = null; this.paused = false; this.noAutosave = true; this.full = true; this.t = 0; this.flash = 0;
    this.shake = 0; this.hype = 0; this.parts = []; this.floats = []; this.lastMsg = ''; this.msgT = 0;
    this.ballTrail = []; this.dustT = 0; this.prevScore = { u: 0, o: 0 }; this.bump = { u: 0, o: 0 };
    this.wx = []; for (let i = 0; i < 110; i++) this.wx.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() });
    this.layout();
  }
  layout() {
    const W = G.W, H = G.H;
    this.top = G.SAFE.t;
    this.FT = this.top + HUD_H + STANDS_H;
    const avail = H - this.FT - SIDE_H - TIP_H - G.SAFE.b;
    this.SY = Math.max(2.6, Math.floor(avail / FW * 20) / 20);
    this.fieldB = this.FT + FW * this.SY;
    this.half = W / 2 / SX;
  }
  sx(x) { return Math.round((x - this.camX) * SX + G.W / 2 + this.shx); }
  sy(y, z = 0) { return Math.round(this.FT + y * this.SY - z * 3 + this.shy); }
  onPortrait() { if (this.m.phase !== 'final') this.paused = true; }
  update(dt) {
    this.layout();
    if (this.paused) return;
    this.t += dt;
    const m = this.m;
    m.update(dt);
    while (m.sfx.length) this.playSfx(m.sfx.shift());
    // camera
    let target = this.camX;
    const p = m.play;
    if (m.phase === 'opp') target = 10 + (100 - m.oppMarker());
    else if (p && (m.phase === 'live' || m.phase === 'msg')) {
      if (p.ball.state === 'air' || p.ball.state === 'kick') target = p.ball.x + (p.mode === 'return' ? 6 : 4);
      else if (p.carrier) target = p.carrier.x + 9;
      else if (p.mode === 'return') target = p.KR.x + 12;
      else if (this.g && this.g.kind === 'aim') target = p.QB.x + 24;
      else target = p.QB.x + 20;
    } else if (p && m.phase === 'presnap') target = p.los + 16;
    else if (m.phase === 'msg') target = 10 + m.ballYard + 10;
    this.camX += (target - this.camX) * Math.min(1, dt * 4);
    this.camX = clamp(this.camX, this.half - 4, 124 - this.half);
    // effects
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.hype > 0) this.hype -= dt;
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 90) * dt; q.vx *= 0.99; q.life -= dt; }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const f of this.floats) { f.y -= 12 * dt; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    if (p && p.result && !p._fx) {
      p._fx = true;
      const c = p.carrier;
      if (c && (p.result.kind === 'tackle' || p.result.kind === 'oob') && !p.result.sack) {
        const g = Math.round(p.result.yards);
        this.floats.push({ x: c.x, y: c.y, s: g >= 0 ? `+${g}` : `${g}`, c: g >= 10 ? '#ffd23f' : g >= 0 ? '#fff' : '#ff4d5e', life: 1.2 });
        if (g >= 15) this.hype = 1.2;
      }
    }
    // dust kicked up by a fast ball carrier
    this.dustT -= dt;
    const car = p && p.carrier && !p.result ? p.carrier : null;
    if (car && Math.hypot(car.vx, car.vy) > 6.5 && this.dustT <= 0) {
      this.dustT = 0.09;
      this.parts.push({ wx: car.x - 0.6, wy: car.y, x: 0, y: 3, vx: -8 - Math.random() * 8, vy: -4 - Math.random() * 6, g: 30, c: m.weather === 'snow' ? '#ffffff' : '#a8d08d', life: 0.3 });
    }
    for (const k of ['u', 'o']) { if (m.score[k] !== this.prevScore[k]) { this.bump[k] = 0.8; this.prevScore[k] = m.score[k]; } if (this.bump[k] > 0) this.bump[k] -= dt; }
    if (m.msg !== this.lastMsg || m.phase !== 'msg') { if (m.phase === 'msg' && m.msg !== this.lastMsg) this.msgT = 0; this.lastMsg = m.phase === 'msg' ? m.msg : ''; }
    this.msgT += dt;
  }
  playSfx(e) {
    const map = { snap: 'snap', throw: 'throw', catch: 'catch', tackle: 'tackle', juke: 'juke', miss: 'juke', dive: 'juke', whistle: 'whistle',
      kick: 'kick', int: 'bad', drop: 'drop', deflect: 'drop', groan: 'groan', crowd: 'crowd', good: 'good', bad: 'bad', handoff: 'hike' };
    if (e === 'td') { sfx.crowd(true); sfx.good(); this.flash = 0.5; this.hype = 3; this.confetti(); return; }
    if (e === 'tackle') { this.shake = 0.18; this.dust(); if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate(12); } catch (_) {} }
    if (e === 'int') this.shake = 0.3;
    if (e === 'miss') this.dust(true);
    if (map[e]) sfx[map[e]]();
  }
  confetti() {
    const cols = [this.m.me.c1, this.m.me.c2, '#ffd23f', '#fff'];
    for (let i = 0; i < 120; i++) this.parts.push({ sx: true, x: Math.random() * G.W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 50, g: 25, c: cols[i % 4], life: 3 + Math.random() });
  }
  dust(small = false) {
    const p = this.m.play; const c = p && (p.carrier || p.QB); if (!c) return;
    for (let i = 0; i < (small ? 4 : 9); i++) this.parts.push({ wx: c.x, wy: c.y, x: 0, y: 0, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, g: 40, c: '#c9b38b', life: 0.4 + Math.random() * 0.3 });
  }
  // ---------------- input ----------------
  pointer(e) {
    const m = this.m;
    if (this.paused) return;
    if (e.type === 'down') {
      if (this.g && e.id !== this.g.id) { // second finger while aiming toggles bullet
        if (this.g.kind === 'aim') { this.g.bullet = !this.g.bullet; sfx.click(); }
        return;
      }
      if (m.phase === 'msg') { if (this.msgT > 0.25) m.skip(); return; }
      if (m.phase === 'opp') { m.skip(); return; }
      if (m.phase === 'kick') { const r = m.kick.tap(); if (r === 'kick') sfx.kick(); else sfx.click(); return; }
      if (m.phase === 'presnap') { m.snap(); sfx.snap(); }
      if (m.phase !== 'live') return;
      const p = m.play;
      if (p.mode === 'return' && !p.decided) { p.returnBall(); }
      if (p.canHandoff && p.canHandoff()) {
        const rx = this.sx(p.RB.x), ry = this.sy(p.RB.y) - 7;
        if (Math.hypot(e.x - rx, e.y - ry) < 22) { p.handoff(); sfx.hike(); return; }
      }
      if (p.carrier || p.mode === 'return') { this.g = { kind: 'swipe', id: e.id, x0: e.x, y0: e.y, t: this.t }; return; }
      if (p.canThrow() || !p.started) this.g = { kind: 'aim', id: e.id, x0: e.x, y0: e.y, x: e.x, y: e.y, bullet: e.button === 2 };
    } else if (e.type === 'chord') {
      if (this.g && this.g.kind === 'aim') { this.g.bullet = !this.g.bullet; sfx.click(); }
    } else if (e.type === 'move') {
      const g = this.g; if (!g || g.id !== e.id) return;
      if (g.kind === 'aim') { g.x = e.x; g.y = e.y; }
      else if (g.kind === 'swipe') {
        const dx = e.x - g.x0, dy = e.y - g.y0;
        if (Math.hypot(dx, dy) > 12) { this.swipe(dx, dy); g.x0 = e.x; g.y0 = e.y; }
      }
    } else if (e.type === 'up' || e.type === 'cancel') {
      const g = this.g; if (!g || g.id !== e.id) return;
      this.g = null;
      if (g.kind !== 'aim' || e.type === 'cancel') return;
      const p = m.play; if (!p || m.phase !== 'live' || p.mode === 'return') return;
      const dx = g.x0 - g.x, dy = g.y0 - g.y;
      if (Math.hypot(dx, dy) < 6) return; // a tap, not a throw
      if (dx < -8 && Math.abs(dx) > Math.abs(dy) * 0.8) { p.scramble(); return; }
      if (!p.canThrow()) return;
      const t = p.aimTarget(dx, dy, SX, this.SY);
      p.throwTo(t.x, t.y, g.bullet);
    }
  }
  swipe(dx, dy) {
    const p = this.m.play; if (!p || !p.carrier) return;
    if (Math.abs(dy) > Math.abs(dx)) p.juke(dy < 0 ? -1 : 1);
    else if (dx > 0) p.dive(); else p.stutter();
  }
  key(e) {
    const m = this.m, k = e.key, p = m.play;
    if (k === 'Escape' || k === 'p') { this.paused = !this.paused; return; }
    if (this.paused) return;
    if (k === ' ' || k === 'Enter') {
      if (m.phase === 'presnap') { m.snap(); sfx.snap(); }
      else if (m.phase === 'msg') m.skip();
      else if (m.phase === 'opp') m.skip();
      else if (m.phase === 'kick') { if (m.kick.tap() === 'kick') sfx.kick(); }
      else if (m.phase === 'live' && p && p.mode === 'return') p.returnBall();
      return;
    }
    if (k === 't' || k === 'T') { if (m.timeout()) app.toast('TIMEOUT'); return; }
    if (!p || m.phase !== 'live') return;
    if ((k === 'h' || k === 'H') && p.handoff && p.handoff()) { sfx.hike(); return; }
    if (this.g && this.g.kind === 'aim' && (k === 'b' || k === 'B' || k === 'Shift')) { this.g.bullet = !this.g.bullet; return; }
    if (p.mode === 'return' && !p.decided && 'wasdWASD'.includes(k)) p.returnBall();
    if (!p.carrier) return;
    if (k === 'w' || k === 'W' || k === 'ArrowUp') p.juke(-1);
    else if (k === 's' || k === 'S' || k === 'ArrowDown') p.juke(1);
    else if (k === 'a' || k === 'A' || k === 'ArrowLeft') p.stutter();
    else if (k === 'd' || k === 'D' || k === 'ArrowRight') p.dive();
  }
  // ---------------- drawing ----------------
  draw() {
    const m = this.m, W = G.W, H = G.H;
    this.layout();
    this.shx = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    this.shy = this.shake > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;
    rect(0, 0, W, H, '#0b0d1c');
    if (m.phase === 'kick') { this.drawKick(); this.drawHUD(); this.drawParts(); return; }
    this.drawStands();
    this.drawField();
    const p = m.play;
    if (p && m.phase !== 'opp') this.drawPlay(p);
    if (m.phase === 'opp') this.drawOpp();
    if (m.night) rect(0, this.FT, W, this.fieldB - this.FT + SIDE_H, 'rgba(8,10,46,0.30)');
    this.drawWeather();
    this.drawParts();
    for (const f of this.floats) big(f.s, this.sx(f.x), this.sy(f.y) - 30 - (1.2 - f.life) * 10, f.c, { align: 'center' });
    this.drawHUD();
    this.drawBottom();
    if (m.phase === 'opp') this.drawOppPanel();
    if (m.phase === 'msg') this.banner(m.msg);
    if (m.phase === 'choice') this.drawChoice();
    if (m.phase === 'final') this.drawFinal();
    if (this.flash > 0 && ((this.flash * 10) | 0) % 2) { frame(0, 0, W, H, '#ffd23f'); frame(1, 1, W - 2, H - 2, '#ffd23f'); }
    if (this.paused) this.drawPause();
  }
  drawStands() {
    const W = G.W, m = this.m, y0 = this.top + HUD_H, ft = this.FT;
    rect(0, y0, W, ft - y0, m.night ? '#0e1030' : '#262a52');
    // crowd rows anchored to the world so they scroll with the field
    const off = Math.floor(this.camX * SX);
    for (let row = 0; row < 3; row++) {
      for (let sxp = -3; sxp < W + 3; sxp += 3) {
        const col = Math.floor((sxp + off) / 3);
        const hsh = (col * 2654435761 + row * 97) >>> 0;
        if (hsh % 7 === 0) continue;
        const bob = this.hype > 0 ? Math.round(Math.max(0, Math.sin(this.t * 18 + col * 0.7)) * 2) : (hsh % 23 === 0 ? Math.round(Math.sin(this.t * 4 + col)) : 0);
        const x = sxp - ((off % 3) + 3) % 3;
        const y = y0 + 1 + row * 3 - bob;
        rect(x, y, 2, 2, CROWD[hsh % CROWD.length]);
        if (m.night && row === 0 && hsh % 11 === 0) px(x, y - 1, '#fff');
      }
    }
    // ad boards in team colours
    rect(0, ft - 3, W, 3, m.me.c1);
    for (let x = -(off % 48); x < W; x += 48) { rect(x, ft - 3, 24, 3, m.opp.c1); }
    rect(0, ft - 1, W, 1, '#0b0d1c');
    if (m.night) for (let x = 20; x < W; x += 90) { rect(x, y0, 8, 2, '#fffbe0'); rect(x - 2, y0 + 2, 12, 1, 'rgba(255,251,224,0.4)'); }
  }
  drawField() {
    const m = this.m, W = G.W, FT = this.FT, SY = this.SY, fb = this.fieldB;
    const x0 = Math.floor(this.camX - this.half - 2), x1 = Math.ceil(this.camX + this.half + 2);
    const snow = m.weather === 'snow';
    for (let yd = Math.max(0, Math.floor(x0 / 5) * 5); yd < Math.min(120, x1); yd += 5) {
      let c = GREEN[(yd / 5) % 2];
      if (snow) c = (yd / 5) % 2 ? '#8fb59a' : '#97bda2';
      if (yd < 10) c = shadeColor(m.me.c1, 0.85); else if (yd >= 110) c = shadeColor(m.opp.c1, 0.85);
      rect(this.sx(yd), FT, 5 * SX, FW * SY, c);
    }
    // grass texture (anchored to world yards so it scrolls with the field)
    const tuft = snow ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.09)', tuft2 = snow ? 'rgba(160,190,170,0.5)' : 'rgba(255,255,255,0.06)';
    for (let yd = Math.max(10, x0); yd < Math.min(110, x1); yd++) {
      const bx = this.sx(yd);
      for (let k = 0; k < 7; k++) {
        const h = ((yd * 73856093) ^ (k * 19349663)) >>> 0;
        const ty = FT + 2 + (h % Math.max(1, Math.floor(FW * SY - 4))), tx = bx + ((h >> 8) % SX);
        rect(tx, ty, 1, 2, k % 2 ? tuft : tuft2);
      }
    }
    // end zone checker + rotated team names
    for (const [ex, t, rot] of [[0, m.me, -1], [110, m.opp, 1]]) {
      const s0 = this.sx(ex), s1 = this.sx(ex + 10);
      if (s1 < 0 || s0 > W) continue;
      const dark = shadeColor(t.c1, 0.7);
      for (let y = FT; y < fb; y += 8) for (let x = s0; x < s1; x += 8) if (((x - s0) / 8 + (y - FT) / 8) % 2 === 0) rect(x, y, 8, 8, dark);
      const ctx = G.ctx; ctx.save(); ctx.translate(Math.round((s0 + s1) / 2), Math.round((FT + fb) / 2)); ctx.rotate(rot * Math.PI / 2);
      const sc = bigWidth(t.name, 2) < FW * SY - 16 ? 2 : 1;
      big(t.name, 0, -Math.round(3.5 * sc), t.c2 === '#111111' ? '#fff' : t.c2, { align: 'center', scale: sc });
      ctx.restore();
    }
    // midfield badge
    const mx = this.sx(60);
    if (mx > -40 && mx < W + 40) big(this.home().abbr, mx + 1, Math.round((FT + fb) / 2) - 7, 'rgba(255,255,255,0.22)', { align: 'center', scale: 2, outline: null, shadow: false });
    // lines
    for (let yd = Math.max(0, x0); yd <= Math.min(120, x1); yd++) {
      const sx = this.sx(yd);
      if (yd % 5 === 0 && yd >= 10 && yd <= 110) rect(sx, FT, 1, FW * SY, yd === 10 || yd === 110 ? '#ffffff' : 'rgba(255,255,255,0.78)');
      if (yd > 10 && yd < 110 && yd % 5) for (const hy of [0.9, 23.6, 29.7, FW - 0.9]) rect(sx, this.sy(hy) - 1, 1, 3, 'rgba(255,255,255,0.55)');
      if (yd % 10 === 0 && yd > 10 && yd < 110) {
        const v = yd - 10, n = Math.min(v, 100 - v);
        const ty = this.sy(6), by = this.sy(FW - 6) - 7;
        big(String(n), sx + 1, ty, 'rgba(255,255,255,0.9)', { align: 'center', outline: null, shadow: false });
        big(String(n), sx + 1, by, 'rgba(255,255,255,0.9)', { align: 'center', outline: null, shadow: false });
        if (n !== 50) { const dir = v < 50 ? -1 : 1, ax = sx + dir * 11; for (let i = 0; i < 3; i++) rect(ax - dir * i, ty + 3 - i, 1, 1 + 2 * i, 'rgba(255,255,255,0.8)'); }
      }
    }
    rect(0, FT - 1, W, 1, '#fff'); rect(0, fb, W, 1, '#fff');
    // sideline below the field
    rect(0, fb + 1, W, SIDE_H, snow ? '#7d9c86' : '#256f30');
    const off = Math.floor(this.camX * SX);
    for (let x = -(off % 64); x < W; x += 64) { rect(x + 8, fb + 3, 26, 3, shadeColor(this.home().c1, 0.8)); }
    // goal posts (back line) with shadow
    for (const gx of [0, 120]) {
      const s = this.sx(gx), cy = this.sy(FW / 2);
      if (s < -12 || s > W + 12) continue;
      const lo = this.sy(FW / 2 - 3.1), hi = this.sy(FW / 2 + 3.1);
      rect(s + 3, cy + 1, 6, 2, 'rgba(0,0,0,0.25)');
      rect(s, cy - 16, 2, 16, '#ffd23f');
      rect(s, lo - 16, 2, hi - lo + 2, '#ffd23f');
      rect(s, lo - 32, 2, 16, '#ffd23f'); rect(s, hi - 32, 2, 16, '#ffd23f');
    }
    // scrimmage & first down markers
    if (m.phase !== 'opp' && m.phase !== 'kick' && !(m.play && m.play.mode === 'return')) {
      const los = this.sx(10 + m.ballYard);
      rect(los, FT, 1, FW * SY, '#29adff');
      if (!m.conv && m.ballYard + m.toGo < 100) {
        const f = this.sx(10 + m.fd);
        rect(f, FT, 1, FW * SY, '#ffec27');
        rect(f - 4, FT - 11, 9, 9, '#0b0d1c'); rect(f - 3, FT - 10, 7, 7, '#ff9f1c');
        text(String(Math.min(4, m.down)), f - 1, FT - 9, '#0b0d1c');
      }
    }
  }
  home() { return this.m.userHome ? this.m.me : this.m.opp; }
  drawPlay(p) {
    const m = this.m;
    // routes before the snap: dotted path, chevrons showing direction, arrowhead (or stop bar) at the end
    if (!p.started && p.receivers) {
      for (const r of p.receivers) {
        if (!r.route || r.block) continue;
        const col = r.run ? '#ffa300' : '#fff1e8';
        const pts = [{ x: r.x, y: r.y }, ...r.route.slice(0, r.run ? 2 : undefined)];
        const last = pts[pts.length - 1], prev = pts[pts.length - 2];
        if (!r.stopAtEnd) { // extend in the final direction so the arrow shows where they keep running
          const L = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
          pts.push({ x: last.x + (last.x - prev.x) / L * 4, y: last.y + (last.y - prev.y) / L * 4 });
        }
        const sp = pts.map((q) => [this.sx(q.x), this.sy(q.y) - 2]);
        let along = 0;
        for (let i = 1; i < sp.length; i++) {
          const [x0, y0] = sp[i - 1], [x1, y1] = sp[i];
          line(x0, y0, x1, y1, col, 2, i);
          const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
          for (let d = 14 - (along % 14); d < len - 6; d += 14) chevron(x0 + ux * d, y0 + uy * d, ux, uy, col);
          along += len;
        }
        const [ex, ey] = sp[sp.length - 1], [px0, py0] = sp[sp.length - 2];
        const L = Math.hypot(ex - px0, ey - py0) || 1, ux = (ex - px0) / L, uy = (ey - py0) / L;
        arrowHead(ex, ey, ux, uy, r.stopAtEnd ? '#ffec27' : col);
        if (r.stopAtEnd) { for (let j = -3; j <= 3; j++) { rect(ex + ux * 2 - uy * j, ey + uy * 2 + ux * j, 1, 1, '#0b0d1c'); rect(ex + ux * 3 - uy * j, ey + uy * 3 + ux * j, 1, 1, '#ffec27'); } }
      }
    }
    // aim preview
    if (this.g && this.g.kind === 'aim' && p.canThrow && p.canThrow()) {
      const dx = this.g.x0 - this.g.x, dy = this.g.y0 - this.g.y;
      if (Math.hypot(dx, dy) >= 6) {
        if (dx < -8 && Math.abs(dx) > Math.abs(dy) * 0.8) big('RUN!', this.sx(p.QB.x), this.sy(p.QB.y) - 34, '#ffa300', { align: 'center' });
        else {
          const t = p.aimTarget(dx, dy, SX, this.SY);
          const peak = flightOf(t.d, this.g.bullet).peak;
          const col = this.g.bullet ? '#ff4d5e' : '#fff1e8';
          for (let i = 1; i <= 20; i++) {
            const u = i / 20, x = p.QB.x + (t.x - p.QB.x) * u, y = p.QB.y + (t.y - p.QB.y) * u;
            const z = 2 - 0.7 * u + 4 * peak * u * (1 - u);
            rect(this.sx(x) - (i % 2 ? 1 : 0), this.sy(y, z) - 8, i % 2 ? 2 : 1, i % 2 ? 2 : 1, col);
          }
          const tx = this.sx(t.x), ty = this.sy(t.y);
          const r = 5 + Math.round(Math.sin(this.t * 10));
          for (let a = 0; a < 20; a++) px(tx + Math.cos(a / 20 * 6.283) * r, ty + Math.sin(a / 20 * 6.283) * r * 0.6, '#ffec27');
          rect(tx - 1, ty, 3, 1, '#ffec27');
          line(this.g.x0, this.g.y0, this.g.x, this.g.y, 'rgba(255,255,255,0.5)', 1);
          const pw = t.d / t.max;
          rect(this.g.x0 - 16, this.g.y0 - 15, 32, 5, '#0b0d1c'); rect(this.g.x0 - 15, this.g.y0 - 14, 30 * pw, 3, pw > 0.97 ? '#ff4d5e' : '#3ccf6a');
          big(this.g.bullet ? 'BULLET' : 'LOB', this.g.x0, this.g.y0 - 26, this.g.bullet ? '#ff4d5e' : '#fff', { align: 'center' });
          big(`${Math.round(t.d)}`, tx, ty + 5, '#ffec27', { align: 'center' });
        }
      }
    }
    // entities, depth-sorted
    const ents = p.ents.slice().sort((a, b) => a.y - b.y);
    const bl = p.ball, inAir = bl.state === 'air', left = inAir ? bl.T - bl.t : 9;
    const td = p.result && p.result.kind === 'td';
    for (const e of ents) {
      const off = e.side === 'off';
      const T = off ? m.me : m.opp;
      const x = this.sx(e.x);
      let y = this.sy(e.y);
      if (x < -16 || x > G.W + 16) continue;
      const pants = off ? '#e9e9e9' : shadeColor(T.c2 === '#111111' ? '#555555' : T.c2, 0.75);
      const face = off ? 1 : -1;
      const down = (e.down && p.result) || (e.stun > 0.3 && !e.held);
      const sp = Math.hypot(e.vx, e.vy);
      // pick a pose
      let fr = down ? 5 : sp > 0.6 ? [1, 2, 3, 2][Math.floor(e.anim * 1.4) % 4] : 0;
      let lift = 0;
      if (!down) {
        if (e === p.QB && p.mode !== 'return' && !p.carrier && ((!p.thrown && this.g && this.g.kind === 'aim') || (p.thrown && p.t - p.throwT < 0.22))) fr = 4;
        if (e.toBall && inAir && left < 0.45) fr = 6;                       // reaching for the ball
        if (e.diveT > 0) { fr = 7; lift = 4; }                               // diving forward
        if (e.lunge && p.result) { fr = 7; lift = 2; }                       // tackler lunging
        if (td && off && (e === p.carrier || Math.abs(e.x - (p.carrier || e).x) < 12)) { fr = 6; lift = Math.round(Math.abs(Math.sin(this.t * 9 + e.y)) * 5); }
        if (!p.started && off && fr === 0) lift = Math.floor(this.t * 2 + e.y) % 2; // pre-snap bounce
      }
      // shadow shrinks as the player leaves the ground
      rect(x - 4 + Math.min(2, lift >> 1), y - 1, 9 - Math.min(4, lift), 3, 'rgba(0,0,0,0.28)');
      rect(x - 3, y - 2, 7, 1, 'rgba(0,0,0,0.18)');
      // juke after-images
      if (e === p.carrier && e.jukeT > 0 && e.trail.length > 12) {
        const n = e.trail.length, ctx = G.ctx;
        ctx.globalAlpha = 0.28;
        for (const back of [10, 20]) { const tx = this.sx(e.trail[n - back - 2]), ty = this.sy(e.trail[n - back - 1]); drawSprite(playerSprite(T.c1, T.c2, fr, face, e.p.skin || 0, pants), tx - 5, ty - 15); }
        ctx.globalAlpha = 1;
      }
      const img = playerSprite(T.c1, T.c2, fr, face, e.p.skin || 0, pants);
      y -= lift;
      if (fr === 5 || fr === 7) drawSprite(img, x - 8, y - 8); else drawSprite(img, x - 5, y - img.height + 1);
      const headY = fr === 6 ? y - 17 : y - 15;
      if (off && e.star && fr !== 5 && fr !== 7) starIcon(x - 2, headY - 7, '#ffd23f');
      // rating badge over skill players and defenders
      if (!down && fr !== 7 && !['OL', 'DL', 'BLK'].includes(e.role) && (m.phase === 'presnap' || m.phase === 'live') && !p.result) {
        const v = e.ov ?? (e.ov = ovr(e.p)), by = headY - (off && e.star ? 15 : 9);
        rect(x - 6, by, 13, 7, '#0b0d1c'); rect(x - 5, by + 1, 11, 5, off ? shadeColor(T.c1, 0.55) : '#3a1018');
        text(String(v), x + 1, by + 1, ovrColor(v), 1, 'center');
      }
      if (e === p.carrier && !down && fr !== 7) { const ay = headY - (e.star ? 12 : 6) + Math.round(Math.sin(this.t * 8)); rect(x - 1, ay, 3, 1, '#fff'); px(x, ay + 1, '#fff'); }
    }
    // handoff ring
    if (p.canHandoff && p.canHandoff()) {
      const x = this.sx(p.RB.x), y = this.sy(p.RB.y) - 7, r = 10 + Math.sin(this.t * 12) * 1.5;
      for (let a = 0; a < 28; a++) px(x + Math.cos(a / 28 * 6.283) * r, y + Math.sin(a / 28 * 6.283) * r * 0.9, '#ffec27');
      big('TAP', x, y - 22, '#ffec27', { align: 'center' });
    }
    // ball
    const b = p.ball;
    const spin = Math.floor(this.t * 14) % 3;
    if (b.state === 'air' || b.state === 'loose' || b.state === 'kick') {
      const bx = this.sx(b.x), by = this.sy(b.y, b.z) - 2;
      // fading trail
      this.ballTrail.push([b.x, b.y, b.z]); if (this.ballTrail.length > 8) this.ballTrail.shift();
      this.ballTrail.forEach(([tx, ty, tz], i) => { if (i % 2) return; rect(this.sx(tx) - 1, this.sy(ty, tz) - 2, 2, 1, `rgba(255,255,255,${0.08 + i * 0.05})`); });
      const sh = Math.max(1, 4 - Math.round(b.z / 4));
      rect(this.sx(b.x) - sh, this.sy(b.y), sh * 2, 1, 'rgba(0,0,0,0.45)');
      ballSprite(bx, by, spin);
      if (b.state === 'air') { const tx = this.sx(b.x1), ty = this.sy(b.y1), rr = 3 + (1 - Math.min(1, left)) * 2; for (let a = 0; a < 14; a++) px(tx + Math.cos(a / 14 * 6.283 + this.t * 3) * rr * 1.3, ty + Math.sin(a / 14 * 6.283 + this.t * 3) * rr * 0.75, 'rgba(255,236,39,0.85)'); }
    } else {
      this.ballTrail.length = 0;
      if (b.state === 'carried' && p.carrier && !(p.carrier.down && p.result)) ballSprite(this.sx(p.carrier.x) + 3, this.sy(p.carrier.y) - 8, 0);
      else if (b.state === 'held' && p.QB && p.mode !== 'return') {
        // snap: the ball travels from the center to the QB
        const u = p.started ? Math.min(1, p.t / 0.22) : 0, ctr = p.OL ? p.OL[2] : p.QB;
        const qx = this.sx(p.QB.x) + 3, qy = this.sy(p.QB.y) - (this.g ? 12 : 8);
        const cx2 = this.sx(ctr.x) + 2, cy2 = this.sy(ctr.y) - 3;
        ballSprite(cx2 + (qx - cx2) * u, cy2 + (qy - cy2) * u - Math.sin(u * Math.PI) * 4, u < 1 ? spin : 0);
      } else if (b.state === 'carried' && !p.carrier && p.KR) ballSprite(this.sx(p.KR.x) + 3, this.sy(p.KR.y) - 8, 0);
    }
  }
  drawWeather() {
    const w = this.m.weather; if (w === 'clear') return;
    const W = G.W, top = this.FT - STANDS_H, h = this.fieldB - top;
    for (const f of this.wx) {
      if (w === 'snow') {
        const x = ((f.x * W + this.t * 10 * f.s + Math.sin(this.t + f.y * 9) * 6) % W + W) % W;
        const y = top + ((f.y * h + this.t * 18 * f.s) % h);
        rect(x, y, f.s > 1.1 ? 2 : 1, f.s > 1.1 ? 2 : 1, '#ffffff');
      } else {
        const x = ((f.x * W - this.t * 60 * f.s) % W + W) % W;
        const y = top + ((f.y * h + this.t * 200 * f.s) % h);
        line(x, y, x - 2, y + 5, 'rgba(180,200,255,0.55)');
      }
    }
  }
  drawParts() {
    for (const q of this.parts) {
      const x = q.sx ? q.x : this.sx(q.wx) + q.x, y = q.sx ? q.y : this.sy(q.wy) + q.y - 4;
      rect(x, y, 2, q.sx ? 3 : 2, q.c);
    }
  }
  drawOpp() {
    const m = this.m, s = m.oppState; if (!s) return;
    const yd = m.oppMarker();
    const bx = this.sx(10 + (100 - yd)), by = this.sy(FW / 2) + 10;
    rect(bx, this.FT, 1, FW * this.SY, '#ff4d5e');
    const fr = (i) => [1, 2, 3, 2][(Math.floor(this.t * 7) + i) % 4];
    for (let i = 0; i < 6; i++) drawSprite(playerSprite(m.opp.c1, m.opp.c2, fr(i), -1, i, shadeColor(m.opp.c2 === '#111111' ? '#555555' : m.opp.c2, 0.75)), bx + 6 + (i % 3) * 9, by - 26 + Math.floor(i / 3) * 24 + (i % 2) * 6);
    for (let i = 0; i < 6; i++) drawSprite(playerSprite(m.me.c1, m.me.c2, fr(i + 1), 1, i + 1, '#e9e9e9'), bx - 18 - (i % 3) * 9, by - 26 + Math.floor(i / 3) * 24 + (i % 2) * 6);
    ballSprite(bx + 2, by - 8, Math.floor(this.t * 10) % 3);
  }
  drawOppPanel() {
    const m = this.m, s = m.oppState; if (!s) return;
    const n = s.lines.length, shown = s.shown, W = G.W;
    const rows = Math.min(5, shown);
    const w = 240, x = Math.floor((W - w) / 2), y = this.FT + 4;
    panel(x, y, w, 20 + rows * 8, 'rgba(20,24,51,0.94)');
    rect(x + 1, y + 1, w - 2, 12, '#b81d2e');
    big(`${m.opp.abbr} ON OFFENSE`, x + 5, y + 3, '#fff', { shadow: false });
    text(`FROM THEIR ${s.start}`, x + w - 6, y + 4, '#ffd9dc', 1, 'right');
    const from = Math.max(0, shown - 5);
    for (let i = from; i < shown; i++) text(s.lines[i], x + 6, y + 17 + (i - from) * 8, i === n - 1 ? '#ffd23f' : '#f4f4f4');
  }
  drawHUD() {
    const m = this.m, W = G.W, top = this.top, L = 3 + G.SAFE.l, R = W - 3 - G.SAFE.r;
    rect(0, 0, W, top + HUD_H, '#0b0d1c');
    rect(0, top + HUD_H - 1, W, 1, '#2a3166');
    const box = (x, t, sc, tos, poss, bump = 0) => {
      const sc_c = bump > 0 && Math.floor(bump * 8) % 2 ? '#ffd23f' : '#fff', pop = bump > 0.55 ? 1 : 0;
      rect(x, top + 2, 62, 20, '#000'); rect(x + 1, top + 3, 22, 18, t.c1);
      big(t.abbr, x + 12, top + 9, t.c2 === '#111111' ? '#fff' : '#fff', { align: 'center', scale: 1 });
      rect(x + 23, top + 3, 38, 18, '#1b2045');
      if (bump > 0) rect(x + 23, top + 3, 38, 18, `rgba(255,210,63,${Math.min(0.35, bump * 0.45)})`);
      if (sc < 10) big(String(sc), x + 57, top + 5 - pop, sc_c, { align: 'right', scale: 2 });
      else big(String(sc), x + 58, top + 9 - pop, sc_c, { align: 'right' });
      for (let i = 0; i < 3; i++) rect(x + 3 + i * 6, top + 18, 4, 2, i < tos ? '#ffd23f' : '#3a3f5e');
      if (poss) { rect(x + 25, top + 10, 3, 3, '#8b4a1c'); }
    };
    const uPoss = m.phase !== 'opp';
    box(L, m.me, m.score.u, m.to.u, uPoss, this.bump.u); box(L + 64, m.opp, m.score.o, m.to.o, !uPoss, this.bump.o);
    const q = m.q <= 4 ? `Q${m.q}` : m.q === 5 ? 'OT' : `OT${m.q - 4}`;
    const cl = Math.ceil(m.clock), mm = Math.floor(cl / 60), ss = String(cl % 60).padStart(2, '0');
    const cx = L + 132;
    big(q, cx, top + 3, '#ffd23f');
    big(`${mm}:${ss}`, cx, top + 13, m.runoff > 0 && m.phase === 'presnap' ? '#ff4d5e' : '#fff');
    const dx = cx + 42;
    if (m.phase === 'opp') { big(`${m.opp.abbr} BALL`, dx, top + 3, '#ff4d5e'); text(`AT THEIR ${Math.round(m.oppMarker())}`, dx, top + 14, '#9aa3cf'); }
    else if (m.play && m.play.mode === 'return') { big('KICKOFF', dx, top + 3, '#fff'); text('RETURN IT!', dx, top + 14, '#9aa3cf'); }
    else if (m.phase !== 'final' && m.phase !== 'kick') {
      const dn = m.conv ? '2-PT TRY' : `${['1ST', '2ND', '3RD', '4TH'][m.down - 1] || '4TH'} & ${m.toGoText()}`;
      big(dn, dx, top + 3, '#fff'); text(`BALL ${yardText(m.ballYard)}`, dx, top + 14, '#9aa3cf');
    }
    // buttons (right aligned)
    let bx = R - 22;
    UI.button(bx, top + 3, 22, 18, '||', () => { this.paused = true; }, { color: '#4b5378', small: true });
    if (m.phase === 'presnap') {
      bx -= 40;
      UI.button(bx, top + 3, 38, 18, `TO ${m.to.u}`, () => { if (m.timeout()) app.toast('TIMEOUT - CLOCK STOPPED'); else app.toast(m.to.u ? 'CLOCK ALREADY STOPPED' : 'NO TIMEOUTS LEFT'); }, { disabled: m.to.u <= 0, color: '#7e2553' });
      const fgd = Math.round(100 - m.ballYard + 17);
      if (!m.conv && fgd <= 62 && m.down < 4 && bx - 46 > dx + 62) { bx -= 46; UI.button(bx, top + 3, 44, 18, `FG ${fgd}`, () => m.startKick('fg', fgd), { color: '#257179' }); }
    }
    // weather / time badge
    const wb = m.weather === 'snow' ? 'SNOW' : m.weather === 'rain' ? 'RAIN' : m.night ? 'NIGHT' : '';
    if (wb && bx - 34 > dx + 70) text(wb, bx - 6, top + 9, '#9aa3cf', 1, 'right');
  }
  drawBottom() {
    const m = this.m, p = m.play, W = G.W, H = G.H, y = H - TIP_H - G.SAFE.b;
    rect(0, y, W, TIP_H + G.SAFE.b, '#0b0d1c');
    let tip = '';
    if (m.phase === 'presnap') tip = `${p.play.name}  -  TAP TO SNAP, THEN DRAG BACK TO AIM`;
    else if (m.phase === 'live') {
      if (p.mode === 'return') tip = !p.decided && p.ball.x1 < 10 ? 'TAP TO RETURN IT  -  OR STAY PUT FOR A TOUCHBACK' : 'SWIPE UP/DOWN JUKE  -  FORWARD DIVE  -  BACK STUTTER';
      else if (p.canHandoff()) tip = 'TAP THE RB TO HAND OFF  -  OR DRAG BACK TO PASS';
      else if (p.carrier) tip = 'SWIPE UP/DOWN JUKE  -  FORWARD DIVE  -  BACK STUTTER';
      else if (p.canThrow()) tip = 'DRAG BACK + RELEASE = THROW  -  2ND FINGER / RIGHT CLICK = BULLET  -  DRAG FORWARD = RUN';
    } else if (m.phase === 'opp') tip = 'YOUR DEFENSE IS ON THE FIELD  -  TAP TO FAST FORWARD';
    const c = p && p.carrier && m.phase === 'live' ? p.carrier : null;
    if (c && !c.p.regular) {
      starIcon(6 + G.SAFE.l, y + 3, '#ffd23f');
      big(`${c.p.pos} ${displayName(c.p)}`, 14 + G.SAFE.l, y + 3, '#fff', { shadow: false });
      const g = Math.round(c.x - p.los);
      big(`${g >= 0 ? '+' : ''}${g} YDS`, W - 6 - G.SAFE.r, y + 3, g >= 10 ? '#ffd23f' : '#fff', { align: 'right', shadow: false });
    } else text(tip, W / 2, y + 4, '#9aa3cf', 1, 'center');
  }
  banner(s) {
    const W = G.W, cy = Math.round((this.FT + this.fieldB) / 2) - 14;
    const hot = /TOUCHDOWN|INTERCEPT|FUMBLE|SAFETY|FIRST DOWN|SACKED|GOOD!|VICTORY/.test(s);
    let sc = hot && bigWidth(s, 2) <= W - 30 ? 2 : 1;
    const main = s.replace(/ - .*/, '').trim(), sub = s.includes(' - ') ? s.slice(s.indexOf(' - ') + 3) : '';
    if (bigWidth(main, sc) > W - 20) sc = 1;
    const slide = Math.min(1, this.msgT * 6);
    const h = 12 + 7 * sc + (sub ? 10 : 0);
    const bw = Math.round(W * slide);
    rect((W - bw) / 2, cy - 2, bw, h + 4, '#0b0d1c');
    rect((W - bw) / 2, cy, bw, h, hot ? '#b81d2e' : '#1b2045');
    rect((W - bw) / 2, cy, bw, 1, 'rgba(255,255,255,0.35)');
    if (slide < 1) return;
    const pop = sc === 2 && this.msgT < 0.35 ? 1 : 0;
    big(main, W / 2, cy + 6 - pop, hot ? '#ffd23f' : '#fff', { align: 'center', scale: sc });
    if (sub) text(sub, W / 2, cy + 8 + 7 * sc + 2, '#f4f4f4', 1, 'center');
  }
  drawChoice() {
    const m = this.m, W = G.W, n = m.options.length;
    const w = 210, h = 30 + n * 24, x = Math.floor((W - w) / 2), y = Math.max(this.FT + 4, Math.floor((G.H - h) / 2));
    rect(0, this.FT, W, this.fieldB - this.FT, 'rgba(5,6,18,0.45)');
    panel(x, y, w, h);
    rect(x + 1, y + 1, w - 2, 16, '#2f6fe0');
    big(m.choiceTitle, W / 2, y + 5, '#fff', { align: 'center' });
    m.options.forEach((o, i) => UI.button(x + 14, y + 24 + i * 24, w - 28, 20, o.label, () => o.fn(), { disabled: o.disabled, color: i === 0 ? '#2fa84f' : '#2f6fe0' }));
  }
  drawFinal() {
    const m = this.m, W = G.W, H = G.H;
    rect(0, 0, W, H, 'rgba(5,6,18,0.55)');
    const w = 240, h = 132, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    panel(x, y, w, h);
    const won = m.score.u > m.score.o, tie = m.score.u === m.score.o;
    rect(x + 1, y + 1, w - 2, 16, won ? '#2fa84f' : tie ? '#4b5378' : '#b81d2e');
    big('FINAL' + (m.q >= 5 ? ' / OT' : ''), W / 2, y + 5, '#fff', { align: 'center' });
    big(won ? 'VICTORY!' : tie ? 'TIE GAME' : 'DEFEAT', W / 2, y + 24, won ? '#ffd23f' : tie ? '#fff' : '#ff8a95', { align: 'center', scale: 2 });
    G.helmet(x + 18, y + 48, m.me.c1, m.me.c2, 2, 1);
    G.helmet(x + w - 50, y + 48, m.opp.c1, m.opp.c2, 2, -1);
    big(`${m.score.u} - ${m.score.o}`, W / 2, y + 52, '#fff', { align: 'center', scale: 2 });
    text(`${m.me.abbr}`, x + 34, y + 76, '#9aa3cf', 1, 'center'); text(`${m.opp.abbr}`, x + w - 34, y + 76, '#9aa3cf', 1, 'center');
    text(`PASS ${m.team.pyds}   RUSH ${m.team.ryds}   ALLOWED ${m.team.oppYds} YDS`, W / 2, y + 88, '#9aa3cf', 1, 'center');
    UI.button(x + 50, y + h - 30, w - 100, 22, 'CONTINUE', () => this.onDone(m.result()), { color: '#2fa84f' });
  }
  drawPause() {
    const m = this.m, W = G.W, H = G.H;
    rect(0, 0, W, H, 'rgba(5,6,18,0.7)');
    const w = 200, h = 136, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    panel(x, y, w, h);
    big('PAUSED', W / 2, y + 7, '#ffd23f', { align: 'center', scale: 2 });
    UI.button(x + 20, y + 30, w - 40, 20, 'RESUME', () => { this.paused = false; }, { color: '#2fa84f' });
    UI.button(x + 20, y + 54, w - 40, 20, 'SIM REST OF GAME', () => { this.paused = false; if (m.phase !== 'final') m.simRest(); }, { color: '#4b5378' });
    UI.button(x + 20, y + 78, w - 40, 20, `SOUND ${app.career.settings.sound ? 'ON' : 'OFF'}`, () => { app.career.settings.sound = !app.career.settings.sound; }, { color: '#2f6fe0' });
    text('KEYS: SPACE SNAP  H HANDOFF  WASD / ARROWS', W / 2, y + 108, '#9aa3cf', 1, 'center');
    text('B BULLET  T TIMEOUT  ESC PAUSE', W / 2, y + 117, '#9aa3cf', 1, 'center');
  }
  // behind-the-kicker view for FG / PAT
  drawKick() {
    const m = this.m, k = m.kick, W = G.W, H = G.H;
    const top = this.top + HUD_H, HZ = top + Math.round((H - top) * 0.3), F = (H - HZ) * 3.6, CZ = 4.2;
    const gy = (z) => HZ + F / (z + CZ), sc = (z) => (H - HZ) * 1.9 / (z + CZ), gx = (x, z) => W / 2 + x * sc(z);
    // sky + stands
    const sky = m.night ? ['#070820', '#0c0e2e', '#121540'] : ['#4aa3df', '#6bb8e8', '#8fcbee'];
    const sh = HZ - top;
    sky.forEach((c, i) => rect(0, top + Math.floor(sh * i / 6), W, Math.ceil(sh / 6) + 1, c));
    rect(0, top + Math.floor(sh / 2), W, Math.ceil(sh / 2), m.night ? '#0e1030' : '#262a52');
    for (let r = 0; r < 4; r++) for (let x = 0; x < W; x += 3) {
      const hsh = (x * 2654435761 + r * 131) >>> 0; if (hsh % 5 === 0) continue;
      rect(x, top + Math.floor(sh / 2) + 2 + r * 3, 2, 2, CROWD[hsh % CROWD.length]);
    }
    rect(0, HZ - 3, W, 3, m.me.c1);
    // field in perspective
    for (let z = -4; z < 140; z += 5) {
      const y0 = gy(z + 5), y1 = gy(z);
      rect(0, Math.floor(y0), W, Math.ceil(y1 - y0) + 1, Math.floor((z + 100) / 5) % 2 ? GREEN[0] : GREEN[1]);
      if (y1 < H) rect(0, Math.round(y1), W, 1, 'rgba(255,255,255,0.4)');
    }
    for (const sx2 of [-26.6, 26.6]) line(gx(sx2, 0), gy(0), gx(sx2, 120), gy(120), 'rgba(255,255,255,0.7)');
    // posts
    const D = k.dist, base = gy(D), s = sc(D), hw = 3.08 * s;
    rect(W / 2 + 2, base, Math.max(3, s * 1.2), 2, 'rgba(0,0,0,0.25)');
    rect(W / 2 - 1, base - 3.33 * s, 2, 3.33 * s, '#ffd23f');
    rect(W / 2 - hw, base - 3.33 * s, hw * 2 + 2, 2, '#ffd23f');
    rect(W / 2 - hw, base - 10 * s, 2, 6.67 * s, '#ffd23f'); rect(W / 2 + hw, base - 10 * s, 2, 6.67 * s, '#ffd23f');
    // wind + info
    const L = 6 + G.SAFE.l, R = W - 6 - G.SAFE.r;
    panel(L - 2, top + 3, 98, 16);
    big(`WIND ${Math.abs(m.wind)}`, L + 2, top + 7, '#fff', { shadow: false });
    const ax = L + 70, ay = top + 10, dir = Math.sign(m.wind);
    if (dir) { line(ax - 8, ay, ax + 8, ay, '#ffd23f'); line(ax + 8 * dir, ay, ax + 5 * dir, ay - 3, '#ffd23f'); line(ax + 8 * dir, ay, ax + 5 * dir, ay + 3, '#ffd23f'); }
    else text('CALM', ax - 6, ay - 2, '#ffd23f');
    panel(R - 128, top + 3, 130, 16);
    big(`${k.kind === 'pat' ? 'PAT' : 'FG'} ${D} YDS`, R - 124, top + 7, '#fff', { shadow: false });
    text(`MAX ~${Math.round(k.maxRange)}`, R - 4, top + 8, '#9aa3cf', 1, 'right');
    // kicker + ball
    const kx = W / 2, ky = H - 20 - G.SAFE.b;
    drawSprite(playerSprite(m.me.c1, m.me.c2, k.stage === 'flight' ? 1 : 0, 1, 0), kx - 20, ky - 14);
    if (k.stage !== 'flight') {
      const a = (k.stage === 'aim' ? k.ang : k.lockAng) * Math.PI / 180;
      for (let i = 6; i < 70; i += 3) rect(kx + Math.sin(a) * i - 1, ky - Math.cos(a) * i - 1, 3, 3, i > 60 ? '#ff9f1c' : '#ffec27');
      ballSprite(kx, ky - 1, 2);
      // power meter
      const mx = R - 16, my = top + 34, mh = H - my - 30 - G.SAFE.b;
      rect(mx - 1, my - 1, 12, mh + 2, '#0b0d1c'); rect(mx, my, 10, mh, '#1b2045');
      const need = Math.min(1, D / k.maxRange);
      rect(mx - 4, my + mh - need * mh, 18, 2, '#ff4d5e');
      if (k.stage === 'power') rect(mx + 1, my + mh - k.power * mh, 8, k.power * mh, k.power > 0.92 ? '#ff9f1c' : '#3ccf6a');
      big(k.stage === 'aim' ? 'TAP TO AIM' : 'TAP FOR POWER', W / 2, ky - 92 < base + 6 ? base + 8 : ky - 92, '#fff', { align: 'center' });
    } else {
      const u = Math.min(1.2, k.u);
      const z = Math.min(k.range, D * 1.15) * u, lat = k.lateral * (z / D);
      const peak = 12 * Math.min(1, k.range / D);
      const fh = Math.max(0, 4 * peak * (u * 0.9) * (1 - u * 0.9));
      const bxp = gx(lat, z), byp = gy(z) - fh * sc(z);
      rect(gx(lat, z) - 1, gy(z), 3, 1, 'rgba(0,0,0,0.4)');
      const bs = Math.max(1, Math.round(sc(z) / 3));
      rect(bxp - bs, byp - bs, bs * 2 + 1, bs * 2, '#8b4a1c');
      if (k.u > 1) this.banner(k.good ? "IT'S GOOD!" : k.why);
    }
  }
}
// small direction chevron (">" pointing along ux,uy)
function chevron(x, y, ux, uy, col) {
  const nx = -uy, ny = ux;
  for (let i = 0; i <= 2; i++) {
    px(x - ux * i + nx * i, y - uy * i + ny * i, col);
    px(x - ux * i - nx * i, y - uy * i - ny * i, col);
  }
}
// filled arrowhead with a dark outline, tip at (x, y) pointing along (ux, uy)
function arrowHead(x, y, ux, uy, col) {
  const nx = -uy, ny = ux, Lh = 6, Hw = 3.5;
  for (const [c, grow] of [['#0b0d1c', 1], [col, 0]]) {
    for (let i = -grow; i <= Lh + grow; i++) {
      const w = (i / Lh) * Hw + grow;
      for (let j = -w; j <= w; j += 0.5) rect(Math.round(x - ux * i + nx * j), Math.round(y - uy * i + ny * j), 1, 1, c);
    }
  }
}
