import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SHARE_HERO_GAP, SHARE_HERO_H } from '@wordle-duel/core';
import { ART_SIZE } from './art';
import { SHARE_H_MAX, SHARE_H_MIN, SHARE_W, lbLayout } from './share-fit';
import { SHARE_SITE } from './share-look';
import { generateShareImage, shareCardArt, shareCardPlan, type ShareImageInput, type ShareLeaderboardInput, type ShareLeaderboardRowInput, type TileStateString } from './share-image';
import { SHARE_EXTRA_SAMPLES, SHARE_SAMPLES } from './share-samples';

// Night share cards (founder 10-16, option B). Two layers: the pure plan (every card kind, 2 / 6 / 12 players, every
// game) stays 1080 × [1350, 1440]; and a real render through generateShareImage on a recording canvas: the clean
// variant of a word game draws no answer letters or words, the "wordocious.com" line is always there.

const DATE = new Date('2026-10-16T12:00:00');
const natOf = (input: ShareImageInput): readonly [number, number] | null => {
  const t = shareCardArt(input).title;
  return t ? ART_SIZE[t as keyof typeof ART_SIZE] ?? null : null;
};
const NAMES = ['MJT', 'Juniper', 'Ava', 'VowelMaven', 'TileTamer', 'QuillQueen', 'Bram', 'Lex', 'Pip', 'Rune', 'Sage', 'BMT'];
const row = (rank: number, you = false): ShareLeaderboardRowInput => ({ rank, name: NAMES[(rank - 1) % NAMES.length], scoreDisplay: `${2500 - rank * 40}`, subline: `${3 + (rank % 3)} guesses · 1:0${rank % 10} · Win`, isYou: you });

/** A daily board with `players` rows: the top rows in `rows`, the sharer where the board puts them. */
function board(players: number, variant: ShareLeaderboardInput['variant'] = 'solo', youRank = players): ShareLeaderboardInput {
  const rows = Array.from({ length: players }, (_, i) => row(i + 1, i + 1 === youRank));
  return {
    layout: 'leaderboard', mode: 'Classic', variant, modeChip: 'Classic', dateChip: 'Oct 16, 2026 · #193 · as of 9:53 AM',
    footer: 'Can you beat them? Play free at wordocious.com', rows, date: DATE, shareRank: youRank, sharePlayers: players,
  };
}
/** The app's shape for a big board: the top 5 plus the sharer's own row below. */
function topPlusYou(players: number, variant: ShareLeaderboardInput['variant'] = 'solo'): ShareLeaderboardInput {
  const b = board(Math.min(5, players), variant, 0);
  return { ...b, you: row(players, true), youRankLine: `#${players} of ${players}`, shareRank: players, sharePlayers: players };
}
const VARIANTS: ShareLeaderboardInput['variant'][] = ['solo', 'vs', 'podium', 'friends', 'friendsPodium', 'sweep', 'sweepPodium', 'weeklyRace', 'flawlessStreak', 'trophyCase'];
const PLAYERS = [2, 6, 12];

