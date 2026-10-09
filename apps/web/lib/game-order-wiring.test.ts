import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

// Item 35 guard: every list that shows games must read the player's order, and the edit mode is gated.
describe('game order is wired into every list (item 35)', () => {
  it('Home orders both sections from the saved order and offers the pencil + long-press edit mode', () => {
    const page = read('app/page.tsx');
    expect(page).toContain('useGameOrder()');
    expect(page).toContain('applyGameOrder(wordRaw');
    expect(page).toContain('applyGameOrder(puzzleRaw');
    expect(page).toContain('TitlePencil');
    expect(page).toContain('EditBar');
  });
  it('Leaderboard + Stats pickers get the order', () => {
    expect(read('components/ui/game-picker.tsx')).toContain('order: gameOrderPrefs');
    expect(read('app/stats/page.tsx')).toContain('order: gameOrderPrefs');
  });
  it('NEXT on finished screens walks the player order', () => {
    const cta = read('components/game/next-daily-cta.tsx');
    expect(cta).toContain('nextUnplayed(');
    expect(cta).toContain("resolvedOrder('dailies'");
  });
  it('the store is gated by the custom_game_order off-switch and saves to profiles.game_order', () => {
    const store = read('lib/game-order-store.ts');
    expect(store).toContain("isLive('custom_game_order')");
    expect(store).toContain('game_order');
  });
});
