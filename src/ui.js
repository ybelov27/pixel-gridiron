// Immediate-mode canvas buttons. Buttons registered during draw are hit-tested on the next click.
import { rect, frame, text, textWidth } from './gfx.js';
export const UI = {
  buttons: [],
  begin() { this.buttons = []; },
  button(x, y, w, h, label, onClick, o = {}) {
    const dis = !!o.disabled;
    const bg = dis ? '#333c57' : (o.color || '#3b5dc9');
    rect(x, y, w, h, '#000');
    rect(x + 1, y + 1, w - 2, h - 2, bg);
    rect(x + 1, y + h - 2, w - 2, 1, 'rgba(0,0,0,0.35)');
    if (o.selected) frame(x, y, w, h, '#ffcd34');
    const tc = dis ? '#7a7f99' : (o.textColor || '#fff');
    const sc = o.scale || 1;
    const lines = String(label).split('\n');
    const lh = 6 * sc;
    let ty = y + Math.floor((h - lines.length * lh) / 2) + 1;
    for (const l of lines) { text(l, x + w / 2, ty, tc, sc, 'center'); ty += lh; }
    this.buttons.push({ x, y, w, h, onClick: dis ? null : onClick, sfx: o.sfx });
  },
  hit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    }
    return null;
  },
  // invisible clickable zone
  zone(x, y, w, h, onClick) { this.buttons.push({ x, y, w, h, onClick }); },
};
export function fitText(s, maxW) {
  s = String(s);
  while (s.length > 1 && textWidth(s) > maxW) s = s.slice(0, -1);
  return s;
}
