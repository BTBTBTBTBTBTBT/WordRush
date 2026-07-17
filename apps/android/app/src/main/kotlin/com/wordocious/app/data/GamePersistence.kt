package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Local game persistence — mirrors the iOS local-resume behavior (UserDefaults).
 * Stores the full GameState (JSON) keyed by seed+mode so a daily/in-progress game
 * resumes after the app is backgrounded or closed. The finished state is kept too,
 * so re-opening a completed daily lands on the post-game screen (web parity).
 */
object GamePersistence {
    /** Save-format version, gating schema evolution the way the web's
     *  SAVE_VERSION does (use-game-snapshot.ts): a decodable-but-older save is
     *  DISCARDED on mismatch instead of silently restored into a newer
     *  reducer (ignoreUnknownKeys made that especially easy here). Bump when
     *  GameState's persisted shape changes meaning. */
    const val SAVE_VERSION = 1

    /** A game started close to local midnight can cross the day boundary.
     *  Keep yesterday's IN-PROGRESS daily loadable for this window (web
     *  DAILY_CROSS_MIDNIGHT_GRACE_MS parity — 4h). */
    const val CROSS_MIDNIGHT_GRACE_MS = 4L * 60 * 60 * 1000

    /** Versioned envelope. Legacy entries are a bare GameState — decoded as v1
     *  by the fallback in [decodeVersionedSave], so shipping this doesn't wipe
     *  anyone's in-flight game. savedAt powers the cross-midnight grace
     *  (SharedPreferences has no file mtime). */
    @Serializable
    data class VersionedSave(val version: Int, val savedAt: Long, val state: GameState)

    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_games", Context.MODE_PRIVATE)
    }
    private val json = Json { ignoreUnknownKeys = true }

    private fun key(seed: String, mode: GameMode) = "game-${mode.name}-$seed"

    // Pure encode/decode, extracted so the version-gate is unit-testable
    // (GamePersistenceTest) without SharedPreferences.
    fun encodeVersionedSave(state: GameState, savedAt: Long = System.currentTimeMillis()): String =
        json.encodeToString(VersionedSave.serializer(), VersionedSave(SAVE_VERSION, savedAt, state))

    /** Decode a stored entry: envelope with matching version, legacy bare
     *  GameState (treated as v1, savedAt unknown → 0), or null (mismatched
     *  version / corrupt). */
    fun decodeVersionedSave(raw: String): VersionedSave? {
        runCatching { json.decodeFromString(VersionedSave.serializer(), raw) }.getOrNull()?.let {
            return if (it.version == SAVE_VERSION) it else null
        }
        return runCatching { json.decodeFromString(GameState.serializer(), raw) }.getOrNull()
            ?.let { VersionedSave(SAVE_VERSION, 0L, it) }
    }

    fun save(seed: String, mode: GameMode, state: GameState) {
        runCatching {
            prefs.edit().putString(key(seed, mode), encodeVersionedSave(state)).apply()
        }
    }

    fun load(seed: String, mode: GameMode): GameState? =
        prefs.getString(key(seed, mode), null)?.let { decodeVersionedSave(it)?.state }

    /** If today's daily has no save but YESTERDAY's daily for this mode is
     *  still in progress and was saved within the grace window, return
     *  yesterday's seed so the caller can resume it (it records to yesterday —
     *  the day always derives from the seed, never the clock). Mirrors iOS
     *  GamePersistence.gracedYesterdaySeed / web use-game-snapshot.ts. */
    fun gracedYesterdaySeed(todaySeed: String, mode: GameMode): String? {
        val todayStr = com.wordocious.core.getDailySeedDate(todaySeed) ?: return null
        val yesterdayStr = previousDay(todayStr) ?: return null
        val seed = com.wordocious.core.generateDailySeed(yesterdayStr, mode.name)
        val raw = prefs.getString(key(seed, mode), null) ?: return null
        val saved = decodeVersionedSave(raw) ?: return null
        val fresh = System.currentTimeMillis() - saved.savedAt < CROSS_MIDNIGHT_GRACE_MS
        return if (fresh && saved.state.status == com.wordocious.core.GameStatus.PLAYING) seed else null
    }

    /** The `YYYY-MM-DD` after "-daily-" in a persistence key, or null for
     *  practice/VS keys. Pure — unit-tested. */
    fun dailyDateFrom(key: String): String? {
        val i = key.indexOf("-daily-")
        if (i < 0) return null
        val date = key.drop(i + "-daily-".length).take(10)
        return if (Regex("""\d{4}-\d{2}-\d{2}""").matches(date)) date else null
    }

    private fun previousDay(day: String): String? = runCatching {
        val f = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        f.timeZone = java.util.TimeZone.getDefault()
        val d = f.parse(day) ?: return null
        java.util.Calendar.getInstance().apply { time = d; add(java.util.Calendar.DAY_OF_YEAR, -1) }
            .let { f.format(it.time) }
    }.getOrNull()

    /** Storage hygiene (iOS cleanupStaleDailyGames parity — Android previously
     *  had NO sweep, so per-seed daily saves accumulated forever). Removes
     *  game/elapsed/hint entries for any daily date other than today, except
     *  yesterday's still-in-progress game within the cross-midnight grace.
     *  Call once at app start. */
    fun cleanupStaleDailyGames(today: String) {
        runCatching {
            val yesterday = previousDay(today)
            val all = prefs.all
            // Pass 1 — decide which dates survive, from game- entries only:
            // today always; yesterday iff some game is still PLAYING within
            // the grace window. (Two passes so an elapsed/hint key seen before
            // its game- key can't be swept out from under a graced game.)
            val keep = mutableSetOf(today)
            if (yesterday != null) {
                val graced = all.any { (k, v) ->
                    k.startsWith("game-") && dailyDateFrom(k) == yesterday && v is String &&
                        decodeVersionedSave(v)?.let {
                            it.state.status == com.wordocious.core.GameStatus.PLAYING &&
                                System.currentTimeMillis() - it.savedAt < CROSS_MIDNIGHT_GRACE_MS
                        } == true
                }
                if (graced) keep.add(yesterday)
            }
            // Pass 2 — remove every daily-keyed entry whose date didn't survive.
            val editor = prefs.edit()
            for ((k, _) in all) {
                val date = dailyDateFrom(k) ?: continue
                if (date !in keep) editor.remove(k)
            }
            editor.apply()
        }
    }

    fun clear(seed: String, mode: GameMode) {
        prefs.edit().remove(key(seed, mode)).apply()
    }

    /** Wipe ALL on-device game saves (every mode/seed, plus elapsed/hint keys).
     *  Called on sign-out so the next session never inherits the previous user's
     *  boards — the completed-daily card reads from this local store. */
    fun clearAll() {
        prefs.edit().clear().apply()
    }

    // Elapsed-at-finish: frozen when the game ends so a re-opened finished game
    // shows the recorded time (not a value that keeps growing from startTime).
    private fun elapsedKey(seed: String, mode: GameMode) = "elapsed-${mode.name}-$seed"

    fun saveElapsed(seed: String, mode: GameMode, seconds: Int) {
        prefs.edit().putInt(elapsedKey(seed, mode), seconds).apply()
    }

    fun loadElapsed(seed: String, mode: GameMode): Int? {
        val k = elapsedKey(seed, mode)
        return if (prefs.contains(k)) prefs.getInt(k, 0) else null
    }

    // Hint UI state (Six/Seven/ProperNoundle) — the board guesses already persist
    // via save(), but the revealed clue/vowel/consonant flags + clue text live
    // outside GameState, so they need their own slot to survive a resume
    // (mirrors iOS persistHintUI/restoreHintUI).
    @Serializable
    data class HintState(
        val clue: String? = null,
        val vowelRevealed: String? = null,
        val consonantRevealed: String? = null,
        val vowelUsed: Boolean = false,
        val consonantUsed: Boolean = false,
    )

    private fun hintKey(seed: String, mode: GameMode) = "hints-${mode.name}-$seed"

    fun saveHints(seed: String, mode: GameMode, state: HintState) {
        runCatching {
            prefs.edit().putString(hintKey(seed, mode), json.encodeToString(HintState.serializer(), state)).apply()
        }
    }

    fun loadHints(seed: String, mode: GameMode): HintState? =
        prefs.getString(hintKey(seed, mode), null)?.let {
            runCatching { json.decodeFromString(HintState.serializer(), it) }.getOrNull()
        }
}
