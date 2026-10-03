'use client';

import { GameStatus, type BoardState } from '@wordle-duel/core';
import { getTodayLocal } from './daily-service';
import { WIN_FG } from './tile-theme';
import { MODES } from './modes.generated';
import { boardToGrid, boardToLetters, MODE_SHARE_GLYPH } from './share-grid';
import {
  ART_SIZE, PAGE_TINTS, artSrc, gameArtSrc, gameTint, pageWall,
  type ArtName, type TintStops,
} from './art';
import {
  LEADERBOARD_SHARE_ART, TILE_GLOSS, fallbackSharePoints, gameShareArt, glossFrom,
  shareDayKey, shareInfoLine, shareStatWindows, shareSweepInfo,
  type GlossPalette,
} from './share-look';
import {
  ANSWER_CAPTION_H, BOARD_W, GROUPS_DOTS_H, HUB_RANK_H, MULTI_CHROME, PROFILE_HEAD_H, SCRAMBLE_DIVIDER_H,
  SHARE_SPACE, SHARE_W, TITLE_MAX_W,
  boardBlockHeight, cipherWordWidth, crosswordGeometry, cryptoGeometry, gridGeometry, groupsGeometry,
  hubGeometry, ladderGeometry, leaderboardPanelGeometry, multiDims, multiGeometry, planShareCard,
  profileGeometry, scrambleGeometry, singleCaptionH, squareSize, stackGeometry, titleBoxHeight,
  type GridGeometry, type SharePlan,
} from './share-fit';
import { shareHookLine } from './leaderboard-share';
import {
  canvasToPng, drawCastWordmark, drawDateLine, drawGlossTile, drawImageContain, drawInfoLine, drawSoftNumber,
  drawStatWindow, drawStatWindows, drawTileGlyph, drawWallpaper, fitFontPx, loadCastImages, loadShareImage,
  resolveCanvasFontStack, setLetterSpacing,
} from './share-canvas';
import { softMix } from './soft-surface';
// The grid helpers live in share-grid.ts so a game screen can use them without
// pulling this canvas renderer into its first-load JS (founder, 2026-09-29).
export { boardToGrid, boardToLetters, MODE_SHARE_GLYPH };


// next/font registers Nunito under a HASHED family applied to <body>; the
// literal "Nunito" never exists in document.fonts, so canvas silently drew
// every share card in the system fallback (founder caught the sharper
// letterforms on the leaderboard card, Aug 7). Resolved from the body's
// computed style at render time (lib/share-canvas.ts).
let SHARE_FONT_STACK = '"Nunito", system-ui, -apple-system, sans-serif';
function resolveShareFontStack(): void {
  SHARE_FONT_STACK = resolveCanvasFontStack();
}

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

import type { TileStateString } from './share-grid';
export type { TileStateString } from './share-grid';

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
  /** Optional headline override — the More Games Sweep card says "MORE GAMES SWEEP" /
   *  "FLAWLESS MORE GAMES" (founder, 2026-09-26) over the same tile layout. */
  title?: string;
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

/** Shareable profile / stats card (1080 wide, sized to its content: lib/share-fit.ts). */
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

/** Daily-leaderboard share card (1080 wide, sized to its rows): solo board, VS board, or
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
  /** Footer hook ("Can you beat them? Play free at wordocious.com"); the card draws it under the rows without the site part (shareHookLine). */
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


// ──────────────────────────────────────────────────────────────────────────
// Palette (matches the in-app tile + chip colors)
// ──────────────────────────────────────────────────────────────────────────

// The card's inks (FINISH_SPEC E1): dark purples on the wallpaper, never gray-on-white.
const BG = '#f3eeff';

// Per-mode accent, derived from the single-source mode catalog (keyed by title == ShareMode).
const MODE_ACCENT: Record<ShareMode, string> = Object.fromEntries(
  MODES.filter((m) => m.dbKey).map((m) => [m.title, m.accentHex]),
) as Record<ShareMode, string>;

const TEXT_DARK = '#2a1650';
const TEXT_MUTED = '#6f5f8f';

// Win / loss accents (WIN_FG comes from tile-theme, Royal violet).
const LOSS_FG = '#e11d48';

// The tinted panels behind a board (never white): lilac for a win, rose for a loss.
const PANEL_WIN = 'rgba(245, 238, 255, 0.86)';
const PANEL_LOSS = 'rgba(255, 236, 241, 0.86)';
const PANEL_WIN_LINE = 'rgba(124, 58, 237, 0.55)';
const PANEL_LOSS_LINE = 'rgba(225, 29, 72, 0.55)';

// Accent palettes the More Games boards draw their glossy cells in.
const GLOSS_DARK = glossFrom('#3b2a5c');
const GLOSS_VIOLET = glossFrom('#8b5cf6');

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

/** A tinted board panel (lilac win / rose loss) with its soft ring — the old white-bordered card. */
function drawResultPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, won: boolean, radius = 28): void {
  ctx.save();
  ctx.shadowColor = 'rgba(60, 30, 110, 0.14)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  drawRoundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = won ? PANEL_WIN : PANEL_LOSS;
  ctx.fill();
  ctx.restore();
  drawRoundRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = won ? PANEL_WIN_LINE : PANEL_LOSS_LINE;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** A glossy result tile (game kit): purple correct, gold present, slate absent, frosted empty. */
function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  state: TileStateString,
  letter?: string,
): void {
  const pal = state === 'EMPTY' ? null : TILE_GLOSS[state];
  const faceH = drawGlossTile(ctx, x, y, size, size, pal, { gloss: state === 'ABSENT' ? 0.3 : undefined });
  // "Full results" variant: glyph centered on the face. EMPTY tiles never
  // carry a letter (boardToLetters pads with ''), so this only fires on
  // evaluated rows.
  if (letter && state !== 'EMPTY') drawTileGlyph(ctx, letter, x, y, size, faceH);
}

/** A glossy cell in any palette (null = frosted) — the More Games boards. */
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pal: GlossPalette | null, radius?: number): number {
  return drawGlossTile(ctx, x, y, size, size, pal, { radius: radius ?? Math.max(5, size * 0.2) });
}

/**
 * Paint one board at `top`, centered on `centerX`, at the geometry the card's
 * layout measured (lib/share-fit.ts): an optional tinted panel (lilac win /
 * rose loss, soft ring; `won` null = no panel, the tiles sit right on the
 * wallpaper), the glossy tiles (no rim, no grid lines), and — revealing a
 * loss — the answer spelled out underneath.
 */
