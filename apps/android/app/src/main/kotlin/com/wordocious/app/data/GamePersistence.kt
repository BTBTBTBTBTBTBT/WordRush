package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import kotlinx.serialization.json.Json

/**
 * Local game persistence — mirrors the iOS local-resume behavior (UserDefaults).
 * Stores the full GameState (JSON) keyed by seed+mode so a daily/in-progress game
 * resumes after the app is backgrounded or closed. The finished state is kept too,
 * so re-opening a completed daily lands on the post-game screen (web parity).
 */
object GamePersistence {
    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_games", Context.MODE_PRIVATE)
    }
    private val json = Json { ignoreUnknownKeys = true }

    private fun key(seed: String, mode: GameMode) = "game-${mode.name}-$seed"

    fun save(seed: String, mode: GameMode, state: GameState) {
        runCatching {
            prefs.edit().putString(key(seed, mode), json.encodeToString(GameState.serializer(), state)).apply()
        }
    }

    fun load(seed: String, mode: GameMode): GameState? =
        prefs.getString(key(seed, mode), null)?.let {
            runCatching { json.decodeFromString(GameState.serializer(), it) }.getOrNull()
        }

    fun clear(seed: String, mode: GameMode) {
        prefs.edit().remove(key(seed, mode)).apply()
    }
}
