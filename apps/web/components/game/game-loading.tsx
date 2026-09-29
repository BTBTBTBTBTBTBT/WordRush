/**
 * Full-screen "Loading..." shown while a game's word lists or puzzle are
 * fetched (founder, 2026-09-29); `failed` offers a reload instead.
 */
export function GameLoading({ failed = false }: { failed?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col gap-3 items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      {failed ? (
        <>
          <div className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Couldn&apos;t load the puzzle. Check your connection.</div>
          <button type="button" onClick={() => window.location.reload()} className="text-sm font-bold underline" style={{ color: 'var(--color-text-muted)' }}>Try again</button>
        </>
      ) : (
        <div className="text-lg font-black animate-pulse" style={{ color: 'var(--color-text)' }}>Loading...</div>
      )}
    </div>
  );
}
