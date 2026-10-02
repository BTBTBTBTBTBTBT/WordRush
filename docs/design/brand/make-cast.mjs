// The WORDOCIOUS mascot cast as production art (founder-approved cast,
// docs/design/brand/chatgpt/12-cast-final.png). gpt-image-1 image EDITS with the
// final cast sheet + the character's own crop as references, transparent PNG,
// 1024x1024, high quality. Key: ~/.wordocious-openai-key (never printed).
//   node make-cast.mjs [--only w,o1] [--pose hero] [--dry]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const ONLY = arg('only', '');
const POSE = arg('pose', 'hero');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REFS = path.join(HERE, 'refs');
const OUT = path.join(HERE, 'cast', POSE);

const STYLE = [
  'Use the attached reference images: the first is the approved Wordocious mascot cast sheet, the second is the exact character to draw.',
  'Redraw ONLY that one character, matching the reference exactly: same tile shape, colors, face, letter, proportions and signature feature.',
  'Chubby rounded letter-tile body, the letter in bold white rounded type on its front, small simple face (dot eyes, small mouth), tiny stubby arms and feet,',
  'crisp polished vector-like 3D render with soft gradients and gentle highlights, no outlines, no sparkles.',
  'Full body, centered, filling about 80% of a square canvas, a soft contact shadow directly under the feet is fine.',
  'Transparent background. No other text, no other characters, no frame.',
].join(' ');

const CAST = {
  w: 'W: purple (#7c3aed with a purple-to-pink gradient) confident leader, small smirk, a tiny flowing purple cape behind it',
  o1: 'O: amber (#f59e0b) bubbly cheerleader with FOUR arms, the top two holding purple pom-poms, jumping happily',
  r: 'R: slate gray (#94a3b8) sleepy and chill, half-closed eyes, a droopy lavender nightcap with a white pom-pom',
  d: 'D: blue (#2563eb) brainy, round black glasses, a yellow pencil standing at its side',
  o2: 'O: hot pink (#ec4899) dramatic star, heart-shaped pink sunglasses pushed up on top, winking, hand on hip',
  c: 'C: teal (#0891b2) curious explorer; the white C letter itself is its mouth with two small rounded snaggleteeth inside the C opening, two wide eyes above, no dark interior, no tongue',
  i: 'I: green (#059669) tall slim tile, shy and sweet, blushing cheeks, a small two-leaf sprout growing from its top',
  o3: 'O: orange (#f97316) goofy prankster CYCLOPS: the white O letter is one big round eye with a dark pupil, a small pink tongue below, nothing else white',
  u: 'U: violet (#7e22ce) zen and calm, eyes closed, serene smile, no feet, floating above a soft shadow',
  s: 'S: gold (#ca8a04) speedy competitor, a white-and-purple headband, tiny purple sneakers, mid-run with motion lines',
};

const POSES = {
  hero: 'Pose: its signature pose from the reference.',
  cheer: 'Pose: celebrating a big win, both arms up, joyful open smile, a little jump.',
  wave: 'Pose: friendly hello wave toward the viewer.',
  think: 'Pose: thinking, one hand on its chin, looking up curiously.',
  sleep: 'Pose: sitting down asleep, eyes closed, a small "z" floating is NOT allowed (no text), just peaceful.',
  sad: 'Pose: a gentle aw-shucks shrug after a loss, small smile, not crying.',
};

function readKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim(); } catch { return ''; }
}

const names = ONLY ? ONLY.split(',') : Object.keys(CAST);
console.log(`${names.length} images (${POSE}), ~$${(names.length * 0.19).toFixed(2)}`);
if (DRY) process.exit(0);
const key = readKey();
if (!key) { console.error('No key'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

for (const n of names) {
  const file = path.join(OUT, `${n}.png`);
  if (fs.existsSync(file)) { console.log('skip', n); continue; }
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', `${STYLE}\n\nCharacter: ${CAST[n]}.\n${POSES[POSE] ?? POSES.hero}`);
  form.append('size', '1024x1024');
  form.append('quality', 'high');
  form.append('background', 'transparent');
  form.append('output_format', 'png');
  form.append('input_fidelity', 'high');
  for (const ref of ['cast-sheet.png', `${n}.png`]) {
    form.append('image[]', new Blob([fs.readFileSync(path.join(REFS, ref))], { type: 'image/png' }), ref);
  }
  let done = false;
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    const j = await res.json();
    if (res.ok) { fs.writeFileSync(file, Buffer.from(j.data[0].b64_json, 'base64')); console.log('wrote', n); done = true; break; }
    const code = j.error?.code ?? '';
    console.error(n, res.status, code, (j.error?.message ?? '').split('sk-')[0].slice(0, 160));
    if (res.status === 429 && code !== 'insufficient_quota') { await new Promise((r) => setTimeout(r, 15000)); continue; }
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 13000));
}
