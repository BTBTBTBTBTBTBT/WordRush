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

        if !(mine.isEmpty && theirs.isEmpty) {
            HStack(alignment: .top, spacing: 16) {
                side(label: myName, boards: mine, accent: Color(hex: 0x7C3AED))
                Rectangle().fill(Theme.border).frame(width: 1)
                side(label: opponentName, boards: theirs, accent: Color(hex: 0xEC4899))
            }
            .padding(16).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func side(label: String, boards: [Int: [VSResultBoards.EvaluatedRow]], accent: Color) -> some View {
        let indices = boards.keys.sorted()
        let shown = Array(indices.prefix(2))
        let more = indices.count - shown.count
        return VStack(spacing: 8) {
            Text(label.uppercased())
                .font(Brand.font(10, .heavy)).tracking(0.8)
                .foregroundStyle(accent).lineLimit(1)
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
            return AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x22C55E), Color(hex: 0x16A34A)],
                                                startPoint: .topLeading, endPoint: .bottomTrailing))
        case .present:
            return AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xEAB308), Color(hex: 0xCA8A04)],
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
