import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { join } from 'node:path';
import {
  enforceSeasonalAccess,
  AVATAR_ACCESS_CONFIG, AVATAR_ACCESS_TABLE, avatarAccessKey, avatarEarnedKeys, avatarLockedCardLines, avatarPartAccess, avatarPartRule,
  avatarSaveCheck, avatarWornParts, enforceAvatarAccess, evaluateEarn, type AvatarAccessContext,
} from './avatar-access';
import {
  AVATAR_BACKDROP_IDS, AVATAR_BODIES, AVATAR_BROWS, AVATAR_CHEEKS, AVATAR_COLORS, AVATAR_EXTRAS, AVATAR_FACES, AVATAR_FEET, AVATAR_FRAMES,
  AVATAR_HEADS, AVATAR_HELD, AVATAR_MOUTHS, AVATAR_NECKS, AVATAR_NOSES, AVATAR_PATTERNS, AVATAR_PETS, AVATAR_WRAPS, AVATAR_EYES,
  AVATAR_CAST_IDS, castPreset, defaultAvatar, enforceAvatarPro, validateAvatar, type AvatarConfig,
} from './avatar-config';
import { AVATAR_POSES } from './avatar-pose';
import { NEW_ACHIEVEMENTS } from './achievement-rules';

const repo = join(__dirname, '..', '..', '..');
const base = castPreset('w');
const on = (o: Partial<AvatarAccessContext> = {}): AvatarAccessContext => ({ isPro: false, date: '2026-07-01', gating: true, ...o });
const mk = (o: Record<string, string>): AvatarConfig => validateAvatar({ ...base, ...o }, base);

describe('the flag', () => {
  it('ships OFF', () => {
    expect(AVATAR_ACCESS_CONFIG.itemGating).toBe(false);
  });
  it('gating off = today: Pro-only lists, level frames, seasons; everything else free', () => {
    expect(avatarPartRule('head', 'crown', { gating: false })).toEqual({ pro: true });
    expect(avatarPartRule('color', 'gold', { gating: false })).toEqual({ pro: true });
    expect(avatarPartRule('accColor', 'rainbow', { gating: false })).toEqual({ pro: true });
    expect(avatarPartRule('head', 'cowboy', { gating: false })).toEqual({ free: true });
    expect(avatarPartRule('pet', 'kitten', { gating: false })).toEqual({ free: true });
    expect(avatarPartRule('head', 'pumpkinhat', { gating: false })).toEqual({ season: 'halloween', pro: true });
    expect(avatarPartRule('frame', 'silver', { gating: false }).earn).toMatchObject({ stat: 'level', min: 11 });
  });
  it('gating off: a free player saving a non-Pro look keeps every part (no change vs enforceAvatarPro)', () => {
    const c = mk({ head: 'cowboy', pet: 'kitten', body: 'star', held: 'mic' });
    const ctx = { isPro: false, date: '2026-07-01', gating: false };
    expect(avatarSaveCheck(c, ctx).ok).toBe(true);
    expect(enforceAvatarAccess(c, ctx)).toEqual(c);
    const pro = mk({ head: 'crown', neck: 'wings', color: 'gold' });
    expect(enforceAvatarAccess(pro, ctx)).toEqual(enforceAvatarPro(pro, false));
  });
});

