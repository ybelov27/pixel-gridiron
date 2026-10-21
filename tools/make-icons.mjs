// Generates the app icons (pixel-art football on a field) as PNGs with no dependencies: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const ART = [
  'GGGGGGGGGGGGGGGG', 'GgggggggggggggGG', 'GGGGGGGGGGGGGGGG', 'GGGGGoooooGGGGGG', 'GGGooBBBBBooGGGG', 'GGoBBBBBBBBBoGGG',
  'GoBBBwBwBwBBBoGG', 'GoBBwwwwwwwBBoGG', 'GoBBBwBwBwBBBoGG', 'GGoBBBBBBBBBoGGG', 'GGGooBBBBBooGGGG', 'GGGGGoooooGGGGGG',
  'GGGGGGGGGGGGGGGG', 'GgggggggggggggGG', 'GGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGG',
];
const COL = { G: [46, 139, 58], g: [240, 240, 240], o: [16, 16, 26], B: [139, 74, 28], w: [244, 244, 244] };
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
}
function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = COL[ART[Math.floor(y * 16 / size)][Math.floor(x * 16 / size)]];
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [180, 192, 512]) writeFileSync(new URL(`../icons/icon-${s}.png`, import.meta.url), png(s));
console.log('icons written');
