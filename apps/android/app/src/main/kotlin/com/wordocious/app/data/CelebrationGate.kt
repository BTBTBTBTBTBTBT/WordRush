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

    // ── 2.8 item 52: the celebration fires at the right moment ───────────────
    // Bug (founder 10-09): the Flawless banner didn't show after the 8th daily; it came later, after a Puzzle. It only
    // presented at a CALM moment on Home's root, so leaving the last daily's finished screen by NEXT (or from another
    // tab) ran the whole next game first. Rules (same as web `celebration-gate.ts` / iOS `CelebrationGate`):
    //  - DUE is computed from LOCAL results the instant a group's last game finishes (the server never delays it);
    //  - a LIVE celebration presents the moment nothing is open: on Home's root show, off Home go Home then show,
    //    something open wait; a late source (replay / sync) still waits for calm on Home's root;
    //  - leaving a finished screen by NEXT / Leaderboard / Keep playing while one is due plays it FIRST;
    //  - never twice (per-day seen tier; flawless covers sweep); a celebration whose day ended is dropped.

    enum class Group(val raw: String) { DAILY("daily"), MORE("more") }
    enum class Tier(val raw: String) { SWEEP("sweep"), FLAWLESS("flawless") }

    /** One celebration due now; [token] = `day:group:tier`, the once-per-day key. */
    data class Due(val group: Group, val tier: Tier, val token: String)

    /**
     * Which celebrations are due right now, from local results alone (Daily Sweep first, then Puzzles).
     * [results] = today's finished games by key -> won; [seen] = the tier already celebrated today for a group.
     */
    fun due(
        results: Map<String, Boolean>, dailyKeys: List<String>, moreKeys: List<String>,
        today: String, dataDay: String, seen: (Group) -> Tier?,
    ): List<Due> {
        if (dataDay != today) return emptyList()
        val out = ArrayList<Due>()
        for ((group, keys) in listOf(Group.DAILY to dailyKeys, Group.MORE to moreKeys)) {
            if (keys.isEmpty()) continue
            val rows = keys.map { results[it] }
            if (rows.any { it == null }) continue
            val wins = rows.count { it == true }
            // A "sweep" with zero recorded wins is stale / degenerate data, never a real day of play.
            if (wins == 0) continue
            val tier = if (wins >= keys.size) Tier.FLAWLESS else Tier.SWEEP
            val s = seen(group)
            if (s == Tier.FLAWLESS || s == tier) continue
            out.add(Due(group, tier, "$today:${group.raw}:${tier.raw}"))
        }
        return out
    }

    enum class Action { PRESENT, GO_HOME_THEN_PRESENT, WAIT, DROP }

    /** What to do with a queued celebration right now. */
    fun action(
        source: Source, onHomeRoot: Boolean, anythingPresented: Boolean, popupUp: Boolean,
        celebrationDay: String, today: String,
    ): Action = when {
        shouldDrop(celebrationDay, today) -> Action.DROP
        anythingPresented || popupUp -> Action.WAIT
        onHomeRoot -> Action.PRESENT
        source == Source.LIVE -> Action.GO_HOME_THEN_PRESENT
        else -> Action.WAIT
    }

    /** A game handoff (NEXT daily, Keep playing, Leaderboard) waits while a celebration is due or on screen. */
    fun shouldDeferHandoff(pending: Int): Boolean = pending > 0
}
