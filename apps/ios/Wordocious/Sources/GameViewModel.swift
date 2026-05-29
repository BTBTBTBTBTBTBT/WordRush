import SwiftUI
import WordociousCore

/// Drives any solo mode (1..N boards) from the pure engine. A single shared
/// input row is applied to every still-playing board (applyToAll) for
/// multi-board modes; single-board modes submit to board 0.
@MainActor
final class GameViewModel: ObservableObject {
    @Published private(set) var state: GameState
    @Published var currentInput: String = ""
    @Published var toast: String?
    /// Per-board evaluations: evaluations[boardIndex][rowIndex].
    @Published private(set) var evaluations: [[GuessResult]] = []

    let mode: GameMode
    let wordLength: Int
    let isDaily: Bool
    private let persistence = GamePersistence.shared
    private var resultRecorded = false

    var boards: [BoardState] { state.boards }
    var boardCount: Int { state.boards.count }
    var isMultiBoard: Bool { state.boards.count > 1 }
    var status: GameStatus { state.status }
    var isFinished: Bool { status != .playing }

    // MARK: - Gauntlet

    var isGauntlet: Bool { mode == .gauntlet }

    /// All boards in the current stage solved, but the run isn't over yet —
    /// the player taps Continue to advance (or finish) via NEXT_STAGE.
    var stageCleared: Bool {
        isGauntlet && status == .playing && !state.boards.isEmpty && state.boards.allSatisfy { $0.status == .won }
    }

    var gauntletStageLabel: String? {
        guard isGauntlet, let g = state.gauntlet else { return nil }
        let name = g.stages[safe: g.currentStage]?.name ?? ""
        return "Stage \(g.currentStage + 1)/\(g.totalStages) · \(name)"
    }

    var isLastStage: Bool {
        guard let g = state.gauntlet else { return false }
        return g.currentStage >= g.totalStages - 1
    }

    /// Advance to the next stage (or finish the run on the last stage).
    func nextStage() {
        guard isGauntlet, stageCleared else { return }
        let elapsedMs = Date().timeIntervalSince1970 * 1000 - state.startTime
        state = gameReducer(state: state, action: .nextStage(elapsedMs: elapsedMs))
        currentInput = ""
        recomputeEvaluations()
        persistence.save(state)
        if isFinished { recordResultIfNeeded() }   // last stage → WON
    }

    /// Max rows to render = the largest maxGuesses across boards (multi-board
    /// modes share a guess budget; single boards use their own).
    var maxGuesses: Int { state.boards.map(\.maxGuesses).max() ?? 6 }

    init(seed: String, mode: GameMode) {
        self.mode = mode
        switch mode {
        case .duel6: wordLength = 6
        case .duel7: wordLength = 7
        default: wordLength = 5
        }

        self.isDaily = isDailySeed(seed)
        if let saved = GamePersistence.shared.load(seed: seed, mode: mode) {
            state = saved
        } else {
            state = createInitialState(seed: seed, mode: mode)
        }
        recomputeEvaluations()
        // A game restored from disk that's already finished shouldn't re-post.
        resultRecorded = state.status != .playing
    }

    // MARK: - Input

    func type(_ letter: String) {
        guard !isFinished, currentInput.count < wordLength else { return }
        currentInput += letter.uppercased()
    }

    func delete() {
        guard !currentInput.isEmpty else { return }
        currentInput.removeLast()
    }

    func submit() {
        guard !isFinished else { return }
        guard currentInput.count == wordLength else { flash("Not enough letters"); return }
        let guess = currentInput.uppercased()
        guard GameDictionary.shared.isValidWord(guess) else { flash("Not in word list"); return }

        let beforeGuessCount = totalGuesses
        let action: GameAction = isMultiBoard
            ? .submitGuess(guess: guess, boardIndex: nil, applyToAll: true)
            : .submitGuess(guess: guess, boardIndex: 0, applyToAll: false)
        state = gameReducer(state: state, action: action)

        if totalGuesses != beforeGuessCount {
            currentInput = ""
            recomputeEvaluations()
            persistence.save(state)
            if state.status == .won { flash("Solved!") }
            else if state.status == .lost { flash(lossMessage) }
            if isFinished { recordResultIfNeeded() }
        } else {
            flash("Not in word list")
        }
    }

