import { supabase } from './supabase-client';
import { getTodayLocal } from './daily-service';

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
  { key: 'all_modes', name: 'All Modes Played', description: 'Play all 9 game modes', category: 'beginner', icon: 'grid' },
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

  // Daily sweep achievements — unlock once the corresponding
  // daily_bonuses flag has ever been set for this user.
  { key: 'daily_sweep', name: 'Daily Sweep', description: 'Complete all 9 dailies in a single day', category: 'skill', icon: 'sparkles' },
  { key: 'flawless_victory', name: 'Flawless Victory', description: 'Win all 9 dailies in a single day', category: 'skill', icon: 'trophy' },

  // Cumulative milestones
  { key: 'century_club', name: 'Century Club', description: 'Win 100 total games', category: 'consistency', icon: 'trophy' },
  { key: 'thousand_words', name: 'Thousand Words', description: 'Win 1,000 total games', category: 'consistency', icon: 'crown' },
  { key: 'sweep_streak_7', name: 'Sweep Streak', description: 'Complete the daily sweep 7 days in a row', category: 'consistency', icon: 'sparkles' },
  { key: 'iron_will', name: 'Iron Will', description: 'Complete the daily sweep 30 days in a row', category: 'consistency', icon: 'flame' },

  // Mode mastery
  { key: 'quad_king', name: 'Quad King', description: 'Win 50 QuadWord games', category: 'skill', icon: 'grid' },
  { key: 'octo_boss', name: 'Octo Boss', description: 'Win 50 OctoWord games', category: 'skill', icon: 'grid' },
  { key: 'sequence_ace', name: 'Succession Ace', description: 'Win 50 Succession games', category: 'skill', icon: 'zap' },
  { key: 'rescue_hero', name: 'Rescue Hero', description: 'Win 50 Deliverance games', category: 'skill', icon: 'star' },

  // Skill ceiling
  { key: 'lightning_round', name: 'Lightning Round', description: 'Complete the daily sweep in under 20 minutes', category: 'skill', icon: 'zap' },
  { key: 'no_sweat', name: 'No Sweat', description: 'Win Classic in 2 guesses', category: 'skill', icon: 'star' },
  { key: 'untouchable', name: 'Untouchable', description: 'Achieve a 10-win VS streak', category: 'social', icon: 'swords' },
  { key: 'gauntlet_god', name: 'Gauntlet God', description: 'Complete Gauntlet without failing any board', category: 'skill', icon: 'crown' },

  // Social/competitive
  { key: 'rival', name: 'Rival', description: 'Play 50 VS matches', category: 'social', icon: 'swords' },
  { key: 'dominant', name: 'Dominant', description: 'Win 50 VS matches', category: 'social', icon: 'trophy' },

  // Collection
  { key: 'medal_wall', name: 'Medal Wall', description: 'Earn 100 medals', category: 'collection', icon: 'medal' },

  // Six & Seven
  { key: 'six_shooter', name: 'Six Shooter', description: 'Win 50 Classic Six games', category: 'skill', icon: 'zap' },
  { key: 'lucky_seven', name: 'Lucky Seven', description: 'Win 50 Classic Seven games', category: 'skill', icon: 'star' },
  { key: 'extended_vocab', name: 'Extended Vocabulary', description: 'Win both a Six and Seven daily in the same day', category: 'beginner', icon: 'grid' },

  // Mode mastery completion
  { key: 'proper_scholar', name: 'Proper Scholar', description: 'Win 50 ProperNoundle games', category: 'skill', icon: 'grid' },
  { key: 'classic_master', name: 'Classic Master', description: 'Win 100 Classic games', category: 'skill', icon: 'trophy' },

  // Speed
  { key: 'blitz', name: 'Blitz', description: 'Win any game in under 15 seconds', category: 'skill', icon: 'zap' },
  { key: 'speed_sweep', name: 'Speed Sweep', description: 'Complete the daily sweep in under 15 minutes', category: 'skill', icon: 'zap' },

  // Cumulative play
  { key: 'dedicated', name: 'Dedicated', description: 'Play 500 total games', category: 'consistency', icon: 'flame' },
  { key: 'obsessed', name: 'Obsessed', description: 'Play 2,000 total games', category: 'consistency', icon: 'flame' },

  // Sweep milestones
  { key: 'daily_devotee', name: 'Daily Devotee', description: 'Complete 50 daily sweeps', category: 'consistency', icon: 'sparkles' },
  { key: 'centurion', name: 'Centurion', description: 'Complete 100 daily sweeps', category: 'consistency', icon: 'sparkles' },

  // Level milestones
  { key: 'rising_star', name: 'Rising Star', description: 'Reach level 10', category: 'beginner', icon: 'star' },
  { key: 'elite', name: 'Elite', description: 'Reach level 50', category: 'skill', icon: 'crown' },

  // Ultimate streaks
  { key: 'year_one', name: 'Year One', description: 'Play 365 consecutive days', category: 'consistency', icon: 'flame' },
  { key: 'flawless_streak', name: 'Flawless Streak', description: 'Achieve Flawless Victory 3 days in a row', category: 'skill', icon: 'trophy' },

  // VS / Social
  { key: 'versatile_victor', name: 'Versatile Victor', description: 'Win VS matches in 5 different game modes', category: 'social', icon: 'swords' },
  { key: 'triple_threat', name: 'Triple Threat', description: 'Win 3 VS matches in a single day', category: 'social', icon: 'swords' },

  // Special moments
  { key: 'close_call', name: 'Close Call', description: 'Win a game on your final guess', category: 'skill', icon: 'star' },
  { key: 'hat_trick', name: 'Hat Trick', description: 'Win 3 daily games in under 60 seconds each in one day', category: 'skill', icon: 'zap' },
  { key: 'eagle_eye', name: 'Eagle Eye', description: 'Solve 10 games in 1 guess lifetime', category: 'skill', icon: 'crown' },

  // Collection depth
  { key: 'gold_rush', name: 'Gold Rush', description: 'Earn 50 gold medals', category: 'collection', icon: 'crown' },
  { key: 'diamond_hands', name: 'Diamond Hands', description: 'Earn 100 gold medals', category: 'collection', icon: 'crown' },

  // Skill ceiling
  { key: 'unbreakable', name: 'Unbreakable', description: 'Achieve a 25-win streak', category: 'skill', icon: 'flame' },
  { key: 'the_natural', name: 'The Natural', description: 'Win 10 games in under 30 seconds', category: 'skill', icon: 'zap' },

  // Cumulative
  { key: 'wordsmith', name: 'Wordsmith', description: 'Win 500 total games', category: 'consistency', icon: 'trophy' },
  { key: 'endurance', name: 'Endurance', description: 'Play 1,000 total games', category: 'consistency', icon: 'flame' },

  // Time investment
  { key: 'marathon_runner', name: 'Marathon Runner', description: 'Accumulate 5 hours of total playtime', category: 'consistency', icon: 'flame' },

  // Mode variety
  { key: 'linguist', name: 'Linguist', description: 'Win Classic, Six, and Seven daily in the same day', category: 'beginner', icon: 'grid' },

  // Long-term streaks
  { key: 'streak_master', name: 'Streak Master', description: 'Achieve a 50-day login streak', category: 'consistency', icon: 'flame' },
  { key: 'daily_regular', name: 'Daily Regular', description: 'Complete dailies on 100 different days', category: 'consistency', icon: 'calendar' },

  // ────────────────────────────────────────────────────────────
  // "Pure" ladder — win without using a single hint. One tier
  // per mode that exposes hints (Six / Seven / ProperNoundle),
  // gated on `matches.hints_used = 0 AND winner_id IS NOT NULL`.
  // The cross-mode capstone unlocks at 50 hintless wins summed
  // across all three modes for players who never lean on a hint.
  // ────────────────────────────────────────────────────────────
  { key: 'pure_six_initiate',     name: 'Pure Six',            description: 'Win Classic Six without using any hints',         category: 'skill', icon: 'star' },
  { key: 'pure_six_adept',        name: 'Pure Six Adept',      description: 'Win 10 Classic Six games without hints',          category: 'skill', icon: 'star' },
  { key: 'pure_six_master',       name: 'Pure Six Master',     description: 'Win 50 Classic Six games without hints',          category: 'skill', icon: 'crown' },
  { key: 'pure_seven_initiate',   name: 'Pure Seven',          description: 'Win Classic Seven without using any hints',       category: 'skill', icon: 'star' },
  { key: 'pure_seven_adept',      name: 'Pure Seven Adept',    description: 'Win 10 Classic Seven games without hints',        category: 'skill', icon: 'star' },
  { key: 'pure_seven_master',     name: 'Pure Seven Master',   description: 'Win 50 Classic Seven games without hints',        category: 'skill', icon: 'crown' },
  { key: 'pure_proper_initiate',  name: 'Pure Proper',         description: 'Win ProperNoundle without using any hints',       category: 'skill', icon: 'star' },
  { key: 'pure_proper_adept',     name: 'Pure Proper Adept',   description: 'Win 10 ProperNoundle games without hints',        category: 'skill', icon: 'star' },
  { key: 'pure_proper_master',    name: 'Pure Proper Master',  description: 'Win 50 ProperNoundle games without hints',        category: 'skill', icon: 'crown' },
  { key: 'pure_player',           name: 'Pure Player',         description: 'Win 50 hintless games across Six, Seven, and ProperNoundle combined', category: 'skill', icon: 'crown' },

  // ────────────────────────────────────────────────────────────
  // Sweep / Flawless ladder extensions (powered by the daily
  // sweep stat calcs). All detectable from daily_bonuses + daily_results.
  // ────────────────────────────────────────────────────────────
  { key: 'flawless_5', name: 'High Five', description: 'Achieve Flawless Victory on 5 different days', category: 'consistency', icon: 'trophy' },
  { key: 'flawless_25', name: 'Flawless 25', description: 'Achieve Flawless Victory 25 times', category: 'consistency', icon: 'crown' },
  { key: 'flawless_streak_5', name: 'Flawless Streak 5', description: 'Achieve Flawless Victory 5 days in a row', category: 'skill', icon: 'trophy' },
  { key: 'sweep_streak_60', name: 'Sweep Streak 60', description: 'Complete the daily sweep 60 days in a row', category: 'consistency', icon: 'flame' },
  { key: 'flawless_speed', name: 'Flawless Blitz', description: 'Win all 9 dailies with total time under 18 minutes', category: 'skill', icon: 'zap' },

  // ────────────────────────────────────────────────────────────
  // Round-out additions (6) — fill each grouped column to a clean
  // multiple of 3: consistency→21, skill→39, social→9. All
  // non-duplicative of existing keys and cheaply detectable by
  // extending the existing query blocks below.
  // ────────────────────────────────────────────────────────────
  { key: 'streak_14', name: 'Fortnight', description: 'Play 14 consecutive days', category: 'consistency', icon: 'flame' },
  { key: 'flawless_10', name: 'Flawless Ten', description: 'Achieve Flawless Victory 10 times', category: 'consistency', icon: 'trophy' },
  { key: 'quick_draw', name: 'Quick Draw', description: 'Win any game in under 10 seconds', category: 'skill', icon: 'zap' },
  { key: 'sharpshooter', name: 'Sharpshooter', description: 'Solve 25 games in 1 guess lifetime', category: 'skill', icon: 'crown' },
  { key: 'vs_centurion', name: 'VS Centurion', description: 'Win 100 VS matches', category: 'social', icon: 'trophy' },
  { key: 'vs_marathoner', name: 'VS Marathoner', description: 'Play 100 VS matches', category: 'social', icon: 'swords' },
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
  hintsUsed: number = 0,
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
    if (['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'].every(m => modes.has(m))) {
      await tryUnlock('all_modes');
    }
  }

  // Streak achievements
  if (!alreadyUnlocked.has('streak_7') || !alreadyUnlocked.has('streak_14') || !alreadyUnlocked.has('streak_30')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('daily_login_streak')
      .eq('id', userId)
      .single();
    if (profile) {
      if (profile.daily_login_streak >= 7) await tryUnlock('streak_7');
      if (profile.daily_login_streak >= 14) await tryUnlock('streak_14');
      if (profile.daily_login_streak >= 30) await tryUnlock('streak_30');
    }
  }

  // Daily Sweep / Flawless Victory. Piggyback on the daily_bonuses
  // table the award helper writes to: if the user has ever had a row
  // with the corresponding flag true, the achievement unlocks.
  if (!alreadyUnlocked.has('daily_sweep') || !alreadyUnlocked.has('flawless_victory')) {
    const { data: bonusRows } = await (supabase as any)
      .from('daily_bonuses')
      .select('sweep_awarded, flawless_awarded')
      .eq('user_id', userId) as { data: Array<{ sweep_awarded: boolean; flawless_awarded: boolean }> | null };
    if (bonusRows) {
      if (bonusRows.some((r) => r.sweep_awarded)) await tryUnlock('daily_sweep');
      if (bonusRows.some((r) => r.flawless_awarded)) await tryUnlock('flawless_victory');
    }
  }

  // Medal collection achievements
  if (!alreadyUnlocked.has('medal_10') || !alreadyUnlocked.has('medal_50') || !alreadyUnlocked.has('golden_touch') || !alreadyUnlocked.has('medal_wall')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('gold_medals, silver_medals, bronze_medals')
      .eq('id', userId)
      .single();
    if (profile) {
      const totalMedals = (profile.gold_medals || 0) + (profile.silver_medals || 0) + (profile.bronze_medals || 0);
      if (totalMedals >= 10) await tryUnlock('medal_10');
      if (totalMedals >= 50) await tryUnlock('medal_50');
      if (totalMedals >= 100) await tryUnlock('medal_wall');
      if ((profile.gold_medals || 0) >= 10) await tryUnlock('golden_touch');
    }
  }

  // Century Club / Thousand Words (cumulative wins)
  if (!alreadyUnlocked.has('century_club') || !alreadyUnlocked.has('thousand_words')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('total_wins')
      .eq('id', userId)
      .single();
    if (profile) {
      if (profile.total_wins >= 100) await tryUnlock('century_club');
      if (profile.total_wins >= 1000) await tryUnlock('thousand_words');
    }
  }

  // Sweep Streak (7 days) / Iron Will (30 days) / Sweep Streak 60
  if (!alreadyUnlocked.has('sweep_streak_7') || !alreadyUnlocked.has('iron_will') || !alreadyUnlocked.has('sweep_streak_60')) {
    const { data: bonusDays } = await (supabase as any)
      .from('daily_bonuses')
      .select('day')
      .eq('user_id', userId)
      .eq('sweep_awarded', true)
      .order('day', { ascending: false })
      .limit(90);
    if (bonusDays && bonusDays.length > 0) {
      // Count consecutive days backwards from the most recent sweep day
      let streak = 1;
      for (let i = 1; i < bonusDays.length; i++) {
        const prev = new Date(bonusDays[i - 1].day);
        const curr = new Date(bonusDays[i].day);
        const diffMs = prev.getTime() - curr.getTime();
        if (diffMs >= 82800000 && diffMs <= 90000000) { // ~23-25h to handle timezone edges
          streak++;
        } else {
          break;
        }
      }
      if (streak >= 7) await tryUnlock('sweep_streak_7');
      if (streak >= 30) await tryUnlock('iron_will');
      if (streak >= 60) await tryUnlock('sweep_streak_60');
    }
  }

  // Mode mastery achievements (wins in specific modes)
  const modeMasteryChecks: [string, string, number][] = [
    ['quad_king', 'QUORDLE', 50],
    ['octo_boss', 'OCTORDLE', 50],
    ['sequence_ace', 'SEQUENCE', 50],
    ['rescue_hero', 'RESCUE', 50],
    ['six_shooter', 'DUEL_6', 50],
    ['lucky_seven', 'DUEL_7', 50],
    ['proper_scholar', 'PROPERNOUNDLE', 50],
    ['classic_master', 'DUEL', 100],
  ];
  for (const [key, mode, threshold] of modeMasteryChecks) {
    if (!alreadyUnlocked.has(key)) {
      const { data: stats } = await (supabase as any)
        .from('user_stats')
        .select('wins')
        .eq('user_id', userId)
        .eq('game_mode', mode)
        .eq('play_type', 'solo');
      const totalWins = (stats || []).reduce((s: number, r: any) => s + (r.wins || 0), 0);
      if (totalWins >= threshold) await tryUnlock(key);
    }
  }

  // Lightning Round (under 20 min) / Speed Sweep (under 15 min)
  if (seed?.startsWith('daily-') && (!alreadyUnlocked.has('lightning_round') || !alreadyUnlocked.has('speed_sweep') || !alreadyUnlocked.has('hat_trick') || !alreadyUnlocked.has('flawless_speed'))) {
    const today = getTodayLocal(); // daily_results.day is player-LOCAL; UTC missed evening plays
    const { data: todayResults } = await (supabase as any)
      .from('daily_results')
      .select('game_mode, time_seconds, completed')
      .eq('user_id', userId)
      .eq('day', today)
      .eq('completed', true);
    if (todayResults) {
      // Hat Trick: 3 daily games each won in under 60 seconds
      const fastWins = todayResults.filter((r: any) => (r.time_seconds || 0) < 60);
      if (fastWins.length >= 3) await tryUnlock('hat_trick');

      // Sweep speed checks
      if (todayResults.length >= 9) {
        const modes = new Set(todayResults.map((r: any) => r.game_mode));
        const allModes = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'];
        if (allModes.every(m => modes.has(m))) {
          const totalTime = todayResults.reduce((s: number, r: any) => s + (r.time_seconds || 0), 0);
          if (totalTime < 1200) await tryUnlock('lightning_round');
          if (totalTime < 900) await tryUnlock('speed_sweep');
          // Flawless Blitz: all 9 WON (completed) AND under 18 minutes. Since the
          // query already filters completed=true, 9 rows here means a Flawless day.
          if (totalTime < 1080) await tryUnlock('flawless_speed');
        }
      }
    }
  }

  // No Sweat (Classic in 2 guesses)
  if (gameMode === 'DUEL' && won && guessCount <= 2) {
    await tryUnlock('no_sweat');
  }

  // Untouchable (10-win VS streak)
  if (playType === 'vs' && won && !alreadyUnlocked.has('untouchable')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single();
    if (profile && profile.current_streak >= 10) {
      await tryUnlock('untouchable');
    }
  }

  // Gauntlet God (complete gauntlet with all boards solved)
  if (gameMode === 'GAUNTLET' && won && !alreadyUnlocked.has('gauntlet_god')) {
    // Check most recent gauntlet daily result for boards_solved === total_boards
    const { data: gauntletResult } = await (supabase as any)
      .from('daily_results')
      .select('boards_solved, total_boards')
      .eq('user_id', userId)
      .eq('game_mode', 'GAUNTLET')
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (gauntletResult && gauntletResult.boards_solved === gauntletResult.total_boards) {
      await tryUnlock('gauntlet_god');
    }
  }

  // Rival (50 VS matches played) / Dominant (50 VS wins) / Versatile Victor (5 modes)
  if (playType === 'vs' && (!alreadyUnlocked.has('rival') || !alreadyUnlocked.has('dominant') || !alreadyUnlocked.has('versatile_victor') || !alreadyUnlocked.has('vs_marathoner') || !alreadyUnlocked.has('vs_centurion'))) {
    const { data: vsStats } = await (supabase as any)
      .from('user_stats')
      .select('total_games, wins, game_mode')
      .eq('user_id', userId)
      .eq('play_type', 'vs');
    if (vsStats) {
      const totalGames = vsStats.reduce((s: number, r: any) => s + (r.total_games || 0), 0);
      const totalWins = vsStats.reduce((s: number, r: any) => s + (r.wins || 0), 0);
      if (totalGames >= 50) await tryUnlock('rival');
      if (totalGames >= 100) await tryUnlock('vs_marathoner');
      if (totalWins >= 50) await tryUnlock('dominant');
      if (totalWins >= 100) await tryUnlock('vs_centurion');
      // Versatile Victor: won in 5+ different modes
      const modesWon = vsStats.filter((r: any) => (r.wins || 0) > 0).length;
      if (modesWon >= 5) await tryUnlock('versatile_victor');
    }
  }

  // Triple Threat (3 VS wins in a single day)
  if (playType === 'vs' && won && !alreadyUnlocked.has('triple_threat')) {
    const today = getTodayLocal(); // daily_results.day is player-LOCAL; UTC missed evening plays
    const { data: todayDaily } = await (supabase as any)
      .from('daily_results')
      .select('vs_wins')
      .eq('user_id', userId)
      .eq('day', today);
    if (todayDaily) {
      const totalVsWins = todayDaily.reduce((s: number, r: any) => s + (r.vs_wins || 0), 0);
      if (totalVsWins >= 3) await tryUnlock('triple_threat');
    }
  }

  // Blitz (win any game in under 15 seconds) / Quick Draw (under 10s)
  if (won && timeSeconds < 15) {
    await tryUnlock('blitz');
  }
  if (won && timeSeconds < 10) {
    await tryUnlock('quick_draw');
  }

  // Close Call (win on final guess)
  if (won) {
    const FINAL_GUESS: Record<string, number> = {
      DUEL: 6, DUEL_6: 7, DUEL_7: 8, PROPERNOUNDLE: 6,
      QUORDLE: 9, OCTORDLE: 13,
    };
    if (FINAL_GUESS[gameMode] && guessCount === FINAL_GUESS[gameMode]) {
      await tryUnlock('close_call');
    }
  }

  // Eagle Eye (10 lifetime 1-guess wins) / Sharpshooter (25)
  if (won && guessCount === 1 && (!alreadyUnlocked.has('eagle_eye') || !alreadyUnlocked.has('sharpshooter'))) {
    const { count } = await (supabase as any)
      .from('daily_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('guess_count', 1)
      .eq('completed', true);
    if ((count || 0) >= 10) await tryUnlock('eagle_eye');
    if ((count || 0) >= 25) await tryUnlock('sharpshooter');
  }

  // Extended Vocabulary (win both Six and Seven daily in same day)
  if ((gameMode === 'DUEL_6' || gameMode === 'DUEL_7') && won && seed?.startsWith('daily-') && !alreadyUnlocked.has('extended_vocab')) {
    const today = getTodayLocal(); // daily_results.day is player-LOCAL; UTC missed evening plays
    const { data: sixSevenResults } = await (supabase as any)
      .from('daily_results')
      .select('game_mode')
      .eq('user_id', userId)
      .eq('day', today)
      .eq('completed', true)
      .in('game_mode', ['DUEL_6', 'DUEL_7']);
    if (sixSevenResults) {
      const modes = new Set(sixSevenResults.map((r: any) => r.game_mode));
      if (modes.has('DUEL_6') && modes.has('DUEL_7')) {
        await tryUnlock('extended_vocab');
      }
    }
  }

  // Dedicated (500 games) / Obsessed (2000 games)
  if (!alreadyUnlocked.has('dedicated') || !alreadyUnlocked.has('obsessed')) {
    const { data: allStats } = await (supabase as any)
      .from('user_stats')
      .select('total_games')
      .eq('user_id', userId);
    if (allStats) {
      const totalPlayed = allStats.reduce((s: number, r: any) => s + (r.total_games || 0), 0);
      if (totalPlayed >= 500) await tryUnlock('dedicated');
      if (totalPlayed >= 2000) await tryUnlock('obsessed');
    }
  }

  // Daily Devotee (50 sweeps) / Centurion (100 sweeps)
  if (!alreadyUnlocked.has('daily_devotee') || !alreadyUnlocked.has('centurion')) {
    const { count: sweepCount } = await (supabase as any)
      .from('daily_bonuses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('sweep_awarded', true);
    if ((sweepCount || 0) >= 50) await tryUnlock('daily_devotee');
    if ((sweepCount || 0) >= 100) await tryUnlock('centurion');
  }

  // High Five (5 flawless) / Flawless Ten (10) / Flawless 25 (25) — flawless-day count.
  if (!alreadyUnlocked.has('flawless_5') || !alreadyUnlocked.has('flawless_10') || !alreadyUnlocked.has('flawless_25')) {
    const { count: flawlessCount } = await (supabase as any)
      .from('daily_bonuses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('flawless_awarded', true);
    if ((flawlessCount || 0) >= 5) await tryUnlock('flawless_5');
    if ((flawlessCount || 0) >= 10) await tryUnlock('flawless_10');
    if ((flawlessCount || 0) >= 25) await tryUnlock('flawless_25');
  }

  // Rising Star (level 10) / Elite (level 50)
  if (!alreadyUnlocked.has('rising_star') || !alreadyUnlocked.has('elite')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('level')
      .eq('id', userId)
      .single();
    if (profile) {
      if (profile.level >= 10) await tryUnlock('rising_star');
      if (profile.level >= 50) await tryUnlock('elite');
    }
  }

  // Year One (365 consecutive days)
  if (!alreadyUnlocked.has('year_one')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('daily_login_streak')
      .eq('id', userId)
      .single();
    if (profile && profile.daily_login_streak >= 365) {
      await tryUnlock('year_one');
    }
  }

  // Flawless Streak (3 days in a row) / Flawless Streak 5 (5 days in a row)
  if (!alreadyUnlocked.has('flawless_streak') || !alreadyUnlocked.has('flawless_streak_5')) {
    const { data: flawlessDays } = await (supabase as any)
      .from('daily_bonuses')
      .select('day')
      .eq('user_id', userId)
      .eq('flawless_awarded', true)
      .order('day', { ascending: false })
      .limit(10);
    if (flawlessDays && flawlessDays.length > 0) {
      // Length of the current consecutive run ending at the most recent flawless day.
      let run = 1;
      for (let i = 1; i < flawlessDays.length; i++) {
        const prev = new Date(flawlessDays[i - 1].day);
        const curr = new Date(flawlessDays[i].day);
        const diffMs = prev.getTime() - curr.getTime();
        if (diffMs >= 82800000 && diffMs <= 90000000) run++;
        else break;
      }
      if (run >= 3) await tryUnlock('flawless_streak');
      if (run >= 5) await tryUnlock('flawless_streak_5');
    }
  }

  // Gold Rush (50 gold) / Diamond Hands (100 gold)
  if (!alreadyUnlocked.has('gold_rush') || !alreadyUnlocked.has('diamond_hands')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('gold_medals')
      .eq('id', userId)
      .single();
    if (profile) {
      if ((profile.gold_medals || 0) >= 50) await tryUnlock('gold_rush');
      if ((profile.gold_medals || 0) >= 100) await tryUnlock('diamond_hands');
    }
  }

  // Unbreakable (25-win streak)
  if (won && !alreadyUnlocked.has('unbreakable')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('current_streak, best_streak')
      .eq('id', userId)
      .single();
    if (profile && (profile.current_streak >= 25 || profile.best_streak >= 25)) {
      await tryUnlock('unbreakable');
    }
  }

  // The Natural (10 wins under 30 seconds)
  if (won && timeSeconds < 30 && !alreadyUnlocked.has('the_natural')) {
    const { count } = await (supabase as any)
      .from('daily_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true)
      .lt('time_seconds', 30)
      .gt('boards_solved', 0);
    if ((count || 0) >= 10) await tryUnlock('the_natural');
  }

  // Wordsmith (500 wins)
  if (won && !alreadyUnlocked.has('wordsmith')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('total_wins')
      .eq('id', userId)
      .single();
    if (profile && profile.total_wins >= 500) await tryUnlock('wordsmith');
  }

  // Endurance (1000 total games)
  if (!alreadyUnlocked.has('endurance')) {
    const { data: allStats } = await (supabase as any)
      .from('user_stats')
      .select('total_games')
      .eq('user_id', userId);
    if (allStats) {
      const total = allStats.reduce((s: number, r: any) => s + (r.total_games || 0), 0);
      if (total >= 1000) await tryUnlock('endurance');
    }
  }

  // Marathon Runner (5 hours / 18000 seconds of total playtime)
  if (!alreadyUnlocked.has('marathon_runner') && seed?.startsWith('daily-')) {
    const { data: timeResults } = await (supabase as any)
      .from('daily_results')
      .select('time_seconds')
      .eq('user_id', userId)
      .eq('completed', true);
    if (timeResults) {
      const totalSec = timeResults.reduce((s: number, r: any) => s + (r.time_seconds || 0), 0);
      if (totalSec >= 18000) await tryUnlock('marathon_runner');
    }
  }

  // Linguist (Classic + Six + Seven daily wins in same day)
  if (['DUEL', 'DUEL_6', 'DUEL_7'].includes(gameMode) && won && seed?.startsWith('daily-') && !alreadyUnlocked.has('linguist')) {
    const today = getTodayLocal(); // daily_results.day is player-LOCAL; UTC missed evening plays
    const { data: langResults } = await (supabase as any)
      .from('daily_results')
      .select('game_mode')
      .eq('user_id', userId)
      .eq('day', today)
      .eq('completed', true)
      .in('game_mode', ['DUEL', 'DUEL_6', 'DUEL_7']);
    if (langResults) {
      const modes = new Set(langResults.map((r: any) => r.game_mode));
      if (modes.has('DUEL') && modes.has('DUEL_6') && modes.has('DUEL_7')) {
        await tryUnlock('linguist');
      }
    }
  }

  // Streak Master (50-day login streak)
  if (!alreadyUnlocked.has('streak_master')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('daily_login_streak')
      .eq('id', userId)
      .single();
    if (profile && profile.daily_login_streak >= 50) await tryUnlock('streak_master');
  }

  // ─── Pure ladder ────────────────────────────────────────────
  // Hintless wins per mode, queried from `matches` so both daily and
  // practice games count. Only fires after a hintless win in one of
  // the three hint-bearing modes so we don't query Supabase on every
  // unrelated game.
  const PURE_MODES = ['DUEL_6', 'DUEL_7', 'PROPERNOUNDLE'];
  if (won && hintsUsed === 0 && PURE_MODES.includes(gameMode)) {
    const tierKey = (mode: string, tier: 'initiate' | 'adept' | 'master') => {
      const slug = mode === 'DUEL_6' ? 'six' : mode === 'DUEL_7' ? 'seven' : 'proper';
      return `pure_${slug}_${tier}`;
    };
    const keys = (['initiate', 'adept', 'master'] as const).map(t => tierKey(gameMode, t));
    const anyPerModeLeft = keys.some(k => !alreadyUnlocked.has(k));
    const playerLeft = !alreadyUnlocked.has('pure_player');

    if (anyPerModeLeft || playerLeft) {
      // Per-mode count: hintless solo wins in this specific mode.
      const { count: modeCount } = await (supabase as any)
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('player1_id', userId)
        .is('player2_id', null)
        .eq('winner_id', userId)
        .eq('game_mode', gameMode)
        .eq('hints_used', 0);
      const c = modeCount || 0;
      if (c >= 1)  await tryUnlock(tierKey(gameMode, 'initiate'));
      if (c >= 10) await tryUnlock(tierKey(gameMode, 'adept'));
      if (c >= 50) await tryUnlock(tierKey(gameMode, 'master'));

      // Cross-mode capstone: 50 hintless solo wins across all three modes.
      if (playerLeft) {
        const { count: allCount } = await (supabase as any)
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('player1_id', userId)
          .is('player2_id', null)
          .eq('winner_id', userId)
          .in('game_mode', PURE_MODES)
          .eq('hints_used', 0);
        if ((allCount || 0) >= 50) await tryUnlock('pure_player');
      }
    }
  }

  // Daily Regular (100 different days with dailies)
  if (!alreadyUnlocked.has('daily_regular') && seed?.startsWith('daily-')) {
    const { count } = await (supabase as any)
      .from('daily_results')
      .select('day', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true);
    // count returns total rows, but we need distinct days — use a workaround
    const { data: distinctDays } = await (supabase as any)
      .from('daily_results')
      .select('day')
      .eq('user_id', userId)
      .eq('completed', true);
    if (distinctDays) {
      const uniqueDays = new Set(distinctDays.map((r: any) => r.day));
      if (uniqueDays.size >= 100) await tryUnlock('daily_regular');
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
