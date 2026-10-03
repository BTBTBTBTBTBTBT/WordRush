import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BOT_CAST } from '@wordle-duel/core';
import {
  AVATAR_CAST_COLOR, AVATAR_CAST_IDS, AVATAR_CAST_NAME, AVATAR_FRAMES, FRAME_COLOR, avatarFrameFor, frameArtName,
  isAvatarCastId, isMissingColumnError, ownAvatarChoice, readAvatarChoice, readPendingChoice, retryPendingChoice,
  saveProfileWithAvatar, unlockedFrames, writePendingChoice, type ProfilesUpdater, type StorageLike,
  avatarColumns, choiceForConfig, resolveAvatarConfig, resolveRowAvatar,
} from './avatar-cast';
import { castPreset, defaultAvatar, validateAvatar } from '@wordle-duel/core';
import { CAST, mascotSrc } from './mascots';
import { ART_SIZE } from './art';

const UPLOADED = 'https://x.supabase.co/storage/v1/object/public/avatars/u9/avatar.jpg';

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

/** A fake profiles table: rejects any patch naming a column in `missing`. */
function fakeClient(missing: string[], failWith?: { code: string; message: string }) {
  const calls: Record<string, unknown>[] = [];
  const client: ProfilesUpdater = {
    from: () => ({
      update: (patch) => ({
        eq: async () => {
          calls.push(patch);
          if (failWith) return { error: failWith };
          const bad = Object.keys(patch).find((k) => missing.includes(k));
          return bad
            ? { error: { code: 'PGRST204', message: `Could not find the '${bad}' column of 'profiles' in the schema cache` } }
            : { error: null };
        },
      }),
    }),
  };
  return { client, calls };
}

const MISSING = ['avatar_cast_id', 'avatar_frame'];

