package com.wordocious.app.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * BI19: warm today's Leaderboard + Stats caches in the background — once launch has settled
 * and again after every finished daily — so those tabs open on current data instead of
 * waiting on a round trip. Everything lands in the existing caches (LeaderboardService's disk
 * board cache, the persisted Stats memo); failures leave the cached copies alone.
 */
object TodayPrefetch {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var job: Job? = null

    /** After launch settles (auth restored, the first frame long gone). */
    fun afterLaunch() = schedule(delayMs = 6_000, modes = DailyCompletionsService.SWEEP_KEYS.toList())

    /** After a daily finishes: that board + the overall board + Stats, debounced so a burst of
     *  finish writes is one prefetch. */
    fun afterFinish(gameMode: String? = null) =
        schedule(delayMs = 4_000, modes = listOfNotNull(gameMode))

    private fun schedule(delayMs: Long, modes: List<String>) {
        job?.cancel()
        job = scope.launch {
            delay(delayMs)
            val uid = AuthService.userId ?: return@launch
            runCatching { LeaderboardService.prefetchToday(uid, modes) }
            runCatching { com.wordocious.app.ui.fetchProfileMain(uid, prev = null) }
        }
    }
}
