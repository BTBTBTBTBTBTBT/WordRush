'use client';

import { avatarAchievements, unlockAchievements } from '@/lib/achievement-service';
import { useEffect, useRef, useState } from 'react';
import { changePhotoRows, displayAfter, pickShow, showsChangePhoto, showsPhoto, validateUsername } from '@wordle-duel/core';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Pencil, Camera, ImageIcon } from 'lucide-react';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { POPUP_DIM } from '@/components/ui/soft-popup';
import { SoftSwitch } from '@/components/settings/settings-kit';
import { softBackground, softBorder } from '@/lib/soft-surface';
import { GameArt } from '@/components/ui/game-art';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { ITEM_GATING_ON, earnStatsFromProfile, loadOwnedItems } from '@/lib/avatar-access';
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
import { DressStage, STAGE_SIDE_SLOT, StageClose, TitleRibbon, backdropCss, devDressDemo, doorFromUrl, finishNudge, openDressUp, useDressUpRequests, warmDressArt, type DressDoor } from '@/components/profile/dress-up';
import { TitleShelves } from '@/components/profile/title-shelves';
import { applyAvatarPick, castPreset, validateAvatar } from '@wordle-duel/core';
import { randomAvatar } from '@/lib/avatar-render';
import { avatarPhotoProblem, canTakePhoto, removeAvatarPhoto, uploadAvatarPhoto } from '@/lib/avatar-photo';
import { QuietButton } from '@/components/ui/family-button';
import { FamilyActionMenu, FAMILY_MENU_INK, familyMenuInk, type FamilyMenuAction } from '@/components/ui/family-action-menu';
import { CastLoader } from '@/components/ui/cast-loader';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The door it opened through (founder 10-05: own-avatar taps, the Home host, the party-hat offer). */
  door?: DressDoor;
}

const BIO_MAX = 80;

