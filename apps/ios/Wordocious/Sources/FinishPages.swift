import SwiftUI
import WordociousCore

// The finishing build, phase 2 (docs/FINISH_SPEC.md §A6, §C2–C4, §C6): the shared
// PAGE pieces every tab / footer page reuses, so Leaderboard, Stats, Friends and the
// footer pages draw them identically (visual reference: docs/design/brand/mockups/
// leaderboard-polish.html + stats-friends-polish.html + finishing-touches.html):
//   §A6 `PageHeadline` — the page / day title art as a full-width headline
//   `FinishLabel` — the small caps card / section label (11 pt 900, 0.12 em)
//   `SoftSegmented` — the soft two-option toggle (Everyone | Friends, Today | All-time)
//   §C2 / §C3 `GamePickerCard` — ONE game picker window (WORDOCIOUS row + the Sweep
//       tile, PUZZLES row; every game visible, no scrolling rail)
//   §C2a `WLBadgeSlot` — the fixed-width W / L column left of a row's points
//   §C2 / §C4 `PodiumView` — the top-3 podium (gold / silver / bronze steps)
//   `.stripedRow` — the soft striped list rows
// Presentation only; Reduce Motion is honored by the shared squish.

// MARK: - §A6 / §N Page headlines

/// FINISH_SPEC §A6 + §N1 ("a calmer top"): a page / day title as a headline right on
/// the wallpaper — no box, no stage, no border, no float — and, since the titles were
/// re-shipped as LETTERING ONLY (the living cast row is the one whole-cast art on a
/// screen), a SMALLER centered headline: ≈62% of the content width, at most 300 pt
/// wide and 64 pt tall (every footer title lands on the same height). The Leaderboard
/// day title (which keeps its single host) is `.day`: ≈58% width, at most 150 pt tall.
/// `bleed` is kept for callers but no longer used (titles no longer run edge to edge);
/// `maxHeight` can only make a title smaller. Falls back to the gradient caps
/// `PageTitle` when the art is missing.
struct PageHeadline: View {
    enum Style {
        /// Page titles: ≈62% width, ≤ 300 pt wide, ≤ 64 pt tall.
        case page
        /// The Leaderboard day title: ≈58% width, ≤ 150 pt tall.
        case day

        var fraction: CGFloat { self == .day ? 0.58 : 0.62 }
        var maxWidth: CGFloat { self == .day ? 300 : 300 }
        var maxHeight: CGFloat { self == .day ? 150 : 64 }
    }

    let asset: String
    let label: String
    var style: Style = .page
    var bleed: CGFloat = 0
    var maxHeight: CGFloat? = nil

    init(asset: String, label: String, style: Style = .page, bleed: CGFloat = 0, maxHeight: CGFloat? = nil) {
        self.asset = asset
        self.label = label
        self.style = style
        self.bleed = bleed
        self.maxHeight = maxHeight
    }

    /// A page title (`art-title-<page>`).
    init(_ name: ArtTitleName, label: String? = nil, style: Style = .page, bleed: CGFloat = 0, maxHeight: CGFloat? = nil) {
        self.init(asset: name.assetName, label: label ?? name.label, style: style, bleed: bleed, maxHeight: maxHeight)
    }

    var body: some View {
        if ArtAsset.exists(asset) {
            let h = min(style.maxHeight, maxHeight ?? .infinity)
            HeadlineFitLayout(fraction: style.fraction, maxWidth: style.maxWidth) {
                Image(asset)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(maxHeight: h)
            }
            .shadow(color: Color(hex: 0x28145A).opacity(0.14), radius: 6, x: 0, y: 4)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isHeader)
        } else {
            PageTitle(label, colors: PageHeaderStyle.purplePink)
                .frame(maxWidth: .infinity)
        }
    }
}

/// Takes the full offered width itself, offers its child `fraction` of it (at most
/// `maxWidth`) and centers the child — the §N1 headline rule.
struct HeadlineFitLayout: Layout {
    let fraction: CGFloat
    let maxWidth: CGFloat

