'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Camera } from 'lucide-react';
import NextImage from 'next/image';
import { toast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/lib/supabase-error-handler';
import { LetterTileAvatar, letterTileRadius } from '@/components/ui/letter-tile-avatar';

interface AvatarUploadProps {
  size?: number;
  editable?: boolean;
  avatarUrl?: string | null;
  username?: string;
  /** The shown player's emoji fallback (defaults to the signed-in player's when no username is passed). */
  emoji?: string | null;
  /** The shown player's profile accent (defaults to the signed-in player's when no username is passed). */
  accent?: string | null;
}

export function AvatarUpload({ size = 96, editable = true, avatarUrl, username, emoji, accent }: AvatarUploadProps) {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // An explicit avatarUrl (even null: another player with no photo) wins over the
  // signed-in player's own photo; omitted = show the signed-in player.
  const displayUrl = avatarUrl !== undefined ? avatarUrl : profile?.avatar_url;
  const displayName = username ?? profile?.username ?? '?';
  const own = username === undefined ? (profile as { accent_color?: string | null; avatar_emoji?: string | null } | null) : null;
  const tileAccent = accent !== undefined ? accent : own?.accent_color ?? null;
  const tileEmoji = emoji !== undefined ? emoji : own?.avatar_emoji ?? null;

  const resizeImage = (file: File, maxSize: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
          'image/jpeg',
          0.85,
        );
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be under 5MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const resized = await resizeImage(file, 256);
      const path = `${profile.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Append cache buster to force browser refresh
      const freshUrl = `${publicUrl}?t=${Date.now()}`;

      await (supabase as any)
        .from('profiles')
        .update({ avatar_url: freshUrl })
        .eq('id', profile.id);

      await refreshProfile();
    } catch (err) {
      console.error('Avatar upload failed:', err);
      handleSupabaseError(err, 'avatar-upload');
      toast({ title: 'Avatar upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="relative group cursor-pointer"
      style={{ width: size, height: size }}
      onClick={() => editable && fileInputRef.current?.click()}
    >
      {displayUrl ? (
        <NextImage
          src={displayUrl}
          alt={displayName}
          width={size}
          height={size}
          className="w-full h-full rounded-full object-cover border-3 border-white/30"
          unoptimized
        />
      ) : (
        // No photo: the letter tile (ART_SPEC §20). (The old circle's `border-3` was a no-op on
        // Tailwind 3.3 — no width utility — so there is no visible ring to carry over.)
        <LetterTileAvatar name={displayName} emoji={tileEmoji} accent={tileAccent} size={size} />
      )}

      {editable && (
        <div
          className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center${displayUrl ? ' rounded-full' : ''}`}
          style={displayUrl ? undefined : { borderRadius: letterTileRadius(size) }}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>
      )}

      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      )}
    </div>
  );
}
