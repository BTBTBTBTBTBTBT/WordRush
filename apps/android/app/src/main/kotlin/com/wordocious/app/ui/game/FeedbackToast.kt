package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Nightlight
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

// FINISH_SPEC feedback toasts (founder, 2026-10-02): the in-game "+5" is a celebratory
// candy burst (gold star, big outlined number, quality word, sparkles); every other
// message is a calm candy pill with a glossy 3D coin. One shared composable,
// [GameFeedbackToast]; each game only picks where it sits ([feedbackAnchor]) so it
// never covers the title art or the board. Same rules on iOS and web.

/** Pure pieces of the feedback toast (classification + the animation curves). */
object FeedbackToast {
    enum class Tone { SUCCESS, ERROR, WIN, LOSS, WARN, INFO }

    sealed interface Kind
    data class Score(val points: Int, val pangram: Boolean, val label: String) : Kind
    data class Message(val text: String, val tone: Tone) : Kind

    private val SCORE_RE = Regex("""^(Pangram!\s*)?\+(\d+)$""", RegexOption.IGNORE_CASE)

    /** SCORE for "+N" / "Pangram! +N"; everything else a MESSAGE with its tone. */
    fun kind(text: String): Kind {
        val m = SCORE_RE.find(text.trim())
        if (m != null) {
            val pangram = m.groupValues[1].isNotEmpty()
            val n = m.groupValues[2].toIntOrNull() ?: 0
            return Score(n, pangram, qualityLabel(n, pangram))
        }
        return Message(text, tone(text))
    }

    /** Hubbub scoring: a 4-letter word is 1 pt, n letters n pts, a pangram +7. */
    fun qualityLabel(points: Int, pangram: Boolean): String = when {
        pangram -> "PANGRAM!"
        points <= 4 -> "Good!"
        points <= 6 -> "Nice!"
        points == 7 -> "Great!"
        else -> "Amazing!"
    }

    fun tone(text: String): Tone {
        val t = text.lowercase()
        return when {
            "used for two" in t -> Tone.WARN
            listOf("solved", "nice", "great", "rank up").any { it in t } -> Tone.WIN
            listOf("copied", "saved", "sent").any { it in t } -> Tone.SUCCESS
            t.startsWith("not ") || listOf("already", "enough", "invalid", "must", "only", "too short", "or more", "missing").any { it in t } -> Tone.ERROR
            listOf("the word was", "answer", "out of").any { it in t } -> Tone.LOSS
            else -> Tone.INFO
        }
    }

    /**
     * A non-game confirmation's tone: "Could not / failed" error, "Already" warn,
     * anything done ("Sent!", "User blocked", "Report submitted") success.
     */
    fun statusTone(text: String): Tone {
        val t = text.lowercase()
        return when {
            t.startsWith("could not") || "failed" in t || "couldn" in t -> Tone.ERROR
            t.startsWith("already") -> Tone.WARN
            else -> Tone.SUCCESS
        }
    }

    /** Tone accents (info is purple, never blue). */
    fun accent(tone: Tone): Color = when (tone) {
        Tone.SUCCESS -> Color(0xFF22B573)
        Tone.ERROR -> Color(0xFFF0435F)
        Tone.WIN -> PIECE_WON
        Tone.LOSS -> PIECE_LOST
        Tone.WARN -> Color(0xFFF59E0B)
        Tone.INFO -> Color(0xFF9B5CF6)
    }

    // ── animation curves (ms → frame); transform + opacity only ──

    data class Frame(val scale: Float = 1f, val alpha: Float = 1f, val dx: Float = 0f, val dy: Float = 0f, val sparkle: Float = -1f)

    const val SCORE_MS = 1100f
    const val MESSAGE_IN_MS = 360f
    const val SPARKLE_MS = 500f
    val SHAKE = floatArrayOf(0f, -8f, 8f, -6f, 6f, -3f, 0f)
    const val SHAKE_MS = 350f

    private fun clamp01(x: Float) = x.coerceIn(0f, 1f)
    private fun easeOut(x: Float) = 1f - (1f - x) * (1f - x)
    private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t

    /** Score: spring pop 0.6 → 1.08 → 1 + fade in (0.3 s), hold, then float up 12 dp and fade (0.75 → 1.1 s). dy in dp. */
    fun scoreFrame(ms: Float, reduced: Boolean): Frame {
        val fadeOut = clamp01((ms - 750f) / 350f)
        val alphaIn = clamp01(ms / 150f)
        if (reduced) return Frame(alpha = alphaIn * (1f - fadeOut))
        val scale = when {
            ms < 170f -> lerp(0.6f, 1.08f, easeOut(ms / 170f))
            ms < 300f -> lerp(1.08f, 1f, (ms - 170f) / 130f)
            else -> 1f
        }
        val sparkle = if (ms <= SPARKLE_MS) clamp01(ms / SPARKLE_MS) else -1f
        return Frame(scale = scale, alpha = alphaIn * (1f - fadeOut), dy = -12f * easeOut(fadeOut), sparkle = sparkle)
    }

