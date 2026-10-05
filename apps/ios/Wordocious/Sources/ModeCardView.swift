import SwiftUI
import WordociousCore

/// The home mode card, shared by the WORDOCIOUS DAILIES and PUZZLES sections
/// (home redesign, 2026-10-01) so every game renders the SAME card point for
/// point. Daily completion (W/L badge, "4 guesses · 27s", accent tint) is a
/// DAILY-only concept: callers pass `done`/`vsWon` only in Daily mode.
///
/// Layout (FINISH_SPEC BH, the compact card; web mode-card.tsx, Android ModeCardView.kt):
/// 66 pt tall (was ~104), radius 16, no stroke, the candy cap trim (CardTrim) across its
/// rounded top; under it ONE top-aligned row: the glossy game icon at 40 pt, the game name in
/// its accent (900, 17, ONE line, scaling down for long names) and today's 3D W / L badge at
/// the row's end; ONE muted subtitle line (13 medium, ellipsis) 4 under the name. Locked: dimmed with a gray trim. FINISH_SPEC §Y: no infinity
/// mark on Unlimited cards; §Z: the subtitle line is always reserved, so Daily ⇄ Unlimited
/// never moves the grid.
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

    private static let icon = HomeCardSpec.icon
    /// BJ18: the Home grid's shared name size (HomeCardNameFit); a lone card keeps 17.
    @Environment(\.homeCardNameSize) private var nameSize

    var body: some View {
        let isVs = mode.id == "vs"
        let isDone = done != nil || vsWon != nil
        let lockGray = Color(hex: 0xD1D5DB)
        // Founder 10-03 ("align at the tops"): icon, name and badge share ONE top line; the
        // subtitle sits 4 under the name, beside the icon. The card hugs it (66 with the trim).
        return HStack(alignment: .top, spacing: 8) {
            iconView
            VStack(alignment: .leading, spacing: HomeCardSpec.descGap) {
                titleRow
                    .padding(.top, -3) // the name's cap height on the icon's top edge
                subtitle(isVs ? (vsWon != nil ? "Played today" : mode.desc) : resultText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, HomeCardSpec.padX)
        .padding(.top, HomeCardSpec.padTop).padding(.bottom, HomeCardSpec.padBottom)
        .frame(maxWidth: .infinity, minHeight: HomeCardSpec.height - GameCardChrome.band, alignment: .topLeading)
        .gameCardChrome(bar: locked ? lockGray : mode.accent, done: isDone && !locked, locked: locked)
        .opacity(locked ? 0.6 : 1)
    }

    private func subtitle(_ text: String) -> some View {
        Text(text)
            .font(Brand.font(HomeCardSpec.desc, .semibold)).foregroundStyle(Theme.textMuted)
            .lineLimit(1).minimumScaleFactor(0.9).truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Today's W / L outcome for the top row's badge (Daily only; never on Unlimited).
    private var badgeWon: Bool? {
        if unlimited { return nil }
        if let done { return done.completed }
        return vsWon
    }

    /// BH2: the game name on ONE line (scaled down for Crosswordocious / ProperNoundle,
    /// never wrapping) with today's W / L badge top-aligned at the row's end (its slot is
    /// reserved, so solved and unsolved names line up). §Y: VoiceOver still hears "Unlimited".
    private var titleRow: some View {
        HStack(alignment: .top, spacing: 4) {
            Text(mode.title).font(Brand.font(nameSize, .black))   // BJ18: the grid's ONE name size
                .foregroundStyle(locked ? Theme.textMuted : mode.accent.onSeasonCard)
                .lineLimit(1).minimumScaleFactor(0.6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityLabel(unlimited && !locked ? "\(mode.title), Unlimited" : mode.title)
            Group {
                if let won = badgeWon { ResultBadge(won: won, size: HomeCardSpec.badge) }
            }
            .frame(width: HomeCardSpec.badge, height: HomeCardSpec.badge, alignment: .top)
            .padding(.top, 2)
        }
    }

    /// The glossy game icon at 40 pt (no chip box); the old chip glyph when the art is missing.
    @ViewBuilder
    private var iconView: some View {
        if let art = mode.icon.gameArt {
            GameArtImage(asset: art, size: Self.icon)
        } else {
            ModeIconView(icon: mode.icon, accent: mode.accent, box: 34)
                .frame(width: Self.icon, height: Self.icon)
        }
    }

    /// "4 guesses · 27s" — through the mode's guess semantics (Sudoku reads
    /// "0 mistakes", Letter Ladder "Par"), the shared cross-platform formatter.
    private var resultText: String {
        guard let done else { return mode.desc }
        return CardLine.compact("\(formatGuessStat(semantics: mode.guessSemantics, guessBase: mode.guessBase, guessCount: done.guessCount)) · \(formatShortTime(Int(done.timeSeconds)))")
    }

}

/// ART_SPEC §18.2 / §21.5 + FINISH_SPEC BH: the Home game card's chrome, shared by ModeCardView
/// and the VS Battle window under the grids so all of them wear the exact same treatment: a soft
/// accent wash (no plain white, A1), radius 16, NO stroke (BH4), the page-tinted lift, and the
/// candy cap trim across the rounded top (BH1). `done` deepens the wash. Callers pad their
/// content with `GameCardChrome.inner`.
struct GameCardChrome: ViewModifier {
    static let radius: CGFloat = HomeCardSpec.radius
    /// The trim's solid band (its drips hang over the content's top padding).
    static let band: CGFloat = CardTrimGeometry.band
    static let inner = EdgeInsets(top: 10, leading: 8, bottom: 10, trailing: 10)

    let bar: Color
    var done: Bool = false
    var locked: Bool = false

    @ViewBuilder
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Self.radius)
        // FINISH_SPEC §A1: no plain white — the card takes a soft wash of its own
        // accent (stronger once done). Dark keeps its surface.
        let dark = Theme.isDark
        // Season surfaces: the season's translucent card (the wall glows through), its glow for
        // the lift, drawn ONCE (under the clip) so the opacity doesn't stack.
        if let look = SeasonKit.surfaces, let seasonFill = look.cardFill {
            VStack(spacing: 0) {
                Color.clear.frame(height: Self.band)
                content
            }
            .background(ZStack(alignment: .top) {
                shape.fill(bar.opacity(done ? 0.16 : 0.08))
                CardTrim(color: bar, locked: locked)
            })
            .clipShape(shape)
            .background(shape.fill(seasonFill)
                .shadow(color: (look.glow ?? bar).opacity(look.dark ? 0.30 : 0.22), radius: 10, x: 0, y: look.dark ? 0 : 4))
        } else {
            let fill: Color = dark ? Theme.surface : bar.wash(done ? 0.16 : 0.10)
            VStack(spacing: 0) {
                Color.clear.frame(height: Self.band)
                content
            }
            .background(ZStack(alignment: .top) {
                shape.fill(fill)
                if dark && done { shape.fill(bar.opacity(0.06)) }
                CardTrim(color: bar, locked: locked)
            })
            .clipShape(shape)
            // ART_SPEC §11: an opaque base carrying the page-tinted lift, outside the clip.
            .background(shape.fill(fill).pageCardShadow())
        }
    }
}

/// FINISH_SPEC BH1: the candy cap trim — ONE static shape: a slim glossy band in the game's
/// color (light lip → color → a deeper base, the highlight baked into the gradient) whose
/// bottom edge is a row of shallow frosting drips. No blur, no shadow, no animation.
struct CardTrim: View {
    let color: Color
    var locked: Bool = false

    var body: some View {
        let season = locked ? nil : SeasonKit.surfaces?.capStops(color)
        let stops: [Gradient.Stop] = season.map { s in
            [.init(color: s[0], location: 0), .init(color: s[1], location: 0.42), .init(color: s[2], location: 1)]
        } ?? (locked
            ? [.init(color: Color(hex: 0xE5E7EB), location: 0), .init(color: Color(hex: 0xC9CED6), location: 1)]
            : [.init(color: color.wash(0.45), location: 0), .init(color: color, location: 0.42),
               .init(color: color.mixed(over: .black, 0.86), location: 1)])
        CardTrimShape()
            .fill(LinearGradient(stops: stops, startPoint: .top, endPoint: .bottom))
            .frame(height: CardTrimGeometry.band + CardTrimGeometry.drip)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

struct CardTrimShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + CardTrimGeometry.band))
        for seg in CardTrimGeometry.segments(width: rect.width) {
            p.addQuadCurve(to: CGPoint(x: rect.minX + seg.end.x, y: rect.minY + seg.end.y),
                           control: CGPoint(x: rect.minX + seg.control.x, y: rect.minY + seg.control.y))
        }
        p.closeSubpath()
        return p
    }
}

