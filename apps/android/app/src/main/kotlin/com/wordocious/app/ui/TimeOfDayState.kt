package com.wordocious.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.ui.theme.SeasonSurfaces
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TimeOfDay
import java.time.Duration
import java.time.LocalDateTime
import kotlinx.coroutines.delay

/**
 * Time of day (founder 10-16, docs/design/brand/seasons/time-of-day/NOTES.md v2): while a season shows, its wall, Home stage and every
 * window follow the device's LOCAL clock in four slots (morning 5-10, day 10-16, evening 16-19, night 19-5; core [TimeOfDay]).
 *
 * ONE app-wide state: [slot] (Compose state) is what the wall / stage / surfaces resolve against. It is the admin pin ([pref], the
 * `debug-tod` pref: auto|morning|day|evening|night, also `--es dressTod day` on MainActivity in debug builds) or the clock. A single
 * delayed callback re-arms at core [TimeOfDay.nextChange] (no polling) and the foreground (ON_START) re-reads the clock. Outside a
 * season nothing runs and nothing changes.
 */
object TimeOfDayState {
    /** The admin override pref key (same value space as the web `?tod=` / iOS `debug-tod`). */
    const val PREF_KEY = "debug-tod"

    /** The pinned slot, null = follow the clock (Auto). Observable. */
    var pref: TimeOfDay? by mutableStateOf(readPref())
        private set

    /** The slot the app is drawn in right now. Observable; the wall, stage and window colors cross-fade 600 ms on a change. */
    var slot: TimeOfDay by mutableStateOf(resolve())
        private set

    private fun readPref(): TimeOfDay? = runCatching { TimeOfDay.fromId(SettingsPref.get(PREF_KEY, "")) }.getOrNull()

    /** The slot for [now]: the pin, else the clock (pure given [pref]). */
    fun resolve(now: LocalDateTime = LocalDateTime.now()): TimeOfDay = pref ?: TimeOfDay.at(now)

    /** Settings (admin) / the debug intent: a slot id, or null / "auto" = follow the clock. Persists, re-resolves. */
    fun pick(id: String?) {
        pref = TimeOfDay.fromId(id)
        runCatching { SettingsPref.set(PREF_KEY, pref?.id ?: "auto") }
        slot = resolve()
    }

    /** DEBUG intent extra (`--es dressTod day|auto`), mirrors DressDemo.applySeason. */
    fun applyExtra(extra: String?) {
        if (!com.wordocious.app.BuildConfig.DEBUG || extra.isNullOrBlank()) return
        pick(extra)
    }

    /** Re-reads the clock (foreground, a timer fire). */
    fun refresh() {
        val next = resolve()
        if (next != slot) slot = next
    }

    /** The slot after the current one (the one to prewarm). */
    fun next(from: TimeOfDay = slot): TimeOfDay = TimeOfDay.entries[(from.ordinal + 1) % TimeOfDay.entries.size] // Morning, Day, Evening, Night, Morning...

    /** Milliseconds until the clock slot next changes (core [TimeOfDay.nextChange]); at least 1 s. */
    fun msToNextChange(now: LocalDateTime = LocalDateTime.now()): Long =
        Duration.between(now, TimeOfDay.nextChange(now)).toMillis().coerceAtLeast(1_000L)

    /** Crossfade spec for the wall / stage (instant under Reduce Motion). */
    fun fadeMs(): Int = if (WTheme.reducedMotion) 0 else TimeOfDay.FADE_MS
}

/**
 * The app-wide host (compose once, under the theme): arms the single boundary timer, re-reads on foreground, and animates the window
 * colors (WTheme.season + palette, so every Composable reading them tweens) 600 ms to the new slot's look. Reduce Motion = instant.
 */
@Composable
fun TimeOfDayHost() {
    val ctx = LocalContext.current
    val season = rememberSeason()
    val pref = TimeOfDayState.pref
    var wake by remember { mutableIntStateOf(0) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val obs = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_START) wake++ }
        owner.lifecycle.addObserver(obs)
        onDispose { owner.lifecycle.removeObserver(obs) }
    }
    // The clock: one delayed callback to the next boundary (none when pinned or out of season).
    LaunchedEffect(season != null, pref, wake) {
        if (season == null) return@LaunchedEffect
        while (true) {
            TimeOfDayState.refresh()
            if (pref != null) break
            delay(TimeOfDayState.msToNextChange() + 250L)
        }
    }
    // The window colors follow the slot (and the season's own changes apply instantly: SeasonKit.applySurfaces).
    val slot = TimeOfDayState.slot
    val last = remember { arrayOf<Any?>(null, null) }
    LaunchedEffect(slot, season) {
        val seasonChanged = last[1] != season
        val slotChanged = last[0] != null && last[0] != slot
        last[0] = slot; last[1] = season
        val to = SeasonKit.currentLook(ctx)
        val from = WTheme.season
        if (!slotChanged || seasonChanged || season == null || from == null || to == null || from == to || WTheme.reducedMotion) {
            SeasonKit.applyLook(to)
            return@LaunchedEffect
        }
        val base = com.wordocious.app.ui.theme.Palettes.byKey(com.wordocious.app.data.ThemePref.current())
        try {
            animate(0f, 1f, animationSpec = tween(TimeOfDay.FADE_MS, easing = FastOutSlowInEasing)) { t, _ ->
                SeasonKit.applyLook(SeasonSurfaces.lerp(from, to, t), base)
            }
        } finally {
            // Cancelled by a newer slot: that run starts from the in-between look; completed: land exactly on the target.
            if (TimeOfDayState.slot == slot) SeasonKit.applyLook(to, base)
        }
    }
}
