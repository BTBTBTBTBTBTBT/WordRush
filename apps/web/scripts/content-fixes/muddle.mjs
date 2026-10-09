// Muddle content fixes from the 2026-10-06 content audit (REPORT-CONTENT-FIXES.md). FUTURE puzzles only
// (dailies from CONTENT_RELEASE_DATE, Unlimited, holiday entries not yet served); ids, cartoons and
// schedule positions are kept. Each swapped scramble word keeps the punchline letters it feeds (circled
// letters re-pointed), passes compose.mjs's own rules (5–6 letters, a valid guess with ONE arrangement,
// not on the never/tone/profanity lists, not in the punchline or caption) and gets a fresh scramble by the
// same rule (moves ≥ n−1 letters, not itself a word, no blocked substring). Prints every change as JSON.
//   node apps/web/scripts/content-fixes/muddle.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { WEB, DATA, readJSON, upperList, neverAnswer, wordset, rngFor, shuffle } from '../more-games/lib.mjs';
import { CONTENT_RELEASE_DATE } from '../content-release-date.mjs';
import { liveFrom, dec } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const file = path.join(DATA, 'scramble-puzzles.json');
const bank = readJSON(file);
const composeSrc = fs.readFileSync(path.join(WEB, 'scripts', 'muddle', 'compose.mjs'), 'utf8');
const TONE = new Set([...composeSrc.slice(composeSrc.indexOf('const TONE'), composeSrc.indexOf(']);', composeSrc.indexOf('const TONE'))).matchAll(/'([A-Z]+)'/g)].map((m) => m[1]));
const never = neverAnswer(), hard = new Set([...wordset('profanity-exact.generated.txt'), ...wordset('offensive-blocklist.txt')]);
const sig = (w) => [...w].sort().join('');
// Nothing an answer-swap batch removes, and nothing British (the guard lists), may come back in as a Muddle word.
const swapKeys = new Set([...fs.readFileSync(path.join(WEB, '..', '..', 'packages', 'core', 'src', 'solution-swaps.ts'), 'utf8').matchAll(/^  ([A-Z]+): '/gm)].map((m) => m[1]));
const spellSrc = fs.readFileSync(path.join(WEB, 'scripts', 'spelling-copy.test.ts'), 'utf8');
const BRIT = new Set([...spellSrc.slice(spellSrc.indexOf('const WORDS'), spellSrc.indexOf('];', spellSrc.indexOf('const WORDS'))).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase()));
for (const l of fs.readFileSync(path.join(WEB, 'scripts', 'data', 'brit-words-extended.txt'), 'utf8').split('\n')) if (l && !l.startsWith('#')) BRIT.add(l.split(/\s+/)[0]);
const allowedAll = new Set([...upperList('allowed.json'), ...upperList('allowed-6.json')]);
const anagrams = new Map(); for (const w of allowedAll) anagrams.set(sig(w), (anagrams.get(sig(w)) || 0) + 1);

/** [puzzle id, old word, new word] — circled letters are re-pointed automatically. */
const WORD_SWAPS = [
  ['md-9guhqs', dec('U0hJVFRZ'), 'GRITTY'], ['md-ikz7lk', dec('RlVDS0VE'), 'FORKED'],
  ['md-83zqje', 'MOZART', 'NORMAL'], ['md-lh3wjv', 'NISSAN', 'STAIRS'], ['md-d4bohx', dec('SE9PS1VQ'), 'COOKIE'],
  ['md-szxpv4', 'CICERO', 'CIRCUS'], ['md-u3blw', 'GHETTO', 'SHADOW'], ['md-w4wkda', 'NOUGHT', 'KNIGHT'],
  ['md-mil0k3', 'CUTLER', 'CUTTER'], ['md-htmnde', 'WRIGHT', 'GROWTH'], ['md-qogggt', 'TIPPLE', 'TICKET'],
  ['md-fwykwn', 'TRUMP', 'GROUP'], ['md-u9qycg', 'TRUMP', 'PILOT'], ['md-jfmjrv', 'APACHE', 'POCKET'],
  ['md-d0znq6', 'TRUMP', 'MOTOR'], ['md-92xx09', 'TRUMP', 'PROUD'], ['md-oe7pqy', 'BLANC', 'BLAND'],
  ['md-2j1lhi', 'SURREY', 'SURFER'], ['md-gwv8cd', 'HIPPY', 'SHINY'], ['md-uvzpf', 'RANDY', 'CANDY'],
  ['md-sqj970', 'QUAKER', 'QUAINT'], ['md-2fse5h', 'DUCHY', 'CHILD'], ['md-zfg05e', 'SURREY', 'ARROWS'],
  ['md-lknlj6', 'DUCHY', 'LUCKY'], ['md-wxsn77', 'TRUMP', 'PROUD'], ['md-m824u4', 'BETHEL', 'BOTTLE'],
  ['md-wfr8ri', dec('Q1JPVENI'), 'SKETCH'], ['md-iumrhz', 'OILERS', 'WINTER'], ['md-o0pqks', 'DISTAL', 'LIFTED'],
  ['md-svp1cq', 'DHARMA', 'AFRAID'], ['md-jqqagi', 'CAIRNS', 'CINDER'], ['md-gppuqh', 'DHARMA', 'DRIVER'],
  ['md-9tzrux', 'HARPER', 'PIRATE'], ['md-5fxgl7', 'PLANAR', 'NAPKIN'], ['md-dnzkoz', 'BOOTY', 'BOOTH'],
  ['md-rhjyb3', 'SEXTON', 'BASKET'], ['md-8k0zrq', 'SEXTON', 'SUNSET'],
];
/** British punchlines rebuilt to the American form (same scene, so the cartoon still fits). */
const FINALS = {
  // H***** fed H, K and P; no common clean word carries all three, so PIANO takes the P from ALIAS's slot.
  'md-krfti8': { final: 'PUMPKIN PATCH', words: { ALIAS: 'PIANO', [dec('SE9PS1VQ')]: 'HOCKEY' } },
  'md-8upzsk': { final: 'HIGH STRUNG', words: {} },
  'md-2i7t2x': { final: 'LOST AND FOUND', words: { CREPT: 'TREND', HEFTY: 'AUDIT', IMPORT: 'FONDUE' },
    caption: "The town's wandering cottage finally turned up at the station's ____." },
  'md-z96fa7': { final: 'WHEN PIGS FLY', words: { SIGMA: 'ANSWER' },
    caption: "Asked if his hogs would ever master the new trampoline, the farmer laughed, '____.'" },
  'md-uu9vwb': { final: 'CLOCKING OUT', words: { FIXING: 'TUNING' } },
  'md-1p7idp': { final: 'MOMS THE WORD', words: { COUNT: 'FLOOD' }, alt: [['bouquet of autumn flowers', 'bouquet of flowers']] },
};
/** Caption / alt-text rewrites (British wording, metric units). Alt text still describes the same cartoon. */
const TEXT = {
  'md-nyhi5f': { caption: 'The grumpy man with the stop sign at the school crosswalk was known to everyone as the ____.' },
  'md-zgqx80': { caption: 'The movers set down the sofa and gathered around as the foreman gave a truly ____.', alt: [['tearful removal men', 'tearful movers']] },
  'md-imsoer': { caption: "Asked whether Grandma might skip this year's Mardi Gras pancake supper, Grandpa said ____." },
  // "bird blind" would leak BIRD (the answer is EARLY BIRD).
  'md-dkpksk': { caption: 'She reached the wildlife blind before dawn; the club called her its ____.', alt: [['dark hide', 'dark wildlife blind']] },
  'md-sjgtu3': { alt: [['with a torch', 'with a flashlight']] },
  'md-f89neb': { caption: "When the magician's audience left at intermission, the critic called it a ____." },
  'md-fyosj0': { alt: [['by torchlight', 'by flashlight']] },
  'md-xtxhj1': { caption: 'The traveling cinema showed films from the back of a camper; naturally they called it the ____.', alt: [['A caravan', 'A camper'], ['deckchairs', 'lawn chairs']] },
  'md-g2d3mg': { caption: 'The magician scored three goals for the town soccer team; the paper called it a ____.', alt: [['football pitch', 'soccer field']] },
  // "counter" would leak the answer (COUNTER OFFER).
  'md-b01e5c': { caption: 'The shopkeeper haggled by sliding bills back and forth across the register; he called it a ____.', alt: [['folded notes across the till', 'folded bills across the register']] },
  'md-mwaaan': { alt: [['reveller', 'reveler']] },
  'md-78xswy': { caption: 'The baker and the butcher chatted across the street all day; locals called it ____.' },
  'md-4i9an': { caption: 'The November feast arrived at the table on a toy railroad; Grandpa called it the ____.' },
  'md-qogggt': { caption: "Asked which way the harbor lay, the lighthouse admitted it didn't have the ____.", alt: [['rowing boat', 'rowboat']] },
  'md-a5k0p9': { caption: 'The mechanic only fixed transmissions at night; he called it ____.', alt: [['a gear lever', "a car's gears"]] },
  'md-za1drz': { caption: 'The robot swapped its overalls for a tuxedo in seconds; the inventor called it a ____.', alt: [['dinner jacket', 'tuxedo jacket']] },
  'md-jfmjrv': { caption: "The baker's fanciest customers would only ever buy the ____." },
  'md-gonnbn': { caption: 'The model railroad hobbyist meant to fix the engine but got ____.' },
  'md-izz9n': { alt: [['payslip', 'pay stub']] },
  'md-m1x9z1': { caption: "The librarian's calendar had no free slots left; she was ____." },
  'md-m0uy3s': { alt: [['dressing gown', 'bathrobe']] },
  'md-1iqvqc': { alt: [['back garden', 'backyard']] },
  'md-a4k6zx': { caption: "The cottage swapped its gown on moving day; the mail carrier said he'd need a ____.", alt: [['puzzled postman', 'puzzled mail carrier']] },
  'md-zdxc41': { alt: [['stalled coach', 'stalled bus']] },
  'md-sk70xj': { caption: 'The model railroad enthusiast talked about nothing else; he had a ____.' },
  'md-7rum1u': { caption: 'After hours in the attic, the model railroad builder was ____.', alt: [['model railway', 'model railroad']] },
  'md-5ccbk': { caption: 'When the boomerang arrived with no address, the post office marked it ____.', alt: [['sorting-office window', 'post office window']] },
  'md-pvky5j': { caption: 'When the angler claimed the pike was six feet long, his wife suspected ____.' },
  'md-rul94s': { caption: 'The officer stood at the intersection with a megaphone and clapperboard, ____.', alt: [['at a junction', 'at an intersection']] },
  'md-q3cme2': { caption: 'The model railroad builder lost his ____ when the engine derailed.' },
  'md-9vv74t': { alt: [['tall wedding gateau', 'tall tiered wedding dessert']] },
  'md-rm0z97': { alt: [['trouser cuff', 'pant cuff']] },
  'md-c68un6': { alt: [['A cockerel', 'A strutting chicken']] },
  'md-ubfj9s': { caption: 'The astronomy club planted its telescopes thirty feet apart, nicely ____.' },
  'md-z38cc': { caption: 'The kingfisher stopped at the bird blind for barely a second; the club logged it as a ____.', alt: [['wooden hide', 'wooden bird blind']] },
};

const entries = liveFrom(bank, CONTENT_RELEASE_DATE);
const byId = new Map(entries.map((e) => [e.p.id, e]));
const changes = [];
const fail = (m) => { throw new Error(m); };
function scramble(word, label) {
  const rng = rngFor(`${label}-content-fix-v1`);
  for (let t = 0; t < 400; t++) {
    const s = shuffle(word.split(''), rng).join('');
    const moved = [...s].filter((c, i) => c !== word[i]).length;
    if (s !== word && moved >= word.length - 1 && !allowedAll.has(s) && ![...hard].some((h) => s.includes(h))) return s;
  }
  fail(`no scramble for ${word}`);
}
function point(word, letters) { // circled indexes in `word` covering the multiset `letters`
  const taken = new Set(), idx = [];
  for (const c of letters) { const i = [...word].findIndex((ch, k) => ch === c && !taken.has(k)); if (i < 0) return null; taken.add(i); idx.push(i); }
  return idx.sort((a, b) => a - b);
}
function okWord(w, p, finalText) {
  if (!/^[A-Z]{5,6}$/.test(w)) return 'not 5–6 letters';
  if (!allowedAll.has(w)) return 'not a valid guess';
  if (anagrams.get(sig(w)) !== 1) return 'has another arrangement';
  if (never.has(w) || TONE.has(w) || hard.has(w)) return 'never/tone/profanity list';
  if (swapKeys.has(w)) return 'an answer-swap batch removes it';
  if (BRIT.has(w)) return 'British';
  if (p.words.some((x) => x.answer === w)) return 'already in the puzzle';
  if (finalText.split(' ').includes(w) || p.caption.toUpperCase().includes(w)) return 'in the punchline/caption';
  return null;
}
function swapWord(e, oldW, newW, need) {
  const p = e.p, k = p.words.findIndex((x) => x.answer === oldW);
  if (k < 0) fail(`${p.id}: ${oldW} not found`);
  const letters = need ?? p.words[k].circled.map((i) => oldW[i]);
  const why = okWord(newW, p, p.final.answer); if (why) fail(`${p.id}: ${newW} ${why}`);
  const circled = point(newW, letters); if (!circled) fail(`${p.id}: ${newW} lacks ${letters.join('')}`);
  const before = { ...p.words[k] };
  p.words[k] = { answer: newW, scramble: scramble(newW, `${p.id}-${newW}`), circled };
  changes.push({ id: p.id, where: e.where, date: e.date, field: 'word', old: `${before.answer} [${before.circled}]`, new: `${newW} [${circled}]` });
}
const common = [...upperList('solutions.json'), ...upperList('solutions-6.json')];
const problems = [];
for (const [id, oldW, newW] of WORD_SWAPS) {
  const e = byId.get(id); if (!e) { changes.push({ id, skipped: 'frozen or not found' }); continue; }
  try { swapWord(e, oldW, newW); } catch (err) {
    const p = e.p, w = p.words.find((x) => x.answer === oldW), letters = w.circled.map((i) => oldW[i]);
    const cands = common.filter((c) => c.length === oldW.length && !okWord(c, p, p.final.answer) && point(c, letters)).slice(0, 25);
    problems.push(`${err.message} → candidates (${letters.join('')}): ${cands.join(' ')}`);
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
for (const [id, f] of Object.entries(FINALS)) {
  const e = byId.get(id); if (!e) { changes.push({ id, skipped: 'frozen' }); continue; }
  const p = e.p, oldFinal = p.final.answer;
  // Re-point every word's circles so their letters cover the NEW punchline exactly (word swaps first).
  p.final = { answer: f.final, pattern: f.final.split(' ').map((x) => x.length) };
  for (const [o, n] of Object.entries(f.words)) { const k = p.words.findIndex((x) => x.answer === o); const why = okWord(n, p, f.final); if (why) fail(`${id}: ${n} ${why}`); p.words[k] = { answer: n, scramble: scramble(n, `${id}-${n}`), circled: [] }; }
  let need = [...f.final.replace(/ /g, '')];
  const take = (w) => { const out = []; const used = new Set(); for (let i = 0; i < w.length; i++) { const j = need.indexOf(w[i]); if (j >= 0 && !used.has(i)) { out.push(i); need.splice(j, 1); used.add(i); } } return out; };
  // keep each word's circles where they still fit, then fill the rest left to right
  const plan = p.words.map((w) => w.circled.filter((i) => { const j = need.indexOf(w.answer[i]); if (j < 0) return false; need.splice(j, 1); return true; }));
  p.words.forEach((w, k) => { if (!need.length) return; const extra = []; for (let i = 0; i < w.answer.length && need.length; i++) { if (plan[k].includes(i)) continue; const j = need.indexOf(w.answer[i]); if (j >= 0) { extra.push(i); need.splice(j, 1); } } plan[k] = [...plan[k], ...extra].sort((a, b) => a - b); });
  if (need.length) fail(`${id}: cannot cover ${f.final} (left ${need.join('')})`);
  p.words.forEach((w, k) => { w.circled = plan[k]; if (!w.circled.length) fail(`${id}: ${w.answer} feeds nothing`); });
  void take;
  if (f.caption) p.caption = f.caption;
  for (const [a, b] of f.alt ?? []) { if (!p.altText.includes(a)) fail(`${id}: alt lacks "${a}"`); p.altText = p.altText.replace(a, b); }
  changes.push({ id, where: e.where, date: e.date, field: 'final', old: oldFinal, new: `${f.final} — ${p.words.map((w) => `${w.answer}[${w.circled}]`).join(' ')}` });
}
for (const [id, t] of Object.entries(TEXT)) {
  const e = byId.get(id); if (!e) { changes.push({ id, skipped: 'frozen' }); continue; }
  const p = e.p;
  if (t.caption) { changes.push({ id, where: e.where, date: e.date, field: 'caption', old: p.caption, new: t.caption }); p.caption = t.caption; }
  for (const [a, b] of t.alt ?? []) { if (!p.altText.includes(a)) fail(`${id}: alt lacks "${a}"`); const o = p.altText; p.altText = p.altText.replace(a, b); changes.push({ id, where: e.where, date: e.date, field: 'alt', old: o, new: p.altText }); }
}
// Validate every touched puzzle with the bank builder's own rules.
const leaks = [];
for (const id of new Set(changes.filter((c) => !c.skipped).map((c) => c.id))) {
  const p = byId.get(id).p, letters = p.final.answer.replace(/[^A-Z]/g, '');
  const circ = p.words.flatMap((w) => w.circled.map((i) => w.answer[i])).sort().join('');
  if (circ !== [...letters].sort().join('')) fail(`${id}: circled ≠ punchline`);
  if (p.words.flatMap((w) => w.circled.map((i) => w.answer[i])).join('') === letters) fail(`${id}: tray spells the answer`);
  for (const w of p.words) if (sig(w.scramble) !== sig(w.answer) || w.scramble === w.answer) fail(`${id}: bad scramble ${w.answer}`);
  if (p.caption.length < 20 || p.caption.length > 110 || (p.caption.match(/____/g) || []).length !== 1) fail(`${id}: caption shape`);
  const leak = p.final.answer.split(' ').filter((x) => x.length > 3 && p.altText.toUpperCase().includes(x));
  if (leak.length) leaks.push(`${id}: ${leak.join(' ')} leaks — ${p.caption} | ${p.altText}`);
  if (new Set(p.words.map((w) => w.answer)).size !== 4) fail(`${id}: repeated word`);
}
if (leaks.length) fail(leaks.join('\n'));
if (!DRY) fs.writeFileSync(file, JSON.stringify(bank) + '\n');
console.log(JSON.stringify(changes));
