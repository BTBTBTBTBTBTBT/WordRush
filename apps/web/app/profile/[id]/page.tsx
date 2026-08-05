'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import {
  Trophy,
  Target,
  Flame,
  Clock,
  Star,
  Zap,
  Swords,
  User,
  Check,
  X,
  ArrowLeft,
  MoreHorizontal,
  Flag,
  Ban,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { SocialLinksDisplay, type SocialLinks } from '@/components/profile/social-links';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModePicker, PROFILE_MODES } from '@/components/profile/mode-picker';
import { ACHIEVEMENTS } from '@/lib/achievement-service';
import { resolveAccent } from '@/lib/profile-personalization';
import { TopWordsCard } from '@/components/profile/top-words-card';
import { useAuth } from '@/lib/auth-context';
import { reportUser, blockUser, unblockUser, fetchBlockedIds, isBlocked } from '@/lib/moderation-service';
import { WIN_FG } from '@/lib/tile-theme';
import { modeLabel } from '@/lib/mode-labels';
import {
  fetchPersona,
  fetchTodayRing,
  presenceLabel,
  profileApiHeaders,
  type Persona,
  type TodayRing,
} from '@/lib/profile-social';
import {
  YouVsThemCard,
  TrophyCaseCard,
  HighlightsReel,
  LatelyCard,
  ArchetypeModal,
  archetypeName,
  ARCHETYPE_EMOJI,
} from '@/components/profile/profile-social';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserStats = Database['public']['Tables']['user_stats']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