describe('night card plan: 1080 wide, 1350–1440 tall for every card kind', () => {
  const heroBands = [0, SHARE_HERO_H + SHARE_HERO_GAP];

  it('a leaderboard with 2, 6 and 12 players, every variant, the sharer on the podium or below the rows', () => {
    for (const variant of VARIANTS) {
      for (const n of PLAYERS) {
        const inputs = [board(n, variant), board(n, variant, 1), topPlusYou(n, variant), { ...board(n, variant), you: undefined }];
        for (const input of inputs) {
          for (const heroH of heroBands) {
            for (const dayNat of [undefined, null, [1200, 300] as const]) {
              const { plan } = shareCardPlan(input, natOf(input), { heroH, dayNat });
              const tag = `${variant} ${n} players, hero ${heroH}, day ${String(dayNat)}`;
              expect(SHARE_W).toBe(1080);
              expect(plan.height, tag).toBeGreaterThanOrEqual(SHARE_H_MIN);
              expect(plan.height, tag).toBeLessThanOrEqual(SHARE_H_MAX);
              expect(plan.urlY, tag).toBeLessThan(plan.height);
              expect(plan.boardTop + plan.boardH, tag).toBeLessThanOrEqual(plan.footTop + 0.5);
            }
          }
        }
      }
    }
  });

  it('every game\'s finished card (clean and revealed, every sample, every extra card), with and without the hero band', () => {
    for (const { id, input } of [...SHARE_SAMPLES, ...SHARE_EXTRA_SAMPLES]) {
      const variants: ShareImageInput[] = [input];
      if ('reveal' in input) variants.push({ ...input, reveal: !input.reveal } as ShareImageInput);
      for (const v of variants) {
        for (const heroH of heroBands) {
          for (const nat of [natOf(v), null]) {
            const { plan } = shareCardPlan(v, nat, { heroH });
            const tag = `${id} hero ${heroH} nat ${String(nat)}`;
            expect(plan.height, tag).toBeGreaterThanOrEqual(1350);
            expect(plan.height, tag).toBeLessThanOrEqual(1440);
          }
        }
      }
    }
  });
});

// ── A recording canvas so generateShareImage runs in node ──────────────────

interface FakeCanvas { width: number; height: number; texts: string[] }
const canvases: FakeCanvas[] = [];

function recordingCtx(canvas: FakeCanvas): CanvasRenderingContext2D {
  let fontPx = 16;
  const t: Record<string | symbol, unknown> = { canvas };
  return new Proxy(t, {
    get(target, prop) {
      if (prop === 'measureText') return (s: unknown) => ({ width: String(s).length * fontPx * 0.58, actualBoundingBoxAscent: fontPx * 0.72, actualBoundingBoxDescent: fontPx * 0.2 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: unknown) => { canvas.texts.push(String(s)); };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') return () => ({ addColorStop() {} });
      if (prop === 'createPattern') return () => ({});
      if (prop === 'getImageData' || prop === 'createImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h });
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'isPointInPath') return () => false;
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => undefined;
    },
    set(target, prop, v) {
      if (prop === 'font') { const m = /(\d+(?:\.\d+)?)px/.exec(String(v)); if (m) fontPx = parseFloat(m[1]); }
      target[prop] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function fakeCanvas(): HTMLCanvasElement {
  const c: FakeCanvas & Record<string, unknown> = { width: 300, height: 150, texts: [] };
  canvases.push(c);
  const ctx = recordingCtx(c);
  c.getContext = () => ctx;
  c.toBlob = (cb: (b: Blob | null) => void) => { cb(new Blob(['png'], { type: 'image/png' })); };
  c.toDataURL = () => 'data:image/png;base64,';
  return c as unknown as HTMLCanvasElement;
}

/** An <img> whose load always fails (fast): art, cast, glyph and podium pictures all fall back to lettering / tiles. */
class FakeImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  currentSrc = '';
  decoding = '';
  crossOrigin = '';
  private _src = '';
  get src() { return this._src; }
  set src(v: string) { this._src = v; setTimeout(() => this.onerror?.(), 0); }
}

const saved: Record<string, unknown> = {};
beforeAll(() => {
  for (const k of ['document', 'window', 'Image', 'Path2D']) saved[k] = (globalThis as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>).document = { createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas() : { style: {} }) };
  (globalThis as Record<string, unknown>).window = { devicePixelRatio: 1 };
  (globalThis as Record<string, unknown>).Image = FakeImage;
  (globalThis as Record<string, unknown>).Path2D = class { constructor(public d?: string) {} };
});
afterAll(() => {
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete (globalThis as Record<string, unknown>)[k];
    else (globalThis as Record<string, unknown>)[k] = saved[k];
  }
});

/** Renders one card; returns the 1080-wide card canvas (the texts it drew and its height). */
async function render(input: ShareImageInput): Promise<FakeCanvas> {
  canvases.length = 0;
  const blob = await generateShareImage(input, { season: null, hero: null });
  expect(blob).not.toBeNull();
  const card = canvases.filter((c) => c.width === 1080).sort((a, b) => b.texts.length - a.texts.length)[0];
  expect(card, 'a 1080-wide card canvas').toBeTruthy();
  return card;
}

const grid = (r: number, c: number, solved: number | null): TileStateString[][] =>
  Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (i >= (solved ?? r) ? 'EMPTY' : solved !== null && i === solved - 1 ? 'CORRECT' : (i + j) % 3 ? 'ABSENT' : 'PRESENT') as TileStateString));
