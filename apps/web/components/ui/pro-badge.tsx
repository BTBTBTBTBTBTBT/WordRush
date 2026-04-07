'use client';

export function ProBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const classes = size === 'sm'
    ? 'text-[9px] px-1.5 py-0.5'
    : 'text-[10px] px-2 py-0.5';

  return (
    <span
      className={`${classes} font-black rounded-full text-white uppercase tracking-wider`}
      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
    >
      PRO
    </span>
  );
}
