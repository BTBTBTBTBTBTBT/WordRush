package com.wordocious.app.ui

import androidx.compose.ui.draw.drawBehind
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.ProfileService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * Profile-social layer for the PUBLIC profile screen — the approved
 * "profile social" redesign (scratchpad mock profile-preview.html):
 * presence + today-ring + identity chips, You-vs-Them, Trophy Case,
 * Highlights, Lately feed, and the spoiler-guarded board viewer.
 *
 * Everything renders from best-effort fetches; a missing persona/H2H/board
 * simply hides its section — the classic profile below never breaks.
 */

// ═══════════════════════════ shared bits ════════════════════════════════════

private val BrandPink = Color(0xFFEC4899)
private val BrandPurpleDeep = Color(0xFF7C3AED)
private val Teal = Color(0xFF0D9488)
private val Green = Color(0xFF22C55E)

/** "daily-YYYY-MM-DD-MODE" → MODE (underscores intact). */
internal fun seedModeName(seed: String): String? =
    Regex("^daily-\\d{4}-\\d{2}-\\d{2}-(.+)$").find(seed)?.groupValues?.get(1)

/** DB mode string → display title via the modeTitle helper (DUEL_6 → "SIX"). */
internal fun modeTitleFromDb(name: String?): String =
    name?.let { n -> runCatching { GameMode.valueOf(n) }.getOrNull()?.let { modeTitle(it) } ?: n } ?: ""

private fun clock(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)

/** "yyyy-MM-dd" → Today / Yesterday / weekday / "MMM d" (best-effort). */
private fun relativeDayLabel(day: String): String = runCatching {
    val d = java.time.LocalDate.parse(day)
    val today = java.time.LocalDate.parse(com.wordocious.app.todayLocalDate())
    when (val diff = java.time.temporal.ChronoUnit.DAYS.between(d, today)) {
        0L -> "Today"
        1L -> "Yesterday"
        in 2..6 -> d.dayOfWeek.getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.US)
        else -> d.format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
    }
}.getOrDefault(day)

private fun shortDayLabel(day: String): String = runCatching {
    java.time.LocalDate.parse(day).format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
}.getOrDefault(day)

/** Card header caption — mock .cardtitle, as the finishing kit's FinishLabel. */
@Composable
private fun CardTitle(text: String, accent: Color = SOCIAL_PURPLE) {
    // 2.8 item 17: the named sections (TROPHY CASE, HIGHLIGHTS, LATELY, HEAD TO HEAD) wear the bubble lettering in their cast
    // color; composite captions ("YOU vs NAME") keep the quiet caps line.
    val hex = com.wordocious.core.StatsProfile.SECTION_TITLE_COLORS[text]
    if (hex != null) {
        BubbleText(text, ThemeKit.accentPalette(coreHexColor(hex)), Modifier.widthIn(max = 240.dp), maxSize = 20, minSize = 13, align = androidx.compose.ui.text.style.TextAlign.Start)
    } else FinishLabel(text, color = darkenInk(accent))
}

/**
 * The card every section sits on (mock .card) in the finishing look: a tinted card in
 * [accent] with its top bar (A1); a tappable card squishes (A9).
 */