    private func inner(_ width: CGFloat) -> CGFloat { min(width * fraction, maxWidth) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? maxWidth / fraction
        let child = subviews.first?.sizeThatFits(ProposedViewSize(width: inner(width), height: nil)) ?? .zero
        return CGSize(width: width, height: child.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let w = inner(bounds.width)
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: w, height: nil))
            view.place(at: CGPoint(x: bounds.midX, y: bounds.minY), anchor: .top,
                       proposal: ProposedViewSize(width: size.width, height: size.height))
        }
    }
}

// MARK: - Labels

/// The small caps label on tinted cards and above sections (mockup `.lbl`):
/// 11 pt Nunito Black, 0.12 em tracking, in the card's label color.
struct FinishLabel: View {
    let text: String
    var color: Color = Color(hex: 0x5B3C96)

    init(_ text: String, color: Color = Color(hex: 0x5B3C96)) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text.uppercased())
            .font(Brand.font(11, .black)).tracking(1.3)
            .foregroundStyle(Theme.isDark ? Theme.textSecondary : color)
            .lineLimit(1).minimumScaleFactor(0.7)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Soft segmented toggle

/// The soft two- (or more-) option toggle (mockup `.seg`): a tinted track, the
/// selected option a light pill with purple ink and a soft shadow. Every option
/// squishes (§A9).
struct SoftSegmented<Key: Hashable>: View {
    let options: [(key: Key, label: String)]
    @Binding var selection: Key
    var accent: Color = Color(hex: 0x7C3AED)
    var accessibilityLabel: String = ""
    var onChange: ((Key) -> Void)? = nil

