// The musical cast easter egg (docs/cloud-prompts/10): long-press any cast puppet in the header → all ten turn
// "musical" (a staggered squash-and-pop, floating notes, a little glow); then each tap plays a note in that
// character's own voice. Left → right W O R D O C I O U S is a C major scale, C4 … E5. Play a public-domain tune
// correctly and a secret achievement unlocks (shown only once earned). Long-press again → back to normal laughs.
// Pure; pinned across TS / Swift / Kotlin by musical-cast-fixtures.json.
//
// Behind the musicalCast flag: ON in debug builds, ON in release too (founder 10-09: the tunes ship in 2.8).

/** The flag: on in debug (web dev, iOS DEBUG, Android BuildConfig.DEBUG), off in release. */
export const MUSICAL_CAST_FLAG = { debug: true, release: true } as const;

export function musicalCastEnabled(isDebugBuild: boolean): boolean {
  return isDebugBuild ? MUSICAL_CAST_FLAG.debug : MUSICAL_CAST_FLAG.release;
}

/** The header's cast, left → right (WORDOCIOUS). */
export const MUSICAL_CAST_IDS = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'] as const;
/** C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 as MIDI note numbers (the notes are cut by docs/design/brand/sounds/make-notes.py). */
export const MUSICAL_SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76] as const;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** "C4", "E5" … */
export function midiNoteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export interface MusicalNote { castId: string; index: number; midi: number; name: string; /** The sound name: note-<id> (note-h-<id> in a season with its own voicing). */ sound: string }

/**
 * In a season with its own spooky voicing (item 49), each cast member's note is the same voice with an instrument
 * layered under it (organ, xylophone "bones", celesta, low strings): the sound is `<prefix><id>`. Other seasons: none.
 * The registry's `slots.sounds.note` names the same prefix; this is the core's mirror so the three apps agree.
 */
export const SEASON_NOTE_PREFIX: Readonly<Record<string, string>> = { halloween: 'note-h-' };

/** A cast member's note (unknown id → null). `season` = the active season id (null/unknown = the normal voices). */
export function musicalNote(castId: string, season: string | null = null): MusicalNote | null {
  const index = (MUSICAL_CAST_IDS as readonly string[]).indexOf(castId);
  if (index < 0) return null;
  const midi = MUSICAL_SCALE[index];
  const prefix = (season && SEASON_NOTE_PREFIX[season]) || 'note-';
  return { castId, index, midi, name: midiNoteName(midi), sound: `${prefix}${castId}` };
}

// ── The transform ─────────────────────────────────────────────────────────────────────────────────────────

/** How long a press must hold to toggle musical mode, and the transform's timing (same perf rules as the puppets). */
export const MUSICAL_TIMING = {
  longPressMs: 550,
  /** A finger that drifts further than this (CSS px / pt / dp) cancels the long-press. */
  moveSlop: 10,
  /** Each character starts this much after its neighbor, rippling out from the one pressed. */
  staggerMs: 55,
  /** One character's squash-and-pop. */
  popMs: 420,
} as const;

/** The squash-and-pop keyframes (t 0..1 → scale x / y, a little lift in % of height): squash, stretch up, settle. */
export const MUSICAL_POP_KEYS: ReadonlyArray<{ t: number; sx: number; sy: number; lift: number }> = [
  { t: 0, sx: 1, sy: 1, lift: 0 },
  { t: 0.22, sx: 1.16, sy: 0.82, lift: 0 },
  { t: 0.5, sx: 0.9, sy: 1.14, lift: 9 },
  { t: 0.74, sx: 1.05, sy: 0.96, lift: 0 },
  { t: 1, sx: 1, sy: 1, lift: 0 },
];

/**
 * The per-character start delays (ms, WORDOCIOUS order): a ripple out from the pressed one (|i − pressed| × stagger).
 * Reduce Motion → every delay 0 (and the platforms swap instantly, no pop).
 */
