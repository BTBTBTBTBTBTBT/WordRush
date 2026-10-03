package com.wordocious.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
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
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
    /** Everyone sees the DAILY | UNLIMITED switch (R3); non-Pro taps on UNLIMITED open Go Pro. */
    isPro: Boolean,
    onModeChange: (PlayMode) -> Unit,
    /** The player's username; empty for a guest. */
    name: String,
    /** Live HH:MM:SS to local midnight. */
    clock: String,
    onOpen: (ModeCard) -> Unit,
    onShare: (headline: String) -> Unit,
) {
    // FINISH_SPEC Z: today's DAILY tiers decide the slots in both modes; the shown tiers
    // (glow, colors, flames) are NONE in Unlimited.
    val dailyWTier = groupTier(word.progress)
    val dailyPTier = groupTier(puzzles.progress)
    val wTier = if (unlimited) BannerTier.NONE else dailyWTier
    val pTier = if (unlimited) BannerTier.NONE else dailyPTier
    val slots = bannerSlots(word.progress, puzzles.progress, word.streaks, puzzles.streaks, unlimited)
    val double = wTier == BannerTier.FLAWLESS && pTier == BannerTier.FLAWLESS
    val dailyDouble = dailyWTier == BannerTier.FLAWLESS && dailyPTier == BannerTier.FLAWLESS
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    // Both modes' words are laid out (one invisible) so their slots never resize on the toggle.
    val dailyHeadline = bannerHeadline(word.progress, puzzles.progress, hour, name, false)
    val unlimitedHeadline = bannerHeadline(word.progress, puzzles.progress, hour, name, true)
    val headline = if (unlimited) unlimitedHeadline else dailyHeadline
    val dailyClock = bannerClockLine(word.progress, puzzles.progress, clock, false)
    val unlimitedClock = bannerClockLine(word.progress, puzzles.progress, clock, true)
    // Z: the swap is a quick crossfade inside the slots (instant with Reduce Motion).
    val modeFade by androidx.compose.animation.core.animateFloatAsState(
        if (unlimited) 1f else 0f,
        if (WTheme.reducedMotion) androidx.compose.animation.core.snap() else tween(180),
        label = "bannerModeFade",
    )
    // R3: a free player / guest tapping UNLIMITED gets the Go Pro paywall; turning Pro
    // there switches straight to Unlimited.
    var paywall by remember { mutableStateOf(false) }
    if (paywall) {
        com.wordocious.app.ui.game.ProPaywallDialog(
            onDismiss = { paywall = false },
            onPro = { paywall = false; onModeChange(PlayMode.UNLIMITED) },
        )
    }
    val topColor = when (wTier) { BannerTier.NONE -> Color(0xFFECE8FF); BannerTier.SWEEP -> TIER_SWEEP; BannerTier.FLAWLESS -> TIER_FLAWLESS }
    val bottomColor = when (pTier) { BannerTier.NONE -> Color(0xFFE2E6FF); BannerTier.SWEEP -> TIER_SWEEP; BannerTier.FLAWLESS -> TIER_FLAWLESS }
    val headInk = if (double) Color(0xFF78350F) else Color(0xFF4C1D95)
    val subInk = if (double) Color(0xFF92400E) else Color(0xFF6D28D9)
    // Exactly one shimmer, Daily only, and only once a row has something to celebrate.
    val shimmer = !unlimited && (wTier != BannerTier.NONE || pTier != BannerTier.NONE) && !WTheme.calmMotion // AD: a looping shine (off under Battery Saver too)
    // ART_SPEC §18.4: radius 22, the frosted headline strip across the full width.
    val shape = RoundedCornerShape(22.dp)
    // FINISH_SPEC G4: once a row is swept (or flawless) the banner shows the wide scene
    // art across its top in a tinted band with its own top bar — gold for the Sweep,
    // pink for Flawless. Daily only.
    val artTier = bannerArtTier(wTier, pTier, unlimited)
    // Z: the band's slot exists in both modes (Unlimited shows U's loop art in it).
    val bandTier = slots.sceneBand
    val artAccent = if (bandTier == BannerTier.FLAWLESS) MomentInk.flawless else MomentInk.sweep

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
                .then(if (shimmer) Modifier.bannerShimmer() else Modifier)
                .then(if (artTier != BannerTier.NONE) Modifier.border(1.5.dp, accentLine(artAccent), shape) else Modifier),
        ) {
            if (bandTier != BannerTier.NONE) BannerSceneSlot(bandTier, artAccent, modeFade)
            // Frosted headline strip: it titles the whole card, so it sits apart from the Wordocious
            // row's glow. ART_SPEC §18.4: white at 72% (the fill under it is a smooth gradient, so
            // a backdrop blur would change nothing on Android; no platform backdrop blur here).
            Column(
                // FINISH_SPEC A1: the frosted strip is a lilac frost, not white.
                Modifier.fillMaxWidth().background(FinishInk.lavender.copy(alpha = 0.78f))
                    .padding(start = 12.dp, top = 12.dp, end = 8.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(Modifier.padding(end = slots.headlineEndClear.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Z: both modes' headlines share one slot (the taller of the two), crossfading.
                    Box(Modifier.weight(1f)) {
                        BannerHeadlineLayer(dailyHeadline, dailyDouble, headInk = Color(0xFF78350F), alpha = 1f - modeFade, active = !unlimited, name = name)
                        BannerHeadlineLayer(unlimitedHeadline, false, headInk = headInk, alpha = modeFade, active = unlimited, name = name)
                    }
                    // Nothing to share before the first finished game (iOS/web parity). Z: the
                    // slot stays (empty) in Unlimited and before the first game.
                    val canShare = !unlimited && word.progress.played + puzzles.progress.played > 0
                    Box(
                        Modifier.size(BannerSlotSpec.SHARE.dp)
                            .graphicsLayer { alpha = 1f - modeFade }
                            .then(if (canShare) Modifier.squishClickable("Share today's progress", icon = true) { onShare(headline) } else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (word.progress.played + puzzles.progress.played > 0) {
                            Icon3D(Icon3DName.SHARE, 23.dp, contentDescription = null, modifier = Modifier)
                        }
                    }
                }
                Row(Modifier.padding(end = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Z: both clock lines laid out on top of each other (the slot is the taller).
                    Box(Modifier.weight(1f)) {
                        Text(
                            dailyClock, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp,
                            color = subInk,
                            modifier = Modifier.graphicsLayer { alpha = 1f - modeFade }
                                .then(if (unlimited) Modifier.clearAndSetSemantics { } else Modifier),
                        )
                        Text(
                            unlimitedClock, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp,
                            color = subInk,
                            modifier = Modifier.graphicsLayer { alpha = modeFade }
                                .then(if (!unlimited) Modifier.clearAndSetSemantics { } else Modifier),
                        )
                    }
                    // R3 (founder 10-02): everyone sees the switch; UNLIMITED wears a small gold
                    // PRO pill for free players and guests, and their tap opens Go Pro.
                    DailyUnlimitedSwitch(
                        if (unlimited) PlayMode.UNLIMITED else PlayMode.DAILY,
                        locked = !isPro,
                        onChange = { m -> if (m == PlayMode.UNLIMITED && !isPro) paywall = true else onModeChange(m) },
                    )
                }
            }
            BannerGroupRow(word, wTier, "WORDOCIOUS", big = true, unlimited, completions, onOpen,
                Modifier.padding(start = 12.dp, end = 12.dp, top = 10.dp, bottom = 6.dp),
                flameSlot = slots.wordFlameSlot, dailyTier = dailyWTier)
            BannerGroupRow(puzzles, pTier, "PUZZLES", big = false, unlimited, completions, onOpen,
                Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp),
                flameSlot = slots.puzzlesFlameSlot, dailyTier = dailyPTier)
        }
        // The scene art carries the cast on a swept day (A7: no second W host beside it).
        if (slots.hostShown) BannerHost(Mascots.home, Modifier.align(Alignment.TopEnd))
        }
    }
}

