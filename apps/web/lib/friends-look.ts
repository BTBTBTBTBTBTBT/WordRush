import type { CSSProperties } from 'react';
import { SOFT, alphaHex, softMix } from './soft-surface';
import type { PoseArtName } from './art';

// The Friends tab's finishing look (docs/FINISH_SPEC.md C4 + A1/A2; mockup
// docs/design/brand/mockups/stats-friends-polish.html, the Friends phone).
// The page pins the light look (PageBackground scheme="light"), so its washes
// are opaque mixes over WHITE — never the dark card base — and its inks stay
// the mockup's dark purples in every theme. Under a dark season the page's CSS
// variables (--fr-*, globals.css) swap in the night glass and light inks; the
// values here are the light fallbacks. Pure, no hooks.

/** The Friends page palette (mockup values). */
export const FR_LOOK = {
  pink: '#ec4899',
  gold: '#f5a524',
  lavender: '#7c3aed',
  teal: '#0d9488',
  /** The race banner's pink → gold top bar. */
  bannerBar: 'linear-gradient(90deg, #ec4899, #f59e0b)',
  /** This week's race: the warm gold bar. */
  goldBar: 'linear-gradient(90deg, #f5a524, #ffd166)',
  /** The friends list: a purple → pink bar. */
  lavenderBar: 'linear-gradient(90deg, #a855f7, #ec4899)',
  bannerInk: 'var(--fr-banner-ink, #7a1f55)',
  bannerClock: 'var(--fr-banner-clock, #b0306f)',
  bannerSub: 'var(--fr-banner-sub, #8a4a6e)',
  chipInk: 'var(--fr-chip-ink, #5a2342)',
  goldInk: 'var(--fr-gold-ink, #8a4a12)',
  playLabel: 'var(--fr-play-label, #8a2d63)',
  ink: 'var(--fr-ink, #2a1650)',
  sub: 'var(--fr-sub, #6f5f8f)',
  rowSub: 'var(--fr-row-sub, #7a6a95)',
  /** The mockup's card shadow. */
  shadow: '0 8px 20px rgba(60, 30, 110, 0.10)',
} as const;

/**
 * A tinted Friends surface (A1): the accent at `share` over white with the
 * accent's 32% border, rounded. Cards pair it with a top bar (`frBar`) and
 * `overflow: hidden`.
 */
export function frSurface(accent: string, { share = SOFT.tint, radius = 20, shadow = true, border = true }: {
  share?: number; radius?: number; shadow?: boolean; border?: boolean;
} = {}): CSSProperties {
  return {
    // A dark season (globals.css, html[data-season-tone="dark"]) swaps in the night glass, no line.
    background: `var(--fr-season-card, ${softMix(accent, share)})`,
    border: border ? `1.5px solid var(--fr-season-line, ${softMix(accent, SOFT.line)})` : undefined,
    borderRadius: radius,
    boxShadow: shadow ? FR_LOOK.shadow : undefined,
  };
}

/** A card's top bar (10 px; the friend-game cards use 7). */
export function frBar(background: string, height: number = SOFT.bar): CSSProperties {
  return { height, background, flex: 'none' };
}

/** The soft white stripe on every other row of a tinted list (mockup `.frow:nth-child(even)`). */
export function rowStripe(index: number): string | undefined {
  return index % 2 === 1 ? `var(--fr-stripe, ${alphaHex('#ffffff', 0.45)})` : undefined;
}

/** Medal colors (the Leaderboard podium's gold / silver / bronze). */
export const MEDAL = { gold: '#f5a524', silver: '#aab3c5', bronze: '#d9844a' } as const;
const MEDALS = [MEDAL.gold, MEDAL.silver, MEDAL.bronze] as const;
/** You off the podium (the mockup's purple "5 · YOU" chip). */
export const RACE_YOU = '#7c3aed';
/** Anyone else off the podium, or before the race starts. */
export const RACE_REST = '#cbd5e1';

/**
 * The rank circle's color on a race chip: medal colors for the top three once
 * the race has points (and only for a row that scored), purple for you
 * otherwise, slate for everyone else.
 */
export function raceChipColor(row: { rank: number; points: number; me: boolean }, anyPoints: boolean): string {
  if (anyPoints && row.points > 0 && row.rank >= 1 && row.rank <= 3) return MEDALS[row.rank - 1];
  return row.me ? RACE_YOU : RACE_REST;
}

export interface PodiumSlot {
  /** Index into the standings (0 = first place). */
  index: number;
  place: 1 | 2 | 3;
  /** Grid column: 2nd left, 1st center, 3rd right. */
  column: 1 | 2 | 3;
  /** Step height in px. */
  step: number;
  /** Step gradient, top → bottom. */
  from: string;
  to: string;
  /** Avatar size in px (first place is bigger). */
  avatar: number;
}

const STEPS: Record<1 | 2 | 3, Omit<PodiumSlot, 'index' | 'place' | 'column'>> = {
  1: { step: 62, from: '#ffd66b', to: '#f5a524', avatar: 48 },
  2: { step: 46, from: '#e4e8f0', to: '#aab3c5', avatar: 40 },
  3: { step: 34, from: '#ffc9a0', to: '#d9844a', avatar: 40 },
};
const COLUMN: Record<1 | 2 | 3, 1 | 2 | 3> = { 1: 2, 2: 1, 3: 3 };

