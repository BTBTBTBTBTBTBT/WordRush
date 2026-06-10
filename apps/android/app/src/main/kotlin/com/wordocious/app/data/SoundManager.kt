package com.wordocious.app.data

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.pow
import kotlin.math.sin

/**
 * Synthesized game sounds — Android port of web lib/sounds.ts (and iOS
 * SoundManager.swift). All sounds are short synthesized tones, generated as
 * PCM and played through a throwaway AudioTrack; no audio assets.
 *
 * Exact web parameters (frequency Hz / duration s / gain / start offset ms):
 *   keyTap   800/0.04/0.06
 *   invalid  200/0.15/0.08 + 150/0.15/0.06 @80ms
 *   success  523/0.12/0.10 + 659/0.12/0.10 @100ms + 784/0.20/0.12 @200ms
 *   gameOver 392/0.20/0.10 + 330/0.20/0.10 @150ms + 262/0.30/0.08 @300ms
 *
 * Fade envelope per iOS: (1 - t/duration)^1.5 (the web uses an exponential
 * gain ramp to 0.001 — perceptually equivalent). Sine waves throughout, like
 * iOS (web mixes square/sawtooth; iOS normalized to sine).
 *
 * Preference: SettingsPref.SOUND ("pref-sound"), default ON — same key the
 * Settings "Sound Effects" switch writes.
 */
object SoundManager {
    private const val SAMPLE_RATE = 44100
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val enabled get() = SettingsPref.get(SettingsPref.SOUND, true)

    fun playKeyTap() {
        if (!enabled) return
        tone(800.0, 0.04, 0.06f)
    }

    fun playInvalid() {
        if (!enabled) return
        tone(200.0, 0.15, 0.08f)
        tone(150.0, 0.15, 0.06f, delayMs = 80)
    }

    fun playSuccess() {
        if (!enabled) return
        tone(523.0, 0.12, 0.10f)
        tone(659.0, 0.12, 0.10f, delayMs = 100)
        tone(784.0, 0.20, 0.12f, delayMs = 200)
    }

    /** VS match-found stinger — web playVsStinger (392/0.10/g0.10 + 523/0.18/g0.10 @100ms). */
    fun playVsStinger() {
        if (!enabled) return
        tone(392.0, 0.10, 0.10f)
        tone(523.0, 0.18, 0.10f, delayMs = 100)
    }

    /** Soft thunk whenever the opponent lands a guess row — web playOpponentThunk (220/0.06/g0.05). */
    fun playOpponentThunk() {
        if (!enabled) return
        tone(220.0, 0.06, 0.05f)
    }

    fun playGameOver() {
        if (!enabled) return
        tone(392.0, 0.20, 0.10f)
        tone(330.0, 0.20, 0.10f, delayMs = 150)
        tone(262.0, 0.30, 0.08f, delayMs = 300)
    }

    // PCM cache — key taps fire on every key press; synthesizing once is enough.
    private val pcmCache = HashMap<String, ShortArray>()

    private fun synth(freq: Double, duration: Double, volume: Float): ShortArray {
        val key = "$freq:$duration:$volume"
        pcmCache[key]?.let { return it }
        val frames = (SAMPLE_RATE * duration).toInt().coerceAtLeast(1)
        val w = 2.0 * PI * freq
        val pcm = ShortArray(frames) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val env = (1.0 - i.toDouble() / frames).pow(1.5)
            (sin(w * t) * volume * env * Short.MAX_VALUE).toInt().toShort()
        }
        pcmCache[key] = pcm
        return pcm
    }

    private fun tone(freq: Double, duration: Double, volume: Float, delayMs: Long = 0) {
        scope.launch {
            if (delayMs > 0) delay(delayMs)
            val pcm = synth(freq, duration, volume)
            runCatching {
                val track = AudioTrack(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                    AudioFormat.Builder()
                        .setSampleRate(SAMPLE_RATE)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                    pcm.size * 2,
                    AudioTrack.MODE_STATIC,
                    AudioManager.AUDIO_SESSION_ID_GENERATE,
                )
                track.write(pcm, 0, pcm.size)
                track.play()
                delay((duration * 1000).toLong() + 60)
                track.release()
            }
        }
    }
}
