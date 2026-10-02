'use client';

import { useAuth } from '@/lib/auth-context';
import { isProAvatar } from '@/lib/pro-identity';
import { ProAvatarFrame } from '@/components/ui/letter-tile-avatar';

/**
 * FINISH_SPEC AA2: whether the avatar shown for `name` wears the Pro ring +
 * crown. An explicit flag from the row data wins; otherwise (leaderboard /
 * friends rows don't carry other players' Pro state yet) the signed-in Pro
 * player's own avatar is crowned wherever it appears. Outside the auth
 * provider (never in the app) it is simply false.
 */
export function useProAvatar(name: string | null | undefined, explicit?: boolean | null): boolean {
  let own: { username?: string | null; proActive: boolean } = { proActive: false };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { profile, isProActive } = useAuth();
    own = { username: profile?.username ?? null, proActive: isProActive };
  } catch {
    // No AuthProvider above this avatar.
  }
  return isProAvatar(name, own, explicit);
}

/**
 * AA2 for any avatar node: wraps `children` (a `size` box) and adds the Pro
 * ring + crown when the avatar is a Pro player's. Usable from files that
 * aren't client components (components/leaderboard/board-rows.tsx).
 */
export function ProAvatarSlot({ name, pro, size, radius = 'circle', children }: {
  name: string | null | undefined;
  /** An explicit Pro flag from the row data (wins over the own-avatar check). */
  pro?: boolean | null;
  size: number;
  radius?: number | 'circle';
  children: React.ReactNode;
}) {
  const crowned = useProAvatar(name, pro);
  return <ProAvatarFrame pro={crowned} size={size} radius={radius}>{children}</ProAvatarFrame>;
}
