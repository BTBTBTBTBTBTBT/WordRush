import { supabase } from './supabase-client';

export const COIN_RATES = {
  WIN: 10,
  LOSS: 5,
  DAILY_BONUS: 25,
  STREAK_7_BONUS: 50,
} as const;

/**
 * Award coins after a game result. Returns total coins awarded.
 */
export async function awardGameCoins(
  userId: string,
  won: boolean,
  isDailyChallenge: boolean,
): Promise<number> {
  const base = won ? COIN_RATES.WIN : COIN_RATES.LOSS;
  const dailyBonus = isDailyChallenge ? COIN_RATES.DAILY_BONUS : 0;
  const total = base + dailyBonus;

  await recordTransaction(userId, total, 'earn', won
    ? isDailyChallenge ? 'daily_win' : 'game_win'
    : isDailyChallenge ? 'daily_loss' : 'game_loss',
  );
  await addCoins(userId, total);
  return total;
}

/**
 * Award bonus coins for hitting a 7-day login streak milestone.
 */
export async function awardStreakBonus(userId: string, streak: number): Promise<number> {
  const amount = COIN_RATES.STREAK_7_BONUS;
  await recordTransaction(userId, amount, 'earn', `streak_bonus_day_${streak}`);
  await addCoins(userId, amount);
  return amount;
}

/**
 * Spend coins. Returns true if successful, false if insufficient balance.
 */
export async function spendCoins(
  userId: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('coins')
    .eq('id', userId)
    .single() as { data: { coins: number } | null };

  if (!profile || profile.coins < amount) return false;

  await recordTransaction(userId, -amount, 'spend', reason);
  await (supabase as any)
    .from('profiles')
    .update({ coins: profile.coins - amount })
    .eq('id', userId);

  return true;
}

/**
 * Get current coin balance.
 */
export async function getCoinBalance(userId: string): Promise<number> {
  const { data } = await (supabase as any)
    .from('profiles')
    .select('coins')
    .eq('id', userId)
    .single() as { data: { coins: number } | null };

  return data?.coins ?? 0;
}

async function addCoins(userId: string, amount: number): Promise<void> {
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('coins')
    .eq('id', userId)
    .single() as { data: { coins: number } | null };

  if (profile) {
    await (supabase as any)
      .from('profiles')
      .update({ coins: profile.coins + amount })
      .eq('id', userId);
  }
}

async function recordTransaction(
  userId: string,
  amount: number,
  type: 'earn' | 'spend',
  reason: string,
): Promise<void> {
  await (supabase as any)
    .from('coin_transactions')
    .insert({ user_id: userId, amount, type, reason });
}
