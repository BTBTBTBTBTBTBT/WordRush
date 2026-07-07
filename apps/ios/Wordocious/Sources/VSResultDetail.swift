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

/// VS result share card — same canvas + aesthetic as the daily ShareCardView
/// (F8F7FF bg, WORDOCIOUS gradient wordmark, accent mode label, Win/Loss pill,
/// tinted board cards, wordocious.com footer), with a head-to-head center:
/// each player's name, final score (winner crowned + accent, loser dimmed),
/// solve line, and their color-only boards. Colors only = no daily spoilers.
struct VSShareCardView: View {
    struct Side {
        let name: String
        let score: Double
        let won: Bool
        let solved: Bool
        /// Per board: rows of tile states (colors only).
        let grids: [[[TileState]]]
    }

    let modeLabel: String     // e.g. "VS CLASSIC"
    let accent: Color
    let isWin: Bool           // my result (drives the pill)
    let isDraw: Bool
    let me: Side
    let opponent: Side
    let dateStr: String

    // Identical palette to ShareCardView.
    private let bg = Color(hex: 0xF8F7FF)
    private let textMuted = Color(hex: 0x6B7280)
    private let winFG = Color(hex: 0x7C3AED), winBG = Color(hex: 0xF5F3FF)
    private let lossFG = Color(hex: 0xDC2626), lossBG = Color(hex: 0xFEE2E2)
    private let drawFG = Color(hex: 0xD97706), drawBG = Color(hex: 0xFEF3C7)
    private let boardWinTint = Color(hex: 0xF5F3FF), boardLossTint = Color(hex: 0xFEF2F2)
    private let mePurple = Color(hex: 0x7C3AED), oppPink = Color(hex: 0xEC4899)

    var size: CGSize { CGSize(width: 1080, height: 1080) }

