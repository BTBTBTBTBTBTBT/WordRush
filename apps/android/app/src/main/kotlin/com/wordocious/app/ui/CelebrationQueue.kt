package com.wordocious.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wordocious.app.data.CelebrationGate
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.SettingsPref
import kotlinx.coroutines.delay

// Late celebrations wait for a calm moment (founder, 2026-10-03: during an outage the game's
// write landed late and the Daily Sweep popped at an awkward moment). The rules are the pure
// CelebrationGate (data/); this file is the Android wiring. iOS / web parity.

/**
 * What the screen is doing right now, for [CelebrationGate.isCalm]. Snapshot state, read on the
 * main thread by [CelebrationQueueHost].
 * - [homeRoot]: MainScreen's Home tab at its root (no game, cover or pushed page).
 * - [presented]: dialogs / sheets / covers that report themselves ([ReportPresented]).
 * - [popups]: other popups that report themselves ([ReportPopup]); the achievement popup and a
 *   sweep celebration on screen count too.
 */
object CelebrationCalm {
    var homeRoot by mutableStateOf(false)
    var presented by mutableIntStateOf(0)
    var popups by mutableIntStateOf(0)

    /** The popup input of [isCalm] (2.8 item 52: the host decides Home / present / wait from the raw inputs). */
    val popupUp: Boolean
        get() = popups > 0 || BadgeMoments.current != null || CelebrationQueue.showingSweep != null

    val isCalm: Boolean
        get() = CelebrationGate.isCalm(
            onHomeRoot = homeRoot,
            anythingPresented = presented > 0,
            popupUp = popups > 0 || BadgeMoments.current != null || CelebrationQueue.showingSweep != null,
        )
}

/** Marks a dialog / sheet / cover as up while this is composed with [active] true. */
@Composable
fun ReportPresented(active: Boolean = true) {
    if (!active) return
    DisposableEffect(Unit) {
        CelebrationCalm.presented++
        onDispose { CelebrationCalm.presented-- }
    }
}

/** Marks a popup (streak / shield header popups, Pro welcome, the shield modal…) as up. */
@Composable
fun ReportPopup(active: Boolean = true) {
    if (!active) return
    DisposableEffect(Unit) {
        CelebrationCalm.popups++
        onDispose { CelebrationCalm.popups-- }
    }
}

/**
 * The queue of celebrations waiting for calm: every Daily Sweep / Flawless / Puzzles sweep, and
 * the LATE achievement / tier popups (replay, launch sync, or a live result that took longer
 * than [CelebrationGate.lateAfterSeconds]). Main thread only. Presented in order by
 * [CelebrationQueueHost]; a sweep whose day is no longer today is dropped.
 */
object CelebrationQueue {
    sealed interface Item {
        /** A sweep celebration. [more] = the Puzzles (More Games) sweep. [byMode] is the
         *  completions snapshot that earned it (never live state). */
        data class Sweep(
            val more: Boolean,
            val day: String,
            val flawless: Boolean,
            val byMode: Map<String, DailyCompletionsService.Completion>,
        ) : Item

        data class Badge(val moment: BadgeMoment) : Item
    }

    private val items = mutableStateListOf<Item>()

    /** How many are waiting (the one on screen excluded). */
    val pending: Int get() = items.size

    /** The sweep celebration on screen (HomeScreen renders it), or null. */
    var showingSweep by mutableStateOf<Item.Sweep?>(null)
        private set

    private fun prefKey(more: Boolean) = if (more) "more-sweep-celebrated-day" else "sweep-celebrated-day"
    private fun token(day: String, flawless: Boolean) = "$day:${if (flawless) "flawless" else "sweep"}"

    /** The existing once-per-day tokens: a sweep celebrates once, and once more on the
     *  sweep → flawless upgrade. */
    fun alreadyCelebrated(more: Boolean, day: String, flawless: Boolean): Boolean {
        val seen = SettingsPref.get(prefKey(more), "")
        return seen == token(day, flawless) || seen == "$day:flawless"
    }

    /** Queue a sweep (main thread). One per kind and day; a flawless replaces a queued sweep. */
    fun enqueueSweep(s: Item.Sweep) {
        if (alreadyCelebrated(s.more, s.day, s.flawless)) return
        showingSweep?.let { if (it.more == s.more && it.day == s.day && (it.flawless || !s.flawless)) return }
        val i = items.indexOfFirst { it is Item.Sweep && it.more == s.more && it.day == s.day }
        if (i >= 0) {
            if (s.flawless && !(items[i] as Item.Sweep).flawless) items[i] = s
            return
        }
        items.add(s)
    }

    /** Queue late badge moments (main thread; already de-duplicated by BadgeMoments). */
    fun enqueueBadges(moments: List<BadgeMoment>) {
        items.addAll(moments.map { Item.Badge(it) })
    }

