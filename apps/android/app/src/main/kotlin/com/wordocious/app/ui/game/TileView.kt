package com.wordocious.app.ui.game

import androidx.compose.animation.core.animateFloatAsState
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
    isInvalid: Boolean = false,
    cornerRadius: Dp = 4.dp,
    fontSize: Float = 20f,
    modifier: Modifier = Modifier,
) {
    // Orthographic scaleY squash: start at 0 → 1 after flipDelay ms (web: 80ms stagger/tile)
    var flipped by remember(flipDelay) { mutableStateOf(flipDelay == null) }
    LaunchedEffect(flipDelay) {
        if (flipDelay != null) {
            delay(flipDelay.toLong())
            flipped = true
        }
    }
    val scale by animateFloatAsState(
        targetValue = if (flipped) 1f else 0f,
        animationSpec = tween(durationMillis = if (flipDelay != null) 160 else 0),
        label = "tileFlip",
    )

    val filled = state != TileState.EMPTY
    val bgColor = when {
        isInvalid -> Color(0xFFFEE2E2)
        filled -> WTheme.tileColor(state)
        else -> Color.Transparent
    }
    val borderColor = when {
        isInvalid -> Color(0xFFDC2626)
        filled -> bgColor
        else -> WTheme.emptyBorder
    }
    val textColor = when {
        isInvalid -> Color(0xFFDC2626)
        filled -> Color.White
        else -> WTheme.text
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .graphicsLayer { scaleY = if (flipDelay != null) scale else 1f }
            .clip(RoundedCornerShape(cornerRadius))
            .background(bgColor)
            .then(if (!filled && !isInvalid) Modifier.border(2.dp, borderColor, RoundedCornerShape(cornerRadius)) else Modifier),
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
