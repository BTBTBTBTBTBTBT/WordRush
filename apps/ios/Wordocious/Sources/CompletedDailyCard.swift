import SwiftUI
import WordociousCore

/// Collapsible "your completed puzzle today" card on the leaderboard — ports
/// components/game/completed-daily-board.tsx. Shows only when the current user
/// has a daily result for the selected mode; expands to reveal their solved
/// board (reconstructed from the matches row). Current-user only.
struct CompletedDailyCard: View {
    let mode: GameMode
    @State private var data: MatchStatsService.SolvedDaily?
    @State private var expanded = false
    @State private var maxGuesses = 0

    /// Web-parity responsive tile size so all boards fit on one screen.
    private var tileSize: CGFloat {
        CompletedBoardLayout.tileSize(boardCount: data?.solutions.count ?? 1,
                                      wordLen: data?.solutions.first?.count ?? 5)
    }

    var body: some View {
        Group {
            if data == nil {
                Color.clear.frame(height: 0)   // keep the view non-empty so .task runs
            } else if let d = data {
                let won = d.won
                VStack(spacing: 0) {
                    // Top accent bar: green won / gray attempted.
                    LinearGradient(colors: won ? [Color(hex: 0x22C55E), Color(hex: 0x4ADE80)] : [Color(hex: 0x9CA3AF), Color(hex: 0xD1D5DB)],
                                   startPoint: .leading, endPoint: .trailing).frame(height: 4)

                    Button { withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { expanded.toggle() } } label: {
                        HStack(spacing: 8) {
                            Text(won ? "✓" : "✗").font(Brand.font(9, .black)).foregroundStyle(won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
                                .frame(width: 16, height: 16)
                                .background(Circle().fill(won ? Color(hex: 0xDCFCE7) : Color(hex: 0xFEE2E2)))
                            Text(won ? "COMPLETED TODAY" : "ATTEMPTED TODAY")
                                .font(Brand.font(10, .heavy)).tracking(0.6)
                                .foregroundStyle(won ? Color(hex: 0x22C55E) : Theme.textMuted)
                            Spacer()
                            Text("\(d.guessCount) · \(timeString(d.timeSeconds))")
                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.textMuted).rotationEffect(.degrees(expanded ? 180 : 0))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .contentShape(Rectangle())   // whole header tappable
                    }.buttonStyle(.plain)

                    if expanded {
                        VStack(spacing: 8) {
                            boards(d)
                            if d.solutions.count == 1 {
                                Text(d.solutions[0].uppercased()).font(Brand.font(18, .black)).tracking(2).foregroundStyle(Theme.textPrimary)
                            }
                            HStack(spacing: 20) {
                                stat("\(d.guessCount)", "GUESSES")
                                stat(timeString(d.timeSeconds), "TIME")
                            }
                        }
                        .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .task(id: mode.rawValue) {
            let seed = DailySeed.today(mode: mode)
            data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
            maxGuesses = createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 6
            expanded = false
        }
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
        if d.solutions.count == 1 {
            boardGrid(solution: d.solutions[0], guesses: d.guesses, multi: false)
        } else {
            let count = d.solutions.count
            let cols = Array(repeating: GridItem(.flexible(), spacing: CompletedBoardLayout.gridSpacing),
                             count: CompletedBoardLayout.cols(count))
            LazyVGrid(columns: cols, spacing: CompletedBoardLayout.gridSpacing) {
                ForEach(Array(d.solutions.enumerated()), id: \.offset) { _, sol in
                    boardGrid(solution: sol, guesses: d.guesses, multi: true)
                }
            }
            .frame(maxWidth: CompletedBoardLayout.maxWidth(count))
        }
    }

    private func boardGrid(solution: String, guesses: [String], multi: Bool) -> some View {
        let solved = guesses.contains { $0.uppercased() == solution.uppercased() }
        // Filled rows up to (incl.) the solving guess, then empty filler to
        // maxGuesses so every board is the same height (web parity).
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

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.font(9, .bold)).tracking(0.6).foregroundStyle(Theme.textMuted)
        }
    }

    private func timeString(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}