describe('cast table (FINISH_SPEC AH)', () => {
  it('covers the ten heroes with their bot colors and names', () => {
    expect(AVATAR_CAST_IDS).toEqual(CAST);
    expect(AVATAR_CAST_IDS).toEqual(['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']);
    for (const b of BOT_CAST) {
      expect(AVATAR_CAST_COLOR[b.castId]).toBe(b.color);
      expect(AVATAR_CAST_NAME[b.castId]).toBe(b.name);
    }
    for (const id of AVATAR_CAST_IDS) {
      expect(AVATAR_CAST_COLOR[id]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(fs.existsSync(path.join(__dirname, '..', 'public', mascotSrc(id)))).toBe(true);
    }
  });

  it('validates ids', () => {
    expect(isAvatarCastId('o2')).toBe(true);
    expect(isAvatarCastId('x')).toBe(false);
    expect(isAvatarCastId(null)).toBe(false);
  });
});

describe('frames', () => {
  it('follows the level tier, clamping a chosen frame to the unlocked ones', () => {
    expect(avatarFrameFor(null)).toBeNull();
    expect(avatarFrameFor(undefined, 'gold')).toBeNull();
    expect(avatarFrameFor(1)).toBe('bronze');
    expect(avatarFrameFor(11)).toBe('silver');
    expect(avatarFrameFor(30)).toBe('gold');
    expect(avatarFrameFor(60)).toBe('platinum');
    expect(avatarFrameFor(120)).toBe('diamond');
    expect(avatarFrameFor(60, 'bronze')).toBe('bronze');
    expect(avatarFrameFor(12, 'diamond')).toBe('silver');
    expect(avatarFrameFor(30, 'nope')).toBe('gold');
  });

  it('lists the unlocked frames', () => {
    expect(unlockedFrames(0)).toEqual(['bronze']);
    expect(unlockedFrames(26)).toEqual(['bronze', 'silver', 'gold']);
    expect(unlockedFrames(100)).toEqual(AVATAR_FRAMES);
  });

  it('has a ring color per tier and keeps the frame art out of ART_SIZE until it ships', () => {
    for (const t of AVATAR_FRAMES) {
      expect(FRAME_COLOR[t].ring).toMatch(/^#[0-9a-f]{6}$/i);
      expect(frameArtName(t)).toBe(`art-frame-${t}`);
      const shipped = fs.existsSync(path.join(__dirname, '..', 'public', 'art', `${frameArtName(t)}.webp`));
      if (!shipped) expect(Object.keys(ART_SIZE)).not.toContain(frameArtName(t));
    }
  });
});

describe('tolerant columns', () => {
  it('reads missing / unknown values as null', () => {
    expect(readAvatarChoice({ username: 'a' })).toEqual({ castId: null, frame: null });
    expect(readAvatarChoice(null)).toEqual({ castId: null, frame: null });
    expect(readAvatarChoice({ avatar_cast_id: 'zz', avatar_frame: 'wood' })).toEqual({ castId: null, frame: null });
    expect(readAvatarChoice({ avatar_cast_id: 'u', avatar_frame: 'gold' })).toEqual({ castId: 'u', frame: 'gold' });
  });

  it('recognizes the missing-column errors', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: '' })).toBe(true);
    expect(isMissingColumnError({ code: '42703', message: '' })).toBe(true);
    expect(isMissingColumnError({ message: 'column "avatar_cast_id" of relation "profiles" does not exist' })).toBe(true);
    expect(isMissingColumnError({ message: "Could not find the 'avatar_frame' column of 'profiles' in the schema cache" })).toBe(true);
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });

  it('saves everything in one write when the columns exist', async () => {
    const s = memStorage();
    const { client, calls } = fakeClient([]);
    const res = await saveProfileWithAvatar(client, 'u1', { bio: 'hi' }, { castId: 'd', frame: null }, s);
    expect(res).toEqual({ error: null, pending: false });
    expect(calls).toEqual([{ bio: 'hi', avatar_cast_id: 'd', avatar_frame: null }]);
    expect(readPendingChoice('u1', s)).toBeNull();
  });

  it('saves the rest and keeps the choice locally when the columns are missing, then retries', async () => {
    const s = memStorage();
    const { client, calls } = fakeClient(MISSING);
    const res = await saveProfileWithAvatar(client, 'u1', { bio: 'hi' }, { castId: 'o3', frame: 'bronze' }, s);
    expect(res).toEqual({ error: null, pending: true });
    expect(calls[1]).toEqual({ bio: 'hi' });
    expect(readPendingChoice('u1', s)).toEqual({ castId: 'o3', frame: 'bronze' });
    expect(ownAvatarChoice({ avatar_cast_id: null }, readPendingChoice('u1', s)).castId).toBe('o3');

    expect(await retryPendingChoice(client, 'u1', s)).toBe('missing');
    expect(readPendingChoice('u1', s)).not.toBeNull();

    const later = fakeClient([]);
    expect(await retryPendingChoice(later.client, 'u1', s)).toBe('saved');
    expect(later.calls).toEqual([{ avatar_cast_id: 'o3', avatar_frame: 'bronze' }]);
    expect(readPendingChoice('u1', s)).toBeNull();
    expect(await retryPendingChoice(later.client, 'u1', s)).toBe('none');
  });

  it('keeps a pending "photo / initials" (null) choice too', async () => {
    const s = memStorage();
    writePendingChoice('u2', { castId: null, frame: null }, s);
    expect(readPendingChoice('u2', s)).toEqual({ castId: null, frame: null });
    expect(ownAvatarChoice({ avatar_cast_id: 'w' }, readPendingChoice('u2', s)).castId).toBeNull();
  });

  it('surfaces other errors without touching local storage', async () => {
    const s = memStorage();
    const { client } = fakeClient([], { code: '23505', message: 'duplicate key' });
    const res = await saveProfileWithAvatar(client, 'u1', { username: 'x' }, { castId: 'w', frame: null }, s);
    expect(res.pending).toBe(false);
    expect(res.error).toEqual({ code: '23505', message: 'duplicate key' });
    expect(s.data.size).toBe(0);
  });

  it('ignores garbage in storage', () => {
    const s = memStorage();
    s.setItem('wordocious.avatarChoice.u3', '{not json');
    expect(readPendingChoice('u3', s)).toBeNull();
    expect(readPendingChoice(null, s)).toBeNull();
  });
});

