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
            PageBackground(tint: .forGame(mode))  // ART_SPEC §15 / §19: the game's wallpaper
            if !loaded {
                CastLoader(label: "LOADING \(ModeStyle.title(mode).uppercased())")
            } else if mode == .gauntlet, let g = gauntlet {
                GauntletResultsView(progress: g, won: localWon, mode: mode, isDaily: true,
                                    elapsedMsFallback: elapsedMs, onHome: { dismiss() }, onShare: { share() })
            } else if let d = data, mode != .gauntlet {
                // FINISH_SPEC §R2: one screen — compact header + result strip, the
                // board scaled to the height left, then the dock (share + Next daily /
                // Leaderboard + the Pro Unlimited card); the breakdown, rank and
                // definition below the dock.
                FinishedScreenLayout(header: {
                    FinishedCompactHeader(
                        mode: mode, won: d.won,
                        guessCount: d.guessCount, maxGuesses: maxGuesses,
                        timeSeconds: d.timeSeconds,
                        boardsSolved: d.won ? d.solutions.count : solvedCount(d),
                        totalBoards: d.solutions.count, points: points(d))
                }, board: { size in
                    boards(d, size: size)
                }, dock: {
                    // Founder 10-02: the SHARE RESULTS candy (+ "Next <Game> in …" inside it)
                    // rides the dock's action row (no share icon floating beside the strip).
                    NextDailyCTA(currentMode: mode.rawValue, compact: true,
                                 share: AnyView(FinishedShareCTA(nextGame: FinishedShareCTA.gameName(mode),
                                                                 onShare: { reveal in share(reveal: reveal) })))
                        .padding(.bottom, 6)
                }, extras: {
                    VStack(spacing: 10) {
                        DailyRankBadge(gameMode: mode)
                        ScoreBreakdownView(gameMode: mode.rawValue, completed: d.won,
                                           guessCount: d.guessCount, timeSeconds: d.timeSeconds,
                                           boardsSolved: d.won ? d.solutions.count : solvedCount(d), totalBoards: d.solutions.count,
                                           day: LeaderboardService.todayLocal())
                        // Single-board modes (Classic / Six / Seven): word + definition,
                        // using the actual displayed board's solution (reliable).
                        // ProperNoundle answers are proper nouns (not in the dictionary)
                        // — its clue/photo stand in for the definition, so skip the card.
                        if let only = displayBoards(d).first, displayBoards(d).count == 1, mode != .propernoundle {
                            DefinitionCard(solution: only.solution)
                        }
                    }
                    .padding(.top, 14).padding(.bottom, 16)
                })
                .padding(.horizontal, 12)
            } else {
                VStack(spacing: 12) {
                    // R unplugged for the error screen (MASCOT_SPEC §6, ART_SPEC §7).
                    SceneArt(.unplugged)
                    Text("Couldn't load your solved puzzle").font(Brand.font(15, .black)).foregroundStyle(FinishInk.heading)
                    // §A8: a candy button, not a text link.
                    Button { dismiss() } label: { CandyLabel(title: "Home") { Icon3D(.tabHome, size: 20) } }
                        .buttonStyle(CandyButtonStyle(variant: .purple, size: .medium, fullWidth: false))
                        .accessibilityLabel("Home")
                }
            }

            // Corner Home button on every completed screen — including Gauntlet —
            // matching the web GameHomeButton (gauntlet-game.tsx also renders it
            // alongside its top Home/Share links).
            GameCornerButton(kind: .home) { dismiss() }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)
        }
        .navigationBarBackButtonHidden(true)
        .hidesBottomNav()
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(mode))
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

    /// The score the breakdown card shows (same inputs) — the result strip and the
    /// share image's POINTS window.
    private func points(_ d: MatchStatsService.SolvedDaily) -> Int {
        Int(DailyScoring.breakdown(gameMode: mode.rawValue, completed: d.won,
                                   guessCount: d.guessCount, timeSeconds: d.timeSeconds,
                                   boardsSolved: d.won ? d.solutions.count : solvedCount(d),
                                   totalBoards: d.solutions.count,
                                   dateKey: LeaderboardService.todayLocal()).total)
    }

    /// §R2: the board(s) scaled to fit `size` — a single board on the shared tray,
    /// multi-board games as the compact mini grid.
    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily, size: CGSize) -> some View {
        let bs = displayBoards(d)
        let rowCount = bs.map(\.maxGuesses).max() ?? 6
        if bs.count == 1 {
            let len = CGFloat(max(1, bs[0].solution.count)), rows = CGFloat(max(1, rowCount))
            let pad = GameTray.padding * 2
            let tile = max(10, min(52, (size.width * 0.94 - pad) / (len + (len - 1) * 0.1),
                                   (size.height - pad - GameTray.lip - 4) / (rows + (rows - 1) * 0.1)))
            // §L: the single solved board sits on the shared game tray (won →
            // purple wash, lost → slate). Mini boards tray themselves (framed).
            CompletedMiniBoardView(board: bs[0], tileSize: tile, rowCount: rowCount, framed: false)
                .gameTray(accent: ModeStyle.accent(mode), state: bs[0].status == .won ? .won : .lost)
                .frame(width: size.width, height: size.height)
        } else {
            FinishedMiniGrid(boards: bs, rowCount: rowCount, size: size, revealMissed: !d.won)
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

    /// Letter grid matching `grid(_:)` row-for-row ('' pads empty rows) — only
    /// consumed by the "Full results" share variant.
    private func letters(_ b: BoardState) -> [[String]] {
        var rows: [[String]] = []
        for p in b.prefilledGuesses ?? [] { rows.append(p.evaluation.tiles.map { $0.letter.uppercased() }) }
        for g in b.guesses {
            let ev = b.hintEvaluations?[g] ?? evaluateGuess(solution: b.solution, guess: g)
            rows.append(ev.tiles.map { $0.letter.uppercased() })
        }
        let total = (b.prefilledGuesses?.count ?? 0) + b.maxGuesses
        let w = b.solution.count
        while rows.count < total { rows.append(Array(repeating: "", count: w)) }
        return rows
    }

    /// Build the share card from the completed data and present the share sheet
    /// (same ShareService the live post-game screen uses → identical image).
    private func share(reveal: Bool = false) {
        // User-initiated share from the re-entry review: chooser pick →
        // text/image (Gauntlet's card skips the chooser, always an image).
        ShareEvents.log(kind: mode == .gauntlet || reveal ? "image" : "text",
                        gameMode: mode.rawValue, surface: "solved_review")
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
        var singleBoard: BoardState? = nil
        if bs.count > 1 {
            kind = .multi(boards: bs.map { ShareBoard(grid: grid($0), letters: letters($0), won: $0.status == .won, solution: $0.solution) },
                          boardsSolved: d.won ? bs.count : solvedCount(d), totalBoards: bs.count)
        } else if let first = bs.first {
            kind = .single(grid: grid(first))
            singleBoard = first
        } else {
            return
        }
        // ProperNoundle: caption the loss with the display form ("Taylor Swift"),
        // not the normalized board solution.
        let pnDisplay = mode == .propernoundle ? ProperNoundle.dailyPuzzle()?.display : nil
        ShareService.share(kind: kind, mode: mode, modeLabel: ModeStyle.shareLabel(mode), accent: ModeStyle.accent(mode),
                           won: d.won, guesses: d.guessCount, maxGuesses: maxGuesses, timeSeconds: d.timeSeconds,
                           reveal: reveal,
                           letters: singleBoard.map { letters($0) },
                           solutionDisplay: pnDisplay ?? singleBoard?.solution,
                           // The share image's gold POINTS window: the same score the
                           // review's breakdown card shows (same inputs).
                           points: points(d))
    }
}
