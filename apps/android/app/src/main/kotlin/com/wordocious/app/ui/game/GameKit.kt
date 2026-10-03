package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState

// FINISH_SPEC B1–B3: the game kit's tile (the ART_SPEC §20 recipe shared with the
// letter-tile avatars) and its motion timings. Visual reference: the `.tile` rules and
// keyframes in docs/design/brand/mockups/game-kit.html. Every word game draws its
// tiles through TileView (this look); number games carry digits on the same tile.

/**
 * B3 the motion kit's timings (ms). Reduce Motion: flips become a quick crossfade, the rest is off.
 * FINISH_SPEC AQ1 (founder 10-02: "feels a little slow … when I am trying to go through it fast"):
 * a shorter hop and a not-a-word reject that never blocks typing (web REVEAL parity: glow 600,
 * hop 400 / 60, wobble 500, nudge 360, reject 700 / 60 / 160).
 * FINISH_SPEC BI5 (founder 10-02 on 2.7: "it seemed really rushed … way too zippy"): the
 * pre-overhaul reveal pacing is back — single board 500 ms flips, 150 ms apart (a 5-letter row
 * ≈ 1.1 s); multi-board mini boards 300 ms, 80 ms apart. (B3 was 720 / 300; AQ1 220 / 70.)
 * The finish hold waits out the whole row (and a win's hop wave) plus the old 200 ms beat.
 */
object TileMotion {
    /** Type a letter / place a number: soft spring swell. */
    const val TYPE_MS = 220
    /** Reveal (single board): each tile turns over in this long… */
    const val FLIP_MS = 500
    /** …this far apart. */
    const val FLIP_STAGGER_MS = 150
    /** Reveal (multi-board mini boards): each tile turns over in this long… */
    const val MINI_FLIP_MS = 300
    /** …this far apart. */
    const val MINI_FLIP_STAGGER_MS = 80
    /** The soft color glow each revealed tile lands with. */
    const val BLOOM_MS = 600
    /** Not a word: the row nudge. */
    const val NUDGE_MS = 360
    /** Not a word: the red glow (typing during it starts the fresh row at once). */
    const val BAD_MS = 700
    /** Not a word: the letters clear right to left this far apart… */
    const val CLEAR_STAGGER_MS = 60
    /** …each shrinking away in this long. */
    const val CLEAR_MS = 160
    /** Win: the hop wave. */
    const val HOP_MS = 400
    const val HOP_STAGGER_MS = 60
    /** Lose: the wobble + sink. */
    const val SINK_MS = 500
    /** Hint: one gold glow pulse (plays twice). */
    const val HINT_PULSE_MS = 900
    /** Reduce Motion: the flip's crossfade. */
    const val REDUCED_FLIP_MS = 160
    /** BI5 the pre-overhaul beat between the board settling and the result popup. */
    const val FINISH_BEAT_MS = 200

    /** BI5 one tile's turn-over: single board or [mini] (multi-board). */
    fun flipMs(mini: Boolean = false): Int = if (mini) MINI_FLIP_MS else FLIP_MS

    /** BI5 the gap between neighboring tiles: single board or [mini] (multi-board). */
    fun staggerMs(mini: Boolean = false): Int = if (mini) MINI_FLIP_STAGGER_MS else FLIP_STAGGER_MS

    /** AQ1 when tile [column] of a revealing row lands (its flip ends) — its keyboard key takes its color then. */
    fun tileLandsMs(column: Int, mini: Boolean = false): Int = column.coerceAtLeast(0) * staggerMs(mini) + flipMs(mini)

    /** AQ1 how many of a [tiles]-wide row's tiles have landed [elapsedMs] after it committed. */
    fun tilesLanded(elapsedMs: Int, tiles: Int, mini: Boolean = false): Int {
        if (tiles <= 0 || elapsedMs < flipMs(mini)) return 0
        return ((elapsedMs - flipMs(mini)) / staggerMs(mini) + 1).coerceIn(0, tiles)
    }

