// Boot + 60 FPS fixed-timestep loop + scene/modal dispatch.
import { initCanvas, getCanvas, W, H, rect, text, panel, wrap } from './gfx.js';
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

let pressed = null, acc = 0, last = performance.now();

function drawModal() {
  const m = app.modal;
  const lines = m.lines.flatMap((l) => wrap(l, 52));
  const h = 30 + lines.length * 8 + 20 * Math.ceil(m.buttons.length / (m.buttons.length > 3 ? 2 : 1));
  const w = 240, x = (W - w) / 2, y = Math.max(8, (H - h) / 2);
  rect(0, 0, W, H, 'rgba(0,0,0,0.6)');
  panel(x, y, w, h);
  text(m.title, W / 2, y + 7, '#ffcd34', 1, 'center');
  lines.forEach((l, i) => text(l, x + 10, y + 20 + i * 8, '#f4f4f4'));
  const by = y + 24 + lines.length * 8;
  const cols = m.buttons.length > 3 ? 2 : 1;
  const bw = cols === 2 ? 108 : 200;
  m.buttons.forEach((b, i) => {
    const bx = cols === 2 ? x + 10 + (i % 2) * 112 : x + 20, byy = by + Math.floor(i / cols) * 20;
    UI.button(bx, byy, bw, 16, b.label, () => { app.modal = null; b.fn && b.fn(); }, { color: b.color, disabled: b.disabled });
  });
}

function handle(e) {
  const sc = app.scene;
  if (e.type === 'down') {
    unlockAudio();
    const b = UI.hit(e.x, e.y);
    if (b) { pressed = { b, id: e.id }; return; }
    if (app.modal) return;
    sc.pointer && sc.pointer(e);
  } else if (e.type === 'up' || e.type === 'cancel') {
    if (pressed && pressed.id === e.id) {
      const b = UI.hit(e.x, e.y);
      const was = pressed.b; pressed = null;
      if (b && b.onClick && b.x === was.x && b.y === was.y && e.type === 'up') {
        sfx.click();
        b.onClick();
        if (!(app.scene && app.scene.noAutosave)) app.autosave();
      }
      return;
    }
    if (!app.modal) sc.pointer && sc.pointer(e);
  } else if (e.type === 'key') {
    unlockAudio();
    if (app.modal) { if (e.key === 'Escape') app.modal = null; return; }
    sc.key && sc.key(e);
  } else if (!app.modal) sc.pointer && sc.pointer(e);
}

function step() {
  while (input.queue.length) handle(input.queue.shift());
  if (app.scene && app.scene.update && !app.modal) app.scene.update(STEP);
  if (app.toastT > 0) app.toastT -= STEP;
}
function render() {
  audio.enabled = app.career ? app.career.settings.sound !== false : audio.enabled;
  UI.begin();
  rect(0, 0, W, H, '#10121c');
  app.scene && app.scene.draw();
  if (app.modal) { UI.begin(); drawModal(); }
  if (app.toastT > 0) {
    const tw = Math.min(W - 20, app.toastText.length * 4 + 12);
    rect((W - tw) / 2, H - 20, tw, 12, '#000'); text(app.toastText, W / 2, H - 17, '#ffcd34', 1, 'center');
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
// debug hook (used by the in-browser smoke test): advance the fixed-step loop synchronously
window.__pg = { app, input, tick(sec = 1) { for (let i = 0; i < sec * 60; i++) { step(); if (i % 6 === 0) render(); } render(); } };
app.go(new TitleScene());
requestAnimationFrame(frame);
