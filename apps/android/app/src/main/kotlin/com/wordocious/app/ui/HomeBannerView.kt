package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BannerTier
import com.wordocious.core.DayStreaks
import com.wordocious.core.GroupProgress
import com.wordocious.core.bannerClockLine
import com.wordocious.core.bannerHeadline
import com.wordocious.core.groupStatus
import com.wordocious.core.groupStreak
import com.wordocious.core.groupTier
import com.wordocious.core.unlimitedGroupStatus

// The home banner (founder-approved home redesign, 2026-10-01; spec:
// docs/HOME_REDESIGN_SPEC.md §2). One window: a frosted headline strip over a
// Wordocious row (the eight sweep dailies) and a Puzzles row (the ten More Games
// dailies). Each row glows on its own (purple sweep, gold flawless) through ONE
// blended background and ONE shimmer; Double Flawless turns the whole card gold.
// The words come from the shared core (HomeBanner.kt), so web and iOS print the
// same thing. Mirrors web components/home/home-banner.tsx.

private val TIER_SWEEP = Color(0xFFEBD6FD)
private val TIER_FLAWLESS = Color(0xFFFDE68A)
private fun tierInk(t: BannerTier): Color = when (t) {
    BannerTier.NONE -> Color(0xFF6D28D9)
    BannerTier.SWEEP -> Color(0xFF7E22CE)
    BannerTier.FLAWLESS -> Color(0xFF92400E)
}

/** One banner row: its cards (catalog order), today's progress, its runs and Unlimited count. */
data class BannerRow(
    val cards: List<ModeCard>,
    val progress: GroupProgress,
    val streaks: DayStreaks,
    val unlimitedPlayed: Int,
)

