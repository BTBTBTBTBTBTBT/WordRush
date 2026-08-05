package com.wordocious.app.data

import android.content.Context
import android.content.SharedPreferences
import com.wordocious.core.GameMode
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Crash/offline protection for solo result recording — the Android port of web
 * stats-service.ts's pending-record queue (drainPendingRecords) and iOS
 * PendingRecords.swift. Closes the wave-3 audit backlog item "systemic
 * lost-result risk": the terminal game state persisted locally but the network
 * record was fire-and-forget, so a finish in a dead spot silently lost the
 * result (and streak/XP credit) forever.
 *
 * Android's GameResultsService.record() funnels EVERYTHING (user_stats,
 * matches row, profile progression, daily extras) through one call, but the
 * three primary writes hit disjoint tables and fail INDEPENDENTLY, so one
 * done-flag for the lot was wrong in both directions:
 *  - it could re-run a write that had already landed. When user_stats
 *    succeeded but matches and profiles both failed, the whole payload
 *    survived, drain() found no matches row and replayed record() in full —
 *    total_games +2, wins +2 and a permanently skewed average_time for one
 *    game actually played.
 *  - it could discard a write that had never run. A matches row on the server
 *    cleared the key outright, so a game whose progression half had failed
 *    lost its XP, level, win streak and daily-login streak for good.
 * Hence a flag per part (stats / match / xp). Semantics otherwise mirror
 * web/iOS:
 * - persisted BEFORE any network write, keyed by mode+seed
 * - each part marks itself done as it lands; the key goes when all three are
 * - drain() re-runs ONLY the parts still outstanding. It checks the server for
 *   a matches row too, but that settles the match part alone (it is what stops
 *   match history duplicating) — it is not evidence about the other two.
 * - solo only (VS is server-coordinated; CPU games are untracked practice)
 * - payloads older than 7 days are dropped; other accounts' payloads are left
 */
object PendingRecords {
    private const val PREFS = "wordocious_pending_records"
    private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    @Serializable
    data class Payload(
        val userId: String,
        val gameModeName: String,
        val seed: String,
        val savedAt: Long,
        val won: Boolean,
        val guessCount: Int,
        val timeSeconds: Int,
        val boardsSolved: Int,
        val totalBoards: Int,
        val solutions: List<String>,
        val guesses: List<String>,
        val hintsUsed: Int,
        val stagesCompleted: Int? = null,
        val bestCorrectLetters: Int? = null,
        /** user_stats aggregate landed (wins/losses/games/best/avg/fastest). */
        val statsDone: Boolean = false,
        /** `matches` history row landed. */
        val matchDone: Boolean = false,
        /** profiles progression landed (XP, level, win + daily-login streak). */
        val xpDone: Boolean = false,
        /** daily_results row landed (daily seeds only — the leaderboard row).
         *  This was the UNTRACKED fourth write: it runs AFTER the three parts
         *  above are flagged, so a cut (leave the post-game mid-flight, kill,
         *  offline blip) lost it while drain() saw "all done" and released the
         *  payload — Doug's DUEL daily showed completed locally with no
         *  leaderboard row and nothing left to retry. Old payloads decode as
         *  false and simply replay the (idempotent, best-score-upsert) write. */
        val dailyDone: Boolean = false,
    )

    enum class Part { STATS, MATCH, XP, DAILY }

    /** Every tracked write landed. The DAILY part only applies to daily seeds —
     *  an unlimited game writes no daily_results row and must not be held
     *  hostage by a flag nothing will ever set. */
    private fun Payload.allDone(): Boolean =
        statsDone && matchDone && xpDone && (dailyDone || !seed.startsWith("daily-"))

    private fun key(gameModeName: String, seed: String) = "$gameModeName-$seed"

    /** Current payload for this game, if one is outstanding. */
    fun read(gameModeName: String, seed: String): Payload? {
        val raw = prefs?.getString(key(gameModeName, seed), null) ?: return null
        return runCatching { json.decodeFromString<Payload>(raw) }.getOrNull()
    }

    /**
     * Persist the record args BEFORE the network flow (solo only). MERGES onto
     * an existing payload rather than replacing it: drain() replays through
     * record(), which registers again, and a blind overwrite would reset the
     * done-flags and re-run writes that had already landed.
     */
    fun register(payload: Payload) {
        val p = prefs ?: return
        val existing = read(payload.gameModeName, payload.seed)
        val merged = if (existing == null) payload else payload.copy(
            savedAt = existing.savedAt,
            statsDone = existing.statsDone,
            matchDone = existing.matchDone,
            xpDone = existing.xpDone,
            dailyDone = existing.dailyDone,
        )
        runCatching {
            p.edit().putString(key(payload.gameModeName, payload.seed), json.encodeToString(merged)).apply()
        }
    }

