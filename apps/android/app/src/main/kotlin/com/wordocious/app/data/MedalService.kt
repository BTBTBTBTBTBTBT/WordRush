package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

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
        // Delegated to wordocious.com/api/daily/award-bonuses. The app used to
        // write the daily_bonuses row itself, but that row IS the all-time
        // sweep leaderboard (alltime_sweep_leaderboard counts rows with
        // sweep_awarded = true), so a client able to write the flag could award
        // itself sweeps for days it never played. The server recomputes the
        // award from daily_results and grants the XP.
        val day = todayLocalDate()
        val token = SupabaseConfig.client.auth.currentSessionOrNull()?.accessToken
            ?: return@runCatching 0 to 0

        val body = withContext(Dispatchers.IO) {
            val conn = (java.net.URL("https://wordocious.com/api/daily/award-bonuses")
                .openConnection() as java.net.HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                doOutput = true
                connectTimeout = 10_000
                readTimeout = 10_000
            }
            conn.outputStream.use { it.write("""{"day":"$day"}""".toByteArray()) }
            if (conn.responseCode !in 200..299) return@withContext null
            conn.inputStream.bufferedReader().use { it.readText() }
        } ?: return@runCatching 0 to 0

        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
            .parseToJsonElement(body).jsonObject
        fun flag(k: String) = json[k]?.jsonPrimitive?.booleanOrNull ?: false
        if (!flag("awarded")) return@runCatching 0 to 0

        // XP values are only used to size the toast chips; the profile XP was
        // already written by the server.
        (if (flag("sweepAwarded")) DAILY_SWEEP_XP else 0) to
            (if (flag("flawlessAwarded")) FLAWLESS_EXTRA_XP else 0)
    }.getOrDefault(0 to 0)
}