// Every tile letter is Q and the answers are Q-words: no chip, label or stat ever contains a Q, so a leak is unambiguous.
const QROW = (c: number) => Array.from({ length: c }, () => 'Q');
const letters = (r: number, c: number) => Array.from({ length: r }, () => QROW(c));

const WORD_CARDS: Array<{ id: string; input: ShareImageInput; answers: string[] }> = [
  { id: 'classic-loss', answers: ['QUIZZ'], input: { layout: 'single', mode: 'Classic', won: false, guesses: 6, maxGuesses: 6, timeSeconds: 201, grid: grid(6, 5, null), letters: letters(6, 5), solutionDisplay: 'QUIZZ', date: DATE } },
  { id: 'classic-win', answers: ['QUIZZ'], input: { layout: 'single', mode: 'Classic', won: true, guesses: 4, maxGuesses: 6, timeSeconds: 94, grid: grid(6, 5, 4), letters: letters(6, 5), solutionDisplay: 'QUIZZ', date: DATE } },
  { id: 'six', answers: ['QUIZZQ'], input: { layout: 'single', mode: 'Six', won: false, guesses: 7, maxGuesses: 7, timeSeconds: 160, grid: grid(7, 6, null), letters: letters(7, 6), solutionDisplay: 'QUIZZQ', date: DATE } },
  { id: 'seven', answers: ['QUIZZQQ'], input: { layout: 'single', mode: 'Seven', won: false, guesses: 8, maxGuesses: 8, timeSeconds: 240, grid: grid(8, 7, null), letters: letters(8, 7), solutionDisplay: 'QUIZZQQ', date: DATE } },
  { id: 'propernoundle', answers: ['QUEEN QUAIL'], input: { layout: 'single', mode: 'ProperNoundle', won: false, guesses: 6, maxGuesses: 6, timeSeconds: 75, grid: grid(6, 12, null), letters: letters(6, 12), wordGroups: [6, 6], category: 'Sports', solutionDisplay: 'QUEEN QUAIL', date: DATE } },
  { id: 'deliverance', answers: ['QUIZZ'], input: { layout: 'single', mode: 'Deliverance', won: false, guesses: 6, maxGuesses: 6, timeSeconds: 55, grid: grid(6, 5, null), letters: letters(6, 5), solutionDisplay: 'QUIZZ', date: DATE } },
  {
    id: 'quadword', answers: ['QUIZZ', 'QUACK', 'QUEST', 'QUOTA'],
    input: { layout: 'multi', mode: 'QuadWord', won: false, guesses: 9, maxGuesses: 9, timeSeconds: 330, boards: ['QUIZZ', 'QUACK', 'QUEST', 'QUOTA'].map((s, i) => ({ grid: grid(9, 5, i === 0 ? 3 : null), letters: letters(9, 5), won: i === 0, solution: s })), boardsSolved: 1, totalBoards: 4, date: DATE },
  },
  {
    id: 'octoword', answers: ['QUIZZ', 'QUACK'],
    input: { layout: 'multi', mode: 'OctoWord', won: false, guesses: 13, maxGuesses: 13, timeSeconds: 610, boards: Array.from({ length: 8 }, (_, i) => ({ grid: grid(13, 5, i < 6 ? i + 3 : null), letters: letters(13, 5), won: i < 6, solution: i % 2 ? 'QUIZZ' : 'QUACK' })), boardsSolved: 6, totalBoards: 8, date: DATE },
  },
  {
    id: 'succession', answers: ['QUIZZ'],
    input: { layout: 'multi', mode: 'Succession', won: false, guesses: 10, maxGuesses: 10, timeSeconds: 420, boards: [2, 5, null, null].map((s) => ({ grid: grid(10, 5, s), letters: letters(10, 5), won: s !== null, solution: 'QUIZZ' })), boardsSolved: 2, totalBoards: 4, date: DATE },
  },
];

