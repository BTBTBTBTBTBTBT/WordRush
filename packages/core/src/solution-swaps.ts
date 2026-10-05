/**
 * §265: answers that read as PROPER NOUNS are swapped out of the answer pools.
 * Each has a lowercase dictionary sense (japan = lacquer, aspen = a poplar) and
 * cleared the frequency bar BECAUSE of the country/city/people it names, so the
 * curation let it through (founder: "Aspen populated on OctoWord and Japan
 * yesterday, why?"). The pools are ORDER-LOCKED (position = deck-permutation
 * input), so nothing is deleted or moved: from the cutover date on, the word at
 * that index resolves to its replacement. Dated seeds gate on the seed's date,
 * undated seeds (unlimited, live VS — server and clients must agree) on
 * wall-clock UTC, exactly like SOLUTIONS_GROWTH_CUTOVER_DATE. The old words stay
 * valid GUESSES. Mirrors: packages/core/src/solution-swaps.ts,
 * apps/ios/Sources/Core/SolutionSwaps.swift,
 * apps/android/core/.../SolutionSwaps.kt — keep all three identical
 * (solution-swaps.test.ts + native tests pin them). Ship all three platforms
 * before the date arrives.
 */
export const SOLUTION_SWAP_CUTOVER_DATE = '2026-10-05';

export const SOLUTION_SWAPS: Readonly<Record<string, string>> = {
  JAPAN: 'ALOOF',
  CHINA: 'EJECT',
  CHILE: 'LIVID',
  ASPEN: 'DUVET',
  DUTCH: 'SLUSH',
  GREEK: 'VISOR',
  ROMAN: 'GLEAM',
  SWISS: 'ERUPT',
  WELSH: 'CRUMB',
  BIBLE: 'EMBER',
  BERLIN: 'BLOTCH',
  BRAZIL: 'JABBER',
  GERMAN: 'CAJOLE',
  GOOGLE: 'CARAFE',
  GREECE: 'CURDLE',
  MORMON: 'BRAISE',
  MUSLIM: 'DAWDLE',
  PANAMA: 'BISECT',
  VIKING: 'PILFER',
  CHICAGO: 'PROFUSE',
  CHINESE: 'COMPOTE',
  ENGLISH: 'BURNISH',
  MOROCCO: 'ENTWINE',
};

/** Batch 1 only: the pool with every swapped-out answer replaced IN PLACE (same length, same index). */
export function applySolutionSwaps(pool: readonly string[]): string[] {
  return pool.map((w) => SOLUTION_SWAPS[w] ?? w);
}

/**
 * Batch 2 (founder, 2026-09-23: "please continue to get rid of profanity like
 * fucker and blowjob"): PROFANITY and sexual/drug vocabulary that the 6- and
 * 7-letter curation let through — the exact-match profanity lists carried FUCK
 * and SHIT but not FUCKER/FUCKING/SHITTY, and BLOWJOB only as a username
 * substring. Same mechanism as batch 1, but a SEPARATE table with its own
 * LATER cutover: store builds carrying batch 1 (iOS 1.29 / Android 121) are
 * already out, so SOLUTION_SWAPS must never grow — a client without an entry
 * would deal the old word while the server dealt the new one. The date is set
 * after the next iOS and Android store releases; all four runtimes must carry
 * this table before it arrives. Replacements: common, clean, guessable words
 * absent from the current AND legacy pools, not in any blocklist, and not a
 * batch-1 replacement. The old words stay valid GUESSES.
 */
export const SOLUTION_SWAP_2_CUTOVER_DATE = '2026-11-16';

export const SOLUTION_SWAPS_2: Readonly<Record<string, string>> = {
  FUCKER: 'CASHEW',
  FUCKED: 'DAPPER',
  SHITTY: 'CHISEL',
  HERPES: 'FONDUE',
  HEROIN: 'FILLET',
  FETISH: 'FLAUNT',
  FUCKING: 'CRUMPET',
  BLOWJOB: 'APRICOT',
  BROTHEL: 'BAGPIPE',
  GENITAL: 'CHUTNEY',
  VAGINAL: 'COPILOT',
  COCAINE: 'CATWALK',
  BONDAGE: 'CROWBAR',
};

/** Batch 2 only, IN PLACE. */
export function applySolutionSwaps2(pool: readonly string[]): string[] {
  return pool.map((w) => SOLUTION_SWAPS_2[w] ?? w);
}

