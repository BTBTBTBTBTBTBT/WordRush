package com.wordocious.app.ui

import androidx.compose.ui.semantics.heading
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Shared top header for every tab (Home, Leaderboard, Stats, Friends). FINISH_SPEC:
 * A5 the living cast header — the ten cast heroes spelling WORDOCIOUS edge to edge,
 * one character at a time playing its move (Pro wears the crown on W over a soft gold
 * glow line, the header's only Pro marker); C1 / A3 the controls row under it — the
 * streak / flawless / shield counts and the help / settings controls as bare soft 3D
 * icons (no bubbles) with soft numbers, squishing on press; C5 the streak and shield
 * popups, anchored under the tapped control. Mirrors web `app-header.tsx` and iOS
 * `AppHeaderView`.
 */
@Composable
fun AppHeader(
    onNav: (String) -> Unit = {},
    onSettings: () -> Unit = {},
    onSignIn: () -> Unit = {},
) {
    val profile by AuthService.profile.collectAsState()
    val isGuest by AuthService.isGuest.collectAsState()
    Column(
        // N3: 9 dp breathing room under the status bar; N4: the controls row 6 dp below the cast.
        modifier = Modifier.fillMaxWidth().padding(top = 9.dp, bottom = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // AS2 (founder 10-02): the controls row (streak · shield · ? · settings) ON TOP, the
        // WORDOCIOUS cast row under it.
        HeaderControlsRow(profile, isGuest, onNav, onSettings, onSignIn)
        Spacer(Modifier.height(4.dp))
        CastTitle(pro = AuthService.isProActive)
    }
}

/**
 * A5 the cast row, edge to edge (a 2 dp gutter). Pro: the crown on W and a soft gold
 * glow line beneath the row.
 */
@Composable
private fun CastTitle(pro: Boolean) {
    // FINISH_SPEC N3: the cast row at ≈90% of the width, centered (not edge to edge), on a
    // soft elliptical ground shadow in the page accent (~14%, blurred by its own falloff).
    val accent = LocalPageTint.current?.accent ?: Color(0xFF7C3AED)
    Box(
        Modifier.fillMaxWidth(CAST_ROW_WIDTH_FRACTION)
            .drawBehind {
                val w = size.width * 0.92f
                val h = 14.dp.toPx()
                val cx = size.width / 2f
                val cy = size.height - h * 0.35f
                drawOval(
                    Brush.radialGradient(
                        listOf(accent.copy(alpha = 0.14f), accent.copy(alpha = 0.07f), Color.Transparent),
                        center = Offset(cx, cy), radius = w / 2f,
                    ),
                    topLeft = Offset(cx - w / 2f, cy - h / 2f), size = Size(w, h),
                )
            },
        contentAlignment = Alignment.BottomCenter,
    ) {
        if (pro) {
            // #f59e0b at ~25%, 2 dp, blurred (blur is API 31+; the faded ends carry it below).
            Box(
                Modifier.fillMaxWidth(0.86f).height(2.dp).blur(2.dp, androidx.compose.ui.draw.BlurredEdgeTreatment.Unbounded)
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color.Transparent, Color(0xFFF59E0B).copy(alpha = 0.25f), Color(0xFFF59E0B).copy(alpha = 0.25f), Color.Transparent),
                        ),
                    ),
            )
        }
        LivingCastHeader(Modifier.fillMaxWidth().padding(bottom = if (pro) 3.dp else 0.dp), crown = pro)
    }
}

/** Which header popup is open (C5). */
private enum class HeaderPop { STREAK, FLAWLESS, SHIELD }