    /** Message: pop 0.9 → 1 + fade in; ERROR shakes once (0,-8,8,-6,6,-3,0 over 0.35 s). dx in dp. */
    fun messageFrame(ms: Float, shake: Boolean, reduced: Boolean): Frame {
        val alpha = clamp01(ms / 150f)
        if (reduced) return Frame(alpha = alpha)
        val scale = when {
            ms < 160f -> lerp(0.9f, 1.02f, easeOut(ms / 160f))
            ms < 260f -> lerp(1.02f, 1f, (ms - 160f) / 100f)
            else -> 1f
        }
        var dx = 0f
        if (shake && ms < SHAKE_MS) {
            val seg = SHAKE_MS / (SHAKE.size - 1)
            val i = (ms / seg).toInt().coerceIn(0, SHAKE.size - 2)
            dx = lerp(SHAKE[i], SHAKE[i + 1], (ms - i * seg) / seg)
        }
        return Frame(scale = scale, alpha = alpha, dx = dx)
    }
}

// ── placement ─────────────────────────────────────────────────────────────

/** Where a game wants its feedback toast centered (root-space y of the anchored element's center). */
@Stable
class FeedbackAnchor {
    var centerY by mutableFloatStateOf(Float.NaN)
}

/** Provided by a game screen; [feedbackAnchor] on the entry line / meta row feeds it. */
val LocalFeedbackAnchor = compositionLocalOf<FeedbackAnchor?> { null }

/** Marks this element as where the game's feedback toast sits (centered over it, as an overlay). */
fun Modifier.feedbackAnchor(explicit: FeedbackAnchor? = null): Modifier = composed {
    val anchor = explicit ?: LocalFeedbackAnchor.current ?: return@composed this
    DisposableEffect(anchor) { onDispose { anchor.centerY = Float.NaN } }
    this.onGloballyPositioned { c -> anchor.centerY = c.positionInRoot().y + c.size.height / 2f }
}

/**
 * The shared game feedback toast: put it in the screen's root Box (it fills it and
 * never takes touches). It centers itself on the [LocalFeedbackAnchor] element when
 * one is on screen, else [fallbackTop] below the Box top. [text] null fades it out.
 * [tone] overrides the classified tone for messages; bump [nonce] to replay the same text.
 */
@Composable
fun GameFeedbackToast(
    text: String?, modifier: Modifier = Modifier, fallbackTop: Dp = 100.dp, tone: FeedbackToast.Tone? = null,
    anchor: FeedbackAnchor? = LocalFeedbackAnchor.current, nonce: Int = 0,
) {
    var last by remember { mutableStateOf<String?>(null) }
    val out = remember { Animatable(1f) }
    LaunchedEffect(text) {
        if (text != null) { out.snapTo(1f); last = text }
        else if (last != null) { out.animateTo(0f, tween(180)); last = null }
    }
    var selfTop by remember { mutableFloatStateOf(0f) }
    val cur = text ?: last ?: return
    Layout(
        content = {
            Box(Modifier.graphicsLayer { alpha = out.value }) {
                key(cur, nonce) { FeedbackBody(cur, tone) }
            }
        },
        modifier = modifier.fillMaxSize().onGloballyPositioned { selfTop = it.positionInRoot().y },
    ) { measurables, c ->
        val p = measurables.first().measure(c.copy(minWidth = 0, minHeight = 0))
        val w = if (c.hasBoundedWidth) c.maxWidth else p.width
        val h = if (c.hasBoundedHeight) c.maxHeight else p.height
        layout(w, h) {
            val ay = anchor?.centerY ?: Float.NaN
            val y = if (ay.isNaN()) fallbackTop.roundToPx() else (ay - selfTop - p.height / 2f).roundToInt()
            p.place((w - p.width) / 2, y.coerceIn(0, maxOf(0, h - p.height)))
        }
    }
}

/** The toast's look without placement (for an inline / already-positioned spot). */
@Composable
fun FeedbackBody(text: String, tone: FeedbackToast.Tone? = null) {
    when (val k = FeedbackToast.kind(text)) {
        is FeedbackToast.Score -> ScoreBurst(k)
        is FeedbackToast.Message -> CandyMessage(k.text, tone ?: k.tone)
    }
}

