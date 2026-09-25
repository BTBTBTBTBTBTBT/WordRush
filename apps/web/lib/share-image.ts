'use client';

import { evaluateGuess, GameStatus, type BoardState } from '@wordle-duel/core';
import { getTodayLocal } from './daily-service';
import { TILE_HEX, WIN_FG, WIN_BG, BOARD_WIN_TINT } from './tile-theme';
import { MODES } from './modes.generated';


// next/font registers Nunito under a HASHED family applied to <body>; the
// literal "Nunito" never exists in document.fonts, so canvas silently drew
// every share card in the system fallback (founder caught the sharper
// letterforms on the leaderboard card, Aug 7). Resolve the real stack from
// the body's computed style at render time.
let SHARE_FONT_STACK = '"Nunito", system-ui, -apple-system, sans-serif';
function resolveShareFontStack(): void {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    const fam = getComputedStyle(document.body).fontFamily;
    if (fam && fam.length > 0) SHARE_FONT_STACK = fam;
  } catch { /* keep fallback */ }
}

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/**
 * Uppercase tile-state string. Classic/Quordle/etc. produce these directly
 * from the core reducer; ProperNoundle uses lowercase internally and
 * normalizes to this set at the share-image boundary.
 */
export type TileStateString = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';

export type ShareMode =
  | 'Classic'
  | 'QuadWord'
  | 'OctoWord'
  | 'Succession'
  | 'Deliverance'
  | 'Gauntlet'
  | 'ProperNoundle'
  | 'Six'
  | 'Seven'
  /** More Games (§18d): one board drawing per title inside the same card frame. */
  | 'Sudocious'
  | 'Starsweep'
  | 'Letter Ladder'
  | 'Spyglass'
  | 'Hubbub'
  | 'Codebreaker'
  | 'Kindred'
  | 'Crosswordocious'
  | 'Muddle'
  /** SWEEP SHARE (§231): the Daily Sweep board's leaderboard card — not a
   *  playable mode, so it has no catalog accent (MODE_ACCENT is empty for it;
   *  the leaderboard card falls back to its variant theme). */
  | 'DailySweep'
  /** WEEKLY RACE SHARE (§234): the friends weekly-race card — like DailySweep,
   *  not a playable mode (no catalog accent; the chip falls back to the
   *  weeklyRace variant theme). */
  | 'WeeklyRace'
  /** FLAWLESS STREAK (§244): consecutive days with every daily won — not a mode. */
  | 'FlawlessStreak'
  /** TROPHY CASE (§245): the all-time records a player holds — not a mode. */
  | 'TrophyCase';

interface ShareBase {
  mode: ShareMode;
  won: boolean;
  timeSeconds: number;
  guesses: number;
  maxGuesses: number;
  /** Defaults to today's local date. */
  date?: Date;
  /**
   * "Full results" variant: draw the guessed letters inside the tiles (and
   * the answer under lost boards) instead of the spoiler-free color-only
   * treatment. Off by default — the default output stays byte-identical.
   */
  reveal?: boolean;
  /**
   * Composite score of the result, for the hosted share page's unfurl copy
   * (mistake-scored modes list "Score · Time · Mistakes" by name, §18d).
   */
  points?: number;
}

export interface ShareSingleInput extends ShareBase {
  layout: 'single';
  /** Rows of evaluated tiles, one row per guess. Empty rows are padded automatically. */
  grid: TileStateString[][];
  /** Per-row letters matching `grid` ('' for empty tiles). Required for `reveal`. */
  letters?: string[][];
  /** Answer in display form (ProperNoundle keeps its space) — drawn under a lost board when revealing. */
  solutionDisplay?: string;
  /** Optional category pill (ProperNoundle only). */
  category?: string;
  /**
   * Letters-per-word for the puzzle answer. Only meaningful when the
   * answer contains a space (e.g. "Kylian Mbappe" → [6, 6]) — used
   * exclusively by ProperNoundle to insert a visible gap between first
   * and last name in the share image, matching the in-game board. If
   * absent or length ≤ 1 the tiles render as a single uniformly-spaced
   * row, which is the right default for every other mode.
   */
  wordGroups?: number[];
}

/**
 * Sudoku (More Games §18d): the 9 × 9 ruled board with given cells as dark
 * squares and the player's cells as purple squares — no digits, so the card
 * spoils nothing and invites a try. Stat line reads "0 mistakes · 3:58".
 */
export interface ShareSudokuInput extends ShareBase {
  layout: 'sudoku';
  /** 81 chars, '0' = empty. */
  givens: string;
  board: string;
  hintMask: string;
  mistakes: number;
  difficulty: string;
  puzzleNumber?: number;
}

/**
 * Starsweep (More Games §18d): the colored regions with the placed stars as
 * dots — no crosses, no missing stars — so the card spoils nothing.
 * Stat line reads "#12 · 8 × 8 · 0 mistakes · 2:10".
 */
export interface ShareRegionsInput extends ShareBase {
  layout: 'regions';
  n: number;
  /** n*n chars, region index per cell. */
  regions: string;
  /** n*n chars: '.' empty, 'x' crossed, '*' star. */
  board: string;
  hintMask: string;
  mistakes: number;
  sizeLabel: string;
  puzzleNumber?: number;
}

/**
 * Letter Ladder (More Games §18d): START and END spelled out, the rungs
 * between them as blank tiles with only the changed position filled (accent;
 * violet for a hint rung) — so the card shows the shape of the climb without
 * a single rung word. Stat line reads "#12 · Par 5 · +1 · 2:10".
 */
export interface ShareLadderInput extends ShareBase {
  layout: 'ladder';
  start: string;
  end: string;
  /** The ladder as played, words[0] = start. */
  words: string[];
  hintMask: string;
  par: number;
  moves: number;
  puzzleNumber?: number;
}

/**
 * Spyglass (More Games §18d): the 10 × 10 as a dot grid with the found words
 * as accent capsules — no letters, so the card spoils nothing.
 * Stat line reads "#12 · 10/10 · 0 misses · 2:45".
 */
export interface ShareWordsearchInput extends ShareBase {
  layout: 'wordsearch';
  n: number;
  words: Array<{ w: string; r: number; c: number; d: string }>;
  found: string[];
  misses: number;
  title: string;
  puzzleNumber?: number;
}

/**
 * Hubbub (More Games §18d): the blank 2-3-2 tile silhouette with the center
 * filled, the rank name, % of max, words and pangrams — no letters.
 * Stat line reads "#12 · Uproar · 72% · 18 words · 1 pangram".
 */
export interface ShareHubInput extends ShareBase {
  layout: 'hub';
  rankName: string;
  pct: number;
  wordsFound: number;
  wordCount: number;
  pangramsFound: number;
  puzzleNumber?: number;
}

/**
 * Codebreaker (More Games §18d): the CIPHERTEXT only — blank cells with the code
 * letter under each, words kept whole — so the card spoils nothing and invites
 * a try. Stat line reads "#12 · No checks · 2:05".
 */
export interface ShareCryptogramInput extends ShareBase {
  layout: 'cryptogram';
  cipher: string;
  checks: number;
  puzzleNumber?: number;
}

/**
 * Kindred (More Games §18d): four tier bars in the order solved (one to four
 * pips each) plus four mistake dots — never a row-per-guess color grid, and
 * no words. Stat line reads "#12 · 4/4 groups · 1 mistake · 2:10".
 */
export interface ShareGroupsInput extends ShareBase {
  layout: 'groups';
  /** Tiers in the order solved (1–4); unsolved tiers are drawn dashed after them on a loss. */
  solvedTiers: number[];
  mistakes: number;
  maxMistakes: number;
  puzzleNumber?: number;
}

/**
 * Crosswordocious (More Games §18d): the grid silhouette in purple with no
 * letters or numbers. Stat line reads "#12 · Clean · 3:20".
 */
export interface ShareCrosswordInput extends ShareBase {
  layout: 'crossword';
  w: number;
  h: number;
  /** w*h characters, "." for a block. */
  solution: string;
  checks: number;
  puzzleNumber?: number;
}

/**
 * Muddle (More Games §18d): four rows of blank tiles with the circled positions
 * ringed, then the punchline row blank with word gaps. The cartoon is NOT on
 * the card (it would spoil the joke). Stat line reads "#12 · 5 checks · 1:52".
 */
export interface ShareScrambleInput extends ShareBase {
  layout: 'scramble';
  words: { length: number; circled: number[] }[];
  pattern: number[];
  checks: number;
  solvedCount: number;
  puzzleNumber?: number;
}

export interface ShareMultiBoard {
  grid: TileStateString[][];
  /** Per-row letters matching `grid` ('' for empty tiles). Required for `reveal`. */
  letters?: string[][];
  /** Whether this specific board was solved — drives its green/red border + tint. */
  won: boolean;
  /** The board's answer — drawn under the board when revealing a loss. */
  solution?: string;
}

export interface ShareMultiInput extends ShareBase {
  layout: 'multi';
  /** Per-board tile grids plus each board's win/loss — mirrors the in-app
   *  finished-screen treatment where each board has its own colored border. */
  boards: ShareMultiBoard[];
  boardsSolved: number;
  totalBoards: number;
}

export interface ShareGauntletInput extends ShareBase {
  layout: 'gauntlet';
  stages: Array<{
    name: string;
    status: GameStatus;
    guesses: number;
    boardsSolved: number;
    totalBoards: number;
  }>;
  stagesCompleted: number;
  totalStages: number;
}

/** One daily game's row in the all-dailies share card. */
export interface ShareDailyGame {
  /** Drives the row's accent color + glyph badge. */
  mode: ShareMode;
  /** Display name (e.g. "Classic Six"). */
  modeLabel: string;
  won: boolean;
  guesses: number;
  timeSeconds: number;
  score: number;
}

export interface ShareDailySweepInput {
  layout: 'daily-sweep';
  /** Always 'Classic' — present only to satisfy callers that read `.mode`;
   *  the daily-sweep card renders its own multi-mode header. */
  mode: ShareMode;
  /** All games won → Flawless Victory (gold); else Daily Sweep (violet). */
  flawless: boolean;
  games: ShareDailyGame[];
  total: number;
  won: number;
  totalGuesses: number;
  totalTimeSeconds: number;
  totalScore: number;
  date?: Date;
}

/** Shareable profile / stats card (1080×1080). */
export interface ShareProfileInput {
  layout: 'profile';
  /** 'Classic' — present only to satisfy callers that read `.mode`. */
  mode: ShareMode;
  username: string;
  level: number;
  tier: string;
  accentHex: string;
  totalWins: number;
  winRate: number;
  currentStreak: number;
  dailyStreak: number;
  gold: number;
  silver: number;
  bronze: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  date?: Date;
}