/**
 * Batch 3 (founder, 2026-10-05: "Definitely get the British answers out, I don't
 * care the date you choose"): British-spelled and British-vocabulary answers
 * (COLOUR, THEATRE, CENTRE, YOGHURT, DUSTBIN, PETROL, JUMPER, BLOKE, CHEQUE,
 * ADVERT, PENCE…) plus
 * CRUMPET, which batch 2 itself dealt in place of FUCKING (British, and slang),
 * and DUVET, batch 1's replacement for ASPEN (US: comforter).
 * CRUMPET and DUVET are keyed on earlier replacements, so this table is applied
 * AFTER batches 1 and 2. Its own table because builds carrying batches 1 and 2 are already in
 * the stores (neither may grow). Cutover: the batch-2 date — the 10-09
 * coordinated release (first builds carrying this table) has 5+ weeks to reach
 * users first, and one shared date keeps a single "release before" deadline.
 * It is its own constant so it can move later without touching batch 2.
 * Replacements: same length, common American words, guessable, not current
 * answers, not a batch-1/2 replacement, not British-spelled.
 * The old words stay valid GUESSES.
 */
export const SOLUTION_SWAP_3_CUTOVER_DATE = '2026-11-16';

export const SOLUTION_SWAPS_3: Readonly<Record<string, string>> = {
  LITRE: 'PECAN',
  QUEUE: 'LASSO',
  FIBRE: 'GECKO',
  BLOKE: 'LLAMA',
  JUMPER: 'PIGLET',
  LEARNT: 'TURNIP',
  RUMOUR: 'WALRUS',
  CENTRE: 'IGUANA',
  PLOUGH: 'TOUCAN',
  PETROL: 'BOBCAT',
  ARMOUR: 'QUIVER',
  CHILLI: 'KIMCHI',
  VAPOUR: 'MAGPIE',
  HONOUR: 'CATNIP',
  HUMOUR: 'EGGNOG',
  AGEING: 'LENTIL',
  COLOUR: 'SORBET',
  LABOUR: 'GELATO',
  FAVOUR: 'CHURRO',
  FULFIL: 'TAMALE',
  TUMOUR: 'SALAMI',
  AMONGST: 'PRETZEL',
  FLAVOUR: 'POTLUCK',
  DUSTBIN: 'TOOLBOX',
  DEFENCE: 'HOEDOWN',
  PARLOUR: 'SUNBEAM',
  LICENCE: 'CARPOOL',
  REALISE: 'TADPOLE',
  CALIBRE: 'BOBSLED',
  CENTRED: 'TUGBOAT',
  MOULDED: 'COWGIRL',
  FUELLED: 'HARPOON',
  THEATRE: 'MARACAS',
  YOGHURT: 'PAPRIKA',
  OFFENCE: 'TREETOP',
  HARBOUR: 'WARTHOG',
  ANALYSE: 'WETSUIT',
  SULPHUR: 'MUSKRAT',
  SPECTRE: 'SUNFISH',
  PENCE: 'GUMBO',
  CHEQUE: 'WIDGET',
  ADVERT: 'SUDOKU',
  DRAUGHT: 'GUMDROP',
  QUEUING: 'TRAPEZE',
  DUVET: 'TAFFY',
  CRUMPET: 'WALLABY',
};

/** Batch 3 only, IN PLACE (keys may be batch-2 replacements — apply after batch 2). */
export function applySolutionSwaps3(pool: readonly string[]): string[] {
  return pool.map((w) => SOLUTION_SWAPS_3[w] ?? w);
}

/** How many swap batches a date has reached (0 before the first cutover). Batches apply in order. */
export function solutionSwapBatchesFor(date: string): number {
  if (date < SOLUTION_SWAP_CUTOVER_DATE) return 0;
  if (date < SOLUTION_SWAP_2_CUTOVER_DATE) return 1;
  return date < SOLUTION_SWAP_3_CUTOVER_DATE ? 2 : 3;
}

/** The first `batches` swap batches, in order. */
export function applySolutionSwapBatches(pool: readonly string[], batches: number): string[] {
  let out = [...pool];
  if (batches >= 1) out = applySolutionSwaps(out);
  if (batches >= 2) out = applySolutionSwaps2(out);
  if (batches >= 3) out = applySolutionSwaps3(out);
  return out;
}

/** Every batch in order — the pool as every runtime sees it once the last cutover has passed. */
export function applyAllSolutionSwaps(pool: readonly string[]): string[] {
  return applySolutionSwapBatches(pool, 3);
}
