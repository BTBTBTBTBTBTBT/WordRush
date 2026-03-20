'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Camera } from 'lucide-react';

interface AvatarUploadProps {
  size?: number;
  editable?: boolean;
  avatarUrl?: string | null;
  username?: string;
}

export function AvatarUpload({ size = 96, editable = true, avatarUrl, username }: AvatarUploadProps) {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = avatarUrl ?? profile?.avatar_url;
  const displayName = username ?? profile?.username ?? '?';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

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
        <img
          src={displayUrl}
          alt={displayName}
          className="w-full h-full rounded-full object-cover border-3 border-white/30"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-3 border-white/30"
          style={{ width: size, height: size }}
        >
          <span className="text-white font-black" style={{ fontSize: size * 0.35 }}>
            {initials}
          </span>
        </div>
      )}

      {editable && (
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
