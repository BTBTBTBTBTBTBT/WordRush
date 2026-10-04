package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandyIcon
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.CastPoses
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
import com.wordocious.app.ui.PopupConfetti
import com.wordocious.app.ui.SceneArtPop
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.TintedCard
import com.wordocious.app.ui.accentWash
import com.wordocious.app.ui.softNumberStyle
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.tintedPill
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.GauntletProgress
import com.wordocious.core.TileState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// FINISH_SPEC Q — the Gauntlet finish screen, keeping the B6 finished-screen layout
// and all its data: an amber hero card on top (WON: the champion scene springs in,
// then bobs, with one confetti burst; LOST: R with cocoa + I's good game, kind,
// never sad, and the failed stage's answer on glossy tiles), the headline in the
// soft-number ink, the 5-star row, three soft-number stat pills and (Unlimited) a large
// amber "Play again"; the dock leads with "Share results" + "Next Gauntlet in …". Then the score breakdown, the next-daily
// handoff and the per-stage rows on the shared game tray (L), each with its W / L
// badge. Reduce Motion: no bob, no confetti, the stars at once. Mirrors web
// components/gauntlet/gauntlet-results.tsx.

/** The champion scene's aspect (1200 × 815). */
private const val CHAMPION_ASPECT = 1200f / 815f

/** Q the confetti palette: amber, gold and the cast's candy colors. */
private val GAUNTLET_CONFETTI = listOf(
    Color(0xFFF59E0B), Color(0xFFFFD66B), Color(0xFFF97316), Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFF34D399),
)

/**
 * The whole Gauntlet results screen body (PostGameScreen's GauntletResultsScreen
 * delegates here). Same inputs and callbacks as before.
 */
@Composable
internal fun GauntletFinishScreen(
    g: GauntletProgress, won: Boolean, seed: String, elapsedSeconds: Int, hintsUsed: Int,
    onHome: () -> Unit, onShare: () -> Unit,
    onPlayAgain: (() -> Unit)?, onOpenDaily: ((GameMode) -> Unit)?,
    onOpenUnlimited: ((GameMode) -> Unit)? = null,
    onOpenLeaderboard: ((GameMode) -> Unit)? = null,
) {
    val cleared = g.stageResults.count { it.status == GameStatus.WON }
    val totalGuesses = g.stageResults.sumOf { it.guesses }
    val totalTimeMs = g.stageResults.sumOf { it.timeMs }.takeIf { it > 0 } ?: (elapsedSeconds * 1000)
    val cumBoards = g.stageResults.sumOf { r ->
        if (r.status == GameStatus.WON) (g.stages.firstOrNull { it.stageIndex == r.stageIndex }?.boardCount ?: 0)
        else (r.boardsSnapshot?.count { it.status == GameStatus.WON } ?: 0)
    }
    val cumTotal = maxOf(1, g.stages.sumOf { it.boardCount })
    val isDaily = seed == com.wordocious.app.todayLocalSeed(GameMode.GAUNTLET.name)

    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }

    // BA2 (founder 10-02): the results fit ONE screen — the hero card (scene, headline, stars,
    // stat pills, the actions) and the compact dock; the score and stage breakdowns live behind
    // the "More" chip like every other game. Centered in the height; scrolls only as a fallback.
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val viewport = maxHeight
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .heightIn(min = viewport)
                .padding(horizontal = 16.dp).padding(top = 52.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Founder 10-02: the hero art is capped (~280 dp, at most 45% of the page) so the
            // title, stars, stats, dock and More all fit one balanced screen.
            val artMax = if (isShortScreen()) 110.dp else minOf(280.dp, viewport * 0.45f)
            GauntletHeroCard(
                g = g, won = won, cleared = cleared, totalGuesses = totalGuesses, totalTimeMs = totalTimeMs,
                isDaily = isDaily, onPlayAgain = onPlayAgain, artMax = artMax,
                modifier = Modifier.riseIn(appeared, 0),
            )
            Box(Modifier.riseIn(appeared, 400)) {
                FinishedDock(
                    mode = GameMode.GAUNTLET, isDaily = isDaily && onOpenDaily != null, accent = GAUNTLET_ACCENT,
                    // Founder 10-02: "Share results" leads the dock (+ "Next Gauntlet in …" on a daily);
                    // it replaces the hero card's floating share and "Play again tomorrow".
                    onShare = onShare,
                    onOpenDaily = onOpenDaily, onOpenLeaderboard = onOpenLeaderboard, onOpenUnlimited = onOpenUnlimited,
                    more = {
                        ScoreBreakdownCard(
                            mode = GameMode.GAUNTLET, won = won, guessCount = totalGuesses,
                            elapsedSeconds = totalTimeMs / 1000, boardsSolved = cumBoards, totalBoards = cumTotal,
                            hintsUsed = hintsUsed, stagesCompleted = cleared,
                            day = com.wordocious.core.getDailySeedDate(seed),
                        )
                        // L: the per-stage rows (each with its W / L badge, tap to expand the final
                        // boards) on the shared game tray in the Gauntlet amber.
                        GameTray(
                            GAUNTLET_ACCENT, Modifier.fillMaxWidth(),
                            state = TrayState.PLAYING, padding = PaddingValues(12.dp),
                        ) {
                            GauntletStageBreakdown(g = g, totalMs = totalTimeMs, showSummary = false, showStageHeader = true)
                        }
                    },
                )
            }
        }
        // One confetti burst over the screen on a cleared run (off with Reduce Motion).
        if (won) PopupConfetti(GAUNTLET_CONFETTI)
    }
}

