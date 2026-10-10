'use client';

import Link from 'next/link';
import { avatarPlacePose } from '@wordle-duel/core';
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

export function PodiumStageCard({ place, tone, open, onOpenChange }: { place: PodiumPlace; tone: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  const posed = { ...look.config, pose: avatarPlacePose(tone) } as typeof look.config;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="p-0 max-w-[320px] overflow-hidden rounded-[28px] border-0 gap-0">
        <DialogTitle className="sr-only">{place.username}, place {place.rank}</DialogTitle>
        <DialogDescription className="sr-only">A closer look at this player&apos;s mascot.</DialogDescription>
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
        {/* Founder 10-09 ("no more plain text anywhere"): the name and the points in the bubble lettering, the name in the player's own
            color (their backdrop), and View profile as the family cast button. */}
        <div className="flex flex-col items-center gap-1.5 px-4 pt-3.5 pb-4" style={{ background: 'var(--color-surface)' }}>
          <BubbleText text={place.username.toUpperCase()} accent={nameColorHex(look.config.bg, look.config.color)} maxSize={30} minSize={18} calm />
          <BubbleText text={String(place.points).toUpperCase()} spec={GOLD_POINTS} maxSize={22} minSize={14} calm />
          <CastLink href={`/profile/${place.userId}`} color="purple" size="m" className="mt-1.5" onClick={() => onOpenChange(false)}>View profile</CastLink>
        </div>
      </DialogContent>
    </Dialog>
  );
}