function drawBoardCard(
  ctx: CanvasRenderingContext2D,
  grid: TileStateString[][],
  centerX: number,
  top: number,
  geo: GridGeometry,
  chrome: number,
  won: boolean | null,
  wordGroups?: number[],
  reveal?: {
    /** Per-row letters matching `grid`; '' entries draw no glyph. */
    letters?: string[][];
    /** Answer text drawn under the board (lost boards only). */
    answerCaption?: string;
  },
): void {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return;
  const { tile, gap, groupGap } = geo;
  const inset = chrome / 2;
  const boardW = geo.gridW + chrome;
  const boardH = geo.gridH + chrome;
  const x = centerX - boardW / 2;
  if (won !== null) drawResultPanel(ctx, x, top, boardW, boardH, won, 18);

  // ProperNoundle multi-word answers keep a tile-wide break between names
  // (founder: "Why are we having so much trouble with this?").
  const groups = wordGroups && wordGroups.length > 1 ? wordGroups : null;
  const xOffsets: number[] = new Array(cols);
  if (groups) {
    let colCursor = 0;
    let gx = 0;
    for (let g = 0; g < groups.length; g++) {
      for (let i = 0; i < groups[g] && colCursor < cols; i++) {
        xOffsets[colCursor] = gx;
        gx += tile + gap;
        colCursor++;
      }
      if (g < groups.length - 1) gx += groupGap - gap;
    }
    for (; colCursor < cols; colCursor++) {
      xOffsets[colCursor] = colCursor === 0 ? 0 : xOffsets[colCursor - 1] + tile + gap;
    }
  } else {
    for (let c = 0; c < cols; c++) xOffsets[c] = c * (tile + gap);
  }

  const x0 = x + inset;
  const y0 = top + inset;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(ctx, x0 + xOffsets[c], y0 + r * (tile + gap), tile, grid[r][c], reveal?.letters?.[r]?.[c]);
    }
  }

  // Revealed loss: the answer never appears in the tiles, so spell it out
  // under the board — same treatment as the completed-puzzle page.
  if (reveal?.answerCaption) {
    ctx.save();
    ctx.font = `900 ${Math.min(30, Math.max(16, Math.floor(tile * 0.6)))}px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = LOSS_FG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowOffsetY = 2;
    ctx.fillText(reveal.answerCaption.toUpperCase(), centerX, top + boardH + ANSWER_CAPTION_H / 2 + 2);
    ctx.restore();
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ──────────────────────────────────────────────────────────────────────────
// The finishing look (docs/FINISH_SPEC.md E1, S2, S3): the wallpaper behind
// the card, the game's title art (~70% wide), ONE compact info line with a
// W / L badge, the board block (~88% wide), three tinted stat windows, and the
// cast wordmark over "wordocious.com". The canvas is exactly as tall as that
// stack (lib/share-fit.ts planShareCard, clamped 4:5 … 9:16). Every image is
// optional: when one fails to load (offline, slow) the card draws its plain
// fallback in that spot.
// ──────────────────────────────────────────────────────────────────────────

/** Card side padding (stat windows, rows panels). */
const CARD_PAD = 64;

/** The board block's box on the card (content + any slack): draw centered in it. */
interface Box {
  top: number;
  h: number;
}

interface ShareArt {
  wall: HTMLImageElement | null;
  /** Title art (game title, page title or moment lettering). */
  title: HTMLImageElement | null;
  titleName: ArtName | null;
  /** Sweep rows: each game's glossy icon by mode title (null where one failed). */
  icons: Map<string, HTMLImageElement | null>;
}

async function loadShareArt(opts: {
  wall: string;
  title: ArtName | null;
  icons?: string[];
}): Promise<ShareArt> {
  const iconModes = opts.icons ?? [];
  const iconSrc = (mode: string) => gameArtSrc(MODES.find((m) => m.title === mode)?.id);
  const [wall, title, ...icons] = await Promise.all([
    loadShareImage([artSrc(opts.wall)]),
    opts.title ? loadShareImage([artSrc(opts.title)]) : Promise.resolve(null),
    ...iconModes.map((m) => {
      const src = iconSrc(m);
      return src ? loadShareImage([src]) : Promise.resolve(null);
    }),
  ]);
  return {
    wall,
    title,
    titleName: opts.title,
    icons: new Map(iconModes.map((m, i) => [m, icons[i] ?? null])),
  };
}

/** The loaded title art's own size (ART_SIZE only when the browser doesn't report one); null = no art. */
function titleNatural(art: ShareArt): readonly [number, number] | null {
  if (!art.title || !art.titleName) return null;
  return art.title.naturalWidth && art.title.naturalHeight
    ? [art.title.naturalWidth, art.title.naturalHeight]
    : ART_SIZE[art.titleName];
}

/**
 * The card's title in its `boxH` slot at `top`: the art fit inside ~70% of the
 * width, or — when it didn't load — the name lettered in its accent (or a
 * 2-stop gradient) with a white edge.
 */
function drawCardTitle(
  ctx: CanvasRenderingContext2D,
  art: ShareArt,
  width: number,
  top: number,
  boxH: number,
  fallbackText: string,
  fallbackColor: string | readonly [string, string],
): void {
  const nat = titleNatural(art);
  if (art.title && nat) {
    drawImageContain(ctx, art.title, width / 2, top, TITLE_MAX_W, boxH, nat);
    return;
  }
  const px = fitFontPx(ctx, fallbackText, Math.min(76, Math.round(boxH * 0.8)), TITLE_MAX_W + 120);
  ctx.save();
  ctx.font = `900 ${px}px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const baseY = top + boxH / 2 + px * 0.36;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(6, px * 0.14);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeText(fallbackText, width / 2, baseY);
  if (typeof fallbackColor === 'string') {
    ctx.fillStyle = fallbackColor;
  } else {
    const w = ctx.measureText(fallbackText).width;
    const g = ctx.createLinearGradient(width / 2 - w / 2, 0, width / 2 + w / 2, 0);
    g.addColorStop(0, fallbackColor[0]);
    g.addColorStop(1, fallbackColor[1]);
    ctx.fillStyle = g;
  }
  ctx.fillText(fallbackText, width / 2, baseY);
  ctx.restore();
}

const MODE_DISPLAY: Partial<Record<ShareMode, string>> = {
  Six: 'CLASSIC SIX',
  Seven: 'CLASSIC SEVEN',
};

/** The three tinted windows (purple guesses · blue time · gold points) in the foot slot. */
function drawCardStats(ctx: CanvasRenderingContext2D, input: ShareImageInput, width: number, top: number, points: number | null): void {
  drawStatWindows(ctx, shareStatWindows(input, points), CARD_PAD, top, width - CARD_PAD * 2, SHARE_SPACE.stats);
}