@Composable
private fun SocialCard(
    accent: Color = SOCIAL_PURPLE,
    onClick: (() -> Unit)? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    TintedCard(
        accent,
        Modifier.fillMaxWidth().then(if (onClick != null) Modifier.squishClickable(label = null, onClick = onClick) else Modifier),
        // BJ7: 12 padding / 8 spacing (was 14 / 9), a slimmer bar.
        corner = 18.dp, barHeight = 5.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 12.dp, end = 12.dp, top = 11.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/** The profile-social accents. */
private val SOCIAL_PURPLE = Color(0xFF7C3AED)
private val SOCIAL_PINK = Color(0xFFEC4899)
private val SOCIAL_GOLD = Color(0xFFF59E0B)
private val SOCIAL_BLUE = Color(0xFF2563EB)

/** A8 a dialog's close action: a medium candy button. */
@Composable
private fun DialogDone(label: String, onDismiss: () -> Unit) {
    CandyButton(label, onClick = onDismiss, color = CandyColor.PURPLE, size = CandySize.MEDIUM)
}

// ═══════════════════════ 1 · identity: presence + ring + chips ══════════════

/** "Played 12 minutes ago" + pulsing green dot from profiles.last_seen_at. */
@Composable
fun PresenceLine(lastSeenAt: String?) {
    val minutes = rememberMinutesSince(lastSeenAt) ?: return
    if (minutes >= 7 * 24 * 60) return   // stale beyond a week — say nothing
    val live = minutes < 15
    val text = when {
        minutes < 3 -> "Playing now"
        minutes < 60 -> "Played $minutes minutes ago"
        minutes < 24 * 60 -> "Played ${minutes / 60} ${if (minutes / 60 == 1L) "hour" else "hours"} ago"
        else -> "Played ${minutes / (24 * 60)} ${if (minutes / (24 * 60) == 1L) "day" else "days"} ago"
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        val dotColor = if (live) Green else WTheme.textMuted
        // AQ2: the glow is read in the draw pass (no per-frame recomposition); still while scrolling.
        val glowAlpha: androidx.compose.runtime.State<Float> = if (live && !WTheme.reducedMotion && !ambientMotionPaused()) {
            val transition = rememberInfiniteTransition(label = "presence")
            transition.animateFloat(
                initialValue = 0.25f, targetValue = 0.05f,
                animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Reverse),
                label = "presenceGlow",
            )
        } else androidx.compose.runtime.remember(live) { androidx.compose.runtime.mutableFloatStateOf(if (live) 0.18f else 0f) }
        Box(contentAlignment = Alignment.Center) {
            if (live) Box(Modifier.size(13.dp).drawBehind { drawCircle(Green.copy(alpha = glowAlpha.value)) })
            Box(Modifier.size(7.dp).clip(CircleShape).background(dotColor))
        }
        Text(text, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
    }
}

@Composable
private fun rememberMinutesSince(instant: String?): Long? {
    if (instant.isNullOrBlank()) return null
    return runCatching {
        val then = java.time.Instant.parse(if (instant.endsWith("Z") || instant.contains('+')) instant else instant + "Z")
        java.time.Duration.between(then, java.time.Instant.now()).toMinutes().coerceAtLeast(0)
    }.getOrNull()
}

/** Progress ring + "N/total today" capsule wrapped around the avatar — total =
 *  the sweep size from the catalog (Stage 9: 8), never a literal. [square]
 *  (ART_SPEC §20): the avatar is a letter tile of [avatarSize], so the ring is a
 *  concentric rounded square (same stroke) instead of a circle. */
@Composable
fun TodayRingAvatar(
    completed: Int,
    total: Int = com.wordocious.app.ModeGen.sweep.size,
    square: Boolean = false,
    avatarSize: androidx.compose.ui.unit.Dp = 96.dp,
    content: @Composable () -> Unit,
) {
    val ringColor = WTheme.primary
    val track = WTheme.border
    Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(bottom = 6.dp)) {
        Canvas(Modifier.size(avatarSize + 16.dp)) {   // BJ7: the ring follows the avatar (112 at 96)
            val stroke = 5.dp.toPx()
            val arcSize = Size(size.width - stroke, size.height - stroke)
            val topLeft = Offset(stroke / 2f, stroke / 2f)
            val frac = if (completed > 0) completed.coerceAtMost(total).toFloat() / total else 0f
            if (square) {
                // Concentric with the tile: its 24% radius plus the gap out to the stroke's center line.
                val radius = avatarSize.toPx() * 0.24f + (arcSize.width - avatarSize.toPx()) / 2f
                val path = roundedSquareRingPath(topLeft, arcSize, radius)
                drawPath(path, track, style = Stroke(stroke, cap = StrokeCap.Round))
                if (frac > 0f) {
                    val measure = androidx.compose.ui.graphics.PathMeasure()
                    measure.setPath(path, false)
                    val seg = androidx.compose.ui.graphics.Path()
                    measure.getSegment(0f, measure.length * frac, seg, true)
                    drawPath(seg, ringColor, style = Stroke(stroke, cap = StrokeCap.Round))
                }
            } else {
                drawArc(
                    color = track, startAngle = -90f, sweepAngle = 360f, useCenter = false,
                    topLeft = topLeft, size = arcSize, style = Stroke(stroke, cap = StrokeCap.Round),
                )
                if (completed > 0) {
                    drawArc(
                        color = ringColor, startAngle = -90f,
                        sweepAngle = 360f * frac, useCenter = false,
                        topLeft = topLeft, size = arcSize, style = Stroke(stroke, cap = StrokeCap.Round),
                    )
                }
            }
        }
        content()
        Text(
            "$completed/$total today",
            fontSize = 9.5.sp, fontWeight = FontWeight.Black, color = Color.White,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .offset(y = 8.dp)
                .clip(RoundedCornerShape(50))
                .background(ringColor)
                .padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

/** A rounded-square outline that starts at top-center and runs clockwise (so a
 *  partial segment reads like the circular ring's -90° start). */
private fun roundedSquareRingPath(topLeft: Offset, size: Size, radius: Float): androidx.compose.ui.graphics.Path {
    val l = topLeft.x; val t = topLeft.y; val r = l + size.width; val b = t + size.height
    val rad = radius.coerceIn(0f, minOf(size.width, size.height) / 2f)
    val d = rad * 2f
    return androidx.compose.ui.graphics.Path().apply {
        moveTo((l + r) / 2f, t)
        lineTo(r - rad, t)
        arcTo(androidx.compose.ui.geometry.Rect(r - d, t, r, t + d), -90f, 90f, false)
        lineTo(r, b - rad)
        arcTo(androidx.compose.ui.geometry.Rect(r - d, b - d, r, b), 0f, 90f, false)
        lineTo(l + rad, b)
        arcTo(androidx.compose.ui.geometry.Rect(l, b - d, l + d, b), 90f, 90f, false)
        lineTo(l, t + rad)
        arcTo(androidx.compose.ui.geometry.Rect(l, t, l + d, t + d), 180f, 90f, false)
        close()
    }
}

private data class ChipStyle(val fg: Color, val border: Color, val bg: Color)

@Composable
private fun IdentityChip(text: String, style: ChipStyle, onClick: (() -> Unit)? = null, art: GlyphArt? = null) {
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(style.bg)
            .border(1.5.dp, style.border, RoundedCornerShape(50))
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(horizontal = 10.dp, vertical = 4.5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (art != null) GlyphArtImage(art, 14.dp)
        Text(
            if (onClick != null) "$text ›" else text,
            fontSize = 10.sp, fontWeight = FontWeight.Black, color = style.fg, letterSpacing = 0.4.sp,
        )
    }
}

/** AL addendum 2: each archetype's badge art (was ⛏️ ⚡ 🎯 🦉 🏹 emoji). */
private fun archetypeArt(a: String): GlyphArt = when (a) {
    "GRINDER" -> GlyphArt.GRID; "SPEEDRUNNER" -> GlyphArt.ZAP; "SNIPER" -> GlyphArt.TARGET
    "NIGHT_OWL" -> GlyphArt.SPARKLES; else -> GlyphArt.SWORDS
}

private fun archetypeLabel(a: String): String = a.replace('_', ' ')

/**
 * Chips row under the username: Level (existing badge, relocated here) +
 * archetype + best percentile + signature opener. Archetype taps through to
 * the explainer sheet.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IdentityChipsRow(
    level: Int,
    persona: ProfileService.Persona?,
    onArchetypeTap: () -> Unit,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        // FINISH_SPEC V3: the tier badge with "LVL N" in soft numbers + the tier, on a tier-tinted pill.
        Row(
            Modifier.align(Alignment.CenterVertically)
                .tintedPill(TierInk.accent(com.wordocious.core.levelTier(level)), 50.dp)
                .padding(start = 6.dp, end = 11.dp, top = 5.dp, bottom = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) { LevelBadge(level, 26.dp, numberSize = 14.sp, prefix = "LVL", showTier = true) }
        if (persona != null) {
            IdentityChip(
                archetypeLabel(persona.archetype),
                ChipStyle(BrandPurpleDeep, Color(0xFFC4B5FD), BrandPurpleDeep.copy(alpha = 0.08f)),
                onClick = onArchetypeTap,
                art = archetypeArt(persona.archetype),
            )
            persona.bestPercentile?.takeIf { it.topPct > 0 }?.let { pct ->
                IdentityChip(
                    "TOP ${pct.topPct}% · ${modeTitleFromDb(pct.mode)}",
                    ChipStyle(Teal, Color(0xFF5EEAD4), Teal.copy(alpha = 0.08f)),
                )
            }
            persona.opener?.takeIf { it.word.isNotBlank() }?.let { op ->
                IdentityChip(
                    "OPENS WITH “${op.word.uppercase()}”",
                    ChipStyle(BrandPink, Color(0xFFF9A8D4), BrandPink.copy(alpha = 0.07f)),
                )
            }
        }
    }
}

/** Archetype explainer — the 5 archetypes plus the viewer's own. */
@Composable
fun ArchetypeDialog(targetName: String, targetArchetype: String, onDismiss: () -> Unit) {
    val viewerId = AuthService.userId
    val myArchetype by produceState(initialValue = null as String?, viewerId) {
        value = viewerId?.let { id ->
            runCatching { ProfileService.fetchPersona(id)?.archetype }.getOrNull()
        }
    }
    AlertDialog(
        modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
        onDismissRequest = onDismiss,
        containerColor = accentWash(SOCIAL_PURPLE, 0.10f),
        confirmButton = { DialogDone("Done", onDismiss) },
        title = { HeadingArt(Heading.ARCHETYPES, height = 36.dp, contentDescription = "Player archetypes") },   // BJ16
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()).heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    "Computed from recent daily play — the rarest habit wins.",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                listOf(
                    "GRINDER" to "Sweeps every daily, day after day.",
                    "SPEEDRUNNER" to "Average solve under 90 seconds.",
                    "SNIPER" to "Averages 3.6 guesses or fewer.",
                    "NIGHT_OWL" to "40%+ of dailies played late at night.",
                    "CHALLENGER" to "Still writing their story — the starting archetype.",
                ).forEach { (key, desc) ->
                    val isTarget = key == targetArchetype
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            // BJ7: no outlined boxes — the target reads by its deeper wash.
                            .background(accentWash(BrandPurpleDeep, if (isTarget) 0.24f else 0.10f))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            GlyphArtImage(archetypeArt(key), 16.dp)
                            Text(archetypeLabel(key), fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (isTarget) BrandPurpleDeep else WTheme.text)
                            if (isTarget) Text(targetName, fontSize = 9.sp, fontWeight = FontWeight.Black, color = BrandPurpleDeep)
                            if (key == myArchetype) Text("YOU", fontSize = 9.sp, fontWeight = FontWeight.Black, color = BrandPink)
                        }
                        Text(desc, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                    }
                }
            }
        },
    )
}

