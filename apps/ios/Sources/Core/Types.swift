import Foundation

// MARK: - Enums

public enum GameMode: String, Codable {
    case duel = "DUEL"
    case multiDuel = "MULTI_DUEL"
    case gauntlet = "GAUNTLET"
    case quordle = "QUORDLE"
    case octordle = "OCTORDLE"
    case sequence = "SEQUENCE"
    case rescue = "RESCUE"
    case tournament = "TOURNAMENT"
    case propernoundle = "PROPERNOUNDLE"
    case duel6 = "DUEL_6"
    case duel7 = "DUEL_7"
}

public enum TileState: String, Codable {
    case correct = "CORRECT"
    case present = "PRESENT"
    case absent = "ABSENT"
    case empty = "EMPTY"
    case hintUsed = "HINT_USED"
}

public enum GameStatus: String, Codable {
    case playing = "PLAYING"
    case won = "WON"
    case lost = "LOST"
    case abandoned = "ABANDONED"
}

// MARK: - Structs

public struct TileResult: Codable, Equatable {
    public let letter: String
    public var state: TileState

    public init(letter: String, state: TileState) {
        self.letter = letter
        self.state = state
    }
}

public struct GuessResult: Codable, Equatable {
    public let tiles: [TileResult]
    public let isCorrect: Bool

    public init(tiles: [TileResult], isCorrect: Bool) {
        self.tiles = tiles
        self.isCorrect = isCorrect
    }
}

public struct PrefilledGuess: Codable, Equatable {
    public let word: String
    public let evaluation: GuessResult

    public init(word: String, evaluation: GuessResult) {
        self.word = word
        self.evaluation = evaluation
    }
}

public struct BoardState: Codable, Equatable {
    public let solution: String
    public var guesses: [String]
    public var maxGuesses: Int
    public var status: GameStatus
    public var prefilledGuesses: [PrefilledGuess]?
    public var hintEvaluations: [String: GuessResult]?

    public init(
        solution: String,
        guesses: [String],
        maxGuesses: Int,
        status: GameStatus,
        prefilledGuesses: [PrefilledGuess]? = nil,
        hintEvaluations: [String: GuessResult]? = nil
    ) {
        self.solution = solution
        self.guesses = guesses
        self.maxGuesses = maxGuesses
        self.status = status
        self.prefilledGuesses = prefilledGuesses
        self.hintEvaluations = hintEvaluations
    }
}

public struct GauntletStageConfig: Codable, Equatable {
    public let stageIndex: Int
    public let name: String
    public let baseMode: GameMode
    public let boardCount: Int
    public let maxGuesses: Int
    public let sequential: Bool
    public let hasPrefill: Bool

    public init(
        stageIndex: Int,
        name: String,
        baseMode: GameMode,
        boardCount: Int,
        maxGuesses: Int,
        sequential: Bool,
        hasPrefill: Bool
    ) {
        self.stageIndex = stageIndex
        self.name = name
        self.baseMode = baseMode
        self.boardCount = boardCount
        self.maxGuesses = maxGuesses
        self.sequential = sequential
        self.hasPrefill = hasPrefill
    }
}

public struct GauntletStageResult: Codable, Equatable {
    public let stageIndex: Int
    public let status: GameStatus
    public let guesses: Int
    public let timeMs: Int
    public var boardsSnapshot: [BoardState]?

    public init(
        stageIndex: Int,
        status: GameStatus,
        guesses: Int,
        timeMs: Int,
        boardsSnapshot: [BoardState]? = nil
    ) {
        self.stageIndex = stageIndex
        self.status = status
        self.guesses = guesses
        self.timeMs = timeMs
        self.boardsSnapshot = boardsSnapshot
    }
}

public struct GauntletProgress: Codable, Equatable {
    public var currentStage: Int
    public let totalStages: Int
    public let stages: [GauntletStageConfig]
    public var stageResults: [GauntletStageResult]
    public var stageStartTime: Double
    public var stageStartElapsedMs: Double?
    public var allSolutions: [String]
    public var blackoutCount: Int

