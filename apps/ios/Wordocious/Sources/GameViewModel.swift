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
    private let persistence = GamePersistence.shared

    var boards: [BoardState] { state.boards }
    var boardCount: Int { state.boards.count }
    var isMultiBoard: Bool { state.boards.count > 1 }
    var status: GameStatus { state.status }
    var isFinished: Bool { status != .playing }

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

        if let saved = GamePersistence.shared.load(seed: seed, mode: mode) {
            state = saved
        } else {
            state = createInitialState(seed: seed, mode: mode)
        }
        recomputeEvaluations()
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
        } else {
            flash("Not in word list")
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
