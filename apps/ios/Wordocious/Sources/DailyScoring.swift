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

    static func compositeScore(
        gameMode: String,
        completed: Bool,
        guessCount: Int,
        timeSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        hintsUsed: Int = 0
    ) -> Double {
        guard let c = config[gameMode] else { return 0 }
        let basePoints = completed ? 1000.0 : 0.0
        let guessBonus = completed ? Double(max(0, c.maxGuesses - guessCount) * c.guessWeight) : 0.0
        let timeBonus = completed ? Double(max(0, c.timeCap - timeSeconds)) : 0.0
        let completionBonus = (Double(boardsSolved) / Double(max(1, totalBoards))) * 200.0
        let hintPenalty = c.hintCost.map { Double(hintsUsed * $0) } ?? 0.0
        let raw = max(0, basePoints + guessBonus + timeBonus + completionBonus - hintPenalty)
        return (raw * 100).rounded() / 100
    }
}
