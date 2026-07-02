import SwiftUI
import WordociousCore

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
