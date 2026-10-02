import SwiftUI
import WordociousCore

/// The Leaderboard banner (founder, 2026-10-01; spec docs/LEADERBOARD_REDESIGN_SPEC.md §1;
/// web app/daily/page.tsx). The home / VS / Friends one-window shape in gold-to-lilac:
/// a frosted strip with the day's title (core leaderboardTitle — "FRIDAY’S FINEST",
/// "HALLOWEEN HEROES" on a holiday), the date + reset clock and ALL-TIME →, over two
/// rows of square game tiles (docs/GAME_TILE_STYLE.md): WORDOCIOUS (the eight sweep
/// dailies, home order) with the SWEEP chip, and PUZZLES (the ten More Games dailies,
/// home order). Exactly one selection across both rows and the chip. Replaces the old
/// gradient title, the date/countdown row and the HModePicker grid.
struct LeaderboardBannerView: View {
    @Binding var selected: GameMode
    @Binding var isSweep: Bool
    let onAllTime: () -> Void

    private static let head = Color(hex: 0x78350F)
    private static let sub = Color(hex: 0x92400E)
    private static let gold = Color(hex: 0xF59E0B)

    var body: some View {
        let window = VStack(spacing: 0) {
            strip
            BannerGameRows(selected: $selected, isSweep: $isSweep, ink: Self.sub)
        }
        .bannerWindow(top: Color(hex: 0xFEF3C7), bottom: Color(hex: 0xEDE9FE), shadow: Color(hex: 0x92400E))
        if Self.hasTitleArt(Self.todayTitle()) {
            // ART_SPEC §1 / §8: the day art (or the holiday's whole-cast LEADERBOARD
            // art) carries its own hosts, so O2 steps aside (same top inset, so the
            // page doesn't shift between days).
            window.padding(.top, 12)
        } else {
            // The cast (docs/MASCOT_SPEC.md §1): O2 in the spotlight beside the day's title.
            window.bannerHost(Mascots.leaderboard, trailing: 12)
        }
    }

    // MARK: Frosted strip

    private var strip: some View {
        // Ticks once a second for the reset clock; the title and date flip at local midnight.
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let clock = Self.resetClock()
            let date = ctx.date.formatted(.dateTime.month(.abbreviated).day()).uppercased()
            let title = Self.todayTitle()
            VStack(alignment: .leading, spacing: 4) {
                if let art = DayTitleArt.forTitle(title) {
                    // ART_SPEC §1: the weekday's title art (lettering + that day's host).
                    DayTitleArtView(asset: art.asset, label: art.label)
                } else if ArtAsset.exists(ArtTitleName.leaderboard.assetName) {
                    // ART_SPEC §8: a holiday shows the whole cast around LEADERBOARD
                    // with the holiday title ("<HOLIDAY> HEROES") as a small caps subtitle.
                    VStack(spacing: 2) {
                        DayTitleArtView(asset: ArtTitleName.leaderboard.assetName,
                                        label: ArtTitleName.leaderboard.label, maxHeight: 96)
                        Text(title)
                            .font(Brand.font(11, .black)).tracking(1.2)
                            .foregroundStyle(Self.head)
                            .lineLimit(1).minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity)
                    }
                } else {
                    // A holiday ("<HOLIDAY> HEROES") keeps the text treatment.
                    Text(title)
                        .font(Brand.font(22, .black)).tracking(0.4)
                        .foregroundStyle(Self.head)
                        .shadow(color: Self.gold.opacity(0.55), radius: 8)
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
                        .padding(.trailing, Mascots.bannerClearance)
                        .accessibilityAddTraits(.isHeader)
                }
                HStack(spacing: 8) {
                    Text("\(date) · RESETS IN \(clock)")
                        .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                        .foregroundStyle(Self.sub)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button(action: onAllTime) {
                        Text("ALL-TIME →")
                            .font(Brand.font(10.5, .black)).tracking(0.4)
                            .foregroundStyle(Self.sub)
                            .lineLimit(1).fixedSize()
                            .padding(.vertical, 4).contentShape(Rectangle())
                    }
                    .buttonStyle(.squish)
                    .accessibilityLabel("All-time records")
                }
            }
        }
        .padding(.top, 12).padding(.horizontal, 12).padding(.bottom, 10)
        .background(Color.white.opacity(0.5))
    }

    /// Today's title (core leaderboardTitle on the player's local day, with the
    /// app's holiday-of-the-day name) — shared with the Records banner.
    static func todayTitle() -> String {
        let day = LeaderboardService.todayLocal()
        return leaderboardTitle(day, HolidayTitles.title(holidayKeyForDay(day, table: HolidayTable.bundled)))
    }

    /// Whether the title slot shows art: a weekday's day art, or on a holiday the
    /// whole-cast LEADERBOARD art (ART_SPEC §1 / §8).
    static func hasTitleArt(_ title: String) -> Bool {
        DayTitleArt.forTitle(title) != nil || ArtAsset.exists(ArtTitleName.leaderboard.assetName)
    }

    /// hh:mm:ss to local midnight.
    static func resetClock() -> String {
        let left = secondsUntilLocalMidnight()
        return String(format: "%02d:%02d:%02d", left / 3600, (left % 3600) / 60, left % 60)
    }
}

