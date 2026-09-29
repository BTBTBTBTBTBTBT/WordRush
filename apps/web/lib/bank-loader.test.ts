import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import {
  hubPuzzleForDay, hubPuzzleForSeed, crosswordPuzzleForDay, crosswordPuzzleForSeed, wordsearchPuzzleForDay, wordsearchPuzzleForSeed,
  scramblePuzzleForDay, scramblePuzzleForSeed, groupsPuzzleForDay, groupsPuzzleForSeed, cryptogramPuzzleForDay, cryptogramPuzzleForSeed,
  ladderPuzzleForDay, ladderPuzzleForSeed, type HolidayTable,
} from '@wordle-duel/core';
import { bankEntryPath, type BankGame } from './bank-loader';
import { HOLIDAY_TABLE } from './holidays';

// The web fetches one bank entry per puzzle (founder, 2026-09-29): the core's
// selector runs on a stub bank and the chosen file is fetched. This pins that
// the stub path picks EXACTLY the entry the core picks from the real bank
// (daily, holiday and Unlimited), and that the checked-in manifest matches
// data/ — run `node scripts/split-banks.js` after editing a bank.
const require = createRequire(import.meta.url);
const { computeManifest } = require('../scripts/split-banks.js') as { computeManifest: () => unknown };
const root = path.resolve(__dirname, '..');
const readBank = (g: string) => JSON.parse(fs.readFileSync(path.join(root, 'data', `${g}-puzzles.json`), 'utf8'));

type Sel = { day: (b: any, d: string, t?: HolidayTable | null) => unknown; seed: (b: any, s: string) => unknown };
const GAMES: Record<BankGame, Sel> = {
  hub: { day: hubPuzzleForDay, seed: hubPuzzleForSeed },
  crossword: { day: crosswordPuzzleForDay, seed: crosswordPuzzleForSeed },
  wordsearch: { day: wordsearchPuzzleForDay, seed: wordsearchPuzzleForSeed },
  scramble: { day: scramblePuzzleForDay, seed: scramblePuzzleForSeed },
  groups: { day: groupsPuzzleForDay, seed: groupsPuzzleForSeed },
  cryptogram: { day: cryptogramPuzzleForDay, seed: cryptogramPuzzleForSeed },
  ladder: { day: ladderPuzzleForDay, seed: ladderPuzzleForSeed },
};

function entryAt(bank: any, rel: string) {
  const name = rel.split('/').pop()!.replace(/\.json$/, '');
  const h = /^h-(.+)-(\d+)$/.exec(name);
  if (h) return bank.holiday[h[1]][Number(h[2])];
  return (name[0] === 'd' ? bank.daily : bank.extra)[Number(name.slice(1))];
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

describe('bank manifest', () => {
  it('lib/banks-manifest.json matches data/ (run node scripts/split-banks.js)', () => {
    expect(JSON.parse(fs.readFileSync(path.join(root, 'lib', 'banks-manifest.json'), 'utf8'))).toEqual(computeManifest());
  });
});

describe('stub-bank selection equals the core on the real bank', () => {
  for (const [game, sel] of Object.entries(GAMES) as [BankGame, Sel][]) {
    it(game, () => {
      const bank = readBank(game);
      const days = new Set<string>(Object.keys(HOLIDAY_TABLE.days));
      for (let i = -30; i < 900; i++) days.add(addDays(bank.epoch, i));
      for (const day of days) {
        const rel = bankEntryPath(game, (b) => sel.day(b, day, HOLIDAY_TABLE));
        const want = sel.day(bank, day, HOLIDAY_TABLE);
        expect(rel ? entryAt(bank, rel) : null, `${game} ${day}`).toBe(want);
      }
      for (let i = 0; i < 400; i++) {
        const seed = `unlimited-${game.toUpperCase()}-${1_790_000_000_000 + i * 7919}`;
        const rel = bankEntryPath(game, (b) => sel.seed(b, seed));
        expect(rel ? entryAt(bank, rel) : null, `${game} ${seed}`).toBe(sel.seed(bank, seed));
      }
    });
  }
});
