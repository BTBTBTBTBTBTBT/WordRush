package com.wordocious.core

/**
 * Two-pass Wordle evaluation — mirrors `apps/ios/Sources/Core/Evaluator.swift`.
 * Pass 1 marks exact-position matches CORRECT and consumes those solution slots;
 * pass 2 marks PRESENT for the first unused solution slot with the same letter.
 * Case-insensitive. Throws if guess length != solution length (callers must
 * length-gate first).
 */
fun evaluateGuess(solution: String, guess: String): GuessResult {
    val sol = solution.uppercase()
    val gus = guess.uppercase()
    require(sol.length == gus.length) {
        "Guess length ${gus.length} does not match solution length ${sol.length}"
    }

    val used = BooleanArray(sol.length)
    val tiles = ArrayList<TileResult>(gus.length)

    // First pass: CORRECT (consume slot) or provisional ABSENT.
    for (i in gus.indices) {
        if (gus[i] == sol[i]) {
            tiles.add(TileResult(gus[i].toString(), TileState.CORRECT))
            used[i] = true
        } else {
            tiles.add(TileResult(gus[i].toString(), TileState.ABSENT))
        }
    }

    // Second pass: PRESENT for the first unused matching solution slot.
    for (i in gus.indices) {
        if (tiles[i].state == TileState.CORRECT) continue
        for (j in sol.indices) {
            if (!used[j] && gus[i] == sol[j]) {
                tiles[i].state = TileState.PRESENT
                used[j] = true
                break
            }
        }
    }

    return GuessResult(tiles, tiles.all { it.state == TileState.CORRECT })
}
