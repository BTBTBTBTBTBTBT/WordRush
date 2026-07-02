import Foundation
import WordociousCore

/// Turns (seed, mode, difficulty) into a believable opponent trajectory — a
/// schedule of VSOpponentProgress events + a revealed guess log, ending in a
/// solve or a fail. Swift port of apps/web/lib/bot/bot-engine.ts. Runs entirely
/// on-device; LocalBotMatchService replays the plan on timers.
enum BotEngine {

    struct AdaptiveHint {
        var winRate: Double = 0.5
        var avgGuesses: Int? = nil
    }

    struct BuildOpts {
        var targetGuesses: Int? = nil
        /// Pin the bot's total solve time (ms) — ghost races replay a pace.
        var targetSolveMs: Double? = nil
        var forceSolve: Bool = false
        var adaptive: AdaptiveHint? = nil
    }

    /// One scheduled event: a typing ping OR a progress payload.
    struct Event {
        var atMs: Double
        var typing: Bool
        var progress: VSOpponentProgress?
    }

    struct Plan {
        var totalBoards: Int
        var solved: Bool
        var boardsSolved: Int
        var finishAtMs: Double
        var totalGuesses: Int
        var events: [Event]
        /// Gauntlet: when the opponent clears each stage (drives the 5-node stepper).
        var stageEvents: [(atMs: Double, stageIndex: Int)]
        var guessLog: [VSGuessLogEntry]
        var solutions: [String]
    }

    /// Board index that COMPLETES each Gauntlet stage (last board of the stage).
    private static let gauntletStageLastBoard: [Int] = {
        var out: [Int] = []; var cum = 0
        for s in gauntletStages { cum += s.boardCount; out.append(cum - 1) }
        return out // [0, 4, 8, 12, 20]
    }()

    private struct DiffParams {
        var perGuessMinMs: Double
        var perGuessMaxMs: Double
        var minGuesses: Int
        var maxGuesses: Int
        var failChance: Double
    }

    private static func params(_ tier: BotTier) -> DiffParams {
        switch tier {
        case .easy: return DiffParams(perGuessMinMs: 12000, perGuessMaxMs: 20000, minGuesses: 5, maxGuesses: 6, failChance: 0.30)
        case .medium: return DiffParams(perGuessMinMs: 7000, perGuessMaxMs: 12000, minGuesses: 4, maxGuesses: 5, failChance: 0.10)
        case .hard: return DiffParams(perGuessMinMs: 3000, perGuessMaxMs: 6000, minGuesses: 2, maxGuesses: 4, failChance: 0.02)
        }
    }

    private static func resolveParams(_ difficulty: BotDifficulty, _ hint: AdaptiveHint?) -> DiffParams {
        guard difficulty == .adaptive else {
            return params(BotTier(rawValue: difficulty.rawValue) ?? .medium)
        }
        let wr = hint?.winRate ?? 0.5
        let target = hint?.avgGuesses ?? 4
        let minG = max(2, target - 1)
        let maxG = max(minG + 1, target + 1)
        let speed = 1 - min(1, max(0, wr)) // 0 crushing .. 1 losing
        let perMin = 4000 + speed * 8000
        return DiffParams(perGuessMinMs: perMin, perGuessMaxMs: perMin + 5000, minGuesses: minG, maxGuesses: maxG, failChance: 0.05 + speed * 0.2)
    }

    private static func greens(_ word: String, _ solution: String) -> Int {
        let w = Array(word), s = Array(solution)
        var n = 0
        for i in 0..<min(w.count, s.count) where w[i] == s[i] { n += 1 }
        return n
    }

    /// Increasing-greens path of real dictionary words toward `solution`.
    private static func realWordPath(_ solution: String, steps: Int, willSolve: Bool) -> [String] {
        let len = solution.count
        let pool = GameDictionary.shared.getAllowedWords().filter { $0.count == len && $0 != solution }
        if pool.isEmpty { return fabricatedPath(solution, steps: steps, willSolve: willSolve) }
        var path: [String] = []
        var used = Set<String>()
        let solvingIndex = willSolve ? steps - 1 : -1
        for i in 0..<steps {
            if i == solvingIndex { path.append(solution); break }
            let frac = steps > 1 ? Double(i) / Double(steps - 1) : 0
            let targetGreens = min(len - 1, Int((frac * Double(len - 1)).rounded()))
            var best: String?
            var bestDelta = Int.max
            for _ in 0..<60 {
                let cand = pool[Int.random(in: 0..<pool.count)]
                if used.contains(cand) { continue }
                let delta = abs(greens(cand, solution) - targetGreens)
                if delta < bestDelta { bestDelta = delta; best = cand; if delta == 0 { break } }
            }
            let word = best ?? pool.randomElement()!
            used.insert(word)
            path.append(word)
        }
        return path
    }

