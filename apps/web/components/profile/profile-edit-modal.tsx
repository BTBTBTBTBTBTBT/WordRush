'use client';

import { avatarAchievements, unlockAchievements } from '@/lib/achievement-service';
import { useEffect, useRef, useState } from 'react';
import { validateUsername } from '@wordle-duel/core';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Pencil, Star, Lock, Globe } from 'lucide-react';
import { CandyButton } from '@/components/ui/candy-button';
import { POPUP_DIM, PoseArt, PopupBar, popupCard, softInput, softRow } from '@/components/ui/soft-popup';
import { SoftSwitch } from '@/components/settings/settings-kit';
import { softBackground, softBorder } from '@/lib/soft-surface';
import { GameArt } from '@/components/ui/game-art';
import { HeaderBack } from '@/components/ui/page-header';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { MascotBuilder } from '@/components/avatar/mascot-builder';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { choiceForConfig, saveProfileWithAvatar, type ProfilesUpdater } from '@/lib/avatar-cast';
import { afterOwnAvatarSave } from '@/lib/avatar-directory';
import { avatarInitial } from '@/lib/avatar-render';
import type { AvatarConfig } from '@wordle-duel/core';
import {
  PLATFORMS,
  SocialIcon,
  sanitizeHandle,
  type SocialLinks,
} from '@/components/profile/social-links';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { GameSquare } from '@/components/ui/game-tile';
import { ACHIEVEMENTS } from '@/lib/achievement-service';
import { ACCENT_COLORS, resolveAccent } from '@/lib/profile-personalization';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { HeadingArt } from '@/components/ui/heading-art';

interface Props {
  open: boolean;
  onClose: () => void;
}

const BIO_MAX = 80;

