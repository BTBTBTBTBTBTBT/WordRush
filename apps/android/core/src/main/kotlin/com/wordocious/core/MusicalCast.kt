package com.wordocious.core

import kotlin.math.abs
import kotlin.math.floor

// The musical cast easter egg (docs/cloud-prompts/10): long-press any cast puppet in the header → all ten turn
// "musical" (a staggered squash-and-pop, floating notes, a little glow); then each tap plays a note in that
// character's own voice. Left → right W O R D O C I O U S is a C major scale, C4 … E5. Play a public-domain tune
// correctly and a secret achievement unlocks (shown only once earned). Long-press again → back to normal laughs.
// Pure; 1:1 port of packages/core/src/musical-cast.ts, pinned by musical-cast-fixtures.json.
//
// Behind the musicalCast flag: ON in debug builds (BuildConfig.DEBUG), OFF in release until the founder approves.

data class MusicalNote(
    val castId: String,
    val index: Int,
    val midi: Int,
    val name: String,
    /** The sound name: note-<id> (res/raw/sfx_note_<id>); note-h-<id> (sfx_note_h_<id>) in a season with its own voicing. */
    val sound: String,
)

/** One squash-and-pop keyframe: t 0..1 → scale x / y, a little lift in % of height. */
data class MusicalPopKey(val t: Double, val sx: Double, val sy: Double, val lift: Double)

data class MusicalMelody(
    val id: String,
    val name: String,
    /** The secret achievement it unlocks. */
    val achievement: String,
    /** The tune as MIDI notes, in C. Matched by its intervals, so any key that fits counts. */
    val notes: List<Int>,
)

data class MelodyState(val notes: List<Int> = emptyList(), val lastAt: Long? = null)

data class MelodyTap(
    val state: MelodyState,
    val note: MusicalNote?,
    /** The tune just completed (the buffer then clears so it can't fire twice). */
    val matched: MusicalMelody?,
)

/** How long a press must hold to toggle musical mode, and the transform's timing. */
object MusicalTiming {
    const val longPressMs = 550L
    /** A finger that drifts further than this (dp) cancels the long-press. */
    const val moveSlop = 10
    /** Each character starts this much after its neighbor, rippling out from the one pressed. */
    const val staggerMs = 55L
    /** One character's squash-and-pop. */
    const val popMs = 420L
}

object MusicalCast {
    /** The flag: on in debug, off in release. */
    const val FLAG_DEBUG = true
    const val FLAG_RELEASE = false

    fun enabled(isDebugBuild: Boolean): Boolean = if (isDebugBuild) FLAG_DEBUG else FLAG_RELEASE

    /** The header's cast, left → right (WORDOCIOUS). */
    val CAST_IDS: List<String> = listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s")
    /** C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 as MIDI note numbers. */
    val SCALE: List<Int> = listOf(60, 62, 64, 65, 67, 69, 71, 72, 74, 76)

