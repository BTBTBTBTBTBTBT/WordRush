package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.TrackChanges
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.CandyButton
import com.wordocious.app.ui.CandyColor
import com.wordocious.app.ui.CandyIcon
import com.wordocious.app.ui.CandySize
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.Icon3D
import com.wordocious.app.ui.Icon3DName
import com.wordocious.app.ui.Mascot
import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.Mascots
import com.wordocious.app.ui.MomentArt
import com.wordocious.app.ui.MomentTitle
import com.wordocious.app.ui.PopupConfetti
import com.wordocious.app.ui.PopupScrim
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.darkenInk
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

// docs/FINISH_SPEC.md R1 — THE win / lose popup, one component for every game (web
// components/effects/result-popup.tsx parity): a soft game-accent card over the warm
// cream with the rainbow bar, the host on a stage (glow, slow rays, ground shadow,
// spring-in with a 1.06 overshoot, then a bob), one confetti burst in the cast
// colors, the moment lettering with one gloss sweep, the answers on small glossy
// tiles in a tinted tray, stat chips (points counting up with a sparkle) and a candy
// CONTINUE in the game accent. Reduce Motion: no rays, bob, confetti or count-up.

// ── Pure bits (unit-tested: WinPopupTest) ─────────────────────────────────

/** What a stat chip shows as its glyph: boards = grid, guesses (and the other counts) = target, time = clock, points = gold star. */
enum class WinStatKind { BOARDS, GUESSES, TIME, POINTS }

/** One stat chip: [value] in soft numbers over [label] in small caps. */
data class WinStat(val kind: WinStatKind, val value: String, val label: String)

/** The answers in the tray: one word per entry, [solved] per word (missing = solved on a win). */
data class WinAnswers(val words: List<String>, val solved: List<Boolean> = emptyList()) {
    fun isSolved(i: Int, won: Boolean): Boolean = solved.getOrNull(i) ?: won
}

object WinPopupMath {
    /** The warm cream under the card wash. */
    const val CREAM: Int = 0xFFFFF9F2.toInt()
    const val COUNT_UP_MS = 700
    const val FLIP_MS = 300
    const val TILE_STAGGER_MS = 40
    const val WORD_STAGGER_MS = 120
    const val TRAY_DELAY_MS = 200

    /** The points count-up: ease-out (cubic) from 0 to [target] at [t] ∈ [0, 1] (web countUpValue). */
    fun countUpValue(target: Int, t: Float): Int {
        val k = t.coerceIn(0f, 1f)
        return (target * (1.0 - (1.0 - k).pow(3))).roundToInt()
    }

    /** The count-up at [elapsedMs] of [durationMs]. */
    fun countUpAt(target: Int, elapsedMs: Long, durationMs: Int = COUNT_UP_MS): Int =
        if (durationMs <= 0) target else countUpValue(target, elapsedMs.toFloat() / durationMs)

    /** A chip's glyph from the caller's label ("TIME", "POINTS", "BOARDS"; every other count is a target). */
    fun kindFor(label: String): WinStatKind = when (label.trim().uppercase()) {
        "TIME" -> WinStatKind.TIME
        "POINTS", "PTS", "SCORE" -> WinStatKind.POINTS
        "BOARDS" -> WinStatKind.BOARDS
        else -> WinStatKind.GUESSES
    }

    /** The word games' chips: boards (multi-board only), guesses (of the max), time, points (when known). */
    fun wordGameStats(
        multi: Boolean, boardsSolved: Int, totalBoards: Int,
        guesses: Int, maxGuesses: Int, elapsedSeconds: Int, points: Int?,
    ): List<WinStat> = buildList {
        if (multi) add(WinStat(WinStatKind.BOARDS, "$boardsSolved/$totalBoards", "Boards"))
        add(WinStat(WinStatKind.GUESSES, if (maxGuesses > 0) "$guesses/$maxGuesses" else "$guesses", "Guesses"))
        add(WinStat(WinStatKind.TIME, formatTime(elapsedSeconds), "Time"))
        if (points != null) add(WinStat(WinStatKind.POINTS, "%,d".format(points), "Points"))
    }