export function musicalTransformDelays(pressedCastId: string, reduceMotion: boolean): number[] {
  const from = Math.max(0, (MUSICAL_CAST_IDS as readonly string[]).indexOf(pressedCastId));
  return MUSICAL_CAST_IDS.map((_, i) => (reduceMotion ? 0 : Math.abs(i - from) * MUSICAL_TIMING.staggerMs));
}

/** The whole transform's length (ms): the last delay + one pop; 0 under Reduce Motion. */
export function musicalTransformDuration(pressedCastId: string, reduceMotion: boolean): number {
  if (reduceMotion) return 0;
  return Math.max(...musicalTransformDelays(pressedCastId, false)) + MUSICAL_TIMING.popMs;
}

// ── Melodies ──────────────────────────────────────────────────────────────────────────────────────────────

export interface MusicalMelody {
  id: string;
  name: string;
  /** The secret achievement it unlocks. */
  achievement: string;
  /** The season (registry id) it only counts in; omitted = every day of the year. Data for the admin Sound Library. */
  season?: string;
  /** Where the public-domain tune comes from (composer / origin, year): shown in the admin Sound Library. */
  source: string;
  /** The discovery hint: a short, spoiler-light nudge (the rare idle hum, the Sound Library). Never the title. */
  hint: string;
  /** The tune as MIDI notes, in C (every note on the cast's keys). Matched by its intervals, so any key that fits counts. */
  notes: readonly number[];
  /**
   * What the cast sings back once the tune is matched (founder 10-13): the jingle finished to its natural end — Mary on
   * through "its fleece was white as snow", Ode to Joy home to its closing C — never a second verse. Absent → `notes`.
   */
  song?: readonly number[];
  /** Each sung note's length in replay beats (same length as `song ?? notes`), so held notes hold. Absent → 1 each. */
  beats?: readonly number[];
}

const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74;

/** Public-domain tunes (their best-known opening, every note on a cast key). */
export const MUSICAL_MELODIES: readonly MusicalMelody[] = [
  {
    id: 'mary', name: 'Mary Had a Little Lamb', achievement: 'tune_little_lamb', source: 'Sarah Josepha Hale, 1830; traditional tune', hint: 'A lamb whose fleece was white as snow', notes: [E4, D4, C4, D4, E4, E4, E4, D4, D4, D4, E4, G4, G4],
    song: [E4, D4, C4, D4, E4, E4, E4, D4, D4, D4, E4, G4, G4, E4, D4, C4, D4, E4, E4, E4, E4, D4, D4, E4, D4, C4],
    beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  },
  {
    id: 'twinkle', name: 'Twinkle, Twinkle, Little Star', achievement: 'tune_little_star', source: 'French folk tune, 1761; words Jane Taylor, 1806', hint: 'A little star, up above the world so high', notes: [C4, C4, G4, G4, A4, A4, G4, F4, F4, E4, E4, D4, D4, C4],
    beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2],
  },
  {
    id: 'ode', name: 'Ode to Joy', achievement: 'tune_ode_to_joy', source: 'Ludwig van Beethoven, Symphony No. 9, 1824', hint: "Beethoven's big finale, four notes up the scale", notes: [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4],
    song: [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4, E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, D4, C4, C4],
    beats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2],
  },
  {
    id: 'birthday', name: 'Happy Birthday', achievement: 'tune_happy_birthday', source: 'Patty and Mildred Hill, 1893 (public domain since 2016)', hint: 'The song with the candles, once a year', notes: [G4, G4, A4, G4, C5, B4, G4, G4, A4, G4, D5, C5],
    beats: [0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1, 2],
  },
  {
    id: 'buns', name: 'Hot Cross Buns', achievement: 'tune_hot_cross_buns', source: 'English street cry, 1798', hint: 'One a penny, two a penny', notes: [E4, D4, C4, E4, D4, C4, C4, C4, C4, C4, D4, D4, D4, D4, E4, D4, C4],
    beats: [1, 1, 2, 1, 1, 2, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 2],
  },
];

