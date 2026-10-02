package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin

// FINISH_SPEC I — Muddle letters (founder 10-02: "the letters that appear in circles …
// super polished"): circled answer slots are glossy round COINS (art_muddle_coin_*; the
// letter drawn on top in code), uncircled slots the B1 square glossy tiles, the
// punchline tray gold coins, the scrambled clue letters small glossy amber chips that
// sink when used. Motion: placing a letter = the type pop; a solved word = the reveal
// flip + glow; the punchline solved = a hop wave + confetti. Mirrors web and iOS.

/** I the coin kinds (the four shipped coin images). */
enum class CoinKind(val res: Int) {
    /** A gold ring over a frosted empty cell. */
    EMPTY(R.drawable.art_muddle_coin_empty),
    /** Purple with a gold rim. */
    FILLED(R.drawable.art_muddle_coin_filled),
    /** Violet + sparkle — a revealed hint letter. */
    HINT(R.drawable.art_muddle_coin_hint),
    /** Gold — the punchline tray. */
    PUNCHLINE(R.drawable.art_muddle_coin_punchline),
}

/** I the coin for a slot (pure, unit-tested). */
fun coinKind(filled: Boolean, pinned: Boolean, punchline: Boolean): CoinKind = when {
    !filled -> CoinKind.EMPTY
    punchline -> CoinKind.PUNCHLINE
    pinned -> CoinKind.HINT
    else -> CoinKind.FILLED
}

/** I the letter ink on a coin: dark amber on the gold coin, white otherwise. */
fun coinInk(kind: CoinKind): Color = if (kind == CoinKind.PUNCHLINE) Color(0xFF7A3D00) else Color.White

/** A violet tile family for a pinned (hint) letter on a square slot. */
private val PINNED_LOOK = TileLooks.CORRECT.copy(
    edge = Color(0xFF5B21B6), faceTop = Color(0xFFC4A4FF), faceMid = Color(0xFF8B5CF6), faceBottom = Color(0xFF7C4DEB),
)

/** I3 the scramble chip: a light amber face, an amber lip, dark-purple letters. */
private val CHIP_LOOK = TileLooks.TYPED.copy(
    edge = Color(0xFFE8A04A), faceTop = Color(0xFFFFF6E3), faceMid = Color(0xFFFFE7B8), faceBottom = Color(0xFFFFDFA3),
    ring = null, ringFrac = 0f, gloss = 0.6f, glyph = Color(0xFF3B1A78), glyphShadow = Color(0x33FFFFFF),
)
private val CHIP_LOOK_DARK = CHIP_LOOK.copy(
    edge = Color(0xFF7A4A12), faceTop = Color(0xFF5A4126), faceMid = Color(0xFF4A3520), faceBottom = Color(0xFF42301D), glyph = Color(0xFFFFE7B8),
)

/**
 * B3 the type pop + the solved flip-and-glow + the hop, keyed on the slot's state: a
 * letter arriving swells in (1.07, [TileMotion.TYPE_MS]); [solved] turning true flips
 * the slot (720 ms, [flipDelayMs] after its neighbors) and blooms a soft glow; [hop]
 * turning true hops it ([hopDelayMs]). Reduce Motion: static.
 */
private class SlotMotion {
    val pop = Animatable(1f)
    val flip = Animatable(1f)
    val glow = Animatable(0f)
    val lift = Animatable(0f)
}

