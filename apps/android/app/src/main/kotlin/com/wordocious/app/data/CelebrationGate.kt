package com.wordocious.app.data

/**
 * When a celebration may appear (founder, 2026-10-03: during an outage the game's write landed
 * late and the Daily Sweep popped at an awkward moment). iOS / Android / web parity.
 *
 * - Daily Sweep / Flawless / Puzzles sweep: ALWAYS wait for a calm moment, and are dropped if
 *   their day is no longer today's local day by the time that moment comes.
 * - Achievement / tier popups: a LIVE finish keeps the old behavior (after the game's own win
 *   popup); a LATE one waits for calm like the sweeps.
 *
 * Pure (unit-tested: CelebrationGateTest). The app wiring lives in ui/CelebrationQueue.kt.
 */
object CelebrationGate {
    /** Where an unlock / result came from. */
    enum class Source {
        /** The game the player just finished, recorded now. */
        LIVE,
        /** The pending-records replay (PendingRecords.drain). */
        REPLAY,
        /** The launch / foreground achievement sync (AchievementSeen's "seen set" diff). */
        SYNC,
    }

    /** A live finish whose result comes back later than this is treated as late. */
    const val lateAfterSeconds = 6L

    /** Calm = Home tab at its root, nothing presented over it, no other popup up. */
    fun isCalm(onHomeRoot: Boolean, anythingPresented: Boolean, popupUp: Boolean): Boolean =
        onHomeRoot && !anythingPresented && !popupUp

    /** Late = a replay, a sync, or a live record that took more than [lateAfterSeconds]. */
    fun isLate(source: Source, startedAtMs: Long, nowMs: Long): Boolean =
        source != Source.LIVE || nowMs - startedAtMs > lateAfterSeconds * 1000L

    /** A queued sweep / flawless celebration from a past day is dropped, not shown. */
    fun shouldDrop(celebrationDay: String, today: String): Boolean = celebrationDay != today
}
