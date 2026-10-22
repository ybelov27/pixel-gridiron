// Low-res canvas that fills the screen at an integer device-pixel scale, bitmap fonts and procedural sprites.
// BW x BH is the guaranteed minimum logical area (menus are laid out in it); W x H grow to fill the screen.
export const BW = 384, BH = 216;
export let W = BW, H = BH, SCALE = 1;
// pixel-art assets are smoothed with Scale2x (EPX) to this factor and drawn into a full-resolution canvas
export let HI = 1;
export const SAFE = { l: 0, r: 0, t: 0, b: 0 }; // notch / home-indicator insets in logical px
export let PORTRAIT = false;
export let ctx = null;
let canvas = null, probe = null;
const MAX_W = 560, MAX_H = 320;

export function initCanvas(c) {
  canvas = c;
  probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => { setTimeout(resize, 120); setTimeout(resize, 500); });
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = innerWidth, vh = innerHeight;
  const dw = Math.round(vw * dpr), dh = Math.round(vh * dpr);
  PORTRAIT = vh > vw * 1.05;
  // in portrait, lay the game out as if the phone were rotated so the scale matches landscape
  const fw = PORTRAIT ? Math.max(dw, dh) : dw, fh = PORTRAIT ? Math.min(dw, dh) : dh;
  let s = Math.floor(Math.min(fw / BW, fh / BH));
  if (s < 1) s = Math.min(fw / BW, fh / BH); // tiny window: fractional fallback
  let w = Math.floor(dw / s), h = Math.floor(dh / s);
  while (!PORTRAIT && (w > MAX_W || h > MAX_H) && s >= 1) { s++; w = Math.floor(dw / s); h = Math.floor(dh / s); }
  if (!PORTRAIT && (w < BW || h < BH)) { s = Math.max(1, s - 1); w = Math.floor(dw / s); h = Math.floor(dh / s); }
  w = Math.max(BW, Math.min(PORTRAIT ? 2000 : MAX_W, w)); h = Math.max(PORTRAIT ? 1 : BH, Math.min(PORTRAIT ? 2000 : MAX_H, h));
  SCALE = s;
  // classic crisp pixels: draw at the logical resolution and let CSS scale it up by an integer factor
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  W = w; H = h;
  HI = 1; // Scale2x smoothing switched off (the chunky pixel look reads better)
  ctx = canvas.getContext('2d');
  if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  canvas.style.width = (w * s / dpr) + 'px';
  canvas.style.height = (h * s / dpr) + 'px';
  const cs = getComputedStyle(probe), k = dpr / s;
  SAFE.t = Math.ceil(parseFloat(cs.paddingTop) * k) || 0; SAFE.r = Math.ceil(parseFloat(cs.paddingRight) * k) || 0;
  SAFE.b = Math.ceil(parseFloat(cs.paddingBottom) * k) || 0; SAFE.l = Math.ceil(parseFloat(cs.paddingLeft) * k) || 0;
}
// ---------- Scale2x (EPX) smoothing for pixel art ----------
function scale2x(src) {
  const w = src.width, h = src.height, sx = src.getContext('2d');
  const id = sx.getImageData ? sx.getImageData(0, 0, w, h) : null;
  if (!id || !id.data) return null;
  const s = new Uint32Array(id.data.buffer.slice(0));
  const out = document.createElement('canvas'); out.width = w * 2; out.height = h * 2;
  const ox = out.getContext('2d'), od = ox.createImageData(w * 2, h * 2), o = new Uint32Array(od.data.buffer);
  const at = (x, y) => s[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A;
    if (A === B && A !== C && B !== D) e1 = B;
    if (D === C && D !== B && C !== A) e2 = C;
    if (B === D && B !== A && D !== C) e3 = D;
    const i = (y * 2) * (w * 2) + x * 2;
    o[i] = e0; o[i + 1] = e1; o[i + w * 2] = e2; o[i + w * 2 + 1] = e3;
  }
  ox.putImageData(od, 0, 0);
  return out;
}
// smoothed copy of a pixel-art canvas at the current HI factor (cached on the canvas)
export function hi(c) {
  if (HI <= 1) return c;
  if (c._hi && c._hiLevel === HI) return c._hi;
  let out = c;
  try { for (let f = 1; f < HI; f *= 2) { const n = scale2x(out); if (!n) { out = c; break; } out = n; } } catch (_) { out = c; }
  c._hi = out; c._hiLevel = HI;
  return out;
}
// top-left of the centered BW x BH layout box used by menus
export function boxX() { return Math.floor((W - BW) / 2); }
export function boxY() { return Math.floor((H - BH) / 2); }
export function getCanvas() { return canvas; }

