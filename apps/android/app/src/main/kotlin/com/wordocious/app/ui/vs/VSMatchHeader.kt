package com.wordocious.app.ui.vs

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.min

/**
 * Persistent in-match VS header — Android port of web vs-match-header.tsx.
 * You on the left, opponent on the right, a tug-of-war bar in the middle that
 * fills toward whoever is ahead (purple = you, pink = them), a crown on the
 * leader, and a "typing…" pulse while opponent pings arrive.
 */
data class HeaderPlayer(
    val username: String,
    val avatarUrl: String?,
    val guesses: Int,
    /** Normalized 0..1 lead metric — see [computeVsProgress]. */
    val progress: Float,
)

/**
 * Tug-of-war lead metric: boards solved dominate (weight 0.7); best-row
 * greens add the within-board signal (weight 0.3) — web computeVsProgress.
 */
fun computeVsProgress(boardsSolved: Int, totalBoards: Int, bestGreens: Int, wordLen: Int): Float =
    min(
        1f,
        (boardsSolved.toFloat() / max(1, totalBoards)) * 0.7f +
            (bestGreens.toFloat() / max(1, wordLen)) * 0.3f,
    )

/** Max count of CORRECT tiles in any single row across all boards (opponent tiles). */
fun bestRowGreens(tiles: Map<Int, List<List<TileState>>>): Int {
    var best = 0
    for (rows in tiles.values) for (row in rows) {
        val greens = row.count { it == TileState.CORRECT }
        if (greens > best) best = greens
    }
    return best
}

/**
 * Max greens in any of MY rows, evaluated locally from each board's solution.
 * ProperNoundle has no local solution until match end — greens stay 0 (web parity).
 */
fun myBestRowGreens(boards: List<BoardState>, mode: GameMode): Int {
    if (mode == GameMode.PROPERNOUNDLE) return 0
    var best = 0
    for (board in boards) {
        for (guess in board.guesses) {
            val greens = runCatching {
                evaluateGuess(board.solution, guess).tiles.count { it.state == TileState.CORRECT }
            }.getOrDefault(0)
            if (greens > best) best = greens
        }
    }
    return best
}

@Composable
fun VsMatchHeader(me: HeaderPlayer, opponent: HeaderPlayer, opponentTyping: Boolean, modifier: Modifier = Modifier) {
    // Boundary position: 50% when even; shifts by half the progress delta,
    // clamped so neither color ever fully disappears (web: [0.1, 0.9]).
    val myShare = (0.5f + (me.progress - opponent.progress) / 2f).coerceIn(0.1f, 0.9f)
    val iLead = me.progress > opponent.progress + 0.001f
    val theyLead = opponent.progress > me.progress + 0.001f
    val dur = if (WTheme.reducedMotion) 0 else 500
    val animatedShare by animateFloatAsState(myShare, tween(dur), label = "tugOfWar")

    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // You
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                VsAvatar(me.username, me.avatarUrl, size = 28.dp, borderColor = WTheme.border)
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(me.username, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (iLead) CrownIcon()
                    }
                    Text(guessLine(me.guesses), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
            }
            // Opponent (mirrored)
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)) {
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (theyLead) CrownIcon()
                        Text(opponent.username, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(guessLine(opponent.guesses), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                }
                VsAvatar(opponent.username, opponent.avatarUrl, size = 28.dp, borderColor = WTheme.border)
            }
        }

        // Tug-of-war bar — you purple, them pink (outer clip rounds both ends).
        Row(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(WTheme.border)) {
            Box(
                Modifier.fillMaxWidth(animatedShare).fillMaxHeight()
                    .background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED)))),
            )
            Box(
                Modifier.weight(1f).fillMaxHeight()
                    .background(Brush.horizontalGradient(listOf(Color(0xFFEC4899), Color(0xFFF472B6)))),
            )
        }

        // Typing indicator — visible while opponent pings arrive.
        if (opponentTyping) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End),
            ) {
                Text("${opponent.username} is typing", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEC4899))
                TypingDots()
            }
        }
    }
}

private fun guessLine(n: Int) = "$n ${if (n == 1) "guess" else "guesses"}"

@Composable
private fun CrownIcon() {
    Icon(
        painterResource(R.drawable.ic_crown), null,
        tint = Color(0xFFF59E0B), modifier = Modifier.size(12.dp),
    )
}

/** Three pulsing dots (staggered 0.2s) — web animate-pulse parity. */
@Composable
fun TypingDots(dotSize: androidx.compose.ui.unit.Dp = 4.dp, color: Color = Color(0xFFEC4899)) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(3) { i ->
            var on by remember { mutableStateOf(true) }
            LaunchedEffect(Unit) {
                delay(i * 200L)
                while (true) { on = !on; delay(500) }
            }
            val alpha by animateFloatAsState(if (on) 1f else 0.3f, tween(if (WTheme.reducedMotion) 0 else 450), label = "typingDot$i")
            Box(Modifier.size(dotSize).graphicsLayer { this.alpha = alpha }.clip(CircleShape).background(color))
        }
    }
}

/** Moment callout pill — purple→pink gradient toast (web vs-game callout). */
@Composable
fun VsCalloutPill(text: String) {
    Text(
        text, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color.White,
        modifier = Modifier.clip(RoundedCornerShape(50))
            .background(Brush.horizontalGradient(listOf(Color(0xFF9333EA), Color(0xFFDB2777))))
            .padding(horizontal = 16.dp, vertical = 8.dp),
    )
}