// ──────────────────────────────────────────────────────────────────────────
// Board-area drawing per layout (geometry from lib/share-fit.ts, the same
// math that sized the card; each board centers in its box)
// ──────────────────────────────────────────────────────────────────────────

function drawSingle(ctx: CanvasRenderingContext2D, input: ShareSingleInput, width: number, box: Box): void {
  const rows = input.grid.length;
  const cols = input.grid[0]?.length ?? 0;
  if (!rows || !cols) return;
  // Single-board modes (FINISH_SPEC E1/S2): big glossy tiles right on the
  // wallpaper, no panel — the guesses window says X/6 on a loss.
  const geo = gridGeometry(rows, cols, BOARD_W, box.h, { gap: 10, groups: input.wordGroups, captionH: singleCaptionH(input) });
  const reveal = input.reveal
    ? { letters: input.letters, answerCaption: !input.won ? input.solutionDisplay : undefined }
    : undefined;
  drawBoardCard(ctx, input.grid, width / 2, box.top + (box.h - geo.h) / 2, geo, 0, null, input.wordGroups, reveal);
}

// Sudoku (More Games §18d): the 9 × 9 as glossy squares — givens dark, the
// player's correct digits purple, hint cells violet, everything else frosted —
// inside the tinted win/loss panel. No digits, so the card spoils nothing.
function drawSudoku(ctx: CanvasRenderingContext2D, input: ShareSudokuInput, width: number, box: Box): void {
  const size = squareSize(BOARD_W, box.h);
  const cardPad = Math.round(size * 0.022);
  const gap = Math.max(3, Math.round(size * 0.006));
  const boxGap = gap * 3;
  const inner = size - cardPad * 2;
  const cell = (inner - gap * 6 - boxGap * 2) / 9;
  const x0 = (width - size) / 2, y0 = box.top + (box.h - size) / 2;
  ctx.save();
  drawResultPanel(ctx, x0, y0, size, size, input.won);
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const x = x0 + cardPad + c * (cell + gap) + Math.floor(c / 3) * (boxGap - gap);
    const y = y0 + cardPad + r * (cell + gap) + Math.floor(r / 3) * (boxGap - gap);
    const given = input.givens[i] !== '0';
    const filled = input.board[i] !== '0';
    const hinted = input.hintMask[i] === '1';
    drawCell(ctx, x, y, cell, given ? GLOSS_DARK : hinted ? GLOSS_VIOLET : filled ? TILE_GLOSS.CORRECT : null);
  }
  ctx.restore();
}

// Starsweep (More Games §18d): the regions as tinted glossy squares, the placed
// stars as dark dots (hint stars violet), nothing else — no crosses and never
// the missing stars, so the card spoils nothing and invites a try.
const REGIONS_SHARE_TINTS = ['#ede9fe', '#d1fae5', '#e0f2fe', '#fce7f3', '#fef9c3', '#ccfbf1', '#ffedd5', '#ecfccb', '#e2e8f0'];
const REGIONS_GLOSS = REGIONS_SHARE_TINTS.map((t) => glossFrom(t));
function drawRegions(ctx: CanvasRenderingContext2D, input: ShareRegionsInput, width: number, box: Box): void {
  const n = Math.max(1, input.n);
  const size = squareSize(BOARD_W, box.h);
  const cardPad = Math.round(size * 0.022);
  const gap = Math.max(3, Math.round(size * 0.006));
  const inner = size - cardPad * 2;
  const cell = (inner - gap * (n - 1)) / n;
  const x0 = (width - size) / 2, y0 = box.top + (box.h - size) / 2;
  ctx.save();
  drawResultPanel(ctx, x0, y0, size, size, input.won);
  const HINTC = '#8b5cf6';
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const x = x0 + cardPad + c * (cell + gap);
    const y = y0 + cardPad + r * (cell + gap);
    const g = (input.regions.charCodeAt(i) || 48) - 48;
    const faceH = drawCell(ctx, x, y, cell, REGIONS_GLOSS[g % REGIONS_GLOSS.length]);
    if (input.board[i] === '*') {
      ctx.fillStyle = input.hintMask[i] === '1' ? HINTC : '#3b1a78';
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + faceH / 2, cell * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Letter Ladder (More Games §18d): START and END spelled out as filled tiles,
// every rung between them blank except the changed position (accent; violet
// for a hint rung). Spoils no rung word. Tall ladders scale by height.
const LADDER_GLOSS = glossFrom('#0284c7');
function drawLadder(ctx: CanvasRenderingContext2D, input: ShareLadderInput, width: number, box: Box): void {
  const words = input.words.length ? input.words : [input.start];
  const rows: Array<{ word: string; prev?: string; kind: 'start' | 'rung' | 'hint' | 'end' }> = [];
  words.forEach((w, i) => rows.push({ word: w, prev: i > 0 ? words[i - 1] : undefined, kind: i === 0 ? 'start' : input.hintMask[i] === '1' ? 'hint' : 'rung' }));
  if (words[words.length - 1] !== input.end) rows.push({ word: input.end, kind: 'end' });
  const cols = Math.max(input.start.length, input.end.length, 3);
  const geo = ladderGeometry(rows.length, cols, BOARD_W, box.h);
  const { tile, gap } = geo;
  const x0 = (width - geo.gridW) / 2, y0 = box.top + (box.h - geo.h) / 2;
  const ACCENT = '#0284c7', END_BORDER = '#0284c7aa';
  ctx.save();
  rows.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * (tile + gap), y = y0 + r * (tile + gap);
      const changed = !!row.prev && row.prev[c] !== row.word[c];
      const radius = Math.max(6, tile * 0.14);
      if (row.kind === 'start') {
        const faceH = drawCell(ctx, x, y, tile, TILE_GLOSS.CORRECT, radius);
        drawTileGlyph(ctx, row.word[c] ?? '', x, y, tile, faceH);
      } else if (row.kind === 'end') {
        const faceH = drawCell(ctx, x, y, tile, null, radius);
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]); ctx.strokeStyle = END_BORDER; drawRoundRect(ctx, x + 1.5, y + 1.5, tile - 3, faceH - 3, radius); ctx.stroke(); ctx.setLineDash([]);
        drawTileGlyph(ctx, row.word[c] ?? '', x, y, tile, faceH, ACCENT);
      } else if (changed) {
        drawCell(ctx, x, y, tile, row.kind === 'hint' ? GLOSS_VIOLET : LADDER_GLOSS, radius);
      } else {
        drawCell(ctx, x, y, tile, null, radius);
      }
    }
  });
  ctx.restore();
}

