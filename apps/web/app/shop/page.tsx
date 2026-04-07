'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowLeft, Coins, Palette, Keyboard, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CoinBalance } from '@/components/ui/coin-balance';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-yellow-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          {profile && <CoinBalance coins={coins} />}
        </div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <ShoppingBag className="w-12 h-12 text-pink-400 mx-auto mb-3" />
          <h1 className="text-4xl font-black text-white">Shop</h1>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white/20 border-2 border-white/30 text-white'
                  : 'bg-white/5 border-2 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {!user ? (
          <div className="text-center text-white/60 py-12">
            Sign in to access the shop.
          </div>
        ) : activeTab === 'coins' ? (
          /* Coin Packs */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COIN_PACKS.map(pack => (
              <motion.div
                key={pack.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`bg-white/5 backdrop-blur-sm rounded-2xl p-6 border text-center ${
                  pack.popular ? 'border-yellow-400/40' : 'border-white/10'
                }`}
              >
                {pack.popular && (
                  <div className="text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-2">Most Popular</div>
                )}
                <Coins className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                <div className="text-2xl font-black text-white mb-1">{pack.coins.toLocaleString()}</div>
                <div className="text-white/50 text-sm mb-4">Coins</div>
                <button
                  onClick={() => handleBuyCoinPack(pack.id)}
                  disabled={buyingPack !== null}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {buyingPack === pack.id ? 'Processing...' : `$${pack.price.toFixed(2)}`}
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Cosmetic Items */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredCosmetics.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <CosmeticCard
                  item={item}
                  owned={owned.includes(item.id)}
                  equipped={equipped[item.category] === item.id}
                  coins={coins}
                  onBuyWithCoins={handleBuyCosmetic}
                  onEquip={handleEquip}
                  onUnequip={handleUnequip}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
