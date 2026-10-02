'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ArtScene } from '@/components/ui/art-scene';
import { CandyButton } from '@/components/ui/candy-button';
import { BRAND_BAR, StateCard } from '@/components/ui/soft-popup';
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
      {/* G5: a tinted card with the brand top bar and the candy Try Again. */}
      <StateCard gradient={BRAND_BAR}>
        {/* R, unplugged, waits it out with you (docs/ART_SPEC.md §7). */}
        <div className="flex justify-center mb-3">
          <ArtScene scene={PAGE_SCENES.offline} priority />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Something went wrong</h1>
        <p className="text-sm font-bold mb-5" style={{ color: 'var(--color-text-muted)' }}>Don't worry, your streak is safe.</p>
        <CandyButton color="purple" size="md" icon="replay" onClick={reset}>
          Try Again
        </CandyButton>
      </StateCard>
    </div>
  );
}
