package com.wordocious.app.data

import android.content.Context
import android.content.Intent
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess

/**
 * Builds the shareable emoji grid + launches the Android share sheet —
 * mirrors the web share text (🟩/🟨/⬛ grid, header line, wordocious.com).
 */
object ShareHelper {

    private fun emoji(state: TileState): String = when (state) {
        TileState.CORRECT -> "🟩"
        TileState.PRESENT -> "🟨"
        TileState.HINT_USED -> "🟨"
        else -> "⬛"
    }

    /** Build the share text for a finished single- or multi-board game. */
    fun buildShareText(state: GameState, mode: GameMode, elapsedSeconds: Int): String {
        val won = state.status == GameStatus.WON
        val modeName = modeLabel(mode)
        val sb = StringBuilder()

        if (state.boards.size == 1) {
            val board = state.boards[0]
            val tries = if (won) "${board.guesses.size}/${board.maxGuesses}" else "X/${board.maxGuesses}"
            sb.appendLine("Wordocious $modeName $tries")
            sb.appendLine()
            board.guesses.forEach { guess ->
                val eval = evaluateGuess(board.solution, guess)
                sb.appendLine(eval.tiles.joinToString("") { emoji(it.state) })
            }
        } else {
            val solved = state.boards.count { it.status == GameStatus.WON }
            sb.appendLine("Wordocious $modeName $solved/${state.boards.size} boards")
            sb.appendLine()
            // One compact emoji line per board: its final-row result
            state.boards.forEach { board ->
                val lastGuess = board.guesses.lastOrNull()
                if (lastGuess != null) {
                    val eval = evaluateGuess(board.solution, lastGuess)
                    sb.append(eval.tiles.joinToString("") { emoji(it.state) })
                    sb.append(if (board.status == GameStatus.WON) " ✅" else " ❌")
                    sb.appendLine()
                }
            }
        }

        val mins = elapsedSeconds / 60
        val secs = elapsedSeconds % 60
        sb.appendLine()
        sb.appendLine("⏱ ${if (mins > 0) "${mins}m " else ""}${secs}s")
        sb.append("Play at wordocious.com")
        return sb.toString()
    }

    /** Launch the system share sheet. */
    fun share(context: Context, text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        val chooser = Intent.createChooser(intent, "Share your result").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    private fun modeLabel(mode: GameMode): String = when (mode) {
        GameMode.DUEL -> "Classic"
        GameMode.MULTI_DUEL -> "Duel"
        GameMode.QUORDLE -> "QuadWord"
        GameMode.OCTORDLE -> "OctoWord"
        GameMode.SEQUENCE -> "Succession"
        GameMode.RESCUE -> "Deliverance"
        GameMode.DUEL_6 -> "Six"
        GameMode.DUEL_7 -> "Seven"
        GameMode.GAUNTLET -> "Gauntlet"
        GameMode.PROPERNOUNDLE -> "ProperNoundle"
        GameMode.TOURNAMENT -> "Tournament"
    }
}
