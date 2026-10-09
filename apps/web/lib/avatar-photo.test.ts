import { beforeEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn();
const eq = vi.fn();
vi.mock('@/lib/supabase-client', () => ({
  supabase: { from: (table: string) => ({ update: (row: unknown) => { update(table, row); return { eq: (...a: unknown[]) => { eq(...a); return Promise.resolve({ error: null }); } }; } }) },
}));
const afterOwnAvatarSave = vi.fn();
vi.mock('@/lib/avatar-directory', () => ({ afterOwnAvatarSave: (id: string) => afterOwnAvatarSave(id) }));

import { AVATAR_PHOTO_BUCKET, AVATAR_PHOTO_MAX_BYTES, AVATAR_PHOTO_SIDE, avatarPhotoPath, avatarPhotoProblem, centerSquare, removeAvatarPhoto } from './avatar-photo';

describe('avatar photo (cloud prompt 07: web upload = iOS / Android rules)', () => {
  beforeEach(() => { update.mockClear(); eq.mockClear(); afterOwnAvatarSave.mockClear(); });

  it('uses the native bucket, path and size', () => {
    expect(AVATAR_PHOTO_BUCKET).toBe('avatars');
    expect(avatarPhotoPath('abc-123')).toBe('abc-123/avatar.jpg');
    expect(AVATAR_PHOTO_SIDE).toBe(256);
  });

  it('center-crops to a square (iOS AvatarUploader.resize / Android resizeToJpeg)', () => {
    expect(centerSquare(400, 300)).toEqual({ sx: 50, sy: 0, side: 300 });
    expect(centerSquare(300, 500)).toEqual({ sx: 0, sy: 100, side: 300 });
    expect(centerSquare(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 });
  });

  it('rejects non-images and files over 5MB', () => {
    expect(avatarPhotoProblem({ size: 1000, type: 'image/png' })).toBeNull();
    expect(avatarPhotoProblem({ size: AVATAR_PHOTO_MAX_BYTES, type: 'image/heic' })).toBeNull();
    expect(avatarPhotoProblem({ size: AVATAR_PHOTO_MAX_BYTES + 1, type: 'image/jpeg' })).toBe('Image must be under 5MB');
    expect(avatarPhotoProblem({ size: 10, type: 'application/pdf' })).toBe('Please choose an image');
  });

  it('remove clears profiles.avatar_url for the player and refreshes their cached look', async () => {
    await removeAvatarPhoto('u1');
    expect(update).toHaveBeenCalledWith('profiles', { avatar_url: null });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    expect(afterOwnAvatarSave).toHaveBeenCalledWith('u1');
  });
});
