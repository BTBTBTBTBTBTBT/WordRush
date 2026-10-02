'use client';

// The PRO badge (FINISH_SPEC G1 / G5): a small glossy gold pill in the candy
// family — the amber gradient, a thin gold ring, a darker lip and a white
// label with a soft dark edge. A label, not a button.
export function ProBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const classes = size === 'sm'
    ? 'text-[9px] px-1.5 py-0.5'
    : 'text-[10px] px-2 py-0.5';

  return (
    <span
      className={`${classes} relative inline-block font-black rounded-full text-white uppercase tracking-wider`}
      style={{
        background: 'linear-gradient(#ffc56b, #f97316)',
        boxShadow: 'inset 0 0 0 1px #f5c542, 0 1.5px 0 #a24b0e',
        textShadow: '0 1px 1px rgba(59, 26, 120, 0.55)',
        lineHeight: 1.3,
      }}
    >
      PRO
    </span>
  );
}
