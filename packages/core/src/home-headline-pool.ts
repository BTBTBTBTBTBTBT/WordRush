// Home headline POOL (founder 10-16: "adjust and expand on the verbiage shown with the custom letters on the
// main screen … seasonality touches … different time of day sayings that will not feel stale … Double Flawless …
// more responsiveness to the last games played or next games up … fresh and pleasantly surprising … no negative
// impact on loads or choppiness"). PROTOTYPE — core only, not wired (docs/review/home-headlines/PROPOSAL.md).
//
// The system: the Home state picks a CONTEXT by priority (Double Flawless > fresh personal record > streak news >
// flawless row > all done > row done > last-played reaction > next-up nudge > holiday > season pack > weekday >
// time of day). Each context has a POOL of lines; a seasonal FLAVOR pool is mixed in at a set rate; a rare
// SURPRISE line replaces a non-celebration pick. Selection is deterministic — seeded by (user, date, time bucket,
// context) — so nothing changes per frame or per minute inside a bucket, and a small "recently shown" history
// (caller-persisted, local only) keeps a line from repeating for N days. Every line is checked against the
// bubble-lettering fit for the device's slot (two lines at full size, never shrunk below 85%, never clipped);
// the legacy `bannerHeadline` line is the always-fitting fallback. Pure, so web, iOS and Android read the
// SAME words (parity fixtures: see the proposal's fixture plan). American spelling, no emoji, no shaming.

import { bannerHeadline, groupTier, type BannerTier, type GroupProgress, type HeadlineOptions, type RowStreaks } from './home-banner';
import { dayHash, streakHeadline } from './streak-headline';
import { bubbleFit, homeHeadlineFit } from './bubble-text';
import { headlineFontSize } from './headline-tokens';

// ---------------------------------------------------------------------------
// Inputs (everything Home already holds in memory; no new network calls).

export type TimeBucket = 'lateNight' | 'earlyMorning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