// Spyglass (More Games §18d): a dot grid with the found words as accent
// capsules laid along their lines. No letters, so the card spoils nothing.
const WORDSEARCH_DIR_DELTAS: Record<string, [number, number]> = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1], W: [0, -1], N: [-1, 0], NW: [-1, -1], SW: [1, -1] };
function drawWordsearch(ctx: CanvasRenderingContext2D, input: ShareWordsearchInput, width: number, box: Box): void {
  const n = Math.max(1, input.n);
  const size = squareSize(BOARD_W, box.h);
  const cardPad = Math.round(size * 0.03);
  const inner = size - cardPad * 2;
  const cell = inner / n;
  const x0 = (width - size) / 2, y0 = box.top + (box.h - size) / 2;
  ctx.save();
  drawResultPanel(ctx, x0, y0, size, size, input.won);
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

// Muddle (More Games §18d): four rows of frosted tiles (circled positions
// ringed), a divider, then the punchline row grouped by word in the lilac
// tint. No letters, no cartoon.
const SCRAMBLE_LILAC = glossFrom('#e9ddff');
function drawScramble(ctx: CanvasRenderingContext2D, input: ShareScrambleInput, width: number, box: Box): void {
  const DIVIDER = 'rgba(124, 58, 237, 0.28)', RING = '#7c3aed';
  const geo = scrambleGeometry(input.words, input.pattern, BOARD_W, box.h);
  const { tile, gap, rowGap, small, smallGap, wordGap, cols } = geo;
  const boardW = cols * tile + (cols - 1) * gap;
  const x0 = (width - boardW) / 2;
  let y = box.top + (box.h - geo.h) / 2;
  ctx.save();
  for (const w of input.words) {
    for (let i = 0; i < w.length; i++) {
      const x = x0 + i * (tile + gap);
      const faceH = drawCell(ctx, x, y, tile, null);
      if (w.circled.includes(i)) {
        ctx.strokeStyle = RING; ctx.lineWidth = Math.max(3, tile * 0.05);
        ctx.beginPath(); ctx.arc(x + tile / 2, y + faceH / 2, tile * 0.34, 0, Math.PI * 2); ctx.stroke();
      }
    }
    y += tile + rowGap;
  }
  // divider
  y += 6;
  ctx.strokeStyle = DIVIDER; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + boardW, y); ctx.stroke();
  y += SCRAMBLE_DIVIDER_H - 6;
  const totalLetters = input.pattern.reduce((a, b) => a + b, 0);
  const rowW = totalLetters * small + (totalLetters - input.pattern.length) * smallGap + Math.max(0, input.pattern.length - 1) * wordGap;
  let x = (width - rowW) / 2;
  for (const len of input.pattern) {
    for (let i = 0; i < len; i++) {
      const faceH = drawCell(ctx, x, y, small, SCRAMBLE_LILAC);
      ctx.strokeStyle = RING; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + small / 2, y + faceH / 2, small * 0.32, 0, Math.PI * 2); ctx.stroke();
      x += small + smallGap;
    }
    x += wordGap - smallGap;
  }
  ctx.restore();
}

// Crosswordocious (More Games §18d): the grid silhouette — glossy lilac tiles
// where the letters are, nothing where the blocks are, no letters, no numbers.
function drawCrossword(ctx: CanvasRenderingContext2D, input: ShareCrosswordInput, width: number, box: Box): void {
  const FILL = glossFrom('#c4b5fd');
  const geo = crosswordGeometry(input.w, input.h, BOARD_W, box.h);
  const { tile, gap } = geo;
  const x0 = (width - geo.gridW) / 2, y0 = box.top + (box.h - geo.h) / 2;
  ctx.save();
  for (let r = 0; r < input.h; r++) for (let c = 0; c < input.w; c++) {
    if (input.solution[r * input.w + c] === '.') continue;
    drawCell(ctx, x0 + c * (tile + gap), y0 + r * (tile + gap), tile, FILL);
  }
  ctx.restore();
}

// Kindred (More Games §18d): four glossy tier bars in solve order with pips,
// unsolved tiers dashed beneath on a loss, then the mistake dots. No words.
const GROUPS_TIER_FILL: Record<number, [string, string]> = { 1: ['#ddd6fe', '#3b0764'], 2: ['#a78bfa', '#1a1a2e'], 3: ['#7c3aed', '#ffffff'], 4: ['#1a1a2e', '#ffffff'] };
function drawGroups(ctx: CanvasRenderingContext2D, input: ShareGroupsInput, width: number, box: Box): void {
  const ACCENT = '#9f1239', DOT_OFF = 'rgba(159, 18, 57, 0.18)';
  const tiers = [...input.solvedTiers, ...[1, 2, 3, 4].filter((t) => !input.solvedTiers.includes(t))];
  const geo = groupsGeometry(tiers.length, box.h);
  const { barH, gap } = geo;
  const barW = BOARD_W;
  const x0 = (width - barW) / 2;
  let y = box.top + (box.h - geo.h) / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  tiers.forEach((t) => {
    const solved = input.solvedTiers.includes(t);
    const [bg, fg] = GROUPS_TIER_FILL[t];
    const radius = Math.min(26, barH * 0.24);
    if (solved) {
      drawGlossTile(ctx, x0, y, barW, barH, glossFrom(bg), { radius });
    } else {
      ctx.setLineDash([12, 10]); ctx.lineWidth = 4; ctx.strokeStyle = bg; drawRoundRect(ctx, x0, y, barW, barH, radius); ctx.stroke(); ctx.setLineDash([]);
    }
    // pips, centered
    const pipR = Math.max(7, Math.round(barH * 0.1)), pipGap = pipR * 1.5, pipsW = t * pipR * 2 + (t - 1) * pipGap;
    let px = width / 2 - pipsW / 2 + pipR;
    ctx.fillStyle = solved ? fg : bg;
    for (let i = 0; i < t; i++) { ctx.beginPath(); ctx.arc(px, y + barH / 2, pipR, 0, Math.PI * 2); ctx.fill(); px += pipR * 2 + pipGap; }
    y += barH + gap;
  });
  // mistake dots
  y += 24 - gap;
  const dotsH = GROUPS_DOTS_H - 24;
  const dotR = 14, dotGap = 26, n = input.maxMistakes, dotsW = n * dotR * 2 + (n - 1) * dotGap;
  let dx = width / 2 - dotsW / 2 + dotR;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < n - input.mistakes ? ACCENT : DOT_OFF;
    ctx.beginPath(); ctx.arc(dx, y + dotsH / 2, dotR, 0, Math.PI * 2); ctx.fill();
    dx += dotR * 2 + dotGap;
  }
  ctx.restore();
}

