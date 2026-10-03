import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { join } from 'node:path';
import {
  isPerfectDailyResult, modeMomentHeadline, moreSweepModeKeys, moreSweepMomentText, recordMomentLabel, recordValueText, guessStatText, countWord,
} from './mode-coverage';
import {
  loadCatalogModes, renderModeCoverageJson, MODE_COVERAGE_FIXTURE, MODE_COVERAGE_FIXTURE_DIRS,
} from '../scripts/gen-mode-coverage-fixtures';

// FINISH_SPEC BJ12 — every game reaches Stats (Today + All-time + recent) and
// Friends Moments. Table-driven over EVERY catalog mode: a game added to
// modes.json is checked here the day it lands, with no list to update.

const repo = join(__dirname, '..', '..', '..');
const read = (...p: string[]) => fs.readFileSync(join(repo, ...p), 'utf8');
const modes = loadCatalogModes();
const recordable = modes.filter((m) => m.dbKey);
const daily = recordable.filter((m) => m.enabled && m.dailyEligible);

// The generated catalogs every platform reads its mode list from.
const WEB_CATALOG = read('apps', 'web', 'lib', 'modes.generated.ts');
const IOS_CATALOG = read('apps', 'ios', 'Wordocious', 'Sources', 'ModeCatalog.generated.swift');
const ANDROID_CATALOG = read('apps', 'android', 'app', 'src', 'main', 'kotlin', 'com', 'wordocious', 'app', 'ModeCatalog.generated.kt');

describe('BJ12 mode coverage: every mode, every surface', () => {
  it('the catalog has every game the founder named', () => {
    const keys = recordable.map((m) => m.dbKey);
    for (const k of ['DUEL', 'DUEL_6', 'DUEL_7', 'QUORDLE', 'OCTORDLE', 'RESCUE', 'SEQUENCE', 'PROPERNOUNDLE', 'GAUNTLET',
      'SCRAMBLE', 'HUB', 'SUDOKU', 'REGIONS', 'LADDER', 'WORDSEARCH', 'CRYPTOGRAM', 'GROUPS', 'CROSSWORD']) {
      expect(keys, k).toContain(k);
    }
  });

  for (const m of recordable) {
    const key = m.dbKey as string;
    describe(`${key} (${m.title})`, () => {
      it('is in every platform\'s generated catalog with the same title (stats key, picker, recent-match label)', () => {
        expect(WEB_CATALOG).toContain(`"dbKey": "${key}"`);
        expect(WEB_CATALOG).toContain(`"title": "${m.title}"`);
        expect(IOS_CATALOG).toContain(`dbKey: "${key}", title: "${m.title}"`);
        expect(ANDROID_CATALOG).toContain(`"${key}", "${m.title}"`);
      });

      if (m.enabled && m.dailyEligible) {
        it('a perfect daily earns the Perfect medal (the Moments "played a perfect" row)', () => {
          const total = m.group === 'more' || m.guessBase === 1 ? 1 : m.guessBase;
          expect(isPerfectDailyResult(key, m, m.guessBase, total, total, true)).toBe(true);
          expect(isPerfectDailyResult(key, m, m.guessBase, total, total, false)).toBe(false);
          if (key !== 'GAUNTLET') expect(isPerfectDailyResult(key, m, m.guessBase + 1, total, total, true)).toBe(false);
        });
      }

      it('its Moments headlines name the game', () => {
        const ev = (type: string, kind: string) => ({ type, kind, me: false, username: 'Doug', gameMode: key, gameTitle: m.title });
        expect(modeMomentHeadline(ev('medal', 'gold'), m.guessSemantics, null)).toBe(`Doug took gold in ${m.title}`);
        expect(modeMomentHeadline(ev('medal', 'perfect'), m.guessSemantics, null)).toBe(`Doug played a perfect ${m.title}`);
        const v = recordValueText('fewest_guesses', m.guessBase, m.guessSemantics, m.guessBase);
        expect(modeMomentHeadline(ev('record', 'fewest_guesses'), m.guessSemantics, v))
          .toBe(`Doug set the all-time ${m.title} ${recordMomentLabel('fewest_guesses', m.guessSemantics)} · ${v}`);
      });
    });
  }

  it('the More Games Sweep counts every More Games daily, and its copy says how many', () => {
    const keys = moreSweepModeKeys(modes);
    expect(keys).toEqual(daily.filter((m) => m.group === 'more').map((m) => m.dbKey));
    expect(keys.length).toBeGreaterThan(0);
    expect(moreSweepMomentText('Doug', false, keys.length)).toBe(`Doug — More Games Sweep, all ${countWord(keys.length)} played`);
    expect(moreSweepMomentText('You', true, 10)).toBe('You — Flawless More Games, all ten won');
  });

  it('a "fewest" record reads through the mode (Sudocious "Fewest Mistakes · 0 mistakes", Letter Ladder "Best vs Par · Par")', () => {
    expect(recordMomentLabel('fewest_guesses', 'mistakes')).toBe('Fewest Mistakes');
    expect(recordValueText('fewest_guesses', 1, 'mistakes', 1)).toBe('0 mistakes');
    expect(recordMomentLabel('fewest_guesses', 'overPar')).toBe('Best vs Par');
    expect(recordValueText('fewest_guesses', 1, 'overPar', 1)).toBe('Par');
    expect(recordValueText('fewest_guesses', 1, 'rank', 1)).toBe('Pandemonium');
    expect(recordValueText('fewest_guesses', 3, 'guesses', 1)).toBe('3 guesses');
    expect(recordValueText('fastest_win', 75)).toBe('1m 15s');
    expect(guessStatText('misses', 10, 12)).toBe('2 misses');
  });

  it('the word modes keep their shipped Perfect rules', () => {
    expect(isPerfectDailyResult('DUEL', undefined, 1, 1, 1, true)).toBe(true);
    expect(isPerfectDailyResult('DUEL', undefined, 2, 1, 1, true)).toBe(false);
    expect(isPerfectDailyResult('QUORDLE', undefined, 4, 4, 4, true)).toBe(true);
    expect(isPerfectDailyResult('QUORDLE', undefined, 4, 3, 4, true)).toBe(false);
    expect(isPerfectDailyResult('GAUNTLET', undefined, 30, 21, 21, true)).toBe(true);
    expect(isPerfectDailyResult('UNKNOWN', undefined, 1, 1, 1, true)).toBe(false);
  });

  for (const dir of MODE_COVERAGE_FIXTURE_DIRS) {
    it(`${MODE_COVERAGE_FIXTURE} in ${dir.includes('ios') ? 'iOS' : 'Android'} matches the TS core`, () => {
      expect(fs.readFileSync(join(dir, MODE_COVERAGE_FIXTURE), 'utf8')).toBe(renderModeCoverageJson());
    });
  }
});
