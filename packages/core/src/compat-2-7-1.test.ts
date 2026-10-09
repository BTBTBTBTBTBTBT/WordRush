import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { join } from 'node:path';
import fixtures from './compat-fixtures.json';
import {
  applyFriendlyMove, isLiveReaction, liveTopic, LIVE_EVENT_MOVE, LIVE_EVENT_REACT, LIVE_REACTIONS,
  parseAgeCheckStored, parseInvitePath, parseTypedInvite, resolveAvatar,
} from './index';

// Item 39: 2.7.1 and 2.8 players together. The cases live in compat-fixtures.json, the same file the Swift and Kotlin
// suites read; every shape a different version can send must be read without throwing.

const anyData = fixtures as any;

describe('invites: the 2.8 one-link and the 2.7.1 links parse to the same invite', () => {
  for (const c of anyData.invites as any[]) {
    it(`${c.input || '(empty)'}`, () => {
      expect(parseInvitePath(c.input)).toEqual(c.parse);
      expect(parseTypedInvite(c.input)).toEqual(c.typed);
    });
  }
});

describe('avatars: unknown ids, new parts, wrong types never throw', () => {
  for (const c of anyData.avatars as any[]) {
    it(c.name, () => {
      const seeded = resolveAvatar({ username: c.source.username }).config as unknown as Record<string, unknown>;
      const got = resolveAvatar(c.source);
      expect(got.kind).toBe(c.kind);
      expect(got.photoUrl).toBe(c.photoUrl);
      const cfg = got.config as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(c.config ?? {})) expect(cfg[k], k).toEqual(v);
      for (const k of c.seeded ?? []) expect(cfg[k], `${k} = seeded`).toEqual(seeded[k]);
      for (const k of c.absent ?? []) expect(cfg[k] === undefined || cfg[k] === 'none', `${k} absent`).toBe(true);
    });
  }
});

describe('live pocket games', () => {
  const live = anyData.live;
  it('the channel + event names are what a 2.7.1 build expects', () => {
    expect(liveTopic(live.topic.gameId)).toBe(live.topic.topic);
    expect(LIVE_EVENT_MOVE).toBe(live.events.move);
    expect(LIVE_EVENT_REACT).toBe(live.events.react);
    expect([...LIVE_REACTIONS]).toEqual(live.reactions.known);
  });
  it('known reactions pass, a reaction from a newer build is ignored', () => {
    for (const r of live.reactions.known) expect(isLiveReaction(r), r).toBe(true);
    for (const r of live.reactions.unknown) expect(isLiveReaction(r), r).toBe(false);
    expect(isLiveReaction(undefined)).toBe(false);
    expect(isLiveReaction(null)).toBe(false);
    expect(isLiveReaction(7)).toBe(false);
  });
});

describe('pocket game moves from either version', () => {
  for (const m of anyData.games.moves as any[]) {
    it(m.name, () => {
      const r = applyFriendlyMove(m.state, m.by, m.move);
      expect(r.ok).toBe(m.ok);
    });
  }
});

describe('age flag', () => {
  const now = new Date(anyData.age.nowYear, 5, 15);
  for (const c of anyData.age.stored as any[]) {
    it(`${c.raw ?? '(none)'}`, () => {
      expect(parseAgeCheckStored(c.raw, now)).toEqual(c.expect);
    });
  }
});

describe('the fixture copies are byte-identical on every platform', () => {
  const repo = join(__dirname, '..', '..', '..');
  const source = fs.readFileSync(join(__dirname, 'compat-fixtures.json'), 'utf8');
  for (const dir of [
    join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
    join(repo, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
    join(repo, 'apps', 'android', 'app', 'src', 'test', 'resources', 'fixtures'),
  ]) {
    it(dir.replace(repo, ''), () => {
      expect(fs.readFileSync(join(dir, 'compat-fixtures.json'), 'utf8')).toBe(source);
    });
  }
});