const A4h = 69, B4h = 71, C5h = 72, D5h = 74, E5h = 76, G4h = 67, F4h = 65, E4h = 64, D4h = 62, C4h = 60;

/**
 * The Halloween tunes (item 49): public-domain compositions played on the cast's own white keys (realized in A minor,
 * which is the cast's C major scale shifted: matching is by interval shape, so the tune keeps its contour). Only
 * active in season. Each is a hidden achievement.
 *   - In the Hall of the Mountain King (Grieg, 1875): B C# D E F# D F# . E C# E, here A B C D E C E . D B D.
 *   - Toccata and Fugue in D minor (Bach, BWV 565) opening: A G A . G F E D . C# D. The cast has no C#, so the cast's
 *     version plays the C natural: A G A G F E D C D.
 *   - Funeral March (Chopin, Piano Sonata No. 2, 1839), B-flat minor: Bb Bb Bb Bb Db C C Bb Bb A Bb, here A A A A C B B
 *     A A G A (G natural stands in for the leading tone G#). Checked against the Marche funebre score (bars 1-4).
 *   - Funeral March of a Marionette (Gounod, 1872), D minor: D D C# Bb C# D E, here A A G F G A B (G for G#). Checked
 *     against a lettered piano score (the Alfred Hitchcock Presents theme).
 *   - Danse Macabre (Saint-Saens, 1874), the G minor waltz theme: G G Bb G A Bb G Bb G Bb A Bb A G, here A A C A B C A C
 *     A C B C B A. Two independent lettered scores agree.
 *   - Night on Bald Mountain (Mussorgsky), D minor: E F E D E F F A E, here B C B A B C C E B. Checked against two piano
 *     arrangements (one with fingering that pins the pitches).
 *   - The Sorcerer's Apprentice (Dukas, 1897), the march theme (A minor): A E A C A C B C A C, as written. Checked
 *     against a lettered beginner score.
 * No tune's interval shape is a prefix or a copy of another's (musical-cast.test.ts pins that).
 * Founder 10-13, the sung-back jingle (`song`/`beats`), from Mutopia scores: Mountain King's whole first phrase in D minor
 * (in A it would need A5; G for E#, and the semitone-lower E C E echo repeats as G E G); Toccata's first two statements
 * at one octave (the score drops an octave each time); Bald Mountain's theme + its falling fill (an octave up, the score's
 * B3/A3 are below the cast). The other four keep their opening (no checked continuation yet).
 */