/** Local hour 0-23 → the bucket. Late night 0-4, early 5-7, morning 8-11, midday 12-13, afternoon 14-16, evening 17-20, night 21-23. */
export function timeBucket(hour: number): TimeBucket {
  if (hour < 5) return 'lateNight';
  if (hour < 8) return 'earlyMorning';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

/** Headline packs: calendar windows for seasonal flavor (independent of the art seasons; wraps past Dec 31). */
export const HEADLINE_PACKS = [
  { id: 'halloween', start: [10, 9], end: [10, 31] },
  { id: 'thanksgiving', start: [11, 14], end: [11, 29] },
  { id: 'winter', start: [12, 1], end: [12, 30] },
  { id: 'newyear', start: [12, 31], end: [1, 6] },
  { id: 'valentines', start: [2, 7], end: [2, 14] },
  { id: 'spring', start: [3, 20], end: [4, 15] },
  { id: 'summer', start: [6, 21], end: [7, 10] },
  { id: 'fall', start: [9, 22], end: [10, 8] },
] as const;
export type HeadlinePack = (typeof HEADLINE_PACKS)[number]['id'];

/** The pack a local `YYYY-MM-DD` falls in (null = none). */
export function headlinePack(dateKey: string): HeadlinePack | null {
  const [, m, d] = dateKey.split('-').map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return null;
  const k = m * 100 + d;
  for (const p of HEADLINE_PACKS) {
    const a = p.start[0] * 100 + p.start[1];
    const b = p.end[0] * 100 + p.end[1];
    if (a <= b ? k >= a && k <= b : k >= a || k <= b) return p.id;
  }
  return null;
}

/** Weekday 0 (Sunday) – 6 for a `YYYY-MM-DD` (calendar math, no time zones). */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface LastGame {
  /** The game's title as shown on its card ("Muddle"). */
  title: string;
  won: boolean;
  /** Minutes since it finished (the reaction fades after `LAST_GAME_FRESH_MINUTES`). */
  minutesAgo: number;
  /** A personal best landed with it (best time / score / guesses for that game). */
  record?: boolean;
}

export interface HeadlineContext {
  name: string;
  hour: number;
  /** Local day `YYYY-MM-DD`. */
  dateKey: string;
  word: GroupProgress;
  puzzles: GroupProgress;
  streaks?: { word: RowStreaks; puzzles: RowStreaks };
  unlimited?: boolean;
  /** The next unplayed daily's title in the player's own order (null when none). */
  nextGame?: string | null;
  lastGame?: LastGame | null;
  /** Today's holiday key from the bundled table (holidayKeyForDay), null when none. */
  holiday?: string | null;
  /** The headline slot's text width in px (the platform's measured slot; default = a 390 phone). */
  slotWidth?: number;
  /** A stable per-user salt (user id; '' for guests) so two players at the same table read different lines. */
  userSeed?: string;
  /** Recently shown line ids (the templates), caller-persisted locally; see HISTORY_DAYS. */
  history?: readonly string[];
}

export type HeadlineContextKind =
  | 'unlimited' | 'doubleFlawless' | 'streak' | 'flawlessRow' | 'newRecord' | 'allDone' | 'rowDone'
  | 'lastPlayed' | 'nextUp' | 'holiday' | 'pack' | 'weekday' | 'timeOfDay' | 'surprise' | 'legacy';

export interface HeadlineChoice {
  text: string;
  /** The line's stable id (its template) — push it on the caller's history when it is SHOWN. */
  id: string;
  context: HeadlineContextKind;
  /** The time bucket the pick was seeded with (recompute when it changes, i.e. at most 7 times a day). */
  bucket: TimeBucket;
}

/** A last-played reaction lives this long after the game ends. */
export const LAST_GAME_FRESH_MINUTES = 20;
/** The caller keeps ids shown in the last N days (one entry per shown line; ~14 × 30 bytes). */
export const HISTORY_DAYS = 10;
/** Seasonal flavor replaces the base pick this often during a pack (1 in SEASON_RATE picks are base). */
export const SEASON_RATE = 3;
/** The rare surprise: 1 in SURPRISE_RATE non-celebration picks. */
export const SURPRISE_RATE = 12;
/** A pool line must keep at least this share of the device's full lettering size. */
export const MIN_FIT_SCALE = 0.85;
export const DEFAULT_SLOT_WIDTH = 294;

// ---------------------------------------------------------------------------
// The copy bank. `{name}` = the player's name (hero gold line), `{next}` = the next unplayed game, `{last}` = the
// last game played, `{n}` = the streak, `{left}` = puzzles left today. Lines needing a slot are skipped when it
// is empty. Keep each line under ~30 characters so it fits two bubble lines on a small phone (the test checks).

const T = {
  lateNight: [
    'UP LATE, {name}?', 'NIGHT OWL, {name}?', 'MOONLIT WORDS, {name}', 'ONE MORE BEFORE BED?',
    'QUIET HOURS, SHARP MIND', 'MIDNIGHT WORDS HIT DIFFERENT', 'STILL UP? SO ARE THE PUZZLES', 'A LITTLE LATE-NIGHT WORDPLAY',
    'THE LETTERS ARE UP TOO', 'INSOMNIA LOVES A GOOD PUZZLE',
  ],
  earlyMorning: [
    'EARLY BIRD, {name}!', 'UP WITH THE SUN, {name}', 'FIRST LIGHT, FIRST WORD', 'COFFEE FIRST OR PUZZLE FIRST?',
    'DAWN PATROL, {name}', 'THE DAY IS BRAND NEW', 'RISE AND SOLVE, {name}!', 'BEAT THE SUN TO IT',
    'SUNRISE SOLVE, {name}', 'A HEAD START ON TODAY',
  ],
  morning: [
    'GOOD MORNING, {name}!', 'FRESH PUZZLES, {name}!', 'A NEW DAY, {name}!', 'BRIGHT-EYED, {name}?',
    'TOP O\' THE DAY, {name}', 'MORNING BRAIN, MEET PUZZLES', 'LET\'S BEGIN, {name}!', '18 FRESH PUZZLES, {name}',
    'MORNING! THE BOARDS ARE SET', 'COFFEE\'S ON, {name}', 'RISE AND SHINE, {name}', 'GOOD MORNING! ALL NEW TODAY',
  ],
  midday: [
    'HAPPY LUNCHTIME, {name}!', 'HIGH NOON, {name}', 'A MIDDAY PUZZLE BREAK?', 'LUNCH BREAK, {name}?',
    'HALFWAY THROUGH THE DAY', 'NOON ALREADY, {name}?', 'PERFECT TIME FOR A ROUND', 'GAME ON, {name}',
    'BREAK TIME, BRAIN TIME', 'SANDWICH IN ONE HAND?',
  ],
  afternoon: [
    'GOOD AFTERNOON, {name}!', 'READY, {name}?', 'THE AFTERNOON IS YOURS', 'A LITTLE 3 PM BRAIN BOOST',
    'HELLO AGAIN, {name}', 'SUNNY SIDE UP, {name}', 'AFTERNOON SLUMP? NOT HERE', 'TEA TIME, {name}?',
    'BOARDS AWAIT, {name}', 'MID-AFTERNOON, MID-GENIUS',
  ],
  evening: [
    'GOOD EVENING, {name}!', 'WIND DOWN, {name}', 'DINNER\'S DONE? PUZZLE TIME', 'GOLDEN HOUR, {name}',
    'EVENING WORDS, {name}', 'SLIPPERS ON, PUZZLES OPEN', 'SETTLE IN, {name}', 'A COZY EVENING ROUND',
    'LIGHTS LOW, LETTERS BRIGHT', 'YOUR MOVE, {name}',
  ],
  night: [
    'STARRY NIGHT, {name}', 'ONE LAST ROUND, {name}?', 'BEFORE BED, A PUZZLE', 'STARS ARE OUT, {name}',
    'A NIGHTCAP OF WORDS', 'LATE SHIFT, {name}', 'THE DAY ISN\'T OVER YET', 'PAJAMA PUZZLES, {name}',
    'NIGHT MODE: ON', 'UNWIND, {name}',
  ],
} as const satisfies Record<TimeBucket, readonly string[]>;

const WEEKDAY: readonly (readonly string[])[] = [
  ['SUNDAY, {name}!', 'SLOW SUNDAY, SHARP WORDS', 'NO RUSH TODAY, {name}', 'SUNDAY FUNDAY, {name}'],
  ['MONDAY MASTER, {name}', 'MONDAY? PUZZLES FIX THAT', 'NEW WEEK, {name}!', 'OWN MONDAY, {name}'],
  ['TUESDAY TITAN, {name}', 'TERRIFIC TUESDAY, {name}', 'TUESDAY: THE SLEEPER HIT', 'GAME FACE, {name}'],
  ['WIZARD HOURS, {name}', 'HUMP DAY, {name}!', 'MIDWEEK MAGIC, {name}', 'WEDNESDAY WORDS AWAIT'],
  ['THUNDER TIME, {name}!', 'ALMOST FRIDAY, {name}', 'FRIDAY EVE, {name}', 'THUNDER AHEAD, {name}'],
  ['FRIDAY\'S FINEST, {name}!', 'HAPPY FRIDAY, {name}!', 'FRIDAY FEELING, {name}', 'TGIF, {name}!'],
  ['SATURDAY STAR, {name}!', 'ALL YOURS, {name}', 'WEEKEND WORDS, {name}', 'SLOW SATURDAY, QUICK WINS'],
];

/** Holiday-day greetings (keys = holiday-days.json). Inclusive and warm; never assumes anyone celebrates. */
const HOLIDAY: Readonly<Record<string, readonly string[]>> = {
  newyear: ['HAPPY NEW YEAR, {name}!', 'NEW YEAR, NEW WORDS', 'FRESH YEAR, FRESH PUZZLES', 'A CLEAN SLATE, {name}'],
  mlkday: ['A DAY TO REFLECT, {name}', 'WORDS CAN MOVE THE WORLD'],
  groundhog: ['SIX MORE WEEKS OF PUZZLES', 'DID THE GROUNDHOG SEE IT?', 'SAME DAY AGAIN? NEW PUZZLES'],
  valentines: ['BE MINE, {name}?', 'WORDS FROM THE HEART', 'LOVE AT FIRST LETTER', 'ROSES ARE RED, {name}'],
  presidents: ['HAIL TO THE CHIEF, {name}', 'A PRESIDENTIAL PUZZLE DAY'],
  lunarnewyear: ['HAPPY LUNAR NEW YEAR!', 'GOOD FORTUNE, {name}', 'LUCKY YEAR, {name}'],
  mardigras: ['LAISSEZ LES MOTS ROULER', 'MARDI GRAS, {name}!', 'FAT TUESDAY, FULL BOARDS'],
  stpatricks: ['LUCKY DAY, {name}!', 'GREEN ALL OVER, {name}', 'FOUR-LEAF LETTERS TODAY', 'SLÁINTE, {name}!'],
  aprilfools: ['NO TRICKS, JUST PUZZLES', 'APRIL FOOLS, {name}!', 'TRUST NO WORD TODAY'],
  passover: ['CHAG SAMEACH, {name}', 'A STORY WORTH RETELLING'],
  easter: ['HAPPY EASTER, {name}!', 'WORDS HIDDEN LIKE EGGS', 'HOPPY SOLVING, {name}'],
  earthday: ['HAPPY EARTH DAY, {name}', 'GREEN LETTERS, BLUE PLANET', 'EARTH DAY, {name}!'],
  cincodemayo: ['FELIZ CINCO DE MAYO!', 'FIESTA TIME, {name}', 'CINCO LETRAS, {name}?'],
  mothersday: ['HAPPY MOTHER\'S DAY!', 'CALL YOUR MOM, {name}', 'MOMS KNOW ALL THE WORDS'],
  memorial: ['IN REMEMBRANCE, {name}', 'A DAY TO HONOR AND REST'],
  juneteenth: ['JUNETEENTH, {name}', 'FREEDOM DAY, {name}', 'CELEBRATE AND REFLECT'],
  fathersday: ['HAPPY FATHER\'S DAY!', 'DAD JOKES NOT INCLUDED', 'CALL YOUR DAD, {name}'],
  july4: ['HAPPY FOURTH, {name}!', 'STARS, STRIPES AND LETTERS', 'FIREWORKS LATER. PUZZLES NOW', 'RED, WHITE AND WORDS'],
  labor: ['HAPPY LABOR DAY, {name}', 'REST, THEN PUZZLE', 'A DAY OFF WELL EARNED'],
  indigenous: ['HARVEST MOON, {name}', 'A BRIGHT MOON, BRIGHT MIND', 'UNDER THE HARVEST MOON'],
  halloween: ['HAPPY HALLOWEEN!', 'BOO, {name}!', 'TRICK OR TREAT? PUZZLE', 'SPOOKY SOLVING, {name}', 'FANGS A LOT, {name}'],
  veterans: ['THANK YOU, VETERANS', 'HONOR AND THANKS'],
  diwali: ['HAPPY DIWALI, {name}!', 'LIGHT WINS, {name}', 'A FESTIVAL OF LIGHT'],
  thanksgiving: ['HAPPY THANKSGIVING!', 'GRATEFUL, {name}', 'PASS THE PIE, {name}', 'FEAST ON WORDS, {name}', 'THANKFUL AND FULL'],
  hanukkah: ['HAPPY HANUKKAH, {name}!', 'EIGHT NIGHTS OF LIGHT', 'FESTIVAL OF LIGHTS!'],
  christmas: ['MERRY CHRISTMAS!', 'MERRY, {name}!', 'HO HO HO, {name}', 'UNWRAP TODAY\'S PUZZLES'],
  kwanzaa: ['HAPPY KWANZAA, {name}!', 'JOYOUS KWANZAA, {name}'],
};

/** Season packs: flavored greetings mixed into the greeting contexts during the window (inclusive by design). */
const PACK: Readonly<Record<HeadlinePack, readonly string[]>> = {
  halloween: [
    'SOMETHING WICKED THIS WAY WORDS', 'BOO-TIFUL DAY, {name}', 'SPOOKY SEASON, {name}', 'CREEP IT REAL, {name}',
    'WITCHING HOUR WORDS', 'NO GHOSTS, JUST PUZZLES', 'PUMPKIN TIME, {name}', 'EERIE GOOD PUZZLES TODAY',
    'A HAUNTINGLY GOOD DAY', 'GOBLIN MODE, {name}?',
  ],
  thanksgiving: [
    'GRATEFUL FOR PUZZLES', 'GOBBLE UP A PUZZLE', 'HARVEST SEASON, {name}', 'PIE LATER. PUZZLE NOW',
    'THANKFUL FOR YOU', 'A CORNUCOPIA OF WORDS', 'LEFTOVERS AND LETTERS', 'COZY SEASON, {name}',
  ],
  winter: [
    'HAPPY HOLIDAYS, {name}!', 'SEASON\'S GREETINGS!', 'WARM WISHES, {name}', 'COCOA AND CROSSWORDS?',
    'LET IT SNOW, LET IT SOLVE', 'COZY UP, {name}', 'FESTIVE PUZZLES AWAIT', 'TWINKLY SEASON, {name}',
    'SNOW DAY VIBES, {name}', 'BUNDLE UP, {name}', 'MERRY EVERYTHING!', 'HOLIDAY HOURS: ALWAYS OPEN',
  ],
  newyear: [
    'NEW YEAR, SAME GENIUS', 'RESOLUTION: MORE PUZZLES', 'A FRESH YEAR OF WORDS', 'CHEERS, {name}!',
    'DAY ONE, {name}!', 'OUT WITH THE OLD WORDS',
  ],
  valentines: ['PUZZLES ARE OUR LOVE LANGUAGE', 'YOU\'RE A CATCH, {name}', 'SWEET ON WORDS, {name}', 'HEARTS AND LETTERS'],
  spring: ['SPRING HAS SPRUNG!', 'FRESH AS SPRING, {name}', 'BLOOMING GOOD PUZZLES', 'APRIL SHOWERS, WORD POWERS'],
  summer: ['SUMMER WORDS, {name}', 'SUNSCREEN AND SUDOKU?', 'LONG DAYS, LONG WORDS', 'BEACH BRAIN? NOT YOU'],
  fall: ['SWEATER WEATHER!', 'CRISP AIR, CRISP MIND', 'FALLING FOR PUZZLES', 'PUMPKIN SPICE AND PUZZLES'],
};

const DOUBLE_FLAWLESS: readonly string[] = [
  'DOUBLE FLAWLESS!', 'DOUBLE GOLD, {name}!', 'FLAWLESS TIMES TWO!', '18 FOR 18. UNREAL, {name}!',
  'A PERFECT DAY, {name}!', 'NOT ONE MISS. DOUBLE FLAWLESS!', 'TAKE A BOW, {name}!', 'FLAWLESS. BOTH ROWS. WOW',
  'THE WHOLE BOARD GLOWS GOLD', 'ZERO MISSES, {name}!', 'A GOLDEN DAY, {name}!', 'FRAME THIS ONE, {name}',
];
const DOUBLE_FLAWLESS_PACK: Partial<Record<HeadlinePack, readonly string[]>> = {
  halloween: ['SCARY GOOD, {name}!', 'A FRIGHTFULLY PERFECT DAY', 'DOUBLE FLAWLESS! NO TRICKS', 'PERFECT TO THE BONE'],
  thanksgiving: ['A FEAST OF FLAWLESS', 'DOUBLE FLAWLESS! GRATEFUL', 'STUFFED WITH WINS'],
  winter: ['DOUBLE FLAWLESS! A GIFT', 'PERFECT AS FRESH SNOW', 'A FLAWLESS HOLIDAY'],
  newyear: ['A PERFECT START, {name}!', 'DOUBLE FLAWLESS! WHAT A YEAR'],
};

const FLAWLESS_ROW: readonly string[] = [
  'WORDOCIOUS FLAWLESS! {left} LEFT', 'FLAWLESS ROW! {left} TO GO', 'ONE ROW GOLD. {left} MORE', 'HALF THE DAY, ALL PERFECT',
  'GOLD ROW, {name}!', 'NO MISSES YET, {name}', 'FLAWLESS SO FAR, {name}!', 'A ROW OF GOLD, {left} LEFT',
  'PERFECT ROW! NOW {next}?', 'FLAWLESS! {next} IS NEXT',
];
const FLAWLESS_ROW_PACK: Partial<Record<HeadlinePack, readonly string[]>> = {
  halloween: ['SPOOKY PERFECT, {name}!', 'A FLAWLESS FRIGHT, {left} LEFT'],
  thanksgiving: ['FLAWLESS! SAVE ROOM FOR {left}', 'A GOLDEN HARVEST'],
  winter: ['FLAWLESS! {left} GIFTS LEFT', 'A ROW OF GOLD, {name}!'],
};

const NEW_RECORD: readonly string[] = [
  'NEW RECORD IN {last}!', 'PERSONAL BEST, {name}!', 'A NEW BEST IN {last}!', 'RECORD BREAKER, {name}!',
  'FASTEST {last} YET!', 'YOUR BEST {last} EVER', 'A NEW HIGH MARK, {name}', 'A RECORD, {name}!',
  'NEW BEST! {left} LEFT TODAY', 'BEST EVER, {name}!',
];

const ALL_DONE: readonly string[] = [
  'ALL 18 DONE, {name}!', 'DOUBLE SWEEP, {name}!', 'THAT\'S A WRAP, {name}!', 'EVERY BOARD, DONE', 'CLEAN SWEEP, {name}!',
  'NOTHING LEFT BUT BRAGGING', 'FULL HOUSE, {name}!', 'DAY COMPLETE. NICELY DONE', 'TABLE CLEARED, {name}',
  'SEE YOU TOMORROW!',
];
const ALL_DONE_PACK: Partial<Record<HeadlinePack, readonly string[]>> = {
  halloween: ['ALL TREATS, NO TRICKS LEFT', 'THE CRYPT IS EMPTY'],
  thanksgiving: ['PLATE CLEAN, {name}!', 'ALL GOBBLED UP, {name}'],
  winter: ['EVERY GIFT UNWRAPPED', 'COCOA TIME, {name}'],
  newyear: ['A COMPLETE DAY, {name}!', 'DONE AND DUSTED!'],
};

const ROW_DONE: readonly string[] = [
  'ROW ONE DONE! {left} LEFT', 'SWEPT A ROW! {left} TO GO', 'HALFWAY HOME, {name}', 'ONE ROW DOWN, {left} LEFT',
  'SWEEP! NOW {next}?', 'KEEP THE BROOM OUT', 'ROW SWEPT! {left} MORE', 'NICE SWEEP, {name}!',
];

const LAST_WON: readonly string[] = [
  'NICE {last}, {name}!', '{last}: CONQUERED', 'THAT {last} WAS CLEAN', 'STILL WARM FROM {last}', 'ONE MORE LIKE THAT',
  'WELL PLAYED, {name}!', '{last} DOWN. {left} LEFT', 'SMOOTH {last}!', '{last} LOOKED EASY', 'ON A ROLL, {name}!',
  'NEXT UP: {next}?', '{last} DONE. {next} NEXT?',
];
const LAST_LOST: readonly string[] = [
  'TOUGH {last}. YOU\'VE GOT THIS', 'A TRICKY ONE, {name}', 'SHAKE IT OFF, {name}', 'ON TO THE NEXT, {name}', 'THAT {last} WAS A BEAST',
  'REGROUP. {next} AWAITS', 'EVERYONE MISSES ONE', 'FRESH START WITH {next}?', 'NO SWEAT, {name}', 'THE NEXT ONE IS YOURS',
];

const NEXT_UP: readonly string[] = [
  'NEXT UP: {next}', '{next} IS CALLING', '{next} AWAITS', 'WARMING UP · {played} DOWN', 'ON A ROLL · {played} OF {total}',
  'HOME STRETCH · {left} LEFT', 'HOW ABOUT {next}?', '{left} TO GO. {next} NEXT?', 'TRY {next} NEXT', 'KEEP IT ROLLING, {name}',
  '{next} IS WAITING', 'STRETCH GOAL: {next}', 'ALMOST THERE, {name}', 'YOU\'RE CRUISING, {name}', '{left} LEFT. YOU\'VE GOT TIME',
  'THE DAY ISN\'T DONE YET',
];
const NEXT_UP_PACK: Partial<Record<HeadlinePack, readonly string[]>> = {
  halloween: ['{next} LURKS NEXT', 'DARE TO TRY {next}?', 'SPOOKY GOOD PACE', 'THE CAULDRON HAS {left} LEFT'],
  thanksgiving: ['SECOND HELPING: {next}', 'ROOM FOR {left} MORE?', 'GRAVY ON TOP: {next}'],
  winter: ['UNWRAP {next} NEXT', '{left} STOCKINGS TO FILL', 'NEXT GIFT: {next}'],
  newyear: ['RESOLUTION: {next}', 'A NEW YEAR, {left} LEFT TODAY'],
};

const SURPRISE: readonly string[] = [
  'YOU\'RE KIND OF A BIG DEAL', 'THE LETTERS MISSED YOU', 'PLOT TWIST: MORE PUZZLES', 'A WILD PUZZLER APPEARS',
  'WE SAVED YOUR SEAT', 'FUN FACT: YOU\'RE GREAT', 'LOOK WHO\'S HERE!', 'TODAY FEELS LUCKY',
  'VOWELS ARE OVERRATED', 'YOU AGAIN? WONDERFUL', 'MAIN CHARACTER ENERGY', 'THE BOARD WHISPERS YOUR NAME',
  'CERTIFIED WORD NERD', 'SPELLING: 10/10', 'NO NOTES, {name}', 'SMALL STEPS, BIG WORDS',
];

const UNLIMITED: readonly string[] = ['UNLIMITED PLAY', 'ENDLESS PUZZLES, {name}', 'NO LIMITS TODAY', 'PLAY TILL YOU DROP', 'FRESH SEED EVERY TAP', 'UNLIMITED MODE, {name}'];

/** The whole bank, tagged (for the proposal's listing and the fixture generator). */
export const HEADLINE_BANK: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(Object.entries(T).map(([k, v]) => [`time/${k}`, v])),
  ...Object.fromEntries(WEEKDAY.map((v, i) => [`weekday/${i}`, v])),
  ...Object.fromEntries(Object.entries(HOLIDAY).map(([k, v]) => [`holiday/${k}`, v])),
  ...Object.fromEntries(Object.entries(PACK).map(([k, v]) => [`pack/${k}`, v])),
  'doubleFlawless': DOUBLE_FLAWLESS,
  ...Object.fromEntries(Object.entries(DOUBLE_FLAWLESS_PACK).map(([k, v]) => [`doubleFlawless/${k}`, v])),
  'flawlessRow': FLAWLESS_ROW,
  ...Object.fromEntries(Object.entries(FLAWLESS_ROW_PACK).map(([k, v]) => [`flawlessRow/${k}`, v])),
  'newRecord': NEW_RECORD,
  'allDone': ALL_DONE,
  ...Object.fromEntries(Object.entries(ALL_DONE_PACK).map(([k, v]) => [`allDone/${k}`, v])),
  'rowDone': ROW_DONE,
  'lastPlayed/won': LAST_WON,
  'lastPlayed/lost': LAST_LOST,
  'nextUp': NEXT_UP,
  ...Object.fromEntries(Object.entries(NEXT_UP_PACK).map(([k, v]) => [`nextUp/${k}`, v])),
  'surprise': SURPRISE,
  'unlimited': UNLIMITED,
};

