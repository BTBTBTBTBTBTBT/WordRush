package com.wordocious.core

/**
 * Game state machine — mirrors `apps/ios/Sources/Core/Reducer.swift`.
 * Pure function: `(GameState, GameAction) -> GameState`. Immutable data classes
 * + `.copy()` replace Swift's value-type struct mutation. Requires
 * [GameDictionary] to be initialized.
 *
 * NOTE: `startTime`/`stageStartTime` use wall-clock (`System.currentTimeMillis`)
 * exactly like Swift's `Date()...` — they're not part of cross-platform fixture
 * parity (the deterministic part is seeds/evals/scoring, already fixture-locked).
 */

fun initializeGame(seed: String, mode: GameMode): GameState = createInitialState(seed, mode)

private fun nowMs(): Double = System.currentTimeMillis().toDouble()

private fun createBoardState(solution: String, maxGuesses: Int = 6): BoardState =
    BoardState(solution = solution, guesses = emptyList(), maxGuesses = maxGuesses, status = GameStatus.PLAYING)

private fun createStageBoardsFromSolutions(seed: String, stage: GauntletStageConfig, solutions: List<String>): List<BoardState> {
    val boards = solutions.map { createBoardState(it, stage.maxGuesses) }
    if (!stage.hasPrefill) return boards
    val prefillWords = generatePrefillWords(seed, solutions, GameDictionary.getAllowedWords())
    return boards.map { it.copy(prefilledGuesses = generatePrefillGuesses(prefillWords, it.solution)) }
}

private fun getStageSolutionSlice(allSolutions: List<String>, stageIndex: Int): List<String> {
    var offset = 0
    for (i in 0 until stageIndex) offset += gauntletStages[i].boardCount
    return allSolutions.subList(offset, offset + gauntletStages[stageIndex].boardCount).toList()
}

fun createInitialState(seed: String, mode: GameMode): GameState {
    val now = nowMs()
    fun simple(count: Int, maxGuesses: Int): GameState =
        GameState(mode, seed, now, generateSolutionsFromSeed(seed, count).map { createBoardState(it, maxGuesses) }, 0, GameStatus.PLAYING)
    fun simpleLen(count: Int, maxGuesses: Int, wordLength: Int): GameState =
        GameState(mode, seed, now, generateSolutionsFromSeedForLength(seed, count, wordLength).map { createBoardState(it, maxGuesses) }, 0, GameStatus.PLAYING)

    return when (mode) {
        GameMode.DUEL -> simple(1, 6)
        GameMode.MULTI_DUEL -> simple(2, 6)
        GameMode.QUORDLE -> simple(4, 9)
        GameMode.OCTORDLE -> simple(8, 13)
        GameMode.SEQUENCE -> simple(4, 10)
        GameMode.TOURNAMENT -> simple(5, 6)
        GameMode.PROPERNOUNDLE -> {
            // Separate engine: the board solution is a real puzzle's normalized
            // answer (variable length), not a generated 5-letter word.
            val date = getDailySeedDate(seed)
            val puzzle = if (date != null) ProperNoundle.dailyPuzzle(date) else ProperNoundle.puzzleForSeed(seed)
            val answer = (puzzle?.answer ?: "wordocious").uppercase()
            GameState(mode, seed, now, listOf(createBoardState(answer, ProperNoundle.MAX_GUESSES)), 0, GameStatus.PLAYING)
        }
        GameMode.DUEL_6 -> simpleLen(1, 7, 6)
        GameMode.DUEL_7 -> simpleLen(1, 8, 7)
        GameMode.RESCUE -> {
            val solutions = generateSolutionsFromSeed(seed, 4)
            val prefillWords = generatePrefillWords(seed, solutions, GameDictionary.getAllowedWords())
            val boards = solutions.map {
                createBoardState(it, 6).copy(prefilledGuesses = generatePrefillGuesses(prefillWords, it))
            }
            GameState(mode, seed, now, boards, 0, GameStatus.PLAYING)
        }
        GameMode.GAUNTLET -> {
            val allSolutions = generateSolutionsFromSeed(seed, gauntletTotalSolutions)
            val firstSlice = getStageSolutionSlice(allSolutions, 0)
            val boards = createStageBoardsFromSolutions(seed, gauntletStages[0], firstSlice)
            GameState(
                mode, seed, now, boards, 0, GameStatus.PLAYING,
                gauntlet = GauntletProgress(
                    currentStage = 0, totalStages = gauntletStages.size, stages = gauntletStages,
                    stageResults = emptyList(), stageStartTime = now, stageStartElapsedMs = 0.0,
                    allSolutions = allSolutions, blackoutCount = 0,
                ),
            )
        }
    }
}

