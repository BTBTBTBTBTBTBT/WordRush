// Apply the reviewed Hubbub everyday-word additions (FRIDAY-QUEUE item 33) to puzzles dated on/after the
// content release date (dailies) + the Unlimited pool. Past dailies never change. Recomputes max + pangrams.
import { readFileSync, writeFileSync } from 'node:fs';
import { hubWordScore } from '../../packages/core/src/games/hub';

const RELEASE = '2026-10-13';
// Reviewed 10-09 (Opus): names, brands, misspellings, British forms, contractions, crude/derogatory terms.
const EXCLUDE = new Set(`BABAR BAILLY BEECHER CICERO CRAMER DILLER EVERLY FLICKR GARBER GOOGLED GOOGLING GRAMMER GROVER
HALLER HAMER HAPPEND HELMER HEROD LAZER LORING MOLLER NAGAR PANELLED PINTER POOPER POOPING RENARD REDNECK WINKLER
AGARD AUTOR BABER BABUR BALMER BARRELLED BELLER BIRTHER BROOKER BROWER CELLER COMED CRAPPER DADAR DAMAR DEFECATED
DOERR DOLLARD FAREED FROMMER GABLER GATELY GENER GENTING GOERING GRABER GRINER HAMEED HARTER HERING HOLLAR HOOVERED
HUGER KILNER KNELLER LAVAR LEMOND LEVELLER LICENCING LODER METTLER MODER MONOD NAVEED NAVER NOMAR PERCENTER PILLER
RUNING THATD THEYR WILLD TOMER TROYER TRUTHER VIBER VINING REVELLING`.split(/\s+/).filter(Boolean));

const bankPath = 'apps/web/data/hub-puzzles.json';
const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
const add = JSON.parse(readFileSync('docs/audits/puzzles/hubbub-additions.json', 'utf8')).puzzles as Record<string, { kind: string; day?: string; words: string[]; bonus: string[] }>;
let changed = 0, addedMain = 0, addedBonus = 0;
for (const list of [bank.daily, bank.extra]) {
  for (const p of list) {
    const a = add[p.id];
    if (!a) continue;
    if (a.kind === 'daily' && (!a.day || a.day < RELEASE)) continue;
    const has = new Set([...p.words, ...p.bonus]);
    // Strict fit: ≥ 4 letters, only the puzzle's letters, includes the center (the audit list had a few strays).
    const fits = (x: string) => x.length >= 4 && x.includes(p.letters[0]) && [...x].every((ch) => p.letters.includes(ch));
    const w = a.words.filter((x) => fits(x) && !EXCLUDE.has(x) && !has.has(x));
    const b = a.bonus.filter((x) => fits(x) && !EXCLUDE.has(x) && !has.has(x) && !w.includes(x));
    if (!w.length && !b.length) continue;
    p.words = [...p.words, ...w].sort(); // the main list is kept alphabetical
    p.bonus = [...p.bonus, ...[...b].sort()]; // appended (existing order untouched)
    const letters = new Set(p.letters.split(''));
    const newPan = w.filter((x) => [...letters].every((l) => x.includes(l)));
    p.pangrams = [...p.pangrams, ...newPan];
    p.max = p.words.reduce((t: number, x: string) => t + hubWordScore(x, p.letters), 0);
    changed++; addedMain += w.length; addedBonus += b.length;
  }
}
const raw = readFileSync(bankPath, 'utf8');
writeFileSync(bankPath, JSON.stringify(bank) + (raw.endsWith('\n') ? '\n' : ''));
console.log({ changed, addedMain, addedBonus });
