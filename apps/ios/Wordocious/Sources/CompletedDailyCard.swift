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
    @State private var reloadToken = 0

    /// Paint from the day's disk copy in the FIRST frame (founder, 2026-09-29: switching modes on
    /// the leaderboard showed the card missing for a frame, the rank banner and board jumping up,
    /// then the card snapping in — the cache used to be read only in .task, after first render).
    init(mode: GameMode) {
        self.mode = mode
        let seed = DailySeed.today(mode: mode)
        _data = State(initialValue: Self.readCache(mode: mode, seed: seed))
        _maxGuesses = State(initialValue: createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 6)
    }

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
            return "\(cleared)/\(g.totalStages) · \(guesses)g · \(formatShortTime(secs))"
        }
        // Web + Android parity (completed-daily-board summaryLabel): multi-board =
        // "solved/total · Ng · 13s", single = "guesses/max · 13s". Was the bare
        // "4 · 0:13" (m:ss, no denominator); formatShortTime gives "13s" / "1m 5s".
        if boardCount > 1 {
            let solved = localBoards?.filter { $0.status == .won }.count
                ?? d.solutions.filter { sol in d.guesses.contains { $0.uppercased() == sol.uppercased() } }.count
            return "\(solved)/\(boardCount) · \(d.guessCount)g · \(formatShortTime(d.timeSeconds))"
        }
        return "\(d.guessCount)/\(maxGuesses) · \(formatShortTime(d.timeSeconds))"
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
                    // Top accent bar: purple won / slate attempted.
                    LinearGradient(colors: won ? [Color(hex: 0x7C3AED), Color(hex: 0xA78BFA)] : [Color(hex: 0x6B7891), Color(hex: 0xA3AEC2)],
                                   startPoint: .leading, endPoint: .trailing).frame(height: 4)

                    // FINISH_SPEC §G5: the toggle row stays (it opens the solved board)
                    // but compact and tinted — it now sits under the Leaderboard's gold
                    // result card, which already carries the solve line.
                    Button { withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { expanded.toggle() } } label: {
                        HStack(spacing: 7) {
                            Icon3D(won ? .badgeCheck : .badgeL, size: 16)
                            Text(won ? "COMPLETED TODAY" : "ATTEMPTED TODAY")
                                .font(Brand.font(10, .black)).tracking(0.6)
                                .foregroundStyle(won ? Color(hex: 0x7C3AED) : FinishInk.secondary)
                            Spacer()
                            Text(summaryLabel(d)).softNumber(11)
                            Image(systemName: "chevron.down").font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(FinishInk.secondary).rotationEffect(.degrees(expanded ? 180 : 0))
                        }
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(Theme.isDark ? Color.clear : (won ? G5Accent.purple : G5Accent.slate).wash(0.07))
                        .contentShape(Rectangle())   // whole header tappable
                    }.buttonStyle(.squish)

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
                                                   timeSeconds: totalMs / 1000, boardsSolved: cumBoards, totalBoards: cumTotal,
                                                   stagesCompleted: g.stageResults.filter { $0.status == .won }.count,
                                                   day: LeaderboardService.todayLocal())
                            }
                            .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                        } else if mode != .gauntlet {
                            VStack(spacing: 8) {
                                if mode == .propernoundle {
                                    // Reconstruct the real ProperNoundle board from the recorded
                                    // guesses (matches row) — re-derive tiles against today's
                                    // answer, lay out the multi-word groups. Matches the web card.
                                    if let p = ProperNoundle.dailyPuzzle(), !d.guesses.isEmpty {
                                        // §L: the solved board on the shared game tray.
                                        CompletedProperNoundleMiniBoard(guesses: d.guesses, puzzle: p)
                                            .gameTray(accent: ModeStyle.accent(mode), state: won ? .won : .lost)
                                        Text(p.display.uppercased()).font(Brand.font(18, .black)).tracking(2).foregroundStyle(FinishInk.heading)
                                    } else if d.solutions.count == 1 {
                                        Text(d.solutions[0].uppercased()).font(Brand.font(18, .black)).tracking(2).foregroundStyle(FinishInk.heading)
                                    }
                                } else {
                                    boards(d)
                                    if d.solutions.count == 1 {
                                        Text(d.solutions[0].uppercased()).font(Brand.font(18, .black)).tracking(2).foregroundStyle(FinishInk.heading)
                                    }
                                }
                                HStack(spacing: 20) {
                                    stat("\(d.guessCount)", "GUESSES")
                                    stat(timeString(d.timeSeconds), "TIME")
                                }
                                // Full score breakdown (same card as post-game) below the stats.
                                // Single-board near-miss credit: recompute best green count from the
                                // reconstructed guesses (position match works for Classic/Six/Seven and
                                // ProperNoundle's normalized answer). nil for multi-board (ignored).
                                let bestCorrect: Int? = {
                                    guard boardCount == 1 else { return nil }
                                    let solRaw = mode == .propernoundle
                                        ? (ProperNoundle.dailyPuzzle().map { ProperNoundle.normalize($0.answer) } ?? "")
                                        : (d.solutions.first ?? "")
                                    let s = Array(solRaw.uppercased())
                                    guard !s.isEmpty else { return 0 }
                                    return d.guesses.reduce(0) { best, gw in
                                        let raw = mode == .propernoundle ? ProperNoundle.normalize(gw) : gw
                                        let g = Array(raw.uppercased())
                                        return max(best, zip(g, s).filter { $0 == $1 }.count)
                                    }
                                }()
                                ScoreBreakdownView(gameMode: mode.rawValue, completed: won,
                                                   guessCount: d.guessCount, timeSeconds: d.timeSeconds,
                                                   boardsSolved: won ? boardCount : 0, totalBoards: boardCount,
                                                   hintsUsed: d.hintsUsed,
                                                   bestCorrectLetters: bestCorrect,
                                                   day: LeaderboardService.todayLocal())
                            }
                            .padding(.horizontal, 14).padding(.bottom, 14).padding(.top, 4)
                        }
                    }
                }
                // The soft completed-board card (Leaderboard / Records redesign): radius 14,
                // soft shadow, no border.
                .lbCard()
            }
        }
        .onDailyRecorded { reloadToken += 1 }
        .task(id: "\(mode.rawValue)-\(reloadToken)") {
            // Reset per-mode state up front — otherwise a previously-viewed mode's
            // data (notably the Gauntlet stage breakdown) leaks into this mode when
            // its own local save isn't reloaded, rendering e.g. Gauntlet's stages
            // under Classic.
            // data is NOT cleared: .id(mode) gives every mode a fresh card seeded from its own cache in init.
            localBoards = nil; gauntlet = nil
            let seed = DailySeed.today(mode: mode)
            var localStatus: GameStatus? = nil
            if let state = GamePersistence.shared.load(seed: seed, mode: mode),
               state.status == .won || state.status == .lost {
                localBoards = state.boards
                gauntlet = state.gauntlet
                localStatus = state.status
            }
            maxGuesses = createInitialState(seed: seed, mode: mode).boards.map(\.maxGuesses).max() ?? 6
            let savedMs = Int(GamePersistence.shared.loadElapsed(seed: seed, mode: mode))
            // §254: paint IMMEDIATELY. This card used to render zero height until
            // the network answered — even when the game was played on this very
            // device and the board was already on disk — so it was the last
            // thing on every page to appear, and it shoved the rank banner and
            // the whole leaderboard down when it did. Two instant sources, in
            // order: the day-keyed disk copy of the last server answer, else a
            // provisional record built from the local save. The fetch below
            // then refreshes silently; a failed fetch no longer blanks the card.
            if let cached = Self.readCache(mode: mode, seed: seed) {
                data = cached
            } else if let bs = localBoards, let st = localStatus {
                data = MatchStatsService.SolvedDaily(
                    guesses: bs.flatMap(\.guesses), solutions: bs.map(\.solution),
                    won: st == .won,
                    guessCount: bs.map(\.guesses.count).max() ?? 0,
                    timeSeconds: savedMs / 1000,
                    hintsUsed: bs.first?.hintEvaluations?.count ?? 0)
            }
            elapsedMs = savedMs > 0 ? savedMs : (data?.timeSeconds ?? 0) * 1000
            if let fresh = await MatchStatsService.solvedDaily(mode: mode, seed: seed) {
                data = fresh
                Self.writeCache(fresh, mode: mode, seed: seed)
                if savedMs <= 0 { elapsedMs = fresh.timeSeconds * 1000 }
            }
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

    // §254: day-keyed disk copy of the last server answer, one slot per mode.
    // The seed embeds the date, so a stale slot simply misses — no pruning.
    private struct CacheEntry: Codable { let seed: String; let solved: MatchStatsService.SolvedDaily }
    private static func cacheKey(_ mode: GameMode) -> String { "completed-daily-cache-\(mode.rawValue)" }
    static func readCache(mode: GameMode, seed: String) -> MatchStatsService.SolvedDaily? {
        guard let d = UserDefaults.standard.data(forKey: cacheKey(mode)),
              let e = try? JSONDecoder().decode(CacheEntry.self, from: d), e.seed == seed else { return nil }
        return e.solved
    }
    static func writeCache(_ solved: MatchStatsService.SolvedDaily, mode: GameMode, seed: String) {
        if let d = try? JSONEncoder().encode(CacheEntry(seed: seed, solved: solved)) {
            UserDefaults.standard.set(d, forKey: cacheKey(mode))
        }
    }

    @ViewBuilder private func boards(_ d: MatchStatsService.SolvedDaily) -> some View {
        let bs = localBoards ?? CompletedBoardReconstruct.boards(mode: mode, seed: DailySeed.today(mode: mode), solutions: d.solutions,
                                                                 guesses: d.guesses, maxGuesses: maxGuesses)
        let rowCount = bs.count > 1 ? CompletedMiniBoardView.sharedRows(bs) : (bs.map(\.maxGuesses).max() ?? 6)   // §AT2
        if bs.count == 1 {
            // §L: the single solved board sits on the shared game tray (won →
            // purple wash, lost → slate). Mini boards tray themselves (framed).
            CompletedMiniBoardView(board: bs[0], tileSize: tileSize, rowCount: rowCount, framed: false)
                .gameTray(accent: ModeStyle.accent(mode), state: bs[0].status == .won ? .won : .lost)
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
            Text(value).softNumber(16)
            Text(label).font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(FinishInk.secondary)
        }
    }

    private func timeString(_ s: Int) -> String { "\(s / 60):\(String(format: "%02d", s % 60))" }
}

