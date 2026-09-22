import SwiftUI
import WordociousCore

/// The home-grid mode card, extracted verbatim from HomeView.cardBody (More
/// Games Stage 5) so the More Games sheet renders the SAME card point for
/// point. Daily completion (W/L badge, "4 guesses · 27s", accent tint) is a
/// DAILY-only concept: callers pass `done`/`vsWon` only in Daily mode.
struct ModeCardView: View {
    let mode: HomeMode
    /// Today's daily result for this mode (Daily mode only).
    var done: DailyCompletion? = nil
    /// Today's daily-VS outcome for the VS card (Daily mode only).
    var vsWon: Bool? = nil
    var locked: Bool = false
    /// The More Games tile's "N of M played" line — replaces the description.
    var subtitleOverride: String? = nil

    var body: some View {
        let isVs = mode.id == "vs"
        let isDone = done != nil || vsWon != nil
        let lockGray = Color(hex: 0xD1D5DB)
        let barColors = locked ? [lockGray, lockGray] : [mode.accent, mode.accent.opacity(0.53)]
        let borderC = locked ? lockGray : (isDone ? mode.accent.opacity(0.4) : Theme.border)
        return VStack(spacing: 0) {
            // Full-width top accent bar (flush, gradient → accent@0x88; gray when locked).
            LinearGradient(colors: barColors, startPoint: .leading, endPoint: .trailing)
                .frame(height: 4)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    ModeIconView(icon: mode.icon, accent: mode.accent, box: 32)
                    Spacer()
                    if let done { winBadge(won: done.completed) }
                    else if let vsWon { winBadge(won: vsWon) }
                }
                Text(mode.title).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                    .padding(.top, 8)
                Text(subtitleOverride ?? (isVs ? (vsWon != nil ? "Played today" : mode.desc) : resultText))
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.top, 1)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(RoundedRectangle(cornerRadius: 14).fill(isDone ? mode.accent.opacity(0.06) : Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(borderC, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .opacity(locked ? 0.6 : 1)
    }

    /// "4 guesses · 27s" — through the mode's guess semantics (Sudoku reads
    /// "0 mistakes", Letter Ladder "Par"), the shared cross-platform formatter.
    private var resultText: String {
        guard let done else { return mode.desc }
        return "\(formatGuessStat(semantics: mode.guessSemantics, guessBase: mode.guessBase, guessCount: done.guessCount)) · \(formatShortTime(Int(done.timeSeconds)))"
    }

    private func winBadge(won: Bool) -> some View {
        Text(won ? "W" : "L").font(Brand.font(10, .black)).foregroundStyle(.white)
            .frame(width: 20, height: 20)
            .background(RoundedRectangle(cornerRadius: 6).fill(Color(hex: won ? 0x7C3AED : 0xDC2626)))
    }
}