describe('the table', () => {
  const all: Array<[string, readonly string[]]> = [
    ['body', AVATAR_BODIES], ['color', AVATAR_COLORS.map((c) => c.id)], ['pattern', AVATAR_PATTERNS], ['eyes', AVATAR_EYES], ['brows', AVATAR_BROWS],
    ['nose', AVATAR_NOSES], ['cheeks', AVATAR_CHEEKS], ['mouth', AVATAR_MOUTHS], ['extra', AVATAR_EXTRAS], ['head', AVATAR_HEADS], ['face', AVATAR_FACES],
    ['neck', AVATAR_NECKS], ['held', AVATAR_HELD], ['wrap', AVATAR_WRAPS], ['feet', AVATAR_FEET], ['pet', AVATAR_PETS], ['frame', AVATAR_FRAMES],
    ['bg', AVATAR_BACKDROP_IDS], ['pose', AVATAR_POSES],
  ];
  it('covers every option of every field (none / solid / auto excepted) and nothing else', () => {
    const want = new Set<string>();
    for (const [f, ids] of all) for (const id of ids) if (!['none', 'solid', 'auto'].includes(id)) want.add(avatarAccessKey(f, id));
    expect(new Set(Object.keys(AVATAR_ACCESS_TABLE.parts))).toEqual(want);
  });
  it('every rule has at least one route; prices come from a known tier', () => {
    for (const [k, r] of Object.entries(AVATAR_ACCESS_TABLE.parts)) {
      expect(r.free || r.pro || r.buy || r.earn || r.season, k).toBeTruthy();
      if (r.buy) expect(AVATAR_ACCESS_TABLE.tiers[r.buy], k).toBeGreaterThan(0);
      if (r.earn) expect(!!r.earn.achievement !== !!r.earn.stat, k).toBe(true);
    }
  });
  it('everything Pro-only today stays in Pro (no Pro member loses anything)', () => {
    for (const [f, ids] of all) for (const id of ids) {
      if (avatarPartRule(f, id, { gating: false }).pro) expect(avatarPartRule(f, id, { gating: true }).pro, `${f}:${id}`).toBe(true);
    }
  });
  it('earn conditions name real achievements (core ones checked here; the web catalog test checks the rest)', () => {
    const core = new Set(NEW_ACHIEVEMENTS.map((a) => a.key));
    const named = Object.values(AVATAR_ACCESS_TABLE.parts).map((r) => r.earn?.achievement).filter((k): k is string => !!k);
    expect(named.length).toBeGreaterThan(20);
    expect(named.filter((k) => core.has(k)).length).toBeGreaterThan(10);
  });
  it('nobody\'s default look is locked: every seeded default and cast preset is free', () => {
    const names = ['', 'guest', 'bmt', 'jpgolf', 'zed', 'abc123', 'wordocious', 'doug'];
    const accents = [null, '#7c3aed', '#ef4444', '#0ea5e9', '#22c55e', '#f5a524', '#64748b', '#000000', '#ffffff'];
    const configs = [...names.flatMap((n) => accents.map((a) => defaultAvatar(n, a))), ...AVATAR_CAST_IDS.map(castPreset)];
    for (const c of configs) expect(avatarSaveCheck(c, on()).locked).toEqual([]);
  });
  it('the core + iOS + Android copies are byte-identical to the proposal JSON', () => {
    const src = fs.readFileSync(join(repo, 'docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.json'), 'utf8');
    for (const p of ['packages/core/src/avatar-access.json', 'apps/ios/Wordocious/Resources/avatar-access.json', 'apps/android/app/src/main/assets/avatar-access.json']) {
      expect(fs.readFileSync(join(repo, p), 'utf8'), p).toBe(src);
    }
  });
});

describe('access rules (gating on)', () => {
  it('free starter parts are open to everyone', () => {
    expect(avatarPartAccess({ field: 'head', id: 'party' }, on())).toMatchObject({ unlocked: true, reason: 'free' });
    expect(avatarPartAccess({ field: 'patternColor', id: 'purple' }, on())).toMatchObject({ unlocked: true, reason: 'free' });
  });
  it('a gated part: locked for free players, open with Pro, open when owned', () => {
    const p = { field: 'head', id: 'cowboy' };
    expect(avatarPartAccess(p, on())).toMatchObject({ unlocked: false, reason: 'locked' });
    expect(avatarPartAccess(p, on({ isPro: true }))).toMatchObject({ unlocked: true, reason: 'pro' });
    expect(avatarPartAccess(p, on({ owned: ['head:cowboy'] }))).toMatchObject({ unlocked: true, reason: 'owned' });
    expect(avatarPartAccess(p, on({ owned: ['neck:cowboy'] })).unlocked).toBe(false);
  });
  it('earned by achievement or by stat', () => {
    expect(avatarPartAccess({ field: 'head', id: 'crown' }, on({ stats: { achievements: ['boss_battle'] } }))).toMatchObject({ unlocked: true, reason: 'earned' });
    expect(avatarPartAccess({ field: 'body', id: 'star' }, on({ stats: { bestStreak: 29 } })).unlocked).toBe(false);
    expect(avatarPartAccess({ field: 'body', id: 'star' }, on({ stats: { bestStreak: 30 } }))).toMatchObject({ unlocked: true, reason: 'earned' });
  });
  it('a saved part is never stripped (grandfathered), including saved colors in any color field', () => {
    expect(avatarPartAccess({ field: 'head', id: 'cowboy' }, on({ saved: mk({ head: 'cowboy' }) }))).toMatchObject({ unlocked: true, reason: 'saved' });
    expect(avatarPartAccess({ field: 'accColor', id: 'navy' }, on({ saved: mk({ color: 'navy' }) }))).toMatchObject({ unlocked: true, reason: 'saved' });
  });
  it('seasonal parts never disappear: free in season; out of season they stay with Pro / buy routes, kept when saved', () => {
    const p = { field: 'head', id: 'pumpkinhat' };
    const inSeason = avatarPartAccess(p, on({ date: '2026-10-20' }));
    expect(inSeason).toMatchObject({ unlocked: true, reason: 'season' });
    expect(inSeason.routes.map((r) => r.kind)).toEqual(['season', 'buy', 'pro']);
    const out = avatarPartAccess(p, on({ date: '2026-07-01' }));
    expect(out.unlocked).toBe(false);
    expect(out.routes.map((r) => r.kind)).toEqual(['season', 'buy', 'pro']);   // buy + Pro stay open (no `limited`)
    expect(avatarPartAccess(p, on({ date: '2026-07-01', isPro: true })).reason).toBe('pro');
    expect(avatarPartAccess(p, on({ date: '2026-07-01', owned: ['head:pumpkinhat'] })).reason).toBe('owned');
    expect(avatarPartAccess(p, on({ date: '2026-07-01', saved: mk({ head: 'pumpkinhat' }) })).reason).toBe('saved');
    expect(avatarPartAccess(p, on({ date: '2026-07-01', previewSeason: 'halloween' })).reason).toBe('season');
  });
  it('gating off: a free player cannot SAVE a seasonal part off-season (enforceSeasonalAccess), Pro / owned / saved can', () => {
    const c = mk({ head: 'pumpkinhat', pet: 'kitten' });
    const free = { isPro: false, date: '2026-07-01', gating: false };
    expect(enforceSeasonalAccess(c, free)).toEqual({ ...c, head: 'none' });
    expect(enforceSeasonalAccess(c, { ...free, isPro: true })).toEqual(c);
    expect(enforceSeasonalAccess(c, { ...free, owned: ['head:pumpkinhat'] })).toEqual(c);
    expect(enforceSeasonalAccess(c, { ...free, saved: c })).toEqual(c);
    expect(enforceSeasonalAccess(c, { ...free, date: '2026-10-20' })).toEqual(c);
  });
  it('routes list what applies: earn with progress, Pro, buy', () => {
    const a = avatarPartAccess({ field: 'body', id: 'star' }, on({ stats: { bestStreak: 12 } }));
    expect(avatarLockedCardLines(a)).toEqual(['Earn: Keep a 30-day play streak (12 / 30)', 'Included with Pro', 'Buy $2.99']);
    expect(avatarLockedCardLines(avatarPartAccess({ field: 'head', id: 'crown' }, on()))).toEqual(['Earn: Beat Webster, the final boss', 'Included with Pro', 'Buy $2.99']);
    expect(avatarLockedCardLines(avatarPartAccess({ field: 'frame', id: 'gold' }, on({ stats: { level: 3 } })))).toEqual(['Earn: Reach level 26 (3 / 26)']);
  });
});