/** One row of the daily-leaderboard share card. All strings are preformatted
 *  by the pure builder (lib/leaderboard-share.ts) so the renderer stays a dumb
 *  layout pass and the formatting logic stays unit-testable. */
export interface ShareLeaderboardRowInput {
  /** §249: the nine-dot mode strip, SWEEP_DOT_MODES order. null = unplayed
   *  (hollow), -1 = loss (red), else 0..1 = win intensity (pre-remapped t —
   *  the renderer draws violet at alpha 0.18 + 0.82t, in-app rules verbatim). */
  dots?: Array<number | null>;
  rank: number;
  name: string;
  scoreDisplay: string;
  /** Full-stats subline ("4 guesses · 3:44 · Win" / "3-1 today"). Omitted on
   *  the compressed top-5 rows of the sharer-below-top-5 layout. */
  subline?: string;
  /** Sharer's own row — gets the gold "you" highlight + "· YOU" label. */
  isYou?: boolean;
}

/** Daily-leaderboard share card (1080×1080): solo board, VS board, or
 *  yesterday's settled podium. Spoiler-free by construction — no words or
 *  boards, only names/scores/stats. */
export interface ShareLeaderboardInput {
  layout: 'leaderboard';
  /** The board's game mode — drives the mode chip accent + share URL naming. */
  mode: ShareMode;
  /** FRIENDS (§207): 'friends' = today's friends-only board, 'friendsPodium'
   *  = yesterday's settled podium among friends — same geometry, indigo
   *  identity, dense friend ranks in rows/you/shareRank. */
  /** SWEEP SHARE (§231): 'sweep' = today's Daily Sweep board, 'sweepPodium'
   *  = yesterday's settled Sweep podium — the founder wants the Sweep board
   *  shareable exactly like every other board. Rows carry the RPC's
   *  tie-aware sweep rank; `mode` is 'DailySweep'. */
  /** WEEKLY RACE SHARE (§234): 'weeklyRace' = the friends weekly race — a
   *  timestamped brag card of this week's standings (me + friends by
   *  weekPoints) with how much time is left; `mode` is 'WeeklyRace'. */
  variant: 'solo' | 'vs' | 'podium' | 'friends' | 'friendsPodium' | 'sweep' | 'sweepPodium' | 'weeklyRace' | 'flawlessStreak' | 'trophyCase';
  /** Mode chip text ("Classic Six", "Classic VS"). */
  modeChip: string;
  /** Date chip text ("Aug 7, 2026 · #123" / "Aug 6, 2026 · Final"). */
  dateChip: string;
  /** Top rows (≤5; podium ≤3), ordered by rank. */
  rows: ShareLeaderboardRowInput[];
  /** Sharer's row when ranked below the top rows (drawn after a "• • •" divider). */
  you?: ShareLeaderboardRowInput;
  /** "#12 of 87" under the out-of-top you-row. */
  youRankLine?: string;
  /** Rank-vs-yesterday pill on the sharer's row; absent = didn't play yesterday. */
  delta?: { text: string; improved: boolean };
  /** Footer hook line ("Can you beat them? Play free at wordocious.com"). */
  footer: string;
  /** Board day — drives the storage-key date. Defaults to today. */
  date?: Date;
  /** Sharer's rank/total, carried into the /s/ unfurl copy. */
  shareRank?: number;
  sharePlayers?: number;
}

export type ShareImageInput =
  | ShareSingleInput
  | ShareSudokuInput
  | ShareRegionsInput
  | ShareLadderInput
  | ShareWordsearchInput
  | ShareHubInput
  | ShareCryptogramInput
  | ShareGroupsInput
  | ShareCrosswordInput
  | ShareScrambleInput
  | ShareMultiInput
  | ShareGauntletInput
  | ShareDailySweepInput
  | ShareProfileInput
  | ShareLeaderboardInput;

/**
 * Short per-mode glyph drawn inside the accent badge on the all-dailies share
 * card — derived from the single-source mode catalog (modes.json → modes.generated).
 * Keyed by ShareMode (== catalog title); kept identical on iOS + Android.
 */
export const MODE_SHARE_GLYPH: Record<ShareMode, string> = Object.fromEntries(
  MODES.filter((m) => m.dbKey && m.glyph).map((m) => [m.title, m.glyph as string]),
) as Record<ShareMode, string>;

// ──────────────────────────────────────────────────────────────────────────
// Palette (matches the in-app tile + chip colors)
// ──────────────────────────────────────────────────────────────────────────

const BG = '#f8f7ff';
const TILE_COLORS: Record<TileStateString, string> = {
  CORRECT: TILE_HEX.correct,
  PRESENT: TILE_HEX.present,
  ABSENT: '#9ca3af',
  EMPTY: '#e5e7eb',
};
const TILE_BORDER_EMPTY = '#d1d5db';

// Per-mode accent, derived from the single-source mode catalog (keyed by title == ShareMode).
const MODE_ACCENT: Record<ShareMode, string> = Object.fromEntries(
  MODES.filter((m) => m.dbKey).map((m) => [m.title, m.accentHex]),
) as Record<ShareMode, string>;

const WORDMARK_GRADIENT: [string, string] = ['#a78bfa', '#ec4899'];
const FOOT_COLOR = '#9ca3af';
const TEXT_DARK = '#1a1a2e';
const TEXT_MUTED = '#6b7280';

// Win/Loss pill (same as profile + leaderboard pills we shipped earlier).
// WIN_BG / WIN_FG / BOARD_WIN_TINT come from tile-theme (Royal violet).
const LOSS_BG = '#fee2e2';
const LOSS_FG = '#dc2626';

// Softer tint used behind a board's tile grid so the colored border has a
// subtle fill to match the in-app finished screen.
const BOARD_LOSS_TINT = '#fef2f2'; // red-50

// ──────────────────────────────────────────────────────────────────────────
// Helpers — BoardState → normalized grid
// ──────────────────────────────────────────────────────────────────────────

/**
 * Evaluate every row of a BoardState into tile-state grids. Prefilled
 * guesses (Deliverance) appear first, followed by the player's guesses.
 * Empty rows are padded with EMPTY so every board in a multi-board share
 * has the same total row count the player saw in-app — specifically
 * `prefilledGuesses.length + maxGuesses`, since `maxGuesses` is the player
 * guess budget *excluding* prefills (see reducer.ts where the LOST check
 * uses `newGuesses.length >= board.maxGuesses`). Without including the
 * prefill count in the pad target, Deliverance boards would render at
 * different heights depending on how far each player got, and downstream
 * drawBoardCard would size tiles differently per board — the "funky sizes"
 * bug the share image had.
 */
export function boardToGrid(board: BoardState): TileStateString[][] {
  const width = board.solution.length;
  const rows: TileStateString[][] = [];
  const prefillCount = board.prefilledGuesses?.length ?? 0;

  if (board.prefilledGuesses?.length) {
    for (const p of board.prefilledGuesses) {
      rows.push(p.evaluation.tiles.map(t => t.state as TileStateString));
    }
  }
  for (const guess of board.guesses) {
    const ev = evaluateGuess(board.solution, guess);
    rows.push(ev.tiles.map(t => t.state as TileStateString));
  }
  const totalRows = prefillCount + board.maxGuesses;
  while (rows.length < totalRows) {
    rows.push(Array(width).fill('EMPTY'));
  }
  return rows;
}

/**
 * Letter grid matching boardToGrid row-for-row — same prefill-first order and
 * the same pad target, with '' for empty tiles so drawTile draws no glyph.
 * Only consumed by the "Full results" (reveal) share variant.
 */