@Composable
fun HomeBannerView(
    word: BannerRow,
    puzzles: BannerRow,
    completions: Map<String, DailyCompletionsService.Completion>,
    unlimited: Boolean,
    /** Pro players get the DAILY | UNLIMITED switch in the strip. */
    isPro: Boolean,
    onModeChange: (PlayMode) -> Unit,
    /** The player's username; empty for a guest. */
    name: String,
    /** Live HH:MM:SS to local midnight. */
    clock: String,
    onOpen: (ModeCard) -> Unit,
    onShare: (headline: String) -> Unit,
) {
    val wTier = if (unlimited) BannerTier.NONE else groupTier(word.progress)
    val pTier = if (unlimited) BannerTier.NONE else groupTier(puzzles.progress)
    val double = wTier == BannerTier.FLAWLESS && pTier == BannerTier.FLAWLESS
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    val headline = bannerHeadline(word.progress, puzzles.progress, hour, name, unlimited)
    val clockLine = bannerClockLine(word.progress, puzzles.progress, clock, unlimited)
    val topColor = when (wTier) { BannerTier.NONE -> Color(0xFFECE8FF); BannerTier.SWEEP -> TIER_SWEEP; BannerTier.FLAWLESS -> TIER_FLAWLESS }
    val bottomColor = when (pTier) { BannerTier.NONE -> Color(0xFFE2E6FF); BannerTier.SWEEP -> TIER_SWEEP; BannerTier.FLAWLESS -> TIER_FLAWLESS }
    val headInk = if (double) Color(0xFF78350F) else Color(0xFF4C1D95)
    val subInk = if (double) Color(0xFF92400E) else Color(0xFF6D28D9)
    // Exactly one shimmer, Daily only, and only once a row has something to celebrate.
    val shimmer = !unlimited && (wTier != BannerTier.NONE || pTier != BannerTier.NONE) && !WTheme.reducedMotion
    val shape = RoundedCornerShape(16.dp)

    // Fixed card chrome: capped fontScale (the HomeScreen rule) so huge system text
    // can't balloon the strip or push the tile rows out of the card.
    CappedFontScale {
        // The host (W, MASCOT_SPEC §1–§2) peeks 12 dp over the strip's top edge, so the
        // card sits 12 dp down inside this box and the headline row keeps clear of it.
        Box(Modifier.fillMaxWidth().padding(top = BANNER_HOST_PEEK)) {
        Column(
            Modifier.fillMaxWidth()
                .bannerGlow(double)
                .clip(shape)
                .drawBehind {
                    if (unlimited) {
                        drawRect(Brush.linearGradient(listOf(Color(0xFFFCE7F3), Color(0xFFEDE9FE)), start = Offset.Zero, end = Offset(size.width, size.height)))
                    } else {
                        drawRect(Brush.verticalGradient(0f to topColor, 0.52f to topColor, 0.72f to bottomColor, 1f to bottomColor))
                        drawRect(Brush.linearGradient(
                            0f to Color.White.copy(alpha = 0.35f), 0.55f to Color.White.copy(alpha = 0f),
                            start = Offset.Zero, end = Offset(size.width, size.height),
                        ))
                    }
                }
                .then(if (shimmer) Modifier.bannerShimmer() else Modifier),
        ) {
            // Frosted headline strip: it titles the whole card, so it sits apart from the Wordocious row's glow.
            Column(
                Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.5f))
                    .padding(start = 12.dp, top = 12.dp, end = 8.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(Modifier.padding(end = BANNER_HOST_CLEAR), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        Modifier.weight(1f).heightIn(min = 30.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        if (double) Icon3D(Icon3DName.TROPHY, 22.dp)
                        if (unlimited) Icon(Icons.Filled.AllInclusive, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp))
                        Text(
                            headline, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp,
                            lineHeight = 1.2.em, color = headInk, maxLines = 2,
                        )
                    }
                    // Nothing to share before the first finished game (iOS/web parity).
                    if (!unlimited && word.progress.played + puzzles.progress.played > 0) {
                        Box(
                            Modifier.size(36.dp).clickableNoRipple { onShare(headline) }
                                .semantics { contentDescription = "Share today's progress" },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Filled.Share, null, tint = subInk, modifier = Modifier.size(19.dp))
                        }
                    }
                }
                Row(Modifier.padding(end = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        clockLine, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp,
                        color = subInk, modifier = Modifier.weight(1f),
                    )
                    if (isPro) DailyUnlimitedSwitch(if (unlimited) PlayMode.UNLIMITED else PlayMode.DAILY, onModeChange)
                }
            }
            BannerGroupRow(word, wTier, "WORDOCIOUS", big = true, unlimited, completions, onOpen,
                Modifier.padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 6.dp))
            BannerGroupRow(puzzles, pTier, "PUZZLES", big = false, unlimited, completions, onOpen,
                Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp))
        }
        BannerHost(Mascots.home, Modifier.align(Alignment.TopEnd))
        }
    }
}

/** How far a banner host peeks over the card's top edge (MASCOT_SPEC §2). */
internal val BANNER_HOST_PEEK = 12.dp

/** Right padding a banner headline keeps so the 56 dp host never covers it. */
internal val BANNER_HOST_CLEAR = 50.dp

/**
 * A banner's host (MASCOT_SPEC §2): 56 dp at the right end of the headline strip,
 * overlapping the card's top edge by [BANNER_HOST_PEEK], idle bob. Place it in a
 * Box that has [BANNER_HOST_PEEK] top padding around the (clipped) card.
 */
@Composable
internal fun BannerHost(id: MascotId, modifier: Modifier = Modifier) {
    Mascot(id, 56.dp, modifier.offset(x = (-2).dp, y = -BANNER_HOST_PEEK), motion = MascotMotion.BOB)
}

