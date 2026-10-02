// Starsweep game pieces (founder 10-02: "chatgpt design making the stars and board to match the clean
// aesthetic"). One transparent 2x2 sheet → split by poses/split-api.py-style centroid split.
// Key: ~/.wordocious-openai-key (never printed). gpt-image-1 high.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.resolve(HERE, '..', '..');
const key = fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim();
const prompt = [
  'A 2x2 sheet of four GAME PIECES for a cute mobile puzzle game, in the same glossy soft 3D candy style as the reference icon (chunky, rounded, soft highlights, a gentle darker lip at the bottom, no faces, no text).',
  'Each piece big and centered in its own quarter, same size, nothing crossing the middle lines, transparent background:',
  'top-left: a chunky rounded five-point STAR in deep navy / midnight indigo, glossy (a placed but unchecked star);',
  'top-right: the same star shape in bright glossy PURPLE (#8b5cf6 to #6d28d9) with two tiny white sparkles (a correct star);',
  'bottom-left: the same star shape in glossy coral RED (#f0435f) with a small soft crack line (a wrong star);',
  'bottom-right: a soft rounded "X" marker made of two chunky rounded bars in pale lilac-grey (#b9aedb), glossy (a crossed-out cell).',
  'Clean, minimal, readable at small sizes.',
].join(' ');
const form = new FormData();
form.append('model', 'gpt-image-1'); form.append('prompt', prompt); form.append('size', '1024x1024');
form.append('quality', 'high'); form.append('background', 'transparent');
form.append('image[]', new Blob([fs.readFileSync(path.join(BRAND, 'games', 'regions.png'))], { type: 'image/png' }), 'regions.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
const j = await res.json();
if (!res.ok) { console.error(res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'pieces-sheet.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', j.usage?.output_tokens);