export function boardToLetters(board: BoardState): string[][] {
  const width = board.solution.length;
  const rows: string[][] = [];
  const prefillCount = board.prefilledGuesses?.length ?? 0;

  if (board.prefilledGuesses?.length) {
    for (const p of board.prefilledGuesses) {
      rows.push(p.evaluation.tiles.map(t => (t.letter ?? '').toUpperCase()));
    }
  }
  for (const guess of board.guesses) {
    rows.push(guess.toUpperCase().split(''));
  }
  const totalRows = prefillCount + board.maxGuesses;
  while (rows.length < totalRows) {
    rows.push(Array(width).fill(''));
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Drawing primitives
// ──────────────────────────────────────────────────────────────────────────

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  state: TileStateString,
  letter?: string,
): void {
  drawRoundRect(ctx, x, y, size, size, Math.max(4, size * 0.12));
  ctx.fillStyle = TILE_COLORS[state];
  ctx.fill();
  if (state === 'EMPTY') {
    ctx.strokeStyle = TILE_BORDER_EMPTY;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.stroke();
  }
  // "Full results" variant: glyph centered in the tile. EMPTY tiles never
  // carry a letter (boardToLetters pads with ''), so this only fires on
  // evaluated rows.
  if (letter && state !== 'EMPTY') {
    ctx.save();
    ctx.font = `900 ${Math.max(10, Math.floor(size * 0.55))}px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), x + size / 2, y + size / 2 + 1);
    ctx.restore();
  }
}

/**
 * Paint a board: optional colored "card" (tinted background + thick border)
 * matching the in-app finished-screen treatment, then the tile grid inside.
 * When `won` is null the card is omitted — used for single-board layouts that
 * rely on the header Win/Loss pill instead.
 */
/** Height reserved under a board for the revealed-loss answer caption. */
const ANSWER_CAPTION_H = 44;

function drawBoardCard(
  ctx: CanvasRenderingContext2D,
  grid: TileStateString[][],
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number,
  won: boolean | null,
  wordGroups?: number[],
  reveal?: {
    /** Per-row letters matching `grid`; '' entries draw no glyph. */
    letters?: string[][];
    /** Answer text drawn under the board (lost boards only). */
    answerCaption?: string;
    /** Reserve the caption strip even without a caption — keeps every board
     *  in a multi grid the same height whether it was won or lost. */
    reserveCaption?: boolean;
  },
): void {
  if (!grid.length) return;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!cols) return;

  const cardPad = won === null ? 0 : 12;
  const borderWidth = won === null ? 0 : 3;

  const gap = 4;
  const groups = wordGroups && wordGroups.length > 1 ? wordGroups : null;

  // "Full results": shift the board up by half the caption strip and draw the
  // answer underneath, so grid+caption stay centered where the grid alone was.
  const captionH = reveal && (reveal.answerCaption || reveal.reserveCaption) ? ANSWER_CAPTION_H : 0;
  const boardCenterY = centerY - captionH / 2;

  const innerMaxW = maxWidth - cardPad * 2 - borderWidth * 2;
  const innerMaxH = maxHeight - captionH - cardPad * 2 - borderWidth * 2;

  // ProperNoundle multi-word answers need a *visible* break between
  // first and last name. Prior iterations scaled the gap at 3×, then
  // 0.55×-tile, and the user still saw the two names lumped together
  // ("Why are we having so much trouble with this?"). Escalate to a
  // full tile-width of empty space between words — this is roughly
  // what you'd expect from visual parity with the in-game board at
  // 1080px output, and leaves no ambiguity that the break is a word
  // boundary rather than a tile-grid artifact. Two-pass: compute tile
  // size assuming uniform spacing first, derive group gap from that,
  // then recompute tile size with the group gaps baked in so the row
  // fits horizontally.
  const tile1FromW = (innerMaxW - gap * (cols - 1)) / cols;
  const tile1FromH = (innerMaxH - gap * (rows - 1)) / rows;
  const tile1 = Math.floor(Math.min(tile1FromW, tile1FromH));
  const groupGap = groups ? Math.max(gap * 4, tile1) : gap;
  const extraGroupWidth = groups ? (groups.length - 1) * (groupGap - gap) : 0;

  const tileFromWidth = (innerMaxW - gap * (cols - 1) - extraGroupWidth) / cols;
  const tileFromHeight = (innerMaxH - gap * (rows - 1)) / rows;
  const tile = Math.floor(Math.min(tileFromWidth, tileFromHeight));
  const totalW = cols * tile + gap * (cols - 1) + extraGroupWidth;
  const totalH = rows * tile + gap * (rows - 1);

  if (won !== null) {
    // Colored card behind the tile grid — matches in-app finished board look.
    const cardW = totalW + cardPad * 2;
    const cardH = totalH + cardPad * 2;
    const cardX = centerX - cardW / 2;
    const cardY = boardCenterY - cardH / 2;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = won ? BOARD_WIN_TINT : BOARD_LOSS_TINT;
    ctx.fill();
    ctx.strokeStyle = won ? WIN_FG : LOSS_FG;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  // Precompute per-column x offsets once. For grouped layouts, crossing
  // a group boundary bumps the offset by `groupGap` instead of `gap`.
  const xOffsets: number[] = new Array(cols);
  if (groups) {
    let colCursor = 0;
    let x = 0;
    for (let g = 0; g < groups.length; g++) {
      const size = groups[g];
      for (let i = 0; i < size && colCursor < cols; i++) {
        xOffsets[colCursor] = x;
        x += tile + gap;
        colCursor++;
      }
      // Replace the last intra-group `gap` with the larger `groupGap`
      // before starting the next group, unless this was the final group.
      if (g < groups.length - 1) x += (groupGap - gap);
    }
    // Safety: if group sizes don't add up to cols (shouldn't happen),
    // fill any remaining columns with uniform spacing so we don't crash.
    for (; colCursor < cols; colCursor++) {
      xOffsets[colCursor] = colCursor === 0 ? 0 : xOffsets[colCursor - 1] + tile + gap;
    }
  } else {
    for (let c = 0; c < cols; c++) xOffsets[c] = c * (tile + gap);
  }

  const x0 = centerX - totalW / 2;
  const y0 = boardCenterY - totalH / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(ctx, x0 + xOffsets[c], y0 + r * (tile + gap), tile, grid[r][c], reveal?.letters?.[r]?.[c]);
    }
  }

  // Revealed loss: the answer never appears in the tiles, so spell it out
  // under the board — same treatment as the completed-puzzle page.
  if (reveal?.answerCaption) {
    const captionY = boardCenterY + totalH / 2 + cardPad + borderWidth + ANSWER_CAPTION_H / 2 + 2;
    ctx.save();
    ctx.font = `900 ${Math.min(30, Math.max(16, Math.floor(tile * 0.6)))}px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = LOSS_FG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(reveal.answerCaption.toUpperCase(), centerX, captionY);
    ctx.restore();
  }
}

function drawWinLossPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  won: boolean,
): { width: number; height: number } {
  const label = won ? 'Win' : 'Loss';
  const bg = won ? WIN_BG : LOSS_BG;
  const fg = won ? WIN_FG : LOSS_FG;
  ctx.font = `700 22px ${SHARE_FONT_STACK}`;
  const labelW = ctx.measureText(label).width;
  const padX = 16;
  const padY = 8;
  const width = labelW + padX * 2;
  const height = 22 + padY * 2;
  drawRoundRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  return { width, height };
}

function drawCategoryPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
): { width: number; height: number } {
  ctx.font = `700 18px ${SHARE_FONT_STACK}`;
  const w = ctx.measureText(label).width + 24;
  const h = 30;
  drawRoundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  return { width: w, height: h };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ──────────────────────────────────────────────────────────────────────────
// Header / footer
// ──────────────────────────────────────────────────────────────────────────

function drawHeader(
  ctx: CanvasRenderingContext2D,
  input: ShareSingleInput | ShareMultiInput | ShareGauntletInput | ShareSudokuInput | ShareRegionsInput | ShareLadderInput | ShareWordsearchInput | ShareHubInput | ShareCryptogramInput | ShareGroupsInput | ShareCrosswordInput | ShareScrambleInput,
  width: number,
): { bottomY: number } {
  // Wordmark
  ctx.save();
  const wordmarkY = 72;
  ctx.font = `900 56px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const gradient = ctx.createLinearGradient(width / 2 - 200, wordmarkY - 48, width / 2 + 200, wordmarkY + 8);
  gradient.addColorStop(0, WORDMARK_GRADIENT[0]);
  gradient.addColorStop(1, WORDMARK_GRADIENT[1]);
  ctx.fillStyle = gradient;
  ctx.fillText('WORDOCIOUS', width / 2, wordmarkY);
  ctx.restore();

  // Mode name in mode accent color
  const modeY = wordmarkY + 60;
  ctx.font = `900 38px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MODE_ACCENT[input.mode];
  const MODE_DISPLAY: Partial<Record<ShareMode, string>> = {
    Six: 'CLASSIC SIX',
    Seven: 'CLASSIC SEVEN',
  };
  const modeLabel = MODE_DISPLAY[input.mode] ?? input.mode.toUpperCase();
  ctx.fillText(modeLabel, width / 2, modeY);

  // Metadata line
  const metaY = modeY + 48;
  const date = input.date ?? new Date(getTodayLocal() + 'T00:00:00');
  const dateStr = formatShortDate(date);
  const timeStr = formatTime(input.timeSeconds);

  let statsText: string;
  if (input.layout === 'gauntlet') {
    statsText = `${input.stagesCompleted}/${input.totalStages} stages · ${input.guesses} guesses · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'multi') {
    const guessDisplay = input.won ? `${input.guesses}/${input.maxGuesses}` : `X/${input.maxGuesses}`;
    statsText = `${input.boardsSolved}/${input.totalBoards} boards · ${guessDisplay} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'sudoku') {
    // Semantics-aware (More Games §11): mistakes, never "guesses".
    const m = `${input.mistakes} mistake${input.mistakes === 1 ? '' : 's'}`;
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}${input.difficulty} · ${input.won ? m : 'Out of mistakes'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'regions') {
    const m = `${input.mistakes} mistake${input.mistakes === 1 ? '' : 's'}`;
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}${input.sizeLabel} · ${input.won ? m : 'Out of mistakes'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'ladder') {
    const over = input.moves - input.par;
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}Par ${input.par} · ${input.won ? (over <= 0 ? 'On par' : `+${over}`) : 'Out of moves'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'wordsearch') {
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}${input.found.length}/${input.words.length} · ${input.misses} miss${input.misses === 1 ? '' : 'es'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'hub') {
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}${input.rankName} · ${input.pct}% · ${input.wordsFound} word${input.wordsFound === 1 ? '' : 's'} · ${input.pangramsFound} pangram${input.pangramsFound === 1 ? '' : 's'} · ${dateStr}`;
  } else if (input.layout === 'cryptogram') {
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    const c = input.checks === 0 ? 'No checks' : `${input.checks} check${input.checks === 1 ? '' : 's'}`;
    statsText = `${num}${input.won ? c : 'Revealed'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'groups') {
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}${input.solvedTiers.length}/4 groups · ${input.mistakes} mistake${input.mistakes === 1 ? '' : 's'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'crossword') {
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    const c = input.checks === 0 ? 'Clean' : `${input.checks} check${input.checks === 1 ? '' : 's'}`;
    statsText = `${num}${input.won ? c : 'Revealed'} · ${timeStr} · ${dateStr}`;
  } else if (input.layout === 'scramble') {
    const num = input.puzzleNumber ? `#${input.puzzleNumber} · ` : '';
    statsText = `${num}${input.solvedCount}/5 solved · ${input.checks} check${input.checks === 1 ? '' : 's'} · ${timeStr} · ${dateStr}`;
  } else {
    const guessDisplay = input.won ? `${input.guesses}/${input.maxGuesses}` : `X/${input.maxGuesses}`;
    statsText = `${guessDisplay} · ${timeStr} · ${dateStr}`;
  }

  ctx.font = `700 24px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const statsWidth = ctx.measureText(statsText).width;

  // ProperNoundle: category pill before stats
  let categoryPillW = 0;
  let pillGap = 0;
  const pillBlockHeight = 38;
  if (input.layout === 'single' && input.category) {
    pillGap = 12;
  }

  const winPill = { width: 0, height: 38 };
  // Measure win/loss pill without drawing
  ctx.font = `700 22px ${SHARE_FONT_STACK}`;
  const pillLabel = input.won ? 'Win' : 'Loss';
  const pillLabelW = ctx.measureText(pillLabel).width;
  winPill.width = pillLabelW + 32;

  if (input.layout === 'single' && input.category) {
    ctx.font = `700 18px ${SHARE_FONT_STACK}`;
    categoryPillW = ctx.measureText(input.category).width + 24;
  }

  const pillSpacing = 12;
  const blockWidth =
    statsWidth +
    (categoryPillW > 0 ? categoryPillW + pillSpacing : 0) +
    pillSpacing +
    winPill.width;
  const blockStartX = width / 2 - blockWidth / 2;

  // stats text
  ctx.font = `700 24px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(statsText, blockStartX, metaY);

  let cursorX = blockStartX + statsWidth + pillSpacing;

  if (input.layout === 'single' && input.category) {
    const pill = drawCategoryPill(ctx, cursorX, metaY - 15, input.category, MODE_ACCENT[input.mode]);
    cursorX += pill.width + pillSpacing;
  }

  drawWinLossPill(ctx, cursorX, metaY - 19, input.won);

  return { bottomY: metaY + pillBlockHeight };
}

function drawFooter(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.font = `700 22px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = FOOT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('wordocious.com', width / 2, height - 40);
}

// ──────────────────────────────────────────────────────────────────────────
// Board-area drawing per layout
// ──────────────────────────────────────────────────────────────────────────

function drawSingle(
  ctx: CanvasRenderingContext2D,
  input: ShareSingleInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const areaHeight = footerTop - headerBottom;
  const centerX = width / 2;
  const centerY = headerBottom + areaHeight / 2;
  const maxWidth = width - 160;
  const maxHeight = areaHeight - 80;
  // Single-board modes: card matches the header Win/Loss pill so the border
  // echoes the result in the body too — same treatment as multi-board.
  // wordGroups is only populated for multi-word ProperNoundle answers; every
  // other caller leaves it undefined and the tiles render uniformly spaced.
  const reveal = input.reveal
    ? {
        letters: input.letters,
        answerCaption: !input.won ? input.solutionDisplay : undefined,
      }
    : undefined;
  drawBoardCard(ctx, input.grid, centerX, centerY, maxWidth, maxHeight, input.won, input.wordGroups, reveal);
}

// Sudoku (More Games §18d): the ruled 9 × 9 as squares — givens dark, the
// player's correct digits purple, hint cells violet, everything else light —
// inside the same win/loss-bordered card the word boards use. No digits, so
// the card spoils nothing.
function drawSudoku(
  ctx: CanvasRenderingContext2D,
  input: ShareSudokuInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const areaHeight = footerTop - headerBottom;
  const size = Math.min(width - 200, areaHeight - 80);
  const cardPad = 16, borderWidth = 3;
  const inner = size - cardPad * 2;
  const gap = 4, boxGap = 12;
  const cell = (inner - gap * 6 - boxGap * 2) / 9;
  const x0 = (width - size) / 2, y0 = headerBottom + (areaHeight - size) / 2;
  ctx.save();
  ctx.fillStyle = input.won ? WIN_BG : BOARD_LOSS_TINT;
  drawRoundRect(ctx, x0, y0, size, size, 28);
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = input.won ? WIN_FG : LOSS_FG;
  ctx.stroke();
  const PLAYER = '#7c3aed', HINTC = '#8b5cf6', EMPTY = '#e9e5f5';
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const x = x0 + cardPad + c * (cell + gap) + Math.floor(c / 3) * (boxGap - gap);
    const y = y0 + cardPad + r * (cell + gap) + Math.floor(r / 3) * (boxGap - gap);
    const given = input.givens[i] !== '0';
    const filled = input.board[i] !== '0';
    const hinted = input.hintMask[i] === '1';
    ctx.fillStyle = given ? TEXT_DARK : hinted ? HINTC : filled ? PLAYER : EMPTY;
    drawRoundRect(ctx, x, y, cell, cell, Math.max(4, cell * 0.18));
    ctx.fill();
  }
  ctx.restore();
}

// Starsweep (More Games §18d): the regions as tinted squares (the same soft
// tints the board uses), the placed stars as dark dots (hint stars violet),
// nothing else — no crosses and never the missing stars, so the card spoils
// nothing and invites a try.
const REGIONS_SHARE_TINTS = ['#ede9fe', '#d1fae5', '#e0f2fe', '#fce7f3', '#fef9c3', '#ccfbf1', '#ffedd5', '#ecfccb', '#e2e8f0'];
function drawRegions(
  ctx: CanvasRenderingContext2D,
  input: ShareRegionsInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const n = Math.max(1, input.n);
  const areaHeight = footerTop - headerBottom;
  const size = Math.min(width - 200, areaHeight - 80);
  const cardPad = 16, borderWidth = 3, gap = 4;
  const inner = size - cardPad * 2;
  const cell = (inner - gap * (n - 1)) / n;
  const x0 = (width - size) / 2, y0 = headerBottom + (areaHeight - size) / 2;
  ctx.save();
  ctx.fillStyle = input.won ? WIN_BG : BOARD_LOSS_TINT;
  drawRoundRect(ctx, x0, y0, size, size, 28);
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = input.won ? WIN_FG : LOSS_FG;
  ctx.stroke();
  const HINTC = '#8b5cf6';
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const x = x0 + cardPad + c * (cell + gap);
    const y = y0 + cardPad + r * (cell + gap);
    const g = (input.regions.charCodeAt(i) || 48) - 48;
    ctx.fillStyle = REGIONS_SHARE_TINTS[g % REGIONS_SHARE_TINTS.length];
    drawRoundRect(ctx, x, y, cell, cell, Math.max(4, cell * 0.18));
    ctx.fill();
    if (input.board[i] === '*') {
      ctx.fillStyle = input.hintMask[i] === '1' ? HINTC : TEXT_DARK;
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Letter Ladder (More Games §18d): START and END spelled out as filled tiles,
// every rung between them blank except the changed position (accent; violet
// for a hint rung). Spoils no rung word.
function drawLadder(
  ctx: CanvasRenderingContext2D,
  input: ShareLadderInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const words = input.words.length ? input.words : [input.start];
  const rows: Array<{ word: string; prev?: string; kind: 'start' | 'rung' | 'hint' | 'end' }> = [];
  words.forEach((w, i) => rows.push({ word: w, prev: i > 0 ? words[i - 1] : undefined, kind: i === 0 ? 'start' : input.hintMask[i] === '1' ? 'hint' : 'rung' }));
  if (words[words.length - 1] !== input.end) rows.push({ word: input.end, kind: 'end' });
  const areaHeight = footerTop - headerBottom;
  const gap = 10, pad = 28;
  const maxTile = 96;
  const tile = Math.min(maxTile, Math.floor((areaHeight - pad * 2 - gap * (rows.length - 1)) / rows.length), Math.floor((width - 200 - gap * 4) / 5));
  const boardW = tile * 5 + gap * 4, boardH = tile * rows.length + gap * (rows.length - 1);
  const x0 = (width - boardW) / 2, y0 = headerBottom + (areaHeight - boardH) / 2;
  const ACCENT = '#0284c7', HINTC = '#8b5cf6', START_FILL = '#7c3aed', EMPTY = '#ffffff', EMPTY_BORDER = '#d1d5db', END_BORDER = '#0284c788';
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.floor(tile * 0.5)}px ${SHARE_FONT_STACK}`;
  rows.forEach((row, r) => {
    for (let c = 0; c < 5; c++) {
      const x = x0 + c * (tile + gap), y = y0 + r * (tile + gap);
      const changed = !!row.prev && row.prev[c] !== row.word[c];
      const radius = Math.max(6, tile * 0.14);
      ctx.lineWidth = 3;
      if (row.kind === 'start') {
        ctx.fillStyle = START_FILL; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillText(row.word[c] ?? '', x + tile / 2, y + tile / 2 + 2);
      } else if (row.kind === 'end') {
        ctx.setLineDash([8, 6]); ctx.strokeStyle = END_BORDER; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ACCENT; ctx.fillText(row.word[c] ?? '', x + tile / 2, y + tile / 2 + 2);
      } else if (changed) {
        ctx.fillStyle = row.kind === 'hint' ? HINTC : ACCENT; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.fill();
      } else {
        ctx.fillStyle = EMPTY; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.fill();
        ctx.strokeStyle = EMPTY_BORDER; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.stroke();
      }
    }
  });
  ctx.restore();
}

// Spyglass (More Games §18d): a dot grid with the found words as accent
// capsules laid along their lines. No letters, so the card spoils nothing.
const WORDSEARCH_DIR_DELTAS: Record<string, [number, number]> = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1], W: [0, -1], N: [-1, 0], NW: [-1, -1], SW: [1, -1] };
function drawWordsearch(
  ctx: CanvasRenderingContext2D,
  input: ShareWordsearchInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const n = Math.max(1, input.n);
  const areaHeight = footerTop - headerBottom;
  const size = Math.min(width - 200, areaHeight - 80);
  const cardPad = 24;
  const inner = size - cardPad * 2;
  const cell = inner / n;
  const x0 = (width - size) / 2, y0 = headerBottom + (areaHeight - size) / 2;
  ctx.save();
  ctx.fillStyle = input.won ? WIN_BG : BOARD_LOSS_TINT;
  drawRoundRect(ctx, x0, y0, size, size, 28);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = input.won ? WIN_FG : LOSS_FG;
  ctx.stroke();
  const ACCENT = '#4d7c0f';
  // Capsules first, dots on top.
  for (const p of input.words) {
    if (!input.found.includes(p.w)) continue;
    const [dr, dc] = WORDSEARCH_DIR_DELTAS[p.d] ?? [0, 1];
    const ax = x0 + cardPad + (p.c + 0.5) * cell, ay = y0 + cardPad + (p.r + 0.5) * cell;
    const bx = x0 + cardPad + (p.c + dc * (p.w.length - 1) + 0.5) * cell, by = y0 + cardPad + (p.r + dr * (p.w.length - 1) + 0.5) * cell;
    ctx.strokeStyle = `${ACCENT}66`;
    ctx.lineWidth = cell * 0.72;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.fillStyle = '#c4b5fd';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    ctx.beginPath();
    ctx.arc(x0 + cardPad + (c + 0.5) * cell, y0 + cardPad + (r + 0.5) * cell, cell * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Hubbub (More Games §18d): the 2-3-2 cluster as blank tiles with the center
// filled in the accent, the rank name large beneath, then % of max. No letters.
// Muddle (More Games §18d): four rows of blank tiles (circled positions ringed)
// on one six-column grid, a divider, then the punchline row grouped by word in
// the lilac tint. No letters, no cartoon.
function drawScramble(
  ctx: CanvasRenderingContext2D,
  input: ShareScrambleInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const EMPTY = '#ffffff', EMPTY_BORDER = '#d1d5db', RING = '#7c3aed', LILAC = '#f5f3ff', LILAC_BORDER = '#c4b5fd';
  const areaHeight = footerTop - headerBottom;
  const gap = 10, rowGap = 26, cols = 6;
  const tile = Math.min(84, Math.floor((width - 200 - gap * (cols - 1)) / cols), Math.floor((areaHeight - 120 - rowGap * 5) / 5));
  const boardW = cols * tile + (cols - 1) * gap;
  const x0 = (width - boardW) / 2;
  const totalH = 4 * tile + 3 * rowGap + 40 + tile;
  let y = headerBottom + (areaHeight - totalH) / 2;
  ctx.save();
  ctx.lineWidth = 3;
  for (const w of input.words) {
    for (let i = 0; i < w.length; i++) {
      const x = x0 + i * (tile + gap), radius = Math.max(6, tile * 0.14);
      ctx.fillStyle = EMPTY; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.fill();
      ctx.strokeStyle = EMPTY_BORDER; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.stroke();
      if (w.circled.includes(i)) { ctx.strokeStyle = RING; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + tile / 2, y + tile / 2, tile * 0.34, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 3; }
    }
    y += tile + rowGap;
  }
  // divider
  y += 6;
  ctx.strokeStyle = EMPTY_BORDER; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + boardW, y); ctx.stroke();
  y += 34;
  const small = Math.floor(tile * 0.78), wordGap = 26;
  const totalLetters = input.pattern.reduce((a, b) => a + b, 0);
  const rowW = totalLetters * small + (totalLetters - input.pattern.length) * 6 + (input.pattern.length - 1) * wordGap;
  let x = (width - rowW) / 2;
  for (const len of input.pattern) {
    for (let i = 0; i < len; i++) {
      const radius = Math.max(5, small * 0.14);
      ctx.fillStyle = LILAC; drawRoundRect(ctx, x, y, small, small, radius); ctx.fill();
      ctx.strokeStyle = LILAC_BORDER; ctx.lineWidth = 3; drawRoundRect(ctx, x, y, small, small, radius); ctx.stroke();
      ctx.strokeStyle = RING; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + small / 2, y + small / 2, small * 0.32, 0, Math.PI * 2); ctx.stroke();
      x += small + 6;
    }
    x += wordGap - 6;
  }
  ctx.restore();
}

// Crosswordocious (More Games §18d): the grid silhouette — purple tiles where
// the letters are, nothing where the blocks are, no letters, no numbers.
function drawCrossword(
  ctx: CanvasRenderingContext2D,
  input: ShareCrosswordInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const FILL = '#ede9fe', BORDER = '#c4b5fd';
  const areaHeight = footerTop - headerBottom;
  const gap = 6;
  const cell = Math.floor(Math.min((width - 160 - gap * (input.w - 1)) / input.w, (areaHeight - 60 - gap * (input.h - 1)) / input.h));
  const boardW = input.w * cell + (input.w - 1) * gap, boardH = input.h * cell + (input.h - 1) * gap;
  const x0 = (width - boardW) / 2, y0 = headerBottom + (areaHeight - boardH) / 2;
  ctx.save();
  ctx.lineWidth = 3;
  for (let r = 0; r < input.h; r++) for (let c = 0; c < input.w; c++) {
    if (input.solution[r * input.w + c] === '.') continue;
    const x = x0 + c * (cell + gap), y = y0 + r * (cell + gap), radius = Math.max(5, cell * 0.16);
    ctx.fillStyle = FILL; drawRoundRect(ctx, x, y, cell, cell, radius); ctx.fill();
    ctx.strokeStyle = BORDER; drawRoundRect(ctx, x, y, cell, cell, radius); ctx.stroke();
  }
  ctx.restore();
}

// Kindred (More Games §18d): four tier bars in solve order with pips, unsolved
// tiers dashed beneath on a loss, then the mistake dots. No words.
const GROUPS_TIER_FILL: Record<number, [string, string]> = { 1: ['#ddd6fe', '#3b0764'], 2: ['#a78bfa', '#1a1a2e'], 3: ['#7c3aed', '#ffffff'], 4: ['#1a1a2e', '#ffffff'] };
function drawGroups(
  ctx: CanvasRenderingContext2D,
  input: ShareGroupsInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const ACCENT = '#9f1239', DOT_OFF = '#e5e7eb';
  const tiers = [...input.solvedTiers, ...[1, 2, 3, 4].filter((t) => !input.solvedTiers.includes(t))];
  const areaHeight = footerTop - headerBottom;
  const barW = Math.min(760, width - 160), barH = 96, gap = 22;
  const dotsH = 60;
  const totalH = tiers.length * barH + (tiers.length - 1) * gap + dotsH + 30;
  const x0 = (width - barW) / 2;
  let y = headerBottom + (areaHeight - totalH) / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  tiers.forEach((t) => {
    const solved = input.solvedTiers.includes(t);
    const [bg, fg] = GROUPS_TIER_FILL[t];
    const radius = 22;
    if (solved) {
      ctx.fillStyle = bg; drawRoundRect(ctx, x0, y, barW, barH, radius); ctx.fill();
    } else {
      ctx.setLineDash([12, 10]); ctx.lineWidth = 4; ctx.strokeStyle = bg; drawRoundRect(ctx, x0, y, barW, barH, radius); ctx.stroke(); ctx.setLineDash([]);
    }
    // pips, centered
    const pipR = 9, pipGap = 14, pipsW = t * pipR * 2 + (t - 1) * pipGap;
    let px = width / 2 - pipsW / 2 + pipR;
    ctx.fillStyle = solved ? fg : bg;
    for (let i = 0; i < t; i++) { ctx.beginPath(); ctx.arc(px, y + barH / 2, pipR, 0, Math.PI * 2); ctx.fill(); px += pipR * 2 + pipGap; }
    y += barH + gap;
  });
  // mistake dots
  y += 30 - gap;
  const dotR = 14, dotGap = 26, n = input.maxMistakes, dotsW = n * dotR * 2 + (n - 1) * dotGap;
  let dx = width / 2 - dotsW / 2 + dotR;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < n - input.mistakes ? ACCENT : DOT_OFF;
    ctx.beginPath(); ctx.arc(dx, y + dotsH / 2, dotR, 0, Math.PI * 2); ctx.fill();
    dx += dotR * 2 + dotGap;
  }
  ctx.restore();
}

