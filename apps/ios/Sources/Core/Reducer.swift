import Foundation

func initializeGame(seed: String, mode: GameMode) -> GameState {
    return createInitialState(seed: seed, mode: mode)
}

private func createBoardState(solution: String, maxGuesses: Int = 6) -> BoardState {
    return BoardState(
        solution: solution,
        guesses: [],
        maxGuesses: maxGuesses,
        status: .playing
    )
}

private func createStageBoardsFromSolutions(seed: String, stage: GauntletStageConfig, solutions: [String]) -> [BoardState] {
    let dict = GameDictionary.shared
    var boards = solutions.map { createBoardState(solution: $0, maxGuesses: stage.maxGuesses) }

    if stage.hasPrefill {
        let allowedWords = dict.getAllowedWords()
        let prefillWords = generatePrefillWords(seed: seed, solutions: solutions, allowedWords: allowedWords)
        for i in 0..<boards.count {
            boards[i].prefilledGuesses = generatePrefillGuesses(words: prefillWords, solution: boards[i].solution)
        }
    }

    return boards
}

private func getStageSolutionSlice(allSolutions: [String], stageIndex: Int) -> [String] {
    var offset = 0
    for i in 0..<stageIndex {
        offset += gauntletStages[i].boardCount
    }
    return Array(allSolutions[offset..<(offset + gauntletStages[stageIndex].boardCount)])
}

func createInitialState(seed: String, mode: GameMode) -> GameState {
    let now = Date().timeIntervalSince1970 * 1000

    switch mode {
    case .duel:
        let solutions = generateSolutionsFromSeed(seed, count: 1)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 6) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .multiDuel:
        let solutions = generateSolutionsFromSeed(seed, count: 2)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 6) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .gauntlet:
        let allSolutions = generateSolutionsFromSeed(seed, count: gauntletTotalSolutions)
        let firstStage = gauntletStages[0]
        let firstStageSolutions = getStageSolutionSlice(allSolutions: allSolutions, stageIndex: 0)
        let gauntletBoards = createStageBoardsFromSolutions(seed: seed, stage: firstStage, solutions: firstStageSolutions)

        return GameState(
            mode: mode, seed: seed, startTime: now,
            boards: gauntletBoards, currentBoardIndex: 0, status: .playing,
            gauntlet: GauntletProgress(
                currentStage: 0,
                totalStages: gauntletStages.count,
                stages: gauntletStages,
                stageResults: [],
                stageStartTime: now,
                stageStartElapsedMs: 0,
                allSolutions: allSolutions,
                blackoutCount: 0
            )
        )

    case .quordle:
        let solutions = generateSolutionsFromSeed(seed, count: 4)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 9) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .octordle:
        let solutions = generateSolutionsFromSeed(seed, count: 8)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 13) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .sequence:
        let solutions = generateSolutionsFromSeed(seed, count: 4)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 10) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .rescue:
        let solutions = generateSolutionsFromSeed(seed, count: 4)
        var boards = solutions.map { createBoardState(solution: $0, maxGuesses: 6) }
        let dict = GameDictionary.shared
        let allowedWords = dict.getAllowedWords()
        let prefillWords = generatePrefillWords(seed: seed, solutions: solutions, allowedWords: allowedWords)
        for i in 0..<boards.count {
            boards[i].prefilledGuesses = generatePrefillGuesses(words: prefillWords, solution: boards[i].solution)
        }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .tournament:
        let solutions = generateSolutionsFromSeed(seed, count: 5)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 6) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .propernoundle:
        let solutions = generateSolutionsFromSeed(seed, count: 1)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 6) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .duel6:
        let solutions = generateSolutionsFromSeedForLength(seed, count: 1, wordLength: 6)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 7) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)

    case .duel7:
        let solutions = generateSolutionsFromSeedForLength(seed, count: 1, wordLength: 7)
        let boards = solutions.map { createBoardState(solution: $0, maxGuesses: 8) }
        return GameState(mode: mode, seed: seed, startTime: now, boards: boards, currentBoardIndex: 0, status: .playing)
    }
}

