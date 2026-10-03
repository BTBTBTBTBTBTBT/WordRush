import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('./supabase-client', () => ({ supabase: {} }));

import { ACHIEVEMENTS, ACHIEVEMENT_CATALOG, newAchievementPayloads } from './achievement-service';
import { diffSeen } from './achievement-seen';
import { dismissCelebration, getCelebrations, queueCelebrations, CATEGORY_ACCENT } from './badges';
import { ACHIEVEMENT_CATEGORIES, NEW_ACHIEVEMENTS } from '@wordle-duel/core';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('BE: the new-game achievements in the catalog', () => {
  it('serves all 38 (hidden ones flagged) in /api/achievements; players only see the tracked ones', () => {
    for (const a of NEW_ACHIEVEMENTS) expect(ACHIEVEMENT_CATALOG.some((c) => c.key === a.key), a.key).toBe(true);
    expect(ACHIEVEMENT_CATALOG.filter((a) => a.hidden).map((a) => a.key).sort()).toEqual(['under_par']);
    expect(ACHIEVEMENTS.some((a) => a.hidden)).toBe(false);
    expect(read('app/api/achievements/route.ts')).toContain('{ achievements: ACHIEVEMENT_CATALOG }');
  });
  it('every catalog key and name is unique and every category is a contract id with an accent', () => {
    const keys = ACHIEVEMENT_CATALOG.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const names = ACHIEVEMENT_CATALOG.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(ACHIEVEMENT_CATEGORIES, a.key).toContain(a.category);
      expect(CATEGORY_ACCENT[a.category], a.category).toBeTruthy();
    }
  });
  it('never returns hidden or unknown keys as new unlocks', () => {
    expect(newAchievementPayloads(['under_par', 'nope', 'puzzle_sweep']).map((a) => a.key)).toEqual(['puzzle_sweep']);
    expect(newAchievementPayloads(['night_owl'])[0]).toEqual({ key: 'night_owl', name: 'Night Owl', description: 'Finish a daily between midnight and 4 AM', category: 'streaks' });
  });
  it('the endpoints return newAchievements (BF1)', () => {
    for (const f of ['app/api/daily/award-bonuses/route.ts', 'app/api/friends/route.ts', 'app/api/friends/react/route.ts', 'app/api/friends/games/[id]/move/route.ts', 'app/api/friends/games/[id]/resign/route.ts']) {
      expect(read(f), f).toContain('newAchievements');
    }
  });
});

describe('BF1: the unseen diff', () => {
  const earned = [
    { key: 'first_win', unlocked_at: '2026-09-01T10:00:00Z' },
    { key: 'night_owl', unlocked_at: '2026-10-02T03:00:00Z' },
    { key: 'puzzle_sweep', unlocked_at: '2026-10-01T20:00:00Z' },
  ];
  it('first launch seeds everything as seen and celebrates nothing', () => {
    expect(diffSeen(null, earned)).toEqual({ fresh: [], next: ['first_win', 'night_owl', 'puzzle_sweep'] });
  });
  it('queues an unseen key once, oldest first; already-seen keys never popup', () => {
    const r = diffSeen(['first_win'], earned);
    expect(r.fresh).toEqual(['puzzle_sweep', 'night_owl']);
    expect(diffSeen(r.next, earned).fresh).toEqual([]);
  });
});

describe('BF2: the celebration queue', () => {
  beforeEach(() => { while (getCelebrations().length) dismissCelebration(); });
  it('plays one at a time in unlock order, never duplicates', () => {
    const item = (key: string) => ({ kind: 'achievement' as const, key, name: key, description: '', badge: 'star' as const, accent: '#7c3aed' });
    queueCelebrations([item('a'), item('b')]);
    queueCelebrations([item('b'), item('c')]);
    expect(getCelebrations().map((c) => (c.kind === 'achievement' ? c.key : ''))).toEqual(['a', 'b', 'c']);
    dismissCelebration();
    expect(getCelebrations()[0]).toMatchObject({ key: 'b' });
  });
  it('waits for the win popup and never shows during a live VS match', () => {
    const host = read('components/badges/achievement-unlock-host.tsx');
    expect(host).toContain(".result-pop");
    expect(host).toContain('leaveGuard() !== null');
  });
});
