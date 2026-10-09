package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import kotlinx.coroutines.delay
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.data.DailySweepShare
import com.wordocious.app.ui.theme.WTheme

/**
 * One-time-per-day Daily Sweep / Flawless Victory celebration (FINISH_SPEC G3): a
 * full-screen overlay tinted in the moment's color (pink for Flawless, gold for the
 * Sweep), the existing moment lettering, the big scene art springing in with a bounce
 * (`art_scene_flawless_star` / `art_scene_sweep_broom`) on a soft glow, the totals as
 * soft-number stat tiles, the per-game results as mini game cards with W / L badges,
 * confetti, and candy CTAs (Share + Close). Reduce Motion: no spring, no confetti.
 * Mirrors web sweep-celebration.tsx + iOS SweepCelebrationView.
 */
@Composable
fun SweepCelebration(
    byMode: Map<String, DailyCompletionsService.Completion>,
    onShare: () -> Unit,
    onClose: () -> Unit,
    /** false = the Daily Sweep; true = the More Games Sweep (founder, 2026-09-26) — the same
     *  celebration over the ten More Games dailies, never awarding anything and never using
     *  the Daily Sweep wording. */
    more: Boolean = false,
) {
    val totals = remember(byMode, more) {
        if (!more) DailyCompletionsService.totals(byMode)
        else moreTotals(byMode).let { t -> DailyCompletionsService.Totals(t.completed, t.won, t.total, 0, t.totalTimeSeconds, t.totalScore) }
    }
    val flawless = if (more) moreSweepTier(byMode) == MoreSweepTier.FLAWLESS else totals.flawless
    val rows = remember(byMode, more) { DailySweepShare.rows(byMode, more) }
    val title = if (flawless) (if (more) MoreSweepTier.FLAWLESS.title else "FLAWLESS VICTORY!")
                else (if (more) MoreSweepTier.SWEEP.title else "DAILY SWEEP!")
    // 2.8 item 7: current naming ("All 10 Puzzles done today!").
    val noun = if (more) "Puzzles" else "Dailies"
    // G3: the moment's color — pink for Flawless, gold for the Sweep.
    val accent = if (flawless) MomentInk.flawless else MomentInk.sweep
    val ink = darkenInk(accent)
    val dark = WTheme.isDark
    // FINISH_SPEC AI: the store review ask rides the END of the Daily Sweep / Flawless
    // celebration (not the More Games sweep); every gate lives in StoreReview.
    val reviewActivity = androidx.compose.ui.platform.LocalContext.current as? android.app.Activity
    val closeAndMaybeReview: () -> Unit = {
        onClose()
        if (!more) reviewActivity?.let {
            com.wordocious.app.data.StoreReview.maybeAsk(
                it, if (flawless) com.wordocious.app.data.StoreReview.Moment.FLAWLESS else com.wordocious.app.data.StoreReview.Moment.DAILY_SWEEP,
            )
        }
    }

    // iOS fires the success haptic + jingle on appear — the biggest daily
    // milestone shouldn't land quieter than an ordinary win.
    // Spec U: Sweep / Flawless = celebrate · success + heavy.
    val feedbackView = androidx.compose.ui.platform.LocalView.current
    LaunchedEffect(Unit) {
        com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.CELEBRATE, feedbackView)
    }
    // The page fades in (instant under Reduce Motion).
    val appear = remember { Animatable(if (WTheme.reducedMotion) 1f else 0f) }
    LaunchedEffect(Unit) { if (appear.value < 1f) appear.animateTo(1f, tween(220)) }

    // 2.8 item 7 kit (docs/design/brand/2.8/celebrate): props only; the season's swap via the registry extras.
    val still = WTheme.calmMotion
    val ctx = LocalContext.current
    val season = remember { SeasonSkins.current() }
    @androidx.annotation.DrawableRes fun kitRes(name: String): Int {
        val n = SeasonKit.extra(ctx, season, name) ?: return 0
        return ctx.resources.getIdentifier(n.replace('-', '_'), "drawable", ctx.packageName)
    }
    // one clock for the kit: 0 -> 1 as it blooms; a second for the sparkle sweep; the stats count up; the badges stamp in
    val kit = remember { Animatable(if (still) 1f else 0f) }
    val sweep = remember { Animatable(if (still) 2.6f else -1.4f) }
    var progress by remember { mutableStateOf(if (still) 1f else 0f) }
    var stamped by remember { mutableIntStateOf(if (still) Int.MAX_VALUE else 0) }
    LaunchedEffect(Unit) {
        if (still) return@LaunchedEffect
        kit.animateTo(1f, spring(dampingRatio = 0.62f, stiffness = 90f))
    }
    LaunchedEffect(Unit) {
        if (still) return@LaunchedEffect
        delay(450)
        sweep.animateTo(2.6f, tween(1100))
    }
    LaunchedEffect(Unit) {
        if (still) return@LaunchedEffect
        delay(650)
        val steps = 28
        for (i in 1..steps) {
            val k = i / steps.toFloat()
            progress = 1f - (1f - k) * (1f - k) * (1f - k)
            delay(32)
        }
        progress = 1f
    }
    LaunchedEffect(Unit) {
        if (still) return@LaunchedEffect
        delay(700)
        for (k in 1..maxOf(1, rows.size)) {
            stamped = k
            com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.PRESS, feedbackView)
            delay(110)
        }
    }

    // Your mascot cheers with it (a no-op while the living mascot is off) — a beat after the popup mounts.
    LaunchedEffect(Unit) {
        delay(500)
        com.wordocious.app.data.MascotMoments.emit(if (flawless) com.wordocious.core.AvatarReaction.FLAWLESS else com.wordocious.core.AvatarReaction.SWEEP)
    }

    androidx.activity.compose.BackHandler(onBack = closeAndMaybeReview)
    Box(
        Modifier.fillMaxSize()
            .graphicsLayer { alpha = appear.value }
            .background(
                if (dark) Brush.verticalGradient(listOf(accent.copy(alpha = 0.32f).compositeOver(Color(0xFF15101F)), Color(0xFF15101F)))
                else Brush.verticalGradient(listOf(Wash.mix(accent, 0.30f), Wash.mix(accent, 0.12f), Wash.mix(accent, 0.20f))),
            )
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { },
    ) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp).padding(bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            // 2.8 item 7: centered on BOTH axes on every screen size (the Column is the screen tall).
            verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                PopupClose(closeAndMaybeReview, tint = if (dark) WTheme.text else ink)
            }
            // Moment lettering (ART_SPEC §6): SWEEP! / FLAWLESS!, read as the full title.
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                MomentTitle(
                    if (flawless) MomentArt.FLAWLESS else MomentArt.SWEEP,
                    contentDescription = titleCaseLabel(title),
                    widthFraction = 0.82f, maxHeight = 84.dp,
                )
                // the streamers swing in either side; one sparkle trail sweeps across the lettering
                val streamers = kitRes("celebrate-streamers-pair")
                if (streamers != 0) {
                    for (left in listOf(true, false)) {
                        Image(
                            painterResource(streamers), null, contentScale = ContentScale.Fit,
                            modifier = Modifier.align(if (left) Alignment.TopStart else Alignment.TopEnd).width(56.dp).offset(y = (-22).dp)
                                .graphicsLayer {
                                    val k = kit.value.coerceIn(0f, 1f)
                                    alpha = k
                                    rotationZ = (1f - k) * (if (left) -24f else 24f)
                                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(if (left) 1f else 0f, 0f)
                                    scaleX = if (left) 1f else -1f
                                },
                        )
                    }
                }
                val sparkle = kitRes("celebrate-sparkle-sweep")
                if (sparkle != 0 && !still) {
                    Box(Modifier.matchParentSize().clipToBounds()) {
                        Image(
                            painterResource(sparkle), null, contentScale = ContentScale.FillHeight,
                            modifier = Modifier.height(100.dp).align(Alignment.CenterStart)
                                .graphicsLayer { translationX = sweep.value * size.width * 1.2f },
                        )
                    }
                }
            }
            // G3: the big scene art springing in with a bounce on a soft glow.
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                // the confetti + streamer burst blooms BEHIND the art (gold for Flawless)
                val burst = kitRes(if (flawless) "celebrate-burst-gold" else "celebrate-burst-party")
                if (burst != 0) {
                    Image(
                        painterResource(burst), null, contentScale = ContentScale.Fit,
                        modifier = Modifier.size(330.dp).graphicsLayer {
                            val k = kit.value.coerceIn(0f, 1f)
                            scaleX = 0.35f + 0.65f * k; scaleY = 0.35f + 0.65f * k
                            rotationZ = (1f - k) * -6f
                            alpha = 0.92f * k
                        },
                    )
                }
                SceneArtPop(
                    if (flawless) R.drawable.art_scene_flawless_star else R.drawable.art_scene_sweep_broom,
                    height = 210.dp, glow = Color.White, delayMs = 120,
                )
                // Halloween: bats + a broom drift in at the corners (registry extras; none out of season)
                for ((name, left, w) in listOf(Triple("celebrate-float-1", true, 70), Triple("celebrate-float-2", false, 58))) {
                    val f = kitRes(name)
                    if (f != 0) {
                        Image(
                            painterResource(f), null, contentScale = ContentScale.Fit,
                            modifier = Modifier.align(if (left) Alignment.TopStart else Alignment.TopEnd).width(w.dp)
                                .graphicsLayer { val k = kit.value.coerceIn(0f, 1f); alpha = k; translationY = (1f - k) * 12.dp.toPx() },
                        )
                    }
                }
                // 2.8 items 7 + 13: YOUR mascot stands beside the art, celebrating with it
                OwnMascotCutout(
                    96.dp,
                    Modifier.align(Alignment.BottomEnd).offset(x = 18.dp, y = 6.dp)
                        .graphicsLayer { val k = kit.value.coerceIn(0f, 1f); alpha = k; scaleX = 0.4f + 0.6f * k; scaleY = 0.4f + 0.6f * k; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f) },
                )
                // Flawless: the crown drops onto the star (Halloween: the witch hat)
                val crown = if (flawless) kitRes("celebrate-crown-gold") else 0
                if (crown != 0) {
                    Image(
                        painterResource(crown), null, contentScale = ContentScale.Fit,
                        modifier = Modifier.align(Alignment.TopCenter).width(78.dp).offset(y = (-6).dp)
                            .graphicsLayer {
                                val k = kit.value.coerceIn(0f, 1f)
                                alpha = k; translationY = (1f - k) * -42.dp.toPx()
                                scaleX = 0.7f + 0.3f * k; scaleY = 0.7f + 0.3f * k
                            },
                    )
                }
            }
            Text(
                "All ${totals.total} $noun ${if (flawless) "won" else "done"} today!",
                fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.text else ink,
                textAlign = TextAlign.Center,
            )
            // A2: the totals as soft-number stat tiles in the moment's color.
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TintedStatTile(accent, "WON", "${(totals.won * progress).toInt()}/${totals.total}", Modifier.weight(1f), valueSize = 22.sp, bar = true)
                TintedStatTile(accent, "TOTAL TIME", fmt((totals.totalTimeSeconds * progress).toInt()), Modifier.weight(1f), valueSize = 22.sp, bar = true)
                TintedStatTile(accent, "TOTAL PTS", formatScore((totals.totalScore.toDouble() * progress).toInt().toDouble()), Modifier.weight(1f), valueSize = 22.sp, bar = true)
            }
            // Per-game results: mini game cards (tinted by game) with their W / L badge.
            TintedCard(
                accent, Modifier.fillMaxWidth(), corner = 18.dp,
                contentPadding = PaddingValues(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // 2 columns: every name the same size, W/L badges in one aligned column (3 columns orphaned Starsweep).
                rows.chunked(2).forEachIndexed { rowIdx, pair ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        pair.forEachIndexed { col, r -> SweepResultCell(r, Modifier.weight(1f), stamped > rowIdx * 2 + col) }
                        repeat(2 - pair.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            Spacer(Modifier.height(2.dp))
            // 2.8 item 23: family buttons sized to their labels (SHARE cast medium, CLOSE the family QUIET).
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                CastButton(
                    "Share", onClick = onShare,
                    color = (if (flawless) CandyColor.PINK else CandyColor.AMBER).cast(null),
                    size = CastSize.M, fill = false,
                )
                QuietButton("Close", onClick = closeAndMaybeReview, size = CandySize.MEDIUM)
            }
        }
        // G3: confetti in the moment's colors (off with Reduce Motion).
        PopupConfetti(if (flawless) MomentInk.flawlessConfetti else MomentInk.sweepConfetti)
    }
}

