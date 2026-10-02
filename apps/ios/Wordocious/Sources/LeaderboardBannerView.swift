import SwiftUI
import WordociousCore

/// The Leaderboard's top (FINISH_SPEC §A6 / §C2 / §C2b; mockup docs/design/brand/
/// mockups/leaderboard-polish.html): the day title as a full-width HEADLINE right on
/// the wallpaper (core leaderboardTitle — the weekday's `art-day-<weekday>`; on a
/// holiday the whole-cast LEADERBOARD art with the holiday title as a small caps line
/// under it, or the text title when the art is missing), then the shared game picker
/// window (`GamePickerCard`, warm gold): its header strip carries the date + the reset
/// clock and ALL-TIME (opens Records); the WORDOCIOUS row ends with the Sweep tile
/// (§C2b), then the PUZZLES row. Exactly one selection across the tiles.
struct LeaderboardBannerView: View {
    @Binding var selected: GameMode
    @Binding var isSweep: Bool
    let onAllTime: () -> Void
    /// The page's horizontal padding (the headline bleeds past it to the screen edges).
    var bleed: CGFloat = 16

    private static let ink = Color(hex: 0x8A4A12)

    var body: some View {
        // FINISH_SPEC §AU2: a compact top so the podium shows on arrival — the day
        // title ≤ 110 pt and the one-row scrolling picker.
        VStack(spacing: 8) {
            LeaderboardHeadline(bleed: bleed, maxHeight: 110)
            GamePickerCard(selection: isSweep ? GamePicker.sweep : selected.rawValue,
                           accent: LbStyle.gold, ink: Self.ink, compact: true,
                           onSelect: select) {
                strip
            }
        }
    }

    /// A tile tap: the Sweep tile opens the Sweep board; a game tile its daily board.
    private func select(_ key: String) {
        if key == GamePicker.sweep {
            isSweep = true
            return
        }
        let m = (homeModes + moreModes).first { $0.dbKey == key }
        guard let gm = m?.mode ?? GameMode(rawValue: key) else { return }
        isSweep = false
        selected = gm
    }

    // MARK: Header strip

    private var strip: some View {
        // Ticks once a second for the reset clock; the date flips at local midnight.
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let date = ctx.date.formatted(.dateTime.month(.abbreviated).day()).uppercased()
            HStack(spacing: 8) {
                Text("\(date) · RESETS IN \(Self.resetClock())")
                    .font(Brand.font(12, .black)).tracking(0.7).monospacedDigit()
                    .foregroundStyle(Theme.isDark ? Theme.textSecondary : Self.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onAllTime) {
                    HStack(spacing: 4) {
                        Icon3D(.trophy, size: 16)
                        Text("ALL-TIME")
                            .font(Brand.font(11, .black)).tracking(0.8)
                            .foregroundStyle(Theme.isDark ? Theme.textPrimary : Self.ink)
                            .lineLimit(1).fixedSize()
                    }
                    .padding(.horizontal, 10).frame(height: 28)
                    .tintedPill(LbStyle.gold)
                    .contentShape(Capsule())
                }
                .buttonStyle(.squish)
                .accessibilityLabel("All-time records")
            }
        }
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

/// §A6: the day's title as the Leaderboard headline — no box, no float, no host
/// beside it. Re-reads the title each minute so it flips at local midnight.
struct LeaderboardHeadline: View {
    var bleed: CGFloat = 16
    /// §AU2: the Leaderboard caps the day title (nil = the style's cap).
    var maxHeight: CGFloat? = nil

    var body: some View {
        TimelineView(.everyMinute) { _ in
            let title = LeaderboardBannerView.todayTitle()
            if let art = DayTitleArt.forTitle(title) {
                // FINISH_SPEC §N1: the day title keeps its host, capped at ≈58% width / 150 pt.
                PageHeadline(asset: art.asset, label: art.label, style: .day, bleed: bleed, maxHeight: maxHeight)
                    // FINISH_SPEC §X: in season, a small Halloween prop beside the day title
                    // (nothing out of season or when the prop art doesn't ship).
                    .overlay(alignment: .bottomTrailing) {
                        SeasonDayProp(size: 44).padding(.trailing, UIScreen.main.bounds.width * 0.1)
                    }
            } else if ArtAsset.exists(ArtTitleName.leaderboard.assetName) {
                // ART_SPEC §8: a holiday shows the whole cast around LEADERBOARD with
                // the holiday title ("<HOLIDAY> HEROES") as a small caps line under it.
                VStack(spacing: 2) {
                    PageHeadline(.leaderboard, bleed: bleed, maxHeight: maxHeight.map { $0 * 0.6 })
                    Text(title)
                        .font(Brand.font(13, .black)).tracking(1.4)
                        .foregroundStyle(Theme.isDark ? Theme.textSecondary : Color(hex: 0x8A4A12))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity)
                        .accessibilityAddTraits(.isHeader)
                }
            } else {
                // No art at all: the text title (PageHeadline's caps fallback).
                PageHeadline(asset: ArtTitleName.leaderboard.assetName, label: title, bleed: bleed)
            }
        }
    }
}

/// The Records top (FINISH_SPEC §A6 / §C2; spec docs/RECORDS_REDESIGN_SPEC.md §1): the
/// ALL-TIME RECORDS whole-cast art as the headline, then the same game picker window
/// as the Leaderboard, whose header strip carries the sub line (Daily: the day's title
/// · reset clock; All-Time: THE BEST EVER · N RECORDS) and the DAILY | ALL-TIME toggle.
struct RecordsBannerView: View {
    @Binding var tab: RecordsTab.RecordsSubTab
    @Binding var selected: GameMode
    @Binding var isSweep: Bool
    /// The all-time records count once loaded (All-Time sub line); nil omits the number.
    var recordsCount: Int? = nil
    var bleed: CGFloat = 16

    private static let ink = Color(hex: 0x8A4A12)

    var body: some View {
        VStack(spacing: 12) {
            PageHeadline(.records, bleed: bleed)
            GamePickerCard(selection: isSweep ? GamePicker.sweep : selected.rawValue,
                           accent: LbStyle.gold, ink: Self.ink,
                           onSelect: select) {
                strip
            }
        }
    }

    private func select(_ key: String) {
        if key == GamePicker.sweep {
            isSweep = true
            return
        }
        let m = (homeModes + moreModes).first { $0.dbKey == key }
        guard let gm = m?.mode ?? GameMode(rawValue: key) else { return }
        isSweep = false
        selected = gm
    }

    /// DAILY | ALL-TIME switches in one un-animated transaction (the cached board paints with it).
    private var tabBinding: Binding<RecordsTab.RecordsSubTab> {
        Binding(get: { tab }, set: { t in if tab != t { instantly { tab = t } } })
    }

    private var strip: some View {
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
            .font(Brand.font(11, .black)).tracking(0.6).monospacedDigit()
            .foregroundStyle(Theme.isDark ? Theme.textSecondary : Self.ink)
            .lineLimit(2).minimumScaleFactor(0.8)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            SoftSegmented(options: [(key: RecordsTab.RecordsSubTab.daily, label: "Daily"),
                                    (key: RecordsTab.RecordsSubTab.allTime, label: "All-time")],
                          selection: tabBinding, accent: LbStyle.gold,
                          accessibilityLabel: "Daily or All-Time")
        }
    }
}