@Composable
private fun BannerGroupRow(
    row: BannerRow,
    tier: BannerTier,
    label: String,
    big: Boolean,
    unlimited: Boolean,
    completions: Map<String, DailyCompletionsService.Completion>,
    onOpen: (ModeCard) -> Unit,
    modifier: Modifier,
) {
    val ink = tierInk(tier)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = ink)
            Text(
                if (unlimited) unlimitedGroupStatus(row.unlimitedPlayed) else groupStatus(row.progress),
                fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = ink,
                modifier = Modifier.weight(1f), maxLines = 1,
            )
            // Unlimited hides the streaks; a row's flame hides when its run is 0.
            val streak = if (unlimited) 0 else groupStreak(tier, row.streaks)
            if (streak > 0) StreakFlame(streak, flame = 12.dp, fontSize = 12)
        }
        // Spec sizes (32/28 dp tiles, 7/4 dp gaps) are the ceiling; a narrow phone
        // shrinks the tiles so all of them fit on one line.
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val n = row.cards.size.coerceAtLeast(1)
            val specSize = if (big) 32.dp else 28.dp
            val gap = if (big) 7.dp else 4.dp
            val fit = (maxWidth - gap * (n - 1)) / n
            val size = if (fit < specSize) fit else specSize
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                row.cards.forEach { card ->
                    BannerTile(
                        card = card,
                        result = if (unlimited) null else card.dbKey?.let { completions[it] },
                        unlimited = unlimited,
                        size = size,
                        radius = if (big) 9.dp else 8.dp,
                        onClick = { onOpen(card) },
                    )
                }
            }
        }
    }
}

/** The 3D streak flame (HEADER_SPEC §2) + the run in #c2410c, no background. */
@Composable
internal fun StreakFlame(streak: Int, flame: Dp, fontSize: Int) {
    Row(
        Modifier.semantics { contentDescription = "$streak-day streak" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Icon3D(Icon3DName.FLAME, flame)
        Text("$streak", fontSize = fontSize.sp, fontWeight = FontWeight.Black, color = Color(0xFFC2410C))
    }
}

@Composable
private fun BannerTile(
    card: ModeCard,
    result: DailyCompletionsService.Completion?,
    unlimited: Boolean,
    size: Dp,
    radius: Dp,
    onClick: () -> Unit,
) {
    val accent = card.accent
    val shape = RoundedCornerShape(radius)
    val ink: Color
    val look: Modifier
    when {
        // Unlimited: white 90%, no border, a soft violet lift, accent icon.
        unlimited -> {
            ink = accent
            look = Modifier.shadow(1.5.dp, shape, ambientColor = Color(0x1F4C1D95), spotColor = Color(0x1F4C1D95))
                .clip(shape).background(Color.White.copy(alpha = 0.9f))
        }
        // Won: accent fill with an accent glow, white icon.
        result?.completed == true -> {
            ink = Color.White
            look = Modifier.shadow(5.dp, shape, ambientColor = accent.copy(alpha = 0.7f), spotColor = accent.copy(alpha = 0.7f))
                .clip(shape).background(accent)
        }
        // Lost: gray fill, white icon.
        result != null -> {
            ink = Color.White
            look = Modifier.clip(shape).background(Color(0xFF9CA3AF))
        }
        // Unplayed: white 85%, dashed accent border at 55%, accent icon.
        else -> {
            ink = accent
            look = Modifier.clip(shape).background(Color.White.copy(alpha = 0.85f)).dashedBorder(1.5.dp, accent.copy(alpha = 0.55f), radius)
        }
    }
    val state = when {
        unlimited -> ""
        result == null -> ", not played yet"
        result.completed -> ", won"
        else -> ", played"
    }
    Box(
        Modifier.size(size).then(look).clickableNoRipple(onClick)
            .semantics { contentDescription = card.title + state },
        contentAlignment = Alignment.Center,
    ) {
        ModeGlyph(card, ink, box = size)
    }
}

/** 1.5dp dashed rounded border (Compose's border() can't dash). */
internal fun Modifier.dashedBorder(width: Dp, color: Color, radius: Dp): Modifier = drawWithContent {
    drawContent()
    val w = width.toPx()
    drawRoundRect(
        color = color,
        topLeft = Offset(w / 2, w / 2),
        size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w),
        cornerRadius = CornerRadius(radius.toPx() - w / 2),
        style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 2.5.dp.toPx()))),
    )
}

