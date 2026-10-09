'use client';

import type { ReactNode } from 'react';
import { CAST_COLORS, friendsSinceLine, headToHeadLine, levelTier, profileActions, type FriendshipState, type ProfileAction } from '@wordle-duel/core';
import { DressStage } from '@/components/profile/dress-up';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { BubbleText } from '@/components/ui/bubble-text';
import { CandyButton } from '@/components/ui/candy-button';
import { LevelBadge } from '@/components/badges/badge-art';
import { TIER_ACCENT } from '@/lib/badges';
import { ART_SIZE, artSrc } from '@/lib/art';
import { alphaHex, softCard, softPill } from '@/lib/soft-surface';
import { RecordBar } from '@/components/stats/stat-hero';
import { SoftNum } from '@/components/ui/soft-number';
import { usePocketRecords } from '@/components/stats/pocket-records';
import type { FriendProfile } from '@/lib/friends-service';
import { resolveAccent } from '@/lib/profile-personalization';
import { useLivingMascotOn } from '@/hooks/use-flags';

// FRIDAY-QUEUE item 17 (founder 10-07, Oliver's profile): the player's mascot full-body on a mini Stage (the Edit
// Profile podium + curtains), the name in the bubble lettering, a friendship badge + "Friends since Sep 2026" by the
// name (replacing the old top-right FRIENDS pill), rank + XP as one compact strip, and one clear family-button
// action row (Challenge · Pocket game · React · Add friend, or Requested / Accept–Decline) with Unfriend / Block /
// Report living in the "⋯" menu. The state -> buttons rules are core profileActions (same on iOS and Android).

export interface HeroProfile {
  id: string;
  username: string;
  avatar_url?: string | null;
  accent_color?: string | null;
  avatar_config?: unknown;
  avatar_cast_id?: string | null;
  avatar_frame?: string | null;
  is_pro?: boolean | null;
  level?: number | null;
  xp: number;
}

/** The mini Stage: backdrop + curtains + podium with the player's full-body mascot (alive when `living_mascot` is on). */
export function ProfileStage({ profile, height = 214, mascotSize = 132, children }: { profile: HeroProfile; height?: number; mascotSize?: number; children?: ReactNode }) {
  const livingOn = useLivingMascotOn();
  const look = usePlayerAvatar({
    name: profile.username, userId: profile.id, url: profile.avatar_url, accent: profile.accent_color,
    config: profile.avatar_config, castId: profile.avatar_cast_id, frame: profile.avatar_frame, level: profile.level, pro: profile.is_pro,
  });
  const standing = look.url ? (
    <MascotAvatar config={look.config} initial={look.initial} size={mascotSize} photoUrl={look.url} pro={look.pro} level={look.level} />
  ) : livingOn ? (
    <MascotAvatar config={look.config} initial={look.initial} size={mascotSize} cutout living />
  ) : undefined;
  return (
    <DressStage config={look.config} initial={look.initial} photo={standing} height={height} mascotSize={mascotSize} curtains rounded>
      {children}
    </DressStage>
  );
}

/** The friendship badge (art-pf-friendship-badge) beside the name. */
export function FriendshipBadge({ size = 30 }: { size?: number }) {
  const dims = (ART_SIZE as Record<string, readonly [number, number]>)['art-pf-friendship-badge'];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc('art-pf-friendship-badge')} alt="Friends" width={dims?.[0]} height={dims?.[1]} draggable={false} decoding="async"
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
}

/** Rank + XP as ONE compact strip: the tier level badge, a thin XP bar, "N XP to next". */
export function RankStrip({ level, xp }: { level: number; xp: number }) {
  const progress = (xp % 1000) / 10;
  const toNext = 1000 - (xp % 1000);
  const tier = TIER_ACCENT[levelTier(level)];
  return (
    <div className="flex items-center gap-3 mx-auto" style={{ maxWidth: 320 }}>
      <span className="inline-flex items-center px-3 py-0.5 shrink-0" style={softPill(tier, { bar: false })}>
        <LevelBadge level={level} size={30} numberSize={16} prefix="Lvl" tier />
      </span>
      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: alphaHex('#7c3aed', 0.14) }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
        </div>
        <p className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{toNext} XP to next</p>
      </div>
    </div>
  );
}