    /** "48s" under a minute, "35:17" past it ("35m 17s" wrapped in the cell). */
    fun formatTime(s: Int): String = if (s < 60) "${s}s" else "${s / 60}:${"%02d".format(s % 60)}"

    /** The number inside a points string ("1,234" → 1234), null when it isn't one. */
    fun parsePoints(value: String): Int? {
        val digits = value.filter { it.isDigit() }
        if (digits.isEmpty() || digits.length > 9 || value.any { !it.isDigit() && it != ',' && it != '.' && it != ' ' }) return null
        return digits.toIntOrNull()
    }

    /** A chip value's size (sp) for its final text, so a count-up never changes size mid-run. */
    fun valueFontSp(text: String): Float = when {
        text.length <= 4 -> 18f
        text.length == 5 -> 16f
        text.length == 6 -> 14.5f
        else -> 13f
    }

    /** The answer tiles' side (dp): ~26 for one word, smaller as the boards and the words grow (web answerTileSize). */
    fun answerTileSize(words: List<String>): Float {
        val n = words.size
        val longest = words.maxOfOrNull { it.length } ?: 0
        var s = when {
            n <= 1 -> 26f
            n <= 4 -> 22f
            n <= 8 -> 19f
            else -> 15f
        }
        if (longest > 6) s = (s * (if (n <= 1) 0.88f else 0.8f)).roundToInt().toFloat()
        return s
    }

    /** Multi-board keeps the 2-column grid (3 past eight boards); one word = one column. */
    fun answerColumns(n: Int): Int = when {
        n > 8 -> 3
        n > 1 -> 2
        else -> 1
    }

    /** When a tile starts flipping: the tray's delay, then 120 ms per word, 40 ms per letter (left → right). */
    fun tileDelayMs(wordIndex: Int, letterIndex: Int): Int = TRAY_DELAY_MS + wordIndex * WORD_STAGGER_MS + letterIndex * TILE_STAGGER_MS

    /** A tile's flip (0 = edge-on, 1 = flat) at [clockMs]. */
    fun flipProgress(clockMs: Float, delayMs: Int, durationMs: Int = FLIP_MS): Float =
        ((clockMs - delayMs) / durationMs).coerceIn(0f, 1f)

    /** The whole tray's flip clock length. */
    fun trayDurationMs(words: List<String>): Int {
        val longest = words.maxOfOrNull { it.length } ?: 0
        return tileDelayMs((words.size - 1).coerceAtLeast(0), (longest - 1).coerceAtLeast(0)) + FLIP_MS
    }

    /**
     * CONTINUE in the game accent: the candy whose hue sits nearest the accent (low
     * saturation slate → purple). [avoidPink] when the pink Play again sits beside it.
     */
    fun candyFor(accentArgb: Int, avoidPink: Boolean = false): CandyColor {
        val r = ((accentArgb shr 16) and 0xFF) / 255f
        val g = ((accentArgb shr 8) and 0xFF) / 255f
        val b = (accentArgb and 0xFF) / 255f
        val mx = max(r, max(g, b))
        val mn = min(r, min(g, b))
        val d = mx - mn
        val sat = if (mx <= 0f) 0f else d / mx
        val pick = if (sat < 0.25f || d <= 0f) CandyColor.PURPLE else {
            var hue = when (mx) {
                r -> 60f * (((g - b) / d) % 6f)
                g -> 60f * (((b - r) / d) + 2f)
                else -> 60f * (((r - g) / d) + 4f)
            }
            if (hue < 0f) hue += 360f
            when {
                hue < 15f || hue >= 330f -> CandyColor.PINK
                hue < 70f -> CandyColor.AMBER
                hue < 205f -> CandyColor.TEAL
                hue < 290f -> CandyColor.PURPLE
                else -> CandyColor.PINK
            }
        }
        return if (avoidPink && pick == CandyColor.PINK) CandyColor.PURPLE else pick
    }

    /** The card's wash: [accent] at [amount] over the warm cream (light) or the dark surface. */
    fun cardWash(accentArgb: Int, amount: Float, baseArgb: Int = CREAM): Int = TintMath.over(accentArgb or (0xFF shl 24), amount, baseArgb)
}