/** Q the amber hero card: art, headline, stars, stat pills, the failed answer, actions. */
@Composable
private fun GauntletHeroCard(
    g: GauntletProgress, won: Boolean, cleared: Int, totalGuesses: Int, totalTimeMs: Int,
    isDaily: Boolean, onPlayAgain: (() -> Unit)?, artMax: Dp,
    modifier: Modifier = Modifier,
) {
    val accent = GAUNTLET_ACCENT
    val total = g.totalStages.takeIf { it > 0 } ?: 5
    TintedCard(
        accent, modifier.fillMaxWidth(), corner = 24.dp, bar = GAUNTLET_BAR,
        // LOST: the same card in a lighter amber.
        tint = accentWash(accent, if (won) 0.14f else 0.07f),
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (won) {
            ChampionScene(artMax)
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.Bottom) {
                GauntletLook.LOST_POSES.forEachIndexed { i, p ->
                    SceneArtPop(
                        CastPoses.res(p.mascot, p.pose) ?: p.mascot.res, height = minOf(if (isShortScreen()) 92.dp else 124.dp, artMax),
                        modifier = Modifier.weight(1f), delayMs = i * 120L,
                    )
                }
            }
        }
        // BJ16: GAUNTLET CLEARED! / SO CLOSE! as lettering art.
        if (won) com.wordocious.app.ui.HeadingArt(com.wordocious.app.ui.Heading.GAUNTLETCLEARED, height = 40.dp, maxWidth = 340.dp)
        else com.wordocious.app.ui.MomentTitle(com.wordocious.app.ui.MomentArt.SO_CLOSE, maxHeight = 60.dp)
        StarRow(GauntletLook.starRow(total, cleared), cleared, total)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FinishStatPill("$cleared/$total", "Stages", Color(0xFFF5A524), Color(0xFFA2560C), Modifier.weight(1f)) {
                Icon3D(Icon3DName.TROPHY, 20.dp)
            }
            FinishStatPill(fmtRunTime(totalTimeMs), "Time", Color(0xFF2563EB), Color(0xFF2456A8), Modifier.weight(1f)) {
                Icon(Icons.Filled.Schedule, null, tint = Color(0xFF2563EB), modifier = Modifier.size(20.dp))
            }
            FinishStatPill("$totalGuesses", "Guesses", Color(0xFF7C3AED), Color(0xFF6D28D9), Modifier.weight(1f)) {
                Icon3D(Icon3DName.BADGE_CHECK, 20.dp)
            }
        }
        if (!won) FailedAnswers(GauntletLook.failedAnswers(g))
        // B6: an Unlimited (Pro) run's "Play again", centered. Founder 10-02: share and the
        // daily "Play again tomorrow" moved to the dock ("Share results" + "Next Gauntlet in …");
        // the corner Home button still goes home.
        if (onPlayAgain != null) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CandyButton(
                    "Play again", onClick = onPlayAgain, color = CandyColor.AMBER, size = CandySize.LARGE,
                    icon = CandyIcon.PLAY,
                )
            }
        }
        if (isDaily) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { DailyRankBadge(GameMode.GAUNTLET) }
    }
}

/** Q WON: the champion scene, full card width, springing in then bobbing gently. Decorative. */
@Composable
private fun ChampionScene(maxHeight: Dp) {
    val still = WTheme.reducedMotion
    val scale = remember { Animatable(if (still) 1f else 0.4f) }
    val alpha = remember { Animatable(if (still) 1f else 0f) }
    val feedbackView = androidx.compose.ui.platform.LocalView.current
    LaunchedEffect(Unit) {
        // Spec U: Gauntlet champion = celebrate · success + heavy (sound stays under Reduce Motion).
        com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.CELEBRATE, feedbackView)
    }
    LaunchedEffect(still) {
        if (still) { scale.snapTo(1f); alpha.snapTo(1f) } else {
            launch { alpha.animateTo(1f, tween(180)) }
            scale.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = 220f))
        }
    }
    // FINISH_SPEC AD: the spring-in stays; the idle bob stops under Battery Saver too.
    val bob = if (still || WTheme.calmMotion) 0f else {
        rememberInfiniteTransition(label = "championBob").animateFloat(
            0f, 1f, infiniteRepeatable(tween(1300, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "bob",
        ).value
    }
    Image(
        painterResource(R.drawable.art_scene_gauntlet_champion),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        // BA2 + founder 10-02: capped (110 dp on a short screen, else ~280 dp / 45% of the page)
        // so the whole result fits one screen.
        modifier = Modifier.fillMaxWidth().heightIn(max = maxHeight).aspectRatio(CHAMPION_ASPECT).clearAndSetSemantics { }.graphicsLayer {
            scaleX = scale.value; scaleY = scale.value; this.alpha = alpha.value
            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0.9f)
            translationY = -5.dp.toPx() * bob
        },
    )
}

