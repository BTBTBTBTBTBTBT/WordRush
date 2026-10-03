package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
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
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.Wash
import com.wordocious.app.ui.accentLine
import com.wordocious.app.ui.accentWash
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.squishClickable
import com.wordocious.app.ui.tintedPill
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// FINISH_SPEC J1 + J3 + L + B6 / G5 — the remaining game pieces (Hubbub, Crosswordocious,
// Kindred, Codebreaker, Spyglass, Letter Ladder): the Hubbub honeycomb of glossy hexes,
// the tinted glossy chip / capsule recipes, the type pop, and the finished-game pieces
// these screens share (tinted toasts, the tinted result card with tinted pills, the
// tinted overlay card with its 10 dp top bar, soft-number stat blocks, candy actions).
// Mirrors the web and iOS finishing kits.

/** The solved / failed tones (the tray's WON / LOST washes) and the B6 time pill's blue. */
internal val PIECE_WON = Color(0xFF7C3AED)
internal val PIECE_LOST = Color(0xFF6B7891)
internal val PIECE_TIME = Color(0xFF2563EB)

// ── J1 · the Hubbub honeycomb (pure, unit-tested) ─────────────────────────

/**
 * J1 the honeycomb: the gold center hex with the six lilac hexes around it. The hex
 * art (art_piece_hex*) is a FLAT-TOP hexagon whose corners reach [RADIUS] of the image
 * side from its center, so neighbors sit √3·R apart, straight above / below and on
 * the four diagonals. All numbers are in units of the hex image's side.
 */
object Honeycomb {
    /** The hex's circumradius as a fraction of its image side (the art spans 240 / 256 px). */
    const val RADIUS = 0.47f
    /** The breathing room between neighbors, as a fraction of the center distance. */
    const val GAP = 0.08f

    /** Center-to-center distance between neighbors. */
    fun step(gap: Float = GAP): Float = sqrt(3f) * RADIUS * (1f + gap)

    /**
     * The six outer hexes' centers relative to the middle hex's center (x right, y
     * down), clockwise from the top: top, upper right, lower right, bottom, lower left,
     * upper left.
     */
    fun outerOffsets(gap: Float = GAP): List<Pair<Float, Float>> {
        val d = step(gap)
        return List(6) { i ->
            val a = Math.toRadians(-90.0 + 60.0 * i)
            val x = (d * cos(a)).toFloat()
            val y = (d * sin(a)).toFloat()
            // Snap the float noise (cos 90° ≈ 6e-17) so the column is exactly centered.
            (if (kotlin.math.abs(x) < 1e-5f) 0f else x) to (if (kotlin.math.abs(y) < 1e-5f) 0f else y)
        }
    }

    /** The cluster's bounding width / height (in hex sides). */
    fun width(gap: Float = GAP): Float = 2f * (outerOffsets(gap).maxOf { kotlin.math.abs(it.first) }) + 1f
    fun height(gap: Float = GAP): Float = 2f * (outerOffsets(gap).maxOf { kotlin.math.abs(it.second) }) + 1f

    /** The largest hex side (dp) that fits a [w] × [h] dp box. */
    fun sideFor(w: Float, h: Float, gap: Float = GAP): Float = minOf(w / width(gap), h / height(gap))
}

/** J1 the letter ink: dark amber on the gold center, white on the lilac hexes. */
fun hexInk(center: Boolean): Color = if (center) Color(0xFF7A3D00) else Color.White

/**
 * J1 one glossy hive letter: the hex art (gold center / lilac outer) with the letter
 * drawn on top in Nunito Black (the tile text-shadow; dark amber on gold). Tap =
 * squish + the type pop. [label] is what TalkBack reads.
 */
