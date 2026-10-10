import WidgetKit
import SwiftUI
import UIKit

// Home-screen widget: today's eight Wordocious dailies (and the ten Puzzles on the
// large size) plus the play streak. Renders purely from the JSON snapshot the app
// writes into the app-group container (WidgetBridge) — no app code is linked, so the
// mode catalog stays single-sourced in the app. HomeBanner.swift + WidgetStats.swift
// are compiled in (project.yml) so the words and numbers match the app.
//
// FINISH_SPEC BI13 (founder 10-02: "clean up the widgets … make them better looking …
// on brand"): one calm background (lavender → white; deep purple in dark), ONE hero —
// a ring built from the eight game colors whose segments light up as each daily is
// done (gold + "SWEPT" when all eight are) — the streak set right into the 3D flame,
// the dailies as glossy brand tiles in each game's color (done = glossy tile + white
// check, to play = a pale wash of the color with the game's 3D icon). BI13b (founder
// 10-03: "a little personality"): one small cast member peeking in — the small's mascot
// corner, up from behind the top-right daily chip (medium) or the middle Puzzle chip (large,
// beside the W header) — mood by state, pose by day (WidgetCast.peekPose). BI13c: the player's
// own look (an app-rendered PNG: mascot cutout or framed photo) heads the large widget in W's
// place, and peeks in instead of the cast on big days (swept / streak milestone). Two type sizes in Nunito Black (hero +
// small tracked caps), brand purple as the one accent, gold only for the streak and a
// sweep. No boxes, outlines or frames around anything; system content margins.
// Every game chip deep-links (wordocious://daily/<MODE>).

private let appGroup = "group.com.wordocious.app"
private let snapshotKey = "widget-snapshot"

// Mirrors WidgetBridge.Snapshot (app side). Keep field names in sync.
struct WSnapshot: Codable {
    struct Mode: Codable {
        let key: String
        let title: String
        let glyph: String
        let colorHex: String
        let played: Bool
        let won: Bool
        // Home-menu icon spec; optional so an old app's snapshot (no icon
        // fields) still renders via the text glyph.
        let iconKind: String?
        let iconAsset: String?
        let iconText: String?
    }
    let day: String
    let streak: Int
    let modes: [Mode]
    // Footer stats; optional so an old app's snapshot still decodes.
    let points: Int?
    let seconds: Int?
    let shields: Int?
    // v3 (home redesign): the Puzzles row, the username for the greeting, the row
    // streaks. Optional so an older app's snapshot still decodes (no Puzzles row).
    var puzzles: [Mode]? = nil
    var username: String? = nil
    var wordStreaks: GroupStreaks? = nil
    var puzzleStreaks: GroupStreaks? = nil
    /// §E2: today's leaderboard rank, when the app writes one (optional; absent → shields).
    var rank: Int? = nil
    /// 2.8 (items 28 + 48): today's word dailies are all WON (the header trophy's "flawless" day), and the
    /// flawless-day run the header trophy shows. Optional so an older app's snapshot still decodes.
    var flawless: Bool? = nil
    var flawlessStreak: Int? = nil
    /// 2.8: the `season_halloween` off-switch as the app last saw it (false = normal widgets everywhere).
    var seasonHalloween: Bool? = nil
    /// 2.8 item 25: the player's Ocean / Forest / Dark skin (the app writes nil for Default and while a season skin shows).
    var theme: ThemeSkin? = nil

    struct ThemeSkin: Codable {
        let wall: [String]
        let glow: String
        let ink: String
        let inkSecondary: String
        let accent: String
        let dark: Bool
    }
}

extension WSnapshot {
    var puzzleModes: [Mode] { puzzles ?? [] }
    /// Every word daily won today (the app writes the flag; derived from the chips for an older snapshot).
    var isFlawless: Bool { flawless ?? (!modes.isEmpty && modes.allSatisfy(\.won)) }
    /// The flawless-day run (the header trophy shows it from 2).
    var flawlessRun: Int { max(flawlessStreak ?? 0, isFlawless ? 1 : 0) }
    var word: GroupProgress {
        GroupProgress(played: modes.filter(\.played).count, won: modes.filter(\.won).count, total: modes.count)
    }
    var puzzleProgress: GroupProgress {
        GroupProgress(played: puzzleModes.filter(\.played).count, won: puzzleModes.filter(\.won).count, total: puzzleModes.count)
    }
    var done: Int { word.played + puzzleProgress.played }
    var total: Int { modes.count + puzzleModes.count }

    /// The home banner's headline for this moment (HomeBanner, shared with the app).
    func headline(at date: Date) -> String {
        HomeBanner.bannerHeadline(word, puzzleProgress, hour: Calendar.current.component(.hour, from: date),
                                  name: username ?? "")
    }

    /// Reset every chip (and the day's stats) for a new local day; streaks and names stay.
    func freshDay(_ day: String) -> WSnapshot {
        func reset(_ m: Mode) -> Mode {
            Mode(key: m.key, title: m.title, glyph: m.glyph, colorHex: m.colorHex, played: false, won: false,
                 iconKind: m.iconKind, iconAsset: m.iconAsset, iconText: m.iconText)
        }
        return WSnapshot(day: day, streak: streak, modes: modes.map(reset), points: 0, seconds: 0, shields: shields,
                         puzzles: puzzles?.map(reset), username: username,
                         wordStreaks: wordStreaks, puzzleStreaks: puzzleStreaks,
                         flawless: false, flawlessStreak: flawlessStreak, seasonHalloween: seasonHalloween, theme: theme)
    }
}

/// Fallback roster so the widget shows the real chips before the app has ever
/// written a snapshot (fresh install / not signed in). The extension can't import
/// the catalog, so these literals mirror ModeGen.sweep and the More Games dailies
/// (catalog order); icon specs match ModeCatalog.swift.
private let placeholderModes: [(key: String, title: String, glyph: String, hex: String, kind: String, asset: String?, text: String?)] = [
    ("DUEL", "Classic", "C", "#7c3aed", "original", "wordle-grid", nil),
    ("QUORDLE", "Quad", "IV", "#ec4899", "roman", nil, "IV"),
    ("OCTORDLE", "Octo", "VIII", "#7e22ce", "roman", nil, "VIII"),
    ("SEQUENCE", "Succ.", "S", "#2563eb", "asset", "trending-up", nil),
    ("RESCUE", "Deliv.", "D", "#059669", "asset", "shield", nil),
    ("DUEL_6", "Six", "6", "#06b6d4", "hand", "six-hand", "6"),
    ("DUEL_7", "Seven", "7", "#84cc16", "hand", "seven-hand", "7"),
    ("GAUNTLET", "Gauntlet", "G", "#d97706", "asset", "skull", nil),
]
private let placeholderPuzzles: [(key: String, title: String, glyph: String, hex: String, kind: String, asset: String)] = [
    ("PROPERNOUNDLE", "Proper", "P", "#dc2626", "asset", "crown"),
    ("SUDOKU", "Sudocious", "9", "#1e40af", "symbol", "grid"),
    ("SCRAMBLE", "Muddle", "M", "#f97316", "symbol", "shuffle"),
    ("HUB", "Hubbub", "H", "#c026d3", "symbol", "hexagon"),
    ("CROSSWORD", "Crossword", "X", "#475569", "symbol", "quote.opening"),
    ("GROUPS", "Kindred", "K", "#9f1239", "symbol", "rectangle.3.group"),
    ("LADDER", "Ladder", "L", "#0284c7", "symbol", "stairs"),
    ("CRYPTOGRAM", "Code", "?", "#92400e", "symbol", "key"),
    ("WORDSEARCH", "Spyglass", "W", "#4d7c0f", "symbol", "text.magnifyingglass"),
    ("REGIONS", "Stars", "*", "#ca8a04", "symbol", "star"),
]

