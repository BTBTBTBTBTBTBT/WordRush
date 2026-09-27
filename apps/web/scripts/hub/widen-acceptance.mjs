#!/usr/bin/env node
// Hubbub acceptance, widened (founder, 2026-09-26: "make sure hubbub won't have
// any more issues with people asking me why their words weren't accepted").
//
// The bank's `words` (the common list that defines `max` and the ranks) stays
// frozen. Its `bonus` list — every OTHER word the puzzle accepts, all scoring
// since §281 — is widened here from a large general dictionary so any real
// English word that fits the seven letters counts. The curated lexicon only
// ever knew ~21k common words and dropped function words, clipped forms and
// modern vocabulary (THEY, METRO, RETRO were refused on launch week).
//
// Source: the system dictionary (/usr/share/dict/words — Webster's 2nd,
// 235k entries), lowercase entries only (capitalized = proper nouns), 4–12
// letters, minus every blocklist under scripts/data (offensive, profanity,
// taste, manual, proper nouns, names). Idempotent and append-only: a re-run
// adds only words not yet accepted, so no played day's `words`/`max` move and
// the parity fixtures (bonus[0]) keep their meaning.
//
//   node apps/web/scripts/hub/widen-acceptance.mjs [--dict /path/to/words]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const dictPath = process.argv.includes('--dict') ? process.argv[process.argv.indexOf('--dict') + 1] : '/usr/share/dict/words';

const block = new Set();
for (const f of ['offensive-blocklist.txt', 'profanity-exact.generated.txt', 'taste-exact.generated.txt', 'manual-blocklist.txt', 'proper-noun-blocklist.txt', 'answer-proper-nouns.txt', 'names-blocklist.txt', 'lexicon-reject.txt']) {
  try {
    for (const line of fs.readFileSync(join(root, 'scripts/data', f), 'utf8').split('\n')) {
      const w = line.trim().split(/[\s#,]/)[0].toUpperCase();
      if (/^[A-Z]+$/.test(w)) block.add(w);
    }
  } catch { /* optional list */ }
}
// Words that carry an offensive root even when the exact form is not listed.
const ROOTS = ['FUCK', 'SHIT', 'CUNT', 'NIGG', 'FAGG', 'KIKE', 'SPIC', 'WETBACK', 'RETARD', 'RAPE', 'RAPIST', 'PISS', 'COCK', 'DICK', 'TWAT', 'WANK', 'JIZZ', 'CUM', 'BONER', 'PUSSY', 'WHORE', 'SLUT', 'PORN', 'NAZI', 'HITLER'];
const blocked = (w) => block.has(w) || ROOTS.some((r) => w.includes(r));

const dictionary = new Set(
  fs.readFileSync(dictPath, 'utf8').split('\n')
    .filter((w) => /^[a-z]{4,12}$/.test(w))
    .map((w) => w.toUpperCase())
    .filter((w) => !blocked(w)),
);
console.log(`dictionary: ${dictionary.size} candidate words from ${dictPath}`);

// Bucket the dictionary by letter signature for a fast per-puzzle scan.
const fits = (w, letters) => [...w].every((c) => letters.includes(c)) && w.includes(letters[0]);

const bankPath = join(root, 'apps/web/data/hub-puzzles.json');
const raw = fs.readFileSync(bankPath, 'utf8');
const bank = JSON.parse(raw);
let added = 0, puzzles = 0, maxAdd = 0, sample = '';
const puzzlesAll = [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()];
for (const p of puzzlesAll) {
  const have = new Set([...p.words, ...p.bonus]);
  const extra = [];
  for (const w of dictionary) if (!have.has(w) && fits(w, p.letters)) extra.push(w);
  if (extra.length) {
    extra.sort();
    p.bonus = [...p.bonus, ...extra];
    added += extra.length; puzzles++;
    if (extra.length > maxAdd) { maxAdd = extra.length; sample = `${p.letters}: +${extra.length} e.g. ${extra.slice(0, 8).join(',')}`; }
  }
}
const out = (/\n\s+"/.test(raw.slice(0, 200)) ? JSON.stringify(bank, null, raw.match(/\n( +)"/)[1].length) : JSON.stringify(bank)) + (raw.endsWith('\n') ? '\n' : '');
for (const dst of [bankPath, join(root, 'apps/ios/Wordocious/Resources/hub-puzzles.json'), join(root, 'apps/ios/Tests/Fixtures/hub-puzzles.json'), join(root, 'apps/android/core/src/main/resources/data/hub-puzzles.json')]) {
  if (fs.existsSync(dst)) fs.writeFileSync(dst, out);
}
console.log(`bank: +${added} accepted words across ${puzzles} of ${puzzlesAll.length} puzzles (largest ${sample}); size ${(out.length / 1024).toFixed(0)} KB`);