/**
 * G4 the swept / flawless banner art: the card's own top bar (gold Sweep, pink
 * Flawless), then the wide scene (`art_scene_banner_sweep` — O1 + S with the broom + W;
 * `art_scene_banner_flawless` — D + the pink O with the gem + I) across the banner on a
 * soft tinted band with a glow, the cast fully visible (fit, never cropped). Decorative.
 *
 * FINISH_SPEC Z: the band is a slot that exists in BOTH modes once today's dailies earn
 * it — in Unlimited the same band (same height) shows U with her loop of tiles on a
 * peach wash, crossfading by [unlimitedFade] (0 = Daily, 1 = Unlimited), so the tile
 * rows below never move on the toggle.
 */
@Composable
private fun BannerSceneSlot(tier: BannerTier, accent: Color, unlimitedFade: Float) {
    val res = if (tier == BannerTier.FLAWLESS) com.wordocious.app.R.drawable.art_scene_banner_flawless
              else com.wordocious.app.R.drawable.art_scene_banner_sweep
    val peach = com.wordocious.app.ui.game.UNLIMITED_PEACH
    BoxWithConstraints(Modifier.fillMaxWidth().clearAndSetSemantics { }) {
        // The art is ~1.6:1; at most 140 dp tall so the tile rows stay in view (BannerSlotSpec).
        val h = (maxWidth * BannerSlotSpec.SCENE_ART_FRACTION).coerceAtMost(BannerSlotSpec.SCENE_ART_MAX.dp)
        val glow = Modifier.drawBehind {
            drawCircle(
                Brush.radialGradient(
                    listOf(Color.White.copy(alpha = 0.7f), Color.White.copy(alpha = 0f)),
                    center = center, radius = size.width * 0.42f,
                ),
                radius = size.width * 0.42f,
            )
        }
        // Daily: the sweep / flawless scene.
        if (unlimitedFade < 1f) {
            Column(Modifier.fillMaxWidth().graphicsLayer { alpha = 1f - unlimitedFade }) {
                Box(
                    Modifier.fillMaxWidth().height(BannerSlotSpec.SCENE_BAR.dp).background(
                        if (tier == BannerTier.FLAWLESS) Brush.horizontalGradient(listOf(Color(0xFFF472B6), accent, Color(0xFFDB2777)))
                        else MomentInk.proBar,
                    ),
                )
                Box(
                    Modifier.fillMaxWidth().background(accentWash(accent, 0.16f)).then(glow).padding(top = 6.dp, bottom = 2.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    androidx.compose.foundation.Image(
                        androidx.compose.ui.res.painterResource(res), contentDescription = null,
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                        modifier = Modifier.fillMaxWidth().height(h),
                    )
                }
            }
        }
        // Unlimited: U and her loop of tiles in the same slot (Y: the loop art, no ∞ glyph).
        if (unlimitedFade > 0f) {
            Column(Modifier.fillMaxWidth().graphicsLayer { alpha = unlimitedFade }) {
                Box(Modifier.fillMaxWidth().height(BannerSlotSpec.SCENE_BAR.dp).background(peach))
                Box(
                    Modifier.fillMaxWidth().background(accentWash(peach, 0.16f)).then(glow).padding(top = 6.dp, bottom = 2.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(Modifier.fillMaxWidth().height(h), contentAlignment = Alignment.Center) {
                        com.wordocious.app.ui.game.UnlimitedLoopArt(h * (900f / 759f) * 0.92f)
                    }
                }
            }
        }
    }
}

/**
 * G4 which scene the banner shows (pure, unit-tested): FLAWLESS when the Wordocious row
 * is flawless (or only the Puzzles row has a tier and it is flawless), SWEEP when either
 * row is swept, NONE otherwise and always in Unlimited.
 */
internal fun bannerArtTier(word: BannerTier, puzzles: BannerTier, unlimited: Boolean): BannerTier = when {
    unlimited -> BannerTier.NONE
    word == BannerTier.FLAWLESS || (word == BannerTier.NONE && puzzles == BannerTier.FLAWLESS) -> BannerTier.FLAWLESS
    word == BannerTier.SWEEP || puzzles != BannerTier.NONE -> BannerTier.SWEEP
    else -> BannerTier.NONE
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
    // FINISH_SPEC AD: the idle bob stops under Battery Saver too.
    Mascot(id, 56.dp, modifier.offset(x = (-2).dp, y = -BANNER_HOST_PEEK), motion = if (WTheme.calmMotion) MascotMotion.NONE else MascotMotion.BOB)
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
    /** Z: today's run has a flame — its slot is kept (invisible) in Unlimited too. */
    flameSlot: Boolean = false,
    /** Z: the row's DAILY tier (what the flame's run reads in both modes). */
    dailyTier: BannerTier = tier,
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
            // AS7 (founder 10-02): no per-row streak flames — every streak lives in the header's
            // streak popup now. [flameSlot] / [dailyTier] stay for the slot math's callers.
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
            // FINISH_SPEC A1: icon tiles are mini game cards (tint, line, 4 dp top bar).
            look = Modifier.miniGameCard(accent, radius)
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
            // FINISH_SPEC A1: an unplayed tile is a mini game card (was white with a dashed line).
            look = Modifier.miniGameCard(accent, radius)
        }
    }
    val state = when {
        unlimited -> ""
        result == null -> ", not played yet"
        result.completed -> ", won"
        else -> ", played"
    }
    Box(
        Modifier.squishClickable(card.title + state, card = true, onClick = onClick).size(size).then(look),
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
    // AQ2: also off while the page scrolls.
    if (ambientMotionPaused()) return this
    // Perf (2026-10-02 measured audit): animate only the 2.2 s pass, then rest without
    // frames — the old 4 s infinite transition asked for a frame on every vsync of the
    // 1.8 s rest too. Same timing on screen.
    val anim = androidx.compose.runtime.remember { androidx.compose.animation.core.Animatable(0f) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        while (true) {
            anim.snapTo(0f)
            anim.animateTo(2200f, tween(2200, easing = LinearEasing))
            kotlinx.coroutines.delay(1800)
        }
    }
    return drawWithContent {
        drawContent()
        val pass = anim.value / 2200f
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

/**
 * The DAILY | UNLIMITED switch, in the strip's second line. FINISH_SPEC Z: the two
 * segments are fixed-width (measured once from their labels in the same Black weight),
 * the labels never change weight, and only the tinted thumb slides between them
 * (instant with Reduce Motion) — so nothing reflows on the toggle. R3: with [locked]
 * (free players and guests) UNLIMITED wears a small gold PRO pill (AA4: never for Pro).
 */
@Composable
private fun DailyUnlimitedSwitch(value: PlayMode, locked: Boolean, onChange: (PlayMode) -> Unit) {
    val purple = Color(0xFF7C3AED)
    val labelStyle = TextStyle(fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    val density = LocalDensity.current
    val geo = remember(density, measurer) {
        fun w(t: String) = with(density) { measurer.measure(t, labelStyle, maxLines = 1).size.width.toDp().value }
        switchGeometry(kotlin.math.ceil(w("DAILY")), kotlin.math.ceil(w("UNLIMITED")))
    }
    val unlimited = value == PlayMode.UNLIMITED
    val (thumbX, thumbW) = geo.thumb(unlimited)
    val still = WTheme.reducedMotion
    val spec: androidx.compose.animation.core.AnimationSpec<Dp> =
        if (still) androidx.compose.animation.core.snap()
        else androidx.compose.animation.core.spring(dampingRatio = 0.8f, stiffness = 500f)
    val x by androidx.compose.animation.core.animateDpAsState(thumbX.dp, spec, label = "switchThumbX")
    val w by androidx.compose.animation.core.animateDpAsState(thumbW.dp, spec, label = "switchThumbW")
    val segH = BannerSlotSpec.SWITCH_SEGMENT_H.dp
    Box {
        Box(
            Modifier.width(geo.trackWidth.dp).height((BannerSlotSpec.SWITCH_SEGMENT_H + BannerSlotSpec.SWITCH_PAD * 2).dp)
                .clip(RoundedCornerShape(50)).background(purple.copy(alpha = 0.12f))
                .padding(BannerSlotSpec.SWITCH_PAD.dp),
        ) {
            // The sliding thumb: the only thing that moves.
            Box(
                Modifier.offset(x = x).width(w).height(segH)
                    .clip(RoundedCornerShape(50)).background(accentWash(purple, 0.06f)),
            )
            Row {
                listOf(PlayMode.DAILY to "DAILY", PlayMode.UNLIMITED to "UNLIMITED").forEach { (mode, label) ->
                    val on = value == mode
                    // Selected UNLIMITED stays violet, never pink/red (founder veto).
                    val ink = if (!on) purple else if (mode == PlayMode.DAILY) Color(0xFF4C1D95) else Color(0xFF6D28D9)
                    val segW = if (mode == PlayMode.DAILY) geo.dailyWidth else geo.unlimitedWidth
                    Box(
                        Modifier.squishClickable(
                            if (mode == PlayMode.UNLIMITED && locked) "unlimited, a Pro feature" else label.lowercase(),
                            role = androidx.compose.ui.semantics.Role.Tab,
                        ) { onChange(mode) }
                            .semantics { selected = on }
                            .width(segW.dp).height(segH),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(label, style = labelStyle, color = ink, maxLines = 1, softWrap = false)
                    }
                }
            }
        }
        if (locked) {
            com.wordocious.app.ui.game.ProPill(Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = (-7).dp))
        }
    }
}

/**
 * Z one mode's headline in the shared headline slot: the old WORDOCIOUS wordmark style
 * (Nunito Black, violet→pink, soft pink glow; the double-flawless gold day keeps its
 * tier ink and the trophy). Two lines, then it steps down (to 70%) rather than
 * truncating. Both modes' layers are always laid out; [alpha] crossfades them and the
 * hidden one ([active] = false) is silent to screen readers.
 */
@Composable
private fun BannerHeadlineLayer(headline: String, double: Boolean, @Suppress("UNUSED_PARAMETER") headInk: Color, alpha: Float, active: Boolean, name: String? = null) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 30.dp)
            .graphicsLayer { this.alpha = alpha }
            .then(if (active) Modifier else Modifier.clearAndSetSemantics { }),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (double) Icon3D(Icon3DName.TROPHY, 22.dp)
        // AR: the live lettering (purple → magenta, gold numbers, the star separator); the
        // double-flawless gold day takes the celebration palette.
        LiveHeadline(
            headline,
            if (double) HeadlinePalette.CELEBRATION else HeadlinePalette.HOME,
            Modifier.weight(1f),
            names = listOfNotNull(name?.takeIf { it.isNotBlank() }),
            maxSize = 22.sp, minSize = 15.sp, sound = active,
        )
    }
}
