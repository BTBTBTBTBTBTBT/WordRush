package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseIn
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState
import kotlinx.coroutines.delay

/** Spoken name for a tile's evaluation (TalkBack). */
fun tileStateName(state: TileState): String = when (state) {
    TileState.CORRECT -> "correct"
    TileState.PRESENT -> "wrong position"
    TileState.ABSENT -> "not in word"
    TileState.HINT_USED -> "revealed by hint"
    else -> ""
}

/**
 * Single tile — matches the web Board's `Tile` component (border-2, tile colors,
 * white text on filled). `flipDelay` drives the orthographic scaleY squash
 * (web's `animate-tile-flip-mini` @ `letterIndex * 80ms`).
 */
@Composable
fun TileView(
    letter: String,
    state: TileState,
    flipDelay: Int? = null,   // ms; null = no animation
    flipDuration: Int = 300,  // web: tile-flip 500ms full board, tile-flip-mini 300ms
    isInvalid: Boolean = false,
    cornerRadius: Dp = 4.dp,
    /** iOS scales the stroke with the tile (0.09 × size, clamped 1–2pt). */
    borderWidth: Dp = 2.dp,
    /**
     * Explicit point size, or null to derive it from the tile the way iOS does
     * (BoardView.swift:72-85 — `min(width, height) * 0.5`). A FIXED size is
     * wrong whenever the tile can shrink: OctoWord squeezes 13 rows into a small
     * card, the cell became shorter than a 10sp glyph, and every letter was
     * clipped in half. Callers that own their geometry still pass a number.
     */
    fontSize: Float? = null,
    // square=true forces a 1:1 tile (single-board). false = fill the cell
    // (multi-board in-play, non-square per spec — prevents overlap).
    square: Boolean = true,
    // Sequence locked-board mask: gray-100 tile, gray-300 border, "•" letter.
    masked: Boolean = false,
    // Mini (multi-board) tile — web's colorblind palette differs: cyan-600/orange-500
    // (multi-board.tsx getTileColor) vs the single-board CSS-override palette.
    mini: Boolean = false,
    modifier: Modifier = Modifier,
) {
    // Web tile-flip: rotateX 0→90→0 over the full duration, fill-mode `both` —
    // the tile sits flat (final color) before its stagger delay, then flips.
    // Under Reduced Motion we snap (no flip) — spec accessibility gating.
    val animateFlip = flipDelay != null && !WTheme.reducedMotion
    val rotation = remember(flipDelay) { Animatable(0f) }
    LaunchedEffect(flipDelay) {
        if (animateFlip) {
            delay(flipDelay!!.toLong())
            rotation.animateTo(90f, tween(flipDuration / 2, easing = EaseIn))
            rotation.animateTo(0f, tween(flipDuration / 2, easing = EaseOut))
        }
    }

    val filled = state != TileState.EMPTY
    // Spec: invalid = bg #FEF2F2 / border #F87171 / text #EF4444.
    //
    // Empty tiles use the THEMED surface, not hard white. They were opaque
    // Color.White, which is right in the three light themes but drew a grid of
    // glaring white blocks over the near-black page in Dark. iOS returns .clear
    // for .empty (Theme.swift:90) and lets the page show through; a flat
    // surface fill is the same result without the gradient bleeding through the
    // tile, which is why white was chosen here originally.
    val bgColor = when {
        isInvalid -> Color(0xFFFEF2F2)
        masked -> Color(0xFFF3F4F6)
        // Orange = CORRECT, blue = PRESENT — matching this app's own keyboard
        // (KeyboardView.quadColor), iOS and web. These two were reversed
        // (cyan=correct, orange=present) against a web behaviour that no longer
        // exists, so in Quad/Octo with colourblind mode ON, orange meant
        // "present" on the board and "correct" on the keys. It actively misled
        // the exact users the feature is for.
        filled && mini && WTheme.colorblind && state == TileState.CORRECT -> Color(0xFFF5793A)
        filled && mini && WTheme.colorblind && state == TileState.PRESENT -> Color(0xFF85C0F9)
        filled -> WTheme.tileColor(state)
        else -> WTheme.surface
    }
    val borderColor = when {
        isInvalid -> Color(0xFFF87171)
        masked -> Color(0xFFD1D5DB)
        // Web HINT_USED: faint ghost tile — border gray-200 (#E5E7EB).
        state == TileState.HINT_USED -> Color(0xFFE5E7EB)
        // Web ABSENT keeps the gray-300 border (board.tsx TILE.border).
        state == TileState.ABSENT -> Color(0xFFD1D5DB)
        filled -> bgColor
        else -> WTheme.emptyBorder
    }
    val textColor = when {
        isInvalid -> Color(0xFFEF4444)
        masked -> WTheme.text
        // Web HINT_USED letter = gray-300, not white-on-gray.
        state == TileState.HINT_USED -> Color(0xFFD1D5DB)
        filled -> Color.White
        else -> WTheme.text
    }
    val showBorder = !filled || state == TileState.HINT_USED || state == TileState.ABSENT || masked

    BoxWithConstraints(
        modifier = modifier
            .then(if (square) Modifier.aspectRatio(1f) else Modifier.fillMaxSize())
            .graphicsLayer {
                rotationX = rotation.value
                cameraDistance = 12f * density
            }
            .clip(RoundedCornerShape(cornerRadius))
            .background(bgColor)
            .then(if (showBorder) Modifier.border(borderWidth, borderColor, RoundedCornerShape(cornerRadius)) else Modifier)
            // TalkBack reads the letter plus its evaluation instead of a bare glyph.
            .then(if (letter.isNotBlank() && !masked) Modifier.semantics {
                contentDescription = if (filled) "$letter, ${tileStateName(state)}" else letter
            } else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        // Half the SHORTER side, matching iOS. Floored so a sliver of a tile
        // still renders something legible rather than nothing.
        // Convert through density instead of reading .value and emitting it as
        // sp. Dp.value is a dp count; handing it to .sp re-multiplies it by the
        // user's fontScale inside a tile whose aspectRatio box did NOT scale, so
        // at 2x text size the glyph doubled and clipped. Ironically Android was
        // the only platform to break here BECAUSE it is the only one that
        // honours font scale at all.
        val density = androidx.compose.ui.platform.LocalDensity.current
        val derivedSp = with(density) { (minOf(maxWidth, maxHeight) * 0.5f).toSp().value }
        val resolved = fontSize ?: derivedSp.coerceAtLeast(6f)
        Text(
            text = letter.uppercase(),
            color = textColor,
            fontSize = resolved.sp,
            maxLines = 1,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
    }
}
