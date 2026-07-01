package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.TileState
import kotlinx.coroutines.delay

/**
 * Compact opponent-progress strip shown above the player's board during a match —
 * ports iOS OpponentStrip / web OpponentMiniBoard. Shows guess count, boards
 * solved (multi), a solved checkmark, and a live colors-only tile preview.
 */
@Composable
fun OpponentStrip(opponent: OpponentProgressState, maxGuesses: Int, wordLength: Int, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Opponent", fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textSecondary)
            Spacer(Modifier.weight(1f))
            if (opponent.stagesCleared > 0) {
                Text("Stage ${opponent.stagesCleared + 1}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            } else if (opponent.totalBoards > 1) {
                Text("${opponent.boardsSolved}/${opponent.totalBoards} boards", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            }
            Text("${opponent.attempts} guesses", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            if (opponent.solved) Text("✓", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF7C3AED))
        }
        // During your own play only render per-board grids for <=4 boards — 8
        // tiny OctoWord grids over your own 8 boards are illegible and steal
        // space, so those stay summary-only (the count line above); the spectator
        // "still playing" screen renders all boards larger. Gauntlet (21 boards)
        // also falls out here — it shows Stage N.
        // Render the EMPTY grid from the start (no hasTiles gate) so the board is
        // visible the whole match and never flickers in on the opponent's first guess.
        if (opponent.totalBoards <= 4) {
            val boards = if (opponent.totalBoards > 1) (0 until opponent.totalBoards).toList() else listOf(0)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                boards.forEach { i -> OpponentMiniBoard(opponent.tiles[i] ?: emptyList(), maxGuesses, wordLength, 8.dp) }
            }
        }
    }
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
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        repeat(maxOf(maxGuesses, 1)) { r ->
            val isNew = r == tiles.size - 1 && tiles.getOrNull(r) != null
            // Pop-in for the newest row: fade + scale 0.8→1 over 200ms.
            val pop = androidx.compose.runtime.remember(r, tiles.size) {
                androidx.compose.animation.core.Animatable(if (isNew && !WTheme.reducedMotion) 0f else 1f)
            }
            if (isNew && !WTheme.reducedMotion) {
                LaunchedEffect(r, tiles.size) {
                    pop.animateTo(1f, androidx.compose.animation.core.tween(200))
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(gap),
                modifier = Modifier.graphicsLayer {
                    val v = pop.value
                    alpha = v
                    scaleX = 0.8f + 0.2f * v
                    scaleY = 0.8f + 0.2f * v
                },
            ) {
                repeat(maxOf(wordLength, 1)) { c ->
                    val st = tiles.getOrNull(r)?.getOrNull(c)
                    val color = when (st) {
                        TileState.CORRECT -> Color(0xFF7C3AED)
                        TileState.PRESENT -> Color(0xFFF59E0B)
                        TileState.ABSENT -> Color(0xFF9CA3AF)
                        else -> Color.Transparent
                    }
                    Box(
                        Modifier.size(cell).clip(RoundedCornerShape(2.dp)).background(color)
                            .then(if (st == null || st == TileState.EMPTY) Modifier.border(1.dp, Color(0xFFD1D5DB), RoundedCornerShape(2.dp)) else Modifier),
                    )
                }
            }
        }
    }
}

/** Cycling "Searching…/Scanning…/…" status — ports vs-game.tsx WAITING_PHRASES. */
@Composable
fun CyclingStatus() {
    val phrases = remember {
        listOf("Searching", "Scanning", "Seeking", "Matching", "Pairing", "Connecting", "Locating",
            "Scouting", "Hunting", "Queuing", "Polling", "Awaiting", "Preparing", "Loading", "Syncing",
            "Summoning", "Fetching", "Probing", "Browsing", "Rallying")
    }
    var index by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { while (true) { delay(2500); index = (index + 1) % phrases.size } }
    Text("${phrases[index]}…", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = WTheme.textSecondary)
}