    private val NAMES = listOf("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

    /** "C4", "E5" … */
    fun midiNoteName(midi: Int): String = "${NAMES[((midi % 12) + 12) % 12]}${floor(midi / 12.0).toInt() - 1}"

    /**
     * In a season with its own spooky voicing (item 49) each cast member's note is `<prefix><id>`; other seasons: none.
     * The registry's `slots.sounds.note` names the same prefix; this is the core's mirror so the three apps agree.
     */
    val SEASON_NOTE_PREFIX: Map<String, String> = mapOf("halloween" to "note-h-")

    /** A cast member's note (unknown id → null). [season] = the active season id (null / unknown = the normal voices). */
    fun note(castId: String, season: String? = null): MusicalNote? {
        val index = CAST_IDS.indexOf(castId)
        if (index < 0) return null
        val midi = SCALE[index]
        val prefix = season?.let { SEASON_NOTE_PREFIX[it] } ?: "note-"
        return MusicalNote(castId, index, midi, midiNoteName(midi), "$prefix$castId")
    }

    // ── The transform ──────────────────────────────────────────────────────────────────────────────────────

    /** The squash-and-pop keyframes: squash, stretch up, settle. */
    val POP_KEYS: List<MusicalPopKey> = listOf(
        MusicalPopKey(0.0, 1.0, 1.0, 0.0),
        MusicalPopKey(0.22, 1.16, 0.82, 0.0),
        MusicalPopKey(0.5, 0.9, 1.14, 9.0),
        MusicalPopKey(0.74, 1.05, 0.96, 0.0),
        MusicalPopKey(1.0, 1.0, 1.0, 0.0),
    )

    /** The pop's (sx, sy, lift %) at [t] 0..1, linear between keys (outside → rest). */
    fun popAt(t: Double): MusicalPopKey {
        if (t <= 0.0 || t >= 1.0) return POP_KEYS.first().copy(t = t)
        for (i in 1 until POP_KEYS.size) {
            val b = POP_KEYS[i]
            if (t <= b.t) {
                val a = POP_KEYS[i - 1]
                val u = (t - a.t) / (b.t - a.t)
                return MusicalPopKey(t, a.sx + (b.sx - a.sx) * u, a.sy + (b.sy - a.sy) * u, a.lift + (b.lift - a.lift) * u)
            }
        }
        return POP_KEYS.last().copy(t = t)
    }

    /**
     * The per-character start delays (ms, WORDOCIOUS order): a ripple out from the pressed one (|i − pressed| × stagger).
     * Reduce Motion → every delay 0 (and the platforms swap instantly, no pop).
     */
    fun transformDelays(pressedCastId: String, reduceMotion: Boolean): List<Long> {
        val from = maxOf(0, CAST_IDS.indexOf(pressedCastId))
        return CAST_IDS.indices.map { i -> if (reduceMotion) 0L else abs(i - from) * MusicalTiming.staggerMs }
    }

    /** The whole transform's length (ms): the last delay + one pop; 0 under Reduce Motion. */
    fun transformDuration(pressedCastId: String, reduceMotion: Boolean): Long {
        if (reduceMotion) return 0L
        return transformDelays(pressedCastId, false).max() + MusicalTiming.popMs
    }

    // ── Melodies ───────────────────────────────────────────────────────────────────────────────────────────

    private const val C4 = 60
    private const val D4 = 62
    private const val E4 = 64
    private const val F4 = 65
    private const val G4 = 67
    private const val A4 = 69
    private const val B4 = 71
    private const val C5 = 72
    private const val D5 = 74

    /** Public-domain tunes (their best-known opening, every note on a cast key). */
    val MELODIES: List<MusicalMelody> = listOf(
        MusicalMelody("mary", "Mary Had a Little Lamb", "tune_little_lamb", listOf(E4, D4, C4, D4, E4, E4, E4, D4, D4, D4, E4, G4, G4)),
        MusicalMelody("twinkle", "Twinkle, Twinkle, Little Star", "tune_little_star", listOf(C4, C4, G4, G4, A4, A4, G4, F4, F4, E4, E4, D4, D4, C4)),
        MusicalMelody("ode", "Ode to Joy", "tune_ode_to_joy", listOf(E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4)),
        MusicalMelody("birthday", "Happy Birthday", "tune_happy_birthday", listOf(G4, G4, A4, G4, C5, B4, G4, G4, A4, G4, D5, C5)),
        MusicalMelody("buns", "Hot Cross Buns", "tune_hot_cross_buns", listOf(E4, D4, C4, E4, D4, C4, C4, C4, C4, C4, D4, D4, D4, D4, E4, D4, C4)),
    )

    private const val E5 = 76

    /**
     * The Halloween tunes (item 49): public-domain compositions on the cast's own keys (matched by interval shape).
     * In the Hall of the Mountain King (Grieg, 1875) and the Toccata and Fugue in D minor (Bach, BWV 565) opening; the
     * cast has no C#, so the Toccata plays the C natural. Also the Funeral March (Chopin, 1839), the Funeral March of a
     * Marionette (Gounod, 1872; G stands in for G#), Danse Macabre (Saint-Saens, 1874), Night on Bald Mountain
     * (Mussorgsky) and The Sorcerer's Apprentice (Dukas, 1897), each checked against a score and realized on the white
     * keys by interval shape (see musical-cast.ts). Only active in season; each is a hidden achievement.
     */
    val HALLOWEEN_MELODIES: List<MusicalMelody> = listOf(
        MusicalMelody("mountain_king", "In the Hall of the Mountain King", "tune_mountain_king", listOf(A4, B4, C5, D5, E5, C5, E5, D5, B4, D5)),
        MusicalMelody("toccata", "Toccata and Fugue in D minor", "tune_toccata", listOf(A4, G4, A4, G4, F4, E4, D4, C4, D4)),
        MusicalMelody("funeral_march", "Funeral March", "tune_funeral_march", listOf(A4, A4, A4, A4, C5, B4, B4, A4, A4, G4, A4)),
        MusicalMelody("marionette", "Funeral March of a Marionette", "tune_marionette", listOf(A4, A4, G4, F4, G4, A4, B4)),
        MusicalMelody("danse_macabre", "Danse Macabre", "tune_danse_macabre", listOf(A4, A4, C5, A4, B4, C5, A4, C5, A4, C5, B4, C5, B4, A4)),
        MusicalMelody("bald_mountain", "Night on Bald Mountain", "tune_bald_mountain", listOf(B4, C5, B4, A4, B4, C5, C5, E5, B4)),
        MusicalMelody("sorcerers_apprentice", "The Sorcerer's Apprentice", "tune_sorcerers_apprentice", listOf(A4, E5, A4, C5, A4, C5, B4, C5, A4, C5)),
    )

    /** Halloween tunes still waiting for checked notation: none (all five from the plan are wired above). */
    val HALLOWEEN_TUNES_TODO: List<String> = emptyList()

    /** The tunes that count right now: the everyday five, plus the season's own (halloween). */
    fun activeMelodies(season: String? = null): List<MusicalMelody> =
        if (season == "halloween") MELODIES + HALLOWEEN_MELODIES else MELODIES

    /** The steps between consecutive notes (the shape of a tune, key-free). */
    fun melodyIntervals(notes: List<Int>): List<Int> = (1 until notes.size).map { notes[it] - notes[it - 1] }

    /**
     * The tune the played notes END with, or null. A tune counts when its last N notes have the tune's exact shape (its
     * intervals) — in C or any other key the cast can play. Ties → the longest tune.
     */
    fun matchMelody(played: List<Int>, melodies: List<MusicalMelody> = MELODIES): MusicalMelody? {
        var best: MusicalMelody? = null
        for (m in melodies) {
            if (played.size < m.notes.size) continue
            val tail = played.subList(played.size - m.notes.size, played.size)
            if (melodyIntervals(tail) == melodyIntervals(m.notes) && (best == null || m.notes.size > best.notes.size)) best = m
        }
        return best
    }

    /** A pause longer than this starts a fresh phrase; the buffer keeps at most this many notes. */
    const val MELODY_GAP_MS = 4000L
    const val MELODY_BUFFER = 32

    val MELODY_START = MelodyState()

    /** One tap in musical mode at [atMs] (any clock in ms, e.g. SystemClock.uptimeMillis). Pure: returns the next state. */
    fun melodyTap(state: MelodyState, castId: String, atMs: Long, season: String? = null): MelodyTap {
        val note = note(castId, season) ?: return MelodyTap(state, null, null)
        val last = state.lastAt
        val fresh = last == null || atMs - last > MELODY_GAP_MS || atMs < last
        val notes = ((if (fresh) emptyList() else state.notes) + note.midi).takeLast(MELODY_BUFFER)
        val matched = matchMelody(notes, activeMelodies(season))
        return MelodyTap(MelodyState(if (matched != null) emptyList() else notes, atMs), note, matched)
    }

    /** The secret achievement keys (achievement-rules NEW_ACHIEVEMENTS, `secret`: shown only once unlocked). */
    val ACHIEVEMENT_KEYS: List<String> = (MELODIES + HALLOWEEN_MELODIES).map { it.achievement }
}

// ── Achievement listing (achievement-rules.ts SECRET_ACHIEVEMENT_KEYS / achievementListed) ─────────────────

/** The secret keys: awarded, but a locked one is never listed (it appears once unlocked). */
val SECRET_ACHIEVEMENT_KEYS: List<String> = MusicalCast.ACHIEVEMENT_KEYS

/** Should a catalog entry show in a player's list? Hidden never; a secret only once the player has it. */
fun achievementListed(hidden: Boolean, secret: Boolean, key: String, unlocked: (String) -> Boolean): Boolean {
    if (hidden) return false
    return !secret || unlocked(key)
}
