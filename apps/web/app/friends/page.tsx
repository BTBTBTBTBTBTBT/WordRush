'use client';

// FRIENDS (§207 Tier 3, Aug 11) — the dedicated friends screen. The card that
// used to live inline on the profile page gets a full page: requests, sent,
// friends, add-by-username, with room to breathe. Since D1 of the Stats +
// Friends redesign (2026-09-26) it is the fourth bottom tab.

import { BottomNav } from '@/components/ui/bottom-nav';
import { FriendsPanel } from '@/components/friends/friends-panel';
import { InvitePanel } from '@/components/referrals/invite-panel';
import { useAuth } from '@/lib/auth-context';

export default function FriendsPage() {
  const { user, loading } = useAuth();
  return (
    <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
      {/* D1 (2026-09-26): Friends is a bottom tab — no Back row. */}
      {!loading && !user ? (
        <p className="text-sm font-bold p-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Sign in to add friends and race them on every daily board.
        </p>
      ) : (
        <>
          <FriendsPanel />
          {/* §212: recruiting and friending are the same motion — the
              gift-Pro panel lives here too. */}
          <InvitePanel />
        </>
      )}
      <BottomNav />
    </main>
  );
}