/// The Records banner (founder, 2026-10-01; spec docs/RECORDS_REDESIGN_SPEC.md §1; web
/// components/leaderboard/records-banner.tsx): the Leaderboard banner's one window in
/// lilac-to-gold. A frosted strip with the trophy + ALL-TIME RECORDS, the sub line
/// (Daily: the day's title · reset clock; All-Time: THE BEST EVER · N RECORDS) and the
/// DAILY | ALL-TIME pill switch, then the same two game rows as the Leaderboard banner.
/// Replaces the old RECORDS header, the Daily / All-Time toggle row and the mode picker.
struct RecordsBannerView: View {
    @Binding var tab: RecordsTab.RecordsSubTab
    @Binding var selected: GameMode
    @Binding var isSweep: Bool
    /// The all-time records count once loaded (All-Time sub line); nil omits the number.
    var recordsCount: Int? = nil

    private static let head = Color(hex: 0x4C1D95)
    private static let sub = Color(hex: 0x6D28D9)

    var body: some View {
        VStack(spacing: 0) {
            strip
            BannerGameRows(selected: $selected, isSweep: $isSweep, ink: Self.sub)
        }
        .bannerWindow(top: Color(hex: 0xEDE9FE), bottom: Color(hex: 0xFEF3C7), shadow: Color(hex: 0x4C1D95))
        // ART_SPEC §2: the title art carries the whole cast, so the O2 host is gone
        // (same top inset as the hosted banners).
        .padding(.top, 12)
    }

    private var strip: some View {
        VStack(alignment: .leading, spacing: 4) {
            // ART_SPEC §2: ALL-TIME RECORDS as the whole-cast title art. The
            // DAILY | ALL-TIME switch stays on the sub line (the home banner's switch row).
            ArtTitle(.records, colors: [Self.head, Self.head])
                .frame(maxWidth: .infinity)
            HStack(alignment: .center, spacing: 8) {
                Group {
                    if tab == .daily {
                        // Ticks once a second for the reset clock.
                        TimelineView(.periodic(from: .now, by: 1)) { _ in
                            Text("\(LeaderboardBannerView.todayTitle()) · RESETS IN \(LeaderboardBannerView.resetClock())")
                        }
                    } else {
                        Text(recordsCount.map { "THE BEST EVER · \($0) RECORD\($0 == 1 ? "" : "S")" } ?? "THE BEST EVER")
                    }
                }
                .font(Brand.font(10.5, .heavy)).tracking(0.4).monospacedDigit()
                .foregroundStyle(Self.sub)
                .lineLimit(2).minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                tabSwitch
            }
        }
        .padding(.top, 12).padding(.leading, 12).padding(.trailing, 10).padding(.bottom, 10)
        .background(Color.white.opacity(0.5))
    }

    /// DAILY | ALL-TIME as the home-banner pill switch (white selected segment, violet track).
    private var tabSwitch: some View {
        HStack(spacing: 0) {
            segment(.daily, "DAILY")
            segment(.allTime, "ALL-TIME")
        }
        .padding(2)
        .background(Capsule().fill(Color(hex: 0x7C3AED).opacity(0.12)))
        .fixedSize()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Daily or All-Time")
    }

