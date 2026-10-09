'use client';

import { useState, useRef } from 'react';
import { avatarPhotoProblem, uploadAvatarPhoto } from '@/lib/avatar-photo';
import { useAuth } from '@/lib/auth-context';
import { Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/lib/supabase-error-handler';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { avatarRadiusPx } from '@/lib/avatar-render';

interface AvatarUploadProps {
  size?: number;
  editable?: boolean;
  avatarUrl?: string | null;
  username?: string;
  /** Retired (AM2): an emoji avatar is never drawn. */
  emoji?: string | null;
  /** The shown player's profile accent (defaults to the signed-in player's when no username is passed). */
  accent?: string | null;
  /** FINISH_SPEC AA2: the shown player's Pro state when the page knows it (else the signed-in Pro player's own avatar is crowned). */
  pro?: boolean | null;
  /** FINISH_SPEC AH: the shown player's avatar_cast_id / avatar_frame / level when the page's row carries them (the signed-in player's own choice is always used). */
  castId?: string | null;
  frame?: string | null;
  level?: number | null;
  /** FINISH_SPEC AN3: the shown player's user id + avatar_config when the page's row carries them. */
  userId?: string | null;
  config?: unknown;
  /** Draw the photo (when there is one) even if the player shows their mascot (Edit Profile's photo option). */
  photoOnly?: boolean;
  /** Called after a new photo was stored. */
  onUploaded?: () => void;
  /** 10-06: the player's own living mascot (behind the livingMascot flag; the Stats card). */
  living?: boolean;
  /** 2.8 item 13: a mascot player stands free (no tile, backdrop or frame); a photo keeps its frame. */
  cutout?: boolean;
}

export function AvatarUpload({ size = 96, editable = true, avatarUrl, username, accent, pro, castId, frame, level, userId, config, photoOnly = false, onUploaded, living = false, cutout = false }: AvatarUploadProps) {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // An explicit avatarUrl (even null: another player with no photo) wins over the
  // signed-in player's own photo; omitted = show the signed-in player.
  const displayUrl = avatarUrl !== undefined ? avatarUrl : profile?.avatar_url;
  const displayName = username ?? profile?.username ?? '?';
  // AN5 / AN6: the photo (rounded square) or the mascot, in the player's frame, crowned when Pro.
  const look = usePlayerAvatar({ name: displayName, userId: username === undefined ? profile?.id : userId, url: displayUrl ?? null, accent, config, castId, frame, level, pro });
  const shownUrl = photoOnly ? displayUrl ?? null : look.url;
  const radius = avatarRadiusPx(size);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;

    const problem = avatarPhotoProblem(file);
    if (problem) {
      toast({ title: problem, variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Same rules as Edit Profile's Change Photo menu and iOS / Android (lib/avatar-photo.ts).
      await uploadAvatarPhoto(profile.id, file);
      await refreshProfile();
      onUploaded?.();
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
      <MascotAvatar
        config={look.config}
        initial={look.initial}
        size={size}
        photoUrl={shownUrl}
        pro={look.pro}
        level={look.level}
        label={displayName}
        living={living}
        cutout={cutout && !shownUrl}
      />

      {editable && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ background: 'rgba(59, 26, 120, 0.5)', borderRadius: radius }}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>
      )}

      {/* G5: a small candy camera badge says "tap to change" (decorative: the whole avatar is the target). */}
      {editable && size >= 56 && (
        <span
          aria-hidden="true"
          className="candy candy-purple candy-round absolute pointer-events-none"
          style={{ ['--candy-h' as string]: '28px', ['--candy-lip-h' as string]: '3px', ['--candy-ring' as string]: '1px', right: -4, bottom: -1, marginBottom: 0 } as React.CSSProperties}
        >
          <Camera className="w-3.5 h-3.5" color="#ffffff" strokeWidth={2.6} />
        </span>
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
