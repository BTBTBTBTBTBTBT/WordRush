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
    /// Gauntlet run (stages + per-stage results/snapshots) when this is a
    /// completed Gauntlet daily — drives the dedicated stage-by-stage card.
    @State private var gauntlet: GauntletProgress?
    @State private var localWon = false
    @State private var elapsedMs = 0

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
            } else if mode == .gauntlet, let g = gauntlet {
                GauntletResultsView(progress: g, won: localWon, mode: mode, isDaily: true,
                                    elapsedMsFallback: elapsedMs, onHome: { dismiss() }, onShare: { share() })
            } else if let d = data, mode != .gauntlet {
                ScrollView {
                    VStack(spacing: 10) {
                        FinishedStatsHeader(
                            mode: mode, won: d.won,
                            guessCount: d.guessCount, maxGuesses: maxGuesses,
                            timeSeconds: d.timeSeconds,
                            boardsSolved: d.won ? d.solutions.count : solvedCount(d),
                            totalBoards: d.solutions.count,
                            onHome: { dismiss() }, onShare: { share() })
                        DailyRankBadge(gameMode: mode)
                        boards(d)
                        ScoreBreakdownView(gameMode: mode.rawValue, completed: d.won,
                                           guessCount: d.guessCount, timeSeconds: d.timeSeconds,
                                           boardsSolved: d.won ? d.solutions.count : 0, totalBoards: d.solutions.count,
                                           day: LeaderboardService.todayLocal())
                        // Single-board modes (Classic / Six / Seven): word + definition,
                        // using the actual displayed board's solution (reliable).
                        // ProperNoundle answers are proper nouns (not in the dictionary)
                        // — its clue/photo stand in for the definition, so skip the card.
                        if let only = displayBoards(d).first, displayBoards(d).count == 1, mode != .propernoundle {
                            DefinitionCard(solution: only.solution)
                        }
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

            // Corner Home button on every completed screen — including Gauntlet —
            // matching the web GameHomeButton (gauntlet-game.tsx also renders it
            // alongside its top Home/Share links).
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
        // Left-edge swipe → back to Home (parity with the web back gesture).
        .swipeToGoBack { dismiss() }
        .task {
            let seed = DailySeed.today(mode: mode)
            // Prefer the local saved game (correct per-board state for every mode).
            if let state = GamePersistence.shared.load(seed: seed, mode: mode),
               state.status == .won || state.status == .lost {
                localBoards = state.boards
                gauntlet = state.gauntlet
                localWon = state.status == .won
            }
            data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
            // The matches insert is fire-and-forget at game end — if the player
            // taps the completed card immediately, the row can still be in
            // flight. One short retry covers the race.
            if data == nil, localBoards == nil {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                data = await MatchStatsService.solvedDaily(mode: mode, seed: seed)
            }
            maxGuesses = createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 0
            let savedMs = Int(GamePersistence.shared.loadElapsed(seed: seed, mode: mode))
            elapsedMs = savedMs > 0 ? savedMs : (data?.timeSeconds ?? 0) * 1000
            // Gauntlet played on another device: no local session, so rebuild the
            // stage breakdown from the server-persisted matches.gauntlet_stages.
            if mode == .gauntlet, gauntlet == nil, let sg = await MatchStatsService.gauntletStages(seed: seed) {
                gauntlet = GauntletProgress(
                    currentStage: sg.stages.count, totalStages: sg.stages.count,
                    stages: sg.stages, stageResults: sg.stageResults,
                    stageStartTime: 0, allSolutions: [], blackoutCount: 0)
                localWon = (data?.won ?? false)
            }
            // Last resort (no local session, no server stage data): rebuild the
            // stage breakdown by replaying the recorded guesses through the engine
            // so the proper results screen shows — never the generic board grid.
            if mode == .gauntlet, gauntlet == nil, let d = data, !d.guesses.isEmpty,
               let r = GauntletReconstruct.reconstruct(seed: seed, guesses: d.guesses) {
                gauntlet = r.progress
                localWon = r.won
            }
            // No matches row (failed/in-flight insert) but the LOCAL finished game
            // exists: synthesize the display payload from it so the review always
            // renders for on-device plays — never "Couldn't load".
            if data == nil, let lb = localBoards {
                // Use the LONGEST board's guess list: solved boards stop
                // accumulating (board 0 solving on row 6 of a 10-guess
                // Succession would report "6"), so the board with the most
                // guesses holds the complete shared history — same MAX
                // semantics as rowsUsed / the recorded player1_score.
                let fullHistory = lb.max(by: { $0.guesses.count < $1.guesses.count })?.guesses ?? []
                data = MatchStatsService.SolvedDaily(
                    guesses: fullHistory,
                    solutions: lb.map(\.solution),
                    won: localWon,
                    guessCount: fullHistory.count,
                    timeSeconds: elapsedMs / 1000,
                    hintsUsed: 0)
            }
            loaded = true
        }
    }

    private func solvedCount(_ d: MatchStatsService.SolvedDaily) -> Int {
        d.solutions.filter { sol in d.guesses.contains { $0.uppercased() == sol.uppercased() } }.count
    }

    /// Boards to display/share: local saved per-board state, else a mode-aware
    /// reconstruction (sequence-correct) from the matches row.
    private func displayBoards(_ d: MatchStatsService.SolvedDaily) -> [BoardState] {
        localBoards ?? CompletedBoardReconstruct.boards(mode: mode, seed: DailySeed.today(mode: mode),
                                                        solutions: d.solutions,
                                                        guesses: d.guesses, maxGuesses: maxGuesses)
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
        let bs = displayBoards(d)
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

    /// A board's evaluated rows (prefilled + guesses), padded to its full row
    /// count — mirrors the web `boardToGrid` used by the share image.
    private func grid(_ b: BoardState) -> [[TileState]] {
        var rows: [[TileState]] = []
        for p in b.prefilledGuesses ?? [] { rows.append(p.evaluation.tiles.map(\.state)) }
        for g in b.guesses {
            let ev = b.hintEvaluations?[g] ?? evaluateGuess(solution: b.solution, guess: g)
            rows.append(ev.tiles.map(\.state))
        }
        let total = (b.prefilledGuesses?.count ?? 0) + b.maxGuesses
        let w = b.solution.count
        while rows.count < total { rows.append(Array(repeating: .empty, count: w)) }
        return rows
    }

    /// Build the share card from the completed data and present the share sheet
    /// (same ShareService the live post-game screen uses → identical image).
    private func share() {
        let kind: ShareCardView.Kind
        if mode == .gauntlet, let g = gauntlet {
            let stages = g.stages.map { st -> GauntletStageShare in
                let r = g.stageResults.first { $0.stageIndex == st.stageIndex }
                let snap = r?.boardsSnapshot ?? []
                return GauntletStageShare(name: st.name, won: r?.status == .won,
                                          guesses: r?.guesses ?? 0,
                                          boardsSolved: snap.filter { $0.status == .won }.count,
                                          totalBoards: st.boardCount)
            }
            let cleared = stages.filter { $0.won }.count
            ShareService.share(kind: .gauntlet(stages: stages, stagesCompleted: cleared, totalStages: g.totalStages),
                               mode: mode, modeLabel: ModeStyle.shareLabel(mode), accent: ModeStyle.accent(mode),
                               won: localWon, guesses: g.stageResults.reduce(0) { $0 + $1.guesses },
                               maxGuesses: 0, timeSeconds: elapsedMs / 1000)
            return
        }
        guard let d = data else { return }
        let bs = displayBoards(d)
        if bs.count > 1 {
            kind = .multi(boards: bs.map { (grid($0), $0.status == .won) },
                          boardsSolved: d.won ? bs.count : solvedCount(d), totalBoards: bs.count)
        } else if let first = bs.first {
            kind = .single(grid: grid(first))
        } else {
            return
        }
        ShareService.share(kind: kind, mode: mode, modeLabel: ModeStyle.shareLabel(mode), accent: ModeStyle.accent(mode),
                           won: d.won, guesses: d.guessCount, maxGuesses: maxGuesses, timeSeconds: d.timeSeconds)
    }
}
