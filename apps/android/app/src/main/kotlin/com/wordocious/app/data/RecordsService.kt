package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Count
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant

/**
 * Writes the all-time "hall of records" rows — the Android port of iOS
 * RecordsService.updateAfterGame / web lib/stats-service.ts record checks
 * (previously deferred on native, bible §7). Best-effort: every failure is
 * swallowed so a post-game flow never breaks on a record write.
 *
 * The read path (fetchAllTimeRecords, powering RecordsScreen) lives in
 * LeaderboardService; this object only writes.
 */
object RecordsService {
    private val client get() = SupabaseConfig.client

    private fun isDailySeed(seed: String) = seed.startsWith("daily-")

    @Serializable
    private data class RecordRow(
        val id: String,
        @SerialName("record_value") val recordValue: Double = 0.0,
        @SerialName("holder_id") val holderId: String,
    )

    @Serializable
    private data class RecordInsert(
        @SerialName("record_type") val recordType: String,
        @SerialName("game_mode") val gameMode: String?,
        @SerialName("play_type") val playType: String?,
        @SerialName("holder_id") val holderId: String,
        @SerialName("record_value") val recordValue: Double,
        @SerialName("achieved_at") val achievedAt: String,
        @SerialName("updated_at") val updatedAt: String,
    )

    /**
     * Compare a challenger value against the best existing record for
     * (recordType, gameMode, playType) and update the canonical row / insert the
     * first one. Fetch-then-update-by-id (like web `checkAndUpdateRecord`) so the
     * NULL-unique global keys never accumulate duplicate rows.
     */
    private suspend fun checkAndUpdateRecord(
        recordType: String, gameMode: String?, playType: String?,
        holderId: String, newValue: Int, higherIsBetter: Boolean = true,
    ) {
        runCatching {
            val rows = client.postgrest["all_time_records"]
                .select(Columns.raw("id,record_value,holder_id")) {
                    filter {
                        eq("record_type", recordType)
                        if (gameMode != null) eq("game_mode", gameMode) else exact("game_mode", null)
                        if (playType != null) eq("play_type", playType) else exact("play_type", null)
                    }
                    order("record_value", if (higherIsBetter) Order.DESCENDING else Order.ASCENDING)
                }
                .decodeList<RecordRow>()
            val best = rows.firstOrNull()
            val nv = newValue.toDouble()
            val challengerWins = when {
                best == null -> true
                higherIsBetter -> nv > best.recordValue
                else -> nv < best.recordValue
            }
            val winnerValue = if (challengerWins) nv else best!!.recordValue
            val winnerHolder = if (challengerWins) holderId else best!!.holderId
            val now = Instant.now().toString()
            if (best != null) {
                client.postgrest["all_time_records"].update({
                    set("holder_id", winnerHolder)
                    set("record_value", winnerValue)
                    set("updated_at", now)
                    if (challengerWins) set("achieved_at", now)
                }) { filter { eq("id", best.id) } }
            } else {
                client.postgrest["all_time_records"].insert(
                    RecordInsert(
                        recordType = recordType, gameMode = gameMode, playType = playType,
                        holderId = winnerHolder, recordValue = winnerValue,
                        achievedAt = now, updatedAt = now,
                    )
                )
            }
        }
    }

    @Serializable
    private data class MatchWinnerRow(@SerialName("winner_id") val winnerId: String? = null)

    /** Best consecutive-win streak for one mode, from the newest 200 matches
     *  (web stats-service.ts fetchModeWinStreak — same walk / limit / ordering). */
    private suspend fun fetchModeBestWinStreak(userId: String, gameMode: String): Int = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("winner_id")) {
                filter {
                    or { eq("player1_id", userId); eq("player2_id", userId) }
                    eq("game_mode", gameMode)
                }
                order("created_at", Order.DESCENDING)
                limit(200)
            }
            .decodeList<MatchWinnerRow>()
        var best = 0
        var streak = 0
        for (r in rows) {
            if (r.winnerId == userId) { streak++; best = maxOf(best, streak) } else streak = 0
        }
        best
    }.getOrDefault(0)

    @Serializable
    private data class TotalGamesRow(@SerialName("total_games") val totalGames: Int = 0)

    @Serializable
    private data class ProfileStatsRow(
        @SerialName("best_streak") val bestStreak: Int = 0,
        val xp: Int = 0,
        @SerialName("gold_medals") val goldMedals: Int = 0,
    )

    /**
     * Run every post-game record check (web stats-service.ts parity). Call AFTER
     * user_stats / profiles are updated so the fresh totals read back correctly.
     */
    suspend fun updateAfterGame(
        userId: String, gameMode: String, playType: String,
        won: Boolean, guessCount: Int, timeSeconds: Int, seed: String,
    ) {
        if (won && timeSeconds > 0) {
            checkAndUpdateRecord("fastest_win", gameMode, playType, userId, timeSeconds, higherIsBetter = false)
        }
        if (won && guessCount > 0) {
            checkAndUpdateRecord("fewest_guesses", gameMode, playType, userId, guessCount, higherIsBetter = false)
        }

        val totalGames = runCatching {
            client.postgrest["user_stats"]
                .select(Columns.raw("total_games")) {
                    filter { eq("user_id", userId); eq("game_mode", gameMode); eq("play_type", playType) }
                    limit(1)
                }
                .decodeList<TotalGamesRow>().firstOrNull()?.totalGames ?: 0
        }.getOrDefault(0)
        if (totalGames > 0) {
            checkAndUpdateRecord("most_games_played", gameMode, playType, userId, totalGames)
        }

        val profile = runCatching {
            client.postgrest["profiles"]
                .select(Columns.raw("best_streak,xp,gold_medals")) {
                    filter { eq("id", userId) }; limit(1)
                }
                .decodeList<ProfileStatsRow>().firstOrNull()
        }.getOrNull()
        if (profile != null) {
            if (profile.bestStreak > 0) {
                checkAndUpdateRecord("longest_streak", null, null, userId, profile.bestStreak)
            }
            checkAndUpdateRecord("highest_level", null, null, userId, profile.xp / 1000 + 1)
            if (profile.goldMedals > 0) {
                checkAndUpdateRecord("most_gold_medals", null, null, userId, profile.goldMedals)
            }
        }

        // Per-mode longest win streak — walk this mode's match history (web
        // stats-service.ts fetchModeWinStreak parity). Only on a win, keyed
        // (longest_streak, gameMode, playType).
        if (won) {
            val best = fetchModeBestWinStreak(userId, gameMode)
            if (best > 0) {
                checkAndUpdateRecord("longest_streak", gameMode, playType, userId, best)
            }
        }

        if (isDailySeed(seed)) {
            val completions = runCatching {
                client.postgrest["daily_results"]
                    .select(Columns.raw("user_id")) {
                        count(Count.EXACT); limit(1)
                        filter { eq("user_id", userId); eq("completed", true) }
                    }
                    .countOrNull()?.toInt() ?: 0
            }.getOrDefault(0)
            if (completions > 0) {
                checkAndUpdateRecord("most_daily_completions", null, null, userId, completions)
            }
        }
    }
}
