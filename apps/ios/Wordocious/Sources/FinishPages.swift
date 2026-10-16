import SwiftUI
import UIKit
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
        /// Page titles: ≈62% width, ≤ 300 pt wide, ≤ 52 pt tall (BJ7: was 64 — crisper headers).
        case page
        /// The Leaderboard day title: ≈58% width, ≤ 150 pt tall.
        case day

        var fraction: CGFloat { self == .day ? 0.58 : 0.62 }
        var maxWidth: CGFloat { self == .day ? 300 : 300 }
        var maxHeight: CGFloat { self == .day ? 150 : 52 }
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

    /// A page title (`art-titlecast-<page>`).
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
        // Founder rule 10-10: no plain-text headings: the small card / section label is bubble lettering (hugs its text, shrinks
        // only when the row is tighter than it).
        BubbleLabel(text, color: color.bubbleInk, size: 13)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Founder 10-09: a card's title in the Wordocious bubble lettering (Word of the Day, Medals, Your trophy shelf ...),
/// never plain text. Small, leading, tinted in the card's color.
struct CardTitle: View {
    let text: String
    var color: Color = Color(hex: 0x7C3AED)
    var maxSize: CGFloat = 19

    init(_ text: String, color: Color = Color(hex: 0x7C3AED), maxSize: CGFloat = 19) {
        self.text = text
        self.color = color
        self.maxSize = maxSize
    }

    var body: some View {
        // Founder 10-10 (season readability): the ink lifts on dark surfaces (idempotent bubbleInk).
        BubbleTextView(text: text.uppercased(), palette: .accent(color.bubbleInk), maxSize: maxSize, minSize: 12, animated: false,
                       alignment: .leading)
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
    /// Founder 10-09: a smaller switch that sits quietly beside another control (Leaderboard's Everyone | Friends).
    var small: Bool = false

    /// Button family (10-05, README §4): every two-way switch is the candy segmented (frosted track +
    /// glossy purple thumb), compact here (32 pt, hugging its labels).
    var body: some View {
        CandySegmented(options: options, selection: selection, accent: accent,
                       accessibilityLabel: accessibilityLabel, height: small ? 26 : 32,
                       fontSize: small ? 11 : 13, labelPad: small ? 10 : 14) { k in
            selection = k
            onChange?(k)
        }
        .fixedSize()
    }
}

/// FINISH_SPEC BB2 + the candy toggle sprites (night art 10-03, "Small menus with flair"
/// proposal 1): the glossy candy track (art-toggle-*-track) with a glossy purple thumb
/// (art-toggle-*-thumb-on), both three-sliced, the thumb sliding (matched geometry: a position
/// change only) under the chosen option — white bold label on it, the deep purple ink off it.
/// `selection` matching no option shows no thumb. `accent` is kept for callers.
struct CandySegmented<Key: Hashable>: View {
    let options: [(key: Key, label: String)]
    let selection: Key?
    var accent: Color = Color(hex: 0x2563EB)
    var accessibilityLabel: String = ""
    var height: CGFloat = 38
    var fontSize: CGFloat = 13
    var labelPad: CGFloat = 14
    let onSelect: (Key) -> Void
    @Namespace private var ns
    @Environment(\.candyHue) private var hue

