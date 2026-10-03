'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { CandyLink } from '@/components/ui/candy-button';
import { PAGE_SCENES } from '@/lib/art';
import { softBackground } from '@/lib/soft-surface';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Errors caught by an App Router error boundary are not reported
    // automatically — forward them to Sentry.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {/* BI24: R, unplugged, waits it out with you (docs/ART_SPEC.md §7), over the
          gradient caps headline and the candy Try again. No box. */}
      <BrandEmptyState
        scene={PAGE_SCENES.offline}
        artHeight={140}
        priority
        title="SOMETHING WENT WRONG"
        line="Don't worry, your streak is safe."
        actionLabel="Try again"
        actionIcon="replay"
        onAction={reset}
        secondary={<CandyLink href="/" color="peach" size="sm" className="mt-1">Back to Home</CandyLink>}
      />
    </div>
  );
}
