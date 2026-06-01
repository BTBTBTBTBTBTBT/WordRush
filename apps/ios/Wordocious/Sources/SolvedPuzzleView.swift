import SwiftUI
import WordociousCore

/// Read-only "View Solved Puzzle" — reconstructs a completed daily from its
/// `matches` row (guesses + solutions) so it works cross-device, not just from
/// the local session. Evaluates each guess against each board's solution and
/// renders the grid + score breakdown + definition (no keyboard).
struct SolvedPuzzleView: View {
    let mode: GameMode
    let title: String
    @Environment(\.dismiss) private var dismiss

    @State private var data: MatchStatsService.SolvedDaily?
    @State private var loaded = false
    @State private var maxGuesses = 0

    private var tileSize: CGFloat {
        switch data?.solutions.count ?? 1 {
        case 1: return 48
        case 2: return 40
        case 3...4: return 34
        default: return 30
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if !loaded {
                ProgressView().controlSize(.large).tint(Theme.primary)
            } else if let d = data {
                ScrollView {
                    VStack(spacing: 10) {
                        FinishedStatsHeader(
                            mode: mode, won: d.won,
                            guessCount: d.guessCount, maxGuesses: maxGuesses,
                            timeSeconds: d.timeSeconds,
                            boardsSolved: d.won ? d.solutions.count : solvedCount(d),
                            totalBoards: d.solutions.count,
                            onHome: { dismiss() })
                        DailyRankBadge(gameMode: mode)
                        boards(d)
                        ScoreBreakdownView(gameMode: mode.rawValue, completed: d.won,
                                           guessCount: d.guessCount, timeSeconds: d.timeSeconds,
                                           boardsSolved: d.won ? d.solutions.count : 0, totalBoards: d.solutions.count)
                        if d.solutions.count == 1 { DefinitionCard(solution: d.solutions[0]) }
                    }
                    .padding(.horizontal, 12).padding(.bottom, 16)
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "questionmark.folder").font(.system(size: 36)).foregroundStyle(Theme.textMuted)
                    Text("Couldn't load your solved puzzle").font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                    Button("Home") { dismiss() }.font(Brand.font(15, .black)).foregroundStyle(Theme.primary)
                }
            }

            // Corner Home button (consistent with GameScreen).
            Button { dismiss() } label: {
                Image(systemName: "house.fill").font(.system(size: 20)).foregroundStyle(ModeStyle.accent(mode))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(ModeStyle.accent(mode), lineWidth: 2))
                    .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, 8).padding(.leading, 8)
        }
        .navigationBarBackButtonHidden(true)
        .task {
            let seed = DailySeed.today(mode: mode)
            data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
            maxGuesses = createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 0
            loaded = true
        }
    }

    private func solvedCount(_ d: MatchStatsService.SolvedDaily) -> Int {
        d.solutions.filter { sol in d.guesses.contains { $0.uppercased() == sol.uppercased() } }.count
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
        if d.solutions.count == 1 {
            board(solution: d.solutions[0], guesses: d.guesses, multi: false)
        } else {
            let cols = Array(repeating: GridItem(.flexible(), spacing: 10), count: 2)
            LazyVGrid(columns: cols, spacing: 14) {
                ForEach(Array(d.solutions.enumerated()), id: \.offset) { _, sol in
                    board(solution: sol, guesses: d.guesses, multi: true)
                }
            }
        }
    }

    private func board(solution: String, guesses: [String], multi: Bool) -> some View {
        let solved = guesses.contains { $0.uppercased() == solution.uppercased() }
        // Filled rows = guesses this board received up to (and including) the one
        // that solved it; then empty filler to maxGuesses so every board is the
        // same height (web parity).
        var rows: [GuessResult] = []
        for g in guesses {
            rows.append(evaluateGuess(solution: solution, guess: g))
            if g.uppercased() == solution.uppercased() { break }
        }
        let width = solution.count
        let total = max(rows.count, maxGuesses)
        return VStack(spacing: tileSize * 0.1) {
            ForEach(0..<total, id: \.self) { i in
                HStack(spacing: tileSize * 0.1) {
                    if i < rows.count {
                        ForEach(rows[i].tiles.indices, id: \.self) { c in
                            TileView(letter: rows[i].tiles[c].letter, state: rows[i].tiles[c].state, revealed: true, size: tileSize)
                        }
                    } else {
                        ForEach(0..<width, id: \.self) { _ in
                            TileView(letter: "", state: .empty, revealed: false, size: tileSize)
                        }
                    }
                }
            }
        }
        .modifier(SolvedBoardFrame(won: multi && solved, lost: multi && !solved, active: multi, tileSize: tileSize))
    }
}
