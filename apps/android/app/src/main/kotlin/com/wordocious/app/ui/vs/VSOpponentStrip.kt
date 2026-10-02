package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState
import kotlinx.coroutines.delay

/**
 * The in-match opponent strip (VS polish §1, founder 2026-10-01): ONE compact
 * row (56 dp, white card, soft shadow, no border) instead of the old HUD card
 * with a wall of empty grids. Avatar (bot art for bots, the challenger for a
 * race), name, a slim teal progress bar, `N guesses` and a typing dot; on the
 * right a tiny color-only board for single-board modes, `2/4 boards` for
 * multi-board modes, the stage for Gauntlet. Fixed height so nothing below
 * ever jumps when it updates.
 */
@Composable
fun VsOpponentBar(
    name: String,
    avatarUrl: String?,
    opponent: OpponentProgressState,
    /** The STARTING row budget (live maxGuesses can shrink). */
    maxGuesses: Int,
    wordLength: Int,
    typing: Boolean,
    modifier: Modifier = Modifier,
    /** The MODE's board count (opponent.totalBoards is 0 until their first event). */
    totalBoards: Int = 1,
    /** Gauntlet: the opponent's current stage name + accent; null elsewhere. */
    stageName: String? = null,
    stageGradient: List<Color> = emptyList(),
) {
    val liveTotalBoards = maxOf(opponent.totalBoards, totalBoards)
    val multi = liveTotalBoards > 1
    // Boards solved / total; a single board also counts its best row's greens
    // so the bar moves before the solve.
    val fraction = when {
        opponent.solved -> 1f
        multi -> opponent.boardsSolved.toFloat() / liveTotalBoards
        else -> bestRowGreens(opponent.tiles).toFloat() / maxOf(1, wordLength)
    }
    val dur = if (WTheme.reducedMotion) 0 else 400
    val animated by androidx.compose.animation.core.animateFloatAsState(fraction.coerceIn(0f, 1f), androidx.compose.animation.core.tween(dur), label = "oppBar")
    Row(
        modifier.fillMaxWidth().height(56.dp).vsCard(14.dp).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        VsAvatar(name, avatarUrl, size = 36.dp, borderColor = Color.Transparent)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    name, fontSize = 12.5.sp, fontWeight = FontWeight.Black, color = VsTeal.deep,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
                )
                if (opponent.solved) Icon(Icons.Filled.Check, "Solved", tint = VsTeal.ink, modifier = Modifier.size(12.dp))
                // Space is always reserved: the dot fades, the row never shifts.
                Box(Modifier.size(7.dp).graphicsLayer { alpha = if (typing && !opponent.solved) 1f else 0f }) {
                    TypingPulseDot()
                }
            }
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(VsTeal.soft)) {
                Box(Modifier.fillMaxWidth(animated).height(4.dp).clip(RoundedCornerShape(2.dp)).background(VsTeal.ink))
            }
            Text(
                "${opponent.attempts} ${if (opponent.attempts == 1) "guess" else "guesses"}",
                fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.sub, maxLines = 1,
            )
        }
        when {
            stageName != null -> Column(horizontalAlignment = Alignment.End) {
                Text("STAGE ${opponent.stagesCleared + 1}", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = VsTeal.label)
                Text(
                    stageName, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1,
                    color = stageGradient.firstOrNull() ?: VsTeal.deep,
                )
            }
            multi -> Text(
                "${opponent.boardsSolved}/$liveTotalBoards boards",
                fontSize = 12.sp, fontWeight = FontWeight.Black, color = VsTeal.ink, maxLines = 1,
            )
            // A tiny colors-only board — only where it reads (Classic/Six/Seven;
            // a long ProperNoundle name would not fit the row).
            wordLength <= 7 -> {
                val rows = maxOf(maxGuesses, opponent.tiles[0]?.size ?: 0, 1)
                val cell = minOf(6f, (40f - (rows - 1)) / rows).dp
                OpponentMiniBoard(opponent.tiles[0] ?: emptyList(), maxGuesses, wordLength, cell)
            }
        }
    }
}

/** One soft teal dot that breathes while the opponent types. */
@Composable
private fun TypingPulseDot() {
    var on by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { while (true) { delay(500); on = !on } }
    val a by androidx.compose.animation.core.animateFloatAsState(
        if (on || WTheme.reducedMotion) 1f else 0.3f, androidx.compose.animation.core.tween(if (WTheme.reducedMotion) 0 else 450), label = "typingDot",
    )
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = a }.clip(CircleShape).background(VsTeal.ink))
}

/**
 * Colors-only opponent mini board (CORRECT green / PRESENT yellow / ABSENT
 * gray). New rows pop in (fade + scale 0.8→1, 200ms; snap under reduced
 * motion) — web OpponentMiniBoard's animate-fade-in-scale. Shared by the
 * in-match HUD strip (small cells) and the spectator screen (16dp cells).
 */
@Composable
fun OpponentMiniBoard(tiles: List<List<TileState>>, maxGuesses: Int, wordLength: Int, cell: androidx.compose.ui.unit.Dp) {
    val gap = if (cell >= 12.dp) 2.dp else 1.dp
    val radius = maxOf(2.dp, (cell.value * 0.16f).dp)
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        // Always the full frame; tiles.size guards against clipping a filled row
        // if the opponent somehow exceeds the frame budget.
        repeat(maxOf(maxGuesses, tiles.size, 1)) { r ->
            val isNew = r == tiles.size - 1 && tiles.getOrNull(r) != null
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                repeat(maxOf(wordLength, 1)) { c ->
                    val st = tiles.getOrNull(r)?.getOrNull(c)
                    val filled = st != null && st != TileState.EMPTY
                    // Newest row flips in tile-by-tile (staggered 3D reveal) for a
                    // fluid opponent-guess reveal; empty tiles stay static.
                    val flip = androidx.compose.runtime.remember(r, tiles.size, c) {
                        androidx.compose.animation.core.Animatable(if (isNew && filled && !WTheme.reducedMotion) 0f else 1f)
                    }
                    if (isNew && filled && !WTheme.reducedMotion) {
                        LaunchedEffect(r, tiles.size, c) {
                            delay((c * 55).toLong())
                            flip.animateTo(1f, androidx.compose.animation.core.tween(300))
                        }
                    }
                    val color = when (st) {
                        TileState.CORRECT -> Color(0xFF7C3AED)
                        TileState.PRESENT -> Color(0xFFF59E0B)
                        // Theme-driven (iOS Theme.textMuted) so Ocean/Forest tint too.
                        TileState.ABSENT -> WTheme.textMuted
                        else -> Color.Transparent
                    }
                    Box(
                        Modifier.size(cell)
                            .graphicsLayer {
                                val v = flip.value
                                alpha = v
                                val s = 0.5f + 0.5f * v
                                scaleX = s; scaleY = s
                                rotationX = -85f * (1f - v)
                                cameraDistance = 12f * density
                            }
                            .clip(RoundedCornerShape(radius)).background(color)
                            .then(if (st == null || st == TileState.EMPTY) Modifier.border(1.dp, WTheme.border, RoundedCornerShape(radius)) else Modifier),
                    )
                }
            }
        }
    }
}
