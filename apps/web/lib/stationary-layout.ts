// FINISH_SPEC Z: the Daily ⇄ Unlimited switch must not move anything.
//
// Web has the switch on Home only (the game screens have no in-game switch), so
// the "boards" that must stay put are the Home banner's two rows of game tiles
// and the game-card grids under it. Everything above them lives in fixed-size
// SLOTS that exist in both modes; a mode with nothing for a slot keeps it empty.
// These pure helpers describe the slots (the components size themselves from
// them) separately from the CONTENT that fills them — the slots take the play
// mode as an input and must come out identical for both (stationary-layout.test.ts).

export type PlayMode = 'daily' | 'unlimited';
export type FrameTier = 'none' | 'sweep' | 'flawless';

// ── The DAILY | UNLIMITED switch ───────────────────────────────────────────

/**
 * Fixed segment widths (no text-width reflow; both labels keep the same font
 * weight) — only the sliding thumb moves. `proPill` is the extra room the
 * locked (free player) UNLIMITED segment needs for its gold PRO pill.
 */
export const MODE_SWITCH = { height: 26, pad: 2, daily: 62, unlimited: 94, proPill: 30 } as const;

export interface SwitchSegment { x: number; width: number }
export interface SwitchLayout {
  daily: SwitchSegment;
  unlimited: SwitchSegment;
  /** The sliding thumb: the selected segment's box. */
  thumb: SwitchSegment;
  /** Outer box, padding included. */
  width: number;
  height: number;
}

export function modeSwitchLayout(mode: PlayMode, { locked = false }: { locked?: boolean } = {}): SwitchLayout {
  const daily = { x: 0, width: MODE_SWITCH.daily };
  const unlimited = { x: MODE_SWITCH.daily, width: MODE_SWITCH.unlimited + (locked ? MODE_SWITCH.proPill : 0) };
  return {
    daily,
    unlimited,
    thumb: mode === 'unlimited' ? unlimited : daily,
    width: daily.width + unlimited.width + MODE_SWITCH.pad * 2,
    height: MODE_SWITCH.height + MODE_SWITCH.pad * 2,
  };
}

// ── The Home banner ────────────────────────────────────────────────────────

/** Slot sizes (px). */
export const BANNER_SLOT = {
  /** Room above the card for the host / the art's overhang. */
  headroom: 16,
  /** The swept / flawless top bar (kept in Unlimited on that day, recolored). */
  topBar: 10,
  /** The card border on an art-frame day (softBorder's 1.5 px). */
  border: 1.5,
  /** The strip's top padding: art frame / host frame. */
  stripTopArt: 8,
  stripTopHost: 12,
  stripBottom: 8,
  /** Gap between the headline row and the controls block. */
  stripGap: 6,
  /** The headline box: always two 22 px × 1.15 lines (one-line headlines center in it). */
  headline: 51,
  /** The share button's box, reserved even when there is nothing to share. */
  share: 36,
  /** The celebration art beside the headline (and Unlimited's U loop in the same box). */
  art: 100,
  /**
   * FINISH_SPEC BI21: the controls block under the headline — the centered DAILY |
   * UNLIMITED switch (30), a 6 px gap, then the centered one-line meta line (14).
   */
  controls: 50,
  switchRow: 30,
  metaLine: 14,
  /** A row's label · status · streak line. */
  rowHeader: 16,
  rowGap: 6,
  wordPadTop: 8,
  wordPadBottom: 3,
  puzzlePadTop: 5,
  puzzlePadBottom: 12,
  /** BI21: one tile size for both rows (at most 32, sized so 10 fit with 5 px gaps). */
  tileLg: 32,
  tileSm: 32,
  tileGapMin: 5,
  tileSlots: 10,
} as const;

export interface BannerInput {
  /** Today's DAILY tier of the Wordocious row — the frame never follows the mode. */
  dailyTier: FrameTier;
  /** Today's DAILY tier of the Puzzles row. */
  puzzleTier: FrameTier;
  /** Any daily finished today (there is something to share). */
  playedAny: boolean;
}