// Codebreaker (More Games §18d): the ciphertext as rows of blank cells with the
// code letter beneath each, words wrapped whole. No plain letters.
function drawCryptogram(
  ctx: CanvasRenderingContext2D,
  input: ShareCryptogramInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const ACCENT = '#92400e', EMPTY = '#ffffff', EMPTY_BORDER = '#d1d5db', CODE = '#9ca3af';
  const words = input.cipher.split(' ');
  const areaHeight = footerTop - headerBottom;
  const margin = 70;
  const maxW = width - margin * 2;
  // Pick the largest cell size whose wrapped rows fit the area.
  let cell = 58, gap = 6, wordGap = 22, rowH = 0, rows: string[][] = [];
  for (; cell >= 26; cell -= 4) {
    rowH = cell + 22 + 18;
    rows = [];
    let cur: string[] = [], curW = 0;
    for (const w of words) {
      const letters = [...w].filter((ch) => /[A-Z]/.test(ch)).length, puncts = w.length - letters;
      const ww = letters * (cell + gap) + puncts * (cell * 0.45) - gap;
      if (cur.length && curW + wordGap + ww > maxW) { rows.push(cur); cur = []; curW = 0; }
      curW += (cur.length ? wordGap : 0) + ww; cur.push(w);
    }
    if (cur.length) rows.push(cur);
    if (rows.length * rowH + (rows.length - 1) * 10 <= areaHeight - 40) break;
  }
  const totalH = rows.length * rowH + (rows.length - 1) * 10;
  let y = headerBottom + (areaHeight - totalH) / 2;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const row of rows) {
    const widths = row.map((w) => { const letters = [...w].filter((ch) => /[A-Z]/.test(ch)).length; return letters * (cell + gap) + (w.length - letters) * (cell * 0.45) - gap; });
    const rowW = widths.reduce((a, b) => a + b, 0) + wordGap * (row.length - 1);
    let x = (width - rowW) / 2;
    row.forEach((w, i) => {
      for (const ch of w) {
        if (/[A-Z]/.test(ch)) {
          const radius = Math.max(5, cell * 0.16);
          ctx.fillStyle = EMPTY; drawRoundRect(ctx, x, y, cell, cell, radius); ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = EMPTY_BORDER; drawRoundRect(ctx, x, y, cell, cell, radius); ctx.stroke();
          ctx.fillStyle = CODE; ctx.font = `800 ${Math.floor(cell * 0.34)}px ui-monospace, Menlo, monospace`;
          ctx.fillText(ch, x + cell / 2, y + cell + 14);
          x += cell + gap;
        } else {
          ctx.fillStyle = ACCENT; ctx.font = `900 ${Math.floor(cell * 0.6)}px ${SHARE_FONT_STACK}`;
          ctx.fillText(ch, x + cell * 0.22, y + cell / 2 + 2);
          x += cell * 0.45;
        }
      }
      x += wordGap - gap;
    });
    y += rowH + 10;
  }
  ctx.restore();
}

function drawHub(
  ctx: CanvasRenderingContext2D,
  input: ShareHubInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const areaHeight = footerTop - headerBottom;
  const ACCENT = '#c026d3';
  const tile = Math.min(150, Math.floor((areaHeight - 260) / 3.4)), gap = 18;
  const cx = width / 2;
  const clusterH = tile * 3 + gap * 2;
  const y0 = headerBottom + (areaHeight - clusterH - 200) / 2;
  const rows: Array<Array<'o' | 'c'>> = [['o', 'o'], ['o', 'c', 'o'], ['o', 'o']];
  ctx.save();
  rows.forEach((row, r) => {
    const rowW = row.length * tile + (row.length - 1) * gap;
    row.forEach((kind, i) => {
      const x = cx - rowW / 2 + i * (tile + gap), y = y0 + r * (tile + gap);
      const radius = Math.max(8, tile * 0.14);
      if (kind === 'c') { ctx.fillStyle = ACCENT; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.fill(); }
      else {
        ctx.fillStyle = '#ffffff'; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#d1d5db'; drawRoundRect(ctx, x, y, tile, tile, radius); ctx.stroke();
      }
    });
  });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `900 64px ${SHARE_FONT_STACK}`; ctx.fillStyle = ACCENT;
  ctx.fillText(input.rankName.toUpperCase(), cx, y0 + clusterH + 96);
  ctx.font = `700 30px ${SHARE_FONT_STACK}`; ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(`${input.pct}% of the maximum`, cx, y0 + clusterH + 146);
  ctx.restore();
}

