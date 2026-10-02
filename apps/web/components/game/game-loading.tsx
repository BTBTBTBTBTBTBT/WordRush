import { CastLoader, LoadingTip } from '@/components/ui/cast-loader';
import { ArtScene } from '@/components/ui/art-scene';
import { CandyButton } from '@/components/ui/candy-button';
import { BRAND_BAR, StateCard } from '@/components/ui/soft-popup';
import { PAGE_SCENES } from '@/lib/art';
import { softBackground } from '@/lib/soft-surface';

/**
 * Full-screen "Loading..." shown while a game's word lists or puzzle are
 * fetched (founder, 2026-09-29); `failed` offers a reload instead. The cast
 * waves over the label with one of D's tips (docs/MASCOT_SPEC.md §3, §6); a
 * failed load gets R, unplugged, over the message (docs/ART_SPEC.md §7), on a
 * tinted card with the candy Try again (FINISH_SPEC G5).
 */
export function GameLoading({ failed = false }: { failed?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col gap-3 items-center justify-center px-6" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {failed ? (
        <StateCard gradient={BRAND_BAR}>
          <ArtScene scene={PAGE_SCENES.offline} />
          <div className="mt-3 text-sm font-bold text-center" style={{ color: 'var(--color-text)' }}>Couldn&apos;t load the puzzle. Check your connection.</div>
          <CandyButton color="purple" size="md" icon="replay" className="mt-4" onClick={() => window.location.reload()}>Try again</CandyButton>
        </StateCard>
      ) : (
        <>
          <CastLoader />
          <div className="text-lg font-black" style={{ color: 'var(--color-text)' }}>Loading...</div>
          <LoadingTip />
        </>
      )}
    </div>
  );
}
