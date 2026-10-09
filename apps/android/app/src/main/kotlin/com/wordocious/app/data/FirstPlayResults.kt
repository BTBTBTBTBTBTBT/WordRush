package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import com.wordocious.app.ModeGen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * "Has this player already played this game?" for the first-play welcome card (FRIDAY-QUEUE item 12 +
 * the 10-09 suppression): an existing player never gets a tutorial for a game they already know, and the
 * key is recorded quietly instead (PocketHelp.tutorialShouldRecordSeen). Two signals, either is enough:
 * a saved game on this device (word games: "game-<MODE>-<seed>" in wordocious_games; More Games:
 * "<id>-save-..." in wordocious_prefs) and, signed in, a user_stats row with total_games > 0 (so a new
 * device of an existing player is covered). Web: lib/first-play-results.ts. iOS: FirstPlayResults.swift.
 */
object FirstPlayResults {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Db keys (game_mode) the signed-in player has any stats for. Null until known; guests resolve to empty at once. */
    private val _played = MutableStateFlow<Set<String>?>(null)
    val played: StateFlow<Set<String>?> = _played.asStateFlow()
    private var loadedFor: String? = null

    /** Load the played set for the current account (idempotent per account). */
    fun ensureLoaded() {
        val uid = AuthService.userId
        val tag = uid ?: ""
        if (loadedFor == tag) return
        loadedFor = tag
        if (uid == null) { _played.value = emptySet(); return }
        _played.value = null
        scope.launch {
            // A failed read is an empty list (fetchUserStats): the card then shows once, never hides on a guess.
            val rows = ProfileService.fetchUserStats(uid)
            _played.value = rows.filter { it.totalGames > 0 }.map { it.gameMode }.toSet()
        }
    }

    /** The More Games save prefix per db key (the keys the screens write to wordocious_prefs). */
    private val MORE_SAVE_PREFIX = mapOf(
        "REGIONS" to "regions", "SUDOKU" to "sudoku", "SCRAMBLE" to "muddle", "CROSSWORD" to "crossword",
        "GROUPS" to "groups", "LADDER" to "ladder", "CRYPTOGRAM" to "cryptogram", "WORDSEARCH" to "wordsearch", "HUB" to "hub",
    )

    /** The db key for a guide slug ("classic" -> "DUEL"), or null for a pocket key / unknown slug. */
    fun dbKeyForSlug(slug: String): String? = ModeGen.all.firstOrNull { it.guideSlug == slug }?.dbKey

    /** This device holds a saved game for the db key. Read once per screen (a save written during play must not retract a card already decided). */
    fun hasLocalSave(dbKey: String): Boolean = runCatching {
        val games = App.instance.getSharedPreferences("wordocious_games", Context.MODE_PRIVATE)
        if (games.all.keys.any { it.startsWith("game-$dbKey-") }) return@runCatching true
        val prefix = MORE_SAVE_PREFIX[dbKey] ?: return@runCatching false
        val prefs = App.instance.getSharedPreferences("wordocious_prefs", Context.MODE_PRIVATE)
        prefs.all.keys.any { it.startsWith("$prefix-save-") }
    }.getOrDefault(false)
}