@Composable
private fun rememberSlotMotion(ch: String, solved: Boolean, hop: Boolean, flipDelayMs: Int, hopDelayMs: Int): SlotMotion {
    val m = remember { SlotMotion() }
    val still = WTheme.reducedMotion
    val last = remember { arrayOf(ch, solved.toString(), hop.toString()) }
    LaunchedEffect(ch) {
        val was = last[0]; last[0] = ch
        if (!still && ch.isNotEmpty() && was.isEmpty()) {
            m.pop.animateTo(1f, keyframes {
                durationMillis = TileMotion.TYPE_MS
                0.55f at 0
                1.07f at (TileMotion.TYPE_MS * 0.55f).toInt()
            })
        }
    }
    LaunchedEffect(solved) {
        val was = last[1].toBoolean(); last[1] = solved.toString()
        if (!still && solved && !was) {
            kotlinx.coroutines.delay(flipDelayMs.toLong())
            launch {
                m.flip.animateTo(1f, keyframes {
                    durationMillis = TileMotion.FLIP_MS
                    0f at TileMotion.FLIP_MS / 2
                })
            }
            kotlinx.coroutines.delay((TileMotion.FLIP_MS / 2).toLong())
            m.glow.snapTo(1f)
            m.glow.animateTo(0f, tween(TileMotion.BLOOM_MS))
        }
    }
    LaunchedEffect(hop) {
        val was = last[2].toBoolean(); last[2] = hop.toString()
        if (!still && hop && !was) {
            kotlinx.coroutines.delay(hopDelayMs.toLong())
            m.lift.animateTo(0f, keyframes {
                durationMillis = TileMotion.HOP_MS
                -0.32f at (TileMotion.HOP_MS * 0.4f).toInt()
                0.04f at (TileMotion.HOP_MS * 0.75f).toInt()
            })
        }
    }
    return m
}

private fun Modifier.slotMotion(m: SlotMotion, size: Dp, glowColor: Color): Modifier = this
    .drawBehind {
        val g = m.glow.value
        if (g > 0.01f) {
            val r = this.size.minDimension
            for (k in 4 downTo 1) {
                val grow = r * 0.25f * k / 4f
                drawCircle(glowColor.copy(alpha = 0.55f * g * (1f - k / 4f) + 0.06f * g), radius = r / 2 + grow)
            }
        }
    }
    .graphicsLayer {
        val s = m.pop.value
        scaleX = s * m.flip.value
        scaleY = s
        translationY = m.lift.value * size.toPx()
    }

/** The letter drawn on a coin / tile: Nunito Black with the tile's soft text-shadow. */
@Composable
private fun SlotLetter(ch: String, ink: Color, fontSize: TextUnit, bottomInset: Dp = 0.dp) {
    val px = LocalDensity.current.density
    Text(
        ch, color = ink, fontSize = fontSize, fontWeight = FontWeight.Black, fontFamily = Nunito, maxLines = 1, softWrap = false,
        modifier = Modifier.padding(bottom = bottomInset),
        style = TextStyle(
            shadow = if (ink == Color.White) Shadow(Color(0x592E0C63), Offset(0f, 1.2f * px), 1.4f * px)
            else Shadow(Color.White.copy(alpha = 0.55f), Offset(0f, 1f * px), 0f),
        ),
    )
}

/**
 * I1 / I2 a circled answer slot (or a punchline tray letter) as a glossy round coin,
 * the same footprint as the square tiles: the coin art (an empty slot = the gold ring
 * over a frosted cell) with the letter on top at ~52% of the coin.
 */
@Composable
fun MuddleCoin(
    ch: String,
    pinned: Boolean,
    punchline: Boolean,
    size: Dp,
    modifier: Modifier = Modifier,
    solved: Boolean = false,
    hop: Boolean = false,
    flipDelayMs: Int = 0,
    hopDelayMs: Int = 0,
) {
    val kind = coinKind(ch.isNotEmpty(), pinned, punchline)
    val m = rememberSlotMotion(ch, solved, hop, flipDelayMs, hopDelayMs)
    val frost = TileLooks.of(TileFace.EMPTY, dark = WTheme.isDark)
    Box(
        modifier.slotMotion(m, size, if (punchline) Color(0xFFFFBE46) else Color(0xFF965AFF)),
        contentAlignment = Alignment.Center,
    ) {
        if (kind == CoinKind.EMPTY) {
            // The frosted cell under the empty ring.
            Box(Modifier.fillMaxSize().padding(size * 0.06f).drawBehind {
                drawCircle(frost.faceTop)
                drawCircle(frost.edge.copy(alpha = 0.5f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()))
            })
        }
        Image(painterResource(kind.res), contentDescription = null, modifier = Modifier.fillMaxSize())
        if (ch.isNotEmpty()) {
            val sp = with(LocalDensity.current) { (size * 0.52f).toSp() }
            SlotLetter(ch, coinInk(kind), sp)
        }
    }
}

/**
 * I1 an uncircled answer slot: the B1 square glossy tile (empty = frosted, a placed
 * letter purple, a pinned letter violet), the same motion as the coins.
 */