    /** The day of the head sweep (null when the head isn't a sweep / empty) — the host drops a stale-day one. */
    fun peekSweepDay(): String? = (items.firstOrNull() as? Item.Sweep)?.day

    /** Present the head (main thread, at a calm moment). True when something went up. */
    fun presentNext(today: String): Boolean {
        if (items.isEmpty()) return false
        val shown = presentHead(today)
        releaseHeldIfDone()
        return shown
    }

    private fun presentHead(today: String): Boolean {
        return when (val head = items.removeAt(0)) {
            is Item.Sweep -> when {
                CelebrationGate.shouldDrop(head.day, today) -> false
                alreadyCelebrated(head.more, head.day, head.flawless) -> false
                else -> {
                    SettingsPref.set(prefKey(head.more), token(head.day, head.flawless))
                    showingSweep = head
                    true
                }
            }
            is Item.Badge -> {
                BadgeMoments.showNow(head.moment)
                true
            }
        }
    }

    fun finishSweep() {
        showingSweep = null
        releaseHeldIfDone()
    }

    // ── 2.8 item 52: handoffs wait for the celebration; off-Home celebrations route Home ──

    /** Sweep celebrations due or on screen (held game handoffs wait on it). */
    val pendingSweeps: Int get() = items.count { it is Item.Sweep } + (if (showingSweep != null) 1 else 0)

    /** Bumped when a live celebration needs the app on its Home tab (MainScreen observes it). */
    var goHomeTick by mutableIntStateOf(0)
        private set

    fun requestGoHome() {
        goHomeTick++
    }

    private val held = ArrayList<() -> Unit>()

    /**
     * True when [go] (NEXT daily, Keep playing…) was held until the pending celebrations have played; false = run it
     * now. A held handoff is released after 8 s regardless (see [CelebrationQueueHost]).
     */
    fun holdHandoff(go: () -> Unit): Boolean {
        if (!CelebrationGate.shouldDeferHandoff(pendingSweeps)) return false
        held.add(go)
        heldSince = android.os.SystemClock.uptimeMillis()
        return true
    }

    var heldSince = 0L
        private set

    val hasHeld: Boolean get() = held.isNotEmpty()

    fun releaseHeldIfDone() {
        if (pendingSweeps == 0) releaseHeld()
    }

    fun releaseHeld() {
        val run = held.toList()
        held.clear()
        run.forEach { it() }
    }
}

/**
 * Drives [CelebrationQueue]: while something is queued, checks for calm every 0.5 s; once calm,
 * waits a short settle beat (0.4 s), checks again, and presents the head. Idle (no polling)
 * when the queue is empty. Place once, above the app's content.
 */
@Composable
fun CelebrationQueueHost() {
    val waiting = CelebrationQueue.pending > 0
    val lifecycle = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle
    fun active() = lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)
    // 2.8 item 52: a LIVE sweep (queued by a finish in this session, from LOCAL results) presents the moment nothing
    // is open: on Home's root show; off Home go Home first, then show; anything open waits. (It used to wait for
    // Home's root, so leaving the last daily's finished screen by NEXT ran the next game before the celebration.)
    LaunchedEffect(waiting) {
        if (!waiting) return@LaunchedEffect
        var settled = 0
        var routedHome = false
        while (CelebrationQueue.pending > 0) {
            delay(250)
            val today = com.wordocious.app.todayLocalDate()
            val head = CelebrationQueue.peekSweepDay()
            val action = if (!active()) CelebrationGate.Action.WAIT else CelebrationGate.action(
                // Sweeps are LIVE (a finish in this session); a late badge moment keeps waiting for calm on Home.
                source = if (head != null) CelebrationGate.Source.LIVE else CelebrationGate.Source.REPLAY,
                onHomeRoot = CelebrationCalm.homeRoot,
                anythingPresented = CelebrationCalm.presented > 0,
                popupUp = CelebrationCalm.popupUp,
                celebrationDay = head ?: today,
                today = today,
            )
            when (action) {
                CelebrationGate.Action.DROP -> { CelebrationQueue.presentNext(today); settled = 0 }
                CelebrationGate.Action.PRESENT -> {
                    settled++   // a ~0.5 s settle beat so a cover mid-dismissal never collides with it
                    if (settled >= 2) { CelebrationQueue.presentNext(today); settled = 0; routedHome = false }
                }
                CelebrationGate.Action.GO_HOME_THEN_PRESENT -> {
                    settled = 0
                    if (!routedHome) { routedHome = true; CelebrationQueue.requestGoHome() }
                }
                CelebrationGate.Action.WAIT -> settled = 0
            }
        }
    }
    // A held game handoff never waits more than 8 s for a celebration that can't show.
    LaunchedEffect(CelebrationQueue.hasHeld) {
        if (!CelebrationQueue.hasHeld) return@LaunchedEffect
        delay(8000)
        CelebrationQueue.releaseHeld()
    }
}
