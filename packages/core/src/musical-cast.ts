// The musical cast easter egg (docs/cloud-prompts/10): long-press any cast puppet in the header → all ten turn
// "musical" (a staggered squash-and-pop, floating notes, a little glow); then each tap plays a note in that
// character's own voice. Left → right W O R D O C I O U S is a C major scale, C4 … E5. Play a public-domain tune
// correctly and a secret achievement unlocks (shown only once earned). Long-press again → back to normal laughs.
// Pure; pinned across TS / Swift / Kotlin by musical-cast-fixtures.json.
//
// Behind the musicalCast flag: ON in debug builds, OFF in release until the founder approves.

/** The flag: on in debug (web dev, iOS DEBUG, Android BuildConfig.DEBUG), off in release. */
export const MUSICAL_CAST_FLAG = { debug: true, release: false } as const;

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
  /** The tune as MIDI notes, in C (every note on the cast's keys). Matched by its intervals, so any key that fits counts. */
  notes: readonly number[];
}

const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74;

/** Public-domain tunes (their best-known opening, every note on a cast key). */
export const MUSICAL_MELODIES: readonly MusicalMelody[] = [
  { id: 'mary', name: 'Mary Had a Little Lamb', achievement: 'tune_little_lamb', notes: [E4, D4, C4, D4, E4, E4, E4, D4, D4, D4, E4, G4, G4] },
  { id: 'twinkle', name: 'Twinkle, Twinkle, Little Star', achievement: 'tune_little_star', notes: [C4, C4, G4, G4, A4, A4, G4, F4, F4, E4, E4, D4, D4, C4] },
  { id: 'ode', name: 'Ode to Joy', achievement: 'tune_ode_to_joy', notes: [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4] },
  { id: 'birthday', name: 'Happy Birthday', achievement: 'tune_happy_birthday', notes: [G4, G4, A4, G4, C5, B4, G4, G4, A4, G4, D5, C5] },
  { id: 'buns', name: 'Hot Cross Buns', achievement: 'tune_hot_cross_buns', notes: [E4, D4, C4, E4, D4, C4, C4, C4, C4, C4, D4, D4, D4, D4, E4, D4, C4] },
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
 */
export const HALLOWEEN_MELODIES: readonly MusicalMelody[] = [
  { id: 'mountain_king', name: 'In the Hall of the Mountain King', achievement: 'tune_mountain_king', notes: [A4h, B4h, C5h, D5h, E5h, C5h, E5h, D5h, B4h, D5h] },
  { id: 'toccata', name: 'Toccata and Fugue in D minor', achievement: 'tune_toccata', notes: [A4h, G4h, A4h, G4h, F4h, E4h, D4h, C4h, D4h] },
  { id: 'funeral_march', name: 'Funeral March', achievement: 'tune_funeral_march', notes: [A4h, A4h, A4h, A4h, C5h, B4h, B4h, A4h, A4h, G4h, A4h] },
  { id: 'marionette', name: 'Funeral March of a Marionette', achievement: 'tune_marionette', notes: [A4h, A4h, G4h, F4h, G4h, A4h, B4h] },
  { id: 'danse_macabre', name: 'Danse Macabre', achievement: 'tune_danse_macabre', notes: [A4h, A4h, C5h, A4h, B4h, C5h, A4h, C5h, A4h, C5h, B4h, C5h, B4h, A4h] },
  { id: 'bald_mountain', name: 'Night on Bald Mountain', achievement: 'tune_bald_mountain', notes: [B4h, C5h, B4h, A4h, B4h, C5h, C5h, E5h, B4h] },
  { id: 'sorcerers_apprentice', name: "The Sorcerer's Apprentice", achievement: 'tune_sorcerers_apprentice', notes: [A4h, E5h, A4h, C5h, A4h, C5h, B4h, C5h, A4h, C5h] },
];

/** Halloween tunes still waiting for checked notation: none (all five from the plan are wired above). */
export const HALLOWEEN_TUNES_TODO: readonly string[] = [];

/** The tunes that count right now: the everyday five, plus the season's own (halloween). */
export function activeMelodies(season: string | null = null): readonly MusicalMelody[] {
  return season === 'halloween' ? [...MUSICAL_MELODIES, ...HALLOWEEN_MELODIES] : MUSICAL_MELODIES;
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

/** The secret achievement keys (achievement-rules NEW_ACHIEVEMENTS, `secret`: shown only once unlocked). */
export const MUSICAL_ACHIEVEMENT_KEYS: readonly string[] = [...MUSICAL_MELODIES, ...HALLOWEEN_MELODIES].map((m) => m.achievement);
