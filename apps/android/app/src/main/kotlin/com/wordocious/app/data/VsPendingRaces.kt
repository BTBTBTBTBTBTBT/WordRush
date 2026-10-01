package com.wordocious.app.data

import com.wordocious.core.GameMode
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.math.roundToInt

/**
 * Race results never get lost (VS overhaul §14, founder 2026-10-01). When a
 * race's result POST fails with a network error or a 5xx — a finish OR a
 * mid-game quit — the run waits here (`wordocious-vs-pending-races`, one per
 * code) and is sent again every time the VS lobby loads and on app start.
 *
 * Retry rules (web/iOS parity):
 *  - accepted, `alreadyRecorded == false` → record the racer's side through
 *    the normal live-VS path (user_stats 'vs' + XP; a draw books nothing), drop
 *  - accepted, `alreadyRecorded == true` → drop (the side is already booked)
 *  - a 4xx (400/403/404/410) → drop; network error / 5xx / 401 → keep
 *  - a quit (`quit: true`) always books a loss, even when the server scores a draw
 *  - anything older than 3 days → drop
 */
object VsPendingRaces {
    private const val KEY = "wordocious-vs-pending-races"
    private const val MAX_AGE_MS = 3L * 24 * 60 * 60 * 1000

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mutex = Mutex()

    @Serializable
    data class Item(
        val code: String,
        val gameMode: String,
        val seed: String,
        val run: VsChallengeService.Run,
        val savedAt: Long,
        /** Left mid-game: the racer's side books as a loss, like the online quit path. */
        val quit: Boolean = false,
    )

    fun all(): List<Item> = runCatching {
        json.decodeFromString<List<Item>>(SettingsPref.get(KEY, "[]"))
    }.getOrDefault(emptyList())

    private fun write(items: List<Item>) {
        if (items.isEmpty()) SettingsPref.remove(KEY) else SettingsPref.set(KEY, json.encodeToString(items))
    }

    /** Keep a run that couldn't be sent (replaces an earlier one for the same code). */
    @Synchronized
    fun save(code: String, gameMode: GameMode, seed: String, run: VsChallengeService.Run, quit: Boolean = false) {
        val c = code.uppercase()
        write(all().filter { it.code != c } + Item(c, gameMode.name, seed, run, System.currentTimeMillis(), quit))
    }

    @Synchronized
    private fun remove(code: String) = write(all().filter { it.code != code })

    /** Send every pending race again (§14). No-throw; one pass at a time. */
    suspend fun retry() {
        if (AuthService.profile.value == null) return
        if (!mutex.tryLock()) return
        try {
            val now = System.currentTimeMillis()
            for (item in all()) {
                if (now - item.savedAt > MAX_AGE_MS) { remove(item.code); continue }
                when (val r = VsChallengeService.postResult(item.code, item.run, quit = item.quit)) {
                    is VsChallengeService.PostOutcome.Accepted -> {
                        if (!r.response.alreadyRecorded) recordSide(item, r.response.outcome)
                        remove(item.code)
                    }
                    is VsChallengeService.PostOutcome.Rejected -> remove(item.code)
                    VsChallengeService.PostOutcome.Retry -> {}
                }
            }
        } finally {
            mutex.unlock()
        }
    }

    /** The racer's own side, as the finish (outcome from the server, racer's side) or the quit (a loss) would have recorded it. */
    private suspend fun recordSide(item: Item, outcome: String) {
        if (!item.quit && outcome == "draw") return
        val mode = runCatching { GameMode.valueOf(item.gameMode) }.getOrNull() ?: return
        val run = item.run
        GameResultsService.record(
            gameMode = mode, playType = "vs", won = !item.quit && outcome == "win", guessCount = run.guesses,
            timeSeconds = (run.timeMs / 1000.0).roundToInt(), boardsSolved = run.boardsSolved, totalBoards = run.totalBoards,
            seed = item.seed, solutions = run.solutions, guesses = run.guessLog,
        )
    }
}
