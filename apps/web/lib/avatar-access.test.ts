import { describe, it, expect } from 'vitest';
import { AVATAR_ACCESS_TABLE } from '@wordle-duel/core';
import { ACHIEVEMENT_CATALOG } from './achievement-service';
import { ITEM_GATING_ON, buyAvatarItem, earnStatsFromProfile, loadOwnedItems } from './avatar-access';

describe('web item gating', () => {
  it('ships off', () => {
    expect(ITEM_GATING_ON).toBe(false);
  });
  it('every earn condition names a real, awardable achievement', () => {
    const visible = new Set(ACHIEVEMENT_CATALOG.filter((a) => !a.hidden).map((a) => a.key));
    for (const [key, rule] of Object.entries(AVATAR_ACCESS_TABLE.parts)) {
      if (rule.earn?.achievement) expect(visible.has(rule.earn.achievement), `${key} → ${rule.earn.achievement}`).toBe(true);
    }
  });
  it('earn stats from a profile row (missing / junk → 0)', () => {
    expect(earnStatsFromProfile({ level: 12, current_streak: 3, best_streak: '40', best_daily_login_streak: null }, new Set(['boss_battle'])))
      .toEqual({ level: 12, currentStreak: 3, bestStreak: 40, bestLoginStreak: 0, achievements: ['boss_battle'] });
    expect(earnStatsFromProfile(null)).toEqual({ level: 0, currentStreak: 0, bestStreak: 0, bestLoginStreak: 0, achievements: [] });
  });
  it('purchases + the ledger are stubs for now', async () => {
    expect(await buyAvatarItem('head:crown')).toEqual({ ok: false, reason: 'coming-soon' });
    expect(await loadOwnedItems()).toEqual([]);
  });
});
