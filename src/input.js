// Pointer (mouse + touch) and keyboard input mapped into internal canvas coordinates.
import { W, H } from './gfx.js';
export const input = { queue: [], pointers: new Map(), keys: new Set() };

export function initInput(canvas) {
  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.focus();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    const p = toLocal(e);
    input.pointers.set(e.pointerId, p);
    input.queue.push({ type: 'down', id: e.pointerId, x: p.x, y: p.y, button: e.button, touches: input.pointers.size, ptype: e.pointerType });
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toLocal(e);
    if (input.pointers.has(e.pointerId)) input.pointers.set(e.pointerId, p);
    // chorded mouse button (right button pressed while left held) arrives as a move with button=2
    if (e.button === 2 && (e.buttons & 2)) input.queue.push({ type: 'chord', id: e.pointerId, x: p.x, y: p.y });
    input.queue.push({ type: 'move', id: e.pointerId, x: p.x, y: p.y, buttons: e.buttons });
  });
  const up = (e) => {
    const p = toLocal(e);
    input.pointers.delete(e.pointerId);
    input.queue.push({ type: e.type === 'pointercancel' ? 'cancel' : 'up', id: e.pointerId, x: p.x, y: p.y, button: e.button, touches: input.pointers.size });
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); input.queue.push({ type: 'wheel', dy: Math.sign(e.deltaY) }); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    input.keys.add(e.key);
    input.queue.push({ type: 'key', key: e.key });
  });
  addEventListener('keyup', (e) => input.keys.delete(e.key));
}