export function ProfileEditModal({ open, onClose }: Props) {
  const { profile, refreshProfile, isProActive } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  const [username, setUsername] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [bio, setBio] = useState('');
  const [accent, setAccent] = useState<string | null>(null);
  const [favoriteMode, setFavoriteMode] = useState<string | null>(null);
  const [featured, setFeatured] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // FINISH_SPEC AN4: "Make your mascot" — the builder view (replaces the AH hero grid + frame row).
  const [view, setView] = useState<'profile' | 'mascot'>('profile');
  const [draft, setDraft] = useState<AvatarConfig | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarNote, setAvatarNote] = useState('');
  const [nudge, setNudge] = useState(false);
  // The signed-in player's avatar as it shows everywhere (saved config, a locally kept one, or the default).
  const ownLook = usePlayerAvatar({ name: profile?.username ?? null, userId: profile?.id ?? null });

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setView('profile');
    setDraft(null);
    setAvatarNote('');
  }, [open]);

  // AM2: players who had an emoji avatar get ONE gentle "Pick your character!" nudge (no DB change).
  useEffect(() => {
    if (!open || !profileId || !profile) return;
    const p = profile as Record<string, unknown>;
    const hadEmoji = typeof p.avatar_emoji === 'string' && p.avatar_emoji.trim().length > 0;
    if (!hadEmoji || (p.avatar_config && typeof p.avatar_config === 'object')) return;
    const key = `wordocious.pickCharacterNudge.${profileId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    setNudge(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId]);

  /** Tolerant save of the avatar (avatar_config + the legacy columns; kept on this device if the columns are missing). */
  const saveAvatar = async (config: AvatarConfig): Promise<boolean> => {
    if (!profile) return false;
    setAvatarSaving(true);
    setAvatarNote('');
    const res = await saveProfileWithAvatar(supabase as unknown as ProfilesUpdater, profile.id, {}, choiceForConfig(config));
    // FINISH_SPEC BE: Self Portrait / Dress Up once the mascot is saved.
    if (!res.error) void unlockAchievements(profile.id, avatarAchievements(config));
    setAvatarSaving(false);
    if (res.error) {
      setAvatarNote((res.error as { message?: string }).message ?? 'Could not save your avatar. Please try again.');
      return false;
    }
    afterOwnAvatarSave(profile.id);
    await refreshProfile();
    return true;
  };

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
      setIsPrivate(Boolean(p.is_private));
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
  const level = Number((profile as any).level) || 0;
  const initial = avatarInitial(username.trim() || profile.username);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const trimmed = username.trim();
    // Shape AND content. The DB trigger enforce_username_policy_trg is the
    // authority (a profile PATCH goes straight to PostgREST, so a check here
    // is bypassable); this just avoids a round trip and a raw Postgres error.
    // Only a CHANGED name is screened — mirrors the trigger, which leaves
    // existing rows alone so a name that predates the policy doesn't block
    // unrelated profile edits (bio, avatar, links).
    if (trimmed !== profile.username) {
      const check = validateUsername(trimmed);
      if (!check.ok) {
        setError(check.error ?? 'That username is not available.');
        setSaving(false);
        return;
      }
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
      is_private: isPrivate,
    };
    if (trimmed !== profile.username) payload.username = trimmed;

    // AN4: the avatar saves from the mascot builder (its own Save); this saves the rest.
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

    // BJ5: boards cached with the old name / accent are dropped.
    afterOwnAvatarSave(profile.id);
    await refreshProfile();
    setSaving(false);
    onClose();
  };

  const label = (t: string) => (
    <label className="block text-[10px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{t}</label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: POPUP_DIM }}>
      <div
        ref={focusRef}
        className="w-full max-w-sm max-h-[92vh] overflow-y-auto relative"
        style={{ ...popupCard(EDIT_ACCENT, { share: 0.08 }), overflowY: 'auto' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Accent bar — matches the app chrome (A1: the 10 px card top bar). */}
        <PopupBar accent={EDIT_ACCENT} gradient="linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)" />

        <div className="p-5">
          <HeaderBack kind="close" onClick={onClose} size={32} className="absolute top-4 right-3" />

          <div className="flex items-center gap-2 mb-3 pr-9">
            {/* A7: O2, the star, strutting beside the title (a secondary spot). */}
            <PoseArt pose="art-pose-o2-strut" size={44} />
            {/* BJ16: the view's heading lettering, not plain text. */}
            <HeadingArt key={view} slug={view === 'mascot' ? 'mascot' : 'editprofile'} as="h2" height={36} maxWidth={230} align="left" />
          </div>

          {view === 'mascot' && draft ? (
            <>
              <MascotBuilder
                value={draft}
                onChange={setDraft}
                initial={initial}
                isPro={isProActive}
                level={level}
                photoUrl={avatarUrl}
                saving={avatarSaving}
                onBack={() => setView('profile')}
                onSave={async (config) => {
                  if (await saveAvatar(config)) setView('profile');
                }}
              />
              {avatarNote && <p className="text-xs font-bold mt-2" style={{ color: 'var(--color-loss-text)' }}>{avatarNote}</p>}
            </>
          ) : (
          <>
          {/* Live preview */}
          <div className="p-4 mb-5 flex flex-col items-center text-center" style={softRow(accentHex, { radius: 18 })}>
            {/* AN5 / AN6: the avatar as it shows everywhere (photo or mascot), its letter live with the name. */}
            <MascotAvatar
              config={ownLook.config}
              initial={initial}
              size={64}
              photoUrl={ownLook.url}
              pro={ownLook.pro}
              level={ownLook.level}
              className="mb-2"
            />
            <div className="text-lg font-black" style={{ color: accentHex }}>{username.trim() || 'username'}</div>
            {featuredName && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full mt-1" style={{ background: `${accentHex}1a`, color: accentHex }}>
                <Star className="w-3 h-3" /> {featuredName}
              </span>
            )}
            {bio.trim() && <p className="text-xs font-bold mt-1.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>{bio.trim()}</p>}
            {favMode && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5" style={{ background: `${favMode.accentColor}1a`, color: favMode.accentColor }}>
                <GameArt id={favMode.id} size={16} className="-my-1" fallback={favMode.icon ? <favMode.icon className="w-3 h-3" /> : null} /> {favMode.shortTitle}
              </span>
            )}
          </div>

          {/* Avatar (AN4): make your mascot, or tap your picture to upload a photo. */}
          {label('Avatar')}
          {nudge && (
            // AM2: a one-time gentle nudge for players who had an emoji avatar.
            <div className="flex items-center gap-3 p-3 mb-2" style={softRow('#ec4899', { radius: 16 })} role="status">
              <MascotAvatar config={ownLook.config} initial={initial} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>Pick your character!</div>
                <div className="text-[11px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>Build a mascot that wears your initial.</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mb-1.5">
            <AvatarUpload
              size={56}
              editable
              accent={accent}
              photoOnly
              onUploaded={() => {
                // A new photo shows right away (the mascot / photo switch flips to the photo).
                if (ownLook.config.display !== 'photo') void saveAvatar({ ...ownLook.config, display: 'photo' });
              }}
            />
            <div className="flex-1 min-w-0">
              <CandyButton
                color="purple"
                size="sm"
                onClick={() => { setDraft(ownLook.config); setNudge(false); setView('mascot'); }}
                disabled={saving}
              >
                Make your mascot
              </CandyButton>
              <p className="text-[10px] font-bold leading-snug mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Tap your picture to upload a photo.
              </p>
            </div>
          </div>
          {avatarNote && <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-loss-text)' }}>{avatarNote}</p>}
          <div className="mb-4" />

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
            style={softInput(EDIT_ACCENT)}
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
            style={softInput(EDIT_ACCENT)}
          />

          {/* Accent color */}
          {label('Accent color')}
          {/* The swatches sit on a tray tinted in the chosen accent; each is a glossy candy dot, the chosen one ringed. */}
          <div className="flex flex-wrap gap-2.5 mb-4 p-2.5" style={softRow(accentHex, { radius: 16 })}>
            {ACCENT_COLORS.map((c) => {
              const selected = (accent ?? '#7C3AED').toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.id}
                  onClick={() => setAccent(c.id === 'purple' ? null : c.hex)}
                  className="w-8 h-8 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 28%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 45%), ${c.hex}`,
                    boxShadow: selected
                      ? `0 0 0 2px var(--color-card-base, #fff), 0 0 0 4.5px ${c.hex}, 0 3px 6px ${c.hex}66`
                      : `inset 0 -2.5px 0 rgba(0, 0, 0, 0.18), 0 2px 5px ${c.hex}55`,
                  }}
                  aria-label={c.id}
                  aria-pressed={selected}
                />
              );
            })}
          </div>

          {/* Featured title */}
          {label('Featured title')}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFeatured(null)}
              className="text-[11px] font-bold px-2.5 py-1"
              style={{ ...chip(accentHex, featured == null), color: featured == null ? 'var(--color-text)' : 'var(--color-text-muted)' }}
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
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1"
                  style={{ ...chip(accentHex, sel), color: 'var(--color-text)' }}
                >
                  <Star className="w-3 h-3" style={{ color: accentHex }} /> {a.name}
                </button>
              );
            })}
          </div>

          {/* Favorite mode */}
          {label('Favorite mode')}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFavoriteMode(null)}
              className="text-[11px] font-bold px-2.5 py-1.5"
              style={{ ...chip(accentHex, favoriteMode == null, 10), color: favoriteMode == null ? 'var(--color-text)' : 'var(--color-text-muted)' }}
            >None</button>
            {PROFILE_MODES.map((m) => {
              const sel = favoriteMode === m.dbKey;
              const Icon = m.icon;
              return (
                // Compact square game tile (docs/GAME_TILE_STYLE.md).
                <GameSquare
                  key={m.dbKey}
                  accent={m.accentColor}
                  selected={sel}
                  size={36}
                  glyph={Icon
                    ? <Icon className="w-4 h-4" style={{ color: m.accentColor }} />
                    : <span className="text-[10px] font-black" style={{ color: m.accentColor }}>{m.romanNumeral ?? m.shortTitle.charAt(0)}</span>}
                  onClick={() => setFavoriteMode(m.dbKey)}
                  aria-label={m.title}
                  aria-pressed={sel}
                />
              );
            })}
          </div>

          {/* Privacy */}
          {label('Privacy')}
          <div
            className="w-full flex items-center gap-3 px-3 py-2.5 mb-1.5"
            style={{ ...softRow(EDIT_ACCENT, { radius: 14 }), opacity: saving ? 0.5 : 1 }}
          >
            {isPrivate ? (
              <Lock className="w-4 h-4 shrink-0" style={{ color: '#7c3aed' }} />
            ) : (
              <Globe className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            )}
            <span className="flex-1 text-left text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
              Private profile
            </span>
            <SoftSwitch
              checked={isPrivate}
              onCheckedChange={(v) => setIsPrivate(v)}
              accent={EDIT_ACCENT}
              disabled={saving}
              label="Private profile"
            />
          </div>
          <p className="text-[10px] font-bold mb-4 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            Hide your words, stats, and game history from other players. You&apos;ll still appear on leaderboards.
          </p>

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
                  style={{ ...softInput(p.color), borderRadius: 10 }}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-loss-text)' }}>{error}</p>}

          <div className="flex gap-2">
            <CandyButton color="peach" size="md" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </CandyButton>
            <CandyButton color="purple" size="md" className="flex-1" icon="check" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </CandyButton>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

export function EditProfileButton({ onClick }: { onClick: () => void }) {
  return (
    <CandyButton color="purple" size="sm" onClick={onClick} icon={<Pencil className="w-3 h-3" color="#ffffff" strokeWidth={3} />}>
      Edit profile
    </CandyButton>
  );
}

/** The sheet's accent (brand purple). */
const EDIT_ACCENT = '#7c3aed';

/** A picker chip (featured title, favorite mode "None"): tinted, selected = stronger wash + ring. */
function chip(accent: string, selected: boolean, radius = 999): React.CSSProperties {
  return {
    background: softBackground(accent, selected ? 0.24 : 0.08),
    border: selected ? `2px solid ${accent}` : softBorder(accent, 0.08),
    borderRadius: radius,
  };
}
