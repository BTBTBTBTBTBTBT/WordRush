import SwiftUI
import WordociousCore

/// Drives a single-board game (DUEL / DUEL_6 / DUEL_7) from the pure engine.
/// Holds the current typed-but-unsubmitted row separately from the committed
/// guesses in GameState.
@MainActor
final class GameViewModel: ObservableObject {
    @Published private(set) var state: GameState
    @Published var currentInput: String = ""
    @Published var toast: String?
    @Published private(set) var lastEvaluations: [GuessResult] = []

    let mode: GameMode
    let wordLength: Int
    private let persistence = GamePersistence.shared

    var board: BoardState { state.boards[0] }
    var maxGuesses: Int { board.maxGuesses }
    var status: GameStatus { state.status }
    var isFinished: Bool { status != .playing }
    var solution: String { board.solution }

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
        guard !isFinished else { return }
        guard currentInput.count < wordLength else { return }
        currentInput += letter.uppercased()
    }

    func delete() {
        guard !currentInput.isEmpty else { return }
        currentInput.removeLast()
    }

    func submit() {
        guard !isFinished else { return }
        guard currentInput.count == wordLength else {
            flash("Not enough letters")
            return
        }
        let guess = currentInput.uppercased()
        guard GameDictionary.shared.isValidWord(guess) else {
            flash("Not in word list")
            return
        }

        let before = state.boards[0].guesses.count
        state = gameReducer(state: state, action: .submitGuess(guess: guess, boardIndex: nil, applyToAll: false))
        let after = state.boards[0].guesses.count

        if after > before {
            currentInput = ""
            recomputeEvaluations()
            persistence.save(state)
            if state.status == .won { flash("Solved!") }
            else if state.status == .lost { flash(solution) }
        }
    }

    // MARK: - Keyboard letter states

    /// Best-known state per letter across all committed guesses, for keyboard coloring.
    func keyState(for letter: String) -> TileState? {
        var best: TileState?
        for eval in lastEvaluations {
            for tile in eval.tiles where tile.letter == letter.uppercased() {
                best = Self.merge(best, tile.state)
            }
        }
        return best
    }

    private static func merge(_ a: TileState?, _ b: TileState) -> TileState {
        // correct > present > absent
        let rank: (TileState) -> Int = {
            switch $0 { case .correct: return 3; case .present: return 2; case .absent: return 1; default: return 0 }
        }
        guard let a else { return b }
        return rank(b) > rank(a) ? b : a
    }

    // MARK: - Helpers

    private func recomputeEvaluations() {
        lastEvaluations = board.guesses.map { evaluateGuess(solution: solution, guess: $0) }
    }

    func evaluation(forRow row: Int) -> GuessResult? {
        guard row < lastEvaluations.count else { return nil }
        return lastEvaluations[row]
    }

    private func flash(_ message: String) {
        toast = message
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if toast == message { toast = nil }
        }
    }
}
