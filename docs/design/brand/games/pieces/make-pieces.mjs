// Starsweep game pieces (founder 10-02: "chatgpt design making the stars and board to match the clean
// aesthetic"). One transparent 2x2 sheet → split by poses/split-api.py-style centroid split.
// Key: ~/.wordocious-openai-key (never printed). gpt-image-1 high.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.resolve(HERE, '..', '..');
const key = fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim();
const prompt = [
  'A 2x2 sheet of four BLANK game pieces for a cute mobile word game, in the same glossy soft 3D candy style as the reference icon: chunky, soft glossy highlight across the top half, a slightly darker lip at the bottom so they look pressable, no faces, no text.',
  'Each piece big and centered in its own quarter, the two hexagons exactly the same size, nothing crossing the middle lines, transparent background:',
  'top-left: a flat-topped rounded HEXAGON tile in soft glossy lilac (#c4b5fd to #a78bfa) with a clean EMPTY center (a letter will be drawn on it later);',
  'top-right: the same rounded HEXAGON in glossy warm GOLD (#ffd166 to #f5a524) with a clean EMPTY center (the special center tile);',
  'bottom-left: a chunky glossy "X" game piece made of two rounded bars, bright purple (#8b5cf6 to #6d28d9);',
  'bottom-right: a chunky glossy "O" ring game piece, hot pink (#f472b6 to #db2777).',
  'Clean, premium, readable at small sizes.',
].join(' ');
const form = new FormData();
form.append('model', 'gpt-image-1'); form.append('prompt', prompt); form.append('size', '1024x1024');
form.append('quality', 'high'); form.append('background', 'transparent');
form.append('image[]', new Blob([fs.readFileSync(path.join(BRAND, 'games', 'hub.png'))], { type: 'image/png' }), 'regions.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
const j = await res.json();
if (!res.ok) { console.error(res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'pieces-sheet.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', j.usage?.output_tokens);
