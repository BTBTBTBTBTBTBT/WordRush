package com.wordocious.app.ui.vs

/**
 * Founder 10-02: VS Gauntlet matches solo — the player's race clock PAUSES while their own
 * stage card is up (5 s, tap to skip), and recorded times exclude that card time. Each player
 * pauses only during their own card (the opponent's clock is theirs). Pure (unit tested).
 */
class RaceClock {
    private var startMs = 0.0
    private var pausedMs = 0L
    private var pausedAt: Long? = null

    val started: Boolean get() = startMs > 0

    /** A new match starts at [startMs] (server time or now); clears any pause. */
    fun start(startMs: Double) { this.startMs = startMs; pausedMs = 0; pausedAt = null }

    /** The stage card went up at [nowMs] (no-op while already paused). */
    fun pause(nowMs: Long) { if (pausedAt == null && started) pausedAt = nowMs }

    /** The stage card went away at [nowMs]: its time is excluded from the race. */
    fun resume(nowMs: Long) {
        pausedAt?.let { pausedMs += (nowMs - it).coerceAtLeast(0) }
        pausedAt = null
    }

    /** Race time at [nowMs]: wall time since the start minus every stage-card pause (a live pause included). */
    fun elapsedMs(nowMs: Long): Long {
        if (!started) return 0
        val live = pausedAt?.let { (nowMs - it).coerceAtLeast(0) } ?: 0L
        return ((nowMs - startMs).toLong() - pausedMs - live).coerceAtLeast(0)
    }
}
