// Low-res canvas, integer scaling, bitmap font and procedural sprites.
export const W = 384, H = 216;
export let ctx = null;
let canvas = null;

export function initCanvas(c) {
  canvas = c;
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(innerWidth * dpr / W, innerHeight * dpr / H);
  // integer scale in device pixels when possible (crisp), fractional fallback for tiny screens
  const s = fit >= 1 ? Math.floor(fit) : fit;
  canvas.style.width = (W * s / dpr) + 'px';
  canvas.style.height = (H * s / dpr) + 'px';
}
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
  const a = fontAtlas(color);
  for (let i = 0; i < s.length; i++) {
    const j = idx[s[i]];
    if (j === undefined || s[i] === ' ') continue;
    ctx.drawImage(a, j * 4, 0, 3, 5, x + i * 4 * scale, y, 3 * scale, 5 * scale);
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
export function panel(x, y, w, h, bg = '#1a1c2c', border = '#f4f4f4') {
  rect(x, y, w, h, bg); frame(x, y, w, h, border); frame(x + 1, y + 1, w - 2, h - 2, '#000');
}

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

// ---------- player sprites (7x11) ----------
const FRAMES = [
  ['..hhh..', '.hhhhm.', '.hhssm.', '..jjj..', '.jjnjj.', 'sjjnjjs', '.jjjjj.', '..ppp..', '..p.p..', '.l...l.', 'bb...bb'],
  ['..hhh..', '.hhhhm.', '.hhssm.', '..jjj..', '.jjnjj.', 'sjjnjjs', '.jjjjj.', '..ppp..', '...pp..', '...ll..', '...bb..'],
  // down / tackled (lying)
  ['.......', '.......', '.......', '.......', '.......', '.......', '.......', 'hhjjjpl', 'hsjnjpb', '.......', '.......'],
];
const SKINS = ['#f2c39b', '#c98c5a', '#8d5a35', '#5c3a21'];
const spriteCache = new Map();
export function playerSprite(primary, secondary, frameI, facing, skin = 0, pants = '#e8e8e8') {
  const key = primary + secondary + frameI + facing + skin + pants;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = 7; c.height = 11;
  const x = c.getContext('2d');
  const map = { h: primary, m: '#c0c0c0', s: SKINS[skin % 4], j: primary, n: secondary, p: pants, l: secondary, b: '#111' };
  const f = FRAMES[frameI];
  for (let r = 0; r < 11; r++) for (let k = 0; k < 7; k++) {
    const ch = f[r][facing > 0 ? k : 6 - k];
    if (ch !== '.') { x.fillStyle = map[ch]; x.fillRect(k, r, 1, 1); }
  }
  spriteCache.set(key, c);
  return c;
}
export function drawSprite(img, x, y) { ctx.drawImage(img, Math.round(x), Math.round(y)); }