private fun updateBoardWithGuess(board: BoardState, guess: String): BoardState {
    if (board.status != GameStatus.PLAYING) return board
    if (guess.length != board.solution.length) return board
    val result = evaluateGuess(board.solution, guess)
    val newGuesses = board.guesses + guess.uppercase()
    val newStatus = when {
        result.isCorrect -> GameStatus.WON
        newGuesses.size >= board.maxGuesses -> GameStatus.LOST
        else -> board.status
    }
    return board.copy(guesses = newGuesses, status = newStatus)
}

fun gameReducer(state: GameState, action: GameAction): GameState = when (action) {
    is GameAction.SubmitGuess -> reduceSubmitGuess(state, action)
    is GameAction.SubmitHint -> reduceSubmitHint(state, action)
    GameAction.NextBoard -> reduceNextBoard(state)
    is GameAction.NextStage -> reduceNextStage(state, action.elapsedMs)
    GameAction.StealGuess -> reduceStealGuess(state)
    is GameAction.BlackoutRestart -> reduceBlackout(state, action.boardIndex)
    GameAction.Abandon -> state.copy(status = GameStatus.ABANDONED)
    is GameAction.Reset -> createInitialState(action.seed, action.mode)
    is GameAction.RestoreState -> action.state
}

private fun reduceSubmitGuess(state: GameState, a: GameAction.SubmitGuess): GameState {
    // ProperNoundle guesses are names — not validated against the word dictionary
    // (only length-gated below). All other modes require a valid dictionary word.
    if (state.mode != GameMode.PROPERNOUNDLE && !GameDictionary.isValidWord(a.guess)) return state

    val newBoards: List<BoardState>
    if (a.applyToAll) {
        newBoards = state.boards.map { updateBoardWithGuess(it, a.guess) }
        // No board changed (nothing accepted the guess) → no-op.
        if (newBoards.zip(state.boards).all { (n, o) -> n.solution == o.solution && n.guesses == o.guesses }) return state
    } else {
        val idx = a.boardIndex ?: state.currentBoardIndex
        val board = state.boards[idx]
        if (board.status != GameStatus.PLAYING) return state
        if (a.guess.length != board.solution.length) return state
        newBoards = state.boards.toMutableList().also { it[idx] = updateBoardWithGuess(board, a.guess) }
    }

    var gameStatus = state.status
    when (state.mode) {
        GameMode.DUEL, GameMode.DUEL_6, GameMode.DUEL_7, GameMode.PROPERNOUNDLE ->
            gameStatus = newBoards[0].status

        GameMode.MULTI_DUEL ->
            if (newBoards.all { it.status != GameStatus.PLAYING }) {
                gameStatus = if (newBoards.any { it.status == GameStatus.WON }) GameStatus.WON else GameStatus.LOST
            }

        GameMode.GAUNTLET -> {
            val g = state.gauntlet
            if (g != null) {
                val anyLost = newBoards.any { it.status == GameStatus.LOST }
                val allWon = newBoards.all { it.status == GameStatus.WON }
                if (anyLost && !allWon) {
                    val stageGuesses = newBoards.maxOfOrNull { it.guesses.size } ?: 0
                    val stageTimeMs = (nowMs() - g.stageStartTime).toInt()
                    val failed = GauntletStageResult(g.currentStage, GameStatus.LOST, stageGuesses, stageTimeMs, newBoards)
                    return state.copy(
                        boards = newBoards, status = GameStatus.LOST,
                        gauntlet = g.copy(stageResults = g.stageResults + failed),
                    )
                }
            }
        }

        GameMode.QUORDLE, GameMode.OCTORDLE, GameMode.SEQUENCE ->
            if (newBoards.all { it.status != GameStatus.PLAYING }) {
                gameStatus = if (newBoards.all { it.status == GameStatus.WON }) GameStatus.WON else GameStatus.LOST
            }

        GameMode.RESCUE, GameMode.TOURNAMENT -> {
            val allWon = newBoards.all { it.status == GameStatus.WON }
            val anyLost = newBoards.any { it.status == GameStatus.LOST }
            if (allWon) gameStatus = GameStatus.WON else if (anyLost) gameStatus = GameStatus.LOST
        }
    }

    return state.copy(boards = newBoards, status = gameStatus)
}

