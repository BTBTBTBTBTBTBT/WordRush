import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cryptogramPuzzleForDay, cryptogramPuzzleForSeed, cryptogramDailyNumber, cryptogramEncipher, cryptogramPlainFor, cryptogramCodeFor,
  cryptogramCodeLetters, cryptogramFrequencies, cryptogramHintTarget, cryptogramGuessCount, cryptogramConflicts, cryptogramIsSolved,
  createCryptogramState, cryptogramReduce, cryptogramMatchRow, reconstructCryptogram, CRYPTOGRAM_ALPHABET, type CryptogramBank,
} from './cryptogram';
import { holidayKeyForDay, holidayOccurrence, bankHolidayPick, type HolidayTable } from '../bank';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'cryptogram-puzzles.json'), 'utf8')) as CryptogramBank;
const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;

describe('holiday calendar helpers (§20)', () => {
  it('names holidays, counts outings, and picks entries in calendar order', () => {
    expect(holidayKeyForDay('2026-12-25', table)).toBe('christmas');
    expect(holidayKeyForDay('2026-09-23', table)).toBeNull();
    expect(holidayOccurrence('2026-12-24', 'christmas', table)).toBe(0);
    expect(holidayOccurrence('2026-12-26', 'christmas', table)).toBe(2);
    expect(holidayOccurrence('2027-12-25', 'christmas', table)).toBe(4);
    const three = { christmas: ['a', 'b', 'c'] };
    expect(bankHolidayPick('2026-12-26', table, three)).toEqual({ key: 'christmas', index: 2, entry: 'c' });
    expect(bankHolidayPick('2027-12-24', table, three)?.entry).toBe('a');       // wraps: outing 3 → index 0
    expect(bankHolidayPick('2026-12-25', table, {})).toBeNull();
    expect(bankHolidayPick('2026-09-23', table, three)).toBeNull();
    expect(bankHolidayPick('2026-12-25', null, three)).toBeNull();
  });
});

describe('Codebreaker bank', () => {
  it('has a year of dailies, an Unlimited pool, holiday sets, and honest puzzles', () => {
    expect(bank.epoch).toBe('2026-09-23');
    expect(bank.daily.length).toBeGreaterThanOrEqual(365);
    expect(bank.extra.length).toBeGreaterThanOrEqual(30);
    expect(Object.keys(bank.holiday ?? {}).length).toBe(28);
    expect(cryptogramPuzzleForDay(bank, '2026-09-23', table)?.id).toBe(bank.daily[0].id);
    expect(cryptogramPuzzleForDay(bank, '2026-12-25', table)?.holiday).toBe('christmas');
    expect(cryptogramPuzzleForDay(bank, '2026-12-25', null)?.holiday).toBeUndefined();
    expect(cryptogramDailyNumber('2026-09-23')).toBe(1);
    expect(bank.extra.some((q) => q.id === cryptogramPuzzleForSeed(bank, 'unlimited-CRYPTOGRAM-1')?.id)).toBe(true);
    const ids = new Set<string>();
    for (const p of [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()]) {
      expect(ids.has(p.id), `${p.id} duplicate id`).toBe(false); ids.add(p.id);
      expect(p.key, p.id).toMatch(/^[A-Z]{26}$/);
      expect(new Set(p.key).size, p.id).toBe(26);
      for (let i = 0; i < 26; i++) expect(p.key[i], `${p.id} key fixes ${CRYPTOGRAM_ALPHABET[i]}`).not.toBe(CRYPTOGRAM_ALPHABET[i]);
      expect(p.text.length).toBeGreaterThanOrEqual(30); expect(p.text.length).toBeLessThanOrEqual(90);
      expect(p.given.length).toBe(3);
      const letters = cryptogramCodeLetters(cryptogramEncipher(p.text, p.key));
      expect(letters.length).toBeGreaterThanOrEqual(10); expect(letters.length).toBeLessThanOrEqual(22);
      for (const g of p.given) expect(p.text.toUpperCase().includes(g), `${p.id} given ${g}`).toBe(true);
    }
  });
});

