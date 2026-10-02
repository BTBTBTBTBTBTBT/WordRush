'use client';

// FRIENDS (§207 Tier 3, Aug 11) — the dedicated friends screen, the fourth
// bottom tab since D1 of the Stats + Friends redesign (2026-09-26). Friends
// overhaul (2026-10-01; docs/FRIENDS_REDESIGN_SPEC.md §2): the whole tab lives
// in FriendsPanel (banner, invites, your turn, games, races, friends, moments,
// add by username); the gift-Pro InvitePanel closes the page.

import { BottomNav } from '@/components/ui/bottom-nav';
import { FriendsPanel } from '@/components/friends/friends-panel';
import { InvitePanel } from '@/components/referrals/invite-panel';
import { useAuth } from '@/lib/auth-context';
import { FR } from '@/lib/friends-play';

export default function FriendsPage() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: FR.page }}>
      <main className="max-w-md mx-auto px-4 pt-2 space-y-3.5">
        {!loading && !user ? (
          <p className="text-sm font-bold p-6 text-center" style={{ color: FR.label }}>
            Sign in to add friends, race them on every daily board and play quick games together.
          </p>
        ) : (
          <>
            <FriendsPanel />
            {/* §212: recruiting and friending are the same motion. */}
            <InvitePanel />
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
