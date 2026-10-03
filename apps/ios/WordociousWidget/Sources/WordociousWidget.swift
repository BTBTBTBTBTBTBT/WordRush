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
// beside the W header) — mood by state, pose by day (WidgetCast.peekPose). Two type sizes in Nunito Black (hero +
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
}

extension WSnapshot {
    var puzzleModes: [Mode] { puzzles ?? [] }
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
                         wordStreaks: wordStreaks, puzzleStreaks: puzzleStreaks)
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
          let snap = try? JSONDecoder().decode(WSnapshot.self, from: data) else { return emptySnapshot() }
    if snap.day == localDay(date) { return snap }
    return snap.freshDay(localDay(date))
}

private func nextLocalMidnight(after date: Date = Date()) -> Date {
    Calendar.current.nextDate(after: date, matching: DateComponents(hour: 0, minute: 0, second: 0),
                              matchingPolicy: .nextTime) ?? date.addingTimeInterval(3600)
}

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
        var dates: [Date] = [now]
        var t = now
        while dates.count < 40 {
            let left = midnight.timeIntervalSince(t)
            let step: TimeInterval = left <= 3600 ? 900 : 3600
            var rem = left.truncatingRemainder(dividingBy: step)
            if rem < 1 { rem = step }
            t = t.addingTimeInterval(rem)
            if t >= midnight.addingTimeInterval(-1) { break }
            dates.append(t)
        }
        var entries = dates.map { DailyEntry(date: $0, snap: snap) }
        entries.append(DailyEntry(date: midnight, snap: loadSnapshot(for: midnight.addingTimeInterval(1))))
        completion(Timeline(entries: entries, policy: .after(midnight)))
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
    static func number(_ dark: Bool) -> Color { dark ? Color(widgetHex: "#e9ddff") : Color(widgetHex: "#3b1a78") }
    static func label(_ dark: Bool) -> Color { dark ? Color(widgetHex: "#cdb8ff") : Color(widgetHex: "#5b3c96") }
    static func accent(_ dark: Bool) -> Color { dark ? Color(widgetHex: "#a78bfa") : Color(widgetHex: "#7c3aed") }
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
                        .frame(width: size * 0.7, height: size * 0.7)
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
    /// BI13b: a cast member peeking up from behind the first-row chip at `index`.
    var peek: (asset: String, index: Int)? = nil

    var body: some View {
        GeometryReader { g in
            let cols = max(1, columns)
            let rows = max(1, Int((Double(modes.count) / Double(cols)).rounded(.up)))
            let minGap: CGFloat = 8
            let side = max(12, min(maxChip,
                                   (g.size.width - minGap * CGFloat(cols - 1)) / CGFloat(cols),
                                   (g.size.height - minGap * CGFloat(rows - 1)) / CGFloat(rows)))
            let spreadX = cols > 1 ? (g.size.width - side * CGFloat(cols)) / CGFloat(cols - 1) : 0
            let hGap = min(spreadX, max(minGap, side * 0.3))
            let spreadY = rows > 1 ? (g.size.height - side * CGFloat(rows)) / CGFloat(rows - 1) : 0
            let vGap = max(minGap * 0.5, min(hGap, spreadY))
            let gridW = side * CGFloat(cols) + hGap * CGFloat(cols - 1)
            let gridH = side * CGFloat(rows) + vGap * CGFloat(rows - 1)
            ZStack(alignment: .topLeading) {
            if let peek, peek.index < min(cols, modes.count) {
                // Head and shoulders only, cut exactly at the chip's top edge, so it reads as
                // standing behind the chip; it lives in the empty band above the grid.
                let fig = side * 0.8, show = fig * 0.52
                CastPeek(asset: peek.asset)
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
                ForEach(Array(modes.enumerated()), id: \.offset) { i, m in
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
                VStack(spacing: -2) {
                    Text(swept ? "SWEPT" : "\(played)/\(modes.count)")
                        // The hero size, eased down only on rings too small to hold it.
                        .font(WType.black(min(WType.hero, d * 0.32)))
                        .tracking(swept ? 0.5 : 0)
                        .monospacedDigit()
                        .foregroundStyle(swept ? WInk.gold(dark) : WInk.number(dark))
                        .lineLimit(1).minimumScaleFactor(0.4)
                    // The caps label only where the ring has room for both lines.
                    if d >= 84 {
                        Caps(text: swept ? "ALL \(modes.count)" : "DAILIES", color: WInk.label(dark).opacity(0.8))
                    }
                }
                .frame(width: (d - 2 * lw) * 0.82)
            }
            .frame(width: d, height: d)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(modes.filter(\.played).count) of \(modes.count) dailies done")
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

/// The friendly W (the one mascot; its Halloween skin in season).
private struct MascotW: View {
    let date: Date
    var body: some View {
        let skin = WidgetCast.asset("w", day: localDay(date))
        Image(UIImage(named: skin) != nil ? skin : "mascot-w")
            .resizable().interpolation(.high).scaledToFit()
            .accessibilityHidden(true)
    }
}

/// BI13b: the one cast member peeking in (WidgetCast.peekPose — mood by state, pose by day).
private struct CastPeek: View {
    let asset: String
    var body: some View {
        Image(UIImage(named: asset) != nil ? asset : "mascot-r")
            .resizable().interpolation(.high).scaledToFit()
            .accessibilityHidden(true)
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
        return WidgetCast.peekAsset(WidgetCast.peekPose(played: word.played, total: modes.count, streak: streak, day: day), day: day)
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
    let left = Text(resetLabel(date)).foregroundColor(WInk.number(dark)) + Text(" LEFT").foregroundColor(muted)
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

// MARK: - Small: the ring (hero) + the W, then the flame streak and the reset time

struct SmallView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        GeometryReader { g in
            let ring = min(g.size.width * 0.64, g.size.height - 44)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 0) {
                    DailyRing(modes: snap.modes, dark: dark)
                        .frame(width: ring, height: ring)
                    Spacer(minLength: 2)
                    // BI13b: the day's cast member in the mascot corner (sleepy R before the
                    // first daily, a cheer on a sweep, S with a trophy on a milestone).
                    CastPeek(asset: snap.peekAsset(at: date))
                        .frame(width: min(46, g.size.width - ring - 2), height: min(46, g.size.width - ring - 2))
                }
                Spacer(minLength: 4)
                HStack(spacing: 6) {
                    FlameStreak(streak: snap.streak, size: 34)
                    VStack(alignment: .leading, spacing: 3) {
                        Caps(text: "DAY STREAK", color: WInk.number(dark))
                        Caps(text: "RESETS IN \(resetLabel(date))", color: WInk.label(dark).opacity(0.75))
                    }
                }
            }
            .frame(width: g.size.width, height: g.size.height, alignment: .topLeading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(widgetPhrase(snap, date))
        // The one tap a small widget gets: straight into the next unplayed daily.
        .widgetURL(snap.nextUp.flatMap(dailyURL))
    }
}

// MARK: - Medium: ring + streak | the 4×2 daily chips; one stat line across the bottom

struct MediumView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        VStack(spacing: 8) {
            GeometryReader { g in
                let left = min(g.size.width * 0.33, 108)
                let ring = min(left, g.size.height - 36)
                HStack(spacing: 14) {
                    VStack(spacing: 4) {
                        DailyRing(modes: snap.modes, dark: dark)
                            .frame(width: ring, height: ring)
                        Spacer(minLength: 0)
                        HStack(spacing: 4) {
                            FlameStreak(streak: snap.streak, size: 34)
                            Caps(text: "DAY STREAK", color: WInk.number(dark))
                        }
                    }
                    .frame(width: left)
                    ChipGrid(modes: snap.modes, columns: 4, dark: dark, peek: (snap.peekAsset(at: date), 3))
                }
            }
            StatLine(items: statTexts(snap, date, dark, nextFirst: true), dark: dark)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(widgetPhrase(snap, date))
        .widgetURL(snap.nextUp.flatMap(dailyURL))
    }
}

// MARK: - Large: header (W + title, flame streak), ring + daily chips, the Puzzles, points

struct LargeView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        let muted = WInk.label(dark).opacity(0.75)
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                MascotW(date: date).frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 3) {
                    Caps(text: "WORDOCIOUS", color: WInk.accent(dark), tracking: 1.6)
                    Caps(text: "TODAY'S DAILIES", color: muted)
                }
                Spacer(minLength: 6)
                HStack(spacing: 4) {
                    FlameStreak(streak: snap.streak, size: 38)
                    Caps(text: "DAY STREAK", color: WInk.number(dark))
                }
            }
            Spacer(minLength: 8)
            GeometryReader { g in
                HStack(spacing: 16) {
                    DailyRing(modes: snap.modes, dark: dark)
                        .frame(width: min(g.size.height, g.size.width * 0.32), height: min(g.size.height, g.size.width * 0.32))
                    ChipGrid(modes: snap.modes, columns: 4, dark: dark)
                }
            }
            .frame(minHeight: 84, maxHeight: 108)
            if !snap.puzzleModes.isEmpty {
                Spacer(minLength: 10)
                HStack {
                    Caps(text: "PUZZLES", color: WInk.number(dark))
                    Spacer()
                    Caps(text: "\(snap.puzzleProgress.played)/\(snap.puzzleProgress.total)", color: muted)
                }
                Spacer(minLength: 6).frame(maxHeight: 8)
                ChipGrid(modes: snap.puzzleModes, columns: 5, dark: dark, peek: (snap.peekAsset(at: date), 2))
                    .frame(minHeight: 90, maxHeight: 116)
            }
            Spacer(minLength: 8)
            StatLine(items: statTexts(snap, date, dark, nextFirst: true), dark: dark)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(widgetPhrase(snap, date))
        .widgetURL(snap.nextUp.flatMap(dailyURL))
    }
}

