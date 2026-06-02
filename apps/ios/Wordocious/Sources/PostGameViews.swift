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

/// Web-parity finished-game header (ports the completion header in
/// octordle/quordle/rescue-game.tsx): gradient title, a stat row with the amber
/// trophy + boards-solved, total guesses, and the blue clock + time, a green
/// (won) or red (lost) summary line, then Home / Share links. Shared by the
/// live post-game screen and the reconstructed Solved-Puzzle view.
struct FinishedStatsHeader: View {
    let mode: GameMode
    let won: Bool
    let guessCount: Int
    let maxGuesses: Int            // 0 = unknown (hide the "/N")
    let timeSeconds: Int
    let boardsSolved: Int
    let totalBoards: Int
    var onHome: () -> Void
    var onShare: (() -> Void)? = nil

    private var timeStr: String { "\(timeSeconds / 60):\(String(format: "%02d", timeSeconds % 60))" }
    private var isMulti: Bool { totalBoards > 1 }

    var body: some View {
        VStack(spacing: 6) {
            Text(ModeStyle.title(mode)).font(Brand.font(28, .black))
                .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))

            HStack(spacing: 12) {
                if isMulti {
                    statItem(icon: "trophy.fill", color: Color(hex: 0xD97706), text: "\(boardsSolved)/\(totalBoards)")
                }
                Text(maxGuesses > 0 ? "\(guessCount)/\(maxGuesses) guesses" : "\(guessCount) guesses")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                statItem(icon: "clock", color: Color(hex: 0x60A5FA), text: timeStr)
            }

            Text(summary)
                .font(Brand.font(12, .bold))
                .foregroundStyle(won ? Color(hex: 0x16A34A) : Color(hex: 0xF87171))
                .multilineTextAlignment(.center)

            HStack(spacing: 16) {
                Button("Home", action: onHome)
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted).underline()
                if let onShare {
                    Button("Share", action: onShare)
                        .font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0x3B82F6)).underline()
                }
            }
        }
        .padding(.top, 8)
    }

    private var summary: String {
        if won {
            return isMulti
                ? "All \(totalBoards) solved in \(guessCount) guesses  ·  \(timeStr)"
                : "Solved in \(guessCount) guesses  ·  \(timeStr)"
        }
        return isMulti
            ? "\(boardsSolved)/\(totalBoards) solved  ·  \(timeStr)"
            : "Out of guesses  ·  \(timeStr)"
    }

    private func statItem(icon: String, color: Color, text: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 11)).foregroundStyle(color)
            Text(text).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
        }
    }
}

/// Your daily-leaderboard standing on the post-game screen — ports
/// daily-rank-badge.tsx. Hidden until ≥2 players have a result today.
struct DailyRankBadge: View {
    let gameMode: GameMode
    var playType: String = "solo"
    @State private var rank: (rank: Int, total: Int)?

    var body: some View {
        Group {
            if let r = rank, r.total >= 2 {
                let percentile = Int((1 - Double(r.rank - 1) / Double(r.total)) * 100)
                let top = max(1, 100 - percentile)
                let gold = percentile >= 75
                HStack(spacing: 4) {
                    Image(systemName: "trophy.fill").font(.system(size: 10))
                    Text("Top \(top)% · #\(r.rank) of \(r.total)").font(Brand.font(10, .black))
                }
                .foregroundStyle(gold ? Color(hex: 0x92400E) : Theme.textMuted)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(gold ? Color(hex: 0xFEF3C7) : Theme.surfaceHover))
                .overlay(Capsule().stroke(gold ? Color(hex: 0xFDE68A) : Theme.border, lineWidth: 1))
            }
        }
        .task(id: gameMode.rawValue) {
            guard let uid = AuthService.shared.profile?.id else { return }
            rank = await LeaderboardService.userRank(gameMode: gameMode, userId: uid, playType: playType)
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
/// Solution word + dictionary definition shown on single-board completed
/// screens (Classic / Six / Seven), ported 1:1 from the web completed-daily
/// "Solution + Definition" block: the word in bold, then a box with the
/// phonetic + part-of-speech pill + definition — or "No definition available
/// for this word." when the dictionary has no entry (so it always populates,
/// never a blank gap). `showWord` lets the live finished board (which already
/// spells the word in green tiles) omit the redundant heading.
struct DefinitionCard: View {
    let solution: String
    var showWord: Bool = true
    @State private var def: WordOfTheDayView.WordInfo?
    @State private var loaded = false

    var body: some View {
        VStack(spacing: 8) {
            if showWord {
                Text(solution.uppercased()).font(Brand.font(18, .black)).tracking(2)
                    .foregroundStyle(Theme.textPrimary)
            }
            if loaded {
                box   // full width — matches the Score Breakdown card
            }
        }
        .task(id: solution) {
            def = await WordOfTheDayView.definition(for: solution)
            loaded = true
        }
    }

    @ViewBuilder private var box: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let d = def {
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
            } else {
                Text("No definition available for this word.")
                    .font(Brand.font(13, .medium)).italic().foregroundStyle(Theme.textMuted)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }
}