/** The cast colors for the one confetti burst (web CAST_CONFETTI). */
val WIN_CAST_CONFETTI: List<Color> = listOf(
    Color(0xFF7C3AED), Color(0xFFF97316), Color(0xFF22C55E), Color(0xFF2563EB), Color(0xFFEC4899),
    Color(0xFF0EA5E9), Color(0xFF10B981), Color(0xFFEAB308), Color(0xFF8B5CF6), Color(0xFFEF4444),
)

/** The rainbow top bar (kept from the old card). */
private val WIN_BAR = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))
private val POINTS_GOLD = Color(0xFFF5A524)

/** What the popup hands the pieces inside it (PieceOverlay callers' stat chips and CONTINUE). */
class WinPopupHost(val accent: Color, val onContinue: (() -> Unit)?, val won: Boolean) {
    /** Set while composing when a Play again candy sits on the card (CONTINUE then avoids pink). */
    var playAgainShown: Boolean = false
}

val LocalWinPopupHost = staticCompositionLocalOf<WinPopupHost?> { null }

// ── The popup ──────────────────────────────────────────────────────────────

/**
 * R1 the win / lose popup. [hostKey] = the game's db key (its host stands on the
 * stage; a loss shows R), [accent] = the game accent. [answers] optional (Sudoku /
 * Starsweep pass none), [stats] the chips, [extra] anything the game adds under the
 * tray (the definition card). [streakDay] / [flawless] / [newRecord] add chips only
 * when the caller knows them. Tap anywhere = [onContinue] (also the CONTINUE candy).
 */
@Composable
fun WinPopup(
    won: Boolean,
    hostKey: String?,
    accent: Color,
    onContinue: () -> Unit,
    moment: MomentArt = if (won) MomentArt.VICTORY else MomentArt.SO_CLOSE,
    answers: WinAnswers? = null,
    stats: List<WinStat> = emptyList(),
    onPlayAgain: (() -> Unit)? = null,
    playAgainLabel: String = if (won) "Play again" else "Try again",
    streakDay: Int? = null,
    flawless: Boolean = false,
    newRecord: Boolean = false,
    extra: (@Composable ColumnScope.() -> Unit)? = null,
) {
    WinPopupFrame(won, hostKey, accent, onScrimTap = onContinue) {
        WinLettering(moment)
        if (answers != null && answers.words.isNotEmpty()) WinAnswerTray(answers, won, accent)
        extra?.invoke(this)
        if (stats.isNotEmpty()) WinStatRow(stats, accent)
        if (streakDay != null || flawless || newRecord) WinExtraChips(streakDay, flawless, newRecord)
        WinActions(won, accent, onContinue, onPlayAgain, playAgainLabel)
    }
}

/** How far the stage sits above the card (the host's feet rest ~26 dp into it). */
private val STAGE_TOP = 74.dp
private val STAGE_W = 150.dp
private val STAGE_H = 104.dp
/** Room above the stage so the rays are never clipped by the scroller. */
private val RAYS_ROOM = 46.dp

/**
 * R1 the shared frame: the scrim (tap = [onScrimTap]), the one confetti burst (wins),
 * the host on its stage and the card (accent gradient over the cream, rainbow bar, 28
 * dp corners, a soft accent glow). [glossBand] sweeps the gloss across the top of
 * [content] (callers that place the lettering themselves); null = no frame gloss.
 */
