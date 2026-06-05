package com.wordocious.app.ui.game

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wordocious.app.GameViewModel
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * Full game screen — audit-then-match of the web game UI.
 *
 * Single-board (DUEL/DUEL_6/DUEL_7/PROPERNOUNDLE/TOURNAMENT):
 *   Board fills available space using BoxWithConstraints — same as the web's
 *   `w-full max-w-[400px] max-h-full aspect-ratio` approach.
 *
 * Multi-board (QUORDLE/OCTORDLE/SEQUENCE/RESCUE/GAUNTLET):
 *   MultiBoardLayout handles 2×2 / 4×2 grids with Sequence locking and
 *   OctoWord tap-to-zoom.
 *
 * Post-game: GameStatus.WON / LOST → PostGameScreen overlay.
 */
private class GameVMFactory(val seed: String, val mode: GameMode) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = GameViewModel(seed, mode) as T
}

/** Format elapsed seconds as M:SS for the game header. */
private fun fmtClock(secs: Int): String = "%d:%02d".format(secs / 60, secs % 60)

/**
 * Gauntlet 5-node stepper (spec line 102): done = green ✓, active = purple
 * (glow), future = number; connectors between nodes (green up to active).
 */
@Composable
private fun GauntletStepper(current: Int, total: Int) {
    val green = Color(0xFF22C55E)
    val purple = Color(0xFFA855F7)
    val gray = Color(0xFFD1D5DB)
    Row(verticalAlignment = Alignment.CenterVertically) {
        for (i in 0 until total) {
            val done = i < current
            val active = i == current
            val nodeColor = when { done -> green; active -> purple; else -> WTheme.surfaceAlt }
            Box(
                modifier = Modifier
                    .size(if (active) 26.dp else 22.dp)
                    .then(if (active) Modifier.shadow(8.dp, androidx.compose.foundation.shape.CircleShape, clip = false, spotColor = purple) else Modifier)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(nodeColor)
                    .border(if (done || active) 0.dp else 1.5.dp, gray, androidx.compose.foundation.shape.CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (done) "✓" else "${i + 1}",
                    color = if (done || active) Color.White else WTheme.textMuted,
                    fontSize = if (active) 13.sp else 11.sp,
                    fontWeight = FontWeight.Black,
                )
            }
            if (i < total - 1) {
                Box(
                    Modifier.width(14.dp).height(2.dp)
                        .background(if (i < current) green else gray),
                )
            }
        }
    }
}

@Composable
fun GameScreen(mode: GameMode, title: String, seed: String, onBack: () -> Unit) {
    val vm: GameViewModel = viewModel(
        key = "game-$mode-$seed",
        factory = GameVMFactory(seed, mode),
    )
    val state by vm.state.collectAsState()
    val input by vm.currentInput.collectAsState()
    val elapsed by vm.elapsed.collectAsState()

    val multiBoard = state.boards.size > 1
    val isSequential = mode == GameMode.SEQUENCE
    // Quadrant keyboard for parallel multi-board modes (Quad/Octo/Deliverance); NOT Sequence.
    val useQuadrant = multiBoard && !isSequential
    val letterStates = if (isSequential) {
        // Sequence: keyboard colors from the ACTIVE board only (spec hot-spot #8).
        computeCombinedLetterStates(listOf(state.boards[state.currentBoardIndex]))
    } else {
        computeCombinedLetterStates(state.boards)
    }
    val perBoardStates = if (useQuadrant) computePerBoardLetterStates(state.boards) else null
    val isApplyToAll = multiBoard && !isSequential
    val isFinished = state.status != GameStatus.PLAYING

    // Show post-game overlay once all tiles have revealed
    if (isFinished) {
        PostGameScreen(
            state = state,
            mode = mode,
            seed = seed,
            elapsedSeconds = elapsed,
            onBack = onBack,
        )
        return
    }

    val accent = com.wordocious.app.ui.modeAccent(mode)
    Box(
        modifier = Modifier.fillMaxSize()
            .background(
                androidx.compose.ui.graphics.Brush.verticalGradient(
                    listOf(WTheme.bg, WTheme.surfaceHover), // #F8F7FF → #F3F0FF
                ),
            ),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
            // Centered gradient mode title + progress + live clock (spec Part 2 Headers)
            val board0 = state.boards[0]
            val progressLabel = if (mode == GameMode.GAUNTLET) {
                val sn = (state.gauntlet?.currentStage ?: 0) + 1
                "Stage $sn / ${state.gauntlet?.totalStages ?: 5}"
            } else {
                "Guess ${board0.guesses.size + 1} / ${board0.maxGuesses}"
            }
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = 48.dp, bottom = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Gauntlet gets a 5-node stepper above the stage name (spec line 102).
                if (mode == GameMode.GAUNTLET) {
                    GauntletStepper(
                        current = state.gauntlet?.currentStage ?: 0,
                        total = state.gauntlet?.totalStages ?: 5,
                    )
                    Spacer(Modifier.height(6.dp))
                }
                Text(
                    com.wordocious.app.ui.modeTitle(mode),
                    fontSize = 28.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
                    style = androidx.compose.ui.text.TextStyle(
                        brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                            com.wordocious.app.ui.modeTitleGradient(mode),
                        ),
                    ),
                )
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(progressLabel, color = WTheme.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("·", color = WTheme.textMuted, fontSize = 12.sp)
                    Text(fmtClock(elapsed), color = WTheme.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
            }

            // Board area — fills between header and keyboard
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            if (multiBoard) {
                MultiBoardLayout(
                    boards = state.boards,
                    currentGuess = input,
                    currentBoardIndex = state.currentBoardIndex,
                    isSequential = isSequential,
                    modifier = Modifier.fillMaxSize().padding(4.dp),
                )
            } else {
                SingleBoard(
                    board = state.boards[0],
                    currentGuess = input,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        Spacer(Modifier.height(6.dp))

            KeyboardView(
                letterStates = letterStates,
                onKey = { vm.typeLetter(it) },
                onDelete = { vm.deleteLetter() },
                onEnter = { vm.submit(applyToAll = isApplyToAll) },
                perBoardStates = perBoardStates,
            )

            Spacer(Modifier.height(8.dp))
        }

        // Corner Home button (top-left) — spec Part 2 Nav: 44dp circle, surface
        // fill, 2dp accent stroke, house icon, shadow. Visible in play + post-game.
        CornerHomeButton(accent = accent, onClick = onBack, modifier = Modifier.padding(8.dp))
    }
}

@Composable
private fun CornerHomeButton(accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val circle = androidx.compose.foundation.shape.CircleShape
    Box(
        modifier = modifier
            .size(44.dp)
            .shadow(4.dp, circle, clip = false)
            .clip(circle)
            .background(WTheme.surface)
            .border(2.dp, accent, circle)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            androidx.compose.material.icons.Icons.Filled.Home,
            contentDescription = "Home",
            tint = accent,
            modifier = Modifier.size(20.dp),
        )
    }
}

