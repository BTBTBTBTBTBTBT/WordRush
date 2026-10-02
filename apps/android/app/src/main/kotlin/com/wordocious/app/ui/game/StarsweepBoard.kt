package com.wordocious.app.ui.game

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.wordocious.app.R
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.RegionsState
import kotlinx.coroutines.launch

// FINISH_SPEC H — Starsweep in the new look (founder 10-02): every region a soft pastel
// candy tile (a lighter top gloss and a 1.5 dp darker lip), region borders as a wider
// darker seam (never black lines), the stars and crosses as the glossy art pieces
// (art_starsweep_*), all inside the shared game tray (L). Motion: placing a star pops
// (B3 type), playing it flips and glows (purple when right, red + a small shake when
// wrong), a hint glows gold twice. Mirrors the web and iOS Starsweep boards.

/** H the region pastels (pure, unit-tested): lilac, peach, mint, sky, butter, pink, aqua, coral, lavender. */
object StarsweepPalette {
    val PASTELS: List<Color> = listOf(
        Color(0xFFE6DAFF), // lilac
        Color(0xFFFFDDC7), // peach
        Color(0xFFCFF3DE), // mint
        Color(0xFFD3E9FF), // sky
        Color(0xFFFFF0B0), // butter
        Color(0xFFFFD9EA), // pink
        Color(0xFFC9F1EE), // aqua
        Color(0xFFFFD1CA), // coral
        Color(0xFFE0DCF8), // lavender
    )
    private const val NIGHT = 0xFF1E1730.toInt()

    /** Region [g]'s pastel; dark mode = a deeper muted version over the night surface. */
    fun pastel(g: Int, dark: Boolean): Color {
        val base = PASTELS[Math.floorMod(g, PASTELS.size)]
        return if (dark) Color(TintMath.over(base.toArgb(), 0.32f, NIGHT)) else base
    }

    /** The tile's top (lighter) face color. */
    fun faceTop(c: Color): Color = Color(TintMath.over(0xFFFFFFFF.toInt(), 0.38f, c.toArgb()))

    /** The 1.5 dp bottom lip (the pastel darkened). */
    fun lip(c: Color): Color = Color(TintMath.over(0xFF000000.toInt(), 0.16f, c.toArgb()))

    /** Cell padding (dp) on a side: a wide half-seam where the region changes, a thin one inside. */
    fun halfGap(sameRegion: Boolean, edge: Boolean): Float = when {
        edge -> 0.75f
        sameRegion -> 0.75f
        else -> 2.25f
    }
}

/** The art for a cell's mark, or null for an empty cell. */
@DrawableRes
internal fun starsweepArt(mark: Char, wrong: Boolean, missing: Boolean): Int? = when {
    mark == '*' -> if (wrong) R.drawable.art_starsweep_star_wrong else R.drawable.art_starsweep_star_correct
    mark == 'o' -> R.drawable.art_starsweep_star_placed
    mark == 'x' -> R.drawable.art_starsweep_cross
    missing -> R.drawable.art_starsweep_star_correct
    else -> null
}

private val STAR_ACCENT = Color(0xFFCA8A04)

/**
 * H the Starsweep board: [state]'s regions as pastel candy tiles inside the game tray,
 * the marks as art, the focused cell ringed. [revealSolution] shows the missing stars
 * faded on a lost board. [onTap] gets the cell index.
 */
