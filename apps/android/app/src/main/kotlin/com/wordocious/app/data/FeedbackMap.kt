package com.wordocious.app.data

/**
 * FINISH_SPEC U — the pure half of sound + haptics (no Android types, JVM-testable).
 *
 * The 16 sounds + the Sound Lab picks (res/raw/sfx_<name>.m4a), the haptic vocabulary, and the event map
 * (sound · haptic) every screen fires through [SoundManager] / [Haptics].
 */

/** The sound pack — [file] is the res/raw name (sfx_<name>). */
enum class Sfx(val file: String) {
    TAP("sfx_tap"),
    DELETE("sfx_delete"),
    FLIP("sfx_flip"),
    PRESS("sfx_press"),
    RELEASE("sfx_release"),
    HOP("sfx_hop"),
    INVALID("sfx_invalid"),
    WIN("sfx_win"),
    LOSE("sfx_lose"),
    CELEBRATE("sfx_celebrate"),
    STREAK("sfx_streak"),
    TICK("sfx_tick"),
    NOTIFY("sfx_notify"),
    UNLOCK("sfx_unlock"),
    VS("sfx_vs"),
    WHOOSH("sfx_whoosh"),

    // The founder's Sound Lab picks (docs/design/brand/sounds/make-sounds.py PICKS).
    /** The cold-start intro jingle (pick: "Marimba Parade"), ≈ 3 s. */
    INTRO("sfx_intro"),
    /** Classic's own picks (Sound Lab "Classic" rows), played instead of the pack sound while the
     *  Classic game screen is up (SoundManager.enterClassic); every other game keeps the pack's. */
    CLASSIC_INVALID("sfx_classic_invalid"),
    CLASSIC_STREAK("sfx_classic_streak"),
    CLASSIC_LOSE("sfx_classic_lose"),
    CLASSIC_WIN("sfx_classic_win"),

    /** The player's level going up (pick: "Rising Stairs"). */
    LEVELUP("sfx_levelup"),
    /** A game opening (pick: "Page Breeze"). */
    OPEN("sfx_open"),
    /** Hubbub pangram: a 1-up (Johnny 10-05; pick: "Triple Coin Climb"). */
    PANGRAM("sfx_pangram"),

    /** Each header hero's giggle (pick: "Giggles"), played by SoundManager.castLaugh. */
    LAUGH_W("sfx_laugh_w"), LAUGH_O1("sfx_laugh_o1"), LAUGH_R("sfx_laugh_r"), LAUGH_D("sfx_laugh_d"),
    LAUGH_O2("sfx_laugh_o2"), LAUGH_C("sfx_laugh_c"), LAUGH_I("sfx_laugh_i"), LAUGH_O3("sfx_laugh_o3"),
    LAUGH_U("sfx_laugh_u"), LAUGH_S("sfx_laugh_s"),
}

/** The haptic vocabulary (spec U): iOS UIImpactFeedbackGenerator / UINotificationFeedbackGenerator names. */
enum class Haptic { LIGHT, SELECTION, WARNING, SOFT, SUCCESS, SUCCESS_HEAVY, MEDIUM }

/** Spec U event map: each event = an optional sound and an optional haptic. */
enum class FeedbackEvent(val sound: Sfx?, val haptic: Haptic?) {
    KEY(Sfx.TAP, Haptic.LIGHT),
    DELETE(Sfx.DELETE, Haptic.LIGHT),
    FLIP(Sfx.FLIP, Haptic.SELECTION),
    ROW_LAND(null, Haptic.LIGHT),
    INVALID(Sfx.INVALID, Haptic.WARNING),
    PRESS(Sfx.PRESS, Haptic.SOFT),
    RELEASE(Sfx.RELEASE, null),
    HOP(Sfx.HOP, null),
    WIN(Sfx.WIN, Haptic.SUCCESS),
    LOSE(Sfx.LOSE, Haptic.SOFT),
    CELEBRATE(Sfx.CELEBRATE, Haptic.SUCCESS_HEAVY),
    STREAK(Sfx.STREAK, Haptic.MEDIUM),
    TICK(Sfx.TICK, null),
    NOTIFY(Sfx.NOTIFY, Haptic.LIGHT),
    UNLOCK(Sfx.UNLOCK, Haptic.SUCCESS),
    VS(Sfx.VS, Haptic.MEDIUM),
    WHOOSH(Sfx.WHOOSH, null),
    /** The cold-start intro, as the W pops (the animated intro only). */
    INTRO(Sfx.INTRO, null),
    /** The level goes up: the XP toast's "Level up!", or the tier popup when it crosses a tier. */
    LEVEL_UP(Sfx.LEVELUP, Haptic.SUCCESS),
    /** A game opens (GameMotion.gameEntered: solo, VS, pocket games). Never on close / back. */
    GAME_OPEN(Sfx.OPEN, null),
}

