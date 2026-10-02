package com.wordocious.app.ui

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
        CastTitle(pro = AuthService.isProActive)
        Spacer(Modifier.height(6.dp))
        HeaderControlsRow(profile, isGuest, onNav, onSettings, onSignIn)
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
 * Places the popup card just under the anchor (the controls row), centered across
 * the window with the card's own side margins.
 */
private class UnderAnchor(private val gapPx: Int) : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
        val x = ((windowSize.width - popupContentSize.width) / 2).coerceAtLeast(0)
        val y = (anchorBounds.bottom + gapPx).coerceAtMost((windowSize.height - popupContentSize.height).coerceAtLeast(0))
        return IntOffset(x, y)
    }
}

/** The whole-window dim behind a header popup (tap = dismiss). */
private object WindowOrigin : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset = IntOffset.Zero
}

/**
 * C5 a header popup: the page dims softly and the card sits just under the control
 * row it came from — a colored [header] gradient with the big 3D [icon], a friendly
 * [title] + [subtitle] and a [host] pose, then the body on the [tint].
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
    // The dim (its own window behind the card).
    Popup(popupPositionProvider = WindowOrigin, onDismissRequest = onDismiss, properties = PopupProperties(focusable = false)) {
        Box(Modifier.fillMaxSize().background(Color(0x471E0F3C)).clickableNoRipple(onDismiss))
    }
    Popup(
        popupPositionProvider = remember(density) { UnderAnchor(with(density) { 6.dp.roundToPx() }) },
        onDismissRequest = onDismiss,
        properties = PopupProperties(focusable = true, dismissOnClickOutside = true),
    ) {
        val appear = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
        LaunchedEffect(Unit) { appear.animateTo(1f, tween(220)) }
        val shape = RoundedCornerShape(24.dp)
        Box(Modifier.fillMaxWidth().padding(horizontal = 14.dp), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = 440.dp).fillMaxWidth()
                    .graphicsLayer {
                        alpha = appear.value
                        val s = 0.94f + 0.06f * appear.value
                        scaleX = s; scaleY = s
                        transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0f)
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
                body()
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

/** C5 the streak popup: warm orange header with the flame and S (trophy), Current + Best, this week. */
@Composable
private fun StreakPopup(p: com.wordocious.app.data.Profile, onDismiss: () -> Unit) {
    val current = p.dailyLoginStreak
    val best = maxOf(p.bestDailyLoginStreak, current)
    val playedToday = com.wordocious.app.data.DailyCompletionsService.readCache().isNotEmpty()
    val week = remember(current, playedToday) { StreakWeek.days(LocalDate.now(), current, playedToday) }
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
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PopupStatTile("$current", "CURRENT", STREAK_ORANGE, STREAK_LABEL, Modifier.weight(1f))
            PopupStatTile("$best", "BEST", STREAK_ORANGE, STREAK_LABEL, Modifier.weight(1f))
        }
        // This week as seven day tiles, filled orange for each day played.
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 4.dp, bottom = 2.dp)
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
        PopupBody("Play any daily puzzle each day to keep your streak going. Miss a day and it resets, unless a streak shield saves it.")
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
