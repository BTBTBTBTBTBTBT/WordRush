package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.wordocious.app.data.AvatarFields
import com.wordocious.app.data.PlayerAvatars
import com.wordocious.core.PlayerTint
import com.wordocious.core.avatarColorHex
import kotlinx.serialization.json.JsonElement

/** The three inks of a podium plaque, picked for contrast against its fill (founder 10-09). */
class PlaqueInk(val lightInk: Boolean) {
    val heading: Color = if (lightInk) Color.White else Color(0xFF2A1650)
    val muted: Color = if (lightInk) Color.White.copy(alpha = 0.82f) else Color(0xFF5B4B7A)
    /** The gold highlight (FLAWLESS / streak): bright gold on dark, deep amber on light. */
    val badge: Color = if (lightInk) Color(0xFFF5B82E) else Color(0xFFB45309)
    /**
     * The bubble lettering on the plate (founder 10-09): purple letters + numbers with a white outline on a pale plate; white
     * letters + gold numbers (dark outline) on a dark one. Mirrors iOS PlayerTint.platePalette.
     */
    val palette: HeadlinePalette = if (lightInk) {
        HeadlinePalette(
            top = Color.White, bottom = Color(0xFFEDE9FE), deep = Color(0xFF3B0764), nameTop = Color.White, nameBottom = Color(0xFFEDE9FE),
            outline = Color(0xFF4C1D95), numberTop = Color(0xFFFFE07A), numberBottom = Color(0xFFF5A524), rim = Color(0xFF4C1D95),
        )
    } else {
        HeadlinePalette(
            top = Color(0xFFA855F7), bottom = Color(0xFF6D28D9), deep = Color(0xFF3B0764), nameTop = Color(0xFFA855F7), nameBottom = Color(0xFF6D28D9),
            outline = Color.White, numberTop = Color(0xFFA855F7), numberBottom = Color(0xFF6D28D9), rim = Color.White,
        )
    }
}

private fun hex(c: String): Color = Color(android.graphics.Color.parseColor(c))

private fun List<String>.fillBrush(diagonal: Boolean): Brush {
    val colors = map(::hex).let { if (it.size > 1) it else listOf(it[0], it[0]) }
    return if (diagonal) Brush.linearGradient(colors) else Brush.verticalGradient(colors)
}

/**
 * Founder 10-09: the name / points / badge / detail plaque under a podium player wears THEIR mascot-maker backdrop
 * (the fill, a top-left to bottom-right gradient) and frame (the border), 12 dp radius and a soft shadow; the ink follows
 * the fill's brightness so the stats read on any backdrop. Colors come from core PlayerTint (pinned to TS and Swift by
 * player-tint-fixtures.json), the config from the same resolver the avatar uses.
 */