// ---------- bitmap font (3x5 glyphs, 4x6 cell) ----------
const G = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
  K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',
  P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',
  U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',
  Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010',
  '9':'010101011001110','.':'000000000000010',',':'000000000010100',':':'000010000010000','!':'010010010000010',
  '?':'110001010000010','-':'000000111000000','+':'000010111010000','/':'001001010100100',"'":'010010000000000',
  '"':'101101000000000','(':'001010010010001',')':'100010010010100','%':'101001010100101','$':'011110010011110',
  '#':'101111101111101','*':'000101010101000','<':'001010100010001','>':'100010001010100','=':'000111000111000',
  '&':'010101010101011','_':'000000000000111','[':'011010010010011',']':'110010010010110','|':'010010010010010',
  '^':'010101000000000',' ':'000000000000000','@':'010111010101000','~':'000001111001000'
};
const CHARS = Object.keys(G);
const fontCache = new Map();
function fontAtlas(color) {
  let c = fontCache.get(color);
  if (c) return c;
  if (fontCache.size > 64) fontCache.clear();
  c = document.createElement('canvas');
  c.width = CHARS.length * 4; c.height = 6;
  const x = c.getContext('2d');
  x.fillStyle = color;
  CHARS.forEach((ch, i) => {
    const g = G[ch];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r * 3 + k] === '1') x.fillRect(i * 4 + k, r, 1, 1);
  });
  fontCache.set(color, c);
  return c;
}
const idx = {}; CHARS.forEach((c, i) => idx[c] = i);
export function textWidth(s, scale = 1) { return (String(s).length * 4 - 1) * scale; }
export function text(s, x, y, color = '#fff', scale = 1, align = 'left', shadow = null) {
  s = String(s).toUpperCase();
  if (align === 'center') x -= Math.floor(textWidth(s, scale) / 2);
  else if (align === 'right') x -= textWidth(s, scale);
  x = Math.round(x); y = Math.round(y);
  if (shadow) drawStr(s, x + scale, y + scale, shadow, scale);
  drawStr(s, x, y, color, scale);
}
function drawStr(s, x, y, color, scale) {
  const a = fontAtlas(color), ha = hi(a);
  for (let i = 0; i < s.length; i++) {
    const j = idx[s[i]];
    if (j === undefined || s[i] === ' ') continue;
    const k = a === ha ? 1 : HI;
    ctx.drawImage(ha, j * 4 * k, 0, 3 * k, 5 * k, x + i * 4 * scale, y, 3 * scale, 5 * scale);
  }
}
// word-wrap into lines of max chars
export function wrap(s, maxChars) {
  const words = String(s).split(' '); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- primitives ----------
export function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
export function frame(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillStyle = c; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}
export function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
export function line(x0, y0, x1, y1, c, dotted = 0, phase = 0) {
  const dx = x1 - x0, dy = y1 - y0; const n = Math.max(Math.abs(dx), Math.abs(dy)) | 0;
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) {
    if (dotted && ((i + phase) % (dotted * 2)) >= dotted) continue;
    const t = n ? i / n : 0;
    ctx.fillRect(Math.round(x0 + dx * t), Math.round(y0 + dy * t), 1, 1);
  }
}
export function panel(x, y, w, h, bg = THEME_PANEL, border = null) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  rect(x + 2, y + 2, w, h, 'rgba(0,0,0,0.35)');             // drop shadow
  rect(x, y, w, h, '#0b0d1c');                              // outline
  rect(x + 1, y + 1, w - 2, h - 2, bg);
  rect(x + 1, y + 1, w - 2, 1, border || 'rgba(255,255,255,0.18)');  // top highlight
  rect(x + 1, y + h - 2, w - 2, 1, 'rgba(0,0,0,0.3)');      // bottom lowlight
}
const THEME_PANEL = '#232a55';
// ---------- star icons ----------
const STAR = ['00100', '01110', '11111', '01110', '01010'];
export function starIcon(x, y, c = '#ffcd34') {
  ctx.fillStyle = c;
  for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) if (STAR[r][k] === '1') ctx.fillRect(Math.round(x) + k, Math.round(y) + r, 1, 1);
}
// draws a row of stars for a 0.5-5 rating; returns width
export function stars(x, y, v, max = 5, on = '#ffcd34', off = '#3b3f58') {
  for (let i = 0; i < max; i++) {
    starIcon(x + i * 6, y, off);
    if (v >= i + 1) starIcon(x + i * 6, y, on);
    else if (v >= i + 0.5) { // half star: clip left half
      ctx.save(); ctx.beginPath(); ctx.rect(x + i * 6, y, 3, 5); ctx.clip(); starIcon(x + i * 6, y, on); ctx.restore();
    }
  }
  return max * 6;
}
export function bar(x, y, w, h, v, max, c = '#38b764', bg = '#333c57') {
  rect(x, y, w, h, bg); rect(x, y, Math.max(0, Math.round(w * Math.min(1, v / max))), h, c);
}

