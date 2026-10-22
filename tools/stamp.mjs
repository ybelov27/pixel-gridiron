// Cache-busting without a build step: writes an import map into index.html that points every module at
// "file.js?v=<content hash>", so browsers (and GitHub Pages' 10-minute cache) always load the latest code.
// Run before pushing: node tools/stamp.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(join(root, 'src'));
const hash = (p) => createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 8);
const imports = {};
for (const f of files.sort()) { const rel = './' + relative(root, f); imports[rel] = `${rel}?v=${hash(f)}`; }
const all = createHash('sha1').update(Object.values(imports).join()).digest('hex').slice(0, 8);
const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 1)}\n</script>`;
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '');
html = html.replace(/<script type="module" src="[^"]*"><\/script>/, `${map}\n<script type="module" src="./src/main.js?v=${imports['./src/main.js'].split('=')[1]}"></script>`);
writeFileSync(join(root, 'index.html'), html);
// bump the service worker cache name so installed copies refresh too
const swp = join(root, 'sw.js');
let sw = readFileSync(swp, 'utf8').replace(/const CACHE = '[^']*';/, `const CACHE = 'pixel-gridiron-${all}';`);
// keep the offline precache list in sync with every module in src/
const statics = ['./', 'index.html', 'manifest.webmanifest', ...readdirSync(join(root, 'icons')).filter((f) => f.endsWith('.png')).sort().map((f) => `icons/${f}`)];
const list = [...statics, ...Object.keys(imports).map((k) => k.slice(2))];
sw = sw.replace(/const FILES = \[[\s\S]*?\];/, `const FILES = ${JSON.stringify(list, null, 1).replace(/"/g, "'")};`);
writeFileSync(swp, sw);
console.log(`stamped ${files.length} modules, build ${all}`);
