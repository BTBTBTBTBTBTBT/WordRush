import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Stats + Friends redesign D2 step 3 (founder, 2026-09-26): the Records tab
// went, "so long as the information expected still populates elsewhere". This
// pins that promise: every row the old Records → You view showed must still be
// rendered by the Stats tab's components, and the global views (Hall of Fame,
// by-mode records, all-time Sweep board) must still be on the Records page.

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('records fold into Stats', () => {
  const stats = read('components/stats/your-records.tsx') + read('app/stats/page.tsx');
  const YOUR_ROWS = [
    'Next Up', '-day streak shield', 'from the', // chases
    'Daily Sweeps', 'Flawless Victories', 'Current Sweep Streak', 'Best Sweep Time',
    'Fastest Win', "recordLabel('fewest_guesses'", 'Games Played', 'Win–Loss',
    'Medals', 'Global Records', 'Your Trophy Shelf', 'held since',
  ];
  it.each(YOUR_ROWS)('the Stats tab still shows "%s"', (label) => {
    expect(stats).toContain(label);
  });
  it('the game page carries its Records card and the All-time page the rest', () => {
    const page = read('app/stats/page.tsx');
    expect(page).toContain('<GameRecordsCard');
    expect(page).toContain('<NextUpCard');
    expect(page).toContain('<SweepRecordsCard');
    expect(page).toContain('<RecordsHeldRow');
    expect(page).toContain('<TrophyShelf');
  });
  it('the Records page keeps the global views and drops the personal one', () => {
    const records = read('app/records/page.tsx');
    expect(records).toContain('Hall of Fame');
    expect(records).toContain('By Game Mode');
    expect(records).toContain('Sweep · All-Time');
    expect(records).not.toContain('YourRecordsView');
    expect(records).not.toContain("['you', 'You']");
  });
  it('the Leaderboard page links to the all-time records', () => {
    expect(read('app/daily/page.tsx')).toContain('href="/records"');
  });
});
