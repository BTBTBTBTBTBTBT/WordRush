// FINISH_SPEC BJ1: the Stats page's two section headers — TODAY first, ALL-TIME beneath
// (no Today | All-time toggle any more). Brand gradient caps + a short gradient rule, a
// small muted note on the right (the date, "since Mar 2025"). Static: no animation, no
// box, no border — cheap to scroll past. Twins: iOS StatsSectionBanner, Android
// StatsSectionBanner.

export const SECTION_GRADIENTS = {
  today: ['#2563eb', '#7c3aed'],
  all: ['#d97706', '#db2777'],
} as const;

export function StatsSectionBanner({ kind, note }: { kind: 'today' | 'all'; note?: string | null }) {
  const [a, b] = SECTION_GRADIENTS[kind];
  const grad = `linear-gradient(90deg, ${a}, ${b})`;
  return (
    <div className="flex items-end justify-between gap-3 pt-2" data-stats-section={kind}>
      <div className="flex flex-col gap-1">
        <h2
          className="font-black uppercase leading-none"
          style={{ fontSize: 24, letterSpacing: '0.08em', background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          {kind === 'today' ? 'Today' : 'All-time'}
        </h2>
        <span aria-hidden="true" className="block rounded-full" style={{ width: 44, height: 4, background: grad }} />
      </div>
      {note && (
        <span className="text-[11px] font-extrabold uppercase tracking-wider pb-1" style={{ color: 'var(--color-text-muted)' }}>{note}</span>
      )}
    </div>
  );
}
