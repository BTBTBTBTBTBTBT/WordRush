package com.wordocious.app.ui

import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
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
import androidx.compose.ui.semantics.heading
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
    // Season surfaces: the season's secondary ink (iOS tierInk parity).
    BannerTier.NONE -> com.wordocious.app.ui.theme.WTheme.season?.textSecondary ?: Color(0xFF6D28D9)
    BannerTier.SWEEP -> Color(0xFF7E22CE)
    BannerTier.FLAWLESS -> Color(0xFF92400E)
}

/** One banner row: its cards (catalog order), today's progress, its runs and Unlimited count. */
data class BannerRow(
    val cards: List<ModeCard>,
    val progress: GroupProgress,
    val streaks: DayStreaks,
    val unlimitedPlayed: Int,
    /** 2.8 items 7 + 48: the best flawless run ever (0 = unknown → no "NEW BEST!"). */
    val bestFlawless: Int = 0,
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
    // 2.8 item 13: when the day's counter grew while Home was away (7 -> 8 OF 18), the host mascot reacts as Home returns.
    run {
        val played = word.progress.played + puzzles.progress.played
        val tabHidden = LocalTabHidden.current.value
        var seen by androidx.compose.runtime.remember { androidx.compose.runtime.mutableIntStateOf(-1) }
        androidx.compose.runtime.LaunchedEffect(played, tabHidden) {
            if (tabHidden) return@LaunchedEffect
            if (seen in 0 until played) {
                kotlinx.coroutines.delay(450)
                com.wordocious.app.data.MascotMoments.emit(com.wordocious.core.AvatarReaction.PROGRESS)
            }
            seen = played
        }
    }
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    // Both modes' words are laid out (one invisible) so their slots never resize on the toggle.
    // 2.8 items 7 + 48: a finished row speaks to its streak ("FLAWLESS 3-PEAT!"); the day's variant is picked by date.
    val dailyHeadline = bannerHeadline(
        word.progress, puzzles.progress, hour, name, false,
        com.wordocious.core.RowStreaks(word.streaks.sweep, word.streaks.flawless, 0, word.bestFlawless),
        com.wordocious.core.RowStreaks(puzzles.streaks.sweep, puzzles.streaks.flawless),
        com.wordocious.app.todayLocalDate(),
    )
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
    val season = WTheme.season?.takeIf { it.heroFill != null }
    val headInk = if (double) Color(0xFF78350F) else (season?.text ?: Color(0xFF4C1D95))
    val subInk = if (double) Color(0xFF92400E) else (season?.textSecondary ?: Color(0xFF6D28D9))
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
        // BJ6 symmetric hero (founder 10-03: "even and symmetrical"): the host stands CENTERED
        // on the card's top edge — its head rises [HOME_HOST_RISE] above the card ([HOME_BANNER_TOP]
        // of this box's top padding + [HOME_HOST_OVERHANG] over the header's bottom edge, inside
        // Home's extended scroll viewport), its lower part overlaps the frosted strip.
        // The share control lives in the app header (HomeShareControl), not on the card.
        // BJ6 round 3: the host renders in every state; a W host that steps aside for the
        // celebration art takes its headroom with it (never an empty slot).
        // Founder 2.7.1: the cached own look until the live one is known (no purple-W flash).
        val host = rememberHomeHost()
        val hostPick = host.pick
        val hostShows = homeHostShows(hostPick, slots.hostShown)
        Box(Modifier.fillMaxWidth().padding(top = if (hostShows) HOME_BANNER_TOP else 0.dp)) {
        Column(
            Modifier.fillMaxWidth()
                .bannerGlow(double)
                .clip(shape)
                .drawBehind {
                    if (season != null) {
                        // Season surfaces: the hero fill + a soft glow behind the banner art
                        // (dark tone: jack-o'-lantern center glow; light tone: an orange edge glow).
                        drawRect(season.heroFill!!)
                        season.bannerGlow?.let { g ->
                            if (season.dark) drawRect(Brush.radialGradient(
                                0f to g.copy(alpha = 0.34f), 0.55f to g.copy(alpha = 0.10f), 1f to g.copy(alpha = 0f),
                                center = Offset(size.width / 2, size.height * 0.46f), radius = 190.dp.toPx(),
                            )) else drawRect(Brush.radialGradient(
                                0f to g.copy(alpha = 0f), 0.6f to g.copy(alpha = 0f), 1f to g.copy(alpha = 0.26f),
                                center = Offset(size.width / 2, size.height / 2), radius = maxOf(size.width, size.height) * 0.62f,
                            ))
                        }
                    } else if (unlimited) {
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
            // BJ6: the card mirrors on its center line — the strip clears the host's lower part
            // (no clearance when the scene band sits on top: the host then stands on the band).
            Column(
                // FINISH_SPEC A1: the frosted strip is a lilac frost, not white. BJ6 round 3 flair
                // (static, symmetric): a soft diagonal sheen in the frost, the brand candy cap across
                // the card's top edge, tiny confetti dots mirrored in the empty top corners.
                Modifier.fillMaxWidth().homeStripFlair(cap = bandTier == BannerTier.NONE)
                    .padding(start = 12.dp, top = homeStripTop(bandTier != BannerTier.NONE, hostShows).dp, end = 12.dp, bottom = 4.dp),
                // BH3: one headline line, then the slim switch, the meta line under it (BJ6: 6 / 3).
                verticalArrangement = Arrangement.spacedBy(0.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // FINISH_SPEC BI21 (founder 10-03: "fill that space better … it doesn't look
                // even"): the headline centered on the card's center line (the W host's
                // clearance reserved on BOTH sides), then a centered wide DAILY | UNLIMITED
                // switch, then the centered meta line.
                // BJ6 round 4 (founder: long usernames never shrink, scroll or clip): the slot's
                // width is read once per layout (BoxWithConstraints, not per frame); the full size
                // comes from core headlineFontSize, the lines from core headlineLayout — both
                // remembered by (headline, name, width). Gold sparkles flank line 1, mirrored.
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val lineW = maxWidth - HOME_HEADLINE_SIDES
                    // 2.8 item 6: core's bubble-text fit — the name keeps its stacked gold lines; every
                    // other headline that is too long wraps in balanced lines (never "…", never a clip).
                    val usable = (lineW.value - HOME_HEADLINE_ART_PAD).coerceAtLeast(1f).toDouble()
                    val dailyLayout = remember(dailyHeadline, name, usable) { com.wordocious.core.homeHeadlineFit(dailyHeadline, name, usable) }
                    val unlimitedLayout = remember(unlimitedHeadline, name, usable) { com.wordocious.core.homeHeadlineFit(unlimitedHeadline, name, usable) }
                    // Z: both modes' headlines share one slot (the taller of the two), crossfading.
                    Box(Modifier.fillMaxWidth()) {
                        BannerHeadlineLayer(dailyHeadline, dailyLayout, dailyLayout.size, dailyDouble, alpha = 1f - modeFade, active = !unlimited, name = name)
                        BannerHeadlineLayer(unlimitedHeadline, unlimitedLayout, unlimitedLayout.size, false, alpha = modeFade, active = unlimited, name = name)
                    }
                }
                // R3 (founder 10-02): everyone sees the switch; BI21: the PRO chip sits inside
                // the UNLIMITED half for free players and guests, whose tap opens Go Pro.
                Spacer(Modifier.height(6.dp))
                DailyUnlimitedSwitch(
                    if (unlimited) PlayMode.UNLIMITED else PlayMode.DAILY,
                    locked = !isPro,
                    onChange = { m -> if (m == PlayMode.UNLIMITED && !isPro) paywall = true else onModeChange(m) },
                )
                // Z: both meta lines laid out on top of each other (the slot is the taller).
                // BH3: under the switch (BJ6: 3), 11 sp small caps.
                Box(Modifier.fillMaxWidth().padding(top = 3.dp), contentAlignment = Alignment.Center) {
                    val metaStyle = TextStyle(
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.4.sp, lineHeight = 12.sp,
                        fontFeatureSettings = "tnum, smcp", textAlign = TextAlign.Center,
                    )
                    Text(
                        dailyClock, style = metaStyle, color = subInk, maxLines = 1,
                        modifier = Modifier.fillMaxWidth().graphicsLayer { alpha = 1f - modeFade }
                            .then(if (unlimited) Modifier.clearAndSetSemantics { } else Modifier),
                    )
                    Text(
                        unlimitedClock, style = metaStyle, color = subInk, maxLines = 1,
                        modifier = Modifier.fillMaxWidth().graphicsLayer { alpha = modeFade }
                            .then(if (!unlimited) Modifier.clearAndSetSemantics { } else Modifier),
                    )
                }
            }
            // Season preview: no celebration today → the season's Home banner art (registry `banner`)
            // under the headline strip, fit, at most 104 dp tall (iOS / web parity), never cropped.
            if (bandTier == BannerTier.NONE) HalloweenBannerSlot { res ->
                androidx.compose.foundation.Image(
                    androidx.compose.ui.res.painterResource(res), contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().height(110.dp).padding(top = 4.dp, bottom = 6.dp, start = 10.dp, end = 10.dp).clearAndSetSemantics { },
                )
            }
            // BI21: one tile size for both rows (sized so 10 fit), each row spread edge to edge.
            // BJ6 round 3: the two progress rows sit in one subtle lavender tint band (two zones).
            val tileSlots = maxOf(10, word.cards.size, puzzles.cards.size)
            Column(Modifier.fillMaxWidth().background(season?.raised?.copy(alpha = 0.45f) ?: HOME_ROWS_TINT)) {
            BannerGroupRow(word, wTier, "WORDOCIOUS", tileSlots, unlimited, completions, onOpen,
                Modifier.padding(start = HOME_ROW_PAD_X.dp, end = HOME_ROW_PAD_X.dp, top = 4.dp, bottom = 4.dp),
                flameSlot = slots.wordFlameSlot, dailyTier = dailyWTier)
            BannerGroupRow(puzzles, pTier, "PUZZLES", tileSlots, unlimited, completions, onOpen,
                Modifier.padding(start = HOME_ROW_PAD_X.dp, end = HOME_ROW_PAD_X.dp, top = 4.dp, bottom = 6.dp),
                flameSlot = slots.puzzlesFlameSlot, dailyTier = dailyPTier)
            }
        }
        // BJ6: the host, centered on the card's top edge (drawn over the card). On a swept day the
        // celebration art carries the cast: a W host then hides (alpha 0, keeps its place).
        if (hostShows) HomeHostSwap(host, HOME_HOST_BOX, Modifier.align(Alignment.TopCenter).offset(y = -HOME_HOST_RISE))
        // Door 2 (founder 10-05): "Make me yours!" beside the plain host (× ends it for good) —
        // only once the look is known (never a bubble flash to a customized player at launch).
        if (hostShows && host.inviteAllowed && hostPick == com.wordocious.app.data.HomeHostPick.W && rememberHostInvite() != null)
            HostInviteBubble(Modifier.align(Alignment.TopCenter).offset(x = 104.dp, y = -HOME_HOST_RISE + 4.dp))
        }
    }
    // BJ6: the share control moved to the app header (Home only): publish its state + action.
    val shareHeadline by androidx.compose.runtime.rememberUpdatedState(headline)
    val shareAction by androidx.compose.runtime.rememberUpdatedState(onShare)
    HomeSharePublisher(
        visible = homeShareVisible(unlimited, word.progress.played + puzzles.progress.played),
        onShare = { shareAction(shareHeadline) },
    )
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

/**
 * FINISH_SPEC BH3 (founder 10-03: the Home banner is "bloated"): the Home host is 52 dp, centered
 * on the one-line headline row (strip top 4 + half the 32 row = 20 into the card), so the card
 * only needs 6 dp of room above it.
 */
internal val HOME_HOST_SIZE = 52.dp
internal val HOME_HOST_PEEK = 6.dp

/** Right padding a banner headline keeps so the 56 dp host never covers it. */
internal val BANNER_HOST_CLEAR = 50.dp

/**
 * A banner's host (MASCOT_SPEC §2): 56 dp at the right end of the headline strip,
 * overlapping the card's top edge by [BANNER_HOST_PEEK], idle bob. Place it in a
 * Box that has [BANNER_HOST_PEEK] top padding around the (clipped) card.
 */
@Composable
internal fun BannerHost(id: MascotId, modifier: Modifier = Modifier, size: Dp = 56.dp, peek: Dp = BANNER_HOST_PEEK) {
    // FINISH_SPEC AD: the idle bob stops under Battery Saver too.
    Mascot(id, size, modifier.offset(x = (-2).dp, y = -peek), motion = if (WTheme.calmMotion) MascotMotion.NONE else MascotMotion.BOB)
}

@Composable
private fun BannerGroupRow(
    row: BannerRow,
    tier: BannerTier,
    label: String,
    /** BI21: how many tiles the shared tile size must fit (the widest row, at least 10). */
    tileSlots: Int,
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
    // BH3: label → icons 4.
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
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
        // BI21: one tile size for every row — at most 32 dp, sized so [tileSlots] tiles fit
        // with 5 dp gaps — and the row spreads edge to edge (first flush left, last flush
        // right, equal gaps), so the 8- and 10-tile rows end flush.
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            // BJ6 round 3: as large as fits — both rows the same size, ≥ 4 dp gaps, up to 36.
            val size = homeTileSize(maxWidth.value, tileSlots).dp
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                row.cards.forEach { card ->
                    BannerTile(
                        card = card,
                        result = if (unlimited) null else card.dbKey?.let { completions[it] },
                        unlimited = unlimited,
                        size = size,
                        radius = 8.dp,
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
    // FINISH_SPEC BI21 (no bordered boxes): glossy = the fill + a soft white sheen on top.
    val gloss = Brush.verticalGradient(0f to Color.White.copy(alpha = 0.38f), 0.55f to Color.White.copy(alpha = 0f))
    val ink: Color
    val look: Modifier
    when {
        // Unlimited: a soft tinted tile with a light lift, full-strength accent icon.
        unlimited -> {
            ink = accent
            look = Modifier.shadow(3.dp, shape, ambientColor = accent.copy(alpha = 0.18f), spotColor = accent.copy(alpha = 0.18f))
                .clip(shape).background(accentWash(accent, 0.16f))
        }
        // 2.8 item 8: played (won OR lost) = THE one game-tile style (the Sudocious finish screen's
        // picker tile, miniGameCard): the game's wash + top band, plus today's W / L badge below.
        result != null -> {
            ink = accent
            look = Modifier.miniGameCard(accent, radius)
        }
        // Not played: a soft pale tile, the icon dimmed (on a dark season's glass a dim night tile
        // with a hint of the game color, so the played tiles' solid color stands out; iOS parity).
        else -> {
            ink = accent
            val night = WTheme.season?.takeIf { it.dark }?.card
            look = Modifier.clip(shape).background(
                if (night != null) Color(TintMath.over(accent.copy(alpha = 1f).toArgb(), SeasonDone.IDLE_TILE, night.toArgb()))
                else accentWash(accent, 0.12f),
            )
        }
    }
    val state = when {
        unlimited -> ""
        result == null -> ", not played yet"
        result.completed -> ", won"
        else -> ", lost"
    }
    // The outer box is unclipped so the W / L badge can overhang the tile's corner.
    Box(Modifier.squishClickable(card.title + state, card = true, onClick = onClick).size(size)) {
      Box(Modifier.fillMaxSize().then(look), contentAlignment = Alignment.Center) {
        // A played tile shows the real full-color 3D art on a small pale disc (iOS BannerGlyph
        // `solid` parity), so it never melts into its own accent fill. ModeGlyph's white ink
        // tints the art into a flat white silhouette, so it is used only for the unplayed /
        // Unlimited tiles and for a mode without art.
        val playedArt = if (!unlimited && result != null) gameArtRes(card.id) else null
        Box(Modifier.graphicsLayer { alpha = if (!unlimited && result == null) 0.45f else 1f }, contentAlignment = Alignment.Center) {
            if (playedArt != null) {
                val icon = size * 0.56f * 1.25f
                androidx.compose.foundation.Image(
                    artPainter(playedArt, icon), contentDescription = null,
                    modifier = Modifier.size(icon),
                )
            } else {
                ModeGlyph(card, ink, box = size)
            }
        }
      }
        if (!unlimited && result != null) {
            ResultBadge(
                result.completed, size = 13.dp,
                modifier = Modifier.align(Alignment.TopEnd).offset(x = 3.dp, y = (-3).dp),
            )
        }
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
 * The DAILY | UNLIMITED switch, centered under the headline. FINISH_SPEC BI21: about
 * 75% of the card's width (at most 280 dp) in two EQUAL halves; R3: with [locked] (free
 * players and guests) a small gold crown + PRO chip sits INSIDE the UNLIMITED half beside
 * its label (AA4: never for Pro). Z: the labels never change weight and only the tinted
 * thumb slides between the halves (instant with Reduce Motion), so nothing reflows.
 */
@Composable
private fun DailyUnlimitedSwitch(value: PlayMode, locked: Boolean, onChange: (PlayMode) -> Unit) {
    val labelStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
    val unlimited = value == PlayMode.UNLIMITED
    val still = WTheme.reducedMotion
    val spec: androidx.compose.animation.core.AnimationSpec<Float> =
        if (still) androidx.compose.animation.core.snap()
        else androidx.compose.animation.core.spring(dampingRatio = 0.7f, stiffness = 500f)
    val pos by androidx.compose.animation.core.animateFloatAsState(if (unlimited) 1f else 0f, spec, label = "switchThumb")
    val trackH = (BannerSlotSpec.SWITCH_SEGMENT_H + BannerSlotSpec.SWITCH_PAD * 2).toFloat()
    // The candy toggle sprites (night art 10-03, proposal 1): the glossy track + a glossy thumb,
    // three-sliced; the thumb sits inside the track's rim and is the only thing that moves.
    val pad = candyPad(trackH).dp
    val trackImg = candyBitmap(CandySprite.TRACK)
    val thumbImg = candyBitmap(CandySprite.THUMB_ON)
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val track = (maxWidth * 0.64f).coerceAtMost(230.dp) // BH3: slimmer, ~64% wide
        val half = (track - pad * 2) / 2
        Box(Modifier.width(track).height(trackH.dp).candyPill(trackImg).padding(pad)) {
            Box(
                Modifier.graphicsLayer { translationX = half.toPx() * pos }.width(half).fillMaxHeight()
                    .candyPill(thumbImg),
            )
            Row {
                listOf(PlayMode.DAILY to "DAILY", PlayMode.UNLIMITED to "UNLIMITED").forEach { (mode, label) ->
                    val on = value == mode
                    Row(
                        Modifier.squishClickable(
                            if (mode == PlayMode.UNLIMITED && locked) "unlimited, a Pro feature" else label.lowercase(),
                            role = androidx.compose.ui.semantics.Role.Tab,
                        ) { onChange(mode) }
                            .semantics { selected = on }
                            .width(half).fillMaxHeight(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
                    ) {
                        Text(label, style = labelStyle, color = if (on) CandyInk.ON else CandyInk.off, maxLines = 1, softWrap = false)
                        // Proposal 1: the gold PRO crown sprite inside the Unlimited half, no pill
                        // (AA4: only for players without Pro).
                        if (mode == PlayMode.UNLIMITED && locked) {
                            androidx.compose.foundation.Image(
                                androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.art_badge_pro_crown_sprite),
                                contentDescription = null, modifier = Modifier.size(15.dp).offset(y = (-1).dp),
                            )
                        }
                    }
                }
            }
        }
    }
}


/**
 * Z one mode's headline in the shared headline slot: the brand lettering (Nunito Black,
 * violet→pink; the double-flawless gold day keeps the celebration palette + trophy). BJ6
 * round 4: [layout]'s lines each at exactly [size] dp, centered — never shrunk, clipped or
 * scrolled; the name lines ([HeadlineLayout.nameLines], when stacked) in the gold lettering.
 * A headline without the name goes through core's bubble fit: one line scaled to the slot, else a
 * balanced wrap — never an ellipsis (2.8 item 6). Both modes'
 * layers are laid out; [alpha] crossfades them and the hidden one is silent to screen readers.
 */
@Composable
private fun BannerHeadlineLayer(
    headline: String, layout: com.wordocious.core.BubbleFit, size: Int, double: Boolean,
    alpha: Float, active: Boolean, name: String? = null,
) {
    val stacked = layout.lines.size > 1
    val nameList = listOfNotNull(name?.takeIf { it.isNotBlank() })
    Column(
        Modifier.fillMaxWidth()
            .graphicsLayer { this.alpha = alpha }
            .then(
                if (active) Modifier.clearAndSetSemantics { contentDescription = headline; heading() }
                else Modifier.clearAndSetSemantics { },
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        layout.lines.forEachIndexed { i, line ->
            val gold = stacked && i in layout.nameLines
            Row(
                Modifier.fillMaxWidth().heightIn(min = 28.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Line 1 carries the mirrored sparkles; the other lines keep the same side room.
                if (i == 0) GoldSparkle(HOME_SPARKLE) else Spacer(Modifier.width(HOME_SPARKLE))
                Row(
                    Modifier.weight(1f).padding(horizontal = HOME_SPARKLE_GAP),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                ) {
                    if (double && i == 0) Icon3D(Icon3DName.TROPHY, 22.dp)
                    // AR: the live lettering (purple → magenta, gold numbers, the star separator).
                    BubbleLine(
                        line,
                        when {
                            double -> HeadlinePalette.CELEBRATION
                            // Season surfaces: the greeting takes the season's lettering (iOS parity).
                            else -> HeadlinePalette.season(WTheme.season?.headline)
                                ?: if (gold) HeadlinePalette.LEADERBOARD else HeadlinePalette.HOME
                        },
                        size,
                        Modifier.weight(1f),
                        // A gold name line is the name itself (no second accent inside it).
                        names = if (gold) emptyList() else nameList,
                        sound = active && i == 0,
                        interactive = active,
                    )
                }
                if (i == 0) GoldSparkle(HOME_SPARKLE) else Spacer(Modifier.width(HOME_SPARKLE))
            }
        }
    }
}
