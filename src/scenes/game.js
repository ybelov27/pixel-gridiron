// On-field scene: renders the match, maps pointer/keyboard gestures to play controls.
import * as G from '../gfx.js';
import { rect, frame, text, line, px, panel, playerSprite, drawSprite, starIcon, textWidth, big, bigWidth, ballSprite, shadeColor } from '../gfx.js';
import { UI } from '../ui.js';
import { sfx, playSong } from '../audio.js';
import { songById, songEvents } from '../music.js';
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
    if (m.phase === 'kick' && m.kick) {
      // side-on kick: frame the kicker, then follow the ball to the posts
      const k = m.kick, spot = 120 - k.dist;
      target = k.stage === 'flight' ? Math.min(124, spot + Math.min(k.range, k.dist * 1.15) * Math.min(1, k.u) + 4) : Math.max(spot + this.half * 0.75, Math.min(108, (spot + 120) / 2));
    }
    else if (m.phase === 'opp') target = 10 + (100 - m.oppMarker());
    else if (p && (m.phase === 'live' || m.phase === 'msg')) {
      if (p.ball.state === 'air') target = p.ball.x + (p.ball.x1 - p.ball.x) * 0.4 + 4;   // look toward where it will land
      else if (p.ball.state === 'kick') target = p.ball.x + 6;
      else if (p.mode === 'intret' && p.returner) target = p.returner.x - 10;
      else if (p.carrier) target = p.carrier.x + 9 + p.carrier.vx * 0.5;                      // lead the runner
      else if (p.mode === 'return') target = p.KR.x + 12;
      else if (this.g && this.g.kind === 'aim') target = p.QB.x + 24;
      else target = p.QB.x + 20;
    } else if (p && m.phase === 'presnap') target = p.los + 16;
    else if (m.phase === 'msg') target = 10 + m.ballYard + 10;
    this.camV = (this.camV || 0) + ((target - this.camX) * 9 - (this.camV || 0) * 5.5) * dt; // critically-damped follow
    this.camX += this.camV * dt;
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
    // a new formation jogs up to the line instead of popping in
    if (p !== this.lastPlay) {
      const prev = this.lastPlay;
      this.lastPlay = p; this.formT = p && !p.started && p.mode !== 'return' ? 0.7 : 0;
      this.celeb = null;
      // same roster order play to play: start each player where he finished the previous snap (no popping in)
      const same = prev && p && prev.ents && p.ents && prev.ents.length === p.ents.length && !prev.mode && !p.mode;
      if (p && p.ents) p.ents.forEach((e, i) => { if (same) { const q = prev.ents[i]; e.fromX = q.x; e.fromY = q.y; } else { e.fromX = undefined; } });
    }
    if (this.formT > 0) this.formT -= dt;
    // touchdown celebration for whoever scored
    if (p && p.result && p.result.kind === 'td' && !this.celeb) {
      const s = p.carrier || p.KR;
      if (s && s.side === 'off') {
        const type = s.p.celeb || 'SPIKE';
        this.celeb = { e: s, type, t: 0 };
        this.floats.push({ x: s.x, y: s.y - 2, s: `${type}!`, c: '#ffd23f', life: 1.8 });
      }
    }
    if (this.celeb) {
      this.celeb.t += dt;
      if (this.celeb.type === 'FIREWORKS' && Math.floor(this.celeb.t / 0.35) !== Math.floor((this.celeb.t - dt) / 0.35)) this.burst(this.celeb.e);
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
    if (e === 'td') { sfx.crowd(true); playSong(songEvents(songById(app.career && app.career.music && app.career.music.equipped))); this.flash = 0.5; this.hype = 3; this.confetti(); return; }
    if (e === 'tackle') { this.shake = 0.18; this.dust(); if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate(12); } catch (_) {} }
    if (e === 'int') this.shake = 0.3;
    if (e === 'miss') this.dust(true);
    if (map[e]) sfx[map[e]]();
  }
  confetti() {
    const cols = [this.m.me.c1, this.m.me.c2, '#ffd23f', '#fff'];
    for (let i = 0; i < 120; i++) this.parts.push({ sx: true, x: Math.random() * G.W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 50, g: 25, c: cols[i % 4], life: 3 + Math.random() });
  }
  burst(e) {
    const cols = [this.m.me.c1, this.m.me.c2, '#ffd23f', '#ff4d5e', '#29adff'];
    const bx = (Math.random() - 0.5) * 20, by = -24 - Math.random() * 10;
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; this.parts.push({ wx: e.x, wy: e.y, x: bx, y: by, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, g: 20, c: cols[i % cols.length], life: 0.7 }); }
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
        if (Math.hypot(dx, dy) > 9) { this.swipe(dx, dy); g.x0 = e.x; g.y0 = e.y; }
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
    // diagonal swipes count as jukes; only a clearly forward / backward swipe dives or stutters
    if (Math.abs(dy) * 1.5 >= Math.abs(dx)) p.juke(dy < 0 ? -1 : 1);
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
    if (m.phase === 'kick') { this.drawStands(); this.drawField(); this.drawKickSide(); this.drawHUD(); this.drawParts(); return; }
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
    // crowd rows anchored to the world so they scroll with the field (column col sits at screen x 3*col - off)
    const off = Math.floor(this.camX * SX);
    const fan = (col, row, x, still) => {
      const hsh = (col * 2654435761 + row * 97) >>> 0;
      if (hsh % 7 === 0) return;
      const fidget = hsh % 23 === 0;
      if (still !== null && still === fidget) return; // layer: only the still fans; per frame: only the fidgeters
      const bob = this.hype > 0 ? Math.round(Math.max(0, Math.sin(this.t * 18 + col * 0.7)) * 2) : (fidget ? Math.round(Math.sin(this.t * 4 + col)) : 0);
      const y = y0 + 1 + row * 3 - bob;
      rect(x, y, 2, 2, CROWD[hsh % CROWD.length]);
      if (m.night && row === 0 && hsh % 11 === 0) px(x, y - 1, '#fff');
    };
    const cA = Math.floor(off / 3) - 1, cB = Math.ceil((off + W) / 3) + 1;
    if (this.hype > 0) { for (let row = 0; row < 3; row++) for (let col = cA; col <= cB; col++) fan(col, row, 3 * col - off, null); }
    else {
      // still fans never change: draw them once into a strip covering every camera position
      const c0 = -Math.ceil(W / 3) - 4, n = Math.ceil((140 * SX + 2 * W) / 3), key = [W, y0, m.night].join();
      if (!this._crowd || this._crowdKey !== key) {
        const c = this._crowd = document.createElement('canvas'); c.width = n * 3; c.height = y0 + 12; this._crowdKey = key;
        G.drawTo(c, () => { for (let row = 0; row < 3; row++) for (let i = 0; i < n; i++) fan(c0 + i, row, 3 * i, true); });
      }
      G.ctx.drawImage(this._crowd, 3 * c0 - off, 0);
      for (let row = 0; row < 3; row++) for (let col = cA; col <= cB; col++) fan(col, row, 3 * col - off, false);
    }
    // ad boards in team colours
    rect(0, ft - 3, W, 3, m.me.c1);
    for (let x = -(off % 48); x < W; x += 48) { rect(x, ft - 3, 24, 3, m.opp.c1); }
    rect(0, ft - 1, W, 1, '#0b0d1c');
    if (m.night) for (let x = 20; x < W; x += 90) { rect(x, y0, 8, 2, '#fffbe0'); rect(x - 2, y0 + 2, 12, 1, 'rgba(255,251,224,0.4)'); }
  }
  // the turf, end zones, lines and numbers never change during a game: draw them once into a
  // full-length layer and copy the visible slice each frame
  fieldLayer() {
    const m = this.m, key = [G.W, G.H, this.FT, this.SY, m.weather, m.me.id, m.opp.id, this.home().id].join();
    if (this._layer && this._layerKey === key) return this._layer;
    const c = this._layer || document.createElement('canvas');
    c.width = 120 * SX + 2; c.height = G.H;
    const save = [this.camX, this.shx, this.shy];
    this.camX = G.W / 2 / SX; this.shx = 0; this.shy = 0; // world yard 0 lands on layer x 0
    G.drawTo(c, () => this.drawFieldStatic(0, 120));
    [this.camX, this.shx, this.shy] = save;
    this._layer = c; this._layerKey = key;
    return c;
  }
  drawFieldStatic(x0, x1) {
    const m = this.m, W = 120 * SX + 2, FT = this.FT, SY = this.SY, fb = this.fieldB;
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
      // team logo badges at both ends of the end zone, name in between
      const cx = Math.round((s0 + s1) / 2);
      for (const by of [FT + 5, fb - 31]) {
        rect(cx - 19, by - 1, 38, 28, '#0b0d1c'); rect(cx - 18, by, 36, 26, t.c2 === '#111111' ? '#444' : t.c2); rect(cx - 16, by + 2, 32, 22, shadeColor(t.c1, 0.45));
        G.helmet(cx - 16, by + 1, t.c1, t.c2, 2, -rot);
      }
      const ctx = G.ctx; ctx.save(); ctx.translate(cx, Math.round((FT + fb) / 2)); ctx.rotate(rot * Math.PI / 2);
      const room = FW * SY - 76;
      const sc = bigWidth(t.name, 2) <= room ? 2 : 1;
      big(t.name, 0, -Math.round(3.5 * sc), t.c2 === '#111111' ? '#fff' : t.c2, { align: 'center', scale: sc });
      ctx.restore();
    }
    // midfield badge
    const mx = this.sx(60);
    if (mx > -40 && mx < W + 40) {
      const hm = this.home(), ctx2 = G.ctx, my = Math.round((FT + fb) / 2);
      ctx2.globalAlpha = 0.4; G.helmet(mx - 23, my - 26, hm.c1, hm.c2, 3, 1); ctx2.globalAlpha = 1;
      big(hm.abbr, mx + 1, my + 13, 'rgba(255,255,255,0.3)', { align: 'center', outline: null, shadow: false });
    }
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
  }
  drawField() {
    const m = this.m, W = G.W, FT = this.FT, SY = this.SY, fb = this.fieldB;
    const snow = m.weather === 'snow';
    G.ctx.drawImage(this.fieldLayer(), this.sx(0), 0);
    rect(0, FT - 1, W, 1, '#fff'); rect(0, fb, W, 1, '#fff');
    // sideline below the field
    rect(0, fb + 1, W, SIDE_H, snow ? '#7d9c86' : '#256f30');
    // team benches: little players standing along the sideline between the 30s (ours left of midfield, theirs right)
    for (let yd = 30; yd <= 90; yd += 1.25) {
      if (yd > 57 && yd < 63) continue;
      const bx = this.sx(yd); if (bx < -4 || bx > W + 4) continue;
      const t = yd < 60 ? m.me : m.opp, h = ((yd * 8) * 2654435761) >>> 0;
      const bob = this.hype > 0 && t === m.me ? Math.round(Math.max(0, Math.sin(this.t * 14 + yd))) * 2 : 0;
      rect(bx, fb + 2 - bob, 2, 1, t.c2 === '#111111' ? '#444' : t.c2);   // helmet stripe / cap
      rect(bx, fb + 3 - bob, 2, 3, h % 5 === 0 ? '#e9e9e9' : t.c1);     // jersey (some in warmups)
    }
    // cheerleaders on the far sideline near both end zones: sway between plays, jump on big plays
    const hm = this.home();
    for (const [a0, a1] of [[13, 27], [93, 107]]) for (let yd = a0, i = 0; yd <= a1; yd += 2.3, i++) {
      const cx2 = this.sx(yd); if (cx2 < -6 || cx2 > W + 6) continue;
      const hype = this.hype > 0;
      const fr = hype ? Math.floor(this.t * 6 + i) % 2 : Math.floor(this.t * 1.5 + i * 0.7) % 2;
      const jump = hype ? Math.round(Math.abs(Math.sin(this.t * 9 + i))) * 3 : 0;
      const img = G.cheerSprite(hm.c1, hm.c2 === '#111111' ? '#e0e0e0' : hm.c2, fr, i, i * 3);
      drawSprite(img, cx2 - 4, FT + 1 - img.height - jump);
    }
    // end-zone pylons on all four goal-line / end-line corners
    for (const px2 of [0, 10, 110, 120]) for (const py2 of [0, FW]) {
      const qx = this.sx(px2), qy = this.sy(py2);
      if (qx < -4 || qx > W + 4) continue;
      rect(qx - 1, qy - 4, 3, 5, '#0b0d1c'); rect(qx, qy - 3, 1, 3, '#ff7a1a');
    }
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
        // chain crew on the near sideline: two poles and the 10-yard chain between them
        const fb2 = this.fieldB, c0 = this.sx(10 + m.fd - 10);
        rect(Math.min(c0, f), fb2 + 4, Math.abs(f - c0), 1, '#c9c9c9');
        for (const cx of [c0, f]) { rect(cx - 1, fb2 - 4, 3, 9, '#0b0d1c'); rect(cx, fb2 - 3, 1, 7, '#ff9f1c'); rect(cx - 1, fb2 - 5, 3, 2, '#ff9f1c'); }
      }
    }
  }
  home() { return this.m.userHome ? this.m.me : this.m.opp; }
  drawPlay(p) {
    const m = this.m;
    const jog = !p.started && this.formT > 0 ? Math.pow(this.formT / 0.7, 2) : 0;
    // routes before the snap: dotted path, chevrons showing direction, arrowhead (or stop bar) at the end
    if (!p.started && p.receivers && jog < 0.05) {
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
    const td = p.result && p.result.kind === 'td', blur = app.career?.settings.blur !== false;
    for (const e of ents) {
      const off = e.side === 'off';
      const T = off ? m.me : m.opp;
      let wx = e.x + (off ? -7 : 7) * jog + (e.y - FW / 2) * jog * 0.15, wy = e.y - (e.y - FW / 2) * jog * 0.25;
      if (jog > 0 && e.fromX !== undefined) { wx = e.x + (e.fromX - e.x) * jog; wy = e.y + (e.fromY - e.y) * jog; }
      const x = this.sx(wx);
      let y = this.sy(wy);
      if (x < -16 || x > G.W + 16) continue;
      const pants = off ? '#e9e9e9' : shadeColor(T.c2 === '#111111' ? '#555555' : T.c2, 0.75);
      const face = off ? 1 : -1;
      const down = (e.down && p.result) || (e.stun > 0.22 && !e.held);
      const rising = !down && e.stun > 0.05 && !e.held;
      const sp = Math.hypot(e.vx, e.vy);
      // pick a pose
      let fr = down ? 5 : sp > 0.6 || jog > 0.03 ? [1, 2, 3, 2][Math.floor((e.anim + this.t * 6) * 1.4) % 4] : 0;
      let lift = 0;
      if (!down) {
        if (e === p.QB && p.mode !== 'return' && !p.carrier && ((!p.thrown && this.g && this.g.kind === 'aim') || (p.thrown && p.t - p.throwT < 0.22))) fr = 4;
        if (e.toBall && inAir && left < 0.45) fr = 6;                       // reaching for the ball
        if (e.diveT > 0) { fr = 7; lift = 4; }                               // diving forward
        if (e.lunge && p.result) { fr = 7; lift = 2; }                       // tackler lunging
        if (td && off && (e === p.carrier || Math.abs(e.x - (p.carrier || e).x) < 12)) { fr = 6; lift = Math.round(Math.abs(Math.sin(this.t * 9 + e.y)) * 5); }
        if (!p.started && off && fr === 0) lift = Math.floor(this.t * 2 + e.y) % 2; // pre-snap bounce
        if (rising) { fr = 7; lift = 1; }                                     // getting back up
      }
      // shadow shrinks as the player leaves the ground
      rect(x - 3 + Math.min(2, lift >> 1), y - 1, 7 - Math.min(4, lift), 2, 'rgba(0,0,0,0.3)');
      // after-images: a juke always leaves two; with motion blur on, a ball carrier at full tilt leaves a faint smear
      if ((e === p.carrier || e === p.returner) && !down && e.trail.length > 44) {
        const juke = e.jukeT > 0, a = juke ? 0.28 : blur ? clamp((sp - 6.2) / 3.5, 0, 1) * 0.3 : 0;
        if (a > 0.02) {
          const n = e.trail.length, ctx = G.ctx, gi = playerSprite(T.c1, T.c2, fr, face, e.p.skin || 0, pants);
          (juke ? [10, 20] : [6, 12]).forEach((back, i) => {
            ctx.globalAlpha = juke ? a : a / (i + 1);
            drawSprite(gi, this.sx(e.trail[n - back - 2]) - 4, this.sy(e.trail[n - back - 1]) - gi.height + 1 - lift);
          });
          ctx.globalAlpha = 1;
        }
      }
      if (this.celeb && this.celeb.e === e && p.result) { this.drawCeleb(e, x, y, T, pants, face); continue; }
      const img = playerSprite(T.c1, T.c2, fr, face, e.p.skin || 0, pants);
      y -= lift;
      if (fr === 5 || fr === 7) drawSprite(img, x - 6, y - 6); else drawSprite(img, x - 4, y - img.height + 1);
      const headY = fr === 6 ? y - 13 : y - 11;
      if (off && e.star && fr !== 5 && fr !== 7) starIcon(x - 2, headY - 6, '#ffd23f');
      // rating badge over skill players and defenders
      if (!down && fr !== 7 && !['OL', 'DL', 'BLK'].includes(e.role) && m.phase === 'presnap') {
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
      if (blur && b.state !== 'loose' && this.ballTrail.length >= 8) { // ghost balls smear a fast pass or kick
        const ctx = G.ctx;
        for (const [i, a] of [[3, 0.14], [5, 0.28]]) { const [tx, ty, tz] = this.ballTrail[i]; ctx.globalAlpha = a; ballSprite(this.sx(tx), this.sy(ty, tz) - 2, spin); }
        ctx.globalAlpha = 1;
      }
      const sh = Math.max(1, 4 - Math.round(b.z / 4));
      rect(this.sx(b.x) - sh, this.sy(b.y), sh * 2, 1, 'rgba(0,0,0,0.45)');
      ballSprite(bx, by, spin);
      if (b.state === 'air') { const tx = this.sx(b.x1), ty = this.sy(b.y1), rr = 3 + (1 - Math.min(1, left)) * 2; for (let a = 0; a < 14; a++) px(tx + Math.cos(a / 14 * 6.283 + this.t * 3) * rr * 1.3, ty + Math.sin(a / 14 * 6.283 + this.t * 3) * rr * 0.75, 'rgba(255,236,39,0.85)'); }
    } else {
      this.ballTrail.length = 0;
      if (this.celeb && p.result) { /* the celebration draws the ball */ }
      else if (b.state === 'carried' && p.carrier && !(p.carrier.down && p.result)) ballSprite(this.sx(p.carrier.x) + 3, this.sy(p.carrier.y) - 6, 0);
      else if (b.state === 'held' && p.QB && p.mode !== 'return') {
        // snap: the ball travels from the center to the QB
        const u = p.started ? Math.min(1, p.t / 0.22) : 0, ctr = p.OL ? p.OL[2] : p.QB;
        const qx = this.sx(p.QB.x) + 3, qy = this.sy(p.QB.y) - (this.g ? 12 : 8);
        const cx2 = this.sx(ctr.x) + 2, cy2 = this.sy(ctr.y) - 3;
        ballSprite(cx2 + (qx - cx2) * u, cy2 + (qy - cy2) * u - Math.sin(u * Math.PI) * 4, u < 1 ? spin : 0);
      } else if (p.mode === 'intret' && p.returner && !(p.returner.down && p.result)) ballSprite(this.sx(p.returner.x) - 3, this.sy(p.returner.y) - 6, 0);
      else if (b.state === 'carried' && !p.carrier && p.KR) ballSprite(this.sx(p.KR.x) + 3, this.sy(p.KR.y) - 6, 0);
    }
  }
  // each player's own touchdown celebration (sprite poses + ball + effects)
  drawCeleb(e, x, y, T, pants, face) {
    const t = this.celeb.t, type = this.celeb.type, skin = e.p.skin || 0;
    const spr = (fr, f = face) => playerSprite(T.c1, T.c2, fr, f, skin, pants);
    const shadow = (w = 7) => rect(x - (w >> 1), y - 1, w, 2, 'rgba(0,0,0,0.3)');
    const put = (img, dx = 0, lift = 0) => drawSprite(img, x - 4 + dx, y - img.height + 1 - lift);
    const spin = Math.floor(this.t * 14) % 3;
    switch (type) {
      case 'SPIKE': {
        shadow(); put(spr(t < 0.3 ? 6 : 0));
        if (t < 0.3) ballSprite(x + 1, y - 17, 0);
        else { const u = t - 0.3; ballSprite(x + 5 + u * 8, y - 2 - Math.abs(Math.sin(u * 9)) * 12 * Math.exp(-u * 2.2), spin); }
        break;
      }
      case 'DANCE': { shadow(); put(spr([1, 3][Math.floor(t * 8) % 2], Math.floor(t * 4) % 2 ? face : -face), 0, Math.floor(t * 8) % 2); break; }
      case 'BACKFLIP': {
        const cyc = t % 1.2, u = Math.min(1, cyc / 0.8), h = Math.sin(u * Math.PI) * 16;
        shadow(Math.max(3, 7 - Math.round(h / 4)));
        const img = spr(cyc < 0.8 ? 6 : 0), ctx = G.ctx;
        ctx.save(); ctx.translate(x, y - 6 - h); ctx.rotate(-face * u * Math.PI * 2 * (cyc < 0.8 ? 1 : 0));
        ctx.drawImage(G.hi(img), -4, -img.height / 2 - 1, img.width, img.height); ctx.restore();
        break;
      }
      case 'LEAP': { const u = Math.min(1, t / 0.5), h = Math.round(Math.sin(u * Math.PI / 2) * 22); shadow(Math.max(3, 7 - (h >> 2))); put(spr(u < 1 ? 1 : 6), Math.round(u * 6) * face, h + (u >= 1 ? Math.floor(t * 6) % 2 : 0)); break; }
      case 'FLEX': {
        shadow(); put(spr(Math.floor(t * 4) % 2 ? 6 : 0));
        for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.57; px(x + Math.cos(a) * 8, y - 8 + Math.sin(a) * 6, '#ffd23f'); }
        break;
      }
      case 'MOONWALK': { const dx = -Math.min(28, t * 12) * face; shadow(); put(spr([3, 2, 1, 2][Math.floor(t * 8) % 4]), dx); ballSprite(x + dx + 3, y - 6, 0); break; }
      case 'HELICOPTER': { shadow(); put(spr(6, Math.floor(t * 14) % 2 ? 1 : -1)); ballSprite(x + Math.cos(t * 14) * 7, y - 18 + Math.sin(t * 14) * 2, spin); break; }
      default: { shadow(); put(spr(6), 0, Math.floor(t * 3) % 2); } // FIREWORKS: arms up while the sky lights up
    }
    if (e.star) starIcon(x - 2, y - 24, '#ffd23f');
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
  // opponent drive: both teams line up and run each play from the ticker (they attack leftward)
  drawOpp() {
    const m = this.m, s = m.oppState; if (!s) return;
    const per = 0.55, n = s.lines.length;
    const idx = Math.min(n - 1, Math.floor(s.t / per)), u = Math.min(1, s.t / per - idx);
    const from = s.pos[Math.min(idx, s.pos.length - 1)], to = s.pos[Math.min(idx + 1, s.pos.length - 1)];
    const wx = (yd) => 10 + (100 - yd);
    const L = wx(from), gain = wx(to) - L;           // negative = toward our goal
    const line = s.lines[idx] || '';
    const pass = /PASS|INCOMPLETE|INTERCEPT/.test(line), sack = /SACK/.test(line), last = idx === n - 1;
    const cy = FW / 2, ease = (k) => k * k * (3 - 2 * k);
    const play = last ? 0 : ease(Math.max(0, Math.min(1, (u - 0.2) / 0.65)));
    const ents = [];
    const add = (team, x, y, f, moving, isBall) => ents.push({ team, x, y, f, moving, isBall });
    // offense formation (theirs, facing left)
    const offs = [];
    for (let i = -2; i <= 2; i++) offs.push([L + 0.8, cy + i * 1.3, 'OL']);
    offs.push([L + 0.8, cy + 4, 'TE'], [L + 4.5, cy, 'QB'], [L + 6.5, cy + 1.5, 'RB'], [L + 0.8, cy - 16, 'WR'], [L + 0.8, cy + 17, 'WR'], [L + 0.8, cy - 9, 'WR']);
    const carrierI = sack ? 6 : pass ? 8 : 7;
    let ballX = L + 4.5, ballY = cy;
    offs.forEach(([x, y, r], i) => {
      let px2 = x, py2 = y;
      if (i === carrierI) {
        if (sack) { px2 = x + 3 * play; }
        else if (pass) { px2 = x + (gain - 2) * play; py2 = y + (cy - y) * 0.35 * play; }
        else { px2 = x + (gain - 6.5) * play; py2 = y + Math.sin(play * 3) * 1.5; }
        ballX = px2; ballY = py2;
      } else if (r === 'OL') px2 = x - 0.8 * play;
      else if (r === 'WR' || r === 'TE') px2 = x + Math.min(0, gain - 4) * play * 0.6;
      add('o', px2, py2, -1, play > 0 && play < 1, i === carrierI);
    });
    // our defense (facing right) converges on the ball carrier
    const defs = [];
    for (let i = 0; i < 4; i++) defs.push([L - 1, cy + (i - 1.5) * 2.2]);
    for (let i = 0; i < 3; i++) defs.push([L - 5, cy + (i - 1) * 5]);
    defs.push([L - 6, cy - 16], [L - 6, cy + 17], [L - 12, cy - 8], [L - 12, cy + 8]);
    defs.forEach(([x, y], i) => {
      const k = Math.min(0.9, Math.max(0, play - 0.15 - (i % 4) * 0.04) * 1.3);
      add('d', x + (ballX - 0.8 - x) * k, y + (ballY - y) * k * 0.9, 1, play > 0 && play < 1, false);
    });
    // pass in the air during the play
    let fly = null;
    if (pass && !last && play > 0.05 && play < 0.45) { const q = (play - 0.05) / 0.4; fly = { x: L + 4.5 + (ballX - L - 4.5) * q, y: cy + (ballY - cy) * q, z: Math.sin(q * Math.PI) * 6 }; }
    rect(this.sx(L), this.FT, 1, FW * this.SY, '#ff4d5e');
    ents.sort((a, b) => a.y - b.y);
    const opPants = shadeColor(m.opp.c2 === '#111111' ? '#555555' : m.opp.c2, 0.75);
    ents.forEach((e, i) => {
      const T = e.team === 'o' ? m.opp : m.me, x = this.sx(e.x), y = this.sy(e.y);
      if (x < -16 || x > G.W + 16) return;
      const fr = e.moving ? [1, 2, 3, 2][(Math.floor(this.t * 9) + i) % 4] : 0;
      const img = playerSprite(T.c1, T.c2, fr, e.f, i % 4, e.team === 'o' ? opPants : '#e9e9e9');
      rect(x - 3, y - 1, 7, 2, 'rgba(0,0,0,0.3)');
      drawSprite(img, x - 4, y - img.height + 1);
      if (e.isBall && !fly) ballSprite(x - 3, y - 6, 0);
    });
    if (fly) { ballSprite(this.sx(fly.x), this.sy(fly.y, fly.z) - 4, Math.floor(this.t * 14) % 3); }
    else if (!ents.some((e) => e.isBall)) ballSprite(this.sx(ballX), this.sy(ballY) - 4, 0);
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
    if (p && p.mode === 'intret' && m.phase === 'live') {
      big('INTERCEPTED! RUN HIM DOWN...', W / 2, y + 3, '#ff4d5e', { align: 'center', shadow: false });
    } else if (c) {
      let x = 6 + G.SAFE.l;
      if (!c.p.regular) { starIcon(x, y + 3, '#ffd23f'); x += 8; }
      const nm = `${c.p.pos} ${displayName(c.p)}`;
      big(nm, x, y + 3, '#fff', { shadow: false });
      const gy = Math.round(c.x - p.los);
      big(`${gy >= 0 ? '+' : ''}${gy} YDS`, W - 6 - G.SAFE.r, y + 3, gy >= 10 ? '#ffd23f' : '#fff', { align: 'right', shadow: false });
    } else text(tip, W / 2, y + 4, '#9aa3cf', 1, 'center');
  }
  banner(s) {
    const W = G.W, cy = Math.round((this.FT + this.fieldB) / 2) - 14;
    const hot = /TOUCHDOWN|INTERCEPT|FUMBLE|SAFETY|FIRST DOWN|SACKED|GOOD!|VICTORY|INJURY/.test(s);
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
    const w = 200, h = 160, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    panel(x, y, w, h);
    big('PAUSED', W / 2, y + 7, '#ffd23f', { align: 'center', scale: 2 });
    UI.button(x + 20, y + 30, w - 40, 20, 'RESUME', () => { this.paused = false; }, { color: '#2fa84f' });
    UI.button(x + 20, y + 54, w - 40, 20, 'SIM REST OF GAME', () => { this.paused = false; if (m.phase !== 'final') m.simRest(); }, { color: '#4b5378' });
    const st = app.career.settings, hw = (w - 44) / 2;
    UI.button(x + 20, y + 78, hw, 20, `SOUND ${st.sound ? 'ON' : 'OFF'}`, () => { st.sound = !st.sound; }, { color: '#2f6fe0' });
    UI.button(x + 24 + hw, y + 78, hw, 20, `BLUR ${st.blur !== false ? 'ON' : 'OFF'}`, () => { st.blur = st.blur === false; }, { color: '#2f6fe0' });
    if (this.onExit) UI.button(x + 20, y + 102, w - 40, 20, 'SAVE & EXIT', () => { this.paused = false; this.onExit(); }, { color: '#7e2553' });
    text('KEYS: SPACE SNAP  H HANDOFF  WASD / ARROWS', W / 2, y + 132, '#9aa3cf', 1, 'center');
    text('B BULLET  T TIMEOUT  ESC PAUSE', W / 2, y + 141, '#9aa3cf', 1, 'center');
  }
  // side-on view for field goals and extra points: aim + power taps, played out on the normal field
  drawKickSide() {
    const m = this.m, k = m.kick, W = G.W, H = G.H;
    const spotX = 120 - k.dist, cy = FW / 2, face = 1;
    const pants = '#e9e9e9', opPants = shadeColor(m.opp.c2 === '#111111' ? '#555555' : m.opp.c2, 0.75);
    // line of scrimmage at the 2 (snap 7 yards in front of the hold spot)
    const los = spotX + 7;
    const people = [];
    for (let i = -3; i <= 3; i++) {
      people.push([los - 0.7, cy + i * 1.2, m.me.c1, m.me.c2, 1, pants, 0]);
      people.push([los + 0.8, cy + i * 1.25, m.opp.c1, m.opp.c2, -1, opPants, k.stage === 'flight' ? [1, 2, 3, 2][Math.floor(this.t * 9 + i) % 4] : 0]);
    }
    people.push([spotX + 0.6, cy + 0.4, m.me.c1, m.me.c2, 1, pants, 5]); // holder down on a knee (lying pose reads as kneeling)
    people.push([spotX - 1.2 + (k.stage === 'flight' ? Math.min(1, k.u * 4) * 1.2 : 0), cy - 0.6, m.me.c1, m.me.c2, 1, pants, k.stage === 'flight' && k.u < 0.25 ? 1 : 0]);
    people.sort((a, b) => a[1] - b[1]);
    for (const [x, y, c1, c2, f, pt, fr] of people) {
      const sx = this.sx(x), sy = this.sy(y), img = playerSprite(c1, c2, fr, f, 0, pt);
      rect(sx - 4, sy - 1, 9, 3, 'rgba(0,0,0,0.28)');
      if (fr === 5) drawSprite(img, sx - 6, sy - 6); else drawSprite(img, sx - 4, sy - img.height + 1);
    }
    const bx0 = this.sx(spotX), by0 = this.sy(cy) - 3;
    if (k.stage !== 'flight') {
      // once power is set, the aim line shows where the ball would cross the goal line (wind included)
      const latAt = k.latFor(k.ang);
      const W = G.W;
      ballSprite(bx0, by0, 2);
      if (k.stage === 'aim') {
        let gx = this.sx(120);
        const gy = this.sy(cy + latAt), offscreen = gx > W - 14;
        if (offscreen) gx = W - 14;
        line(bx0, by0, gx, gy - 20, 'rgba(255,236,39,0.9)', 2);
        if (offscreen) { // the posts are further downfield: show the aim against them at the edge
          const lo2 = this.sy(cy - 3.08), hi2 = this.sy(cy + 3.08);
          rect(gx - 1, lo2 - 22, 3, hi2 - lo2 + 4, '#0b0d1c'); rect(gx, lo2 - 21, 1, hi2 - lo2 + 2, '#ffd23f');
          text('POSTS', gx - 2, lo2 - 30, '#ffd23f', 1, 'right'); text('>', gx + 5, gy - 22, '#fff');
        }
        const lo = this.sy(cy - 3.08), hi = this.sy(cy + 3.08);
        rect(gx - 5, lo - 20, 2, hi - lo, 'rgba(255,255,255,0.25)');
        rect(gx - 7, gy - 21, 5, 3, '#0b0d1c'); rect(gx - 6, gy - 20, 3, 1, Math.abs(latAt) <= 3.08 ? '#3ccf6a' : '#ff4d5e');
      }
      const bw = 120, bx = Math.floor((W - bw) / 2), by = this.fieldB - 16;
      panel(bx - 4, by - 14, bw + 8, 26);
      text(k.stage === 'power' ? 'TAP WHEN THE METER IS FULL' : 'TAP WHEN THE ARROWS MEET', W / 2, by - 10, '#fff', 1, 'center');
      rect(bx, by - 2, bw, 8, '#0b0d1c'); rect(bx + 1, by - 1, bw - 2, 6, '#1b2045');
      if (k.stage === 'power') {
        // power meter: green zone at the top, red tick = the leg needed to reach the posts
        rect(bx + 1 + Math.round((bw - 2) * 0.92), by - 1, Math.round((bw - 2) * 0.08), 6, '#24402c');
        const pw = k.power;
        rect(bx + 1, by - 1, Math.round((bw - 2) * pw), 6, pw >= 0.92 ? '#3ccf6a' : pw * k.maxRange >= k.dist ? '#ffd23f' : '#ff9f1c');
        rect(bx + Math.round(Math.min(1, k.dist / k.maxRange) * bw), by - 4, 1, 12, '#ff4d5e');
      } else {
        // direction: two arrows slide in from the ends; tap when they meet in the middle
        const mid = bx + bw / 2, gap = Math.round(k.ang / k.A * (bw / 2 - 6));
        const ok = Math.abs(latAt) <= 3.08;
        rect(mid, by - 4, 1, 12, ok ? '#3ccf6a' : '#ffffff');
        arrowHead(Math.round(mid - gap) - 1, by + 2, 1, 0, '#ffd23f');
        arrowHead(Math.round(mid + gap) + 1, by + 2, -1, 0, '#ffd23f');
      }
    } else {
      const u = Math.min(1.25, k.u), reach = Math.min(k.range, k.dist * 1.25);
      const x = spotX + reach * u, lat = k.lateral * (reach * u / k.dist);
      const peak = 7 * Math.min(1, k.range / k.dist);
      const z = Math.max(0, 0.5 + 4 * peak * u * (1 - u * 0.8));
      const sx = this.sx(x), syg = this.sy(cy + lat);
      rect(sx - 2, syg, 4, 1, 'rgba(0,0,0,0.4)');
      ballSprite(sx, this.sy(cy + lat, z) - 3, Math.floor(this.t * 14) % 3);
      if (k.u > 1) this.banner(k.good ? "IT'S GOOD!" : k.why);
    }
    // wind
    text(`WIND ${Math.abs(m.wind)} MPH ${m.wind < 0 ? '<' : m.wind > 0 ? '>' : ''}`, 6 + G.SAFE.l, this.FT + 4, '#fff');
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
