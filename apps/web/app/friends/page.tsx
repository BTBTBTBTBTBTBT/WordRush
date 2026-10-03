'use client';

// FRIENDS (§207 Tier 3, Aug 11) — the dedicated friends screen, the fourth
// bottom tab since D1 of the Stats + Friends redesign (2026-09-26). Friends
// overhaul (2026-10-01; docs/FRIENDS_REDESIGN_SPEC.md §2): the whole tab lives
// in FriendsPanel (banner, invites, your turn, games, races, friends, moments,
// add by username); the gift-Pro InvitePanel closes the page. Founder
// (2026-10-02): the shared AppHeader tops this tab exactly like Home,
// Leaderboard, Stats and Records. Finishing build C4b (2026-10-02): the FRIENDS
// headline (A6) tops FriendsPanel with nothing beside it.

import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { FriendsPanel } from '@/components/friends/friends-panel';
import { InvitePanel } from '@/components/referrals/invite-panel';
import { useAuth } from '@/lib/auth-context';
import { FR } from '@/lib/friends-play';
import { PageBackground } from '@/components/ui/page-background';
import { PageHeadline } from '@/components/ui/page-headline';
import { GuestPitch, GUEST_GRADIENTS } from '@/components/ui/guest-pitch';
import { PAGE_HOSTS } from '@/lib/mascots';

const LIGHT_CARD_BASE = { ['--color-card-base' as string]: '#ffffff' } as React.CSSProperties;

export default function FriendsPage() {
  const { user, loading, exitGuest } = useAuth();
  return (
    // Light-only page: the shared washes (soft-surface, the game tray) mix over
    // white here in every theme, so the Friends inks stay legible.
    <PageBackground tint="friends" scheme="light" className="min-h-screen pb-24 flex flex-col" style={LIGHT_CARD_BASE}>
      <AppHeader />

      {/* FINISH_SPEC AG: up to 1100 px on desktop web (FriendsPanel lays its cards in two columns). */}
      <main className={`max-w-md mx-auto px-4 pt-2 w-full ${!loading && !user ? 'flex flex-1 flex-col' : 'page-wide space-y-3.5'}`}>
        {!loading && !user ? (
          // FINISH_SPEC BI23: a finished signed-out state under the FRIENDS title art — O1 + I
          // as a duo, the headline, one line, the candy SIGN IN (no empty list, no add field).
          <>
            <PageHeadline name="art-titlecast-friends" label="Friends" />
            <GuestPitch
              hosts={[PAGE_HOSTS.friends, PAGE_HOSTS.addFriend]}
              title="Play with friends"
              subtitle="Sign in to add friends, race them every day and play pocket games together."
              gradient={GUEST_GRADIENTS.friends}
              preview={{ kind: 'none' }}
              onSignIn={exitGuest}
              subColor={FR.label}
            />
          </>
        ) : (
          <>
            <FriendsPanel />
            {/* §212: recruiting and friending are the same motion. */}
            <div className="page-col empty:hidden"><InvitePanel /></div>
          </>
        )}
      </main>
      <BottomNav />
    </PageBackground>
  );
}