private fun reduceSubmitHint(state: GameState, a: GameAction.SubmitHint): GameState {
    val idx = a.boardIndex ?: state.currentBoardIndex
    val board = state.boards[idx]
    if (board.status != GameStatus.PLAYING) return state

    val newGuesses = board.guesses + a.hintWord
    val hintKey = (newGuesses.size - 1).toString()
    val newStatus = if (newGuesses.size >= board.maxGuesses) GameStatus.LOST else board.status
    val newHints = (board.hintEvaluations ?: emptyMap()) + (hintKey to a.hintEvaluation)
    val updated = board.copy(guesses = newGuesses, status = newStatus, hintEvaluations = newHints)
    val newBoards = state.boards.toMutableList().also { it[idx] = updated }

    val gameStatus = when (state.mode) {
        GameMode.DUEL, GameMode.DUEL_6, GameMode.DUEL_7 -> newStatus
        else -> state.status
    }
    return state.copy(boards = newBoards, status = gameStatus)
}

private fun reduceNextBoard(state: GameState): GameState {
    val cur = state.boards[state.currentBoardIndex]
    if (cur.status != GameStatus.WON) return state
    val next = state.currentBoardIndex + 1
    if (next >= state.boards.size) return state
    return state.copy(currentBoardIndex = next)
}

private fun reduceNextStage(state: GameState, elapsedMs: Double?): GameState {
    if (state.mode != GameMode.GAUNTLET) return state
    val g = state.gauntlet ?: return state
    if (!state.boards.all { it.status == GameStatus.WON }) return state

    val stageStartElapsed = g.stageStartElapsedMs
    val stageTimeMs = if (elapsedMs != null && stageStartElapsed != null) maxOf(0.0, elapsedMs - stageStartElapsed)
        else nowMs() - g.stageStartTime
    val stageGuesses = state.boards.maxOfOrNull { it.guesses.size } ?: 0
    val result = GauntletStageResult(g.currentStage, GameStatus.WON, stageGuesses, stageTimeMs.toInt(), state.boards)
    val withResult = g.copy(stageResults = g.stageResults + result)

    val nextIdx = g.currentStage + 1
    if (nextIdx >= g.totalStages) {
        return state.copy(status = GameStatus.WON, gauntlet = withResult)
    }

    val nextStage = withResult.stages[nextIdx]
    val nextBoards = createStageBoardsFromSolutions(state.seed, nextStage, getStageSolutionSlice(withResult.allSolutions, nextIdx))
    val advanced = withResult.copy(
        currentStage = nextIdx, stageStartTime = nowMs(),
        stageStartElapsedMs = elapsedMs ?: withResult.stageStartElapsedMs,
    )
    return state.copy(boards = nextBoards, currentBoardIndex = 0, gauntlet = advanced)
}

private fun reduceStealGuess(state: GameState): GameState {
    if (state.mode != GameMode.GAUNTLET || state.gauntlet == null) return state
    if (state.status != GameStatus.PLAYING) return state
    val newBoards = state.boards.map {
        if (it.status != GameStatus.PLAYING) it
        else it.copy(maxGuesses = maxOf(it.guesses.size + 1, it.maxGuesses - 1))
    }
    return state.copy(boards = newBoards)
}

private fun reduceBlackout(state: GameState, boardIndex: Int): GameState {
    if (state.mode != GameMode.GAUNTLET) return state
    val g = state.gauntlet ?: return state
    if (state.status != GameStatus.PLAYING) return state
    if (boardIndex >= state.boards.size || state.boards[boardIndex].status != GameStatus.LOST) return state

    val blackoutNum = g.blackoutCount + 1
    val replacementSeed = "${state.seed}-blackout-$blackoutNum"
    val newSolution = generateSolutionsFromSeed(replacementSeed, 1)[0]
    val stageConfig = g.stages[g.currentStage]
    var newBoard = createBoardState(newSolution, stageConfig.maxGuesses)
    if (stageConfig.hasPrefill) {
        val prefillWords = generatePrefillWords(replacementSeed, listOf(newSolution), GameDictionary.getAllowedWords())
        newBoard = newBoard.copy(prefilledGuesses = generatePrefillGuesses(prefillWords, newSolution))
    }
    val newBoards = state.boards.toMutableList().also { it[boardIndex] = newBoard }
    return state.copy(boards = newBoards, gauntlet = g.copy(blackoutCount = blackoutNum))
}