extension View {
    /// ART_SPEC §21.5: wrap in the Home game card's chrome (see GameCardChrome).
    func gameCardChrome(bar: Color, done: Bool = false, locked: Bool = false) -> some View {
        modifier(GameCardChrome(bar: bar, done: done, locked: locked))
    }
}


// MARK: - BJ18 one name size per grid

private struct HomeCardNameSizeKey: EnvironmentKey { static let defaultValue: CGFloat = HomeCardSpec.name }

extension EnvironmentValues {
    var homeCardNameSize: CGFloat {
        get { self[HomeCardNameSizeKey.self] }
        set { self[HomeCardNameSizeKey.self] = newValue }
    }
}

/// FINISH_SPEC BJ18: every card in a Home grid draws its name at ONE size — the largest that fits
/// the widest name in its slot (HomeCardSpec.uniformNameSize); a card's own minimumScaleFactor is
/// only the last resort. Android CardNameSizeScope, web FitName's shared size.
private struct HomeCardNameFit: ViewModifier {
    let titles: [String]
    @State private var width: CGFloat = 0

    func body(content: Content) -> some View {
        let widths = titles.map { Brand.textWidth($0, HomeCardSpec.name, .black) }
        let size = width > 0 ? HomeCardSpec.uniformNameSize(widths: widths, slot: HomeCardSpec.nameSlot(gridWidth: width))
                             : HomeCardSpec.name
        content
            .environment(\.homeCardNameSize, size)
            .background(GeometryReader { g in
                Color.clear
                    .onAppear { width = g.size.width }
                    .onChange(of: g.size.width) { width = $0 }
            })
    }
}

extension View {
    /// BJ18: one card-name size across this grid of Home cards.
    func homeCardNames(_ titles: [String]) -> some View { modifier(HomeCardNameFit(titles: titles)) }
}
