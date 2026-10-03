import { describe, expect, it } from 'vitest';
import { readDismissed, showClearAll, visibleCreditRows, writeDismissed } from './referral-credits';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

const rows = [
  { id: 'a', status: 'redeemed' },
  { id: 'b', status: 'converted' },
  { id: 'c', status: 'pending' },
];

describe('referral credit notices (founder 10-03: X them away)', () => {
  it('a dismissal persists for that user (a relaunch reads it back) and hides only that credit', () => {
    const s = memoryStorage();
    writeDismissed('u1', ['a'], s);
    const back = readDismissed('u1', s); // a fresh read = the next launch
    expect([...back]).toEqual(['a']);
    expect(visibleCreditRows(rows, back).map((r) => r.id)).toEqual(['b', 'c']);
    // Another account on the same device keeps its own list.
    expect(readDismissed('u2', s).size).toBe(0);
  });

  it('merges ids (server + local, Clear all) without duplicates', () => {
    const s = memoryStorage();
    writeDismissed('u1', ['a'], s);
    const all = writeDismissed('u1', ['a', 'b'], s);
    expect([...all].sort()).toEqual(['a', 'b']);
    // Open invites are never dismissable credits: the card keeps them (and its pitch).
    expect(visibleCreditRows(rows, all).map((r) => r.id)).toEqual(['c']);
  });

  it('shows Clear all only at 2+ credits; garbage storage reads as empty', () => {
    expect(showClearAll(rows)).toBe(true);
    expect(showClearAll(rows.slice(1))).toBe(false);
    expect(readDismissed('u1', { getItem: () => '{not json' }).size).toBe(0);
  });
});
