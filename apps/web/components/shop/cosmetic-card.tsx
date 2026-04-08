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
        background: equipped ? '#fffbeb' : '#ffffff',
        border: equipped
          ? '1.5px solid #fde68a'
          : owned
            ? '1.5px solid #bbf7d0'
            : '1.5px solid #ede9f6',
        borderRadius: '16px',
      }}
    >
      {/* Preview */}
      <div
        className="h-16 rounded-xl mb-2.5 flex items-center justify-center"
        style={{ background: '#f8f7ff', border: '1px solid #ede9f6' }}
      >
        <CosmeticPreviewMini item={item} />
      </div>

      <h3 className="font-extrabold text-xs" style={{ color: '#1a1a2e' }}>{item.name}</h3>
      <p className="text-[10px] font-bold mb-2.5" style={{ color: '#9ca3af' }}>{item.description}</p>

      {equipped ? (
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full py-2 rounded-xl text-[10px] font-black transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: '#fef9ec',
            border: '1.5px solid #fde68a',
            color: '#92400e',
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
            background: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            color: '#16a34a',
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
            background: '#f3f0ff',
            border: '1.5px solid #ede9f6',
            color: '#1a1a2e',
          }}
        >
          <Coins className="w-3 h-3" style={{ color: '#d97706' }} />
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
