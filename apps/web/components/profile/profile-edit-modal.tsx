'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { X as XIcon, Check, Pencil, Star } from 'lucide-react';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import {
  PLATFORMS,
  SocialIcon,
  sanitizeHandle,
  type SocialLinks,
} from '@/components/profile/social-links';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { ACHIEVEMENTS } from '@/lib/achievement-service';
import { ACCENT_COLORS, resolveAccent, accentDark } from '@/lib/profile-personalization';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface Props {
  open: boolean;
  onClose: () => void;
}

const BIO_MAX = 80;

export function ProfileEditModal({ open, onClose }: Props) {
  const { profile, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  const [username, setUsername] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [bio, setBio] = useState('');
  const [accent, setAccent] = useState<string | null>(null);
  const [favoriteMode, setFavoriteMode] = useState<string | null>(null);
  const [featured, setFeatured] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed local state from the current profile whenever the modal opens.
  useEffect(() => {
    if (open && profile) {
      const p = profile as any;
      setUsername(profile.username);
      setSocials((p.social_links as SocialLinks | null) ?? {});
      setBio(p.bio ?? '');
      setAccent(p.accent_color ?? null);
      setFavoriteMode(p.favorite_mode ?? null);
      setFeatured(p.featured_achievement ?? null);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
      // Which achievements has the player unlocked? (only those are pickable as a title)
      supabase.from('achievements').select('achievement_key').eq('user_id', profile.id)
        .then(({ data }: any) => setUnlocked(new Set((data ?? []).map((r: any) => r.achievement_key))));
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !profile) return null;

  const accentHex = resolveAccent(accent);
  const unlockedAchievements = ACHIEVEMENTS.filter((a) => unlocked.has(a.key));
  const featuredName = featured ? ACHIEVEMENTS.find((a) => a.key === featured)?.name : null;
  const favMode = favoriteMode ? PROFILE_MODES.find((m) => m.dbKey === favoriteMode) : null;
  const avatarUrl = (profile as any).avatar_url as string | null;

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

    const payload: Record<string, unknown> = {
      social_links: cleanedSocials,
      bio: bio.trim().slice(0, BIO_MAX) || null,
      accent_color: accent,
      favorite_mode: favoriteMode,
      featured_achievement: featured && unlocked.has(featured) ? featured : null,
    };
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

  const label = (t: string) => (
    <label className="block text-[10px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{t}</label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(26,26,46,0.55)' }}>
      <div
        ref={focusRef}
        className="w-full max-w-sm max-h-[92vh] overflow-y-auto relative"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '20px' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Accent bar — matches the app chrome */}
        <div className="h-1.5 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }} />

        <div className="p-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-3 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'var(--color-bg)' }}
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>

          <h2 className="text-lg font-black uppercase text-transparent bg-clip-text mb-3" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Edit Profile</h2>

          {/* Live preview */}
          <div className="rounded-2xl p-4 mb-5 flex flex-col items-center text-center" style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)' }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white overflow-hidden mb-2"
              style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentDark(accentHex)})` }}
            >
              {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (username.trim().charAt(0).toUpperCase() || '?')}
            </div>
            <div className="text-lg font-black" style={{ color: accentHex }}>{username.trim() || 'username'}</div>
            {featuredName && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full mt-1" style={{ background: `${accentHex}1a`, color: accentHex }}>
                <Star className="w-3 h-3" /> {featuredName}
              </span>
            )}
            {bio.trim() && <p className="text-xs font-bold mt-1.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>{bio.trim()}</p>}
            {favMode && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5" style={{ background: `${favMode.accentColor}1a`, color: favMode.accentColor }}>
                {favMode.icon ? <favMode.icon className="w-3 h-3" /> : null} {favMode.shortTitle}
              </span>
            )}
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <AvatarUpload size={72} editable />
            <p className="text-[10px] font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>Tap the avatar to upload a photo.</p>
          </div>

          {/* Username */}
          {label('Username')}
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            disabled={saving}
            className="w-full px-3 py-2 text-sm font-bold outline-none mb-4"
            style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: '10px', color: 'var(--color-text)' }}
          />

          {/* Bio */}
          <div className="flex items-center justify-between mb-1.5">
            {label('Bio')}
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{bio.length}/{BIO_MAX}</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            placeholder="A short tagline…"
            rows={2}
            disabled={saving}
            className="w-full px-3 py-2 text-sm font-bold outline-none mb-4 resize-none"
            style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: '10px', color: 'var(--color-text)' }}
          />

          {/* Accent color */}
          {label('Accent color')}
          <div className="flex flex-wrap gap-2 mb-4">
            {ACCENT_COLORS.map((c) => {
              const selected = (accent ?? '#7C3AED').toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.id}
                  onClick={() => setAccent(c.id === 'purple' ? null : c.hex)}
                  className="w-8 h-8 rounded-full"
                  style={{ background: c.hex, outline: selected ? `2px solid ${c.hex}` : 'none', outlineOffset: '2px', border: '2px solid var(--color-surface)' }}
                  aria-label={c.id}
                />
              );
            })}
          </div>

          {/* Featured title */}
          {label('Featured title')}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFeatured(null)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={featured == null
                ? { background: accentHex, color: '#fff' }
                : { background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >None</button>
            {unlockedAchievements.length === 0 && (
              <span className="text-[11px] font-bold py-1" style={{ color: 'var(--color-text-muted)' }}>Unlock achievements to wear one as a title.</span>
            )}
            {unlockedAchievements.map((a) => {
              const sel = featured === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setFeatured(a.key)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={sel
                    ? { background: accentHex, color: '#fff' }
                    : { background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  <Star className="w-3 h-3" /> {a.name}
                </button>
              );
            })}
          </div>

          {/* Favorite mode */}
          {label('Favorite mode')}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFavoriteMode(null)}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
              style={favoriteMode == null
                ? { background: accentHex, color: '#fff' }
                : { background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >None</button>
            {PROFILE_MODES.map((m) => {
              const sel = favoriteMode === m.dbKey;
              const Icon = m.icon;
              return (
                <button
                  key={m.dbKey}
                  onClick={() => setFavoriteMode(m.dbKey)}
                  title={m.title}
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: sel ? `${m.accentColor}22` : 'var(--color-bg)', border: `1.5px solid ${sel ? m.accentColor : 'var(--color-border)'}`, color: m.accentColor }}
                >
                  {Icon ? <Icon className="w-4 h-4" /> : <span className="text-[10px] font-black">{m.romanNumeral ?? m.shortTitle.charAt(0)}</span>}
                </button>
              );
            })}
          </div>

          {/* Socials */}
          {label('Socials')}
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
                  style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
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
              style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
            >Cancel</button>
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
    </div>
  );
}

export function EditProfileButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full"
      style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: '#7c3aed' }}
    >
      <Pencil className="w-3 h-3" />
      Edit profile
    </button>
  );
}
