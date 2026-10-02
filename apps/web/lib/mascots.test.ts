import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MODES } from './modes.generated';
import {
  CAST, GAME_HOSTS, GUIDE_HOSTS, LOADING_TIPS, MASCOT_LETTER, MASCOT_LINES, PAGE_HOSTS,
  allDoneLine, castMemberFor, gameHost, guideHost, loadingTip, mascotSrc, pocketResultHost,
  victoryHost, vsResultHost,
} from './mascots';

// The cast tables (docs/MASCOT_SPEC.md §0, §1, §3, §5, §6). iOS Mascots.swift and
// Android ui/Mascots.kt carry the same tables; these pin the web copy to the spec.

describe('the cast', () => {
  it('spells WORDOCIOUS in order', () => {
    expect(CAST.map((id) => MASCOT_LETTER[id]).join('')).toBe('WORDOCIOUS');
    expect(new Set(CAST).size).toBe(10);
  });

  it('has art for every member in public/mascots', () => {
    for (const id of CAST) {
      const file = path.join(__dirname, '..', 'public', mascotSrc(id));
      expect(fs.existsSync(file), file).toBe(true);
    }
  });
});

describe('page hosts (§1, §6)', () => {
  it('matches the spec table', () => {
    expect(PAGE_HOSTS).toMatchObject({
      home: 'w', puzzles: 'c', wordOfTheDay: 'i', leaderboard: 'o2', records: 'o2',
      stats: 'd', friends: 'o1', vs: 's', empty: 'r', allDone: 'u', pocketWin: 'o3',
      settings: 'r', pro: 'w', guides: 'c', offline: 'r', notFound: 'o3', addFriend: 'i', tips: 'd',
    });
  });

  it('only names cast members', () => {
    for (const id of Object.values(PAGE_HOSTS)) expect(CAST).toContain(id);
  });
});

describe('game hosts (§5)', () => {
  it('matches the spec table, keyed by mode db key', () => {
    expect(GAME_HOSTS).toEqual({
      DUEL: 'w', GAUNTLET: 's', QUORDLE: 'o1', OCTORDLE: 'd', SEQUENCE: 'i', RESCUE: 'c',
      DUEL_6: 'o2', DUEL_7: 'u', SUDOKU: 'u', SCRAMBLE: 'r', HUB: 'o1', CROSSWORD: 'd',
      GROUPS: 'o2', LADDER: 'i', CRYPTOGRAM: 'c', WORDSEARCH: 'o3', REGIONS: 's', PROPERNOUNDLE: 'w',
    });
  });

  it('gives every game in the catalog a host, and only real games', () => {
    const keys = MODES.filter((m) => m.dbKey).map((m) => m.dbKey as string).sort();
    expect(Object.keys(GAME_HOSTS).sort()).toEqual(keys);
    for (const id of Object.values(GAME_HOSTS)) expect(CAST).toContain(id);
  });

  it('has no host for non-games', () => {
    expect(gameHost('SWEEP')).toBeNull();
    expect(gameHost(null)).toBeNull();
    expect(gameHost(undefined)).toBeNull();
  });

  it('maps every guide slug to its game host', () => {
    for (const m of MODES) {
      if (!m.guideSlug || !m.dbKey) continue;
      expect(guideHost(m.guideSlug)).toBe(GAME_HOSTS[m.dbKey]);
    }
    expect(Object.keys(GUIDE_HOSTS)).toHaveLength(MODES.filter((m) => m.guideSlug && m.dbKey).length);
    expect(guideHost('crosswordocious')).toBe('d');
    expect(guideHost('nope')).toBeNull();
  });
});

describe('moments (§3)', () => {
  it('victory: the game host, else a day-stable cast member', () => {
    expect(victoryHost('QUORDLE', '2026-10-02')).toBe('o1');
    const a = victoryHost(undefined, '2026-10-02');
    expect(CAST).toContain(a);
    expect(victoryHost(undefined, '2026-10-02')).toBe(a);
    expect(castMemberFor('x')).toBe(castMemberFor('x'));
    // Seeds spread across the cast.
    const seen = new Set(Array.from({ length: 60 }, (_, i) => castMemberFor(`2026-10-${i}:MODE`)));
    expect(seen.size).toBeGreaterThan(5);
  });

  it('VS result: win S, loss R, draw U', () => {
    expect(vsResultHost('win')).toBe('s');
    expect(vsResultHost('loss')).toBe('r');
    expect(vsResultHost('draw')).toBe('u');
  });

  it('pocket game result: win O3, loss R', () => {
    expect(pocketResultHost('win')).toBe('o3');
    expect(pocketResultHost('loss')).toBe('r');
  });
});

describe('voice (§6)', () => {
  it('keeps every line to one short line', () => {
    for (const line of [...Object.values(MASCOT_LINES), ...LOADING_TIPS, allDoneLine('02:06:43')]) {
      expect(line.length).toBeLessThanOrEqual(60);
      expect(line).not.toMatch(/\n/);
    }
  });

  it('rotates five tips, any tick', () => {
    expect(LOADING_TIPS).toHaveLength(5);
    expect(loadingTip(0)).toBe(LOADING_TIPS[0]);
    expect(loadingTip(7)).toBe(LOADING_TIPS[2]);
    expect(loadingTip(-1)).toBe(LOADING_TIPS[4]);
    for (const t of LOADING_TIPS) expect(t.startsWith('Tip: ')).toBe(true);
  });

  it('prints the all-done line with the clock', () => {
    expect(allDoneLine('2:06:43')).toBe('All done for today. Fresh puzzles in 2:06:43.');
  });
});