@Composable
private fun HeaderControlsRow(
    profile: com.wordocious.app.data.Profile?,
    isGuest: Boolean,
    onNav: (String) -> Unit,
    onSettings: () -> Unit,
    onSignIn: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    var open by remember { mutableStateOf<HeaderPop?>(null) }
    Column(Modifier.fillMaxWidth()) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {

        // Counts read AuthService.headerStreak/headerShields, not `profile` directly:
        // the profile row lands a beat after launch, so gating on it made the counts pop
        // in a second late on every cold start. Those fall back to the last known values
        // for exactly that window, and are null on a first launch or after sign-out so
        // nothing is drawn. The popups still need the real row, so a tap during the
        // window is inert.
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            val streak = AuthService.headerStreak ?: 0
            if (streak > 0) {
                SoftControl(
                    Icon3DName.FLAME, "$streak day streak",
                    onClick = { if (profile != null) open = HeaderPop.STREAK },
                    number = "$streak",
                )
            }
            // §244: flawless-streak count — the day-stamped cache written by
            // dailySweepStats(), synchronous like the other header values. Only a
            // live run (>= 2) earns header real estate.
            val flawlessStreak = com.wordocious.app.data.MatchStatsService.cachedFlawlessStreak()
            if (flawlessStreak >= 2) {
                SoftControl(
                    Icon3DName.TROPHY, "$flawlessStreak day flawless streak",
                    onClick = { open = HeaderPop.FLAWLESS },
                    number = "$flawlessStreak",
                )
            }
            val shields = AuthService.headerShields
            if (shields != null) {
                SoftControl(
                    Icon3DName.SHIELD, "$shields streak ${if (shields == 1) "shield" else "shields"}",
                    onClick = { if (profile != null) open = HeaderPop.SHIELD },
                    number = "$shields",
                )
            }
        }

        // Guest — the Sign In entry, a small candy pill (A8). Opens sign-in as a
        // DISMISSIBLE overlay, matching iOS: guest state is untouched, so backing out
        // returns you to the exact tab you were on.
        if (isGuest) {
            CandyButton("Sign In", onClick = onSignIn, size = CandySize.SMALL)
            Spacer(Modifier.width(2.dp))
        }
        SoftControl(Icon3DName.HELP, "Help", onClick = { menuOpen = true })
        if (menuOpen) {
            InfoMenuSheet(onNav = { menuOpen = false; onNav(it) }, onDismiss = { menuOpen = false })
        }
        SoftControl(Icon3DName.GEAR, "Settings", onClick = onSettings)
    }
    // C5 the popups, anchored just under this controls row (this zero-height strip sits
    // right below it, so the popup's anchor bottom is the row's bottom edge).
    Box(Modifier.fillMaxWidth()) {
        val p = profile
        when (open) {
            HeaderPop.STREAK -> if (p != null) StreakPopup(p, onDismiss = { open = null })
            HeaderPop.SHIELD -> if (p != null) ShieldPopup(p.streakShields, onDismiss = { open = null })
            HeaderPop.FLAWLESS -> FlawlessPopup(com.wordocious.app.data.MatchStatsService.cachedFlawlessStreak(), onDismiss = { open = null })
            null -> Unit
        }
    }
    }
}

// ── C5 · streak + shield popups ───────────────────────────────────────────

/**
 * C5 this week's played days (Monday first) for a [streak]-day run as of [today]:
 * the run ends today when [playedToday], else yesterday, and covers [streak]
 * consecutive days back from there. (A shield-saved day inside the run counts as
 * kept; there is no per-day history on the client.)
 */
object StreakWeek {
    fun days(today: LocalDate, streak: Int, playedToday: Boolean): List<Boolean> {
        val monday = today.with(DayOfWeek.MONDAY)
        if (streak <= 0) return List(7) { false }
        val end = if (playedToday) today else today.minusDays(1)
        val start = end.minusDays((streak - 1).toLong())
        return List(7) { i ->
            val d = monday.plusDays(i.toLong())
            !d.isBefore(start) && !d.isAfter(end)
        }
    }

    val LABELS = listOf("M", "T", "W", "T", "F", "S", "S")
}

/**
 * C5 / AS6 a header popup, presented at the WINDOW level (a full-screen Dialog — it used to
 * be a Popup anchored inside the header, which on some devices only shaded the header
 * strip): the whole screen dims (tap = dismiss) and the card springs in centered — a
 * colored [header] gradient with the big 3D [icon], a friendly [title] + [subtitle] and a
 * [host] pose, then the scrollable body on the [tint].
 */