private val INK_OUTLINE = Color(0xFF3C1E6E)

/** A glossy candy pill: [fill], a [rim] border, a darker bottom [lip] and a soft highlight across the top third. */
private fun Modifier.candyPill(fill: Brush, rim: Color, rimWidth: Dp, lip: Color, lipHeight: Dp, highlight: Float): Modifier =
    this
        .drawBehind {
            val r = size.height / 2f
            drawRoundRect(lip, topLeft = Offset(0f, lipHeight.toPx()), size = size, cornerRadius = CornerRadius(r))
        }
        .clip(RoundedCornerShape(50))
        .background(fill)
        .drawBehind {
            val h = size.height
            drawRoundRect(
                Color.White.copy(alpha = highlight), topLeft = Offset(h * 0.32f, h * 0.09f),
                size = Size((size.width - h * 0.64f).coerceAtLeast(0f), h * 0.26f), cornerRadius = CornerRadius(h * 0.13f),
            )
        }
        .border(rimWidth, rim, RoundedCornerShape(50))

// ── SCORE: the celebratory candy burst ───────────────────────────────────

private val GOLD_FILL = Brush.verticalGradient(listOf(Color(0xFFFFE27A), Color(0xFFF5A524)))
private val PANGRAM_FILL = Brush.horizontalGradient(
    listOf(Color(0xFFFF6FB5), Color(0xFFFFB547), Color(0xFFFFE45C), Color(0xFF5EE0A0), Color(0xFF6FA8FF), Color(0xFFA77BFF)),
)
private val SPARKLE_ANGLES = floatArrayOf(30f, 150f, 210f, 330f)

@Composable
private fun ScoreBurst(s: FeedbackToast.Score) {
    val reduced = WTheme.reducedMotion
    val t = remember { Animatable(0f) }
    LaunchedEffect(Unit) { t.animateTo(FeedbackToast.SCORE_MS, tween(FeedbackToast.SCORE_MS.toInt(), easing = LinearEasing)) }
    val big = if (s.pangram) 1.15f else 1f
    val density = LocalDensity.current.density
    val outline = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Black, color = Color.White, shadow = Shadow(INK_OUTLINE, Offset(0f, 2f * density), 0f))
    var pill by remember { mutableStateOf(IntSize.Zero) }
    Box(
        Modifier.padding(horizontal = 24.dp, vertical = 14.dp)
            .graphicsLayer {
                val f = FeedbackToast.scoreFrame(t.value, reduced)
                scaleX = f.scale; scaleY = f.scale; alpha = f.alpha; translationY = f.dy * density
            },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier
                .onSizeChanged { pill = it }
                .semantics { liveRegion = LiveRegionMode.Polite }
                .candyPill(
                    fill = if (s.pangram) PANGRAM_FILL else GOLD_FILL, rim = Color.White, rimWidth = 2.5.dp,
                    lip = if (s.pangram) Color(0xFF7C3AED) else Color(0xFFD97706), lipHeight = 3.dp, highlight = 0.38f,
                )
                .padding(start = 10.dp * big, end = 16.dp * big, top = 5.dp * big, bottom = 6.dp * big),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            CandyStar(24.dp * big)
            Text("+${s.points}", style = outline, fontSize = 24.sp * big, maxLines = 1, softWrap = false)
            Text(s.label, style = outline, fontSize = if (s.pangram) 15.sp else 13.sp, maxLines = 1, softWrap = false)
        }
        // Four tiny sparkles burst once from the pill's edge and fade (off with Reduce Motion).
        if (!reduced) for ((i, deg) in SPARKLE_ANGLES.withIndex()) {
            val gold = i % 2 == 1
            Box(
                Modifier.size(if (gold) 5.dp else 4.dp)
                    .graphicsLayer {
                        val p = FeedbackToast.scoreFrame(t.value, false).sparkle
                        if (p < 0f) { alpha = 0f; return@graphicsLayer }
                        val a = deg * PI.toFloat() / 180f
                        val travel = (10f + 22f * p) * density
                        translationX = cos(a) * (pill.width / 2f * 0.8f + travel)
                        translationY = -sin(a) * (pill.height / 2f + travel * 0.7f)
                        alpha = 1f - p
                    }
                    .background(if (gold) Color(0xFFFFD84D) else Color.White, CircleShape),
            )
        }
    }
}