// MARK: - Lock screen (accessoryRectangular): the headline + both rows at a glance

struct AccessoryRectangularView: View {
    let snap: WSnapshot
    let date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("WORDOCIOUS").font(.system(size: 11, weight: .black, design: .rounded))
                .widgetAccentable()
            Text(snap.headline(at: date))
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(snap.puzzleModes.isEmpty
                    ? "Word \(snap.word.played)/\(snap.word.total)"
                    : "Word \(snap.word.played)/\(snap.word.total) · Puzzles \(snap.puzzleProgress.played)/\(snap.puzzleProgress.total)")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Widget

/// BI13: the one calm background — the brand's soft lavender → white; deep purple in dark.
struct WidgetBackdrop: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        LinearGradient(colors: scheme == .dark
                       ? [Color(widgetHex: "#2a1650"), Color(widgetHex: "#1c1231")]
                       : [Color(widgetHex: "#e6dcff"), Color(widgetHex: "#f5f3ff"), Color.white],
                       startPoint: .top, endPoint: .bottom)
            .accessibilityHidden(true)
    }
}

struct WordociousDailyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WordociousDaily", provider: DailyProvider()) { entry in
            WidgetRootView(entry: entry)
                .widgetBackdrop()
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

    func body(content: Content) -> some View {
        let accessory = family == .accessoryRectangular
        if #available(iOS 17.0, *) {
            // The system content margins pad the views; lock-screen accessories tint
            // themselves, so they get no background.
            content.containerBackground(for: .widget) {
                if accessory { Color.clear } else { WidgetBackdrop() }
            }
        } else if accessory {
            content
        } else {
            // iOS 16 has no content margins: the same 16 pt by hand.
            content.padding(16).background(WidgetBackdrop())
        }
    }
}

extension View {
    func widgetBackdrop() -> some View { modifier(BackdropModifier()) }
}

@main
struct WordociousWidgetBundle: WidgetBundle {
    var body: some Widget {
        WordociousDailyWidget()
    }
}
