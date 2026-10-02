import { CORE_MODES, MORE_GAME_MODES, type ModeMeta } from './modes.generated';

// The one game picker (docs/FINISH_SPEC.md C2, C2b, C3): the Leaderboard and
// the Stats page share the same window — a header row, the WORDOCIOUS row (the
// eight core dailies in Home order, then the Sweep broom as the 9th tile, no
// separate SWEEP pill) and the PUZZLES row (every daily More Games title in
// catalog order). Every game is visible at once (no scrolling rail); icon
// tiles are mini game cards tinted in the game's accent. Pure data here; the
// look is components/ui/game-picker.tsx.

/** The Sweep board's picker key (the synthetic cross-mode board). */
export const SWEEP_KEY = 'SWEEP';
/** The Sweep tile's accent (profile mode-picker SWEEP_MODE). */
export const SWEEP_ACCENT = '#4f46e5';

export interface PickerTile {
  /** What `onSelect` receives: a daily mode's db key, or SWEEP_KEY. */
  key: string;
  /** Game art id (public/art/game-<id>.webp): the mode id, or 'sweep'. */
  artId: string;
  /** Accessible name. */
  title: string;
  accent: string;
}

export interface PickerRows {
  wordocious: PickerTile[];
  puzzles: PickerTile[];
}

const tile = (m: ModeMeta): PickerTile => ({ key: m.dbKey as string, artId: m.id, title: m.title, accent: m.accentHex });

/**
 * The picker's two rows. `flagOn` filters remote-gated games (useFlags().isOn,
 * the same filter Home uses); `sweep` adds the Sweep tile after the last
 * WORDOCIOUS game (C2b).
 */
export function pickerRows(flagOn: (key: string | null) => boolean, { sweep = true }: { sweep?: boolean } = {}): PickerRows {
  const wordocious = CORE_MODES.filter((m) => !m.homeWide && m.dbKey && m.dailyEligible && flagOn(m.flagKey)).map(tile);
  if (sweep) wordocious.push({ key: SWEEP_KEY, artId: 'sweep', title: 'Daily Sweep', accent: SWEEP_ACCENT });
  const puzzles = MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey && flagOn(m.flagKey)).map(tile);
  return { wordocious, puzzles };
}

/** The tile for a key in the rows, or null. */
export function pickerTileFor(rows: PickerRows, key: string): PickerTile | null {
  return rows.wordocious.find((t) => t.key === key) ?? rows.puzzles.find((t) => t.key === key) ?? null;
}