private func emptySnapshot() -> WSnapshot {
    WSnapshot(day: localDay(), streak: 0,
              modes: placeholderModes.map { .init(key: $0.key, title: $0.title, glyph: $0.glyph, colorHex: $0.hex,
                                                  played: false, won: false,
                                                  iconKind: $0.kind, iconAsset: $0.asset, iconText: $0.text) },
              points: nil, seconds: nil, shields: nil,
              puzzles: placeholderPuzzles.map { .init(key: $0.key, title: $0.title, glyph: $0.glyph, colorHex: $0.hex,
                                                     played: false, won: false,
                                                     iconKind: $0.kind, iconAsset: $0.asset, iconText: nil) })
}

private func localDay(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.calendar = Calendar(identifier: .gregorian)
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

/// Read the app-written snapshot; a snapshot from a previous day keeps the
/// streak, name and shields but resets every chip (and the day's stats) —
/// new puzzles dropped at midnight.
private func loadSnapshot(for date: Date = Date()) -> WSnapshot {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: snapshotKey),
          let snap = try? JSONDecoder().decode(WSnapshot.self, from: data) else { WInk.skin = nil; return emptySnapshot() }
    WInk.skin = snap.theme   // the ink helpers below read the theme's colors (item 25)
    if snap.day == localDay(date) { return snap }
    return snap.freshDay(localDay(date))
}

private func nextLocalMidnight(after date: Date = Date()) -> Date {
    Calendar.current.nextDate(after: date, matching: DateComponents(hour: 0, minute: 0, second: 0),
                              matchingPolicy: .nextTime) ?? date.addingTimeInterval(3600)
}

/// The Halloween widgets (item 24): the core season window AND the `season_halloween` off-switch.
private func halloweenOn(_ snap: WSnapshot, _ date: Date) -> Bool {
    snap.seasonHalloween != false && Season.current(day: localDay(date)) == .halloween
}

/// The live countdown to local midnight (item 28): the system ticks h:m:s with no timeline cost.
private func midnightWindow(_ date: Date) -> ClosedRange<Date> {
    let end = nextLocalMidnight(after: date)
    return min(date, end)...end
}

private func countdownText(_ date: Date) -> Text {
    Text(timerInterval: midnightWindow(date), pauseTime: nil, countsDown: true, showsHours: true)
}

private let homeURL = URL(string: "wordocious://home")!

struct DailyEntry: TimelineEntry {
    let date: Date
    let snap: WSnapshot
}

struct DailyProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyEntry {
        DailyEntry(date: Date(), snap: emptySnapshot())
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyEntry) -> Void) {
        completion(DailyEntry(date: Date(), snap: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEntry>) -> Void) {
        // BI13: the "resets in 4h" label steps on every whole hour before midnight (every
        // 15 minutes inside the last hour), and midnight resets every chip. The app pushes
        // reloads on every completion, so no data polling is needed.
        let now = Date()
        let snap = loadSnapshot()
        let midnight = nextLocalMidnight(after: now)
        // Founder 10-10 (the large widget stayed blank on device): WidgetKit renders EVERY entry up front, and the large
        // layout draws ~20 images per entry — 40 entries blew its render budget. At most 6 entries now (~the next
        // 5 hours, the label steps hourly; the countdown itself ticks live), then a fresh timeline is requested.
        var dates: [Date] = [now]
        var t = now
        while dates.count < 6 {
            let left = midnight.timeIntervalSince(t)
            let step: TimeInterval = left <= 3600 ? 900 : 3600
            var rem = left.truncatingRemainder(dividingBy: step)
            if rem < 1 { rem = step }
            t = t.addingTimeInterval(rem)
            if t >= midnight.addingTimeInterval(-1) { break }
            dates.append(t)
        }
        var entries = dates.map { DailyEntry(date: $0, snap: snap) }
        let reachesMidnight = (dates.last ?? now).addingTimeInterval(3600) >= midnight
        if reachesMidnight {
            entries.append(DailyEntry(date: midnight, snap: loadSnapshot(for: midnight.addingTimeInterval(1))))
        }
        completion(Timeline(entries: entries, policy: .after(reachesMidnight ? midnight : (dates.last ?? now).addingTimeInterval(60))))
    }
}

// MARK: - Brand kit (theme colors, Nunito Black, the glossy tile)

extension Color {
    init(widgetHex hex: String) {
        let c = rgb(hex)
        self.init(red: c.0, green: c.1, blue: c.2)
    }
}

private func rgb(_ hex: String) -> (Double, Double, Double) {
    var s = hex.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    var v: UInt64 = 0
    Scanner(string: s).scanHexInt64(&v)
    return (Double((v >> 16) & 0xFF) / 255, Double((v >> 8) & 0xFF) / 255, Double(v & 0xFF) / 255)
}

/// `hex` lightened toward white (k > 0) or darkened toward black (k < 0) — the glossy
/// tile's light / edge tones (ART_SPEC §20).
private func shade(_ hex: String, _ k: Double) -> Color {
    let (r, g, b) = rgb(hex)
    if k >= 0 { return Color(red: r + (1 - r) * k, green: g + (1 - g) * k, blue: b + (1 - b) * k) }
    let m = 1 + k
    return Color(red: r * m, green: g * m, blue: b * m)
}

/// The app theme's inks (Theme.swift): soft-number plum, label lilac, brand purple,
/// gold (streak / sweep only), slate (a missed daily).
private enum WInk {
    /// Halloween (black + orange) accent / gold.
    static let hallowOrange = Color(widgetHex: "#fb923c")
    /// Item 25: the player's theme skin (set from the snapshot); nil = the brand lavender inks.
    static var skin: WSnapshot.ThemeSkin?
    static func number(_ dark: Bool) -> Color { skin.map { Color(widgetHex: $0.ink) } ?? (dark ? Color(widgetHex: "#e9ddff") : Color(widgetHex: "#3b1a78")) }
    static func label(_ dark: Bool) -> Color { skin.map { Color(widgetHex: $0.inkSecondary) } ?? (dark ? Color(widgetHex: "#cdb8ff") : Color(widgetHex: "#5b3c96")) }
    static func accent(_ dark: Bool) -> Color { skin.map { Color(widgetHex: $0.accent) } ?? (dark ? Color(widgetHex: "#a78bfa") : Color(widgetHex: "#7c3aed")) }
    static func gold(_ dark: Bool) -> Color { dark ? Color(widgetHex: "#fcd34d") : Color(widgetHex: "#d97706") }
    static let slateHex = "#64748b"
}

/// The two type sizes: the hero number and the small tracked caps.
private enum WType {
    static let hero: CGFloat = 28
    static let caps: CGFloat = 10

