'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { X as XIcon, Check, Pencil } from 'lucide-react';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import {
  PLATFORMS,
  SocialIcon,
  sanitizeHandle,
  type SocialLinks,
} from '@/components/profile/social-links';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ open, onClose }: Props) {
  const { profile, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed local state from the current profile whenever the modal opens
  // so edits don't leak between open/close cycles.
  useEffect(() => {
    if (open && profile) {
      setUsername(profile.username);
      setSocials(((profile as any).social_links as SocialLinks | null) ?? {});
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, profile]);

  if (!open || !profile) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setError('Username must be 3-20 characters');
      setSaving(false);
      return;
    }

    const cleanedSocials: SocialLinks = {};
    for (const p of PLATFORMS) {
      const v = sanitizeHandle(p.key, socials[p.key] ?? '');
      if (v) cleanedSocials[p.key] = v;
    }

    const payload: Record<string, unknown> = { social_links: cleanedSocials };
    if (trimmed !== profile.username) payload.username = trimmed;

    const { error: updErr } = await (supabase as any)
      .from('profiles')
      .update(payload)
      .eq('id', profile.id);

    if (updErr) {
      if (updErr.code === '23505' || updErr.message?.includes('unique') || updErr.message?.includes('duplicate')) {
        setError('Username already taken');
      } else {
        setError(updErr.message ?? 'Failed to save');
      }
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(26,26,46,0.55)' }}
    >
      <div
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 relative"
        style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '20px' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: '#f8f7ff' }}
          aria-label="Close"
        >
          <XIcon className="w-4 h-4" style={{ color: '#9ca3af' }} />
        </button>

        <h2 className="text-lg font-black mb-1" style={{ color: '#1a1a2e' }}>Edit profile</h2>
        <p className="text-xs font-bold mb-4" style={{ color: '#9ca3af' }}>
          Avatar, name, and links — all in one place.
        </p>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-4">
          <AvatarUpload size={88} editable />
          <p className="text-[10px] font-bold mt-1" style={{ color: '#9ca3af' }}>
            Tap the avatar to upload a new photo.
          </p>
        </div>

        {/* Username */}
        <label className="block text-[10px] font-extrabold uppercase mb-1" style={{ color: '#9ca3af' }}>Username</label>
        <input
          ref={inputRef}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          disabled={saving}
          className="w-full px-3 py-2 text-sm font-bold outline-none mb-4"
          style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', borderRadius: '10px', color: '#1a1a2e' }}
        />

        {/* Socials */}
        <label className="block text-[10px] font-extrabold uppercase mb-1" style={{ color: '#9ca3af' }}>Socials</label>
        <div className="space-y-2 mb-4">
          {PLATFORMS.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ color: p.color }}>
                <SocialIcon platform={p.key} className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={socials[p.key] ?? ''}
                onChange={(e) => setSocials((v) => ({ ...v, [p.key]: e.target.value }))}
                placeholder={p.placeholder}
                disabled={saving}
                className="flex-1 text-xs font-bold px-2.5 py-1.5 outline-none"
                style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', borderRadius: '8px', color: '#1a1a2e' }}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs font-bold text-red-500 mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black"
            style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', color: '#1a1a2e' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50 flex items-center justify-center gap-1"
            style={{ background: '#7c3aed' }}
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditProfileButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full"
      style={{ background: '#f3f0ff', border: '1.5px solid #ede9f6', color: '#7c3aed' }}
    >
      <Pencil className="w-3 h-3" />
      Edit profile
    </button>
  );
}
