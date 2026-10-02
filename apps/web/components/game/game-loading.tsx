import { CastLoader, LoadingTip } from '@/components/ui/cast-loader';
import { Mascot } from '@/components/ui/mascot';
import { PAGE_HOSTS } from '@/lib/mascots';

/**
 * Full-screen "Loading..." shown while a game's word lists or puzzle are
 * fetched (founder, 2026-09-29); `failed` offers a reload instead. The cast
 * waves over the label with one of D's tips (docs/MASCOT_SPEC.md §3, §6); a
 * failed load gets R, sleepy, over the message.
 */
export function GameLoading({ failed = false }: { failed?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col gap-3 items-center justify-center px-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      {failed ? (
        <>
          <Mascot id={PAGE_HOSTS.offline} size={96} />
          <div className="text-sm font-bold text-center" style={{ color: 'var(--color-text)' }}>Couldn&apos;t load the puzzle. Check your connection.</div>
          <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold underline" style={{ color: 'var(--color-text-muted)' }}>Try again</button>
        </>
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
