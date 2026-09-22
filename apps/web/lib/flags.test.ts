import { describe, it, expect } from 'vitest';
import { isFlagOn, indexFlags, isTester, NOBODY, type AppFlag } from './flags';
import { MODES } from './modes.generated';

const rows: AppFlag[] = [
  { key: 'menu.more', enabled: true, audience: 'testers' },
  { key: 'mode.sudoku', enabled: true, audience: 'all' },
  { key: 'mode.hub', enabled: false, audience: 'all' },
];
const flags = indexFlags(rows);
const admin = { isAdmin: true, role: 'user' };
const tester = { isAdmin: false, role: 'tester' };
const player = { isAdmin: false, role: 'user' };

describe('remote flags resolver', () => {
  it('nothing to gate or unknown flags → on; a missing row fails closed', () => {
    expect(isFlagOn(null, flags, NOBODY)).toBe(true);
    expect(isFlagOn('menu.more', null, NOBODY)).toBe(true);
    expect(isFlagOn('menu.more', undefined, NOBODY)).toBe(true);
    // The table was read but this key has no row: the gate was never set up,
    // so a gated mode stays hidden even for admins (fail closed).
    expect(isFlagOn('mode.nope', flags, NOBODY)).toBe(false);
    expect(isFlagOn('mode.nope', flags, admin)).toBe(false);
  });

  it('enabled = false is the kill switch for everyone, admins included', () => {
    expect(isFlagOn('mode.hub', flags, admin)).toBe(false);
    expect(isFlagOn('mode.hub', flags, player)).toBe(false);
  });

  it("audience 'all' is on for everyone; 'testers' only for admins and testers", () => {
    expect(isFlagOn('mode.sudoku', flags, player)).toBe(true);
    expect(isFlagOn('mode.sudoku', flags, NOBODY)).toBe(true);
    expect(isFlagOn('menu.more', flags, player)).toBe(false);
    expect(isFlagOn('menu.more', flags, NOBODY)).toBe(false);
    expect(isFlagOn('menu.more', flags, tester)).toBe(true);
    expect(isFlagOn('menu.more', flags, admin)).toBe(true);
    expect(isFlagOn('menu.more', flags, { isAdmin: false, role: 'admin' })).toBe(true);
  });

  it('isTester matches the §228 ads-exempt set', () => {
    expect(isTester(admin)).toBe(true);
    expect(isTester(tester)).toBe(true);
    expect(isTester(player)).toBe(false);
  });

  it('every flagged catalog mode is seeded by the Stage 7 migration', async () => {
    const fs = await import('node:fs');
    const sql = fs.readFileSync(new URL('../../../supabase/manual-migrations/20260922000003_app_flags.sql', import.meta.url), 'utf8');
    for (const m of MODES) if (m.flagKey) expect(sql, m.flagKey).toContain(`('${m.flagKey}',`);
  });
});