    /** How long a row of [tiles] takes to reveal (the last tile lands). */
    fun revealMs(tiles: Int, mini: Boolean = false): Int = if (tiles <= 0) 0 else tileLandsMs(tiles - 1, mini)

    /** How long the win hop wave over [tiles] takes. */
    fun hopWaveMs(tiles: Int): Int = if (tiles <= 0) 0 else (tiles - 1) * HOP_STAGGER_MS + HOP_MS

    /** How long the not-a-word clear over [tiles] takes. */
    fun clearMs(tiles: Int): Int = if (tiles <= 0) 0 else (tiles - 1) * CLEAR_STAGGER_MS + CLEAR_MS

    /**
     * How long a live finish holds the board on screen before the result screen: the
     * final row's whole reveal at the board's own pacing (mini on multi-board), then (a
     * win) the hop wave, then the 200 ms beat — never cut short (BI5: the popup waits
     * for the slower row). Reduce Motion: a short beat only.
     */
    fun finishHoldMs(tiles: Int, won: Boolean, multiBoard: Boolean, reduced: Boolean): Int = when {
        reduced -> 350
        won -> revealMs(tiles, multiBoard) + hopWaveMs(tiles) + FINISH_BEAT_MS
        else -> revealMs(tiles, multiBoard) + FINISH_BEAT_MS
    }
}

/** B1 one tile's paint: the lip ([edge]), the face gradient, the inner ring, the gloss and the glyph. */
data class TileLook(
    val edge: Color,
    val faceTop: Color,
    val faceMid: Color,
    val faceBottom: Color,
    /** Inner ring color (null = none) and its width as a fraction of the tile size. */
    val ring: Color?,
    val ringFrac: Float,
    val gloss: Float,
    val glyph: Color,
    val glyphShadow: Color,
    /** The bloom color this tile lands with after a reveal. */
    val glow: Color,
)

/** B1 the tile states the kit paints (the core TileState plus the board-only looks). */
enum class TileFace { EMPTY, TYPED, CORRECT, PRESENT, ABSENT, HINT, GIVEN, CONFLICT, BAD, MASKED }

object TileLooks {
    private fun c(argb: Long) = Color(argb.toInt())
    private fun mix(a: Color, amount: Float, b: Color): Color = Color(TintMath.over(a.toArgb(), amount, b.toArgb()))

    /** A solid-state tile family (light → base 70% → bottom, a darker lip) from one [base]. */
    private fun family(base: Color, glow: Color, gloss: Float = 0.55f): TileLook = TileLook(
        edge = mix(Color.Black, 0.38f, base),
        faceTop = mix(Color.White, 0.28f, base),
        faceMid = base,
        faceBottom = mix(Color.Black, 0.08f, base),
        ring = null, ringFrac = 0f, gloss = gloss, glyph = Color.White,
        glyphShadow = Color(0x59000000), glow = glow,
    )

