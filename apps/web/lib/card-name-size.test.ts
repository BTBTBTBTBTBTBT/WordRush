import { describe, expect, it } from 'vitest';
import { createCardNameScope, uniformCardNameSize } from './card-name-size';

describe('uniformCardNameSize (BJ18)', () => {
  it('caps at 17, floors at 13 and steps by 0.5', () => {
    expect(uniformCardNameSize(20)).toBe(17);
    expect(uniformCardNameSize(17)).toBe(17);
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
    scope.report(a, 17, (s) => drawn.set('a', s));
    expect(drawn.get('a')).toBe(17);
    scope.report(b, 15.2, (s) => drawn.set('b', s));
    expect(scope.size()).toBe(15);
    expect([drawn.get('a'), drawn.get('b')]).toEqual([15, 15]);
    // A third card that fits at 17 joins at the shared size.
    scope.report(c, 17, (s) => drawn.set('c', s));
    expect(drawn.get('c')).toBe(15);
    // A very long name never drags the grid under 13 (it shrinks on its own card).
    scope.report(b, 10, (s) => drawn.set('b', s));
    expect(scope.size()).toBe(13);
    expect([drawn.get('a'), drawn.get('b'), drawn.get('c')]).toEqual([13, 13, 13]);
    // The long card leaves: everyone grows back.
    scope.remove(b);
    expect(scope.size()).toBe(17);
    expect(drawn.get('a')).toBe(17);
    scope.remove(a); scope.remove(c);
    expect(scope.size()).toBeNull();
  });
});