@Composable
private fun HeaderPopup(
    onDismiss: () -> Unit,
    tint: Color,
    header: Brush,
    icon: Icon3DName,
    title: String,
    subtitle: String,
    host: Pair<MascotId, String>,
    body: @Composable ColumnScope.() -> Unit,
) {
    val density = androidx.compose.ui.platform.LocalDensity.current
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        // Our own scrim covers the whole window (the platform dim is turned off).
        val view = androidx.compose.ui.platform.LocalView.current
        androidx.compose.runtime.SideEffect {
            (view.parent as? androidx.compose.ui.window.DialogWindowProvider)?.window?.setDimAmount(0f)
        }
        val appear = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
        LaunchedEffect(Unit) { appear.animateTo(1f, tween(220)) }
        val shape = RoundedCornerShape(24.dp)
        Box(
            Modifier.fillMaxSize()
                .graphicsLayer { alpha = appear.value }
                .background(Color(0x661E0F3C))
                .clickableNoRipple(onDismiss)
                .systemBarsPadding()
                .padding(horizontal = 14.dp, vertical = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier.widthIn(max = 440.dp).fillMaxWidth()
                    .graphicsLayer {
                        val s = 0.92f + 0.08f * appear.value
                        scaleX = s; scaleY = s
                    }
                    // The card's lift (0 18 40 rgba(40,15,80,.35)).
                    .shadow(16.dp, shape, clip = false, ambientColor = Color(0x59280F50), spotColor = Color(0x59280F50))
                    .clip(shape)
                    .background(if (WTheme.isDark) WTheme.surface else tint)
                    .clickableNoRipple { /* the card itself never dismisses */ },
            ) {
                // The colored header: big 3D icon, headline + subline, the host on the right.
                Box(Modifier.fillMaxWidth().background(header)) {
                    Row(
                        Modifier.fillMaxWidth().padding(start = 16.dp, end = 86.dp, top = 14.dp, bottom = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon3D(icon, 58.dp)
                        Column(Modifier.semantics(mergeDescendants = true) { contentDescription = "$title. $subtitle" }) {
                            Text(
                                title, fontSize = 21.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = Color.White,
                                style = androidx.compose.ui.text.TextStyle(
                                    shadow = androidx.compose.ui.graphics.Shadow(Color(0x1F000000), Offset(0f, 2f * density.density), 0f),
                                ),
                            )
                            Text(subtitle, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color.White.copy(alpha = 0.9f))
                        }
                    }
                    CastPose(host.first, host.second, 74.dp, Modifier.align(Alignment.BottomEnd).offset(x = (-8).dp, y = 6.dp))
                }
                Column(Modifier.fillMaxWidth().verticalScroll(androidx.compose.foundation.rememberScrollState())) { body() }
            }
        }
    }
}

/** C5 a soft-number stat tile (CURRENT / BEST) on the popup, tinted in [accent] with a top bar. */
@Composable
private fun PopupStatTile(value: String, label: String, accent: Color, labelInk: Color, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier.clip(shape)
            .background(accentWash(accent, 0.12f))
            .border(1.5.dp, accentLine(accent, 0.30f), shape)
            .drawBehind { drawRect(accent, size = androidx.compose.ui.geometry.Size(size.width, 4.dp.toPx())) }
            .padding(top = 10.dp, bottom = 8.dp, start = 10.dp, end = 10.dp)
            .semantics(mergeDescendants = true) { },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SoftNumber(value, 28.sp)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, color = labelInk)
    }
}

@Composable
private fun PopupBody(text: String) {
    Text(
        text, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, lineHeight = 19.sp,
        color = if (WTheme.isDark) WTheme.textSecondary else Color(0xFF5A4A72),
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp),
    )
}

private val STREAK_ORANGE = Color(0xFFF5A524)
private val STREAK_LABEL = Color(0xFFA2560C)

/**
 * C5 / AS7 the streak popup — ALL the streak info in one place (the Home banner rows no longer
 * carry their own flames): the daily streak (current + best) and this week; the Wordocious
 * and Puzzles sweep streaks (regular chips); the flawless streaks in their own gold section
 * (Wordocious + Puzzles, current + best, shown once ever achieved); the shields and how they
 * work. Labeled chips with the 3D icons and soft numbers, no emoji.
 */
