'use client';

export function ProBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const classes = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5';

  return (
    <span className={`${classes} font-black rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white uppercase tracking-wider`}>
      PRO
    </span>
  );
}