    private static var cache: [CGFloat: UIFont] = [:]

    /// Nunito Black (900) — the app's bundled variable Nunito (bundled into the
    /// extension too); the rounded system black only if the font failed to load.
    static func black(_ size: CGFloat) -> Font {
        if let f = cache[size] { return Font(f) }
        guard let base = UIFont(name: "Nunito", size: size) else {
            return .system(size: size, weight: .black, design: .rounded)
        }
        let desc = base.fontDescriptor.addingAttributes([
            UIFontDescriptor.AttributeName(rawValue: "NSCTFontVariationAttribute"): [0x77676874: 900],
        ])
        let f = UIFont(descriptor: desc, size: size)
        cache[size] = f
        return Font(f)
    }
}

/// A small-caps label: Nunito Black at the caps size, letter-spaced.
/// Founder 10-10 ("DAY ST..."): beside the flame + trophy pair the label stacks DAY / STREAK on two lines (never truncated).
private struct StreakLabel: View {
    let stacked: Bool
    let color: Color
    var body: some View {
        if stacked {
            VStack(alignment: .leading, spacing: 0) {
                Caps(text: "DAY", color: color)
                Caps(text: "STREAK", color: color)
            }
            .fixedSize()
        } else {
            Caps(text: "DAY STREAK", color: color).fixedSize()
        }
    }
}

private struct Caps: View {
    let text: String
    let color: Color
    var tracking: CGFloat = 0.9

    var body: some View {
        Text(text.uppercased())
            .font(WType.black(WType.caps))
            .tracking(tracking)
            .monospacedDigit()
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

/// ART_SPEC §20 glossy tile (the letter-tile recipe, no rim): a darker body showing as a
/// bottom lip, the face's light → base gradient, and a soft white gloss on its top.
private struct GlossyTile: View {
    let hex: String
    let size: CGFloat

    var body: some View {
        let r = size * 0.24
        let lip = size * 0.07
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: r, style: .continuous).fill(shade(hex, -0.22))
            RoundedRectangle(cornerRadius: r, style: .continuous)
                .fill(LinearGradient(stops: [.init(color: shade(hex, 0.18), location: 0),
                                             .init(color: shade(hex, 0), location: 0.7),
                                             .init(color: shade(hex, -0.06), location: 1)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(height: size - lip)
            RoundedRectangle(cornerRadius: size * 0.18, style: .continuous)
                .fill(LinearGradient(colors: [.white.opacity(0.30), .white.opacity(0)], startPoint: .top, endPoint: .bottom))
                .frame(width: size * 0.84, height: (size - lip) * 0.42)
                .padding(.top, size * 0.08)
        }
        .frame(width: size, height: size)
    }
}

/// The white check / cross drawn on a finished tile (a shape, not a glyph).
private struct TileMark: Shape {
    let won: Bool
    func path(in r: CGRect) -> Path {
        var p = Path()
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + r.width * x, y: r.minY + r.height * y) }
        if won {
            p.move(to: pt(0.2, 0.54)); p.addLine(to: pt(0.42, 0.75)); p.addLine(to: pt(0.8, 0.3))
        } else {
            p.move(to: pt(0.28, 0.28)); p.addLine(to: pt(0.72, 0.72))
            p.move(to: pt(0.72, 0.28)); p.addLine(to: pt(0.28, 0.72))
        }
        return p
    }
}

/// The 3D game icon for a daily (`game-<catalog id>`; the catalog ids are the DB keys
/// lowercased except Classic / Six / Seven).
private func gameIconAsset(_ key: String) -> String? {
    let ids = ["DUEL": "practice", "DUEL_6": "six", "DUEL_7": "seven"]
    let name = "game-\(ids[key] ?? key.lowercased())"
    return UIImage(named: name) != nil ? name : nil
}

private func dailyURL(_ m: WSnapshot.Mode) -> URL? { URL(string: "wordocious://daily/\(m.key)") }

/// One daily as a chip: to play = a pale wash of the game's color holding its 3D icon;
/// done = the glossy tile in the game's color with a white check (a missed one: slate
/// with a white cross). No outlines.
private struct DailyChip: View {
    let mode: WSnapshot.Mode
    let size: CGFloat
    let dark: Bool

    var body: some View {
        let lip = size * 0.07
        ZStack {
            if mode.played {
                GlossyTile(hex: mode.won ? mode.colorHex : WInk.slateHex, size: size)
                TileMark(won: mode.won)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: max(2, size * 0.09), lineCap: .round, lineJoin: .round))
                    .frame(width: size * 0.5, height: size * 0.5)
                    .shadow(color: shade(mode.won ? mode.colorHex : WInk.slateHex, -0.35).opacity(0.45), radius: 0, x: 0, y: size * 0.02)
                    .offset(y: -lip / 2)
            } else {
                RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                    .fill(dark ? shade(mode.colorHex, 0.45).opacity(0.17) : Color(widgetHex: mode.colorHex).opacity(0.15))
                if let icon = gameIconAsset(mode.key) {
                    Image(icon).resizable().interpolation(.high).scaledToFit()
                        .frame(width: size * 0.8, height: size * 0.8)
                } else {
                    Text(mode.iconText ?? mode.glyph)
                        .font(WType.black(size * 0.36)).minimumScaleFactor(0.5).lineLimit(1)
                        .foregroundStyle(Color(widgetHex: mode.colorHex))
                        .padding(size * 0.12)
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(mode.title), \(mode.played ? (mode.won ? "solved" : "played") : "not played, tap to play")")
    }
}

/// A tidy grid of chips: equal gaps, rows filling the offered width, the grid centered
/// in the offered height. Each chip deep-links into its daily when `linked`.
private struct ChipGrid: View {
    let modes: [WSnapshot.Mode]
    let columns: Int
    let dark: Bool
    var linked = true
    var maxChip: CGFloat = 64
    /// Founder 10-10: spread the columns edge to edge (the first and last columns touch the sides), so stacked grids line up.
    var spread = false
    /// BI13b: a cast member peeking up from behind the first-row chip at `index`.
    var peek: (art: PeekArt, index: Int)? = nil

