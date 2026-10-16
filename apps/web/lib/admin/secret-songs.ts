/**
 * admin > Design > Sound Library > Secret songs (founder 10-16: "a secret easter egg song selection part … shown
 * there by season"). The musical-cast tunes straight from core (musical-cast.ts: the everyday five + each season's
 * batch in SEASON_MELODIES), grouped by season with the season's window, readiness and note voicing, each with the
 * secret achievement it unlocks (achievement-rules.ts) and the tap sequence shown as the cast's letters. Pure (no
 * React, no Supabase); the page adds the ▶ preview.
 *
 * Core's `season` (optional: a tune that names its own season wins over the batch it sits in), `source` (the
 * public-domain credit) and `hint` (the spoiler-light nudge) are read as-is; a tune with no hint falls back to its
 * achievement's description, an empty source shows nothing.
 */
import {
  MUSICAL_CAST_IDS, MUSICAL_MELODIES, MUSICAL_SCALE, NEW_ACHIEVEMENTS, SEASON_MELODIES, SEASON_NOTE_PREFIX, SEASON_WINDOWS,
  melodySong, midiNoteName, type MusicalMelody,
} from '@wordle-duel/core';

export const ALWAYS_GROUP = 'always';

/** One note of a tune as the cast plays it: which figure, its letter, the note name. */
export interface SongStep { castId: string; letter: string; note: string; midi: number; beats: number }

export interface SecretSongView {
  id: string;
  name: string;
  /** The group it lands in: ALWAYS_GROUP or a season id. */
  season: string;
  /** The secret achievement (key + what the player sees once it's earned). */
  achievement: { key: string; name: string; description: string } | null;
  /** The public-domain credit (composer / origin, year), null when the tune has none yet. */
  source: string | null;
  /** The in-app nudge, else the achievement description. */
  hint: string | null;
  /** The notes the player must tap (the match), as cast steps. */
  match: SongStep[];
  /** What the cast sings back once matched (the finished jingle), as timed cast steps. */
  song: SongStep[];
  /** The whole sung jingle, in beats. */
  totalBeats: number;
}

export interface SecretSongGroup {
  id: string;
  title: string;
  /** "Oct 9 – Oct 31" for a season, null for Always. */
  window: string | null;
  /** live = counts for the public now (Always, or a season marked `ready`); preview = only the admin Season preview. */
  status: 'live' | 'preview';
  /** The note sample prefix the season voices (note-h- …), or null for the everyday voices. */
  notePrefix: string | null;
  songs: SecretSongView[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (m: number, d: number) => `${MONTHS[m - 1] ?? m} ${d}`;

/** The cast letter for an id (o1 / o2 / o3 → O). */
export function castLetter(castId: string): string {
  return castId.charAt(0).toUpperCase();
}

function steps(notes: readonly number[], beats: readonly number[]): SongStep[] {
  const out: SongStep[] = [];
  notes.forEach((midi, i) => {
    const k = (MUSICAL_SCALE as readonly number[]).indexOf(midi);
    if (k < 0) return;
    const castId = MUSICAL_CAST_IDS[k];
    out.push({ castId, letter: castLetter(castId), note: midiNoteName(midi), midi, beats: beats[i] ?? 1 });
  });
  return out;
}

/** One tune as the page shows it (`season` = the group it belongs to). */
export function secretSongView(m: MusicalMelody, season: string, achievements: readonly { key: string; name: string; description: string }[] = NEW_ACHIEVEMENTS): SecretSongView {
  const a = achievements.find((e) => e.key === m.achievement) ?? null;
  const sung = melodySong(m);
  const song = steps(sung.notes, sung.beats);
  return {
    id: m.id,
    name: m.name,
    season,
    achievement: a ? { key: a.key, name: a.name, description: a.description } : null,
    source: m.source?.trim() || null,
    hint: m.hint?.trim() || a?.description || null,
    match: steps(m.notes, m.notes.map(() => 1)),
    song,
    totalBeats: song.reduce((s, st) => s + st.beats, 0),
  };
}

export interface SecretSongSources {
  always: readonly MusicalMelody[];
  bySeason: Readonly<Record<string, readonly MusicalMelody[]>>;
  windows: readonly { id: string; start: readonly [number, number]; end: readonly [number, number]; ready: boolean }[];
  notePrefix: Readonly<Record<string, string>>;
  /** The season's display name (the registry title). */
  label: (id: string) => string;
  achievements?: readonly { key: string; name: string; description: string }[];
}

/**
 * Songs → groups: Always first (the everyday tunes, or any tune without a season), then every season with a
 * batch in calendar (SEASON_WINDOWS) order; a season that has tunes but no window still gets its own group
 * (status preview, no dates); a season with no tunes is hidden. A tune's own `season` field (optional) wins
 * over the batch it sits in.
 */
export function groupSecretSongs(src: SecretSongSources): SecretSongGroup[] {
  const buckets = new Map<string, SecretSongView[]>();
  const put = (m: MusicalMelody, fallback: string) => {
    const season = (m.season ?? '').trim() || fallback;
    if (!buckets.has(season)) buckets.set(season, []);
    buckets.get(season)!.push(secretSongView(m, season, src.achievements));
  };
  for (const m of src.always) put(m, ALWAYS_GROUP);
  for (const [season, list] of Object.entries(src.bySeason)) for (const m of list) put(m, season);

  const order: string[] = [ALWAYS_GROUP, ...src.windows.map((w) => w.id)];
  for (const id of buckets.keys()) if (!order.includes(id)) order.push(id);

  const out: SecretSongGroup[] = [];
  for (const id of order) {
    const songs = buckets.get(id);
    if (!songs?.length) continue;
    if (id === ALWAYS_GROUP) {
      out.push({ id, title: 'Always', window: null, status: 'live', notePrefix: null, songs });
      continue;
    }
    const w = src.windows.find((x) => x.id === id) ?? null;
    out.push({
      id,
      title: src.label(id),
      window: w ? `${md(w.start[0], w.start[1])} – ${md(w.end[0], w.end[1])}` : null,
      status: w?.ready ? 'live' : 'preview',
      notePrefix: src.notePrefix[id] ?? null,
      songs,
    });
  }
  return out;
}

/** The live data: core's catalog, the registry's titles. */
export function secretSongGroups(label: (id: string) => string): SecretSongGroup[] {
  return groupSecretSongs({
    always: MUSICAL_MELODIES,
    bySeason: SEASON_MELODIES,
    windows: SEASON_WINDOWS,
    notePrefix: SEASON_NOTE_PREFIX,
    label,
  });
}

/** How players find the eggs (the trigger), one line for every group. */
export const SECRET_SONG_TRIGGER =
  'Long-press any cast figure in the header (550 ms) → the ten turn musical, W → S is a C major scale (C4 … E5). Tap the tune; the cast sings it back and the secret badge unlocks. Long-press again to stop.';
