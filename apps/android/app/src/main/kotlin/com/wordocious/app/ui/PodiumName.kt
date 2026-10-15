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
import com.wordocious.app.ui.theme.WTheme
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
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.zIndex
import com.wordocious.app.data.AvatarFields
import com.wordocious.app.data.PlayerAvatars
import com.wordocious.core.PlayerTint
import com.wordocious.core.avatarColorHex
import kotlinx.serialization.json.JsonElement

private fun hex(c: String): Color = Color(android.graphics.Color.parseColor(c))

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
    val palette = remember(cfg.bg, cfg.color, WTheme.isDark) { ThemeKit.accentPalette(hex(PlayerTint.nameHex(cfg.bg, avatarColorHex(cfg.color)))) }
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
    return remember(cfg.bg, cfg.color, WTheme.isDark) { ThemeKit.accentPalette(hex(PlayerTint.nameHex(cfg.bg, avatarColorHex(cfg.color)))) }
}