    var body: some View {
        GeometryReader { g in
            let cols = max(1, columns)
            let rows = max(1, Int((Double(modes.count) / Double(cols)).rounded(.up)))
            let minGap: CGFloat = 8
            let side = max(12, min(maxChip,
                                   (g.size.width - minGap * CGFloat(cols - 1)) / CGFloat(cols),
                                   (g.size.height - minGap * CGFloat(rows - 1)) / CGFloat(rows)))
            let spreadX = cols > 1 ? (g.size.width - side * CGFloat(cols)) / CGFloat(cols - 1) : 0
            let hGap = spread ? max(minGap * 0.5, spreadX) : min(spreadX, max(minGap, side * 0.3))
            let spreadY = rows > 1 ? (g.size.height - side * CGFloat(rows)) / CGFloat(rows - 1) : 0
            let vGap = max(minGap * 0.5, min(hGap, spreadY))
            let gridW = side * CGFloat(cols) + hGap * CGFloat(cols - 1)
            let gridH = side * CGFloat(rows) + vGap * CGFloat(rows - 1)
            ZStack(alignment: .topLeading) {
            if let peek, peek.index < min(cols, modes.count) {
                // Head and shoulders only, cut exactly at the chip's top edge, so it reads as
                // standing behind the chip; it lives in the empty band above the grid.
                // BI13c: the player's own cutout carries more headroom (hat) — show it to the cheeks.
                let own: Bool = { if case .own = peek.art { return true } else { return false } }()
                let fig = side * 0.8, show = fig * (own ? 0.66 : 0.52)
                CastPeek(art: peek.art)
                    .frame(width: fig, height: fig)
                    .frame(width: fig, height: show, alignment: .top)
                    .clipped()
                    .position(x: (g.size.width - gridW) / 2 + CGFloat(peek.index) * (side + hGap) + side / 2,
                              y: (g.size.height - gridH) / 2 - show / 2)
            }
            VStack(spacing: vGap) {
                ForEach(0..<rows, id: \.self) { r in
                    HStack(spacing: hGap) {
                        ForEach(Array(modes.enumerated()).filter { $0.offset / cols == r }, id: \.offset) { _, m in
                            chip(m, side)
                        }
                        // Keep a short last row aligned to the columns.
                        let short = cols - modes.dropFirst(r * cols).prefix(cols).count
                        if short > 0 {
                            ForEach(0..<short, id: \.self) { _ in Color.clear.frame(width: side, height: side) }
                        }
                    }
                }
            }
            .frame(width: g.size.width, height: g.size.height)
            }
        }
    }

    @ViewBuilder private func chip(_ m: WSnapshot.Mode, _ side: CGFloat) -> some View {
        if linked, let url = dailyURL(m) {
            Link(destination: url) { DailyChip(mode: m, size: side, dark: dark) }
        } else {
            DailyChip(mode: m, size: side, dark: dark)
        }
    }
}

/// THE hero: a ring built from the eight game colors, one segment per daily, each
/// lighting up (full color) as that daily is done; the count big inside. All eight
/// done → the whole ring turns gold and reads SWEPT.
private struct DailyRing: View {
    let modes: [WSnapshot.Mode]
    let dark: Bool
    /// Item 28 / 48: all word dailies won → the gold FLAWLESS ring with the run as the hero ("×3").
    var flawless = false
    var flawlessRun = 0
    /// The word inside the ring under the count (founder 10-10: DAILIES / PUZZLES), shown at every ring size.
    var label = "DAILIES"

    var body: some View {
        GeometryReader { g in
            let d = min(g.size.width, g.size.height)
            let lw = d * 0.11
            let radius = (d - lw) / 2
            let circ = 2 * Double.pi * Double(radius)
            let n = max(modes.count, 1)
            // Half the gap between segments, in trim units (round caps reach lw/2 past the trim).
            let half = min(0.35 / Double(n), (Double(lw) / 2 + Double(d) * 0.03) / circ)
            let played = modes.filter(\.played).count
            let swept = !modes.isEmpty && played == modes.count
            let gold = LinearGradient(colors: [Color(widgetHex: "#fcd34d"), Color(widgetHex: "#f59e0b")],
                                      startPoint: .top, endPoint: .bottom)
            ZStack {
                if flawless {
                    // The art team's gold ring with its eight sparkle stars (art/streaks/out/flawless-ring).
                    Image("streak-flawless-ring").resizable().interpolation(.high).scaledToFit()
                        .frame(width: d, height: d)
                        .shadow(color: Color(widgetHex: "#f59e0b").opacity(dark ? 0.55 : 0.3), radius: d * 0.06)
                }
                ForEach(Array(modes.enumerated()), id: \.offset) { i, m in
                  if !flawless {
                    let a = Double(i) / Double(n), b = Double(i + 1) / Double(n)
                    let arc = Circle().trim(from: a + half, to: b - half)
                    let style = StrokeStyle(lineWidth: lw, lineCap: .round)
                    Group {
                        if swept {
                            arc.stroke(gold, style: style)
                        } else if m.played {
                            arc.stroke(Color(widgetHex: m.won ? m.colorHex : WInk.slateHex), style: style)
                        } else {
                            arc.stroke(dark ? shade(m.colorHex, 0.45).opacity(0.24) : Color(widgetHex: m.colorHex).opacity(0.17), style: style)
                        }
                    }
                    .rotationEffect(.degrees(-90))
                    .padding(lw / 2)
                  }
                }
                VStack(spacing: -2) {
                    if flawless {
                        // The run is the hero; FLAWLESS under it (or alone on a first flawless day).
                        if flawlessRun >= 2 {
                            Text("\u{00D7}\(flawlessRun)")
                                .font(WType.black(min(WType.hero * 1.15, d * 0.34)))
                                .monospacedDigit().foregroundStyle(WInk.gold(dark))
                                .lineLimit(1).minimumScaleFactor(0.4)
                            // Founder 10-10 ("×3 FLAWLES"): the label shrinks to fit inside the gold ring, never truncates.
                            if d >= 60 {
                                Text("FLAWLESS").font(WType.black(WType.caps)).tracking(0.4)
                                    .foregroundStyle(WInk.gold(dark))
                                    .lineLimit(1).minimumScaleFactor(0.35).allowsTightening(true)
                            }
                        } else {
                            Text("FLAWLESS")
                                .font(WType.black(min(WType.hero * 0.6, d * 0.16)))
                                .foregroundStyle(WInk.gold(dark)).lineLimit(1).minimumScaleFactor(0.4)
                        }
                    } else {
                    Text(swept ? "SWEPT" : "\(played)/\(modes.count)")
                        // The hero size, eased down only on rings too small to hold it.
                        .font(WType.black(min(WType.hero, d * 0.32)))
                        .tracking(swept ? 0.5 : 0)
                        .monospacedDigit()
                        .foregroundStyle(swept ? WInk.gold(dark) : WInk.number(dark))
                        .lineLimit(1).minimumScaleFactor(0.4)
                    // The caps label only where the ring has room for both lines.
                    if d >= 84 {
                        Caps(text: swept ? "ALL \(modes.count)" : label, color: WInk.label(dark).opacity(0.8))
                    } else {
                        // Small rings too: the word sized to the ring (never dropped, never truncated).
                        Text(swept ? "ALL \(modes.count)" : label)
                            .font(WType.black(max(6.5, d * 0.12))).tracking(0.3)
                            .foregroundStyle(WInk.label(dark).opacity(0.8))
                            .lineLimit(1).minimumScaleFactor(0.5)
                    }
                    }
                }
                // The gold flawless ring art is thicker (its sparkle stars ride on it): its text keeps a wider margin.
                .frame(width: flawless ? d * 0.56 : (d - 2 * lw) * 0.82)
            }
            .frame(width: d, height: d)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(flawless
            ? (flawlessRun >= 2 ? "Flawless, \(flawlessRun) days in a row" : "Flawless today")
            : "\(modes.filter(\.played).count) of \(modes.count) dailies done")
    }
}

/// The streak set right into the 3D flame (the number sits on the flame's body, above
/// its face). A zero streak shows a quieter flame.
private struct FlameStreak: View {
    let streak: Int
    let size: CGFloat

