package com.wordocious.app.ui.game

import androidx.compose.animation.core.LinearEasing
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.Text
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import kotlin.random.Random

/**
 * Victory / game-over celebration overlay (spec line 150). Shown for a game that
 * finished LIVE this session, before the post-game stats screen. Dim backdrop +
 * confetti, a card with the 6pt accent bar, big VICTORY!/GAME OVER title, the
 * solution (single) or board count (multi), stat blocks, tap-to-continue.
 */
@Composable
fun VictoryOverlay(
    state: GameState,
    mode: GameMode,
    elapsedSeconds: Int,
    onContinue: () -> Unit,
) {
    val won = state.status == GameStatus.WON
    val board = state.boards[0]
    val multi = state.boards.size > 1
    val boardsSolved = state.boards.count { it.status == GameStatus.WON }

    // Web parity: victory-animation plays the success jingle on mount,
    // game-over-animation the descending jingle (gauntlet losses never mount
    // this overlay, so they stay silent — matches web/iOS).
    LaunchedEffect(Unit) {
        if (won) com.wordocious.app.data.SoundManager.playSuccess()
        else com.wordocious.app.data.SoundManager.playGameOver()
    }

    // Spring-in scale of the card
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    // Web fade-in-scale: 0.8 → 1.0 over 300ms ease-out; snap under reduced motion.
    val dur = if (WTheme.reducedMotion) 0 else 300
    val scale by animateFloatAsState(if (shown) 1f else 0.8f, tween(dur, easing = EaseOut), label = "victoryScale")
    val alpha by animateFloatAsState(if (shown) 1f else 0f, tween(dur, easing = EaseOut), label = "victoryAlpha")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF18182E).copy(alpha = 0.6f))
            .clickableNoRipple(onContinue),
        contentAlignment = Alignment.Center,
    ) {
        if (won && !WTheme.reducedMotion) ConfettiView()

        Column(
            modifier = Modifier
                .widthIn(max = 380.dp)
                .padding(24.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale; this.alpha = alpha }
                .clip(RoundedCornerShape(16.dp))
                .background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // 6pt accent bar
            Box(
                Modifier.fillMaxWidth().height(6.dp)
                    .background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))),
            )
            Column(
                Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (won) {
                    Text(
                        "VICTORY!",
                        fontSize = 36.sp, fontWeight = FontWeight.Black,
                        style = TextStyle(brush = Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24)))),
                    )
                } else {
                    Text("GAME OVER", fontSize = 36.sp, fontWeight = FontWeight.Black, color = Color(0xFFF87171))
                }
                Spacer(Modifier.height(8.dp))
                if (!multi) {
                    Text(board.solution.uppercase(), fontSize = 22.sp, fontWeight = FontWeight.Black,
                        color = if (won) WTheme.winText else WTheme.lossText)
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (multi) StatBlock("Boards", "$boardsSolved/${state.boards.size}")
                    StatBlock("Guesses", "${board.guesses.size}")
                    StatBlock("Time", fmtVTime(elapsedSeconds))
                }
                Spacer(Modifier.height(16.dp))
                Text("Tap anywhere to continue", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC4B5FD))
            }
        }
    }
}

@Composable
private fun StatBlock(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
    }
}

/** Confetti — web effects/confetti.tsx parity: 50 pieces, 12×12 rounded squares,
 *  8-color palette, 0–0.5s random delay, 2–4s LINEAR full-height fall, 720° spin,
 *  fading to 0 at the end. */
@Composable
private fun ConfettiView() {
    val colors = listOf(
        Color(0xFFFFD700), Color(0xFFFF6B9D), Color(0xFFC084FC), Color(0xFF60A5FA),
        Color(0xFF34D399), Color(0xFFFBBF24), Color(0xFFF97316), Color(0xFFEC4899),
    )
    // Stable per-piece params (seeded once)
    val pieces = remember {
        List(50) {
            ConfettiPiece(
                xFrac = Random.nextFloat(),
                color = colors[Random.nextInt(colors.size)],
                delayMs = Random.nextInt(0, 500),
                durationMs = Random.nextInt(2000, 4000),
            )
        }
    }
    Box(Modifier.fillMaxSize()) {
        pieces.forEach { p -> ConfettiRect(p) }
    }
}

private data class ConfettiPiece(val xFrac: Float, val color: Color, val delayMs: Int, val durationMs: Int)

@Composable
private fun ConfettiRect(p: ConfettiPiece) {
    var go by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { go = true }
    val progress by animateFloatAsState(
        targetValue = if (go) 1f else 0f,
        animationSpec = tween(durationMillis = p.durationMs, delayMillis = p.delayMs, easing = LinearEasing),
        label = "confetti",
    )
    val rot = progress * 720f
    val fade = (1f - progress).coerceIn(0f, 1f)
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val fall = maxHeight * progress
        Box(
            Modifier
                .padding(start = (p.xFrac * 360).dp)
                .offset(y = fall - 20.dp)
                .rotate(rot)
                .size(12.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(p.color.copy(alpha = fade)),
        )
    }
}

private fun fmtVTime(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)
