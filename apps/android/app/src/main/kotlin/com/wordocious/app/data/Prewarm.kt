package com.wordocious.app.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Off-main warm-up of the bundled word lists and puzzle banks (founder, 2026-09-29).
 *
 * Every More Games screen builds its session inside `remember { … }`, and the
 * session's first line reads `XBank.bundled` — a lazy that reads and decodes a
 * bundled JSON file (Hubbub's is 977 KB). On first open that decode ran on the
 * UI thread, so the tap that opened a game hitched. The banks are warmed here on
 * Dispatchers.Default shortly after the first frame (MainScreen) and again,
 * idempotently, when the More Games sheet opens, so composition finds them ready.
 *
 * Every `bundled` is a plain `by lazy`, whose default mode is SYNCHRONIZED: a
 * screen that opens mid-warm waits for the one decode in flight instead of
 * starting a second, and a bank that is already warm costs a field read.
 */
object Prewarm {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val dictionaryStarted = AtomicBoolean(false)
    private val banksStarted = AtomicBoolean(false)

    /** The Classic word lists (~635 KB) — every word game's GameViewModel needs them. */
    fun dictionary() {
        if (dictionaryStarted.compareAndSet(false, true)) scope.launch { runCatching { com.wordocious.core.DictionaryLoader.ensureLoaded() } }
    }

    /** All More Games banks, one after another (gentle on a cold start's CPU). */
    fun banks() {
        if (!banksStarted.compareAndSet(false, true)) return
        dictionary()
        scope.launch {
            val warmers: List<() -> Any?> = listOf(
                { com.wordocious.core.HolidayTable.bundled },
                { com.wordocious.core.HubBank.bundled },
                { com.wordocious.core.CrosswordBank.bundled },
                { com.wordocious.core.GroupsBank.bundled },
                { com.wordocious.core.WordsearchBank.bundled },
                { com.wordocious.core.ScrambleBank.bundled },
                { com.wordocious.core.CryptogramBank.bundled },
                { com.wordocious.core.LadderBank.bundled },
                { com.wordocious.core.ProperNoundle.dailyPuzzle(com.wordocious.app.todayLocalDate()) },
            )
            for (w in warmers) runCatching { w() }
        }
    }
}
