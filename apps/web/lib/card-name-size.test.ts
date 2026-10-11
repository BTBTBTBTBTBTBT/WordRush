import { describe, expect, it } from 'vitest';
import { createCardNameScope, uniformCardNameSize } from './card-name-size';

describe('uniformCardNameSize (BJ18)', () => {
  it('caps at 18, floors at 13 and steps by 0.5', () => {
    expect(uniformCardNameSize(20)).toBe(18);
    expect(uniformCardNameSize(18)).toBe(18);
    expect(uniformCardNameSize(17.9)).toBe(17.5);
    expect(uniformCardNameSize(15.74)).toBe(15.5);
    expect(uniformCardNameSize(13.2)).toBe(13);
    expect(uniformCardNameSize(11)).toBe(13);
  });
});

describe('createCardNameScope (BJ18)', () => {
  it('draws every card at the smallest fit and redraws all when it changes', () => {
    const scope = createCardNameScope();
    const drawn = new Map<string, number>();
    const a = {}, b = {}, c = {};
    scope.report(a, 18, (s) => drawn.set('a', s));
    expect(drawn.get('a')).toBe(18);
    scope.report(b, 15.2, (s) => drawn.set('b', s));
    expect(scope.size()).toBe(15);
    expect([drawn.get('a'), drawn.get('b')]).toEqual([15, 15]);
    // A third card that fits at 18 joins at the shared size.
    scope.report(c, 18, (s) => drawn.set('c', s));
    expect(drawn.get('c')).toBe(15);
    // A very long name never drags the grid under 13 (it shrinks on its own card).
    scope.report(b, 10, (s) => drawn.set('b', s));
    expect(scope.size()).toBe(13);
    expect([drawn.get('a'), drawn.get('b'), drawn.get('c')]).toEqual([13, 13, 13]);
    // The long card leaves: everyone grows back.
    scope.remove(b);
    expect(scope.size()).toBe(18);
    expect(drawn.get('a')).toBe(18);
    scope.remove(a); scope.remove(c);
    expect(scope.size()).toBeNull();
  });
});

describe('createCardNameScope rows (founder 10-10)', () => {
  it('sizes each row on its own: a long name only shrinks its row', () => {
    const scope = createCardNameScope();
    const drawn = new Map<string, number>();
    const a = {}, b = {}, c = {}, d = {};
    scope.report(a, 18, (s) => drawn.set('a', s), 0);
    scope.report(b, 14.2, (s) => drawn.set('b', s), 0);
    scope.report(c, 18, (s) => drawn.set('c', s), 1);
    scope.report(d, 17, (s) => drawn.set('d', s), 1);
    expect([drawn.get('a'), drawn.get('b')]).toEqual([14, 14]);
    expect([drawn.get('c'), drawn.get('d')]).toEqual([17, 17]);
    expect([scope.size(0), scope.size(1)]).toEqual([14, 17]);
    // A card that moves rows (the grid reflowed) leaves its old row and grows it back.
    scope.report(b, 14.2, (s) => drawn.set('b', s), 1);
    expect(drawn.get('a')).toBe(18);
    expect([drawn.get('c'), drawn.get('d'), drawn.get('b')]).toEqual([14, 14, 14]);
    scope.remove(a); scope.remove(b); scope.remove(c); scope.remove(d);
    expect(scope.size(0)).toBeNull();
    expect(scope.size(1)).toBeNull();
  });
});