export interface HeroHandlers {
  onChallenge: () => void;
  onPocket: () => void;
  onReact: () => void;
  onAddFriend: () => void;
  onCancelRequest: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

const LABEL: Record<ProfileAction, string> = {
  challenge: 'Challenge', pocket: 'Pocket game', react: 'React', addFriend: 'Add friend', requested: 'Requested', accept: 'Accept', decline: 'Decline',
};

/** The action row: family buttons by friendship state (core profileActions), with the "⋯" menu at its end. */
export function ProfileActionRow({ state, h, busy, menu }: { state: FriendshipState; h: HeroHandlers; busy?: boolean; menu?: ReactNode }) {
  const { row } = profileActions(state);
  if (row.length === 0 && !menu) return null;
  const go: Record<ProfileAction, () => void> = {
    challenge: h.onChallenge, pocket: h.onPocket, react: h.onReact, addFriend: h.onAddFriend, requested: h.onCancelRequest, accept: h.onAccept, decline: h.onDecline,
  };
  const color = (a: ProfileAction) => (a === 'challenge' ? 'pink' : a === 'pocket' ? 'teal' : a === 'react' ? 'amber' : a === 'requested' || a === 'decline' ? 'peach' : 'purple');
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {row.map((a) => (
        <CandyButton key={a} onClick={go[a]} color={color(a)} size="sm" disabled={busy}>{LABEL[a]}</CandyButton>
      ))}
      {menu}
    </div>
  );
}

/** The identity block under the stage: name (bubble lettering) + friendship badge + "Friends since", rank strip. */
export function ProfileIdentity({ profile, friendsSince, isFriend, children }: { profile: HeroProfile; friendsSince?: string | null; isFriend: boolean; children?: ReactNode }) {
  const accent = resolveAccent(profile.accent_color ?? null);
  const since = isFriend ? friendsSinceLine(friendsSince) : null;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="flex items-center justify-center gap-2 w-full" style={{ maxWidth: 360 }}>
        <div className="min-w-0 flex-1">
          <BubbleText text={profile.username.toUpperCase()} accent={accent} maxSize={38} minSize={20} level={1} />
        </div>
        {isFriend && <FriendshipBadge />}
      </div>
      {isFriend && <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{since ?? 'Friends'}</p>}
      {children}
    </div>
  );
}

/**
 * HEAD TO HEAD (item 17): your record against this player — VS plus pocket games, the same numbers as the Stats page's
 * HEAD TO HEAD rows and the Friends card — as one line over a two-color record bar. Friends only (the data is friend-scoped).
 */
export function HeadToHeadStrip({ friend, name }: { friend: FriendProfile | null; name: string }) {
  const records = usePocketRecords(Boolean(friend));
  if (!friend) return null;
  const vs = { wins: friend.h2hW ?? 0, losses: friend.h2hL ?? 0, draws: 0 };
  const pocket = records?.byFriend[friend.id]?.total ?? { wins: 0, losses: 0, draws: 0 };
  const wins = vs.wins + pocket.wins;
  const losses = vs.losses + pocket.losses;
  if (wins + losses + pocket.draws === 0) return null;
  return (
    <div className="p-3 animate-fade-in-up" style={softCard(CAST_COLORS.D, { radius: 18 })}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="min-w-0" style={{ maxWidth: 240 }}>
          <BubbleText text="HEAD TO HEAD" accent={CAST_COLORS.D} align="left" maxSize={20} minSize={13} level={3} />
        </div>
        <SoftNum size={20} className="soft-num-auto shrink-0">{wins}–{losses}</SoftNum>
      </div>
      <RecordBar wins={wins} losses={losses} height={9} />
      <p className="text-[10.5px] font-extrabold mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>{headToHeadLine(vs, pocket)} · you vs {name}</p>
    </div>
  );
}
