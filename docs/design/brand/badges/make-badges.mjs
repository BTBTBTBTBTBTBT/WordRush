// Achievement + level badge sheets via the OpenAI API (founder 10-02: "execute all of them … use the api").
// Each sheet is a 2x2 (1024²) or 3x2 (1536x1024) grid of glossy candy badges in the medal style
// (icons/medals/gold.png is passed as the style reference). Transparent.
//   node badges/make-badges.mjs [sheet,sheet]   → badges/api/<sheet>.png ; split with badges/split-badges.py
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.dirname(HERE);
const OUT = path.join(HERE, 'api');
const BASE = 'glossy soft 3D game achievement BADGE in a cute candy style exactly like the reference medal image (chunky, soft highlights, gentle darker lip, no characters, no faces, no text, no letters, no numbers)';
const sheet2 = (a, b, c, d) => `A 2x2 sheet of four separate ${BASE}s, each big and centered in its own quarter with clear empty space between them, all the same size, transparent background. Each badge is a rounded shield-shaped badge with a thick colored rim and a big glossy symbol in the middle: top-left ${a}; top-right ${b}; bottom-left ${c}; bottom-right ${d}.`;
const JOBS = {
  'ach-1': { size: '1024x1024', prompt: sheet2('a purple badge with a big golden STAR', 'a purple badge with a shiny golden CROWN', 'a purple badge with a bright yellow LIGHTNING BOLT', 'a purple badge with an orange-and-yellow FLAME') },
  'ach-2': { size: '1024x1024', prompt: sheet2('a purple badge with a golden TROPHY cup', 'a purple badge with a cluster of three pink-and-gold SPARKLES', 'a purple badge with a 3x3 GRID of small rounded gold and purple tiles', 'a purple badge with two crossed golden SWORDS') },
  'ach-3': { size: '1024x1024', prompt: sheet2('a purple badge with a red-and-white TARGET bullseye with a little dart', 'a purple badge with a small gold MEDAL on a ribbon', 'a purple badge with a green ARROW zig-zagging UP like a rising chart', 'a purple badge with two curved teal SHUFFLE arrows crossing') },
  'ach-4': { size: '1024x1024', prompt: sheet2('a purple badge with a big pink SPEECH BUBBLE with quote marks shaped as two dots', 'a purple badge with a golden KEY', 'a purple badge with three small rounded PEOPLE silhouettes in pink, blue and green (no faces)', 'a purple badge with a cute red-and-white CALENDAR page with a gold check') },
  'levels': { size: '1536x1024', prompt: `A 3x2 sheet of six separate glossy soft 3D RANK BADGES in a cute candy style exactly like the reference medal image (chunky, soft highlights, gentle darker lip, no characters, no faces, no text, no letters, no numbers), each big and centered in its own sixth with clear empty space between them, all the same size, transparent background. Each is a rounded hexagon gem badge with a star in the center, getting fancier left to right, top row then bottom row: 1) BRONZE (warm copper, simple), 2) SILVER (cool silver, one small wing on each side), 3) GOLD (shiny gold, small wings), 4) PLATINUM (pale lavender-white platinum with purple accents, bigger wings), 5) DIAMOND (sparkling icy-blue faceted diamond, big wings and a small crown on top), 6) a glossy GOLD CROWN emblem on a purple gem (the PRO badge).` },
};
const key = (() => { try { return fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim(); } catch { return ''; } })();
if (!key) { console.error('No key'); process.exit(1); }
const names = process.argv[2] ? process.argv[2].split(',') : Object.keys(JOBS);
for (const name of names) {
  const job = JOBS[name]; const out = path.join(OUT, `${name}.png`);
  if (fs.existsSync(out)) { console.log('skip (exists)', name); continue; }
  const form = new FormData();
  form.append('model', 'gpt-image-1'); form.append('prompt', job.prompt); form.append('size', job.size);
  form.append('quality', 'high'); form.append('background', 'transparent');
  form.append('image[]', new Blob([fs.readFileSync(path.join(BRAND, 'icons', 'medals', 'gold.png'))], { type: 'image/png' }), 'gold.png');
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.error(name, res.status, j.error?.message); continue; }
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(name, 'ok', Math.round((Date.now() - t0) / 1000) + 's');
}
