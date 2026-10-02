package com.wordocious.app.ui.game

import kotlinx.coroutines.launch
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.tintedPill
import androidx.compose.animation.core.animateFloat
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameStatus
import com.wordocious.core.GauntletProgress
import com.wordocious.core.GauntletStageConfig
import com.wordocious.core.GauntletStageResult
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import kotlinx.coroutines.delay

/**
 * Gauntlet stage-transition overlay — ports web gauntlet/stage-transition.tsx:
 * a 2.5s full-screen interstitial after clearing a stage (tap to skip).
 *
 * FINISH_SPEC P: a tinted amber card in the Gauntlet accent with a big cast pose per
 * upcoming stage that springs in (GauntletLook.stagePose), "STAGE 3 OF 5" in soft
 * numbers over a 5-dot progress row (cleared = amber with a W badge, the next one
 * pulsing), the next stage's rule as a tinted pill, the running guess total in soft
 * numbers and a large amber candy CONTINUE. The whole screen still taps to skip.
 */
@Composable
fun StageTransitionOverlay(
    completed: GauntletStageConfig,
    next: GauntletStageConfig?,
    /** VS: the same 5 s hold (founder 10-02) — the race clock keeps running, and a tap /
     *  CONTINUE / Enter skips at once. */
    isVersus: Boolean = false,
    /** Stages cleared, counting the one just finished (drives the dots and the pose). */
    cleared: Int = completed.stageIndex + 1,
    /** Stages in the run (5). */
    totalStages: Int = com.wordocious.core.gauntletStages.size,
    /** Guesses used so far — the running score (GauntletLook.guessesSoFar); null hides it. */
    guessesSoFar: Int? = null,
    /** AU3: bumped by the screen's Enter key — skips like a tap. */
    skipSignal: Int = 0,
    onComplete: () -> Unit,
) {
    // AU3 (founder 10-02): fluid in and out — the scrim fades and the card glides up +
    // springs in (no flash / jump between the board and the card), and it stays up AT LEAST
    // 5 s before auto-advancing (VS too, founder 10-02: the race clock keeps running).
    // A tap anywhere / CONTINUE / Enter skips at once. It MUST always auto-advance — the win
    // only records on advance (a real Flawless once showed as an 8/9 Sweep).
    val reduced = WTheme.reducedMotion
    val appear = remember(completed.stageIndex) { androidx.compose.animation.core.Animatable(if (reduced) 1f else 0f) }
    var leaving by remember(completed.stageIndex) { androidx.compose.runtime.mutableStateOf(false) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val latestComplete by androidx.compose.runtime.rememberUpdatedState(onComplete)
    fun leave() {
        if (leaving) return
        leaving = true
        scope.launch {
            if (!reduced) appear.animateTo(0f, com.wordocious.app.ui.Motion.exit())
            latestComplete()
        }
    }
    LaunchedEffect(completed.stageIndex) {
        if (!reduced) appear.animateTo(1f, com.wordocious.app.ui.Motion.springIn())
    }
    LaunchedEffect(completed.stageIndex) {
        delay(GauntletLook.stageHoldMs(isVersus).toLong())
        leave()
    }
    LaunchedEffect(skipSignal) { if (skipSignal > 0) leave() }
    val dark = WTheme.isDark
    val accent = GAUNTLET_ACCENT
    val ink = if (dark) WTheme.text else GAUNTLET_INK
    val heading = if (dark) WTheme.text else com.wordocious.app.ui.FinishInk.heading
    val done = cleared.coerceIn(0, totalStages)
    val pose = GauntletLook.stagePose(if (next != null) done + 1 else null)
    val dots = GauntletLook.stageDots(totalStages, if (next != null) done else totalStages)
    val shape = RoundedCornerShape(24.dp)
    Box(
        Modifier.fillMaxSize()
            .graphicsLayer { alpha = appear.value.coerceIn(0f, 1f) }
            .background(Color(0x731E0F3C)).clickableNoRipple { leave() }
            .semantics { contentDescription = if (next != null) "Stage complete. Next: ${next.name}" else "Stage complete" },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.padding(horizontal = 24.dp).widthIn(max = 380.dp).fillMaxWidth()
                .graphicsLayer {
                    val a = appear.value
                    translationY = (1f - a) * 28.dp.toPx()
                    val s = 0.94f + 0.06f * a
                    scaleX = s; scaleY = s
                }
                .clip(shape).background(com.wordocious.app.ui.accentWash(accent)).border(1.5.dp, com.wordocious.app.ui.accentLine(accent), shape),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.fillMaxWidth().height(10.dp).background(GAUNTLET_BAR))
            Column(
                Modifier.padding(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // The pose springs in (keyed so a new stage replays the spring). Decorative.
                androidx.compose.runtime.key(pose) {
                    com.wordocious.app.ui.SceneArtPop(
                        com.wordocious.app.ui.CastPoses.res(pose.mascot, pose.pose) ?: pose.mascot.res,
                        height = 132.dp, glow = accent.copy(alpha = 0.5f),
                    )
                }
                Text(
                    "STAGE COMPLETE · ${completed.name.uppercase()}",
                    color = ink, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                    fontFamily = com.wordocious.app.ui.theme.Nunito, textAlign = TextAlign.Center,
                )
                // AR: the stage line in the live lettering (gold numbers).
                com.wordocious.app.ui.LiveHeadline(
                    if (next != null) "STAGE ${done + 1} OF $totalStages" else "ALL $totalStages CLEARED",
                    com.wordocious.app.ui.HeadlinePalette.CELEBRATION,
                    Modifier.fillMaxWidth(), maxSize = 26.sp, minSize = 16.sp, maxLines = 1,
                )
                StageDotsRow(dots, done, totalStages)
                if (next != null) {
                    Text(
                        next.name,
                        color = heading, fontSize = 22.sp, fontWeight = FontWeight.Black,
                        fontFamily = com.wordocious.app.ui.theme.Nunito, textAlign = TextAlign.Center,
                    )
                    Text(
                        GauntletLook.stageRuleLine(next).uppercase(),
                        color = ink, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp,
                        fontFamily = com.wordocious.app.ui.theme.Nunito, textAlign = TextAlign.Center,
                        modifier = Modifier.tintedPill(accent, 50.dp).padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
                if (guessesSoFar != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.semantics(mergeDescendants = true) {},
                    ) {
                        com.wordocious.app.ui.SoftNumber("$guessesSoFar", 22.sp)
                        Text(
                            "GUESSES SO FAR", color = ink, fontSize = 10.sp, fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp, fontFamily = com.wordocious.app.ui.theme.Nunito,
                        )
                    }
                }
                // Final stage: invite a tap, but the 4s timer above still fires — the
                // win only records on advance, so this must never wait forever.
                com.wordocious.app.ui.CandyButton(
                    "CONTINUE", onClick = { leave() },
                    color = com.wordocious.app.ui.CandyColor.AMBER, size = com.wordocious.app.ui.CandySize.LARGE,
                    icon = com.wordocious.app.ui.CandyIcon.ARROW, fill = true,
                    contentDescription = if (next == null) "Tap to see your results" else "Tap to continue",
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                )
            }
        }
    }
}

/** The Gauntlet catalog accent (amber). */
internal val GAUNTLET_ACCENT = Color(GauntletLook.ACCENT_ARGB)
/** Labels on the amber card: the accent darkened ~35%. */
internal val GAUNTLET_INK = Color(0xFF8D4D04)
/** The amber card's top bar. */
internal val GAUNTLET_BAR = Brush.horizontalGradient(listOf(Color(0xFFFFC56B), Color(0xFFF59E0B), Color(0xFFD97706)))

/**
 * P the 5-dot progress row: cleared stages filled amber with a small W badge, the
 * next stage pulsing (still with Reduce Motion), the rest a soft amber ring.
 */
@Composable
private fun StageDotsRow(dots: List<GauntletLook.Dot>, done: Int, total: Int) {
    val accent = GAUNTLET_ACCENT
    val still = WTheme.reducedMotion
    val pulse = if (still) 1f else {
        val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "stageDot")
        t.animateFloat(
            1f, 1.18f,
            androidx.compose.animation.core.infiniteRepeatable(
                androidx.compose.animation.core.tween(700, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                androidx.compose.animation.core.RepeatMode.Reverse,
            ),
            label = "stageDotPulse",
        ).value
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "$done of $total stages cleared" },
    ) {
        dots.forEach { d ->
            when (d) {
                GauntletLook.Dot.DONE -> Box(
                    Modifier.size(24.dp).shadow(2.dp, CircleShape, clip = false, spotColor = GAUNTLET_INK)
                        .clip(CircleShape).background(Brush.verticalGradient(listOf(Color(0xFFFFC56B), accent))),
                    contentAlignment = Alignment.Center,
                ) { com.wordocious.app.ui.ResultBadge(true, size = 16.dp) }
                GauntletLook.Dot.CURRENT -> Box(
                    Modifier.size(24.dp).graphicsLayer { scaleX = pulse; scaleY = pulse }
                        .clip(CircleShape).background(accent.copy(alpha = 0.35f)).border(1.5.dp, accent.copy(alpha = 0.6f), CircleShape),
                )
                GauntletLook.Dot.TODO -> Box(
                    Modifier.size(24.dp).clip(CircleShape).background(accent.copy(alpha = 0.12f)).border(1.5.dp, accent.copy(alpha = 0.4f), CircleShape),
                )
            }
        }
    }
}