describe('Codebreaker reducer', () => {
  const p = bank.daily[0];
  const truth = (code: string) => cryptogramPlainFor(code, p.key);

  it('starts with the given letters locked and enciphers consistently', () => {
    const s = createCryptogramState(p, 'fixture', 0);
    expect(s.cipher).toBe(cryptogramEncipher(p.text, p.key));
    expect(s.cipher.replace(/[^A-Z]/g, '').length).toBe(p.text.toUpperCase().replace(/[^A-Z]/g, '').length);
    for (const g of p.given) { const code = cryptogramCodeFor(g, p.key); expect(s.mapping[code]).toBe(g); expect(s.locked).toContain(code); }
    expect(cryptogramFrequencies(s.cipher)[cryptogramCodeFor(p.given[0], p.key)]).toBeGreaterThan(0);
  });

  it('pencils freely, flags conflicts, checks lock right and clear wrong, and completes itself', () => {
    let s = createCryptogramState(p, 'fixture', 0);
    const free = cryptogramCodeLetters(s.cipher).filter((c) => !s.locked.includes(c));
    const [a, b] = free;
    s = cryptogramReduce(s, { type: 'SET', code: a, plain: truth(a) }); expect(s.mapping[a]).toBe(truth(a)); expect(s.events).toEqual([`=${a}:${truth(a)}`]);
    s = cryptogramReduce(s, { type: 'SET', code: b, plain: truth(a) }); expect(cryptogramConflicts(s.mapping)).toEqual([truth(a)]);
    s = cryptogramReduce(s, { type: 'SET', code: s.locked[0], plain: 'Q' }); expect(s.mapping[s.locked[0]]).not.toBe('Q');   // locked letters never change
    s = cryptogramReduce(s, { type: 'CHECK' });
    expect(s.checks).toBe(1); expect(s.locked).toContain(a); expect(s.mapping[b]).toBeUndefined(); expect(s.lastWrong).toEqual([b]); expect(s.events.at(-1)).toBe('#1');
    expect(cryptogramGuessCount(s.checks)).toBe(2); expect(cryptogramGuessCount(0)).toBe(1); expect(cryptogramGuessCount(7)).toBe(4);
    for (const c of free) if (!s.locked.includes(c)) s = cryptogramReduce(s, { type: 'SET', code: c, plain: truth(c) }, 55);
    expect(cryptogramIsSolved(s)).toBe(true); expect(s.status).toBe('won'); expect(s.ended).toBe(true); expect(s.endTime).toBe(55);
    const before = s;
    s = cryptogramReduce(s, { type: 'SET', code: a, plain: 'Q' }); expect(s).toBe(before);            // ended: no-op
  });

  it('hints fill the most frequent unresolved letter and reveal records a loss', () => {
    let s = createCryptogramState(p, 'fixture', 0);
    const target = cryptogramHintTarget(s)!;
    expect(s.locked.includes(target) && s.mapping[target] === truth(target)).toBe(false);
    s = cryptogramReduce(s, { type: 'HINT' });
    expect(s.mapping[target]).toBe(truth(target)); expect(s.locked).toContain(target); expect(s.hintsUsed).toBe(1); expect(s.events).toEqual([`?${target}`]);
    s = cryptogramReduce(s, { type: 'REVEAL' }, 300);
    expect(s.status).toBe('lost'); expect(s.ended).toBe(true); expect(cryptogramIsSolved(s)).toBe(true); expect(s.events.at(-1)).toBe('!');
    const row = cryptogramMatchRow(s);
    expect(row.solutions).toEqual([p.text, p.key, p.id]);
    expect(row.guesses[0]).toMatch(/^=[A-Z.]{26}$/); expect(row.guesses[1]).toMatch(/^h[ghrl.]{26}$/); expect(row.guesses[2]).toBe('c0');
    const r = reconstructCryptogram(row.solutions, row.guesses)!;
    expect(r.revealed).toBe(true); expect(r.solved).toBe(false); expect(r.correct).toBe(r.total); expect(r.given.sort()).toEqual([...p.given].sort()); expect(r.hinted).toEqual([target]);
    expect(reconstructCryptogram(['x', 'ABC'], [])).toBeNull();
  });
});
