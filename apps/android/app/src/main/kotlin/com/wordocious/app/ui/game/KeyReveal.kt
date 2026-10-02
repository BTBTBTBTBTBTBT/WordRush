package com.wordocious.app.ui.game

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.wordocious.core.BoardState
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import kotlinx.coroutines.delay

/**
 * FINISH_SPEC AQ1 (founder 10-02: "the keyboard tiles take a bit to populate the color"):
 * the keyboard's letter colors build TILE BY TILE — the key for tile i takes its color the
 * moment tile i lands, never after the whole row (and never slower than the row). A new
 * guess mid-reveal snaps the previous row's colors in at once. Pure, so it is unit tested
 * (iOS core KeyReveal / web lib/key-reveal parity).
 */
object KeyReveal {
    /** correct > present (and hint-used) > absent > nothing. */
    fun rank(s: TileState?): Int = when (s) {
        TileState.CORRECT -> 3
        TileState.PRESENT, TileState.HINT_USED -> 2
        TileState.ABSENT -> 1
        else -> 0
    }

    /** The better-known of two states for one letter. */
    fun merge(a: TileState?, b: TileState): TileState = if (a == null || rank(b) > rank(a)) b else a

    /**
     * The keys while a row reveals: [base] (the settled colors before the row) plus the
     * first [landed] tiles of each of [rows] (one row per board the guess landed on). Once
     * every tile has landed the keys are exactly [target] (the full recomputation, which
     * also drops a just-finished board's letters).
     */
    fun during(
        base: Map<String, TileState>,
        target: Map<String, TileState>,
        rows: List<List<Pair<String, TileState>>>,
        landed: Int,
    ): Map<String, TileState> {
        val width = rows.maxOfOrNull { it.size } ?: 0
        if (landed >= width) return target
        if (landed <= 0) return base
        val out = base.toMutableMap()
        for (row in rows) {
            for ((letter, state) in row.take(landed)) {
                if (letter.isBlank()) continue
                val k = letter.uppercase()
                out[k] = merge(out[k], state)
            }
        }
        return out
    }

    /** The newest guess's tiles on each board it landed on (a sequential stage: just the board it hit). */
    fun newestRows(boards: List<BoardState>, sequential: Boolean): List<List<Pair<String, TileState>>> {
        val newest = boards.maxOfOrNull { it.guesses.size } ?: 0
        if (newest == 0) return emptyList()
        val hit = boards.filter { it.guesses.size == newest }.let { if (sequential) it.take(1) else it }
        return hit.map { b ->
            val idx = b.guesses.size - 1
            val eval = b.hintEvaluations?.get(idx.toString()) ?: evaluateGuess(b.solution, b.guesses[idx])
            eval.tiles.map { it.letter to it.state }
        }
    }
}

/**
 * AQ1 shows [target] tile by tile: when [revealKey] changes (a row committed), the value
 * steps through [partial] (base, n landed) as each of the row's [width] tiles lands, then
 * settles on [target]. Any other change of [target] (or Reduce Motion) shows at once.
 */
@Composable
internal fun <T> rememberTileByTile(
    target: T,
    width: Int,
    revealKey: Int,
    reduced: Boolean,
    partial: (base: T, landed: Int) -> T,
): T {
    var shown by remember { mutableStateOf(target) }
    // The last fully applied target and the last row key (plain holders: no recomposition).
    val settled = remember { arrayOf<Any?>(target) }
    val lastKey = remember { intArrayOf(revealKey) }
    LaunchedEffect(target, revealKey) {
        @Suppress("UNCHECKED_CAST") val base = settled[0] as T
        settled[0] = target
        val fresh = revealKey != lastKey[0]
        lastKey[0] = revealKey
        if (!fresh || reduced || width <= 0) { shown = target; return@LaunchedEffect }
        shown = base // a reveal cut short by this one has already snapped into `base`
        for (i in 0 until width) {
            delay((if (i == 0) TileMotion.tileLandsMs(0) else TileMotion.FLIP_STAGGER_MS).toLong())
            shown = partial(base, i + 1)
        }
        shown = target
    }
    return shown
}
