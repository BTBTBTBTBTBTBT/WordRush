import SwiftUI
import WordociousCore

/// The home mode card, shared by the WORDOCIOUS DAILIES and PUZZLES sections
/// (home redesign, 2026-10-01) so every game renders the SAME card point for
/// point. Daily completion (W/L badge, "4 guesses · 27s", accent tint) is a
/// DAILY-only concept: callers pass `done`/`vsWon` only in Daily mode.
///
/// Layout (ART_SPEC §18.2, the founder's ChatGPT mockup; web mode-card.tsx): a
/// white card, radius 18, a thick 10 pt band in the game's accent across its
/// rounded top, then a row — the glossy game icon at 52 pt (no chip box) and a
/// text column pinned to the icon's height (§21.2): the game name in its accent
/// (900, 16; shrinks to fit a long word) on the icon's top edge, the description
/// (secondary ink, 12.5, up to two lines) on its bottom edge. No chevron (§21.4).
/// ~84 pt tall. Every state is as before: the 3D W / L badge (now at the end of
/// the title line, §21.1), the dimmed free-played (locked) card with its gray band, the
/// done tint, and the result line in place of the description once played. FINISH_SPEC §Y:
/// no infinity mark on Unlimited cards any more.
struct ModeCardView: View {
    let mode: HomeMode
    /// Today's daily result for this mode (Daily mode only).
    var done: DailyCompletion? = nil
    /// Today's daily-VS outcome for the VS card (Daily mode only).
    var vsWon: Bool? = nil
    var locked: Bool = false
    /// Pro's Unlimited mode (home redesign, founder 2026-10-01): no badges (and,
    /// FINISH_SPEC §Y, no infinity mark either).
    var unlimited: Bool = false

    /// §18.2 measures (radius, band and padding live on GameCardChrome).
    private static let icon: CGFloat = 52

    var body: some View {
        let isVs = mode.id == "vs"
        let isDone = done != nil || vsWon != nil
        let lockGray = Color(hex: 0xD1D5DB)
        // §21.2: the text column is pinned to the icon — exactly as tall as it,
        // title on the icon's top edge, the subtitle's last line on its bottom
        // edge (a two-line subtitle grows upward). If the text can't fit, the
        // column (and the card) grows and the icon stays centered on it.
        // §21.4: no trailing chevron; the column takes the full width.
        return HStack(alignment: .center, spacing: 8) {
            iconView
            VStack(alignment: .leading, spacing: 0) {
                titleRow
                Spacer(minLength: 2)
                // FINISH_SPEC §Z: the subtitle slot always reserves the description's
                // height, so a played card ("4 guesses · 27s", Daily) and the same card
                // in Unlimited (the description) are the same height — flipping the
                // Daily ⇄ Unlimited switch never moves the grid.
                ZStack(alignment: .bottomLeading) {
                    subtitle(mode.desc).hidden()
                    subtitle(isVs ? (vsWon != nil ? "Played today" : mode.desc) : resultText)
                }
            }
            .frame(maxWidth: .infinity, minHeight: Self.icon, alignment: .leading)
        }
        .padding(GameCardChrome.inner)
        .frame(maxWidth: .infinity, minHeight: 84 - GameCardChrome.band, alignment: .leading)
        .gameCardChrome(bar: locked ? lockGray : mode.accent, done: isDone && !locked,
                        border: locked ? lockGray : nil)
        .opacity(locked ? 0.6 : 1)
    }

    private func subtitle(_ text: String) -> some View {
        Text(text)
            .font(Brand.font(12.5, .semibold)).foregroundStyle(Theme.textSecondary)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Today's W / L outcome for the title-line badge (Daily only; never on Unlimited).
    private var badgeWon: Bool? {
        if unlimited { return nil }
        if let done { return done.completed }
        return vsWon
    }

    /// §21.1: the game name, one line (scaled down, then truncated), with today's
    /// W / L badge right-aligned at the end of the same row. The badge rides in an
    /// overlay centered on the title line (whose center sits on the cap-height
    /// middle), so solved and unsolved cards keep identical text alignment; the
    /// title reserves the badge's width and truncates before it.
    /// §Y: Unlimited has no mark in that slot (the infinity glyph is gone); VoiceOver
    /// still hears "Unlimited" on the title.
    private var titleRow: some View {
        let badgeSize: CGFloat = 26
        let won = badgeWon
        let reserve: CGFloat = won != nil ? badgeSize + 4 : 0
        return Text(mode.title).font(Brand.font(16, .black))
            .foregroundStyle(locked ? Theme.textMuted : mode.accent)
            .lineLimit(1).minimumScaleFactor(0.68)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, reserve)
            .accessibilityLabel(unlimited && !locked ? "\(mode.title), Unlimited" : mode.title)
            .overlay(alignment: .trailing) {
                if let won {
                    winBadge(won: won, size: badgeSize)
                }
            }
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

    /// ART_SPEC §4: the 3D W / L badge (26 pt), on the title line since §21.1.
    private func winBadge(won: Bool, size: CGFloat) -> some View {
        ResultBadge(won: won, size: size)
    }
}

/// ART_SPEC §18.2 / §21.5: the Home game card's chrome, shared by ModeCardView and
/// the two windows under the grids (Word of the Day, VS Battle) so all of them wear
/// the exact same treatment: white surface, radius 18, 1.5 pt border, the page-tinted
/// lift, and the thick colored top band across the rounded top. `done` adds the
/// completed card's accent wash + accent border. Callers pad their content with
/// `GameCardChrome.inner` (the game card's inner padding).
struct GameCardChrome: ViewModifier {
    static let radius: CGFloat = 18
    static let band: CGFloat = 10
    static let inner = EdgeInsets(top: 10, leading: 8, bottom: 10, trailing: 10)

    let bar: Color
    var done: Bool = false
    /// Overrides the border color (the locked card's gray); nil = the standard border.
    var border: Color? = nil

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Self.radius)
        // FINISH_SPEC §A1: no plain white — the card takes a soft wash of its own
        // accent (stronger once done) with an accent border. Dark keeps its surface.
        let dark = Theme.isDark
        let borderC = border ?? (dark ? (done ? bar.opacity(0.4) : Theme.border) : bar.wash(done ? 0.45 : 0.32))
        let fill: Color = dark ? Theme.surface : bar.wash(done ? 0.16 : 0.10)
        return VStack(spacing: 0) {
            // The thick top band (the clip rounds it into the card's top corners).
            LinearGradient(colors: [bar, bar.opacity(0.8)], startPoint: .leading, endPoint: .trailing)
                .frame(height: Self.band)
            content
        }
        .background(ZStack {
            shape.fill(fill)
            if dark && done { shape.fill(bar.opacity(0.06)) }
        })
        .clipShape(shape)
        .overlay(shape.stroke(borderC, lineWidth: 1.5))
        // ART_SPEC §11: an opaque base carrying the page-tinted lift, outside the clip.
        .background(shape.fill(fill).pageCardShadow())
    }
}

extension View {
    /// ART_SPEC §21.5: wrap in the Home game card's chrome (see GameCardChrome).
    func gameCardChrome(bar: Color, done: Bool = false, border: Color? = nil) -> some View {
        modifier(GameCardChrome(bar: bar, done: done, border: border))
    }
}