    var body: some View {
        ZStack {
            Image("icon3d-flame").resizable().interpolation(.high).scaledToFit()
                .saturation(streak == 0 ? 0.3 : 1)
                .opacity(streak == 0 ? 0.7 : 1)
            Text("\(streak)")
                .font(WType.black(size * (streak >= 100 ? 0.27 : 0.34)))
                .monospacedDigit()
                .foregroundStyle(Color.white)
                .shadow(color: Color(widgetHex: "#c2410c").opacity(0.7), radius: 0, x: 0, y: max(0.5, size * 0.025))
                .lineLimit(1).minimumScaleFactor(0.5)
                .frame(width: size * 0.56)
                .offset(y: -size * 0.03)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(streak) day streak")
    }
}

/// The flawless-day run set into the SAME trophy the app header shows, growing by tier
/// (3 / 5 / 7 / 10 / 30, art/streaks). Same size, baseline, number weight and size as the flame.
private struct TrophyStreak: View {
    let streak: Int
    let size: CGFloat

    private var tier: Int {
        switch streak { case 30...: return 30; case 10...: return 10; case 7...: return 7; case 5...: return 5; default: return 3 }
    }

    var body: some View {
        ZStack {
            Image("streak-trophy-\(tier)").resizable().interpolation(.high).scaledToFit()
            Text("\(streak)")
                .font(WType.black(size * (streak >= 100 ? 0.27 : 0.34)))
                .monospacedDigit()
                .foregroundStyle(Color.white)
                .shadow(color: Color(widgetHex: "#b45309").opacity(0.75), radius: 0, x: 0, y: max(0.5, size * 0.025))
                .lineLimit(1).minimumScaleFactor(0.5)
                .frame(width: size * 0.56)
                .offset(y: size * 0.27)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(streak) flawless days in a row")
    }
}

/// Item 28: the day-streak flame and the flawless trophy as a matched pair — same icon size, same baseline,
/// numbers in the same weight and size, even spacing, centered as a group (the header's flame · trophy row).
/// Flame alone (no gap) when there is no flawless run of 2+.
private struct StreakPair: View {
    let snap: WSnapshot
    let size: CGFloat

    var body: some View {
        let run = snap.flawlessRun
        HStack(alignment: .center, spacing: size * 0.06) {
            FlameStreak(streak: snap.streak, size: size)
            if run >= 2 { TrophyStreak(streak: run, size: size) }
        }
    }
}

/// WORDOCIOUS as the bubble lettering image (never plain text), per widget size; tinted per theme / season.
private struct WordmarkImage: View {
    enum Size: String { case small, medium, large }
    let size: Size
    let halloween: Bool
    let dark: Bool
    var height: CGFloat

    var body: some View {
        // Halloween: black backs take the orange-bodied lettering; normal: the purple bubble face.
        let variant = halloween ? "halloween-orange" : "normal"
        Image("widget-wordmark-\(size.rawValue)-\(variant)")
            .resizable().interpolation(.high).scaledToFit()
            .frame(height: height)
            .accessibilityLabel("Wordocious")
    }
}

/// The friendly W (the one mascot; its Halloween skin in season).
private struct MascotW: View {
    let date: Date
    var seasonOn = true
    var body: some View {
        let skin = WidgetCast.asset("w", day: localDay(date), seasonOn: seasonOn)
        Image(UIImage(named: skin) != nil ? skin : "mascot-w")
            .resizable().interpolation(.high).scaledToFit()
            .accessibilityHidden(true)
    }
}

/// What peeks in: a bundled cast pose, or (BI13c, big days) the player's own pre-rendered look.
enum PeekArt {
    case asset(String)
    case own(UIImage)
}

/// BI13b: the one cast member peeking in (WidgetCast.peekPose — mood by state, pose by day).
private struct CastPeek: View {
    let art: PeekArt
    var body: some View {
        Group {
            switch art {
            case .asset(let asset): Image(UIImage(named: asset) != nil ? asset : "mascot-r").resizable().interpolation(.high)
            case .own(let img): Image(uiImage: img).resizable().interpolation(.high)
            }
        }
        .scaledToFit()
        .accessibilityHidden(true)
    }
}

/// BI13c: the player's own look, pre-rendered by the app (WidgetAvatarSnapshot) into the
/// app-group container — a mascot cutout or a framed photo; nil (→ W / the cast) when absent.
enum OwnLook {
    struct Look { let image: UIImage; let photo: Bool }
    static var load: () -> Look? = {
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        for (name, photo) in [(WidgetAvatar.mascotFile, false), (WidgetAvatar.photoFile, true)] {
            if let img = UIImage(contentsOfFile: dir.appendingPathComponent(name).path) { return Look(image: img, photo: photo) }
        }
        return nil
    }
}

/// BI13c: the large header's host — the player's own look (mascot cutout / framed photo), else W.
private struct HeaderHost: View {
    let date: Date
    let own: OwnLook.Look?
    var seasonOn = true
    var body: some View {
        if let own {
            Image(uiImage: own.image).resizable().interpolation(.high).scaledToFit().accessibilityHidden(true)
        } else {
            MascotW(date: date, seasonOn: seasonOn)
        }
    }
}

/// A row of short stats spread evenly across the width, separated by small dots.
private struct StatLine: View {
    let items: [Text]
    let dark: Bool

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, t in
                if i > 0 {
                    Spacer(minLength: 4)
                    Circle().fill(WInk.label(dark).opacity(0.35)).frame(width: 3, height: 3)
                    Spacer(minLength: 4)
                }
                t.font(WType.black(WType.caps)).tracking(0.9).monospacedDigit().lineLimit(1)
            }
        }
        .minimumScaleFactor(0.7)
        .lineLimit(1)
    }
}

extension WSnapshot {
    /// BI13b: the peeking cast member's image set at `date` (by the dailies' state + the day).
    func peekAsset(at date: Date) -> String {
        let day = localDay(date)
        return WidgetCast.peekAsset(WidgetCast.peekPose(played: word.played, total: modes.count, streak: streak, day: day), day: day,
                                    seasonOn: seasonHalloween != false)
    }

    /// BI13c: on a big day (swept / streak milestone) the player's own look peeks in instead of
    /// the cast — a photo only where it shows whole (`photoOK`), never cut by a chip.
    func peekArt(at date: Date, own: OwnLook.Look?, photoOK: Bool) -> PeekArt {
        if let own, own.photo ? photoOK : true,
           WidgetCast.ownPeekDay(played: word.played, total: modes.count, streak: streak) {
            return .own(own.image)
        }
        return .asset(peekAsset(at: date))
    }

    /// The first unplayed daily (Wordocious first, then Puzzles).
    var nextUp: Mode? { (modes + puzzleModes).first(where: { !$0.played }) }

