package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Count
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate

/**
 * Achievement catalog + unlocked-keys reader + unlock detection — 1:1 with
 * apps/web lib/achievement-service.ts (ACHIEVEMENTS + checkAchievements) and
 * iOS AchievementService. Unlock detection now runs natively too:
 * [checkAchievements] is called from GameResultsService.record after every
 * finished game and writes new keys into the shared `achievements` table
 * (idempotent — per-insert unique-violation failures are swallowed).
 */
object AchievementService {
    @Serializable
    data class AchievementDef(
        val key: String, val name: String, val description: String, val category: String,
        val icon: String? = null,   // present in /api/achievements; unused for rendering
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

    // ============================================================
    // Unlock detection — 1:1 port of web checkAchievements()
    // ============================================================

    @Serializable
    private data class Insert(
        @SerialName("user_id") val userId: String,
        @SerialName("achievement_key") val achievementKey: String,
    )

    @Serializable
    private data class TotalWinsRow(@SerialName("total_wins") val totalWins: Int = 0)

    @Serializable
    private data class CurrentStreakRow(@SerialName("current_streak") val currentStreak: Int = 0)

    @Serializable
    private data class WinStreaksRow(
        @SerialName("current_streak") val currentStreak: Int = 0,
        @SerialName("best_streak") val bestStreak: Int = 0,
    )

    @Serializable
    private data class LoginStreakRow(@SerialName("daily_login_streak") val dailyLoginStreak: Int = 0)

    @Serializable
    private data class MedalCountsRow(
        @SerialName("gold_medals") val goldMedals: Int = 0,
        @SerialName("silver_medals") val silverMedals: Int = 0,
        @SerialName("bronze_medals") val bronzeMedals: Int = 0,
    )

    @Serializable
    private data class GoldMedalsRow(@SerialName("gold_medals") val goldMedals: Int = 0)

    @Serializable
    private data class LevelRow(val level: Int = 1)

    @Serializable
    private data class ModeRow(@SerialName("game_mode") val gameMode: String)

    @Serializable
    private data class BonusFlagsRow(
        @SerialName("sweep_awarded") val sweepAwarded: Boolean = false,
        @SerialName("flawless_awarded") val flawlessAwarded: Boolean = false,
    )

    @Serializable
    private data class DayRow(val day: String)

    @Serializable
    private data class WinsRow(val wins: Int = 0)

    @Serializable
    private data class DailyTimedRow(
        @SerialName("game_mode") val gameMode: String,
        @SerialName("time_seconds") val timeSeconds: Int? = 0,
        val completed: Boolean = false,
    )

    @Serializable
    private data class GauntletBoardsRow(
        @SerialName("boards_solved") val boardsSolved: Int? = 0,
        @SerialName("total_boards") val totalBoards: Int? = 0,
    )

    @Serializable
    private data class VsStatsRow(
        @SerialName("total_games") val totalGames: Int? = 0,
        val wins: Int? = 0,
        @SerialName("game_mode") val gameMode: String,
    )

    @Serializable
    private data class VsWinsRow(@SerialName("vs_wins") val vsWins: Int? = 0)

    @Serializable
    private data class TotalGamesRow(@SerialName("total_games") val totalGames: Int? = 0)

    @Serializable
    private data class TimeSecondsRow(@SerialName("time_seconds") val timeSeconds: Int? = 0)

    private val ALL_MODES = listOf(
        "DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE",
        "DUEL_6", "DUEL_7", "GAUNTLET", "PROPERNOUNDLE",
    )

    /** Day strings are ISO dates; "consecutive" = exactly 1 day apart (web's ~23-25h ms window). */
    private fun isConsecutiveDays(newer: String, older: String): Boolean = runCatching {
        LocalDate.parse(newer).toEpochDay() - LocalDate.parse(older).toEpochDay() == 1L
    }.getOrDefault(false)

    /**
     * Check and award achievements after a game result — 1:1 port of web
     * checkAchievements (apps/web/lib/achievement-service.ts). Returns newly
     * unlocked keys. Never throws. Note: web keys "today" off UTC; this app's
     * native standard is the device-LOCAL day (matches daily recording).
     */
    suspend fun checkAchievements(
        userId: String,
        gameMode: String,
        playType: String,
        won: Boolean,
        guessCount: Int,
        timeSeconds: Int,
        seed: String?,
        hintsUsed: Int = 0,
    ): List<String> = runCatching {
        val client = SupabaseConfig.client
        val unlocked = mutableListOf<String>()

        // Fetch existing achievements
        val alreadyUnlocked = client.postgrest["achievements"]
            .select(Columns.raw("achievement_key")) { filter { eq("user_id", userId) } }
            .decodeList<Row>()
            .map { it.achievementKey }
            .toMutableSet()

        suspend fun tryUnlock(key: String) {
            if (key in alreadyUnlocked) return
            runCatching {
                client.postgrest["achievements"].insert(Insert(userId, key))
            }.onSuccess {
                alreadyUnlocked.add(key)
                unlocked.add(key)
            }
        }

        val isDaily = seed?.startsWith("daily-") == true

        // First Win
        if (won) tryUnlock("first_win")

        // Daily Debut
        if (isDaily) tryUnlock("daily_debut")

        // Speed Demon (Classic under 30s)
        if (gameMode == "DUEL" && won && timeSeconds < 30) tryUnlock("speed_demon")

        // Perfectionist (1 guess)
        if (won && guessCount == 1) tryUnlock("perfectionist")

        // Gauntlet Master
        if (gameMode == "GAUNTLET" && won) tryUnlock("gauntlet_master")

        // VS Veteran (10 VS wins)
        if (playType == "vs" && won) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("total_wins")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<TotalWinsRow>()
            if (profile != null && profile.totalWins >= 10) tryUnlock("vs_veteran")
        }

        // Unstoppable (5-win streak)
        if (won) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("current_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<CurrentStreakRow>()
            if (profile != null && profile.currentStreak >= 5) tryUnlock("unstoppable")
        }

        // All Modes Played
        if ("all_modes" !in alreadyUnlocked) {
            val modes = client.postgrest["user_stats"]
                .select(Columns.raw("game_mode")) { filter { eq("user_id", userId) } }
                .decodeList<ModeRow>()
                .map { it.gameMode }
                .toSet()
            if (ALL_MODES.all { it in modes }) tryUnlock("all_modes")
        }

        // Streak achievements
        if ("streak_7" !in alreadyUnlocked || "streak_30" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("daily_login_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<LoginStreakRow>()
            if (profile != null) {
                if (profile.dailyLoginStreak >= 7) tryUnlock("streak_7")
                if (profile.dailyLoginStreak >= 30) tryUnlock("streak_30")
            }
        }

        // Daily Sweep / Flawless Victory — piggyback on daily_bonuses flags
        if ("daily_sweep" !in alreadyUnlocked || "flawless_victory" !in alreadyUnlocked) {
            val bonusRows = client.postgrest["daily_bonuses"]
                .select(Columns.raw("sweep_awarded, flawless_awarded")) { filter { eq("user_id", userId) } }
                .decodeList<BonusFlagsRow>()
            if (bonusRows.any { it.sweepAwarded }) tryUnlock("daily_sweep")
            if (bonusRows.any { it.flawlessAwarded }) tryUnlock("flawless_victory")
        }

        // Medal collection achievements
        if ("medal_10" !in alreadyUnlocked || "medal_50" !in alreadyUnlocked ||
            "golden_touch" !in alreadyUnlocked || "medal_wall" !in alreadyUnlocked
        ) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("gold_medals, silver_medals, bronze_medals")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<MedalCountsRow>()
            if (profile != null) {
                val totalMedals = profile.goldMedals + profile.silverMedals + profile.bronzeMedals
                if (totalMedals >= 10) tryUnlock("medal_10")
                if (totalMedals >= 50) tryUnlock("medal_50")
                if (totalMedals >= 100) tryUnlock("medal_wall")
                if (profile.goldMedals >= 10) tryUnlock("golden_touch")
            }
        }

        // Century Club / Thousand Words (cumulative wins)
        if ("century_club" !in alreadyUnlocked || "thousand_words" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("total_wins")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<TotalWinsRow>()
            if (profile != null) {
                if (profile.totalWins >= 100) tryUnlock("century_club")
                if (profile.totalWins >= 1000) tryUnlock("thousand_words")
            }
        }

        // Sweep Streak (7 days) / Iron Will (30 days) / Sweep Streak 60
        if ("sweep_streak_7" !in alreadyUnlocked || "iron_will" !in alreadyUnlocked || "sweep_streak_60" !in alreadyUnlocked) {
            val bonusDays = client.postgrest["daily_bonuses"]
                .select(Columns.raw("day")) {
                    filter { eq("user_id", userId); eq("sweep_awarded", true) }
                    order("day", Order.DESCENDING)
                    limit(90)
                }
                .decodeList<DayRow>()
            if (bonusDays.isNotEmpty()) {
                // Count consecutive days backwards from the most recent sweep day
                var streak = 1
                for (i in 1 until bonusDays.size) {
                    if (isConsecutiveDays(bonusDays[i - 1].day, bonusDays[i].day)) streak++ else break
                }
                if (streak >= 7) tryUnlock("sweep_streak_7")
                if (streak >= 30) tryUnlock("iron_will")
                if (streak >= 60) tryUnlock("sweep_streak_60")
            }
        }

        // Mode mastery achievements (wins in specific modes)
        val modeMasteryChecks = listOf(
            Triple("quad_king", "QUORDLE", 50),
            Triple("octo_boss", "OCTORDLE", 50),
            Triple("sequence_ace", "SEQUENCE", 50),
            Triple("rescue_hero", "RESCUE", 50),
            Triple("six_shooter", "DUEL_6", 50),
            Triple("lucky_seven", "DUEL_7", 50),
            Triple("proper_scholar", "PROPERNOUNDLE", 50),
            Triple("classic_master", "DUEL", 100),
        )
        for ((key, mode, threshold) in modeMasteryChecks) {
            if (key in alreadyUnlocked) continue
            val stats = client.postgrest["user_stats"]
                .select(Columns.raw("wins")) {
                    filter { eq("user_id", userId); eq("game_mode", mode); eq("play_type", "solo") }
                }
                .decodeList<WinsRow>()
            val totalWins = stats.sumOf { it.wins }
            if (totalWins >= threshold) tryUnlock(key)
        }

        // Lightning Round (under 20 min) / Speed Sweep (under 15 min) / Hat Trick / Flawless Blitz
        if (isDaily && ("lightning_round" !in alreadyUnlocked || "speed_sweep" !in alreadyUnlocked || "hat_trick" !in alreadyUnlocked || "flawless_speed" !in alreadyUnlocked)) {
            val today = todayLocalDate()
            val todayResults = client.postgrest["daily_results"]
                .select(Columns.raw("game_mode, time_seconds, completed")) {
                    filter { eq("user_id", userId); eq("day", today); eq("completed", true) }
                }
                .decodeList<DailyTimedRow>()
            // Hat Trick: 3 daily games each won in under 60 seconds
            val fastWins = todayResults.filter { (it.timeSeconds ?: 0) < 60 }
            if (fastWins.size >= 3) tryUnlock("hat_trick")

            // Sweep speed checks
            if (todayResults.size >= 9) {
                val modes = todayResults.map { it.gameMode }.toSet()
                if (ALL_MODES.all { it in modes }) {
                    val totalTime = todayResults.sumOf { it.timeSeconds ?: 0 }
                    if (totalTime < 1200) tryUnlock("lightning_round")
                    if (totalTime < 900) tryUnlock("speed_sweep")
                    // todayResults is filtered completed=true, so all 9 present == Flawless day.
                    if (totalTime < 1080) tryUnlock("flawless_speed")
                }
            }
        }

        // No Sweat (Classic in 2 guesses)
        if (gameMode == "DUEL" && won && guessCount <= 2) tryUnlock("no_sweat")

        // Untouchable (10-win VS streak)
        if (playType == "vs" && won && "untouchable" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("current_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<CurrentStreakRow>()
            if (profile != null && profile.currentStreak >= 10) tryUnlock("untouchable")
        }

        // Gauntlet God (complete gauntlet with all boards solved)
        if (gameMode == "GAUNTLET" && won && "gauntlet_god" !in alreadyUnlocked) {
            val gauntletResult = client.postgrest["daily_results"]
                .select(Columns.raw("boards_solved, total_boards")) {
                    filter { eq("user_id", userId); eq("game_mode", "GAUNTLET"); eq("completed", true) }
                    order("created_at", Order.DESCENDING)
                    limit(1)
                }
                .decodeSingleOrNull<GauntletBoardsRow>()
            if (gauntletResult != null && gauntletResult.boardsSolved == gauntletResult.totalBoards) {
                tryUnlock("gauntlet_god")
            }
        }

        // Rival (50 VS played) / Dominant (50 VS wins) / Versatile Victor (5 modes)
        if (playType == "vs" && ("rival" !in alreadyUnlocked || "dominant" !in alreadyUnlocked || "versatile_victor" !in alreadyUnlocked)) {
            val vsStats = client.postgrest["user_stats"]
                .select(Columns.raw("total_games, wins, game_mode")) {
                    filter { eq("user_id", userId); eq("play_type", "vs") }
                }
                .decodeList<VsStatsRow>()
            val totalGames = vsStats.sumOf { it.totalGames ?: 0 }
            val totalWins = vsStats.sumOf { it.wins ?: 0 }
            if (totalGames >= 50) tryUnlock("rival")
            if (totalWins >= 50) tryUnlock("dominant")
            // Versatile Victor: won in 5+ different modes
            val modesWon = vsStats.count { (it.wins ?: 0) > 0 }
            if (modesWon >= 5) tryUnlock("versatile_victor")
        }

        // Triple Threat (3 VS wins in a single day)
        if (playType == "vs" && won && "triple_threat" !in alreadyUnlocked) {
            val today = todayLocalDate()
            val todayDaily = client.postgrest["daily_results"]
                .select(Columns.raw("vs_wins")) { filter { eq("user_id", userId); eq("day", today) } }
                .decodeList<VsWinsRow>()
            val totalVsWins = todayDaily.sumOf { it.vsWins ?: 0 }
            if (totalVsWins >= 3) tryUnlock("triple_threat")
        }

        // Blitz (win any game in under 15 seconds)
        if (won && timeSeconds < 15) tryUnlock("blitz")

        // Close Call (win on final guess)
        if (won) {
            val finalGuess = mapOf(
                "DUEL" to 6, "DUEL_6" to 7, "DUEL_7" to 8, "PROPERNOUNDLE" to 6,
                "QUORDLE" to 9, "OCTORDLE" to 13,
            )
            if (finalGuess[gameMode] != null && guessCount == finalGuess[gameMode]) tryUnlock("close_call")
        }

        // Eagle Eye (10 lifetime 1-guess wins)
        if (won && guessCount == 1 && "eagle_eye" !in alreadyUnlocked) {
            val count = client.postgrest["daily_results"]
                .select(Columns.raw("id")) {
                    count(Count.EXACT); limit(1)
                    filter { eq("user_id", userId); eq("guess_count", 1); eq("completed", true) }
                }
                .countOrNull() ?: 0L
            if (count >= 10) tryUnlock("eagle_eye")
        }

        // Extended Vocabulary (win both Six and Seven daily in same day)
        if ((gameMode == "DUEL_6" || gameMode == "DUEL_7") && won && isDaily && "extended_vocab" !in alreadyUnlocked) {
            val today = todayLocalDate()
            val sixSevenModes = client.postgrest["daily_results"]
                .select(Columns.raw("game_mode")) {
                    filter {
                        eq("user_id", userId); eq("day", today); eq("completed", true)
                        isIn("game_mode", listOf("DUEL_6", "DUEL_7"))
                    }
                }
                .decodeList<ModeRow>()
                .map { it.gameMode }
                .toSet()
            if ("DUEL_6" in sixSevenModes && "DUEL_7" in sixSevenModes) tryUnlock("extended_vocab")
        }

        // Dedicated (500 games) / Obsessed (2000 games)
        if ("dedicated" !in alreadyUnlocked || "obsessed" !in alreadyUnlocked) {
            val allStats = client.postgrest["user_stats"]
                .select(Columns.raw("total_games")) { filter { eq("user_id", userId) } }
                .decodeList<TotalGamesRow>()
            val totalPlayed = allStats.sumOf { it.totalGames ?: 0 }
            if (totalPlayed >= 500) tryUnlock("dedicated")
            if (totalPlayed >= 2000) tryUnlock("obsessed")
        }

        // Daily Devotee (50 sweeps) / Centurion (100 sweeps)
        if ("daily_devotee" !in alreadyUnlocked || "centurion" !in alreadyUnlocked) {
            val sweepCount = client.postgrest["daily_bonuses"]
                .select(Columns.raw("id")) {
                    count(Count.EXACT); limit(1)
                    filter { eq("user_id", userId); eq("sweep_awarded", true) }
                }
                .countOrNull() ?: 0L
            if (sweepCount >= 50) tryUnlock("daily_devotee")
            if (sweepCount >= 100) tryUnlock("centurion")
        }

        // High Five (5 flawless) / Flawless 25 (25 flawless) — flawless-day count.
        if ("flawless_5" !in alreadyUnlocked || "flawless_25" !in alreadyUnlocked) {
            val flawlessCount = client.postgrest["daily_bonuses"]
                .select(Columns.raw("id")) {
                    count(Count.EXACT); limit(1)
                    filter { eq("user_id", userId); eq("flawless_awarded", true) }
                }
                .countOrNull() ?: 0L
            if (flawlessCount >= 5) tryUnlock("flawless_5")
            if (flawlessCount >= 25) tryUnlock("flawless_25")
        }

        // Rising Star (level 10) / Elite (level 50)
        if ("rising_star" !in alreadyUnlocked || "elite" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("level")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<LevelRow>()
            if (profile != null) {
                if (profile.level >= 10) tryUnlock("rising_star")
                if (profile.level >= 50) tryUnlock("elite")
            }
        }

        // Year One (365 consecutive days)
        if ("year_one" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("daily_login_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<LoginStreakRow>()
            if (profile != null && profile.dailyLoginStreak >= 365) tryUnlock("year_one")
        }

        // Flawless Streak (3 days in a row) / Flawless Streak 5 (5 days in a row)
        if ("flawless_streak" !in alreadyUnlocked || "flawless_streak_5" !in alreadyUnlocked) {
            val flawlessDays = client.postgrest["daily_bonuses"]
                .select(Columns.raw("day")) {
                    filter { eq("user_id", userId); eq("flawless_awarded", true) }
                    order("day", Order.DESCENDING)
                    limit(10)
                }
                .decodeList<DayRow>()
            if (flawlessDays.isNotEmpty()) {
                // Length of the current consecutive run from the most recent flawless day.
                var run = 1
                for (i in 1 until flawlessDays.size) {
                    if (isConsecutiveDays(flawlessDays[i - 1].day, flawlessDays[i].day)) run++ else break
                }
                if (run >= 3) tryUnlock("flawless_streak")
                if (run >= 5) tryUnlock("flawless_streak_5")
            }
        }

        // Gold Rush (50 gold) / Diamond Hands (100 gold)
        if ("gold_rush" !in alreadyUnlocked || "diamond_hands" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("gold_medals")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<GoldMedalsRow>()
            if (profile != null) {
                if (profile.goldMedals >= 50) tryUnlock("gold_rush")
                if (profile.goldMedals >= 100) tryUnlock("diamond_hands")
            }
        }

        // Unbreakable (25-win streak)
        if (won && "unbreakable" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("current_streak, best_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<WinStreaksRow>()
            if (profile != null && (profile.currentStreak >= 25 || profile.bestStreak >= 25)) tryUnlock("unbreakable")
        }

        // The Natural (10 wins under 30 seconds)
        if (won && timeSeconds < 30 && "the_natural" !in alreadyUnlocked) {
            val count = client.postgrest["daily_results"]
                .select(Columns.raw("id")) {
                    count(Count.EXACT); limit(1)
                    filter {
                        eq("user_id", userId); eq("completed", true)
                        lt("time_seconds", 30); gt("boards_solved", 0)
                    }
                }
                .countOrNull() ?: 0L
            if (count >= 10) tryUnlock("the_natural")
        }

        // Wordsmith (500 wins)
        if (won && "wordsmith" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("total_wins")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<TotalWinsRow>()
            if (profile != null && profile.totalWins >= 500) tryUnlock("wordsmith")
        }

        // Endurance (1000 total games)
        if ("endurance" !in alreadyUnlocked) {
            val allStats = client.postgrest["user_stats"]
                .select(Columns.raw("total_games")) { filter { eq("user_id", userId) } }
                .decodeList<TotalGamesRow>()
            val total = allStats.sumOf { it.totalGames ?: 0 }
            if (total >= 1000) tryUnlock("endurance")
        }

        // Marathon Runner (5 hours / 18000 seconds of total playtime)
        if ("marathon_runner" !in alreadyUnlocked && isDaily) {
            val timeResults = client.postgrest["daily_results"]
                .select(Columns.raw("time_seconds")) {
                    filter { eq("user_id", userId); eq("completed", true) }
                }
                .decodeList<TimeSecondsRow>()
            val totalSec = timeResults.sumOf { it.timeSeconds ?: 0 }
            if (totalSec >= 18000) tryUnlock("marathon_runner")
        }

        // Linguist (Classic + Six + Seven daily wins in same day)
        if (gameMode in listOf("DUEL", "DUEL_6", "DUEL_7") && won && isDaily && "linguist" !in alreadyUnlocked) {
            val today = todayLocalDate()
            val langModes = client.postgrest["daily_results"]
                .select(Columns.raw("game_mode")) {
                    filter {
                        eq("user_id", userId); eq("day", today); eq("completed", true)
                        isIn("game_mode", listOf("DUEL", "DUEL_6", "DUEL_7"))
                    }
                }
                .decodeList<ModeRow>()
                .map { it.gameMode }
                .toSet()
            if ("DUEL" in langModes && "DUEL_6" in langModes && "DUEL_7" in langModes) tryUnlock("linguist")
        }

        // Streak Master (50-day login streak)
        if ("streak_master" !in alreadyUnlocked) {
            val profile = client.postgrest["profiles"]
                .select(Columns.raw("daily_login_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<LoginStreakRow>()
            if (profile != null && profile.dailyLoginStreak >= 50) tryUnlock("streak_master")
        }

        // ─── Pure ladder ────────────────────────────────────────────
        // Hintless wins per mode, queried from `matches` so both daily and
        // practice games count. Only fires after a hintless win in one of
        // the three hint-bearing modes.
        val pureModes = listOf("DUEL_6", "DUEL_7", "PROPERNOUNDLE")
        if (won && hintsUsed == 0 && gameMode in pureModes) {
            val slug = when (gameMode) {
                "DUEL_6" -> "six"
                "DUEL_7" -> "seven"
                else -> "proper"
            }
            fun tierKey(tier: String) = "pure_${slug}_$tier"
            val keys = listOf("initiate", "adept", "master").map { tierKey(it) }
            val anyPerModeLeft = keys.any { it !in alreadyUnlocked }
            val playerLeft = "pure_player" !in alreadyUnlocked

            if (anyPerModeLeft || playerLeft) {
                // Per-mode count: hintless solo wins in this specific mode.
                val modeCount = client.postgrest["matches"]
                    .select(Columns.raw("id")) {
                        count(Count.EXACT); limit(1)
                        filter {
                            eq("player1_id", userId)
                            exact("player2_id", null)
                            eq("winner_id", userId)
                            eq("game_mode", gameMode)
                            eq("hints_used", 0)
                        }
                    }
                    .countOrNull() ?: 0L
                if (modeCount >= 1) tryUnlock(tierKey("initiate"))
                if (modeCount >= 10) tryUnlock(tierKey("adept"))
                if (modeCount >= 50) tryUnlock(tierKey("master"))

                // Cross-mode capstone: 50 hintless solo wins across all three modes.
                if (playerLeft) {
                    val allCount = client.postgrest["matches"]
                        .select(Columns.raw("id")) {
                            count(Count.EXACT); limit(1)
                            filter {
                                eq("player1_id", userId)
                                exact("player2_id", null)
                                eq("winner_id", userId)
                                isIn("game_mode", pureModes)
                                eq("hints_used", 0)
                            }
                        }
                        .countOrNull() ?: 0L
                    if (allCount >= 50) tryUnlock("pure_player")
                }
            }
        }

        // Daily Regular (100 different days with dailies)
        if ("daily_regular" !in alreadyUnlocked && isDaily) {
            val distinctDays = client.postgrest["daily_results"]
                .select(Columns.raw("day")) {
                    filter { eq("user_id", userId); eq("completed", true) }
                }
                .decodeList<DayRow>()
            val uniqueDays = distinctDays.map { it.day }.toSet()
            if (uniqueDays.size >= 100) tryUnlock("daily_regular")
        }

        unlocked.toList()
    }.getOrElse { emptyList() }
}