/**
 * The banner's shadow, drawn unclipped before the card clips itself: normal
 * `0 4px 14px rgba(76,29,149,0.08)`; Double Flawless a gold glow all around
 * (`0 0 26px rgba(245,158,11,0.8)`). A blurred paint gives the even, centered
 * CSS glow that an elevation shadow (light from above) can't.
 */
private fun Modifier.bannerGlow(double: Boolean): Modifier = drawBehind {
    val blur = (if (double) 26.dp else 14.dp).toPx()
    val dy = if (double) 0f else 4.dp.toPx()
    val color = if (double) Color(0xFFF59E0B).copy(alpha = 0.8f) else Color(0xFF4C1D95).copy(alpha = 0.08f)
    val r = 16.dp.toPx()
    drawIntoCanvas { canvas ->
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color.toArgb()
            maskFilter = android.graphics.BlurMaskFilter(blur / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
        }
        canvas.nativeCanvas.drawRoundRect(0f, dy, size.width, size.height + dy, r, r, paint)
    }
}

/**
 * Exactly ONE diagonal light band across the whole banner (both rows): 38% of
 * the width, white 0 → 55% → 0, skewed about -18°, one left-to-right pass of
 * ~2.2 s, then a rest, every 4 s. Callers skip it under reduced motion; it also
 * stops ticking while Home is hidden under a game or another tab.
 */
@Composable
internal fun Modifier.bannerShimmer(): Modifier {
    val hidden by LocalTabHidden.current
    if (hidden) return this
    val transition = rememberInfiniteTransition(label = "bannerShimmer")
    val t by transition.animateFloat(
        initialValue = 0f, targetValue = 4000f,
        animationSpec = infiniteRepeatable(tween(4000, easing = LinearEasing), RepeatMode.Restart),
        label = "t",
    )
    return drawWithContent {
        drawContent()
        val pass = t / 2200f
        if (pass >= 1f) return@drawWithContent
        val w = size.width; val h = size.height
        val band = w * 0.38f
        val skew = h * 0.325f // tan(18°)
        val x = -band - skew + pass * (w + band + skew * 2f)
        val path = Path().apply {
            moveTo(x + skew, 0f); lineTo(x + skew + band, 0f)
            lineTo(x + band, h); lineTo(x, h); close()
        }
        drawPath(
            path,
            Brush.horizontalGradient(
                listOf(Color.White.copy(alpha = 0f), Color.White.copy(alpha = 0.55f), Color.White.copy(alpha = 0f)),
                startX = x + skew / 2f, endX = x + skew / 2f + band,
            ),
        )
    }
}

/** Pro's DAILY | UNLIMITED switch, in the strip's second line. */
@Composable
private fun DailyUnlimitedSwitch(value: PlayMode, onChange: (PlayMode) -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(Color(0xFF7C3AED).copy(alpha = 0.12f)).padding(2.dp),
    ) {
        listOf(PlayMode.DAILY to "DAILY", PlayMode.UNLIMITED to "UNLIMITED").forEach { (mode, label) ->
            val on = value == mode
            // Selected UNLIMITED stays violet, never pink/red (founder veto).
            val ink = if (!on) Color(0xFF7C3AED) else if (mode == PlayMode.DAILY) Color(0xFF4C1D95) else Color(0xFF6D28D9)
            Box(
                Modifier.height(26.dp).clip(RoundedCornerShape(50))
                    .background(if (on) Color.White else Color.Transparent)
                    .clickableNoRipple { onChange(mode) }
                    .padding(horizontal = 10.dp)
                    .semantics { contentDescription = label.lowercase() + if (on) ", selected" else "" },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = ink, maxLines = 1)
            }
        }
    }
}