/** Q the 5-star row: filled gold per cleared stage, the rest soft gray; popping in 90 ms apart. */
@Composable
private fun StarRow(stars: List<Boolean>, cleared: Int, total: Int) {
    Row(
        Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "$cleared of $total stages cleared" },
        horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
    ) {
        stars.forEachIndexed { i, on -> FinishStar(on, i, 30.dp) }
    }
}

@Composable
private fun FinishStar(on: Boolean, index: Int, size: Dp) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(still) {
        if (still) pop.snapTo(1f) else {
            delay(350L + index * GauntletLook.STAR_STAGGER_MS.toLong())
            pop.animateTo(1f, spring(dampingRatio = 0.4f, stiffness = 380f))
        }
    }
    val top = if (on) Color(0xFFFFE08A) else Color(0xFFE6E2EE)
    val bottom = if (on) Color(0xFFF5A524) else Color(0xFFC9C3D6)
    val line = if (on) Color(0xFFB4690E) else Color(0xFFB9B2C8)
    Canvas(Modifier.size(size).graphicsLayer { scaleX = pop.value; scaleY = pop.value; alpha = pop.value.coerceIn(0f, 1f) }) {
        // The 24-unit star path (web gauntlet-results Star), scaled to the box.
        val k = this.size.minDimension / 24f
        val pts = listOf(
            12f to 2.6f, 14.9f to 8.5f, 21.4f to 9.4f, 16.7f to 14f, 17.8f to 20.5f,
            12f to 17.4f, 6.2f to 20.5f, 7.3f to 14f, 2.6f to 9.4f, 9.1f to 8.5f,
        )
        val path = Path().apply {
            pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(x * k, y * k) else lineTo(x * k, y * k) }
            close()
        }
        if (on) {
            val shadow = Path().apply { addPath(path, Offset(0f, 2f * k)) }
            drawPath(shadow, Color(0x59A24B0E))
        }
        drawPath(path, Brush.verticalGradient(listOf(top, bottom), startY = 2.6f * k, endY = 20.5f * k))
        drawPath(path, line, style = Stroke(width = 1f * k, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

/** A1 + A2: a tinted stat pill — icon, soft number, small-caps label in the accent's ink. */
@Composable
private fun FinishStatPill(
    value: String, label: String, accent: Color, ink: Color, modifier: Modifier = Modifier,
    icon: @Composable () -> Unit,
) {
    Column(
        modifier.tintedPill(accent, 14.dp).padding(top = 10.dp, bottom = 8.dp, start = 4.dp, end = 4.dp)
            .semantics(mergeDescendants = true) { contentDescription = "$value $label" },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        icon()
        SoftNumber(value, 20.sp)
        Text(
            label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, fontFamily = Nunito,
            color = if (WTheme.isDark) WTheme.textMuted else ink,
        )
    }
}

/** Q LOST: the failed stage's unsolved answer(s), each on glossy solved tiles. */
@Composable
private fun FailedAnswers(answers: List<String>) {
    if (answers.isEmpty()) return
    val one = answers.size == 1
    Column(
        Modifier.fillMaxWidth().semantics(mergeDescendants = true) {
            contentDescription = (if (one) "The answer was " else "The answers were ") + answers.joinToString(", ")
        },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text(
            if (one) "THE ANSWER" else "THE ANSWERS",
            fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp, fontFamily = Nunito,
            color = if (WTheme.isDark) WTheme.textMuted else GAUNTLET_INK,
        )
        answers.forEach { word ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.clearAndSetSemantics { }) {
                word.forEach { ch -> TileView(letter = ch.toString(), state = TileState.CORRECT, modifier = Modifier.size(30.dp)) }
            }
        }
    }
}

/** iOS RiseIn: fade in while rising 14 dp, eased out after [delayMs] (instant with Reduce Motion). */
@Composable
private fun Modifier.riseIn(appeared: Boolean, delayMs: Int): Modifier {
    val reduced = WTheme.reducedMotion
    val t by androidx.compose.animation.core.animateFloatAsState(
        if (appeared) 1f else 0f,
        tween(if (reduced) 0 else 400, if (reduced) 0 else delayMs, androidx.compose.animation.core.EaseOut),
        label = "gauntletRiseIn",
    )
    return this.graphicsLayer { alpha = t; translationY = (1f - t) * 14.dp.toPx() }
}

/** Compact "45s" / "2m 5s" from milliseconds (iOS GauntletResultsView.fmt). */
private fun fmtRunTime(ms: Int): String {
    val s = ms / 1000
    return if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"
}
