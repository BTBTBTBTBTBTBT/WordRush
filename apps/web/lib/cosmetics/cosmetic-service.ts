import { supabase } from '../supabase-client';
import { getCosmeticById, CosmeticCategory } from './catalog';
import { spendCoins } from '../coin-service';

export async function purchaseCosmeticWithCoins(
  userId: string,
  cosmeticId: string,
): Promise<boolean> {
  const item = getCosmeticById(cosmeticId);
  if (!item) return false;

  const spent = await spendCoins(userId, item.coinPrice, `cosmetic_${cosmeticId}`);
  if (!spent) return false;

  await grantCosmetic(userId, cosmeticId);
  return true;
}

export async function grantCosmetic(userId: string, cosmeticId: string): Promise<void> {
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('owned_cosmetics')
    .eq('id', userId)
    .single() as { data: { owned_cosmetics: string[] } | null };

  if (!profile) return;

  const owned = profile.owned_cosmetics || [];
  if (!owned.includes(cosmeticId)) {
    await (supabase as any)
      .from('profiles')
      .update({ owned_cosmetics: [...owned, cosmeticId] })
      .eq('id', userId);
  }
}

export async function equipCosmetic(userId: string, cosmeticId: string): Promise<void> {
  const item = getCosmeticById(cosmeticId);
  if (!item) return;

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('equipped_cosmetics')
    .eq('id', userId)
    .single() as { data: { equipped_cosmetics: Record<string, string> } | null };

  if (!profile) return;

  const equipped = profile.equipped_cosmetics || {};
  equipped[item.category] = cosmeticId;

  await (supabase as any)
    .from('profiles')
    .update({ equipped_cosmetics: equipped })
    .eq('id', userId);
}

export async function unequipCosmetic(userId: string, category: CosmeticCategory): Promise<void> {
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('equipped_cosmetics')
    .eq('id', userId)
    .single() as { data: { equipped_cosmetics: Record<string, string> } | null };

  if (!profile) return;

  const equipped = { ...profile.equipped_cosmetics };
  delete equipped[category];

  await (supabase as any)
    .from('profiles')
    .update({ equipped_cosmetics: equipped })
    .eq('id', userId);
}

export function getEquippedCosmetics(profile: any): {
  tile_theme?: string;
  keyboard_skin?: string;
  victory_animation?: string;
} {
  const equipped = profile?.equipped_cosmetics || {};
  return {
    tile_theme: equipped.tile_theme,
    keyboard_skin: equipped.keyboard_skin,
    victory_animation: equipped.victory_animation,
  };
}