const getMode = (dbKey: string) => PROFILE_MODES.find((m) => m.dbKey === dbKey);

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Same tier ladder the own-profile page renders next to the level badge. */
function levelTier(level: number) {
  if (level >= 100) return { label: 'Diamond', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' };
  if (level >= 51) return { label: 'Platinum', bg: '#f5f3ff', border: '#c4b5fd', color: '#6d28d9' };
  if (level >= 26) return { label: 'Gold', bg: '#fef9ec', border: '#fde68a', color: '#92400e' };
  if (level >= 11) return { label: 'Silver', bg: '#f3f4f6', border: '#d1d5db', color: '#374151' };
  return { label: 'Bronze', bg: '#fef2e8', border: '#fed7aa', color: '#9a3412' };
}

const REPORT_REASONS = [
  'Inappropriate username',
  'Inappropriate profile content',
  'Cheating or fake scores',
  'Other',
];

/** ⋯ report/block menu (App Review 1.2 parity) — only rendered when a
 *  signed-in user is viewing SOMEONE ELSE's profile. */
function ModerationMenu({ viewerId, profileId }: { viewerId: string; profileId: string }) {
  const [open, setOpen] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchBlockedIds(viewerId).then(() => {
      if (active) setBlocked(isBlocked(profileId));
    });
    return () => { active = false; };
  }, [viewerId, profileId]);

  const handleReport = async (reason: string) => {
    setOpen(false);
    setShowReasons(false);
    const ok = await reportUser(viewerId, profileId, reason, 'public_profile');
    setConfirmation(ok ? 'Report submitted. Thank you.' : 'Could not submit report. Try again later.');
  };

  const handleBlockToggle = async () => {
    setOpen(false);
    if (blocked) {
      await unblockUser(viewerId, profileId);
      setBlocked(false);
      setConfirmation('User unblocked.');
    } else {
      await blockUser(viewerId, profileId);
      setBlocked(true);
      setConfirmation("User blocked. You won't see them on leaderboards.");
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={() => { setOpen((o) => !o); setShowReasons(false); }}
        aria-label="Profile actions"
        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute top-9 z-20 w-56 overflow-hidden text-left"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          {!showReasons ? (
            <>
              <button
                onClick={() => setShowReasons(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-extrabold"
                style={{ color: 'var(--color-text)' }}
              >
                <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: '#dc2626' }} /> Report user
              </button>
              <button
                onClick={handleBlockToggle}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-extrabold"
                style={{ color: 'var(--color-text)', borderTop: '1px solid var(--color-border)' }}
              >
                <Ban className="w-3.5 h-3.5 shrink-0" style={{ color: '#dc2626' }} /> {blocked ? 'Unblock user' : 'Block user'}
              </button>
            </>
          ) : (
            <>
              <div
                className="px-3 py-2 text-[10px] font-black uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}
              >
                Report reason
              </div>
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleReport(reason)}
                  className="w-full px-3 py-2.5 text-xs font-extrabold text-left"
                  style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}
                >
                  {reason}
                </button>
              ))}
              <button
                onClick={() => setShowReasons(false)}
                className="w-full px-3 py-2 text-[11px] font-bold text-left"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {confirmation && (
        <p className="text-[11px] font-bold mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{confirmation}</p>
      )}
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params.id as string;
  const { user, profile: viewerProfile, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'solo' | 'vs'>('solo');
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [topWords, setTopWords] = useState<Array<{ word: string; count: number; wins: number }>>([]);

  // Profile-social layer — all non-blocking; the page renders without them
  // and the new cards fill in as data arrives.
  const [persona, setPersona] = useState<Persona | null>(null);
  const [todayRing, setTodayRing] = useState<TodayRing | null>(null);
  const [showArchetype, setShowArchetype] = useState(false);

  // PRIVATE PROFILES: everything below the profiles row itself is gated.
  // The server endpoints enforce it (403 { private: true }); the client
  // mirrors the same rule so it doesn't fire doomed requests or read the
  // still-world-readable tables (user_stats, daily_results) directly.
  const isPrivate = Boolean((profile as any)?.is_private);
  const isOwnProfile = Boolean(user && user.id === profileId);
  const viewerIsAdmin = Boolean((viewerProfile as any)?.is_admin);
  const gated = isPrivate && !isOwnProfile && !viewerIsAdmin;

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!data || error) setNotFound(true);
        else setProfile(data);
        setLoading(false);
      });
    return () => { active = false; };
  }, [profileId]);

  // Deep data — only once the profile row is here, auth has settled (the
  // owner's Bearer token is what opens the server gate), and the viewer is
  // allowed past the privacy gate.
  useEffect(() => {
    if (!profile || authLoading || gated) return;
    let active = true;

    // Matches come from the server endpoint, not a direct query: the matches
    // SELECT policy is participants-only, so a client read of someone ELSE'S
    // history returns zero rows (Recent Matches showed "No matches played yet"
    // on every profile but your own).
    (async () => {
      const headers = await profileApiHeaders();
      const [statsRes, matchesRes] = await Promise.all([
        supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', profileId),
        fetch(`/api/profile/${profileId}/matches`, { headers })
          .then((r) => (r.ok ? r.json() : { matches: [] }))
          .catch(() => ({ matches: [] })),
      ]);
      if (!active) return;
      if (statsRes.data) setStats(statsRes.data);
      setMatches(matchesRes.matches ?? []);
    })();

    fetchPersona(profileId).then((p) => { if (active) setPersona(p); });
    fetchTodayRing(profileId).then((r) => { if (active) setTodayRing(r); });
    return () => { active = false; };
  }, [profile, authLoading, gated, profileId]);

  useEffect(() => {
    // Server endpoint for the same RLS reason as matches above — and it now
    // honors the Solo/VS toggle (the old call was always solo-scoped).
    if (selectedMode && profileId && !gated && !authLoading) {
      let active = true;
      profileApiHeaders()
        .then((headers) => fetch(`/api/profile/${profileId}/top-words?mode=${selectedMode}&play=${activeTab}`, { headers }))
        .then((r) => (r.ok ? r.json() : { topWords: [] }))
        .then((d) => { if (active) setTopWords(d.topWords ?? []); })
        .catch(() => { if (active) setTopWords([]); });
      return () => { active = false; };
    } else {
      setTopWords([]);
    }
  }, [selectedMode, profileId, activeTab, gated, authLoading]);

  const filteredStats = stats.filter((s) => s.play_type === activeTab);
  const selectedModeStat = selectedMode ? filteredStats.find((s) => s.game_mode === selectedMode) : null;

  // For a private profile, hold the loading screen until auth settles so the
  // owner never sees their own teaser card flash before the full page.
  if (loading || (isPrivate && authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-lg font-black" style={{ color: 'var(--color-text)' }}>Loading...</div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center space-y-4 animate-fade-in-scale">
          <h1 className="text-4xl font-black" style={{ color: 'var(--color-text)' }}>Player not found</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>This profile doesn't exist or may have been removed.</p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-yellow-400 to-pink-500 text-white">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── PRIVATE PROFILE TEASER ────────────────────────────────────────────────
  // One clean card, styled like the profile header: identity + headline
  // numbers (all from the world-readable profiles row), a lock badge, and
  // nothing that reveals words or strategy. The deep endpoints 403 anyway;
  // this is the face on that rule.
  if (gated) {
    const tier = levelTier(profile.level ?? 1);
    const memberSince = (profile as any).created_at
      ? new Date((profile as any).created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;
    const teaserStats = [
      { label: 'Wins', value: profile.total_wins },
      { label: 'Games', value: profile.total_wins + profile.total_losses },
      { label: 'Daily Streak', value: (profile as any).daily_login_streak ?? 0 },
    ];
    const medals = [
      { emoji: '\u{1F947}', count: profile.gold_medals ?? 0 },
      { emoji: '\u{1F948}', count: profile.silver_medals ?? 0 },
      { emoji: '\u{1F949}', count: profile.bronze_medals ?? 0 },
    ];
    return (
      <div className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-sm mx-auto pt-8 space-y-4 animate-fade-in-up">
          <div
            className="rounded-2xl p-6 flex flex-col items-center text-center"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
          >
            <AvatarUpload size={96} editable={false} avatarUrl={profile.avatar_url} username={profile.username} />

            {(profile as any).accent_color ? (
              <h1 className="text-3xl font-black mt-3" style={{ color: resolveAccent((profile as any).accent_color) }}>{profile.username}</h1>
            ) : (
              <h1 className="text-3xl font-black mt-3 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
                {profile.username}
              </h1>
            )}

            {/* Lock badge — the notation the founder asked for */}
            <div
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide"
              style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <Lock className="w-3 h-3" /> This profile is private
            </div>
            <p className="text-xs font-bold mt-2 max-w-[240px]" style={{ color: 'var(--color-text-muted)' }}>
              {profile.username} keeps their words and strategies to themselves. You can still meet them on the daily leaderboards.
            </p>

            {/* Level + tier, member since — same chips as the profile header */}
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold"
                style={{ background: tier.bg, border: `1.5px solid ${tier.border}`, color: tier.color }}
              >
                <Star className="w-3.5 h-3.5" fill="currentColor" />
                Level {profile.level}
                <span className="opacity-70">·</span>
                <span>{tier.label}</span>
              </div>
              {memberSince && (
                <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Member since {memberSince}</p>
              )}
            </div>

            {/* Medal counts */}
            <div className="mt-4 flex items-center justify-center gap-4">
              {medals.map((m) => (
                <div key={m.emoji} className="flex items-center gap-1">
                  <span className="text-lg" aria-hidden="true">{m.emoji}</span>
                  <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{m.count}</span>
                </div>
              ))}
            </div>

            {/* Headline numbers */}
            <div className="mt-3 pt-3 w-full grid grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              {teaserStats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Report / Block still works on private profiles */}
          {user && user.id !== profileId && (
            <div className="flex justify-center">
              <ModerationMenu viewerId={user.id} profileId={profileId} />
            </div>
          )}

          <div className="flex justify-center">
            <Link href="/">
              <Button variant="outline" style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: '#7c3aed' }}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const levelProgress = (profile.xp % 1000) / 10;
  const xpToNextLevel = 1000 - (profile.xp % 1000);

  const winRate = profile.total_wins + profile.total_losses > 0
    ? ((profile.total_wins / (profile.total_wins + profile.total_losses)) * 100).toFixed(1)
    : '0.0';

  // Profile-social derived bits
  const presence = presenceLabel(profile.last_played_at);
  const fastest = stats
    .filter((s) => s.play_type === 'solo' && s.fastest_time > 0)
    .reduce<{ mode: string; seconds: number } | null>(
      (best, s) => (!best || s.fastest_time < best.seconds ? { mode: s.game_mode, seconds: s.fastest_time } : best),
      null,
    );

  return (
    <div className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
          {/* Avatar with today-progress ring + "N/9 today" pill */}
          <div className="relative" style={{ width: 128, height: 128 }}>
            {todayRing && (
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 86 86"
                style={{ transform: 'rotate(-90deg)' }}
                aria-hidden="true"
              >
                <circle cx="43" cy="43" r="40.5" fill="none" strokeWidth={4} stroke="var(--color-border)" />
                <circle
                  cx="43" cy="43" r="40.5" fill="none" strokeWidth={4} strokeLinecap="round"
                  stroke="#8B5CF6" strokeDasharray={254}
                  strokeDashoffset={254 * (1 - todayRing.done / todayRing.total)}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <AvatarUpload
                size={112}
                editable={false}
                avatarUrl={profile.avatar_url}
                username={profile.username}
              />
            </div>
            {todayRing && (
              <div
                className="absolute left-1/2 -translate-x-1/2 -bottom-1 px-2 py-0.5 rounded-full text-[9.5px] font-black text-white whitespace-nowrap"
                style={{ background: '#8B5CF6' }}
              >
                {todayRing.done}/{todayRing.total} today
              </div>
            )}
          </div>

          <div className="text-center">
            {(profile as any).accent_color ? (
              <h1 className="text-5xl font-black drop-shadow-lg" style={{ color: resolveAccent((profile as any).accent_color) }}>{profile.username}</h1>
            ) : (
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 drop-shadow-lg">
                {profile.username}
              </h1>
            )}

            {/* Private profile, owner/admin looking at the full page — the
                subtle "this is what everyone else can't see" reminder. */}
            {isPrivate && (
              <div className="mt-1.5 flex justify-center">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide"
                  style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  <Lock className="w-3 h-3" /> {isOwnProfile ? 'Your profile is private' : 'Private profile'}
                </span>
              </div>
            )}

            {/* Presence line — "Played X minutes ago" with a live pulse dot */}
            {presence && (
              <div
                className="mt-1 flex items-center justify-center gap-1.5 text-[11.5px] font-bold"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {presence.live && (
                  <span className="relative flex w-2 h-2" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: '#22c55e' }} />
                    <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: '#22c55e' }} />
                  </span>
                )}
                {presence.label}
              </div>
            )}

            {/* Persona chips: archetype (tap → explainer), best percentile, signature opener */}
            {persona && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <button
                  onClick={() => setShowArchetype(true)}
                  className="text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full transition-transform active:scale-95"
                  style={{ color: '#7c3aed', border: '1.5px solid #c4b5fd', background: 'var(--color-surface-hover)' }}
                >
                  {ARCHETYPE_EMOJI[persona.archetype]} {archetypeName(persona.archetype)}
                  <span className="opacity-60"> ›</span>
                </button>
                {persona.bestPercentile && (
                  <span
                    className="text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase"
                    style={{ color: '#0d9488', border: '1.5px solid #5eead4', background: 'rgba(13,148,136,0.08)' }}
                  >
                    Top {persona.bestPercentile.topPct}% · {modeLabel(persona.bestPercentile.mode)}
                  </span>
                )}
                {persona.opener && (
                  <span
                    className="text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full uppercase"
                    style={{ color: '#ec4899', border: '1.5px solid #f9a8d4', background: 'rgba(236,72,153,0.07)' }}
                  >
                    Opens with &ldquo;{persona.opener.word}&rdquo;
                  </span>
                )}
              </div>
            )}

            {/* Personalization: featured title, bio, favorite-mode chip */}
            {(() => {
              const accentHex = resolveAccent((profile as any).accent_color);
              const featuredName = (profile as any).featured_achievement
                ? ACHIEVEMENTS.find((a) => a.key === (profile as any).featured_achievement)?.name : null;
              const bioText = ((profile as any).bio as string | null)?.trim();
              const favMode = (profile as any).favorite_mode
                ? PROFILE_MODES.find((m) => m.dbKey === (profile as any).favorite_mode) : null;
              return (
                <div className="mt-2 flex flex-col items-center gap-1.5">
                  {featuredName && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide px-3 py-0.5 rounded-full" style={{ background: `${accentHex}1a`, color: accentHex }}>
                      <Star className="w-3 h-3" fill="currentColor" /> {featuredName}
                    </span>
                  )}
                  {bioText && <p className="text-sm font-bold max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{bioText}</p>}
                  {favMode && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-0.5 rounded-full" style={{ background: `${favMode.accentColor}1a`, color: favMode.accentColor }}>
                      {favMode.icon ? <favMode.icon className="w-3 h-3" /> : null} {favMode.shortTitle}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Level Badge & XP Bar */}
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1"
                style={{ background: 'var(--color-highlight-gold)', border: '1.5px solid var(--color-gold-border)' }}>
                <Star className="w-4 h-4" style={{ color: '#d97706' }} fill="currentColor" />
                <span className="font-bold text-sm" style={{ color: '#92400e' }}>Level {profile.level}</span>
              </div>
              <div className="w-48">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{xpToNextLevel} XP to next level</p>
              </div>
            </div>
          </div>

          {/* Report / Block (only when signed in and viewing someone else) */}
          {user && user.id !== profileId && (
            <ModerationMenu viewerId={user.id} profileId={profileId} />
          )}

          <SocialLinksDisplay links={(profile as any).social_links as SocialLinks | null} />

          <Link href="/">
            <Button variant="outline" style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: '#7c3aed' }}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Profile-social cards — You-vs-Them, Trophy Case, Highlights, Lately */}
        <div className="max-w-xl mx-auto w-full space-y-3">
          {user && !isOwnProfile && (
            <YouVsThemCard viewerId={user.id} targetId={profileId} targetName={profile.username} />
          )}
          <TrophyCaseCard
            targetId={profileId}
            targetName={profile.username}
            gold={profile.gold_medals ?? 0}
            silver={profile.silver_medals ?? 0}
            bronze={profile.bronze_medals ?? 0}
            persona={persona}
          />
          <HighlightsReel targetId={profileId} persona={persona} fastest={fastest} />
          <LatelyCard targetId={profileId} persona={persona} />
        </div>

        {/* Overall Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="rounded-2xl p-6 animate-fade-in-scale"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-gold-border)', animationDelay: '0.1s', animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Star className="w-8 h-8" style={{ color: '#d97706' }} fill="currentColor" />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Level</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.level}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span>Progress</span>
                <span>{xpToNextLevel} XP to next level</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-6 animate-fade-in-scale"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-win-bg)', animationDelay: '0.2s', animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8" style={{ color: WIN_FG }} />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Wins</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.total_wins}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{winRate}% win rate</div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-6 animate-fade-in-scale"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-gold-border-light)', animationDelay: '0.3s', animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8" style={{ color: '#ea580c' }} fill="currentColor" />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Win Streak</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.current_streak}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Best: {profile.best_streak}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-gold-border-light)' }}>
              <Zap className="w-6 h-6" style={{ color: '#7c3aed' }} />
              <div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Daily Login Streak</div>
                <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{(profile as any).daily_login_streak ?? 0}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Best: {(profile as any).best_daily_login_streak ?? 0}</div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-6 animate-fade-in-scale"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', animationDelay: '0.4s', animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8" style={{ color: '#2563eb' }} />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Games</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>
                  {profile.total_wins + profile.total_losses}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{profile.total_losses} losses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Tabs */}
        <div
          className="space-y-3 animate-fade-in-up"
          style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
        >
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Game Mode Statistics
          </div>

          {/* Solo / VS toggle */}
          <div className="flex gap-2">
            {(['solo', 'vs'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all"
                style={{
                  background: activeTab === t ? 'var(--color-surface)' : 'var(--color-surface-hover)',
                  border: activeTab === t ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
                  color: activeTab === t ? '#7c3aed' : 'var(--color-text-muted)',
                }}
              >
                {t === 'solo' ? <User className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                {t === 'solo' ? 'Solo' : 'VS'}
              </button>
            ))}
          </div>

          {/* Mode Picker */}
          <ModePicker
            showAll={false}
            selectedMode={selectedMode || (filteredStats[0]?.game_mode ?? 'DUEL')}
            onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
          />

          {/* Selected mode stats card */}
          {(() => {
            const modeKey = selectedMode || filteredStats[0]?.game_mode || 'DUEL';
            const stat = filteredStats.find((s) => s.game_mode === modeKey);
            const mode = getMode(modeKey);
            const color = mode?.accentColor || '#7c3aed';
            const Icon = mode?.icon;

            return (
              <div
                className="overflow-hidden"
                style={{
                  background: 'var(--color-surface)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '16px',
                }}
              >
                <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                <div className="px-4 pt-3 pb-2 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}15` }}
                  >
                    {mode?.romanNumeral ? (
                      <span className="text-[11px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span>
                    ) : Icon ? (
                      <Icon className="w-4 h-4" style={{ color }} />
                    ) : null}
                  </div>
                  <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>
                    {mode?.title || modeKey}
                  </div>
                </div>

                {stat ? (
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Wins', value: stat.wins, color: WIN_FG },
                        { label: 'Losses', value: stat.losses, color: '#dc2626' },
                        { label: 'Best', value: stat.best_score > 0 ? stat.best_score : '-', color: '#d97706' },
                        { label: 'Fastest', value: stat.fastest_time > 0 ? formatDuration(stat.fastest_time) : '-', color: '#2563eb' },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <div className="text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      No {activeTab} games played in this mode yet
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Top Words for selected mode */}
          {topWords.length > 0 && (
            <TopWordsCard
              words={topWords}
              accentColor={getMode(selectedMode || filteredStats[0]?.game_mode || 'DUEL')?.accentColor || '#7c3aed'}
            />
          )}
        </div>

        {/* Recent Matches Section */}
        <div
          className="rounded-2xl p-6 animate-fade-in-up"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', animationDelay: '0.6s', animationFillMode: 'both' }}
        >
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Clock className="w-6 h-6" style={{ color: '#2563eb' }} />
            Recent Matches
          </h2>

          {matches.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No matches played yet.
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllRecent ? matches : matches.slice(0, 5)).map((match, index) => {
                const isSolo = !match.player2_id;
                const isWinner = match.winner_id === profile.id;
                const isPlayer1 = match.player1_id === profile.id;
                const playerTime = isPlayer1 ? match.player1_time : (match.player2_time ?? 0);
                const matchDate = new Date(match.created_at);

                return (
                  <div
                    key={match.id}
                    className="rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in-up"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', animationDelay: `${0.7 + index * 0.05}s`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isWinner ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                          border: isWinner ? '1px solid var(--color-win-text)' : '1px solid var(--color-loss-text)',
                          opacity: 0.9,
                        }}
                      >
                        {isWinner ? (
                          <Check className="w-5 h-5" style={{ color: WIN_FG }} />
                        ) : (
                          <X className="w-5 h-5" style={{ color: '#dc2626' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
                          {getMode(match.game_mode)?.title || match.game_mode}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          {isSolo ? 'Solo' : 'VS Match'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <div>
                        <div className="font-bold text-sm" style={{ color: isWinner ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}>
                          {isWinner ? 'Win' : 'Loss'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {playerTime > 0 ? `${playerTime}s` : '-'}
                        </div>
                      </div>
                      <div className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
                        <div>{matchDate.toLocaleDateString()}</div>
                        <div>{matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {matches.length > 5 && (
                <button onClick={() => setShowAllRecent((v) => !v)} className="w-full mt-2 py-1 text-[11px] font-extrabold" style={{ color: '#7c3aed' }}>
                  {showAllRecent ? 'Show less' : `View all ${matches.length} →`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {persona && (
        <ArchetypeModal
          open={showArchetype}
          onClose={() => setShowArchetype(false)}
          targetName={profile.username}
          targetArchetype={persona.archetype}
          viewerId={user?.id ?? null}
        />
      )}

      <BottomNav />
    </div>
  );
}
