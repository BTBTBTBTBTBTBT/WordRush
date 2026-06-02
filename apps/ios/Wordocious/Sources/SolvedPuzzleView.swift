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
    /// Local saved per-board state (when this device played it). Preferred over
    /// the flat matches-row reconstruction because it's correct for EVERY mode —
    /// sequence/rescue boards have independent guess streams that a single shared
    /// guess list can't represent. Falls back to `data` only for cross-device.
    @State private var localBoards: [BoardState]?

    private var boardCount: Int { localBoards?.count ?? data?.solutions.count ?? 1 }
    private var wordLen: Int { localBoards?.first?.solution.count ?? data?.solutions.first?.count ?? 5 }

    /// Web-parity responsive tile size so every board fits on one screen
    /// (no scrolling) — matches completed-daily-board.tsx.
    private var tileSize: CGFloat {
        CompletedBoardLayout.tileSize(boardCount: boardCount, wordLen: wordLen)
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
        .hidesBottomNav()
        .task {
            let seed = DailySeed.today(mode: mode)
            // Prefer the local saved game (correct per-board state for every mode).
            if let state = GamePersistence.shared.load(seed: seed, mode: mode),
               state.status == .won || state.status == .lost {
                localBoards = state.boards
            }
            data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
            maxGuesses = createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 0
            loaded = true
        }
    }

    private func solvedCount(_ d: MatchStatsService.SolvedDaily) -> Int {
        d.solutions.filter { sol in d.guesses.contains { $0.uppercased() == sol.uppercased() } }.count
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
        // Prefer the local saved per-board state; otherwise reconstruct from the
        // matches row (mode-aware so Succession's sequential boards are correct).
        let bs = localBoards ?? CompletedBoardReconstruct.boards(mode: mode, solutions: d.solutions,
                                                                 guesses: d.guesses, maxGuesses: maxGuesses)
        let rowCount = bs.map(\.maxGuesses).max() ?? 6
        if bs.count == 1 {
            CompletedMiniBoardView(board: bs[0], tileSize: tileSize, rowCount: rowCount, framed: false)
        } else {
            let cols = Array(repeating: GridItem(.flexible(), spacing: CompletedBoardLayout.gridSpacing),
                             count: CompletedBoardLayout.cols(bs.count))
            LazyVGrid(columns: cols, spacing: CompletedBoardLayout.gridSpacing) {
                ForEach(bs.indices, id: \.self) { i in
                    CompletedMiniBoardView(board: bs[i], tileSize: tileSize, rowCount: rowCount, framed: true)
                }
            }
            .frame(maxWidth: CompletedBoardLayout.maxWidth(bs.count))
        }
    }
}