    /** B1 right spot: PURPLE (no gold rim). */
    val CORRECT = TileLook(
        edge = c(0xFF4C1D95), faceTop = c(0xFFA66BFF), faceMid = c(0xFF7C3AED), faceBottom = c(0xFF6A2BD6),
        ring = null, ringFrac = 0f, gloss = 0.55f, glyph = Color.White, glyphShadow = c(0x8C2E0C63), glow = c(0x99965AFF),
    )
    /** B1 wrong spot: GOLD. */
    val PRESENT = TileLook(
        edge = c(0xFFB0650B), faceTop = c(0xFFFFD166), faceMid = c(0xFFF5A524), faceBottom = c(0xFFE8901A),
        ring = null, ringFrac = 0f, gloss = 0.55f, glyph = Color.White, glyphShadow = c(0x73783C00), glow = c(0xA6FFBE46),
    )
    /** B1 not in word: SLATE GREY. */
    val ABSENT = TileLook(
        edge = c(0xFF3F4A5E), faceTop = c(0xFF8D99B0), faceMid = c(0xFF6B7891), faceBottom = c(0xFF5D6981),
        ring = null, ringFrac = 0f, gloss = 0.32f, glyph = Color.White, glyphShadow = c(0x73191E2D), glow = c(0x598C96AF),
    )
    /** B1 empty: frosted glass (white ~55–62% over the wallpaper, a faint lilac border). */
    val EMPTY = TileLook(
        edge = c(0x8CD8C8F3), faceTop = c(0x9EFFFFFF), faceMid = c(0x9EFFFFFF), faceBottom = c(0x9EFFFFFF),
        ring = c(0x297C3AED), ringFrac = 0.033f, gloss = 0.35f, glyph = c(0xFF3B1A78), glyphShadow = Color.Transparent, glow = Color.Transparent,
    )
    /** Dark mode's frosted glass (the dark wallpaper shows through). */
    val EMPTY_DARK = TileLook(
        edge = c(0x24FFFFFF), faceTop = c(0x1FFFFFFF), faceMid = c(0x17FFFFFF), faceBottom = c(0x14FFFFFF),
        ring = c(0x40A78BFA), ringFrac = 0.033f, gloss = 0.12f, glyph = c(0xFFF1EAFF), glyphShadow = Color.Transparent, glow = Color.Transparent,
    )
    /** B1 typed: white face + purple border + dark purple letter. */
    val TYPED = TileLook(
        edge = c(0xFFC9B2F2), faceTop = Color.White, faceMid = Color.White, faceBottom = Color.White,
        ring = c(0xFF8B5CF6), ringFrac = 0.042f, gloss = 0.55f, glyph = c(0xFF3B1A78), glyphShadow = c(0x2E7C3AED), glow = Color.Transparent,
    )
    /** Sudoku "given": a plain light tile, dark purple digit. */
    val GIVEN = TileLook(
        edge = c(0xFFD8C8F3), faceTop = c(0xFFFCFAFF), faceMid = c(0xFFFCFAFF), faceBottom = c(0xFFFCFAFF),
        ring = c(0x247C3AED), ringFrac = 0.025f, gloss = 0.4f, glyph = c(0xFF2A1650), glyphShadow = Color.Transparent, glow = Color.Transparent,
    )
    /** A hint-row ghost (the revealed slot's faint placeholder). */
    val HINT = TileLook(
        edge = c(0xFFE2D6F7), faceTop = c(0xFFFAF7FF), faceMid = c(0xFFFAF7FF), faceBottom = c(0xFFF6F1FF),
        ring = c(0x1F7C3AED), ringFrac = 0.025f, gloss = 0.3f, glyph = c(0xFFB8A6D9), glyphShadow = Color.Transparent, glow = Color.Transparent,
    )
    /** A rule break (Sudoku conflict). */
    val CONFLICT = TileLook(
        edge = c(0xFFB4233C), faceTop = c(0xFFFF8A9B), faceMid = c(0xFFF0435F), faceBottom = c(0xFFD9324E),
        ring = null, ringFrac = 0f, gloss = 0.5f, glyph = Color.White, glyphShadow = c(0x59000000), glow = c(0x99F0435F),
    )
    /** Not a word: the typed tile with red letters and a red ring (the glow is the motion). */
    val BAD = TYPED.copy(ring = c(0xFFF0435F), ringFrac = 0.05f, glyph = c(0xFFC2183A), glyphShadow = Color.Transparent, glow = c(0x99F0435F))