// ---------- big bold font (5x7 glyphs) ----------
const B = {
  A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01110100011000010000100001000101110',
  D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',
  G:'01110100011000010111100011000101111',H:'10001100011000111111100011000110001',I:'01110001000010000100001000010001110',
  J:'00111000100001000010000101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',
  M:'10001110111010110101100011000110001',N:'10001100011100110101100111000110001',O:'01110100011000110001100011000101110',
  P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',
  S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',
  V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',
  Y:'10001100011000101010001000010000100',Z:'11111000010001000100010001000011111',
  '0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100010001000100011111',
  '3':'11111000100010000010000011000101110','4':'00010001100101010010111110001000010','5':'11111100001111000001000011000101110',
  '6':'00110010001000011110100011000101110','7':'11111000010001000100010000100001000','8':'01110100011000101110100011000101110',
  '9':'01110100011000101111000010001001100','.':'00000000000000000000000000110001100',',':'00000000000000000000011000010001000',
  ':':'00000011000110000000011000110000000','!':'00100001000010000100001000000000100','?':'01110100010000100010001000000000100',
  '-':'00000000000000011111000000000000000','+':'00000001000010011111001000010000000','/':'00000000010001000100010001000000000',
  "'":'00100001000100000000000000000000000','(':'00010001000100001000010000010000010',')':'01000001000001000010000100010001000',
  '%':'11000110010001000100010001001100011','$':'00100011111010001110001011111000100','#':'01010010101111101010111110101001010',
  '*':'00000001001010101110101010010000000','<':'00010001000100010000010000010000010','>':'01000001000001000001000100010001000',
  '=':'00000000001111100000111110000000000','&':'01100100101010001000101011001001101','_':'00000000000000000000000000000011111',
  '^':'00100010101000100000000000000000000','[':'01110010000100001000010000100001110',']':'01110000100001000010000100001001110',
  '"':'01010010100101000000000000000000000','|':'00100001000010000100001000010000100',' ':'00000000000000000000000000000000000',
};
const BCH = Object.keys(B), bidx = {}; BCH.forEach((c, i) => bidx[c] = i);
const bigCache = new Map();
function bigAtlas(color, bold) {
  const key = color + bold;
  let c = bigCache.get(key);
  if (c) return c;
  if (bigCache.size > 64) bigCache.clear();
  const cw = bold ? 6 : 5;
  c = document.createElement('canvas'); c.width = BCH.length * cw; c.height = 7;
  const x = c.getContext('2d'); x.fillStyle = color;
  BCH.forEach((ch, i) => { const g = B[ch];
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r * 5 + k] === '1') { x.fillRect(i * cw + k, r, bold ? 2 : 1, 1); } });
  bigCache.set(key, c);
  return c;
}
export function bigWidth(s, scale = 1, bold = true) { return (String(s).length * (bold ? 7 : 6) - 1) * scale; }
// chunky outlined text, the main display font. Each outlined string takes ~10 passes, so the
// finished string is rendered once into its own small canvas and reused while it stays on screen.
const bigStrCache = new Map();
function bigStr(s, color, scale, bold, oc, shadow) {
  const key = s + '|' + color + '|' + scale + bold + oc + shadow;
  let c = bigStrCache.get(key);
  if (c) return c;
  if (bigStrCache.size > 400) bigStrCache.clear();
  const adv = (bold ? 7 : 6) * scale, cw = bold ? 6 : 5, wpx = bigWidth(s, scale, bold);
  c = document.createElement('canvas'); c.width = Math.max(1, wpx + 2 + scale); c.height = 7 * scale + scale + 3;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const draw = (col, dx, dy) => { const a = bigAtlas(col, bold);
    for (let i = 0; i < s.length; i++) { const j = bidx[s[i]]; if (j === undefined || s[i] === ' ') continue;
      x.drawImage(a, j * cw, 0, cw, 7, 1 + i * adv + dx, 1 + dy, cw * scale, 7 * scale); } };
  if (shadow && oc) draw(oc, 0, scale + 1);
  if (oc) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) draw(oc, dx, dy);
  draw(color, 0, 0);
  bigStrCache.set(key, c);
  return c;
}
export function big(s, x, y, color = '#fff', o = {}) {
  s = String(s).toUpperCase();
  const scale = o.scale || 1, bold = o.bold !== false;
  const wpx = bigWidth(s, scale, bold);
  if (o.align === 'center') x -= Math.floor(wpx / 2); else if (o.align === 'right') x -= wpx;
  const oc = o.outline === undefined ? '#0b0d1c' : o.outline;
  ctx.drawImage(bigStr(s, color, scale, bold, oc, o.shadow !== false), Math.round(x) - 1, Math.round(y) - 1);
}
// run drawing calls against an offscreen canvas instead of the screen
export function drawTo(c, fn) {
  const prev = ctx; ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  try { fn(); } finally { ctx = prev; }
}

