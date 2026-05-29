import SwiftUI
import WordociousCore

/// Phase 0 smoke-test screen. Proves the WordociousCore package is linked
/// and the engine + bundled dictionary work on-device: it generates today's
/// daily DUEL seed, creates a game, and lets you submit a guess against the
/// real solution. This view gets replaced by the real game UI in Phase 1.
struct ContentView: View {
    @State private var state: GameState?
    @State private var guess: String = ""
    @State private var lastResult: GuessResult?
    @State private var seed: String = ""

    var body: some View {
        VStack(spacing: 20) {
            Text("Wordocious")
                .font(.largeTitle).bold()
            Text("Phase 0 · engine smoke test")
                .font(.caption).foregroundStyle(.secondary)

            if let state {
                Text("Seed: \(seed)")
                    .font(.caption2).foregroundStyle(.secondary)
                Text("Status: \(state.status.rawValue)")
                    .font(.headline)

                if let board = state.boards.first {
                    Text("Solution length: \(board.solution.count) · guesses: \(board.guesses.count)/\(board.maxGuesses)")
                        .font(.subheadline)
                }

                if let lastResult {
                    HStack(spacing: 4) {
                        ForEach(Array(lastResult.tiles.enumerated()), id: \.offset) { _, tile in
                            Text(tile.letter)
                                .font(.title2).bold()
                                .frame(width: 40, height: 40)
                                .background(color(for: tile.state))
                                .foregroundStyle(.white)
                                .cornerRadius(6)
                        }
                    }
                }

                TextField("Type a 5-letter guess", text: $guess)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 40)

                Button("Submit guess") { submit() }
                    .buttonStyle(.borderedProminent)
                    .disabled(guess.count != 5)
            } else {
                ProgressView()
            }
        }
        .padding()
        .onAppear(perform: start)
    }

    private func start() {
        DictionaryLoader.ensureInitialized()
        let today = ISO8601DateFormatter.dateOnly.string(from: Date())
        let s = generateDailySeed(date: today, gameMode: GameMode.duel.rawValue)
        seed = s
        state = createInitialState(seed: s, mode: .duel)
    }

    private func submit() {
        guard var current = state else { return }
        let g = guess.uppercased()
        if isValidWordToplevel(g), let solution = current.boards.first?.solution {
            lastResult = evaluateGuess(solution: solution, guess: g)
        }
        current = gameReducer(state: current, action: .submitGuess(guess: g, boardIndex: nil, applyToAll: false))
        state = current
        guess = ""
    }

    private func isValidWordToplevel(_ word: String) -> Bool {
        GameDictionary.shared.isValidWord(word)
    }

    private func color(for s: TileState) -> Color {
        switch s {
        case .correct: return .green
        case .present: return .yellow
        case .absent: return .gray
        default: return .secondary
        }
    }
}

private extension ISO8601DateFormatter {
    static let dateOnly: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()
}
