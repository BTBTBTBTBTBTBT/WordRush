import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyAllSolutionSwaps } from '@wordle-duel/core';
import { CONTENT_RELEASE_DATE } from './content-release-date.mjs';

/**
 * Puzzle CONTENT is American English too — answers, hidden words, categories,
 * clues, quotes, captions — not just the app copy spelling-copy.test.ts guards.
 * Tester Johnny on Spyglass #13 "Rain Gear" (2026-10-05): PUDDLE, SOGGY and
 * WATERPROOF are not gear, WELLIES is British ("constantly remind it not to use
 * British dating, measurements, spellings"), and "toggle?" — a coat-fastener
 * part name nobody connects to rain gear.
 *
 * Scope: what a player has NOT seen yet — every daily from CUTOVER on, the whole
 * Unlimited pool and every holiday puzzle — plus the Spyglass theme pools that
 * future grids draw from. Past dailies are frozen (players already played them).
 *
 * Fails on: British spellings (the spelling-copy.test.ts list), British vocabulary
 * (BRIT_WORDS / BRIT_PHRASES), DD/MM dates and metric-only units in text, a Spyglass
 * word outside its theme pool or on the off-theme/obscure lists, a "Hidden X" Kindred
 * group whose words do not all hide X, and any NEW British-spelled Classic/Six/Seven
 * answer. A legit exception goes in ALLOW with its reason.
 */
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'data');
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
// First unseen daily: the next coordinated release (one constant for the guard and every repair script).
const CUTOVER = CONTENT_RELEASE_DATE;
const EPOCH = '2026-09-23';
const FROM = Math.round((Date.parse(`${CUTOVER}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / 86400000);

const spellingSrc = readFileSync(join(__dirname, 'spelling-copy.test.ts'), 'utf8');
const listStart = spellingSrc.indexOf('const WORDS');
const BRIT_SPELLINGS = new Set([...spellingSrc.slice(listStart, spellingSrc.indexOf('];', listStart)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1].toUpperCase()));

/** Always-British vocabulary (US word in the comment). Context words like LIFT, FLAT, CHIPS, BOOT are left to review. */
const BRIT_WORDS = new Set(`
  WELLIES WELLINGTONS LORRY LORRIES NAPPY NAPPIES PRAM PRAMS PETROL MOTORWAY MOTORWAYS POSTCODE POSTCODES CRISPS
  FORTNIGHT FORTNIGHTS QUEUE QUEUES QUEUED QUEUEING AUBERGINE AUBERGINES COURGETTE COURGETTES SPANNER SPANNERS DUSTBIN
  DUSTBINS LOO QUID FETE FETES GAOL TYRE TYRES KERB PYJAMAS ALUMINIUM TROUSERS CANDYFLOSS BANGERS TELLY BROLLY CAGOULE
  WAISTCOAT SELLOTAPE TIPPEX CASHPOINT CHIPPY MATHS TENNER FIVER KNACKERED CHUFFED GOBSMACKED SKINT HEADMISTRESS
  ROUNDABOUT FOOTPATH BLOKE BLOKES JUMPER JUMPERS ANORAK DUVET HUMBUG CRUMPET CRUMPETS MARMITE NEWSAGENT
  SPANNER BALACLAVA TERRAPIN STOAT BUSKER QUAY BOLLARD
`.trim().split(/\s+/));
/** British phrases and British-only meanings, matched case-insensitively in text and titles. */
const BRIT_PHRASES = [/\bvillage green\b/i, /\bvillage fete\b/i, /\bcar park\b/i, /\bon holiday\b/i, /\bholiday abroad\b/i, /\bpaper round\b/i,
  /\bcoconut shy\b/i, /\bbusman'?s\b/i, /\bbonfire night\b/i, /\bfireworks night\b/i, /\bpotting shed\b/i, /\bcity break\b/i,
  /\bsoccer pitch\b/i, /\bhospital ward\b/i, /\bkitchen fitters?\b/i, /\bboiled sweets\b/i, /\bhigh street\b/i, /\bfish fingers\b/i];
const DATE_OR_METRIC = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b\d+\s?(km|kg|cm|mm|kilomet(er|re)s?|met(er|re)s?|lit(er|re)s?|grams?|celsius)\b|°C/i;

/** Spyglass: words that are rain-adjacent / jargon / regional — never in a theme pool again. */
const OFF_THEME: Record<string, string[]> = {
  raingear: ['PUDDLE', 'SOGGY', 'WATERPROOF', 'SPLASH', 'DRIZZLE', 'DOWNPOUR', 'DRIPPING', 'STORM', 'FORECAST', 'CLOUD', 'ZIPPER', 'COLLAR', 'LINING', 'CANOPY', 'TOGGLE'],
  babyclothes: ['RATTLE', 'PACIFIER', 'STROLLER', 'BLANKET', 'TINY'],
};
/** Obscure or jargon words no player connects to a theme (any game). */
const OBSCURE_WORDS = new Set(`TOGGLE CAIRN LIANA DESCANT ZEPHYR ISOBAR CELSIUS ANVIL LEVERET CYGNET FARRIER KNEELER CRUMBCOAT TENON MORTISE
  DIATOM HEELTAP HATPIN SINGLET TRILBY CLOCHE BOATER BROGUE CATHERINEWHEEL COWSLIP PUNCTURE GEARBOX CARRIAGE KILT HEDGEROW THATCH PUB`.trim().split(/\s+/));
/** Common words that only failed as Spyglass split-phrase halves (SLEEPING bag, GUINEA pig) — fine elsewhere. */
const PHRASE_HALVES = new Set(`HIDE GUINEA SLEEPING DINING LINING STARTING FLASHING FRESH CLIMBING SPRINGER`.trim().split(/\s+/));
/** Spyglass: obscure, jargon or split-phrase halves (any theme). */
const OBSCURE = new Set([...OBSCURE_WORDS, ...PHRASE_HALVES]);

/** Known exceptions: `${game}:${id}:${WORD}` → why. Ids pin the puzzle so a new one never rides in. */
const ALLOW: Record<string, string> = {
  'crossword:cw-uplpfw:PLOUGH': 'clue says "spelled the British way" (bible, 2026-09-24)',
  'crossword:cw-hmxt00:PLOUGH': 'clue says "spelled the British way"',
  'kindred:gr-hzu5x7:GREY': '___hound (GREYHOUND)',
  'crossword:cw-8dyxbz:TROUSERS': 'answer in the grid; clue now "Dress pants, also called ____"',
  'crossword:cw-shifet:TROUSERS': 'answer in the grid; clue now "Dress pants, also called ____"',
  'crossword:cw-3es5ch:TROUSERS': 'answer in the grid; clue now "Dress pants, also called ____"',
};
/**
 * Audit leftovers not fixed yet. EMPTY since 2026-10-05 (every Kindred, Ladder, Muddle and Hubbub
 * finding landed); keep it empty — a new finding gets fixed, or an ALLOW line with its reason.
 * Keys: game:id:WORD, game:id:"phrase", kindred:id:HIDDEN:WORD.
 */
const PENDING = new Set<string>([]);
const ok = (key: string) => Boolean(ALLOW[key]) || PENDING.has(key);

type Hit = string;
const words = (s: string) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
function scan(game: string, id: string, text: string, hits: Hit[], { phrases = true, units = true } = {}) {
  for (const w of words(text)) {
    const u = w.toUpperCase().replace(/'S$/, '');
    if ((BRIT_SPELLINGS.has(u) || BRIT_WORDS.has(u)) && !ok(`${game}:${id}:${u}`)) hits.push(`${game} ${id}: ${u} — ${text.slice(0, 90)}`);
  }
  if (phrases) for (const re of BRIT_PHRASES) if (re.test(text) && !ok(`${game}:${id}:"${text.match(re)![0]}"`)) hits.push(`${game} ${id}: "${text.match(re)![0]}" — ${text.slice(0, 90)}`);
  if (units && DATE_OR_METRIC.test(text)) hits.push(`${game} ${id}: date/metric "${text.match(DATE_OR_METRIC)![0]}" — ${text.slice(0, 90)}`);
}
/** Unseen puzzles of a bank: dailies from the cutover, the Unlimited pool, every holiday. */
function unseen<P>(bank: { daily: P[]; extra?: P[]; holiday?: Record<string, P[]> }): P[] {
  return [...bank.daily.slice(FROM), ...(bank.extra ?? []), ...Object.values(bank.holiday ?? {}).flat()];
}

describe('American English in puzzle content (unseen puzzles)', () => {
  it('Spyglass: titles, words and theme pools', () => {
    const hits: Hit[] = [];
    const { themes } = read('wordsearch-themes.json') as { themes: { key: string; title: string; words: string }[] };
    const pools = new Map(themes.map((t) => [t.key, new Set(t.words.split(/\s+/))]));
    for (const t of themes) {
      scan('spyglass-theme', t.key, `${t.title} ${t.words}`, hits);
      for (const w of pools.get(t.key)!) {
        if (OBSCURE.has(w)) hits.push(`spyglass-theme ${t.key}: ${w} is obscure/jargon/a phrase half`);
        if (OFF_THEME[t.key]?.includes(w)) hits.push(`spyglass-theme ${t.key}: ${w} does not fit "${t.title}"`);
      }
    }
    for (const p of unseen(read('wordsearch-puzzles.json')) as { id: string; theme: string; title: string; words: { w: string }[] }[]) {
      scan('spyglass', p.id, `${p.title} ${p.words.map((w) => w.w).join(' ')}`, hits);
      const theme = themes.find((t) => t.key === p.theme)!;
      if (p.title !== theme.title) hits.push(`spyglass ${p.id}: title "${p.title}" ≠ theme title "${theme.title}"`);
      for (const { w } of p.words) if (!pools.get(p.theme)!.has(w)) hits.push(`spyglass ${p.id}: ${w} is not in the "${theme.title}" pool`);
    }
    expect(hits, hits.slice(0, 30).join('\n')).toEqual([]);
  });

  it('Kindred: labels and words; "Hidden X" groups really hide X', () => {
    const hits: Hit[] = [];
    for (const p of unseen(read('groups-puzzles.json')) as { id: string; groups: { label: string; words: string[] }[] }[]) {
      for (const g of p.groups) {
        scan('kindred', p.id, `${g.label} :: ${g.words.join(' ')}`, hits);
        const hidden = g.label.match(/^Hidden ([A-Z]{2,})$/);
        if (hidden) for (const w of g.words) if (!w.includes(hidden[1]) && !ok(`kindred:${p.id}:HIDDEN:${w}`)) hits.push(`kindred ${p.id}: "${g.label}" but ${w} does not contain ${hidden[1]}`);
      }
    }
    expect(hits, hits.slice(0, 30).join('\n')).toEqual([]);
  });

  it('Crossword, Codebreaker, Muddle, Hubbub, Letter Ladder', () => {
    const hits: Hit[] = [];
    for (const p of unseen(read('crossword-puzzles.json')) as { id: string; title: string; entries: { answer: string; clue: string }[] }[]) {
      scan('crossword', p.id, p.title, hits);
      for (const e of p.entries) scan('crossword', p.id, `${e.answer} :: ${e.clue}`, hits);
    }
    for (const p of unseen(read('cryptogram-puzzles.json')) as { id: string; text: string }[]) scan('codebreaker', p.id, p.text, hits);
    for (const p of unseen(read('scramble-puzzles.json')) as { id: string; words: { answer: string }[]; final: { answer: string }; caption?: string; altText?: string }[])
      scan('muddle', p.id, `${p.words.map((w) => w.answer).join(' ')} :: ${p.final.answer} :: ${p.caption ?? ''} :: ${p.altText ?? ''}`, hits);
    // Hubbub: only the REQUIRED list — British forms stay accepted as 0-point bonus words.
    for (const p of unseen(read('hub-puzzles.json')) as { id: string; words: string[] }[]) scan('hubbub', p.id, p.words.join(' '), hits, { phrases: false, units: false });
    for (const p of unseen(read('ladder-puzzles.json')) as { id: string; path: string[] }[]) scan('ladder', p.id, p.path.join(' '), hits, { phrases: false, units: false });
    expect(hits, hits.slice(0, 30).join('\n')).toEqual([]);
  });

  // Letter Ladder accepts only data/ladder-words.json (tester Doug, 2026-10-05: THAVE, "a rare British
  // dialect word", was accepted as a rung). Rebuild with scripts/ladder/build-ladder-words.mjs.
  it('Letter Ladder accept list: common American words only, and every unseen ladder solvable in par on it', () => {
    const list = read('ladder-words.json') as string[];
    const set = new Set(list);
    const bad = list.filter((w) => BRIT_SPELLINGS.has(w) || BRIT_WORDS.has(w) || OBSCURE_WORDS.has(w) || !/^[A-Z]{5}$/.test(w));
    expect(bad, 'British / obscure / malformed words in ladder-words.json').toEqual([]);
    for (const w of ['THAVE', 'BLOKE', 'QUEUE', 'LITRE', 'PENCE']) expect(set.has(w), w).toBe(false);
    expect(list.length).toBeGreaterThan(2000);
    const adj = (w: string) => { const out: string[] = []; for (let i = 0; i < 5; i++) for (let c = 65; c <= 90; c++) { const v = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1); if (v !== w && set.has(v)) out.push(v); } return out; };
    const dist = (s: string, e: string) => { const d = new Map([[s, 0]]); let f = [s]; while (f.length && !d.has(e)) { const n: string[] = []; for (const u of f) for (const v of adj(u)) if (!d.has(v)) { d.set(v, d.get(u)! + 1); n.push(v); } f = n; } return d.get(e); };
    const hits: string[] = [];
    for (const p of unseen(read('ladder-puzzles.json')) as { id: string; start: string; end: string; par: number; path: string[] }[]) {
      const off = p.path.filter((w) => !set.has(w));
      if (off.length) hits.push(`ladder ${p.id}: path word(s) not on the list: ${off.join(' ')}`);
      if (dist(p.start, p.end) !== p.par) hits.push(`ladder ${p.id}: ${p.start}→${p.end} is not ${p.par} steps on the list`);
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });

  // Classic / Six / Seven answers change only through a dated answer swap (solution-swaps.ts). Swap batch 3
  // (founder 2026-10-05) takes every British answer out, so the pools AS DEALT once every batch is live hold none.
  it('PENDING stays empty', () => { expect([...PENDING]).toEqual([]); });

  it('no British Classic / Six / Seven answers once every swap batch is live', () => {
    const extra = new Set(['SULPHUR', 'MOULDED', 'CHEQUE', 'ADVERT', 'PENCE', 'DRAUGHT', 'QUEUING', 'CRUMPET']);
    const found = ['solutions.json', 'solutions-6.json', 'solutions-7.json']
      .flatMap((f) => applyAllSolutionSwaps((read(f) as string[]).map((w) => w.toUpperCase())))
      .filter((w) => BRIT_SPELLINGS.has(w) || BRIT_WORDS.has(w) || extra.has(w));
    expect(found).toEqual([]);
  });
});
