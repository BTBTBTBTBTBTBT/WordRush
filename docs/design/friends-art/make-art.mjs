// Friends pocket-game art (Rock Paper Scissors, Call It coin), designed by gpt-image-1 with the founder's own key
// (~/.wordocious-openai-key, never printed). Two takes per bot, 1024x1024,
// transparent PNG, high quality ≈ $0.17 each → about $1.70 for the set.
//   node make-bots.mjs [--only rook,lexi] [--n 2] [--dry]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const N = Number(arg('n', 2));
const ONLY = arg('only', '');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
const MAX_USD = 3;
const USD = 0.17;

const STYLE = [
  'A single object illustration for Wordocious, a clean, modern word-puzzle app, part of a matching set.',
  'Centered, three-quarter view, filling most of a square canvas.',
  'Flat vector illustration with soft rounded shapes, smooth gentle gradients and one soft highlight; very thin or no outlines; polished and minimal like a premium iOS game icon, not 3D-rendered, not photographic.',
  'Friendly and charming, readable at 64 pixels: one strong silhouette, few details.',
  'Transparent background. No text, no letters, no numbers, no logos, no frame, no ground shadow, no hands.',
].join(' ');

const BOTS = {
  rock: 'A smooth, rounded pebble-shaped rock with a cute chunky feel, violet-to-purple gradient (#7c3aed, #a78bfa) with a soft lavender highlight.',
  paper: 'A single sheet of paper with one folded corner and a gentle curl, warm white with soft amber shading (#fde68a, #f59e0b) on the fold.',
  scissors: 'A pair of open scissors with rounded hot-pink handles (#ec4899, #db2777) and soft silver blades.',
  heads: 'A shiny gold coin seen face-on (#fcd34d, #d97706), with a bold rounded capital letter W embossed in the center in a purple-to-pink gradient (#a855f7, #ec4899). The W is the only letter.',
  tails: 'The back of the same shiny gold coin seen face-on (#fcd34d, #d97706), with a small rounded square game tile embossed in the center in amber (#f59e0b). No letters.',
};

function readKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim(); } catch { return ''; }
}

const names = ONLY ? ONLY.split(',') : Object.keys(BOTS);
const jobs = names.flatMap((b) => Array.from({ length: N }, (_, i) => ({ b, i: i + 1 })));
console.log(`${jobs.length} images, est. $${(jobs.length * USD).toFixed(2)} (cap $${MAX_USD})`);
if (jobs.length * USD > MAX_USD) { console.error('Refusing: over the cap.'); process.exit(1); }
if (DRY) { for (const j of jobs) console.log(j.b, j.i, '\n ', STYLE, BOTS[j.b]); process.exit(0); }
const key = readKey();
if (!key) { console.error('No key in ~/.wordocious-openai-key'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

await Promise.all(jobs.map(async ({ b, i }) => {
  const file = path.join(OUT, `${b}-${i}.png`);
  if (fs.existsSync(file)) { console.log('skip', file); return; }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: `${STYLE}\n\n${BOTS[b]}`, size: '1024x1024', quality: 'high', background: 'transparent', output_format: 'png', n: 1 }),
  });
  const j = await res.json();
  if (!res.ok) { console.error(b, i, res.status, j.error?.code, j.error?.message?.split('sk-')[0]); return; }
  fs.writeFileSync(file, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('wrote', file);
}));
