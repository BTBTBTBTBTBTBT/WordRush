import { supabase } from '@/lib/supabase-client';
import { afterOwnAvatarSave } from '@/lib/avatar-directory';

// The avatar photo upload, shared by Edit Profile's Change Photo menu and the profile-page avatar (cloud prompt
// 07). The SAME rules iOS (AvatarUploader) and Android (EditProfileScreen.uploadUri) use: center-cropped square,
// resized to 256², JPEG 0.85, upserted to the public `avatars` bucket at `<uid>/avatar.jpg`, then
// profiles.avatar_url = the public URL + a `?t=` cache-buster (its own write, before Save).

export const AVATAR_PHOTO_BUCKET = 'avatars';
export const AVATAR_PHOTO_SIDE = 256;
export const AVATAR_PHOTO_QUALITY = 0.85;
/** Web keeps its pre-resize cap (the native pickers hand over already-bounded images). */
export const AVATAR_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const avatarPhotoPath = (userId: string) => `${userId}/avatar.jpg`;

/** Why a picked file can't be used (null = fine). */
export function avatarPhotoProblem(file: { size: number; type?: string }): string | null {
  if (file.type && !file.type.startsWith('image/')) return 'Please choose an image';
  if (file.size > AVATAR_PHOTO_MAX_BYTES) return 'Image must be under 5MB';
  return null;
}

/** The centered square the photo is cropped to (source pixels), before it's drawn at AVATAR_PHOTO_SIDE². */
export function centerSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

/** A camera a file input can open (`capture`): phones and tablets (a coarse pointer); desktops pick files only. */
export function canTakePhoto(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function resizeToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_PHOTO_SIDE;
      canvas.height = AVATAR_PHOTO_SIDE;
      const ctx = canvas.getContext('2d')!;
      const { sx, sy, side } = centerSquare(img.width, img.height);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PHOTO_SIDE, AVATAR_PHOTO_SIDE);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        AVATAR_PHOTO_QUALITY,
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/** Resize, upload and write profiles.avatar_url; returns the new (cache-busted) URL. Throws on failure. */
export async function uploadAvatarPhoto(userId: string, file: File): Promise<string> {
  const resized = await resizeToJpeg(file);
  const path = avatarPhotoPath(userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_PHOTO_BUCKET)
    .upload(path, resized, { upsert: true, contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { data: { publicUrl } } = supabase.storage.from(AVATAR_PHOTO_BUCKET).getPublicUrl(path);
  // Cache-buster so the new image shows at once.
  const freshUrl = `${publicUrl}?t=${Date.now()}`;
  const { error } = await (supabase as any).from('profiles').update({ avatar_url: freshUrl }).eq('id', userId);
  if (error) throw error;
  afterOwnAvatarSave(userId);
  return freshUrl;
}

/** Clear profiles.avatar_url (the stored file stays; the next upload overwrites it, like iOS / Android). */
export async function removeAvatarPhoto(userId: string): Promise<void> {
  const { error } = await (supabase as any).from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw error;
  afterOwnAvatarSave(userId);
}
