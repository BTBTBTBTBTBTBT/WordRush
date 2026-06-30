import Foundation

/// Composite-score formula ported 1:1 from apps/web/lib/composite-scoring.ts
/// (MODE_SCORE_CONFIG + computeScoreBreakdown). Must stay identical to web +
/// Android (DailyScoring.kt) so results rank correctly on the shared
/// leaderboard. Lives in WordociousCore (not the app target) so the
/// cross-platform fixture guard (Tests/CompositeScoringFixtureTests) can assert
/// it against the shared composite-scoring-fixtures.json.
public enum DailyScoring {
    public struct Config {
        let maxGuesses: Int
        let guessWeight: Int
        let timeCap: Int
        let totalBoards: Int
        let hintCost: Int?
    }

    public static let config: [String: Config] = [
        "DUEL":          Config(maxGuesses: 6,  guessWeight: 100, timeCap: 300,  totalBoards: 1, hintCost: nil),
        "QUORDLE":       Config(maxGuesses: 9,  guessWeight: 50,  timeCap: 600,  totalBoards: 4, hintCost: nil),
        "OCTORDLE":      Config(maxGuesses: 13, guessWeight: 30,  timeCap: 900,  totalBoards: 8, hintCost: nil),
        "SEQUENCE":      Config(maxGuesses: 10, guessWeight: 60,  timeCap: 480,  totalBoards: 4, hintCost: nil),
        "RESCUE":        Config(maxGuesses: 6,  guessWeight: 80,  timeCap: 480,  totalBoards: 4, hintCost: nil),
        "GAUNTLET":      Config(maxGuesses: 44, guessWeight: 20,  timeCap: 1800, totalBoards: 21, hintCost: nil),
        "PROPERNOUNDLE": Config(maxGuesses: 6,  guessWeight: 100, timeCap: 300,  totalBoards: 1, hintCost: 120),
        "DUEL_6":        Config(maxGuesses: 7,  guessWeight: 90,  timeCap: 360,  totalBoards: 1, hintCost: 150),
        "DUEL_7":        Config(maxGuesses: 8,  guessWeight: 80,  timeCap: 420,  totalBoards: 1, hintCost: 150),
    ]

    // Loss-credit tuning — identical to lib/composite-scoring.ts. GAUNTLET losses
    // use a stage-depth ladder + per-board tiebreak; single-board losses use a
    // near-miss credit per green letter. Other multi-board losses keep the
    // proportional boards bonus.
    static let gauntletStageLadder = [0, 25, 55, 95, 150] // index = stages fully cleared (0–4)
    static let gauntletStageBoards = [1, 4, 4, 4, 8]
    static let singleBoardGreenValue = 12

    /// Full per-component breakdown — 1:1 with computeScoreBreakdown in
    /// lib/composite-scoring.ts. Drives both the leaderboard score and the
    /// post-game ScoreBreakdown card (so they can never drift).
    public struct Breakdown {
        public let basePoints: Double, guessBonus: Double, timeBonus: Double
        public let completionBonus: Double, hintPenalty: Double, total: Double
        public let hasHints: Bool
        public let maxGuesses: Int, timeCap: Int, guessWeight: Int, hintCost: Int
    }

    public static func breakdown(
        gameMode: String, completed: Bool, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
        // Loss-only progress inputs (optional — fall back to the legacy
        // proportional boards bonus when omitted).
        stagesCompleted: Int? = nil,    // GAUNTLET: fully-cleared stage count
        bestCorrectLetters: Int? = nil  // single-board: best green-letter count
    ) -> Breakdown {
        guard let c = config[gameMode] else {
            return Breakdown(basePoints: 0, guessBonus: 0, timeBonus: 0, completionBonus: 0,
                             hintPenalty: 0, total: 0, hasHints: false,
                             maxGuesses: 0, timeCap: 0, guessWeight: 0, hintCost: 0)
        }
        let hasHints = c.hintCost != nil
        let basePoints = completed ? 1000.0 : 0.0
        // Guess bonus applies ONLY to hint-bearing modes (Six/Seven/
        // ProperNoundle) — matches lib/composite-scoring.ts.
        let guessBonus = (completed && hasHints) ? Double(max(0, c.maxGuesses - guessCount) * c.guessWeight) : 0.0
        let timeBonus = completed ? Double(max(0, c.timeCap - timeSeconds)) : 0.0
        // Completion / progress bonus — wins (and non-Gauntlet multi-board
        // losses) use the proportional boards bonus; Gauntlet + single-board
        // losses use the progress-aware credit.
        let completionBonus: Double
        if completed {
            completionBonus = (Double(boardsSolved) / Double(max(1, totalBoards))) * 200.0
        } else if gameMode == "GAUNTLET" {
            let sc = max(0, min(gauntletStageLadder.count - 1, stagesCompleted ?? 0))
            let clearedBoards = gauntletStageBoards.prefix(sc).reduce(0, +)
            let failedStageBoards = max(0, boardsSolved - clearedBoards)
            completionBonus = Double(gauntletStageLadder[sc] + 6 * failedStageBoards)
        } else if totalBoards == 1 {
            completionBonus = Double(singleBoardGreenValue * max(0, bestCorrectLetters ?? 0))
        } else {
            completionBonus = (Double(boardsSolved) / Double(max(1, totalBoards))) * 200.0
        }
        let hintPenalty = hasHints ? Double(hintsUsed * (c.hintCost ?? 0)) : 0.0
        let total = ((max(0, basePoints + guessBonus + timeBonus + completionBonus - hintPenalty)) * 100).rounded() / 100
        return Breakdown(basePoints: basePoints, guessBonus: guessBonus, timeBonus: timeBonus,
                         completionBonus: completionBonus, hintPenalty: hintPenalty, total: total,
                         hasHints: hasHints, maxGuesses: c.maxGuesses, timeCap: c.timeCap,
                         guessWeight: c.guessWeight, hintCost: c.hintCost ?? 0)
    }

    public static func compositeScore(
        gameMode: String, completed: Bool, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
        stagesCompleted: Int? = nil, bestCorrectLetters: Int? = nil
    ) -> Double {
        breakdown(gameMode: gameMode, completed: completed, guessCount: guessCount,
                  timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
                  hintsUsed: hintsUsed, stagesCompleted: stagesCompleted,
                  bestCorrectLetters: bestCorrectLetters).total
    }
}
