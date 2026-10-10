'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { CastButton } from '@/components/ui/cast-button';
import { CandyLink } from '@/components/ui/candy-button';
import { UtilityCard, UtilityPage } from '@/components/ui/utility-page';
import { PAGE_SCENES } from '@/lib/art';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Errors caught by an App Router error boundary are not reported
    // automatically — forward them to Sentry.
    Sentry.captureException(error);
  }, [error]);

  // 2.8 look: R, unplugged, waits it out with you (docs/ART_SPEC.md §7), on the page wall under the live cast row,
  // in a soft card with the OOPS! lettering, the family Try again and a quiet way home.
  return (
    <UtilityPage>
      <UtilityCard scene={PAGE_SCENES.offline} artSize={140} priority heading="oops" title="Something went wrong" line="Don't worry, your streak is safe.">
        <div className="flex flex-col gap-2">
          <CastButton color="purple" size="lg" block onClick={reset}>Try Again</CastButton>
          <CandyLink href="/" color="peach" size="md" block>Go to Home</CandyLink>
        </div>
      </UtilityCard>
    </UtilityPage>
  );
}