// ---------------------------------------------------------------------------
// Selection.

interface Slots { name: string; next: string; last: string; n: string; left: string; played: string; total: string }

/** Fill `{slot}`s; null when a required slot is empty. */
export function fillHeadline(template: string, slots: Partial<Slots>): string | null {
  let missing = false;
  const out = template.replace(/\{(name|next|last|n|left|played|total)\}/g, (_, k: keyof Slots) => {
    const v = slots[k];
    if (v === undefined || v === '') { missing = true; return ''; }
    return v;
  });
  return missing ? null : out.toUpperCase();
}

/**
 * Does `text` keep two near-full-size bubble lines in a `slotWidth` slot? A stacked name (BJ6) keeps its hero
 * line(s) with at most one line of words beside it; any other line must fit on one line, or on a balanced
 * two-line wrap, at >= MIN_FIT_SCALE of the device's full size (the wiring passes the same minSize / maxLines
 * into the renderer's fit so a pool line wraps instead of shrinking).
 */
export function headlineFitsSlot(text: string, name: string, slotWidth: number): boolean {
  const full = headlineFontSize(slotWidth);
  const minSize = Math.ceil(full * MIN_FIT_SCALE);
  const fit = homeHeadlineFit(text, name, slotWidth);
  if (fit.nameLines.length > 0) return fit.size >= minSize && fit.lines.length - fit.nameLines.length <= 1;
  if (!fit.wrapped && fit.size >= minSize) return true;
  const two = bubbleFit(text, slotWidth, { maxSize: full, minSize, maxLines: 2 });
  return two.lines.length <= 2 && two.size >= minSize;
}

