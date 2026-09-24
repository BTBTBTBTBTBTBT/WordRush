import { describe, it, expect } from 'vitest';
import {
  CIPHER_CELL_MAX, CIPHER_CELL_MIN, CIPHER_CELL_STEP,
  cipherMetrics, cipherWordWidth, wrapCipherWords, cipherBlockHeight, cipherStripHeight, fitCipherCell,
} from './cipher-layout';

// §16 layout rule (founder 2026-09-24): the board + strip block is centred in
// the band and the cell scales to it — 64px down in 4px steps to a 40px floor —
// with the cipher wrapped word by word (words never split).
const CIPHER = 'XQD DZQFN AJ BXK NDQZ PJ XQD ADXNE PZ XQD YQZC';
const CHIPS = 14;

describe('cipherMetrics', () => {
  it('scales the code letter and the chips with the cell: 14px at the top, 11px chips / 10px code at the floor', () => {
    expect(cipherMetrics(CIPHER_CELL_MAX).chipFont).toBe(14);
    expect(cipherMetrics(CIPHER_CELL_MIN).chipFont).toBe(11);
    expect(cipherMetrics(CIPHER_CELL_MAX).codeFont).toBe(14);
    expect(cipherMetrics(CIPHER_CELL_MIN).codeFont).toBe(10);
  });
  it('keeps every derived size monotonic in the cell', () => {
    for (let c = CIPHER_CELL_MIN; c < CIPHER_CELL_MAX; c += CIPHER_CELL_STEP) {
      const a = cipherMetrics(c), b = cipherMetrics(c + CIPHER_CELL_STEP);
      expect(b.rowHeight).toBeGreaterThan(a.rowHeight);
      expect(b.wordGap).toBeGreaterThanOrEqual(a.wordGap);
      expect(b.cellGap).toBeGreaterThanOrEqual(a.cellGap);
      expect(b.chipFont).toBeGreaterThanOrEqual(a.chipFont);
    }
  });
});

describe('wrapCipherWords', () => {
  it('never splits a word and keeps every word in order', () => {
    const lines = wrapCipherWords(CIPHER, 48, 320);
    expect(lines.flat()).toEqual(CIPHER.split(' '));
    for (const line of lines) for (const w of line) expect(CIPHER.split(' ')).toContain(w);
  });
  it('keeps each line inside the available width', () => {
    for (const cell of [64, 52, 40]) {
      const m = cipherMetrics(cell);
      for (const width of [280, 360, 720]) {
        for (const line of wrapCipherWords(CIPHER, cell, width)) {
          const lineWidth = line.reduce((sum, w, i) => sum + cipherWordWidth(w, m) + (i ? m.wordGap : 0), 0);
          if (line.length > 1) expect(lineWidth).toBeLessThanOrEqual(width);
        }
      }
    }
  });
  it('packs greedily: a wider band needs no more lines than a narrower one', () => {
    expect(wrapCipherWords(CIPHER, 48, 720).length).toBeLessThanOrEqual(wrapCipherWords(CIPHER, 48, 320).length);
    expect(wrapCipherWords(CIPHER, 48, 10_000)).toEqual([CIPHER.split(' ')]);
  });
  it('gives an overlong word its own line rather than breaking it', () => {
    const lines = wrapCipherWords('AB CDEFGHIJKLMNOP QR', 64, 200);
    expect(lines).toEqual([['AB'], ['CDEFGHIJKLMNOP'], ['QR']]);
  });
  it('treats punctuation as part of its word', () => {
    const m = cipherMetrics(40);
    expect(cipherWordWidth("XQD'N,", m)).toBe(4 * m.cell + 2 * m.punctWidth + 5 * m.cellGap);
    expect(wrapCipherWords("XQD'N, ABC.", 40, 10_000)).toEqual([["XQD'N,", 'ABC.']]);
  });
  it('ignores empty words from double spaces', () => {
    expect(wrapCipherWords('AB  CD', 40, 10_000)).toEqual([['AB', 'CD']]);
  });
});

describe('fitCipherCell', () => {
  it('lands on the 64px cap when the band is tall', () => {
    expect(fitCipherCell(CIPHER, 380, 2000, CHIPS)).toBe(CIPHER_CELL_MAX);
  });
  it('floors at 40px when the band is tiny', () => {
    expect(fitCipherCell(CIPHER, 380, 100, CHIPS)).toBe(CIPHER_CELL_MIN);
  });
  it('steps in 4px increments between the cap and the floor', () => {
    for (let h = 100; h <= 2000; h += 37) {
      const cell = fitCipherCell(CIPHER, 380, h, CHIPS);
      expect(cell).toBeGreaterThanOrEqual(CIPHER_CELL_MIN);
      expect(cell).toBeLessThanOrEqual(CIPHER_CELL_MAX);
      expect((cell - CIPHER_CELL_MIN) % CIPHER_CELL_STEP).toBe(0);
    }
  });
  it('picks the largest cell whose block fits the band height', () => {
    const width = 380, height = 520;
    const cell = fitCipherCell(CIPHER, width, height, CHIPS);
    expect(cipherBlockHeight(CIPHER, cell, width, CHIPS)).toBeLessThanOrEqual(height);
    if (cell < CIPHER_CELL_MAX) expect(cipherBlockHeight(CIPHER, cell + CIPHER_CELL_STEP, width, CHIPS)).toBeGreaterThan(height);
  });
  it('never shrinks when the band grows', () => {
    let prev = CIPHER_CELL_MIN;
    for (let h = 100; h <= 2000; h += 25) {
      const cell = fitCipherCell(CIPHER, 380, h, CHIPS);
      expect(cell).toBeGreaterThanOrEqual(prev);
      prev = cell;
    }
  });
  it('steps down so the longest word fits the band width', () => {
    const cell = fitCipherCell('XQ ABCDEFGH XQ', 360, 2000, 10);
    expect(cell).toBeLessThan(CIPHER_CELL_MAX);
    const m = cipherMetrics(cell);
    expect(cipherWordWidth('ABCDEFGH', m)).toBeLessThanOrEqual(360);
  });
  it('phone band: a 44-letter saying at 380×520 (a 6.1-inch phone minus header, capsules and keyboard) sits between the floor and the cap', () => {
    const cell = fitCipherCell(CIPHER, 380, 520, CHIPS);
    expect(cell).toBeGreaterThan(CIPHER_CELL_MIN);
    expect(cell).toBeLessThan(CIPHER_CELL_MAX);
  });
});

describe('cipherStripHeight', () => {
  it('is zero without chips and grows by whole chip rows', () => {
    expect(cipherStripHeight(0, 64, 380)).toBe(0);
    const one = cipherStripHeight(1, 64, 380);
    const m = cipherMetrics(64);
    expect(one).toBe(m.chipHeight);
    expect(cipherStripHeight(40, 64, 380)).toBeGreaterThan(one);
  });
});