    /** The look for a [face]; [colorblind] swaps right spot → orange, wrong spot → blue (web/iOS parity). */
    fun of(face: TileFace, colorblind: Boolean = false, dark: Boolean = false): TileLook = when (face) {
        TileFace.CORRECT -> if (colorblind) family(c(0xFFF5793A), c(0x99F5793A)) else CORRECT
        TileFace.PRESENT -> if (colorblind) family(c(0xFF85C0F9), c(0xA685C0F9)) else PRESENT
        TileFace.ABSENT -> ABSENT
        TileFace.EMPTY, TileFace.MASKED -> if (dark) EMPTY_DARK else EMPTY
        TileFace.TYPED -> TYPED
        TileFace.HINT -> HINT
        TileFace.GIVEN -> GIVEN
        TileFace.CONFLICT -> CONFLICT
        TileFace.BAD -> BAD
    }

    /** The face for a board tile: its evaluated [state], or typed / empty for the input row. */
    fun faceFor(state: TileState, hasLetter: Boolean, invalid: Boolean, masked: Boolean): TileFace = when {
        masked -> TileFace.MASKED
        invalid -> TileFace.BAD
        state == TileState.CORRECT -> TileFace.CORRECT
        state == TileState.PRESENT -> TileFace.PRESENT
        state == TileState.ABSENT -> TileFace.ABSENT
        state == TileState.HINT_USED -> TileFace.HINT
        hasLetter -> TileFace.TYPED
        else -> TileFace.EMPTY
    }
}

/** B1 the tile's corner (22% of its size), lip (7%), gloss inset / height. */
internal const val TILE_CORNER = 0.22f
internal const val TILE_LIP = 0.07f

/**
 * B1 paint one tile [look] into this draw scope: the lip (full tile in the edge
 * color), the face inset 7% from the bottom with its vertical gradient and inner ring,
 * then the gloss across the top. An optional soft [glowAlpha] (0..1) halo in
 * [glowColor] spreads around it first (B3 bloom / not-a-word / hint glows).
 */
fun DrawScope.drawGameTile(look: TileLook, glowColor: Color = look.glow, glowAlpha: Float = 0f) {
    val w = size.width
    val h = size.height
    val s = minOf(w, h)
    val r = s * TILE_CORNER
    if (glowAlpha > 0.001f && glowColor.alpha > 0f) {
        // A soft halo: stacked, growing rounded rects (Compose can't blur a shape on every API level).
        val spread = s * 0.27f
        val steps = 5
        for (i in steps downTo 1) {
            val k = i / steps.toFloat()
            val grow = spread * k
            drawRoundRect(
                glowColor.copy(alpha = glowColor.alpha * glowAlpha * (1f - k) * 0.55f),
                topLeft = Offset(-grow, -grow),
                size = Size(w + grow * 2, h + grow * 2),
                cornerRadius = CornerRadius(r + grow),
            )
        }
    }
    // The lip (the tile's 3D thickness).
    drawRoundRect(look.edge, cornerRadius = CornerRadius(r))
    // The face, a lip's height up from the bottom.
    val faceH = h * (1f - TILE_LIP)
    drawRoundRect(
        Brush.verticalGradient(0f to look.faceTop, 0.7f to look.faceMid, 1f to look.faceBottom, endY = faceH),
        size = Size(w, faceH),
        cornerRadius = CornerRadius(r),
    )
    if (look.ring != null && look.ringFrac > 0f) {
        val sw = (s * look.ringFrac).coerceAtLeast(0.75f)
        drawRoundRect(
            look.ring,
            topLeft = Offset(sw / 2, sw / 2),
            size = Size(w - sw, faceH - sw),
            cornerRadius = CornerRadius((r - sw / 2).coerceAtLeast(0f)),
            style = Stroke(sw),
        )
    }
    // The gloss: white at [gloss] → 0 over the top 38%, inset 8% from the sides, 6% from the top.
    if (look.gloss > 0f) {
        val gx = w * 0.08f
        val gy = h * 0.06f
        val gh = h * 0.38f
        drawRoundRect(
            Brush.verticalGradient(listOf(Color.White.copy(alpha = look.gloss), Color.White.copy(alpha = 0f)), startY = gy, endY = gy + gh),
            topLeft = Offset(gx, gy),
            size = Size(w - gx * 2, gh),
            cornerRadius = CornerRadius(s * 0.18f),
        )
    }
}

