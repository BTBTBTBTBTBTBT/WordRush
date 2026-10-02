// Section-title lettering via the OpenAI API when ChatGPT is capped (founder 10-02). Uses an existing
// lettering image as the STYLE reference so it matches DAILIES / PUZZLES exactly. Transparent.
//   node titles/make-lettering-api.mjs "VS BATTLE" vs-battle-lettering-keyed.png
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [text, outName] = process.argv.slice(2);
const key = fs.readFileSync(path.join(os.homedir(), '.wordocious-openai-key'), 'utf8').trim();
const prompt = `Game title lettering that reads exactly "${text}" on ONE SINGLE HORIZONTAL LINE (all words side by side in one row, never stacked), in EXACTLY the same lettering style as the reference image: chunky rounded puffy bubble capitals, a vertical purple-to-magenta-pink gradient, white glossy shine on top of each letter, a thin golden-yellow outline, and a darker purple 3D depth underneath, same letter weight and proportions. Spell it exactly "${text}" — every letter correct, evenly spaced, centered, all letters fully visible with margin. No characters, no sparkles, no other text. Transparent background.`;
const form = new FormData();
form.append('model', 'gpt-image-1'); form.append('prompt', prompt); form.append('size', '1536x1024');
form.append('quality', 'high'); form.append('background', 'transparent');
form.append('image[]', new Blob([fs.readFileSync(path.join(HERE, 'dailies-lettering-keyed.png'))], { type: 'image/png' }), 'dailies.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
const j = await res.json();
if (!res.ok) { console.error(res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(HERE, outName), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', outName, j.usage?.output_tokens);
