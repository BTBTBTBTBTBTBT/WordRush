'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase-client';
import { UtilityCard, UtilityPage } from '@/components/ui/utility-page';

// Session relay for the /admin middleware gate. The browser session lives in
// localStorage (supabase-js), which a server-side gate can never read; the
// wr-auth-token cookie mirror (auth-context.tsx) can be stale after >1h idle.
// The middleware bounces here instead of home: this page refreshes the session,
// rewrites the cookie, and returns to the admin page with wr_retried=1 so a
// genuinely signed-out visitor exits to home rather than looping.
function Relay() {
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      // Only ever forward back into /admin — anything else is someone playing
      // with the query param.
      const nextParam = params.get('next') || '/admin';
      const next = nextParam.startsWith('/admin') ? nextParam : '/admin';
      try {
        const { data: { session } } = await supabase.auth.getSession(); // refreshes if expired
        if (session?.access_token) {
          document.cookie = 'wr-auth-token=' + session.access_token +
            '; path=/; max-age=3600; secure; samesite=lax';
          window.location.replace(next + (next.includes('?') ? '&' : '?') + 'wr_retried=1');
          return;
        }
      } catch {}
      window.location.replace('/');
    })();
  }, [params]);

  return (
    <UtilityPage>
      <UtilityCard pose="art-pose-u-meditate" title="One moment" line="Checking your session…" busy />
    </UtilityPage>
  );
}

export default function AdminAuthPage() {
  return <Suspense fallback={null}><Relay /></Suspense>;
}
