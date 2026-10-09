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
    /// The page's horizontal padding (the headline bleeds past it to the screen edges).
    var bleed: CGFloat = 16
    /// 2.8 item 8: today's W / L per game (the same badges as Home and the finish screens).
    var results: [String: Bool] = [:]
    var sweepResult: Bool? = nil

    private static let ink = Color(hex: 0x8A4A12)

    var body: some View {
        // FINISH_SPEC §AU2 / BB3: a compact top so the podium shows on arrival — the
        // day title ≤ 90 pt and the compact two-row picker grid.
        // 11b: the top of the ONE living stage — the day's bubble title with your mascot and the day's cast host
        // (the date + reset clock is its one small line), then the picker with no card of its own. LeaderboardTab
        // wraps this, the game strip and the podium in LeaderboardStageCard.
        VStack(spacing: 2) {
            StageTitleRow()
            GamePickerCard(selection: isSweep ? GamePicker.sweep : selected.rawValue,
                           accent: LbStyle.gold, ink: Self.ink, results: results,
                           sweepResult: sweepResult, compact: true, bare: true,
                           onSelect: select) {
                EmptyView()
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
                // FINISH_SPEC BB4: no ALL-TIME button — all-time lives in Stats only.
                Text("\(date) · RESETS IN \(Self.resetClock())")
                    .font(Brand.font(12, .black)).tracking(0.7).monospacedDigit()
                    .foregroundStyle(Theme.isDark ? Theme.textSecondary : Self.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity, alignment: .center)
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

/// §A6 + founder 10-05 ("fill out this space beautifully"): the day's title as the
/// Leaderboard headline, BIG — the day art (lettering + its host) at up to
/// `LeaderboardArt.dayCap` tall, centered, and in a season ONE prop on EACH side
/// (never a lone prop on one side). Holidays: the whole-cast LEADERBOARD art with the
/// holiday title as a small caps line under it. Art is pre-decoded (LeaderboardArt.prewarm)
/// and never pops in. Re-reads the title each minute so it flips at local midnight.
struct LeaderboardHeadline: View {
    var bleed: CGFloat = 16
    /// Kept for callers; the band height is `LeaderboardArt.dayCap`.
    var maxHeight: CGFloat? = nil

    var body: some View {
        TimelineView(.everyMinute) { _ in
            let title = LeaderboardBannerView.todayTitle()
            let props = CastSkin.dayProps()
            if let art = DayTitleArt.forTitle(title) {
                DayHeadlineArt(asset: art.asset, label: art.label, cap: LeaderboardArt.dayCap, props: props)
            } else if ArtAsset.exists(ArtTitleName.leaderboard.assetName) {
                // ART_SPEC §8: a holiday shows the whole cast around LEADERBOARD with
                // the holiday title ("<HOLIDAY> HEROES") as a small caps line under it.
                VStack(spacing: 2) {
                    DayHeadlineArt(asset: ArtTitleName.leaderboard.assetName, label: "Leaderboard",
                                   cap: LeaderboardArt.holidayCap, props: props)
                    Text(title)
                        .font(Brand.font(14, .black)).tracking(1.4)
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

/// The day / holiday art centered at up to `cap` tall (as wide as its aspect allows,
/// ≤ 88% of the row), with the season's two props flanking it symmetrically.
private struct DayHeadlineArt: View {
    let asset: String
    let label: String
    let cap: CGFloat
    let props: (left: String, right: String)?

    var body: some View {
        DayHeadlineLayout(aspect: ArtAsset.aspect(asset) ?? 1.6, cap: cap,
                          prop: props == nil ? 0 : LeaderboardArt.propSize) {
            Image(uiImage: LeaderboardArt.decoded(asset) ?? UIImage())
                .resizable().interpolation(.high).scaledToFit()
                .shadow(color: Color(hex: 0x28145A).opacity(0.14), radius: 6, x: 0, y: 4)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isHeader)
            if let props {
                prop(props.left, angle: -10)
                prop(props.right, angle: 10)
            }
        }
    }

    private func prop(_ name: String, angle: Double) -> some View {
        ArtThumbs.image(name, points: LeaderboardArt.propSize)
            .resizable().interpolation(.high).scaledToFit()
            .rotationEffect(.degrees(angle))
            .accessibilityHidden(true)
            .allowsHitTesting(false)
    }
}

/// Places the headline art (subview 0) centered at the top, as big as `cap` and the
/// row allow (keeping room for a prop + gap on each side when there are props), and
/// the props (subviews 1, 2) mirrored left / right of it, level with the lettering.
private struct DayHeadlineLayout: Layout {
    let aspect: CGFloat
    let cap: CGFloat
    let prop: CGFloat
    private let gap: CGFloat = 6

    private func art(_ width: CGFloat) -> CGSize {
        let side = prop > 0 ? 2 * (prop + gap) : 0
        let w = max(1, min(width * 0.88, width - side))
        let h = min(cap, w / aspect)
        return CGSize(width: h * aspect, height: h)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? 370
        return CGSize(width: width, height: art(width).height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let a = art(bounds.width)
        guard let first = subviews.first else { return }
        first.place(at: CGPoint(x: bounds.midX, y: bounds.minY), anchor: .top,
                    proposal: ProposedViewSize(width: a.width, height: a.height))
        guard subviews.count >= 3, prop > 0 else { return }
        // Level with the lettering (the art's lower half), just outside the art.
        let y = bounds.minY + a.height * 0.62
        let off = a.width / 2 + gap + prop / 2
        let p = ProposedViewSize(width: prop, height: prop)
        subviews[1].place(at: CGPoint(x: bounds.midX - off, y: y), anchor: .center, proposal: p)
        subviews[2].place(at: CGPoint(x: bounds.midX + off, y: y), anchor: .center, proposal: p)
    }
}

/// The Leaderboard top's art sizes + launch-time decode (no pop-in, no main-thread decode).
enum LeaderboardArt {
    /// The day title's height cap (founder 10-05: was 78 — "still is very small").
    static let dayCap: CGFloat = 124
    /// The holiday LEADERBOARD art's cap (a wide 4:1 banner).
    static let holidayCap: CGFloat = 80
    /// One season prop per side.
    static let propSize: CGFloat = 50
    /// The game card's title art: ≤ 30 pt tall, ≤ 130 pt wide; drawn from the 130 pt bucket.
    static let cardTitlePoints: CGFloat = 130
    /// The game card's fixed height (the small candy pill + padding).
    static let cardHeight: CGFloat = 46

    static func cardTitleSize(_ asset: String) -> CGSize {
        let a = ArtAsset.aspect(asset) ?? 4
        let h = min(30, cardTitlePoints / a)
        return CGSize(width: h * a, height: h)
    }

    private static let lock = NSLock()
    private static var images: [String: UIImage] = [:]

    /// The full-size art, decoded for display (cached; decodes on the spot on a miss).
    static func decoded(_ name: String) -> UIImage? {
        lock.lock()
        if let hit = images[name] { lock.unlock(); return hit }
        lock.unlock()
        guard let img = UIImage(named: name) else { return nil }
        let ready = img.preparingForDisplay() ?? img
        lock.lock(); images[name] = ready; lock.unlock()
        return ready
    }

    /// Launch: today's (and tomorrow's) day art + the holiday art decoded off main, the
    /// season props and every game card title pre-scaled into ArtThumbs.
    @MainActor static func prewarm() {
        let days = ArtTitleLabels.dayOrder.map { "art-day-\($0)" }
        let today = Calendar.current.component(.weekday, from: Date()) - 1   // Sunday = 0
        let names = [days[today % 7], days[(today + 1) % 7], ArtTitleName.leaderboard.assetName]
        DispatchQueue.global(qos: .utility).async { for n in names { _ = decoded(n) } }
        var items: [(String, CGFloat)] = CastSkin.halloweenPropAssets.map { ($0, propSize) }
        for m in homeModes + moreModes {
            if let gm = m.mode ?? m.dbKey.flatMap({ GameMode(rawValue: $0) }), let t = GameTitleArt.forMode(gm) {
                items.append((t.asset, cardTitlePoints))
            }
        }
        ArtThumbs.prewarm(items)
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
        VStack(spacing: 8) {
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
