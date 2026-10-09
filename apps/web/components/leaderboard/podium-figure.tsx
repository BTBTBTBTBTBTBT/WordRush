'use client';

import { avatarPlacePose } from '@wordle-duel/core';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { BoardAvatar } from '@/components/leaderboard/board-rows';
import { Icon3D } from '@/components/ui/icon3d';
import { useLivingMascotOn } from '@/hooks/use-flags';
import type { PodiumPlace } from '@/components/leaderboard/podium';

// 2.8 item 13 (founder 10-07: "full-body mascots STANDING on their steps, no tile frame, ~2-3x today's size, crown on its
// head"): one podium place's figure. With the living mascot on (the remote `living_mascot` switch) a MASCOT player stands
// free-standing and alive at 2x the old tile size, posed by place (1st cheers, 2nd claps, 3rd waves) with the crown on
// their head; a photo player, and the whole podium while the switch is off, keep the framed BoardAvatar exactly as before.
// The figure's feet sink into the step below (FOOT_OVERLAP) so it stands ON it.

export const PODIUM_FIGURE_SCALE = 2;
export const PODIUM_FOOT_OVERLAP = 12;

export function PodiumFigure({ place, tone, size, ring }: { place: PodiumPlace; tone: number; size: number; ring?: string }) {
  const livingOn = useLivingMascotOn();
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  if (livingOn && !look.url) {
    const big = size * PODIUM_FIGURE_SCALE;
    const posed = { ...look.config, pose: avatarPlacePose(tone) };
    return (
      <span className="relative block" style={{ width: big, height: big, lineHeight: 0, marginBottom: -PODIUM_FOOT_OVERLAP, zIndex: 1 }}>
        <MascotAvatar config={posed as typeof look.config} initial={look.initial} size={big} cutout living />
        {tone === 1 && <Icon3D name="crown" size={34} style={{ position: 'absolute', left: '50%', top: -big * 0.05, marginLeft: -17, zIndex: 2 }} />}
      </span>
    );
  }
  // the framed tile: the first place's crown floats above it, as before
  return (
    <>
      {tone === 1 && <Icon3D name="crown" size={26} style={{ marginBottom: -8, position: 'relative', zIndex: 2 }} />}
      <BoardAvatar url={place.avatarUrl} name={place.username} userId={place.userId} level={place.level} size={size} ring={ring} {...place.avatar} />
    </>
  );
}