// ═══════════════════════ 2 · You vs Them ════════════════════════════════════

@Composable
fun YouVsThemCard(
    targetName: String,
    h2h: ProfileService.H2HSummary,
    todayShared: ProfileService.SharedDaily?,
    onCardTap: () -> Unit,
    onTodayTap: (ProfileService.SharedDaily) -> Unit,
) {
    SocialCard(SOCIAL_PINK, onClick = onCardTap) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            CardTitle("YOU vs ${targetName.uppercase()}", SOCIAL_PINK)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // A2: the head-to-head as soft numbers (the leader's side in its color).
                SoftNumber("${h2h.viewerWins}", 26.sp, color = if (h2h.viewerWins >= h2h.targetWins && !WTheme.isDark) BrandPurpleDeep else null)
                SoftNumber(" – ", 26.sp)
                SoftNumber("${h2h.targetWins}", 26.sp, color = if (h2h.targetWins > h2h.viewerWins) BrandPink else null)
            }
            Column(horizontalAlignment = Alignment.End) {
                val lead = when {
                    h2h.viewerWins > h2h.targetWins -> "You lead"
                    h2h.targetWins > h2h.viewerWins -> "$targetName leads"
                    else -> "All tied"
                }
                Text(lead, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                Text("${h2h.shared.size} shared dailies", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
            }
        }
        if (todayShared != null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickableNoRipple { onTodayTap(todayShared) }
                    .tintedPill(SOCIAL_PURPLE, 12.dp)
                    .padding(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(modeTitleFromDb(todayShared.gameMode), fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = BrandPurpleDeep)
                Text(
                    "today — $targetName ${formatScore(todayShared.targetScore)}, you ${formatScore(todayShared.viewerScore)}",
                    fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        LockedNote()
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            VsStat("AVG GUESSES", h2h.targetAvgGuess?.let { "%.1f".format(it) } ?: "—", h2h.viewerAvgGuess?.let { "%.1f".format(it) } ?: "—", Modifier.weight(1f))
            VsStat("AVG SOLVE", h2h.targetAvgTime?.let { clock(it) } ?: "—", h2h.viewerAvgTime?.let { clock(it) } ?: "—", Modifier.weight(1f))
            VsStat("SWEEPS", "${h2h.targetSweeps}", "${h2h.viewerSweeps}", Modifier.weight(1f))
        }
    }
}

@Composable
private fun VsStat(label: String, them: String, you: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, letterSpacing = 0.8.sp)
        Row {
            Text(them, style = softNumberStyle(14.sp, BrandPink))
            Text(" / ", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
            Text(you, style = softNumberStyle(14.sp))
        }
    }
}