@Composable
private fun StreakPopup(p: com.wordocious.app.data.Profile, onDismiss: () -> Unit) {
    val current = p.dailyLoginStreak
    val best = maxOf(p.bestDailyLoginStreak, current)
    val playedToday = com.wordocious.app.data.DailyCompletionsService.readCache().isNotEmpty()
    val week = remember(current, playedToday) { StreakWeek.days(LocalDate.now(), current, playedToday) }
    // The rows' current runs paint at once from the banner's day-stamped cache; the bests land after a fetch.
    val rows = remember { com.wordocious.app.data.HomeStreaksService.cachedRowStreaks() }
    var summary by remember {
        mutableStateOf(
            StreakSummary(
                wordSweep = rows?.wordSweep ?: 0, puzzlesSweep = rows?.puzzlesSweep ?: 0,
                wordFlawless = maxOf(rows?.wordFlawless ?: 0, com.wordocious.app.data.MatchStatsService.cachedFlawlessStreak()),
                wordFlawlessBest = 0, puzzlesFlawless = rows?.puzzlesFlawless ?: 0, puzzlesFlawlessBest = 0,
            ),
        )
    }
    val flagTable by com.wordocious.app.data.FlagsService.flags.collectAsState()
    val flagsLoaded by com.wordocious.app.data.FlagsService.loaded.collectAsState()
    LaunchedEffect(flagsLoaded) {
        val keys = MORE_CARDS.filter { it.dailyEligible && it.dbKey != null && com.wordocious.app.data.FlagsService.isOn(it.flagKey, flagTable, flagsLoaded) }
            .mapNotNull { it.dbKey }
        val sweep = runCatching { com.wordocious.app.data.MatchStatsService.dailySweepStats() }.getOrNull()
        val puzzles = runCatching { com.wordocious.app.data.HomeStreaksService.puzzleRecords(keys) }.getOrNull()
        summary = summary.merge(
            wordSweep = sweep?.currentSweepStreak, wordFlawless = sweep?.currentFlawlessStreak, wordFlawlessBest = sweep?.bestFlawlessStreak,
            puzzlesSweep = puzzles?.streaks?.sweep, puzzlesFlawless = puzzles?.streaks?.flawless, puzzlesFlawlessBest = puzzles?.totals?.bestFlawless,
        )
    }
    HeaderPopup(
        onDismiss = onDismiss,
        tint = Color(0xFFFFF6EA),
        header = Brush.linearGradient(
            0f to Color(0xFFFFB36B), 0.6f to STREAK_ORANGE, 1f to Color(0xFFFF8A5C),
            start = Offset.Zero, end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
        ),
        icon = Icon3DName.FLAME,
        title = if (current > 0) "$current-day streak!" else "Daily streak",
        subtitle = when {
            current <= 0 -> "Play any daily to start one."
            current >= best -> "Your best ever. Keep it rolling."
            else -> "Keep it rolling."
        },
        host = MascotId.S to "trophy",
    ) {
        StreakSectionLabel("DAILY STREAK")
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PopupStatTile("$current", "CURRENT", STREAK_ORANGE, STREAK_LABEL, Modifier.weight(1f))
            PopupStatTile("$best", "BEST", STREAK_ORANGE, STREAK_LABEL, Modifier.weight(1f))
        }
        // This week as seven day tiles, filled orange for each day played.
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 6.dp, bottom = 2.dp)
                .semantics { contentDescription = "This week: ${week.count { it }} of 7 days played" },
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            week.forEachIndexed { i, on ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(StreakWeek.LABELS[i], fontSize = 10.sp, fontWeight = FontWeight.Black, color = STREAK_LABEL)
                    WeekDayTile(on)
                }
            }
        }

        StreakSectionLabel("SWEEP STREAKS")
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StreakChip("WORDOCIOUS", summary.wordSweep, null, gold = false, Modifier.weight(1f)) { Icon3D(Icon3DName.FLAME, 24.dp) }
            StreakChip("PUZZLES", summary.puzzlesSweep, null, gold = false, Modifier.weight(1f)) { Icon3D(Icon3DName.FLAME, 24.dp) }
        }

        val flawless = summary.flawlessRows()
        if (flawless.isNotEmpty()) {
            StreakSectionLabel("FLAWLESS STREAKS", color = FLAWLESS_LABEL)
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                flawless.forEach { r ->
                    StreakChip(r.label, r.current, r.best, gold = true, Modifier.weight(1f)) {
                        androidx.compose.foundation.Image(artPainter(com.wordocious.app.R.drawable.art_scene_flawless_star, 26.dp), null, Modifier.size(26.dp))
                    }
                }
                if (flawless.size == 1) Spacer(Modifier.weight(1f))
            }
        }

        StreakSectionLabel("STREAK SHIELDS")
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp)
                .semantics(mergeDescendants = true) { contentDescription = "${p.streakShields} streak shields" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            SoftNumber("${p.streakShields}", 22.sp)
            repeat(minOf(p.streakShields, 4)) { Icon3D(Icon3DName.SHIELD, 28.dp) }
            Icon3D(Icon3DName.SHIELD, 28.dp, alpha = 0.28f, colorFilter = Icon3DMuted)
        }
        PopupBody("Play any daily puzzle each day to keep your streak going. Miss a day and a shield saves it; without one it resets. Earn a free shield at every 7-day milestone; Pro members get 4 each billing period.")
    }
}

