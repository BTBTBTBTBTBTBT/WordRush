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
    val hasTiles = opponent.tiles.values.any { it.isNotEmpty() }
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
            if (opponent.solved) Text("✓", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF22C55E))
        }
        if (hasTiles) {
            val boards = if (opponent.totalBoards > 1) (0 until opponent.totalBoards).toList() else listOf(0)
            val cell = if (opponent.totalBoards > 4) 5.dp else 8.dp
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                boards.forEach { i -> OpponentMiniBoard(opponent.tiles[i] ?: emptyList(), maxGuesses, wordLength, cell) }
            }
        }
    }
}

@Composable
private fun OpponentMiniBoard(tiles: List<List<TileState>>, maxGuesses: Int, wordLength: Int, cell: androidx.compose.ui.unit.Dp) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        repeat(maxOf(maxGuesses, 1)) { r ->
            Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                repeat(maxOf(wordLength, 1)) { c ->
                    val st = tiles.getOrNull(r)?.getOrNull(c)
                    val color = when (st) {
                        TileState.CORRECT -> Color(0xFF22C55E)
                        TileState.PRESENT -> Color(0xFFEAB308)
                        TileState.ABSENT -> WTheme.textMuted
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