/** H2H drill-down: every shared daily — date, mode, both scores, winner dot. */
@Composable
fun H2HDetailDialog(targetName: String, h2h: ProfileService.H2HSummary, onDismiss: () -> Unit) {
    AlertDialog(
        modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
        onDismissRequest = onDismiss,
        containerColor = accentWash(SOCIAL_PURPLE, 0.10f),
        confirmButton = { DialogDone("Done", onDismiss) },
        title = {   // BJ16: HEAD TO HEAD lettering, the rival under it
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                HeadingArt(Heading.H2H, height = 34.dp, contentDescription = "You vs $targetName")
                Text("vs @$targetName", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted, modifier = Modifier.clearAndSetSemantics { })
            }
        },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()).heightIn(max = 440.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    "${h2h.shared.size} shared dailies · winner by daily score",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                )
                h2h.shared.forEach { s ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(accentWash(SOCIAL_PURPLE, 0.10f))
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(
                            Modifier.size(8.dp).clip(CircleShape).background(
                                when (s.winner) {
                                    1 -> WTheme.primary
                                    2 -> BrandPink
                                    else -> WTheme.textMuted
                                },
                            ),
                        )
                        Column(Modifier.weight(1f)) {
                            Text(modeTitleFromDb(s.gameMode), fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                            Text(shortDayLabel(s.day), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("You ${formatScore(s.viewerScore)}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (s.winner == 1) WTheme.primary else WTheme.textSecondary)
                            Text("$targetName ${formatScore(s.targetScore)}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (s.winner == 2) BrandPink else WTheme.textSecondary)
                        }
                    }
                }
                LockedNote()
            }
        },
    )
}