function drawMulti(
  ctx: CanvasRenderingContext2D,
  input: ShareMultiInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const n = input.boards.length;
  if (!n || !input.boards[0].grid.length) return;

  // Match the in-app finished-screen arrangement:
  //   4 boards → 2 cols × 2 rows (Quordle / Succession / Deliverance)
  //   8 boards → 4 cols × 2 rows (Octordle)
  const cols = n <= 4 ? 2 : 4;
  const rows = 2;

  // Use the *max* row/col count across all boards to compute a single tile
  // size that every board renders at. drawBoardCard later re-derives its own
  // tile size from each board's grid — feeding it a uniform row count
  // (via boardToGrid's pad-to-prefill+maxGuesses) keeps the sizes matched.
  // Guarding here against a stray board being taller/wider defends against
  // future modes that pack boards with mismatched dimensions.
  const boardCols = Math.max(5, ...input.boards.map(b => b.grid[0]?.length ?? 0));
  const boardRows = Math.max(1, ...input.boards.map(b => b.grid.length));

  // Layout constants — must match drawBoardCard so the pre-compute here
  // produces the same `tile` value the card's internal math will pick.
  const cardPad = 12;
  const borderWidth = 3;
  const tileGap = 4;

  // Inter-board gaps. The previous version divided the canvas into equal
  // cells and centered each board inside its cell — at tile sizes the
  // boards ended up small and the intra-cell slack compounded into a huge
  // "sea" between them. Now we size boards to their natural height
  // constraint and place them directly with a known gap, so the 2×2 grid
  // packs tightly with modest outer margin instead of two lonely columns.
  const rowGap = 20;
  const colGap = 16;
  const verticalPad = 32;
  const minHorizontalPad = 40;

  const areaHeight = footerTop - headerBottom - verticalPad * 2;

  // "Full results": every cell reserves a uniform caption strip under its
  // board (the answer is only drawn under lost boards) so won and lost
  // boards keep identical tile sizes and vertical rhythm.
  const captionH = input.reveal ? ANSWER_CAPTION_H : 0;

  // Tile size derives from whichever axis is tighter. Boards are typically
  // tall-and-narrow (5×9, 5×10, 5×13), so the row budget binds — the width
  // clamp is only there for defensive over-wide inputs.
  const perRowHeight = (areaHeight - rowGap * (rows - 1)) / rows;
  const tileFromHeight =
    (perRowHeight - captionH - cardPad * 2 - borderWidth * 2 - tileGap * (boardRows - 1)) / boardRows;
  const availW = width - minHorizontalPad * 2 - colGap * (cols - 1);
  const perColWidth = availW / cols;
  const tileFromWidth =
    (perColWidth - cardPad * 2 - borderWidth * 2 - tileGap * (boardCols - 1)) / boardCols;
  const tile = Math.max(8, Math.floor(Math.min(tileFromHeight, tileFromWidth)));

  const boardW = boardCols * tile + (boardCols - 1) * tileGap + cardPad * 2 + borderWidth * 2;
  const boardH = boardRows * tile + (boardRows - 1) * tileGap + cardPad * 2 + borderWidth * 2;
  const cellH = boardH + captionH;

  const totalW = cols * boardW + (cols - 1) * colGap;
  const totalH = rows * cellH + (rows - 1) * rowGap;
  const startX = (width - totalW) / 2;
  const startY = headerBottom + verticalPad + (areaHeight - totalH) / 2;

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellCenterX = startX + col * (boardW + colGap) + boardW / 2;
    const cellCenterY = startY + row * (cellH + rowGap) + cellH / 2;
    const board = input.boards[i];
    const reveal = input.reveal
      ? {
          letters: board.letters,
          answerCaption: !board.won ? board.solution : undefined,
          reserveCaption: true,
        }
      : undefined;
    drawBoardCard(ctx, board.grid, cellCenterX, cellCenterY, boardW, cellH, board.won, undefined, reveal);
  }
}