@Composable
fun HubHex(letter: Char, center: Boolean, side: Dp, enabled: Boolean, label: String, modifier: Modifier = Modifier, onTap: () -> Unit) {
    val still = WTheme.reducedMotion
    val pop = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()
    val blank = letter == ' '
    Box(
        modifier
            .size(side)
            .then(
                if (enabled && !blank) Modifier.squishClickable(label) {
                    if (!still) scope.launch {
                        pop.snapTo(1f)
                        pop.animateTo(1f, keyframes {
                            durationMillis = TileMotion.TYPE_MS
                            1.1f at (TileMotion.TYPE_MS * 0.45f).toInt()
                        })
                    }
                    onTap()
                } else Modifier.clearAndSetSemantics { if (!blank) contentDescription = label },
            )
            .graphicsLayer { scaleX = pop.value; scaleY = pop.value },
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painterResource(if (center) R.drawable.art_piece_hex_center else R.drawable.art_piece_hex),
            contentDescription = null, modifier = Modifier.fillMaxSize(),
        )
        if (!blank) {
            val px = LocalDensity.current.density
            val ink = hexInk(center)
            val sp = with(LocalDensity.current) { (side * 0.42f).toSp() }
            Text(
                letter.toString(), color = ink, fontSize = sp, fontWeight = FontWeight.Black, fontFamily = Nunito,
                maxLines = 1, softWrap = false,
                // The face sits a lip above the art's bottom edge.
                modifier = Modifier.padding(bottom = side * 0.06f),
                style = TextStyle(
                    shadow = if (center) Shadow(Color.White.copy(alpha = 0.55f), Offset(0f, 1f * px), 0f)
                    else Shadow(Color(0x592E0C63), Offset(0f, 1.4f * px), 1.6f * px),
                ),
            )
        }
    }
}

/**
 * J1 + L the hive: [centerLetter] in the gold hex with [outer] (six letters, ' ' =
 * empty) around it as a honeycomb, sitting in the game tray ([state]).
 */
@Composable
fun HubHoneycomb(
    centerLetter: Char,
    outer: List<Char>,
    side: Dp,
    accent: Color,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    state: TrayState = TrayState.PLAYING,
    trayPadding: Dp = 10.dp,
    onTap: (Char) -> Unit,
) {
    val offsets = remember { Honeycomb.outerOffsets() }
    val w = side * Honeycomb.width()
    val h = side * Honeycomb.height()
    GameTray(accent, modifier, state = state, padding = androidx.compose.foundation.layout.PaddingValues(trayPadding)) {
        Box(Modifier.size(w, h)) {
            val cx = (w - side) / 2
            val cy = (h - side) / 2
            HubHex(centerLetter, true, side, enabled, "$centerLetter, center letter", Modifier.offset(cx, cy)) { onTap(centerLetter) }
            for (i in 0 until 6) {
                val ch = outer.getOrElse(i) { ' ' }
                val (dx, dy) = offsets[i]
                HubHex(ch, false, side, enabled, ch.toString(), Modifier.offset(cx + side * dx, cy + side * dy)) { onTap(ch) }
            }
        }
    }
}

// ── J3 · glossy chips + capsules ──────────────────────────────────────────

private fun mix(a: Color, amount: Float, b: Color): Color = Color(TintMath.over(a.copy(alpha = 1f).toArgb(), amount, b.copy(alpha = 1f).toArgb()))

/**
 * J3 a glossy chip in [accent]'s tint (Kindred word cards): a tinted face (the accent
 * washed over white), a darker lip, an inner line and the gloss — the B1 tile recipe
 * in the game's color. Dark mode: a deep face with the accent line.
 */
