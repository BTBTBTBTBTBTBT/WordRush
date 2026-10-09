'use client';

import Link from 'next/link';
import { avatarPlacePose } from '@wordle-duel/core';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { BoardAvatar } from '@/components/leaderboard/board-rows';
import { DressStage, StageClose } from '@/components/profile/dress-up';
import { LevelBadge } from '@/components/badges/badge-art';
import { SoftNum } from '@/components/ui/soft-number';
import type { PodiumPlace } from '@/components/leaderboard/podium';

// 2.8 item 13: tap a podium mascot and a mini Stage card opens: that player's mascot standing on the stage in their
// backdrop (posed for the place they hold), their name, level and points, and a quiet View profile link. No new data:
// the same look the podium already drew. (Behind the living mascot switch, like the standing figures themselves.)

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
          photo={look.url ? <BoardAvatar url={place.avatarUrl} name={place.username} userId={place.userId} level={place.level} size={96} {...place.avatar} /> : undefined}
        >
          <StageClose onClick={() => onOpenChange(false)} className="absolute top-2 right-2" />
        </DressStage>
        <div className="flex flex-col items-center gap-1 px-4 py-3" style={{ background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-1 max-w-full min-w-0">
            <span className="truncate text-base font-black" style={{ color: 'var(--color-text)' }}>{place.username}</span>
            {place.level ? <LevelBadge level={place.level} size={18} numberSize={12} className="ml-1" /> : null}
          </div>
          <SoftNum size={14}>{place.points}</SoftNum>
          <Link href={`/profile/${place.userId}`} className="candy candy-peach candy-sm mt-1" onClick={() => onOpenChange(false)}><span className="candy-label">View profile</span></Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
