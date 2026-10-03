'use client';

import { CastLoader, LoadingTip } from '@/components/ui/cast-loader';
import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { PageTitleText } from '@/components/ui/page-header';
import { PAGE_SCENES } from '@/lib/art';
import { softBackground } from '@/lib/soft-surface';

/**
 * Full-screen loader shown while a game's word lists or puzzle are fetched
 * (founder, 2026-09-29); `failed` offers a reload instead. The cast waves over
 * the brand gradient caps label with one of D's tips (docs/MASCOT_SPEC.md §3,
 * §6); a failed load is the shared BrandEmptyState with R unplugged
 * (docs/ART_SPEC.md §7) and the candy Try again (FINISH_SPEC BI24, no box).
 */
export function GameLoading({ failed = false, label = 'LOADING' }: { failed?: boolean; label?: string }) {
  return (
    <div className="min-h-screen flex flex-col gap-3 items-center justify-center px-6" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {failed ? (
        <BrandEmptyState
          scene={PAGE_SCENES.offline}
          priority
          title="CAN'T LOAD THE PUZZLE"
          line="Check your connection and try again."
          actionLabel="Try again"
          actionIcon="replay"
          onAction={() => window.location.reload()}
        />
      ) : (
        <CastLoadingStack label={label} />
      )}
    </div>
  );
}

/** The loader's content on its own (cast wave, gradient caps label, D's tip), for pages with their own background. */
export function CastLoadingStack({ label = 'LOADING' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 items-center px-6">
      <CastLoader />
      <PageTitleText size={18}>{label}</PageTitleText>
      <LoadingTip />
    </div>
  );
}