/**
 * Single-board — fills available space like the web's `max-w-[400px] max-h-full
 * aspect-ratio` board. Uses BoxWithConstraints to compute the largest board that
 * fits width AND height, then centres it. Font size scales with tile size.
 */
@Composable
internal fun SingleBoard(board: BoardState, currentGuess: String, modifier: Modifier = Modifier) {
    val wordLen = board.solution.length
    val rows = board.maxGuesses
    val lastSubmittedRow = if (board.guesses.isNotEmpty()) board.guesses.size - 1 else -1

    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.Center) {
        // Max board width per web (400px ≈ 380dp accounting for padding)
        val maxBoardW = minOf(maxWidth, 380.dp)
        val maxBoardH = maxHeight

        // Board aspect ratio is wordLen:rows (each tile square)
        val ratio = wordLen.toFloat() / rows.toFloat()
        val fromWidth: Dp = maxBoardW
        val fromWidthH: Dp = fromWidth / ratio

        val (boardW, boardH) = if (fromWidthH <= maxBoardH) {
            fromWidth to fromWidthH
        } else {
            (maxBoardH * ratio) to maxBoardH
        }

        // Scale font size to tile height
        val gapTotal = 4.dp * (rows - 1)
        val tileHValue = (boardH.value - gapTotal.value) / rows
        val tileFontSp = (tileHValue * 0.44f).coerceIn(14f, 28f)

        Column(
            modifier = Modifier.size(boardW, boardH),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Submitted rows
            for (rowIdx in 0 until board.guesses.size) {
                val guess = board.guesses[rowIdx]
                val eval = evaluateGuess(board.solution, guess)
                val isLastSubmitted = rowIdx == lastSubmittedRow
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    eval.tiles.forEachIndexed { col, tile ->
                        TileView(
                            letter = tile.letter,
                            state = tile.state,
                            flipDelay = if (isLastSubmitted) col * 150 else null,
                            fontSize = tileFontSp,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Current input row
            if (board.guesses.size < board.maxGuesses && board.status == GameStatus.PLAYING) {
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    for (col in 0 until wordLen) {
                        TileView(
                            letter = currentGuess.getOrNull(col)?.toString() ?: "",
                            state = TileState.EMPTY,
                            fontSize = tileFontSp,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            // Empty rows
            val emptyStart = board.guesses.size + if (board.status == GameStatus.PLAYING) 1 else 0
            for (rowIdx in emptyStart until board.maxGuesses) {
                Row(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    repeat(wordLen) {
                        TileView(letter = "", state = TileState.EMPTY, fontSize = tileFontSp, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
