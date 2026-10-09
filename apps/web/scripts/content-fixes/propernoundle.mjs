// ProperNoundle + unshipped holiday word lists — content fixes from the 2026-10-06 content audit
// (REPORT-CONTENT-FIXES.md). ProperNoundle's rotation wraps forever, so only entries NEVER served yet are
// edited in place (holiday entries not yet served, and rotation entries whose first outing is after
// CONTENT_RELEASE_DATE); ids are kept. The replacements are well-known US names, ≤ 15 letters, not
// already in either file. The holiday answer / Word-of-the-Day tables (scripts/holidays/*.json) are not
// wired into any runtime yet; their British/alcohol picks are swapped too. Prints changes as JSON.
//   node apps/web/scripts/content-fixes/propernoundle.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { DATA, WEB, readJSON } from '../more-games/lib.mjs';

const DRY = process.argv.includes('--dry');
const mainPath = path.join(DATA, 'propernoundle-puzzles.json'), holPath = path.join(DATA, 'propernoundle-holidays.json');
const main = readJSON(mainPath), hol = readJSON(holPath);
const key = (d) => d.toLowerCase().replace(/[^a-z]/g, '');
/** id → [display, category, themeCategory, wikiTitle] (holiday ids use Wikipedia underscores like their file). */
const PN = {
  // Holiday entries that repeat a rotation answer, or that few players know.
  'hol-aprilfools-1': ['Globetrotters', 'other', 'sports', 'Harlem_Globetrotters'],
  'hol-veterans-1': ['Purple Heart', 'other', 'history', 'Purple_Heart'],
  'hol-kwanzaa-1': ['Africa', 'geography', 'history', 'Africa'],
  'hol-aprilfools-2': ['Jimmy Kimmel', 'celebrity', 'currentevents', 'Jimmy_Kimmel'],
  'hol-juneteenth-2': ['Sojourner Truth', 'celebrity', 'history', 'Sojourner_Truth'],
  'hol-july4-2': ['Uncle Sam', 'other', 'history', 'Uncle_Sam'],
  'hol-labor-2': ['Cesar Chavez', 'celebrity', 'history', 'Cesar_Chavez'],
  'hol-indigenous-2': ['Geronimo', 'celebrity', 'history', 'Geronimo'],
  'hol-diwali-2': ['India', 'geography', 'history', 'India'],
  'hol-mlkday-1': ['Lincoln Memorial', 'geography', 'history', 'Lincoln_Memorial'],
  'hol-presidents-1': ['White House', 'geography', 'history', 'White_House'],
  'hol-leapday-1': ['Julian Calendar', 'other', 'history', 'Julian_calendar'],
  'hol-mothersday-1': ['Mother Goose', 'other', 'history', 'Mother_Goose'],
  'hol-earthday-1': ['Bill Nye', 'celebrity', 'science', 'Bill_Nye'],
  'hol-lunarnewyear-2': ['Chinatown', 'geography', 'history', 'Chinatown'],
  'hol-cincodemayo-2': ['Frida Kahlo', 'celebrity', 'history', 'Frida_Kahlo'],
  'hol-mardigras-2': ['Louis Armstrong', 'celebrity', 'music', 'Louis_Armstrong'],
  'hol-leapday-2': ['Kermit the Frog', 'other', 'movies', 'Kermit_the_Frog'],
  // Rotation entries not served yet: niche tech names → household ones; a display typo.
  geo081: ['Alexa', 'other', 'currentevents', 'Amazon Alexa'],
  geo082: ['Zoom', 'other', 'currentevents', 'Zoom (software)'],
  geo084: ['Labubu', 'other', 'currentevents', 'Labubu'],
  geo098: ['PayPal', 'other', 'currentevents', 'PayPal'],
  geo083: ['Etsy', 'other', 'currentevents', 'Etsy'],
  cur113: ['Viola Davis', 'celebrity', 'currentevents', ''],
  cur114: ["Lupita Nyong'o", 'celebrity', 'currentevents', ''],
};
/** Served on 2026-10-12 (before CONTENT_RELEASE_DATE) — listed, not changed. */
const SERVED = new Set(['hol-indigenous-1']);
const changes = [];
const holEntries = Object.values(hol.holiday).flat();
const answers = () => new Set([...main, ...holEntries].map((p) => p.answer));
for (const [id, [display, category, themeCategory, wikiTitle]] of Object.entries(PN)) {
  if (SERVED.has(id)) continue;
  const p = main.find((x) => x.id === id) ?? holEntries.find((x) => x.id === id);
  if (!p) throw new Error(`no ${id}`);
  const answer = key(display);
  if (answer.length > 15 || answer.length < 3) throw new Error(`${id}: ${answer} length`);
  if (answer !== p.answer && answers().has(answer)) throw new Error(`${id}: ${display} already in ProperNoundle`);
  changes.push({ game: 'propernoundle', id, old: `${p.display} (${p.themeCategory})`, new: `${display} (${themeCategory})` });
  Object.assign(p, { answer, display, category, themeCategory });
  if ('wikiTitle' in p) p.wikiTitle = wikiTitle;
}
// Holiday answer / WotD tables (scripts/holidays) — not wired into runtime yet, fixed so they ship clean.
const haPath = path.join(WEB, 'scripts', 'holidays', 'holiday-answers.json');
const ha = readJSON(haPath);
const HA = { leapday: { JUMPER: 'HOPPER', YEARLY: 'RARITY' }, stpatricks: { PINTS: 'PIPES', STOUT: 'REELS', BREWER: 'LEGEND', BREWS: 'SAINT' }, diwali: { SWEETS: 'SPARKS' } };
for (const [h, m] of Object.entries(HA)) for (const [o, n] of Object.entries(m)) {
  const len = String(o.length), list = ha[h][len]; const i = list.indexOf(o);
  if (i < 0) throw new Error(`${h}/${o}`); if (Object.values(ha).some((x) => (x[len] || []).includes(n))) throw new Error(`${n} already listed`);
  list[i] = n; changes.push({ game: 'holiday-answers', id: `${h}/${len}`, old: o, new: n });
}
if (!DRY) {
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2) + '\n');
  fs.writeFileSync(holPath, JSON.stringify(hol, null, 2) + '\n');
  fs.writeFileSync(haPath, fs.readFileSync(haPath, 'utf8').replace(/"(JUMPER|YEARLY|PINTS|STOUT|BREWER|BREWS|SWEETS)"/g, (m, w) => `"${Object.values(HA).find((x) => x[w])[w]}"`));
}
console.log(JSON.stringify(changes));