    var body: some View {
        ZStack {
            bg
            VStack(spacing: 0) {
                // Hero wordmark — the brand is the headline of the share (user
                // feedback: 56pt read as an afterthought on the 1080 canvas).
                Text("WORDOCIOUS")
                    .font(Brand.font(92, .black)).tracking(1)
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 48)
                Text(modeLabel).font(Brand.font(40, .black)).foregroundStyle(accent).padding(.top, 6)
                // Stats line + result pill (same row shape as the daily card).
                HStack(spacing: 12) {
                    Text("\(fmt(me.score)) vs \(fmt(opponent.score)) · \(dateStr)")
                        .font(Brand.font(24, .bold)).foregroundStyle(textMuted)
                    Text(isDraw ? "Draw" : isWin ? "Victory" : "Defeat")
                        .font(Brand.font(22, .bold))
                        .foregroundStyle(isDraw ? drawFG : isWin ? winFG : lossFG)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(isDraw ? drawBG : isWin ? winBG : lossBG))
                }
                .padding(.top, 18)

                Spacer()
                HStack(alignment: .top, spacing: 40) {
                    sideColumn(me, accent: mePurple)
                    // VS sits centered BETWEEN THE BOARDS: a spacer the height of
                    // the name/score/solved header, then a frame the height of the
                    // board block (both sides render identical board sizes, so the
                    // block height is deterministic).
                    VStack(spacing: 0) {
                        Color.clear.frame(width: 10, height: Self.headerBlockHeight)
                        Text("VS").font(Brand.font(44, .black)).foregroundStyle(textMuted)
                            .frame(height: boardsBlockHeight)
                    }
                    sideColumn(opponent, accent: oppPink)
                }
                .padding(.horizontal, 50)
                Spacer()

                Text("wordocious.com").font(Brand.font(22, .bold))
                    .foregroundStyle(Color(hex: 0x9CA3AF)).padding(.bottom, 40)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    private func fmt(_ s: Double) -> String { String(format: "%.2f", s) }

    /// Both sides' cards render on a SHARED grid size (max rows/cols across
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

    /// Fixed height of the name/score/solved block above each side's boards —
    /// lets the center VS column line up with the board region exactly.
    static let headerBlockHeight: CGFloat = 158

    /// Height of one board card, from the same shared-grid math boardCard uses.
    private var boardCardHeight: CGFloat {
        let maxSide: CGFloat = multiBoard ? 260 : 380
        let cols = CGFloat(sharedCols), rows = CGFloat(sharedRows)
        let gap = max(3, maxSide * 0.012)
        let pad = maxSide * 0.04
        let inner = maxSide - pad * 2
        let tile = floor(min((inner - gap * (cols - 1)) / cols, (inner - gap * (rows - 1)) / rows))
        return tile * rows + gap * (rows - 1) + pad * 2
    }

    /// Height of the taller side's shown board stack (boards + 14pt spacing).
    private var boardsBlockHeight: CGFloat {
        let shown = CGFloat(min(max(me.grids.count, opponent.grids.count), 2))
        return boardCardHeight * shown + 14 * (shown - 1)
    }

    private func sideColumn(_ side: Side, accent: Color) -> some View {
        let highlighted = side.won || isDraw
        return VStack(spacing: 0) {
            // Fixed-height header so the center VS column can align on the boards.
            VStack(spacing: 10) {
                HStack(spacing: 6) {
                    if side.won && !isDraw { Text("👑").font(.system(size: 24)) }
                    Text(side.name).font(Brand.font(28, .black)).foregroundStyle(accent).lineLimit(1)
                }
                Text(fmt(side.score))
                    .font(Brand.font(52, .black)).monospacedDigit()
                    .foregroundStyle(highlighted ? accent : textMuted)
                Text(side.solved ? "✓ Solved" : "✗ Not solved")
                    .font(Brand.font(20, .bold))
                    .foregroundStyle(side.solved ? Color(hex: 0x16A34A) : lossFG)
            }
            .frame(height: Self.headerBlockHeight, alignment: .top)
            VStack(spacing: 14) {
                ForEach(0..<min(side.grids.count, 2), id: \.self) { i in
                    boardCard(grid: side.grids[i], tinted: side.won, maxSide: multiBoard ? 260 : 380)
                }
            }
            if side.grids.count > 2 {
                Text("+\(side.grids.count - 2) more").font(Brand.font(18, .bold)).foregroundStyle(textMuted)
                    .padding(.top, 10)
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Same tinted/bordered board card as the daily share card (uniform grid).
    /// Sized by the SHARED row/col counts and padded with empty rows, so every
    /// card on the image has identical dimensions regardless of guess count.
    private func boardCard(grid: [[TileState]], tinted won: Bool, maxSide: CGFloat) -> some View {
        let cols = sharedCols
        let rows = sharedRows
        let gap: CGFloat = max(3, maxSide * 0.012)
        let pad: CGFloat = maxSide * 0.04
        let inner = maxSide - pad * 2
        let tile = floor(min((inner - gap * CGFloat(cols - 1)) / CGFloat(cols),
                             (inner - gap * CGFloat(rows - 1)) / CGFloat(rows)))
        return VStack(spacing: gap) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let state: TileState = r < grid.count && c < grid[r].count ? grid[r][c] : .empty
                        RoundedRectangle(cornerRadius: max(4, tile * 0.12)).fill(tileColor(state))
                            .frame(width: tile, height: tile)
                    }
                }
            }
        }
        .padding(pad)
        .background(RoundedRectangle(cornerRadius: 18).fill(won ? boardWinTint : boardLossTint))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(won ? winFG : lossFG, lineWidth: 4))
    }

    private func tileColor(_ s: TileState) -> Color {
        switch s {
        case .correct: return Color(hex: 0x7C3AED)
        case .present: return Color(hex: 0xF59E0B)
        case .absent, .hintUsed: return Color(hex: 0x9CA3AF)
        case .empty: return Color(hex: 0xE5E7EB)
        }
    }
}

/// Renders the VS share card to a PNG and presents the native share sheet with
/// [image, text] — image for Messages/WhatsApp, text+link for everything else.
enum VSShareService {
    @MainActor
    static func share(card: VSShareCardView, text: String) {
        #if canImport(UIKit)
        let renderer = ImageRenderer(content: card)
        renderer.proposedSize = .init(card.size)
        renderer.scale = 1
        var items: [Any] = [text]
        if let image = renderer.uiImage { items.insert(image, at: 0) }
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
        var top = root
        while let p = top.presentedViewController { top = p }
        let av = UIActivityViewController(activityItems: items, applicationActivities: nil)
        av.popoverPresentationController?.sourceView = top.view
        av.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
        top.present(av, animated: true)
        #endif
    }
}

