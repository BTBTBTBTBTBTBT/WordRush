// 3D achievement + level badges (docs/FINISH_SPEC.md V): which badge art an
// achievement / level wears, the progress a locked achievement shows, and the
// celebration queue (achievement unlocks + a level-up into a new tier) that
// components/badges/achievement-unlock-host.tsx plays one after another.
// Pure + node-safe: no DOM at import time (the queue only notifies listeners).

import { levelTier, levelTierLabel, type LevelTier } from '@wordle-duel/core';
import { ACHIEVEMENT_BADGES, type BadgeName } from '@/lib/art';

export type AchievementBadgeName = (typeof ACHIEVEMENT_BADGES)[number];
export type LevelBadgeName = `level-${LevelTier}`;

/** The badge for an achievement's `icon` key; unknown keys wear the star. */
export function achievementBadge(icon: string): AchievementBadgeName {
  return (ACHIEVEMENT_BADGES as readonly string[]).includes(icon) ? (icon as AchievementBadgeName) : 'star';
}

/** The tier badge for a level (Bronze 1–10 … Diamond 100+, core levelTier). */
export function levelBadge(level: number): LevelBadgeName & BadgeName {
  return `level-${levelTier(level)}`;
}

/** "Level 26 · Gold" — the accessible name of a level badge. */
export function levelLabel(level: number): string {
  return `Level ${level} · ${levelTierLabel(levelTier(level))}`;
}

/** Each tier's accent (the popup wash, chip tints). */
export const TIER_ACCENT: Record<LevelTier, string> = {
  bronze: '#d9844a',
  silver: '#8c95a8',
  gold: '#f5a524',
  platinum: '#7c3aed',
  diamond: '#2563eb',
};

/** Each achievement category's accent (the grid's tints + the unlock popup). */
export const CATEGORY_ACCENT: Record<string, string> = {
  beginner: '#7c3aed',
  consistency: '#f97316',
  skill: '#2563eb',
  social: '#0d9488',
  collection: '#d97706',
  // FINISH_SPEC BE: the new-game categories.
  puzzles: '#db2777',
  vs: '#0f766e',
  bots: '#4f46e5',
  friends: '#e11d48',
  pocket: '#0891b2',
  mascot: '#9333ea',
  seasonal: '#ea580c',
  streaks: '#ca8a04',
};

/** True when going from `prevLevel` to `newLevel` lands in a new tier. */
export function tierChanged(prevLevel: number, newLevel: number): boolean {
  return newLevel > prevLevel && levelTier(prevLevel) !== levelTier(newLevel);
}

/** The profile numbers a locked achievement's progress can be read from. */
export interface ProgressSource {
  dailyStreak?: number | null;
  winStreak?: number | null;
  level?: number | null;
  totalWins?: number | null;
  totalLosses?: number | null;
  gold?: number | null;
  silver?: number | null;
  bronze?: number | null;
}

/**
 * Progress for the achievements whose count the profile row already holds
 * (streaks, level, wins, games, medals); null for the rest. `current` is
 * clamped to the target.
 */
export function achievementProgress(key: string, p: ProgressSource): { current: number; target: number } | null {
  const medals = (p.gold ?? 0) + (p.silver ?? 0) + (p.bronze ?? 0);
  const games = (p.totalWins ?? 0) + (p.totalLosses ?? 0);
  const table: Record<string, [number, number]> = {
    streak_7: [p.dailyStreak ?? 0, 7],
    streak_14: [p.dailyStreak ?? 0, 14],
    streak_30: [p.dailyStreak ?? 0, 30],
    streak_master: [p.dailyStreak ?? 0, 50],
    year_one: [p.dailyStreak ?? 0, 365],
    unstoppable: [p.winStreak ?? 0, 5],
    untouchable: [p.winStreak ?? 0, 10],
    unbreakable: [p.winStreak ?? 0, 25],
    rising_star: [p.level ?? 0, 10],
    elite: [p.level ?? 0, 50],
    century_club: [p.totalWins ?? 0, 100],
    wordsmith: [p.totalWins ?? 0, 500],
    thousand_words: [p.totalWins ?? 0, 1000],
    dedicated: [games, 500],
    endurance: [games, 1000],
    obsessed: [games, 2000],
    medal_10: [medals, 10],
    medal_50: [medals, 50],
    medal_wall: [medals, 100],
    golden_touch: [p.gold ?? 0, 10],
    gold_rush: [p.gold ?? 0, 50],
    diamond_hands: [p.gold ?? 0, 100],
  };
  const row = table[key];
  if (!row) return null;
  return { current: Math.max(0, Math.min(row[0], row[1])), target: row[1] };
}

