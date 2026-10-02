package com.wordocious.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * ONE game-tile style everywhere (founder 2026-10-01, docs/GAME_TILE_STYLE.md).
 * The reference is the home mode card in its completed state ([ModeCardView],
 * web components/home/mode-card.tsx): accent `0f` wash, 1.5 dp accent `66`
 * border, radius 14, a 4 dp accent → accent `88` top bar clipped to the top
 * corners, a 32 dp radius-8 icon chip in accent `15` with the icon in the accent,
 * and the 0.96 press scale.
 *
 * [GameTileCard] is the card variant (Friends PLAY WITH FRIENDS); [GameTileSquare]
 * is the 1 : 1 selector variant (Leaderboard / Records mode grid, Stats rail,
 * quick-play sheet, VS mode strip, profile pickers). Selected squares get a 2 dp
 * full-accent border, a soft accent glow, an accent `~12%` wash and an accent label.
 * Alphas are layered over [surface], so dark mode reads the same over the dark card.
 */
object GameTileStyle {
    const val BG_ALPHA = 0x0F / 255f
    const val BORDER_ALPHA = 0x66 / 255f
    const val BAR_END_ALPHA = 0x88 / 255f
    const val CHIP_ALPHA = 0x15 / 255f
    const val SELECTED_BG_ALPHA = 0.12f
    const val GLOW_ALPHA = 0.4f
    val CORNER = 14.dp
    val BAR = 4.dp
    /** The light-surface title ink (#1a1a2e) for pages that pin a light palette. */
    val INK = Color(0xFF1A1A2E)
}

/** The tile's chrome (wash, top bar, border, shadow / selected glow) on any container. */
fun Modifier.gameTileChrome(
    accent: Color,
    surface: Color,
    selected: Boolean = false,
    corner: Dp = GameTileStyle.CORNER,
): Modifier {
    val shape = RoundedCornerShape(corner)
    return this
        .then(
            if (selected) Modifier.shadow(
                10.dp, shape, clip = false,
                ambientColor = accent.copy(alpha = GameTileStyle.GLOW_ALPHA),
                spotColor = accent.copy(alpha = GameTileStyle.GLOW_ALPHA),
            ) else Modifier.cardShadow(corner),
        )
        .clip(shape)
        .background(surface)
        .background(accent.copy(alpha = if (selected) GameTileStyle.SELECTED_BG_ALPHA else GameTileStyle.BG_ALPHA))
        .drawBehind {
            drawRect(
                Brush.horizontalGradient(listOf(accent, accent.copy(alpha = GameTileStyle.BAR_END_ALPHA))),
                size = Size(size.width, GameTileStyle.BAR.toPx()),
            )
        }
        .border(
            if (selected) 2.dp else 1.5.dp,
            if (selected) accent else accent.copy(alpha = GameTileStyle.BORDER_ALPHA),
            shape,
        )
}

/** Rippleless tap (+ optional hold) with the home card's 0.96 press scale (Reduced Motion: none). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Modifier.gameTilePress(onLongClick: (() -> Unit)? = null, onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed && !WTheme.reducedMotion) 0.96f else 1f,
        animationSpec = tween(if (WTheme.reducedMotion) 0 else 120), label = "gameTilePress",
    )
    // A9: the shared squish (was a flat 0.96 scale).
    @Suppress("UNUSED_VARIABLE") val unused = scale
    return this
        .pressSquish(interaction)
        .combinedClickable(interactionSource = interaction, indication = null, onLongClick = onLongClick, onClick = onClick)
}

/** The icon chip: radius = size / 4 (8 at 32), accent `15`; draw the icon in the accent. */
@Composable
fun GameTileChip(accent: Color, size: Dp = 32.dp, content: @Composable BoxScope.() -> Unit) {
    Box(
        Modifier.size(size).clip(RoundedCornerShape(size / 4)).background(accent.copy(alpha = GameTileStyle.CHIP_ALPHA)),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/**
 * Card variant: chip, 13 / 900 title, 10 / 700 sub, 12 dp padding — the home card.
 * [titleMaxLines] 1 shrinks to fit like the home card; more lets long names wrap.
 */
@Composable
fun GameTileCard(
    accent: Color,
    title: String,
    sub: String?,
    modifier: Modifier = Modifier,
    surface: Color = WTheme.surface,
    titleColor: Color = WTheme.text,
    subColor: Color = WTheme.textMuted,
    titleMaxLines: Int = 1,
    subMaxLines: Int = 2,
    onClick: () -> Unit,
    icon: @Composable BoxScope.() -> Unit,
) {
    CappedFontScale {
        Column(modifier.gameTilePress(onClick = onClick).gameTileChrome(accent, surface).padding(12.dp)) {
            GameTileChip(accent, 32.dp, icon)
            Spacer(Modifier.height(8.dp))
            if (titleMaxLines <= 1) {
                FitText(title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = titleColor)
            } else {
                Text(
                    title, fontSize = 13.sp, lineHeight = 15.sp, fontWeight = FontWeight.Black, color = titleColor,
                    maxLines = titleMaxLines, overflow = TextOverflow.Ellipsis,
                )
            }
            if (sub != null) {
                Text(
                    sub, fontSize = 10.sp, lineHeight = 13.sp, fontWeight = FontWeight.Bold, color = subColor,
                    maxLines = subMaxLines, overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * Square (1 : 1) selector variant: the chip centered over a one-line short label.
 * Size it with [modifier] (a weight in a row grid, or a fixed width / size in a
 * scrolling strip). The chip is [chipSize] at most and shrinks with narrow tiles;
 * the label is up to two centered lines; [label] null drops the label for strips too small to hold one. [overlay] draws
 * on top (e.g. the Stats rail's W/L dot).
 */
@Composable
fun GameTileSquare(
    accent: Color,
    label: String?,
    selected: Boolean,
    modifier: Modifier = Modifier,
    surface: Color = WTheme.surface,
    labelColor: Color = WTheme.textMuted,
    chipSize: Dp = 32.dp,
    corner: Dp = GameTileStyle.CORNER,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
    overlay: @Composable BoxScope.() -> Unit = {},
    icon: @Composable BoxScope.(chip: Dp) -> Unit,
) {
    CappedFontScale {
        BoxWithConstraints(
            modifier.aspectRatio(1f)
                .gameTilePress(onLongClick = onLongClick, onClick = onClick)
                .gameTileChrome(accent, surface, selected, corner),
            contentAlignment = Alignment.Center,
        ) {
            // Half the tile with a label (room for two label lines), more without one.
            val share = if (label != null) 0.5f else 0.7f
            val chip = if (maxWidth.value.isFinite() && maxWidth > 0.dp) min(chipSize, maxWidth * share) else chipSize
            Column(
                Modifier.fillMaxWidth().padding(top = GameTileStyle.BAR / 2).padding(horizontal = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                GameTileChip(accent, chip) { icon(chip) }
                if (label != null) {
                    // Web parity: a long name wraps to two centered lines rather than
                    // ellipsizing ("Rock Paper Scissors"); the 1 : 1 box keeps a grid even.
                    Text(
                        label, fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.ExtraBold,
                        color = if (selected) accent else labelColor,
                        maxLines = 2, overflow = TextOverflow.Clip, textAlign = TextAlign.Center,
                    )
                }
            }
            overlay()
        }
    }
}
