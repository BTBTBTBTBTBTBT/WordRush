import { describe, it, expect, beforeEach } from 'vitest';
import { ACHIEVEMENTS } from './achievement-service';
import { ACHIEVEMENT_BADGES, ART_SIZE } from './art';
import {
  achievementBadge, achievementProgress, achievementTarget, celebrateLevelUp, dismissCelebration,
  formatUnlockDate, getCelebrations, levelBadge, levelLabel, queueCelebrations, subscribeCelebrations, tierChanged,
} from './badges';

function drain() {
  while (getCelebrations().length > 0) dismissCelebration();
}

describe('achievementBadge (FINISH_SPEC V1)', () => {
  it('maps every icon key the catalog uses to its own badge art', () => {
    for (const a of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_BADGES as readonly string[]).toContain(a.icon);
      expect(achievementBadge(a.icon)).toBe(a.icon);
      expect(ART_SIZE).toHaveProperty(`art-badge-${achievementBadge(a.icon)}`);
    }
  });
  it('falls back to the star for unknown keys', () => {
    expect(achievementBadge('rocket')).toBe('star');
    expect(achievementBadge('')).toBe('star');
  });
});

describe('levelBadge / levelLabel (V3)', () => {
  it('uses the core tier ladder', () => {
    expect([1, 10, 11, 25, 26, 50, 51, 99, 100].map(levelBadge)).toEqual([
      'level-bronze', 'level-bronze', 'level-silver', 'level-silver', 'level-gold', 'level-gold',
      'level-platinum', 'level-platinum', 'level-diamond',
    ]);
    expect(levelLabel(26)).toBe('Level 26 · Gold');
  });
  it('every level badge has art', () => {
    for (const l of [1, 11, 26, 51, 100]) expect(ART_SIZE).toHaveProperty(`art-badge-${levelBadge(l)}`);
  });
  it('tierChanged only on a level-up across a tier line', () => {
    expect(tierChanged(10, 11)).toBe(true);
    expect(tierChanged(11, 12)).toBe(false);
    expect(tierChanged(99, 100)).toBe(true);
    expect(tierChanged(26, 25)).toBe(false);
  });
});

describe('achievement progress + target (V1)', () => {
  it('reads progress from the profile numbers, clamped', () => {
    expect(achievementProgress('medal_50', { gold: 10, silver: 20, bronze: 7 })).toEqual({ current: 37, target: 50 });
    expect(achievementProgress('streak_7', { dailyStreak: 12 })).toEqual({ current: 7, target: 7 });
    expect(achievementProgress('dedicated', { totalWins: 100, totalLosses: 20 })).toEqual({ current: 120, target: 500 });
    expect(achievementProgress('speed_demon', {})).toBeNull();
  });
  it('every progress key is a real achievement', () => {
    const keys = new Set(ACHIEVEMENTS.map((a) => a.key));
    for (const k of ['streak_7', 'streak_14', 'streak_30', 'streak_master', 'year_one', 'unstoppable', 'untouchable', 'unbreakable',
      'rising_star', 'elite', 'century_club', 'wordsmith', 'thousand_words', 'dedicated', 'endurance', 'obsessed',
      'medal_10', 'medal_50', 'medal_wall', 'golden_touch', 'gold_rush', 'diamond_hands']) {
      expect(keys.has(k)).toBe(true);
      expect(achievementProgress(k, {})).not.toBeNull();
    }
  });
  it('reads a count target from the description', () => {
    expect(achievementTarget('Win 50 QuadWord games')).toBe(50);
    expect(achievementTarget('Win 1,000 total games')).toBe(1000);
    expect(achievementTarget('Achieve a 5-win streak')).toBe(5);
    expect(achievementTarget('Reach level 10')).toBe(10);
    expect(achievementTarget('Solve Classic in under 30 seconds')).toBeNull();
    expect(achievementTarget('Solve in 1 guess')).toBeNull();
    expect(achievementTarget('Win any game')).toBeNull();
  });
  it('formats the unlock date', () => {
    expect(formatUnlockDate('2026-10-02T15:00:00Z')).toMatch(/Oct [12], 2026/);
    expect(formatUnlockDate(null)).toBe('');
    expect(formatUnlockDate('nope')).toBe('');
  });
});

describe('celebration queue (V2)', () => {
  beforeEach(drain);
  it('queues in order, skips duplicates, notifies, and dismisses oldest first', () => {
    let calls = 0;
    const off = subscribeCelebrations(() => { calls += 1; });
    const a = { kind: 'achievement' as const, key: 'first_win', name: 'First Win', description: 'Win any game', badge: 'trophy' as const, accent: '#7c3aed' };
    const b = { ...a, key: 'daily_debut', name: 'Daily Debut' };
    queueCelebrations([a, b, a]);
    queueCelebrations([b]);
    expect(getCelebrations().map((c) => (c.kind === 'achievement' ? c.key : c.tier))).toEqual(['first_win', 'daily_debut']);
    expect(calls).toBe(1);
    const before = getCelebrations();
    expect(getCelebrations()).toBe(before);
    dismissCelebration();
    expect(getCelebrations().map((c) => (c.kind === 'achievement' ? c.key : ''))).toEqual(['daily_debut']);
    off();
  });
  it('queues a tier popup only when the tier changed', () => {
    celebrateLevelUp(11, 12);
    expect(getCelebrations()).toHaveLength(0);
    celebrateLevelUp(25, 26);
    expect(getCelebrations()).toEqual([{ kind: 'tier', level: 26, tier: 'gold', accent: '#f5a524' }]);
  });
});
