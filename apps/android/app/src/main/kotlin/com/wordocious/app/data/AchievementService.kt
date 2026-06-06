package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Achievement catalog + unlocked-keys reader — 1:1 with apps/web
 * lib/achievement-service.ts ACHIEVEMENTS and iOS AchievementService.
 * Display-only on native: unlock detection runs server-side on the web's
 * recordGameResult and lands in the shared `achievements` table; here we read
 * which keys the user has unlocked (native-side unlock detection is deferred).
 */
object AchievementService {
    data class AchievementDef(val key: String, val name: String, val description: String, val category: String)

    val all: List<AchievementDef> = listOf(
        AchievementDef("first_win", "First Win", "Win any game", "beginner"),
        AchievementDef("all_modes", "All Modes Played", "Play all 9 game modes", "beginner"),
        AchievementDef("daily_debut", "Daily Debut", "Complete your first daily challenge", "beginner"),
        AchievementDef("streak_7", "7-Day Warrior", "Play 7 consecutive days", "consistency"),
        AchievementDef("streak_30", "30-Day Streak", "Play 30 consecutive days", "consistency"),
        AchievementDef("speed_demon", "Speed Demon", "Solve Classic in under 30 seconds", "skill"),
        AchievementDef("perfectionist", "Perfectionist", "Solve in 1 guess", "skill"),
        AchievementDef("gauntlet_master", "Gauntlet Master", "Complete the entire Gauntlet", "skill"),
        AchievementDef("vs_veteran", "VS Veteran", "Win 10 VS matches", "social"),
        AchievementDef("unstoppable", "Unstoppable", "Achieve a 5-win streak", "social"),
        AchievementDef("medal_10", "Medal Collector", "Earn 10 medals", "collection"),
        AchievementDef("medal_50", "Medal Hoarder", "Earn 50 medals", "collection"),
        AchievementDef("golden_touch", "Golden Touch", "Earn 10 gold medals", "collection"),
        AchievementDef("daily_sweep", "Daily Sweep", "Complete all 9 dailies in a single day", "skill"),
        AchievementDef("flawless_victory", "Flawless Victory", "Win all 9 dailies in a single day", "skill"),
        AchievementDef("century_club", "Century Club", "Win 100 total games", "consistency"),
        AchievementDef("thousand_words", "Thousand Words", "Win 1,000 total games", "consistency"),
        AchievementDef("sweep_streak_7", "Sweep Streak", "Complete the daily sweep 7 days in a row", "consistency"),
        AchievementDef("iron_will", "Iron Will", "Complete the daily sweep 30 days in a row", "consistency"),
        AchievementDef("quad_king", "Quad King", "Win 50 QuadWord games", "skill"),
        AchievementDef("octo_boss", "Octo Boss", "Win 50 OctoWord games", "skill"),
        AchievementDef("sequence_ace", "Sequence Ace", "Win 50 Sequence games", "skill"),
        AchievementDef("rescue_hero", "Rescue Hero", "Win 50 Deliverance games", "skill"),
        AchievementDef("lightning_round", "Lightning Round", "Complete the daily sweep in under 20 minutes", "skill"),
        AchievementDef("no_sweat", "No Sweat", "Win Classic in 2 guesses", "skill"),
        AchievementDef("untouchable", "Untouchable", "Achieve a 10-win VS streak", "social"),
        AchievementDef("gauntlet_god", "Gauntlet God", "Complete Gauntlet without failing any board", "skill"),
        AchievementDef("rival", "Rival", "Play 50 VS matches", "social"),
        AchievementDef("dominant", "Dominant", "Win 50 VS matches", "social"),
        AchievementDef("medal_wall", "Medal Wall", "Earn 100 medals", "collection"),
        AchievementDef("six_shooter", "Six Shooter", "Win 50 Classic Six games", "skill"),
        AchievementDef("lucky_seven", "Lucky Seven", "Win 50 Classic Seven games", "skill"),
        AchievementDef("extended_vocab", "Extended Vocabulary", "Win both a Six and Seven daily in the same day", "beginner"),
        AchievementDef("proper_scholar", "Proper Scholar", "Win 50 Propernoundle games", "skill"),
        AchievementDef("classic_master", "Classic Master", "Win 100 Classic games", "skill"),
        AchievementDef("blitz", "Blitz", "Win any game in under 15 seconds", "skill"),
        AchievementDef("speed_sweep", "Speed Sweep", "Complete the daily sweep in under 15 minutes", "skill"),
        AchievementDef("dedicated", "Dedicated", "Play 500 total games", "consistency"),
        AchievementDef("obsessed", "Obsessed", "Play 2,000 total games", "consistency"),
        AchievementDef("daily_devotee", "Daily Devotee", "Complete 50 daily sweeps", "consistency"),
        AchievementDef("centurion", "Centurion", "Complete 100 daily sweeps", "consistency"),
        AchievementDef("rising_star", "Rising Star", "Reach level 10", "beginner"),
        AchievementDef("elite", "Elite", "Reach level 50", "skill"),
        AchievementDef("year_one", "Year One", "Play 365 consecutive days", "consistency"),
        AchievementDef("flawless_streak", "Flawless Streak", "Achieve Flawless Victory 3 days in a row", "skill"),
        AchievementDef("versatile_victor", "Versatile Victor", "Win VS matches in 5 different game modes", "social"),
        AchievementDef("triple_threat", "Triple Threat", "Win 3 VS matches in a single day", "social"),
        AchievementDef("close_call", "Close Call", "Win a game on your final guess", "skill"),
        AchievementDef("hat_trick", "Hat Trick", "Win 3 daily games in under 60 seconds each in one day", "skill"),
        AchievementDef("eagle_eye", "Eagle Eye", "Solve 10 games in 1 guess lifetime", "skill"),
        AchievementDef("gold_rush", "Gold Rush", "Earn 50 gold medals", "collection"),
        AchievementDef("diamond_hands", "Diamond Hands", "Earn 100 gold medals", "collection"),
        AchievementDef("unbreakable", "Unbreakable", "Achieve a 25-win streak", "skill"),
        AchievementDef("the_natural", "The Natural", "Win 10 games in under 30 seconds", "skill"),
        AchievementDef("wordsmith", "Wordsmith", "Win 500 total games", "consistency"),
        AchievementDef("endurance", "Endurance", "Play 1,000 total games", "consistency"),
        AchievementDef("marathon_runner", "Marathon Runner", "Accumulate 5 hours of total playtime", "consistency"),
        AchievementDef("linguist", "Linguist", "Win Classic, Six, and Seven daily in the same day", "beginner"),
        AchievementDef("streak_master", "Streak Master", "Achieve a 50-day login streak", "consistency"),
        AchievementDef("daily_regular", "Daily Regular", "Complete dailies on 100 different days", "consistency"),
        AchievementDef("pure_six_initiate", "Pure Six", "Win Classic Six without using any hints", "skill"),
        AchievementDef("pure_six_adept", "Pure Six Adept", "Win 10 Classic Six games without hints", "skill"),
        AchievementDef("pure_six_master", "Pure Six Master", "Win 50 Classic Six games without hints", "skill"),
        AchievementDef("pure_seven_initiate", "Pure Seven", "Win Classic Seven without using any hints", "skill"),
        AchievementDef("pure_seven_adept", "Pure Seven Adept", "Win 10 Classic Seven games without hints", "skill"),
        AchievementDef("pure_seven_master", "Pure Seven Master", "Win 50 Classic Seven games without hints", "skill"),
        AchievementDef("pure_proper_initiate", "Pure Proper", "Win ProperNoundle without using any hints", "skill"),
        AchievementDef("pure_proper_adept", "Pure Proper Adept", "Win 10 ProperNoundle games without hints", "skill"),
        AchievementDef("pure_proper_master", "Pure Proper Master", "Win 50 ProperNoundle games without hints", "skill"),
        AchievementDef("pure_player", "Pure Player", "Win 50 hintless games across Six, Seven, and ProperNoundle combined", "skill"),
    )

    @Serializable
    private data class Row(@SerialName("achievement_key") val achievementKey: String)

    /** Keys the user has unlocked (from the shared `achievements` table). */
    suspend fun fetchUnlocked(userId: String): Set<String> = runCatching {
        SupabaseConfig.client.postgrest["achievements"]
            .select(Columns.raw("achievement_key")) { filter { eq("user_id", userId) } }
            .decodeList<Row>()
            .map { it.achievementKey }
            .toSet()
    }.getOrElse { emptySet() }
}