private val FLAWLESS_GOLD = Color(0xFFF5A524)
private val FLAWLESS_LABEL = Color(0xFFB45309)

/** AS7 a small caps section label in the streak popup. */
@Composable
private fun StreakSectionLabel(text: String, color: Color = STREAK_LABEL) {
    Text(
        text, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
        color = if (WTheme.isDark) WTheme.textMuted else color,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 6.dp).semantics { heading() },
    )
}

/** AS7 one labeled streak chip: icon, caps label, the current run as a soft number (+ BEST). [gold] = the flawless style. */
@Composable
private fun StreakChip(label: String, current: Int, best: Int?, gold: Boolean, modifier: Modifier = Modifier, icon: @Composable () -> Unit) {
    val accent = if (gold) FLAWLESS_GOLD else STREAK_ORANGE
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.clip(shape)
            .background(if (gold) Brush.verticalGradient(listOf(Color(0xFFFFF1C2), Color(0xFFFFE08A))) else Brush.verticalGradient(listOf(accentWash(accent, 0.12f), accentWash(accent, 0.12f))))
            .border(1.5.dp, accentLine(accent, if (gold) 0.55f else 0.30f), shape)
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = "$label: $current" + (best?.let { ", best $it" } ?: "")
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        icon()
        Column {
            Text(label, fontSize = 9.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp, color = if (gold) FLAWLESS_LABEL else STREAK_LABEL, maxLines = 1)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SoftNumber("$current", 20.sp)
                if (best != null) Text("BEST $best", fontSize = 9.5.sp, fontWeight = FontWeight.Black, color = if (gold) FLAWLESS_LABEL else STREAK_LABEL, modifier = Modifier.padding(bottom = 3.dp))
            }
        }
    }
}

/**
 * AS7 the streak popup's numbers (pure, unit tested): the sweep runs and the flawless runs
 * (current + best). A flawless row shows once that streak was ever achieved (current or
 * best above 0); a never-achieved one is hidden.
 */
data class StreakSummary(
    val wordSweep: Int,
    val puzzlesSweep: Int,
    val wordFlawless: Int,
    val wordFlawlessBest: Int,
    val puzzlesFlawless: Int,
    val puzzlesFlawlessBest: Int,
) {
    data class FlawlessRow(val label: String, val current: Int, val best: Int)

    /** Fresh fetched values over the cached ones (null = that fetch failed; keep what we had). Best never below current. */
    fun merge(
        wordSweep: Int? = null, wordFlawless: Int? = null, wordFlawlessBest: Int? = null,
        puzzlesSweep: Int? = null, puzzlesFlawless: Int? = null, puzzlesFlawlessBest: Int? = null,
    ): StreakSummary = copy(
        wordSweep = wordSweep ?: this.wordSweep,
        puzzlesSweep = puzzlesSweep ?: this.puzzlesSweep,
        wordFlawless = wordFlawless ?: this.wordFlawless,
        wordFlawlessBest = maxOf(wordFlawlessBest ?: this.wordFlawlessBest, wordFlawless ?: this.wordFlawless),
        puzzlesFlawless = puzzlesFlawless ?: this.puzzlesFlawless,
        puzzlesFlawlessBest = maxOf(puzzlesFlawlessBest ?: this.puzzlesFlawlessBest, puzzlesFlawless ?: this.puzzlesFlawless),
    )

    /** The gold flawless rows to show: Wordocious, then Puzzles, each only once ever achieved. */
    fun flawlessRows(): List<FlawlessRow> = buildList {
        val wb = maxOf(wordFlawlessBest, wordFlawless)
        if (wordFlawless > 0 || wb > 0) add(FlawlessRow("WORDOCIOUS FLAWLESS", wordFlawless, wb))
        val pb = maxOf(puzzlesFlawlessBest, puzzlesFlawless)
        if (puzzlesFlawless > 0 || pb > 0) add(FlawlessRow("PUZZLES FLAWLESS", puzzlesFlawless, pb))
    }
}

