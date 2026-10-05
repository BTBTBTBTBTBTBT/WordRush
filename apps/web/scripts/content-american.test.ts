import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyAllSolutionSwaps } from '@wordle-duel/core';

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
const CUTOVER = '2026-10-06';
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
/** Spyglass: obscure, jargon or split-phrase halves no player connects to the title (any theme). */
const OBSCURE = new Set(`TOGGLE CAIRN LIANA DESCANT ZEPHYR ISOBAR CELSIUS ANVIL LEVERET CYGNET FARRIER KNEELER CRUMBCOAT TENON MORTISE
  DIATOM HEELTAP HATPIN SINGLET TRILBY CLOCHE BOATER BROGUE CATHERINEWHEEL COWSLIP HIDE GUINEA SLEEPING DINING LINING
  STARTING FLASHING FRESH CLIMBING SPRINGER PUNCTURE GEARBOX CARRIAGE KILT HEDGEROW THATCH PUB`.trim().split(/\s+/));

/** Known exceptions: `${game}:${id}:${WORD}` → why. Ids pin the puzzle so a new one never rides in. */
const ALLOW: Record<string, string> = {
  'crossword:cw-uplpfw:PLOUGH': 'clue says "spelled the British way" (bible, 2026-09-24)',
  'crossword:cw-hmxt00:PLOUGH': 'clue says "spelled the British way"',
  'kindred:gr-hzu5x7:GREY': '___hound (GREYHOUND)',
  'kindred:gr-g5g39s:SPANNER': 'Hidden PAN wordplay — needs a swap (report 2026-10-05)',
  'hubbub:hb0045:ENROLMENT': 'pangram — the letter set is built on it; regenerating is a bank change',
  'hubbub:hb0167:YOGHURT': 'pangram',
  'hubbub:hb0384:MOTORWAY': 'pangram',
  'hubbub:hb0514:CALIBRE': 'pangram',
  'hubbub:hb0519:HONOURED': 'pangram',
  'muddle:md-4sccue:PETROL': 'scrambled word (circled letters feed SHELF LIFE) — needs a re-scramble',
  'muddle:md-lziusb:PETROL': 'scrambled word — needs a re-scramble',
  'ladder:ld0176:BLOKE': 'ladder start/end — needs a new path (report 2026-10-05)',
  'ladder:ld0268:BLOKE': 'ladder end',
  'ladder:ld0318:BLOKE': 'ladder start',
  'ladder:ld0540:BLOKE': 'ladder start (Unlimited)',
  'crossword:cw-8dyxbz:TROUSERS': 'answer in the grid; clue now "Dress pants, also called ____"',
  'crossword:cw-shifet:TROUSERS': 'answer in the grid; clue now "Dress pants, also called ____"',
  'crossword:cw-3es5ch:TROUSERS': 'answer in the grid; clue now "Dress pants, also called ____"',
};
/**
 * Found by the 2026-10-05 audit and NOT yet fixed (each needs a group swap, an answer
 * re-scramble or a regenerated grid). The guard still fails on anything new; delete a
 * line when its fix lands. Keys: game:id:WORD, game:id:"phrase", kindred:id:HIDDEN:WORD.
 */
const PENDING = new Set<string>([
  'kindred:gr-sjdt3a:JUMPER', 'kindred:gr-kij6yu:BOLLARD', 'kindred:gr-6elxjg:QUEUE', 'kindred:gr-w8ij3o:FORTNIGHT', 'kindred:gr-ix2fsc:SPANNER',
  'kindred:gr-3xrc80:BUSKER', 'kindred:gr-vn9qq1:ANORAK', 'kindred:gr-xx9wuv:HUMBUG', 'kindred:gr-jsa2s5:MATHS', 'kindred:gr-yjas24:STOAT',
  'kindred:gr-7ocjqk:QUAY', 'kindred:gr-kjekro:TERRAPIN', 'kindred:gr-azuyju:HUMBUG', 'kindred:gr-yxacxc:CRISPS', 'kindred:gr-m83h5d:DUVET',
  'kindred:gr-cd53an:BLOKE', 'kindred:gr-uh3zns:QUAY', 'kindred:gr-142114:ROUNDABOUT', 'kindred:gr-x9tgvl:DUVET',
  'kindred:gr-5y4jwr:HIDDEN:ULTIMATE', 'kindred:gr-5y4jwr:HIDDEN:INTIMATE', 'kindred:gr-spyvr:HIDDEN:CANVAS', 'kindred:gr-p141zt:HIDDEN:BREAD',
  'kindred:gr-24jv4v:HIDDEN:BOULDER', 'kindred:gr-k00e4p:HIDDEN:DIALECT', 'kindred:gr-k00e4p:HIDDEN:INTELLECT',
  'muddle:md-84c132:PETROL',
  'muddle:md-j8k9z6:NEWSAGENT', 'muddle:md-j8k9z6:"PAPER ROUND"', 
]);
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

  // Classic / Six / Seven answers change only through a dated answer swap (solution-swaps.ts). Swap batch 3
  // (founder 2026-10-05) takes every British answer out, so the pools AS DEALT once every batch is live hold none.
  it('no British Classic / Six / Seven answers once every swap batch is live', () => {
    const extra = new Set(['SULPHUR', 'MOULDED', 'CHEQUE', 'ADVERT', 'PENCE', 'DRAUGHT', 'QUEUING', 'CRUMPET']);
    const found = ['solutions.json', 'solutions-6.json', 'solutions-7.json']
      .flatMap((f) => applyAllSolutionSwaps((read(f) as string[]).map((w) => w.toUpperCase())))
      .filter((w) => BRIT_SPELLINGS.has(w) || BRIT_WORDS.has(w) || extra.has(w));
    expect(found).toEqual([]);
  });
});
