import { describe, it, expect } from 'vitest';
import * as S from './safety.mjs';
import { gateBank, bankItems, itemProblems } from './gate.mjs';

// Offensive samples are never written in plain text (docs/CONTENT-SAFETY.md): base64 here, decoded at runtime.
const dec = (b: string) => Buffer.from(b, 'base64').toString('utf8');
const ROOT = dec('U0hJVA=='); // a hard root (masked S***)
const EXACT = dec('Qk9ORVI='); // an exact-list word (masked B****)

describe('content-safety module (prompt 05c)', () => {
  it('isOffensive: exact words, roots inside words, leet spellings, phrases in clues — not innocent look-alikes', () => {
    expect(S.isOffensive(EXACT)).toBe(true);
    expect(S.isOffensive(`${ROOT}TY`)).toBe(true);
    expect(S.isOffensive(`${ROOT[0]}${ROOT[1]}1${ROOT[3]}`)).toBe(true);
    expect(S.isOffensive(`what a ${ROOT.toLowerCase()}ty day`)).toBe(true);
    for (const ok of ['SHIITAKE', 'Scunthorpe', 'COCKTAIL', 'ASSET', 'CLASSIC', 'HOUSE', 'Call me at 2455']) expect(S.isOffensive(ok), ok).toBe(false);
  });

  it('masks and finds plain-text leaks without ever returning the word', () => {
    expect(S.mask(EXACT)).toBe('B****');
    expect(S.leaks(`notes: ${EXACT.toLowerCase()} here`)).toEqual(['B****']);
    expect(S.leaks('nothing to see')).toEqual([]);
  });

  it('isBritishOnly, isObscure, mustAccept', () => {
    expect(S.isBritishOnly('COLOUR')).toBe(true);
    expect(S.isBritishOnly('COLOR')).toBe(false);
    expect(S.isBritishOnly('Pull your socks up and try again')).toBe(true);
    expect(S.isObscure('SLUICE')).toBe(true); // curated list
    expect(S.isObscure('HOUSE')).toBe(false);
    expect(S.zipf('HOUSE')).toBeGreaterThan(5);
    expect(S.isMustAccept('AUNTY')).toBe(true);
    expect(S.mustAccept()).toContain('NIECE');
    expect(S.mustAccept().some((w) => S.isBritishOnly(w) || S.isOffensive(w))).toBe(false);
  });

  it("the generators' gate refuses a bank with a bad unseen puzzle and ignores served ones", async () => {
    const opts = { from: '2026-10-13', holidayDays: {} };
    const ladder = (id: string, path: string[]) => ({ id, start: path[0], end: path[path.length - 1], par: path.length - 1, path });
    const clean = { daily: Array.from({ length: 25 }, (_, i) => ladder(`ld${i}`, ['COLD', 'CORD', 'WORD', 'WARD', 'WARM'])), extra: [] as any[] };
    expect(await gateBank('ladder', clean, opts)).toBe(5); // 2026-10-13 is daily#20
    const served = structuredClone(clean); served.daily[3].path[2] = EXACT; // already served: frozen, not re-judged
    expect(await gateBank('ladder', served, opts)).toBe(5);
    const bad = structuredClone(clean); bad.daily[21].path[2] = EXACT;
    await expect(gateBank('ladder', bad, opts)).rejects.toThrow(/offensive {2}ladder ld21 \(daily#21\): .*B\*\*\*\*/);
    const brit = structuredClone(clean); brit.extra.push(ladder('ldx', ['COLOUR', 'COLOR']));
    expect(itemProblems(bankItems('ladder', brit, opts)).g2.join()).toMatch(/COLOUR/);
    expect(() => bankItems('newgame', clean, opts)).toThrow(/no extractor/);
  });
});
