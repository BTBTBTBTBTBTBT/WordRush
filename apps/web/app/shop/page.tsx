'use client';

import { useState } from 'react';
import { Coins, Palette, Keyboard, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { CosmeticCard } from '@/components/shop/cosmetic-card';
import { COSMETICS_CATALOG, CosmeticCategory } from '@/lib/cosmetics/catalog';
import { purchaseCosmeticWithCoins, equipCosmetic, unequipCosmetic } from '@/lib/cosmetics/cosmetic-service';
import { COIN_PACKS } from '@/lib/payment/coin-packs';

const TABS: { id: CosmeticCategory | 'coins'; label: string; icon: any }[] = [
  { id: 'tile_theme', label: 'Tiles', icon: Palette },
  { id: 'keyboard_skin', label: 'Keyboard', icon: Keyboard },
  { id: 'victory_animation', label: 'Victory', icon: Sparkles },
  { id: 'coins', label: 'Coins', icon: Coins },
];

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<CosmeticCategory | 'coins'>('tile_theme');
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const owned = (profile as any)?.owned_cosmetics ?? [];
  const equipped = (profile as any)?.equipped_cosmetics ?? {};
  const coins = (profile as any)?.coins ?? 0;

  const handleBuyCosmetic = async (cosmeticId: string) => {
    if (!user) return;
    await purchaseCosmeticWithCoins(user.id, cosmeticId);
    await refreshProfile();
  };

  const handleEquip = async (cosmeticId: string) => {
    if (!user) return;
    await equipCosmetic(user.id, cosmeticId);
    await refreshProfile();
  };

  const handleUnequip = async (category: string) => {
    if (!user) return;
    await unequipCosmetic(user.id, category as CosmeticCategory);
    await refreshProfile();
  };

  const handleBuyCoinPack = async (packId: string) => {
    if (!user) return;
    setBuyingPack(packId);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'coins',
          itemId: packId,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        await refreshProfile();
      }
    } catch (err) {
      console.error('Purchase error:', err);
    } finally {
      setBuyingPack(null);
    }
  };

  const filteredCosmetics = activeTab !== 'coins'
    ? COSMETICS_CATALOG.filter(c => c.category === activeTab)
    : [];

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black" style={{ color: '#1a1a2e' }}>Shop</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all"
              style={{
                background: activeTab === tab.id ? '#ffffff' : '#f3f0ff',
                border: activeTab === tab.id ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
                color: activeTab === tab.id ? '#7c3aed' : '#9ca3af',
              }}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {!user ? (
          <div className="text-center py-12" style={{ color: '#9ca3af' }}>
            Sign in to access the shop.
          </div>
        ) : activeTab === 'coins' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {COIN_PACKS.map(pack => (
              <div
                key={pack.id}
                className="p-5 text-center"
                style={{
                  background: '#ffffff',
                  border: pack.popular ? '1.5px solid #fde68a' : '1.5px solid #ede9f6',
                  borderRadius: '16px',
                }}
              >
                {pack.popular && (
                  <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: '#d97706' }}>
                    Most Popular
                  </div>
                )}
                <Coins className="w-10 h-10 mx-auto mb-2" style={{ color: '#d97706' }} />
                <div className="text-2xl font-black mb-1" style={{ color: '#1a1a2e' }}>{pack.coins.toLocaleString()}</div>
                <div className="text-xs font-bold mb-4" style={{ color: '#9ca3af' }}>Coins</div>
                <button
                  onClick={() => handleBuyCoinPack(pack.id)}
                  disabled={buyingPack !== null}
                  className="w-full py-2.5 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 4px 0 #92400e',
                  }}
                >
                  {buyingPack === pack.id ? 'Processing...' : `$${pack.price.toFixed(2)}`}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredCosmetics.map((item) => (
              <CosmeticCard
                key={item.id}
                item={item}
                owned={owned.includes(item.id)}
                equipped={equipped[item.category] === item.id}
                coins={coins}
                onBuyWithCoins={handleBuyCosmetic}
                onEquip={handleEquip}
                onUnequip={handleUnequip}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