/** One game in the results grid: its icon as a mini game card, the short label, the W / L badge. */
@Composable
private fun SweepResultCell(r: DailySweepShare.Row, modifier: Modifier, stamped: Boolean = true) {
    val accent = Color(r.accent)
    val card = runCatching { com.wordocious.core.GameMode.valueOf(r.dbKey) }.getOrNull()?.let { modeCardFor(it) }
        ?: modeCardForKey(r.dbKey)
    Row(
        modifier.semantics(mergeDescendants = true) { contentDescription = r.label + if (r.won) ", won" else ", lost" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(Modifier.size(28.dp).miniGameCard(accent, 8.dp), contentAlignment = Alignment.Center) {
            if (card != null) ModeGlyph(card, tint = accent, box = 24.dp)
            else Text(r.glyph, fontSize = if (r.glyph.length >= 3) 9.sp else 12.sp, fontWeight = FontWeight.Black, color = darkenInk(accent))
        }
        // weight(1f, fill = false) so the LABEL absorbs the squeeze, not the badge.
        Text(
            r.label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
            color = if (WTheme.isDark) WTheme.text else FinishInk.heading, maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        Spacer(Modifier.weight(1f))
        // each game's W / L badge stamps in one by one (scale 2.4 -> 1, a quarter turn of tilt, fading in)
        val st by androidx.compose.animation.core.animateFloatAsState(
            if (stamped) 1f else 0f, spring(dampingRatio = 0.55f, stiffness = 500f), label = "sweepStamp",
        )
        ResultBadge(
            r.won, size = 16.dp,
            modifier = Modifier.graphicsLayer {
                val s = 2.4f - 1.4f * st
                scaleX = s; scaleY = s; rotationZ = (1f - st) * -14f; alpha = st.coerceIn(0f, 1f)
            },
        )
    }
}

private fun fmt(s: Int): String = "%d:%02d".format(s / 60, s % 60)