@Composable
fun WinPopupFrame(
    won: Boolean,
    hostKey: String?,
    accent: Color,
    onScrimTap: () -> Unit,
    glossBand: Dp? = null,
    continueAction: (() -> Unit)? = onScrimTap,
    content: @Composable ColumnScope.() -> Unit,
) {
    val still = WTheme.reducedMotion
    var shown by remember { mutableStateOf(false) }
    val feedbackView = androidx.compose.ui.platform.LocalView.current
    LaunchedEffect(Unit) {
        shown = true
        // Spec U: win popup = success haptic, loss popup = soft (the win / lose sound plays
        // from each game's finish — VictoryOverlay / the session finish() — so it never doubles).
        com.wordocious.app.data.Haptics.perform(
            if (won) com.wordocious.app.data.Haptic.SUCCESS else com.wordocious.app.data.Haptic.SOFT,
            feedbackView,
        )
    }
    // AQ1: the popup springs in faster (was 300 ms).
    val dur = if (still) 0 else 200
    val scale by animateFloatAsState(if (shown) 1f else 0.8f, tween(dur, easing = EaseOut), label = "winScale")
    val alpha by animateFloatAsState(if (shown) 1f else 0f, tween(dur, easing = EaseOut), label = "winAlpha")
    val host = remember(won, hostKey) {
        if (won) Mascots.hostFor(hostKey) ?: Mascots.dailyPick(com.wordocious.app.todayLocalDate(), hostKey ?: "") else Mascots.loss
    }

    PopupScrim(onScrimTap) {
        if (won) PopupConfetti(WIN_CAST_CONFETTI)
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val viewport = maxHeight
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = viewport)
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    Modifier.widthIn(max = 380.dp).fillMaxWidth()
                        .graphicsLayer { scaleX = scale; scaleY = scale; this.alpha = alpha }
                        .semantics { paneTitle = if (won) "You won" else "Game over" },
                    contentAlignment = Alignment.TopCenter,
                ) {
                    // Behind the card: the glow and the slow rays.
                    StageBack(accent, Modifier.padding(top = RAYS_ROOM))
                    WinCard(accent, Modifier.padding(top = RAYS_ROOM + STAGE_TOP)) {
                        val popupHost = remember(accent, continueAction, won) { WinPopupHost(accent, continueAction, won) }
                        CompositionLocalProvider(LocalWinPopupHost provides popupHost) {
                            Column(
                                Modifier.fillMaxWidth().then(if (glossBand != null) Modifier.glossSweep(glossBand) else Modifier).padding(bottom = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                                content = content,
                            )
                        }
                    }
                    // In front: the ground shadow and the host.
                    StageFront(host, won, accent, Modifier.padding(top = RAYS_ROOM))
                }
            }
        }
    }
}

/** The card: accent ~10% → ~4% over the warm cream (dark: a deep accent tint), rainbow bar, 28 dp, an accent glow. */
@Composable
private fun WinCard(accent: Color, modifier: Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(28.dp)
    val dark = WTheme.isDark
    val a = accent.copy(alpha = 1f).toArgb()
    val base = if (dark) WTheme.surface.toArgb() else WinPopupMath.CREAM
    val top = Color(WinPopupMath.cardWash(a, if (dark) 0.24f else 0.10f, base))
    val bottom = Color(WinPopupMath.cardWash(a, if (dark) 0.12f else 0.04f, base))
    Column(
        modifier.fillMaxWidth()
            .shadow(22.dp, shape, clip = false, ambientColor = accent.copy(alpha = 0.45f), spotColor = accent.copy(alpha = 0.6f))
            .clip(shape)
            .background(Brush.verticalGradient(listOf(top, bottom)))
            .border(1.5.dp, accent.copy(alpha = if (dark) 0.35f else 0.22f), shape),
    ) {
        Box(Modifier.fillMaxWidth().height(10.dp).background(WIN_BAR))
        Column(
            Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 26.dp, bottom = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            content = content,
        )
    }
}

/** The stage's back layer: a soft radial glow and slow-turning rays (accent 12%, 24 s a turn). */
@Composable
private fun StageBack(accent: Color, modifier: Modifier) {
    // FINISH_SPEC AD: the rays are ambient motion — off under Reduce Motion or Battery Saver.
    val still = WTheme.calmMotion
    val spin = if (still) null else rememberInfiniteTransition(label = "winRays").animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(24_000, easing = LinearEasing), RepeatMode.Restart),
        label = "rays",
    )
    Canvas(modifier.size(STAGE_W, STAGE_H).clearAndSetSemantics { }) {
        val c = Offset(size.width / 2f, size.height * 0.46f)
        if (spin != null) {
            // 15 wedges (10° on, 14° off), fading out from the middle like the web mask.
            val r = 95.dp.toPx()
            val rays = Path()
            var deg = 0f
            while (deg < 360f) {
                val a0 = deg * PI.toFloat() / 180f
                val a1 = (deg + 10f) * PI.toFloat() / 180f
                rays.moveTo(c.x, c.y)
                rays.lineTo(c.x + r * cos(a0), c.y + r * sin(a0))
                rays.lineTo(c.x + r * cos(a1), c.y + r * sin(a1))
                rays.close()
                deg += 24f
            }
            rotate(spin.value, c) {
                drawPath(
                    rays,
                    Brush.radialGradient(
                        0f to accent.copy(alpha = 0.12f), 0.43f to accent.copy(alpha = 0.12f), 1f to accent.copy(alpha = 0f),
                        center = c, radius = r,
                    ),
                )
            }
        }
        val g = 60.dp.toPx()
        drawCircle(
            Brush.radialGradient(0f to accent.copy(alpha = 0.30f), 0.68f to accent.copy(alpha = 0f), center = c, radius = g),
            radius = g, center = c,
        )
    }
}