    /// Fabricated converging path for ProperNoundle / any mode without a matching
    /// dictionary — first `k` letters kept, rest scrambled; last row is the answer.
    private static func fabricatedPath(_ solution: String, steps: Int, willSolve: Bool) -> [String] {
        let bare = Array(solution.replacingOccurrences(of: " ", with: ""))
        let len = bare.count
        let letters = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        var path: [String] = []
        let solvingIndex = willSolve ? steps - 1 : -1
        for i in 0..<steps {
            if i == solvingIndex { path.append(String(bare)); break }
            let frac = steps > 1 ? Double(i) / Double(steps - 1) : 0
            let keep = min(len - 1, Int((frac * Double(len - 1)).rounded()))
            var w = ""
            for p in 0..<len { w.append(p < keep ? bare[p] : letters.randomElement()!) }
            path.append(w)
        }
        return path
    }

    private static func tiles(_ solution: String, _ guess: String) -> [String] {
        evaluateGuess(solution: solution, guess: guess).tiles.map { $0.state.rawValue }
    }

    static func buildPlan(seed: String, mode: GameMode, difficulty: BotDifficulty, opts: BuildOpts = BuildOpts()) -> Plan {
        let state = createInitialState(seed: seed, mode: mode)
        let totalBoards = VSModeInfo.totalBoards(mode)
        let p = resolveParams(difficulty, opts.adaptive)
        // Gauntlet's createInitialState boards hold only the current stage; the
        // full 21-board run comes from the seed directly (reducer parity).
        let solutions: [String]
        if mode == .gauntlet {
            solutions = generateSolutionsFromSeed(seed, count: gauntletTotalSolutions).map { $0.uppercased() }
        } else if mode == .propernoundle {
            // ProperNoundle's answer comes from its OWN puzzle set, not the
            // shared engine (which seeds PN with a dictionary word) — the bot
            // was literally playing a different answer than the player, so the
            // result screen showed the wrong solution and marked the real
            // winner "Not solved".
            let pn = ProperNoundle.puzzle(forSeed: seed)
            solutions = [pn.map { ProperNoundle.normalize($0.answer).uppercased() }
                         ?? (state.boards.first?.solution.uppercased() ?? "")]
        } else {
            solutions = state.boards.map { $0.solution.uppercased() }
        }
        let willSolveAll = opts.forceSolve ? true : Double.random(in: 0..<1) > p.failChance

        var events: [Event] = []
        var stageEvents: [(atMs: Double, stageIndex: Int)] = []
        var guessLog: [VSGuessLogEntry] = []
        var cumulativeAttempts = 0
        var boardsSolved = 0
        var lastAtMs: Double = 0

        for bi in 0..<totalBoards {
            let solution = bi < solutions.count ? solutions[bi] : (solutions.first ?? "")
            let steps = opts.targetGuesses ?? Int.random(in: p.minGuesses...max(p.minGuesses, p.maxGuesses))
            let boardSolves = willSolveAll ? true : bi < totalBoards - 1
            let path = mode == .propernoundle
                ? fabricatedPath(solution, steps: steps, willSolve: boardSolves)
                : realWordPath(solution, steps: steps, willSolve: boardSolves)

            var atMs = lastAtMs
            for (i, word) in path.enumerated() {
                atMs += Double.random(in: p.perGuessMinMs...max(p.perGuessMinMs, p.perGuessMaxMs))
                cumulativeAttempts += 1
                let isSolvingRow = boardSolves && i == path.count - 1
                if isSolvingRow { boardsSolved += 1 }
                if isSolvingRow && mode == .gauntlet, let stageIndex = gauntletStageLastBoard.firstIndex(of: bi) {
                    stageEvents.append((atMs: atMs, stageIndex: stageIndex))
                }
                events.append(Event(atMs: max(0, atMs - 1100), typing: true, progress: nil))
                let prog = VSOpponentProgress(
                    attempts: cumulativeAttempts,
                    solved: boardsSolved >= totalBoards,
                    boardsSolved: boardsSolved,
                    totalBoards: totalBoards,
                    latestGuess: VSOpponentLatestGuess(boardIndex: bi, tiles: tiles(solution, word)),
                    latestGuesses: nil
                )
                events.append(Event(atMs: atMs, typing: false, progress: prog))
                guessLog.append(VSGuessLogEntry(boardIndex: bi, guess: word))
            }
            lastAtMs = atMs
        }

        // Ghost pacing: rescale the whole timeline to a target total solve time.
        if let target = opts.targetSolveMs, lastAtMs > 0 {
            let scale = target / lastAtMs
            for idx in events.indices { events[idx].atMs = max(0, events[idx].atMs * scale) }
            for idx in stageEvents.indices { stageEvents[idx].atMs = max(0, stageEvents[idx].atMs * scale) }
            lastAtMs = target
        }

        events.sort { $0.atMs < $1.atMs }
        return Plan(totalBoards: totalBoards, solved: boardsSolved >= totalBoards, boardsSolved: boardsSolved,
                    finishAtMs: lastAtMs, totalGuesses: cumulativeAttempts, events: events,
                    stageEvents: stageEvents, guessLog: guessLog, solutions: solutions)
    }
}
