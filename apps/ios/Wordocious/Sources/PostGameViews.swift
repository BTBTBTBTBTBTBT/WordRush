import SwiftUI
import WordociousCore

/// Per-mode header style (title + gradient) — mirrors the gradient titles in
/// the web game pages. Single-board gradients are audited from practice-game;
/// others derive from the mode accent.
enum ModeStyle {
    static func title(_ mode: GameMode) -> String {
        switch mode {
        case .duel: return "CLASSIC"
        case .duel6: return "CLASSIC SIX"
        case .duel7: return "CLASSIC SEVEN"
        case .quordle: return "QUADWORD"
        case .octordle: return "OCTOWORD"
        case .sequence: return "SUCCESSION"
        case .rescue: return "DELIVERANCE"
        case .gauntlet: return "GAUNTLET"
        case .propernoundle: return "PROPERNOUNDLE"
        default: return "WORDOCIOUS"
        }
    }
    /// Share-image mode label (special-cases Six/Seven like the web).
    static func shareLabel(_ mode: GameMode) -> String { title(mode) }

    static func accent(_ mode: GameMode) -> Color {
        switch mode {
        case .duel: return Color(hex: 0x7C3AED)
        case .duel6: return Color(hex: 0x06B6D4)
        case .duel7: return Color(hex: 0x84CC16)
        case .quordle: return Color(hex: 0xEC4899)
        case .octordle: return Color(hex: 0x7E22CE)
        case .sequence: return Color(hex: 0x2563EB)
        case .rescue: return Color(hex: 0x059669)
        case .gauntlet: return Color(hex: 0xD97706)
        case .propernoundle: return Color(hex: 0xDC2626)
        default: return Theme.primary
        }
    }

    static func gradient(_ mode: GameMode) -> [Color] {
        switch mode {
        case .duel: return [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)]
        case .duel6: return [Color(hex: 0x06B6D4), Color(hex: 0x22D3EE)]
        case .duel7: return [Color(hex: 0x84CC16), Color(hex: 0xA3E635)]
        default:
            let a = accent(mode)
            return [a, a.opacity(0.65)]
        }
    }

    /// Bright 3-stop title gradients used by the VS screens — 1:1 with the web's
    /// MODE_TITLE_GRADIENTS (vs-game.tsx). Default falls back to the DUEL stops.
    static func titleGradient(_ mode: GameMode) -> [Color] {
        switch mode {
        case .duel:          return [Color(hex: 0x22D3EE), Color(hex: 0x60A5FA), Color(hex: 0x2DD4BF)]
        case .quordle:       return [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)]
        case .octordle:      return [Color(hex: 0x22D3EE), Color(hex: 0xC084FC), Color(hex: 0xF472B6)]
        case .sequence:      return [Color(hex: 0xFACC15), Color(hex: 0xFB923C), Color(hex: 0xF87171)]
        case .rescue:        return [Color(hex: 0x818CF8), Color(hex: 0xC084FC), Color(hex: 0xE879F9)]
        case .propernoundle: return [Color(hex: 0xF87171), Color(hex: 0xFB7185), Color(hex: 0xFB923C)]
        case .duel6:         return [Color(hex: 0x22D3EE), Color(hex: 0x2DD4BF), Color(hex: 0x38BDF8)]
        case .duel7:         return [Color(hex: 0xA3E635), Color(hex: 0x4ADE80), Color(hex: 0x34D399)]
        case .gauntlet:      return [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)]
        default:             return [Color(hex: 0x22D3EE), Color(hex: 0x60A5FA), Color(hex: 0x2DD4BF)]
        }
    }
}

/// Post-game composite-score breakdown — ports score-breakdown.tsx.
struct ScoreBreakdownView: View {
    let gameMode: String
    let completed: Bool
    let guessCount: Int
    let timeSeconds: Int
    let boardsSolved: Int
    let totalBoards: Int

    var body: some View {
        let b = DailyScoring.breakdown(gameMode: gameMode, completed: completed, guessCount: guessCount,
                                       timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards)
        let guessesLeft = max(0, b.maxGuesses - guessCount)
        let timeUnder = max(0, b.timeCap - timeSeconds)
        return VStack(spacing: 2) {
            HStack {
                Text("SCORE BREAKDOWN").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                Spacer()
                Text("\(Int(b.total)) pts").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
            }
            .padding(.bottom, 4)
            row(completed ? "Win bonus" : "Did not finish", completed ? "" : "no win bonus", b.basePoints)
            if completed && b.hasHints { row("Guess bonus", "\(guessesLeft) unused × \(b.guessWeight)", b.guessBonus) }
            if completed { row("Time bonus", "\(fmt(timeUnder)) under \(fmt(b.timeCap))", b.timeBonus) }
            if completed && b.completionBonus > 0 {
                row("Completion bonus", totalBoards > 1 ? "\(boardsSolved)/\(totalBoards) boards" : "puzzle solved", b.completionBonus)
            }
            if b.hasHints { row("Hint penalty", "no hints — full credit", -b.hintPenalty, pure: completed) }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: 400)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }

    private func row(_ label: String, _ detail: String, _ value: Double, pure: Bool = false) -> some View {
        let sign = value > 0 ? "+" : value < 0 ? "−" : ""
        let abs = Swift.abs((value * 100).rounded() / 100)
        return HStack(alignment: .firstTextBaseline) {
            Text(label).font(Brand.font(12, .bold)).foregroundStyle(pure ? Color(hex: 0x16A34A) : Theme.textPrimary)
            if !detail.isEmpty { Text(detail).font(Brand.font(10, .regular)).foregroundStyle(Theme.textMuted).lineLimit(1) }
            Spacer()
            Text("\(sign)\(Int(abs))").font(Brand.font(12, .black))
                .foregroundStyle(value > 0 ? Theme.textPrimary : value < 0 ? Color(hex: 0xDC2626) : Theme.textMuted)
        }
    }

    private func fmt(_ s: Int) -> String { s <= 0 ? "0s" : (s >= 60 ? "\(s/60)m \(s%60)s" : "\(s)s") }
}

/// Dictionary definition card for single-word post-game — ports
/// post-game-summary.tsx (uses dictionaryapi.dev).
struct DefinitionCard: View {
    let solution: String
    @State private var def: WordOfTheDayView.WordInfo?
    @State private var loaded = false

    var body: some View {
        Group {
            if loaded, let d = def {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        if let p = d.phonetic, !p.isEmpty {
                            Text(p).font(Brand.font(12, .semibold)).foregroundStyle(Theme.textMuted)
                        }
                        if let pos = d.partOfSpeech, !pos.isEmpty {
                            Text(pos.uppercased()).font(Brand.font(10, .black)).tracking(0.6)
                                .foregroundStyle(Color(hex: 0xA78BFA))
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 4).fill(Theme.border))
                        }
                    }
                    if let def = d.definition {
                        Text(def).font(Brand.font(14, .medium)).foregroundStyle(Color(hex: 0x4A4A6A))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: 400, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
            }
        }
        .task {
            def = await WordOfTheDayView.definition(for: solution)
            loaded = true
        }
    }
}
