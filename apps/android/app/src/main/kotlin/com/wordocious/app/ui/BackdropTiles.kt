package com.wordocious.app.ui

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * FINISH_SPEC BJ8 (founder 10-03: "I don't ever want the backgrounds to be a distraction"):
 * the floating 3D letter tiles are no longer baked into the wallpapers
 * (docs/design/brand/walls/calm-walls.py made calm bases). The few that remain come from
 * THIS one config — tune counts, sizes and opacities here only. iOS: BackdropTiles.swift,
 * web: lib/backdrop-tiles.ts (same numbers).
 *
 * Games: 4 tiny, faint tiles (0.2) in the side gutters between the header and the
 * keyboard, never behind the board or keys. Pages: 6 small tiles (0.35) in the 16-dp
 * gutters beside the cards and the cast row. Static, desaturated toward the page tint,
 * drawn in the background's own draw pass (cached with it; no blur, no motion).
 */
object BackdropTiles {
    /** [leading]: which side gutter; [inset]: center offset from that edge (dp); [y]: share of the window height. */
    data class Tile(
        val leading: Boolean, val inset: Float, val y: Float, val size: Float,
        val rotation: Float, val letter: String, val color: Long,
    )

    data class Look(val tiles: List<Tile>, val opacity: Float, val saturation: Float, val tintMix: Float)

    /** Every game screen and finished screen: very subtle, static. */
    val game = Look(
        listOf(
            Tile(true, 7f, 0.24f, 11f, -12f, "W", 0xFFA855F7),
            Tile(false, 7f, 0.33f, 12f, 10f, "O", 0xFFF472B6),
            Tile(true, 6f, 0.47f, 10f, 8f, "R", 0xFF34D399),
            Tile(false, 6f, 0.58f, 10f, -9f, "D", 0xFFFB923C),
        ),
        opacity = 0.2f, saturation = 0.55f, tintMix = 0.35f,
    )

    /** Home, Leaderboard, Stats, Friends and the info pages: calm, static. */
    val page = Look(
        listOf(
            Tile(true, 9f, 0.10f, 14f, -12f, "W", 0xFFA855F7),
            Tile(false, 9f, 0.16f, 13f, 11f, "O", 0xFFF472B6),
            Tile(true, 8f, 0.38f, 12f, 9f, "R", 0xFF34D399),
            Tile(false, 8f, 0.52f, 13f, -10f, "D", 0xFF60A5FA),
            Tile(true, 8f, 0.70f, 12f, -7f, "S", 0xFFFB923C),
            Tile(false, 8f, 0.84f, 12f, 8f, "Y", 0xFFA855F7),
        ),
        opacity = 0.35f, saturation = 0.75f, tintMix = 0.25f,
    )

    private fun desaturate(c: Color, s: Float): Color {
        val l = 0.299f * c.red + 0.587f * c.green + 0.114f * c.blue
        return Color(l + (c.red - l) * s, l + (c.green - l) * s, l + (c.blue - l) * s)
    }

    /**
     * Draw [look]'s tiles in window coordinates: [root] is the window size and [origin]
     * this node's position in it (the background is window-anchored, like the wallpaper).
     */
    fun DrawScope.drawBackdropTiles(look: Look, accent: Color, root: Size, origin: Offset, measurer: TextMeasurer) {
        for (t in look.tiles) {
            val side = t.size * density
            val cx = (if (t.leading) t.inset * density else root.width - t.inset * density) - origin.x
            val cy = root.height * t.y - origin.y
            val face = desaturate(lerp(Color(t.color), accent, look.tintMix), look.saturation)
            val a = look.opacity
            val tl = Offset(cx - side / 2f, cy - side / 2f)
            val r = CornerRadius(side * 0.24f)
            rotate(t.rotation, pivot = Offset(cx, cy)) {
                drawRoundRect(lerp(face, Color.Black, 0.3f), topLeft = tl + Offset(0f, side * 0.08f), size = Size(side, side), cornerRadius = r, alpha = a)
                drawRoundRect(
                    Brush.verticalGradient(listOf(lerp(face, Color.White, 0.3f), face), startY = tl.y, endY = tl.y + side),
                    topLeft = tl, size = Size(side, side), cornerRadius = r, alpha = a,
                )
                val text = measurer.measure(
                    t.letter,
                    TextStyle(color = Color.White, fontSize = (side * 0.58f / density / fontScale).sp, fontWeight = FontWeight.Black),
                )
                drawText(
                    text, alpha = a,
                    topLeft = Offset(cx - text.size.width / 2f, cy - text.size.height / 2f),
                )
            }
        }
    }
}
