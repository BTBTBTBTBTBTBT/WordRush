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

    private var tileSize: CGFloat {
        switch data?.solutions.count ?? 1 {
        case 1: return 48
        case 2...4: return 30
        default: return 18
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
                        header(d)
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
            data = await MatchStatsService.solvedDaily(mode: mode, seed: DailySeed.today(mode: mode))
            loaded = true
        }
    }

    private func header(_ d: MatchStatsService.SolvedDaily) -> some View {
        VStack(spacing: 4) {
            Text(ModeStyle.title(mode)).font(Brand.font(28, .black))
                .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
            Text(d.won ? "Solved in \(d.guessCount) guesses  ·  \(timeString(d.timeSeconds))"
                       : "Out of guesses  ·  \(timeString(d.timeSeconds))")
                .font(Brand.font(12, .bold)).foregroundStyle(d.won ? Color(hex: 0x16A34A) : Color(hex: 0xF87171))
        }
        .padding(.top, 8)
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
        if d.solutions.count == 1 {
            board(solution: d.solutions[0], guesses: d.guesses)
        } else {
            let cols = Array(repeating: GridItem(.flexible(), spacing: 10), count: 2)
            LazyVGrid(columns: cols, spacing: 14) {
                ForEach(Array(d.solutions.enumerated()), id: \.offset) { _, sol in
                    board(solution: sol, guesses: d.guesses)
                }
            }
        }
    }

    private func board(solution: String, guesses: [String]) -> some View {
        let solved = guesses.contains { $0.uppercased() == solution.uppercased() }
        // Show rows up to the solving guess (stop once solved), like the played board.
        var rows: [GuessResult] = []
        for g in guesses {
            rows.append(evaluateGuess(solution: solution, guess: g))
            if g.uppercased() == solution.uppercased() { break }
        }
        return VStack(spacing: tileSize * 0.1) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                HStack(spacing: tileSize * 0.1) {
                    ForEach(Array(r.tiles.enumerated()), id: \.offset) { _, t in
                        TileView(letter: t.letter, state: t.state, revealed: true, size: tileSize)
                    }
                }
            }
        }
        .opacity(solved ? 0.9 : 1)
    }

    private func timeString(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}
