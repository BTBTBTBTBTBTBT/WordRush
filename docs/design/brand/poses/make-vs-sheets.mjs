// VS pose sheets via the OpenAI API (founder 10-02: ChatGPT hit its image cap; $10 added to the API,
// "let's use it wisely"). One 1024 square per character = four poses in a 2x2 grid, transparent
// background, the character's hero art as the reference so it stays on-model. Then
//   python3 poses/split-grid.py <id> --api   splits it into <id>-ready|victory|goodgame|waiting.png
// Usage: node poses/make-vs-sheets.mjs i,o2,c,u,o3,d,s   (or `sweep` for the Sweep game icon)
// Key: ~/.wordocious-openai-key (never printed). gpt-image-1, 1024x1024, high (~$0.19 each).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.dirname(HERE);
const OUT = path.join(HERE, 'api');
fs.mkdirSync(OUT, { recursive: true });

const LOOK = {
  i: 'a tall narrow GREEN rounded-rectangle letter tile with a big white "I" on its body, a two-leaf sprout on top, rosy cheeks, small beady black eyes, a shy sweet smile, stubby green arms and feet',
  o2: 'a chubby HOT-PINK rounded-square letter tile with a big glossy WHITE letter "O" ring on the front of her body (the O is WHITE like the reference, never dark), purple heart-shaped sunglasses pushed up on top of her head, small beady black eyes ABOVE the O, a sweet happy smile above the O (one eye winking in some poses), stubby pink arms and feet, always cheerful, never angry or frowning',
  c: 'a chubby TEAL rounded-square letter tile with two big round beady black eyes and NO separate mouth: the big white "C" on its body IS its mouth, with one or two small rounded white snaggleteeth hanging from the top inner edge of the C; stubby teal arms and feet',
  u: 'a chubby VIOLET-PURPLE rounded-square letter tile with a big white "U" on his body, calm closed eyes (two gentle curved lines), a serene small smile, he FLOATS with NO feet, stubby purple arms',
  o3: 'a chubby ORANGE rounded-square letter tile that is a CYCLOPS: the hole of the big white "O" on its body is ONE big round eye (white with a black pupil), a small pink tongue poking out mischievously, stubby orange arms and feet',
  d: 'a chubby BRIGHT-BLUE rounded-square letter tile with a big white "D" on his body, big round black glasses over small beady black eyes, a happy smart smile, holding a yellow pencil, stubby blue arms and feet',
  s: 'a chubby GOLDEN-YELLOW rounded-square letter tile with a big white "S" on his body, a purple-and-white sweatband on his forehead, small beady black eyes, a determined happy grin, purple sneakers, stubby yellow arms',
};
const PROPS = {
  i: ['raising a tiny watering can like a sword, shy but brave', 'jumping with joy, the sprout leaves flapping, tiny hearts', 'sitting, giving a shy little wave, blushing', 'standing, hugging a small potted seedling, looking up hopefully, a small hourglass floating beside'],
  o2: ['striking a playful star pose, one hand on hip, the other pointing forward with a big happy smile', 'twirling with a gold trophy held high, sparkles and little stars', 'sitting gracefully, blowing a kiss, a small heart floating', 'standing, checking a small hand mirror, tapping her foot'],
  c: ['peering through a small brass spyglass, ready for adventure', 'jumping with a treasure map held high, sparkles', 'sitting cross-legged with a backpack beside, smiling', 'standing on tiptoe looking around curiously, a small compass floating beside'],
  u: ['floating in a calm martial-arts stance, palms forward, serene', 'floating higher, arms raised, glowing softly, a gold trophy hovering above his hands', 'floating in a lotus pose holding a small cup of tea', 'floating in meditation, eyes closed, a small hourglass hovering beside'],
  o3: ['grinning mischievously, holding a whoopee cushion like a weapon', 'cartwheeling with joy, confetti', 'sitting on the floor laughing, tongue out', 'standing, juggling three small letter blocks, the single eye looking up'],
  d: ['pushing up his glasses, pencil raised like a sword, ready', 'jumping with a notebook held high, a gold star sticker on it, sparkles', 'sitting, writing notes in a small notebook, content smile', 'standing, scratching his head with the pencil, thinking, a small question mark floating beside'],
  s: ['crouched in a sprinter start position, ready to race', 'leaping across a finish line ribbon holding a gold trophy', 'sitting, wiping his forehead with a towel, thumbs up', 'jogging in place, checking a small stopwatch on his wrist, motion lines'],
};

function readKey() {
  try { return fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim(); } catch { return ''; }
}

function sheetPrompt(id) {
  const [a, b, c, d] = PROPS[id];
  return [
    'A 2x2 character pose sheet for a cute mobile word game, glossy soft 3D vinyl-toy style (exactly like the reference image).',
    `The SAME character in all four poses, exactly matching the reference: ${LOOK[id]}.`,
    'Four poses, one per quarter, each character big and centered in its quarter with clear empty space around it; nothing crosses the middle lines; every prop fully visible, nothing cropped:',
    `top-left "ready to battle": ${a};`,
    `top-right "victory": ${b};`,
    `bottom-left "good game": ${c};`,
    `bottom-right "waiting": ${d}.`,
    'Friendly and happy expressions, never angry, no eyebrows. Transparent background. No text, no frames, no other characters, no ground shadows.',
  ].join(' ');
}

const SWEEP = [
  'One game icon for a cute mobile word game, in the same glossy soft 3D style as the reference (chunky, bold, simple silhouette that reads at small sizes):',
  'a cute glossy 3D BROOM mid-sweep, golden-amber straw head tied with a purple band, a warm wooden handle, three small gold sparkles and a little swoosh of motion lines beside it.',
  'No face, no text. Centered, filling most of the square with even margins. Transparent background.',
].join(' ');

const key = readKey();
if (!key) { console.error('No key'); process.exit(1); }
const ids = (process.argv[2] || 'i,o2,c,u,o3,d,s').split(',');
for (const id of ids) {
  const out = path.join(OUT, id === 'sweep' ? 'game-sweep.png' : `${id}-vs-sheet.png`);
  if (fs.existsSync(out)) { console.log('skip (exists)', out); continue; }
  const ref = id === 'sweep' ? path.join(BRAND, 'games', 'gauntlet.png') : path.join(BRAND, 'cast', 'hero', `${id}.png`);
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', id === 'sweep' ? SWEEP : sheetPrompt(id));
  form.append('size', '1024x1024');
  form.append('quality', 'high');
  form.append('background', 'transparent');
  form.append('n', '1');
  form.append('image[]', new Blob([fs.readFileSync(ref)], { type: 'image/png' }), path.basename(ref));
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.error(id, res.status, j.error?.message); continue; }
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(id, 'ok', Math.round((Date.now() - t0) / 1000) + 's', j.usage ? JSON.stringify(j.usage) : '');
}
