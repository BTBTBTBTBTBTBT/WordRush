'use client';

import { FriendlyGameScreen } from '@/components/friends/game-screen';

/** A Friends pocket game (spec docs/FRIENDS_REDESIGN_SPEC.md §4, §7) — also the push deep link. */
export default function FriendlyGamePage({ params }: { params: { id: string } }) {
  return <FriendlyGameScreen id={params.id} />;
}
