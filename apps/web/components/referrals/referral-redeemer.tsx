'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/hooks/use-toast';

/**
 * Silent referral redemption. Mounted once in the root layout: when a
 * signed-in session appears AND a referral code is pending (wr_ref cookie
 * from /join/[code], or referral_code signup metadata from an
 * email-confirmation flow), redeem it server-side and toast the result.
 * The redeem endpoint clears the cookie and is idempotent, so at worst
 * this fires a cheap no-op once per sign-in.
 */
export function ReferralRedeemer() {
  const { user, session, refreshProfile } = useAuth();
  const attempted = useRef(false);

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
          await refreshProfile();
          toast({ title: '🎁 Gift claimed', description: '7 days of Wordocious Pro unlocked!' });
        }
        // Ineligible/expired stays silent: the user may not even know a
        // cookie was set, and /join/[code] already explains eligibility.
      } catch {}
      // Clear the cookie client-side too in case the response was lost.
      document.cookie = 'wr_ref=; max-age=0; path=/';
    })();
  }, [user, session, refreshProfile]);

  return null;
}