function drawGauntlet(
  ctx: CanvasRenderingContext2D,
  input: ShareGauntletInput,
  width: number,
  headerBottom: number,
  footerTop: number,
): void {
  const n = input.stages.length;
  const horizontalPad = 100;
  const areaWidth = width - horizontalPad * 2;
  const areaHeight = footerTop - headerBottom - 40;
  const gap = 20;
  const chipH = Math.floor((areaHeight - gap * (n - 1)) / n);

  for (let i = 0; i < n; i++) {
    const stage = input.stages[i];
    const chipY = headerBottom + 40 + i * (chipH + gap);
    const won = stage.status === GameStatus.WON;
    const borderColor = won ? WIN_FG : LOSS_FG;
    const bgColor = won ? WIN_BG : LOSS_BG;

    // Chip background
    drawRoundRect(ctx, horizontalPad, chipY, areaWidth, chipH, 24);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stage index
    ctx.font = `900 32px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = won ? WIN_FG : LOSS_FG;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, horizontalPad + 32, chipY + chipH / 2);

    // Stage name
    ctx.font = `900 30px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_DARK;
    ctx.fillText(stage.name, horizontalPad + 80, chipY + chipH / 2 - 12);

    // Stage stats
    ctx.font = `700 20px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    const statsLine = `${stage.boardsSolved}/${stage.totalBoards} boards · ${stage.guesses} guesses`;
    ctx.fillText(statsLine, horizontalPad + 80, chipY + chipH / 2 + 16);

    // Pass/fail mark at right
    ctx.font = `900 56px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = won ? WIN_FG : LOSS_FG;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(won ? '✓' : '✗', horizontalPad + areaWidth - 40, chipY + chipH / 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// All-dailies share card (Daily Sweep / Flawless Victory)
// ──────────────────────────────────────────────────────────────────────────

const SWEEP_VIOLET: [string, string] = ['#a78bfa', '#ec4899'];
const SWEEP_GOLD: [string, string] = ['#d97706', '#b45309'];

/**
 * Draws a mode's real game icon (WHITE) centered at (cx, cy) inside its accent
 * badge on the all-dailies share card — the same lucide art the home cards use
 * (Classic=grid, Succession=trending-up, Deliverance=shield, Gauntlet=skull,
 * ProperNoundle=crown). Returns false for the numeral modes (QuadWord/OctoWord/
 * Six/Seven) so the caller draws the glyph instead. Paths copied verbatim from
 * lucide-react@0.446 so they match the on-screen icons exactly.
 */
function drawSweepBadgeIcon(
  ctx: CanvasRenderingContext2D,
  mode: string,
  cx: number,
  cy: number,
  size: number,
): boolean {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // lucide icons share a 24×24 viewBox + 2px stroke; scale into `size`.
  const lucide = (draw: () => void) => {
    const s = size / 24;
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(s, s);
    ctx.lineWidth = 2;
    draw();
  };
  const strokePath = (d: string) => ctx.stroke(new Path2D(d));
  const strokePolyline = (pts: number[][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  };
  const strokeCircle = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };

  let drew = true;
  switch (mode) {
    case 'Classic': {
      // 5×6 grid of rounded squares (viewBox 20×24), white, like WordleGridIcon.
      const s = size / 24;
      ctx.translate(cx - (20 * s) / 2, cy - (24 * s) / 2);
      ctx.scale(s, s);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.92;
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 5; col++) {
          drawRoundRect(ctx, col * 4, row * 4, 3.2, 3.2, 0.6);
          ctx.fill();
        }
      break;
    }
    case 'Succession':
      lucide(() => {
        strokePolyline([[22, 7], [13.5, 15.5], [8.5, 10.5], [2, 17]]);
        strokePolyline([[16, 7], [22, 7], [22, 13]]);
      });
      break;
    case 'Deliverance':
      lucide(() =>
        strokePath(
          'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
        ),
      );
      break;
    case 'Gauntlet':
      lucide(() => {
        strokePath('m12.5 17-.5-1-.5 1h1z');
        strokePath('M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z');
        strokeCircle(15, 12, 1);
        strokeCircle(9, 12, 1);
      });
      break;
    case 'ProperNoundle':
      lucide(() => {
        strokePath(
          'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z',
        );
        strokePath('M5 21h14');
      });
      break;
    default:
      drew = false;
  }
  ctx.restore();
  return drew;
}

function drawProfileCard(
  ctx: CanvasRenderingContext2D,
  input: ShareProfileInput,
  width: number,
): void {
  const cx = width / 2;
  const accent = input.accentHex;

  // Wordmark
  ctx.save();
  ctx.font = `900 52px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const wm = ctx.createLinearGradient(cx - 200, 50, cx + 200, 100);
  wm.addColorStop(0, WORDMARK_GRADIENT[0]);
  wm.addColorStop(1, WORDMARK_GRADIENT[1]);
  ctx.fillStyle = wm;
  ctx.fillText('WORDOCIOUS', cx, 96);
  ctx.restore();

  // Username (accent)
  ctx.font = `900 76px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent;
  ctx.fillText(input.username, cx, 220);

  // Level · tier
  ctx.font = `700 30px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(`Level ${input.level} · ${input.tier}`, cx, 270);

  // Stat tiles (2 × 3)
  const tiles: Array<{ v: string; l: string }> = [
    { v: `${input.totalWins}`, l: 'Total Wins' },
    { v: `${Math.round(input.winRate)}%`, l: 'Win Rate' },
    { v: `${input.currentStreak}`, l: 'Win Streak' },
    { v: `${input.dailyStreak}`, l: 'Daily Streak' },
    { v: `${input.gold} · ${input.silver} · ${input.bronze}`, l: 'Medals (G·S·B)' },
    { v: `${input.achievementsUnlocked}/${input.achievementsTotal}`, l: 'Achievements' },
  ];
  const padH = 80;
  const gap = 24;
  const tileW = (width - padH * 2 - gap) / 2;
  const tileH = 150;
  const top = 330;
  tiles.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = padH + col * (tileW + gap);
    const y = top + row * (tileH + gap);
    drawRoundRect(ctx, x, y, tileW, tileH, 24);
    ctx.fillStyle = accent + '14';
    ctx.fill();
    ctx.strokeStyle = accent + '40';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `900 56px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = '#1A1A2E';
    ctx.fillText(t.v, x + 28, y + 82);
    ctx.font = `700 24px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(t.l, x + 28, y + 118);
  });
}

function drawDailySweepCard(
  ctx: CanvasRenderingContext2D,
  input: ShareDailySweepInput,
  width: number,
  height: number,
): void {
  const titleGrad = input.flawless ? SWEEP_GOLD : SWEEP_VIOLET;

  // Wordmark
  const wordmarkY = 72;
  ctx.save();
  ctx.font = `900 56px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const wm = ctx.createLinearGradient(width / 2 - 200, wordmarkY - 48, width / 2 + 200, wordmarkY + 8);
  wm.addColorStop(0, WORDMARK_GRADIENT[0]);
  wm.addColorStop(1, WORDMARK_GRADIENT[1]);
  ctx.fillStyle = wm;
  ctx.fillText('WORDOCIOUS', width / 2, wordmarkY);
  ctx.restore();

  // Title
  const titleY = wordmarkY + 70;
  ctx.font = `900 52px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const tg = ctx.createLinearGradient(width / 2 - 260, titleY - 44, width / 2 + 260, titleY + 8);
  tg.addColorStop(0, titleGrad[0]);
  tg.addColorStop(1, titleGrad[1]);
  ctx.fillStyle = tg;
  ctx.fillText(input.flawless ? 'FLAWLESS VICTORY' : 'DAILY SWEEP', width / 2, titleY);

  // Stats line
  const date = input.date ?? new Date(getTodayLocal() + 'T00:00:00');
  const statsText = `${input.won}/${input.total} won · ${formatTime(input.totalTimeSeconds)} · ${input.totalScore.toLocaleString()} pts · ${formatShortDate(date)}`;
  const metaY = titleY + 50;
  ctx.font = `700 26px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statsText, width / 2, metaY);

  const headerBottom = metaY + 30;
  const footerTop = height - 80;

  // Rows — one per daily game.
  const n = input.games.length;
  const horizontalPad = 90;
  const areaWidth = width - horizontalPad * 2;
  const areaTop = headerBottom + 28;
  const areaHeight = footerTop - areaTop - 20;
  const gap = 16;
  const rowH = Math.floor((areaHeight - gap * (n - 1)) / n);

  for (let i = 0; i < n; i++) {
    const g = input.games[i];
    const rowY = areaTop + i * (rowH + gap);
    const accent = MODE_ACCENT[g.mode];

    // Row card
    drawRoundRect(ctx, horizontalPad, rowY, areaWidth, rowH, 20);
    ctx.fillStyle = g.won ? WIN_BG : LOSS_BG;
    ctx.fill();
    ctx.strokeStyle = g.won ? WIN_FG : LOSS_FG;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Accent glyph badge
    const badge = Math.min(rowH - 24, 72);
    const badgeX = horizontalPad + 20;
    const badgeY = rowY + (rowH - badge) / 2;
    drawRoundRect(ctx, badgeX, badgeY, badge, badge, 16);
    ctx.fillStyle = accent;
    ctx.fill();
    // Real game icon (white) where the mode has one; numeral modes fall back to
    // the glyph — same treatment as the home cards + the native share cards.
    if (!drawSweepBadgeIcon(ctx, g.mode, badgeX + badge / 2, badgeY + badge / 2, badge * 0.56)) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${MODE_SHARE_GLYPH[g.mode].length >= 3 ? 24 : 30}px ${SHARE_FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(MODE_SHARE_GLYPH[g.mode], badgeX + badge / 2, badgeY + badge / 2 + 1);
    }

    const textX = badgeX + badge + 22;
    // Mode name
    ctx.font = `900 30px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_DARK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.modeLabel, textX, rowY + rowH / 2 - 13);

    // Per-game stats
    ctx.font = `700 21px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    const guessDisp = g.won ? `${g.guesses}g` : 'X';
    ctx.fillText(`${guessDisp} · ${formatTime(g.timeSeconds)} · ${g.score.toLocaleString()} pts`, textX, rowY + rowH / 2 + 15);

    // Pass/fail mark at right
    ctx.font = `900 48px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = g.won ? WIN_FG : LOSS_FG;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.won ? '✓' : '✗', horizontalPad + areaWidth - 32, rowY + rowH / 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Daily-leaderboard share card (solo / VS / yesterday's podium)
// ──────────────────────────────────────────────────────────────────────────

// Per-variant identity: lavender for the daily board + podium, mint/teal for
// the VS battle board (VS Battle catalog accent = #0d9488).
const VS_ACCENT = '#0d9488';
const LB_THEME: Record<ShareLeaderboardInput['variant'], {
  bg: string; label: string; panelBorder: string; footer: string;
}> = {
  solo:   { bg: '#f5f3ff', label: '#7c3aed', panelBorder: '#a78bfa55', footer: '#7c3aed' },
  vs:     { bg: '#f0fdfa', label: VS_ACCENT, panelBorder: '#0d948855', footer: VS_ACCENT },
  podium: { bg: '#f5f3ff', label: '#d97706', panelBorder: '#f59e0b55', footer: '#7c3aed' },
  // Friends (§207): indigo — the leaderboard tab's own accent family.
  friends:       { bg: '#eef2ff', label: '#4f46e5', panelBorder: '#6366f155', footer: '#4f46e5' },
  friendsPodium: { bg: '#eef2ff', label: '#d97706', panelBorder: '#f59e0b55', footer: '#4f46e5' },
  // Sweep (§231): pink-washed violet — the full-sweep brag's own identity
  // (shared verbatim with the iOS/Android cards).
  sweep:       { bg: '#fdf2f8', label: '#7c3aed', panelBorder: '#ec489955', footer: '#7c3aed' },
  sweepPodium: { bg: '#fdf2f8', label: '#d97706', panelBorder: '#f59e0b55', footer: '#7c3aed' },
  // Weekly race (§234): the friends indigo family — the race lives inside the
  // FRIENDS surface, so its brag card wears the same colors (shared verbatim
  // with the iOS/Android cards).
  weeklyRace: { bg: '#eef2ff', label: '#4f46e5', panelBorder: '#6366f155', footer: '#4f46e5' },
  // Flawless streak + trophy case (§244/§245): the gold family — both cards
  // are pure brags, so they wear the medal/amber identity (shared verbatim
  // with the iOS/Android cards).
  flawlessStreak: { bg: '#fffbeb', label: '#d97706', panelBorder: '#f59e0b55', footer: '#d97706' },
  trophyCase:     { bg: '#fffbeb', label: '#d97706', panelBorder: '#f59e0b55', footer: '#d97706' },
};
const LB_LABEL: Record<ShareLeaderboardInput['variant'], string> = {
  solo: 'DAILY LEADERBOARD',
  vs: 'VS BATTLE LEADERBOARD',
  podium: 'YESTERDAY’S PODIUM',
  friends: 'FRIENDS LEADERBOARD',
  friendsPodium: 'FRIENDS PODIUM',
  sweep: 'DAILY SWEEP BOARD',
  sweepPodium: 'YESTERDAY’S SWEEP PODIUM',
  weeklyRace: 'FRIENDS WEEKLY RACE',
  flawlessStreak: 'FLAWLESS STREAK',
  trophyCase: 'TROPHY CASE',
};

// Rank iconography — same colors as the in-app RankIcon (crown gold, medal
// silver, medal bronze).
const RANK_ICON_COLORS = ['#d97706', '#9ca3af', '#b45309'];

/** Stroke a lucide icon (24×24 viewBox, 2px stroke) centered at (cx, cy).
 *  Paths copied verbatim from lucide-react@0.446 (crown/medal/swords) so the
 *  card echoes the exact on-screen iconography. */
function drawLucideStroke(
  ctx: CanvasRenderingContext2D,
  icon: 'crown' | 'medal' | 'swords',
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  ctx.save();
  const s = size / 24;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const p = (d: string) => ctx.stroke(new Path2D(d));
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const poly = (pts: number[][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  };
  switch (icon) {
    case 'crown':
      p('M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z');
      p('M5 21h14');
      break;
    case 'medal':
      p('M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15');
      p('M11 12 5.12 2.2');
      p('m13 12 5.88-9.8');
      p('M8 7h8');
      ctx.beginPath(); ctx.arc(12, 17, 5, 0, Math.PI * 2); ctx.stroke();
      p('M12 18v-2h-.5');
      break;
    case 'swords':
      poly([[14.5, 17.5], [3, 6], [3, 3], [6, 3], [17.5, 14.5]]);
      line(13, 19, 19, 13);
      line(16, 16, 20, 20);
      line(19, 21, 21, 19);
      poly([[14.5, 6.5], [18, 3], [21, 3], [21, 6], [17.5, 9.5]]);
      line(5, 14, 9, 18);
      line(7, 17, 4, 20);
      line(3, 19, 5, 21);
      break;
  }
  ctx.restore();
}

/** Truncate text with an ellipsis to fit maxWidth at the current ctx.font. */
function clampText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function drawLbRankGlyph(ctx: CanvasRenderingContext2D, rank: number, cx: number, cy: number, forceNumber = false): void {
  if (forceNumber) {
    ctx.font = `900 30px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), cx, cy + 1);
    return;
  }
  if (rank === 1) drawLucideStroke(ctx, 'crown', cx, cy, 40, RANK_ICON_COLORS[0]);
  else if (rank === 2) drawLucideStroke(ctx, 'medal', cx, cy, 40, RANK_ICON_COLORS[1]);
  else if (rank === 3) drawLucideStroke(ctx, 'medal', cx, cy, 40, RANK_ICON_COLORS[2]);
  else {
    ctx.font = `900 30px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), cx, cy + 1);
  }
}

/** One leaderboard row. Draws the gold "you" treatment, rank glyph, name
 *  (+ "· YOU" and the rank-delta pill on the sharer's row), and the
 *  right-aligned score with its optional stats subline. */
function drawLbRow(
  ctx: CanvasRenderingContext2D,
  row: ShareLeaderboardRowInput,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    rankLine?: string;
    delta?: { text: string; improved: boolean };
    separator?: boolean;
    /** You-row sits at the panel's first/last slot — bleed the highlight to
     *  the panel edge and match its corner radius there. */
    edgeTop?: boolean;
    edgeBottom?: boolean;
    /** Panel inner padding to consume when bleeding (default 16). */
    bleed?: number;
    /** §248: flawlessStreak rows are DAYS, not competitors — a crown/medal
     *  column reads as ranking, so those cards number every row instead. */
    numericRank?: boolean;
  } = {},
): void {
  // Gold "you" highlight — full-bleed across the panel with a soft amber
  // glow instead of a hard border (founder polish note, Aug 7).
  if (row.isYou) {
    const bleed = opts.bleed ?? 16;
    const hy = opts.edgeTop ? y - bleed + 2 : y + 4;
    const hb = opts.edgeBottom ? y + h + bleed - 2 : y + h - 4;
    const rTop = opts.edgeTop ? 26 : 16;
    const rBot = opts.edgeBottom ? 26 : 16;
    const goldPath = () => {
      const gx = x + 2, gw = w - 4, gb = hb;
      ctx.beginPath();
      ctx.moveTo(gx + rTop, hy);
      ctx.lineTo(gx + gw - rTop, hy);
      ctx.arcTo(gx + gw, hy, gx + gw, hy + rTop, rTop);
      ctx.lineTo(gx + gw, gb - rBot);
      ctx.arcTo(gx + gw, gb, gx + gw - rBot, gb, rBot);
      ctx.lineTo(gx + rBot, gb);
      ctx.arcTo(gx, gb, gx, gb - rBot, rBot);
      ctx.lineTo(gx, hy + rTop);
      ctx.arcTo(gx, hy, gx + rTop, hy, rTop);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
    ctx.shadowBlur = 26;
    goldPath();
    ctx.fillStyle = '#fef3c7';
    ctx.fill();
    ctx.restore();
    goldPath();
    const goldGlow = ctx.createLinearGradient(x, hy, x, hb);
    goldGlow.addColorStop(0, 'rgba(252, 211, 77, 0.55)');
    goldGlow.addColorStop(1, 'rgba(245, 158, 11, 0.25)');
    ctx.strokeStyle = goldGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const midY = y + h / 2;
  drawLbRankGlyph(ctx, row.rank, x + 56, midY, opts.numericRank);

  // Right block: bold score, optional subline underneath.
  const rightX = x + w - 30;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `900 34px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = TEXT_DARK;
  ctx.fillText(row.scoreDisplay, rightX, row.subline ? midY - 13 : midY);
  let rightBlockW = ctx.measureText(row.scoreDisplay).width;
  if (row.subline) {
    ctx.font = `700 21px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    ctx.fillText(row.subline, rightX, midY + 16);
    rightBlockW = Math.max(rightBlockW, ctx.measureText(row.subline).width);
  }

  // Left block: name (+ YOU label + delta pill), optional "#R of TOTAL" line.
  const nameX = x + 96;
  const nameMaxW = w - 96 - 30 - rightBlockW - 24;
  // §249: a dot strip claims the second line — the name rides high like the
  // rankLine case does.
  const hasDots = !!row.dots && row.dots.length > 0;
  const nameY = opts.rankLine || hasDots ? midY - 14 : midY;
  ctx.textAlign = 'left';
  ctx.font = `900 30px ${SHARE_FONT_STACK}`;
  let reserved = 0;
  if (row.isYou) {
    ctx.font = `900 24px ${SHARE_FONT_STACK}`;
    reserved += ctx.measureText(' · YOU').width;
    ctx.font = `900 30px ${SHARE_FONT_STACK}`;
  }
  const name = clampText(ctx, row.name, Math.max(60, nameMaxW - reserved));
  ctx.fillStyle = TEXT_DARK;
  ctx.fillText(name, nameX, nameY);
  let cursorX = nameX + ctx.measureText(name).width;
  if (row.isYou) {
    ctx.font = `900 24px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = '#d97706';
    ctx.fillText(' · YOU', cursorX, nameY + 1);
    cursorX += ctx.measureText(' · YOU').width;
  }

  // §249: the nine-dot mode strip beneath the name — in-app SweepModeDots
  // rules verbatim (violet win intensity, red loss, hollow unplayed).
  let dotsEndX = nameX;
  if (hasDots) {
    const cy = midY + 18;
    const r = 7;
    row.dots!.forEach((d, i) => {
      const cx = nameX + r + i * 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (d === null) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (d < 0) {
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.18 + 0.82 * d;
        ctx.fillStyle = '#7c3aed';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
    dotsEndX = nameX + r + (row.dots!.length - 1) * 20 + r + 14;
  }

  // Rank-delta pill ("▲3 vs yesterday" green / "▼2 vs yesterday" red) on the
  // sharer's row — under the name when the "#R of TOTAL" line isn't there,
  // sharing the second line with it otherwise (after the dots, §249).
  if (row.isYou && (opts.delta || opts.rankLine)) {
    const lineY = midY + 17;
    let lx = hasDots ? dotsEndX : nameX;
    if (opts.rankLine) {
      ctx.font = `800 21px ${SHARE_FONT_STACK}`;
      ctx.fillStyle = '#b45309';
      ctx.fillText(opts.rankLine, lx, lineY);
      lx += ctx.measureText(opts.rankLine).width + 12;
    }
    if (opts.delta) {
      ctx.font = `800 18px ${SHARE_FONT_STACK}`;
      const pillText = opts.delta.text;
      const pillW = ctx.measureText(pillText).width + 20;
      const pillH = 28;
      // No rank line → pill rides the name line instead of a second line.
      const pillY = opts.rankLine ? lineY - pillH / 2 : nameY - pillH / 2;
      const pillX = opts.rankLine ? lx : cursorX + 12;
      drawRoundRect(ctx, pillX, pillY, pillW, pillH, 14);
      ctx.fillStyle = opts.delta.improved ? '#dcfce7' : '#fee2e2';
      ctx.fill();
      ctx.fillStyle = opts.delta.improved ? '#16a34a' : '#dc2626';
      ctx.fillText(pillText, pillX + 10, pillY + pillH / 2 + 1);
    }
  }

  if (opts.separator && !row.isYou) {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 26, y + h);
    ctx.lineTo(x + w - 26, y + h);
    ctx.stroke();
  }
}

function drawLeaderboardCard(
  ctx: CanvasRenderingContext2D,
  input: ShareLeaderboardInput,
  width: number,
  height: number,
): void {
  const theme = LB_THEME[input.variant];

  // Variant-tinted card background (lavender / mint) over the default fill.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  // Wordmark — the established two-tone (violet→pink) treatment.
  const wordmarkY = 96;
  ctx.save();
  ctx.font = `900 60px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const wm = ctx.createLinearGradient(width / 2 - 220, wordmarkY - 52, width / 2 + 220, wordmarkY + 8);
  wm.addColorStop(0, WORDMARK_GRADIENT[0]);
  wm.addColorStop(1, WORDMARK_GRADIENT[1]);
  ctx.fillStyle = wm;
  ctx.fillText('WORDOCIOUS', width / 2, wordmarkY);
  ctx.restore();

  // Letterspaced variant label. `letterSpacing` is a newer canvas property —
  // set through a cast and degrade gracefully where unsupported.
  const labelY = wordmarkY + 74;
  ctx.save();
  const anyCtx = ctx as unknown as { letterSpacing?: string };
  try { anyCtx.letterSpacing = '10px'; } catch { /* older engines */ }
  ctx.font = `900 36px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.label;
  ctx.fillText(LB_LABEL[input.variant], width / 2, labelY);
  try { anyCtx.letterSpacing = '0px'; } catch { /* older engines */ }
  ctx.restore();

  // Chips: mode (accent bg; swords glyph on the VS variant) + date/puzzle.
  const chipH = 56;
  const chipY = labelY + 36;
  const chipFont = `800 27px ${SHARE_FONT_STACK}`;
  ctx.font = chipFont;
  const swordsSize = input.variant === 'vs' ? 30 : 0;
  const swordsGap = input.variant === 'vs' ? 10 : 0;
  const modeTextW = ctx.measureText(input.modeChip).width;
  const modeChipW = modeTextW + swordsSize + swordsGap + 48;
  const dateTextW = ctx.measureText(input.dateChip).width;
  const dateChipW = dateTextW + 44;
  const chipGap = 16;
  let chipX = (width - modeChipW - chipGap - dateChipW) / 2;

  // 'DailySweep' (§231) isn't in the mode catalog → no MODE_ACCENT entry; the
  // variant theme's label color carries the chip instead.
  const modeAccent = input.variant === 'vs' ? VS_ACCENT : (MODE_ACCENT[input.mode] ?? theme.label);
  drawRoundRect(ctx, chipX, chipY, modeChipW, chipH, chipH / 2);
  ctx.fillStyle = modeAccent;
  ctx.fill();
  let modeTextX = chipX + 24;
  if (input.variant === 'vs') {
    drawLucideStroke(ctx, 'swords', modeTextX + swordsSize / 2, chipY + chipH / 2, swordsSize, '#ffffff');
    modeTextX += swordsSize + swordsGap;
  }
  ctx.font = chipFont;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(input.modeChip, modeTextX, chipY + chipH / 2 + 1);

  chipX += modeChipW + chipGap;
  drawRoundRect(ctx, chipX, chipY, dateChipW, chipH, chipH / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = chipFont;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(input.dateChip, chipX + 22, chipY + chipH / 2 + 1);

  // Rows panel — sized to its content, then centered in the space between
  // the chips and the footer, so short boards (3-4 rows) don't strand dead
  // padding above the first and below the last row (founder note, Aug 7).
  const panelX = 64;
  const panelW = width - panelX * 2;
  const areaTop = chipY + chipH + 40;
  const footerY = height - 52;
  const areaBottom = footerY - 46;
  const pad = 16;
  const dividerH = input.you ? 46 : 0;
  const nRows = input.rows.length + (input.you ? 1 : 0);
  if (!nRows) return;
  const rowH = Math.min(band(input), (areaBottom - areaTop - pad * 2 - dividerH) / nRows);
  const contentH = rowH * nRows + dividerH + pad * 2;
  const panelTop = areaTop + (areaBottom - areaTop - contentH) / 2;
  drawRoundRect(ctx, panelX, panelTop, panelW, contentH, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = theme.panelBorder;
  ctx.lineWidth = 3;
  ctx.stroke();
  let y = panelTop + pad;

  input.rows.forEach((row, i) => {
    drawLbRow(ctx, row, panelX, y, panelW, rowH, {
      numericRank: input.variant === 'flawlessStreak',
      delta: row.isYou ? input.delta : undefined,
      separator: i < input.rows.length - 1 || !!input.you,
      edgeTop: i === 0,
      edgeBottom: i === input.rows.length - 1 && !input.you,
      bleed: pad,
    });
    y += rowH;
  });

  if (input.you) {
    // "• • •" divider between the compressed top rows and the sharer's row.
    ctx.font = `900 26px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('• • •', width / 2, y + dividerH / 2 + 1);
    y += dividerH;
    drawLbRow(ctx, input.you, panelX, y, panelW, rowH, {
      numericRank: input.variant === 'flawlessStreak',
      rankLine: input.youRankLine,
      delta: input.delta,
      edgeBottom: true,
      bleed: pad,
    });
  }

  // Footer hook.
  ctx.font = `800 29px ${SHARE_FONT_STACK}`;
  ctx.fillStyle = theme.footer;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(input.footer, width / 2, footerY + 30);
}

/** Max row height. The podium used a roomier 170 when it held 3 rows; it now
 *  carries the same top 5 (+ you-row) as the daily card, so every board shares
 *  the 130 band. */
function band(_input: ShareLeaderboardInput): number {
  return 130;
}

// ──────────────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────────────

export async function generateShareImage(input: ShareImageInput): Promise<Blob | null> {
  resolveShareFontStack();
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* draw anyway */ }
  if (typeof document === 'undefined') return null;
  const isVertical =
    input.layout === 'daily-sweep' ||
    (input.layout !== 'leaderboard' && (input.mode === 'OctoWord' || input.mode === 'Gauntlet'));
  const width = 1080;
  const height = isVertical ? 1350 : 1080;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // The all-dailies card renders its own multi-mode header + rows + footer.
  if (input.layout === 'daily-sweep') {
    drawDailySweepCard(ctx, input, width, height);
    drawFooter(ctx, width, height);
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  }

  // The daily-leaderboard card renders its own header + rows + footer hook
  // (1080², all three variants).
  if (input.layout === 'leaderboard') {
    drawLeaderboardCard(ctx, input, width, height);
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  }

  // The profile/stats card renders its own header + tiles + footer (1080²).
  if (input.layout === 'profile') {
    drawProfileCard(ctx, input, width);
    drawFooter(ctx, width, height);
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  }

  // Header
  const { bottomY: headerBottom } = drawHeader(ctx, input, width);

  // Footer Y (top edge of footer region)
  const footerTop = height - 80;

  // Body
  if (input.layout === 'single') {
    drawSingle(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'multi') {
    drawMulti(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'gauntlet') {
    drawGauntlet(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'sudoku') {
    drawSudoku(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'regions') {
    drawRegions(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'ladder') {
    drawLadder(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'wordsearch') {
    drawWordsearch(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'hub') {
    drawHub(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'cryptogram') {
    drawCryptogram(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'groups') {
    drawGroups(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'crossword') {
    drawCrossword(ctx, input, width, headerBottom, footerTop);
  } else if (input.layout === 'scramble') {
    drawScramble(ctx, input, width, headerBottom, footerTop);
  }

  // Footer
  drawFooter(ctx, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}
