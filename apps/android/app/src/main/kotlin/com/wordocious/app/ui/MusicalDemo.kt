package com.wordocious.app.ui

import android.os.SystemClock
import android.util.Log
import com.wordocious.app.data.PocketDemo
import com.wordocious.core.MusicalCast
import com.wordocious.core.MusicalMelody
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * DEBUG / benchmark-only musical-cast playthrough (founder 10-13; PocketDemo.enabled is a constant false in the shipping release,
 * so R8 strips this). `--es musicalDemo everyday|halloween|<tune id>` turns musical mode on and taps each tune's `notes` at ~300 ms
 * per tap through the header's own playNote (the path a finger takes), then waits for the sung-back playback and checks it
 * against MusicalCast.replay(tune): same notes in the same order, each within +-40 ms, played to the LAST note, and the tune's
 * secret-achievement unlock CALLED exactly once afterwards. Results go to logcat, tag MusicalDemo (PASS/FAIL per tune).
 */
object MusicalDemo {
    private const val TAG = "MusicalDemo"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /** Cast ids to tap; the live header collects these and calls its playNote. */
    val taps = MutableSharedFlow<String>(extraBufferCapacity = 256)

    private var lastTapAt = 0L
    private val sung = mutableListOf<Pair<String, Long>>()
    private var matched: MusicalMelody? = null
    private val unlocked = mutableListOf<Pair<String, Long>>()

    /** Header hook: every note played (a finger/driver tap or the sung-back playback). */
    fun noted(castId: String, fromPlayback: Boolean) {
        val now = SystemClock.uptimeMillis()
        if (fromPlayback) sung.add(castId to now) else lastTapAt = now
        Log.i(TAG, "note id=$castId playback=$fromPlayback t=$now")
    }

    fun matched(tune: MusicalMelody) { matched = tune; Log.i(TAG, "matched ${tune.id} t=$lastTapAt") }

    fun unlockCalled(key: String) { unlocked.add(key to SystemClock.uptimeMillis()); Log.i(TAG, "unlock CALLED key=$key t=${SystemClock.uptimeMillis()}") }

    fun start(which: String, season: String?) {
        if (!PocketDemo.enabled) return
        scope.launch {
            delay(3000) // guest start-up
            taps.subscriptionCount.first { it > 0 } // Home's header is up and listening
            if (!MusicalCastState.on) { MusicalCastState.toggle("w", System.nanoTime() / 1_000_000, reduceMotion = false) }
            delay(1800)
            val tunes = when (which) {
                "everyday" -> MusicalCast.MELODIES
                "halloween" -> MusicalCast.HALLOWEEN_MELODIES
                else -> (MusicalCast.MELODIES + MusicalCast.HALLOWEEN_MELODIES).filter { it.id == which }
            }
            var pass = 0
            for (t in tunes) { if (play(t)) pass++ }
            Log.i(TAG, "SUMMARY season=$season tunes=${tunes.size} pass=$pass fail=${tunes.size - pass}")
        }
    }

    private suspend fun play(t: MusicalMelody): Boolean {
        sung.clear(); unlocked.clear(); matched = null
        val expected = MusicalCast.replay(t)
        Log.i(TAG, "BEGIN ${t.id} notes=${t.notes.size} expectedSung=${expected.size} replayMs=${MusicalCast.replayDuration(t)}")
        for (midi in t.notes) {
            val k = MusicalCast.SCALE.indexOf(midi)
            taps.emit(MusicalCast.CAST_IDS[k])
            delay(300)
        }
        // lastTapAt is the final note's time; wait the whole sung playback + the unlock beat.
        delay(MusicalCast.replayDuration(t) + 1200)
        val problems = mutableListOf<String>()
        if (matched?.id != t.id) problems += "matched=${matched?.id}"
        if (sung.size != expected.size) problems += "sung ${sung.size}/${expected.size} notes"
        var maxDev = 0L
        expected.forEachIndexed { i, (id, atMs) ->
            val got = sung.getOrNull(i) ?: return@forEachIndexed
            if (got.first != id) problems += "note $i is ${got.first}, expected $id"
            val dev = (got.second - lastTapAt) - atMs
            if (abs(dev) > abs(maxDev)) maxDev = dev
            if (abs(dev) > 40) problems += "note $i off by ${dev}ms"
        }
        if (unlocked.size != 1 || unlocked[0].first != t.achievement) problems += "unlock calls=${unlocked.map { it.first }}"
        else {
            val after = unlocked[0].second - lastTapAt
            if (after < MusicalCast.replayDuration(t)) problems += "unlock came ${after}ms after the last tap (before the playback ended at ${MusicalCast.replayDuration(t)})"
            Log.i(TAG, "unlock-after-last-tap ${after}ms (playback ${MusicalCast.replayDuration(t)}ms)")
        }
        val ok = problems.isEmpty()
        Log.i(TAG, "${if (ok) "PASS" else "FAIL"} ${t.id} sung=${sung.size}/${expected.size} maxDev=${maxDev}ms ${problems.take(6).joinToString("; ")}")
        delay(MusicalCast.MELODY_GAP_MS + 500) // a fresh phrase for the next tune
        return ok
    }
}
