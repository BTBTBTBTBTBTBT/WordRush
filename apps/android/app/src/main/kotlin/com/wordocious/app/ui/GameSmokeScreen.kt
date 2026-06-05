package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wordocious.app.GameViewModel
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * SMOKE-TEST game screen — proves engine→ViewModel→Compose on any mode. Renders
 * the active board + a working keyboard. NOT the final game UI: the web-faithful
 * boards, multi-board layouts, flip/zoom animations and post-game screens come in
 * the audit-then-match pass (web is source of truth). Multi-board modes show only
 * the active board here, with a notice.
 */
private class GameVMFactory(val seed: String, val mode: GameMode) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = GameViewModel(seed, mode) as T
}

@Composable
fun GameSmokeScreen(mode: GameMode, title: String, onBack: () -> Unit) {
    val vm: GameViewModel = viewModel(
        key = "game-$mode",
        factory = GameVMFactory("${mode.name.lowercase()}-demo", mode),
    )
    val state by vm.state.collectAsState()
    val input by vm.currentInput.collectAsState()
    val board = state.boards[state.currentBoardIndex]
    val multiBoard = state.boards.size > 1

    Column(
        modifier = Modifier.fillMaxSize().background(WTheme.bg).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "‹ Home",
                color = WTheme.primary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickableNoRipple(onBack),
            )
            Box(Modifier.weight(1f))
        }

        Text(title, fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.text)
        if (multiBoard) {
            Text(
                "${state.boards.size} boards · showing the active one (multi-board UI pending)",
                color = WTheme.textSecondary, fontSize = 11.sp, textAlign = TextAlign.Center,
            )
        }

        BoardGrid(board = board, currentInput = input)

        val statusText = when (state.status) {
            GameStatus.WON -> "Solved! 🎉  (${board.solution})"
            GameStatus.LOST -> "Out of guesses — ${board.solution}"
            else -> "Guess ${board.guesses.size + 1} / ${board.maxGuesses}"
        }
        Text(statusText, color = WTheme.text, fontWeight = FontWeight.Bold)

        Keyboard(
            onKey = { vm.typeLetter(it) },
            onDelete = { vm.deleteLetter() },
            onEnter = { vm.submit(applyToAll = multiBoard) },
        )
    }
}

@Composable
private fun BoardGrid(board: BoardState, currentInput: String) {
    val cols = board.solution.length
    Column(
        modifier = Modifier.width((cols * 52).dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (row in 0 until board.maxGuesses) {
            val guess = board.guesses.getOrNull(row)
            val isCurrentRow = guess == null && row == board.guesses.size && board.status == GameStatus.PLAYING
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                for (col in 0 until cols) {
                    val (letter, tile) = when {
                        guess != null -> {
                            val eval = evaluateGuess(board.solution, guess)
                            eval.tiles[col].letter to eval.tiles[col].state
                        }
                        isCurrentRow && col < currentInput.length -> currentInput[col].toString() to TileState.EMPTY
                        else -> "" to TileState.EMPTY
                    }
                    Tile(letter = letter, state = tile, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun Tile(letter: String, state: TileState, modifier: Modifier = Modifier) {
    val filled = state != TileState.EMPTY
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(4.dp))
            .background(if (filled) WTheme.tileColor(state) else Color.Transparent)
            .then(if (!filled) Modifier.border(2.dp, WTheme.emptyBorder, RoundedCornerShape(4.dp)) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = letter,
            color = if (filled) Color.White else WTheme.text,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun Keyboard(onKey: (Char) -> Unit, onDelete: () -> Unit, onEnter: () -> Unit) {
    val rows = listOf("QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM")
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        rows.forEachIndexed { i, r ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (i == 2) Key("⏎", wide = true) { onEnter() }
                r.forEach { c -> Key(c.toString()) { onKey(c) } }
                if (i == 2) Key("⌫", wide = true) { onDelete() }
            }
        }
    }
}

@Composable
private fun Key(label: String, wide: Boolean = false, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(width = if (wide) 48.dp else 30.dp, height = 44.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(WTheme.keyDefault)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = WTheme.text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

@Composable
internal fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    return this.clickable(interactionSource = interaction, indication = null, onClick = onClick)
}