    private func segment(_ t: RecordsTab.RecordsSubTab, _ label: String) -> some View {
        let on = tab == t
        return Button { if tab != t { instantly { tab = t } } } label: {
            Text(label)
                .font(Brand.font(10.5, .black)).tracking(0.6)
                .foregroundStyle(on ? Self.head : Color(hex: 0x7C3AED))
                .padding(.horizontal, 10).frame(height: 26)
                .background(Capsule().fill(on ? Color.white : Color.clear))
                .lineLimit(1).fixedSize()
                .contentShape(Capsule())
        }
        .buttonStyle(InstantButtonStyle())
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// The two game rows shared by the Leaderboard and Records banners (spec §1 of
/// docs/LEADERBOARD_REDESIGN_SPEC.md / docs/RECORDS_REDESIGN_SPEC.md): WORDOCIOUS
/// (the eight sweep dailies, home order) with the SWEEP chip, then PUZZLES (the ten
/// More Games dailies, home order), as icon-only square game tiles. Exactly one
/// selection across both rows and the chip.
struct BannerGameRows: View {
    @Binding var selected: GameMode
    @Binding var isSweep: Bool
    /// Row-label ink (amber on the Leaderboard, violet on Records).
    let ink: Color

    @ObservedObject private var flags = FlagsService.shared

    private static let sub = Color(hex: 0x92400E)
    private static let gold = Color(hex: 0xF59E0B)

    /// WORDOCIOUS DAILIES — the home order (core tiles, flag-gated, the wide VS / More tiles excluded).
    private var wordModes: [HomeMode] {
        homeModes.filter { flags.isOn($0.flagKey) && !$0.homeWide && $0.dbKey != nil }
    }
    /// PUZZLES — the home order (the More Games dailies behind their flags; menu.more switches the row off).
    private var puzzleModes: [HomeMode] {
        guard homeModes.contains(where: { $0.id == "more" && flags.isOn($0.flagKey) }) else { return [] }
        return moreDailyModes(moreModes.filter { flags.isOn($0.flagKey) })
    }

    var body: some View {
        let puzzles = puzzleModes
        VStack(spacing: 0) {
            wordRow
                .padding(.top, 10).padding(.horizontal, 12).padding(.bottom, puzzles.isEmpty ? 12 : 6)
            if !puzzles.isEmpty {
                puzzleRow(puzzles)
                    .padding(.top, 8).padding(.horizontal, 12).padding(.bottom, 12)
            }
        }
    }

    // MARK: Rows

    private func label(_ text: String) -> some View {
        Text(text).font(Brand.font(10, .black)).tracking(1).foregroundStyle(ink)
    }

    private var wordRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                label("WORDOCIOUS")
                Spacer(minLength: 4)
                sweepChip
            }
            SquareTileRow(maxSide: 38, minSide: 28, gap: 7) {
                ForEach(wordModes) { m in tile(m, radius: 10) }
            }
        }
    }

    private func puzzleRow(_ modes: [HomeMode]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            label("PUZZLES")
            SquareTileRow(maxSide: 31, minSide: 28, gap: 4) {
                ForEach(modes) { m in tile(m, radius: 9) }
            }
        }
    }

    /// The cross-mode Sweep board: soft gold pill, solid gold with white ink when selected.
    private var sweepChip: some View {
        Button { isSweep = true } label: {
            HStack(spacing: 4) {
                Image("broom").renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 11, height: 11)
                Text("SWEEP").font(Brand.font(10, .black)).tracking(0.8)
            }
            .foregroundStyle(isSweep ? Color.white : Self.sub)
            .padding(.horizontal, 10).frame(height: 22)
            .background(Capsule().fill(isSweep ? Self.gold : Self.gold.opacity(0.18)))
            .shadow(color: isSweep ? Self.gold.opacity(0.4) : .clear, radius: 5)
            .contentShape(Capsule())
        }
        .buttonStyle(InstantButtonStyle())
        .accessibilityLabel("Daily Sweep board")
        .accessibilityAddTraits(isSweep ? .isSelected : [])
    }

    /// One game as an icon-only square tile (accent tint, 1.5 border at 40%, 3 pt top bar;
    /// selected = 2 pt full-accent border + glow + stronger tint).
    private func tile(_ m: HomeMode, radius: CGFloat) -> some View {
        let active = !isSweep && m.dbKey == selected.rawValue
        return Button {
            isSweep = false
            selected = m.mode ?? GameMode(rawValue: m.dbKey ?? "") ?? selected
        } label: {
            GameTileSquare(accent: m.accent, selected: active, radius: radius, light: true, bar: 3) { chip in
                BannerGlyph(icon: m.icon, ink: m.accent, accent: m.accent, solid: false, size: floor(chip * 0.78))
            }
        }
        .buttonStyle(InstantButtonStyle())
        .accessibilityLabel(m.title)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

extension View {
    /// The banner window shared by the Leaderboard and Records banners: a vertical
    /// two-color gradient + the home white sheen, radius 16, soft shadow, no border.
    func bannerWindow(top: Color, bottom: Color, shadow: Color) -> some View {
        frame(maxWidth: .infinity)
            .background {
                ZStack {
                    LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom)
                    LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: shadow.opacity(0.10), radius: 7, x: 0, y: 4)
    }
}

/// One row of equal squares: each side is the row's width shared out (minus the gaps),
/// clamped to [minSide, maxSide]; the row stays centered at that size on wide screens
/// and never wraps.
private struct SquareTileRow: Layout {
    let maxSide: CGFloat
    let minSide: CGFloat
    let gap: CGFloat

    private func side(_ width: CGFloat?, _ n: Int) -> CGFloat {
        guard n > 0 else { return 0 }
        guard let w = width, w.isFinite else { return maxSide }
        let fit = (w - gap * CGFloat(n - 1)) / CGFloat(n)
        return max(minSide, min(maxSide, floor(fit)))
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