/** A small vector five-point gold star with a white rim (no emoji, no Material icon). */
@Composable
private fun CandyStar(size: Dp) {
    Canvas(Modifier.size(size)) {
        val cx = this.size.width / 2f; val cy = this.size.height / 2f
        val outer = this.size.minDimension / 2f * 0.92f; val inner = outer * 0.48f
        val path = Path()
        for (i in 0 until 10) {
            val r = if (i % 2 == 0) outer else inner
            val a = (-90f + i * 36f) * PI.toFloat() / 180f
            val x = cx + cos(a) * r; val y = cy + sin(a) * r * 1.0f + outer * 0.06f
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        drawPath(path, Brush.verticalGradient(listOf(Color(0xFFFFF1A8), Color(0xFFF59E0B))))
        drawPath(path, Color.White, style = Stroke(width = 1.5.dp.toPx(), join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

// ── MESSAGE: the calm candy pill ─────────────────────────────────────────

@Composable
private fun CandyMessage(text: String, tone: FeedbackToast.Tone) {
    val reduced = WTheme.reducedMotion
    val t = remember { Animatable(0f) }
    val shake = tone == FeedbackToast.Tone.ERROR
    LaunchedEffect(Unit) {
        val end = if (shake) FeedbackToast.SHAKE_MS else FeedbackToast.MESSAGE_IN_MS
        t.animateTo(end, tween(end.toInt(), easing = LinearEasing))
    }
    val density = LocalDensity.current.density
    Box(
        Modifier.padding(horizontal = 24.dp, vertical = 6.dp)
            .graphicsLayer {
                val f = FeedbackToast.messageFrame(t.value, shake, reduced)
                scaleX = f.scale; scaleY = f.scale; alpha = f.alpha; translationX = f.dx * density
            },
    ) { CandyMessagePill(text, tone) }
}

/** The static calm candy pill (coin + dark-purple text) — also used by non-game popups. */
@Composable
fun CandyMessagePill(text: String, tone: FeedbackToast.Tone, modifier: Modifier = Modifier) {
    val acc = FeedbackToast.accent(tone)
    val dark = WTheme.isDark
    val argb = acc.toArgb()
    val fill = if (dark) {
        val base = WTheme.surface.toArgb()
        Brush.verticalGradient(listOf(Color(TintMath.over(argb, 0.20f, base)), Color(TintMath.over(argb, 0.32f, base))))
    } else Brush.verticalGradient(listOf(Wash.mix(acc, 0.08f), Wash.mix(acc, 0.20f)))
    Row(
        modifier
            .widthIn(max = 340.dp)
            .semantics { liveRegion = LiveRegionMode.Polite }
            .candyPill(fill, rim = acc.copy(alpha = 0.45f), rimWidth = 1.5.dp, lip = acc.copy(alpha = 0.35f), lipHeight = 2.5.dp, highlight = if (dark) 0.10f else 0.45f)
            .padding(start = 7.dp, end = 16.dp, top = 6.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ToneCoin(tone, 22.dp)
        Text(
            text, fontSize = 13.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, textAlign = TextAlign.Start,
            color = if (dark) WTheme.text else FinishInk.heading,
        )
    }
}

private fun glyph(tone: FeedbackToast.Tone): ImageVector = when (tone) {
    FeedbackToast.Tone.ERROR -> Icons.Filled.Close
    FeedbackToast.Tone.SUCCESS -> Icons.Filled.Check
    FeedbackToast.Tone.WIN -> Icons.Filled.Star
    FeedbackToast.Tone.LOSS -> Icons.Filled.Nightlight
    FeedbackToast.Tone.WARN -> Icons.Filled.PriorityHigh
    FeedbackToast.Tone.INFO -> Icons.Filled.AutoAwesome
}

/** A small glossy 3D coin in the tone accent with a white glyph (never the generic "i"). */
@Composable
fun ToneCoin(tone: FeedbackToast.Tone, size: Dp = 22.dp, glyph: ImageVector? = null) {
    val acc = FeedbackToast.accent(tone)
    val light = Wash.mix(acc, 0.55f)
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val r = this.size.minDimension / 2f
            drawCircle(Brush.verticalGradient(listOf(light, acc)), r)
            drawCircle(Color.White, r - 0.75.dp.toPx(), style = Stroke(1.5.dp.toPx()))
            drawOval(Color.White.copy(alpha = 0.55f), topLeft = Offset(r * 0.55f, r * 0.22f), size = Size(r * 0.9f, r * 0.42f))
        }
        Icon(glyph ?: glyph(tone), null, tint = Color.White, modifier = Modifier.size(size * 0.6f))
    }
}

/** A game screen's root: gives its [feedbackAnchor] + [GameFeedbackToast] one shared anchor. */
@Composable
fun ProvideFeedbackAnchor(content: @Composable () -> Unit) {
    val anchor = remember { FeedbackAnchor() }
    androidx.compose.runtime.CompositionLocalProvider(LocalFeedbackAnchor provides anchor, content = content)
}
