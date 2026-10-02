import SwiftUI
import WordociousCore

/// The home mode card, shared by the WORDOCIOUS DAILIES and PUZZLES sections
/// (home redesign, 2026-10-01) so every game renders the SAME card point for
/// point. Daily completion (W/L badge, "4 guesses · 27s", accent tint) is a
/// DAILY-only concept: callers pass `done`/`vsWon` only in Daily mode.
///
/// Layout (ART_SPEC §18.2, the founder's ChatGPT mockup; web mode-card.tsx): a
/// white card, radius 18, a thick 10 pt band in the game's accent across its
/// rounded top, then a row — the glossy game icon at 52 pt (no chip box), the
/// game name in its accent (900, 16; shrinks to fit a long word) over the
/// description (secondary ink, 12.5, a fixed two-line box so Daily ⇄ Unlimited
/// never reflows the grid), and a small chevron. ~84 pt tall. Every state is as
/// before: the 3D W / L badge top-right over the band, the dimmed free-played
/// (locked) card with its gray band, the done tint, the result line in place of
/// the description once played, and Unlimited's infinity mark.
struct ModeCardView: View {
    let mode: HomeMode
    /// Today's daily result for this mode (Daily mode only).
    var done: DailyCompletion? = nil
    /// Today's daily-VS outcome for the VS card (Daily mode only).
    var vsWon: Bool? = nil
    var locked: Bool = false
    /// Pro's Unlimited mode (home redesign, founder 2026-10-01): no badges, a small
    /// infinity mark top-right in the accent instead.
    var unlimited: Bool = false

    /// §18.2 measures.
    private static let radius: CGFloat = 18
    private static let band: CGFloat = 10
    private static let icon: CGFloat = 52

    var body: some View {
        let isVs = mode.id == "vs"
        let isDone = done != nil || vsWon != nil
        let lockGray = Color(hex: 0xD1D5DB)
        let bandColors = locked ? [lockGray, lockGray] : [mode.accent, mode.accent.opacity(0.8)]
        let borderC = locked ? lockGray : (isDone ? mode.accent.opacity(0.4) : Theme.border)
        let shape = RoundedRectangle(cornerRadius: Self.radius)
        return VStack(spacing: 0) {
            // The thick top band in the game's accent (gray when locked), flush with
            // the card's rounded top (the clip rounds it).
            LinearGradient(colors: bandColors, startPoint: .leading, endPoint: .trailing)
                .frame(height: Self.band)
            HStack(spacing: 8) {
                iconView
                VStack(alignment: .leading, spacing: 2) {
                    // One line, scaled down before it wraps ("Crosswordocious").
                    Text(mode.title).font(Brand.font(16, .black))
                        .foregroundStyle(locked ? Theme.textMuted : mode.accent)
                        .lineLimit(1).minimumScaleFactor(0.68)
                    Text(isVs ? (vsWon != nil ? "Played today" : mode.desc) : resultText)
                        .font(Brand.font(12.5, .semibold)).foregroundStyle(Theme.textSecondary)
                        .lineLimit(2, reservesSpace: true)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.textMuted)
                    .accessibilityHidden(true)
            }
            .padding(.leading, 8).padding(.trailing, 6).padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: 84 - Self.band, alignment: .leading)
        }
        .background(ZStack {
            shape.fill(Theme.surface)
            if isDone { shape.fill(mode.accent.opacity(0.06)) }
        })
        .clipShape(shape)
        .overlay(shape.stroke(borderC, lineWidth: 1.5))
        // The corner mark over the band: today's W / L badge, or Unlimited's infinity.
        .overlay(alignment: .topTrailing) {
            if unlimited {
                if !locked {
                    Image(systemName: "infinity").font(.system(size: 13, weight: .bold))
                        .foregroundStyle(mode.accent).accessibilityLabel("Unlimited")
                        .padding(.top, Self.band + 4).padding(.trailing, 8)
                }
            } else if let done {
                winBadge(won: done.completed).padding(.top, 4).padding(.trailing, 6)
            } else if let vsWon {
                winBadge(won: vsWon).padding(.top, 4).padding(.trailing, 6)
            }
        }
        // ART_SPEC §11: an opaque base carrying the page-tinted lift, outside the clip.
        .background(shape.fill(Theme.surface).pageCardShadow())
        .opacity(locked ? 0.6 : 1)
    }

    /// The glossy game icon at 52 pt (no chip box); the old chip glyph when the art is missing.
    @ViewBuilder
    private var iconView: some View {
        if let art = mode.icon.gameArt {
            GameArtImage(asset: art, size: Self.icon)
        } else {
            ModeIconView(icon: mode.icon, accent: mode.accent, box: 44)
                .frame(width: Self.icon, height: Self.icon)
        }
    }

    /// "4 guesses · 27s" — through the mode's guess semantics (Sudoku reads
    /// "0 mistakes", Letter Ladder "Par"), the shared cross-platform formatter.
    private var resultText: String {
        guard let done else { return mode.desc }
        return "\(formatGuessStat(semantics: mode.guessSemantics, guessBase: mode.guessBase, guessCount: done.guessCount)) · \(formatShortTime(Int(done.timeSeconds)))"
    }

    /// ART_SPEC §4: the 3D W / L badge (26 pt, same corner).
    private func winBadge(won: Bool) -> some View {
        ResultBadge(won: won, size: 26)
    }
}