@Composable
fun StarsweepBoard(
    state: RegionsState,
    focused: Int?,
    revealSolution: Boolean,
    trayState: TrayState,
    onTap: (Int) -> Unit,
) {
    val n = state.n
    val dark = WTheme.isDark
    val seam = if (dark) Color(0xFF120D1F) else GameTrayStyle.seam(GameTrayStyle.tint(STAR_ACCENT, trayState))
    Box(
        Modifier.fillMaxWidth().widthIn(max = 420.dp).aspectRatio(1f)
            .gameTray(STAR_ACCENT, trayState, padding = androidx.compose.foundation.layout.PaddingValues(8.dp)),
    ) {
        Column(
            Modifier.fillMaxSize().drawBehind {
                // The seams: the grid's ground is the tray's deeper tone, so the wider
                // region gaps read as soft darker seams (no black lines).
                drawRoundRect(seam.copy(alpha = if (dark) 1f else 0.55f), cornerRadius = CornerRadius(10.dp.toPx()))
            },
        ) {
            for (r in 0 until n) {
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    for (c in 0 until n) {
                        val i = r * n + c
                        val g = state.regions[i]
                        fun same(j: Int) = state.regions[j] == g
                        val left = StarsweepPalette.halfGap(c > 0 && same(i - 1), c == 0)
                        val right = StarsweepPalette.halfGap(c < n - 1 && same(i + 1), c == n - 1)
                        val top = StarsweepPalette.halfGap(r > 0 && same(i - n), r == 0)
                        val bottom = StarsweepPalette.halfGap(r < n - 1 && same(i + n), r == n - 1)
                        StarsweepCell(
                            state = state, i = i, r = r, c = c,
                            focused = i == focused, revealSolution = revealSolution, onTap = onTap,
                            modifier = Modifier.weight(1f).fillMaxSize()
                                .padding(start = left.dp, end = right.dp, top = top.dp, bottom = bottom.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StarsweepCell(
    state: RegionsState,
    i: Int,
    r: Int,
    c: Int,
    focused: Boolean,
    revealSolution: Boolean,
    onTap: (Int) -> Unit,
    modifier: Modifier,
) {
    val n = state.n
    val g = state.regions[i] - '0'
    val mark = state.board[i]
    val wrong = state.wrongMask[i] == '1'
    val hinted = state.hintMask[i] == '1'
    val missing = revealSolution && mark != '*' && (state.solution[r] - '0') == c
    val pastel = StarsweepPalette.pastel(g, WTheme.isDark)
    val top = StarsweepPalette.faceTop(pastel)
    val lip = StarsweepPalette.lip(pastel)
    val still = WTheme.reducedMotion

    // B3 motion, keyed on the mark's change: pop on placing, flip + glow on playing.
    val pop = remember { Animatable(1f) }
    val flip = remember { Animatable(1f) }
    val glow = remember { Animatable(0f) }
    val shake = remember { Animatable(0f) }
    val prev = remember { arrayOf(mark) }
    LaunchedEffect(mark, wrong, hinted) {
        val was = prev[0]
        prev[0] = mark
        if (still || was == mark) return@LaunchedEffect
        when {
            mark == 'o' || mark == 'x' -> pop.animateTo(1f, keyframes {
                durationMillis = TileMotion.TYPE_MS
                0.6f at 0
                1.07f at (TileMotion.TYPE_MS * 0.55f).toInt()
            })
            mark == '*' -> {
                launch {
                    flip.snapTo(1f)
                    flip.animateTo(1f, keyframes {
                        durationMillis = TileMotion.FLIP_MS / 2
                        0f at TileMotion.FLIP_MS / 4
                    })
                }
                kotlinx.coroutines.delay((TileMotion.FLIP_MS / 4).toLong())
                if (wrong) launch {
                    shake.animateTo(0f, keyframes {
                        durationMillis = TileMotion.NUDGE_MS
                        -4f at 80; 4f at 180; -3f at 280; 2f at 380
                    })
                }
                val pulses = if (hinted) 2 else 1
                repeat(pulses) {
                    glow.snapTo(1f)
                    glow.animateTo(0f, tween(if (hinted) TileMotion.HINT_PULSE_MS / 2 else TileMotion.BLOOM_MS))
                }
            }
        }
    }
    val glowColor = when {
        hinted -> Color(0xFFFFBE46)
        wrong -> Color(0xFFF0435F)
        else -> Color(0xFF965AFF)
    }
    val spoken = buildString {
        append("Row ${r + 1}, column ${c + 1}, region ${g + 1}")
        when {
            mark == '*' && wrong -> append(", wrong star")
            mark == '*' && hinted -> append(", hint star")
            mark == '*' -> append(", star")
            mark == 'o' -> append(", black star, double-tap to play it")
            mark == 'x' -> append(", crossed out")
            missing -> append(", missed star")
        }
    }
    Box(
        modifier
            .graphicsLayer { translationX = shake.value * density }
            .squishClickable(spoken) { onTap(i) }
            .semantics { contentDescription = spoken }
            .drawBehind {
                val corner = minOf(7.dp.toPx(), size.minDimension * 0.22f)
                val cr = CornerRadius(corner)
                val g0 = glow.value
                if (g0 > 0.01f) {
                    val spread = size.minDimension * 0.22f
                    for (k in 4 downTo 1) {
                        val grow = spread * k / 4f
                        drawRoundRect(
                            glowColor.copy(alpha = 0.5f * g0 * (1f - k / 4f) + 0.08f * g0),
                            topLeft = Offset(-grow, -grow), size = Size(size.width + grow * 2, size.height + grow * 2),
                            cornerRadius = CornerRadius(corner + grow),
                        )
                    }
                }
                // The candy tile: the lip, then the face 1.5 dp up with its gradient, then the gloss.
                drawRoundRect(lip, cornerRadius = cr)
                val faceH = size.height - 1.5.dp.toPx()
                drawRoundRect(
                    Brush.verticalGradient(listOf(top, pastel), endY = faceH),
                    size = Size(size.width, faceH), cornerRadius = cr,
                )
                val gx = size.width * 0.12f
                drawRoundRect(
                    Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.45f), Color.White.copy(alpha = 0f)), startY = 1f, endY = faceH * 0.45f),
                    topLeft = Offset(gx, 1.5f), size = Size(size.width - gx * 2, faceH * 0.38f),
                    cornerRadius = CornerRadius(corner * 0.7f),
                )
                if (focused) {
                    val sw = 2.dp.toPx()
                    drawRoundRect(
                        STAR_ACCENT, topLeft = Offset(sw / 2, sw / 2), size = Size(size.width - sw, faceH - sw),
                        cornerRadius = CornerRadius((corner - sw / 2).coerceAtLeast(0f)), style = Stroke(sw),
                    )
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        val art = starsweepArt(mark, wrong, missing)
        if (art != null) {
            Image(
                painterResource(art), contentDescription = null,
                modifier = Modifier.fillMaxSize(0.78f).padding(bottom = 1.dp)
                    .graphicsLayer {
                        val s = pop.value
                        scaleX = s * flip.value; scaleY = s
                        alpha = if (missing) 0.45f else 1f
                    },
            )
        }
    }
}
