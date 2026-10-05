package com.wordocious.app.ui.game

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.theme.WTheme

// FINISH_SPEC L (founder 10-02: "make sure the boards themselves match the same
// polish"): every board container is ONE shared game tray drawn in code — rounded
// 20–22, a soft wash of the game's accent (never plain white), a 1.5 accent border
// (30%), a 4 dp darker lip at the bottom, a faint inner top gloss, a soft accent drop
// shadow and 10–12 inner padding. Solved boards take a gentle purple (won) or slate
// (lost) wash; the active / zoomed mini board a stronger tint + ring. No black grid
// lines anywhere — boards separate cells with gaps or soft seams in the tray color.
// Mirrors the web and iOS GameTray.

/** L a tray's state: playing (the game's accent), solved (purple), failed (slate), or the active mini board. */
enum class TrayState { PLAYING, WON, LOST, ACTIVE }

/** L the tray's numbers (pure, unit-tested). */
object GameTrayStyle {
    val CORNER: Dp = 21.dp
    val LIP: Dp = 4.dp
    val BORDER: Dp = 1.5.dp
    val PADDING: Dp = 11.dp
    /** Accent wash over white. */
    const val WASH = 0.11f
    /** The active / zoomed mini board's stronger tint. */
    const val WASH_ACTIVE = 0.2f
    /** The border: 30% accent over white. */
    const val LINE = 0.30f
    /** The lip: the accent darkened over its line color. */
    const val LIP_DARKEN = 0.18f
    val WON = Color(0xFF7C3AED)
    val LOST = Color(0xFF6B7891)

    /** The tint color the tray uses for [state] given the game [accent]. */
    fun tint(accent: Color, state: TrayState): Color = when (state) {
        TrayState.WON -> WON
        TrayState.LOST -> LOST
        else -> accent.copy(alpha = 1f)
    }

    /** [tint] at [amount] over white, opaque (ARGB). */
    fun washArgb(tint: Color, amount: Float): Int = TintMath.over(tint.copy(alpha = 1f).toArgb(), amount, 0xFFFFFFFF.toInt())

    /** The soft seam color between Sudoku boxes / regions: the tray's line, a touch deeper. */
    fun seam(accent: Color): Color = Color(washArgb(accent, 0.42f))
}

/**
 * L the shared game tray as a modifier: the soft accent shadow, the lip, the washed
 * face, its gloss and border, then [padding] inside. Put it on the board's container
 * (the tiles sit inside). Dark mode: a deep translucent face with the accent line.
 */
fun Modifier.gameTray(
    accent: Color,
    state: TrayState = TrayState.PLAYING,
    corner: Dp = GameTrayStyle.CORNER,
    padding: PaddingValues = PaddingValues(GameTrayStyle.PADDING),
    shadow: Boolean = true,
): Modifier = composed {
    val dark = WTheme.isDark
    val tint = GameTrayStyle.tint(accent, state)
    val wash = if (state == TrayState.ACTIVE) GameTrayStyle.WASH_ACTIVE else GameTrayStyle.WASH
    // Season surfaces: the season's translucent card with a faint accent; no lip under it.
    val season = WTheme.season?.takeIf { it.cardFill != null }
    val face = if (season != null) season.wash(tint, wash * 0.6f).copy(alpha = season.cardOpacity)
        else if (dark) Color(0xFF241A38).copy(alpha = 0.92f) else Color(GameTrayStyle.washArgb(tint, wash))
    val line = if (dark) tint.copy(alpha = 0.45f) else Color(GameTrayStyle.washArgb(tint, GameTrayStyle.LINE))
    val lip = if (dark) Color(0xFF120D1F) else Color(TintMath.over(0xFF000000.toInt(), GameTrayStyle.LIP_DARKEN, line.toArgb()))
    val ring = state == TrayState.ACTIVE
    val shape = RoundedCornerShape(corner)
    this
        .then(
            if (shadow) Modifier.shadow(8.dp, shape, clip = false, ambientColor = tint.copy(alpha = 0.18f), spotColor = tint.copy(alpha = 0.28f))
            else Modifier,
        )
        .drawBehind {
            val r = CornerRadius(corner.toPx())
            val lipPx = GameTrayStyle.LIP.toPx()
            // The lip: the whole tray in the darker tone, the face sits a lip above it.
            if (season == null) drawRoundRect(lip, cornerRadius = r)
            val faceH = size.height - lipPx
            drawRoundRect(face, size = Size(size.width, faceH), cornerRadius = r)
            // A faint inner top gloss.
            val gx = size.width * 0.05f
            drawRoundRect(
                Brush.verticalGradient(
                    listOf(Color.White.copy(alpha = if (dark) 0.06f else 0.45f), Color.White.copy(alpha = 0f)),
                    startY = 0f, endY = faceH * 0.22f,
                ),
                topLeft = Offset(gx, 2f), size = Size(size.width - gx * 2, faceH * 0.2f),
                cornerRadius = CornerRadius(corner.toPx() * 0.8f),
            )
            val bw = GameTrayStyle.BORDER.toPx() * (if (ring) 1.6f else 1f)
            drawRoundRect(
                if (ring) tint else line,
                topLeft = Offset(bw / 2, bw / 2), size = Size(size.width - bw, faceH - bw),
                cornerRadius = CornerRadius((corner.toPx() - bw / 2).coerceAtLeast(0f)), style = Stroke(bw),
            )
        }
        .padding(bottom = GameTrayStyle.LIP)
        .padding(padding)
}

/** L the tray as a container composable. */
@Composable
fun GameTray(
    accent: Color,
    modifier: Modifier = Modifier,
    state: TrayState = TrayState.PLAYING,
    corner: Dp = GameTrayStyle.CORNER,
    padding: PaddingValues = PaddingValues(GameTrayStyle.PADDING),
    contentAlignment: Alignment = Alignment.Center,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(modifier.gameTray(accent, state, corner, padding), contentAlignment = contentAlignment, content = content)
}
