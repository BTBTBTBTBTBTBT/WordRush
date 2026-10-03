// FINISH_SPEC BE + BF1 (server): grant achievements with the service-role
// client and report which ones THIS request inserted, so the endpoint can
// return them as `newAchievements` and the client celebrates at once.
// Hidden / unknown keys are never granted. Never throws.

import type { SupabaseClient } from '@supabase/supabase-js';
import { newAchievementPayloads, type NewAchievement } from './achievement-service';

export async function grantAchievements(admin: SupabaseClient | any, userId: string, keys: readonly string[]): Promise<NewAchievement[]> {
  const wanted = newAchievementPayloads([...new Set(keys)]).map((a) => a.key);
  if (!userId || wanted.length === 0) return [];
  try {
    const { data } = await admin
      .from('achievements')
      .upsert(wanted.map((k) => ({ user_id: userId, achievement_key: k })), { onConflict: 'user_id,achievement_key', ignoreDuplicates: true })
      .select('achievement_key');
    const inserted = ((data ?? []) as Array<{ achievement_key: string }>).map((r) => r.achievement_key);
    return newAchievementPayloads(inserted);
  } catch {
    return [];
  }
}