    var body: some View {
        let dark = Theme.isDark
        HStack(spacing: 0) {
            ForEach(options, id: \.key) { opt in
                let on = opt.key == selection
                Button {
                    guard !on else { return }
                    Haptics.tap()
                    selection = opt.key
                    onChange?(opt.key)
                } label: {
                    Text(opt.label)
                        .font(Brand.font(12, .black))
                        .foregroundStyle(on ? (dark ? Color.white : Color(hex: 0x6D28D9)) : (dark ? Theme.textMuted : Color(hex: 0x8A78AD)))
                        .lineLimit(1).fixedSize()
                        .padding(.horizontal, 11).frame(minHeight: 28)   // §AB: grows with Larger Text
                        .background(Capsule().fill(on ? (dark ? accent.opacity(0.45) : Color(hex: 0xFFFBF6)) : .clear)
                            .shadow(color: on ? Color(hex: 0x4C1D95).opacity(0.12) : .clear, radius: 3, x: 0, y: 2))
                        .contentShape(Capsule())
                }
                .buttonStyle(.squish)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(3)
        .background(Capsule().fill(dark ? Color.white.opacity(0.08) : accent.wash(0.12)))
        .fixedSize()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// FINISH_SPEC BB2: a real candy segmented control — a tinted track, a filled thumb
/// in `accent` that slides between the options (white bold label on it), the other
/// labels in a legible dark ink, 38 pt tall, squishing on press. `selection` matching
/// no option shows no thumb (e.g. Stats with a game picked).
struct CandySegmented<Key: Hashable>: View {
    let options: [(key: Key, label: String)]
    let selection: Key?
    var accent: Color = Color(hex: 0x2563EB)
    var accessibilityLabel: String = ""
    let onSelect: (Key) -> Void
    @Namespace private var ns

    var body: some View {
        let dark = Theme.isDark
        HStack(spacing: 0) {
            ForEach(options, id: \.key) { opt in
                let on = opt.key == selection
                Button {
                    guard !on else { return }
                    Haptics.tap()
                    withAnimation(Theme.animation(Motion.spring)) { onSelect(opt.key) }
                } label: {
                    Text(opt.label)
                        .font(Brand.font(13, .black)).tracking(0.3)
                        // Off: dark ink on the light track (≥ 4.5:1).
                        .foregroundStyle(on ? Color.white : (dark ? Theme.textPrimary : FinishInk.heading))
                        .shadow(color: on ? .black.opacity(0.25) : .clear, radius: 0, x: 0, y: 1)
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .background {
                            if on {
                                ZStack {
                                    Capsule().fill(Color.black.mixed(over: accent, 0.28)).offset(y: 2)
                                    Capsule().fill(LinearGradient(colors: [Color.white.mixed(over: accent, 0.22), accent],
                                                                  startPoint: .top, endPoint: .bottom))
                                }
                                .matchedGeometryEffect(id: "thumb", in: ns)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.squish)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(3)
        .frame(height: 38)
        .background(Capsule().fill(dark ? Color.white.opacity(0.10) : accent.wash(0.16)))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - §C2 / §C3 The game picker window

/// FINISH_SPEC §C2 / §C2b / §C3: ONE game picker window for the Leaderboard and the
/// Stats page. A tinted card whose header strip carries the page's own controls
/// (Leaderboard: date + reset clock + ALL-TIME; Stats: the Today | All-time toggle),
/// then the WORDOCIOUS row (the eight sweep dailies in home order + the Sweep tile
/// as the 9th) and the PUZZLES row (the More Games dailies). Every game is visible
/// at once — no horizontal scrolling. Each tile is a mini game card tinted in its
/// game's color (selected = stronger tint + accent ring) and squishes on tap.
///
/// `selection` is a daily mode's dbKey, `GamePicker.sweep`, or any other key (no
/// tile selected — e.g. Stats' "today" / "all"). `results` optionally marks tiles
/// with today's W / L badge (true = won).
struct GamePickerCard<Header: View>: View {
    let selection: String
    /// The window's page accent (Leaderboard warm gold, Stats blue).
    var accent: Color = Color(hex: 0xF59E0B)
    /// Row-label ink.
    var ink: Color = Color(hex: 0x8A4A12)
    var results: [String: Bool] = [:]
    /// Draw the Sweep tile (the Leaderboard and Stats both do).
    var showSweep: Bool = true
    var sweepResult: Bool? = nil
    /// FINISH_SPEC §AU2: ONE horizontally scrolling row of smaller tiles
    /// (Wordocious + Sweep, a divider, then Puzzles) instead of two labeled rows.
    var compact: Bool = false
    let onSelect: (String) -> Void
    @ViewBuilder var header: () -> Header

    @ObservedObject private var flags = FlagsService.shared

    /// WORDOCIOUS — the home order (core tiles, flag-gated, the wide VS / More tiles excluded).
    private var wordModes: [HomeMode] {
        homeModes.filter { flags.isOn($0.flagKey) && !$0.homeWide && $0.dbKey != nil }
    }
    /// PUZZLES — the More Games dailies behind their flags (menu.more switches the row off).
    private var puzzleModes: [HomeMode] {
        guard homeModes.contains(where: { $0.id == "more" && flags.isOn($0.flagKey) }) else { return [] }
        return moreDailyModes(moreModes.filter { flags.isOn($0.flagKey) })
    }

    var body: some View {
        let puzzles = puzzleModes
        let words = wordModes
        let dark = Theme.isDark
        VStack(spacing: 0) {
            header()
                .padding(.horizontal, 14).padding(.vertical, 9)
                .frame(maxWidth: .infinity)
                .background(dark ? Color.white.opacity(0.04) : accent.wash(0.10))
            // FINISH_SPEC BB3: the same two-row grid everywhere (every game visible, no
            // sideways scroll); `compact` (the Leaderboard) shrinks the tiles + gaps.
            VStack(alignment: .leading, spacing: compact ? 5 : 8) {
                FinishLabel("Wordocious", color: ink)
                PickerTileRow(gap: compact ? 5 : 6, maxSide: compact ? 32 : 44) {
                    ForEach(words) { m in tile(m) }
                    if showSweep { sweepTile }
                }
                if !puzzles.isEmpty {
                    FinishLabel("Puzzles", color: ink).padding(.top, compact ? 1 : 4)
                    PickerTileRow(gap: compact ? 4 : 5, maxSide: compact ? 30 : 40) {
                        ForEach(puzzles) { m in tile(m) }
                    }
                }
            }
            .padding(.horizontal, 12).padding(.top, compact ? 8 : 12).padding(.bottom, compact ? 9 : 14)
        }
        .tintedCard(accent: accent, tint: 0.07, line: 0.22)
    }

    private func tile(_ m: HomeMode) -> some View {
        let key = m.dbKey ?? m.id
        let on = selection == key
        return Button { Haptics.tap(); onSelect(key) } label: {
            PickerTile(accent: m.accent, selected: on, result: results[key]) { side in
                if let art = m.icon.gameArt {
                    GameArtImage(asset: art, size: side * 0.74)
                } else {
                    ModeIconView(icon: m.icon, accent: m.accent, box: side * 0.6)
                }
            }
        }
        .buttonStyle(.squish)
        .accessibilityLabel(m.title)
        .accessibilityValue(results[key].map { $0 ? "Won today" : "Lost today" } ?? "")
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// §C2b: the Daily Sweep as the 9th WORDOCIOUS tile (the glossy 3D broom).
    private var sweepTile: some View {
        let on = selection == GamePicker.sweep
        return Button { Haptics.tap(); onSelect(GamePicker.sweep) } label: {
            PickerTile(accent: GamePicker.sweepAccent, selected: on, result: sweepResult) { side in
                if ArtAsset.exists("game-sweep") {
                    GameArtImage(asset: "game-sweep", size: side * 0.74)
                } else {
                    Image("broom").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: side * 0.5, height: side * 0.5)
                        .foregroundStyle(GamePicker.sweepAccent)
                }
            }
        }
        .buttonStyle(.squish)
        .accessibilityLabel("Daily Sweep")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

enum GamePicker {
    /// The Sweep tile's key.
    static let sweep = "sweep"
    /// The Sweep tile's accent (gold).
    static let sweepAccent = Color(hex: 0xF59E0B)
}

/// One picker tile: a square mini game card (§A1 `gameTile` chrome — 13% wash, 34%
/// border, 4-pt top bar, soft shadow; selected = 26% wash + accent ring) with the
/// game icon and an optional W / L badge in the corner.
struct PickerTile<Icon: View>: View {
    let accent: Color
    var selected: Bool = false
    var result: Bool? = nil
    @ViewBuilder var icon: (CGFloat) -> Icon

    var body: some View {
        GeometryReader { g in
            let s = min(g.size.width, g.size.height)
            icon(s)
                .frame(width: g.size.width, height: g.size.height)
                .padding(.top, 2)
        }
        .aspectRatio(1, contentMode: .fit)
        .gameTile(accent: accent, selected: selected, radius: 12, bar: 4)
        .overlay(alignment: .topTrailing) {
            if let won = result {
                RowResultBadge(won: won, size: 15, label: won ? "Won today" : "Lost today")
                    .offset(x: 4, y: -4)
            }
        }
    }
}

/// One row of equal squares sized to the row's width (minus the gaps), at most
/// `maxSide`; centered, never wrapping, never scrolling.
struct PickerTileRow: Layout {
    var gap: CGFloat = 6
    var maxSide: CGFloat = 44

    private func side(_ width: CGFloat?, _ n: Int) -> CGFloat {
        guard n > 0 else { return 0 }
        guard let w = width, w.isFinite else { return maxSide }
        return max(16, min(maxSide, floor((w - gap * CGFloat(n - 1)) / CGFloat(n))))
    }

    private func total(_ s: CGFloat, _ n: Int) -> CGFloat { s * CGFloat(n) + gap * CGFloat(max(0, n - 1)) }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let n = subviews.count
        let s = side(proposal.width, n)
        let w = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? total(s, n)
        return CGSize(width: w, height: s)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let n = subviews.count
        let s = side(bounds.width, n)
        var x = bounds.minX + max(0, (bounds.width - total(s, n)) / 2)
        for v in subviews {
            v.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: s, height: s))
            x += s + gap
        }
    }
}

// MARK: - §C2a The W / L column

/// FINISH_SPEC §C2a: the W / L result badge in its OWN fixed-width column, placed
/// immediately LEFT of a row's points and vertically centered on the row, so the
/// badges stack in one even column down the list. A row without a result keeps the
/// column's space (empty) so the points still line up.
struct WLBadgeSlot: View {
    /// true = won, false = lost, nil = no badge (the slot stays empty).
    let won: Bool?
    var size: CGFloat = 20
    var label: String? = nil

    static let width: CGFloat = 24

    var body: some View {
        ZStack {
            if let won { RowResultBadge(won: won, size: size, label: label) }
        }
        .frame(width: Self.width)
    }
}

// MARK: - §C2 / §C4 The podium

/// One podium place.
struct PodiumEntry: Identifiable {
    let id: String
    let name: String
    /// The letter tile's username (initials + color).
    let username: String
    var accentHex: String? = nil
    var emoji: String? = nil
    /// The points / score text under the name ("2,005").
    let value: String
}

/// FINISH_SPEC §C2 / §C4: the top-three podium — letter-tile avatars on gold /
/// silver / bronze steps (2 · 1 · 3), a 3D crown on first place, soft numbers.
/// `compact` is the Friends race size. Rows after the top three list below it.
struct PodiumView: View {
    /// First, second, third (fewer is fine).
    let entries: [PodiumEntry]
    var compact: Bool = false
    /// Light-only pages (Friends): keep the light inks in dark mode.
    var lightOnly: Bool = false
    var onTap: ((PodiumEntry) -> Void)? = nil

    private static let gold = [Color(hex: 0xFFD66B), Color(hex: 0xF5A524)]
    private static let silver = [Color(hex: 0xE4E8F0), Color(hex: 0xAAB3C5)]
    private static let bronze = [Color(hex: 0xFFC9A0), Color(hex: 0xD9844A)]

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            column(place: 2)
            column(place: 1)
            column(place: 3)
        }
        .padding(.horizontal, 10).padding(.top, 12)
    }

    @ViewBuilder private func column(place: Int) -> some View {
        if place - 1 < entries.count {
            let e = entries[place - 1]
            let first = place == 1
            let avatar: CGFloat = compact ? (first ? 48 : 40) : (first ? 54 : 44)
            let step: CGFloat = compact ? [62, 46, 34][place - 1] : [74, 54, 40][place - 1]
            let colors = place == 1 ? Self.gold : (place == 2 ? Self.silver : Self.bronze)
            let content = VStack(spacing: 4) {
                if first {
                    Icon3D(.crown, size: compact ? 24 : 26).padding(.bottom, -8).zIndex(1)
                }
                LetterTileAvatar(username: e.username, size: avatar, accentHex: e.accentHex, emoji: e.emoji)
                Text(e.name)
                    .font(Brand.font(compact ? 12 : 13, .black))
                    .foregroundStyle(lightOnly ? FinishInk.title : FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text(e.value)
                    .font(Brand.font(compact ? 11 : 12, .heavy)).monospacedDigit()
                    .foregroundStyle(lightOnly ? FinishInk.muted : FinishInk.secondary)
                    .lineLimit(1).minimumScaleFactor(0.7)
                ZStack {
                    UnevenRoundedRect(top: 12)
                        .fill(LinearGradient(colors: colors, startPoint: .top, endPoint: .bottom))
                    Text("\(place)")
                        .font(Brand.font(compact ? 20 : 22, .black))
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.15), radius: 0, x: 0, y: 2)
                }
                .frame(height: step)
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Place \(place): \(e.name), \(e.value)")
            if let onTap {
                Button { onTap(e) } label: { content.contentShape(Rectangle()) }.buttonStyle(.squish)
            } else {
                content
            }
        } else {
            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
        }
    }
}

/// A rectangle with only its top corners rounded (iOS 16 has no
/// UnevenRoundedRectangle).
struct UnevenRoundedRect: Shape {
    var top: CGFloat

    func path(in rect: CGRect) -> Path {
        let r = min(top, rect.width / 2, rect.height)
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
        p.addQuadCurve(to: CGPoint(x: rect.minX + r, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
        p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + r), control: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

// MARK: - Striped rows

extension View {
    /// The soft striped list row (mockup `.lrow` / `.frow`): every other row takes a
    /// faint wash of the card's accent, with a hairline between rows.
    func stripedRow(_ index: Int, accent: Color = Color(hex: 0xF59E0B), divider: Bool = true) -> some View {
        let dark = Theme.isDark
        return self
            .background(index % 2 == 0 ? (dark ? Color.white.opacity(0.04) : accent.wash(0.10).opacity(0.75)) : Color.clear)
            .overlay(alignment: .top) {
                if divider && index > 0 {
                    Rectangle().fill(dark ? Color.white.opacity(0.06) : accent.opacity(0.10)).frame(height: 1)
                }
            }
    }
}
