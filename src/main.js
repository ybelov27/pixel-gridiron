// Boot + 60 FPS fixed-timestep loop + scene/modal dispatch.
import * as G from './gfx.js';
import { initCanvas, getCanvas, rect, text, panel, wrap, big, THEME, themedBackground, boxX, boxY, ctx as _ctx } from './gfx.js';
import { initInput, input } from './input.js';
import { UI } from './ui.js';
import { unlockAudio, sfx, audio } from './audio.js';
import { app } from './app.js';
import { saveCareer } from './save.js';
import { TitleScene } from './scenes/menus.js';

const STEP = 1 / 60;
initCanvas(document.getElementById('c'));
initInput(getCanvas());
app.autosave = () => { if (app.career) saveCareer(app.career); };

// iOS: block pinch-zoom, double-tap zoom and rubber-band scrolling outside the canvas
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());
// iOS only unlocks Web Audio on touchend/click, not touchstart
for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, unlockAudio, { passive: true });

let pressed = null, acc = 0, last = performance.now(), clock = 0;

function drawModal() {
  const m = app.modal, W = G.W, H = G.H;
  const lines = m.lines.flatMap((l) => wrap(l, 56));
  const cols = m.buttons.length > 3 ? 2 : 1;
  const h = 34 + lines.length * 8 + 22 * Math.ceil(m.buttons.length / cols);
  const w = 256, x = Math.floor((W - w) / 2), y = Math.max(8, Math.floor((H - h) / 2));
  rect(0, 0, W, H, 'rgba(5,6,18,0.7)');
  panel(x, y, w, h);
  rect(x + 1, y + 1, w - 2, 15, '#2f6fe0');
  big(m.title, W / 2, y + 5, '#fff', { align: 'center' });
  lines.forEach((l, i) => text(l, x + 10, y + 22 + i * 8, '#f4f4f4'));
  const by = y + 26 + lines.length * 8;
  const bw = cols === 2 ? 114 : 216;
  m.buttons.forEach((b, i) => {
    const bx = cols === 2 ? x + 10 + (i % 2) * 122 : x + 20, byy = by + Math.floor(i / cols) * 22;
    UI.button(bx, byy, bw, 18, b.label, () => { app.modal = null; b.fn && b.fn(); }, { color: b.color, disabled: b.disabled });
  });
}
function drawRotate() {
  const W = G.W, H = G.H;
  themedBackground(W, H, clock);
  const cx = W / 2, cy = H / 2 - 20;
  // phone outline rocking from portrait to landscape
  const a = Math.min(1, Math.max(0, Math.sin(clock * 2) * 1.2 + 0.2)) * Math.PI / 2;
  const ctx = G.ctx;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-a);
  rect(-14, -24, 28, 48, '#0b0d1c'); rect(-12, -22, 24, 44, '#3ccf6a'); rect(-3, 19, 6, 2, '#0b0d1c');
  ctx.restore();
  big('ROTATE YOUR', cx, cy + 42, '#ffd23f', { align: 'center' });
  big('DEVICE', cx, cy + 54, '#ffd23f', { align: 'center' });
  text('PIXEL GRIDIRON PLAYS IN LANDSCAPE', cx, cy + 70, '#9aa3cf', 1, 'center');
}

function handle(e) {
  const sc = app.scene;
  if (G.PORTRAIT) return;
  if (e.type === 'down') {
    const b = UI.hit(e.x, e.y);
    if (b) { pressed = { b, id: e.id }; UI.held = { x: e.x, y: e.y }; return; }
    if (app.modal) return;
    sc.pointer && sc.pointer(e);
  } else if (e.type === 'move' && pressed && pressed.id === e.id) {
    UI.held = { x: e.x, y: e.y };
  } else if (e.type === 'up' || e.type === 'cancel') {
    unlockAudio();
    if (pressed && pressed.id === e.id) {
      const b = UI.hit(e.x, e.y);
      const was = pressed.b; pressed = null; UI.held = null;
      if (b && b.onClick && b.x === was.x && b.y === was.y && e.type === 'up') {
        sfx.click();
        b.onClick();
        if (!(app.scene && app.scene.noAutosave)) app.autosave();
      }
      return;
    }
    if (!app.modal) sc.pointer && sc.pointer(e);
  } else if (e.type === 'key') {
    if (app.modal) { if (e.key === 'Escape') app.modal = null; return; }
    sc.key && sc.key(e);
  } else if (!app.modal) sc.pointer && sc.pointer(e);
}

function step() {
  while (input.queue.length) handle(input.queue.shift());
  clock += STEP;
  if (G.PORTRAIT) { if (app.scene && app.scene.onPortrait) app.scene.onPortrait(); return; }
  if (app.scene && app.scene.update && !app.modal) app.scene.update(STEP);
  if (app.toastT > 0) app.toastT -= STEP;
}
function render() {
  const W = G.W, H = G.H;
  audio.enabled = app.career ? app.career.settings.sound !== false : audio.enabled;
  UI.begin(); UI.ox = 0; UI.oy = 0;
  if (G.PORTRAIT) { drawRotate(); return; }
  const sc = app.scene;
  if (sc && sc.full) sc.draw();
  else if (sc) {
    // menus are laid out in a centered 384x216 box over a full-screen themed background
    themedBackground(W, H, clock);
    if (sc.backdrop) sc.backdrop(W, H);
    const ox = boxX(), oy = boxY();
    G.ctx.save(); G.ctx.translate(ox, oy); UI.ox = ox; UI.oy = oy;
    sc.draw();
    G.ctx.restore(); UI.ox = 0; UI.oy = 0;
  }
  if (app.modal) { UI.begin(); drawModal(); }
  if (app.toastT > 0) {
    const tw = Math.min(W - 20, app.toastText.length * 4 + 16);
    const ty = H - 22 - G.SAFE.b;
    rect((W - tw) / 2 - 1, ty - 1, tw + 2, 14, '#0b0d1c'); rect((W - tw) / 2, ty, tw, 12, '#232a55');
    text(app.toastText, W / 2, ty + 4, '#ffd23f', 1, 'center');
  }
}
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  while (input.queue.length) handle(input.queue.shift());
  while (acc >= STEP) { acc -= STEP; step(); }
  render();
  requestAnimationFrame(frame);
}
window.addEventListener('error', (e) => console.error('[pixel-gridiron]', e.message));
// offline support / installable app (network-first, falls back to cache)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !location.search.includes('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// debug hook (used by the in-browser smoke test): advance the fixed-step loop synchronously
window.__pg = { app, input, UI, G, tick(sec = 1) { for (let i = 0; i < sec * 60; i++) { step(); if (i % 6 === 0) render(); } render(); } };
app.go(new TitleScene());
requestAnimationFrame(frame);