export interface BannerSlots {
  /** 'art': the swept / flawless frame (top bar + art box); 'host': W stands at the strip's end. */
  frame: 'host' | 'art';
  headroom: number;
  topBar: number;
  border: number;
  stripTop: number;
  headline: number;
  shareWidth: number;
  artHeight: number;
  headerRow: number;
  controls: number;
  rowHeader: number;
  /** Top of the Wordocious tiles, from the banner's top. */
  wordTilesTop: number;
  /** Top of the Puzzles tiles, from the banner's top. */
  puzzleTilesTop: number;
  /** The banner's whole height. */
  height: number;
}

export interface BannerContent {
  /** What the art box shows: today's celebration art, or U's loop in Unlimited. */
  art: 'tier' | 'loop' | null;
  /** The top bar's color set. */
  topBar: 'sweep' | 'flawless' | 'unlimited' | null;
  showShare: boolean;
  showStreaks: boolean;
  showTrophy: boolean;
  /** The tier the tiles / background glow with (none in Unlimited). */
  wordTier: FrameTier;
  puzzleTier: FrameTier;
}

/** The banner's slots. `mode` is an input on purpose: the result must not depend on it. */
export function homeBannerSlots(mode: PlayMode, input: BannerInput): BannerSlots {
  void mode;
  const S = BANNER_SLOT;
  const frame: BannerSlots['frame'] = input.dailyTier === 'none' ? 'host' : 'art';
  const art = frame === 'art';
  const topBar = art ? S.topBar : 0;
  const border = art ? S.border : 0;
  const stripTop = art ? S.stripTopArt : S.stripTopHost;
  const artHeight = art ? S.art : 0;
  const headerRow = Math.max(S.headline, S.share, artHeight);
  const stripHeight = stripTop + headerRow + S.stripGap + S.controls + S.stripBottom;
  const wordTilesTop = S.headroom + border + topBar + stripHeight + S.wordPadTop + S.rowHeader + S.rowGap;
  const wordSection = S.wordPadTop + S.rowHeader + S.rowGap + S.tileLg + S.wordPadBottom;
  const puzzleTilesTop = S.headroom + border + topBar + stripHeight + wordSection + S.puzzlePadTop + S.rowHeader + S.rowGap;
  const height = puzzleTilesTop + S.tileSm + S.puzzlePadBottom + border;
  return {
    frame, headroom: S.headroom, topBar, border, stripTop, headline: S.headline, shareWidth: S.share,
    artHeight, headerRow, controls: S.controls, rowHeader: S.rowHeader, wordTilesTop, puzzleTilesTop, height,
  };
}

/** What fills the slots — this part follows the mode. */
export function homeBannerContent(mode: PlayMode, input: BannerInput): BannerContent {
  const unlimited = mode === 'unlimited';
  const art = input.dailyTier !== 'none';
  return {
    art: art ? (unlimited ? 'loop' : 'tier') : null,
    topBar: art ? (unlimited ? 'unlimited' : (input.dailyTier as 'sweep' | 'flawless')) : null,
    showShare: !unlimited && input.playedAny,
    showStreaks: !unlimited,
    showTrophy: !unlimited && input.dailyTier === 'flawless' && input.puzzleTier === 'flawless',
    wordTier: unlimited ? 'none' : input.dailyTier,
    puzzleTier: unlimited ? 'none' : input.puzzleTier,
  };
}

// ── The Home game cards ────────────────────────────────────────────────────

/** Card measures shared with components/home/mode-card.tsx MODE_CARD. */
export const CARD_SLOT = { titleLine: 20, titleSlot: 26, descLine: 16, descLines: 2, icon: 52 } as const;

export interface CardSlots {
  /** The title line's right-end slot (badge / lock), reserved even when empty. */
  titleSlotWidth: number;
  /** The subtitle box: always two lines tall (a one-line result sits on its bottom line). */
  descHeight: number;
  /** The text column's height for a one-line title. */
  textHeight: number;
}

/** The card's slots; `mode` is an input on purpose: the result must not depend on it. */
export function modeCardSlots(mode: PlayMode): CardSlots {
  void mode;
  const descHeight = CARD_SLOT.descLine * CARD_SLOT.descLines;
  return {
    titleSlotWidth: CARD_SLOT.titleSlot,
    descHeight,
    textHeight: Math.max(CARD_SLOT.icon, CARD_SLOT.titleLine + descHeight),
  };
}
