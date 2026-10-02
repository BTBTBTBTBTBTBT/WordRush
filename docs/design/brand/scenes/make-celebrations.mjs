// Celebration + popup art via the OpenAI API (founder 10-02: custom images for the Pro popup, the
// streak-shield popup, the Flawless + Sweep celebrations and the Home banner Sweep / Flawless states).
// Each image passes the characters' hero art as references so they stay on-model. Transparent.
//   node scenes/make-celebrations.mjs [name,name]     → scenes/api/<name>.png
// Key: ~/.wordocious-openai-key (never printed). gpt-image-1, high.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.dirname(HERE);
const OUT = path.join(HERE, 'api');
fs.mkdirSync(OUT, { recursive: true });

const STYLE = 'Glossy soft 3D vinyl-toy style exactly like the reference character images: chubby rounded letter-tile characters, small beady black eyes, happy friendly faces, never angry. Transparent background, no text, no letters other than each character\'s own body letter, no frame.';
const W = 'W: a chubby purple rounded-square tile with a big white "W" on his body and a small red cape';
const U = 'U: a chubby violet tile with a big white "U", calm closed eyes, floats with no feet';
const O2 = 'pink O: a chubby hot-pink tile with a big WHITE "O" ring on her body and purple heart sunglasses pushed up on her head';
const S = 'S: a chubby golden-yellow tile with a big white "S", a purple-and-white sweatband and purple sneakers';
const O1 = 'cheerleader O: a chubby amber-orange tile with a big white "O" and FOUR arms (two on each side, all four clearly visible), each hand holding a fluffy purple pom-pom (four pom-poms total)';
const D = 'D: a chubby bright-blue tile with a big white "D", round black glasses, holding a yellow pencil';
const I = 'I: a tall narrow green tile with a big white "I", a two-leaf sprout on top, rosy cheeks';

const JOBS = {
  'pro-crown': { size: '1024x1024', refs: ['w'], prompt: `${STYLE} One character, ${W}, wearing a small shiny gold crown, proudly holding up a big glowing golden star with both hands, warm golden light rays and sparkles around him, celebratory and premium. Centered, filling most of the square.` },
  'shield-guard': { size: '1024x1024', refs: ['u'], prompt: `${STYLE} One character, ${U}, floating calmly and holding up a big glowing purple-and-gold shield in front of a small cute orange flame (the streak flame, with a tiny happy face), protecting it; soft purple glow, a few sparkles. Centered, filling most of the square.` },
  'flawless-star': { size: '1024x1024', refs: ['o2'], prompt: `${STYLE} One character, ${O2}, striking a dazzling star pose on top of a big sparkling pink-and-purple faceted gem, arms up, sparkles, little stars and confetti bursting around her. Centered, filling most of the square.` },
  'sweep-broom': { size: '1024x1024', refs: ['s'], prompt: `${STYLE} One character, ${S}, riding a glossy golden broom like a racer, zooming forward with a big grin, a swirl of small colorful letter tiles and sparkles trailing behind, motion lines. Centered, filling most of the square.` },
  'banner-sweep': { size: '1536x1024', refs: ['s', 'o1', 'w'], prompt: `${STYLE} A wide celebration banner scene with three characters side by side, evenly spaced, all fully visible: on the left ${O1} cheering, in the middle ${S} holding a golden broom high like a trophy, on the right ${W} giving a big thumbs up. Confetti and sparkles around them. Fill the width evenly.` },
  'banner-flawless': { size: '1536x1024', refs: ['o2', 'd', 'i'], prompt: `${STYLE} A wide celebration banner scene with three characters side by side, evenly spaced, all fully visible: on the left ${D} clapping, in the middle ${O2} holding up a big sparkling pink gem, on the right ${I} jumping with joy. Sparkles, little stars and soft glow around them.` },
};

function readKey() {
  try { return fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim(); } catch { return ''; }
}
const key = readKey();
if (!key) { console.error('No key'); process.exit(1); }
const names = process.argv[2] ? process.argv[2].split(',') : Object.keys(JOBS);
for (const name of names) {
  const job = JOBS[name];
  const out = path.join(OUT, `${name}.png`);
  if (fs.existsSync(out)) { console.log('skip (exists)', name); continue; }
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', job.prompt);
  form.append('size', job.size);
  form.append('quality', 'high');
  form.append('background', 'transparent');
  for (const r of job.refs) {
    const p = path.join(BRAND, 'cast', 'hero', `${r}.png`);
    form.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/png' }), `${r}.png`);
  }
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.error(name, res.status, j.error?.message); continue; }
  fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(name, 'ok', Math.round((Date.now() - t0) / 1000) + 's', j.usage?.output_tokens);
}