/// Prominent head-to-head FINAL SCORE card — the first thing under the result
/// headline. Big totals (winner highlighted, loser dimmed), the exact
/// calculation under each (guesses + time penalty), solve badges, and a
/// "lowest score wins" footnote. Replaces the old inverted comparison bars,
/// which read backwards (lower-is-better bars looked like the loser led).
struct VSScoreCard: View {
    struct Player {
        let name: String
        let score: Double
        let guesses: Int
        let timeMs: Double
        let solved: Bool
        let isWinner: Bool
    }

    let me: Player
    let opponent: Player
    let isDraw: Bool

    var body: some View {
        VStack(spacing: 14) {
            Text("FINAL SCORE").font(Brand.font(10, .heavy)).tracking(1.5).foregroundStyle(Theme.textMuted)
            HStack(alignment: .top, spacing: 10) {
                column(me, accent: Color(hex: 0x7C3AED))
                Text("VS")
                    .font(Brand.font(13, .black)).foregroundStyle(Theme.textMuted)
                    .padding(.top, 34)
                column(opponent, accent: Color(hex: 0xEC4899))
            }
            Text("Score = guesses + time (1 pt per 45s) · lowest score wins — but solving always beats not solving")
                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11ySummary)
    }

    /// One spoken sentence for the whole score card.
    private var a11ySummary: String {
        func side(_ p: Player) -> String {
            "\(p.name): score \(String(format: "%.2f", p.score)), \(p.guesses) guesses, \(Self.clock(p.timeMs)), \(p.solved ? "solved" : "not solved")"
        }
        let outcome = isDraw ? "Draw" : (me.isWinner ? "You won" : "\(opponent.name) won")
        return "Final score. \(outcome). \(side(me)). Versus. \(side(opponent)). Lowest score wins, but solving always beats not solving."
    }

    private func column(_ p: Player, accent: Color) -> some View {
        let highlighted = p.isWinner || isDraw
        let timePenalty = max(0, p.score - Double(p.guesses))
        return VStack(spacing: 5) {
            HStack(spacing: 4) {
                if p.isWinner && !isDraw {
                    Image(systemName: "crown.fill").font(.system(size: 10)).foregroundStyle(Color(hex: 0xF59E0B))
                }
                Text(p.name).font(Brand.font(11, .heavy)).foregroundStyle(accent).lineLimit(1)
            }
            Text(String(format: "%.2f", p.score))
                .font(Brand.font(36, .black)).monospacedDigit()
                .foregroundStyle(highlighted ? accent : Theme.textMuted)
                .minimumScaleFactor(0.6).lineLimit(1)
            // The exact calculation, spelled out.
            Text("\(p.guesses) guesses + \(String(format: "%.2f", timePenalty)) time")
                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            Text(Self.clock(p.timeMs))
                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            // Solve badge — the tiebreak that actually decides most matches.
            HStack(spacing: 3) {
                Image(systemName: p.solved ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(.system(size: 10))
                Text(p.solved ? "Solved" : "Not solved").font(Brand.font(10, .heavy))
            }
            .foregroundStyle(p.solved ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill((p.solved ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626)).opacity(0.10)))
        }
        .frame(maxWidth: .infinity)
        .opacity(highlighted ? 1 : 0.75)
    }