// ---------- icons (9x9) ----------
const ICONS = {
  team: ['..ooooo..', '.ohhhhho.', 'ohhhhhmmo', 'ohhhhhm.o', 'ohhhhhmmo', '.ohhhho..', '..oooo...', '.........', '.........'],
  office: ['.........', '..ooooo..', '..o...o..', 'ooooooooo', 'o.......o', 'o...o...o', 'o.......o', 'ooooooooo', '.........'],
  sign: ['....o....', '...ooo...', '....o....', '..ooooo..', '.o.....o.', 'o..o.o..o', 'o.......o', '.o.ooo.o.', '..ooooo..'],
  sched: ['.o.....o.', 'ooooooooo', 'o.......o', 'o.o.o.o.o', 'o.......o', 'o.o.o.o.o', 'o.......o', 'ooooooooo', '.........'],
  table: ['ooooooooo', 'o..o....o', 'ooooooooo', 'o..o....o', 'ooooooooo', 'o..o....o', 'ooooooooo', '.........', '.........'],
  bracket: ['ooo......', '..o......', '..ooo....', '..o.o....', 'ooo.oooo.', '....o....', 'ooo.o....', '..ooo....', '.........'],
  trophy: ['ooooooooo', 'o.ooooo.o', 'o.ooooo.o', '.oooooo..', '..ooooo..', '...ooo...', '....o....', '..ooooo..', '.........'],
  gear: ['...ooo...', '.o.ooo.o.', '.ooo.ooo.', 'ooo...ooo', 'oo.....oo', 'ooo...ooo', '.ooo.ooo.', '.o.ooo.o.', '...ooo...'],
  coin: ['..ooooo..', '.oyyyyyo.', 'oyyoooyyo', 'oyyoyyyyo', 'oyyoyyyyo', 'oyyoooyyo', '.oyyyyyo.', '..ooooo..', '.........'],
  news: ['ooooooo..', 'o.....oo.', 'o.ooo.o.o', 'o.....o.o', 'o.ooo.o.o', 'o.....o.o', 'oooooooo.', '.........', '.........'],
};
export function icon(name, x, y, color = '#fff') {
  const g = ICONS[name]; if (!g) return;
  for (let r = 0; r < 9; r++) for (let k = 0; k < 9; k++) {
    const ch = g[r][k]; if (ch === '.') continue;
    ctx.fillStyle = ch === 'y' ? '#ffd23f' : ch === 'h' ? color : ch === 'm' ? '#c0c0c0' : color;
    ctx.fillRect(Math.round(x) + k, Math.round(y) + r, 1, 1);
  }
}

