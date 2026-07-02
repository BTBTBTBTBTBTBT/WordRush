import SwiftUI
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

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
                Text("WORDOCIOUS")
                    .font(Brand.font(56, .black))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                                    startPoint: .leading, endPoint: .trailing))
                    .padding(.top, 44)
                Text(modeLabel).font(Brand.font(38, .black)).foregroundStyle(accent).padding(.top, 10)
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
                .padding(.top, 22)

                Spacer()
                HStack(alignment: .top, spacing: 44) {
                    sideColumn(me, accent: mePurple)
                    Text("VS").font(Brand.font(34, .black)).foregroundStyle(textMuted).padding(.top, 120)
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

    private func sideColumn(_ side: Side, accent: Color) -> some View {
        let highlighted = side.won || isDraw
        return VStack(spacing: 10) {
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
            VStack(spacing: 14) {
                ForEach(0..<min(side.grids.count, 2), id: \.self) { i in
                    boardCard(grid: side.grids[i], tinted: side.won, maxSide: side.grids.count > 1 ? 260 : 380)
                }
            }
            if side.grids.count > 2 {
                Text("+\(side.grids.count - 2) more").font(Brand.font(18, .bold)).foregroundStyle(textMuted)
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Same tinted/bordered board card as the daily share card (uniform grid).
    private func boardCard(grid: [[TileState]], tinted won: Bool, maxSide: CGFloat) -> some View {
        let cols = grid.first?.count ?? 5
        let rows = max(grid.count, 1)
        let gap: CGFloat = max(3, maxSide * 0.012)
        let pad: CGFloat = maxSide * 0.04
        let inner = maxSide - pad * 2
        let tile = floor(min((inner - gap * CGFloat(cols - 1)) / CGFloat(cols),
                             (inner - gap * CGFloat(rows - 1)) / CGFloat(rows)))
        return VStack(spacing: gap) {
            ForEach(0..<grid.count, id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<grid[r].count, id: \.self) { c in
                        RoundedRectangle(cornerRadius: max(4, tile * 0.12)).fill(tileColor(grid[r][c]))
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

/// Side-by-side final boards WITH letters — yours from local play, the
/// opponent's reconstructed from the match-end guess log. Multi-board modes
/// are capped at 2 rendered boards per player with a "+N more" note.
struct VSFinalBoards: View {
    let myName: String
    let opponentName: String
    let myGuessLog: [VSGuessLogEntry]
    let opponentGuessLog: [VSGuessLogEntry]
    let solutions: [String]

    var body: some View {
        let mine = VSResultBoards.evaluate(log: myGuessLog, solutions: solutions)
        let theirs = VSResultBoards.evaluate(log: opponentGuessLog, solutions: solutions)

        let mySolved = VSResultBoards.solved(log: myGuessLog, solutions: solutions)
        let oppSolved = VSResultBoards.solved(log: opponentGuessLog, solutions: solutions)

        if !(mine.isEmpty && theirs.isEmpty) {
            VStack(spacing: 12) {
                HStack(alignment: .top, spacing: 16) {
                    side(label: myName, boards: mine, accent: Color(hex: 0x7C3AED), solved: mySolved)
                    Rectangle().fill(Theme.border).frame(width: 1)
                    side(label: opponentName, boards: theirs, accent: Color(hex: 0xEC4899), solved: oppSolved)
                }
                // Single-board modes: reveal the answer so a missed board isn't a
                // mystery. (Multi-board answer lists are too long to show here.)
                if solutions.count == 1, let answer = solutions.first {
                    Text("Answer: \(answer.uppercased())")
                        .font(Brand.font(11, .black)).tracking(1)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(16).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func side(label: String, boards: [Int: [VSResultBoards.EvaluatedRow]], accent: Color, solved: Bool) -> some View {
        let indices = boards.keys.sorted()
        let shown = Array(indices.prefix(2))
        let more = indices.count - shown.count
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
            if shown.isEmpty {
                Text("No guesses").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: 12) {
                    ForEach(shown, id: \.self) { idx in
                        letterBoard(boards[idx] ?? [])
                    }
                }
            }
            if more > 0 {
                Text("+\(more) more").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
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
