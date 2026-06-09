package com.wordocious.app.ui.game

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseIn
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState
import kotlinx.coroutines.delay

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
    fontSize: Float = 20f,
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
    // Spec: invalid = bg #FEF2F2 / border #F87171 / text #EF4444. Empty = WHITE fill
    // + #D1D5DB border (not transparent — was showing the gradient through the tile).
    val bgColor = when {
        isInvalid -> Color(0xFFFEF2F2)
        masked -> Color(0xFFF3F4F6)
        filled && mini && WTheme.colorblind && state == TileState.CORRECT -> Color(0xFF0891B2)
        filled && mini && WTheme.colorblind && state == TileState.PRESENT -> Color(0xFFF97316)
        filled -> WTheme.tileColor(state)
        else -> Color.White
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

    Box(
        modifier = modifier
            .then(if (square) Modifier.aspectRatio(1f) else Modifier.fillMaxSize())
            .graphicsLayer {
                rotationX = rotation.value
                cameraDistance = 12f * density
            }
            .clip(RoundedCornerShape(cornerRadius))
            .background(bgColor)
            .then(if (showBorder) Modifier.border(2.dp, borderColor, RoundedCornerShape(cornerRadius)) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = letter.uppercase(),
            color = textColor,
            fontSize = fontSize.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
    }
}