export const HALLOWEEN_MELODIES: readonly MusicalMelody[] = [
  { id: 'mountain_king', name: 'In the Hall of the Mountain King', achievement: 'tune_mountain_king', season: 'halloween', source: 'Edvard Grieg, Peer Gynt, 1875', hint: "Tiptoe up the steps of the mountain king's hall", notes: [A4h, B4h, C5h, D5h, E5h, C5h, E5h, D5h, B4h, D5h],
    song: [D4h, E4h, F4h, G4h, A4h, F4h, A4h, G4h, E4h, G4h, G4h, E4h, G4h, D4h, E4h, F4h, G4h, A4h, F4h, A4h, D5h, C5h, A4h, F4h, A4h, C5h],
    beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3] },
  { id: 'toccata', name: 'Toccata and Fugue in D minor', achievement: 'tune_toccata', season: 'halloween', source: 'Johann Sebastian Bach, BWV 565, c. 1704', hint: 'The spookiest organ opening ever written', notes: [A4h, G4h, A4h, G4h, F4h, E4h, D4h, C4h, D4h],
    song: [A4h, G4h, A4h, G4h, F4h, E4h, D4h, C4h, D4h, A4h, G4h, A4h, E4h, F4h, C4h, D4h],
    beats: [0.25, 0.25, 2, 0.25, 0.25, 0.25, 0.25, 0.5, 2.5, 0.25, 0.25, 2, 0.25, 0.25, 0.5, 3] },
  { id: 'funeral_march', name: 'Funeral March', achievement: 'tune_funeral_march', season: 'halloween', source: 'Frederic Chopin, Piano Sonata No. 2, 1839', hint: 'A slow march on one low note', notes: [A4h, A4h, A4h, A4h, C5h, B4h, B4h, A4h, A4h, G4h, A4h] },
  { id: 'marionette', name: 'Funeral March of a Marionette', achievement: 'tune_marionette', season: 'halloween', source: 'Charles Gounod, 1872', hint: "A puppet's march (a certain TV host liked it too)", notes: [A4h, A4h, G4h, F4h, G4h, A4h, B4h] },
  { id: 'danse_macabre', name: 'Danse Macabre', achievement: 'tune_danse_macabre', season: 'halloween', source: 'Camille Saint-Saens, 1874', hint: 'Skeletons waltzing at midnight', notes: [A4h, A4h, C5h, A4h, B4h, C5h, A4h, C5h, A4h, C5h, B4h, C5h, B4h, A4h] },
  { id: 'bald_mountain', name: 'Night on Bald Mountain', achievement: 'tune_bald_mountain', season: 'halloween', source: 'Modest Mussorgsky, 1867', hint: 'A wild night on a bare mountain', notes: [B4h, C5h, B4h, A4h, B4h, C5h, C5h, E5h, B4h],
    song: [B4h, C5h, B4h, A4h, B4h, C5h, C5h, E5h, B4h, B4h, C5h, D5h, E5h, E5h, D5h, C5h, B4h, A4h],
    beats: [1, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 1] },
  { id: 'sorcerers_apprentice', name: "The Sorcerer's Apprentice", achievement: 'tune_sorcerers_apprentice', season: 'halloween', source: 'Paul Dukas, 1897', hint: 'Brooms that will not stop marching', notes: [A4h, E5h, A4h, C5h, A4h, C5h, B4h, C5h, A4h, C5h] },
];

/** Halloween tunes still waiting for checked notation: none (all five from the plan are wired above). */
export const HALLOWEEN_TUNES_TODO: readonly string[] = [];

