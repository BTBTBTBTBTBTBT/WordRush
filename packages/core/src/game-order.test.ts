import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILIES_ORDER, DEFAULT_PUZZLES_ORDER, applyGameOrder, isDefaultOrder, moveGame, nextUnplayed, parseGameOrder, sortByOrder } from './game-order';

const D = [...DEFAULT_DAILIES_ORDER];

describe('game order (item 35)', () => {
  it('founder default: Classic, QuadWord, OctoWord, Succession, Six, Seven, Deliverance, Gauntlet', () => {
    expect(D).toEqual(['practice', 'quordle', 'octordle', 'sequence', 'six', 'seven', 'rescue', 'gauntlet']);
    expect(DEFAULT_PUZZLES_ORDER[DEFAULT_PUZZLES_ORDER.length - 1]).toBe('scramble');
  });
  it('no saved order = the default', () => {
    expect(applyGameOrder(D, null, 'practice')).toEqual(D);
    expect(applyGameOrder(D, [], 'practice')).toEqual(D);
  });
  it('Classic stays first even if a saved order buried it', () => {
    const saved = ['gauntlet', 'practice', 'six'];
    expect(applyGameOrder(D, saved, 'practice')[0]).toBe('practice');
    expect(applyGameOrder(D, saved, 'practice').slice(0, 3)).toEqual(['practice', 'gauntlet', 'six']);
  });
  it('drops unknown ids, collapses duplicates and appends new games at the end', () => {
    const out = applyGameOrder(D, ['seven', 'ghost', 'seven', 'six'], 'practice');
    expect(out).toEqual(['practice', 'seven', 'six', 'quordle', 'octordle', 'sequence', 'rescue', 'gauntlet']);
    expect(new Set(out).size).toBe(D.length);
  });
  it('puzzles have no pin', () => {
    const P = [...DEFAULT_PUZZLES_ORDER];
    expect(applyGameOrder(P, ['scramble'])[0]).toBe('scramble');
  });
  it('sortByOrder keeps unknown items at the end in their relative order', () => {
    const items = [{ id: 'x' }, { id: 'b' }, { id: 'y' }, { id: 'a' }];
    expect(sortByOrder(items, (t) => t.id, ['a', 'b']).map((t) => t.id)).toEqual(['a', 'b', 'x', 'y']);
  });
  it('moveGame cannot move or displace the pinned Classic', () => {
    expect(moveGame(D, 0, 3, 'practice')).toEqual(D);
    expect(moveGame(D, 3, 0, 'practice')[0]).toBe('practice');
    expect(moveGame(D, 7, 1, 'practice')).toEqual(['practice', 'gauntlet', 'quordle', 'octordle', 'sequence', 'six', 'seven', 'rescue']);
    expect(moveGame(D, 2, 2, 'practice')).toEqual(D);
    expect(moveGame(D, 2, 99, 'practice')).toEqual(D);
  });
  it('parseGameOrder rejects garbage and caps lists', () => {
    expect(parseGameOrder(null)).toBeNull();
    expect(parseGameOrder('x')).toBeNull();
    expect(parseGameOrder({ dailies: [1, 2], puzzles: 'no' })).toBeNull();
    expect(parseGameOrder({ dailies: ['six', 4], puzzles: [] })).toEqual({ dailies: ['six'], puzzles: [] });
  });
  it('isDefaultOrder lets Reset clear the saved row', () => {
    expect(isDefaultOrder(D, D, 'practice')).toBe(true);
    expect(isDefaultOrder(D, ['practice', 'six'], 'practice')).toBe(false);
    expect(isDefaultOrder(D, null, 'practice')).toBe(true);
  });
  it('NEXT = next unplayed in YOUR order, wrapping, null when all played', () => {
    const order = ['practice', 'six', 'seven', 'quordle'];
    expect(nextUnplayed(order, 'practice', new Set(['practice']))).toBe('six');
    expect(nextUnplayed(order, 'six', new Set(['practice', 'six', 'seven']))).toBe('quordle');
    expect(nextUnplayed(order, 'quordle', new Set(['quordle', 'six']))).toBe('practice');
    expect(nextUnplayed(order, 'quordle', new Set(order))).toBeNull();
    expect(nextUnplayed(order, 'unknown', new Set())).toBe('practice');
  });
});
