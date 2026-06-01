import Foundation
import WordociousCore

/// Composite-score formula ported 1:1 from apps/web/lib/daily-service.ts
/// (MODE_SCORE_CONFIG + computeScoreBreakdown). Must stay identical to web so
/// iOS results rank correctly on the shared leaderboard.
enum DailyScoring {
    struct Config {
        let maxGuesses: Int
        let guessWeight: Int
        let timeCap: Int
        let totalBoards: Int
        let hintCost: Int?
    }

    static let config: [String: Config] = [
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

    /// Full per-component breakdown — 1:1 with computeScoreBreakdown in
    /// lib/daily-service.ts. Drives both the leaderboard score and the
    /// post-game ScoreBreakdown card (so they can never drift).
    struct Breakdown {
        let basePoints: Double, guessBonus: Double, timeBonus: Double
        let completionBonus: Double, hintPenalty: Double, total: Double
        let hasHints: Bool
        let maxGuesses: Int, timeCap: Int, guessWeight: Int, hintCost: Int
    }

    static func breakdown(
        gameMode: String, completed: Bool, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0
    ) -> Breakdown {
        guard let c = config[gameMode] else {
            return Breakdown(basePoints: 0, guessBonus: 0, timeBonus: 0, completionBonus: 0,
                             hintPenalty: 0, total: 0, hasHints: false,
                             maxGuesses: 0, timeCap: 0, guessWeight: 0, hintCost: 0)
        }
        let hasHints = c.hintCost != nil
        let basePoints = completed ? 1000.0 : 0.0
        // Guess bonus applies ONLY to hint-bearing modes (Six/Seven/
        // ProperNoundle) — matches lib/daily-service.ts.
        let guessBonus = (completed && hasHints) ? Double(max(0, c.maxGuesses - guessCount) * c.guessWeight) : 0.0
        let timeBonus = completed ? Double(max(0, c.timeCap - timeSeconds)) : 0.0
        let completionBonus = (Double(boardsSolved) / Double(max(1, totalBoards))) * 200.0
        let hintPenalty = hasHints ? Double(hintsUsed * (c.hintCost ?? 0)) : 0.0
        let total = ((max(0, basePoints + guessBonus + timeBonus + completionBonus - hintPenalty)) * 100).rounded() / 100
        return Breakdown(basePoints: basePoints, guessBonus: guessBonus, timeBonus: timeBonus,
                         completionBonus: completionBonus, hintPenalty: hintPenalty, total: total,
                         hasHints: hasHints, maxGuesses: c.maxGuesses, timeCap: c.timeCap,
                         guessWeight: c.guessWeight, hintCost: c.hintCost ?? 0)
    }

    static func compositeScore(
        gameMode: String, completed: Bool, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0
    ) -> Double {
        breakdown(gameMode: gameMode, completed: completed, guessCount: guessCount,
                  timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
                  hintsUsed: hintsUsed).total
    }
}
