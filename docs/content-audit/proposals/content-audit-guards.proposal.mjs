// PROPOSAL — not wired into any test run. Guards that would have caught the 2026-10-06 content-audit
// findings automatically (REPORT-CONTENT-AUDIT.md). Dependency-free; it prints what each guard would fail
// on TODAY and exits 0. To adopt one, move its check into apps/web/scripts/content-american.test.ts
// (same unseen() scope: dailies from CONTENT_RELEASE_DATE, the Unlimited pool, holidays) and fix or
// ALLOW the current hits first.
//
//   node docs/content-audit/proposals/content-audit-guards.proposal.mjs [--verbose]
//
// Guards:
//  G1 profanity/slur/explicit terms in EVERY bank, not just the Classic pools (Muddle had FUCKED + SHITTY,
//     Hubbub HOMO/RETARDED/BONER, ladder-words SEMEN/SPERM, crossword clues "A chink in the ____")
//  G2 extended British vocabulary (brit-words-extended.txt) over answers AND text of every unseen puzzle,
//     and over the Classic/Six/Seven pools as dealt once every swap batch is live
//  G3 Kindred: the same 4-word group must not appear in two puzzles (WON TOO FORE ATE ×6)
//  G4 Codebreaker: no saying twice (normalized text, or the same last four words: long lane / long road "that has no turning")
//  G5 Crossword: no stem twice in one grid (EGG/EGGS, TREE/TREES, HEAVEN/HEAVENLY)
//  G6 ProperNoundle: no answer both in the daily rotation and the holiday file (Sacagawea on 2026-10-12)
//  G7 proposed OBSCURE_WORDS extension (obscure-words-proposed.txt) over answers / required words / accept list
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const DATA = join(REPO, 'apps', 'web', 'data');
const VERBOSE = process.argv.includes('--verbose');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const listFile = (p) => readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)[0].toUpperCase());

const CUTOVER = readFileSync(join(REPO, 'apps', 'web', 'scripts', 'content-release-date.mjs'), 'utf8').match(/'(\d{4}-\d{2}-\d{2})'/)[1];
const FROM = Math.round((Date.parse(`${CUTOVER}T00:00:00Z`) - Date.parse('2026-09-23T00:00:00Z')) / 86400000);
const unseen = (bank) => [...bank.daily.slice(FROM), ...(bank.extra ?? []), ...Object.values(bank.holiday ?? {}).flat()];
const words = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).map((w) => w.toUpperCase().replace(/'S$/, ''));

// Same sources as answer-pool-hygiene.test.ts, applied everywhere.
const scriptsData = (f) => listFile(join(REPO, 'scripts', 'data', f));
const HARD_EXACT = new Set([...scriptsData('profanity-exact.generated.txt'), ...scriptsData('offensive-blocklist.txt')]);
const HARD_ROOTS = ['FUCK', 'SHIT', 'CUNT', 'BLOWJOB', 'HANDJOB', 'WANK', 'TWAT', 'NIGG', 'FAGG', 'SLUT', 'WHORE', 'PUSSY', 'JIZZ', 'DILDO', 'RAPIST'];
/** Explicit/slur words the audit found outside the hard lists (exact match). */
const EXPLICIT = new Set(`BONER HORNY SEMEN SPERM NUDES VIBRATOR BONDAGE DONG LUBE PIMP HOMO RETARDED GAYER PERVERT PERVERTED
  RAPING HOOKUP FONDLE PANTIES GROPING FLASHER TOPLESS PLAYBOY REDNECK HICKEY VIAGRA CHINK PRICK SPANK BUTCH`.trim().split(/\s+/));
const isHard = (w) => HARD_EXACT.has(w) || EXPLICIT.has(w) || HARD_ROOTS.some((r) => w.includes(r));

const BRIT = new Set(listFile(join(HERE, 'brit-words-extended.txt')));
const OBSCURE = new Set(listFile(join(HERE, 'obscure-words-proposed.txt')));

// Pools as dealt once every swap batch is live (parsed from solution-swaps.ts so this stays dependency-free).
const swapsSrc = readFileSync(join(REPO, 'packages', 'core', 'src', 'solution-swaps.ts'), 'utf8');
const tables = ['SOLUTION_SWAPS', 'SOLUTION_SWAPS_2', 'SOLUTION_SWAPS_3'].map((n) =>
  Object.fromEntries([...swapsSrc.match(new RegExp(`${n}: Readonly<Record<string, string>> = \\{([\\s\\S]*?)\\};`))[1].matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]])));
const dealt = (f) => tables.reduce((pool, t) => pool.map((w) => t[w] ?? w), read(f).map((w) => w.toUpperCase()));

