'use client';

import { Coins } from 'lucide-react';

interface CoinBalanceProps {
  coins: number;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export function CoinBalance({ coins, size = 'md', onClick }: CoinBalanceProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs gap-1'
    : 'px-3 py-1.5 text-sm gap-1.5';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center ${sizeClasses} rounded-full bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/30 hover:bg-yellow-500/30 transition-colors font-bold text-yellow-300`}
    >
      <Coins className={iconSize} />
      <span>{coins.toLocaleString()}</span>
    </button>
  );
}