/**
 * The count an achievement asks for, read from its description ("Win 50
 * QuadWord games" → 50, "Achieve a 5-win streak" → 5); null when it is not a
 * count ("Solve Classic in under 30 seconds").
 */
export function achievementTarget(description: string): number | null {
  const m = /^(?:Win|Play|Earn|Complete|Solve|Clear|Achieve|Reach|Find|Finish)\s+(?:a\s+|level\s+)?(\d[\d,]*)\b/i.exec(description.trim());
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return n > 1 ? n : null;
}

/** "Oct 2, 2026" — an unlock date; empty when missing / unparsable. */
export function formatUnlockDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── The celebration queue (V2 + V3) ─────────────────────────────────────────

export type BadgeCelebration = (
  | { kind: 'achievement'; key: string; name: string; description: string; badge: AchievementBadgeName; accent: string; xp?: number }
  | { kind: 'tier'; level: number; tier: LevelTier; accent: string }
) & {
  /**
   * From a LATE result (pending-records replay, launch / visibility sync, or a
   * live finish that came back > 6 s late — lib/celebration-gate.ts): it waits
   * for a calm moment instead of showing over whatever is on screen.
   */
  late?: true;
};

/** The window event fired with every batch (detail: the queued items). */
export const BADGE_CELEBRATION_EVENT = 'wordocious:badge-celebration';

const EMPTY: readonly BadgeCelebration[] = Object.freeze([]);
let queue: readonly BadgeCelebration[] = EMPTY;
const listeners = new Set<() => void>();

function sameItem(a: BadgeCelebration, b: BadgeCelebration): boolean {
  if (a.kind === 'achievement' && b.kind === 'achievement') return a.key === b.key;
  if (a.kind === 'tier' && b.kind === 'tier') return a.tier === b.tier;
  return false;
}

/**
 * Adds celebrations to the end of the queue (duplicates already queued are
 * skipped — a late item stays late even if the same unlock is announced live
 * afterwards, e.g. the XpToast's tier popup for a result that came back late).
 * `late` marks them as waiting for a calm moment.
 */
export function queueCelebrations(items: BadgeCelebration[], opts: { late?: boolean } = {}): void {
  const fresh: BadgeCelebration[] = [];
  for (const raw of items) {
    const it: BadgeCelebration = opts.late ? { ...raw, late: true } : raw;
    if (queue.some((q) => sameItem(q, it)) || fresh.some((q) => sameItem(q, it))) continue;
    fresh.push(it);
  }
  if (fresh.length === 0) return;
  queue = [...queue, ...fresh];
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(BADGE_CELEBRATION_EVENT, { detail: fresh })); } catch { /* old browsers */ }
  }
}

/** The pending celebrations, oldest first (a stable reference between changes). */
export function getCelebrations(): readonly BadgeCelebration[] {
  return queue;
}

/** Drops the celebration on screen: `item` when given, else the oldest. */
export function dismissCelebration(item?: BadgeCelebration): void {
  if (queue.length === 0) return;
  const i = item ? queue.indexOf(item) : 0;
  if (i < 0) return;
  queue = queue.length === 1 ? EMPTY : queue.filter((_, j) => j !== i);
  listeners.forEach((l) => l());
}

/**
 * The celebration to show next: the oldest LIVE one (today's behavior), else
 * the oldest late one (which then waits for calm). Null when empty.
 */
export function nextCelebration(items: readonly BadgeCelebration[]): BadgeCelebration | null {
  return items.find((c) => !c.late) ?? items[0] ?? null;
}

/** Subscribes to queue changes (useSyncExternalStore-shaped). */
export function subscribeCelebrations(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Queues the tier popup when a level-up crossed into a new tier (`late` → waits for calm). */
export function celebrateLevelUp(prevLevel: number, newLevel: number, opts: { late?: boolean } = {}): void {
  if (!tierChanged(prevLevel, newLevel)) return;
  const tier = levelTier(newLevel);
  queueCelebrations([{ kind: 'tier', level: newLevel, tier, accent: TIER_ACCENT[tier] }], opts);
}