fun tintedChipLook(accent: Color, dark: Boolean): TileLook = if (dark) TileLook(
    edge = Color(0xFF120D1F), faceTop = Color(0xFF3F3163), faceMid = Color(0xFF362A57), faceBottom = Color(0xFF30254E),
    ring = accent.copy(alpha = 0.45f), ringFrac = 0.025f, gloss = 0.14f, glyph = Color(0xFFF1EAFF),
    glyphShadow = Color.Transparent, glow = accent.copy(alpha = 0.5f),
) else TileLook(
    edge = Wash.mix(accent, 0.46f),
    faceTop = Wash.mix(accent, 0.05f),
    faceMid = Wash.mix(accent, 0.12f),
    faceBottom = Wash.mix(accent, 0.16f),
    ring = Wash.mix(accent, 0.32f), ringFrac = 0.025f, gloss = 0.6f,
    glyph = FinishInk.heading, glyphShadow = Color.White.copy(alpha = 0.7f), glow = accent.copy(alpha = 0.5f),
)

/** J3 a solid glossy family from one [base] (a filled chip / a tile in a game's own color). */
fun solidChipLook(base: Color, glyph: Color = Color.White): TileLook = TileLook(
    edge = mix(Color.Black, 0.36f, base),
    faceTop = mix(Color.White, 0.28f, base),
    faceMid = base,
    faceBottom = mix(Color.Black, 0.08f, base),
    ring = null, ringFrac = 0f, gloss = 0.5f, glyph = glyph,
    glyphShadow = if (glyph == Color.White) Color(0x592E0C63) else Color.White.copy(alpha = 0.5f),
    glow = base.copy(alpha = 0.6f),
)

/** A revealed / hinted letter: the violet tile (Muddle's pinned look). */
val VIOLET_LOOK: TileLook = TileLooks.CORRECT.copy(
    edge = Color(0xFF5B21B6), faceTop = Color(0xFFC4A4FF), faceMid = Color(0xFF8B5CF6), faceBottom = Color(0xFF7C4DEB),
)

/**
 * J3 a glossy capsule in [accent] (found words): a soft accent glow, a darker lip, the
 * accent face with a lighter top, and the white gloss across the top half. Text on it
 * reads white. [glow] 0..1.
 */
fun Modifier.glossyCapsule(accent: Color, glow: Float = 1f, corner: Dp? = null): Modifier = this.drawBehind {
    val a = accent.copy(alpha = 1f)
    val r = corner?.toPx() ?: (size.height / 2f)
    val lip = 2.5.dp.toPx()
    if (glow > 0.01f) {
        for (k in 4 downTo 1) {
            val grow = 2.dp.toPx() * k
            drawRoundRect(
                a.copy(alpha = 0.10f * glow * (5 - k) / 4f),
                topLeft = Offset(-grow, -grow + lip / 2), size = Size(size.width + grow * 2, size.height + grow * 2),
                cornerRadius = CornerRadius(r + grow),
            )
        }
    }
    drawRoundRect(mix(Color.Black, 0.32f, a), cornerRadius = CornerRadius(r))
    val faceH = size.height - lip
    drawRoundRect(
        Brush.verticalGradient(listOf(mix(Color.White, 0.30f, a), a), endY = faceH),
        size = Size(size.width, faceH), cornerRadius = CornerRadius(r),
    )
    val gx = minOf(r * 0.6f, size.width * 0.2f)
    drawRoundRect(
        Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.45f), Color.White.copy(alpha = 0f)), startY = 1f, endY = faceH * 0.55f),
        topLeft = Offset(gx, 1.5f), size = Size(size.width - gx * 2, faceH * 0.48f),
        cornerRadius = CornerRadius(r * 0.7f),
    )
}

/**
 * J3 a glossy capsule laid along a line of cells (a found word on the Spyglass grid):
 * the glow, a lip below, the accent body and a gloss stripe toward the top.
 */