@Composable
fun MuddleSquare(
    ch: String,
    pinned: Boolean,
    size: Dp,
    modifier: Modifier = Modifier,
    solved: Boolean = false,
    hop: Boolean = false,
    flipDelayMs: Int = 0,
    hopDelayMs: Int = 0,
    muted: Boolean = false,
) {
    val look = when {
        ch.isEmpty() -> TileLooks.of(TileFace.EMPTY, dark = WTheme.isDark)
        muted -> TileLooks.of(TileFace.HINT)
        pinned -> PINNED_LOOK
        else -> TileLooks.of(TileFace.CORRECT, WTheme.colorblind)
    }
    val m = rememberSlotMotion(ch, solved, hop, flipDelayMs, hopDelayMs)
    Box(
        modifier.slotMotion(m, size, look.glow.takeIf { it.alpha > 0f } ?: Color(0xFF965AFF)).drawBehind { drawGameTile(look) },
        contentAlignment = Alignment.Center,
    ) {
        if (ch.isNotEmpty()) {
            val sp = with(LocalDensity.current) { (size * 0.52f).toSp() }
            SlotLetter(ch, look.glyph, sp, bottomInset = size * TILE_LIP)
        }
    }
}

/**
 * I3 a scrambled clue letter as a small glossy chip (the B1 recipe at ~70% size, a
 * light amber face, a dark-purple letter); a used letter sinks (scale .9, faded 35%).
 */
@Composable
fun MuddleChip(ch: String, used: Boolean, size: Dp, modifier: Modifier = Modifier) {
    val look = if (WTheme.isDark) CHIP_LOOK_DARK else CHIP_LOOK
    val still = WTheme.reducedMotion
    val sink = remember { Animatable(if (used) 1f else 0f) }
    LaunchedEffect(used) {
        if (still) sink.snapTo(if (used) 1f else 0f) else sink.animateTo(if (used) 1f else 0f, tween(220))
    }
    BoxWithConstraints(
        modifier
            .graphicsLayer {
                val k = sink.value
                val s = 1f - 0.1f * k
                scaleX = s; scaleY = s
                alpha = 1f - 0.65f * k
            }
            .drawBehind { drawGameTile(look) },
        contentAlignment = Alignment.Center,
    ) {
        val sp = with(LocalDensity.current) { (size * 0.56f).toSp() }
        SlotLetter(ch, look.glyph, sp, bottomInset = size * TILE_LIP)
    }
}

/**
 * I4 the punchline-solved confetti: a soft one-shot burst of candy-colored bits that
 * falls and fades over ~1.6 s. Decorative; nothing under Reduce Motion.
 */
@Composable
fun MuddleConfetti(trigger: Boolean, modifier: Modifier = Modifier) {
    if (WTheme.reducedMotion) return
    val t = remember { Animatable(0f) }
    LaunchedEffect(trigger) {
        if (trigger) { t.snapTo(0f); t.animateTo(1f, tween(1600)) }
    }
    if (!trigger || t.value >= 1f) return
    val colors = listOf(Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFFF5A524), Color(0xFF14B8A6), Color(0xFFF97316), Color(0xFFA78BFA))
    // FINISH_SPEC AD: Battery Saver halves the burst (the golden-angle spread still fills the circle).
    val pieces = com.wordocious.app.ui.theme.CalmMotion.confettiCount(36, WTheme.calmMotion)
    Canvas(modifier.fillMaxSize()) {
        val p = t.value
        for (i in 0 until pieces) {
            val angle = (i * 137.5f) * (Math.PI / 180f).toFloat()
            val speed = 0.35f + (i % 7) * 0.06f
            val x = size.width / 2 + cos(angle) * size.width * speed * p
            val y = size.height * 0.45f + sin(angle) * size.height * 0.25f * p + size.height * 0.55f * p * p
            val c = colors[i % colors.size].copy(alpha = (1f - p).coerceIn(0f, 1f))
            val w = 6.dp.toPx(); val h = 3.5.dp.toPx()
            drawRoundRect(c, topLeft = Offset(x - w / 2, y - h / 2), size = Size(w, h), cornerRadius = CornerRadius(1.5.dp.toPx()))
        }
    }
}