// ---------- player sprites: fill art auto-outlined -> 10x16 ----------
// h helmet, s helmet stripe, l logo, m facemask, f face, j jersey, n number band, a arm, p pants, k socks, b shoes
// compact 6x10 fill art -> 8x12 with the auto outline
// h helmet, H helmet shine, s stripe, m facemask, f face, j jersey, J jersey shade, w number, a arm, p pants, P pants stripe, k sock, b cleat
const HEAD = ['.Hsh..', 'Hhshhm', 'hhhhfm', '.hhff.'];
const TORSO = {
  n: ['jjwwjj', 'ajwwJa', '.jjJJ.'],   // arms at sides
  a: ['jjwwja', 'ajwwJ.', '.jjJJ.'],   // arm swing
  c: ['ajwwjj', '.jwwJa', '.jjJJ.'],   // opposite swing
  t: ['jjwwja', '.jwwJ.', '.jjJJ.'],   // throwing (rear arm raised, see THROW_HEAD)
  u: ['.jwwj.', '.jwwJ.', '.jjJJ.'],   // arms up (catch / celebrate)
};
const THROW_HEAD = ['.Hsh..', 'ahshhm', 'ahhhfm', '.hhff.'];
const UP_HEAD = ['a....a', 'aHshha', 'hhshhm', 'hhhhfm', '.hhff.'];
const LEGS = [
  ['.pPPp.', '.k..k.', '.b..bb'], // stand
  ['pP..Pp', 'k....k', 'b....b'], // stride
  ['.pPPp.', '..kk..', '..bbb.'], // feet together
  ['pP..Pp', 'k....k', 'bb...b'], // stride 2
];
const DOWN = ['Hs.........', 'hhhjjwjpPkb', 'hfmjJwjpPkb', '.f.aa......'];
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const OUTLINE = '#10101a';
const SKINS = ['#f2c39b', '#c98c5a', '#8d5a35', '#5c3a21'];
const spriteCache = new Map();
function buildSprite(rows, map, facing) {
  const w = rows[0].length, h = rows.length;
  const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
  const x = c.getContext('2d');
  const filled = (r, k) => r >= 0 && r < h && k >= 0 && k < w && rows[r][facing > 0 ? k : w - 1 - k] !== '.';
  for (let r = -1; r <= h; r++) for (let k = -1; k <= w; k++) {
    if (filled(r, k)) { x.fillStyle = map[rows[r][facing > 0 ? k : w - 1 - k]]; x.fillRect(k + 1, r + 1, 1, 1); }
    else if (filled(r - 1, k) || filled(r + 1, k) || filled(r, k - 1) || filled(r, k + 1)) { x.fillStyle = OUTLINE; x.fillRect(k + 1, r + 1, 1, 1); }
  }
  return c;
}
// frames: 0 stand, 1 run A, 2 run B, 3 run C, 4 throwing, 5 down (lying), 6 arms up (catch/celebrate), 7 dive (lunging forward)
export function playerSprite(primary, secondary, frameI, facing, skin = 0, pants = '#e8e8e8') {
  const key = primary + secondary + frameI + facing + skin + pants;
  let c = spriteCache.get(key);
  if (c) return c;
  const numCol = Math.abs(lum(secondary) - lum(primary)) > 70 ? secondary : (lum(primary) < 140 ? '#f4f4f4' : '#1c1c24');
  const map = { h: primary, H: shadeColor(primary, 1.45), s: secondary, l: secondary, m: '#d8d8d8', f: SKINS[skin % 4], j: primary, J: shadeColor(primary, 0.72),
    w: numCol, n: secondary, a: SKINS[skin % 4], p: pants, P: secondary, k: secondary, b: '#1c1c24' };
  if (frameI === 5) c = buildSprite(DOWN, map, facing);
  else if (frameI === 7) c = buildSprite(DOWN, map, -facing); // horizontal, helmet leading
  else {
    const rows = {
      0: [...HEAD, ...TORSO.n, ...LEGS[0]], 1: [...HEAD, ...TORSO.a, ...LEGS[1]], 2: [...HEAD, ...TORSO.n, ...LEGS[2]],
      3: [...HEAD, ...TORSO.c, ...LEGS[3]], 4: [...THROW_HEAD, ...TORSO.t, ...LEGS[2]], 6: [...UP_HEAD, ...TORSO.u, ...LEGS[0]],
    }[frameI] || [...HEAD, ...TORSO.n, ...LEGS[0]];
    c = buildSprite(rows, map, facing);
  }
  spriteCache.set(key, c);
  return c;
}
export function drawSprite(img, x, y) { ctx.drawImage(hi(img), Math.round(x), Math.round(y), img.width, img.height); }
// big helmet badge for menus (team logo stand-in), drawn at integer scale
const HELMET = ['....ssssss....', '..hhhhhhhhhh..', '.hhhhhhhhhhhh.', 'hhhhhhhllhhhhh', 'hhhhhhllllhhmm', 'hhhhhhhllhhm.m',
  'hhhhhhhhhhhmmm', '.hhhhhhhhhhm.m', '..hhhhhhhhmmm.', '...hhhhhh.....'];
