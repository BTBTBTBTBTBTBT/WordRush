'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ProUnlockedModal } from '@/components/friends/invite-screens';
import { startProWelcome } from '@/lib/pro-welcome';

/**
 * Silent referral redemption. Mounted once in the root layout: when a
 * signed-in session appears AND a referral code is pending (wr_ref cookie
 * from /join/[code], or referral_code signup metadata from an
 * email-confirmation flow), redeem it server-side and celebrate the result
 * with the T4 "Pro unlocked!" window (docs/FINISH_SPEC.md: W crowned, gold
 * confetti, "7 days of Pro are yours!", candy "Start playing").
 * The redeem endpoint clears the cookie and is idempotent, so at worst
 * this fires a cheap no-op once per sign-in.
 */
export function ReferralRedeemer() {
  const { user, session, refreshProfile } = useAuth();
  const attempted = useRef(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!user || !session || attempted.current) return;
    const cookieCode = document.cookie.match(/(?:^|;\s*)wr_ref=([A-Z2-9]+)/)?.[1];
    const metaCode = user.user_metadata?.referral_code as string | undefined;
    const code = cookieCode || metaCode;
    if (!code) return;
    attempted.current = true;

    (async () => {
      try {
        const res = await fetch('/api/referrals/redeem', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.ok) {
          // AP: a gifted week's first activation gets the full "Welcome to
          // Pro" screen ("YOUR FREE WEEK OF PRO!"). Signal it BEFORE the
          // profile refresh so the host sees the not-Pro -> Pro transition.
          // Redeeming is only possible for never-Pro accounts (proBefore false).
          const welcomed = startProWelcome(user.id, { kind: 'gift', proBefore: false });
          await refreshProfile();
          if (!welcomed) setUnlocked(true);
        }
        // Ineligible/expired stays silent: the user may not even know a
        // cookie was set, and /join/[code] already explains eligibility.
      } catch {}
      // Clear the cookie client-side too in case the response was lost.
      document.cookie = 'wr_ref=; max-age=0; path=/';
    })();
  }, [user, session, refreshProfile]);

  return unlocked ? <ProUnlockedModal onClose={() => setUnlocked(false)} /> : null;
}
