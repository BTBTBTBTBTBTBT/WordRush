import { describe, expect, it } from 'vitest';
import { TRAY } from './game-tray';
import {
  cellsTurnedOn, cipherCellLook, crosswordCellLook, glossyChip, glossyFill, lockFlipDelay, LOCK_FLIP, tintedChip, trayChrome,
} from './puzzle-look';

describe('crosswordCellLook (FINISH_SPEC J3)', () => {
  it('reveals in hint violet, locks in purple, pencils as typed, else frosted empty', () => {
    expect(crosswordCellLook({ letter: 'A', locked: true, revealed: true })).toBe('hint');
    expect(crosswordCellLook({ letter: 'A', locked: true, revealed: false })).toBe('correct');
    expect(crosswordCellLook({ letter: 'A', locked: false, revealed: false })).toBe('typed');
    expect(crosswordCellLook({ letter: '', locked: false, revealed: false })).toBe('empty');
  });
});

describe('cipherCellLook (FINISH_SPEC J3)', () => {
  const base = { plain: 'E', locked: false, hinted: false, given: false, finished: false, correct: false };
  it('hint violet beats given beats locked purple', () => {
    expect(cipherCellLook({ ...base, locked: true, hinted: true, given: true })).toBe('hint');
    expect(cipherCellLook({ ...base, locked: true, given: true })).toBe('given');
    expect(cipherCellLook({ ...base, locked: true })).toBe('correct');
  });
  it('a right letter turns purple once the round is over; otherwise penciled = typed', () => {
    expect(cipherCellLook({ ...base, finished: true, correct: true })).toBe('correct');
    expect(cipherCellLook({ ...base, finished: true, correct: false })).toBe('typed');
    expect(cipherCellLook(base)).toBe('typed');
    expect(cipherCellLook({ ...base, plain: '' })).toBe('empty');
    expect(cipherCellLook({ ...base, plain: '', finished: true, correct: true })).toBe('empty');
  });
});

describe('cellsTurnedOn', () => {
  const on = (ch: string) => ch === '1';
  it('lists the cells that just switched on, in reading order', () => {
    expect(cellsTurnedOn('0100', '1110', on)).toEqual([0, 2]);
    expect(cellsTurnedOn('1..', '1ab', (ch) => ch !== '.')).toEqual([1, 2]);
  });
  it('plays nothing on a first render, a new board or a cell switching off', () => {
    expect(cellsTurnedOn(null, '111', on)).toEqual([]);
    expect(cellsTurnedOn(undefined, '111', on)).toEqual([]);
    expect(cellsTurnedOn('00', '111', on)).toEqual([]);
    expect(cellsTurnedOn('11', '01', on)).toEqual([]);
  });
});

describe('lockFlipDelay', () => {
  it('staggers and caps', () => {
    expect(lockFlipDelay(0)).toBe(0);
    expect(lockFlipDelay(2)).toBe(2 * LOCK_FLIP.stagger);
    expect(lockFlipDelay(500)).toBe(LOCK_FLIP.maxSteps * LOCK_FLIP.stagger);
  });
});

describe('trayChrome', () => {
  it('is padding + border on both sides, plus the lip below', () => {
    expect(trayChrome()).toEqual({ x: 2 * (TRAY.padding + 1.5), y: 2 * (TRAY.padding + 1.5) + TRAY.lip });
    expect(trayChrome(8, 2)).toEqual({ x: 20, y: 20 + TRAY.lip });
  });
});

describe('glossy + tinted chips', () => {
  it('fills glossy chips in the accent with a lip, white ink and an optional glow', () => {
    expect(glossyFill('#9f1239')).toContain('#9f1239 70%');
    const s = glossyChip('#9f1239');
    expect(s.color).toBe('#ffffff');
    expect(String(s.background)).toContain('rgba(255, 255, 255, 0.42)');
    expect(String(s.boxShadow)).toMatch(/^inset 0 -4px 0 #/);
    expect(String(glossyChip('#4d7c0f', { glow: true, lip: 0 }).boxShadow)).toContain('0 0 12px 1px #4d7c0f8c');
    expect(String(glossyChip('#4d7c0f', { lip: 0 }).boxShadow)).not.toContain('inset 0 -');
  });
  it('washes tinted chips over the card base (never plain white) with a gloss and a lip', () => {
    const s = tintedChip('#9f1239');
    expect(String(s.background)).toContain('var(--color-card-base');
    expect(String(s.background)).toContain('#9f12391f');
    expect(String(s.background)).toContain('var(--pz-gloss');
    expect(String(s.boxShadow)).toMatch(/^inset 0 -4px 0 #/);
  });
});
