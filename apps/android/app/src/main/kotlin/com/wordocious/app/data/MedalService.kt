package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Client-side medal + daily-bonus awarding — Android port of the web
 * lib/daily-service.ts trio (checkAndAwardStreakMedals, checkAndAwardPerfectMedal,
 * awardDailyBonusesIfComplete) and iOS MedalService.swift. Daily podium medals
 * (gold/silver/bronze) stay server-cron — never awarded client-side.
 *
 * All writes are idempotent: streak medals are once-ever per milestone, perfect
 * medals once per day+mode, and the sweep/flawless bonuses upsert a one-shot
 * `daily_bonuses` row keyed (user_id, day).
 */
object MedalService {
    private val client get() = SupabaseConfig.client

    private const val DAILY_MODE_COUNT = 9
    private const val DAILY_SWEEP_XP = 200
    private const val FLAWLESS_EXTRA_XP = 400

    @Serializable
    private data class MedalInsert(
        @SerialName("user_id") val userId: String,
        val day: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("play_type") val playType: String = "solo",
        @SerialName("medal_type") val medalType: String,
        @SerialName("composite_score") val compositeScore: Int,
    )

    @Serializable
    private data class IdRow(val id: String)

    @Serializable
    private data class StreakRow(@SerialName("daily_login_streak") val streak: Int = 0)

    // ── Streak medals (7/30/100-day daily-login streak, once ever) ───────────────
    suspend fun awardStreakMedals(userId: String, day: String) {
        runCatching {
            val streak = client.postgrest["profiles"]
                .select(Columns.raw("daily_login_streak")) { filter { eq("id", userId) }; limit(1) }
                .decodeSingleOrNull<StreakRow>()?.streak ?: return@runCatching
            for ((days, medalType) in listOf(7 to "streak_7", 30 to "streak_30", 100 to "streak_100")) {
                if (streak < days) continue
                val existing = client.postgrest["medals"]
                    .select(Columns.raw("id")) {
                        filter { eq("user_id", userId); eq("medal_type", medalType) }; limit(1)
                    }
                    .decodeList<IdRow>()
                if (existing.isEmpty()) {
                    client.postgrest["medals"].insert(
                        MedalInsert(userId = userId, day = day, gameMode = "ALL", medalType = medalType, compositeScore = streak)
                    )
                }
            }
        }
    }

    // ── Perfect-game medal (min-guess solve, once per day+mode) ──────────────────
    suspend fun awardPerfectMedal(
        userId: String, gameMode: String, day: String,
        guessCount: Int, boardsSolved: Int, totalBoards: Int, completed: Boolean,
    ) {
        if (!completed) return
        val perfect = when (gameMode) {
            "DUEL", "PROPERNOUNDLE", "DUEL_6", "DUEL_7" -> guessCount == 1
            "QUORDLE" -> boardsSolved == 4 && guessCount <= 4
            "OCTORDLE" -> boardsSolved == 8 && guessCount <= 8
            "SEQUENCE" -> boardsSolved == 4 && guessCount <= 4
            "RESCUE" -> boardsSolved == 4 && guessCount <= 4
            "GAUNTLET" -> boardsSolved == 21
            else -> false
        }
        if (!perfect) return
        runCatching {
            val existing = client.postgrest["medals"]
                .select(Columns.raw("id")) {
                    filter {
                        eq("user_id", userId); eq("day", day)
                        eq("game_mode", gameMode); eq("medal_type", "perfect")
                    }
                    limit(1)
                }
                .decodeList<IdRow>()
            if (existing.isEmpty()) {
                client.postgrest["medals"].insert(
                    MedalInsert(userId = userId, day = day, gameMode = gameMode, medalType = "perfect", compositeScore = guessCount)
                )
            }
        }
    }

    // ── Daily Sweep (+200) / Flawless Victory (+400) ─────────────────────────────
    @Serializable
    private data class BonusRow(
        @SerialName("sweep_awarded") val sweepAwarded: Boolean = false,
        @SerialName("flawless_awarded") val flawlessAwarded: Boolean = false,
    )

    @Serializable
    private data class BonusUpsert(
        @SerialName("user_id") val userId: String,
        val day: String,
        @SerialName("sweep_awarded") val sweepAwarded: Boolean,
        @SerialName("flawless_awarded") val flawlessAwarded: Boolean,
        @SerialName("updated_at") val updatedAt: String,
    )

    @Serializable
    private data class CompletedRow(val completed: Boolean)

    @Serializable
    private data class XpRow(val xp: Int = 0, val level: Int = 1)

    /**
     * Award the one-shot daily bonuses if all 9 daily modes are now done.
     * Returns the NEWLY-awarded XP as (sweepXp, flawlessXp) — (200, 400),
     * (200, 0), (0, 400) or (0, 0) — so the XP toast can show distinct chips.
     */
    suspend fun awardDailyBonusesIfComplete(userId: String): Pair<Int, Int> = runCatching {
        val day = todayLocalDate()
        val existing = client.postgrest["daily_bonuses"]
            .select(Columns.raw("sweep_awarded, flawless_awarded")) {
                filter { eq("user_id", userId); eq("day", day) }; limit(1)
            }
            .decodeSingleOrNull<BonusRow>()
        val sweepAlready = existing?.sweepAwarded ?: false
        val flawlessAlready = existing?.flawlessAwarded ?: false
        if (sweepAlready && flawlessAlready) return@runCatching 0 to 0

        val results = client.postgrest["daily_results"]
            .select(Columns.raw("completed")) {
                filter { eq("user_id", userId); eq("day", day); eq("play_type", "solo") }
            }
            .decodeList<CompletedRow>()
        if (results.size < DAILY_MODE_COUNT) return@runCatching 0 to 0

        val wonAll = results.all { it.completed }
        val sweepNew = !sweepAlready
        val flawlessNew = wonAll && !flawlessAlready
        val xpBonus = (if (sweepNew) DAILY_SWEEP_XP else 0) + (if (flawlessNew) FLAWLESS_EXTRA_XP else 0)
        if (xpBonus == 0) return@runCatching 0 to 0

        client.postgrest["daily_bonuses"].upsert(
            BonusUpsert(
                userId = userId, day = day,
                sweepAwarded = sweepAlready || sweepNew,
                flawlessAwarded = flawlessAlready || flawlessNew,
                updatedAt = java.time.Instant.now().toString(),
            )
        ) { onConflict = "user_id,day" }

        // Add the bonus XP to the profile (re-read first to avoid racing the
        // progression write inside GameResultsService).
        val p = client.postgrest["profiles"]
            .select(Columns.raw("xp, level")) { filter { eq("id", userId) }; limit(1) }
            .decodeSingleOrNull<XpRow>()
        if (p != null) {
            val newXp = p.xp + xpBonus
            client.postgrest["profiles"].update({
                set("xp", newXp)
                set("level", newXp / 1000 + 1)
            }) { filter { eq("id", userId) } }
        }

        (if (sweepNew) DAILY_SWEEP_XP else 0) to (if (flawlessNew) FLAWLESS_EXTRA_XP else 0)
    }.getOrDefault(0 to 0)
}