function pickFrom(pool: readonly string[], seed: string, slots: Partial<Slots>, name: string, slotWidth: number, history: readonly string[]): { id: string; text: string } | null {
  const fitted = pool
    .map((id) => ({ id, text: fillHeadline(id, slots) }))
    .filter((c): c is { id: string; text: string } => c.text !== null && headlineFitsSlot(c.text, name, slotWidth));
  if (fitted.length === 0) return null;
  const fresh = fitted.filter((c) => !history.includes(c.id));
  const candidates = fresh.length > 0 ? fresh : fitted;
  return candidates[dayHash(seed) % candidates.length];
}

function flavored(base: readonly string[], pack: HeadlinePack | null, packPool: Partial<Record<string, readonly string[]>> | null, seed: string): readonly string[] {
  const extra = pack && packPool ? packPool[pack] : undefined;
  if (!extra || extra.length === 0) return base;
  // SEASON_RATE: most picks in a pack wear the season; one in SEASON_RATE stays plain so the season never saturates.
  return dayHash(`${seed}|flavor`) % SEASON_RATE === 0 ? base : extra;
}

/**
 * The Home headline from the pool. Deterministic for (user, date, time bucket, state); the caller re-runs it when
 * the bucket, progress, last game or history changes (never per frame). Falls back to the legacy
 * `bannerHeadline` line, which always fits.
 */