/**
 * Inline stage review (no dialog) — the ANSWERS pills + final boards for a
 * cleared/failed stage, used by the leaderboard "Completed Today" card's inline
 * expand (iOS GauntletCompletedView.stageRow → solutionsReveal + stageBoards).
 */
@Composable
internal fun GauntletStageInlineReview(result: GauntletStageResult) {
    val boards = result.boardsSnapshot ?: return
    val won = result.status == GameStatus.WON
    val cols = if (boards.size == 1) 1 else if (boards.size <= 4) 2 else 4
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        // ANSWERS pills
        // A1 the answers window is tinted, never near-white.
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(com.wordocious.app.ui.accentWash(Color(0xFF7C3AED)))
                .border(1.5.dp, com.wordocious.app.ui.accentLine(Color(0xFF7C3AED)), RoundedCornerShape(12.dp)).padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                if (boards.size == 1) "ANSWER" else "ANSWERS",
                fontSize = 9.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textMuted else com.wordocious.app.ui.FinishInk.muted, letterSpacing = 0.8.sp,
            )
            boards.chunked(cols).forEach { rowBoards ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    rowBoards.forEach { b ->
                        val bWon = b.status == GameStatus.WON
                        Text(
                            b.solution.uppercase(),
                            fontSize = 11.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                            color = if (bWon) Color(0xFF7C3AED) else Color(0xFFDC2626),
                            modifier = Modifier.weight(1f)
                                .softChip(if (bWon) Color(0xFF7C3AED) else Color(0xFFDC2626), corner = 8.dp).padding(vertical = 2.dp),
                        )
                    }
                    repeat(cols - rowBoards.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        // Final boards
        boards.chunked(cols).forEach { rowBoards ->
            Row(Modifier.fillMaxWidth().height(if (cols == 1) 200.dp else 150.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                rowBoards.forEach { b -> StageReviewBoard(b, won, Modifier.weight(1f).fillMaxHeight()) }
                repeat(cols - rowBoards.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun StageReviewBoard(board: BoardState, stageWon: Boolean, modifier: Modifier = Modifier) {
    val won = board.status == GameStatus.WON
    val lost = !stageWon && !won
    val prefills = board.prefilledGuesses ?: emptyList()
    val totalRows = prefills.size + board.maxGuesses

    Column(
        // FINISH_SPEC L: each mini board in its own game tray — purple won, slate lost.
        modifier.gameTray(
            Color(0xFF7C3AED), if (won) TrayState.WON else if (lost) TrayState.LOST else TrayState.PLAYING,
            corner = 12.dp, padding = androidx.compose.foundation.layout.PaddingValues(4.dp), shadow = false,
        ),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        val rows: List<List<Pair<String, TileState>>> = buildList {
            prefills.forEach { p -> add(p.evaluation.tiles.map { it.letter to it.state }) }
            board.guesses.forEach { g ->
                add(evaluateGuess(board.solution, g).tiles.map { it.letter to it.state })
            }
            while (size < totalRows) add(List(board.solution.length) { "" to TileState.EMPTY })
        }
        rows.forEach { tiles ->
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                tiles.forEach { (letter, st) ->
                    TileView(
                        // Font/corner/border all derive from the measured tile
                        // (these rows are 9-10dp tall — fixed chrome drowned them).
                        letter = letter, state = st, square = false, mini = true,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

private fun fmtMs(ms: Int): String {
    val secs = ms / 1000
    return "%d:%02d".format(secs / 60, secs % 60)
}