/** The tunables (spec U): master volume, tap pitch spread, tick throttle, squish quiet window. */
object FeedbackRules {
    /** Master volume for every sound (spec: ~0.6). */
    const val MASTER_VOLUME = 0.6f

    /** A partial success (found word, solved group): `notify` at this volume (× master). */
    const val PARTIAL_VOLUME = 0.7f

    /** `tap` pitch spread: ±3 % per press so typing never sounds robotic. */
    const val TAP_PITCH_SPREAD = 0.03f

    /** Points count-up ticks: at most 12 per second. */
    const val TICK_MAX_PER_SECOND = 12

    /** Minimum gap between two ticks (ceil(1000 / 12) = 84 ms, so never more than 12/s). */
    val TICK_MIN_GAP_MS: Long = (1000L + TICK_MAX_PER_SECOND - 1) / TICK_MAX_PER_SECOND

    /**
     * Not too noisy: a squish press/release that lands within this window of a game key
     * sound (tap/delete) is the same touch on a board or pad — the key sound wins.
     */
    const val SQUISH_QUIET_AFTER_KEY_MS = 350L

    /** Simultaneous reveals (Quad/Octo boards flip together) play one flip, not eight. */
    const val FLIP_MIN_GAP_MS = 45L

    /** One `correct-row land` per row: the hop wave's later tiles land inside this window. */
    const val ROW_LAND_MIN_GAP_MS = 800L

    /** The intro jingle owns the cold start: a `hop` inside this window after it starts stays quiet. */
    const val INTRO_QUIET_MS = 3000L

    /** Whether a `hop` at [nowMs] is covered by the intro jingle that started at [introAtMs] (0 = never played). */
    fun hopMutedByIntro(nowMs: Long, introAtMs: Long): Boolean =
        introAtMs > 0L && nowMs - introAtMs in 0 until INTRO_QUIET_MS

    /** The sounds the intro jingle covers: the landing hop and a game opening under it. */
    fun mutedByIntro(s: Sfx, nowMs: Long, introAtMs: Long): Boolean =
        (s == Sfx.HOP || s == Sfx.OPEN) && hopMutedByIntro(nowMs, introAtMs)

    /** One hero's giggle at most this often: longer than the longest giggle (never overlaps itself). */
    const val LAUGH_MIN_GAP_MS = 700L

    /** A header hero's giggle ([id] = MascotId.key: w, o1, r, … s), or null for an unknown id. */
    fun laughSfx(id: String): Sfx? = Sfx.entries.firstOrNull { it.file == "sfx_laugh_$id" }

    /** Classic's version of a pack sound (null = Classic plays the pack's). */
    fun classicVariant(s: Sfx): Sfx? = when (s) {
        Sfx.INVALID -> Sfx.CLASSIC_INVALID
        Sfx.STREAK -> Sfx.CLASSIC_STREAK
        Sfx.LOSE -> Sfx.CLASSIC_LOSE
        Sfx.WIN -> Sfx.CLASSIC_WIN
        else -> null
    }

    /** The per-event repeat throttle (0 = every time). */
    fun minGapMs(e: FeedbackEvent): Long = when (e) {
        FeedbackEvent.TICK -> TICK_MIN_GAP_MS
        FeedbackEvent.FLIP -> FLIP_MIN_GAP_MS
        FeedbackEvent.ROW_LAND -> ROW_LAND_MIN_GAP_MS
        FeedbackEvent.INTRO -> 5000L
        FeedbackEvent.LEVEL_UP -> 1500L
        else -> 0L
    }

    /** The SoundPool rate for a `tap`, from a uniform [unit] in [0, 1): 0.97 … 1.03. */
    fun tapRate(unit: Double): Float {
        val u = unit.coerceIn(0.0, 1.0).toFloat()
        return 1f - TAP_PITCH_SPREAD + 2f * TAP_PITCH_SPREAD * u
    }
}

/** Lets a repeating sound through at most every [minGapMs] (the count-up tick throttle). */
class FeedbackThrottle(private val minGapMs: Long = FeedbackRules.TICK_MIN_GAP_MS) {
    private var last = Long.MIN_VALUE

    @Synchronized
    fun allow(nowMs: Long): Boolean {
        if (last != Long.MIN_VALUE && nowMs - last < minGapMs) return false
        last = nowMs
        return true
    }
}