/**
 * The Thanksgiving tunes (founder 10-16: "a new batch in the same style"): public-domain compositions on the cast's
 * own white keys, matched by interval shape, active only in the Thanksgiving window (Nov 14 – 29) and only once the
 * season is READY (currentSeason gates it; the admin Season preview passes the id directly). Each is a secret
 * achievement. Normal voices (no seasonal note prefix): a harvest voicing is optional, see
 * docs/design/brand/seasons/thanksgiving/NEEDS-BADGES.md.
 *   - Simple Gifts (Joseph Brackett, 1848, Shaker; public domain — Copland's 1944 arrangement is NOT, we use the
 *     original tune): in G, D D | G G A B A B C D | D C B A G | A A A A | A B A F# D D. Realized a fifth up on the cast
 *     (D4 pickup, G4 tonic): the first phrase ("'Tis the gift to be simple, 'tis the gift to be free, 'tis the") is the
 *     match; the sung continuation ("gift to come down where we ought to be") ends on D4 with F natural standing in
 *     for F# (the cast has no black keys, same rule as the Halloween G-for-G#). Checked against a lettered flatpick
 *     transcription (raccoonbend.com) 10-16.
 *   - We Gather Together (Dutch folk tune in Valerius, 1626; Kremser's 1877 arrangement; words Theodore Baker, 1894), in
 *     D: A | A B A | F# G A | G F# E | F# D = the first line ("We gather together to ask the Lord's blessing"), realized
 *     in C (G | G A G | E F G | F E D | E C) with the whole four-line melody as the sung-back song (every note diatonic,
 *     all on the cast keys). Checked against the Open Hymnal's score from the 1940 Episcopal Hymnal, no. 315
 *     (https://github.com/mzealey/openhymnal/blob/HEAD/Complete/We_Gather_Together/We_Gather_Together-Kremser.abc, 2006)
 *     and hymnary.org's incipit for KREMSER (55653 45432 31556, https://hymnary.org/tune/kremser): they agree.
 *   - Come, Ye Thankful People, Come (George J. Elvey, St. George's Windsor, first published 1858; Henry Alford's words,
 *     1844): the first two lines are the same seven notes twice, in G: B B | D B G A B, here E E G E C D E x2 in C.
 *     Checked against the Open Hymnal's "Songs of Thankfulness and Praise" setting (Anglican Hymn Book, 1871,
 *     https://github.com/mzealey/openhymnal/blob/HEAD/Complete/Songs_Of_Thankfulness_And_Praise/Songs_Of_Thankfulness_And_Praise-St_Georges_Windsor.abc),
 *     the Wikipedia LilyPond score of "Come, Ye Thankful People, Come" (in F), and hymnary.org's incipit
 *     (33531 23335 31233, https://hymnary.org/tune/st_georges_windsor_elvey): three agree. The third line goes chromatic
 *     (a sharp), so there is no sung-back song beyond the hook.
 *   - Now Thank We All Our God (Johann Cruger, Nun danket, Praxis pietatis melica, 1647; Winkworth's words, 1856), in F:
 *     c | c c d d c | A Bb A G, here G | G G A A G | E F E D in C: the opening shared by the Evangelical Lutheran
 *     Hymn-Book 1931 setting (Open Hymnal, https://github.com/mzealey/openhymnal/blob/HEAD/Complete/Now_Thank_We_All_Our_God/Now_Thank_We_All_Our_God-Nun_Danket.abc,
 *     2006) and Bach's chorale prelude BWV 657 (Mutopia, https://www.mutopiaproject.org/ftp/BachJS/BWV657/bwv657/bwv657.ly,
 *     Bach-Album, Peters). Printings disagree after the tenth note (and the tune drops to the leading tone, B3, below the
 *     cast), so the hook stops there and there is no sung-back song.
 * The other candidates stay in THANKSGIVING_TUNES_TODO until their notation is checked against a score (the test
 * pins the list): never wire a tune from memory.
 */
export const THANKSGIVING_MELODIES: readonly MusicalMelody[] = [
  { id: 'simple_gifts', name: 'Simple Gifts', achievement: 'tune_simple_gifts', season: 'thanksgiving', source: 'Joseph Brackett, Shaker, 1848', hint: "'Tis the gift to be simple", notes: [D4h, D4h, G4h, G4h, A4h, B4h, A4h, B4h, C5h, D5h, D5h, C5h, B4h, A4h, G4h],
    song: [D4h, D4h, G4h, G4h, A4h, B4h, A4h, B4h, C5h, D5h, D5h, C5h, B4h, A4h, G4h, A4h, A4h, A4h, A4h, A4h, B4h, A4h, F4h, D4h],
    beats: [0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 2] },
  { id: 'we_gather', name: 'We Gather Together', achievement: 'tune_we_gather', season: 'thanksgiving', source: 'Dutch folk tune, 1626; arr. Eduard Kremser, 1877', hint: 'A Dutch melody for the whole table, asking a blessing', notes: [G4h, G4h, A4h, G4h, E4h, F4h, G4h, F4h, E4h, D4h, E4h, C4h],
    song: [G4h, G4h, A4h, G4h, E4h, F4h, G4h, F4h, E4h, D4h, E4h, C4h, G4h, G4h, A4h, B4h, C5h, D5h, B4h, A4h, G4h, A4h, G4h, G4h, G4h, A4h, B4h, C5h, G4h, G4h, G4h, A4h, F4h, G4h, E4h, C4h, C4h, F4h, G4h, A4h, F4h, G4h, F4h, E4h, E4h, F4h, D4h, C4h, C4h],
    beats: [1, 1.5, 0.5, 1, 1, 1, 1, 1.5, 0.5, 1, 1, 1, 1, 1.5, 0.5, 1, 1.5, 0.5, 1, 1.5, 0.5, 1, 2, 1, 1.5, 0.5, 1, 1, 1, 1, 1.5, 0.5, 0.5, 0.5, 1, 1, 1, 1.5, 0.5, 0.5, 0.5, 1.5, 0.5, 0.5, 0.5, 1, 1.5, 0.5, 2] },
  { id: 'thankful_people', name: 'Come, Ye Thankful People, Come', achievement: 'tune_thankful_people', season: 'thanksgiving', source: "George J. Elvey, St. George's Windsor, 1858", hint: 'The last wagon of the harvest rolls home', notes: [E4h, E4h, G4h, E4h, C4h, D4h, E4h, E4h, E4h, G4h, E4h, C4h, D4h, E4h],
    beats: [1.5, 0.5, 1, 1, 1, 1, 2, 1.5, 0.5, 1, 1, 1, 1, 2] },
  { id: 'now_thank', name: 'Now Thank We All Our God', achievement: 'tune_now_thank', season: 'thanksgiving', source: 'Johann Cruger, Nun danket, 1647', hint: 'A grand old chorale: thanks with heart, hands and voices', notes: [G4h, G4h, G4h, A4h, A4h, G4h, E4h, F4h, E4h, D4h],
    beats: [2, 1.5, 0.5, 1, 1, 3, 1, 1, 1, 2] },
];

