'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
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
    <div
      className="p-3.5 transition-all"
      style={{
        background: equipped ? 'rgba(251,191,36,0.08)' : '#13102a',
        border: equipped
          ? '1px solid rgba(251,191,36,0.3)'
          : owned
            ? '1px solid rgba(74,222,128,0.25)'
            : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
      }}
    >
      {/* Preview */}
      <div
        className="h-16 rounded-xl mb-2.5 flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <CosmeticPreviewMini item={item} />
      </div>

      <h3 className="text-white font-extrabold text-xs">{item.name}</h3>
      <p className="text-[10px] font-bold mb-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.description}</p>

      {equipped ? (
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full py-2 rounded-xl text-[10px] font-black transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(251,191,36,0.25)',
            color: '#fde68a',
          }}
        >
          {loading ? '...' : 'Equipped ✓'}
        </button>
      ) : owned ? (
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full py-2 rounded-xl text-[10px] font-black transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: 'rgba(74,222,128,0.15)',
            border: '1px solid rgba(74,222,128,0.25)',
            color: '#86efac',
          }}
        >
          {loading ? '...' : 'Equip'}
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={loading || !canAfford}
          className="w-full py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          }}
        >
          <Coins className="w-3 h-3" style={{ color: '#fbbf24' }} />
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
          <div key={i} className={`w-7 h-7 rounded-md ${cls} flex items-center justify-center text-white font-black text-[10px]`}>
            {['A', 'B', 'C'][i]}
          </div>
        ))}
      </div>
    );
  }

  if (item.category === 'keyboard_skin') {
    const bgMap: Record<string, string> = { galaxy: 'bg-purple-800', wooden: 'bg-amber-800' };
    const bg = bgMap[item.preview] || 'bg-zinc-700';
    return (
      <div className="flex gap-1">
        {['Q', 'W', 'E', 'R'].map(k => (
          <div key={k} className={`w-6 h-6 rounded ${bg} flex items-center justify-center text-white font-black text-[9px]`}>
            {k}
          </div>
        ))}
      </div>
    );
  }

  return <div className="text-xl">{item.preview === 'fireworks' ? '🎆' : '🌈'}</div>;
}