describe('try-on vs save', () => {
  const draft = mk({ head: 'cowboy', pet: 'kitten', color: 'navy', body: 'classic', eyes: 'beady' });
  it('anything can be tried on; saving lists the locked parts in maker order', () => {
    expect(avatarSaveCheck(draft, on())).toEqual({ ok: false, locked: [{ field: 'color', id: 'navy' }, { field: 'head', id: 'cowboy' }, { field: 'pet', id: 'kitten' }] });
    expect(avatarSaveCheck(draft, on({ isPro: true }))).toEqual({ ok: true, locked: [] });
  });
  it('enforce: locked parts revert to the saved value when that is unlocked, else the free default', () => {
    const saved = mk({ head: 'party', color: 'teal' });
    const out = enforceAvatarAccess(draft, on({ saved }));
    expect(out.head).toBe('party');
    expect(out.color).toBe('teal');
    expect(out.pet).toBeUndefined();
    expect(avatarSaveCheck(out, on({ saved })).ok).toBe(true);
    const bare = enforceAvatarAccess(draft, on());
    expect([bare.head, bare.color, bare.pet]).toEqual(['none', 'purple', undefined]);
  });
  it('pattern color only counts when a pattern is worn', () => {
    expect(avatarWornParts(mk({ pattern: 'solid', patternColor: 'navy' })).some((p) => p.field === 'patternColor')).toBe(false);
    expect(avatarWornParts(mk({ pattern: 'stripes', patternColor: 'navy' })).some((p) => p.field === 'patternColor')).toBe(true);
  });
});

describe('the earn evaluator', () => {
  it('achievements: met or not', () => {
    expect(evaluateEarn({ label: 'x', achievement: 'boss_battle' }, { achievements: ['boss_battle'] })).toEqual({ met: true, current: 1, target: 1, label: 'x' });
    expect(evaluateEarn({ label: 'x', achievement: 'boss_battle' }, null)).toEqual({ met: false, current: 0, target: 1, label: 'x' });
  });
  it('stats: progress capped at the target; junk reads as 0', () => {
    expect(evaluateEarn({ label: 's', stat: 'bestStreak', min: 30 }, { bestStreak: 12 })).toEqual({ met: false, current: 12, target: 30, label: 's' });
    expect(evaluateEarn({ label: 's', stat: 'bestStreak', min: 30 }, { bestStreak: 45 })).toEqual({ met: true, current: 30, target: 30, label: 's' });
    expect(evaluateEarn({ label: 's', stat: 'level', min: 10 }, { level: NaN })).toMatchObject({ met: false, current: 0 });
    expect(evaluateEarn({ label: 's', stat: 'level', min: 10 }, { level: -4 })).toMatchObject({ met: false, current: 0 });
  });
  it('avatarEarnedKeys: what the server grants (source earn)', () => {
    expect(avatarEarnedKeys({})).toEqual([]);
    const got = avatarEarnedKeys({ level: 26, achievements: ['boss_battle'] });
    expect(got).toEqual(expect.arrayContaining(['head:crown', 'face:monocle', 'frame:bronze', 'frame:silver', 'frame:gold']));
    expect(got).not.toContain('frame:platinum');
  });
});
