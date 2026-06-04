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
    /// Local per-board state (correct for every mode incl. sequence/rescue);
    /// preferred over the flat matches-row reconstruction when this device played it.
    @State private var localBoards: [BoardState]?
    @State private var gauntlet: GauntletProgress?
    @State private var elapsedMs = 0

    private var boardCount: Int { localBoards?.count ?? data?.solutions.count ?? 1 }

    /// Header summary: gauntlet shows stages/guesses/time, others guesses·time.
    private func summaryLabel(_ d: MatchStatsService.SolvedDaily) -> String {
        if mode == .gauntlet, let g = gauntlet {
            let cleared = g.stageResults.filter { $0.status == .won }.count
            let guesses = g.stageResults.reduce(0) { $0 + $1.guesses }
            // Total time = sum of per-stage times (authoritative cross-device);
            // fall back to elapsedMs only if stages carry no recorded times.
            let stageMs = g.stageResults.reduce(0) { $0 + $1.timeMs }
            let secs = (stageMs > 0 ? stageMs : elapsedMs) / 1000
            return "\(cleared)/\(g.totalStages) · \(guesses)g · \(timeString(secs))"
        }
        return "\(d.guessCount) · \(timeString(d.timeSeconds))"
    }

    /// Web-parity responsive tile size so all boards fit on one screen.
    private var tileSize: CGFloat {
        CompletedBoardLayout.tileSize(boardCount: boardCount,
                                      wordLen: localBoards?.first?.solution.count ?? data?.solutions.first?.count ?? 5)
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
                            Text(summaryLabel(d))
                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.textMuted).rotationEffect(.degrees(expanded ? 180 : 0))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .contentShape(Rectangle())   // whole header tappable
                    }.buttonStyle(.plain)

                    if expanded {
                        if mode == .gauntlet, let g = gauntlet {
                            let stageMs = g.stageResults.reduce(0) { $0 + $1.timeMs }
                            let totalMs = stageMs > 0 ? stageMs : elapsedMs
                            let totalGuesses = g.stageResults.reduce(0) { $0 + $1.guesses }
                            // Cumulative boards solved across stages — same tally the
                            // score is recorded with (matches the post-game breakdown).
                            let cumBoards = g.stageResults.reduce(0) { acc, r in
                                guard let st = g.stages.first(where: { $0.stageIndex == r.stageIndex }) else { return acc }
                                return acc + (r.status == .won ? st.boardCount : (r.boardsSnapshot?.filter { $0.status == .won }.count ?? 0))
                            }
                            let cumTotal = max(1, g.stages.reduce(0) { $0 + $1.boardCount })
                            VStack(spacing: 8) {
                                GauntletCompletedView(progress: g, totalTimeMs: totalMs)
                                // Score breakdown underneath, matching every other completed screen.
                                ScoreBreakdownView(gameMode: "GAUNTLET", completed: won, guessCount: totalGuesses,
                                                   timeSeconds: totalMs / 1000, boardsSolved: cumBoards, totalBoards: cumTotal)
                            }
                            .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                        } else if mode != .gauntlet {
                            VStack(spacing: 8) {
                                boards(d)
                                if d.solutions.count == 1 {
                                    Text(d.solutions[0].uppercased()).font(Brand.font(18, .black)).tracking(2).foregroundStyle(Theme.textPrimary)
                                }
                                HStack(spacing: 20) {
                                    stat("\(d.guessCount)", "GUESSES")
                                    stat(timeString(d.timeSeconds), "TIME")
                                }
                                // Full score breakdown (same card as post-game) below the stats.
                                ScoreBreakdownView(gameMode: mode.rawValue, completed: won,
                                                   guessCount: d.guessCount, timeSeconds: d.timeSeconds,
                                                   boardsSolved: won ? boardCount : 0, totalBoards: boardCount,
                                                   hintsUsed: d.hintsUsed)
                            }
                            .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                        }
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .task(id: mode.rawValue) {
            // Reset per-mode state up front — otherwise a previously-viewed mode's
            // data (notably the Gauntlet stage breakdown) leaks into this mode when
            // its own local save isn't reloaded, rendering e.g. Gauntlet's stages
            // under Classic.
            localBoards = nil; gauntlet = nil; data = nil
            let seed = DailySeed.today(mode: mode)
            if let state = GamePersistence.shared.load(seed: seed, mode: mode),
               state.status == .won || state.status == .lost {
                localBoards = state.boards
                gauntlet = state.gauntlet
            }
            data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
            maxGuesses = createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 6
            let savedMs = Int(GamePersistence.shared.loadElapsed(seed: seed, mode: mode))
            elapsedMs = savedMs > 0 ? savedMs : (data?.timeSeconds ?? 0) * 1000
            // Gauntlet played on another device → rebuild stage breakdown from
            // the server-persisted matches.gauntlet_stages.
            if mode == .gauntlet, gauntlet == nil, let sg = await MatchStatsService.gauntletStages(seed: seed) {
                gauntlet = GauntletProgress(
                    currentStage: sg.stages.count, totalStages: sg.stages.count,
                    stages: sg.stages, stageResults: sg.stageResults,
                    stageStartTime: 0, allSolutions: [], blackoutCount: 0)
            }
            // Last resort: replay the recorded guesses to rebuild the stage
            // breakdown (cross-device), so the gauntlet card never falls back to
            // the generic board grid.
            if mode == .gauntlet, gauntlet == nil, let d = data, !d.guesses.isEmpty,
               let r = GauntletReconstruct.reconstruct(seed: seed, guesses: d.guesses) {
                gauntlet = r.progress
            }
            expanded = false
        }
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
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

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.font(9, .bold)).tracking(0.6).foregroundStyle(Theme.textMuted)
        }
    }

    private func timeString(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}