/** The stage's front layer: the ground shadow, the host springing in (1.06 overshoot) then bobbing (wins). */
@Composable
private fun StageFront(host: MascotId, won: Boolean, accent: Color, modifier: Modifier) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(if (still) 1f else 0.5f) }
    var landed by remember { mutableStateOf(still) }
    LaunchedEffect(still) {
        if (still) { pop.snapTo(1f); landed = true; return@LaunchedEffect }
        delay(60) // AQ1: quicker host spring (was 120 + 560 ms)
        pop.animateTo(1f, keyframes {
            durationMillis = 400
            0.5f at 0 using FastOutSlowInEasing
            1.06f at 260 using FastOutSlowInEasing
            1f at 400
        })
        landed = true
    }
    // FINISH_SPEC AD: the spring-in stays; the idle bob stops under Battery Saver too.
    val bobbing = won && landed && !still && !WTheme.calmMotion
    val bob = if (bobbing) rememberInfiniteTransition(label = "winBob").animateFloat(
        initialValue = 0f, targetValue = -4f,
        animationSpec = infiniteRepeatable(tween(1400, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bob",
    ) else null
    val deep = darkenInk(accent)
    val mascotSize = if (won) 90.dp else 82.dp
    Box(modifier.size(STAGE_W, STAGE_H).clearAndSetSemantics { }, contentAlignment = Alignment.BottomCenter) {
        Canvas(Modifier.padding(bottom = 1.dp).size(72.dp, 12.dp)) {
            drawOval(Brush.radialGradient(listOf(deep.copy(alpha = 0.30f), deep.copy(alpha = 0f)), center = center, radius = size.width / 2f), size = this.size)
        }
        Box(
            Modifier.padding(bottom = 4.dp).graphicsLayer {
                scaleX = pop.value; scaleY = pop.value
                alpha = ((pop.value - 0.5f) / 0.3f).coerceIn(0f, 1f)
                translationY = (bob?.value ?: 0f) * density
                transformOrigin = TransformOrigin(0.5f, 1f)
            },
        ) { Mascot(host, mascotSize) }
    }
}

/**
 * R1 one gloss sweep across whatever this draws, 0.4 s after the card lands; the
 * shine only lights drawn pixels (the lettering), never the card behind it.
 * [band] limits it to the top of the content. Reduce Motion: none.
 */
fun Modifier.glossSweep(band: Dp? = null, delayMs: Long = 700L): Modifier = composed {
    if (WTheme.reducedMotion) return@composed this
    val p = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay(delayMs)
        p.animateTo(1f, tween(650, easing = FastOutSlowInEasing))
    }
    // Offscreen only while the shine crosses (so it can light just the drawn pixels); otherwise
    // the plain layer, which never clips the shadows of what sits inside.
    this.graphicsLayer {
        val v = p.value
        compositingStrategy = if (v > 0f && v < 1f) CompositingStrategy.Offscreen else CompositingStrategy.Auto
    }.drawWithContent {
        drawContent()
        val v = p.value
        if (v <= 0f || v >= 1f) return@drawWithContent
        val h = band?.toPx()?.coerceAtMost(size.height) ?: size.height
        val w = size.width
        val bw = max(w * 0.22f, 40.dp.toPx())
        val x = -bw + (w + bw * 2f) * v
        clipRect(bottom = h) {
            drawRect(
                Brush.linearGradient(
                    0f to Color.White.copy(alpha = 0f), 0.5f to Color.White.copy(alpha = 0.75f), 1f to Color.White.copy(alpha = 0f),
                    start = Offset(x - bw / 2f, 0f), end = Offset(x + bw / 2f, h * 0.35f),
                ),
                blendMode = BlendMode.SrcAtop,
            )
        }
    }
}