    /// §AL: the stats to draw at `date` (a snapshot from another day reads 0/N, 0 points).
    func dayStats(at date: Date) -> WidgetDayStats {
        WidgetStats.forDay(snapshotDay: day, today: localDay(date), played: done, total: total, points: points)
    }
}

private func resetLabel(_ date: Date) -> String {
    WidgetStats.resetText(seconds: Int(nextLocalMidnight(after: date).timeIntervalSince(date))).uppercased()
}

/// "NEXT CLASSIC", "4H LEFT", "1,240 PTS TODAY" — muted words, the value in ink.
private func statTexts(_ snap: WSnapshot, _ date: Date, _ dark: Bool, nextFirst: Bool) -> [Text] {
    let muted = WInk.label(dark).opacity(0.75)
    let stats = snap.dayStats(at: date)
    let next: Text = snap.nextUp.map {
        Text("NEXT ").foregroundColor(muted)
            + Text(WidgetStats.nextName(key: $0.key, title: $0.title).uppercased()).foregroundColor(WInk.accent(dark))
    } ?? (Text("ALL DONE").foregroundColor(WInk.gold(dark)))
    // The gold clock sprite (night art 10-03), inline at the caps size, leads the countdown.
    let left = Text(Image("art-badge-icon-clock-inline")).baselineOffset(-1.5) + Text(" ")
        + countdownText(date).foregroundColor(WInk.number(dark)) + Text(" LEFT").foregroundColor(muted)
    let pts = Text(WidgetStats.pointsText(stats.points)).foregroundColor(WInk.number(dark))
        + Text(" PTS TODAY").foregroundColor(muted)
    return nextFirst ? [next, left, pts] : [pts, left, next]
}

private func widgetPhrase(_ snap: WSnapshot, _ date: Date) -> String {
    let stats = snap.dayStats(at: date)
    return "\(snap.word.played) of \(snap.word.total) dailies done. \(snap.streak) day streak. "
        + "\(WidgetStats.pointsPhrase(stats)). "
        + WidgetStats.countdownPhrase(seconds: Int(nextLocalMidnight(after: date).timeIntervalSince(date)))
}

// MARK: - Small: wordmark, the ring (hero) + the cast, then the streak pair and the live reset countdown

/// The caps-size live countdown (h:m:s, ticking with no timeline cost). Width-capped so the system timer
/// never grabs the whole row.
private struct CapsTimer: View {
    let date: Date
    let color: Color
    var width: CGFloat = 64

    var body: some View {
        countdownText(date)
            .font(WType.black(WType.caps)).monospacedDigit()
            .foregroundStyle(color)
            .lineLimit(1).minimumScaleFactor(0.7)
            .frame(width: width, alignment: .leading)
    }
}

struct SmallView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let hall = halloweenOn(snap, date)
        let dark = hall || (snap.theme?.dark ?? (scheme == .dark))
        // Founder 10-10: the large widget's look, distilled: WORDOCIOUS, the DAILIES and PUZZLES rings side by side,
        // then the streak pair (left) mirrored by the live countdown (right). The chips are the small size's sacrifice.
        GeometryReader { g in
            let hasPuzzles = !snap.puzzleModes.isEmpty
            let mark: CGFloat = 13
            let bottom: CGFloat = 30
            let ring = max(40, min((g.size.width - 8) / (hasPuzzles ? 2 : 1), g.size.height - mark - bottom - 12))
            VStack(spacing: 0) {
                WordmarkImage(size: .small, halloween: hall, dark: dark, height: mark)
                Spacer(minLength: 4)
                HStack(spacing: 8) {
                    DailyRing(modes: snap.modes, dark: dark, flawless: snap.isFlawless, flawlessRun: snap.flawlessRun)
                        .frame(width: ring, height: ring)
                    if hasPuzzles {
                        DailyRing(modes: snap.puzzleModes, dark: dark, label: "PUZZLES")
                            .frame(width: ring, height: ring)
                    }
                }
                Spacer(minLength: 4)
                HStack(spacing: 4) {
                    StreakPair(snap: snap, size: bottom - 2)
                    Spacer(minLength: 2)
                    // The gold clock sprite (night art 10-03) leads the live countdown.
                    Image("art-badge-icon-clock-sprite").resizable().interpolation(.high)
                        .frame(width: 11, height: 11).accessibilityHidden(true)
                    CapsTimer(date: date, color: WInk.label(dark).opacity(0.8), width: 50)
                }
                .frame(height: bottom)
            }
            .frame(width: g.size.width, height: g.size.height)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(widgetPhrase(snap, date))
        // The one tap a small widget gets: Home (founder 10-05: "I find myself just clicking home
        // every time anyways"), not the next unplayed daily. Medium/large chips still deep-link.
        .widgetURL(homeURL)
    }
}

// MARK: - Medium: ring + streak pair | the 4×2 daily chips; one stat line across the bottom

struct MediumView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let hall = halloweenOn(snap, date)
        let dark = hall || (snap.theme?.dark ?? (scheme == .dark))
        // Founder 10-10: two columns of chips (DAILIES 4×2 | PUZZLES 5×2) under a header band. Each group's ring sits at its
        // left edge (over Classic / over ProperNoundle) with its white label under it; your own mascot stands between the
        // two rings; WORDOCIOUS + TODAY'S DAILIES fill the top right. A finished group's ring glows gold.
        GeometryReader { g in
            let hasPuzzles = !snap.puzzleModes.isEmpty
            let W: CGFloat = g.size.width, H: CGFloat = g.size.height
            let gap: CGFloat = 4, middle: CGFloat = 14, bottom: CGFloat = 16, label: CGFloat = 10, ring: CGFloat = 36
            let headerH: CGFloat = ring + 2 + label
            let cols: CGFloat = hasPuzzles ? 9 : 4
            let byWidth: CGFloat = (W - (cols - (hasPuzzles ? 2 : 1)) * gap - (hasPuzzles ? middle : 0)) / cols
            let byHeight: CGFloat = (H - headerH - bottom - 2 * 4 - gap) / 2
            let c: CGFloat = max(16, min(40, min(byWidth, byHeight)))
            let gridH: CGFloat = 2 * c + gap
            let dW: CGFloat = 4 * c + 3 * gap
            let pW: CGFloat = 5 * c + 4 * gap
            let pX: CGFloat = hasPuzzles ? W - pW : W
            let dDone = !snap.modes.isEmpty && snap.modes.allSatisfy(\.played)
            let pDone = hasPuzzles && snap.puzzleModes.allSatisfy(\.played)
            let gold = Color(widgetHex: "#f59e0b")
            VStack(spacing: 0) {
                // Header band (absolute layout so every piece lines up with the chip columns below).
                ZStack(alignment: .topLeading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Link(destination: homeURL) {
                            DailyRing(modes: snap.modes, dark: dark, flawless: snap.isFlawless, flawlessRun: snap.flawlessRun)
                                .frame(width: ring, height: ring)
                                .shadow(color: dDone ? gold.opacity(0.85) : .clear, radius: dDone ? 7 : 0)
                        }
                        Caps(text: "DAILIES", color: .white).frame(height: label)
                    }
                    // Your mascot, centered between the DAILIES ring and the PUZZLES ring.
                    let mLeft: CGFloat = ring + 6
                    let mRight: CGFloat = hasPuzzles ? pX - 6 : W * 0.6
                    Link(destination: homeURL) {
                        HeaderHost(date: date, own: OwnLook.load(), seasonOn: snap.seasonHalloween != false)
                            .frame(width: min(headerH, mRight - mLeft), height: headerH)
                    }
                    .frame(width: max(0, mRight - mLeft), height: headerH)
                    .offset(x: mLeft)
                    if hasPuzzles {
                        VStack(alignment: .leading, spacing: 2) {
                            Link(destination: homeURL) {
                                DailyRing(modes: snap.puzzleModes, dark: dark, label: "PUZZLES")
                                    .frame(width: ring, height: ring)
                                    .shadow(color: pDone ? gold.opacity(0.85) : .clear, radius: pDone ? 7 : 0)
                            }
                            Caps(text: "PUZZLES", color: .white).frame(height: label)
                        }
                        .offset(x: pX)
                    }
                    // WORDOCIOUS + TODAY'S DAILIES in the top right, after the PUZZLES ring.
                    let tLeft: CGFloat = (hasPuzzles ? pX : W * 0.6) + ring + 8
                    Link(destination: homeURL) {
                        VStack(alignment: .center, spacing: 3) {
                            WordmarkImage(size: .medium, halloween: hall, dark: dark, height: 14)
                            Image("widget-headline-\(hall ? "halloween-orange" : "normal")")
                                .resizable().interpolation(.high).scaledToFit().frame(height: 8)
                                .accessibilityLabel("Today's dailies")
                        }
                        .frame(width: max(40, W - tLeft), height: headerH)
                    }
                    .offset(x: tLeft)
                }
                .frame(width: W, height: headerH, alignment: .topLeading)
                Spacer(minLength: 4)
                HStack(spacing: 0) {
                    ChipGrid(modes: snap.modes, columns: 4, dark: dark, maxChip: c, spread: true)
                        .frame(width: dW, height: gridH)
                    if hasPuzzles {
                        Spacer(minLength: 0)
                        Capsule().fill(Color.white.opacity(0.18)).frame(width: 1.5, height: gridH - 6)
                        Spacer(minLength: 0)
                        ChipGrid(modes: snap.puzzleModes, columns: 5, dark: dark, maxChip: c, spread: true)
                            .frame(width: pW, height: gridH)
                    }
                }
                .frame(width: W, height: gridH)
                Spacer(minLength: 4)
                Link(destination: homeURL) {
                    HStack(spacing: 8) {
                        StreakPair(snap: snap, size: bottom + 2)
                        StatLine(items: statTexts(snap, date, dark, nextFirst: true), dark: dark)
                    }
                    .frame(height: bottom)
                }
            }
            .frame(width: W, height: H)
        }
        // Founder 10-10 ("beefier"): the medium reaches into the system margin so the chips are as big as they can be.
        .padding(.horizontal, -8).padding(.vertical, -6)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(widgetPhrase(snap, date))
        // Anywhere not on a chip: the next daily, else (all done) Home — never a dead tap.
        .widgetURL(snap.nextUp.flatMap(dailyURL) ?? homeURL)
    }
}

