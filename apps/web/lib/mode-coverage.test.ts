import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  fewestRecordTitle, guessStatText, isPerfectDailyResult, moreSweepModeKeys, recordValueText,
} from '@wordle-duel/core';
import { DAILY_MODES, MODES, MODE_BY_DBKEY, MORE_GAME_MODES } from './modes.generated';
import { formatGuessStat } from './format';
import { fewestRecordLabel } from './mode-stats';
import { recordValue } from './records-ui';
import { MODE_CHROME } from '@/components/home/mode-chrome';

// FINISH_SPEC BJ12 (founder 10-03): every game reaches Stats (Today, All-time,
// recent matches) and Friends Moments — checked for EVERY catalog mode, so a
// new game is covered the day it lands in modes.json.

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const componentSources = (() => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(root, 'components'));
  return out.join('\n');
})();

describe('BJ12: every mode reaches Stats and Moments (web)', () => {
  for (const m of DAILY_MODES) {
    const key = m.dbKey as string;
    describe(`${key} (${m.title})`, () => {
      it('has recent-match chrome (title, icon, accent) from the catalog', () => {
        expect(MODE_BY_DBKEY[key]?.title).toBe(m.title);
        expect(MODE_CHROME[m.id], `${m.id} has no MODE_CHROME (recent-match icon)`).toBeDefined();
      });

      if (m.engine === 'custom' && key !== 'PROPERNOUNDLE') {
        it('its game records the finish to user_stats/daily_results AND a matches row (Recent Matches)', () => {
          expect(componentSources).toMatch(new RegExp(`recordGameResult\\(\\s*profile\\.id,\\s*'${key}'`));
          expect(componentSources).toMatch(new RegExp(`gameMode: '${key}'`));
        });
      }

      it('a perfect run earns the Perfect medal (the Moments row)', () => {
        const total = m.group === 'more' || m.guessBase === 1 ? 1 : m.guessBase;
        expect(isPerfectDailyResult(key, m, m.guessBase, total, total, true)).toBe(true);
      });

      it('formats guess stats and records exactly like the shared core (every platform)', () => {
        for (let g = 0; g <= m.guessBase + 12; g++) {
          expect(formatGuessStat(m.guessSemantics, m.guessBase, g)).toBe(guessStatText(m.guessSemantics, m.guessBase, g));
          if (g >= 1) expect(recordValue('fewest_guesses', g, key)).toBe(recordValueText('fewest_guesses', g, m.guessSemantics, m.guessBase));
        }
        expect(recordValue('fastest_win', 75, key)).toBe(recordValueText('fastest_win', 75));
        expect(fewestRecordLabel(m.guessSemantics)).toBe(fewestRecordTitle(m.guessSemantics));
      });
    });
  }

  it('the Moments More Games Sweep counts the same set the feed route reads', () => {
    expect(moreSweepModeKeys(MODES)).toEqual(MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey).map((m) => m.dbKey));
    const route = read('app/api/friends/feed/route.ts');
    expect(route).toContain('moreSweepModeKeys(MODES)');
    const feed = read('components/friends/activity-feed.tsx');
    expect(feed).not.toMatch(/all ten/);
    expect(feed).toContain('modeMomentHeadline');
  });

  it('Stats VS boards include every game with live VS (ProperNoundle too)', () => {
    expect(read('app/stats/page.tsx')).toMatch(/const vsModes = useMemo\(\(\) => \[\.\.\.SWEEP_MODES, \.\.\.MORE_GAME_MODES/);
  });

  it('every recorded game (Unlimited, VS, bots) refreshes the Stats bundle, not only dailies', () => {
    const svc = read('lib/stats-service.ts');
    expect((svc.match(/dispatchGameRecorded\(/g) ?? []).length).toBeGreaterThanOrEqual(4); // def + solo + VS + bots
    expect(read('components/providers/data-cache-provider.tsx')).toContain("addEventListener('game-recorded'");
  });

  it('a signed-in caller never reads a CDN copy of their match history', () => {
    expect(read('app/api/profile/[id]/matches/route.ts')).toMatch(/authed \? 'private, no-store'/);
  });
});
