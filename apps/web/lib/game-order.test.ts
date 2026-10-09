import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILIES_ORDER, DEFAULT_PUZZLES_ORDER } from '@wordle-duel/core';
import { CORE_MODES, MORE_GAME_MODES } from './modes.generated';

// The catalog (modes.json homeSlot -> modes.generated) and the core default constants must agree:
// the web/iOS/Android lists read the catalog, the order logic reads the constants.
describe('default game order = catalog order (item 35)', () => {
  it('Dailies catalog order is the founder default, Classic first', () => {
    const ids = CORE_MODES.filter((m) => !m.homeWide).map((m) => m.id);
    expect(ids).toEqual([...DEFAULT_DAILIES_ORDER]);
    expect(ids[0]).toBe('practice');
  });
  it('Puzzles catalog order is the default puzzle order, Muddle last', () => {
    const ids = MORE_GAME_MODES.map((m) => m.id);
    expect(ids).toEqual([...DEFAULT_PUZZLES_ORDER]);
    expect(ids[ids.length - 1]).toBe('scramble');
  });
});
