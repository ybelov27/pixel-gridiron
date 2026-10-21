// Generates the app icons (pixel-art football on a field) as PNGs with no dependencies: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
// 20x20 pixel art: gold helmet on a navy badge over a field stripe
const ART = [
  'NNNNNNNNNNNNNNNNNNNN',
  'NNNNNNNNNNNNNNNNNNNN',
  'NNNNNNNooooooNNNNNNN',
  'NNNNNooYYWWYYooNNNNN',
  'NNNNoYYYYWWYYYYoNNNN',
  'NNNoYYYYYWWYYYYYoNNN',
  'NNNoYYYYYWWYYYYYYoNN',
  'NNoYYYYYYWWYYYYYYoNN',
  'NNoYYYYoooYYYYYMMMMN',
  'NNoYYYoNNNoYYYYoNNMN',
  'NNoYYYoNNNoYYYYMMMMN',
  'NNoYYYYoooYYYYYoNNMN',
  'NNNoYYYYYYYYYYYMMMMN',
  'NNNNoYYYYYYYYYooNNNN',
  'NNNNNooYYYYYooNNNNNN',
  'NNNNNNNooooooNNNNNNN',
  'GGGGGGGGGGGGGGGGGGGG',
  'GwGGGGwGGGGwGGGGwGGG',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
];
const COL = { N: [20, 24, 51], o: [11, 13, 28], Y: [255, 210, 63], W: [244, 244, 244], M: [200, 200, 210], G: [46, 139, 58], g: [52, 154, 65], w: [244, 244, 244] };
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
}
function png(size) {
  // integer scale per art pixel, centred, padded with the background colour -> perfectly crisp at every size
  const n = ART.length, k = Math.floor(size / n), pad = Math.floor((size - k * n) / 2);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const ay = Math.floor((y - pad) / k), ax = Math.floor((x - pad) / k);
      const ch = ay >= 0 && ay < n && ax >= 0 && ax < n ? ART[ay][ax] : (y < size / 2 ? 'N' : 'g');
      raw.set(COL[ch], y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [152, 167, 180, 192, 512]) writeFileSync(new URL(`../icons/icon-${s}.png`, import.meta.url), png(s));
console.log('icons written');