@Composable
fun PodiumPlaque(
    userId: String?,
    username: String?,
    avatarUrl: String? = null,
    config: JsonElement? = null,
    castId: String? = null,
    frame: String? = null,
    accentHex: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.(PlaqueInk) -> Unit,
) {
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex)
    }
    // Reads snapshot state (the directory + the own profile patch), like the avatar above it: recomposes on a lookup / an edit.
    val cfg = PlayerAvatars.resolve(row).config
    if (row.isPartial) {
        LaunchedEffect(userId, username) {
            if (PlayerAvatars.known(userId, username)?.complete != true) PlayerAvatars.requestLookup(userId, username)
        }
    }
    val plate = remember(cfg.bg, cfg.frame, cfg.color) { PlayerTint.plateHexes(cfg.bg, cfg.frame, avatarColorHex(cfg.color)) }
    val ink = remember(plate.lightInk) { PlaqueInk(plate.lightInk) }
    val shape = RoundedCornerShape(12.dp)
    val border = if (plate.border.size > 1) plate.border.fillBrush(diagonal = false) else SolidColor(hex(plate.border[0]))
    Column(
        modifier.zIndex(2f)
            .shadow(3.dp, shape, clip = false, ambientColor = Color.Black.copy(alpha = 0.18f), spotColor = Color.Black.copy(alpha = 0.18f))
            .background(plate.fill.fillBrush(diagonal = true), shape)
            .border(plate.borderWidth.dp, border, shape)
            .padding(PaddingValues(horizontal = 10.dp, vertical = 4.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { content(ink) }
}


/**
 * Founder 10-09: the player's NAME rides ABOVE their head in the bubble lettering, one line that shrinks to fit (never wraps or
 * clips; floor 0.3), in their own name color (core PlayerTint.nameHex), with a soft glow behind it in their SECONDARY color
 * (their avatar pattern color): two blurred capsules (outer 55% blur 12, inner 90% blur 6). The slot is 10 dp wider than its
 * column on each side and [pull] dp of its height overlaps the figure below, so the name sits close to the head (iOS pulls
 * standing figures 18 dp, the winner only 4 dp so the name stays above the crown). Draw it above the figure (zIndex 2).
 */
@Composable
fun PodiumNameAbove(
    name: String,
    userId: String?,
    username: String?,
    size: Float,
    pull: Dp,
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
    config: JsonElement? = null,
    castId: String? = null,
    frame: String? = null,
    accentHex: String? = null,
) {
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex)
    }
    val cfg = PlayerAvatars.resolve(row).config
    val palette = remember(cfg.bg, cfg.color) { ThemeKit.accentPalette(hex(PlayerTint.nameHex(cfg.bg, avatarColorHex(cfg.color)))) }
    val glow = remember(cfg.patternColor) { hex(avatarColorHex(cfg.patternColor)) }
    val bleed = 10.dp
    Box(
        modifier.zIndex(2f)
            .layout { measurable, c ->
                val extra = (bleed * 2).roundToPx()
                val w = if (c.hasBoundedWidth) c.maxWidth else 0
                val p = measurable.measure(Constraints.fixed(w + extra, (size * 1.3f).dp.roundToPx()))
                val h = (p.height - pull.roundToPx()).coerceAtLeast(0)
                layout(w, h) { p.place(-extra / 2, 0) }
            },
    ) {
        Box(
            Modifier.fillMaxSize().drawBehind {
                val outer = Rect(-2.dp.toPx(), -6.dp.toPx(), this.size.width + 2.dp.toPx(), this.size.height + 6.dp.toPx())
                val inner = Rect(10.dp.toPx(), 1.dp.toPx(), this.size.width - 10.dp.toPx(), this.size.height - 1.dp.toPx())
                drawIntoCanvas { canvas ->
                    fun capsule(r: Rect, alpha: Float, sigma: Float) {
                        if (r.width <= 0f || r.height <= 0f) return
                        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                            color = glow.copy(alpha = alpha).toArgb()
                            maskFilter = android.graphics.BlurMaskFilter(sigma.dp.toPx() * 1.7f, android.graphics.BlurMaskFilter.Blur.NORMAL)
                        }
                        val rad = r.height / 2f
                        canvas.nativeCanvas.drawRoundRect(r.left, r.top, r.right, r.bottom, rad, rad, paint)
                    }
                    capsule(outer, 0.55f, 12f)
                    capsule(inner, 0.9f, 6f)
                }
            },
            contentAlignment = Alignment.Center,
        ) {
            BubbleOneLine(name.uppercase(), palette, size)
        }
    }
}

/**
 * Founder 10-09: a player's NAME palette for the bubble lettering (their vivid backdrop color, core PlayerTint.nameHex), resolved
 * from the same avatar directory as their figure. Stats' player card and Head to Head wear it.
 */
@Composable
fun rememberPlayerNamePalette(
    userId: String?, username: String?,
    avatarUrl: String? = null, config: JsonElement? = null, castId: String? = null, frame: String? = null, accentHex: String? = null,
): HeadlinePalette {
    val row = remember(userId, username, avatarUrl, config, castId, frame, accentHex) {
        AvatarFields(userId, username, avatarUrl, config, castId, frame, accentHex)
    }
    val cfg = PlayerAvatars.resolve(row).config
    return remember(cfg.bg, cfg.color) { ThemeKit.accentPalette(hex(PlayerTint.nameHex(cfg.bg, avatarColorHex(cfg.color)))) }
}