export function selectHomeHeadline(ctx: HeadlineContext): HeadlineChoice {
  const name = ctx.name.trim();
  const bucket = timeBucket(ctx.hour);
  const slotWidth = ctx.slotWidth ?? DEFAULT_SLOT_WIDTH;
  const history = ctx.history ?? [];
  const seedBase = `${ctx.userSeed ?? ''}|${ctx.dateKey}|${bucket}`;
  const legacyOpts: HeadlineOptions = { hour: ctx.hour, name, unlimited: ctx.unlimited, streaks: ctx.streaks, dateKey: ctx.dateKey };
  const legacy = (): HeadlineChoice => ({ text: bannerHeadline(ctx.word, ctx.puzzles, legacyOpts), id: 'legacy', context: 'legacy', bucket });

  const a = groupTier(ctx.word);
  const b = groupTier(ctx.puzzles);
  const total = ctx.word.total + ctx.puzzles.total;
  const played = Math.min(ctx.word.played, ctx.word.total) + Math.min(ctx.puzzles.played, ctx.puzzles.total);
  const left = Math.max(0, total - played);
  const pack = headlinePack(ctx.dateKey);
  const slots: Partial<Slots> = {
    name: name || undefined,
    next: ctx.nextGame?.trim() || undefined,
    last: ctx.lastGame?.title.trim() || undefined,
    left: left > 0 ? String(left) : undefined,
    played: String(played),
    total: String(total),
  };
  const choose = (kind: HeadlineContextKind, pool: readonly string[], packPool: Partial<Record<string, readonly string[]>> | null = null): HeadlineChoice | null => {
    const seed = `${seedBase}|${kind}`;
    const hit = pickFrom(flavored(pool, pack, packPool, seed), seed, slots, name, slotWidth, history);
    return hit ? { ...hit, context: kind, bucket } : null;
  };

  if (ctx.unlimited) return choose('unlimited', UNLIMITED) ?? legacy();

  const streakLine = (row: 'word' | 'puzzles', t: BannerTier): string | null => {
    const s = ctx.streaks?.[row];
    if (!s || t === 'none') return null;
    return streakHeadline(t === 'flawless'
      ? { kind: 'flawless', days: s.flawless, best: s.bestFlawless, dateKey: ctx.dateKey }
      : { kind: 'sweep', days: s.sweep, best: s.bestSweep, dateKey: ctx.dateKey });
  };
  const streakChoice = (line: string | null): HeadlineChoice | null =>
    line && headlineFitsSlot(line, name, slotWidth) ? { text: line, id: `streak:${line}`, context: 'streak', bucket } : null;

  const lastFresh = !!ctx.lastGame && ctx.lastGame.minutesAgo >= 0 && ctx.lastGame.minutesAgo <= LAST_GAME_FRESH_MINUTES;
  // The streak line (milestones, new best, restarts — the existing lines, unchanged) leads in two buckets of three
  // and yields to the pool in the third, so a day with streak news still reads fresh across its buckets.
  const streakLeads = dayHash(`${seedBase}|streakSwap`) % 3 !== 0;
  // 1. Double Flawless beats everything (the whole day glows gold); the Wordocious streak line gets one bucket in three.
  if (a === 'flawless' && b === 'flawless') {
    const streakNews = !streakLeads ? streakChoice(streakLine('word', a)) : null;
    return streakNews ?? choose('doubleFlawless', DOUBLE_FLAWLESS, DOUBLE_FLAWLESS_PACK) ?? legacy();
  }
  // 2. A personal record in the game just played (fresh for LAST_GAME_FRESH_MINUTES).
  if (lastFresh && ctx.lastGame?.record) { const c = choose('newRecord', NEW_RECORD); if (c) return c; }
  // 3. Streak news on a finished row.
  const streakNews = streakLeads ? streakChoice(streakLine('word', a)) ?? streakChoice(streakLine('puzzles', b)) : null;
  if (streakNews) return streakNews;
  // 4. One row flawless while the other is open.
  if ((a === 'flawless') !== (b === 'flawless') && left > 0) return choose('flawlessRow', FLAWLESS_ROW, FLAWLESS_ROW_PACK) ?? legacy();
  // 5. Everything finished (double sweep, or sweep + flawless).
  if (a !== 'none' && b !== 'none') return choose('allDone', ALL_DONE, ALL_DONE_PACK) ?? legacy();
  // 6. One row swept, the other open.
  if (a !== 'none' || b !== 'none') return choose('rowDone', ROW_DONE) ?? legacy();

  // The rare surprise, only where there is nothing to celebrate.
  const surprise = dayHash(`${seedBase}|surprise`) % SURPRISE_RATE === 0 ? choose('surprise', SURPRISE) : null;
  if (surprise) return surprise;

  // 7. A reaction to the game just played (fades after LAST_GAME_FRESH_MINUTES).
  if (lastFresh && played > 0) { const c = choose('lastPlayed', ctx.lastGame!.won ? LAST_WON : LAST_LOST); if (c) return c; }
  // 8. Mid-day: the next game up in the player's order.
  if (played > 0) return choose('nextUp', NEXT_UP, NEXT_UP_PACK) ?? legacy();

  // Nothing played yet: the greeting — holiday day > season pack (at its rate) > weekday (1 in 3) > time of day.
  const holidayPool = ctx.holiday ? HOLIDAY[ctx.holiday] : undefined;
  if (holidayPool) { const c = choose('holiday', holidayPool); if (c) return c; }
  if (pack && dayHash(`${seedBase}|pack`) % SEASON_RATE !== 0) { const c = choose('pack', PACK[pack]); if (c) return c; }
  if (dayHash(`${seedBase}|weekday`) % 3 === 0) { const c = choose('weekday', WEEKDAY[weekdayOf(ctx.dateKey)]); if (c) return c; }
  return choose('timeOfDay', T[bucket]) ?? legacy();
}
