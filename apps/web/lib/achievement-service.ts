import { supabase } from './supabase-client';

// ============================================================
// Achievement Definitions
// ============================================================

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: 'beginner' | 'consistency' | 'skill' | 'social' | 'collection';
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Beginner
  { key: 'first_win', name: 'First Win', description: 'Win any game', category: 'beginner', icon: 'trophy' },
  { key: 'all_modes', name: 'All Modes Played', description: 'Play each of the 6 game modes', category: 'beginner', icon: 'grid' },
  { key: 'daily_debut', name: 'Daily Debut', description: 'Complete your first daily challenge', category: 'beginner', icon: 'calendar' },

  // Consistency
  { key: 'streak_7', name: '7-Day Warrior', description: 'Play 7 consecutive days', category: 'consistency', icon: 'flame' },
  { key: 'streak_30', name: '30-Day Streak', description: 'Play 30 consecutive days', category: 'consistency', icon: 'flame' },

  // Skill
  { key: 'speed_demon', name: 'Speed Demon', description: 'Solve Classic in under 30 seconds', category: 'skill', icon: 'zap' },
  { key: 'perfectionist', name: 'Perfectionist', description: 'Solve in 1 guess', category: 'skill', icon: 'star' },
  { key: 'gauntlet_master', name: 'Gauntlet Master', description: 'Complete the entire Gauntlet', category: 'skill', icon: 'swords' },

  // Social
  { key: 'vs_veteran', name: 'VS Veteran', description: 'Win 10 VS matches', category: 'social', icon: 'swords' },
  { key: 'unstoppable', name: 'Unstoppable', description: 'Achieve a 5-win streak', category: 'social', icon: 'flame' },

  // Collection
  { key: 'medal_10', name: 'Medal Collector', description: 'Earn 10 medals', category: 'collection', icon: 'medal' },
  { key: 'medal_50', name: 'Medal Hoarder', description: 'Earn 50 medals', category: 'collection', icon: 'medal' },
  { key: 'golden_touch', name: 'Golden Touch', description: 'Earn 10 gold medals', category: 'collection', icon: 'crown' },
];

// ============================================================
// Achievement Checking
// ============================================================

/**
 * Check and award achievements after a game result.
 * Returns array of newly unlocked achievement keys.
 */
export async function checkAchievements(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  won: boolean,
  guessCount: number,
  timeSeconds: number,
  seed?: string,
): Promise<string[]> {
  const unlocked: string[] = [];

  // Fetch existing achievements
  const { data: existing } = await (supabase as any)
    .from('achievements')
    .select('achievement_key')
    .eq('user_id', userId);

  const alreadyUnlocked = new Set((existing || []).map((a: any) => a.achievement_key));

  const tryUnlock = async (key: string) => {
    if (alreadyUnlocked.has(key)) return;
    const { error } = await (supabase as any)
      .from('achievements')
      .insert({ user_id: userId, achievement_key: key });
    if (!error) unlocked.push(key);
  };

  // First Win
  if (won) {
    await tryUnlock('first_win');
  }

  // Daily Debut
  if (seed?.startsWith('daily-') && (won || true)) {
    await tryUnlock('daily_debut');
  }

  // Speed Demon (Classic under 30s)
  if (gameMode === 'DUEL' && won && timeSeconds < 30) {
    await tryUnlock('speed_demon');
  }

  // Perfectionist (1 guess)
  if (won && guessCount === 1) {
    await tryUnlock('perfectionist');
  }

  // Gauntlet Master
  if (gameMode === 'GAUNTLET' && won) {
    await tryUnlock('gauntlet_master');
  }

  // VS Veteran (10 VS wins)
  if (playType === 'vs' && won) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('total_wins')
      .eq('id', userId)
      .single();
    if (profile && profile.total_wins >= 10) {
      await tryUnlock('vs_veteran');
    }
  }

  // Unstoppable (5-win streak)
  if (won) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single();
    if (profile && profile.current_streak >= 5) {
      await tryUnlock('unstoppable');
    }
  }

  // All Modes Played
  if (!alreadyUnlocked.has('all_modes')) {
    const { data: modeStats } = await (supabase as any)
      .from('user_stats')
      .select('game_mode')
      .eq('user_id', userId);
    const modes = new Set((modeStats || []).map((s: any) => s.game_mode));
    if (['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET'].every(m => modes.has(m))) {
      await tryUnlock('all_modes');
    }
  }

  // Streak achievements
  if (!alreadyUnlocked.has('streak_7') || !alreadyUnlocked.has('streak_30')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('daily_login_streak')
      .eq('id', userId)
      .single();
    if (profile) {
      if (profile.daily_login_streak >= 7) await tryUnlock('streak_7');
      if (profile.daily_login_streak >= 30) await tryUnlock('streak_30');
    }
  }

  // Medal collection achievements
  if (!alreadyUnlocked.has('medal_10') || !alreadyUnlocked.has('medal_50') || !alreadyUnlocked.has('golden_touch')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('gold_medals, silver_medals, bronze_medals')
      .eq('id', userId)
      .single();
    if (profile) {
      const totalMedals = (profile.gold_medals || 0) + (profile.silver_medals || 0) + (profile.bronze_medals || 0);
      if (totalMedals >= 10) await tryUnlock('medal_10');
      if (totalMedals >= 50) await tryUnlock('medal_50');
      if ((profile.gold_medals || 0) >= 10) await tryUnlock('golden_touch');
    }
  }

  return unlocked;
}

/**
 * Fetch a user's unlocked achievements.
 */
export async function fetchUserAchievements(userId: string): Promise<{ key: string; unlocked_at: string }[]> {
  const { data } = await (supabase as any)
    .from('achievements')
    .select('achievement_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  return (data || []).map((a: any) => ({ key: a.achievement_key, unlocked_at: a.unlocked_at }));
}