describe('the built mascot (FINISH_SPEC AN3)', () => {
  const MISSING_AN = ['avatar_cast_id', 'avatar_frame', 'avatar_config'];
  const cfg = { ...defaultAvatar('u1', '#ec4899'), head: 'party' as const, frame: 'silver' as const, display: 'mascot' as const };

  it('writes avatar_config with the legacy columns (no cast pick; the tier frame or null)', () => {
    expect(choiceForConfig(cfg)).toEqual({ castId: null, frame: 'silver', config: cfg });
    expect(choiceForConfig({ ...cfg, frame: 'pro' }).frame).toBeNull();
    expect(avatarColumns(choiceForConfig(cfg))).toEqual({ avatar_cast_id: null, avatar_frame: 'silver', avatar_config: cfg });
    expect(avatarColumns({ castId: 'w', frame: null })).toEqual({ avatar_cast_id: 'w', avatar_frame: null });
  });

  it('saves avatar_config in one write when the columns exist', async () => {
    const s = memStorage();
    const { client, calls } = fakeClient([]);
    const res = await saveProfileWithAvatar(client, 'u1', {}, choiceForConfig(cfg), s);
    expect(res).toEqual({ error: null, pending: false });
    expect(calls).toEqual([{ avatar_cast_id: null, avatar_frame: 'silver', avatar_config: cfg }]);
  });

  it('keeps the config on this device when avatar_config is missing (PGRST204 / 42703), then retries it', async () => {
    const s = memStorage();
    const { client, calls } = fakeClient(MISSING_AN);
    const res = await saveProfileWithAvatar(client, 'u1', {}, choiceForConfig(cfg), s);
    expect(res).toEqual({ error: null, pending: true });
    expect(calls).toHaveLength(1); // nothing else to save
    expect(readPendingChoice('u1', s)?.config).toEqual(cfg);

    const pg42703: ProfilesUpdater = {
      from: () => ({ update: () => ({ eq: async () => ({ error: { code: '42703', message: 'column "avatar_config" of relation "profiles" does not exist' } }) }) }),
    };
    expect(await retryPendingChoice(pg42703, 'u1', s)).toBe('missing');

    const later = fakeClient([]);
    expect(await retryPendingChoice(later.client, 'u1', s)).toBe('saved');
    expect(later.calls).toEqual([{ avatar_cast_id: null, avatar_frame: 'silver', avatar_config: cfg }]);
    expect(readPendingChoice('u1', s)).toBeNull();
  });

  it('still saves the other profile fields when avatar_config is missing', async () => {
    const s = memStorage();
    const { client, calls } = fakeClient(['avatar_config']);
    const res = await saveProfileWithAvatar(client, 'u1', { bio: 'yo' }, choiceForConfig(cfg), s);
    expect(res).toEqual({ error: null, pending: true });
    expect(calls[1]).toEqual({ bio: 'yo' });
  });

  it('drops a garbage pending config to a valid one', () => {
    const s = memStorage();
    s.setItem('wordocious.avatarChoice.u4', JSON.stringify({ castId: null, frame: null, config: { body: 'zz', eyes: 'happy' } }));
    const c = readPendingChoice('u4', s)!.config!;
    expect(c.eyes).toBe('happy');
    expect(c.body).toBe(defaultAvatar('').body);
  });

  it('resolves what a row wears: saved config → AH cast pick → the default', () => {
    expect(resolveAvatarConfig({ avatar_config: cfg }, 'u1', null)).toEqual(validateAvatar(cfg, defaultAvatar('u1')));
    expect(resolveAvatarConfig({ avatar_cast_id: 'o2', avatar_frame: 'gold' }, 'u1')).toEqual({ ...castPreset('o2'), frame: 'gold' });
    expect(resolveAvatarConfig({}, 'u9', '#2563eb')).toEqual(defaultAvatar('u9', '#2563eb'));
    expect(resolveAvatarConfig(null, 'u9')).toEqual(defaultAvatar('u9'));
    // BJ5: an UPLOADED photo shows by default; an OAuth picture with no saved config never does.
    expect(resolveAvatarConfig({ avatar_url: UPLOADED }, 'u9').display).toBe('photo');
    expect(resolveAvatarConfig({ avatar_url: 'https://lh3.googleusercontent.com/a/x=s96-c' }, 'u9')).toEqual(defaultAvatar('u9'));
    // A saved mascot choice wins over the photo.
    expect(resolveAvatarConfig({ avatar_url: UPLOADED, avatar_config: { ...cfg, display: 'mascot' } }, 'u9').display).toBe('mascot');
    expect(resolveAvatarConfig({ avatar_config: [1, 2] }, 'u9')).toEqual(defaultAvatar('u9'));
  });

  it('BJ5 precedence: saved config (photo only on display=photo) → uploaded photo → cast → seeded', () => {
    const oauth = 'https://lh3.googleusercontent.com/a/x=s96-c';
    // Founder "BMT": uploaded photo + saved config display 'photo' → the photo.
    expect(resolveRowAvatar({ avatar_url: UPLOADED, avatar_config: { ...cfg, display: 'photo' } }, 'BMT')).toMatchObject({ kind: 'photo', photoUrl: UPLOADED });
    // A saved config with display 'mascot' hides the photo.
    expect(resolveRowAvatar({ avatar_url: UPLOADED, avatar_config: { ...cfg, display: 'mascot' } }, 'BMT')).toMatchObject({ kind: 'config', photoUrl: null });
    // "Ukrainian Cyclone": an OAuth picture, no saved config → the seeded mascot, never the picture.
    const uc = resolveRowAvatar({ avatar_url: oauth }, 'Ukrainian Cyclone');
    expect(uc).toEqual({ kind: 'seeded', photoUrl: null, config: defaultAvatar('ukrainian cyclone') });
    // An OAuth picture + a saved config that asks for the photo → the photo (the player chose it).
    expect(resolveRowAvatar({ avatar_url: oauth, avatar_config: { ...cfg, display: 'photo' } }, 'x').kind).toBe('photo');
    // Uploaded photo + worn cast → the photo, ringed in the cast preset's look.
    expect(resolveRowAvatar({ avatar_url: UPLOADED, avatar_cast_id: 'r' }, 'x')).toMatchObject({ kind: 'photo', photoUrl: UPLOADED, config: { ...castPreset('r'), display: 'photo' } });
    // Worn cast, no photo → the cast hero; the frame column rings it.
    expect(resolveRowAvatar({ avatar_cast_id: ' R ', avatar_frame: 'Gold' }, 'x')).toEqual({ kind: 'cast', photoUrl: null, config: { ...castPreset('r'), frame: 'gold' } });
    // Nothing → seeded by the lowercased username, in the accent.
    expect(resolveRowAvatar(null, '  Zed ', '#2563eb')).toEqual({ kind: 'seeded', photoUrl: null, config: defaultAvatar('zed', '#2563eb') });
  });

  it('BJ5: web maps rows onto core resolveAvatar exactly (shared avatar-resolve fixtures)', () => {
    const file = path.resolve(__dirname, '../../ios/Tests/Fixtures/avatar-resolve-fixtures.json');
    const { cases } = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      cases: Array<{ source: { username?: string | null; avatarUrl?: string | null; config?: unknown; castId?: unknown; frame?: unknown; accentHex?: string | null }; result: unknown }>;
    };
    expect(cases.length).toBeGreaterThan(5);
    for (const c of cases) {
      const s = c.source;
      const got = resolveRowAvatar({ avatar_url: s.avatarUrl, avatar_config: s.config, avatar_cast_id: s.castId, avatar_frame: s.frame }, s.username, s.accentHex);
      expect(got).toEqual(c.result);
    }
  });
});