// MARK: - Large: header (W + lettering, streak pair), ring + daily chips, the Puzzles, points

struct LargeView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let hall = halloweenOn(snap, date)
        let dark = hall || (snap.theme?.dark ?? (scheme == .dark))
        let muted = WInk.label(dark).opacity(0.75)
        VStack(spacing: 0) {
            // Every element is its own Link (founder 10-08: the large widget did nothing on tap) with Home
            // as the fallback; the root .widgetURL below covers every gap.
            HStack(spacing: 10) {
                Link(destination: homeURL) {
                    HStack(spacing: 10) {
                        // BI13c: the player's own look heads the large widget (W for guests / no look).
                        // ~1.5× the old 42 pt, standing just over the header baseline like the Home host:
                        // the figure overflows upward into the top margin, so the layout keeps its 42 pt row.
                        HeaderHost(date: date, own: OwnLook.load(), seasonOn: snap.seasonHalloween != false)
                            .frame(width: 60, height: 60, alignment: .bottom)
                            .offset(y: 5)
                            .frame(width: 60, height: 42, alignment: .bottom)
                        VStack(alignment: .leading, spacing: 4) {
                            // Item 28: lettering image + the "today's dailies" headline image.
                            WordmarkImage(size: .large, halloween: hall, dark: dark, height: 16)
                            Image("widget-headline-\(hall ? "halloween-orange" : "normal")")
                                .resizable().interpolation(.high).scaledToFit().frame(height: 9)
                                .accessibilityLabel("Today's dailies")
                        }
                    }
                }
                Spacer(minLength: 6)
                HStack(spacing: 4) {
                    StreakPair(snap: snap, size: 34)
                    Caps(text: "DAY STREAK", color: WInk.number(dark))
                }
            }
            Spacer(minLength: 8)
            // Founder 10-10: two mirrored bands with ONE chip size and gap. DAILIES: the ring on the left, its 8 chips on the
            // right. PUZZLES: its 10 chips (5 × 2) on the left, the PUZZLES ring on the right. Both rings the same size.
            GeometryReader { g in
                let hasPuzzles = !snap.puzzleModes.isEmpty
                let gap: CGFloat = 8, ringGap: CGFloat = 12, title: CGFloat = 12, titleGap: CGFloat = 6, bandGap: CGFloat = 12
                let w = g.size.width
                // Width: 5 chips + 4 gaps + the ring (= 2 chips + a gap) + the ring gap fill the width.
                let byWidth = (w - ringGap - 5 * gap) / 7
                // Height: both bands (2 chips + a gap each) and their titles fit.
                let bands: CGFloat = hasPuzzles ? 2 : 1
                let byHeight = (g.size.height - bands * (title + titleGap) - (hasPuzzles ? bandGap : 0) - bands * gap) / (2 * bands)
                let c = max(20, min(56, byWidth, byHeight))
                let ring = 2 * c + gap
                // Founder 10-10 ("an odd gap between the daily circle and the games"): the DAILIES band grows into the spare
                // room so it also spans the full width (ring + 4 chips: w = 6 cD + 4 gaps + the ring gap) — its ring's left
                // edge stays over the Puzzles chips, its last chip's right edge over the Puzzles ring.
                let spareH = g.size.height - (bands * (title + titleGap) + (hasPuzzles ? bandGap + ring : 0))
                let cD = hasPuzzles ? max(c, min((w - ringGap - 4 * gap) / 6, (spareH - gap) / 2)) : c
                let ringD = 2 * cD + gap
                VStack(alignment: .leading, spacing: 0) {
                    Link(destination: homeURL) {
                        HStack {
                            Caps(text: "DAILIES", color: WInk.number(dark))
                            Spacer()
                            Caps(text: "\(snap.word.played)/\(snap.word.total)", color: muted)
                        }
                        .frame(height: title)
                    }
                    Spacer().frame(height: titleGap)
                    HStack(spacing: 0) {
                        Link(destination: homeURL) {
                            DailyRing(modes: snap.modes, dark: dark, flawless: snap.isFlawless, flawlessRun: snap.flawlessRun)
                                .frame(width: ringD, height: ringD)
                        }
                        Spacer(minLength: ringGap)
                        ChipGrid(modes: snap.modes, columns: 4, dark: dark, maxChip: cD, spread: true)
                            .frame(width: 4 * cD + 3 * gap, height: ringD)
                    }
                    .frame(height: ringD)
                    if hasPuzzles {
                        Spacer().frame(height: bandGap)
                        Link(destination: homeURL) {
                            HStack {
                                Caps(text: "PUZZLES", color: WInk.number(dark))
                                Spacer()
                                Caps(text: "\(snap.puzzleProgress.played)/\(snap.puzzleProgress.total)", color: muted)
                            }
                            .frame(height: title)
                        }
                        Spacer().frame(height: titleGap)
                        HStack(spacing: 0) {
                            // Every Puzzles chip links to its own daily (ChipGrid is linked by default).
                            ChipGrid(modes: snap.puzzleModes, columns: 5, dark: dark, maxChip: c, spread: true,
                                     peek: (.asset(snap.peekAsset(at: date)), 2))
                                .frame(width: 5 * c + 4 * gap, height: ring)
                            Spacer(minLength: ringGap)
                            Link(destination: homeURL) {
                                DailyRing(modes: snap.puzzleModes, dark: dark, label: "PUZZLES")
                                    .frame(width: ring, height: ring)
                            }
                        }
                        .frame(height: ring)
                    }
                }
                .frame(width: w, height: g.size.height, alignment: .center)
            }
            Spacer(minLength: 8)
            Link(destination: homeURL) {
                StatLine(items: statTexts(snap, date, dark, nextFirst: true), dark: dark)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(widgetPhrase(snap, date))
        // nextUp is nil once everything is played: the old nil URL left every gap a dead tap.
        .widgetURL(snap.nextUp.flatMap(dailyURL) ?? homeURL)
    }
}