/** R1 the moment lettering with its one gloss sweep. */
@Composable
fun WinLettering(moment: MomentArt) {
    MomentTitle(moment, Modifier.glossSweep())
}

// ── Answers ────────────────────────────────────────────────────────────────

/**
 * R1 the answers in a tinted inner tray (accent 8%, no line): each word on small
 * glossy SOLVED tiles (a loss: the slate tile + "the answer"), one word per row,
 * flipping in left → right 40 ms apart; multi-board in the 2-column grid with a tiny
 * check per solved word.
 */
@Composable
fun WinAnswerTray(answers: WinAnswers, won: Boolean, accent: Color) {
    val words = answers.words.map { it.uppercase() }
    val multi = words.size > 1 && answers.solved.size > 1
    val cols = if (multi) WinPopupMath.answerColumns(words.size) else 1
    val still = WTheme.reducedMotion
    val total = WinPopupMath.trayDurationMs(words)
    val clock = remember(words) { Animatable(if (still) total.toFloat() else 0f) }
    LaunchedEffect(words, still) {
        if (still) clock.snapTo(total.toFloat()) else clock.animateTo(total.toFloat(), tween(total, easing = LinearEasing))
    }
    val dark = WTheme.isDark
    val anyUnsolved = words.indices.any { !answers.isSolved(it, won) }
    val spoken = (if (anyUnsolved) (if (words.size == 1) "The answer: " else "The answers: ") else "") + words.joinToString(", ")
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(accent.copy(alpha = if (dark) 0.16f else 0.08f))
            .padding(horizontal = 10.dp, vertical = 10.dp)
            .clearAndSetSemantics { contentDescription = spoken },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (anyUnsolved) {
            Text(
                if (words.size == 1) "THE ANSWER" else "THE ANSWERS",
                fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black, letterSpacing = 0.12.em,
                fontFamily = Nunito, color = if (dark) WTheme.textMuted else FinishInk.label,
            )
        }
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            val base = WinPopupMath.answerTileSize(words)
            val longest = (words.maxOfOrNull { it.length } ?: 1).coerceAtLeast(1)
            val colGap = 12f
            val colW = (maxWidth.value - colGap * (cols - 1)) / cols
            val badge = if (multi) (base * 0.6f).coerceAtLeast(12f) + 4f else 0f
            val gap = max(2f, base / 10f)
            val fit = (colW - badge - gap * (longest - 1)) / longest
            val tile = min(base, fit).coerceAtLeast(10f)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                words.indices.chunked(cols).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(colGap.dp), verticalAlignment = Alignment.CenterVertically) {
                        row.forEach { wi ->
                            val solved = answers.isSolved(wi, won)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(horizontalArrangement = Arrangement.spacedBy(gap.dp)) {
                                    words[wi].forEachIndexed { li, ch ->
                                        val f = WinPopupMath.flipProgress(clock.value, WinPopupMath.tileDelayMs(wi, li))
                                        GameTileFace(
                                            ch.toString(), if (solved) TileFace.CORRECT else TileFace.ABSENT,
                                            Modifier.size(tile.dp).graphicsLayer {
                                                rotationX = 90f * (1f - f)
                                                alpha = if (f <= 0f) 0f else 1f
                                                cameraDistance = 12f * density
                                            },
                                        )
                                    }
                                }
                                if (multi) {
                                    val b = (base * 0.6f).coerceAtLeast(12f).dp
                                    if (solved) Icon3D(Icon3DName.BADGE_CHECK, b) else Box(Modifier.size(b))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Stats ──────────────────────────────────────────────────────────────────

/** R1 the stat chips in one row, sharing the width. */
@Composable
fun WinStatRow(stats: List<WinStat>, accent: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
        stats.forEach { WinStatChip(it, accent, Modifier.weight(1f)) }
    }
}

/**
 * R1 one stat chip: a tinted pill (accent 10%; points gold) with its glyph, the value
 * in soft numbers and the label in small caps. Points count up over 700 ms and
 * sparkle at the end (Reduce Motion: the final number at once).
 */
@Composable
fun WinStatChip(stat: WinStat, accent: Color, modifier: Modifier = Modifier) {
    val dark = WTheme.isDark
    val tone = if (stat.kind == WinStatKind.POINTS) POINTS_GOLD else accent
    val deep = darkenInk(accent)
    val still = WTheme.reducedMotion
    val target = if (stat.kind == WinStatKind.POINTS) WinPopupMath.parsePoints(stat.value) else null
    val counting = target != null && target > 0 && !still
    val elapsed = remember(stat.value) { Animatable(if (counting) 0f else WinPopupMath.COUNT_UP_MS.toFloat()) }
    val sparkle = remember(stat.value) { Animatable(0f) }
    LaunchedEffect(stat.value, counting) {
        if (!counting) return@LaunchedEffect
        delay(200)
        // Spec U: the points count-up ticks as the number climbs (throttled to ≤ 12/s).
        val ticks = launch {
            androidx.compose.runtime.snapshotFlow { WinPopupMath.countUpAt(target ?: 0, elapsed.value.toLong()) }
                .collect { com.wordocious.app.data.SoundManager.playTick() }
        }
        elapsed.animateTo(WinPopupMath.COUNT_UP_MS.toFloat(), tween(WinPopupMath.COUNT_UP_MS, easing = LinearEasing))
        ticks.cancel()
        sparkle.animateTo(1f, tween(650, easing = LinearEasing))
    }
    val shown = if (counting && target != null) "%,d".format(WinPopupMath.countUpAt(target, elapsed.value.toLong())) else stat.value
    val fontSp = WinPopupMath.valueFontSp(stat.value)
    Box(modifier.semantics(mergeDescendants = true) { contentDescription = "${stat.label}: ${stat.value}" }) {
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                .background(tone.copy(alpha = if (dark) 0.18f else if (stat.kind == WinStatKind.POINTS) 0.14f else 0.10f))
                .padding(start = 4.dp, end = 4.dp, top = 7.dp, bottom = 6.dp)
                .clearAndSetSemantics { },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            Box(Modifier.height(18.dp), contentAlignment = Alignment.Center) { StatGlyph(stat.kind, if (dark) accent else deep) }
            SoftNumber(shown, fontSp.sp)
            Text(
                stat.label.uppercase(), fontSize = 9.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                letterSpacing = 0.1.em, maxLines = 1, softWrap = false, fontFamily = Nunito,
                color = if (dark) WTheme.textMuted else FinishInk.label,
            )
        }
        if (sparkle.value > 0f && sparkle.value < 1f) Sparkle(sparkle.value, Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = 2.dp))
    }
}

