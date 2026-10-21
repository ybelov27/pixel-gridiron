// Immediate-mode canvas buttons. Buttons registered during draw are hit-tested on the next click.
// UI.ox/UI.oy is the translation of the current layout box (menus are drawn in a centered 384x216 box).
import { rect, text, textWidth, big, bigWidth, shadeColor, icon } from './gfx.js';
export const UI = {
  buttons: [], ox: 0, oy: 0, held: null, // held = {x, y} canvas coords of a pointer that is down
  begin() { this.buttons = []; },
  button(x, y, w, h, label, onClick, o = {}) {
    const dis = !!o.disabled;
    const base = dis ? '#3a3f5e' : (o.color || '#2f6fe0');
    const ax = x + this.ox, ay = y + this.oy;
    const pressed = !dis && this.held && this.held.x >= ax && this.held.x < ax + w && this.held.y >= ay && this.held.y < ay + h;
    const d = pressed ? 1 : 0;
    rect(x, y + 1, w, h, 'rgba(0,0,0,0.45)');                 // drop shadow
    rect(x, y + d, w, h - d, '#0b0d1c');                      // outline
    rect(x + 1, y + 1 + d, w - 2, h - 2 - d, base);
    if (!pressed) {
      rect(x + 1, y + 1, w - 2, 1, dis ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)');
      rect(x + 1, y + h - 3, w - 2, 2, shadeColor(base.startsWith('#') ? base : '#2f6fe0', 0.62));
    }
    if (o.selected) { rect(x, y + d, w, 1, '#ffd23f'); rect(x, y + h - 1, w, 1, '#ffd23f'); rect(x, y + d, 1, h - d, '#ffd23f'); rect(x + w - 1, y + d, 1, h - d, '#ffd23f'); }
    const tc = dis ? '#7a7f99' : (o.textColor || '#fff');
    const lines = String(label).split('\n');
    const ic = o.icon ? 11 : 0;
    const useBig = !o.small && lines.length === 1 && h >= 13 && bigWidth(lines[0]) + ic <= w - 6;
    const yy = y + d - (pressed ? 0 : 1);
    if (useBig) {
      const tw = bigWidth(lines[0]) + ic;
      const tx = x + Math.floor((w - tw) / 2);
      if (o.icon) icon(o.icon, tx, yy + Math.floor((h - 9) / 2) + 1, tc);
      big(lines[0], tx + ic, yy + Math.floor((h - 7) / 2) + 1, tc, { shadow: false, outline: dis ? null : '#0b0d1c' });
    } else {
      const lh = 6;
      let ty = yy + Math.floor((h - lines.length * lh) / 2) + 1;
      for (const l of lines) { text(l, x + w / 2, ty, tc, 1, 'center'); ty += lh; }
    }
    this.buttons.push({ x: ax, y: ay, w, h, onClick: dis ? null : onClick, sfx: o.sfx, label: String(label) });
  },
  hit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    }
    return null;
  },
  // invisible clickable zone
  zone(x, y, w, h, onClick) { this.buttons.push({ x: x + this.ox, y: y + this.oy, w, h, onClick }); },
};
export function fitText(s, maxW) {
  s = String(s);
  while (s.length > 1 && textWidth(s) > maxW) s = s.slice(0, -1);
  return s;
}
