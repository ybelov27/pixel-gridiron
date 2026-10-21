// On-field scene: renders the match, maps pointer/keyboard gestures to play controls.
import { W, H, ctx, rect, frame, text, line, px, panel, playerSprite, drawSprite, starIcon, textWidth } from '../gfx.js';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { app } from '../app.js';
import { FW, flightOf } from '../play.js';
import { eff } from '../players.js';
import { yardText } from '../match.js';
import { clamp } from '../rng.js';

const SX = 6, SY = 3, FT = 36; // px per yard (x), px per yard (y), field top
const GREEN = ['#2f8f3a', '#34993f'];

export class GameScene {
  constructor(match, onDone) {
    this.m = match; this.onDone = onDone; this.camX = 10 + match.ballYard + 18;
    this.g = null; this.paused = false; this.noAutosave = true; this.t = 0; this.flash = 0;
  }
  sx(x) { return (x - this.camX) * SX + W / 2; }
  sy(y, z = 0) { return FT + y * SY - z * 3; }
  update(dt) {
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
      if (p.ball.state === 'air') target = p.ball.x + 4;
      else if (p.carrier) target = p.carrier.x + 8;
      else if (this.g && this.g.kind === 'aim') target = p.QB.x + 24;
      else target = p.QB.x + 20;
    } else if (p && m.phase === 'presnap') target = p.los + 18;
    else if (m.phase === 'msg') target = 10 + m.ballYard + 10;
    this.camX += (target - this.camX) * Math.min(1, dt * 4);
    this.camX = clamp(this.camX, 32, 88);
    if (this.flash > 0) this.flash -= dt;
  }
  playSfx(e) {
    const map = { snap: 'snap', throw: 'throw', catch: 'catch', tackle: 'tackle', juke: 'juke', miss: 'juke', dive: 'juke', whistle: 'whistle',
      kick: 'kick', int: 'bad', drop: 'drop', deflect: 'drop', groan: 'groan', crowd: 'crowd', good: 'good', bad: 'bad', handoff: 'hike' };
    if (e === 'td') { sfx.crowd(true); sfx.good(); this.flash = 0.6; return; }
    if (map[e]) sfx[map[e]]();
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
      if (m.phase === 'msg') { if (m.timer < 1.2) m.skip(); return; }
      if (m.phase === 'opp') { m.skip(); return; }
      if (m.phase === 'kick') { const r = m.kick.tap(); if (r === 'kick') sfx.kick(); else sfx.click(); return; }
      if (m.phase === 'presnap') { m.snap(); sfx.snap(); }
      if (m.phase !== 'live') return;
      const p = m.play;
      if (p.canHandoff()) {
        const rx = this.sx(p.RB.x), ry = this.sy(p.RB.y) - 5;
        if (Math.hypot(e.x - rx, e.y - ry) < 18) { p.handoff(); sfx.hike(); return; }
      }
      if (p.carrier) { this.g = { kind: 'swipe', id: e.id, x0: e.x, y0: e.y, t: this.t }; return; }
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
      const p = m.play; if (!p || m.phase !== 'live') return;
      const dx = g.x0 - g.x, dy = g.y0 - g.y;
      if (Math.hypot(dx, dy) < 6) return; // a tap, not a throw
      if (dx < -8 && Math.abs(dx) > Math.abs(dy) * 0.8) { p.scramble(); return; }
      if (!p.canThrow()) return;
      const t = p.aimTarget(dx, dy, SX, SY);
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
      return;
    }
    if (k === 't' || k === 'T') { if (m.timeout()) app.toast('TIMEOUT'); return; }
    if (!p || m.phase !== 'live') return;
    if ((k === 'h' || k === 'H') && p.handoff()) { sfx.hike(); return; }
    if (this.g && this.g.kind === 'aim' && (k === 'b' || k === 'B' || k === 'Shift')) { this.g.bullet = !this.g.bullet; return; }
    if (!p.carrier) return;
    if (k === 'w' || k === 'W' || k === 'ArrowUp') p.juke(-1);
    else if (k === 's' || k === 'S' || k === 'ArrowDown') p.juke(1);
    else if (k === 'a' || k === 'A' || k === 'ArrowLeft') p.stutter();
    else if (k === 'd' || k === 'D' || k === 'ArrowRight') p.dive();
  }
  // ---------------- drawing ----------------
  draw() {
    const m = this.m;
    if (m.phase === 'kick') { this.drawKick(); this.drawHUD(); return; }
    this.drawField();
    const p = m.play;
    if (p && m.phase !== 'opp') this.drawPlay(p);
    if (m.phase === 'opp') this.drawOpp();
    this.drawHUD();
    this.drawBottom();
    if (m.phase === 'msg') this.banner(m.msg);
    if (m.phase === 'choice') this.drawChoice();
    if (m.phase === 'final') this.drawFinal();
    if (this.flash > 0 && ((this.flash * 10) | 0) % 2) frame(0, 0, W, H, '#ffcd34');
    if (this.paused) this.drawPause();
  }
  drawField() {
    const m = this.m;
    rect(0, 22, W, FT - 22, '#1d2b53');
    for (let x = 0; x < W; x += 4) px(x + ((x * 7) % 3), 25 + ((x * 13) % 7), ['#ff004d', '#fff1e8', '#ffa300', '#29adff'][(x / 4) % 4 | 0]);
    const bottom = this.sy(FW);
    rect(0, bottom, W, H - bottom, '#1d2b53');
    const x0 = Math.floor(this.camX - 34), x1 = Math.ceil(this.camX + 34);
    for (let yd = Math.max(0, Math.floor(x0 / 5) * 5); yd < Math.min(120, x1); yd += 5) {
      let c = GREEN[(yd / 5) % 2];
      if (yd < 10) c = shade(m.me.c1); else if (yd >= 110) c = shade(m.opp.c1);
      rect(this.sx(yd), FT, 5 * SX + 1, FW * SY, c);
    }
    // endzone lettering
    for (const [ex, t] of [[5, m.me], [115, m.opp]]) {
      const s = this.sx(ex);
      if (s > -20 && s < W + 20) t.abbr.split('').forEach((ch, i) => text(ch, s, FT + 50 + i * 18, '#fff', 3, 'center'));
    }
    // lines
    for (let yd = Math.max(0, x0); yd <= Math.min(120, x1); yd++) {
      const sx = this.sx(yd);
      if (yd % 5 === 0 && yd >= 10 && yd <= 110) rect(sx, FT, 1, FW * SY, yd === 10 || yd === 110 ? '#fff' : 'rgba(255,255,255,0.75)');
      if (yd > 10 && yd < 110) {
        for (const hy of [0.6, 23.6, 29.7, FW - 0.6]) rect(sx, this.sy(hy) - 1, 1, 2, 'rgba(255,255,255,0.6)');
      }
      if (yd % 10 === 0 && yd > 10 && yd < 110) {
        const v = yd - 10, n = Math.min(v, 100 - v);
        text(String(n), sx + 1, this.sy(7), 'rgba(255,255,255,0.85)', 2, 'center');
        text(String(n), sx + 1, this.sy(FW - 7) - 9, 'rgba(255,255,255,0.85)', 2, 'center');
      }
    }
    rect(0, FT - 1, W, 1, '#fff'); rect(0, bottom, W, 1, '#fff');
    // goal posts
    for (const gx of [0, 120]) {
      const s = this.sx(gx), cy = this.sy(FW / 2);
      if (s < -10 || s > W + 10) continue;
      rect(s, cy - 14, 1, 14, '#ffcd34'); rect(s - 1, cy - 14, 3, 1, '#ffcd34');
      rect(s, this.sy(FW / 2 - 3.1) - 22, 1, 10, '#ffcd34'); rect(s, this.sy(FW / 2 + 3.1) - 22, 1, 10, '#ffcd34');
      rect(s, this.sy(FW / 2 - 3.1) - 12, 1, (6.2 * SY), '#ffcd34');
    }
    // scrimmage & first down markers (our possession only)
    if (m.phase !== 'opp' && m.phase !== 'kick') {
      const los = this.sx(10 + m.ballYard);
      rect(los, FT, 1, FW * SY, '#29adff');
      if (!m.conv && m.ballYard + m.toGo < 100) rect(this.sx(10 + m.fd), FT, 1, FW * SY, '#ffec27');
    }
  }
  drawPlay(p) {
    const m = this.m;
    // routes before the snap
    if (!p.started) {
      for (const r of p.receivers) {
        if (!r.route || r.block) continue;
        let px0 = r.x, py0 = r.y, phase = 0;
        const pts = r.route.slice(0, r.run ? 2 : undefined);
        for (const q of pts) { line(this.sx(px0), this.sy(py0), this.sx(q.x), this.sy(q.y), r.run ? '#ffa300' : '#fff1e8', 2, phase); phase++; px0 = q.x; py0 = q.y; }
        const last = pts[pts.length - 1], prev = pts.length > 1 ? pts[pts.length - 2] : { x: r.x, y: r.y };
        if (!r.stopAtEnd) {
          const L = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
          const ex = last.x + (last.x - prev.x) / L * 4, ey = last.y + (last.y - prev.y) / L * 4;
          line(this.sx(last.x), this.sy(last.y), this.sx(ex), this.sy(ey), r.run ? '#ffa300' : '#fff1e8', 2);
          rect(this.sx(ex) - 1, this.sy(ey) - 1, 3, 3, r.run ? '#ffa300' : '#fff1e8');
        } else rect(this.sx(last.x) - 1, this.sy(last.y) - 1, 3, 3, '#ffec27');
      }
    }
    // aim preview
    if (this.g && this.g.kind === 'aim' && p.canThrow()) {
      const dx = this.g.x0 - this.g.x, dy = this.g.y0 - this.g.y;
      if (Math.hypot(dx, dy) >= 6) {
        if (dx < -8 && Math.abs(dx) > Math.abs(dy) * 0.8) {
          text('RUN!', this.sx(p.QB.x), this.sy(p.QB.y) - 24, '#ffa300', 1, 'center');
        } else {
          const t = p.aimTarget(dx, dy, SX, SY);
          const peak = flightOf(t.d, this.g.bullet).peak;
          let lx = this.sx(p.QB.x), ly = this.sy(p.QB.y, 2);
          for (let i = 1; i <= 16; i++) {
            const u = i / 16, x = p.QB.x + (t.x - p.QB.x) * u, y = p.QB.y + (t.y - p.QB.y) * u;
            const z = 2 - 0.7 * u + 4 * peak * u * (1 - u);
            const nx = this.sx(x), ny = this.sy(y, z);
            if (i % 2) line(lx, ly, nx, ny, this.g.bullet ? '#ff004d' : '#fff1e8');
            lx = nx; ly = ny;
          }
          const tx = this.sx(t.x), ty = this.sy(t.y);
          line(tx - 3, ty - 2, tx + 3, ty + 2, '#ffec27'); line(tx - 3, ty + 2, tx + 3, ty - 2, '#ffec27');
          // drag arrow at the finger
          line(this.g.x0, this.g.y0, this.g.x, this.g.y, 'rgba(255,255,255,0.6)', 1);
          const pw = t.d / t.max;
          rect(this.g.x0 - 12, this.g.y0 - 12, 24, 3, '#000'); rect(this.g.x0 - 12, this.g.y0 - 12, 24 * pw, 3, pw > 0.97 ? '#ff004d' : '#38b764');
          text(this.g.bullet ? 'BULLET' : 'LOB', this.g.x0, this.g.y0 - 20, this.g.bullet ? '#ff004d' : '#fff', 1, 'center');
          text(`${Math.round(t.d)}Y`, tx, ty + 4, '#ffec27', 1, 'center');
        }
      }
    }
    // entities, depth-sorted
    const ents = p.ents.slice().sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const off = e.side === 'off';
      const T = off ? m.me : m.opp;
      const x = this.sx(e.x), y = this.sy(e.y);
      if (x < -10 || x > W + 10) continue;
      rect(x - 3, y - 1, 7, 2, 'rgba(0,0,0,0.3)');
      const down = (e.down && p.result) || e.stun > 0.3;
      const fr = down ? 2 : (Math.floor(e.anim) % 2);
      drawSprite(playerSprite(T.c1, T.c2, fr, off ? 1 : -1, e.p.skin || 0, off ? '#e8e8e8' : '#3a3a3a'), x - 3, y - 10);
      if (off && e.star) starIcon(x - 2, y - 17, '#ffcd34');
      if (e === p.carrier) { px(x, y - 19 + (e.star ? -1 : 4), '#fff'); }
    }
    // handoff ring
    if (p.canHandoff()) {
      const x = this.sx(p.RB.x), y = this.sy(p.RB.y) - 5, r = 8 + Math.sin(this.t * 12) * 1.5;
      for (let a = 0; a < 24; a++) px(x + Math.cos(a / 24 * 6.283) * r, y + Math.sin(a / 24 * 6.283) * r * 0.8, '#ffec27');
      text('TAP', x, y - 15, '#ffec27', 1, 'center');
    }
    // ball
    const b = p.ball;
    if (b.state === 'air' || b.state === 'loose') {
      rect(this.sx(b.x) - 1, this.sy(b.y), 3, 1, 'rgba(0,0,0,0.5)');
      rect(this.sx(b.x) - 1, this.sy(b.y, b.z) - 1, 3, 2, '#8b4513'); px(this.sx(b.x), this.sy(b.y, b.z) - 1, '#fff');
      if (b.state === 'air') { const tx = this.sx(b.x1), ty = this.sy(b.y1); frame(tx - 2, ty - 1, 5, 3, 'rgba(255,236,39,0.7)'); }
    }
  }
  drawOpp() {
    const m = this.m, s = m.oppState; if (!s) return;
    const yd = m.oppMarker();
    const bx = this.sx(10 + (100 - yd)), by = this.sy(FW / 2) + 18;
    rect(bx, FT, 1, FW * SY, '#ff004d');
    rect(bx - 2, by - 1, 4, 3, '#8b4513');
    // a cluster of opponent sprites around the ball
    for (let i = 0; i < 6; i++) drawSprite(playerSprite(m.opp.c1, m.opp.c2, (Math.floor(this.t * 6) + i) % 2, -1, i, '#3a3a3a'), bx + 6 + (i % 3) * 7, by - 22 + Math.floor(i / 3) * 26 + (i % 2) * 6);
    for (let i = 0; i < 6; i++) drawSprite(playerSprite(m.me.c1, m.me.c2, (Math.floor(this.t * 6) + i) % 2, 1, i + 1, '#e8e8e8'), bx - 14 - (i % 3) * 7, by - 22 + Math.floor(i / 3) * 26 + (i % 2) * 6);
    const n = s.lines.length, shown = s.shown;
    const h = 16 + Math.min(6, shown) * 8;
    panel(W / 2 - 110, 38, 220, h, 'rgba(26,28,44,0.92)');
    text(`${m.opp.abbr} OFFENSE - DRIVE FROM THEIR ${s.start}`, W / 2, 43, '#ffcd34', 1, 'center');
    const from = Math.max(0, shown - 6);
    for (let i = from; i < shown; i++) text(s.lines[i], W / 2 - 102, 53 + (i - from) * 8, i === n - 1 ? '#ffec27' : '#f4f4f4');
  }
  drawHUD() {
    const m = this.m;
    rect(0, 0, W, 22, '#000');
    const box = (x, t, sc, tos) => {
      rect(x, 2, 58, 18, t.c1); rect(x + 1, 3, 56, 16, shade(t.c1));
      text(t.abbr, x + 4, 5, '#fff'); text(String(sc), x + 54, 4, '#fff', 2, 'right');
      for (let i = 0; i < 3; i++) rect(x + 4 + i * 5, 14, 3, 2, i < tos ? '#ffcd34' : '#333');
    };
    box(2, m.me, m.score.u, m.to.u); box(62, m.opp, m.score.o, m.to.o);
    const q = m.q <= 4 ? `Q${m.q}` : m.q === 5 ? 'OT' : `OT${m.q - 4}`;
    const cl = Math.ceil(m.clock), mm = Math.floor(cl / 60), ss = String(cl % 60).padStart(2, '0');
    text(q, 140, 4, '#ffcd34'); text(`${mm}:${ss}`, 140, 12, m.runoff > 0 && m.phase === 'presnap' ? '#ff004d' : '#fff', 1);
    if (m.phase !== 'opp' && m.phase !== 'final') {
      const dn = m.conv ? '2-PT TRY' : `${['1ST', '2ND', '3RD', '4TH'][m.down - 1] || '4TH'} & ${m.toGoText()}`;
      text(dn, 168, 4, '#fff'); text(`BALL ${yardText(m.ballYard)}`, 168, 12, '#c2c3c7');
    } else if (m.phase === 'opp') { text(`${m.opp.abbr} BALL`, 168, 4, '#ff004d'); text(`AT THEIR ${Math.round(m.oppMarker())}`, 168, 12, '#c2c3c7'); }
    // buttons
    if (m.phase === 'presnap') {
      UI.button(250, 3, 34, 16, `TO ${m.to.u}`, () => { if (m.timeout()) app.toast('TIMEOUT - CLOCK STOPPED'); else app.toast(m.to.u ? 'CLOCK ALREADY STOPPED' : 'NO TIMEOUTS LEFT'); }, { disabled: m.to.u <= 0, color: '#5d275d' });
      const fgd = Math.round(100 - m.ballYard + 17);
      if (!m.conv && fgd <= 62 && m.down < 4) UI.button(287, 3, 40, 16, `FG ${fgd}`, () => m.startKick('fg', fgd), { color: '#257179' });
    }
    UI.button(W - 24, 3, 20, 16, '||', () => { this.paused = true; }, { color: '#333c57' });
    if (m.phase !== 'kick') {
      const lb = m.feed[0];
      if (lb && m.phase !== 'msg') text(lb, W - 28, 24, 'rgba(255,255,255,0.6)', 1, 'right');
    }
  }
  drawBottom() {
    const m = this.m, p = m.play;
    rect(0, H - 14, W, 14, 'rgba(0,0,0,0.75)');
    let tip = '';
    if (m.phase === 'presnap') tip = `${p.play.name}  -  TAP TO SNAP, THEN DRAG BACK TO AIM`;
    else if (m.phase === 'live') {
      if (p.canHandoff()) tip = 'TAP THE RB TO HAND OFF - OR DRAG BACK TO PASS';
      else if (p.carrier) tip = 'SWIPE UP/DOWN JUKE  -  FORWARD DIVE  -  BACK STUTTER';
      else if (p.canThrow()) tip = 'DRAG BACK + RELEASE = THROW  -  2ND FINGER/RIGHT CLICK = BULLET  -  DRAG FWD = RUN';
    } else if (m.phase === 'opp') tip = 'YOUR DEFENSE IS ON THE FIELD - TAP TO FAST FORWARD';
    text(tip, W / 2, H - 10, '#c2c3c7', 1, 'center');
  }
  banner(s) {
    const w = Math.min(W - 16, textWidth(s, 2) + 20);
    const big = textWidth(s, 2) + 20 <= W - 16;
    rect((W - w) / 2, 92, w, 22, 'rgba(0,0,0,0.75)');
    text(s, W / 2, big ? 98 : 101, '#ffec27', big ? 2 : 1, 'center');
  }
  drawChoice() {
    const m = this.m;
    const n = m.options.length;
    panel(W / 2 - 90, 60, 180, 26 + n * 20);
    text(m.choiceTitle, W / 2, 67, '#ffcd34', 1, 'center');
    m.options.forEach((o, i) => UI.button(W / 2 - 75, 78 + i * 20, 150, 16, o.label, () => o.fn(), { disabled: o.disabled }));
  }
  drawFinal() {
    const m = this.m;
    panel(W / 2 - 100, 46, 200, 120);
    const res = m.score.u > m.score.o ? 'VICTORY!' : m.score.u < m.score.o ? 'DEFEAT' : 'TIE GAME';
    text('FINAL' + (m.q >= 5 ? ' / OT' : ''), W / 2, 54, '#c2c3c7', 1, 'center');
    text(res, W / 2, 64, m.score.u > m.score.o ? '#38b764' : '#ff004d', 2, 'center');
    text(`${m.me.abbr} ${m.score.u}  -  ${m.score.o} ${m.opp.abbr}`, W / 2, 84, '#fff', 2, 'center');
    text(`PASS YDS ${m.team.pyds}   RUSH YDS ${m.team.ryds}   OPP YDS ${m.team.oppYds}`, W / 2, 104, '#c2c3c7', 1, 'center');
    UI.button(W / 2 - 60, 140, 120, 18, 'CONTINUE', () => this.onDone(m.result()), { color: '#38b764' });
  }
  drawPause() {
    const m = this.m;
    rect(0, 0, W, H, 'rgba(0,0,0,0.6)');
    panel(W / 2 - 80, 50, 160, 110);
    text('PAUSED', W / 2, 58, '#ffcd34', 2, 'center');
    UI.button(W / 2 - 60, 78, 120, 16, 'RESUME', () => { this.paused = false; });
    UI.button(W / 2 - 60, 98, 120, 16, 'SIM REST OF GAME', () => { this.paused = false; if (m.phase !== 'final') m.simRest(); }, { color: '#a7a7a7', textColor: '#000' });
    UI.button(W / 2 - 60, 118, 120, 16, `SOUND: ${app.career.settings.sound ? 'ON' : 'OFF'}`, () => { app.career.settings.sound = !app.career.settings.sound; }, { color: '#333c57' });
    text('KEYS: SPACE SNAP  H HANDOFF  WASD/ARROWS', W / 2, 140, '#c2c3c7', 1, 'center');
    text('B BULLET  T TIMEOUT  ESC PAUSE', W / 2, 148, '#c2c3c7', 1, 'center');
  }
  // behind-the-kicker view for FG / PAT
  drawKick() {
    const m = this.m, k = m.kick;
    const HZ = 60, F = 520;
    const gy = (z) => HZ + F / (z + 4), gx = (x, z) => W / 2 + x * 260 / (z + 4);
    rect(0, 22, W, HZ - 22, '#1d2b53');
    for (let x = 0; x < W; x += 3) px(x, 30 + ((x * 17) % 20), ['#ff004d', '#fff1e8', '#ffa300', '#29adff', '#7e2553'][(x / 3) % 5 | 0]);
    for (let y = HZ; y < H; y++) rect(0, y, W, 1, ((y - HZ) / 6 | 0) % 2 ? GREEN[0] : GREEN[1]);
    for (let z = 0; z <= k.dist + 10; z += 5) rect(0, gy(z), W, 1, 'rgba(255,255,255,0.35)');
    for (const sxl of [-26.6, 26.6]) line(gx(sxl, 0), gy(0), gx(sxl, 90), gy(90), 'rgba(255,255,255,0.6)');
    // posts
    const D = k.dist, base = gy(D), hw = 3.08 * 260 / (D + 4), sc = 260 / (D + 4);
    rect(W / 2, base - 3.33 * sc, 1, 3.33 * sc, '#ffcd34');
    rect(W / 2 - hw, base - 3.33 * sc, hw * 2 + 1, 1, '#ffcd34');
    rect(W / 2 - hw, base - 10 * sc, 1, 6.67 * sc, '#ffcd34'); rect(W / 2 + hw, base - 10 * sc, 1, 6.67 * sc, '#ffcd34');
    // wind
    text(`WIND ${Math.abs(m.wind)} MPH ${m.wind < 0 ? '<' : m.wind > 0 ? '>' : ''}`, 8, 26, '#fff');
    text(`${k.kind === 'pat' ? 'EXTRA POINT' : 'FIELD GOAL'} ${D} YDS   RANGE ~${Math.round(k.maxRange)}`, W - 8, 26, '#fff', 1, 'right');
    // kicker + ball
    const kx = W / 2, ky = H - 22;
    drawSprite(playerSprite(m.me.c1, m.me.c2, k.stage === 'flight' ? 1 : 0, 1, 0), kx - 16, ky - 10);
    if (k.stage !== 'flight') {
      const a = (k.stage === 'aim' ? k.ang : k.lockAng) * Math.PI / 180;
      line(kx, ky, kx + Math.sin(a) * 60, ky - Math.cos(a) * 60, '#ffec27', 2);
      rect(kx - 1, ky - 2, 3, 3, '#8b4513');
      // power meter
      rect(W - 30, 80, 10, 100, '#000'); frame(W - 30, 80, 10, 100, '#fff');
      const need = Math.min(1, D / k.maxRange);
      rect(W - 33, 180 - need * 100, 16, 1, '#ff004d');
      if (k.stage === 'power') rect(W - 29, 180 - k.power * 100, 8, k.power * 100, k.power > 0.92 ? '#ffa300' : '#38b764');
      text(k.stage === 'aim' ? 'TAP TO SET AIM' : 'TAP TO SET POWER', W / 2, H - 10, '#fff', 1, 'center');
    } else {
      const u = Math.min(1.2, k.u);
      const z = Math.min(k.range, D * 1.15) * u, lat = k.lateral * (z / D);
      const peak = 12 * Math.min(1, k.range / D);
      const fh = Math.max(0, 4 * peak * (u * 0.9) * (1 - u * 0.9));
      const bx = gx(lat, z), by = gy(z) - fh * 260 / (z + 4);
      rect(bx - 1, by - 1, 3, 3, '#8b4513');
      if (k.u > 1) this.banner(k.good ? 'IT\'S GOOD!' : k.why);
    }
  }
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) * 0.7 | 0, g = ((n >> 8) & 255) * 0.7 | 0, b = (n & 255) * 0.7 | 0;
  return `rgb(${r},${g},${b})`;
}
