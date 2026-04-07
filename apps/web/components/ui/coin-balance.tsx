'use client';

import { Coins } from 'lucide-react';

interface CoinBalanceProps {
  coins: number;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export function CoinBalance({ coins, size = 'md', onClick }: CoinBalanceProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-[10px] gap-1'
    : 'px-3 py-1.5 text-xs gap-1.5';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center ${sizeClasses} font-extrabold transition-opacity hover:opacity-80`}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        color: '#fde68a',
      }}
    >
      <Coins className={iconSize} />
      <span>{coins.toLocaleString()}</span>
    </button>
  );
}
