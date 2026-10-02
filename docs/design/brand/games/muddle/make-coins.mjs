// Starsweep game pieces (founder 10-02: "chatgpt design making the stars and board to match the clean
// aesthetic"). One transparent 2x2 sheet → split by poses/split-api.py-style centroid split.
// Key: ~/.wordocious-openai-key (never printed). gpt-image-1 high.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.resolve(HERE, '..', '..');
const key = fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim();
const prompt = [
  'A 2x2 sheet of four BLANK round game tokens (coins) for a cute mobile word puzzle, in the same glossy soft 3D candy style as the reference icon: perfectly round, chunky, a soft glossy highlight across the top half, a slightly darker rim/lip at the bottom so they look pressable, NO letters, NO text, NO symbols, no faces — the center must stay clean and empty because a letter will be placed on top later.',
  'Each token big and centered in its own quarter, all exactly the same size, nothing crossing the middle lines, transparent background:',
  'top-left: an EMPTY slot token — frosted pale lilac glass (#efe7ff), translucent-looking, with a thin soft gold ring around the edge;',
  'top-right: a FILLED token — glossy bright purple (#8b5cf6 to #6d28d9) with a shiny GOLD rim ring around the edge;',
  'bottom-left: a HINT token — glossy soft violet (#a78bfa) with a gold rim ring and one tiny white sparkle near the top-right edge;',
  'bottom-right: a PUNCHLINE token — glossy warm gold (#ffd166 to #f5a524) with a slightly darker amber rim ring.',
  'Clean, premium, readable at small sizes.',
].join(' ');
const form = new FormData();
form.append('model', 'gpt-image-1'); form.append('prompt', prompt); form.append('size', '1024x1024');
form.append('quality', 'high'); form.append('background', 'transparent');
form.append('image[]', new Blob([fs.readFileSync(path.join(BRAND, 'games', 'scramble.png'))], { type: 'image/png' }), 'regions.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
const j = await res.json();
if (!res.ok) { console.error(res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'coins-sheet.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', j.usage?.output_tokens);