func gameReducer(state: GameState, action: GameAction) -> GameState {
    switch action {

    case let .submitGuess(guess, boardIndexOpt, applyToAll):
        let dict = GameDictionary.shared
        guard dict.isValidWord(guess) else { return state }

        let updateBoard: (BoardState) -> BoardState = { board in
            guard board.status == .playing else { return board }
            guard guess.count == board.solution.count else { return board }
            let result = evaluateGuess(solution: board.solution, guess: guess)
            var newGuesses = board.guesses
            newGuesses.append(guess.uppercased())
            var newStatus = board.status
            if result.isCorrect {
                newStatus = .won
            } else if newGuesses.count >= board.maxGuesses {
                newStatus = .lost
            }
            var updated = board
            updated.guesses = newGuesses
            updated.status = newStatus
            return updated
        }

        var newBoards: [BoardState]
        if applyToAll {
            newBoards = state.boards.map(updateBoard)
            if zip(newBoards, state.boards).allSatisfy({ $0.solution == $1.solution && $0.guesses == $1.guesses }) {
                return state
            }
        } else {
            let boardIndex = boardIndexOpt ?? state.currentBoardIndex
            let board = state.boards[boardIndex]
            guard board.status == .playing else { return state }
            guard guess.count == board.solution.count else { return state }
            newBoards = state.boards
            newBoards[boardIndex] = updateBoard(board)
        }

        var gameStatus = state.status

        switch state.mode {
        case .duel, .duel6, .duel7:
            gameStatus = newBoards[0].status

        case .multiDuel:
            let allComplete = newBoards.allSatisfy { $0.status != .playing }
            if allComplete {
                let anyWon = newBoards.contains { $0.status == .won }
                gameStatus = anyWon ? .won : .lost
            }

        case .gauntlet:
            if let gauntlet = state.gauntlet {
                let anyLost = newBoards.contains { $0.status == .lost }
                let allWon = newBoards.allSatisfy { $0.status == .won }
                if anyLost && !allWon {
                    let stageGuesses = newBoards.map(\.guesses.count).max() ?? 0
                    let stageTimeMs = Int(Date().timeIntervalSince1970 * 1000 - gauntlet.stageStartTime)
                    let failedStageResult = GauntletStageResult(
                        stageIndex: gauntlet.currentStage,
                        status: .lost,
                        guesses: stageGuesses,
                        timeMs: stageTimeMs,
                        boardsSnapshot: newBoards
                    )
                    var newGauntlet = gauntlet
                    newGauntlet.stageResults.append(failedStageResult)
                    var newState = state
                    newState.boards = newBoards
                    newState.status = .lost
                    newState.gauntlet = newGauntlet
                    return newState
                }
            }

        case .quordle, .octordle, .sequence:
            let allComplete = newBoards.allSatisfy { $0.status != .playing }
            if allComplete {
                let allWon = newBoards.allSatisfy { $0.status == .won }
                gameStatus = allWon ? .won : .lost
            }

        case .rescue, .tournament:
            let allWon = newBoards.allSatisfy { $0.status == .won }
            let anyLost = newBoards.contains { $0.status == .lost }
            if allWon {
                gameStatus = .won
            } else if anyLost {
                gameStatus = .lost
            }

        case .propernoundle:
            gameStatus = newBoards[0].status
        }

        var newState = state
        newState.boards = newBoards
        newState.status = gameStatus
        return newState

    case let .submitHint(hintWord, hintEvaluation, boardIndexOpt):
        let boardIndex = boardIndexOpt ?? state.currentBoardIndex
        let board = state.boards[boardIndex]
        guard board.status == .playing else { return state }

        var newGuesses = board.guesses
        newGuesses.append(hintWord)
        let hintIndex = String(newGuesses.count - 1)

        var newStatus = board.status
        if newGuesses.count >= board.maxGuesses {
            newStatus = .lost
        }

        var updatedBoard = board
        updatedBoard.guesses = newGuesses
        updatedBoard.status = newStatus
        var hintEvals = updatedBoard.hintEvaluations ?? [:]
        hintEvals[hintIndex] = hintEvaluation
        updatedBoard.hintEvaluations = hintEvals

        var newState = state
        newState.boards[boardIndex] = updatedBoard

        switch state.mode {
        case .duel, .duel6, .duel7:
            newState.status = newStatus
        default:
            break
        }

        return newState

    case .nextBoard:
        let currentBoard = state.boards[state.currentBoardIndex]
        guard currentBoard.status == .won else { return state }
        let nextIndex = state.currentBoardIndex + 1
        guard nextIndex < state.boards.count else { return state }
        var newState = state
        newState.currentBoardIndex = nextIndex
        return newState

    case let .nextStage(elapsedMs):
        guard state.mode == .gauntlet, var gauntlet = state.gauntlet else { return state }

        let stageComplete = state.boards.allSatisfy { $0.status == .won }
        guard stageComplete else { return state }

        let stageTimeMs: Double
        if let elapsed = elapsedMs, let startElapsed = gauntlet.stageStartElapsedMs {
            stageTimeMs = max(0, elapsed - startElapsed)
        } else {
            stageTimeMs = Date().timeIntervalSince1970 * 1000 - gauntlet.stageStartTime
        }

        let stageGuesses = state.boards.map(\.guesses.count).max() ?? 0
        let stageResult = GauntletStageResult(
            stageIndex: gauntlet.currentStage,
            status: .won,
            guesses: stageGuesses,
            timeMs: Int(stageTimeMs),
            boardsSnapshot: state.boards
        )

        gauntlet.stageResults.append(stageResult)
        let nextStageIndex = gauntlet.currentStage + 1

        if nextStageIndex >= gauntlet.totalStages {
            var newState = state
            newState.status = .won
            newState.gauntlet = gauntlet
            return newState
        }

        let nextStage = gauntlet.stages[nextStageIndex]
        let nextSolutions = getStageSolutionSlice(allSolutions: gauntlet.allSolutions, stageIndex: nextStageIndex)
        let nextBoards = createStageBoardsFromSolutions(seed: state.seed, stage: nextStage, solutions: nextSolutions)
        let now = Date().timeIntervalSince1970 * 1000

        gauntlet.currentStage = nextStageIndex
        gauntlet.stageStartTime = now
        gauntlet.stageStartElapsedMs = elapsedMs ?? gauntlet.stageStartElapsedMs

        var newState = state
        newState.boards = nextBoards
        newState.currentBoardIndex = 0
        newState.gauntlet = gauntlet
        return newState

    case .stealGuess:
        guard state.mode == .gauntlet, state.gauntlet != nil else { return state }
        guard state.status == .playing else { return state }

        var newState = state
        for i in 0..<newState.boards.count {
            guard newState.boards[i].status == .playing else { continue }
            let newMax = max(newState.boards[i].guesses.count + 1, newState.boards[i].maxGuesses - 1)
            newState.boards[i].maxGuesses = newMax
        }
        return newState

    case let .blackoutRestart(boardIndex):
        guard state.mode == .gauntlet, var gauntlet = state.gauntlet else { return state }
        guard state.status == .playing else { return state }
        guard boardIndex < state.boards.count, state.boards[boardIndex].status == .lost else { return state }

        let blackoutNum = gauntlet.blackoutCount + 1
        let replacementSeed = "\(state.seed)-blackout-\(blackoutNum)"
        let newSolutions = generateSolutionsFromSeed(replacementSeed, count: 1)
        let newSolution = newSolutions[0]

        let stageConfig = gauntlet.stages[gauntlet.currentStage]
        var newBoard = createBoardState(solution: newSolution, maxGuesses: stageConfig.maxGuesses)

        if stageConfig.hasPrefill {
            let dict = GameDictionary.shared
            let allowedWords = dict.getAllowedWords()
            let prefillWords = generatePrefillWords(seed: replacementSeed, solutions: [newSolution], allowedWords: allowedWords)
            newBoard.prefilledGuesses = generatePrefillGuesses(words: prefillWords, solution: newSolution)
        }

        gauntlet.blackoutCount = blackoutNum
        var newState = state
        newState.boards[boardIndex] = newBoard
        newState.gauntlet = gauntlet
        return newState

    case .abandon:
        var newState = state
        newState.status = .abandoned
        return newState

    case let .reset(seed, mode):
        return createInitialState(seed: seed, mode: mode)

    case let .restoreState(restoredState):
        return restoredState
    }
}