// Codebreaker (More Games §18d): the ciphertext as rows of frosted cells with
// the code letter beneath each, words wrapped whole. No plain letters.
function drawCryptogram(ctx: CanvasRenderingContext2D, input: ShareCryptogramInput, width: number, box: Box): void {
  const ACCENT = '#92400e', CODE = '#6f5f8f';
  const geo = cryptoGeometry(input.cipher, BOARD_W, box.h);
  const { cell, gap, wordGap, rowH, codeH, rowGap, rows } = geo;
  let y = box.top + (box.h - geo.h) / 2;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const row of rows) {
    const rowW = row.reduce((a, w) => a + cipherWordWidth(w, cell, gap), 0) + wordGap * (row.length - 1);
    let x = (width - rowW) / 2;
    for (const w of row) {
      for (const ch of w) {
        if (/[A-Z]/.test(ch)) {
          drawCell(ctx, x, y, cell, null);
          ctx.fillStyle = CODE; ctx.font = `800 ${Math.floor(cell * 0.36)}px ui-monospace, Menlo, monospace`;
          ctx.fillText(ch, x + cell / 2, y + cell + codeH / 2);
          x += cell + gap;
        } else {
          ctx.fillStyle = ACCENT; ctx.font = `900 ${Math.floor(cell * 0.6)}px ${SHARE_FONT_STACK}`;
          ctx.fillText(ch, x + cell * 0.22, y + cell / 2 + 2);
          x += cell * 0.45;
        }
      }
      x += wordGap - gap;
    }
    y += rowH + rowGap;
  }
  ctx.restore();
}