    public init(
        currentStage: Int,
        totalStages: Int,
        stages: [GauntletStageConfig],
        stageResults: [GauntletStageResult],
        stageStartTime: Double,
        stageStartElapsedMs: Double? = nil,
        allSolutions: [String],
        blackoutCount: Int
    ) {
        self.currentStage = currentStage
        self.totalStages = totalStages
        self.stages = stages
        self.stageResults = stageResults
        self.stageStartTime = stageStartTime
        self.stageStartElapsedMs = stageStartElapsedMs
        self.allSolutions = allSolutions
        self.blackoutCount = blackoutCount
    }
}

public struct GameState: Codable, Equatable {
    public let mode: GameMode
    public let seed: String
    public let startTime: Double
    public var boards: [BoardState]
    public var currentBoardIndex: Int
    public var status: GameStatus
    public var gauntlet: GauntletProgress?

    public init(
        mode: GameMode,
        seed: String,
        startTime: Double,
        boards: [BoardState],
        currentBoardIndex: Int,
        status: GameStatus,
        gauntlet: GauntletProgress? = nil
    ) {
        self.mode = mode
        self.seed = seed
        self.startTime = startTime
        self.boards = boards
        self.currentBoardIndex = currentBoardIndex
        self.status = status
        self.gauntlet = gauntlet
    }
}

public struct ScoreBreakdown: Codable, Equatable {
    public let winBonus: Int
    public let guessDiff: Int
    public let timeDiff: Int
    public let dnfPenalty: Int
    public let total: Int

    public init(winBonus: Int, guessDiff: Int, timeDiff: Int, dnfPenalty: Int, total: Int) {
        self.winBonus = winBonus
        self.guessDiff = guessDiff
        self.timeDiff = timeDiff
        self.dnfPenalty = dnfPenalty
        self.total = total
    }
}

public struct MatchResult: Codable, Equatable {
    public let playerWon: Bool
    public let playerGuesses: Int
    public let opponentGuesses: Int
    public let playerTime: Double
    public let opponentTime: Double
    public let playerStatus: GameStatus
    public let opponentStatus: GameStatus
    public var score: ScoreBreakdown

    public init(
        playerWon: Bool,
        playerGuesses: Int,
        opponentGuesses: Int,
        playerTime: Double,
        opponentTime: Double,
        playerStatus: GameStatus,
        opponentStatus: GameStatus,
        score: ScoreBreakdown
    ) {
        self.playerWon = playerWon
        self.playerGuesses = playerGuesses
        self.opponentGuesses = opponentGuesses
        self.playerTime = playerTime
        self.opponentTime = opponentTime
        self.playerStatus = playerStatus
        self.opponentStatus = opponentStatus
        self.score = score
    }
}

// MARK: - Actions

public enum GameAction {
    case submitGuess(guess: String, boardIndex: Int? = nil, applyToAll: Bool = false)
    case submitHint(hintWord: String, hintEvaluation: GuessResult, boardIndex: Int? = nil)
    case nextBoard
    case nextStage(elapsedMs: Double? = nil)
    case stealGuess
    case blackoutRestart(boardIndex: Int)
    case abandon
    case reset(seed: String, mode: GameMode)
    case restoreState(state: GameState)
}

// MARK: - Constants

public let gauntletStages: [GauntletStageConfig] = [
    GauntletStageConfig(stageIndex: 0, name: "The Opening",  baseMode: .duel,     boardCount: 1, maxGuesses: 6,  sequential: false, hasPrefill: false),
    GauntletStageConfig(stageIndex: 1, name: "QuadWord",     baseMode: .quordle,  boardCount: 4, maxGuesses: 9,  sequential: false, hasPrefill: false),
    GauntletStageConfig(stageIndex: 2, name: "Succession",   baseMode: .sequence, boardCount: 4, maxGuesses: 10, sequential: true,  hasPrefill: false),
    GauntletStageConfig(stageIndex: 3, name: "Deliverance",  baseMode: .rescue,   boardCount: 4, maxGuesses: 6,  sequential: false, hasPrefill: true),
    GauntletStageConfig(stageIndex: 4, name: "OctoWord",     baseMode: .octordle, boardCount: 8, maxGuesses: 13, sequential: false, hasPrefill: false),
]

public let gauntletTotalSolutions: Int = gauntletStages.reduce(0) { $0 + $1.boardCount }
