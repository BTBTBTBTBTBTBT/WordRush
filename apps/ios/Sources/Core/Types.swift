import Foundation

// MARK: - Enums

enum GameMode: String, Codable {
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

enum TileState: String, Codable {
    case correct = "CORRECT"
    case present = "PRESENT"
    case absent = "ABSENT"
    case empty = "EMPTY"
    case hintUsed = "HINT_USED"
}

enum GameStatus: String, Codable {
    case playing = "PLAYING"
    case won = "WON"
    case lost = "LOST"
    case abandoned = "ABANDONED"
}

// MARK: - Structs

struct TileResult: Codable, Equatable {
    let letter: String
    var state: TileState
}

struct GuessResult: Codable, Equatable {
    let tiles: [TileResult]
    let isCorrect: Bool
}

struct PrefilledGuess: Codable, Equatable {
    let word: String
    let evaluation: GuessResult
}

struct BoardState: Codable, Equatable {
    let solution: String
    var guesses: [String]
    var maxGuesses: Int
    var status: GameStatus
    var prefilledGuesses: [PrefilledGuess]?
    var hintEvaluations: [String: GuessResult]?
}

struct GauntletStageConfig: Codable, Equatable {
    let stageIndex: Int
    let name: String
    let baseMode: GameMode
    let boardCount: Int
    let maxGuesses: Int
    let sequential: Bool
    let hasPrefill: Bool
}

struct GauntletStageResult: Codable, Equatable {
    let stageIndex: Int
    let status: GameStatus
    let guesses: Int
    let timeMs: Int
    var boardsSnapshot: [BoardState]?
}

struct GauntletProgress: Codable, Equatable {
    var currentStage: Int
    let totalStages: Int
    let stages: [GauntletStageConfig]
    var stageResults: [GauntletStageResult]
    var stageStartTime: Double
    var stageStartElapsedMs: Double?
    var allSolutions: [String]
    var blackoutCount: Int
}

struct GameState: Codable, Equatable {
    let mode: GameMode
    let seed: String
    let startTime: Double
    var boards: [BoardState]
    var currentBoardIndex: Int
    var status: GameStatus
    var gauntlet: GauntletProgress?
}

struct ScoreBreakdown: Codable, Equatable {
    let winBonus: Int
    let guessDiff: Int
    let timeDiff: Int
    let dnfPenalty: Int
    let total: Int
}

struct MatchResult: Codable, Equatable {
    let playerWon: Bool
    let playerGuesses: Int
    let opponentGuesses: Int
    let playerTime: Double
    let opponentTime: Double
    let playerStatus: GameStatus
    let opponentStatus: GameStatus
    var score: ScoreBreakdown
}

// MARK: - Actions

enum GameAction {
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

let gauntletStages: [GauntletStageConfig] = [
    GauntletStageConfig(stageIndex: 0, name: "The Opening",  baseMode: .duel,     boardCount: 1, maxGuesses: 6,  sequential: false, hasPrefill: false),
    GauntletStageConfig(stageIndex: 1, name: "QuadWord",     baseMode: .quordle,  boardCount: 4, maxGuesses: 9,  sequential: false, hasPrefill: false),
    GauntletStageConfig(stageIndex: 2, name: "Succession",   baseMode: .sequence, boardCount: 4, maxGuesses: 10, sequential: true,  hasPrefill: false),
    GauntletStageConfig(stageIndex: 3, name: "Deliverance",  baseMode: .rescue,   boardCount: 4, maxGuesses: 6,  sequential: false, hasPrefill: true),
    GauntletStageConfig(stageIndex: 4, name: "OctoWord",     baseMode: .octordle, boardCount: 8, maxGuesses: 13, sequential: false, hasPrefill: false),
]

let gauntletTotalSolutions: Int = gauntletStages.reduce(0) { $0 + $1.boardCount }
