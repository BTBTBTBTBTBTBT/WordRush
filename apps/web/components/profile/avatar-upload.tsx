'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Camera } from 'lucide-react';
import NextImage from 'next/image';
import { toast } from '@/hooks/use-toast';

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
