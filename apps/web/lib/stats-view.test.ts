import { describe, expect, it } from 'vitest';
import { SWEEP_KEY, pickerRows } from './game-picker';
import {
  VIEW_ALL, VIEW_SWEEP, VIEW_TODAY, parseViewParam, pickerKeyForView, swipeNeighbor, swipeOrder, todayBadges, viewForPickerKey, viewUrl,
} from './stats-view';

const isGame = (k: string) => k === 'DUEL' || k === 'GAUNTLET';

describe('Stats view ↔ picker (FINISH_SPEC C3)', () => {
  it('parses ?view=', () => {
    expect(parseViewParam(null, isGame)).toBe(VIEW_TODAY);
    expect(parseViewParam('all-time', isGame)).toBe(VIEW_ALL);
    expect(parseViewParam('all', isGame)).toBe(VIEW_ALL);
    expect(parseViewParam('vs', isGame)).toBe(VIEW_ALL);
    expect(parseViewParam('sweep', isGame)).toBe(VIEW_SWEEP);
    expect(parseViewParam(SWEEP_KEY, isGame)).toBe(VIEW_SWEEP);
    expect(parseViewParam('DUEL', isGame)).toBe('DUEL');
    expect(parseViewParam('NOPE', isGame)).toBe(VIEW_TODAY);
  });
  it('writes the URL', () => {
    expect(viewUrl(VIEW_TODAY)).toBe('/stats');
    expect(viewUrl(VIEW_ALL)).toBe('/stats?view=all-time');
    expect(viewUrl(VIEW_SWEEP)).toBe('/stats?view=sweep');
    expect(viewUrl('DUEL')).toBe('/stats?view=DUEL');
  });
  it('maps the broom tile to the Sweep view and back', () => {
    expect(viewForPickerKey(SWEEP_KEY)).toBe(VIEW_SWEEP);
    expect(viewForPickerKey('DUEL')).toBe('DUEL');
    expect(pickerKeyForView(VIEW_SWEEP)).toBe(SWEEP_KEY);
    expect(pickerKeyForView('DUEL')).toBe('DUEL');
  });
  it('selects no tile on Today / All-time', () => {
    expect(pickerKeyForView(VIEW_TODAY)).toBeNull();
    expect(pickerKeyForView(VIEW_ALL)).toBeNull();
  });
  it('swipes in the picker reading order', () => {
    const rows = pickerRows(() => true);
    const order = swipeOrder(rows);
    expect(order.slice(0, 3)).toEqual([VIEW_TODAY, VIEW_ALL, 'DUEL']);
    expect(order[2 + rows.wordocious.length - 1]).toBe(VIEW_SWEEP);
    expect(order).toHaveLength(2 + rows.wordocious.length + rows.puzzles.length);
    expect(swipeNeighbor(order, VIEW_TODAY, -1)).toBeNull();
    expect(swipeNeighbor(order, VIEW_TODAY, 1)).toBe(VIEW_ALL);
    expect(swipeNeighbor(order, rows.wordocious[rows.wordocious.length - 2].key, 1)).toBe(VIEW_SWEEP);
    expect(swipeNeighbor(order, VIEW_SWEEP, 1)).toBe(rows.puzzles[0]?.key ?? null);
    expect(swipeNeighbor(order, order[order.length - 1], 1)).toBeNull();
    expect(swipeNeighbor(order, 'NOPE', 1)).toBeNull();
  });
  it("badges today's results: purple W, slate L, the broom on a full sweep", () => {
    const rows = pickerRows(() => true);
    const sweepKeys = rows.wordocious.filter((t) => t.key !== SWEEP_KEY).map((t) => t.key);
    const some = new Map([['DUEL', { won: true }], ['GAUNTLET', { won: false }]]);
    const b = todayBadges(rows, some, sweepKeys);
    expect(b.DUEL).toEqual({ kind: 'won' });
    expect(b.GAUNTLET).toEqual({ kind: 'lost' });
    expect(b[SWEEP_KEY]).toBeUndefined();
    expect(b.QUORDLE).toBeUndefined();
    const allWon = new Map(sweepKeys.map((k) => [k, { won: true }]));
    expect(todayBadges(rows, allWon, sweepKeys)[SWEEP_KEY]).toEqual({ kind: 'won' });
    const allDone = new Map(sweepKeys.map((k, i) => [k, { won: i > 0 }]));
    expect(todayBadges(rows, allDone, sweepKeys)[SWEEP_KEY]).toEqual({ kind: 'done' });
  });
});