/** The chip glyphs: grid, target, clock (deep accent), gold star. */
@Composable
private fun StatGlyph(kind: WinStatKind, ink: Color) {
    when (kind) {
        WinStatKind.BOARDS -> Icon(Icons.Rounded.GridView, null, tint = ink, modifier = Modifier.size(16.dp))
        WinStatKind.GUESSES -> Icon(Icons.Rounded.TrackChanges, null, tint = ink, modifier = Modifier.size(16.dp))
        WinStatKind.TIME -> Icon(Icons.Rounded.Schedule, null, tint = ink, modifier = Modifier.size(16.dp))
        WinStatKind.POINTS -> GoldStar(17.dp)
    }
}

/** The gold star (web StarGlyph: #f5a524 fill, #b4690e line). */
@Composable
private fun GoldStar(size: Dp) {
    Canvas(Modifier.size(size)) {
        val k = this.size.minDimension / 24f
        val pts = floatArrayOf(12f, 2.6f, 14.9f, 8.5f, 21.4f, 9.4f, 16.7f, 14f, 17.8f, 20.5f, 12f, 17.4f, 6.2f, 20.5f, 7.3f, 14f, 2.6f, 9.4f, 9.1f, 8.5f)
        val path = Path().apply {
            moveTo(pts[0] * k, pts[1] * k)
            var i = 2
            while (i < pts.size) { lineTo(pts[i] * k, pts[i + 1] * k); i += 2 }
            close()
        }
        drawPath(path, POINTS_GOLD)
        drawPath(path, Color(0xFFB4690E), style = Stroke(width = 1f * k, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

/** The count-up's end sparkle: a four-point gold twinkle growing then fading ([t] 0..1). */
@Composable
private fun Sparkle(t: Float, modifier: Modifier) {
    Canvas(modifier.size(14.dp)) {
        val s = if (t < 0.4f) t / 0.4f * 1.15f else 1.15f - (t - 0.4f) / 0.6f * 0.35f
        val a = if (t < 0.5f) 1f else (1f - t) / 0.5f
        val c = center
        val r = size.minDimension / 2f
        scale(s, c) {
            val p = Path().apply {
                moveTo(c.x, c.y - r)
                quadraticTo(c.x, c.y, c.x + r, c.y)
                quadraticTo(c.x, c.y, c.x, c.y + r)
                quadraticTo(c.x, c.y, c.x - r, c.y)
                quadraticTo(c.x, c.y, c.x, c.y - r)
                close()
            }
            drawPath(p, Color(0xFFFFD66B).copy(alpha = a))
        }
    }
}

/** R1 the extra chips: "Day N" with the flame (pops), FLAWLESS (pink), NEW RECORD (the small lettering). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WinExtraChips(streakDay: Int?, flawless: Boolean, newRecord: Boolean) {
    FlowRow(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (streakDay != null) {
            val still = WTheme.reducedMotion
            val pop = remember { Animatable(if (still) 1f else 0f) }
            LaunchedEffect(still) { if (!still) { delay(900); pop.animateTo(1f, spring(dampingRatio = 0.4f, stiffness = 300f)) } }
            Row(
                Modifier.align(Alignment.CenterVertically)
                    .graphicsLayer { scaleX = pop.value; scaleY = pop.value }
                    .clip(RoundedCornerShape(50)).background(Color(0xFFF97316).copy(alpha = 0.14f))
                    .padding(horizontal = 10.dp, vertical = 4.dp)
                    .semantics(mergeDescendants = true) { contentDescription = "Streak day $streakDay" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon3D(Icon3DName.FLAME, 16.dp)
                SoftNumber("Day $streakDay", 13.sp)
            }
        }
        if (flawless) {
            Text(
                "FLAWLESS", fontSize = 11.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black, letterSpacing = 0.08.em,
                fontFamily = Nunito, color = Color.White,
                modifier = Modifier.align(Alignment.CenterVertically).clip(RoundedCornerShape(50))
                    .background(Brush.verticalGradient(listOf(Color(0xFFF472B6), Color(0xFFDB2777))))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
        if (newRecord) {
            Box(Modifier.align(Alignment.CenterVertically).width(120.dp)) {
                MomentTitle(MomentArt.NEW_RECORD, widthFraction = 1f, maxHeight = 22.dp)
            }
        }
    }
}

// ── Actions ────────────────────────────────────────────────────────────────

/** R1 the actions: Play again (PINK, when the caller has one) and the CONTINUE candy in the game accent. */
@Composable
fun WinActions(won: Boolean, accent: Color, onContinue: (() -> Unit)?, onPlayAgain: (() -> Unit)?, playAgainLabel: String = if (won) "Play again" else "Try again") {
    Column(
        Modifier.fillMaxWidth().padding(top = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        onPlayAgain?.let { WinPlayAgain(playAgainLabel, it) }
        onContinue?.let { WinContinue(accent, it, besidePink = onPlayAgain != null) }
    }
}

/** A8 the PINK Play again / Try again candy. */
@Composable
fun WinPlayAgain(label: String, onClick: () -> Unit) {
    CandyButton(label, onClick = onClick, color = CandyColor.PINK, size = CandySize.MEDIUM, icon = CandyIcon.PLAY)
}

/** R1 the CONTINUE candy in the game accent (the nearest candy color). */
@Composable
fun WinContinue(accent: Color, onClick: () -> Unit, besidePink: Boolean = false) {
    CandyButton(
        "Continue", onClick = onClick,
        color = WinPopupMath.candyFor(accent.copy(alpha = 1f).toArgb(), avoidPink = besidePink),
        size = CandySize.MEDIUM, icon = CandyIcon.ARROW,
    )
}