    /// Post the finished daily result to Supabase (once). No-ops for
    /// non-daily games or when signed out (handled in the service).
    private func recordResultIfNeeded() {
        guard isDaily, !resultRecorded else { return }
        resultRecorded = true
        let elapsedSeconds = max(0, Int((Date().timeIntervalSince1970 * 1000 - state.startTime) / 1000))
        let completed = state.status == .won
        let modeRaw = mode

        let guesses: Int
        let solved: Int
        let total: Int

        if isGauntlet, let g = state.gauntlet {
            // Mirror web gauntlet-game recording: sum across stageResults.
            // On WON the final NEXT_STAGE already pushed the last stage, so the
            // current boards would double-count → currentStageGuesses = 0.
            // On LOST the failed stage is in stageResults (with snapshot).
            let completedStageGuesses = g.stageResults.reduce(0) { $0 + $1.guesses }
            let currentStageGuesses = completed ? 0 : state.boards.reduce(0) { max($0, $1.guesses.count) }
            guesses = completedStageGuesses + currentStageGuesses
            solved = g.stageResults.reduce(0) { sum, r in
                if r.status == .won { return sum + (g.stages[safe: r.stageIndex]?.boardCount ?? 0) }
                return sum + (r.boardsSnapshot?.filter { $0.status == .won }.count ?? 0)
            }
            total = g.stageResults.reduce(0) { $0 + (g.stages[safe: $1.stageIndex]?.boardCount ?? 0) }
        } else {
            guesses = rowsUsed
            solved = state.boards.filter { $0.status == .won }.count
            total = boardCount
        }

        let theSeed = state.seed
        Task {
            await GameResultsService.record(
                gameMode: modeRaw, won: completed, guessCount: guesses,
                timeSeconds: elapsedSeconds, boardsSolved: solved, totalBoards: total,
                seed: theSeed
            )
        }
    }

    // MARK: - Rendering helpers

    /// Number of guesses already committed (rows used). For multi-board modes
    /// every board shares the same guess list length, so board 0 is canonical.
    var rowsUsed: Int { state.boards.first?.guesses.count ?? 0 }

    private var totalGuesses: Int { state.boards.map(\.guesses.count).reduce(0, +) }

    func board(_ i: Int) -> BoardState { state.boards[i] }

    func evaluation(board: Int, row: Int) -> GuessResult? {
        guard board < evaluations.count, row < evaluations[board].count else { return nil }
        return evaluations[board][row]
    }

    /// Best-known state per letter across every board, for keyboard coloring.
    func keyState(for letter: String) -> TileState? {
        var best: TileState?
        for boardEvals in evaluations {
            for eval in boardEvals {
                for tile in eval.tiles where tile.letter == letter.uppercased() {
                    best = Self.merge(best, tile.state)
                }
            }
        }
        return best
    }

    private static func merge(_ a: TileState?, _ b: TileState) -> TileState {
        let rank: (TileState) -> Int = {
            switch $0 { case .correct: return 3; case .present: return 2; case .absent: return 1; default: return 0 }
        }
        guard let a else { return b }
        return rank(b) > rank(a) ? b : a
    }

    private var lossMessage: String {
        let unsolved = state.boards.filter { $0.status != .won }.map(\.solution)
        return unsolved.count == 1 ? unsolved[0] : "\(unsolved.count) left unsolved"
    }

    // MARK: - Internals

    private func recomputeEvaluations() {
        evaluations = state.boards.map { board in
            board.guesses.map { evaluateGuess(solution: board.solution, guess: $0) }
        }
    }

    private func flash(_ message: String) {
        toast = message
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if toast == message { toast = nil }
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
