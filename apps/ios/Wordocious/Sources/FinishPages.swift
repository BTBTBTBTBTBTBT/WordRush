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
        Text(text.uppercased())
            .font(Brand.font(11, .black)).tracking(1.3)
            .foregroundStyle(Theme.isDark ? Theme.textSecondary : color)
            .lineLimit(1).minimumScaleFactor(0.7)
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
        BubbleTextView(text: text.uppercased(), palette: .accent(color), maxSize: maxSize, minSize: 12, animated: false,
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

    /// Button family (10-05, README §4): every two-way switch is the candy segmented (frosted track +
    /// glossy purple thumb), compact here (32 pt, hugging its labels).
    var body: some View {
        CandySegmented(options: options, selection: selection, accent: accent,
                       accessibilityLabel: accessibilityLabel, height: 32) { k in
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
    let onSelect: (Key) -> Void
    @Namespace private var ns

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
                        .font(Brand.font(13, .black)).tracking(0.3)
                        .foregroundStyle(on ? CandyToggleInk.on : CandyToggleInk.off)
                        .shadow(color: on ? Color(hex: 0x4C1D95).opacity(0.45) : .clear, radius: 0, x: 0, y: 1)
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .padding(.horizontal, 14)
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
                let slots = max(words.count + (showSweep ? 1 : 0), puzzles.count)
                PickerTileRow(gap: compact ? 5 : 6, maxSide: compact ? 34 : 44, slots: slots) {
                    ForEach(words) { m in tile(m) }
                    if showSweep { sweepTile }
                }
                if !puzzles.isEmpty {
                    FinishLabel("Puzzles", color: ink).padding(.top, compact ? 1 : 4)
                    PickerTileRow(gap: compact ? 5 : 6, maxSide: compact ? 34 : 44, slots: slots) {
                        ForEach(puzzles) { m in tile(m) }
                    }
                }
            }
            .padding(.horizontal, 12).padding(.top, bare ? 4 : (compact ? 8 : 12)).padding(.bottom, bare ? 6 : (compact ? 9 : 14))
        }
        if bare { stack } else { stack.tintedCard(accent: accent, tint: 0.07, line: 0.22) }
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
    /// 2.8 item 8: the same tile at Home's banner size (smaller radius / bar / badge).
    var radius: CGFloat = 12
    var bar: CGFloat = 4
    var badge: CGFloat = 15
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
                RowResultBadge(won: won, size: badge, label: won ? "Won today" : "Lost today")
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

/// FINISH_SPEC §C2 / §C4 / BJ4: the top-three podium — the players' avatars on gold /
/// silver / bronze steps (2 · 1 · 3), a 3D crown on first place, soft numbers. From ONE
/// result up (core PodiumLayout): the places still free stand as `open` spots (a softly
/// dimmed step with R asleep, "Open spot" · "Claim #N"). `stage` = the board's accent:
/// the finished stage backdrop behind it (BJ4). `compact` is the Friends race size.
/// Rows after the podium list below it.
struct PodiumView: View {
    /// First, second, third (fewer is fine).
    let entries: [PodiumEntry]
    var compact: Bool = false
    /// Light-only pages (Friends): keep the light inks in dark mode.
    var lightOnly: Bool = false
    /// BJ4: places drawn as open spots (from PodiumLayout.layout(ranks).open).
    var open: [Int] = []
    /// BJ4: the stage backdrop in the game's accent (nil = none).
    var stage: Color? = nil
    var onTap: ((PodiumEntry) -> Void)? = nil
    /// 2.8 item 13: tapping another player's standing mascot opens their mini Stage card.
    @State private var stageTarget: PodiumStageTarget?
    private var cardOn: Bool { FlagsService.shared.isLive("podium_stage_card") }
    private var burstOn: Bool { FlagsService.shared.isLive("podium_burst") }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            column(place: 2)
            column(place: 1)
            column(place: 3)
        }
        // The glossy floor plate (art-podium-floor) the pedestals stand on: a flat disc
        // whose middle line meets the steps' feet (static, one image).
        .padding(.bottom, Self.floorRise)
        .background(alignment: .bottom) {
            ArtThumbs.image("art-podium-floor", points: 360)
                .resizable().interpolation(.high)
                .frame(height: Self.floorRise * 2 + 4)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 10).padding(.top, stage == nil ? 12 : 8)
        .background { if let stage { PodiumStage(accent: stage) } }
        .softSheet(item: $stageTarget) { t in
            PodiumStageCard(entry: t.entry, place: t.place, onProfile: onTap.map { tap in { tap(t.entry) } })
                .presentationDetents([.height(400), .large])
        }
    }

    private func stepHeight(_ tone: Int) -> CGFloat {
        let t = min(max(tone, 1), 3) - 1
        return compact ? [62, 46, 34][t] : [74, 54, 40][t]
    }

    @ViewBuilder private func column(place: Int) -> some View {
        if place - 1 < entries.count {
            let e = entries[place - 1]
            let tone = min(e.rank ?? place, 3)
            let first = tone == 1
            let avatar: CGFloat = compact ? (first ? 48 : 40) : (first ? 54 : 44)
            let stands = PodiumFigure.standsFull(e)
            // Name, points and detail: on a standing podium they ride on a soft plaque that overlaps the step's top edge.
            // A light-only card turns dark under a dark season surface (Halloween night): the ink follows the card then.
            // Founder 10-09: the plaque wears the player's own mascot-maker backdrop (fill) and frame (border); the ink
            // follows the fill's brightness so the stats read on any backdrop.
            let plate = PlayerTint.plate(userId: e.id, username: e.username)
            let plaque = VStack(spacing: 2) {
                Text(e.name)
                    .font(Brand.font(compact ? 12 : 13, .black))
                    .foregroundStyle(plate.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
                // Points stay the headline number (#1 a touch larger), then one muted
                // detail line (single line, shrink-to-fit, never wraps into the step).
                Text(e.value)
                    .font(Brand.font((compact ? 11 : 12) + (first ? 1.5 : 0), .heavy)).monospacedDigit()
                    .foregroundStyle(plate.muted)
                    .lineLimit(1).minimumScaleFactor(0.7)
                // Two parts (FLAWLESS / 89-DAY STREAK) stack on two lines instead of one shrunken line.
                ForEach(Array(FriendCards.raceBadgeLines(e.badge).enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(Brand.font(compact ? 8.5 : 9.5, .black)).tracking(0.4).monospacedDigit()
                        .foregroundStyle(plate.badge)
                        .lineLimit(1).minimumScaleFactor(0.55)
                }
                if let d = e.detail, !d.isEmpty {
                    Text(d)
                        .font(Brand.font(compact ? 9 : 10, first ? .heavy : .bold)).monospacedDigit()
                        .foregroundStyle(plate.muted.opacity(first ? 1 : 0.9))
                        .lineLimit(1).minimumScaleFactor(0.6)
                }
            }
            let content = VStack(spacing: 4) {
                if place == 1 && !stands {
                    Icon3D(.crown, size: compact ? 24 : 26).padding(.bottom, -8).zIndex(1)
                }
                // 2.8 item 13: with the living mascot on, a mascot player STANDS on the step full-body (no tile), 2x the old size,
                // posed by place (1st cheers, 2nd claps, 3rd waves); photo players keep the framed tile.
                PodiumFigure(entry: e, place: place, tone: tone, size: avatar, compact: compact)
                // Sits fully ABOVE the step (it used to overlap the step's top by 12 pt and cover its top face).
                let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
                plaque
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(shape.fill(LinearGradient(colors: plate.fill.count > 1 ? plate.fill : [plate.fill.first ?? .white, plate.fill.first ?? .white],
                                                          startPoint: .topLeading, endPoint: .bottomTrailing)))
                    .overlay(shape.strokeBorder(LinearGradient(colors: plate.border.count > 1 ? plate.border : [plate.border.first ?? .clear, plate.border.first ?? .clear],
                                                               startPoint: .top, endPoint: .bottom), lineWidth: plate.borderWidth))
                    .shadow(color: .black.opacity(0.18), radius: 3, y: 2)
            }
            VStack(spacing: 4) {
                Group {
                    if DressUp.isOwn(e.id) || (stands && cardOn) || onTap != nil {
                        // Founder 10-05 (door 1): your own place opens your Stage; a standing mascot opens its mini Stage card.
                        Button {
                            if DressUp.isOwn(e.id) { DressUp.shared.open() }
                            else if stands, cardOn { Haptics.tap(); stageTarget = PodiumStageTarget(entry: e, place: tone) }
                            else { onTap?(e) }
                        } label: { content.contentShape(Rectangle()) }.buttonStyle(.squish)
                    } else {
                        content
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(A11yLabels.podiumPlace(e.rank ?? place, name: e.name, points: e.value, detail: e.detail))
                .accessibilityHint(stands && cardOn && !DressUp.isOwn(e.id) ? "Opens their stage" : "")
                .background(alignment: .top) {
                    // the winner's confetti burst opens once on load
                    if stands && place == 1 && burstOn { PodiumBurst().offset(y: -6) }
                }
                .zIndex(1)
                if let bell = e.bell {
                    Button(action: bell) {
                        Icon3D(.bell, size: 16).frame(width: 30, height: 24).contentShape(Rectangle())
                    }
                    .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
                    .accessibilityLabel("Taunt \(e.name)")
                }
                step(tone: tone, label: "\(e.rank ?? place)")
            }
            .frame(maxWidth: .infinity)
        } else if open.contains(place) {
            openSpot(place: place)
        } else {
            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
        }
    }

    /// The floor plate's rise under the steps' feet (pt).
    static let floorRise: CGFloat = 10

    /// The pedestal art (podium art 10-03, docs/design/brand/podium): `art-podium-N` wears
    /// its numeral; a step whose label isn't its metal's number takes the plain pedestal
    /// with the label on it. Same heights as the code-drawn steps; the width follows the art.
    static func pedestalArt(tone: Int, numbered: Bool) -> String {
        "art-podium-\(min(max(tone, 1), 3))\(numbered ? "" : "-plain")"
    }

    /// BJ2: the pedestals + floor decoded off main before the Leaderboard / Home first shows them.
    static func prewarm() {
        var items: [(String, CGFloat)] = [("art-podium-floor", 360)]
        for t in 1...3 { items.append((pedestalArt(tone: t, numbered: true), 96)) }
        ArtThumbs.prewarm(items)
    }

    private func step(tone: Int, label: String) -> some View {
        let numbered = label == "\(min(max(tone, 1), 3))"
        return ZStack {
            ArtThumbs.image(Self.pedestalArt(tone: tone, numbered: numbered), points: 96)
                .resizable().interpolation(.high).scaledToFit()
            if !numbered {
                Text(label)
                    .font(Brand.font(compact ? 18 : 20, .black))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.18), radius: 0, x: 0, y: 2)
                    .offset(y: stepHeight(tone) * 0.12)
            }
        }
        .frame(height: stepHeight(tone))
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }

    /// BJ4: an open place — R asleep where the avatar would be, quiet lines, the step
    /// in its metal softly dimmed. Intentional, never a grey circle or an outline.
    private func openSpot(place: Int) -> some View {
        let copy = PodiumLayout.openSpot(place)
        let h: CGFloat = compact ? 38 : 44
        return VStack(spacing: 4) {
            ArtThumbs.image("art-scene-r-asleep", points: h * 1.3)
                .resizable().interpolation(.high).scaledToFit()
                .frame(height: h)
                .opacity(0.85)
            Text(copy.title)
                .font(Brand.font(compact ? 12 : 13, .black))
                .foregroundStyle(lightOnly ? FinishInk.muted : FinishInk.secondary)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(copy.line)
                .font(Brand.font(compact ? 11 : 12, .heavy))
                .foregroundStyle((lightOnly ? FinishInk.muted : FinishInk.secondary).opacity(0.8))
                .lineLimit(1).minimumScaleFactor(0.7)
            step(tone: place, label: "\(place)").opacity(0.45)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Place \(place) is open")
    }
}

/// FINISH_SPEC BJ4 (founder 10-03: "a subtle background … it could use some finish"):
/// the podium's stage — one soft vertical wash in the board's accent, ONE static shape
/// layer (faint sunburst rays fanning out from behind #1 plus a few tiny confetti dots),
/// and a soft floor shadow under the steps. Static (drawn once), no blur, no outline.
struct PodiumStage: View {
    let accent: Color

    private static let confetti: [(x: CGFloat, y: CGFloat, r: CGFloat, hex: UInt)] = [
        (0.07, 0.20, 2.0, 0xEC4899), (0.17, 0.48, 1.6, 0x22C55E), (0.29, 0.12, 1.8, 0x2563EB),
        (0.71, 0.10, 2.0, 0xF5A524), (0.82, 0.42, 1.6, 0x7C3AED), (0.93, 0.18, 1.9, 0xEC4899),
        (0.40, 0.30, 1.4, 0x22C55E), (0.61, 0.34, 1.4, 0x2563EB),
    ]

    var body: some View {
        let dark = Theme.isDark
        ZStack(alignment: .bottom) {
            LinearGradient(colors: [accent.opacity(dark ? 0.12 : 0.16), accent.opacity(0)],
                           startPoint: .top, endPoint: .bottom)
            Canvas { ctx, size in
                // Sunburst: 12 thin wedges from just above the #1 column, fading outward.
                let c = CGPoint(x: size.width / 2, y: size.height * 0.30)
                let reach = max(size.width, size.height) * 0.75
                var rays = Path()
                for i in 0..<12 {
                    let a = Double(i) / 12 * 2 * .pi
                    let w = 0.09
                    rays.move(to: c)
                    rays.addLine(to: CGPoint(x: c.x + reach * cos(a - w), y: c.y + reach * sin(a - w)))
                    rays.addLine(to: CGPoint(x: c.x + reach * cos(a + w), y: c.y + reach * sin(a + w)))
                    rays.closeSubpath()
                }
                ctx.fill(rays, with: .radialGradient(
                    Gradient(colors: [(dark ? Color.white : accent).opacity(dark ? 0.07 : 0.11), .clear]),
                    center: c, startRadius: 8, endRadius: reach * 0.8))
                for d in Self.confetti {
                    let r = d.r
                    ctx.fill(Path(ellipseIn: CGRect(x: d.x * size.width - r, y: d.y * size.height - r, width: r * 2, height: r * 2)),
                             with: .color(Color(hex: d.hex).opacity(dark ? 0.35 : 0.5)))
                }
                // The floor shadow under the steps.
                let floor = CGRect(x: size.width * 0.06, y: size.height - 9, width: size.width * 0.88, height: 14)
                ctx.fill(Path(ellipseIn: floor), with: .radialGradient(
                    Gradient(colors: [Color.black.opacity(dark ? 0.22 : 0.10), .clear]),
                    center: CGPoint(x: floor.midX, y: floor.midY), startRadius: 0, endRadius: floor.width / 2))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
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
    var body: some View {
        GeometryReader { g in
            if let img = CandySprite.pill(sprite, dark: Theme.isDark, size: g.size) {
                Image(uiImage: img).resizable()
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


/// 2.8 item 13 (founder 10-07: "full-body mascots STANDING on their steps, no tile frame, ~2-3x today's size, crown on
/// its head"): one podium place's figure. A mascot player (no photo) is drawn as the free-standing living mascot in the
/// pose of their place while `AvatarLiveConfig.livingMascot` is on (the remote `living_mascot` switch); everyone else, and
/// the whole podium while it is off, keeps the framed AvatarView exactly as before. Layout: the figure's feet overlap the
/// step below by `PodiumFigure.footOverlap`, so it stands ON it.
struct PodiumFigure: View {
    let entry: PodiumEntry
    let place: Int
    let tone: Int
    /// The old tile size (pt); a standing figure draws at `scale` times it.
    let size: CGFloat
    let compact: Bool

    @ObservedObject private var directory = AvatarDirectory.shared
    @Environment(\.accessibilityReduceMotion) private var envReduce

    /// How much bigger the standing figure is than the old tile.
    static let scale: CGFloat = 2.0
    /// How far the figure's feet sink into the step (pt) so it stands on it.
    static let footOverlap: CGFloat = 12

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

    var body: some View {
        let r = resolved
        if AvatarLiveConfig.livingMascot, r.photoUrl == nil, LivingMascotView.canAnimate(r.config) {
            let big = size * Self.scale
            let posed: AvatarConfig = { var c = r.config; c.pose = AvatarPose.placePose(place); return c }()
            let initial = AvatarCatalog.initial(entry.username)
            LivingMascotView(config: posed, initial: initial, size: big, cutout: true, interactive: false, own: DressUp.isOwn(entry.id),
                             label: A11yLabels.mascot(own: DressUp.isOwn(entry.id), name: entry.name))
                .frame(width: big, height: big)
                .background { PodiumGlow(tone: tone, height: big) }
                .overlay(alignment: .top) {
                    // the crown sits ON the first place's head
                    if place == 1 { Icon3D(.crown, size: compact ? 30 : 34).offset(y: -big * 0.05) }
                }
                .padding(.bottom, -Self.footOverlap)
                .zIndex(1)
        } else {
            AvatarView(url: entry.avatarUrl, username: entry.username, size: size, accentHex: entry.accentHex, emoji: entry.emoji,
                       pro: entry.pro, userId: entry.id)
                .background { PodiumGlow(tone: tone, height: size) }
        }
    }
}

/// Podium glow (2.8 TestFlight feedback: "a glow behind the characters so they stand out"): a soft radial light behind a
/// standing figure, one clearly different hue per metal (1st warm gold with a few twinkling sparkles, 2nd cool silver,
/// 3rd copper bronze). Behind the figure only (a `.background`), no edge, transparent by its rim; the sparkles hold still
/// under Reduce Motion / calm motion. Mirrors web PODIUM_GLOW / PodiumGlow and Android PodiumGlow hex-for-hex.
struct PodiumGlow: View {
    let tone: Int
    /// The figure's height (pt): the glow is a multiple of it.
    let height: CGFloat
    @State private var twinkle = false

    private var spec: (core: UInt, alpha: Double, scale: CGFloat) {
        switch min(max(tone, 1), 3) {
        case 1: return (0xFFC93C, 0.8, 1.55)
        case 2: return (0xB4C8EE, 0.75, 1.4)
        default: return (0xF28A3B, 0.7, 1.4)
        }
    }
    private static let sparkles: [(x: CGFloat, y: CGFloat, size: CGFloat, delay: Double)] = [
        (0.14, 0.30, 9, 0), (0.86, 0.24, 7, 0.7), (0.24, 0.74, 6, 1.3), (0.80, 0.68, 8, 0.35),
    ]

    var body: some View {
        let g = spec
        let d = (height * g.scale).rounded()
        let core = Color(hex: g.core)
        let calm = Theme.reduceMotion
        ZStack {
            Circle().fill(RadialGradient(
                gradient: Gradient(stops: [
                    .init(color: core.opacity(g.alpha), location: 0),
                    .init(color: core.opacity(g.alpha * 0.45), location: 0.54),
                    .init(color: core.opacity(0), location: 1),
                ]),
                center: .center, startRadius: 0, endRadius: d / 2))
            if tone <= 1 {
                ForEach(0..<Self.sparkles.count, id: \.self) { i in
                    let s = Self.sparkles[i]
                    PodiumSparkle()
                        .fill(Color(hex: 0xFFF1B8))
                        .frame(width: s.size, height: s.size)
                        .scaleEffect(calm ? 1 : (twinkle ? 1.1 : 0.7))
                        .opacity(calm ? 0.85 : (twinkle ? 1 : 0.35))
                        .animation(calm ? nil : .easeInOut(duration: 1.3).repeatForever(autoreverses: true).delay(s.delay), value: twinkle)
                        .position(x: d * s.x, y: d * s.y)
                }
            }
        }
        .frame(width: d, height: d)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { if !calm { twinkle = true } }
    }
}

/// A four-point sparkle (the gold glow's twinkles).
private struct PodiumSparkle: Shape {
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


/// 2.8 item 13: which podium mascot was tapped (its mini Stage card).
struct PodiumStageTarget: Identifiable {
    let entry: PodiumEntry
    let place: Int
    var id: String { entry.id }
}

/// 2.8 item 13: the winner's confetti burst, once, as the podium opens (the celebration kit's party burst, the season's
/// swap when there is one). Transform + opacity only; nothing under Reduce Motion / Low Power.
private struct PodiumBurst: View {
    @State private var up = false
    @State private var gone = false

    var body: some View {
        Group {
            if !Motion.calm(), let n = SeasonKit.extra("celebrate-burst-party"), ArtAsset.exists(n) {
                Image(n).resizable().interpolation(.high).scaledToFit().frame(width: 170)
                    .scaleEffect(up ? 1.05 : 0.4)
                    .opacity(gone ? 0 : (up ? 1 : 0))
                    .onAppear {
                        withAnimation(.easeOut(duration: 0.55)) { up = true }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { withAnimation(.easeIn(duration: 0.5)) { gone = true } }
                    }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
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
        VStack(spacing: 0) {
            DressStage(config: posed, initial: AvatarCatalog.initial(entry.username),
                       photo: r.photoUrl != nil ? (r.photoUrl, entry.username, entry.id) : nil,
                       height: 250, mascotSize: 160, mascotLabel: A11yLabels.mascot(own: false, name: entry.name),
                       glow: [Color(hex: 0xFCD34D), Color(hex: 0xE2E8F0), Color(hex: 0xFB923C)][min(max(place, 1), 3) - 1]) {
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
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 16)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.isDark ? Theme.surface : Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
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
    static func nameColor(userId: String?, username: String) -> Color {
        let c = config(userId: userId, username: username)
        let hex = AvatarCatalog.backdrop(c.bg)?.colors.last ?? AvatarCatalog.color(c.color).hex
        guard let base = Color(hexString: hex) else { return Color(hex: 0x7C3AED) }
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(base).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        if s < 0.12 { return Color(hex: 0x8B5CF6) }   // a grey / white backdrop: the brand purple
        return Color(hue: h, saturation: max(s, 0.78), brightness: max(b, 0.92))
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