export function ProfileEditModal({ open, onClose, door = { kind: 'stage' } }: Props) {
  const { profile, refreshProfile, isProActive } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  // The owned-items ledger (admin grants, earns, purchases): owned parts save without Pro.
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  useEffect(() => { void loadOwnedItems().then(setOwnedItems); }, []);
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
  // The Stage (founder 10-05): the live look, whether it changed, the hop, the sheets.
  const [look, setLook] = useState<AvatarConfig | null>(null);
  const [touched, setTouched] = useState(false);
  const [hop, setHop] = useState(0);
  const [sheet, setSheet] = useState<'titles' | 'socials' | 'privacy' | 'favorite' | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  // Change Photo (cloud prompt 07): the family menu, the upload in flight, the two pickers (library / camera).
  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  // The signed-in player's avatar as it shows everywhere (saved config, a locally kept one, or the default).
  const ownLook = usePlayerAvatar({ name: profile?.username ?? null, userId: profile?.id ?? null });

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!open) return;
    warmDressArt();
    setView('profile');
    setDraft(null);
    setAvatarNote('');
    setTouched(false);
    setSheet(null);
    setPhotoMenu(false);
    const base = { ...ownLook.config };
    setLook(base);
    if (door.kind === 'room') { setDraft({ ...base, display: 'mascot' }); setView('mascot'); }
    if (door.kind === 'partyhat') {
      if (profile) finishNudge('partyhat', profile.id);
      setDraft(applyAvatarPick({ ...base, display: 'mascot' }, 'head', 'party')); setView('mascot');
    }
    if (door.kind === 'titles') setSheet('titles');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      supabase.from('achievements').select('achievement_key,unlocked_at').eq('user_id', profile.id)
        .then(({ data }: any) => {
          setUnlocked(new Set((data ?? []).map((r: any) => r.achievement_key)));
          setDates(Object.fromEntries((data ?? []).map((r: any) => [r.achievement_key, r.unlocked_at ?? ''])));
        });
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    // Escape inside the Change Photo menu closes just the menu (it has its own handler).
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !photoMenu) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, photoMenu]);

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

    // Founder 10-05: ONE Save — the look (when it changed on the Stage) rides along with the rest.
    if (touched && look) {
      if (!(await saveAvatar(look))) { setSaving(false); return; }
      finishNudge('host', profile.id);
    }
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

  const photoShows = showsPhoto(look?.display, !!avatarUrl);
  const canChangePhoto = showsChangePhoto(look?.display, !!avatarUrl);
  const muted = '#6b5a96';
  const rowLabel = (t: string) => <span className="w-[84px] shrink-0 text-[10px] font-black uppercase tracking-[1px]" style={{ color: muted }}>{t}</span>;
  const row = (t: string, content: React.ReactNode, onClick?: () => void) => {
    const inner = <>{rowLabel(t)}<span className="flex-1 min-w-0 flex items-center gap-1.5">{content}</span>{onClick && <span className="font-black" style={{ color: '#a78bfa' }}>›</span>}</>;
    return onClick
      ? <button type="button" onClick={onClick} className="w-full flex items-center gap-2.5 py-2.5 border-0 bg-transparent text-left cursor-pointer" style={{ borderTop: '1px solid rgba(124,58,237,0.08)' }}>{inner}</button>
      : <div className="w-full flex items-center gap-2.5 py-2.5" style={{ borderTop: '1px solid rgba(124,58,237,0.08)' }}>{inner}</div>;
  };
  const setLookTouched = (c: AvatarConfig) => { setLook(c); setTouched(true); };

  // Change Photo: the same three rows as iOS / Android (Take photo on a device with a camera, Choose from library,
  // Remove photo when one is set). A new photo shows at once; a removed one falls back to the mascot.
  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = avatarPhotoProblem(file);
    if (problem) { setError(problem); return; }
    setError('');
    setPhotoBusy(true);
    try {
      await uploadAvatarPhoto(profile.id, file);
      await refreshProfile();
      setLook((l) => (l ? { ...l, display: displayAfter('uploaded') } : l));
      setTouched(true);
      setHop((h) => h + 1);
    } catch {
      setError('Avatar upload failed. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = async () => {
    setError('');
    setPhotoBusy(true);
    try {
      await removeAvatarPhoto(profile.id);
      await refreshProfile();
      setLook((l) => (l ? { ...l, display: displayAfter('removed') } : l));
      setTouched(true);
      setHop((h) => h + 1);
    } catch {
      setError('Could not remove your photo. Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const photoMenuRows: FamilyMenuAction[] = changePhotoRows(canTakePhoto(), !!avatarUrl).map((r) => {
    if (r === 'camera') {
      return { id: 'camera', title: 'Take photo', icon: <Camera className="w-[22px] h-[22px]" color={familyMenuInk(FAMILY_MENU_INK.purple)} strokeWidth={2.6} />, run: () => cameraInput.current?.click() };
    }
    if (r === 'library') {
      return { id: 'library', title: 'Choose from library', tint: FAMILY_MENU_INK.teal, icon: <ImageIcon className="w-[22px] h-[22px]" color={familyMenuInk(FAMILY_MENU_INK.teal)} strokeWidth={2.6} />, run: () => libraryInput.current?.click() };
    }
    return { id: 'remove', title: 'Remove photo', icon: 'xmark', danger: true, run: () => { void removePhoto(); } };
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-center" style={{ background: POPUP_DIM }}>
      <div ref={focusRef} className="w-full max-w-sm h-full overflow-y-auto relative" style={{ background: '#f6f0ff' }} role="dialog" aria-modal="true" aria-label="Edit profile">
        {view === 'mascot' && draft ? (
          <div className="p-5">
            <MascotBuilder
              value={draft}
              onChange={setDraft}
              initial={initial}
              isPro={isProActive}
              level={level}
              photoUrl={avatarUrl}
              saving={avatarSaving}
              onBack={() => setView('profile')}
              initialTab={door.kind === 'room' ? door.tab : undefined}
              saved={ownLook.config}
              owned={ownedItems}
              earnStats={ITEM_GATING_ON ? earnStatsFromProfile(profile as unknown as Record<string, unknown>, unlocked) : null}
              onSave={(config) => {
                // Done returns to the Stage with a soft hop (saved with the one Save).
                setLookTouched({ ...config, display: look?.display === 'photo' && avatarUrl && door.kind === 'stage' ? 'photo' : 'mascot' });
                setView('profile');
                window.setTimeout(() => setHop((h) => h + 1), 400);
              }}
            />
            {avatarNote && <p className="text-xs font-bold mt-2" style={{ color: 'var(--color-loss-text)' }}>{avatarNote}</p>}
          </div>
        ) : look && (
          <>
            <DressStage
              config={look} initial={initial} height={320} hopToken={hop}
              photo={photoShows ? (
                <button type="button" aria-label="Change photo" disabled={photoBusy} onClick={() => setPhotoMenu(true)}
                  className="border-0 bg-transparent p-0 cursor-pointer transition-transform duration-100 active:scale-[0.96] motion-reduce:active:scale-100">
                  <MascotAvatar config={look} initial={initial} size={130} photoUrl={avatarUrl} pro={isProActive} level={level} />
                </button>
              ) : undefined}
            >
              {/* × and SAVE in equal side slots (the heading centers, both stay inside the stage); SAVE is the
                  finished cast primary (the frost helper pill read pale on the stage). */}
              <div className="absolute inset-x-0 top-0 flex items-center gap-1 px-3 pt-3">
                <span className="flex items-center" style={{ width: STAGE_SIDE_SLOT, marginLeft: -8 }}><StageClose label="Cancel" onClick={onClose} /></span>
                <span className="flex-1 min-w-0 flex justify-center"><HeadingArt slug="editprofile" as="h2" height={32} maxWidth={200} /></span>
                <span className="flex items-center justify-end" style={{ width: STAGE_SIDE_SLOT }}>
                  <CastButton color="purple" size="s" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</CastButton>
                </span>
              </div>
            </DressStage>
            <div className="flex flex-col items-center mt-2 px-4">
              <div className="text-[22px] font-black truncate max-w-full" style={{ color: accent ? accentHex : '#6d28d9' }}>{username.trim() || 'username'}</div>
              <button type="button" onClick={() => setSheet('titles')} className="border-0 bg-transparent p-0 mt-1 cursor-pointer" aria-label="Opens the title picker">
                <TitleRibbon text={featuredName ?? 'Choose a title'} placeholder={!featuredName} maxWidth={250} />
              </button>
            </div>
            <div className="flex items-center gap-2.5 px-4 mt-3.5">
              <CandyButton color="pink" size="lg" className="flex-1" onClick={() => { setDraft({ ...look, display: 'mascot' }); setView('mascot'); }}>✦ MAKE YOUR MASCOT</CandyButton>
              <button type="button" aria-label="Randomize my mascot" onClick={() => { setLookTouched({ ...randomAvatar(look, Math.random, { isPro: isProActive }), display: look.display }); setHop((h) => h + 1); }}
                className="w-[52px] h-[52px] rounded-full border-0 flex items-center justify-center cursor-pointer"
                style={{ background: 'linear-gradient(#5eead4, #0d9488)', boxShadow: '0 3px 0 #0f766e, inset 0 2px 0 rgba(255,255,255,0.45)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="#fff" />{[[8, 8], [16, 8], [12, 12], [8, 16], [16, 16]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="1.8" fill="#0f766e" />)}</svg>
              </button>
            </div>
            {error && <p className="text-xs font-bold mt-2 px-4" style={{ color: 'var(--color-loss-text)' }}>{error}</p>}
            {avatarNote && <p className="text-xs font-bold mt-2 px-4" style={{ color: 'var(--color-loss-text)' }}>{avatarNote}</p>}
            <div className="text-center text-[10px] font-black uppercase tracking-[1.2px] mt-3.5" style={{ color: muted }}>Backdrop</div>
            <div className="flex justify-center gap-2 mt-1.5">
              {['auto', 'cottoncandy', 'sunset', 'aurora', 'mint', 'lemon', 'night', 'sunburst'].filter((id) => id === 'auto' || isProActive || !['aurora', 'galaxy'].includes(id)).slice(0, 8).map((id) => (
                <button key={id} type="button" aria-label={`${id} backdrop`} aria-pressed={look.bg === id} onClick={() => setLookTouched({ ...look, bg: id })}
                  className="w-[30px] h-[30px] rounded-full border-2 border-white cursor-pointer p-0"
                  style={{ background: backdropCssFor(id, look.color), boxShadow: look.bg === id ? '0 0 0 3px #f5b82e' : '0 2px 5px rgba(60,30,120,0.18)', transform: look.bg === id ? 'scale(1.1)' : undefined }} />
              ))}
              <button type="button" aria-label="More backdrops" onClick={() => { setDraft({ ...look, display: 'mascot' }); setView('mascot'); }}
                className="w-[30px] h-[30px] rounded-full border-0 font-black text-xs cursor-pointer" style={{ background: 'rgba(255,255,255,0.7)', color: '#7c3aed' }}>•••</button>
            </div>
            <div className="text-center text-[10px] font-black uppercase tracking-[1.2px] mt-2.5" style={{ color: muted }}>Frame <span className="normal-case tracking-normal font-extrabold">· how you look in lists</span></div>
            <div className="flex justify-center gap-2 mt-1.5">
              {(['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'] as const).map((id) => (
                <button key={id} type="button" aria-label={`${id} frame`} aria-pressed={look.frame === id} onClick={() => setLookTouched({ ...look, frame: id })}
                  className="w-9 h-9 rounded-[10px] border-0 p-0.5 flex items-center justify-center cursor-pointer text-[9px] font-black"
                  style={{ background: look.frame === id ? '#fff' : 'rgba(255,255,255,0.55)', boxShadow: look.frame === id ? '0 0 0 2px #a78bfa' : undefined, color: muted }}>
                  {id === 'none' ? 'None' : <MascotAvatar config={{ ...look, eyes: 'none', mouth: 'none', nose: 'none', cheeks: 'none', head: 'none', face: 'none', neck: 'none', frame: id } as AvatarConfig} initial=" " size={30} />}
                </button>
              ))}
            </div>
            <div className="px-4 mt-2 pb-8">
              {row('Show', (
                <span className="flex rounded-full p-[3px] w-full" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  {(['mascot', 'photo'] as const).map((d) => (
                    <button key={d} type="button" aria-pressed={(photoShows ? 'photo' : 'mascot') === d}
                      onClick={() => {
                        // "My photo" with no photo yet opens Change Photo (iOS / Android parity) instead of a dead button.
                        const pick = pickShow(d, !!avatarUrl);
                        if (pick.openMenu) { setPhotoMenu(true); return; }
                        if (pick.display) { setLookTouched({ ...look, display: pick.display }); setHop((h) => h + 1); }
                      }}
                      className="flex-1 text-xs font-black py-1.5 rounded-full border-0 cursor-pointer"
                      style={(photoShows ? 'photo' : 'mascot') === d ? { background: 'linear-gradient(#8b5cf6, #6d28d9)', color: '#fff' } : { background: 'transparent', color: '#6d28d9' }}>
                      {d === 'mascot' ? 'My mascot' : 'My photo'}
                    </button>
                  ))}
                </span>
              ))}
              {/* Change photo: a small quiet pill under SHOW while the photo shows; the cast wave while one uploads. */}
              {photoBusy ? (
                <div role="status" aria-label="Uploading photo" className="flex justify-center pb-2.5"><CastLoader size={16} /></div>
              ) : canChangePhoto && (
                <div className="flex justify-center pb-2.5">
                  <QuietButton size="sm" onClick={() => setPhotoMenu(true)}>Change photo</QuietButton>
                </div>
              )}
              {row('Username', <input ref={inputRef} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} disabled={saving} aria-label="Username"
                className="w-full bg-transparent border-0 outline-none text-[15px] font-extrabold" style={{ color: '#2a1650' }} />)}
              {row('Bio', <input value={bio} onChange={(e) => setBio(Array.from(e.target.value).slice(0, BIO_MAX).join(''))} placeholder="A short tagline…" disabled={saving} aria-label="Bio"
                className="w-full bg-transparent border-0 outline-none text-sm font-bold" style={{ color: '#2a1650' }} />)}
              {row('Title', <span className="text-xs font-black px-2.5 py-0.5 rounded-full truncate" style={{ color: '#92400e', background: 'linear-gradient(#fef3c7, #fde68a)' }}>{featuredName ?? 'Choose one'}</span>, () => setSheet('titles'))}
              {row('Favorite', favMode ? <span className="text-sm font-extrabold truncate" style={{ color: '#2a1650' }}>{favMode.title}</span> : <span className="text-sm font-bold" style={{ color: muted }}>Pick a game</span>, () => setSheet('favorite'))}
              {row('Name color', (
                <span className="flex gap-1.5">
                  {ACCENT_COLORS.map((c) => {
                    const selected = (accent ?? '#7C3AED').toLowerCase() === c.hex.toLowerCase();
                    return <button key={c.id} type="button" aria-label={`${c.id} name color`} aria-pressed={selected} onClick={() => setAccent(c.id === 'purple' ? null : c.hex)}
                      className="w-[18px] h-[18px] rounded-full border-0 p-0 cursor-pointer" style={{ background: c.hex, boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}` : undefined }} />;
                  })}
                </span>
              ))}
              {row('Private', <span className="text-[13px] font-bold truncate" style={{ color: muted }}>{isPrivate ? 'On · words & history hidden' : 'Off'}</span>, () => setSheet('privacy'))}
              {row('Socials', <span className="text-[13px] font-bold" style={{ color: muted }}>{(() => { const n = PLATFORMS.filter((p) => (socials[p.key] ?? '').trim()).length; return n === 0 ? 'Add links' : `${n} link${n === 1 ? '' : 's'}`; })()}</span>, () => setSheet('socials'))}
            </div>
          </>
        )}
        <input ref={libraryInput} type="file" accept="image/*" className="hidden" aria-hidden="true" tabIndex={-1} onChange={onPhotoPicked} />
        <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden" aria-hidden="true" tabIndex={-1} onChange={onPhotoPicked} />
        {photoMenu && (
          <FamilyActionMenu title="Change Photo" subtitle="A new photo or one from your library" label="Change photo"
            actions={photoMenuRows} onClose={() => setPhotoMenu(false)} />
        )}
        {(sheet === 'socials' || sheet === 'privacy' || sheet === 'favorite') && (
          <div className="fixed inset-0 z-[55] flex items-end justify-center" style={{ background: 'rgba(30,16,60,0.35)' }} onClick={() => setSheet(null)}>
            <div className="w-full max-w-sm rounded-t-[22px] p-5 pb-7" style={{ background: '#fbf8ff' }} onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 rounded mx-auto mb-3" style={{ background: '#c4b5fd' }} />
              <div className="text-lg font-black text-center mb-2" style={{ color: '#6d28d9' }}>{sheet === 'socials' ? 'Your links' : sheet === 'privacy' ? 'Private profile' : 'Favorite game'}</div>
              {sheet === 'socials' && PLATFORMS.map((p) => (
                <div key={p.key} className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid rgba(124,58,237,0.08)' }}>
                  <span className="w-6 h-6 flex items-center justify-center" style={{ color: p.color }}><SocialIcon platform={p.key} className="w-4 h-4" /></span>
                  <input value={socials[p.key] ?? ''} onChange={(e) => setSocials((v) => ({ ...v, [p.key]: e.target.value }))} placeholder={p.placeholder} aria-label={p.label}
                    className="flex-1 bg-transparent border-0 outline-none text-sm font-bold" style={{ color: '#2a1650' }} />
                </div>
              ))}
              {sheet === 'privacy' && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-extrabold" style={{ color: '#2a1650' }}>Hide my words, stats and game history</span>
                    <SoftSwitch checked={isPrivate} onCheckedChange={(v) => setIsPrivate(v)} accent={EDIT_ACCENT} label="Private profile" />
                  </div>
                  <p className="text-xs font-bold mt-2" style={{ color: muted }}>You&apos;ll still appear on leaderboards.</p>
                </>
              )}
              {sheet === 'favorite' && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <button type="button" onClick={() => { setFavoriteMode(null); setSheet(null); }} className="text-[11px] font-bold px-2.5 py-1.5" style={{ ...chip(accentHex, favoriteMode == null, 10), color: muted }}>None</button>
                  {PROFILE_MODES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <GameSquare key={m.dbKey} accent={m.accentColor} selected={favoriteMode === m.dbKey} size={40}
                        glyph={Icon ? <Icon className="w-4 h-4" style={{ color: m.accentColor }} /> : <span className="text-[10px] font-black" style={{ color: m.accentColor }}>{m.romanNumeral ?? m.shortTitle.charAt(0)}</span>}
                        onClick={() => { setFavoriteMode(m.dbKey); setSheet(null); }} aria-label={m.title} aria-pressed={favoriteMode === m.dbKey} />
                    );
                  })}
                </div>
              )}
              <div className="flex justify-center mt-4"><CandyButton color="purple" size="sm" onClick={() => setSheet(null)}>Done</CandyButton></div>
            </div>
          </div>
        )}
        {sheet === 'titles' && look && (
          <TitleShelves username={username.trim() || profile.username} mascot={look} initial={initial} accent={accent ? accentHex : '#6d28d9'}
            unlockedDates={dates} selected={featured} onClose={() => setSheet(null)}
            onDone={(k) => { setFeatured(k); setSheet(null); setHop((h) => h + 1); }} />
        )}
      </div>
    </div>
  );
}

/**
 * Founder 10-05: the one Edit Profile (the Stage) every door opens — mounted once in the app layout,
 * opened with openDressUp() from the Stats card avatar, your own podium place / board row, the Home host
 * and the party-hat offer.
 */
/** DEV demo: the look the demo room opened on (its "saved" look). */
const DEMO_SAVED: { current: AvatarConfig | null } = { current: null };

export function DressUpHost() {
  const { user, profile } = useAuth();
  const [door, setDoor] = useState<DressDoor | null>(null);
  useDressUpRequests((d) => { if (user && profile) setDoor(d); });
  // A door from another page (/stats?dress=…) opens once the profile is in.
  const fromUrl = useRef(false);
  useEffect(() => {
    if (fromUrl.current || !user || !profile) return;
    const d = doorFromUrl();
    if (d) { fromUrl.current = true; setDoor(d); window.history.replaceState(null, '', window.location.pathname); }
  }, [user, profile]);
  return <ProfileEditModal open={door !== null} door={door ?? undefined} onClose={() => setDoor(null)} />;
}

/**
 * DEV only (never in production: devDressDemo returns null there): `/?dressDemo=room-<tab>` shows the Dressing Room
 * for a GUEST on Home (iOS -storeShot room-<tab>, Android --es dressDemo room-<tab> parity); `&dressLook=k=v,…` sets
 * the look it opens on (= its saved look). Nothing saves.
 */
export function DevDressRoom() {
  const [demoRoom, setDemoRoom] = useState<{ tab: string; look: AvatarConfig } | null>(null);
  useEffect(() => {
    const demo = devDressDemo();
    if (demo?.door?.kind === 'room') setDemoRoom({ tab: demo.door.tab, look: validateAvatar({ ...castPreset('w'), ...demo.look }, castPreset('w')) });
  }, []);
  if (demoRoom) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center" style={{ background: POPUP_DIM }}>
        <div className="w-full max-w-sm h-full overflow-y-auto relative" style={{ background: '#f6f0ff' }} role="dialog" aria-modal="true" aria-label="Dressing room (dev demo)">
          <div className="p-5">
            <MascotBuilder value={demoRoom.look} onChange={(c) => setDemoRoom({ ...demoRoom, look: c })} initial="W" isPro level={24}
              onBack={() => setDemoRoom(null)} onSave={() => setDemoRoom(null)} initialTab={demoRoom.tab} saved={DEMO_SAVED.current ??= demoRoom.look} />
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function EditProfileButton({ onClick }: { onClick: () => void }) {
  return (
    <CandyButton color="purple" size="sm" onClick={onClick} icon={<Pencil className="w-3 h-3" color="#ffffff" strokeWidth={3} />}>
      Edit profile
    </CandyButton>
  );
}

/** A backdrop swatch (the stage's own CSS). */
function backdropCssFor(id: string, color: string): string { return backdropCss(id, color); }

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
