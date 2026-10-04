package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
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
    val noun = if (more) "puzzles" else "daily puzzles"
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
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                PopupClose(closeAndMaybeReview, tint = if (dark) WTheme.text else ink)
            }
            // Moment lettering (ART_SPEC §6): SWEEP! / FLAWLESS!, read as the full title.
            MomentTitle(
                if (flawless) MomentArt.FLAWLESS else MomentArt.SWEEP,
                contentDescription = titleCaseLabel(title),
                widthFraction = 0.82f, maxHeight = 84.dp,
            )
            // G3: the big scene art springing in with a bounce on a soft glow.
            SceneArtPop(
                if (flawless) R.drawable.art_scene_flawless_star else R.drawable.art_scene_sweep_broom,
                height = 210.dp, glow = Color.White, delayMs = 120,
            )
            Text(
                if (flawless) "All ${totals.total} $noun won today" else "All ${totals.total} $noun completed today",
                fontSize = 14.sp, fontWeight = FontWeight.Black, color = if (dark) WTheme.text else ink,
                textAlign = TextAlign.Center,
            )
            // A2: the totals as soft-number stat tiles in the moment's color.
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TintedStatTile(accent, "WON", "${totals.won}/${totals.total}", Modifier.weight(1f), valueSize = 22.sp, bar = true)
                TintedStatTile(accent, "TOTAL TIME", fmt(totals.totalTimeSeconds), Modifier.weight(1f), valueSize = 22.sp, bar = true)
                TintedStatTile(accent, "TOTAL PTS", formatScore(totals.totalScore.toDouble()), Modifier.weight(1f), valueSize = 22.sp, bar = true)
            }
            // Per-game results: mini game cards (tinted by game) with their W / L badge.
            TintedCard(
                accent, Modifier.fillMaxWidth(), corner = 18.dp,
                contentPadding = PaddingValues(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                rows.chunked(3).forEach { triple ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        triple.forEach { r -> SweepResultCell(r, Modifier.weight(1f)) }
                        repeat(3 - triple.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            Spacer(Modifier.height(2.dp))
            CastButton(
                "Share", onClick = onShare,
                color = (if (flawless) CandyColor.PINK else CandyColor.AMBER).cast(null),
                size = CastSize.L, fill = true,
                modifier = Modifier.fillMaxWidth(),
            )
            CastButton(
                "Close", onClick = closeAndMaybeReview, color = CastColor.SLATE, size = CastSize.M,
                fill = true, modifier = Modifier.fillMaxWidth(0.6f),
            )
        }
        // G3: confetti in the moment's colors (off with Reduce Motion).
        PopupConfetti(if (flawless) MomentInk.flawlessConfetti else MomentInk.sweepConfetti)
    }
}

/** One game in the results grid: its icon as a mini game card, the short label, the W / L badge. */
@Composable
private fun SweepResultCell(r: DailySweepShare.Row, modifier: Modifier) {
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
            r.label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
            color = if (WTheme.isDark) WTheme.text else FinishInk.heading, maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        Spacer(Modifier.weight(1f))
        ResultBadge(r.won, size = 16.dp)
    }
}

private fun fmt(s: Int): String = "%d:%02d".format(s / 60, s % 60)