@Composable
private fun WeekDayTile(on: Boolean) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        Modifier.padding(top = 2.dp).fillMaxWidth().height(28.dp)
            .then(
                if (on) Modifier
                    .drawBehind { drawRoundRect(Color(0xFFB0650B), topLeft = Offset(0f, 2.dp.toPx()), cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx())) }
                    .padding(bottom = 2.dp)
                    .clip(shape)
                    .background(Brush.verticalGradient(listOf(Color(0xFFFFB36B), STREAK_ORANGE)))
                else Modifier.clip(shape)
                    .background(Color(0x73FFD6A0))
                    .dashedBorder(1.5.dp, Color(0x59D97706), 8.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (on) Icon3D(Icon3DName.BADGE_CHECK, 20.dp)
    }
}

/** C5 the shield popup: purple header with the shield and U (lotus); the shields as a row of 3D shields. */
@Composable
private fun ShieldPopup(shields: Int, onDismiss: () -> Unit) {
    HeaderPopup(
        onDismiss = onDismiss,
        tint = Color(0xFFF5EFFF),
        header = Brush.linearGradient(
            0f to Color(0xFFA78BFA), 0.6f to Color(0xFF7C3AED), 1f to Color(0xFF6D28D9),
            start = Offset.Zero, end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
        ),
        icon = Icon3DName.SHIELD,
        title = "$shields streak ${if (shields == 1) "shield" else "shields"}",
        subtitle = if (shields > 0) "Your streak is protected." else "Earn one at your next 7-day milestone.",
        host = MascotId.U to "lotus",
    ) {
        // Up to four earned shields, then the next one to earn, faded.
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 2.dp)
                .semantics { contentDescription = "$shields shields" },
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        ) {
            repeat(minOf(shields, 4)) { Icon3D(Icon3DName.SHIELD, 40.dp) }
            Icon3D(Icon3DName.SHIELD, 40.dp, alpha = 0.28f, colorFilter = Icon3DMuted)
        }
        PopupBody("A shield saves your streak if you miss a day. Earn a free one at every 7-day milestone; Pro members get 4 each billing period.")
    }
}

/** The flawless-streak popup in the same family: gold header, the trophy and O2 cheering (A7). */
@Composable
private fun FlawlessPopup(days: Int, onDismiss: () -> Unit) {
    HeaderPopup(
        onDismiss = onDismiss,
        tint = Color(0xFFFFF8E6),
        header = Brush.linearGradient(
            0f to Color(0xFFFFD166), 0.6f to Color(0xFFF5A524), 1f to Color(0xFFF59E0B),
            start = Offset.Zero, end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
        ),
        icon = Icon3DName.TROPHY,
        title = "$days-day flawless run!",
        subtitle = "Every Daily Sweep game won.",
        host = MascotId.O2 to "cheer",
    ) {
        Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 4.dp)) {
            PopupStatTile("$days", "CURRENT", STREAK_ORANGE, STREAK_LABEL, Modifier.weight(1f))
        }
        PopupBody("Consecutive days winning every Daily Sweep game. Win them all today to keep it alive.")
    }
}

/** FINISH_SPEC N3: the cast row's share of the screen width (centered, not edge to edge). */
const val CAST_ROW_WIDTH_FRACTION = 0.9f