/// Compact completed ProperNoundle board — reconstructs each row's tiles from the
/// recorded guess words, laid out in the answer's multi-word groups (e.g.
/// "Taylor Swift" → 6 + 5). Mirrors the web `CompletedProperNoundleMiniBoard`.
struct CompletedProperNoundleMiniBoard: View {
    let guesses: [String]   // raw recorded guess words (matches row)
    let puzzle: NPuzzle
    var maxGuesses: Int = 6
    /// Optional REAL rows (per-index letters + tiles) — the VS recap passes
    /// the live PN view model's final rows so hint rows render as they did
    /// in-game (gray .hintUsed tiles, green revealed letters). Re-evaluating
    /// the recorded word list can't reproduce them: a clue row has no word.
    var realRows: [(letters: [String], tiles: [NTile])]? = nil

    private var groups: [Int] { ProperNoundle.wordGroups(puzzle.display) }
    private var totalLetters: Int { max(1, groups.reduce(0, +)) }
    private var tileSize: CGFloat { min(18, max(10, 220 / CGFloat(totalLetters))) }

    private func ranges() -> [Range<Int>] {
        var out: [Range<Int>] = []
        var start = 0
        for len in groups { out.append(start..<(start + len)); start += len }
        return out
    }

    private func mapTile(_ t: NTile) -> TileState {
        switch t {
        case .correct:  return .correct
        case .present:  return .present
        case .absent:   return .absent
        case .hintUsed: return .hintUsed   // realRows, or a rebuilt hint row
        default:        return .empty
        }
    }