const leaks = (texts: string[], answers: string[]) =>
  texts.filter((t) => /^Q$/i.test(t.trim()) || answers.some((a) => t.toUpperCase().includes(a)));

describe('night card render (recording canvas): the clean variant and the footer link', () => {
  it('the clean (default) card of every word game draws no tile letter and no answer word; "Full results" draws them', async () => {
    for (const { id, input, answers } of WORD_CARDS) {
      const clean = await render(input);
      expect(leaks(clean.texts, answers), `${id} clean leaks`).toEqual([]);
      expect(clean.texts.length, `${id} drew its head`).toBeGreaterThan(3);
      const full = await render({ ...input, reveal: true } as ShareImageInput);
      expect(leaks(full.texts, answers).length, `${id} full reveals`).toBeGreaterThan(0);
    }
  }, 60_000);

  it('every sample card and every leaderboard size renders 1080 × [1350, 1440] with the wordocious.com line last', async () => {
    const cards: Array<{ id: string; input: ShareImageInput }> = [
      ...SHARE_SAMPLES, ...SHARE_EXTRA_SAMPLES,
      ...PLAYERS.flatMap((n) => [{ id: `lb-${n}`, input: board(n) }, { id: `lb-${n}-you-below`, input: topPlusYou(n) }, { id: `lb-${n}-friends`, input: board(n, 'friends', 1) }, { id: `lb-${n}-weekly`, input: board(n, 'weeklyRace') }]),
    ];
    for (const { id, input } of cards) {
      const card = await render(input);
      expect(card.width, id).toBe(1080);
      expect(card.height, id).toBeGreaterThanOrEqual(1350);
      expect(card.height, id).toBeLessThanOrEqual(1440);
      expect(card.texts, `${id} footer link`).toContain(SHARE_SITE);
      expect(card.texts[card.texts.length - 1], `${id} link drawn last`).toBe(SHARE_SITE);
      expect(card.texts.filter((t) => t === SHARE_SITE).length, `${id} one link line`).toBe(1);
    }
  }, 120_000);

  it('a leaderboard card never draws a board word: only names, ranks, scores and stats', async () => {
    for (const n of PLAYERS) {
      const input = board(n);
      const card = await render(input);
      // The rows the compact layout keeps: the podium's three, the row(s) under it and the sharer's own.
      const lb = lbLayout(input);
      const drawn = [...input.rows.slice(0, lb.filled), ...lb.list, ...(lb.you ? [lb.you] : [])];
      expect(drawn.length, `${n} players`).toBeGreaterThanOrEqual(Math.min(n, 3));
      for (const r of drawn) {
        expect(card.texts.some((t) => t.toUpperCase().includes(r.isYou ? 'YOU' : r.name.toUpperCase())), `${n} players: row ${r.rank}`).toBe(true);
      }
      // The only single letters on the card are the cast wordmark's fallback tiles (W·O·R·D·O·C·I·O·U·S).
      for (const t of card.texts.filter((s) => /^[A-Z]$/.test(s))) expect('WORDCIUS', `${n} players: letter ${t}`).toContain(t);
    }
  }, 60_000);
});