/**
 * Thanksgiving tunes still waiting for checked notation (all public domain, verified 10-16): the words of "Over the
 * River and Through the Wood" are Lydia Maria Child's (1844) and its tune is traditional (no public-domain score could
 * be found to check against: only modern arrangements); "Bringing in the Sheaves" is George Minor's tune (1880; hymnary's
 * incipit 55565 31112 16555 gives no octaves, and no second score to settle whether the "6" is above or below the
 * tonic); "For the Beauty of the Earth" is Kocher's Dix (1838), checked (Open Hymnal / Wikipedia LilyPond agree) but it
 * spans E4 to D5 in G major with F# and C natural: realized in C it needs A3 or F5, outside the cast's C4-E5 keys.
 * "Turkey in the Straw" (19th-century folk) is public domain too but is left out on purpose: its minstrel-show history and
 * lyric variants make it a poor fit (founder 10-16: prefer the others if there's any doubt). Wire each once it can be
 * checked against a score and fits the keys, then move it into THANKSGIVING_MELODIES with its own secret achievement.
 */
export const THANKSGIVING_TUNES_TODO: readonly string[] = [
  'Over the River and Through the Wood', 'Bringing in the Sheaves', 'For the Beauty of the Earth',
];

/** Each season's own tunes (only count in that season; the achievements stay forever). Seasons without a batch: none. */
export const SEASON_MELODIES: Readonly<Record<string, readonly MusicalMelody[]>> = {
  halloween: HALLOWEEN_MELODIES,
  thanksgiving: THANKSGIVING_MELODIES,
};

/** The tunes that count right now: the everyday five, plus the season's own (SEASON_MELODIES). */
export function activeMelodies(season: string | null = null): readonly MusicalMelody[] {
  const own = season ? SEASON_MELODIES[season] : undefined;
  return own ? [...MUSICAL_MELODIES, ...own] : MUSICAL_MELODIES;
}

/** The steps between consecutive notes (the shape of a tune, key-free). */
export function melodyIntervals(notes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < notes.length; i++) out.push(notes[i] - notes[i - 1]);
  return out;
}

/**
 * The tune the played notes END with, or null. A tune counts when its last N notes have the tune's exact shape (its
 * intervals) — in C or any other key the cast can play. Ties → the longest tune.
 */
