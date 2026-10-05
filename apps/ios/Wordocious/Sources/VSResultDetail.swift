import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

/// One ProperNoundle row (raw word + REAL tile states) snapshotted from the
/// live PN view model at match end — carries hint rows (.hintUsed tiles, or a
/// letterless clue row) that re-evaluating the recorded word list can't
/// reproduce.
struct VSPNRecapRow: Equatable {
    let word: String
    let tiles: [NTile]
}

/// Result-screen detail blocks — ports apps/web/components/vs/vs-result-detail.tsx:
/// FinalBoards (both players' boards WITH letters, the opponent's reconstructed
/// from the match-end guess log + solutions) and ComparisonBars (you = purple,
/// them = pink, lower is better so bar length is inverted).
enum VSResultBoards {
    struct EvaluatedRow {
        let letters: [String]
        let states: [TileState]
    }

    /// Re-evaluate a guess log against the revealed solutions, grouped by board.
    /// ProperNoundle / length mismatches fall back to all-gray rows (the web
    /// wraps evaluateGuess in try/catch; the Swift evaluator traps on length
    /// mismatch, so guard the length explicitly).
    static func evaluate(log: [VSGuessLogEntry], solutions: [String]) -> [Int: [EvaluatedRow]] {
        var byBoard: [Int: [EvaluatedRow]] = [:]
        for entry in log {
            let word = entry.guess.uppercased()
            let letters = word.map(String.init)
            let solution = entry.boardIndex < solutions.count ? solutions[entry.boardIndex].uppercased() : nil
            let states: [TileState]
            if let solution, solution.count == word.count, !word.isEmpty {
                states = evaluateGuess(solution: solution, guess: word).tiles.map(\.state)
            } else {
                states = Array(repeating: .absent, count: letters.count)
            }
            byBoard[entry.boardIndex, default: []].append(EvaluatedRow(letters: letters, states: states))
        }
        return byBoard
    }

    /// Did this guess log actually solve anything? True when any board contains
    /// an all-correct row. Used for the result screen's solve badges + the
    /// "why you won/lost" line (solving beats score, which is the #1 source of
    /// confusion when the loser has prettier numbers).
    static func solved(log: [VSGuessLogEntry], solutions: [String]) -> Bool {
        for entry in log {
            guard entry.boardIndex < solutions.count else { continue }
            let solution = solutions[entry.boardIndex].uppercased()
            if entry.guess.uppercased() == solution { return true }
        }
        return false
    }
}

/// VS result share card — FINISH_SPEC §E1 on the 1080 canvas, drawn static and
/// ALWAYS LIGHT with the share kit (ShareKit.swift): the VS wallpaper, the VS
/// title art, the date line + result pill, a head-to-head center (each player's
/// name, crowned winner, soft-number score, solve line and their color-only boards
/// on the light game tray in glossy tiles; the candy VS disc between), three tinted
/// stat windows, and (FINISH_SPEC §S3) the cast wordmark: the ten heroes standing
/// together over "wordocious.com". 4:5 (§S2). Colors only = no daily spoilers.
struct VSShareCardView: View {
    struct Side {
        let name: String
        let score: Double
        let won: Bool
        let solved: Bool
        /// Per board: rows of tile states (colors only).
        let grids: [[[TileState]]]
        /// BJ5: the player's username → their resolved avatar (photo / mascot / frame);
        /// a bot's cast art instead when `botArt` is set. nil both = no avatar.
        var username: String? = nil
        var botArt: String? = nil
    }

    let modeLabel: String     // e.g. "VS CLASSIC"
    let accent: Color
    let isWin: Bool           // my result (drives the pill)
    let isDraw: Bool
    let me: Side
    let opponent: Side
    let dateStr: String

    private let mePurple = Color(hex: 0x7C3AED), oppPink = Color(hex: 0xEC4899)

    var size: CGSize { CGSize(width: 1080, height: 1350) }

