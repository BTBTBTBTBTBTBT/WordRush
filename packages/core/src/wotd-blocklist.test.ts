import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WOTD_BLOCKLIST, isBlockedWordOfDay } from './wotd-blocklist';

const REPO = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

describe('isBlockedWordOfDay', () => {
  it('blocks the word that started this — HYMEN', () => {
    expect(isBlockedWordOfDay('HYMEN')).toBe(true);
  });

  it('is case-insensitive, since call sites pass mixed case', () => {
    expect(isBlockedWordOfDay('hymen')).toBe(true);
    expect(isBlockedWordOfDay('Hymen')).toBe(true);
  });

  it('does NOT block ordinary words that merely look alarming', () => {
    // Each of these has a completely innocuous first definition; over-blocking
    // would quietly shrink the featured pool for no reason.
    for (const w of ['COLON', 'STOOL', 'SHOOT', 'JOINT', 'DEATH', 'CRACK', 'NAKED', 'DRUNK']) {
      expect(isBlockedWordOfDay(w), `${w} should stay featurable`).toBe(false);
    }
  });
});

describe('blocklist mirrors', () => {
  // The candidate walk is re-implemented in three other languages. A word added
  // here but not there would still be featured on that platform, which is the
  // whole failure this list exists to prevent.
  const mirrors: [string, string][] = [
    ['web home card', 'apps/web/app/page.tsx'],
    ['iOS', 'apps/ios/Wordocious/Sources/WordOfTheDayView.swift'],
    ['Android', 'apps/android/app/src/main/kotlin/com/wordocious/app/ui/HomeScreen.kt'],
  ];

  it('every blocked word appears in the iOS and Android copies', () => {
    for (const [name, file] of [mirrors[1], mirrors[2]]) {
      const src = read(file);
      for (const word of WOTD_BLOCKLIST) {
        expect(src.includes(`"${word}"`), `${name} is missing ${word}`).toBe(true);
      }
    }
  });

  it('every call site actually consults a blocklist', () => {
    expect(read(mirrors[0][1])).toContain('isBlockedWordOfDay');
    expect(read('apps/web/lib/word-of-day.ts')).toContain('isBlockedWordOfDay');
    expect(read(mirrors[1][1])).toContain('Self.blocked.contains');
    expect(read(mirrors[2][1])).toContain('WOTD_BLOCKED');
  });
});

describe('the blocked words are really in the answer pool', () => {
  // If a word is not in solutions.json it can never be featured anyway, and a
  // stale entry here is dead weight that hides a real gap.
  it('each entry is a current solution', () => {
    const solutions: string[] = JSON.parse(read('apps/web/data/solutions.json'));
    const pool = new Set(solutions);
    const absent = WOTD_BLOCKLIST.filter((w) => !pool.has(w));
    expect(absent, `not in solutions.json: ${absent.join(', ')}`).toEqual([]);
  });
});
