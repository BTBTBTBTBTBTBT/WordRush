import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import fixtures from '../../../packages/core/src/moment-share-fixtures.json';
import { buildLevelUpShareInput, buildPocketResultShareInput, buildStreakShareInput } from './moment-share';
import { shareHeroResultOf } from './share-image';

// Item 46: the three moment shares are the same card on web, iOS and Android. The cases live in
// packages/core/src/moment-share-fixtures.json, the file the Swift and Kotlin MomentShare tests read.

function build(c: { kind: string; args: any }) {
  const a = c.args;
  if (c.kind === 'levelUp') return buildLevelUpShareInput({ level: a.level, tierLabel: a.tier, xpToNext: a.xpToNext, accentHex: a.accentHex });
  if (c.kind === 'pocket') return buildPocketResultShareInput({ gameTitle: a.gameTitle, won: a.won, mine: a.mine, theirs: a.theirs, opponent: a.opponent });
  return buildStreakShareInput({ streak: a.streak, best: a.best, lastDays: a.lastDays });
}

describe('moment share builders match the shared fixture', () => {
  for (const c of fixtures.cases as any[]) {
    it(`${c.kind} ${JSON.stringify(c.args)}`, () => {
      const got = build(c);
      const want = c.expect;
      expect(got.title).toBe(want.title);
      expect(got.accentHex).toBe(want.accentHex);
      expect(got.big).toBe(want.big);
      expect(got.bigLabel).toBe(want.bigLabel);
      expect(got.lines).toEqual(want.lines);
      expect(got.dots).toEqual(want.dots);
      expect(got.won).toEqual(want.won);
      expect(shareHeroResultOf(got)).toBe(want.hero);
    });
  }

  it('the fixture copies are byte-identical on every platform', () => {
    const repo = path.join(__dirname, '..', '..', '..');
    const source = fs.readFileSync(path.join(repo, 'packages', 'core', 'src', 'moment-share-fixtures.json'), 'utf8');
    for (const dir of [
      path.join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
      path.join(repo, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
    ]) {
      expect(fs.readFileSync(path.join(dir, 'moment-share-fixtures.json'), 'utf8'), dir).toBe(source);
    }
  });
});