    var body: some View {
        let pad = CandySprite.pad(height)
        HStack(spacing: 0) {
            ForEach(options, id: \.key) { opt in
                let on = opt.key == selection
                Button {
                    guard !on else { return }
                    Haptics.tap()
                    withAnimation(Theme.animation(Motion.spring)) { onSelect(opt.key) }
                } label: {
                    Text(opt.label)
                        .font(Brand.font(fontSize, .black)).tracking(0.3)
                        .foregroundStyle(on ? CandyToggleInk.on : HueTint.color(CandyToggleInk.off, hue))
                        .shadow(color: on ? HueTint.color(Color(hex: 0x4C1D95), hue).opacity(0.45) : .clear, radius: 0, x: 0, y: 1)
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .padding(.horizontal, labelPad)
                        .frame(maxWidth: .infinity, minHeight: height - pad * 2)
                        .background {
                            if on { CandyPill(sprite: .thumbOn).matchedGeometryEffect(id: "thumb", in: ns) }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.squish)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(pad)
        .frame(height: height)
        .background(CandyPill(sprite: .track))
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
    @Environment(\.widthClass) private var widthClass
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
    /// 11b: no card and no header strip — the picker sits directly on the Leaderboard stage's backdrop.
    var bare: Bool = false
    let onSelect: (String) -> Void
    @ViewBuilder var header: () -> Header

    @ObservedObject private var flags = FlagsService.shared
    /// Item 35: re-sort when the player's saved game order changes.
    @ObservedObject private var orderStore = GameOrderStore.shared

    /// WORDOCIOUS — the home order (core tiles, flag-gated, the wide VS / More tiles excluded).
    private var wordModes: [HomeMode] {
        GameOrderStore.shared.ordered(homeModes.filter { flags.isOn($0.flagKey) && !$0.homeWide && $0.dbKey != nil }, section: .dailies)
    }
    /// PUZZLES — the More Games dailies behind their flags (menu.more switches the row off).
    private var puzzleModes: [HomeMode] {
        guard homeModes.contains(where: { $0.id == "more" && flags.isOn($0.flagKey) }) else { return [] }
        return GameOrderStore.shared.ordered(moreDailyModes(moreModes.filter { flags.isOn($0.flagKey) }), section: .puzzles)
    }

    @ViewBuilder var body: some View {
        let puzzles = puzzleModes
        let words = wordModes
        let dark = Theme.isDark
        let stack = VStack(spacing: 0) {
            if !bare {
                header()
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .frame(maxWidth: .infinity)
                    .background(dark ? Color.white.opacity(0.04) : accent.wash(0.10))
            }
            // FINISH_SPEC BB3: the same two-row grid everywhere (every game visible, no
            // sideways scroll); `compact` (the Leaderboard) shrinks the tiles + gaps.
            VStack(alignment: .leading, spacing: compact ? 5 : 8) {
                FinishLabel("Wordocious", color: ink)
                // 2.8 item 8: both rows share ONE tile size (sized for the longer row) and one gap, like Home's banner rows.
                // Founder 10-09: exactly Home's banner rows — one tile size (max 40) for both rows, each row spread edge
                // to edge with even gaps (BannerSpreadRow), on Stats and the Leaderboard alike.
                let slots = max(10, words.count + (showSweep ? 1 : 0), puzzles.count)
                BannerSpreadRow(slots: slots, maxTile: 40, minGap: 4, proportional: widthClass != .compact) {
                    ForEach(words) { m in tile(m) }
                    if showSweep { sweepTile }
                }
                .frame(maxWidth: .infinity)
                if !puzzles.isEmpty {
                    FinishLabel("Puzzles", color: ink).padding(.top, compact ? 1 : 4)
                    BannerSpreadRow(slots: slots, maxTile: 40, minGap: 4, proportional: widthClass != .compact) {
                        ForEach(puzzles) { m in tile(m) }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 12).padding(.top, bare ? 4 : (compact ? 8 : 12)).padding(.bottom, bare ? 6 : (compact ? 9 : 14))
        }
        if bare { stack } else { stack.tintedCard(accent: accent, tint: 0.07, line: 0.22) }
    }

    private func tile(_ m: HomeMode) -> some View {
        let key = m.dbKey ?? m.id
        return EquatablePickerTile(key: key, title: m.title, accent: m.accent, icon: m.icon,
                                   selected: selection == key, result: results[key], announcesResult: true,
                                   proportional: widthClass != .compact, onSelect: onSelect)
            .equatable()
    }

    /// §C2b: the Daily Sweep as the 9th WORDOCIOUS tile (the glossy 3D broom).
    private var sweepTile: some View {
        EquatablePickerTile(key: GamePicker.sweep, title: "Daily Sweep", accent: GamePicker.sweepAccent, icon: nil,
                            selected: selection == GamePicker.sweep, result: sweepResult, announcesResult: false,
                            proportional: widthClass != .compact, onSelect: onSelect)
            .equatable()
    }
}

/// One picker tile as an equality boundary (founder 10-10, smoothness): a game switch changes the selection ring on TWO of
/// the ~20 tiles, so only those two re-render (the rest used to rebuild their GeometryReader, chrome and art on every
/// pass of the tab). `onSelect` is kept out of `==` (it only forwards the tap); a theme change still re-evaluates.
struct EquatablePickerTile: View, Equatable {
    let key: String
    let title: String
    let accent: Color
    /// nil = the Sweep tile (the glossy broom).
    let icon: ModeIconKind?
    let selected: Bool
    let result: Bool?
    /// The game tiles announce "Won / Lost today"; the Sweep tile never did.
    let announcesResult: Bool
    /// Tablet add-on: the tile scales with its row (see BannerSpreadRow.proportional).
    var proportional: Bool = false
    let onSelect: (String) -> Void
    @ObservedObject private var theme = ThemeManager.shared

    static func == (a: EquatablePickerTile, b: EquatablePickerTile) -> Bool {
        a.key == b.key && a.title == b.title && a.accent == b.accent && a.selected == b.selected && a.result == b.result
            && a.proportional == b.proportional
    }

    var body: some View {
        Button { Haptics.tap(); onSelect(key) } label: {
            PickerTile(accent: accent, selected: selected, result: result, radius: proportional ? 20 : 12,
                       bar: 4, badgeRatio: proportional ? PickerTile<EmptyView>.tabletBadgeRatio : nil) { side in
                if let icon {
                    if let art = icon.gameArt {
                        GameArtImage(asset: art, size: side * 0.74)
                    } else {
                        ModeIconView(icon: icon, accent: accent, box: side * 0.6)
                    }
                } else if ArtAsset.exists("game-sweep") {
                    GameArtImage(asset: "game-sweep", size: side * 0.74)
                } else {
                    Image("broom").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: side * 0.5, height: side * 0.5)
                        .foregroundStyle(GamePicker.sweepAccent)
                }
            }
        }
        .buttonStyle(.squish)
        .accessibilityLabel(title)
        .accessibilityValue(announcesResult ? (result.map { $0 ? "Won today" : "Lost today" } ?? "") : "")
        .accessibilityAddTraits(selected ? .isSelected : [])
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
    /// 2.8 item 8: the same tile at Home's banner size (smaller radius / bar / badge).
    var radius: CGFloat = 12
    var bar: CGFloat = 4
    var badge: CGFloat = 15
    /// Tablet add-on: the badge is this share of the tile's side (nil = the fixed `badge` size).
    var badgeRatio: CGFloat? = nil
    @ViewBuilder var icon: (CGFloat) -> Icon

    var body: some View {
        GeometryReader { g in
            let s = min(g.size.width, g.size.height)
            icon(s)
                .frame(width: g.size.width, height: g.size.height)
                .padding(.top, 2)
        }
        .aspectRatio(1, contentMode: .fit)
        .gameTile(accent: accent, selected: selected, radius: radius, bar: bar)
        .overlay(alignment: .topTrailing) {
            if let won = result {
                GeometryReader { g in
                    let side = min(g.size.width, g.size.height)
                    RowResultBadge(won: won, size: badgeRatio.map { floor(side * $0) } ?? badge,
                                   label: won ? "Won today" : "Lost today")
                        .offset(x: 4, y: -4)
                        .frame(width: g.size.width, height: g.size.height, alignment: .topTrailing)
                }
            }
        }
    }

    /// The tablet badge: 13 / 33 of a phone tile's side, so it grows with the tile.
    static var tabletBadgeRatio: CGFloat { 0.39 }
}

/// One row of equal squares sized to the row's width (minus the gaps), at most
/// `maxSide`; centered, never wrapping, never scrolling.
struct PickerTileRow: Layout {
    var gap: CGFloat = 6
    var maxSide: CGFloat = 44
    /// 2.8 item 8: size the tiles for this many slots (so two rows of different counts share one tile size).
    var slots: Int? = nil

    private func side(_ width: CGFloat?, _ n: Int) -> CGFloat {
        guard n > 0 else { return 0 }
        guard let w = width, w.isFinite else { return maxSide }
        let count = max(n, slots ?? n)
        return max(16, min(maxSide, floor((w - gap * CGFloat(count - 1)) / CGFloat(count))))
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
    /// The player's user id (taps open their profile; the own-avatar match, BJ5).
    let id: String
    let name: String
    /// The player's username (their avatar's seed + directory key).
    let username: String
    var accentHex: String? = nil
    var emoji: String? = nil
    /// The points / score text under the name ("2,005").
    let value: String
    /// FINISH_SPEC BJ5: the row's photo — the podium draws the SAME avatar as the rows
    /// (it used to draw a mascot only, so a photo player looked like a stranger here).
    var avatarUrl: String? = nil
    /// The Pro mark, where the data says so (the own avatar wears it on its own).
    var pro: Bool = false
    /// The competition rank (ties share a metal + height); nil = the place index.
    var rank: Int? = nil
    /// The Friends board's taunt bell under the name (BJ4: friends stand on the podium too).
    var bell: (() -> Void)? = nil
    /// Founder 10-05: how the player got their points — the SAME detail line the board
    /// rows under the podium use ("4 Guesses · 1m 45s", "0 Mistakes · 3m 2s · No hints");
    /// one small muted line under the points. Nil = none (the Friends race: points only).
    var detail: String? = nil
    /// Founder 10-09: today's highlight on the daily race podium — "FLAWLESS · 89-DAY STREAK", "SWEEP", "26-DAY STREAK"
    /// (gold, under the points). Nil = none.
    var badge: String? = nil
}

/// 2.8 one-image podium (founder 10-15, "B, build both into the app"): ONE stadium image (`art-podium-stage`, 1536 x 1024,
/// transparent soft fade at its top, sides and bottom) laid across the content width, so it melts into the season wallpaper
/// behind the page. It carries the crowd, the lights and the three glossy steps with their numbers; each player's mascot
/// stands with its FEET on its step's top-surface center (core `PodiumArt`, a port of packages/core PODIUM_ART), the name
/// floats above it, and the stats print INSIDE the blank satin panel under the number. The same view is every podium in the
/// app: Leaderboard today, Yesterday, the Friends races, the Records sheet. From ONE result up (core PodiumLayout) the places
/// still free are `open`: the step stays, the panel reads "Open spot" · "Claim #N", R sleeps on it. Rows after the podium
/// list below it. Static image + the same living mascots as before: no new per-frame work.
struct PodiumView: View {
    /// First, second, third (fewer is fine).
    let allEntries: [PodiumEntry]
    /// BJ4: places drawn as open spots (from PodiumLayout.layout(ranks).open).
    var allOpen: [Int] = []
    var onTap: ((PodiumEntry) -> Void)? = nil
    /// Share cards (founder 10-16): draw this podium STATIC at exactly this width (pt) — no gestures, no load-in animation,
    /// the winner's glow at rest — with `shareHeadroom` (a fraction of the width) above the art. Nil = the live podium.
    var shareWidth: CGFloat? = nil
    var shareHeadroom: CGFloat = 0.14
    /// 2.8 item 13: tapping another player's standing mascot opens their mini Stage card.
    @State private var stageTarget: PodiumStageTarget?

    init(entries: [PodiumEntry], open: [Int] = [], onTap: ((PodiumEntry) -> Void)? = nil) {
        self.allEntries = entries; self.allOpen = open; self.onTap = onTap
    }
    /// Founder 10-12: podiums with no tap handler of their own (Yesterday's ledge) still offer View profile on the Stage card,
    /// through the page's profile route when it supplies one.
    @Environment(\.lbOpenProfile) private var openProfile
    private var cardOn: Bool { FlagsService.shared.isLive("podium_stage_card") }

    /// Room above the art for the standing mascots' heads, the crown and the names (fraction of the width). The crowd sits
    /// under it, so the figures rise out of the image the way the approved mockup shows.
    static let headroom: CGFloat = 0.2
    /// Tablets: the image scales with the page width up to this many points (core PodiumArt.maxWidthPt, 680: the WHOLE podium
    /// fits between the "#N of M" row and the tab bar on an iPad Pro 13 in portrait). Centered; phones are narrower.
    static let maxWidth = CGFloat(PodiumArt.maxWidthPt)
    /// Mascot box (the living figure's square, with its headroom) as a fraction of the width: ~120 / 102 pt on a phone, the
    /// size the old steps used. Where the drawn figure sits inside it comes from its layout bounds (PodiumPlace).
    static let goldFigure: CGFloat = 0.335
    static let otherFigure: CGFloat = 0.285

    /// The static share scene's height at `shareWidth` (art + headroom).
    static func shareHeight(width: CGFloat, headroom: CGFloat = 0.14) -> CGFloat { width * (headroom + 1 / CGFloat(PodiumArt.aspect)) }

    var body: some View {
        if let w = shareWidth {
            scene(width: w).frame(width: w, height: Self.shareHeight(width: w, headroom: shareHeadroom))
        } else {
            liveBody
        }
    }

    private var liveBody: some View {
        // Total height = the art's height + the headroom, both fractions of the width: the aspect is fixed, no measuring.
        Color.clear
            .aspectRatio(1 / (1 / CGFloat(PodiumArt.aspect) + Self.headroom), contentMode: .fit)
            .frame(maxWidth: Self.maxWidth)
            .overlay { GeometryReader { g in scene(width: g.size.width) } }
            .frame(maxWidth: .infinity)
            .softSheet(item: $stageTarget) { t in
                PodiumStageCard(entry: t.entry, place: t.place,
                                onProfile: onTap.map { tap in { tap(t.entry) } } ?? openProfile.map { open in { open(t.entry.id) } })
                    .presentationDetents([.height(412), .large])
            }
    }

    #if DEBUG
    /// `-podiumOpenDemo`: every podium shows only its top two with #3 open (open-spot capture; DEBUG only).
    private static let openDemo = ProcessInfo.processInfo.arguments.contains("-podiumOpenDemo")
    private var entries: [PodiumEntry] { Self.openDemo ? Array(allEntries.prefix(2)) : allEntries }
    private var open: [Int] { Self.openDemo ? [3] : allOpen }
    #else
    private var entries: [PodiumEntry] { allEntries }
    private var open: [Int] { allOpen }
    #endif

    private func scene(width w: CGFloat) -> some View {
        let h = w / CGFloat(PodiumArt.aspect)
        let top = w * (shareWidth != nil ? shareHeadroom : Self.headroom)
        return ZStack(alignment: .topLeading) {
            ArtThumbs.image("art-podium-stage", points: w)
                .resizable().interpolation(.high)
                .frame(width: w, height: h)
                .offset(y: top)
                .accessibilityHidden(true)
            ForEach(PodiumArt.steps, id: \.place) { s in
                let feet = CGPoint(x: CGFloat(s.feet.x) * w, y: top + CGFloat(s.feet.y) * h + CGFloat(PodiumArt.plantPt))
                let panel = CGRect(x: CGFloat(s.panel.x0) * w, y: top + CGFloat(s.panel.y0) * h,
                                   width: CGFloat(s.panel.x1 - s.panel.x0) * w, height: CGFloat(s.panel.y1 - s.panel.y0) * h)
                if s.place - 1 < entries.count {
                    let e = entries[s.place - 1]
                    PodiumPlace(entry: e, place: s.place, feet: feet, width: w,
                                onStage: cardOn && shareWidth == nil ? { stageTarget = PodiumStageTarget(entry: e, place: min(e.rank ?? s.place, 3)) } : nil,
                                onTap: shareWidth == nil ? onTap : nil, staticShare: shareWidth != nil)
                    panelText(e, panel: panel)
                } else if open.contains(s.place) {
                    emptySpot(place: s.place, feet: feet, panel: panel, width: w)
                }
            }
        }
        .frame(width: w, height: top + h, alignment: .topLeading)
    }

    // MARK: A standing place (PodiumPlace below)

    /// The stats INSIDE the satin panel, centered: the score, then up to two lines (guesses, time) — dark purple on all three.
    private func panelText(_ e: PodiumEntry, panel: CGRect) -> some View {
        let ink = Color(red: Double(PodiumArt.textRgb.r) / 255, green: Double(PodiumArt.textRgb.g) / 255, blue: Double(PodiumArt.textRgb.b) / 255)
        var lines = Self.detailLines(e.detail ?? "")
        if lines.count < 2 { lines += FriendCards.raceBadgeLines(e.badge).prefix(2 - lines.count) }
        return Self.panelLines(score: e.value, lines: lines, panel: panel, ink: ink)
            .accessibilityHidden(true)
    }

    static func panelLines(score: String, lines: [String], panel: CGRect, ink: Color) -> some View {
        let scoreSize = panel.height * CGFloat(PodiumArt.scoreHeight)
        let lineSize = panel.height * CGFloat(PodiumArt.detailHeight)
        return VStack(spacing: panel.height * 0.025) {
            Text(score.uppercased())
                .font(Brand.fixedFont(scoreSize, .black)).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.45)
            ForEach(Array(lines.prefix(2).enumerated()), id: \.offset) { _, line in
                Text(line.uppercased())
                    .font(Brand.fixedFont(lineSize, .heavy)).tracking(0.2).monospacedDigit()
                    .lineLimit(1).minimumScaleFactor(0.5)
            }
        }
        .foregroundStyle(ink)
        .frame(width: panel.width * 0.84, height: panel.height)
        .position(x: panel.midX, y: panel.midY)
    }

    // MARK: An open place

    /// BJ4: an open place — the step stays, R asleep on it, the panel reads "Open spot" · "Claim #N" in the same text style.
    @ViewBuilder
    private func emptySpot(place: Int, feet: CGPoint, panel: CGRect, width w: CGFloat) -> some View {
        let copy = PodiumLayout.openSpot(place)
        // Founder 10-15: the cloud rests ON the step (its bottom on the step-top center, core openSpot), not over the front rim.
        let ow = w * CGFloat(PodiumArt.openSpotWidth)
        let h = ow / CGFloat(PodiumArt.openSpotAspect)
        let bottom = feet.y - CGFloat(PodiumArt.plantPt) + CGFloat(PodiumArt.openSpotPlantPt)
        Ellipse()
            .fill(RadialGradient(colors: [Color.black.opacity(0.45), Color.black.opacity(0)], center: .center,
                                 startRadius: 0, endRadius: ow * 0.4))
            .frame(width: ow * 0.8, height: ow * 0.8 * 0.22)
            .position(x: feet.x, y: bottom - h * 0.04)
            .accessibilityHidden(true)
        ArtThumbs.image("art-scene-r-asleep", points: ow)
            .resizable().interpolation(.high).scaledToFit()
            .frame(width: ow, height: h)
            .opacity(0.9)
            .position(x: feet.x, y: bottom - h / 2)
            .accessibilityHidden(true)
        Self.panelLines(score: copy.title, lines: [copy.line], panel: panel,
                        ink: Color(red: Double(PodiumArt.textRgb.r) / 255, green: Double(PodiumArt.textRgb.g) / 255, blue: Double(PodiumArt.textRgb.b) / 255))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(A11yLabels.podiumOpenSpot(place))
    }

    /// The pedestal art (podium art 10-03, docs/design/brand/podium): `art-podium-N` wears
    /// its numeral; a step whose label isn't its metal's number takes the plain pedestal
    /// with the label on it. (The Stage card's pedestals still use it.)
    static func pedestalArt(tone: Int, numbered: Bool) -> String {
        "art-podium-\(min(max(tone, 1), 3))\(numbered ? "" : "-plain")"
    }

    /// BJ2: the podium image + the pedestals decoded off main before the Leaderboard / Home first shows them.
    static func prewarm() {
        var items: [(String, CGFloat)] = [("art-podium-stage", 400)]
        for t in 1...3 { items.append((pedestalArt(tone: t, numbered: true), 96)) }
        ArtThumbs.prewarm(items)
    }
}

extension PodiumView {
    /// A plaque's detail ("3 guesses · 1m 14s · 4/4") as at most two lines: the first part, then the rest.
    static func detailLines(_ detail: String) -> [String] {
        let parts = detail.split(separator: "·").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        guard let first = parts.first else { return [] }
        // Founder 10-12 ("3M 13S · 2/4 · 1 HI…"): with time, boards AND hints the second line overflowed. The hints part
        // joins the first line instead ("6 GUESSES · 1 HINT" / "3M 13S · 2/4"), so both lines fit.
        if parts.count >= 3, let h = parts.dropFirst().firstIndex(where: { $0.lowercased().contains("hint") }) {
            let rest = parts.enumerated().filter { $0.offset != 0 && $0.offset != h }.map(\.element)
            return ["\(first) · \(parts[h])", rest.joined(separator: " · ")]
        }
        return parts.count == 1 ? [first] : [first, parts.dropFirst().joined(separator: " · ")]
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

// MARK: - Candy toggles (night art 10-03 sprites)

/// The candy toggles (night art 10-03 sprites; "Small menus with flair" proposals 1 + 3, founder
/// 10-03): `art-toggle-{light,dark}-{track,thumb-on,switch,switch-on,knob}`. Pills are THREE-SLICED
/// (the round end caps keep their shape, only the middle stretches) into one cached bitmap per
/// size, so a toggle is a couple of plain images and only the thumb / knob moves (transform).
/// Mirrors web lib/candy-toggle.ts + Android CandyToggle.kt.
enum CandySprite: String {
    case track, thumbOn = "thumb-on", switchOff = "switch", switchOn = "switch-on", knob

    func assetName(dark: Bool) -> String { "art-toggle-\(dark ? "dark" : "light")-\(rawValue)" }

    private static var cache: [String: UIImage] = [:]

    /// The sprite three-sliced to `size` (points) at the screen scale; cached per name + size.
    static func pill(_ sprite: CandySprite, dark: Bool, size: CGSize) -> UIImage? {
        guard size.width >= 1, size.height >= 1 else { return nil }
        let name = sprite.assetName(dark: dark)
        let key = "\(name)@\(Int(size.width * 2))x\(Int(size.height * 2))"
        if let hit = cache[key] { return hit }
        guard let cg = UIImage(named: name)?.cgImage else { return nil }
        let sw = CGFloat(cg.width), sh = CGFloat(cg.height)
        let cap = min(sh / 2, sw / 2)
        let end = min(size.height / 2, size.width / 2)
        let fmt = UIGraphicsImageRendererFormat.preferred()
        fmt.opaque = false
        let img = UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in
            let c = ctx.cgContext
            // UIKit's context is flipped relative to CGImage drawing: draw through UIImage instead.
            func draw(_ src: CGRect, _ dst: CGRect) {
                guard dst.width > 0, let part = cg.cropping(to: src) else { return }
                UIImage(cgImage: part).draw(in: dst)
            }
            c.interpolationQuality = .high
            draw(CGRect(x: 0, y: 0, width: cap, height: sh), CGRect(x: 0, y: 0, width: end, height: size.height))
            draw(CGRect(x: cap, y: 0, width: max(1, sw - 2 * cap), height: sh),
                 CGRect(x: end, y: 0, width: size.width - 2 * end, height: size.height))
            draw(CGRect(x: sw - cap, y: 0, width: cap, height: sh), CGRect(x: size.width - end, y: 0, width: end, height: size.height))
        }
        if cache.count > 64 { cache.removeAll() }
        cache[key] = img
        return img
    }

    /// The groove inset of the track sprite: the thumb sits this far inside the track's rim.
    static func pad(_ height: CGFloat) -> CGFloat { max(2, (height * 0.12).rounded()) }
}

/// A three-sliced candy pill that fills its frame.
struct CandyPill: View {
    let sprite: CandySprite
    /// The Leaderboard's controls wear the selected game's hue: the sprite is pre-tinted once (HueTint), never a live filter.
    @Environment(\.candyHue) private var hue
    var body: some View {
        GeometryReader { g in
            if let img = CandySprite.pill(sprite, dark: Theme.isDark, size: g.size) {
                Image(uiImage: HueTint.image(img, key: "\(sprite.rawValue)|\(Theme.isDark)|\(Int(g.size.width))x\(Int(g.size.height))", hue)).resizable()
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The candy label inks: white on the glossy purple thumb, the deep purple (light) / lilac (dark) off it.
enum CandyToggleInk {
    static let on = Color.white
    static var off: Color { Theme.isDark ? Color(hex: 0xC4B5FD) : Color(hex: 0x6D28D9) }
}

/// The candy on/off switch (proposal 3): a short frosted-lilac track that turns glossy purple
/// (a crossfade) while a pearl knob springs across. Keeps `Toggle`'s switch semantics (VoiceOver
/// announces on/off); the row the Toggle sits in stays the hit area.
struct CandySwitchStyle: ToggleStyle {
    static let size = CGSize(width: 52, height: 30)

    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(spacing: 12) {
                configuration.label
                Spacer(minLength: 0)
                CandySwitchKnob(isOn: configuration.isOn)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish) // A9: the whole settings row squishes
        // VoiceOver hears a real switch (label + on / off), not a button.
        .accessibilityRepresentation { Toggle(isOn: configuration.$isOn) { configuration.label } }
    }
}

struct CandySwitchKnob: View {
    let isOn: Bool
    var body: some View {
        let s = CandySwitchStyle.size
        let knob = s.height - 4
        ZStack(alignment: .leading) {
            CandyPill(sprite: .switchOff)
            CandyPill(sprite: .switchOn).opacity(isOn ? 1 : 0)
            Image(Theme.isDark ? "art-toggle-dark-knob" : "art-toggle-light-knob").resizable()
                .frame(width: knob, height: knob)
                .offset(x: isOn ? s.width - knob - 2 : 2)
        }
        .frame(width: s.width, height: s.height)
        .animation(Theme.animation(.spring(response: 0.28, dampingFraction: 0.6)), value: isOn)
        .accessibilityHidden(true)
    }
}

extension ToggleStyle where Self == CandySwitchStyle {
    static var candy: CandySwitchStyle { CandySwitchStyle() }
}


/// One podium place on the one-image podium: the player's mascot (or framed photo tile) with its lowest drawn pixel on
/// the step-top `feet`, the crown on #1's head, and the name floating ABOVE the head (above the crown on #1) with a clear
/// gap. Everything is measured against the DRAWN figure (the layout's bounds), not its padded box, so a tall hat or a
/// round head never touches the label. #1 gets the one calm load-in (glow, sparkles, crown drop).
struct PodiumPlace: View {
    let entry: PodiumEntry
    let place: Int
    /// Where the figure's feet land (the scene's coordinates).
    let feet: CGPoint
    /// The podium image's width (pt): sizes everything.
    let width: CGFloat
    /// Opens the mini Stage card (nil = the card is off).
    let onStage: (() -> Void)?
    let onTap: ((PodiumEntry) -> Void)?
    /// A share image: no buttons, the winner's glow at rest, no sparkles (one static frame).
    var staticShare = false
    @ObservedObject private var directory = AvatarDirectory.shared

    /// The label's clear gap above the DRAWN head (pt), and above the crown on #1 (core PODIUM_ART).
    static var nameGap: CGFloat { CGFloat(PodiumArt.nameGapPt) }
    static var crownGap: CGFloat { CGFloat(PodiumArt.nameGapPt + PodiumArt.crownGapPt) }

    var body: some View {
        let e = entry
        let tone = min(e.rank ?? place, 3)
        let first = place == 1
        let box = width * (tone == 1 ? PodiumView.goldFigure : PodiumView.otherFigure)
        let living = PodiumFigure.standsFull(e)
        let side = living ? box : box * 0.5
        let b = living ? (PodiumFigure.bounds(e, place: place, size: side, exact: staticShare) ?? AvatarRect(x: 0.12, y: 0.1, w: 0.76, h: 0.84))
                       : AvatarRect(x: 0, y: 0, w: 1, h: 1)
        let figBottom = feet.y + CGFloat(1 - (b.y + b.h)) * side
        let figTop = figBottom - side
        let headTop = figTop + CGFloat(b.y) * side
        let crownSize = width * 0.085
        let crownTop = headTop + crownSize * 0.2 - crownSize
        // Founder 10-15: bigger names that hug the head (core nameSize / nameWidth / nameGapPt), shrunk to fit their slot.
        let nameSize = width * CGFloat(first ? PodiumArt.nameSizeGold : PodiumArt.nameSizeOther)
        let nameH = nameSize * 1.3
        // A standing #1 wears the crown hat (inside the drawn bounds), so only a photo tile still carries the crown icon.
        let iconCrown = first && !living
        let nameTop = (iconCrown ? crownTop - Self.crownGap : headTop - Self.nameGap) - nameH + nameSize * 0.14   // the bubble line has ~0.14 em of air under its glyphs
        let nameWidth = width * CGFloat(first ? PodiumArt.nameWidthGold : PodiumArt.nameWidthOther)
        let cw = max(nameWidth, side)
        let unitH = figBottom - nameTop
        let shadowW = CGFloat(b.w) * side * CGFloat(PodiumArt.shadowWidth)
        let ownsCard = !staticShare && (DressUp.isOwn(e.id) || (living && onStage != nil) || onTap != nil)

        ZStack(alignment: .topLeading) {
            // The contact shadow under the feet (a static radial, no blur).
            Ellipse()
                .fill(RadialGradient(colors: [Color.black.opacity(0.5), Color.black.opacity(0)], center: .center,
                                     startRadius: 0, endRadius: shadowW / 2))
                .frame(width: shadowW, height: shadowW * 0.26)
                .position(x: feet.x, y: feet.y)
            if first && staticShare {
                let c = PodiumWinnerIntro.glowRgb
                let gold = Color(red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255)
                let d = side * CGFloat(PodiumWinnerIntro.glowSize)
                Circle()
                    .fill(RadialGradient(gradient: Gradient(stops: [.init(color: gold.opacity(0.9), location: 0),
                                                                    .init(color: gold.opacity(0.4), location: 0.5),
                                                                    .init(color: gold.opacity(0), location: 1)]),
                                         center: .center, startRadius: 0, endRadius: d / 2))
                    .frame(width: d, height: d).opacity(PodiumWinnerIntro.glowRestOpacity)
                    .position(x: feet.x, y: figTop + side / 2)
            } else if first {
                PodiumWinnerGlow(diameter: side * CGFloat(PodiumWinnerIntro.glowSize))
                    .position(x: feet.x, y: figTop + side / 2)
            }
            unit(e, side: side, living: living, cw: cw, nameWidth: nameWidth, nameSize: nameSize,
                 unitH: unitH, figTop: figTop - nameTop, crownTop: crownTop - nameTop, crownSize: crownSize, first: iconCrown, ownsCard: ownsCard)
                .position(x: feet.x, y: nameTop + unitH / 2)
            if first && Self.sparkling && !staticShare {
                ForEach(0..<PodiumWinnerIntro.sparkleOffsets.count, id: \.self) { i in
                    let o = PodiumWinnerIntro.sparkleOffsets[i]
                    PodiumWinnerSparkle(size: side * CGFloat(PodiumWinnerIntro.sparkleSize),
                                        delay: (PodiumWinnerIntro.sparkleDelayMs + Double(i) * PodiumWinnerIntro.sparkleStaggerMs) / 1000)
                        .position(x: feet.x + CGFloat(o[0]) * side, y: figTop + side / 2 + CGFloat(o[1]) * side)
                }
            }
            if let bell = e.bell, !staticShare {
                // the Friends board's taunt bell: small, beside the name on the step's outer side
                Button(action: bell) {
                    Icon3D(.bell, size: 16).frame(width: 30, height: 24).contentShape(Rectangle())
                }
                .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
                .accessibilityLabel("Taunt \(e.name)")
                .position(x: min(feet.x + nameWidth / 2 + 4, width - 17), y: nameTop + nameH / 2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private static var sparkling: Bool { !(Theme.reduceMotion || ProcessInfo.processInfo.isLowPowerModeEnabled) }

    @ViewBuilder
    private func unit(_ e: PodiumEntry, side: CGFloat, living: Bool, cw: CGFloat, nameWidth: CGFloat, nameSize: CGFloat,
                      unitH: CGFloat, figTop: CGFloat, crownTop: CGFloat, crownSize: CGFloat, first: Bool, ownsCard: Bool) -> some View {
        let tone = min(e.rank ?? place, 3)
        let content = ZStack(alignment: .topLeading) {
            BubbleOneLine(text: e.name.uppercased(),
                          palette: .accent(PlayerTint.nameColor(userId: e.id, username: e.username)),
                          size: nameSize, minScale: CGFloat(PodiumArt.nameMinScale))
                .frame(width: nameWidth)
                .background {
                    // Founder 10-09: a soft glow in the player's secondary (pattern) color behind the name so it pops.
                    let glow = PlayerTint.secondaryColor(userId: e.id, username: e.username)
                    ZStack {
                        if !PerfFlags.noPodGlow {
                            Capsule().fill(glow.opacity(0.55)).padding(.horizontal, nameWidth * 0.2).padding(.vertical, -4).blur(radius: 12)
                            Capsule().fill(glow.opacity(0.9)).padding(.horizontal, nameWidth * 0.3).padding(.vertical, 3).blur(radius: 6)
                        }
                    }
                }
                .offset(x: (cw - nameWidth) / 2, y: 0)
            PodiumFigure(entry: e, place: place, tone: tone, size: side, living: living)
                .frame(width: side, height: side)
                .offset(x: (cw - side) / 2, y: figTop)
            if first {
                PodiumWinnerCrown(size: crownSize)
                    .offset(x: (cw - crownSize) / 2, y: crownTop)
            }
        }
        .frame(width: cw, height: unitH, alignment: .topLeading)
        Group {
            if ownsCard {
                // Founder 10-05 (door 1): your own place opens your Stage; a standing mascot opens its mini Stage card.
                Button {
                    if DressUp.isOwn(e.id) { DressUp.shared.open() }
                    else if living, let onStage { Haptics.tap(); onStage() }
                    else { onTap?(e) }
                } label: { content.contentShape(Rectangle()) }.buttonStyle(.squish)
            } else {
                content
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(A11yLabels.podiumPlace(e.rank ?? place, name: e.name, points: e.value, detail: e.detail))
        .accessibilityHint(living && onStage != nil && !DressUp.isOwn(e.id) ? "Opens their stage" : "")
    }
}

/// 2.8 item 13 (founder 10-07: "full-body mascots STANDING on their steps, no tile frame"): the figure itself. A mascot
/// player (no photo) is drawn as the free-standing living mascot in the pose of their place while
/// `AvatarLiveConfig.livingMascot` is on (the remote `living_mascot` switch); everyone else, and the whole podium while it
/// is off, keeps the framed AvatarView. The one-image podium (10-15) sets where its feet land; no glow behind it any more
/// (the stadium art carries the light).
struct PodiumFigure: View {
    let entry: PodiumEntry
    let place: Int
    let tone: Int
    /// The figure's square (pt): the living mascot's box, or the framed tile's side.
    let size: CGFloat
    /// Whether this place stands full-body (`standsFull`), decided once by the podium.
    let living: Bool

    @ObservedObject private var directory = AvatarDirectory.shared

    private var resolved: AvatarResolve.Resolved {
        directory.look(username: entry.username, userId: entry.id, url: entry.avatarUrl, castId: nil, frame: nil,
                       mascot: nil, accentHex: LetterTileAvatar.defaultAccentHex(username: entry.username, accentHex: entry.accentHex),
                       lookup: true).resolved
    }

    /// Whether this entry stands full-body (a mascot player with the living mascot on and its rig art shipped).
    static func standsFull(_ e: PodiumEntry) -> Bool {
        guard AvatarLiveConfig.livingMascot else { return false }
        let r = AvatarDirectory.shared.look(username: e.username, userId: e.id, url: e.avatarUrl, castId: nil, frame: nil,
                                            mascot: nil, accentHex: nil, lookup: true).resolved
        return r.photoUrl == nil && LivingMascotView.canAnimate(r.config)
    }

    /// The standing figure's DRAWN bounds in the box's fractions (head / hat top, feet bottom), from the same live layout the
    /// mascot is painted with. nil when it doesn't stand full-body.
    static func bounds(_ e: PodiumEntry, place: Int, size: CGFloat, exact: Bool = false) -> AvatarRect? {
        let r = AvatarDirectory.shared.look(username: e.username, userId: e.id, url: e.avatarUrl, castId: nil, frame: nil,
                                            mascot: nil, accentHex: nil, lookup: true).resolved
        guard r.photoUrl == nil, LivingMascotView.canAnimate(r.config), let fit = MascotParts.fit else { return nil }
        let c = podiumConfig(r.config, place: place)
        let l = LiveLayoutMemo.layout(c, small: size <= MascotParts.smallSize, manifest: fit)
        // The live layout's bounds keep ROOM above the head for every pose's raised arms, so its top floats over the real head.
        // The drawn head / hat top is the highest non-arm piece's first inked row (founder 10-15: names 4 pt above the head).
        var b = l.bounds
        let arms: Set<String> = ["armL", "armR", "handL", "handR"]
        let tops = l.layers.filter { !arms.contains($0.ride ?? "") && !$0.layer.hasPrefix("arm") && !$0.art.hasSuffix("-armL") && !$0.art.hasSuffix("-armR") }
            .map { $0.rect.y + MascotArtCache.inkTop($0.art, exact: exact) * $0.rect.h }
        if let head = tops.min(), head > b.y, head < b.y + b.h * 0.5 {
            b.h -= head - b.y; b.y = head
        }
        return b
    }

    /// The config the podium draws: posed for its place, no frame; first place WEARS the crown (core podiumWinnerHead, founder
    /// 10-15: the fitted crown hat instead of a crown icon floating over the head).
    static func podiumConfig(_ config: AvatarConfig, place: Int) -> AvatarConfig {
        var c = config; c.pose = AvatarPose.placePose(place); c.frame = "none"
        if place == 1 { c.head = PodiumArt.winnerHead(c.head) }
        return c
    }

    var body: some View {
        let r = resolved
        if living, r.photoUrl == nil, LivingMascotView.canAnimate(r.config) {
            let posed: AvatarConfig = { var c = Self.podiumConfig(r.config, place: place); c.frame = r.config.frame; return c }()
            let initial = AvatarCatalog.initial(entry.username)
            LivingMascotView(config: posed, initial: initial, size: size, cutout: true, interactive: false, own: DressUp.isOwn(entry.id),
                             label: A11yLabels.mascot(own: DressUp.isOwn(entry.id), name: entry.name))
                .frame(width: size, height: size)
        } else {
            AvatarView(url: entry.avatarUrl, username: entry.username, size: size, accentHex: entry.accentHex, emoji: entry.emoji,
                       pro: entry.pro, userId: entry.id)
        }
    }
}


/// 2.8 item 13: which podium mascot was tapped (its mini Stage card).
struct PodiumStageTarget: Identifiable {
    let entry: PodiumEntry
    let place: Int
    var id: String { entry.id }
}

/// The #1 load-in, part 1: a soft gold radial glow behind the mascot that fades and scales in once (CSS ease-out), then rests
/// at a low opacity. Static (the resting look) under Reduce Motion. Transform + opacity only. (Core PODIUM_WINNER_INTRO.)
private struct PodiumWinnerGlow: View {
    let diameter: CGFloat
    @State private var on = false
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        let calm = envReduce || Theme.reduceMotion
        let c = PodiumWinnerIntro.glowRgb
        let gold = Color(red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255)
        Circle()
            .fill(RadialGradient(gradient: Gradient(stops: [
                .init(color: gold.opacity(0.9), location: 0),
                .init(color: gold.opacity(0.4), location: 0.5),
                .init(color: gold.opacity(0), location: 1),
            ]), center: .center, startRadius: 0, endRadius: diameter / 2))
            .frame(width: diameter, height: diameter)
            .scaleEffect(calm || on ? CGFloat(PodiumWinnerIntro.glowToScale) : CGFloat(PodiumWinnerIntro.glowFromScale))
            .opacity(calm || on ? PodiumWinnerIntro.glowRestOpacity : 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear {
                guard !calm else { return }
                let e = PodiumWinnerIntro.glowEase
                withAnimation(.timingCurve(e[0], e[1], e[2], e[3], duration: PodiumWinnerIntro.glowMs / 1000)) { on = true }
            }
    }
}

/// Part 2: a small four-point sparkle that fades in, drifts up a few points and fades out, once, over `sparkleMs`
/// (staggered by `delay`).
private struct PodiumWinnerSparkle: View {
    let size: CGFloat
    let delay: Double
    @State private var shown = false
    @State private var drift = false

    var body: some View {
        let c = PodiumWinnerIntro.sparkleRgb
        let life = PodiumWinnerIntro.sparkleMs / 1000
        PodiumSparkleShape()
            .fill(Color(red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255))
            .frame(width: size, height: size)
            .scaleEffect(shown ? 1 : 0.6)
            .offset(y: drift ? -CGFloat(PodiumWinnerIntro.sparkleDriftPt) : 0)
            .opacity(shown ? PodiumWinnerIntro.sparklePeakOpacity : 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear {
                withAnimation(.linear(duration: life).delay(delay)) { drift = true }
                withAnimation(.easeOut(duration: life * 0.35).delay(delay)) { shown = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + delay + life * 0.4) {
                    withAnimation(.easeIn(duration: life * 0.6)) { shown = false }
                }
            }
    }
}

/// A four-point sparkle.
private struct PodiumSparkleShape: Shape {
    func path(in r: CGRect) -> Path {
        let w = r.width, h = r.height
        let pts: [(CGFloat, CGFloat)] = [(0.5, 0), (0.62, 0.38), (1, 0.5), (0.62, 0.62), (0.5, 1), (0.38, 0.62), (0, 0.5), (0.38, 0.38)]
        var p = Path()
        for (i, q) in pts.enumerated() {
            let pt = CGPoint(x: r.minX + q.0 * w, y: r.minY + q.1 * h)
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }
}

/// Part 3: the crown drops onto #1's head gently: ease-out over the intro's crown duration, a tiny dip below rest at ~70% of the
/// move, then back to rest. Once.
private struct PodiumWinnerCrown: View {
    let size: CGFloat
    /// 0 = above (hidden), 1 = dipped slightly below rest, 2 = at rest.
    @State private var stage = 0
    @Environment(\.accessibilityReduceMotion) private var envReduce

    var body: some View {
        let calm = envReduce || Theme.reduceMotion
        let st = calm ? 2 : stage
        Icon3D(.crown, size: size)
            .offset(y: st == 0 ? -CGFloat(PodiumWinnerIntro.crownDropPt) : (st == 1 ? CGFloat(PodiumWinnerIntro.crownSettlePt) : 0))
            .opacity(st == 0 ? 0 : 1)
            .onAppear {
                guard !calm else { return }
                let total = PodiumWinnerIntro.crownMs / 1000
                DispatchQueue.main.asyncAfter(deadline: .now() + PodiumWinnerIntro.crownDelayMs / 1000) {
                    withAnimation(.easeOut(duration: total * 0.7)) { stage = 1 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + total * 0.7) {
                        withAnimation(.easeInOut(duration: total * 0.3)) { stage = 2 }
                    }
                }
            }
    }
}

/// 2.8 item 13: the mini Stage card a podium mascot opens: that player's mascot standing on the stage in their backdrop,
/// posed for the place they hold, then their name, points and a quiet View profile pill. Nothing new is fetched.
struct PodiumStageCard: View {
    let entry: PodiumEntry
    let place: Int
    var onProfile: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let r = AvatarDirectory.shared.look(username: entry.username, userId: entry.id, url: entry.avatarUrl, castId: nil, frame: nil,
                                            mascot: nil, accentHex: LetterTileAvatar.defaultAccentHex(username: entry.username, accentHex: entry.accentHex),
                                            lookup: true).resolved
        let posed: AvatarConfig = { var c = r.config; c.pose = AvatarPose.placePose(place); return c }()
        let dark = Theme.isDark
        VStack(spacing: 0) {
            DressStage(config: posed, initial: AvatarCatalog.initial(entry.username),
                       photo: r.photoUrl != nil ? (r.photoUrl, entry.username, entry.id) : nil,
                       height: 250, mascotSize: 160, mascotLabel: A11yLabels.mascot(own: false, name: entry.name),
                       glow: [Color(hex: 0xFCD34D), Color(hex: 0xE2E8F0), Color(hex: 0xFB923C)][min(max(place, 1), 3) - 1],
                       finish: true) {
                VStack {
                    HStack {
                        Spacer(minLength: 0)
                        StageCloseButton(label: "Close") { dismiss() }
                    }
                    Spacer(minLength: 0)
                }
                .padding(8)
            }
            // Founder 10-09 ("no more plain text anywhere"): the name and the points in the bubble lettering, the name in
            // the player's own color (their backdrop), and View profile as the family candy button.
            VStack(spacing: 6) {
                BubbleTextView(text: entry.name.uppercased(), palette: .accent(PlayerTint.nameColor(userId: entry.id, username: entry.username)),
                               maxSize: 30, minSize: 18, animated: false)
                BubbleTextView(text: entry.value.uppercased(), palette: .accent(Color(hex: 0xF5B82E)), maxSize: 22, minSize: 14,
                               animated: false)
                if let onProfile {
                    Button { Haptics.tap(); dismiss(); onProfile() } label: { CandyLabel(title: "View profile") }
                        .buttonStyle(CastButtonStyle(color: .purple, size: .medium, fullWidth: false))
                        .padding(.top, 6)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 18)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            // Founder 10-12: the band continues the stage's gradient (it fades into the same top color) down to the sheet's foot,
            // so there is no seam and no empty slab.
            .background(PodiumSheetPalette.band(dark).ignoresSafeArea(.container, edges: .bottom))
        }
        .background(PodiumSheetPalette.bandBottom(dark).ignoresSafeArea())
        .accessibilityElement(children: .contain)
    }
}

// MARK: - A player's own colors (founder 10-09)

/// A player's mascot-maker colors, for surfaces that wear them: the podium stat plates (their backdrop as the fill, their
/// frame as the border, ink chosen for contrast so the stats always read) and their name in the bubble lettering.
@MainActor
enum PlayerTint {
    nonisolated struct Plate {
        let fill: [Color]
        let border: [Color]
        let borderWidth: CGFloat
        /// True = light (white) ink on a dark fill; false = the dark purple ink on a light fill.
        let lightInk: Bool
        var heading: Color { lightInk ? .white : Color(hex: 0x2A1650) }
        var muted: Color { lightInk ? Color.white.opacity(0.82) : Color(hex: 0x5B4B7A) }
        /// The gold highlight (FLAWLESS / streak): bright gold on dark, deep amber on light.
        var badge: Color { lightInk ? Color(hex: 0xF5B82E) : Color(hex: 0xB45309) }
    }

    /// The player's resolved mascot config (their saved look, a worn cast hero's, or the seeded default).
    static func config(userId: String?, username: String) -> AvatarConfig {
        AvatarDirectory.shared.look(username: username, userId: userId, url: nil, castId: nil, frame: nil,
                                    mascot: nil, accentHex: nil, lookup: true).resolved.config
    }

    /// The backdrop's colors ("auto" = a light tint of the body color, as the avatar tile draws it).
    static func backdropHexes(_ c: AvatarConfig) -> [String] {
        if let b = AvatarCatalog.backdrop(c.bg) {
            // A pattern reads as its base color (+ a whisper of its accent): the pattern itself would fight the text.
            return b.kind == .pattern ? [b.colors[0], mix(b.colors[0], b.colors[1], 0.3)] : b.colors
        }
        return [mix(AvatarCatalog.color(c.color).hex, "#ffffff", 0.78)]
    }

    /// The frame's metal as a border gradient; "none" = a deeper shade of the fill so every plate has an edge.
    static func frameHexes(_ frame: String, fill: [String]) -> (colors: [String], width: CGFloat) {
        switch frame {
        case "bronze": return (["#F0B27A", "#B45309"], 2.5)
        case "silver": return (["#F8FAFC", "#94A3B8"], 2.5)
        case "gold": return (["#FDE68A", "#D97706"], 2.5)
        case "platinum": return (["#E0F2FE", "#64748B"], 2.5)
        case "diamond": return (["#A5F3FC", "#818CF8", "#F0ABFC"], 2.5)
        case "pro": return (["#F5B82E", "#EC4899", "#8B5CF6"], 2.5)
        default: return ([mix(fill[0], "#000000", 0.28)], 1.5)
        }
    }

    static func plate(userId: String?, username: String) -> Plate {
        let c = config(userId: userId, username: username)
        let fill = backdropHexes(c)
        let edge = frameHexes(c.frame, fill: fill)
        let lum = fill.map(luminance).reduce(0, +) / Double(max(1, fill.count))
        return Plate(fill: fill.compactMap { Color(hexString: $0) }, border: edge.colors.compactMap { Color(hexString: $0) },
                     borderWidth: edge.width, lightInk: lum < 0.42)
    }

    /// A vivid version of the player's backdrop color, for their name in the bubble lettering (lemon → a sunny gold).
    /// The player's secondary color (their pattern color in the mascot maker).
    static func secondaryColor(userId: String?, username: String) -> Color {
        let c = config(userId: userId, username: username)
        return Color(hexString: AvatarCatalog.color(c.patternColor).hex) ?? Color(hex: 0x8B5CF6)
    }

    /// The bubble lettering on a plate: purple letters + numbers on a pale plate, white letters + gold numbers on a dark one.
    static func platePalette(lightInk: Bool) -> HeadlinePalette {
        lightInk
            ? HeadlinePalette(top: .white, bottom: Color(hex: 0xEDE9FE), deep: Color(hex: 0x3B0764), outline: Color(hex: 0x4C1D95),
                              nameTop: .white, nameBottom: Color(hex: 0xEDE9FE),
                              numberTop: Color(hex: 0xFFE07A), numberBottom: Color(hex: 0xF5A524))
            // Founder 10-10 (podium stats hard to read): deep violet on the pale plate (was a light-to-mid purple, ~3:1).
            : HeadlinePalette(top: Color(hex: 0x7C3AED), bottom: Color(hex: 0x4C1D95), deep: Color(hex: 0x2E1065), outline: .white,
                              nameTop: Color(hex: 0x7C3AED), nameBottom: Color(hex: 0x4C1D95),
                              numberTop: Color(hex: 0x7C3AED), numberBottom: Color(hex: 0x4C1D95))
    }

    static func nameColor(userId: String?, username: String, onLight: Bool = false) -> Color {
        let c = config(userId: userId, username: username)
        let hex = AvatarCatalog.backdrop(c.bg)?.colors.last ?? AvatarCatalog.color(c.color).hex
        guard let base = Color(hexString: hex) else { return Color(hex: 0x7C3AED) }
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(base).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        if s < 0.12 { return Color(hex: 0x8B5CF6) }   // a grey / white backdrop: the brand purple
        // On a pale surface (a lemon plate) the name deepens (sunny gold → amber) so it never fades into its own backdrop.
        return onLight ? Color(hue: h, saturation: max(s, 0.9), brightness: 0.72)
                       : Color(hue: h, saturation: max(s, 0.78), brightness: max(b, 0.92))
    }

    private static func rgb(_ hex: String) -> (Double, Double, Double) {
        var s = hex; if s.hasPrefix("#") { s.removeFirst() }
        let v = Int(s, radix: 16) ?? 0
        return (Double((v >> 16) & 0xff) / 255, Double((v >> 8) & 0xff) / 255, Double(v & 0xff) / 255)
    }

    static func mix(_ a: String, _ b: String, _ t: Double) -> String {
        let x = rgb(a), y = rgb(b)
        func c(_ p: Double, _ q: Double) -> Int { Int(((p + (q - p) * t) * 255).rounded()) }
        return String(format: "#%02x%02x%02x", c(x.0, y.0), c(x.1, y.1), c(x.2, y.2))
    }

    /// WCAG relative luminance (0 black … 1 white).
    static func luminance(_ hex: String) -> Double {
        func lin(_ v: Double) -> Double { v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        let (r, g, b) = rgb(hex)
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
}
