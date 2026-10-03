import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateDailySeed, isDailySeed, getDailySeedDate } from '@wordle-duel/core';
import { DAILY_MODES, MODE_BY_DBKEY, SWEEP_MODES, sweepModesFor } from './modes.generated';
import { MODE_SCORE_CONFIG, calculateCompositeScore } from './composite-scoring';
import { MIN_WIN_GUESSES, isPlausibleDailyResult } from './plausibility';
import { dailyHref } from './mode-routes';
import { MODE_CARDS, MORE_CARDS } from '@/components/home/mode-chrome';
import { PROFILE_MODES } from '@/components/profile/mode-picker';

// One daily, one key, end to end: the seed the game records under, the
// daily_results game_mode, the score config, Home's completed-card lookup and
// the leaderboard tab must all agree for every daily in the catalog. A
// mismatch anywhere means a finished daily that never shows as done on Home
// or never reaches its board (the 10-02 Muddle report).

const root = path.join(__dirname, '..');
const DATE = '2026-10-02';

/** Every app/ + components/ source file, read once. */
function sources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push({ file: path.relative(root, p), text: fs.readFileSync(p, 'utf8') });
    }
  };
  walk(path.join(root, 'app'));
  walk(path.join(root, 'components'));
  return out;
}
const SRC = sources();

describe('daily key consistency (every daily mode in the catalog)', () => {
  it('covers the known dailies, Muddle included', () => {
    const keys = DAILY_MODES.map((m) => m.dbKey);
    for (const k of ['DUEL', 'DUEL_6', 'DUEL_7', 'QUORDLE', 'OCTORDLE', 'RESCUE', 'SEQUENCE', 'PROPERNOUNDLE', 'GAUNTLET',
      'SCRAMBLE', 'HUB', 'SUDOKU', 'REGIONS', 'LADDER', 'WORDSEARCH', 'CRYPTOGRAM', 'GROUPS', 'CROSSWORD']) {
      expect(keys, k).toContain(k);
    }
  });

  describe.each(DAILY_MODES.map((m) => [m.dbKey as string, m.id] as const))('%s (%s)', (dbKey, id) => {
    it('seed round-trips: generateDailySeed → isDailySeed → date', () => {
      const seed = generateDailySeed(DATE, dbKey);
      expect(isDailySeed(seed)).toBe(true);
      expect(getDailySeedDate(seed)).toBe(DATE);
      // The mode suffix is the dbKey verbatim (pending-record + matches lookups key on it).
      expect(seed.endsWith(`-${dbKey}`)).toBe(true);
    });

    it('has a score config, scores a perfect win above zero, and has a plausibility floor', () => {
      const cfg = MODE_SCORE_CONFIG[dbKey];
      expect(cfg, `MODE_SCORE_CONFIG.${dbKey}`).toBeDefined();
      const minGuesses = MIN_WIN_GUESSES[dbKey] ?? 1;
      const secs = 600;
      expect(isPlausibleDailyResult(true, minGuesses, secs, cfg.totalBoards, dbKey)).toBe(true);
      expect(calculateCompositeScore(dbKey, true, minGuesses, secs, cfg.totalBoards, cfg.totalBoards, 0, undefined, undefined, DATE)).toBeGreaterThan(0);
      expect(MIN_WIN_GUESSES[dbKey], `MIN_WIN_GUESSES.${dbKey}`).toBeDefined();
    });

    it("Home's card looks its completion up under the same key", () => {
      const card = [...MODE_CARDS, ...MORE_CARDS].find((c) => c.id === id);
      expect(card, `home card ${id}`).toBeDefined();
      expect(card!.dbKey).toBe(dbKey);
      expect(card!.dailyEligible).toBe(true);
      expect(MODE_BY_DBKEY[dbKey].id).toBe(id);
      expect(dailyHref(dbKey), `dailyHref(${dbKey})`).toBeTruthy();
    });

    it('the leaderboard tab queries the same key', () => {
      const tab = PROFILE_MODES.find((m) => m.id === id);
      expect(tab, `leaderboard tab ${id}`).toBeDefined();
      expect(tab!.dbKey).toBe(dbKey);
    });

    it('a game generates its daily seed with this key', () => {
      const re = new RegExp(`generateDailySeed\\([^;\\n]*?'${dbKey}'\\)`);
      const hits = SRC.filter((s) => re.test(s.text)).map((s) => s.file);
      expect(hits.length, `no generateDailySeed(…, '${dbKey}') in app/ or components/`).toBeGreaterThan(0);
    });
  });

  it('the sweep set is a subset of the dailies and matches today\'s era', () => {
    const daily = new Set(DAILY_MODES.map((m) => m.dbKey));
    for (const m of SWEEP_MODES) expect(daily.has(m.dbKey)).toBe(true);
    expect(SWEEP_MODES.map((m) => m.dbKey).sort()).toEqual([...sweepModesFor(DATE)].sort());
  });

  it('every custom puzzle finish records under its own literal key', () => {
    // Puzzles record with a literal dbKey (word modes pass the page's `mode`).
    for (const m of DAILY_MODES.filter((x) => x.engine === 'custom' && x.dbKey !== 'PROPERNOUNDLE')) {
      const re = new RegExp(`recordGameResult\\(\\s*profile\\.id,\\s*'${m.dbKey}'`);
      expect(SRC.some((s) => re.test(s.text)), `recordGameResult(profile.id, '${m.dbKey}', …)`).toBe(true);
    }
  });
});