/**
 * The podium's slots for `count` standings, in display order (2nd, 1st, 3rd),
 * only the places that exist; each keeps its own column so first place stays
 * centered even with two entrants.
 */
export function podiumSlots(count: number): PodiumSlot[] {
  const n = Math.max(0, Math.min(3, Math.floor(count)));
  return [1, 0, 2]
    .filter((i) => i < n)
    .map((i) => {
      const place = (i + 1) as 1 | 2 | 3;
      return { index: i, place, column: COLUMN[place], ...STEPS[place] };
    });
}

// ── K1 · Moments as in-app notices (docs/FINISH_SPEC.md K1) ─────────────────
// Each moment is a tinted card in its event's color with a top bar, the
// sender's letter tile, a small cast pose that fits the event, the headline in
// Nunito Black with soft numbers, and a candy action. A7: no pose repeats on
// the screen, and none repeats the page's own art (the banner's O1 cheer, the
// add-friend card's I).

/** The moment fields the look reads (a subset of lib/friends-service FeedEvent). */
export interface MomentLike {
  type: string;
  kind?: string | null;
  me: boolean;
  otherId?: string | null;
}

/** Which notice a moment is: the event, refined for medals and pocket-game results. */
export function momentKey(e: MomentLike, myId: string | null): string {
  if (e.type === 'medal') {
    const k = e.kind ?? '';
    if (k === 'gold' || k === 'silver' || k === 'bronze' || k === 'perfect') return `medal-${k}`;
    if (k.startsWith('streak_')) return 'medal-streak';
    return 'medal';
  }
  if (e.type === 'game') {
    if (e.kind === 'draw') return 'game-draw';
    if (e.me) return 'game-win';
    if (myId && e.otherId === myId) return 'game-beat-you';
    return 'game';
  }
  return e.type;
}

/** Each notice's color (A1 wash + top bar). Pocket games pass their own accent. */
export function momentAccent(key: string, gameAccent?: string | null): string {
  if (key.startsWith('game') && gameAccent) return gameAccent;
  switch (key) {
    case 'flawless': return '#ec4899';
    case 'sweep': return '#7c3aed';
    case 'more_flawless': return '#b45309';
    case 'more_sweep': return '#4f46e5';
    case 'gift': return '#0d9488';
    case 'record': return '#d97706';
    case 'medal-gold': return MEDAL.gold;
    case 'medal-silver': return '#94a3b8';
    case 'medal-bronze': return MEDAL.bronze;
    case 'medal-streak': return '#f97316';
    case 'game-beat-you': return '#db2777';
    default: return '#7c3aed';
  }
}

/** The cast poses that fit each notice, in order of preference (A7: O2 gasp "beat you", S ready a challenge, …). */
export const MOMENT_POSES: Record<string, readonly PoseArtName[]> = {
  flawless: ['art-pose-o2-cheer', 'art-pose-o2-twirl', 'art-pose-o2-victory'],
  sweep: ['art-pose-s-trophy', 'art-pose-s-flex', 'art-pose-s-victory'],
  more_flawless: ['art-pose-c-cheer', 'art-pose-c-victory'],
  more_sweep: ['art-pose-c-map', 'art-pose-c-telescope'],
  'game-win': ['art-pose-o3-victory', 'art-pose-o3-handstand', 'art-pose-o3-laugh'],
  'game-beat-you': ['art-pose-o2-gasp', 'art-pose-o2-lean'],
  'game-draw': ['art-pose-u-goodgame', 'art-pose-u-spin'],
  game: ['art-pose-s-ready', 'art-pose-s-slide', 'art-pose-s-goodgame'],
  gift: ['art-pose-u-tea', 'art-pose-u-meditate', 'art-pose-u-lotus'],
  record: ['art-pose-d-eureka', 'art-pose-d-notes', 'art-pose-d-victory'],
  'medal-gold': ['art-pose-w-proud', 'art-pose-w-victory'],
  'medal-silver': ['art-pose-w-point', 'art-pose-w-hips'],
  'medal-bronze': ['art-pose-w-hips', 'art-pose-w-point'],
  'medal-perfect': ['art-pose-o2-strut'],
  'medal-streak': ['art-pose-s-stopwatch', 'art-pose-s-blocks'],
  medal: ['art-pose-w-wave', 'art-pose-w-cheer'],
};

/**
 * One pose per notice, in list order: each notice takes the first pose of its
 * kind not yet on screen (and not in `exclude`); null once its kind runs out,
 * so the same image never shows twice (A7).
 */
export function momentPoses(keys: readonly string[], exclude: readonly PoseArtName[] = []): Array<PoseArtName | null> {
  const used = new Set<string>(exclude);
  return keys.map((k) => {
    const pick = (MOMENT_POSES[k] ?? MOMENT_POSES.medal).find((p) => !used.has(p)) ?? null;
    if (pick) used.add(pick);
    return pick;
  });
}

/** A headline split into text and number runs, so the numbers can be drawn as soft numbers (A2). */
export function numberRuns(text: string): Array<{ text: string; num: boolean }> {
  const out: Array<{ text: string; num: boolean }> = [];
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), num: false });
    out.push({ text: m[0], num: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), num: false });
  return out;
}
