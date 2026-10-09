#!/usr/bin/env node
// Hubbub everyday-word audit (Friday queue item 33, founder 10-08/10-09: RECOLLECT, RECYCLER,
// REELECT missing from hb0016; FUTON missing from hb0017; AUNTY from Doug's report).
//
// REPORT ONLY — nothing here writes to apps/web/data. For every daily from --from (default:
// today) to the end of the bank, plus the Unlimited pool (`extra`), it lists common English words
// that fit the puzzle (4+ letters, only its seven letters, contains the center, letters may
// repeat) and are in neither `words` nor `bonus`.
//
// "Common" = wordfreq (offline, scripts/puzzles/hubbub-freq.py) Zipf ≥ 1.9, AND one of:
//   • corroborated by an offline dictionary the repo already has (scripts/data/lexicon-all.json
//     tiers, /usr/share/dict/words, apps/web/data/word-definitions.json, the Wordle allowed /
//     solutions lists, ladder-words.json, modern-words.txt, lexicon-accept.txt);
//   • a regular derivation (RE-/UN- prefix, -ED/-ER/-ERS/-ING/-LY/-D/-R suffix) of a corroborated word;
//   • or Zipf ≥ 2.5 on its own — flagged "uncorroborated" for a human look (loanwords such as
//     FUTON postdate Webster's Second and are in no bundled dictionary).
// Excluded: every blocklist under scripts/data (offensive, profanity, taste, manual, proper nouns,
// names, lexicon-reject) + offensive roots; British spellings (content-american BRIT_WORDS,
// spelling-copy WORDS, and -ISE/-OUR/-TRE variants whose American form is commoner).
// Split: Zipf ≥ --main-zipf (default 2.5) → "main-list worthy" (would raise `max`); else → bonus.
//
//   node scripts/puzzles/hubbub-audit.mjs [--from=YYYY-MM-DD] [--main-zipf=2.5] [--out=docs/audits/puzzles]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..');
const DATA = path.join(REPO, 'apps', 'web', 'data');
const SDATA = path.join(REPO, 'scripts', 'data');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const today = new Date().toISOString().slice(0, 10);
const FROM = opt('from', today);
const MAIN_ZIPF = Number(opt('main-zipf', 2.5));
const FLOOR_ZIPF = 1.9;
const SOLO_ZIPF = 2.5; // uncorroborated words need at least this
const OUT = path.join(REPO, opt('out', 'docs/audits/puzzles'));
fs.mkdirSync(OUT, { recursive: true });

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const lines = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n') : []);
const listWords = (p) => lines(p).map((l) => l.trim().split(/[\s#,]/)[0].toUpperCase()).filter((w) => /^[A-Z]+$/.test(w));
const mask = (w) => { let m = 0; for (const c of w) m |= 1 << (c.charCodeAt(0) - 65); return m; };
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };

// ── Frequency (offline wordfreq via python) ────────────────────────────────────────────────
const freq = JSON.parse(execFileSync('python3', [path.join(HERE, 'hubbub-freq.py'), '--min', String(FLOOR_ZIPF)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

// ── Corroborating dictionaries ─────────────────────────────────────────────────────────────
const sources = {};
const addSource = (name, words) => { sources[name] = new Set(words.filter((w) => /^[A-Z]{4,}$/.test(w))); };
const lex = readJSON(path.join(SDATA, 'lexicon-all.json'));
addSource('lexicon-common', lex.common);
addSource('lexicon-extended', lex.extended);
addSource('lexicon-accept', [...lex.acceptOnly, ...listWords(path.join(SDATA, 'lexicon-accept.txt'))]);
addSource('modern', listWords(path.join(SDATA, 'modern-words.txt')));
const web2 = lines('/usr/share/dict/words').filter((l) => /^[a-z]{4,}$/.test(l)).map((w) => w.toUpperCase());
addSource('web2', web2);
const web2Cap = new Set(lines('/usr/share/dict/words').filter((l) => /^[A-Z][a-z]{3,}$/.test(l)).map((w) => w.toUpperCase()));
// word-definitions.json: skip `miss` stubs, proper nouns and "Alternative letter-case form of X" (lowercased names/brands).
addSource('definitions', Object.entries(readJSON(path.join(DATA, 'word-definitions.json')))
  .filter(([, e]) => Array.isArray(e.senses) && e.senses.length && !e.senses.every((x) => x.pos === 'proper noun' || /^Alternative letter-case form of/i.test(x.def ?? '')))
  .map(([w]) => w.toUpperCase()));
const wordle = [];
for (const f of ['allowed.json', 'allowed-6.json', 'allowed-7.json', 'solutions.json', 'solutions-6.json', 'solutions-7.json']) {
  const p = path.join(DATA, f); if (!fs.existsSync(p)) continue;
  const j = readJSON(p); const arr = Array.isArray(j) ? j : (j.words ?? j.list ?? []);
  for (const w of arr) if (typeof w === 'string') wordle.push(w.toUpperCase());
}
addSource('wordle-lists', wordle);
const ladder = fs.existsSync(path.join(DATA, 'ladder-words.json')) ? readJSON(path.join(DATA, 'ladder-words.json')) : [];
addSource('ladder', (Array.isArray(ladder) ? ladder : Object.values(ladder).flat()).filter((w) => typeof w === 'string').map((w) => w.toUpperCase()));
const WEAK = new Set(['wordle-lists', 'ladder']); // guess lists, not dictionaries
const corroboration = (w) => Object.entries(sources).filter(([, s]) => s.has(w)).map(([k]) => k);
const anyDict = new Set(Object.values(sources).flatMap((s) => [...s]));
// Proper nouns: the NLTK names list, and words web2 lists ONLY capitalized (unless a lexicon tier knows them).
const names = new Set(listWords(path.join(SDATA, 'names-nltk-raw.txt')));
const properNoun = (w) => (names.has(w) || (web2Cap.has(w) && !sources.web2.has(w))) && !sources['lexicon-common'].has(w) && !sources['lexicon-extended'].has(w);
// Stems a derivation may build on: curated tiers only (web2 alone would bless KELL → KELLER).
const stemDict = new Set([...sources['lexicon-common'], ...sources['lexicon-extended'], ...sources['lexicon-accept'], ...sources.modern, ...sources.definitions]);
// Founder / tester reports: everyday words no bundled dictionary knows (loanwords younger than 1934).
const REPORTED = new Set(['FUTON', 'AUNTY', 'RECOLLECT', 'RECYCLER', 'REELECT']);

// ── Exclusions ─────────────────────────────────────────────────────────────────────────────
const block = new Set();
for (const f of ['offensive-blocklist.txt', 'profanity-exact.generated.txt', 'taste-exact.generated.txt', 'manual-blocklist.txt', 'proper-noun-blocklist.txt', 'answer-proper-nouns.txt', 'names-blocklist.txt', 'lexicon-reject.txt']) for (const w of listWords(path.join(SDATA, f))) block.add(w);
// Same roots as apps/web/scripts/hub/widen-acceptance.mjs (kept out of the report text).
const ROOTS = ['FUCK', 'SHIT', 'CUNT', 'NIGG', 'FAGG', 'KIKE', 'SPIC', 'WETBACK', 'RETARD', 'RAPE', 'RAPIST', 'PISS', 'COCK', 'DICK', 'TWAT', 'WANK', 'JIZZ', 'CUM', 'BONER', 'PUSSY', 'WHORE', 'SLUT', 'PORN', 'NAZI', 'HITLER'];
const blocked = (w) => block.has(w) || ROOTS.some((r) => w.includes(r));

const guard = fs.readFileSync(path.join(REPO, 'apps', 'web', 'scripts', 'content-american.test.ts'), 'utf8');
const tpl = (name) => { const s = guard.indexOf(name); const a = guard.indexOf('`', s) + 1; return guard.slice(a, guard.indexOf('`', a)); };
const spell = fs.readFileSync(path.join(REPO, 'apps', 'web', 'scripts', 'spelling-copy.test.ts'), 'utf8');
const ls = spell.indexOf('const WORDS');
const BRIT = new Set([...tpl('const BRIT_WORDS').trim().split(/\s+/), ...[...spell.slice(ls, spell.indexOf('];', ls)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase())]);
const z = (w) => freq[w] ?? 0;
function british(w) {
  if (BRIT.has(w)) return true;
  const variants = [];
  if (/IS(E|ED|ES|ER|ERS|ING|ATION|ATIONS)$/.test(w)) variants.push(w.replace(/IS(E|ED|ES|ER|ERS|ING|ATION|ATIONS)$/, 'IZ$1'));
  if (/YS(E|ED|ES|ING)$/.test(w)) variants.push(w.replace(/YS(E|ED|ES|ING)$/, 'YZ$1'));
  if (/OUR/.test(w)) variants.push(w.replace(/OUR/, 'OR'));
  if (/TRE[DS]?$/.test(w)) variants.push(w.replace(/TRE([DS]?)$/, 'TER$1'));
  if (/AE|OE/.test(w)) variants.push(w.replace(/AE/, 'E').replace(/OE/, 'E'));
  return variants.some((v) => v !== w && (freq[v] ?? 0) > z(w) + 0.3);
}
function derivedFrom(w) {
  const stems = [];
  for (const [re, rep] of [[/([BCDFGHJKLMNPRTVZ])\1(ED|ING|ER|ERS)$/, '$1'], [/ED$/, ''], [/ED$/, 'E'], [/IED$/, 'Y'], [/D$/, ''], [/ERS$/, ''], [/ERS$/, 'E'], [/ER$/, ''], [/ER$/, 'E'], [/R$/, ''], [/ING$/, ''], [/ING$/, 'E'], [/LY$/, ''], [/ILY$/, 'Y'], [/NESS$/, ''], [/MENT$/, ''], [/^RE/, ''], [/^UN/, ''], [/^NON/, ''], [/^OVER/, ''], [/^OUT/, '']]) {
    if (re.test(w)) { const s = w.replace(re, rep); if (s.length >= 4 && s !== w) stems.push(s); }
  }
  return stems.find((s) => stemDict.has(s) && !properNoun(s)) ?? null;
}

// ── Candidates per puzzle ──────────────────────────────────────────────────────────────────
const bank = readJSON(path.join(DATA, 'hub-puzzles.json'));
const epoch = Date.parse(`${bank.epoch}T00:00:00Z`);
const fromIdx = Math.max(0, Math.round((Date.parse(`${FROM}T00:00:00Z`) - epoch) / 86400000));
const dayOf = (i) => new Date(epoch + i * 86400000).toISOString().slice(0, 10);
const freqWords = Object.keys(freq).filter((w) => w.length >= 4 && bits(mask(w)) <= 7).map((w) => ({ w, m: mask(w) }));

function audit(p) {
  const set = mask(p.letters), center = 1 << (p.letters.charCodeAt(0) - 65);
  const have = new Set([...p.words, ...p.bonus]);
  const found = [];
  for (const { w, m } of freqWords) {
    if ((m & ~set) !== 0 || !(m & center) || have.has(w)) continue;
    if (blocked(w)) continue;
    if (!REPORTED.has(w) && (british(w) || properNoun(w))) continue; // web2 lists "Recollect" capitalized
    const dicts = corroboration(w);
    const strong = dicts.filter((d) => !WEAK.has(d));
    const stem = strong.length ? null : derivedFrom(w);
    const zipf = z(w);
    let basis, review = false;
    if (REPORTED.has(w)) basis = 'founder/tester report';
    else if (strong.length) basis = strong.join('+');
    else if (stem) basis = `derived from ${stem}`;
    else if (dicts.length && zipf >= SOLO_ZIPF) { basis = `${dicts.join('+')} only`; review = true; }
    // No dictionary at all: needs real frequency, 5+ letters and a vowel (drops names, acronyms, chat tokens).
    else if (zipf >= SOLO_ZIPF && w.length >= 5 && /[AEIOUY]/.test(w) && !names.has(w)) { basis = 'uncorroborated'; review = true; }
    else continue;
    found.push({ w, zipf, tier: zipf >= MAIN_ZIPF ? 'main' : 'bonus', pangram: m === set, basis, review });
  }
  found.sort((a, b) => b.zipf - a.zipf || a.w.localeCompare(b.w));
  return found;
}
const wordScore = (w, pangram) => (w.length === 4 ? 1 : w.length) + (pangram ? 7 : 0);

const REPORTED_IDS = ['hb0016']; // founder 10-08 — yesterday, kept as the reference case
const results = [];
for (let i = 0; i < bank.daily.length; i++) if (i >= fromIdx || REPORTED_IDS.includes(bank.daily[i].id)) results.push({ kind: 'daily', index: i, day: dayOf(i), p: bank.daily[i], missing: audit(bank.daily[i]) });
for (const p of bank.extra) results.push({ kind: 'extra', index: null, day: null, p, missing: audit(p) });

// ── Known everyday words (founder / tester reports) ────────────────────────────────────────
const KNOWN = ['RECOLLECT', 'RECYCLER', 'REELECT', 'AUNTY', 'FUTON'];
const knownWhere = KNOWN.map((w) => {
  const fitsIn = [...bank.daily.map((p, i) => ({ p, i })), ...bank.extra.map((p) => ({ p, i: null }))]
    .filter(({ p }) => [...w].every((c) => p.letters.includes(c)) && w.includes(p.letters[0]));
  return { w, zipf: z(w), puzzles: fitsIn.map(({ p, i }) => ({ id: p.id, index: i, status: p.words.includes(w) ? 'words' : p.bonus.includes(w) ? 'bonus' : 'MISSING' })) };
});

// ── Patch (not applied) ────────────────────────────────────────────────────────────────────
const patch = { generatedBy: 'scripts/puzzles/hubbub-audit.mjs', generatedOn: today, from: FROM, mainZipf: MAIN_ZIPF,
  note: 'PROPOSAL ONLY — not applied. For each puzzle: `words` to add to the scored main list (max rises by `maxDelta`), `bonus` to add to the 0-point-ceiling accepted list, `pangrams` additions. Items marked review=true are uncorroborated by any bundled dictionary and need a human look before applying. Apply only to puzzles from the content release date; past dailies never change; recompute max, sha and the parity fixtures.',
  puzzles: {} };
for (const r of results) {
  if (!r.missing.length) continue;
  const firm = r.missing.filter((m) => !m.review);
  const words = firm.filter((m) => m.tier === 'main').map((m) => m.w);
  const bonus = firm.filter((m) => m.tier === 'bonus').map((m) => m.w);
  const pangrams = firm.filter((m) => m.pangram).map((m) => m.w);
  const maxDelta = firm.filter((m) => m.tier === 'main').reduce((t, m) => t + wordScore(m.w, m.pangram), 0);
  patch.puzzles[r.p.id] = { kind: r.kind, day: r.day, letters: r.p.letters, words, bonus, pangrams, maxDelta, newMax: r.p.max + maxDelta, review: r.missing.filter((m) => m.review).map((m) => m.w) };
}
fs.writeFileSync(path.join(OUT, 'hubbub-additions.json'), JSON.stringify(patch, null, 1));

// ── Report ─────────────────────────────────────────────────────────────────────────────────
const dailies = results.filter((r) => r.kind === 'daily'), extras = results.filter((r) => r.kind === 'extra');
const sum = (rs, f) => rs.reduce((t, r) => t + r.missing.filter(f).length, 0);
const md = [];
md.push('# Hubbub everyday-word audit', '');
md.push(`Generated ${today} by \`scripts/puzzles/hubbub-audit.mjs\` (Friday queue item 33). **Report only** — the bank is untouched; the proposed patch is \`hubbub-additions.json\` beside this file.`, '');
md.push(`Scope: dailies from ${FROM} (index ${fromIdx}, ${bank.daily[fromIdx]?.id}) to ${bank.daily.at(-1).id} (${dailies.length} puzzles) plus the ${extras.length} Unlimited puzzles. Sources: wordfreq (offline, Zipf ≥ ${FLOOR_ZIPF}) cross-checked against the lexicon tiers, /usr/share/dict/words, word-definitions.json, the Wordle and Ladder lists and the modern/accept lists; regular derivations of dictionary words count; words no dictionary knows need Zipf ≥ ${SOLO_ZIPF} and are flagged **review**. Blocklists, offensive roots and British spellings excluded. "Main" = Zipf ≥ ${MAIN_ZIPF} (a knob: \`--main-zipf\`); the rest go to bonus. Zipf 3 ≈ once per million words; 2 ≈ once per ten million.`, '');
md.push('## Summary', '');
md.push(`| | Puzzles | With gaps | Main-list adds | Bonus adds | Review (uncorroborated) |`, '|---|---|---|---|---|---|');
for (const [name, rs] of [['Dailies from today', dailies], ['Unlimited pool', extras]]) md.push(`| ${name} | ${rs.length} | ${rs.filter((r) => r.missing.some((m) => !m.review)).length} | ${sum(rs, (m) => m.tier === 'main' && !m.review)} | ${sum(rs, (m) => m.tier === 'bonus' && !m.review)} | ${sum(rs, (m) => m.review)} |`);
md.push('', '### Known reports', '', '| Word | Zipf | Fits puzzle(s) | Status |', '|---|---|---|---|');
for (const k of knownWhere) md.push(`| ${k.w} | ${k.zipf} | ${k.puzzles.map((p) => `${p.id}${p.index !== null ? ` (day ${p.index}, ${dayOf(p.index)})` : ' (Unlimited)'}`).join(', ') || 'none'} | ${k.puzzles.map((p) => p.status).join(', ') || '—'} |`);
const tally = new Map();
for (const r of results) for (const m of r.missing) tally.set(m.w, (tally.get(m.w) ?? 0) + 1);
const basisOf = new Map(); for (const r of results) for (const m of r.missing) basisOf.set(m.w, m);
const top = [...tally.entries()].filter(([w]) => !basisOf.get(w).review).sort((a, b) => z(b[0]) - z(a[0])).slice(0, 60);
md.push('', `### Most common missing words (across all audited puzzles, dictionary-backed)`, '', top.map(([w, n]) => `${w} ${z(w)} ×${n} _(${basisOf.get(w).basis})_`).join(' · '), '');
const topRev = [...tally.entries()].filter(([w]) => basisOf.get(w).review).sort((a, b) => z(b[0]) - z(a[0])).slice(0, 40);
md.push(`### Most frequent REVIEW words (no dictionary backs them — names, brands, slang, loanwords; not in the patch)`, '', topRev.map(([w, n]) => `${w} ${z(w)} ×${n}`).join(' · '), '');
md.push('### Why these were missing', '', '- `words`/`bonus` were frozen from lexicon-all.json (21k common + 23k extended) and widened once from Webster\'s Second (1934) + 385 curated modern words. Everyday derivations (RECYCLER, REELECT), loanwords (FUTON) and compounds younger than 1934 fall through; obscure 1934 entries (CERCELEE, CEORL) stay because they are in web2.', '- The cloud 05b everyday-words fix (AUNT/AUNTY/UNCLE guard) is not on this branch: AUNTY is still missing from hb0490 (Unlimited).', '');
md.push('## Dailies', '');
for (const r of dailies) {
  if (!r.missing.length) continue;
  const main = r.missing.filter((m) => m.tier === 'main' && !m.review), bonus = r.missing.filter((m) => m.tier === 'bonus' && !m.review);
  md.push(`### ${r.p.id} — day ${r.index} (${r.day}) · letters ${r.p.letters} (center ${r.p.letters[0]}) · ${r.p.words.length} words / ${r.p.bonus.length} bonus · max ${r.p.max}`, '');
  if (main.length) md.push(`- **Main-list worthy** (+${patch.puzzles[r.p.id].maxDelta} max): ${main.map((m) => `${m.w} ${m.zipf}${m.pangram ? ' ★pangram' : ''}`).join(', ')}`);
  if (bonus.length) md.push(`- Bonus: ${bonus.map((m) => `${m.w} ${m.zipf}${m.pangram ? ' ★' : ''}`).join(', ')}`);
  const rev = r.missing.filter((m) => m.review);
  if (rev.length) md.push(`- Review (no dictionary backs these; not in the patch): ${rev.map((m) => `${m.w} ${m.zipf} (${m.basis})`).join('; ')}`);
  md.push('');
}
md.push('## Unlimited pool (brief)', '');
for (const r of extras) if (r.missing.length) md.push(`- ${r.p.id} ${r.p.letters}: ${r.missing.filter((m) => !m.review).map((m) => `${m.w}${m.tier === 'main' ? '*' : ''}`).join(' ')}${r.missing.some((m) => m.review) ? ` · review: ${r.missing.filter((m) => m.review).map((m) => m.w).join(' ')}` : ''}`);
md.push('', '`*` main-list worthy · `⚠` uncorroborated, review before applying', '');
md.push('## Guard test', '', 'Proposed as `docs/audits/puzzles/hubbub-everyday-guard.proposed.test.ts` (move to packages/core/src/games/ once the additions are applied): every known everyday word must be accepted by every puzzle its letters fit, and no audited puzzle may lack a main-tier word.', '');
fs.writeFileSync(path.join(OUT, 'hubbub-missing.md'), md.join('\n'));

// ── Guard test proposal ────────────────────────────────────────────────────────────────────
const guardList = knownWhere.flatMap((k) => k.puzzles.map((p) => `  { id: '${p.id}', word: '${k.w}' },`)).join('\n');
fs.writeFileSync(path.join(OUT, 'hubbub-everyday-guard.proposed.test.ts'), `import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HubBank } from './hub';

// PROPOSED guard (Friday queue item 33): everyday words players reported as rejected must be
// accepted by every puzzle whose letters fit them. Lives in docs/audits/puzzles until the
// additions in hubbub-additions.json are applied; then move it to packages/core/src/games/.
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'hub-puzzles.json'), 'utf8')) as HubBank;
const all = [...bank.daily, ...bank.extra];

/** Reported everyday words and the puzzles whose letters fit them (center included). */
const KNOWN: ReadonlyArray<{ id: string; word: string }> = [
${guardList}
];

describe('Hubbub accepts everyday words', () => {
  it.each(KNOWN)('$id accepts $word', ({ id, word }) => {
    const p = all.find((x) => x.id === id);
    expect(p, id).toBeTruthy();
    expect([...p!.words, ...p!.bonus]).toContain(word);
  });

  it('every reported word is accepted wherever its letters fit', () => {
    const words = [...new Set(KNOWN.map((k) => k.word))];
    for (const w of words) for (const p of all) {
      const fits = [...w].every((c) => p.letters.includes(c)) && w.includes(p.letters[0]);
      if (fits) expect([...p.words, ...p.bonus], \`\${p.id} \${w}\`).toContain(w);
    }
  });
});
`);

console.log(`dailies audited ${dailies.length} (from ${FROM}), with gaps ${dailies.filter((r) => r.missing.some((m) => !m.review)).length}; main adds ${sum(dailies, (m) => m.tier === 'main' && !m.review)}, bonus adds ${sum(dailies, (m) => m.tier === 'bonus' && !m.review)}, review ${sum(dailies, (m) => m.review)}`);
console.log(`unlimited audited ${extras.length}, with gaps ${extras.filter((r) => r.missing.some((m) => !m.review)).length}; main ${sum(extras, (m) => m.tier === 'main' && !m.review)}, bonus ${sum(extras, (m) => m.tier === 'bonus' && !m.review)}`);
for (const k of knownWhere) console.log(k.w, k.zipf, k.puzzles.map((p) => `${p.id}:${p.status}`).join(' '));
console.log(`wrote ${OUT}/hubbub-missing.md, hubbub-additions.json, hubbub-everyday-guard.proposed.test.ts`);
