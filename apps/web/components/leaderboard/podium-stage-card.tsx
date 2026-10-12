'use client';

import Link from 'next/link';
import { avatarPlacePose, AVATAR_BACKDROPS } from '@wordle-duel/core';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { BoardAvatar } from '@/components/leaderboard/board-rows';
import { DressStage, StageClose } from '@/components/profile/dress-up';
import { BubbleText } from '@/components/ui/bubble-text';
import { CastLink } from '@/components/ui/cast-button';
import { nameColorHex } from '@/lib/player-tint';
import type { PodiumPlace } from '@/components/leaderboard/podium';

// 2.8 item 13: tap a podium mascot and a mini Stage card opens: that player's mascot standing on the stage in their
// backdrop (posed for the place they hold), their name, level and points, and a quiet View profile link. No new data:
// the same look the podium already drew. (Behind the living mascot switch, like the standing figures themselves.)

/** The place's metal: gold / silver / bronze (iOS PodiumStageCard glow). */
const GOLD_POINTS = { top: '#FFF1B8', bottom: '#F5B82E', deep: '#92400E', nameTop: '#FFF1B8', nameBottom: '#F5B82E' } as const;
const METAL = ['#FCD34D', '#E2E8F0', '#FB923C'] as const;

/**
 * Founder 10-12: the card's finish. Static gradients only (no blur, no animation). Dark / season: deep violet with a warm gold
 * spotlight behind the pedestal; light: lavender to pink. The stage fades into the band under it (same top color), so there is
 * no seam. A player's own backdrop stays (it is their look) with a soft vignette; one without gets the themed gradient. Scoped to
 * this sheet; DressStage itself is untouched. iOS / Android: PodiumSheetPalette.
 */
const SHEET_CSS = `
.pod-sheet{--pod-top:#EEE6FF;--pod-bot:#F6D3EC;--pod-band-top:#FBDDEE;--pod-band-bot:#FEEFF7;--pod-spot:rgba(255,255,255,.6);--pod-vig:rgba(196,181,253,.32);--pod-wash:rgba(0,0,0,0)}
[data-theme="dark"] .pod-sheet{--pod-top:#1F0E45;--pod-bot:#4A2392;--pod-band-top:#2B1559;--pod-band-bot:#180A38;--pod-spot:rgba(255,211,107,.34);--pod-vig:rgba(26,11,61,.5);--pod-wash:rgba(43,21,89,.42)}
.pod-sheet .pod-stage>div>div:first-child{display:none}
.pod-sheet .pod-stage>div::before{content:'';position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(to bottom,transparent 68%,var(--pod-band-top)),radial-gradient(ellipse 75% 85% at 50% 100%,var(--pod-spot),transparent)}
.pod-sheet .pod-stage.pod-own>div::before{
 background:linear-gradient(to bottom,transparent 68%,var(--pod-band-top)),radial-gradient(ellipse 75% 85% at 50% 100%,var(--pod-spot),transparent),radial-gradient(ellipse at 50% 50%,transparent 35%,var(--pod-vig) 100%),linear-gradient(var(--pod-wash),var(--pod-wash))}
.pod-sheet .pod-stage.pod-auto>div{background:linear-gradient(to bottom,var(--pod-top),var(--pod-bot)) !important}
.pod-sheet .pod-band{background:linear-gradient(to bottom,var(--pod-band-top),var(--pod-band-bot));margin-top:-1px;box-shadow:0 -1px 0 var(--pod-band-top)}
`;

export function PodiumStageCard({ place, tone, open, onOpenChange }: { place: PodiumPlace; tone: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  const posed = { ...look.config, pose: avatarPlacePose(tone) } as typeof look.config;
  const ownBackdrop = AVATAR_BACKDROPS.some((b) => b.id === look.config.bg);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus(); }} className="pod-sheet p-0 max-w-[320px] overflow-hidden rounded-[28px] border-0 gap-0" style={{ background: 'var(--pod-band-bot)' }}>
        <style>{SHEET_CSS}</style>
        <DialogTitle className="sr-only">{place.username}, place {place.rank}</DialogTitle>
        <DialogDescription className="sr-only">A closer look at this player&apos;s mascot.</DialogDescription>
        <div className={`pod-stage ${ownBackdrop ? 'pod-own' : 'pod-auto'}`}>
        <DressStage
          config={posed}
          initial={look.initial}
          height={230}
          mascotSize={150}
          rounded={false}
          glow={METAL[Math.min(Math.max(tone, 1), 3) - 1]}
          photo={look.url ? <BoardAvatar url={place.avatarUrl} name={place.username} userId={place.userId} level={place.level} size={96} {...place.avatar} /> : undefined}
        >
          <StageClose onClick={() => onOpenChange(false)} className="absolute top-2 right-2" />
        </DressStage>
        </div>
        {/* Founder 10-09 ("no more plain text anywhere"): the name and the points in the bubble lettering, the name in the player's own
            color (their backdrop), and View profile as the family cast button. */}
        <div className="pod-band flex flex-col items-center gap-1.5 px-4 pt-2 pb-[18px]">
          <BubbleText text={place.username.toUpperCase()} accent={nameColorHex(look.config.bg, look.config.color)} maxSize={30} minSize={18} calm />
          <BubbleText text={String(place.points).toUpperCase()} spec={GOLD_POINTS} maxSize={22} minSize={14} calm />
          <CastLink href={`/profile/${place.userId}`} color="purple" size="m" className="mt-1.5" onClick={() => onOpenChange(false)}>View profile</CastLink>
        </div>
      </DialogContent>
    </Dialog>
  );
}
