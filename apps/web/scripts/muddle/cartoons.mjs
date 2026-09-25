// Muddle cartoon batch (More Games §5 + §8) — the ONE step that needs the
// founder's own OpenAI key. Generates the single-panel gag cartoon for each
// puzzle in apps/web/data/scramble-puzzles.json (holidays first, then dailies, then
// Unlimited), converts it to an 800×600 WebP, saves it under
// apps/web/public/muddle/<id>-<hash>.webp and writes the file name back into
// the bank's `cartoon` field. Idempotent: puzzles that already have a cartoon
// are skipped, so it can be run in batches (start with --limit 10 for the
// style check the founder approved on 2026-09-22).
//
// The key is read from the OPENAI_API_KEY environment variable or from the
// file ~/.wordocious-openai-key (a single line). It is never printed, never
// logged, never written anywhere else.
//
//   OPENAI_API_KEY=… node apps/web/scripts/muddle/cartoons.mjs --limit 10 [--dry] [--model gpt-image-1] [--quality high] [--holiday christmas] [--concurrency 4] [--gap-ms 12500]
//
// Cost guard: --max-usd (default 40) stops the run once the estimated spend
// (--usd-per-image, default 0.07) would exceed it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { DATA, WEB, readJSON } from '../more-games/lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const LIMIT = Number(arg('limit', 10));
const DRY = process.argv.includes('--dry');
const MODEL = arg('model', 'gpt-image-1');
const QUALITY = arg('quality', 'high');
const SIZE = arg('size', '1536x1024');           // 3:2 from the API, cropped to 4:3 below
const ONLY_HOLIDAY = arg('holiday', null);
const MAX_USD = Number(arg('max-usd', 40));
const USD_PER_IMAGE = Number(arg('usd-per-image', QUALITY === 'high' ? 0.25 : QUALITY === 'medium' ? 0.07 : 0.02)); // measured 2026-09-23: high 1536x1024 ≈ $0.25

// The fixed style spec (§8): one artist for the whole year, no text in the image.
const STYLE = 'Single-panel newspaper gag cartoon, confident black ink outlines, flat limited palette on cream paper (#fdf8ec) with purple (#7c3aed) and orange (#f97316) as the only saturated accents and warm grays, one or two characters with expressive faces, generous margins. No text, lettering, captions, signage or speech bubbles anywhere in the image.';

function readKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const p = path.join(os.homedir(), '.wordocious-openai-key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  return null;
}

const bankPath = path.join(DATA, 'scramble-puzzles.json');
const bank = readJSON(bankPath);
const jokes = readJSON(path.join(WEB, 'scripts', 'muddle', 'jokes.json'));
const sceneFor = new Map(jokes.map((j) => [j.final.replace(/[^A-Z]/g, ''), j.scene]));
const outDir = path.join(WEB, 'public', 'muddle');
fs.mkdirSync(outDir, { recursive: true });

// Holiday puzzles first: they are pinned to dates, so a run that stops early must never leave one without art.
const queue = [
  ...Object.entries(bank.holiday || {}).filter(([k]) => !ONLY_HOLIDAY || k === ONLY_HOLIDAY).flatMap(([, list]) => list),
  ...bank.daily,
  ...bank.extra,
].filter((p) => !p.cartoon && (!ONLY_HOLIDAY || p.holiday === ONLY_HOLIDAY));
const todo = queue.slice(0, LIMIT);
console.log(`${queue.length} puzzles without a cartoon; doing ${todo.length} (limit ${LIMIT}); est. $${(todo.length * USD_PER_IMAGE).toFixed(2)} at $${USD_PER_IMAGE}/image, cap $${MAX_USD}`);
if (todo.length * USD_PER_IMAGE > MAX_USD) { console.error(`Refusing: estimated spend exceeds --max-usd ${MAX_USD}. Lower --limit or raise the cap deliberately.`); process.exit(1); }

const key = DRY ? 'dry' : readKey();
if (!key) { console.error('No key. Set OPENAI_API_KEY in this shell or put the key on one line in ~/.wordocious-openai-key (chmod 600). Never paste it into chat.'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The org limit for gpt-image is 5 images per minute (measured 2026-09-23): start at most one request every 12.5 s,
// and on a 429 wait the time the API asks for and try again rather than skipping the puzzle.
const START_GAP_MS = Number(arg('gap-ms', 12500));
let nextStartAt = 0;
async function paceStart() {
  const now = Date.now();
  const at = Math.max(now, nextStartAt);
  nextStartAt = at + START_GAP_MS;
  if (at > now) await sleep(at - now);
}
async function generate(prompt) {
  for (let attempt = 1; ; attempt++) {
    await paceStart();
    const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1, output_format: 'png' }),
  });
    if (res.status === 429 && attempt < 12) {
      const t = await res.text();
      const m = t.match(/try again in ([\d.]+)\s*(m?s)/i);
      const waitMs = m ? Math.ceil(parseFloat(m[1]) * (m[2].toLowerCase() === 'ms' ? 1 : 1000)) + 500 : 15000;
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) { const t = await res.text(); throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`); }
    const json = await res.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error('no image in response');
    return Buffer.from(b64, 'base64');
  }
}

const CONCURRENCY = Math.max(1, Number(arg('concurrency', 4)));
let done = 0, spent = 0;
async function work(p) {
  const letters = p.final.answer.replace(/[^A-Z]/g, '');
  const scene = sceneFor.get(letters);
  if (!scene) { console.log(`  skip ${p.id}: no scene in jokes.json`); return; }
  const prompt = `${STYLE} Scene: ${scene}`;
  if (DRY) { console.log(`  [dry] ${p.id} ← ${scene.slice(0, 80)}…`); return; }
  try {
    const png = await generate(prompt);
    // Center-crop to 4:3 and shrink to 800×600 WebP (~40–80 KB), hash-named so the CDN can cache forever.
    const webp = await sharp(png).resize(800, 600, { fit: 'cover', position: 'center' }).webp({ quality: 82 }).toBuffer();
    const hash = crypto.createHash('sha256').update(webp).digest('hex').slice(0, 10);
    const file = `${p.id}-${hash}.webp`;
    fs.writeFileSync(path.join(outDir, file), webp);
    p.cartoon = file;
    done++; spent += USD_PER_IMAGE;
    fs.writeFileSync(bankPath, JSON.stringify(bank) + '\n');   // save after every image so a stop loses nothing
    console.log(`  ${p.id} → ${file} (${Math.round(webp.length / 1024)} KB)`);
  } catch (e) {
    console.error(`  ${p.id} FAILED: ${e.message}`);
  }
}
// A small pool: CONCURRENCY puzzles in flight at once (the API allows a handful per minute; default 4).
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
  while (next < todo.length) { const p = todo[next++]; await work(p); }
}));
console.log(`done ${done}/${todo.length}; est. spent $${spent.toFixed(2)}. Next: copy apps/web/data/scramble-puzzles.json over the iOS/Android copies (bank-sync) and review the images in apps/web/public/muddle/.`);