// Hubbub (More Games §18d): the 2-3-2 cluster as frosted tiles with the center
// filled in the accent, the rank name large beneath. No letters.
function drawHub(ctx: CanvasRenderingContext2D, input: ShareHubInput, width: number, box: Box): void {
  const ACCENT = '#c026d3';
  const geo = hubGeometry(BOARD_W, box.h);
  const { tile, gap, clusterH } = geo;
  const cx = width / 2;
  const y0 = box.top + (box.h - geo.h) / 2;
  const rows: Array<Array<'o' | 'c'>> = [['o', 'o'], ['o', 'c', 'o'], ['o', 'o']];
  ctx.save();
  rows.forEach((row, r) => {
    const rowW = row.length * tile + (row.length - 1) * gap;
    row.forEach((kind, i) => {
      const x = cx - rowW / 2 + i * (tile + gap), y = y0 + r * (tile + gap);
      drawCell(ctx, x, y, tile, kind === 'c' ? glossFrom(ACCENT) : null);
    });
  });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${fitFontPx(ctx, input.rankName.toUpperCase(), 64, BOARD_W, 28)}px ${SHARE_FONT_STACK}`; ctx.fillStyle = ACCENT;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.85)'; ctx.shadowOffsetY = 2;
  ctx.fillText(input.rankName.toUpperCase(), cx, y0 + clusterH + HUB_RANK_H - 22);
  ctx.restore();
}

// QuadWord / OctoWord (S2): a tight grid of equal boards — 4 boards always a
// 2 × 2, 8 boards 4 × 2 or 2 × 4 (whichever draws bigger tiles), boards ~4% of
// the width apart, the whole block scaled by height when it is tall.
function drawMulti(ctx: CanvasRenderingContext2D, input: ShareMultiInput, width: number, box: Box): void {
  const n = input.boards.length;
  if (!n || !input.boards[0].grid.length) return;
  const dims = multiDims(input.boards);
  const geo = multiGeometry(n, dims.rows, dims.cols, BOARD_W, box.h, input.reveal ? ANSWER_CAPTION_H : 0);
  const startX = (width - geo.w) / 2;
  const startY = box.top + (box.h - geo.h) / 2;
  for (let i = 0; i < n; i++) {
    const col = i % geo.cols;
    const row = Math.floor(i / geo.cols);
    const board = input.boards[i];
    const cx = startX + col * (geo.board.w + geo.boardGap) + geo.board.w / 2;
    const top = startY + row * (geo.board.h + geo.boardGap);
    const reveal = input.reveal
      ? { letters: board.letters, answerCaption: !board.won ? board.solution : undefined }
      : undefined;
    drawBoardCard(ctx, board.grid, cx, top, geo.board, MULTI_CHROME, board.won, undefined, reveal);
  }
}

// Gauntlet: the stage stack — one tinted window per stage (lilac cleared /
// rose failed) with its number, name, boards + guesses, and a glossy check or
// cross. Scales by height so all five fit the 9:16 clamp.
function drawGauntlet(ctx: CanvasRenderingContext2D, input: ShareGauntletInput, width: number, box: Box): void {
  const n = input.stages.length;
  if (!n) return;
  const geo = stackGeometry(n, box.h, 118, 18, 56);
  const chipH = geo.rowH;
  const areaW = BOARD_W;
  const x0 = (width - areaW) / 2;
  const y0 = box.top + (box.h - geo.h) / 2;
  const k = chipH / 118;
  for (let i = 0; i < n; i++) {
    const stage = input.stages[i];
    const chipY = y0 + i * (chipH + geo.gap);
    const won = stage.status === GameStatus.WON;
    drawResultPanel(ctx, x0, chipY, areaW, chipH, won, Math.min(28, chipH * 0.26));
    const midY = chipY + chipH / 2;

    // Stage number as a soft number.
    drawSoftNumber(ctx, `${i + 1}`, x0 + 56 * Math.max(0.8, k), midY, Math.round(46 * k));

    // Stage name + stats.
    const textX = x0 + 110 * Math.max(0.8, k);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(34 * k)}px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_DARK;
    ctx.fillText(stage.name, textX, midY - 16 * k);
    ctx.font = `800 ${Math.round(24 * k)}px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = won ? WIN_FG : LOSS_FG;
    ctx.fillText(`${stage.boardsSolved}/${stage.totalBoards} boards · ${stage.guesses} guesses`, textX, midY + 20 * k);
    ctx.restore();

    // Glossy check / cross at right.
    const mark = Math.round(Math.min(64, chipH * 0.56));
    drawResultMark(ctx, won, x0 + areaW - 34 - mark / 2, midY, mark);
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
 * ProperNoundle=crown, and the More Games titles per MODE_CHROME). Returns false
 * for the numeral modes (QuadWord/OctoWord/Six/Seven) so the caller draws the
 * glyph instead. Paths copied verbatim from lucide-react@0.446 so they match
 * the on-screen icons exactly.
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
  // lucide <rect rx> and <polygon> equivalents, for the More Games cases below.
  const strokeRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  };
  const strokePolygon = (pts: number[][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
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
    // More Games titles (founder, 2026-09-28: the Sweep card drew letters for
    // them) — the same lucide art MODE_CHROME gives each card, keyed by title.
    case 'Muddle':   // SCRAMBLE → shuffle
      lucide(() => {
        strokePath('M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22');
        strokePath('m18 2 4 4-4 4');
        strokePath('M2 6h1.9c1.5 0 2.9.9 3.6 2.2');
        strokePath('M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8');
        strokePath('m18 14 4 4-4 4');
      });
      break;
    case 'Hubbub':   // HUB → hexagon
      lucide(() =>
        strokePath('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'),
      );
      break;
    case 'Crosswordocious':   // CROSSWORD → quote
      lucide(() => {
        strokePath('M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z');
        strokePath('M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z');
      });
      break;
    case 'Kindred':   // GROUPS → group
      lucide(() => {
        strokePath('M3 7V5c0-1.1.9-2 2-2h2');
        strokePath('M17 3h2c1.1 0 2 .9 2 2v2');
        strokePath('M21 17v2c0 1.1-.9 2-2 2h-2');
        strokePath('M7 21H5c-1.1 0-2-.9-2-2v-2');
        strokeRoundRect(7, 7, 7, 5, 1);
        strokeRoundRect(10, 12, 7, 5, 1);
      });
      break;
    case 'Letter Ladder':   // LADDER → the project's LadderIcon (two rails, three rungs)
      lucide(() => {
        strokePath('M7 3v18');
        strokePath('M17 3v18');
        strokePath('M7 8h10');
        strokePath('M7 13h10');
        strokePath('M7 18h10');
      });
      break;
    case 'Codebreaker':   // CRYPTOGRAM → key-round
      lucide(() => {
        strokePath('M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z');
        // lucide fills this dot with currentColor as well as stroking it.
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(16.5, 7.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      break;
    case 'Spyglass':   // WORDSEARCH → text-search
      lucide(() => {
        strokePath('M21 6H3');
        strokePath('M10 12H3');
        strokePath('M10 18H3');
        strokeCircle(17, 15, 3);
        strokePath('m21 19-1.9-1.9');
      });
      break;
    case 'Sudocious':   // SUDOKU → grid-3x3
      lucide(() => {
        strokeRoundRect(3, 3, 18, 18, 2);
        strokePath('M3 9h18');
        strokePath('M3 15h18');
        strokePath('M9 3v18');
        strokePath('M15 3v18');
      });
      break;
    case 'Starsweep':   // REGIONS → star
      lucide(() => {
        strokePolygon([[12, 2], [15.09, 8.26], [22, 9.27], [17, 14.14], [18.18, 21.02], [12, 17.77], [5.82, 21.02], [7, 14.14], [2, 9.27], [8.91, 8.26]]);
      });
      break;
    default:
      drew = false;
  }
  ctx.restore();
  return drew;
}

/** The profile card body: username, level line, 2 × 3 tinted stat tiles in the player's accent. */
function drawProfileCard(ctx: CanvasRenderingContext2D, input: ShareProfileInput, width: number, box: Box): void {
  const cx = width / 2;
  const accent = input.accentHex;
  const geo = profileGeometry(box.h);
  const top = box.top + (box.h - geo.h) / 2;

  // Username in the player's accent with a white edge so any accent reads on the wallpaper.
  const nameY = top + 70;
  const namePx = fitFontPx(ctx, input.username, 72, width - CARD_PAD * 2, 36);
  ctx.save();
  ctx.font = `900 ${namePx}px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeText(input.username, cx, nameY);
  ctx.fillStyle = accent;
  ctx.fillText(input.username, cx, nameY);
  ctx.restore();

  // Level · tier
  drawDateLine(ctx, `LEVEL ${input.level} · ${input.tier}`.toUpperCase(), cx, nameY + 46, 26);

  // Stat tiles (2 × 3): tinted soft cards in the accent with its top bar, soft numbers.
  const tiles: Array<{ v: string; l: string }> = [
    { v: `${input.totalWins}`, l: 'TOTAL WINS' },
    { v: `${Math.round(input.winRate)}%`, l: 'WIN RATE' },
    { v: `${input.currentStreak}`, l: 'WIN STREAK' },
    { v: `${input.dailyStreak}`, l: 'DAILY STREAK' },
    { v: `${input.gold} · ${input.silver} · ${input.bronze}`, l: 'MEDALS (G·S·B)' },
    { v: `${input.achievementsUnlocked}/${input.achievementsTotal}`, l: 'ACHIEVEMENTS' },
  ];
  const tilesTop = top + PROFILE_HEAD_H;
  const tileW = (width - CARD_PAD * 2 - geo.gap) / 2;
  const tone = {
    tint: softMix(accent, 0.13),
    line: softMix(accent, 0.32),
    bar: [accent, softMix('#ffffff', 0.3, accent)] as const,
    label: TEXT_MUTED,
  };
  tiles.forEach((t, i) => {
    const x = CARD_PAD + (i % 2) * (tileW + geo.gap);
    const y = tilesTop + Math.floor(i / 2) * (geo.tileH + geo.gap);
    drawStatWindow(ctx, { value: t.v, label: t.l, tone: 'purple' }, x, y, tileW, geo.tileH, { tone, numberPx: Math.round(geo.tileH * 0.4) });
  });
}

/** Sweep row / Gauntlet stage mark: a glossy purple check (won) or a rose cross. */
function drawResultMark(ctx: CanvasRenderingContext2D, won: boolean, cx: number, cy: number, size: number): void {
  const pal = won ? TILE_GLOSS.CORRECT : SWEEP_LOSS_GLOSS;
  const faceH = drawGlossTile(ctx, cx - size / 2, cy - size / 2, size, size, pal, { radius: size / 2 });
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(4, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fy = cy - size / 2 + faceH / 2;
  const k = size * 0.2;
  ctx.beginPath();
  if (won) {
    ctx.moveTo(cx - k, fy);
    ctx.lineTo(cx - k * 0.25, fy + k * 0.75);
    ctx.lineTo(cx + k * 1.05, fy - k * 0.7);
  } else {
    ctx.moveTo(cx - k * 0.8, fy - k * 0.8); ctx.lineTo(cx + k * 0.8, fy + k * 0.8);
    ctx.moveTo(cx + k * 0.8, fy - k * 0.8); ctx.lineTo(cx - k * 0.8, fy + k * 0.8);
  }
  ctx.stroke();
  ctx.restore();
}
const SWEEP_LOSS_GLOSS = glossFrom('#f43f5e');

/** The all-dailies card's rows — one tinted soft card per daily game, in the game's accent. */
function drawDailySweepRows(ctx: CanvasRenderingContext2D, input: ShareDailySweepInput, width: number, box: Box, art: ShareArt): void {
  const n = input.games.length;
  if (!n) return;
  const areaWidth = BOARD_W;
  const horizontalPad = (width - areaWidth) / 2;
  const geo = stackGeometry(n, box.h, 112, n > 8 ? 12 : 16, 48);
  const rowH = geo.rowH;
  const y0 = box.top + (box.h - geo.h) / 2;

  for (let i = 0; i < n; i++) {
    const g = input.games[i];
    const rowY = y0 + i * (rowH + geo.gap);
    const accent = MODE_ACCENT[g.mode] ?? '#7c3aed';

    ctx.save();
    ctx.shadowColor = 'rgba(60, 30, 110, 0.12)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    drawRoundRect(ctx, horizontalPad, rowY, areaWidth, rowH, 22);
    ctx.fillStyle = softMix(accent, 0.13);
    ctx.fill();
    ctx.restore();
    // The game-card bar down the left edge.
    ctx.save();
    drawRoundRect(ctx, horizontalPad, rowY, areaWidth, rowH, 22);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(horizontalPad, rowY, 10, rowH);
    ctx.restore();
    drawRoundRect(ctx, horizontalPad + 1.5, rowY + 1.5, areaWidth - 3, rowH - 3, 21);
    ctx.strokeStyle = softMix(accent, 0.32);
    ctx.lineWidth = 3;
    ctx.stroke();

    // The game's glossy icon, or the accent badge with its lucide glyph.
    const badge = Math.min(rowH - 18, 80);
    const badgeX = horizontalPad + 26;
    const badgeY = rowY + (rowH - badge) / 2;
    const icon = art.icons.get(g.mode) ?? null;
    if (icon) {
      drawImageContain(ctx, icon, badgeX + badge / 2, badgeY, badge, badge);
    } else {
      const faceH = drawGlossTile(ctx, badgeX, badgeY, badge, badge, glossFrom(accent), { radius: badge * 0.26 });
      if (!drawSweepBadgeIcon(ctx, g.mode, badgeX + badge / 2, badgeY + faceH / 2, badge * 0.56)) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${MODE_SHARE_GLYPH[g.mode].length >= 3 ? 24 : 30}px ${SHARE_FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(MODE_SHARE_GLYPH[g.mode], badgeX + badge / 2, badgeY + faceH / 2 + 1);
      }
    }

    const textX = badgeX + badge + 22;
    const twoLine = rowH >= 64;
    const nameW = areaWidth - (textX - horizontalPad) - rowH;
    ctx.font = `900 ${Math.min(34, Math.round(rowH * 0.34))}px ${SHARE_FONT_STACK}`;
    ctx.fillStyle = TEXT_DARK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(clampText(ctx, g.modeLabel, nameW), textX, twoLine ? rowY + rowH / 2 - rowH * 0.15 : rowY + rowH / 2);
    if (twoLine) {
      ctx.font = `800 ${Math.min(24, Math.round(rowH * 0.24))}px ${SHARE_FONT_STACK}`;
      ctx.fillStyle = TEXT_MUTED;
      const guessDisp = g.won ? `${g.guesses}g` : 'X';
      ctx.fillText(`${guessDisp} · ${formatTime(g.timeSeconds)} · ${g.score.toLocaleString('en-US')} pts`, textX, rowY + rowH / 2 + rowH * 0.2);
    }

    const mark = Math.min(rowH - 26, 56);
    drawResultMark(ctx, g.won, horizontalPad + areaWidth - 24 - mark / 2, rowY + rowH / 2, mark);
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
  drawSoftNumber(ctx, row.scoreDisplay, rightX, row.subline ? midY - 13 : midY, 34, 'right');
  ctx.font = `900 34px ${SHARE_FONT_STACK}`;
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
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.25)';
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
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 26, y + h);
    ctx.lineTo(x + w - 26, y + h);
    ctx.stroke();
  }
}


/** The leaderboard card's head: the letterspaced variant label over the mode + date chips. */
const LB_LABEL_H = 48;
const LB_CHIP_H = 54;
const LB_HEAD_H = LB_LABEL_H + 16 + LB_CHIP_H;
/** The hook line under the rows panel ("Can you beat them?"). */
const LB_HOOK_H = 44;

function drawLeaderboardCard(
  ctx: CanvasRenderingContext2D,
  input: ShareLeaderboardInput,
  width: number,
  plan: SharePlan,
  hook: string,
): void {
  const theme = LB_THEME[input.variant];

  // Letterspaced variant label (white highlight so it reads on the wallpaper).
  const labelY = plan.headTop + 36;
  ctx.save();
  setLetterSpacing(ctx, 8);
  ctx.font = `900 34px ${SHARE_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = theme.label;
  ctx.fillText(LB_LABEL[input.variant], width / 2, labelY);
  ctx.restore();

  // Chips: mode (accent bg; swords glyph on the VS variant) + date/puzzle.
  const chipH = LB_CHIP_H;
  const chipY = plan.headTop + LB_LABEL_H + 16;
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
  ctx.fillStyle = theme.bg;
  ctx.fill();
  ctx.strokeStyle = theme.panelBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = chipFont;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(input.dateChip, chipX + 22, chipY + chipH / 2 + 1);

  // Rows panel — sized to its content (lib/share-fit.ts), centered in its box.
  const panelX = CARD_PAD;
  const panelW = width - panelX * 2;
  const geo = leaderboardPanelGeometry(input, plan.boardH);
  if (geo.nRows) {
    const { rowH, dividerH, pad } = geo;
    const contentH = geo.h;
    const panelTop = plan.boardTop + (plan.boardH - contentH) / 2;
    // The rows panel: the variant's soft tint (never white) with its top bar.
    ctx.save();
    ctx.shadowColor = 'rgba(60, 30, 110, 0.16)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    drawRoundRect(ctx, panelX, panelTop, panelW, contentH, 28);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.restore();
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

    // Border + top bar go on after the rows, over a you-row highlight that bleeds to the edge.
    ctx.save();
    drawRoundRect(ctx, panelX, panelTop, panelW, contentH, 28);
    ctx.clip();
    ctx.fillStyle = theme.label;
    ctx.fillRect(panelX, panelTop, panelW, 10);
    ctx.restore();
    drawRoundRect(ctx, panelX, panelTop, panelW, contentH, 28);
    ctx.strokeStyle = theme.panelBorder;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // The board's own hook ("Can you beat them?"), its site part dropped: the
  // cast wordmark + "wordocious.com" below carry that (S3).
  if (hook) {
    const px = fitFontPx(ctx, hook, 34, width - CARD_PAD * 2, 20);
    ctx.save();
    ctx.font = `900 ${px}px ${SHARE_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = TEXT_DARK;
    ctx.fillText(hook, width / 2, plan.footTop + LB_HOOK_H / 2);
    ctx.restore();
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────────────

export async function generateShareImage(input: ShareImageInput): Promise<Blob | null> {
  resolveShareFontStack();
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* draw anyway */ }
  if (typeof document === 'undefined') return null;
  const width = SHARE_W;

  // FINISH_SPEC E1: every card wears a wallpaper and its title art.
  const date = ('date' in input && input.date) || new Date(getTodayLocal() + 'T00:00:00');
  const day = shareDayKey(date);
  let wall: string;
  let title: ArtName | null;
  let tint: readonly [string, string, string];
  let fallbackTitle: string;
  let fallbackColor: string | readonly [string, string];
  if (input.layout === 'leaderboard') {
    const lb = LEADERBOARD_SHARE_ART[input.variant];
    wall = pageWall(lb.wall);
    title = lb.title;
    tint = PAGE_TINTS[lb.wall].light;
    fallbackTitle = lb.label;
    fallbackColor = LB_THEME[input.variant].label;
  } else if (input.layout === 'daily-sweep') {
    wall = pageWall('home');
    title = input.flawless ? 'art-moment-flawless' : 'art-moment-sweep';
    tint = PAGE_TINTS.home.light;
    fallbackTitle = input.title ?? (input.flawless ? 'FLAWLESS VICTORY' : 'DAILY SWEEP');
    fallbackColor = input.flawless ? SWEEP_GOLD : SWEEP_VIOLET;
  } else if (input.layout === 'profile') {
    wall = pageWall('stats');
    title = 'art-titlecast-stats';
    tint = PAGE_TINTS.stats.light;
    fallbackTitle = 'STATS';
    fallbackColor = input.accentHex;
  } else {
    const g = gameShareArt(input.mode);
    wall = g.wall;
    title = g.title;
    const accent = MODE_ACCENT[input.mode];
    const t: TintStops = accent ? gameTint(accent) : PAGE_TINTS.home;
    tint = t.light;
    fallbackTitle = MODE_DISPLAY[input.mode] ?? input.mode.toUpperCase();
    fallbackColor = accent ?? '#7c3aed';
  }
  const [art, castImgs] = await Promise.all([
    loadShareArt({
      wall,
      title,
      icons: input.layout === 'daily-sweep' ? input.games.map((g) => g.mode) : undefined,
    }),
    loadCastImages(),
  ]);

  // S2: size the canvas to its content — title, head (info line / chips),
  // the board block, the foot (stat windows / hook), the cast wordmark.
  const titleH = titleBoxHeight(titleNatural(art));
  const hook = input.layout === 'leaderboard' ? shareHookLine(input.footer) : '';
  let headH: number = SHARE_SPACE.info;
  let footH: number = SHARE_SPACE.stats;
  if (input.layout === 'leaderboard') {
    headH = LB_HEAD_H;
    footH = hook ? LB_HOOK_H : 0;
  } else if (input.layout === 'profile') {
    headH = 0;
    footH = 0;
  }
  const plan = planShareCard({ titleH, headH, footH }, (maxH) => boardBlockHeight(input, BOARD_W, maxH));
  const height = plan.height;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  // Background fill under everything (the wallpaper covers it once loaded).
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  drawWallpaper(ctx, width, height, art.wall, tint);
  drawCardTitle(ctx, art, width, plan.titleTop, titleH, fallbackTitle, fallbackColor);
  const box: Box = { top: plan.boardTop, h: plan.boardH };
  const infoY = plan.headTop + SHARE_SPACE.info / 2;

  if (input.layout === 'leaderboard') {
    drawLeaderboardCard(ctx, input, width, plan, hook);
  } else if (input.layout === 'profile') {
    drawProfileCard(ctx, input, width, box);
  } else if (input.layout === 'daily-sweep') {
    // The More Games card names itself on the info line (founder, 2026-09-26)
    // — unless its title art didn't load and the name is already lettered.
    drawInfoLine(ctx, shareSweepInfo(art.title ? input : { ...input, title: undefined }, date), width / 2, infoY);
    drawDailySweepRows(ctx, input, width, box, art);
    drawCardStats(ctx, input, width, plan.footTop, null);
  } else {
    drawInfoLine(ctx, shareInfoLine(input, date), width / 2, infoY);
    if (input.layout === 'single') drawSingle(ctx, input, width, box);
    else if (input.layout === 'multi') drawMulti(ctx, input, width, box);
    else if (input.layout === 'gauntlet') drawGauntlet(ctx, input, width, box);
    else if (input.layout === 'sudoku') drawSudoku(ctx, input, width, box);
    else if (input.layout === 'regions') drawRegions(ctx, input, width, box);
    else if (input.layout === 'ladder') drawLadder(ctx, input, width, box);
    else if (input.layout === 'wordsearch') drawWordsearch(ctx, input, width, box);
    else if (input.layout === 'hub') drawHub(ctx, input, width, box);
    else if (input.layout === 'cryptogram') drawCryptogram(ctx, input, width, box);
    else if (input.layout === 'groups') drawGroups(ctx, input, width, box);
    else if (input.layout === 'crossword') drawCrossword(ctx, input, width, box);
    else if (input.layout === 'scramble') drawScramble(ctx, input, width, box);

    // Purple guesses · blue time · gold points (recomputed when the caller didn't pass them).
    const points = typeof input.points === 'number' ? input.points : fallbackSharePoints(input, day);
    drawCardStats(ctx, input, width, plan.footTop, points);
  }

  // S3: the cast IS the wordmark — the ten heroes standing together over "wordocious.com".
  drawCastWordmark(ctx, plan.cast, castImgs, width / 2, plan.castBase, plan.urlY);

  return canvasToPng(canvas);
}