const hits = { G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [] };
const answerCheck = (game, id, list, { obscure = true } = {}) => {
  for (const w of list) {
    if (isHard(w)) hits.G1.push(`${game} ${id}: ${w}`);
    if (BRIT.has(w)) hits.G2.push(`${game} ${id}: ${w}`);
    if (obscure && OBSCURE.has(w)) hits.G7.push(`${game} ${id}: ${w}`);
  }
};
const textCheck = (game, id, text) => {
  for (const w of words(text)) {
    if (isHard(w)) hits.G1.push(`${game} ${id}: "${w}" in "${text.slice(0, 70)}"`);
    if (BRIT.has(w)) hits.G2.push(`${game} ${id}: "${w}" in "${text.slice(0, 70)}"`);
  }
};

for (const f of ['solutions.json', 'solutions-6.json', 'solutions-7.json']) answerCheck('pool', f, dealt(f));

for (const p of unseen(read('crossword-puzzles.json'))) {
  answerCheck('crossword', p.id, p.entries.map((e) => e.answer), { obscure: false });
  textCheck('crossword', p.id, p.title);
  for (const e of p.entries) textCheck('crossword', p.id, e.clue);
  const ans = p.entries.map((e) => e.answer);
  // Same stem twice: B is A plus an inflection (EGG/EGGS, FORGET/FORGETS, HEAVEN/HEAVENLY) — not EEL in HEELS.
  for (const a of ans) for (const b of ans) if (a !== b && a.length >= 3 && b.startsWith(a) && /^(S|ES|D|ED|ER|ERS|ING|LY|Y)$/.test(b.slice(a.length))) hits.G5.push(`crossword ${p.id}: ${a} / ${b}`);
}
const kindredAll = [...read('groups-puzzles.json').daily, ...(read('groups-puzzles.json').extra ?? []), ...Object.values(read('groups-puzzles.json').holiday ?? {}).flat()];
const groupSeen = new Map();
for (const p of kindredAll) for (const g of p.groups) { const k = [...g.words].sort().join(' '); groupSeen.set(k, [...(groupSeen.get(k) ?? []), p.id]); }
for (const p of unseen(read('groups-puzzles.json'))) {
  for (const g of p.groups) {
    answerCheck('kindred', p.id, g.words);
    textCheck('kindred', p.id, g.label);
    const k = [...g.words].sort().join(' ');
    if (groupSeen.get(k).length > 1) hits.G3.push(`kindred ${p.id}: "${g.label}" ${k} also in ${groupSeen.get(k).filter((x) => x !== p.id).join(', ')}`);
  }
}
const sayings = new Map();
const norm = (t) => t.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const cg = read('cryptogram-puzzles.json');
for (const p of [...cg.daily, ...(cg.extra ?? []), ...Object.values(cg.holiday ?? {}).flat()]) {
  for (const k of [norm(p.text), 'tail:' + norm(p.text).split(' ').slice(-4).join(' ')]) sayings.set(k, [...(sayings.get(k) ?? []), p.id]);
}
for (const p of unseen(cg)) {
  textCheck('codebreaker', p.id, p.text);
  for (const k of [norm(p.text), 'tail:' + norm(p.text).split(' ').slice(-4).join(' ')]) if (sayings.get(k).length > 1) { hits.G4.push(`codebreaker ${p.id}: "${p.text}" ~ ${sayings.get(k).filter((x) => x !== p.id).join(', ')}`); break; }
}
for (const p of unseen(read('scramble-puzzles.json'))) {
  answerCheck('muddle', p.id, [...p.words.map((w) => w.answer), ...p.final.answer.split(/\s+/)]);
  textCheck('muddle', p.id, `${p.caption ?? ''} ${p.altText ?? ''}`);
}
for (const p of unseen(read('hub-puzzles.json'))) answerCheck('hubbub', p.id, p.words);
for (const p of unseen(read('ladder-puzzles.json'))) answerCheck('ladder', p.id, p.path);
answerCheck('ladder-words', 'list', read('ladder-words.json'));
for (const p of unseen(read('wordsearch-puzzles.json'))) { answerCheck('spyglass', p.id, p.words.map((w) => w.w)); textCheck('spyglass', p.id, p.title); }
const pnDaily = new Set(read('propernoundle-puzzles.json').map((p) => p.answer.toLowerCase()));
for (const [key, list] of Object.entries(read('propernoundle-holidays.json').holiday)) for (const p of list) if (pnDaily.has(p.answer.toLowerCase())) hits.G6.push(`propernoundle holiday:${key} ${p.id}: ${p.display} is also in the daily rotation`);

const label = { G1: 'profanity / slur / explicit, every bank', G2: 'extended British vocabulary', G3: 'Kindred duplicate group', G4: 'Codebreaker duplicate saying', G5: 'Crossword stem repeated in one grid', G6: 'ProperNoundle rotation vs holiday duplicate', G7: 'proposed OBSCURE_WORDS' };
for (const [g, list] of Object.entries(hits)) {
  const uniq = [...new Set(list)];
  console.log(`${g} ${label[g]}: ${uniq.length} hit(s)`);
  for (const h of uniq.slice(0, VERBOSE ? Infinity : 8)) console.log(`   ${h}`);
  if (!VERBOSE && uniq.length > 8) console.log(`   … ${uniq.length - 8} more (--verbose)`);
}