export function matchMelody(played: readonly number[], melodies: readonly MusicalMelody[] = MUSICAL_MELODIES): MusicalMelody | null {
  let best: MusicalMelody | null = null;
  for (const m of melodies) {
    if (played.length < m.notes.length) continue;
    const tail = played.slice(played.length - m.notes.length);
    const a = melodyIntervals(tail);
    const b = melodyIntervals(m.notes);
    if (a.every((v, i) => v === b[i]) && (!best || m.notes.length > best.notes.length)) best = m;
  }
  return best;
}

/** A pause longer than this starts a fresh phrase; the buffer keeps at most this many notes. */
export const MELODY_GAP_MS = 4000;
export const MELODY_BUFFER = 32;

export interface MelodyState { notes: number[]; lastAt: number | null }

export const MELODY_START: MelodyState = { notes: [], lastAt: null };

export interface MelodyTap {
  state: MelodyState;
  note: MusicalNote | null;
  /** The tune just completed (the buffer then clears so it can't fire twice). */
  matched: MusicalMelody | null;
}

/** One tap in musical mode at `atMs` (any clock in ms). Pure: returns the next state. */
export function melodyTap(state: MelodyState, castId: string, atMs: number, season: string | null = null): MelodyTap {
  const note = musicalNote(castId, season);
  if (!note) return { state, note: null, matched: null };
  const fresh = state.lastAt === null || atMs - state.lastAt > MELODY_GAP_MS || atMs < state.lastAt;
  const notes = [...(fresh ? [] : state.notes), note.midi].slice(-MELODY_BUFFER);
  const matched = matchMelody(notes, activeMelodies(season));
  return { state: { notes: matched ? [] : notes, lastAt: atMs }, note, matched };
}

/**
 * The playback (founder 10-12): every time a tune is completed the cast sings it back once, cleanly — each note on
 * its own figure — so the player hears that the keys made a song. Founder 10-13: they finish the jingle (`song`) in
 * its own rhythm (`beats`). `leadInMs` after the last tap, then each note `beats[i] × beatMs` after the one before.
 * Taps during the playback are ignored (they never feed the matcher).
 */
export const MELODY_REPLAY = { leadInMs: 450, beatMs: 300 } as const;

/** What the cast sings for a tune: its notes and each one's length in beats. */
export function melodySong(m: MusicalMelody): { notes: readonly number[]; beats: readonly number[] } {
  const notes = m.song ?? m.notes;
  return { notes, beats: m.beats ?? notes.map(() => 1) };
}

/** The completed tune as the cast plays it back: which figure sings each note and when (ms after the last tap). */
export function melodyReplay(m: MusicalMelody): Array<{ castId: string; atMs: number }> {
  const { notes, beats } = melodySong(m);
  let at = 0;
  return notes.flatMap((midi, i) => {
    const atMs = MELODY_REPLAY.leadInMs + Math.round(at * MELODY_REPLAY.beatMs);
    at += beats[i];
    const k = (MUSICAL_SCALE as readonly number[]).indexOf(midi);
    return k < 0 ? [] : [{ castId: MUSICAL_CAST_IDS[k], atMs }];
  });
}

/** The whole playback's length (ms after the last tap): the lead-in + every note's beats. */
export function melodyReplayDuration(m: MusicalMelody): number {
  return MELODY_REPLAY.leadInMs + Math.round(melodySong(m).beats.reduce((a, b) => a + b, 0) * MELODY_REPLAY.beatMs);
}

/** The secret achievement keys (achievement-rules NEW_ACHIEVEMENTS, `secret`: shown only once unlocked). */
/** Every tune in catalog order: the everyday five, then each season's batch (Halloween, Thanksgiving). */
export const ALL_MELODIES: readonly MusicalMelody[] = [...MUSICAL_MELODIES, ...HALLOWEEN_MELODIES, ...THANKSGIVING_MELODIES];

export const MUSICAL_ACHIEVEMENT_KEYS: readonly string[] = ALL_MELODIES.map((m) => m.achievement);