    var body: some View {
        VStack(spacing: tileSize * 0.16) {
            ForEach(0..<maxGuesses, id: \.self) { r in
                let real = realRows?[safe: r]
                let isPast = real != nil || r < guesses.count
                // Without a final-state snapshot, rebuild the row from what was
                // recorded. rebuildRow keeps a hint row's revealed letter at its
                // real slot — normalize+evaluate collapsed the padding and put
                // it at slot 0 in gray (web reconstruct.ts parity).
                let rebuilt: (letters: [String], tiles: [NTile])? = real == nil && r < guesses.count
                    ? ProperNoundle.rebuildRow(recorded: guesses[r], answer: puzzle.answer)
                    : nil
                let letters: [String] = real?.letters ?? rebuilt?.letters ?? []
                let tiles = real?.tiles ?? rebuilt?.tiles ?? []
                HStack(spacing: 6) {
                    ForEach(Array(ranges().enumerated()), id: \.offset) { _, range in
                        HStack(spacing: tileSize * 0.12) {
                            ForEach(range, id: \.self) { idx in
                                let letter = (isPast && idx < letters.count) ? String(letters[idx]).uppercased() : ""
                                let state = (isPast && idx < tiles.count) ? mapTile(tiles[idx]) : TileState.empty
                                TileView(letter: letter, state: state, revealed: isPast, size: tileSize)
                            }
                        }
                    }
                }
            }
        }
    }
}
