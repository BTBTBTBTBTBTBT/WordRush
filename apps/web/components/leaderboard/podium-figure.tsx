'use client';

import type * as React from 'react';
import { PODIUM_WINNER_INTRO, avatarPlacePose, podiumWinnerHead } from '@wordle-duel/core';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { BoardAvatar } from '@/components/leaderboard/board-rows';
import { Icon3D } from '@/components/ui/icon3d';
import { clampAvatarSize } from '@/lib/avatar-render';
import { useLivingMascotOn } from '@/hooks/use-flags';
import type { PodiumPlace } from '@/components/leaderboard/podium';

// 2.8 item 13 (founder 10-07: "full-body mascots STANDING on their steps, no tile frame, ~2-3x today's size, crown on its
// head"): one podium place's figure. With the living mascot on (the remote `living_mascot` switch) a MASCOT player stands
// free-standing and alive at 2x the old tile size, posed by place (1st cheers, 2nd claps, 3rd waves) with the crown on
// their head; a photo player, and the whole podium while the switch is off, keep the framed BoardAvatar exactly as before.
// The figure's feet sink into the step below (FOOT_OVERLAP) so it stands ON it.

export const PODIUM_FIGURE_SCALE = 2;
export const PODIUM_FOOT_OVERLAP = 12;

export function PodiumFigure({ place, tone, size, ring, planted = false, crown = true, intro = false }: {
  /** `tone`: the podium SLOT (1 = the gold step), the same rule as iOS PodiumView / Android BoardPodium. */
  place: PodiumPlace; tone: number; size: number; ring?: string;
  /** One-image podium: the figure's box ends exactly at its feet (no overlap into a step below). */
  planted?: boolean;
  /** False: no crown on first place (a Friends race nobody has scored in yet). */
  crown?: boolean;
  /** The winner intro: a photo tile's crown icon drops in gently (core PODIUM_WINNER_INTRO.crown). */
  intro?: boolean;
}) {
  const livingOn = useLivingMascotOn();
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  if (livingOn && !look.url) {
    const big = size * PODIUM_FIGURE_SCALE;
    // Founder 10-15: first place WEARS the crown (the fitted crown hat, core podiumWinnerHead) instead of a crown icon floating
    // over the head; their own hat comes back off the podium.
    const posed = { ...look.config, pose: avatarPlacePose(tone), ...(tone === 1 && crown ? { head: podiumWinnerHead(look.config.head) } : null) };
    // MascotAvatar clamps its size to 200 px. A wider stage (a tablet) asks for more, so the avatar would draw at 200 at the box's
    // TOP and float above its step: draw it at the clamped size and scale it up from the bottom center instead (feet stay put).
    const drawn = clampAvatarSize(big);
    const k = big / drawn;
    return (
      <span className="relative block" style={{ width: big, height: big, lineHeight: 0, marginBottom: planted ? 0 : -PODIUM_FOOT_OVERLAP, zIndex: 1 }}>
        <span className="absolute block" style={{ left: '50%', bottom: 0, width: drawn, height: drawn, marginLeft: -drawn / 2, transform: k === 1 ? undefined : `scale(${k})`, transformOrigin: '50% 100%' }}>
          <MascotAvatar config={posed as typeof look.config} initial={look.initial} size={drawn} cutout living />
        </span>
      </span>
    );
  }
  // the framed tile: the first place's crown floats above it, as before
  return (
    <>
      {tone === 1 && crown && <Icon3D name="crown" size={26} style={{ marginBottom: -8, position: 'relative', zIndex: 2 }} />}
      <BoardAvatar url={place.avatarUrl} name={place.username} userId={place.userId} level={place.level} size={size} ring={ring} {...place.avatar} />
    </>
  );
}
