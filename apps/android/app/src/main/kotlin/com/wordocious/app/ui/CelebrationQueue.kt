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

    /** Present the head (main thread, at a calm moment). True when something went up. */
    fun presentNext(today: String): Boolean {
        if (items.isEmpty()) return false
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
    fun calmNow() = CelebrationCalm.isCalm &&
        lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)
    LaunchedEffect(waiting) {
        if (!waiting) return@LaunchedEffect
        while (CelebrationQueue.pending > 0) {
            delay(500)
            if (!calmNow()) continue
            delay(400)
            if (!calmNow()) continue
            CelebrationQueue.presentNext(com.wordocious.app.todayLocalDate())
        }
    }
}