    var body: some View {
        ZStack {
            ShareWall(tint: .vs)
            VStack(spacing: 0) {
                if ArtAsset.exists("art-title-vs"), let a = ArtAsset.aspect("art-title-vs"), a > 0 {
                    // §S2: title art ~70% of the width.
                    ShareArt.title("art-title-vs", height: min(200, 756 / a), maxWidth: 756).padding(.top, 44)
                } else {
                    Text(modeLabel)
                        .font(Brand.fixedFont(72, .black)).foregroundStyle(accent)
                        .shadow(color: .white.opacity(0.85), radius: 0, x: 0, y: 3)
                        .lineLimit(1).minimumScaleFactor(0.5)
                        .padding(.horizontal, 60).padding(.top, 44)
                }
                HStack(spacing: 18) {
                    ShareDateLine(text: "\(modeLabel) · \(dateStr)", size: 28)
                    resultPill
                }
                .padding(.top, 14)

                Spacer(minLength: 10)
                HStack(alignment: .center, spacing: 26) {
                    sideColumn(me, accent: mePurple)
                    VSLettering(size: 104)
                    sideColumn(opponent, accent: oppPink)
                }
                .padding(.horizontal, 44)
                Spacer(minLength: 10)

                ShareStatRow(items: [
                    (value: fmt(me.score), label: "YOUR SCORE", tone: .purple),
                    (value: fmt(opponent.score), label: "THEIR SCORE", tone: .pink),
                    (value: isDraw ? "DRAW" : (isWin ? "WIN" : "LOSS"), label: "RESULT", tone: .gold),
                ], height: 100)
                .padding(.horizontal, 60)
                ShareCastWordmark(width: 972)
                    .padding(.top, 40).padding(.bottom, 40)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    /// Victory / Draw / Defeat as a tinted pill with the 3D W / L badge.
    private var resultPill: some View {
        let tone: Color = isDraw ? Color(hex: 0xF5A524) : (isWin ? mePurple : Color(hex: 0x6B7891))
        return HStack(spacing: 10) {
            if !isDraw { ShareResultBadge(won: isWin, size: 40) }
            Text(isDraw ? "Draw" : isWin ? "Victory" : "Defeat")
                .font(Brand.fixedFont(28, .black)).foregroundStyle(ShareInk.heading)
        }
        .padding(.horizontal, 20).frame(height: 56)
        .background(Capsule().fill(tone.vsWash(0.16)))
        .overlay(Capsule().strokeBorder(tone.vsWash(0.45), lineWidth: 3))
    }

    private func fmt(_ s: Double) -> String { String(format: "%.2f", s) }

    /// Both sides' boards render on a SHARED grid size (max rows/cols across
    /// every displayed board, short boards padded with empty rows) so the two
    /// columns are pixel-identical — a 3-guess win next to a 6-guess loss used
    /// to produce two differently-sized boards, which read as a layout bug.
    private var sharedRows: Int {
        let all = me.grids.prefix(2) + opponent.grids.prefix(2)
        return max(all.map(\.count).max() ?? 1, 1)
    }
    private var sharedCols: Int {
        let all = me.grids.prefix(2) + opponent.grids.prefix(2)
        return max(all.compactMap { $0.first?.count }.max() ?? 5, 1)
    }
    private var multiBoard: Bool { me.grids.count > 1 || opponent.grids.count > 1 }

    private func sideColumn(_ side: Side, accent: Color) -> some View {
        VStack(spacing: 8) {
            // BJ5: each side's own avatar (the one resolver; a bot keeps its cast art).
            if let art = side.botArt, ArtAsset.exists(art) {
                Image(art).resizable().interpolation(.high).scaledToFit().frame(width: 96, height: 96)
            } else if let name = side.username {
                AvatarView(url: nil, username: name, size: 96, alwaysLight: true)
            }
            HStack(spacing: 8) {
                if side.won && !isDraw { Icon3D(.crown, size: 34, label: "Winner") }
                Text(side.name).font(Brand.fixedFont(30, .black)).foregroundStyle(accent).lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            Text(fmt(side.score)).shareSoftNumber(56)
            Text(side.solved ? "Solved" : "Not solved")
                .font(Brand.fixedFont(22, .black))
                .foregroundStyle(side.solved ? Color(hex: 0x6D28D9) : ShareInk.muted)
            VStack(spacing: 14) {
                ForEach(0..<min(side.grids.count, 2), id: \.self) { i in
                    boardTray(grid: side.grids[i], won: side.won || (isDraw && side.solved),
                              maxSide: multiBoard ? 200 : 330)
                }
            }
            .padding(.top, 6)
            if side.grids.count > 2 {
                Text("+\(side.grids.count - 2) more").font(Brand.fixedFont(20, .black)).foregroundStyle(ShareInk.muted)
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// One board on the light share tray (won → purple wash, else slate), glossy
    /// color-only tiles (frosted for empty cells) on the shared grid.
    private func boardTray(grid: [[TileState]], won: Bool, maxSide: CGFloat) -> some View {
        let cols = sharedCols
        let rows = sharedRows
        let gap: CGFloat = max(4, maxSide * 0.03)
        let tile = floor(min((maxSide - gap * CGFloat(cols - 1)) / CGFloat(cols),
                             (maxSide - gap * CGFloat(rows - 1)) / CGFloat(rows)))
        return VStack(spacing: gap) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let state: TileState = r < grid.count && c < grid[r].count ? grid[r][c] : .empty
                        ShareTile(fill: state == .empty || state == .hintUsed ? .frost() : .face(GlossyFace(revealed: state)),
                                  size: tile)
                    }
                }
            }
        }
        .shareTray(accent: accent, state: won ? .won : .lost, radius: 30, padding: 16)
    }
}

/// Renders the VS share card to a PNG and presents the native share sheet with
/// the IMAGE ONLY (FINISH_SPEC §S1: no link, no caption text).
enum VSShareService {
    @MainActor
    static func share(card: VSShareCardView, text: String) {
        #if canImport(UIKit)
        _ = text   // §S1: results share no text (kept for the call site).
        guard let image = ShareService.renderCard(card, size: card.size) else { return }
        ShareService.presentImages([image], game: "VS")
        #endif
    }
}

/// Final boards WITH letters — yours from local play, the opponent's
/// reconstructed from the match-end guess log. Single-board modes render the
/// two boards side-by-side for direct comparison; multi-board modes render
/// each player's FULL board set as the same compact per-board recap the solo
/// post-game uses (every board visible with its solved/failed frame — the old
/// 2-boards-plus-"+N more" stack read as a wall of ambiguous letters).
struct VSFinalBoards: View {
    let myName: String
    let opponentName: String
    let myGuessLog: [VSGuessLogEntry]
    let opponentGuessLog: [VSGuessLogEntry]
    let solutions: [String]
    var mode: GameMode = .duel
    var seed: String = ""
    /// Per-side elapsed (ms) — feeds the Gauntlet stage review's TIME stat.
    var myTimeMs: Int = 0
    var opponentTimeMs: Int = 0
    /// MY final board state snapshotted at match end (VSMatchViewModel
    /// .myFinalBoards). When present, MY side renders from it — preserving
    /// hint rows (Six/Seven .submitHint rows stored in hintEvaluations) that
    /// the log-based reconstruction loses. Nil (e.g. state lost) falls back to
    /// re-evaluating myGuessLog. The opponent side is ALWAYS log-based: bots
    /// never hint and human opponents' hints aren't relayed by the server —
    /// a known limitation, not worth a protocol change.
    var myFinalBoards: [BoardState]? = nil
    /// ProperNoundle VS: my final rows with REAL tiles (.hintUsed included).
    var myFinalPNRows: [VSPNRecapRow]? = nil

    /// The tray's color: the mode's own accent (§L).
    private var trayAccent: Color { ModeStyle.accent(mode) }

    var body: some View {
        if mode == .gauntlet {
            gauntletRecap
        } else if solutions.count > 1 {
            multiBoardRecap
        } else {
            singleBoardComparison
        }
    }

    // MARK: Gauntlet — the solo-style stage-by-stage fan-down per player
    // (a flat 21-board letter wall was unreadable).

    @ViewBuilder private var gauntletRecap: some View {
        let myWords = myGuessLog.map(\.guess)
        let oppWords = opponentGuessLog.map(\.guess)
        if !(myWords.isEmpty && oppWords.isEmpty) {
            VStack(spacing: 14) {
                gauntletSection(label: myName, words: myWords, accent: Color(hex: 0x7C3AED), timeMs: myTimeMs)
                Rectangle().fill(GameTray.seam(trayAccent)).frame(height: 1.5)
                gauntletSection(label: opponentName, words: oppWords, accent: Color(hex: 0xEC4899), timeMs: opponentTimeMs)
            }
            .padding(5).frame(maxWidth: .infinity)
            // §L: the final boards sit on the shared game tray (no plain card).
            .gameTray(accent: trayAccent, lightOnly: true)
        }
    }

    @ViewBuilder private func gauntletSection(label: String, words: [String], accent: Color, timeMs: Int) -> some View {
        VStack(spacing: 8) {
            Text(label.uppercased())
                .font(Brand.font(10, .heavy)).tracking(0.8)
                .foregroundStyle(accent).lineLimit(1)
                .minimumScaleFactor(0.7)
            if words.isEmpty {
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .padding(.vertical, 8)
            } else if let rec = GauntletReconstruct.reconstruct(seed: seed, guesses: words) {
                GauntletCompletedView(progress: rec.progress, totalTimeMs: timeMs, showSummary: true)
            } else {
                Text("\(words.count) guesses").font(Brand.font(10, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Multi-board (Quad/Octo/Succession/Deliverance)

    @ViewBuilder private var multiBoardRecap: some View {
        let myWords = myGuessLog.map(\.guess)
        let oppWords = opponentGuessLog.map(\.guess)
        if !(myWords.isEmpty && oppWords.isEmpty) {
            VStack(spacing: 14) {
                recapSection(label: myName, words: myWords, accent: Color(hex: 0x7C3AED))
                Rectangle().fill(GameTray.seam(trayAccent)).frame(height: 1.5)
                recapSection(label: opponentName, words: oppWords, accent: Color(hex: 0xEC4899))
            }
            .padding(5).frame(maxWidth: .infinity)
            .gameTray(accent: trayAccent, lightOnly: true)
        }
    }

    /// One player's full board set, rebuilt through the engine (same replay the
    /// solo "view solved puzzle" uses) and laid out compactly.
    @ViewBuilder private func recapSection(label: String, words: [String], accent: Color) -> some View {
        let boards = CompletedBoardReconstruct.boards(
            mode: mode, seed: seed, solutions: solutions, guesses: words,
            maxGuesses: VSModeInfo.maxGuesses(mode))
        let wordLen = solutions.first?.count ?? 5
        let tile = CompletedBoardLayout.tileSize(boardCount: boards.count, wordLen: wordLen)
        let cols = CompletedBoardLayout.cols(boards.count)
        let rowCount = boards.map { $0.guesses.count }.max() ?? 1
        // Honest per-board tally from the replayed boards — a binary
        // Solved/Not-solved here contradicted the frames (7 purple + 1 red
        // under a "Solved" badge).
        let won = boards.filter { $0.status == .won }.count
        let allWon = won == boards.count && !boards.isEmpty

        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Text(label.uppercased())
                    .font(Brand.font(10, .heavy)).tracking(0.8)
                    .foregroundStyle(accent).lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("\(won)/\(boards.count) BOARDS").font(Brand.font(9, .black)).tracking(0.5)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(Capsule().fill(allWon ? VsLobbyKit.purple : VsLobbyKit.slate))
            }
            if words.isEmpty {
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .padding(.vertical, 8)
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: CompletedBoardLayout.gridSpacing), count: cols),
                          spacing: CompletedBoardLayout.gridSpacing) {
                    ForEach(boards.indices, id: \.self) { i in
                        // §AT2: one row count (the most guesses on any board) for every board.
                        CompletedMiniBoardView(board: boards[i], tileSize: tile, rowCount: max(1, rowCount))
                    }
                }
                .frame(maxWidth: CompletedBoardLayout.maxWidth(boards.count))
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Single board (Classic/Six/Seven/ProperNoundle)

    /// ProperNoundle puzzle for this match's seed — gives us the `display`
    /// string ("Trae Young") whose spaces the raw solution lacks ("TRAEYOUNG",
    /// which is what the guess log / solutions carry and what the recap used
    /// to render verbatim). Guarded against a seed-lookup mismatch: only used
    /// when the looked-up answer actually matches the revealed solution.
    private var pnPuzzle: NPuzzle? {
        guard mode == .propernoundle, let p = ProperNoundle.puzzle(forSeed: seed),
              let solution = solutions.first,
              ProperNoundle.normalize(p.answer) == ProperNoundle.normalize(solution) else { return nil }
        return p
    }

    /// MY rows rebuilt from the final board snapshot — hint rows use their
    /// stored hintEvaluations (revealed letter green, the rest gray .hintUsed),
    /// normal rows re-evaluate. Mirrors GameViewModel.recomputeEvaluations.
    /// Nil when no snapshot survived (fall back to the log reconstruction).
    private var snapshotRows: [Int: [VSResultBoards.EvaluatedRow]]? {
        guard let boards = myFinalBoards else { return nil }
        var byBoard: [Int: [VSResultBoards.EvaluatedRow]] = [:]
        for (bi, board) in boards.enumerated() {
            let solution = board.solution.uppercased()
            for (i, g) in board.guesses.enumerated() {
                let row: VSResultBoards.EvaluatedRow
                if let he = board.hintEvaluations?[String(i)] {
                    row = .init(letters: he.tiles.map { $0.letter.uppercased() },
                                states: he.tiles.map(\.state))
                } else {
                    let word = g.uppercased()
                    let states: [TileState] = (solution.count == word.count && !word.isEmpty)
                        ? evaluateGuess(solution: solution, guess: word).tiles.map(\.state)
                        : Array(repeating: .absent, count: word.count)
                    row = .init(letters: word.map(String.init), states: states)
                }
                byBoard[bi, default: []].append(row)
            }
        }
        return byBoard.isEmpty ? nil : byBoard
    }

    @ViewBuilder private var singleBoardComparison: some View {
        let mine = snapshotRows ?? VSResultBoards.evaluate(log: myGuessLog, solutions: solutions)
        let theirs = VSResultBoards.evaluate(log: opponentGuessLog, solutions: solutions)

        let mySolved = VSResultBoards.solved(log: myGuessLog, solutions: solutions)
        let oppSolved = VSResultBoards.solved(log: opponentGuessLog, solutions: solutions)

        if !(mine.isEmpty && theirs.isEmpty) {
            VStack(spacing: 12) {
                HStack(alignment: .top, spacing: 16) {
                    side(label: myName, boards: mine, accent: Color(hex: 0x7C3AED), solved: mySolved,
                         pnRealRows: myFinalPNRows,
                         board: myFinalBoards?.first ?? logBoard(myGuessLog, solved: mySolved))
                    Rectangle().fill(GameTray.seam(trayAccent)).frame(width: 1.5)
                    side(label: opponentName, boards: theirs, accent: Color(hex: 0xEC4899), solved: oppSolved,
                         board: logBoard(opponentGuessLog, solved: oppSolved))
                }
                // Reveal the answer so a missed board isn't a mystery. For
                // ProperNoundle use the puzzle's display so multi-word answers
                // keep their real spacing ("TRAE YOUNG", not "TRAEYOUNG").
                if let answer = solutions.first {
                    Text("Answer: \((pnPuzzle?.display ?? answer).uppercased())")
                        .font(Brand.font(11, .black)).tracking(1)
                        .foregroundStyle(VsLobbyKit.mutedInk)
                }
            }
            .padding(5).frame(maxWidth: .infinity)
            .gameTray(accent: trayAccent, lightOnly: true)
        }
    }

    /// A single-board side rebuilt from its guess log as a solo BoardState, so
    /// the recap draws with the solo completed-board component.
    private func logBoard(_ log: [VSGuessLogEntry], solved: Bool) -> BoardState? {
        guard let solution = solutions.first else { return nil }
        let words = log.filter { $0.boardIndex == 0 }.map { $0.guess.uppercased() }
        guard !words.isEmpty else { return nil }
        return BoardState(solution: solution.uppercased(), guesses: words,
                          maxGuesses: words.count, status: solved ? .won : .lost)
    }

    private func side(label: String, boards: [Int: [VSResultBoards.EvaluatedRow]], accent: Color, solved: Bool,
                      pnRealRows: [VSPNRecapRow]? = nil, board: BoardState? = nil) -> some View {
        let indices = boards.keys.sorted()
        return VStack(spacing: 8) {
            Text(label.uppercased())
                .font(Brand.font(10, .heavy)).tracking(0.8)
                .foregroundStyle(accent).lineLimit(1)
                .minimumScaleFactor(0.7)
            // At-a-glance outcome for this side's boards.
            Text(solved ? "SOLVED" : "NOT SOLVED").font(Brand.font(9, .black)).tracking(0.5)
                .foregroundStyle(.white)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(Capsule().fill(solved ? VsLobbyKit.purple : VsLobbyKit.slate))
            if let puzzle = pnPuzzle, let rows = pnRealRows, !rows.isEmpty {
                // ProperNoundle, MY side with a final-state snapshot: feed the
                // REAL rows (words + tiles) so hint rows render exactly as they
                // did in-game — gray .hintUsed tiles, green revealed letters.
                // The guess log can't reproduce them (clue rows have no word).
                CompletedProperNoundleMiniBoard(
                    guesses: rows.map(\.word), puzzle: puzzle,
                    maxGuesses: max(1, rows.count),
                    realRows: rows.map { row in
                        (letters: row.word.map { $0 == " " ? "" : String($0).uppercased() },
                         tiles: row.tiles)
                    })
            } else if indices.isEmpty {
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .padding(.vertical, 12)
            } else if let puzzle = pnPuzzle {
                // ProperNoundle: reuse the solo completed mini-board so the
                // recap rows carry the answer's word-group gaps (TRAE ⌷ YOUNG)
                // instead of one unbroken letter run. Only the guessed rows —
                // matches what letterBoard showed for this recap.
                VStack(spacing: 12) {
                    ForEach(indices, id: \.self) { idx in
                        let words = (boards[idx] ?? []).map { $0.letters.joined() }
                        CompletedProperNoundleMiniBoard(guesses: words, puzzle: puzzle,
                                                        maxGuesses: max(1, words.count))
                    }
                }
            } else if let board, !board.guesses.isEmpty {
                // The solo completed board (single boards carry no frame solo).
                let wordLen = board.solution.count
                let tile: CGFloat = wordLen <= 5 ? 24 : (wordLen == 6 ? 21 : 18)
                CompletedMiniBoardView(board: board, tileSize: tile, rowCount: board.guesses.count, framed: false)
            } else {
                VStack(spacing: 12) {
                    ForEach(indices, id: \.self) { idx in
                        letterBoard(boards[idx] ?? [])
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func letterBoard(_ rows: [VSResultBoards.EvaluatedRow]) -> some View {
        // Shrink tiles for long words so two boards still fit side-by-side.
        let wordLen = rows.first?.letters.count ?? 5
        let tile: CGFloat = wordLen <= 5 ? 24 : (wordLen == 6 ? 21 : 18)
        // §B1: the recap letters are the glossy tiles (purple / gold / slate; a hint
        // row's filler is the frosted hint-used tile).
        return VStack(spacing: 3) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 3) {
                    ForEach(Array(row.letters.enumerated()), id: \.offset) { ci, letter in
                        GlossyTile(face: GlossyFace(revealed: row.states[safe: ci] ?? .absent), letter: letter, width: tile)
                    }
                }
            }
        }
    }
}

/// Two horizontal bars per metric (you = purple, them = pink). All metrics
/// are lower-is-better, so bar length is inverted: the lower value gets the
/// fuller bar (min 6%).
struct VSComparisonBars: View {
    struct Metric {
        let label: String
        let mine: Double
        let theirs: Double
        let format: (Double) -> String
    }

    let myName: String
    let opponentName: String
    let metrics: [Metric]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(Array(metrics.enumerated()), id: \.offset) { _, m in
                let total = m.mine + m.theirs
                // Inverted share: my bar grows when MY value is lower.
                let myPct = total <= 0 ? 0.5 : m.theirs / total
                let theirPct = total <= 0 ? 0.5 : m.mine / total
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.label.uppercased())
                        .font(Brand.font(9, .heavy)).tracking(0.8).foregroundStyle(VsLobbyKit.mutedInk)
                    barRow(pct: myPct, value: m.format(m.mine),
                           colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)])
                    barRow(pct: theirPct, value: m.format(m.theirs),
                           colors: [Color(hex: 0xF472B6), Color(hex: 0xEC4899)])
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .vsTinted(VsLobbyKit.purple, radius: 18)
    }

    private func barRow(pct: Double, value: String, colors: [Color]) -> some View {
        HStack(spacing: 8) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(VsLobbyKit.purple.vsWash(0.14))
                    Capsule().fill(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * max(0.06, pct))
                        .animation(Theme.animation(.easeInOut(duration: 0.6)), value: pct)
                }
            }
            .frame(height: 12)
            Text(value)
                .vsNumber(12)
                .frame(width: 56, alignment: .trailing)
        }
    }
}
