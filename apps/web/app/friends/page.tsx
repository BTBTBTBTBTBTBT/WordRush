'use client';

// FRIENDS (§207 Tier 3, Aug 11) — the dedicated friends screen. The card that
// used to live inline on the profile page gets a full page: requests, sent,
// friends, add-by-username, with room to breathe. The profile page keeps a
// compact "FRIENDS →" row pointing here.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FriendsPanel } from '@/components/friends/friends-panel';
import { InvitePanel } from '@/components/referrals/invite-panel';
import { useAuth } from '@/lib/auth-context';

export default function FriendsPage() {
  const { user, loading } = useAuth();
  return (
    <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-[13px] font-black hover:opacity-80 transition-opacity"
          style={{ color: '#7c3aed' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
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
    </main>
  );
}