    /**
     * Flag one part done, the moment it lands. Deliberately does NOT drop the
     * key even when that was the last part — releasing the payload is
     * [settle]'s job, and it happens further down record(), after the daily
     * row, the medals and the sweep bonus. Flagging and releasing were the same
     * act before, so the payload was gone before those later writes ran and a
     * blip between them lost the leaderboard row, the medal and the sweep bonus
     * with nothing left to retry them (web does it in this order).
     */
    fun markDone(gameModeName: String, seed: String, part: Part) {
        val p = prefs ?: return
        val current = read(gameModeName, seed) ?: return
        val next = when (part) {
            Part.STATS -> current.copy(statsDone = true)
            Part.MATCH -> current.copy(matchDone = true)
            Part.XP -> current.copy(xpDone = true)
            Part.DAILY -> current.copy(dailyDone = true)
        }
        runCatching {
            p.edit().putString(key(gameModeName, seed), json.encodeToString(next)).apply()
        }
    }

    /** Release the payload once every part has landed. No-op while any is outstanding. */
    fun settle(gameModeName: String, seed: String) {
        val current = read(gameModeName, seed) ?: return
        if (current.allDone()) clear(gameModeName, seed)
    }

    /** Drop the payload outright. */
    fun clear(gameModeName: String, seed: String) {
        prefs?.edit()?.remove(key(gameModeName, seed))?.apply()
    }

    @Serializable
    private data class IdRow(@SerialName("id") val id: String)

    private var draining = false

    /**
     * Re-fire any solo results whose record flow was cut off. Call once per
     * launch after auth is ready. Idempotent; no-ops when signed out.
     */
    suspend fun drain() {
        if (draining) return
        draining = true
        try {
            val p = prefs ?: return
            // AuthService.userId reads the PROFILE row, which needs a network
            // fetch that may never have completed this launch. Fall back to the
            // locally-stored session user, or a drain would no-op for exactly
            // the stranded sessions whose results are sitting in this queue.
            val userId = AuthService.userId
                ?: runCatching { SupabaseConfig.client.auth.currentUserOrNull()?.id }.getOrNull()
                ?: return
            val all = runCatching { p.all }.getOrNull() ?: return
            val now = System.currentTimeMillis()
            for ((k, v) in all) {
                // (Plain if/continue rather than `?: run { …; continue }` — a
                // non-local continue in an inline lambda is experimental in
                // Kotlin 2.0.x and fails compileDebugKotlin.)
                val raw = v as? String
                if (raw == null) { p.edit().remove(k).apply(); continue }
                val payload = runCatching { json.decodeFromString<Payload>(raw) }.getOrNull()
                if (payload == null) { p.edit().remove(k).apply(); continue }
                // Too stale to be meaningful — drop regardless of owner.
                if (now - payload.savedAt > MAX_AGE_MS) { p.edit().remove(k).apply(); continue }
                // Another account's pending result — leave it for that account.
                if (!payload.userId.equals(userId, ignoreCase = true)) continue
                val mode = runCatching { GameMode.valueOf(payload.gameModeName) }.getOrNull()
                if (mode == null) { p.edit().remove(k).apply(); continue }
                // Every part landed (incl. the daily row for daily seeds), only
                // the release didn't (killed between the last write and
                // settle()) — nothing to replay. The old three-part check here
                // is what deleted Doug's payload with the daily_results row
                // still unwritten.
                if (payload.allDone()) {
                    p.edit().remove(k).apply(); continue
                }

                // Dedupe, per part. A matches row for this seed+mode proves the
                // MATCH write landed and nothing else — the user_stats and
                // profiles writes fail independently of it. Clearing the key on
                // its presence deleted the XP, level, win streak and
                // daily-login streak of any game whose progression half had
                // failed, unrecoverably.
                val existing = runCatching {
                    SupabaseConfig.client.postgrest["matches"].select {
                        filter {
                            eq("player1_id", userId)
                            eq("seed", payload.seed)
                            eq("game_mode", payload.gameModeName)
                        }
                        limit(1)
                    }.decodeList<IdRow>()
                }.getOrNull() ?: continue // can't verify (offline?) — retry later
                if (existing.isNotEmpty() && !payload.matchDone) {
                    markDone(payload.gameModeName, payload.seed, Part.MATCH)
                }

                // Re-run whatever is still outstanding. record() re-registers
                // (merging the flags forward), skips the parts already done and
                // marks each remaining one as it lands, so a failure here simply
                // leaves the rest of the payload for the next launch.
                GameResultsService.record(
                    gameMode = mode, won = payload.won, guessCount = payload.guessCount,
                    timeSeconds = payload.timeSeconds, boardsSolved = payload.boardsSolved,
                    totalBoards = payload.totalBoards, seed = payload.seed,
                    solutions = payload.solutions, guesses = payload.guesses,
                    hintsUsed = payload.hintsUsed, playType = "solo",
                    stagesCompleted = payload.stagesCompleted,
                    bestCorrectLetters = payload.bestCorrectLetters,
                )
            }
        } finally {
            draining = false
        }
    }
}
