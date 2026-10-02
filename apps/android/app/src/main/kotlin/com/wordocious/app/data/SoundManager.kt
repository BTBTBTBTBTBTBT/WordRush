package com.wordocious.app.data

import android.media.AudioAttributes
import android.media.SoundPool
import android.os.SystemClock
import com.wordocious.app.App
import com.wordocious.app.R
import java.util.concurrent.ConcurrentHashMap
import kotlin.random.Random

/**
 * FINISH_SPEC U — the one sound service (replaces the old synthesized AudioTrack tones).
 *
 * The 16-sound pack (res/raw/sfx_<name>.m4a) is preloaded once into a SoundPool
 * (USAGE_GAME / CONTENT_TYPE_SONIFICATION, so it follows the media/game stream and
 * mixes with the player's music) at App start, or on first use. Master volume
 * [FeedbackRules.MASTER_VOLUME]; `tap` varies pitch ±3 % per press.
 *
 * Preference: SettingsPref.SOUND ("pref-sound"), default ON — the Settings "Sound
 * Effects" switch. Sound off mutes everything. Reduce Motion never mutes sound.
 *
 * The event map lives in [FeedbackEvent]; [fire] plays an event's sound + haptic.
 */
object SoundManager {
    private val enabled get() = SettingsPref.get(SettingsPref.SOUND, true)

    @Volatile private var pool: SoundPool? = null
    private val sampleIds = IntArray(Sfx.entries.size)
    private val loaded: MutableSet<Int> = ConcurrentHashMap.newKeySet()
    private val throttles: Map<FeedbackEvent, FeedbackThrottle> =
        FeedbackEvent.entries.filter { FeedbackRules.minGapMs(it) > 0 }
            .associateWith { FeedbackThrottle(FeedbackRules.minGapMs(it)) }
    @Volatile private var lastKeyAt = 0L

    private fun rawRes(s: Sfx): Int = when (s) {
        Sfx.TAP -> R.raw.sfx_tap
        Sfx.DELETE -> R.raw.sfx_delete
        Sfx.FLIP -> R.raw.sfx_flip
        Sfx.PRESS -> R.raw.sfx_press
        Sfx.RELEASE -> R.raw.sfx_release
        Sfx.HOP -> R.raw.sfx_hop
        Sfx.INVALID -> R.raw.sfx_invalid
        Sfx.WIN -> R.raw.sfx_win
        Sfx.LOSE -> R.raw.sfx_lose
        Sfx.CELEBRATE -> R.raw.sfx_celebrate
        Sfx.STREAK -> R.raw.sfx_streak
        Sfx.TICK -> R.raw.sfx_tick
        Sfx.NOTIFY -> R.raw.sfx_notify
        Sfx.UNLOCK -> R.raw.sfx_unlock
        Sfx.VS -> R.raw.sfx_vs
        Sfx.WHOOSH -> R.raw.sfx_whoosh
    }

    /** Load all 16 sounds once (idempotent; the decode itself runs on SoundPool's thread). */
    @Synchronized
    fun preload() {
        if (pool != null) return
        runCatching {
            val p = SoundPool.Builder()
                .setMaxStreams(8)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                .build()
            p.setOnLoadCompleteListener { _, sampleId, status -> if (status == 0) loaded.add(sampleId) }
            val ctx = App.instance
            Sfx.entries.forEach { s -> sampleIds[s.ordinal] = p.load(ctx, rawRes(s), 1) }
            pool = p
        }
    }

    /** Play [s] (muted when Sound Effects is off). [rate] = SoundPool pitch, [volume] × master. */
    fun play(s: Sfx, rate: Float = 1f, volume: Float = 1f) {
        if (s == Sfx.TAP || s == Sfx.DELETE) lastKeyAt = SystemClock.uptimeMillis()
        if (!enabled) return
        if (pool == null) preload()
        val p = pool ?: return
        val id = sampleIds[s.ordinal]
        if (id == 0 || id !in loaded) return
        val v = (FeedbackRules.MASTER_VOLUME * volume).coerceIn(0f, 1f)
        runCatching { p.play(id, v, v, 1, 0, rate.coerceIn(0.5f, 2f)) }
    }

    /** Spec U: an event's sound + haptic ([view] = the composable's LocalView, when there is one). */
    fun fire(event: FeedbackEvent, view: android.view.View? = null) {
        val gate = throttles[event]
        if (gate != null && !gate.allow(SystemClock.uptimeMillis())) return
        when (event.sound) {
            null -> Unit
            Sfx.TAP -> playKeyTap()
            else -> play(event.sound)
        }
        event.haptic?.let { Haptics.perform(it, view) }
    }

    /** True while a game key sound just played (a squish on the same touch stays quiet). */
    fun keyRecentlyPlayed(): Boolean =
        SystemClock.uptimeMillis() - lastKeyAt < FeedbackRules.SQUISH_QUIET_AFTER_KEY_MS

    // ── The original API (every existing call site keeps working) ─────────

    /** Key press: `tap`, pitch varied ±3 % per press. */
    fun playKeyTap() = play(Sfx.TAP, rate = FeedbackRules.tapRate(Random.nextDouble()))

    /** Not a word / wrong move. */
    fun playInvalid() = play(Sfx.INVALID)

    /** A game WIN only (the win popup / the game's win moment): `win`. Mid-game wins use [playPartial]. */
    fun playSuccess() = play(Sfx.WIN)

    /**
     * A partial success mid-game (a found word, a solved group, a check that's all right):
     * the short `notify` chime at 0.7 volume + a light haptic — never the win jingle.
     */
    fun playPartial(view: android.view.View? = null) {
        play(Sfx.NOTIFY, volume = FeedbackRules.PARTIAL_VOLUME)
        Haptics.perform(Haptic.LIGHT, view)
    }

    /** VS match found / start. */
    fun playVsStinger() = play(Sfx.VS)

    /** The opponent lands a guess row — a quiet flip. */
    fun playOpponentThunk() = play(Sfx.FLIP, volume = 0.7f)

    /** A loss (the old game-over chime). */
    fun playGameOver() = play(Sfx.LOSE)

    // ── New events (spec U) ────────────────────────────────────────────────

    fun playDelete() = play(Sfx.DELETE)
    fun playFlip() = play(Sfx.FLIP)
    fun playPress() = play(Sfx.PRESS)
    fun playRelease() = play(Sfx.RELEASE)
    fun playHop() = play(Sfx.HOP)
    fun playWin() = play(Sfx.WIN)
    fun playLose() = play(Sfx.LOSE)
    fun playCelebrate() = play(Sfx.CELEBRATE)
    fun playStreak() = play(Sfx.STREAK)
    fun playNotify() = play(Sfx.NOTIFY)
    fun playUnlock() = play(Sfx.UNLOCK)
    fun playVs() = play(Sfx.VS)
    fun playWhoosh() = play(Sfx.WHOOSH)

    /** Points count-up tick, throttled to ≤ 12 per second. */
    fun playTick() = fire(FeedbackEvent.TICK)

    /** Achievement unlock: `unlock` · success haptic (for the achievement popup). */
    fun achievementUnlocked(view: android.view.View? = null) = fire(FeedbackEvent.UNLOCK, view)
}