    private static func clock(_ ms: Double) -> String {
        let s = Int((ms / 1000).rounded())
        return "\(s / 60)m \(s % 60)s"
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
                Rectangle().fill(Theme.border).frame(height: 1)
                gauntletSection(label: opponentName, words: oppWords, accent: Color(hex: 0xEC4899), timeMs: opponentTimeMs)
            }
            .padding(16).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    @ViewBuilder private func gauntletSection(label: String, words: [String], accent: Color, timeMs: Int) -> some View {
        VStack(spacing: 8) {
            Text(label.uppercased())
                .font(Brand.font(10, .heavy)).tracking(0.8)
                .foregroundStyle(accent).lineLimit(1)
            if words.isEmpty {
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.vertical, 8)
            } else if let rec = GauntletReconstruct.reconstruct(seed: seed, guesses: words) {
                GauntletCompletedView(progress: rec.progress, totalTimeMs: timeMs, showSummary: true)
            } else {
                Text("\(words.count) guesses").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
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
                Rectangle().fill(Theme.border).frame(height: 1)
                recapSection(label: opponentName, words: oppWords, accent: Color(hex: 0xEC4899))
            }
            .padding(16).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
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
                HStack(spacing: 3) {
                    Image(systemName: allWon ? "checkmark.circle.fill" : "xmark.circle.fill").font(.system(size: 9))
                    Text("\(won)/\(boards.count) boards").font(Brand.font(9, .heavy))
                }
                .foregroundStyle(allWon ? Color(hex: 0x16A34A) : (won > 0 ? Color(hex: 0xD97706) : Color(hex: 0xDC2626)))
            }
            if words.isEmpty {
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.vertical, 8)
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: CompletedBoardLayout.gridSpacing), count: cols),
                          spacing: CompletedBoardLayout.gridSpacing) {
                    ForEach(boards.indices, id: \.self) { i in
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
                         pnRealRows: myFinalPNRows)
                    Rectangle().fill(Theme.border).frame(width: 1)
                    side(label: opponentName, boards: theirs, accent: Color(hex: 0xEC4899), solved: oppSolved)
                }
                // Reveal the answer so a missed board isn't a mystery. For
                // ProperNoundle use the puzzle's display so multi-word answers
                // keep their real spacing ("TRAE YOUNG", not "TRAEYOUNG").
                if let answer = solutions.first {
                    Text("Answer: \((pnPuzzle?.display ?? answer).uppercased())")
                        .font(Brand.font(11, .black)).tracking(1)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(16).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func side(label: String, boards: [Int: [VSResultBoards.EvaluatedRow]], accent: Color, solved: Bool,
                      pnRealRows: [VSPNRecapRow]? = nil) -> some View {
        let indices = boards.keys.sorted()
        return VStack(spacing: 8) {
            Text(label.uppercased())
                .font(Brand.font(10, .heavy)).tracking(0.8)
                .foregroundStyle(accent).lineLimit(1)
            // At-a-glance outcome for this side's boards.
            HStack(spacing: 3) {
                Image(systemName: solved ? "checkmark.circle.fill" : "xmark.circle.fill").font(.system(size: 9))
                Text(solved ? "Solved" : "Not solved").font(Brand.font(9, .heavy))
            }
            .foregroundStyle(solved ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
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
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
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
        return VStack(spacing: 3) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 3) {
                    ForEach(Array(row.letters.enumerated()), id: \.offset) { ci, letter in
                        Text(letter)
                            .font(Brand.font(tile * 0.5, .black)).foregroundStyle(.white)
                            .frame(width: tile, height: tile)
                            .background(RoundedRectangle(cornerRadius: 4).fill(tileBackground(row.states[safe: ci] ?? .absent)))
                    }
                }
            }
        }
    }

    private func tileBackground(_ state: TileState) -> AnyShapeStyle {
        switch state {
        case .correct:
            return AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)],
                                                startPoint: .topLeading, endPoint: .bottomTrailing))
        case .present:
            return AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)],
                                                startPoint: .topLeading, endPoint: .bottomTrailing))
        case .hintUsed:
            // Hint-row filler tile — same light gray as the in-game board
            // (BoardView), so a hint row reads distinctly from an absent guess.
            return AnyShapeStyle(Color(hex: 0xE5E7EB))
        default:
            return AnyShapeStyle(Theme.textMuted)
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
                        .font(Brand.font(9, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    barRow(pct: myPct, value: m.format(m.mine),
                           colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)])
                    barRow(pct: theirPct, value: m.format(m.theirs),
                           colors: [Color(hex: 0xF472B6), Color(hex: 0xEC4899)])
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func barRow(pct: Double, value: String, colors: [Color]) -> some View {
        HStack(spacing: 8) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border)
                    Capsule().fill(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * max(0.06, pct))
                        .animation(Theme.animation(.easeInOut(duration: 0.6)), value: pct)
                }
            }
            .frame(height: 12)
            Text(value)
                .font(Brand.font(10, .heavy)).foregroundStyle(Theme.textPrimary)
                .frame(width: 56, alignment: .trailing)
        }
    }
}