/**
 * B1 a static game tile carrying [glyph] (a letter or a digit 0–9) in [face]: the
 * number games and any board that owns its own motion use this; word boards use
 * [TileView]. [glyphSize] in dp (null = 56% of the tile).
 */
@Composable
fun GameTileFace(
    glyph: String,
    face: TileFace,
    modifier: Modifier = Modifier,
    square: Boolean = true,
    glyphSize: Float? = null,
    glyphColor: Color? = null,
) {
    val look = TileLooks.of(face, WTheme.colorblind, WTheme.isDark)
    BoxWithConstraints(
        modifier.then(if (square) Modifier.aspectRatio(1f) else Modifier.fillMaxSize()).drawBehind { drawGameTile(look) },
        contentAlignment = Alignment.Center,
    ) {
        val s = minOf(maxWidth, maxHeight)
        TileGlyph(glyph, glyphColor ?: look.glyph, look.glyphShadow, glyphSize ?: (s.value * 0.56f), s.value)
    }
}

/** The tile's glyph: Nunito Black, centered on the FACE (above the lip), with its soft drop shadow. */
@Composable
internal fun TileGlyph(
    text: String, color: Color, shadow: Color, sizeDp: Float, tileDp: Float, modifier: Modifier = Modifier,
    /** AU4: a draw-phase color (a flip's face swap never recomposes the glyph). */
    colorProducer: (() -> Color)? = null,
) {
    val density = androidx.compose.ui.platform.LocalDensity.current
    val fontSp = with(density) { sizeDp.coerceAtLeast(4f).dp.toSp() }
    val px = density.density
    Box(modifier.fillMaxSize().padding(bottom = (tileDp * TILE_LIP).dp), contentAlignment = Alignment.Center) {
        val style = LocalTextStyle.current.copy(
            color = color,
            fontSize = fontSp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            letterSpacing = 0.sp,
            lineHeight = fontSp,
            platformStyle = PlatformTextStyle(includeFontPadding = false),
            lineHeightStyle = LineHeightStyle(alignment = LineHeightStyle.Alignment.Center, trim = LineHeightStyle.Trim.Both),
            shadow = if (shadow.alpha > 0f) Shadow(shadow, Offset(0f, tileDp * 0.03f * px), tileDp * 0.02f * px) else null,
        )
        androidx.compose.foundation.text.BasicText(
            text = text, style = style, maxLines = 1, softWrap = false,
            color = colorProducer?.let { p -> androidx.compose.ui.graphics.ColorProducer { p() } },
        )
    }
}

/**
 * FINISH_SPEC B6 / A8 a finished game's result action (the More Games result cards):
 * no "Home" text link (the house in the controls row goes home), Share = the 3D share
 * icon, and every other action a glossy candy pill (Play Again pink with the play
 * mark, Keep going the quiet peach).
 */
@Composable
internal fun GameResultAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    @Suppress("UNUSED_PARAMETER") color: Color,
    onClick: () -> Unit,
) {
    when {
        icon == Icons.Filled.Home -> Unit
        icon == Icons.Filled.Share ->
            com.wordocious.app.ui.SoftControl(com.wordocious.app.ui.Icon3DName.SHARE, label, onClick = onClick, iconSize = 30.dp)
        icon == Icons.Filled.Refresh -> com.wordocious.app.ui.CandyButton(
            label, onClick = onClick, color = com.wordocious.app.ui.CandyColor.PINK,
            size = com.wordocious.app.ui.CandySize.SMALL, icon = com.wordocious.app.ui.CandyIcon.PLAY,
        )
        else -> com.wordocious.app.ui.CandyButton(
            label, onClick = onClick, color = com.wordocious.app.ui.CandyColor.PEACH, size = com.wordocious.app.ui.CandySize.SMALL,
        )
    }
}
