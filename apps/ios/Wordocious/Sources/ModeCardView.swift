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

    private static let icon = HomeCardSpec.rowIcon
    /// BJ18: the Home grid's shared name size (HomeCardNameFit); a lone card keeps 17.
    @Environment(\.homeCardNameSizes) private var nameSizes
    /// This card's name size: its row's shared size (founder 10-10), else the spec size.
    private var nameSize: CGFloat { nameSizes[mode.title] ?? HomeCardSpec.name }

    var body: some View {
        let isVs = mode.id == "vs"
        let isDone = done != nil || vsWon != nil
        let lockGray = Color(hex: 0xD1D5DB)
        // Founder 10-03 ("align at the tops"): icon, name and badge share ONE top line; the
        // subtitle sits 4 under the name, beside the icon. The card hugs it (66 with the trim).
        // Founder 10-10 ("make the main titles a bit taller and more readable"): the name spans the full card width on
        // top; the icon (today's W / L on its corner) leads the subtitle line under it.
        return VStack(alignment: .leading, spacing: HomeCardSpec.descGap) {
            titleRow
            HStack(alignment: .center, spacing: 8) {
                iconView
                subtitle(isVs ? (vsWon != nil ? "Played today" : mode.desc) : resultText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        // Founder 10-10: the name across the card's top line with today's W / L badge back at its top-right end (its slot
        // is reserved, so solved and unsolved names line up).
        HStack(alignment: .center, spacing: 4) {
            titleText
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityLabel(unlimited && !locked ? "\(mode.title), Unlimited" : mode.title)
            Group {
                if let won = badgeWon { ResultBadge(won: won, size: HomeCardSpec.badge) }
            }
            .frame(width: HomeCardSpec.badge, height: HomeCardSpec.badge)
        }
    }

    /// The tile name's lettering (founder 10-10: "do the letters on the tiles need to have the borders?").
    @ViewBuilder private var titleText: some View {
        let ink = locked ? Theme.textMuted : mode.accent.onSeasonCard
        switch HomeCardTitleStyle.current {
        case .bubble:
            BubbleOneLine(text: mode.title.uppercased(), palette: .accent(ink), size: nameSize, minScale: 0.75, alignment: .leading)
        case .plainCaps:
            Text(mode.title.uppercased()).font(Brand.font(nameSize, .black)).tracking(0.4)
                .foregroundStyle(locked ? Theme.textMuted : ink.bubbleInk)
                .lineLimit(1).minimumScaleFactor(0.75)
        case .plain:
            Text(mode.title).font(Brand.font(nameSize + 1, .black))
                .foregroundStyle(locked ? Theme.textMuted : ink.bubbleInk)
                .lineLimit(1).minimumScaleFactor(0.75)
        }
    }

    /// The glossy game icon at 40 pt (no chip box); the old chip glyph when the art is missing.
    @ViewBuilder
    private var iconView: some View {
        if let art = mode.icon.gameArt {
            GameArtImage(asset: art, size: Self.icon)
        } else {
            ModeIconView(icon: mode.icon, accent: mode.accent, box: 26)
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
        // Founder 10-05 (2.7.1, "the finished game color" vanished under Haunted glass): on a DARK
        // season card a finished daily wears its game color — a deep accent glass (SeasonDone.wash)
        // and an accent glow instead of the season's orange — while an unplayed card stays plain
        // night glass, so finished reads at a glance. Android gameCardBg, web modeCardSurface.
        if let look = SeasonKit.surfaces, let seasonFill = look.cardFill {
            let wash: Double = look.dark ? (done ? SeasonDone.wash : SeasonDone.idle) : (done ? 0.16 : 0.08)
            let glow: Color = look.dark && done ? bar.opacity(SeasonDone.glow) : (look.glow ?? bar).opacity(look.dark ? 0.30 : 0.22)
            VStack(spacing: 0) {
                Color.clear.frame(height: Self.band)
                content
            }
            .background(ZStack(alignment: .top) {
                shape.fill(bar.opacity(wash))
                CardTrim(color: bar, locked: locked)
            })
            .clipShape(shape)
            .background(shape.fill(seasonFill)
                .shadow(color: glow, radius: look.dark && done ? 12 : 10, x: 0, y: look.dark ? 0 : 4))
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

/// A finished daily under a DARK season's glass (founder 10-05): the share of the game color over
/// the night card (finished / unplayed) and its glow. Android SeasonDone, web SEASON_DONE.
enum SeasonDone {
    static let wash = 0.355
    static let idle = 0.05
    static let glow = 0.55
    /// An unplayed hero progress tile: the game color's share over the night card (its icon dims).
    static let idleTile = 0.10
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

private struct HomeCardNameSizeKey: EnvironmentKey { static let defaultValue: [String: CGFloat] = [:] }

extension EnvironmentValues {
    /// Each card's name size by title (one size per grid ROW).
    var homeCardNameSizes: [String: CGFloat] {
        get { self[HomeCardNameSizeKey.self] }
        set { self[HomeCardNameSizeKey.self] = newValue }
    }
}

/// FINISH_SPEC BJ18: every card in a Home grid draws its name at ONE size — the largest that fits
/// the widest name in its slot (HomeCardSpec.uniformNameSize); a card's own minimumScaleFactor is
/// only the last resort. Android CardNameSizeScope, web FitName's shared size.
private struct HomeCardNameFit: ViewModifier {
    let titles: [String]
    var columns: Int = 2
    @State private var width: CGFloat = 0

    func body(content: Content) -> some View {
        // Founder 10-10 (Crosswordocious set every puzzle's name to ~12 pt): ONE size per grid ROW, so the two cards side
        // by side still match (BJ18's even look) while a short-named row keeps the full size.
        content
            .environment(\.homeCardNameSizes, Self.rowSizes(titles, width: width, columns: columns))
            .background(GeometryReader { g in
                Color.clear
                    .onAppear { width = g.size.width }
                    .onChange(of: g.size.width) { width = $0 }
            })
    }
}

extension HomeCardNameFit {
    static func rowSizes(_ titles: [String], width: CGFloat, columns: Int = 2) -> [String: CGFloat] {
        let slot = HomeCardSpec.nameSlot(gridWidth: width, columns: columns)
        var sizes: [String: CGFloat] = [:]
        for row in stride(from: 0, to: titles.count, by: columns) {
            let pair = Array(titles[row..<min(row + columns, titles.count)])
            let widths = pair.map { Brand.textWidth($0.uppercased(), HomeCardSpec.name, .black) * HomeCardSpec.bubbleWidth }
            let size = width > 0 ? HomeCardSpec.uniformNameSize(widths: widths, slot: slot) : HomeCardSpec.name
            for t in pair { sizes[t] = size }
        }
        return sizes
    }
}

extension View {
    /// BJ18: one card-name size across this grid of Home cards.
    func homeCardNames(_ titles: [String], columns: Int = 2) -> some View { modifier(HomeCardNameFit(titles: titles, columns: columns)) }
}

/// The Home tile name style. Founder 10-10 picked B (`plainCaps`) on the simulator; DEBUG `-tileTitleStyle` still flips it.
enum HomeCardTitleStyle: String {
    case bubble, plainCaps, plain
    static var current: HomeCardTitleStyle {
        #if DEBUG
        if let raw = UserDefaults.standard.string(forKey: "tileTitleStyle"), let s = HomeCardTitleStyle(rawValue: raw) { return s }
        #endif
        return .plainCaps   // founder 10-10 picked B: clean capitals, no outline
    }
}
