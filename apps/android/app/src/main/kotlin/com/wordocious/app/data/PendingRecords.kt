package com.wordocious.app.data

import android.content.Context
import android.content.SharedPreferences
import com.wordocious.core.GameMode
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
 * matches row, profile progression, daily extras) through one call, so one
 * payload per game re-runs the whole flow. Semantics mirror web/iOS:
 * - persisted BEFORE any network write, keyed by mode+seed
 * - cleared when record() reports success (profile progression landed)
 * - drain() re-runs leftovers once per launch after auth is ready, first
 *   checking the server for an existing matches row for that seed+mode — if
 *   one exists, the original flow landed and the key is cleared WITHOUT
 *   re-running (user_stats/XP can never double-increment)
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
    )

    private fun key(gameModeName: String, seed: String) = "$gameModeName-$seed"

    /** Persist the record args BEFORE the network flow (solo only). */
    fun register(payload: Payload) {
        val p = prefs ?: return
        runCatching {
            p.edit().putString(key(payload.gameModeName, payload.seed), json.encodeToString(payload)).apply()
        }
    }

    /** Clear after record() reports success. */
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
            val userId = AuthService.userId ?: return
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

                // Dedupe: an existing matches row for this seed+mode means the
                // original flow landed — clear, never re-run.
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
                if (existing.isNotEmpty()) { p.edit().remove(k).apply(); continue }

                // Re-run the full record flow. record() re-registers this key
                // and clears it on success, so a failure here simply leaves the
                // payload for the next launch.
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
