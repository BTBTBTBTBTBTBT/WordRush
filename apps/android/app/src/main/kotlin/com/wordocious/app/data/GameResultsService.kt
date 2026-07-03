package com.wordocious.app.data

import com.wordocious.core.GameMode
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Records a finished game's full progression — the Android port of iOS
 * GameResultsService (which ports the core of web lib/stats-service.ts
 * recordGameResult): a `matches` history row (powers the Profile charts),
 * the `user_stats` aggregate (wins/losses/games/best/avg/fastest), and the
 * `profiles` XP + level + win-streak + daily-login-streak (+ 7-day shield grant).
 *
 * For daily seeds this also records the daily_results row FIRST (idempotent
 * best-score upsert; PostGameScreen's later call is a harmless no-op), then
 * awards streak/perfect medals and the one-shot Daily Sweep (+200) / Flawless
 * Victory (+400) bonuses via MedalService — matching web stats-service ordering
 * (recordDailyResult → awardDailyBonusesIfComplete) so the 9th completion of
 * the day sees all 9 rows.
 *
 * Call EXACTLY ONCE per live finish (gated in GameScreen on
 * isFinished && !wasFinishedOnEntry) — `matches` inserts and the wins/xp deltas
 * are NOT idempotent.
 */
object GameResultsService {
    private val client get() = SupabaseConfig.client

    /** A daily seed is `daily-<date>-<mode>` (core generateDailySeed). */
    private fun isDailySeed(seed: String) = seed.startsWith("daily-")

    // ── XP result (drives the post-game toast) ───────────────────────────────────
    data class XpResult(
        val xpGain: Int,
        val streakBonus: Int,
        val dailyBonus: Int,
        val totalXp: Int,
        val newLevel: Int,
        val leveledUp: Boolean,
        val sweepBonus: Int = 0,
        val flawlessBonus: Int = 0,
    )

    // ── matches insert (solo: player2_id = null) ─────────────────────────────────
    @Serializable
    private data class SoloMatchInsert(
        @SerialName("game_mode") val gameMode: String,
        @SerialName("player1_id") val player1Id: String,
        @SerialName("winner_id") val winnerId: String?,    // null on a loss
        @SerialName("player1_score") val player1Score: Int, // guess count → distribution bucket
        @SerialName("player1_time") val player1Time: Int,    // seconds
        val seed: String,
        val solutions: List<String>,
        @SerialName("player1_guesses") val player1Guesses: List<String>,
        @SerialName("hints_used") val hintsUsed: Int,
        @SerialName("started_at") val startedAt: String,
        @SerialName("completed_at") val completedAt: String,
    )

    /** Insert a solo match-history row so this game feeds the Profile charts. */
    private suspend fun recordSoloMatch(
        gameMode: GameMode, won: Boolean, score: Int, timeSeconds: Int,
        seed: String, solutions: List<String>, guesses: List<String>, hintsUsed: Int,
    ) {
        val uid = AuthService.userId ?: return
        val now = Instant.now()
        runCatching {
            client.postgrest["matches"].insert(
                SoloMatchInsert(
                    gameMode = gameMode.name, player1Id = uid,
                    winnerId = if (won) uid else null, player1Score = score, player1Time = timeSeconds,
                    seed = seed, solutions = solutions, player1Guesses = guesses, hintsUsed = hintsUsed,
                    startedAt = now.minusSeconds(timeSeconds.toLong()).toString(),
                    completedAt = now.toString(),
                )
            )
        }
    }

    // ── Gauntlet per-stage breakdown (iOS/web parity) ─────────────────────────────
    /** Persist the Gauntlet stage-by-stage breakdown onto the matches row so the
     *  results screen can render cross-device (web ↔ iOS ↔ Android). Written as a
     *  best-effort UPDATE after the row exists (record() awaits the insert first);
     *  if the `gauntlet_stages` column isn't migrated this silently no-ops and the
     *  match row is unaffected. Mirrors iOS GameResultsService.recordGauntletStages
     *  + web recordGauntletStages — same JSON shape (UPPERCASE enums / camelCase). */
    @Serializable
    private data class GauntletStagesPayload(
        val stages: List<com.wordocious.core.GauntletStageConfig>,
        val stageResults: List<com.wordocious.core.GauntletStageResult>,
    )
    @Serializable
    private data class GauntletStagesUpdate(
        @SerialName("gauntlet_stages") val gauntletStages: GauntletStagesPayload,
    )

    suspend fun recordGauntletStages(
        seed: String,
        stages: List<com.wordocious.core.GauntletStageConfig>,
        stageResults: List<com.wordocious.core.GauntletStageResult>,
    ) {
        val uid = AuthService.userId ?: return
        runCatching {
            client.postgrest["matches"].update(GauntletStagesUpdate(GauntletStagesPayload(stages, stageResults))) {
                filter { eq("player1_id", uid); eq("game_mode", "GAUNTLET"); eq("seed", seed) }
            }
        }
    }

    /** The persisted Gauntlet per-stage breakdown, read back for cross-device
     *  review (re-opening a Gauntlet daily played on another device / reinstall).
     *  Mirrors iOS MatchStatsService.gauntletStages. Each GauntletStageResult
     *  carries its boardsSnapshot, so the whole run rebuilds without the guesses. */
    @Serializable
    data class GauntletStagesData(
        val stages: List<com.wordocious.core.GauntletStageConfig> = emptyList(),
        val stageResults: List<com.wordocious.core.GauntletStageResult> = emptyList(),
    )
    @Serializable
    private data class GauntletStagesRow(
        @SerialName("gauntlet_stages") val gauntletStages: GauntletStagesData? = null,
    )

    suspend fun fetchGauntletStages(seed: String): GauntletStagesData? {
        val uid = AuthService.userId ?: return null
        return runCatching {
            client.postgrest["matches"]
                .select(Columns.raw("gauntlet_stages")) {
                    filter { eq("player1_id", uid); eq("game_mode", "GAUNTLET"); eq("seed", seed) }
                    order("created_at", Order.DESCENDING); limit(1)
                }
                .decodeList<GauntletStagesRow>().firstOrNull()?.gauntletStages
        }.getOrNull()
    }

    // ── Cross-device "view solved daily" (iOS parity) ─────────────────────────────
    /** The recorded guess progression of a finished daily — fetched when a daily
     *  was completed on ANOTHER device (or local state was lost) so GameScreen can
     *  replay it through the engine instead of presenting a fresh board. */
    @Serializable
    data class RecordedDailyMatch(
        @SerialName("player1_guesses") val player1Guesses: List<String> = emptyList(),
        @SerialName("player1_time") val player1Time: Int = 0,
        @SerialName("winner_id") val winnerId: String? = null,
    )

    // ── G6: session prefetch of recorded daily matches ────────────────────────────
    // When DailyCompletionsService learns a daily was already played today (e.g.
    // on another device), it warms the recorded matches row here so GameScreen's
    // replay path finds it instantly instead of showing an empty board for the
    // 200-500ms network fetch. Pure cache: GameScreen falls back to the network
    // fetch unchanged on a miss, and a recorded daily row never changes for a
    // given seed (one play per day), so serving the cached copy is exact.
    private val prefetchedMatches = java.util.concurrent.ConcurrentHashMap<String, RecordedDailyMatch>()
    private val prefetchRequested: MutableSet<String> =
        java.util.Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap())

    /** Cached recorded-match row for [seed], if the prefetch already landed. */
    fun prefetchedDailyMatch(seed: String): RecordedDailyMatch? = prefetchedMatches[seed]

    /** Warm the recorded-match row for [seed] (idempotent; retries on failure). */
    suspend fun prefetchRecordedDailyMatch(seed: String) {
        if (!prefetchRequested.add(seed)) return
        val row = fetchRecordedDailyMatch(seed)
        if (row != null) prefetchedMatches[seed] = row
        else prefetchRequested.remove(seed) // fetch failed/none yet — allow a later retry
    }

    /** Drop prefetched rows — called on sign-out (rows are per-user). */
    fun clearPrefetchedDailyMatches() {
        prefetchedMatches.clear()
        prefetchRequested.clear()
    }

    /** Newest `matches` row this user recorded for [seed] (null if none / signed out). */
    suspend fun fetchRecordedDailyMatch(seed: String): RecordedDailyMatch? {
        val uid = AuthService.userId ?: return null
        return runCatching {
            client.postgrest["matches"]
                .select(Columns.raw("player1_guesses,player1_time,winner_id")) {
                    filter { eq("player1_id", uid); eq("seed", seed) }
                    order("created_at", Order.DESCENDING)
                    limit(1)
                }
                .decodeList<RecordedDailyMatch>()
                .firstOrNull()
        }.getOrNull()
    }

    // ── user_stats aggregate ──────────────────────────────────────────────────────
    @Serializable
    private data class StatsRow(
        val id: String,
        val wins: Int = 0,
        val losses: Int = 0,
        @SerialName("total_games") val totalGames: Int = 0,
        @SerialName("best_score") val bestScore: Int = 0,
        @SerialName("average_time") val averageTime: Int = 0,
        @SerialName("fastest_time") val fastestTime: Int = 0,
    )

    @Serializable
    private data class StatsInsert(
        @SerialName("user_id") val userId: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("play_type") val playType: String,
        val wins: Int, val losses: Int,
        @SerialName("total_games") val totalGames: Int,
        @SerialName("best_score") val bestScore: Int,
        @SerialName("average_time") val averageTime: Int,
        @SerialName("fastest_time") val fastestTime: Int,
    )

    /** Record a CPU / bot VS result into its OWN bucket (play_type='vs_cpu').
     *  Pure practice: writes ONLY user_stats — no profiles/XP, no matches row,
     *  no daily_results, no achievements. Best-effort. */
    suspend fun recordCpuResult(gameMode: GameMode, won: Boolean, guessCount: Int, timeSeconds: Int) {
        val userId = AuthService.userId ?: return
        updateUserStats(userId, gameMode.name, "vs_cpu", won, guessCount, timeSeconds)
    }

    private suspend fun updateUserStats(
        userId: String, mode: String, playType: String, won: Boolean, guessCount: Int, timeSeconds: Int,
    ) {
        runCatching {
            val rows = client.postgrest["user_stats"]
                .select(Columns.raw("id, wins, losses, total_games, best_score, average_time, fastest_time")) {
                    filter { eq("user_id", userId); eq("game_mode", mode); eq("play_type", playType) }
                    limit(1)
                }
                .decodeList<StatsRow>()
            val s = rows.firstOrNull()
            if (s != null) {
                val newTotal = s.totalGames + 1
                val newAvg = if (s.averageTime > 0)
                    ((s.averageTime.toDouble() * s.totalGames + timeSeconds) / newTotal).roundToInt() else timeSeconds
                val newBest = if (guessCount > 0 && (s.bestScore == 0 || guessCount < s.bestScore)) guessCount else s.bestScore
                val newFastest = if (timeSeconds > 0 && (s.fastestTime == 0 || timeSeconds < s.fastestTime)) timeSeconds else s.fastestTime
                client.postgrest["user_stats"].update({
                    set("wins", s.wins + if (won) 1 else 0)
                    set("losses", s.losses + if (won) 0 else 1)
                    set("total_games", newTotal)
                    set("best_score", newBest)
                    set("average_time", newAvg)
                    set("fastest_time", newFastest)
                }) { filter { eq("id", s.id) } }
            } else {
                client.postgrest["user_stats"].insert(
                    StatsInsert(
                        userId = userId, gameMode = mode, playType = playType,
                        wins = if (won) 1 else 0, losses = if (won) 0 else 1, totalGames = 1,
                        bestScore = guessCount, averageTime = timeSeconds, fastestTime = timeSeconds,
                    )
                )
            }
        }
    }

    // ── profile progression (XP / level / streaks / shield) ───────────────────────
    @Serializable
    private data class ProgressRow(
        @SerialName("total_wins") val totalWins: Int = 0,
        @SerialName("total_losses") val totalLosses: Int = 0,
        @SerialName("current_streak") val currentStreak: Int = 0,
        @SerialName("best_streak") val bestStreak: Int = 0,
        val xp: Int = 0,
        val level: Int = 1,
        @SerialName("last_played_at") val lastPlayedAt: String? = null,
        @SerialName("daily_login_streak") val dailyLoginStreak: Int = 0,
        @SerialName("best_daily_login_streak") val bestDailyLoginStreak: Int = 0,
        @SerialName("streak_shields") val streakShields: Int = 0,
    )

    private suspend fun updateProfileProgression(userId: String, won: Boolean, seed: String): XpResult? =
        runCatching {
            val p = client.postgrest["profiles"]
                .select(Columns.raw("total_wins,total_losses,current_streak,best_streak,xp,level,last_played_at,daily_login_streak,best_daily_login_streak,streak_shields")) {
                    filter { eq("id", userId) }; limit(1)
                }
                .decodeList<ProgressRow>().firstOrNull() ?: return@runCatching null

            val newWinStreak = if (won) p.currentStreak + 1 else 0
            val newBestWinStreak = max(p.bestStreak, newWinStreak)

            val xpGain = if (won) 100 else 25
            val streakBonus = if (won && newWinStreak > 1) 50 else 0
            val dailyBonus = if (isDailySeed(seed)) 50 else 0
            val newXp = p.xp + xpGain + streakBonus + dailyBonus
            val newLevel = newXp / 1000 + 1

            // Daily-login streak (player-local days).
            val today = com.wordocious.app.todayLocalDate()
            val yesterday = com.wordocious.app.yesterdayLocalDate()
            var newDailyStreak = p.dailyLoginStreak
            var grantShield = false
            val lastDay = p.lastPlayedAt?.let { runCatching { java.time.OffsetDateTime.parse(if (it.endsWith("Z") || it.contains('+')) it else it + "Z").toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString() }.getOrNull() }
            when {
                lastDay == null -> newDailyStreak = 1
                lastDay == today -> { /* same day, no change */ }
                lastDay == yesterday -> { newDailyStreak += 1; if (newDailyStreak % 7 == 0) grantShield = true }
                else -> newDailyStreak = 1
            }
            val newBestDaily = max(p.bestDailyLoginStreak, newDailyStreak)

            client.postgrest["profiles"].update({
                set("total_wins", p.totalWins + if (won) 1 else 0)
                set("total_losses", p.totalLosses + if (won) 0 else 1)
                set("current_streak", newWinStreak)
                set("best_streak", newBestWinStreak)
                set("xp", newXp)
                set("level", newLevel)
                set("last_played_at", Instant.now().toString())
                set("daily_login_streak", newDailyStreak)
                set("best_daily_login_streak", newBestDaily)
                set("streak_shields", p.streakShields + if (grantShield) 1 else 0)
            }) { filter { eq("id", userId) } }

            XpResult(
                xpGain = xpGain, streakBonus = streakBonus, dailyBonus = dailyBonus,
                totalXp = xpGain + streakBonus + dailyBonus,
                newLevel = newLevel, leveledUp = newLevel > p.level,
            )
        }.getOrNull()

    // ── VS match-history row (player2_id set) ──────────────────────────────────────
    @Serializable
    private data class VsMatchInsert(
        @SerialName("game_mode") val gameMode: String,
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player2_id") val player2Id: String,
        @SerialName("winner_id") val winnerId: String?,    // null on a draw
        @SerialName("player1_score") val player1Score: Int,
        @SerialName("player2_score") val player2Score: Int,
        @SerialName("player1_time") val player1Time: Int,
        @SerialName("player2_time") val player2Time: Int,
        val seed: String,
        val solutions: List<String>,
        @SerialName("player1_guesses") val player1Guesses: List<String>,
        @SerialName("player2_guesses") val player2Guesses: List<String>?,
        @SerialName("started_at") val startedAt: String,
        @SerialName("completed_at") val completedAt: String,
        val forfeit: Boolean = false,
    )

    /**
     * Insert the VS match-history row so the battle shows in Recent Matches —
     * ports iOS recordVsMatch / web vs-game recordMatch. Called by ONLY the
     * server-designated writer (recordMatch=player1) so exactly one shared row
     * exists per match. Solutions + both players' guess words are recorded
     * (web row shape, stats-service recordMatch): the writer's own guesses
     * from the finished game state, the opponent's from the match_ended
     * payload's opponentGuessLog.
     */
    suspend fun recordVsMatch(
        gameMode: GameMode, opponentId: String, won: Boolean, isDraw: Boolean,
        playerGuesses: Int, opponentGuesses: Int, playerTimeSec: Int, opponentTimeSec: Int, seed: String,
        solutions: List<String> = emptyList(),
        player1Guesses: List<String> = emptyList(),
        player2Guesses: List<String>? = null,
        forfeit: Boolean = false,
    ) {
        val uid = AuthService.userId ?: return
        val winnerId: String? = if (isDraw) null else if (won) uid else opponentId
        val now = Instant.now()
        runCatching {
            client.postgrest["matches"].insert(
                VsMatchInsert(
                    gameMode = gameMode.name, player1Id = uid, player2Id = opponentId,
                    winnerId = winnerId, player1Score = playerGuesses, player2Score = opponentGuesses,
                    player1Time = playerTimeSec, player2Time = opponentTimeSec,
                    seed = seed, solutions = solutions, player1Guesses = player1Guesses,
                    player2Guesses = player2Guesses,
                    startedAt = now.minusSeconds(playerTimeSec.toLong()).toString(),
                    completedAt = now.toString(),
                    forfeit = forfeit,
                )
            )
        }
    }

    /**
     * Record a finished solo game: user_stats + matches + profile progression.
     * Returns the [XpResult] that drives the post-game XP toast (null on failure).
     */
    suspend fun record(
        gameMode: GameMode,
        won: Boolean,
        guessCount: Int,
        timeSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        seed: String,
        solutions: List<String>,
        guesses: List<String>,
        hintsUsed: Int = 0,
        playType: String = "solo",
        stagesCompleted: Int? = null,
        bestCorrectLetters: Int? = null,
    ): XpResult? {
        val userId = AuthService.userId ?: return null
        // The first three writes touch DISJOINT tables and never read each
        // other's output — user_stats (read-modify-write user_stats),
        // matches (pure insert), profiles progression (read-modify-write
        // profiles) — so they run concurrently instead of as three serial
        // round-trips. Everything BELOW the join reads what these wrote
        // (streak medals read profiles.daily_login_streak; records/
        // achievements read the fresh totals) and must stay after.
        var xp = coroutineScope {
            val statsJob = async { updateUserStats(userId, gameMode.name, playType, won, guessCount, timeSeconds) }
            // Solo games only: VS matches get their single shared row via
            // recordVsMatch (designated writer) — writing a player2_id=null row
            // here too polluted Recent Matches/charts with phantom solo games.
            val matchJob = if (playType == "solo") async {
                recordSoloMatch(gameMode, won, guessCount, timeSeconds, seed, solutions, guesses, hintsUsed)
            } else null
            val xpJob = async { updateProfileProgression(userId, won, seed) }
            statsJob.await()
            matchJob?.await()
            xpJob.await()
        }

        // Daily extras — web stats-service ordering: daily row first, then
        // medals + the one-shot sweep/flawless bonuses (all idempotent).
        if (isDailySeed(seed) && playType == "solo") {
            val today = com.wordocious.app.todayLocalDate()
            coroutineScope {
                // Independent of each other: daily_results row ∥ streak medals
                // (read profiles — written above, before this scope) ∥ perfect
                // medal (own idempotent medals row). The sweep/flawless check
                // below READS today's daily_results, so it stays after the join.
                val dailyJob = async {
                    DailyResultsService.recordDailyResult(
                        mode = gameMode, completed = won, guessCount = guessCount,
                        elapsedSeconds = timeSeconds, boardsSolved = boardsSolved,
                        totalBoards = totalBoards, hintsUsed = hintsUsed, seed = seed,
                        stagesCompleted = stagesCompleted, bestCorrectLetters = bestCorrectLetters,
                    )
                }
                val streakJob = async { MedalService.awardStreakMedals(userId, today) }
                val perfectJob = async {
                    MedalService.awardPerfectMedal(
                        userId, gameMode.name, today,
                        guessCount = guessCount, boardsSolved = boardsSolved,
                        totalBoards = totalBoards, completed = won,
                    )
                }
                dailyJob.await(); streakJob.await(); perfectJob.await()
            }
            val (sweep, flawless) = MedalService.awardDailyBonusesIfComplete(userId)
            if (sweep + flawless > 0) {
                xp = xp?.let {
                    val newTotal = it.totalXp + sweep + flawless
                    it.copy(
                        totalXp = newTotal,
                        sweepBonus = sweep,
                        flawlessBonus = flawless,
                    )
                } ?: XpResult(
                    xpGain = 0, streakBonus = 0, dailyBonus = 0,
                    totalXp = sweep + flawless, newLevel = 1, leveledUp = false,
                    sweepBonus = sweep, flawlessBonus = flawless,
                )
            }
        }

        // Refresh in-memory profile so XP/streak/level reflect immediately on Profile/Home.
        AuthService.refreshProfile()

        // All-time "hall of records" writes (web stats-service.ts parity —
        // previously deferred). Run AFTER stats/profile updates so the fresh
        // totals (total_games, best_streak, xp, gold_medals) read back. Never throws.
        runCatching {
            RecordsService.updateAfterGame(
                userId, gameMode.name, playType, won, guessCount, timeSeconds, seed,
            )
        }

        // Achievement unlock detection — matches web stats-service.ts calling
        // checkAchievements after recordGameResult. Never throws.
        runCatching {
            AchievementService.checkAchievements(
                userId, gameMode.name, playType, won, guessCount, timeSeconds, seed, hintsUsed,
            )
        }
        return xp
    }
}
