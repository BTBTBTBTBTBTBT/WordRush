// FINISH_SPEC BJ12: renders mode-coverage-fixtures.json — every catalog mode
// with the rules that take a finished game into Stats and Friends Moments
// (Perfect medal, the Moments headlines for its medals and records, the More
// Games Sweep count). The Swift (ModeCoverageFixtureTests) and Kotlin
// (ModeCoverageFixtureTest) ports assert against it; packages/core
// src/mode-coverage.test.ts fails when the committed copies drift.
//
//   Regenerate:  apps/server/node_modules/.bin/tsx packages/core/scripts/gen-mode-coverage-fixtures.ts

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPerfectDailyResult, modeMomentHeadline, moreSweepModeKeys, moreSweepMomentText, recordValueText,
  type CoverageModeMeta,
} from '../src/mode-coverage';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

export const MODE_COVERAGE_FIXTURE_DIRS = [
  join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
  join(repo, 'apps', 'android', 'app', 'src', 'test', 'resources', 'fixtures'),
];
export const MODE_COVERAGE_FIXTURE = 'mode-coverage-fixtures.json';

interface CatalogMode extends CoverageModeMeta { id: string; title: string }

export function loadCatalogModes(): CatalogMode[] {
  const raw = JSON.parse(fs.readFileSync(join(repo, 'packages', 'core', 'modes.json'), 'utf8'));
  return raw.modes as CatalogMode[];
}

/** Boards in a full solve, for the case inputs (word modes: the guessBase boards; puzzles: one board and a 3-board variant). */
const boardsFor = (m: CatalogMode): number => (m.dbKey === 'DUEL' || m.dbKey === 'DUEL_6' || m.dbKey === 'DUEL_7' || m.dbKey === 'PROPERNOUNDLE' || m.group === 'more' ? 1 : m.guessBase);

export function renderModeCoverageFixtures() {
  const modes = loadCatalogModes();
  const rows = modes.filter((m) => m.dbKey).map((m) => {
    const key = m.dbKey as string;
    const total = boardsFor(m);
    const inputs: Array<[number, number, number, boolean]> = [
      [m.guessBase, total, total, true],          // the minimum, every board
      [m.guessBase + 1, total, total, true],      // one over
      [m.guessBase, Math.max(0, total - 1), total, true], // a board short
      [m.guessBase, total, total, false],         // not completed
      [m.guessBase, 3, 3, true],                  // a 3-board puzzle at the minimum
      [1, total, total, true],                    // one guess
    ];
    const perfect = inputs.map(([g, b, t, c]) => ({ guessCount: g, boardsSolved: b, totalBoards: t, completed: c, expected: isPerfectDailyResult(key, m, g, b, t, c) }));
    const ev = (type: string, kind: string, me = false) => ({ type, kind, me, username: 'Doug', gameMode: key, gameTitle: m.title });
    const fewest = recordValueText('fewest_guesses', m.guessBase, m.guessSemantics, m.guessBase);
    const fastest = recordValueText('fastest_win', 75, m.guessSemantics, m.guessBase);
    return {
      dbKey: key,
      id: m.id,
      title: m.title,
      group: m.group,
      guessSemantics: m.guessSemantics,
      guessBase: m.guessBase,
      dailyEligible: m.dailyEligible,
      enabled: m.enabled,
      perfect,
      moments: {
        gold: modeMomentHeadline(ev('medal', 'gold'), m.guessSemantics, null),
        bronze: modeMomentHeadline(ev('medal', 'bronze'), m.guessSemantics, null),
        perfect: modeMomentHeadline(ev('medal', 'perfect', true), m.guessSemantics, null),
        fewestValue: fewest,
        fewest: modeMomentHeadline(ev('record', 'fewest_guesses'), m.guessSemantics, fewest),
        fastestValue: fastest,
        fastest: modeMomentHeadline(ev('record', 'fastest_win'), m.guessSemantics, fastest),
      },
    };
  });
  const more = moreSweepModeKeys(modes);
  return {
    modes: rows,
    moreSweep: {
      keys: more,
      sweep: moreSweepMomentText('Doug', false, more.length),
      flawless: moreSweepMomentText('You', true, more.length),
    },
  };
}

export const renderModeCoverageJson = (): string => JSON.stringify(renderModeCoverageFixtures(), null, 2) + '\n';

const isMain = process.argv[1]?.endsWith('gen-mode-coverage-fixtures.ts') ?? false;
if (isMain) {
  const json = renderModeCoverageJson();
  for (const dir of MODE_COVERAGE_FIXTURE_DIRS) {
    fs.writeFileSync(join(dir, MODE_COVERAGE_FIXTURE), json);
    console.log(`wrote ${join(dir, MODE_COVERAGE_FIXTURE)}`);
  }
}
