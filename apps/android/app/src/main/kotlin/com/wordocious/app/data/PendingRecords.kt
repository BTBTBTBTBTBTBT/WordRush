package com.wordocious.app.data

import android.content.Context
import android.content.SharedPreferences
import com.wordocious.core.GameMode
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

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
        registerNetworkCallback(context.applicationContext)
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
    internal fun Payload.allDone(): Boolean = outstandingParts().isEmpty()

    /** The parts a drain would still have to (re)run. Pure — pinned by
     *  PendingRecordsDecisionTest. */
    internal fun Payload.outstandingParts(): Set<Part> = buildSet {
        if (!statsDone) add(Part.STATS)
        if (!matchDone) add(Part.MATCH)
        if (!xpDone) add(Part.XP)
        if (!dailyDone && seed.startsWith("daily-")) add(Part.DAILY)
    }

    /** What one write attempt means for its part. LANDED and REJECTED both
     *  settle the part (REJECTED = the server would refuse it forever — the
     *  plausibility floor, or a mode with no DailyScoring config — so retrying
     *  it only holds the payload hostage for 7 days); PENDING leaves it queued. */
    enum class WriteOutcome { LANDED, PENDING, REJECTED }

    /** A write's outcome from its error. ANY throwable keeps the part pending —
     *  a ktor HttpRequestTimeoutException, a SocketTimeoutException, Supabase's
     *  HttpRequestException wrapper, and a (Timeout)CancellationException alike.
     *  A timed-out request is never evidence that the write landed. */
    fun outcomeOf(error: Throwable?): WriteOutcome =
        if (error == null) WriteOutcome.LANDED else WriteOutcome.PENDING

    /** Pure flag flip behind [markDone]. */
    internal fun Payload.withPart(part: Part): Payload = when (part) {
        Part.STATS -> copy(statsDone = true)
        Part.MATCH -> copy(matchDone = true)
        Part.XP -> copy(xpDone = true)
        Part.DAILY -> copy(dailyDone = true)
    }

    /** Pure: the payload after one part's attempt. */
    internal fun Payload.after(part: Part, outcome: WriteOutcome): Payload =
        if (outcome == WriteOutcome.PENDING) this else withPart(part)

    /** The daily_results write for this result can NEVER land — refused by the
     *  §260 plausibility floor (client and DB trigger alike), or the mode has
     *  no DailyScoring config (it would score as DUEL). Such a DAILY part is
     *  settled, not retried. */
    fun dailyPermanentlyRejected(
        gameModeName: String, completed: Boolean, guessCount: Int, timeSeconds: Int, totalBoards: Int,
    ): Boolean =
        !DailyScoring.config.containsKey(gameModeName) ||
            !Plausibility.isPlausibleDailyResult(completed, guessCount, timeSeconds, totalBoards, gameModeName)

    /**
     * Today's completions implied by queued payloads — results the player
     * finished whose daily_results row has not been CONFIRMED on the server
     * (outage, kill, timeout). Home merges these in so a relaunch during an
     * outage still shows the card completed. Pure: daily seeds dealt [today],
     * this [userId], DAILY part outstanding, not permanently rejected.
     */
    fun todayCompletions(
        payloads: Collection<Payload>, userId: String, today: String,
    ): Map<String, DailyCompletionsService.Completion> {
        val out = mutableMapOf<String, DailyCompletionsService.Completion>()
        for (p in payloads) {
            if (!p.userId.equals(userId, ignoreCase = true)) continue
            if (p.dailyDone || com.wordocious.core.getDailySeedDate(p.seed) != today) continue
            if (dailyPermanentlyRejected(p.gameModeName, p.won, p.guessCount, p.timeSeconds, p.totalBoards)) continue
            val score = DailyScoring.compositeScore(
                p.gameModeName, p.won, p.guessCount, p.timeSeconds, p.boardsSolved, p.totalBoards,
                p.hintsUsed, p.stagesCompleted, p.bestCorrectLetters, today,
            )
            val c = DailyCompletionsService.Completion(p.gameModeName, p.won, p.guessCount, p.timeSeconds, score)
            val prev = out[p.gameModeName]
            if (prev == null || (!prev.completed && c.completed)) out[p.gameModeName] = c
        }
        return out
    }

    /** Merge queued completions into a server/cached map. Adds missing modes
     *  and upgrades a loss to a queued win; never downgrades a win. */
    fun mergeCompletions(
        base: Map<String, DailyCompletionsService.Completion>,
        queued: Map<String, DailyCompletionsService.Completion>,
    ): Map<String, DailyCompletionsService.Completion> {
        if (queued.isEmpty()) return base
        val merged = base.toMutableMap()
        for ((k, v) in queued) {
            val cur = merged[k]
            if (cur == null || (!cur.completed && v.completed)) merged[k] = v
        }
        return merged
    }

    /** Every decodable payload currently queued (any account). */
    fun allPayloads(): List<Payload> {
        val p = prefs ?: return emptyList()
        val all = runCatching { p.all }.getOrNull() ?: return emptyList()
        return all.values.mapNotNull { v -> (v as? String)?.let { runCatching { json.decodeFromString<Payload>(it) }.getOrNull() } }
    }

    // ── In-flight guard ───────────────────────────────────────────────────────
    // record() holds its mode+seed key here for its whole duration. A drain
    // that fires while a LIVE record call is still hung on an outage (foreground
    // return, network callback) must not replay the same game: neither run has
    // flagged STATS yet, so both would read-modify-write user_stats — a
    // permanent double count.
    private val inFlight: MutableSet<String> = ConcurrentHashMap.newKeySet()

    /** Claim [gameModeName]+[seed] for one record run; false if one is already running. */
    fun tryBeginFlight(gameModeName: String, seed: String): Boolean = inFlight.add(key(gameModeName, seed))
    fun endFlight(gameModeName: String, seed: String) { inFlight.remove(key(gameModeName, seed)) }
    fun isInFlight(gameModeName: String, seed: String): Boolean = key(gameModeName, seed) in inFlight

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
        val next = current.withPart(part)
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

    // Atomic: launch, every ON_RESUME and the network callback all call drain()
    // from IO threads; a plain var let two drains replay the same payload.
    private val draining = AtomicBoolean(false)

    private val drainScope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO
    )
    @Volatile private var drainRequest: kotlinx.coroutines.Job? = null

    /** Debounced drain trigger (network regained, foreground). Coalesces a burst
     *  of callbacks into one drain [delayMs] after the first request. */
    fun requestDrain(delayMs: Long = 2_000) {
        // A request already waiting covers this one. (Never cancel it: once its
        // delay is over it IS the running drain, and canceling that would cut a
        // replay short.)
        if (drainRequest?.isActive == true) return
        drainRequest = drainScope.launch {
            kotlinx.coroutines.delay(delayMs)
            drain()
        }
    }

    private val networkCallbackRegistered = AtomicBoolean(false)

    /** Drain whenever a network becomes available — an outage that ends while
     *  the app sits in the foreground otherwise waits for the next resume. */
    private fun registerNetworkCallback(context: Context) {
        if (!networkCallbackRegistered.compareAndSet(false, true)) return
        runCatching {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            cm.registerDefaultNetworkCallback(object : android.net.ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) { requestDrain() }
            })
        }.onFailure { networkCallbackRegistered.set(false) }
    }

    /**
     * Re-fire any solo results whose record flow was cut off. Runs at launch,
     * on every foreground return and when the network comes back. Idempotent;
     * no-ops when signed out; at most one drain runs at a time.
     */
    suspend fun drain() {
        if (!draining.compareAndSet(false, true)) return
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
                // The live record call for this game is still airborne (hung on
                // an outage) — it owns the payload; replaying now double-counts.
                if (isInFlight(payload.gameModeName, payload.seed)) continue
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
                try {
                    GameResultsService.record(
                        gameMode = mode, won = payload.won, guessCount = payload.guessCount,
                        timeSeconds = payload.timeSeconds, boardsSolved = payload.boardsSolved,
                        totalBoards = payload.totalBoards, seed = payload.seed,
                        solutions = payload.solutions, guesses = payload.guesses,
                        hintsUsed = payload.hintsUsed, playType = "solo",
                        stagesCompleted = payload.stagesCompleted,
                        bestCorrectLetters = payload.bestCorrectLetters,
                        // A replayed result's unlocks wait for a calm moment (CelebrationGate).
                        source = CelebrationGate.Source.REPLAY,
                    )
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    // One payload's failure (a medal/bonus read timing out after
                    // the tracked parts) must not strand the rest of the queue.
                    // Its own outstanding parts stay queued for the next drain.
                    DailyResultsService.reportSwallowedWrite("drain", payload.gameModeName, e)
                }
            }
        } finally {
            draining.set(false)
        }
    }
}
