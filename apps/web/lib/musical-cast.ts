// The musical cast easter egg on the web (docs/cloud-prompts/10; core packages/core/src/musical-cast.ts). Behind the
// musicalCast flag: ON in dev builds, OFF in production until the founder approves. The tunes' secret achievements go
// through the existing client unlock (unlockAchievements → the achievements table, RLS insert-own).

import { musicalCastEnabled } from '@wordle-duel/core';
import { supabase } from '@/lib/supabase-client';
import { unlockAchievements } from '@/lib/achievement-service';

export const MUSICAL_CAST_ON: boolean = musicalCastEnabled(process.env.NODE_ENV !== 'production');

/** Unlock a tune's secret achievement for the signed-in player (guests: nothing to store). Never throws. */
export async function unlockTune(achievementKey: string): Promise<string[]> {
  try {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id;
    return id ? await unlockAchievements(id, [achievementKey]) : [];
  } catch {
    return [];
  }
}

/** A drawn eighth note (never an emoji), for the floating notes + the musical badge. */
export const NOTE_SVG = '<svg viewBox="0 0 20 24" width="100%" height="100%" aria-hidden="true"><path d="M8 3 L17 1 L17 15.5 A3.6 3 -20 1 1 14.6 13 L14.6 5.3 L10.4 6.2 L10.4 18 A3.6 3 -20 1 1 8 15.4 Z" fill="currentColor"/></svg>';

/** The floating notes' colors (cast candy colors), picked per tap. */
export const NOTE_COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#0ea5e9', '#22c55e'] as const;

/** A note color for the n-th tap (cycles). */
export function noteColor(n: number): string {
  return NOTE_COLORS[((n % NOTE_COLORS.length) + NOTE_COLORS.length) % NOTE_COLORS.length];
}
