'use client';

import { useState } from 'react';
import { Coins, Check, Palette } from 'lucide-react';
import { CosmeticItem } from '@/lib/cosmetics/catalog';

interface CosmeticCardProps {
  item: CosmeticItem;
  owned: boolean;
  equipped: boolean;
  coins: number;
  onBuyWithCoins: (id: string) => Promise<void>;
  onEquip: (id: string) => Promise<void>;
  onUnequip: (category: string) => Promise<void>;
}

export function CosmeticCard({
  item,
  owned,
  equipped,
  coins,
  onBuyWithCoins,
  onEquip,
  onUnequip,
}: CosmeticCardProps) {
  const [loading, setLoading] = useState(false);
  const canAfford = coins >= item.coinPrice;

  const handleAction = async () => {
    setLoading(true);
    try {
      if (!owned) {
        await onBuyWithCoins(item.id);
      } else if (equipped) {
        await onUnequip(item.category);
      } else {
        await onEquip(item.id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white/5 backdrop-blur-sm rounded-2xl p-4 border transition-all ${
      equipped
        ? 'border-yellow-400/50 bg-yellow-500/10'
        : owned
          ? 'border-green-400/30'
          : 'border-white/10 hover:border-white/20'
    }`}>
      {/* Preview */}
      <div className="h-20 rounded-xl mb-3 flex items-center justify-center bg-white/5 border border-white/5">
        <CosmeticPreviewMini item={item} />
      </div>

      <h3 className="text-white font-bold text-sm">{item.name}</h3>
      <p className="text-white/50 text-xs mb-3">{item.description}</p>

      {/* Status / Action */}
      {equipped ? (
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full py-2 rounded-xl bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 font-bold text-xs transition-colors hover:bg-yellow-500/30 disabled:opacity-50"
        >
          {loading ? '...' : 'Equipped ✓'}
        </button>
      ) : owned ? (
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full py-2 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 font-bold text-xs transition-colors hover:bg-green-500/30 disabled:opacity-50"
        >
          {loading ? '...' : 'Equip'}
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={loading || !canAfford}
          className="w-full py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs transition-colors hover:bg-white/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Coins className="w-3 h-3 text-yellow-400" />
          {loading ? '...' : `${item.coinPrice} Coins`}
        </button>
      )}
    </div>
  );
}

function CosmeticPreviewMini({ item }: { item: CosmeticItem }) {
  if (item.category === 'tile_theme') {
    const colors: Record<string, string[]> = {
      neon: ['bg-emerald-500', 'bg-amber-400', 'bg-slate-800'],
      pastel: ['bg-green-300', 'bg-amber-200', 'bg-stone-300'],
      golden: ['bg-amber-500', 'bg-orange-400', 'bg-stone-600'],
    };
    const c = colors[item.preview] || ['bg-green-600', 'bg-yellow-600', 'bg-zinc-700'];
    return (
      <div className="flex gap-1.5">
        {c.map((cls, i) => (
          <div key={i} className={`w-8 h-8 rounded-md ${cls} flex items-center justify-center text-white font-bold text-xs`}>
            {['A', 'B', 'C'][i]}
          </div>
        ))}
      </div>
    );
  }

  if (item.category === 'keyboard_skin') {
    const bgMap: Record<string, string> = {
      galaxy: 'bg-purple-800',
      wooden: 'bg-amber-800',
    };
    const bg = bgMap[item.preview] || 'bg-zinc-700';
    return (
      <div className="flex gap-1">
        {['Q', 'W', 'E', 'R'].map(k => (
          <div key={k} className={`w-7 h-7 rounded ${bg} flex items-center justify-center text-white font-bold text-[10px]`}>
            {k}
          </div>
        ))}
      </div>
    );
  }

  // Victory animation
  return (
    <div className="text-2xl">
      {item.preview === 'fireworks' ? '🎆' : '🌈'}
    </div>
  );
}