fun DrawScope.drawGlossyLine(start: Offset, end: Offset, thickness: Float, accent: Color, glow: Float = 1f) {
    val a = accent.copy(alpha = 1f)
    if (glow > 0.01f) {
        for (k in 3 downTo 1) {
            drawLine(a.copy(alpha = 0.10f * glow), start, end, strokeWidth = thickness + thickness * 0.22f * k, cap = StrokeCap.Round)
        }
    }
    val lip = thickness * 0.09f
    drawLine(mix(Color.Black, 0.30f, a).copy(alpha = 0.9f), start + Offset(0f, lip), end + Offset(0f, lip), strokeWidth = thickness, cap = StrokeCap.Round)
    drawLine(a.copy(alpha = 0.92f), start, end, strokeWidth = thickness, cap = StrokeCap.Round)
    val up = Offset(0f, -thickness * 0.2f)
    drawLine(Color.White.copy(alpha = 0.32f), start + up, end + up, strokeWidth = thickness * 0.32f, cap = StrokeCap.Round)
}

/** A1 a small soft chip (frequency chips, hint chips): the accent wash and a 1 dp line, no band. */
fun Modifier.softChip(accent: Color, selected: Boolean = false, corner: Dp = 50.dp): Modifier = composed {
    val shape = RoundedCornerShape(corner)
    val dark = WTheme.isDark
    this.clip(shape)
        .background(if (dark) WTheme.surface else Wash.mix(accent, if (selected) Wash.SELECTED else Wash.CARD))
        .border(1.dp, if (selected) accent else accentLine(accent, 0.30f), shape)
}

// ── B3 · the type pop ─────────────────────────────────────────────────────

/** B3 a letter arriving swells in (.55 → 1.07 → 1, [TileMotion.TYPE_MS]). Off with Reduce Motion. */
fun Modifier.typePop(ch: String): Modifier = composed {
    if (WTheme.reducedMotion) return@composed this
    val pop = remember { Animatable(1f) }
    val last = remember { arrayOf(ch) }
    LaunchedEffect(ch) {
        val was = last[0]; last[0] = ch
        if (ch.isNotEmpty() && ch != was) {
            pop.animateTo(1f, keyframes {
                durationMillis = TileMotion.TYPE_MS
                0.55f at 0
                1.07f at (TileMotion.TYPE_MS * 0.55f).toInt()
            })
        }
    }
    this.graphicsLayer { scaleX = pop.value; scaleY = pop.value }
}

// ── G5 / B6 · the finished-game pieces ────────────────────────────────────

/**
 * G5 the game toast: now the shared candy [GameFeedbackToast] (score burst / calm
 * candy message), centered on the screen's [feedbackAnchor] when one is on screen,
 * else [top] below the screen top. [accent] is kept for call-site compatibility.
 */
@Composable
@Suppress("UNUSED_PARAMETER")
fun PieceToast(text: String?, accent: Color, top: Dp = 100.dp) = GameFeedbackToast(text, fallbackTop = top)

/**
 * A2 / R1 an overlay stat: inside the win popup a stat chip (tinted pill, glyph,
 * soft number, small-caps label; points gold and counting up); elsewhere a soft
 * number over a caps label. One line always ("35:17" never breaks).
 */
@Composable
fun PieceStat(value: String, label: String) {
    val host = LocalWinPopupHost.current
    if (host != null) {
        WinStatChip(WinStat(WinPopupMath.kindFor(label), value, label), host.accent, Modifier.widthIn(min = 56.dp))
        return
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        SoftNumber(value, 22.sp)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, letterSpacing = 0.6.sp)
    }
}

/** A8 the overlay's Play again / Try again: the pink candy with the play mark. */
@Composable
fun PiecePlayAgain(won: Boolean, onClick: () -> Unit) {
    LocalWinPopupHost.current?.playAgainShown = true
    WinPlayAgain(if (won) "Play again" else "Try again", onClick)
}

/**
 * R1 the overlay's way out: inside the win popup the CONTINUE candy in the game
 * accent (tap anywhere still works); elsewhere the quiet hint line.
 */
@Composable
fun PieceTapHint(text: String = "Tap anywhere to continue") {
    val host = LocalWinPopupHost.current
    val go = host?.onContinue
    if (host != null && go != null) {
        WinContinue(host.accent, go, besidePink = host.playAgainShown)
        return
    }
    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
}