export function helmet(x, y, primary, secondary, scale = 2, facing = 1) {
  const key = 'helm' + primary + secondary + facing;
  let c = spriteCache.get(key);
  if (!c) { c = buildSprite(HELMET, { h: primary, s: secondary, l: secondary, m: '#d8d8d8' }, facing); spriteCache.set(key, c); }
  ctx.drawImage(hi(c), Math.round(x), Math.round(y), c.width * scale, c.height * scale);
}
// cheerleader (front-facing): r hair, f skin, t top, k skirt, o pom-pom, l legs, b shoes, a arm
const CHEER = [
  ['..rrr..', '..fff..', 'o.ttt.o', 'oatttao', '..ttt..', '.kkkkk.', '..l.l..', '..l.l..', '..b.b..'],
  ['o.rrr.o', 'oafffao', '.attta.', '..ttt..', '..ttt..', '.kkkkk.', '..l.l..', '.l...l.', '.b...b.'],
];
const HAIR = ['#f2d16b', '#7a4a1f', '#2b1a10', '#c0462f'];
export function cheerSprite(top, skirt, frame, hair = 0, skin = 0) {
  const key = 'cheer' + top + skirt + frame + hair + skin;
  let c = spriteCache.get(key);
  if (!c) {
    const pom = lum(skirt) > 200 ? '#ffd23f' : skirt;
    c = buildSprite(CHEER[frame % 2], { r: HAIR[hair % 4], f: SKINS[skin % 4], a: SKINS[skin % 4], t: top, k: skirt, o: pom, l: SKINS[skin % 4], b: '#f4f4f4' }, 1);
    spriteCache.set(key, c);
  }
  return c;
}
const BALL = [['.bbb.', 'bwbwb', '.bbb.'], ['.bbb.', 'bbwbb', '.bbb.'], ['..b..', '.bwb.', '..b..']];
export function ballSprite(x, y, frame = 0) {
  const key = 'ball' + frame;
  let c = spriteCache.get(key);
  if (!c) { c = buildSprite(BALL[frame % 3], { b: '#8b4a1c', w: '#f4f4f4' }, 1); spriteCache.set(key, c); }
  ctx.drawImage(hi(c), Math.round(x) - 3, Math.round(y) - 2, c.width, c.height);
}

// ---------- themed widgets ----------
export const THEME = { bg: '#141833', bg2: '#1b2045', panel: '#232a55', panelHi: '#3a4380', panelLo: '#0d1028', gold: '#ffd23f', text: '#f4f4f4', dim: '#9aa3cf', good: '#3ccf6a', bad: '#ff4d5e', blue: '#2f6fe0', orange: '#ff9f1c' };
export function themedBackground(w, h, t = 0) {
  rect(0, 0, w, h, THEME.bg);
  ctx.fillStyle = THEME.bg2;
  for (let y = ((t * 8) | 0) % 16 - 16; y < h; y += 16) ctx.fillRect(0, y, w, 8);
}
export function shadeColor(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
