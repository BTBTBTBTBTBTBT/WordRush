// VS bot characters, designed by gpt-image-1 with the founder's own key
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
const MAX_USD = 4;
const USD = 0.17;

const STYLE = [
  'A single mascot character for Wordocious, a clean, modern word-puzzle app.',
  'Head and shoulders, centered, facing the viewer, filling most of a square canvas.',
  'Flat vector illustration with soft rounded shapes, smooth gentle gradients and one soft highlight; very thin or no outlines; polished and minimal like a premium iOS app mascot, not 3D-rendered, not photographic.',
  'Friendly and charming, readable as a small round avatar at 40 pixels: one strong silhouette, big simple eyes, few details.',
  'Transparent background. No text, no letters, no numbers, no logos, no frame, no ground shadow.',
].join(' ');

const BOTS = {
  rook: 'Rook, the easy bot: a small, round, cheerful beginner robot, a little clumsy and eager. Its head has a short crenellated top like a chess rook tower. Big round friendly eyes, one stubby antenna with a ball. Mint and teal body (#14b8a6, #99f6e4, #ccfbf1) with white face panel.',
  lexi: 'Lexi, the medium bot: a clever, bookish robot with a visor shaped like round reading glasses and a small glowing pattern on its forehead panel. Confident half-smile. Violet and lavender body (#7c3aed, #a78bfa, #ede9fe) with white face panel.',
  nova: 'Nova, the hard bot: a sleek, fast robot with a crest shaped like a lightning bolt and glowing amber eyes, focused and determined expression. Deep indigo body (#3730a3) with hot pink and amber accents (#ec4899, #f59e0b).',
  adapt: 'Adapt, the bot that matches your level: a calm, balanced robot whose body is split cleanly in two colors, blue on one side and violet on the other (#2563eb, #7c3aed), with a serene, knowing expression and two small round ear-discs like the pans of a balance.',
  ghost: 'Ghost, the replay of the player\'s own best game: a soft, translucent lavender ghost shaped like a friendly robot, faint inner glow, wispy rounded tail instead of a body, playful smile (#c4b5fd, #ede9fe, white).',
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