/**
 * R1 the victory / game-over popup for the More Games titles: the shared
 * [WinPopupFrame] (the host on its stage, the accent card over the cream with the
 * rainbow bar, the confetti burst) around [content]; the lettering at the top of
 * [content] gets the gloss sweep. [onScrimTap] fires on any tap (tap anywhere) and
 * is what [PieceTapHint]'s CONTINUE calls.
 */
@Composable
fun PieceOverlay(won: Boolean, hostKey: String, accent: Color, onScrimTap: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    WinPopupFrame(won, hostKey, accent, onScrimTap = onScrimTap, glossBand = 76.dp, content = content)
}

/**
 * B6 the finished game's result card: a tinted card (purple when solved, slate when
 * not) with its top bar, the W / L badge + [title], the result line as tinted pills
 * ([pills], e.g. [ResultPill]) and an optional quiet [note].
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PieceResultCard(won: Boolean, title: String, note: String? = null, pills: @Composable () -> Unit) {
    val tone = if (won) PIECE_WON else PIECE_LOST
    com.wordocious.app.ui.TintedCard(
        accent = tone,
        modifier = Modifier.widthIn(max = 420.dp).fillMaxWidth(),
        bar = Brush.horizontalGradient(if (won) listOf(Color(0xFF7C3AED), Color(0xFFA855F7)) else listOf(Color(0xFF6B7891), Color(0xFF8D99B0))),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                com.wordocious.app.ui.ResultBadge(won, size = 26.dp)
                Text(
                    title, fontSize = 18.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, textAlign = TextAlign.Center,
                    color = if (won) Color(0xFF7C3AED) else Color(0xFFDC2626),
                )
            }
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) { pills() }
            if (!note.isNullOrEmpty()) {
                Text(note, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
            }
        }
    }
}

/**
 * A8 a game control as a small candy button with a white leading [icon]. Unlike
 * [PadAction]'s dim, [faded] only LOOKS quiet — the tap still goes through (the
 * game answers it, e.g. "Reveal unlocks at 5:00").
 */
@Composable
fun PieceAction(label: String, icon: ImageVector, onClick: () -> Unit, color: CandyColor = CandyColor.PEACH, faded: Boolean = false, reserveLabel: String? = null, count: Int = 0) {
    val leading: @Composable () -> Unit = { Icon(icon, null, tint = color.ink, modifier = Modifier.size(13.dp)) }
    val description = hintCountDescription(label, count)
    // BI22: the used count is a corner badge (overlay); a changing label keeps its widest width.
    androidx.compose.foundation.layout.Box {
        if (reserveLabel == null) {
            CandyButton(label, onClick = onClick, modifier = Modifier.alpha(if (faded) 0.55f else 1f), color = color, size = CandySize.SMALL, contentDescription = description, leading = leading)
        } else {
            ReservedWidth(
                reserve = { CandyButton(reserveLabel, onClick = {}, color = color, size = CandySize.SMALL, leading = leading) },
                modifier = Modifier.alpha(if (faded) 0.55f else 1f),
            ) { CandyButton(label, onClick = onClick, color = color, size = CandySize.SMALL, fill = true, contentDescription = description, leading = leading) }
        }
        HintCountBadge(count, Modifier.align(Alignment.TopEnd).offset(x = 5.dp, y = (-7).dp))
    }
}

/** L a finished board's tray: purple when solved, slate when not; the accent while playing. */
fun finishTray(finished: Boolean, won: Boolean): TrayState = when {
    !finished -> TrayState.PLAYING
    won -> TrayState.WON
    else -> TrayState.LOST
}

/** The words / hints count as "N hint(s)", or null when none were used. */
fun hintsNote(hints: Int): String? = if (hints > 0) "$hints hint${if (hints == 1) "" else "s"}" else null