// ═══════════════════════ guarded board viewer ═══════════════════════════════

/** Read-only reconstruction of another player's solved daily board. */
@Composable
fun GuardedBoardDialog(targetId: String, targetName: String, seed: String, onDismiss: () -> Unit) {
    val fetch by produceState(initialValue = null as ProfileService.BoardFetch?, targetId, seed) {
        value = runCatching { ProfileService.fetchGuardedBoard(targetId, seed) }
            .getOrDefault(ProfileService.BoardFetch.Unavailable)
    }
    val modeName = seedModeName(seed)
    AlertDialog(
        modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
        onDismissRequest = onDismiss,
        containerColor = accentWash(SOCIAL_PURPLE, 0.10f),
        confirmButton = { DialogDone("Close", onDismiss) },
        title = { Text("$targetName · ${modeTitleFromDb(modeName)}", fontWeight = FontWeight.Black) },
        text = {
            when (val f = fetch) {
                null -> CastLoader("LOADING BOARD", Modifier.fillMaxWidth().padding(vertical = 16.dp))
                is ProfileService.BoardFetch.Locked -> Column(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon3D(Icon3DName.LOCK, 40.dp)
                    Text(
                        "Finish today's ${modeTitleFromDb(modeName)} first — no spoilers",
                        fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text, textAlign = TextAlign.Center,
                    )
                    Text(
                        "Boards open only for dailies you've finished.",
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                    )
                }
                is ProfileService.BoardFetch.Unavailable -> BrandEmptyState(
                    // A missing board gets O3's not-found scene (ART_SPEC §7) + BI24 headline.
                    title = "BOARD NOT FOUND", line = "This board isn't available right now.",
                    scene = SceneArt.NOT_FOUND, artHeight = 96.dp,
                )
                is ProfileService.BoardFetch.Ready -> Column(
                    Modifier.verticalScroll(rememberScrollState()).heightIn(max = 440.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    val b = f.board
                    Text(
                        listOfNotNull(
                            if (b.won) "Won" else "Lost",
                            "${b.guesses.size} ${if (b.guesses.size == 1) "guess" else "guesses"}",
                            b.timeSeconds.takeIf { it > 0 }?.let { clock(it) },
                            b.hintsUsed.takeIf { it > 0 }?.let { "$it ${if (it == 1) "hint" else "hints"}" },
                        ).joinToString(" · "),
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary,
                    )
                    ReadOnlyBoards(b)
                }
            }
        },
    )
}

@Composable
private fun ReadOnlyBoards(board: ProfileService.BoardDetail) {
    val solutions = board.solutions.filter { it.isNotBlank() }
    if (solutions.isEmpty()) {
        BrandEmptyState(
            title = "NO BOARD SAVED", line = "This game finished without a board to show.",
            scene = SceneArt.NOT_FOUND, artHeight = 80.dp,
        )
        return
    }
    if (solutions.size == 1) {
        ReadOnlyBoard(solutions[0], board.guesses, Modifier.widthIn(max = 220.dp))
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            solutions.chunked(2).forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    pair.forEach { sol -> ReadOnlyBoard(sol, board.guesses, Modifier.weight(1f)) }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

/** Tile rows re-evaluated with core evaluateGuess; stops after the solving row. */
@Composable
private fun ReadOnlyBoard(solution: String, guesses: List<String>, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        var solved = false
        guesses.forEach { g ->
            if (solved) return@forEach
            val eval = runCatching { evaluateGuess(solution, g) }.getOrNull() ?: return@forEach
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.fillMaxWidth()) {
                eval.tiles.forEach { t ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height(26.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (t.state == TileState.EMPTY) WTheme.surfaceAlt else WTheme.tileColor(t.state)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(t.letter, fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }
            if (eval.isCorrect) solved = true
        }
    }
}

// ═══════════════════════ 3 · Trophy Case ════════════════════════════════════

@Composable
fun TrophyCaseCard(
    gold: Int,
    silver: Int,
    bronze: Int,
    flawless: ProfileService.PersonaFlawless?,
    onTap: () -> Unit,
) {
    SocialCard(SOCIAL_GOLD, onClick = onTap) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            CardTitle("TROPHY CASE", SOCIAL_GOLD)
        }
        TrophyShelfView(gold, silver, bronze)
        flawless?.takeIf { it.count > 0 }?.let { fl ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .tintedPill(SOCIAL_PURPLE, 12.dp)
                    .padding(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                GlyphArtImage(GlyphArt.DIAMOND, 18.dp)
                Text("Rarest: ", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                Text("Flawless Victory ×${fl.count}", fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = BrandPurpleDeep, modifier = Modifier.weight(1f))
                Text("held by ${fl.pctOfPlayers}% of players", fontSize = 10.sp, fontWeight = FontWeight.Black, color = BrandPink)
            }
        }
    }
}

/** AL addendum 2: each medal type's art (was 🥇 🥈 🥉 💎 🔥 🏅 emoji). */
private fun medalArt(type: String): GlyphArt = when (type) {
    "gold" -> GlyphArt.GOLD; "silver" -> GlyphArt.SILVER; "bronze" -> GlyphArt.BRONZE; "perfect" -> GlyphArt.DIAMOND
    "streak_7", "streak_30", "streak_100" -> GlyphArt.FLAME
    else -> GlyphArt.MEDAL
}

private fun medalLabel(m: ProfileService.UserMedal): String = when (m.medalType) {
    "gold" -> "Gold · ${modeTitleFromDb(m.gameMode)}"
    "silver" -> "Silver · ${modeTitleFromDb(m.gameMode)}"
    "bronze" -> "Bronze · ${modeTitleFromDb(m.gameMode)}"
    "perfect" -> "Perfect game · ${modeTitleFromDb(m.gameMode)}"
    "streak_7" -> "7-day streak"
    "streak_30" -> "30-day streak"
    "streak_100" -> "100-day streak"
    else -> m.medalType
}

/** Medal history — every medal; podium rows tap through to that day's podium. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MedalHistorySheet(
    targetName: String,
    medals: List<ProfileService.UserMedal>,
    onPodium: (day: String, gameMode: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    SoftModalSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = accentWash(SOCIAL_GOLD, 0.08f), dragHandle = null) {
        Column(
            Modifier.padding(horizontal = 16.dp, vertical = 18.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PageTitleText("$targetName's medals", fontSize = 18.sp)
            if (medals.isEmpty()) {
                BrandEmptyState(
                    title = "NO MEDALS YET", line = "Top-three daily finishes earn medals.",
                    host = MascotId.U, artHeight = 80.dp,
                )
            }
            medals.forEach { m ->
                val podiumable = m.medalType in setOf("gold", "silver", "bronze") &&
                    !m.gameMode.isNullOrBlank() && m.gameMode != "ALL"
                Row(
                    Modifier
                        .fillMaxWidth()
                        .then(
                            if (podiumable) Modifier.clickableNoRipple { onPodium(m.day, m.gameMode!!) } else Modifier,
                        )
                        .tintedPill(medalTint(m.medalType), 12.dp)
                        .padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    GlyphArtImage(medalArt(m.medalType), 22.dp)
                    Column(Modifier.weight(1f)) {
                        Text(medalLabel(m), fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(shortDayLabel(m.day), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** One day+mode podium — 3 rows; tapping a row opens that player's profile. */
@Composable
fun PodiumDialog(
    day: String,
    gameMode: String,
    onOpenProfile: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val podium by produceState(initialValue = null as List<ProfileService.PodiumEntry>?, day, gameMode) {
        value = runCatching { ProfileService.fetchPodium(day, gameMode) }.getOrDefault(emptyList())
    }
    AlertDialog(
        modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
        onDismissRequest = onDismiss,
        containerColor = accentWash(SOCIAL_PURPLE, 0.10f),
        confirmButton = { DialogDone("Close", onDismiss) },
        title = { Text("${modeTitleFromDb(gameMode)} · ${shortDayLabel(day)}", fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                when {
                    podium == null -> CastLoader("LOADING PODIUM", Modifier.fillMaxWidth().padding(vertical = 16.dp))
                    podium!!.isEmpty() -> BrandEmptyState(
                        title = "NO PODIUM", line = "Nobody made the podium that day.",
                        scene = SceneArt.ASLEEP, artHeight = 80.dp,
                    )
                    else -> podium!!.forEachIndexed { i, e ->
                        // C2 / A1: each place on its medal's tint, a medal disc, the soft score.
                        val medal = PodiumInk.medal(i + 1)
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickableNoRipple { onOpenProfile(e.userId) }
                                .tintedPill(medal, 10.dp)
                                .padding(start = 10.dp, end = 12.dp, top = 11.dp, bottom = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Box(Modifier.size(22.dp).clip(CircleShape).background(medal), contentAlignment = Alignment.Center) {
                                Text("${i + 1}", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White)
                            }
                            LetterTileAvatar(e.username, 26.dp)
                            Text(e.username, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text, modifier = Modifier.weight(1f), maxLines = 1)
                            SoftNumber(formatScore(e.score), 14.sp)
                        }
                    }
                }
            }
        },
    )
}

// ═══════════════════════ 4 · Highlights ═════════════════════════════════════

data class ProfileHighlight(val art: GlyphArt, val big: String, val cap: String, val onTap: (() -> Unit)? = null)

@Composable
fun HighlightsCard(highlights: List<ProfileHighlight>) {
    if (highlights.isEmpty()) return
    // Item 17: never a lonely tile with an empty half — one highlight folds into a single centered line above Lately, two or more
    // fill an even 2-column grid (core highlightsLayout drops an odd last one).
    val layout = com.wordocious.core.StatsProfile.highlightsLayout(highlights.size)
    val shown = highlights.take(layout.shown)
    if (layout.fold) {
        val h = shown.first()
        Row(
            Modifier.fillMaxWidth().then(if (h.onTap != null) Modifier.clickableNoRipple(h.onTap) else Modifier).padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
        ) {
            GlyphArtImage(h.art, 20.dp)
            Text(h.big, style = softNumberStyle(15.sp), maxLines = 1)
            Text(h.cap, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
        }
        return
    }
    SocialCard(Color(0xFFF97316)) {
        CardTitle("HIGHLIGHTS")
        shown.chunked(2).forEach { pair ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                pair.forEach { h ->
                    Column(
                        Modifier
                            .weight(1f)
                            .then(if (h.onTap != null) Modifier.clickableNoRipple(h.onTap) else Modifier)
                            .tintedPill(Color(0xFFF97316), 13.dp)
                            .padding(start = 10.dp, end = 10.dp, top = 10.dp, bottom = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        GlyphArtImage(h.art, 22.dp)
                        Text(h.big, style = softNumberStyle(16.sp), maxLines = 1)
                        Text(h.cap, fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
                    }
                }
            }
        }
    }
}

/** 60-day streak calendar — dot grid, gold ring on 9/9 days. */
@Composable
fun StreakCalendarDialog(
    targetName: String,
    dayCounts: Map<String, Int>,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
        onDismissRequest = onDismiss,
        containerColor = accentWash(SOCIAL_PURPLE, 0.10f),
        confirmButton = { DialogDone("Done", onDismiss) },
        title = { Text("$targetName · last 60 days", fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val days = remember60Days()
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    days.chunked(10).forEach { week ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            week.forEach { day ->
                                val n = dayCounts[day] ?: 0
                                val flawlessDay = n >= com.wordocious.app.ModeGen.requiredSweepCount(day)
                                Box(
                                    Modifier
                                        .size(18.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                flawlessDay -> WTheme.gold
                                                n > 0 -> WTheme.primary
                                                else -> WTheme.surfaceAlt
                                            },
                                        )
                                        .then(
                                            if (flawlessDay) Modifier.border(2.dp, WTheme.goldBorder, CircleShape)
                                            else Modifier.border(1.dp, WTheme.border, CircleShape),
                                        ),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    if (n in 1..8) {
                                        Text("$n", fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                                    }
                                }
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    LegendDot(WTheme.primary, "played")
                    LegendDot(WTheme.gold, "full sweep")
                    LegendDot(WTheme.surfaceAlt, "missed")
                }
            }
        },
    )
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(9.dp).clip(CircleShape).background(color).border(1.dp, WTheme.border, CircleShape))
        Text(label, fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/** Oldest → newest local dates, 60 of them, ending today. */
private fun remember60Days(): List<String> = runCatching {
    val today = java.time.LocalDate.parse(com.wordocious.app.todayLocalDate())
    (59 downTo 0).map { today.minusDays(it.toLong()).toString() }
}.getOrDefault(emptyList())

// ═══════════════════════ 5 · Lately + nemesis ═══════════════════════════════

data class LatelyItem(val art: GlyphArt, val text: String, val whenLabel: String, val onTap: (() -> Unit)? = null)

/** Build the feed: medals grouped per day (newest 3 days) + login streak. */
fun buildLatelyItems(
    medals: List<ProfileService.UserMedal>,
    loginStreak: Int,
    onMedals: () -> Unit,
    onStreak: () -> Unit,
): List<LatelyItem> {
    val items = mutableListOf<LatelyItem>()
    val podiumTypes = setOf("gold", "silver", "bronze")
    medals.filter { it.medalType in podiumTypes || it.medalType == "perfect" }
        .groupBy { it.day }
        .entries.sortedByDescending { it.key }
        .take(3)
        .forEach { (day, dayMedals) ->
            val gold = dayMedals.count { it.medalType == "gold" }
            val silver = dayMedals.count { it.medalType == "silver" }
            val bronze = dayMedals.count { it.medalType == "bronze" }
            val perfect = dayMedals.count { it.medalType == "perfect" }
            val text = when {
                gold > 0 && silver == 0 && bronze == 0 && perfect == 0 ->
                    "Won gold in $gold ${if (gold == 1) "mode" else "modes"}"
                else -> "Earned " + listOfNotNull(
                    gold.takeIf { it > 0 }?.let { "$it gold" },
                    silver.takeIf { it > 0 }?.let { "$it silver" },
                    bronze.takeIf { it > 0 }?.let { "$it bronze" },
                    perfect.takeIf { it > 0 }?.let { "$it perfect" },
                ).joinToString(" · ")
            }
            val art = when {
                gold > 0 -> GlyphArt.GOLD; silver > 0 -> GlyphArt.SILVER; bronze > 0 -> GlyphArt.BRONZE; else -> GlyphArt.DIAMOND
            }
            items += LatelyItem(art, text, relativeDayLabel(day), onTap = onMedals)
        }
    if (loginStreak >= 2) {
        items += LatelyItem(GlyphArt.FLAME, "On a $loginStreak-day login streak", "Today", onTap = onStreak)
    }
    return items
}

@Composable
fun LatelyCard(
    items: List<LatelyItem>,
    nemesis: ProfileService.PersonaNemesis?,
    onNemesisTap: (String) -> Unit,
) {
    if (items.isEmpty() && nemesis == null) return
    SocialCard(SOCIAL_BLUE) {
        CardTitle("LATELY", SOCIAL_BLUE)
        items.forEachIndexed { i, item ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(accentLine(SOCIAL_BLUE, 0.24f)))
            Row(
                Modifier
                    .fillMaxWidth()
                    .then(if (item.onTap != null) Modifier.clickableNoRipple(item.onTap) else Modifier)
                    .padding(vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier.size(28.dp).miniGameCard(SOCIAL_BLUE, 9.dp),
                    contentAlignment = Alignment.Center,
                ) { GlyphArtImage(item.art, 20.dp) }
                Column(Modifier.weight(1f)) {
                    Text(item.text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                    Text(item.whenLabel, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                }
            }
        }
        nemesis?.let { n ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(BrandPink.copy(alpha = 0.06f))
                    .border(1.5.dp, Color(0xFFF9A8D4), RoundedCornerShape(12.dp))
                    .clickableNoRipple { onNemesisTap(n.userId) }
                    .padding(horizontal = 11.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                GlyphArtImage(GlyphArt.SWORDS, 18.dp)
                Text("Most frequent rival: ", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                Text(n.username, fontSize = 11.5.sp, fontWeight = FontWeight.Black, color = BrandPink)
                Text(
                    "— ${n.sharedBoards} shared boards",
                    fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = WTheme.text,
                    modifier = Modifier.weight(1f), maxLines = 1,
                )
            }
        }
    }
}

/** A medal row's tint (gold / silver / bronze; perfect purple; streaks orange). */
private fun medalTint(type: String): Color = when (type) {
    "gold" -> PodiumInk.medal(1)
    "silver" -> PodiumInk.medal(2)
    "bronze" -> PodiumInk.medal(3)
    "perfect" -> SOCIAL_PURPLE
    else -> Color(0xFFF97316)
}

/** The no-spoilers note under You vs Them: the 3D lock + the words (was a 🔒 emoji). */
@Composable
private fun LockedNote() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon3D(Icon3DName.LOCK, 12.dp)
        Text("Boards open only for dailies you've finished", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}