// MARK: - Lock screen (accessoryRectangular): lettering + headline + both rows, h:m countdown

struct AccessoryRectangularView: View {
    let snap: WSnapshot
    let date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                // Item 28: the lettering image even here (the system tints it).
                Image("widget-wordmark-small-normal").resizable().scaledToFit().frame(height: 11)
                    .widgetAccentable().accessibilityLabel("Wordocious")
                Spacer(minLength: 0)
                // Lock-screen accessories can't tick seconds: h:m, refreshed on the timeline.
                Text(resetLabel(date)).font(.system(size: 10, weight: .heavy, design: .rounded)).monospacedDigit()
            }
            Text(snap.isFlawless
                    ? (snap.flawlessRun >= 2 ? "FLAWLESS \u{00D7}\(snap.flawlessRun)" : "FLAWLESS")
                    : snap.headline(at: date))
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(snap.puzzleModes.isEmpty
                    ? "Word \(snap.word.played)/\(snap.word.total)"
                    : "Word \(snap.word.played)/\(snap.word.total) · Puzzles \(snap.puzzleProgress.played)/\(snap.puzzleProgress.total)")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(homeURL)
    }
}

// MARK: - Widget

/// BI13: the one calm background — the brand's soft lavender → white; deep purple in dark.
/// 2.8 Halloween (item 24): black → deep orange-brown with one faint motif that rotates on each timeline
/// step (art/widgets/halloween); never behind text (corner / bottom edge, low opacity).
struct WidgetBackdrop: View {
    @Environment(\.colorScheme) private var scheme
    var halloween = false
    var date = Date()
    var skin: WSnapshot.ThemeSkin? = nil
    /// Founder 10-10: on the medium / large layouts the content reaches every corner, so the motif sits smaller and
    /// fainter (it read on top of NEXT / DAY STREAK).
    var subtle = false
    /// The medium fills every corner (rings in both top corners): no motif there.
    var motif = true

    private static let motifs: [(name: String, alignment: Alignment, w: CGFloat, opacity: Double)] = [
        ("widget-halloween-moon-bats", .topTrailing, 70, 0.55),
        ("widget-halloween-pumpkin-row", .bottom, 150, 0.4),
        ("widget-halloween-bat-flock", .topTrailing, 80, 0.5),
        ("widget-halloween-haunted-hill", .bottomTrailing, 90, 0.4),
        ("widget-halloween-stars-clouds", .top, 130, 0.35),
        ("widget-halloween-cobweb", .topLeading, 60, 0.45),
    ]

    var body: some View {
        if halloween {
            let m = Self.motifs[Int(date.timeIntervalSince1970 / 3600) % Self.motifs.count]
            ZStack(alignment: m.alignment) {
                LinearGradient(colors: [Color(widgetHex: "#000000"), Color(widgetHex: "#1f1004"), Color(widgetHex: "#3a1a05")],
                               startPoint: .top, endPoint: .bottom)
                if motif {
                    Image(m.name).resizable().interpolation(.high).scaledToFit()
                        .frame(width: subtle ? m.w * 0.7 : m.w).opacity(subtle ? m.opacity * 0.35 : m.opacity)
                }
            }
            .accessibilityHidden(true)
        } else if let skin {
            // Item 25: the theme's wall, code-drawn (3 stops + the soft top glow), like the app's pages.
            ZStack {
                LinearGradient(colors: skin.wall.map { Color(widgetHex: $0) }, startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [Color(widgetHex: skin.glow).opacity(0.4), Color(widgetHex: skin.glow).opacity(0)],
                               center: UnitPoint(x: 0.5, y: -0.05), startRadius: 0, endRadius: 260)
            }
            .accessibilityHidden(true)
        } else {
            LinearGradient(colors: scheme == .dark
                           ? [Color(widgetHex: "#2a1650"), Color(widgetHex: "#1c1231")]
                           : [Color(widgetHex: "#e6dcff"), Color(widgetHex: "#f5f3ff"), Color.white],
                           startPoint: .top, endPoint: .bottom)
                .accessibilityHidden(true)
        }
    }
}

struct WordociousDailyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WordociousDaily", provider: DailyProvider()) { entry in
            WidgetRootView(entry: entry)
                .widgetBackdrop(halloween: halloweenOn(entry.snap, entry.date), date: entry.date, skin: entry.snap.theme)
        }
        .configurationDisplayName("Daily Puzzles")
        .description("Today's Wordocious dailies and Puzzles, and your streak.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}

struct WidgetRootView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyEntry

    var body: some View {
        switch family {
        case .systemMedium: MediumView(snap: entry.snap, date: entry.date)
        case .systemLarge: LargeView(snap: entry.snap, date: entry.date)
        case .accessoryRectangular: AccessoryRectangularView(snap: entry.snap, date: entry.date)
        default: SmallView(snap: entry.snap, date: entry.date)
        }
    }
}

private struct BackdropModifier: ViewModifier {
    @Environment(\.widgetFamily) private var family
    let halloween: Bool
    let date: Date
    var skin: WSnapshot.ThemeSkin? = nil

    func body(content: Content) -> some View {
        let accessory = family == .accessoryRectangular
        if #available(iOS 17.0, *) {
            // The system content margins pad the views; lock-screen accessories tint
            // themselves, so they get no background.
            content.containerBackground(for: .widget) {
                if accessory { Color.clear } else { WidgetBackdrop(halloween: halloween, date: date, skin: skin, subtle: true, motif: family != .systemMedium) }
            }
        } else if accessory {
            content
        } else {
            // iOS 16 has no content margins: the same 16 pt by hand.
            content.padding(16).background(WidgetBackdrop(halloween: halloween, date: date, skin: skin, subtle: true, motif: family != .systemMedium))
        }
    }
}

extension View {
    func widgetBackdrop(halloween: Bool = false, date: Date = Date(), skin: WSnapshot.ThemeSkin? = nil) -> some View {
        modifier(BackdropModifier(halloween: halloween, date: date, skin: skin))
    }
}

@main
struct WordociousWidgetBundle: WidgetBundle {
    var body: some Widget {
        WordociousDailyWidget()
    }
}
