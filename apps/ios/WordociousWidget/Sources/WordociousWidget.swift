import WidgetKit
import SwiftUI
import UIKit

// Home-screen widget: today's dailies — the eight Wordocious games and the ten
// Puzzles — plus the play streak. Renders purely from the JSON snapshot the app
// writes into the app-group container (WidgetBridge) — no app code is linked,
// so the mode catalog stays single-sourced in the app. The app's Assets.xcassets
// is compiled into this target too (project.yml), so the chips draw the SAME
// icons as the home menu (skull, shield, hands…), not text stand-ins.
//
// v3 (home redesign, founder-approved 2026-10-01; spec §5, mock board V): the
// widget mirrors the home banner. One window, two colors: the background blends
// the Wordocious row's tier color (top) into the Puzzles row's (bottom), with
// the banner's headline in a frosted strip. Double Flawless turns the frame
// gold. HomeBanner.swift (the shared banner rules) is compiled into this target
// too (project.yml), so the widget's words can never drift from the app's. The
// old fresh / at-risk / sweep / flawless themes are gone; after 8 pm the headline
// simply stays the evening greeting. No animation: widgets can't run the shimmer.
//
// FINISH_SPEC §E2 (finishing-touches `.wsmall` / `.wmed`): a lilac wallpaper (the
// Home wallpaper's colors + the letter-tile art; the art-wall-* images live in the
// app-only Wallpapers catalog) with the Sweep / Flawless tier colors blended over
// it; today's games as mini game-card tiles (the 3D game-<id> icon on a 13% accent
// wash, 34% border, 4-pt accent top bar, radius 9) with a small purple ✓ badge on a
// solved one (slate ✕ on a missed one); the streak (and rank, once the app writes
// it; shields until then) as soft numbers beside 3D icons. Small: flame + streak on
// top, the eight tiles, "5 of 8 today". Medium: the ten cast heroes across the top
// (WORDOCIOUS), the eight tiles + the Puzzles row, the streak / rank column, and
// "Next: Gauntlet · resets in 13:41". The extension has no Nunito, so the soft
// numbers are SF Rounded Black in #3b1a78. Dark appearance: a deep plum wallpaper,
// dark tiles and light lilac numbers. Every image falls back (glyph / gradient).

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
        // Entries where the LOOK can change without new data: now, noon and 5 pm
        // (the greeting turns afternoon / evening), and midnight (every chip resets).
        // The app pushes reloads on every completion, so no data polling is needed.
        let now = Date()
        let snap = loadSnapshot()
        var dates: [Date] = [now]
        let cal = Calendar.current
        for hour in [12, 17] {
            if let d = cal.date(bySettingHour: hour, minute: 0, second: 0, of: now), d > now {
                dates.append(d)
            }
        }
        let midnight = nextLocalMidnight(after: now)
        var entries = dates.map { DailyEntry(date: $0, snap: snap) }
        entries.append(DailyEntry(date: midnight, snap: loadSnapshot(for: midnight.addingTimeInterval(1))))
        completion(Timeline(entries: entries, policy: .after(midnight)))
    }
}

// MARK: - Shared bits

extension Color {
    init(widgetHex hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255,
                  green: Double((v >> 8) & 0xFF) / 255,
                  blue: Double(v & 0xFF) / 255)
    }
}

/// A hex color (`#rrggbb`) at `amount` over `base` — CSS color-mix, opaque.
private func mixHex(_ hex: String, _ amount: Double, over base: (Double, Double, Double) = (1, 1, 1)) -> Color {
    var s = hex.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    var v: UInt64 = 0
    Scanner(string: s).scanHexInt64(&v)
    let r = Double((v >> 16) & 0xFF) / 255, g = Double((v >> 8) & 0xFF) / 255, b = Double(v & 0xFF) / 255
    let k = min(1, max(0, amount))
    return Color(red: base.0 + (r - base.0) * k, green: base.1 + (g - base.1) * k, blue: base.2 + (b - base.2) * k)
}

/// The soft-number ink (§A2) and the label inks, per appearance.
private enum WInk {
    static func number(_ dark: Bool) -> Color { dark ? Color(widgetHex: "#e9ddff") : Color(widgetHex: "#3b1a78") }
    static func label(_ dark: Bool) -> Color { dark ? Color(widgetHex: "#cdb8ff") : Color(widgetHex: "#5b3c96") }
    static let check = Color(widgetHex: "#7c3aed")
    static let missed = Color(widgetHex: "#6b7891")
}

/// §E2 wallpaper: the Home wallpaper's lilac → pink with the letter-tile art
/// (art-bg-tiles, transparent) floating over it; dark: a deep plum.
private struct WidgetWallpaper: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        ZStack {
            LinearGradient(colors: dark
                           ? [Color(widgetHex: "#1c1231"), Color(widgetHex: "#211433"), Color(widgetHex: "#26122c")]
                           : [Color(widgetHex: "#c9b8f6"), Color(widgetHex: "#e6d6f8"), Color(widgetHex: "#fbe2f1")],
                           startPoint: .top, endPoint: .bottom)
            if UIImage(named: "art-bg-tiles") != nil {
                Image("art-bg-tiles").resizable().interpolation(.high).scaledToFill()
                    .opacity(dark ? 0.18 : 0.75)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Soft number (§A2): SF Rounded Black (the extension has no Nunito), dark purple,
/// tabular digits, a soft white under-shadow (dark: light lilac, no glow).
private struct SoftNumber: View {
    let text: String
    let size: CGFloat
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        Text(text)
            .font(.system(size: size, weight: .black, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(WInk.number(dark))
            .shadow(color: dark ? .black.opacity(0.35) : .white.opacity(0.85), radius: 0, x: 0, y: 1)
            .lineLimit(1).minimumScaleFactor(0.6)
    }
}

/// A 3D icon (`icon3d-*`) beside its soft number.
private struct IconNumber: View {
    let icon: String
    let text: String
    var iconSize: CGFloat = 22
    var size: CGFloat = 20

    var body: some View {
        HStack(spacing: 4) {
            if UIImage(named: icon) != nil {
                Image(icon).resizable().interpolation(.high).scaledToFit()
                    .frame(width: iconSize, height: iconSize)
                    .accessibilityHidden(true)
            }
            SoftNumber(text: text, size: size)
        }
    }
}

/// FINISH_SPEC §AL addendum 2: a code-drawn soft gold clock face (until
/// art-badge-icon-clock-sprite ships; used automatically when it does).
private struct ClockGlyph: View {
    var size: CGFloat = 16
    var body: some View {
        if UIImage(named: "art-badge-icon-clock-sprite") != nil {
            Image("art-badge-icon-clock-sprite").resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
        } else {
            ZStack {
                Circle().fill(LinearGradient(colors: [Color(widgetHex: "#ffe08a"), Color(widgetHex: "#f5a524")],
                                             startPoint: .top, endPoint: .bottom))
                Circle().strokeBorder(Color(widgetHex: "#b0650b"), lineWidth: max(1, size * 0.08))
                Circle().fill(Color.white.opacity(0.9)).padding(size * 0.2)
                Path { p in
                    let c = CGPoint(x: size / 2, y: size / 2)
                    p.move(to: c); p.addLine(to: CGPoint(x: c.x, y: size * 0.3))
                    p.move(to: c); p.addLine(to: CGPoint(x: size * 0.66, y: c.y))
                }
                .stroke(Color(widgetHex: "#3b1a78"), style: StrokeStyle(lineWidth: max(1, size * 0.09), lineCap: .round))
            }
            .frame(width: size, height: size)
        }
    }
}

/// The stat's icon: our 3D art only (no system emoji — §AL addendum 2).
private enum StatIcon { case flame, check, star, clock }

private struct StatIconView: View {
    let icon: StatIcon
    var size: CGFloat = 16
    var body: some View {
        Group {
            switch icon {
            case .flame: art("icon3d-flame")
            case .check: art("icon3d-badge-check")
            case .star: art("art-badge-icon-star-sprite")
            case .clock: ClockGlyph(size: size)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    @ViewBuilder private func art(_ name: String) -> some View {
        if UIImage(named: name) != nil {
            Image(name).resizable().interpolation(.high).scaledToFit()
        } else {
            Circle().fill(Color(widgetHex: "#f5a524"))
        }
    }
}

/// FINISH_SPEC §AL: a labeled stat chip — the 3D icon, the soft number and a small
/// caps word (beside it, or under it when `stacked`), on a tinted pill. VoiceOver
/// reads `phrase`.
private struct StatChip<Value: View>: View {
    let icon: StatIcon
    let label: String
    let tint: String
    let phrase: String
    var stacked = false
    @ViewBuilder var value: () -> Value
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        let c = Color(widgetHex: tint)
        Group {
            if stacked {
                VStack(spacing: 0) {
                    HStack(spacing: 3) { StatIconView(icon: icon, size: 13); value() }
                    labelText(dark)
                }
            } else {
                HStack(spacing: 4) { StatIconView(icon: icon, size: 15); value(); labelText(dark) }
            }
        }
        .lineLimit(1).minimumScaleFactor(0.6)
        .padding(.horizontal, 6).padding(.vertical, 3)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 9, style: .continuous)
            .fill(dark ? c.opacity(0.22) : c.opacity(0.14)))
        .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous)
            .strokeBorder(c.opacity(dark ? 0.45 : 0.32), lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(phrase)
    }

    private func labelText(_ dark: Bool) -> some View {
        Text(label).font(.system(size: 8.5, weight: .black, design: .rounded)).tracking(0.6)
            .foregroundStyle(WInk.label(dark))
    }
}

extension WSnapshot {
    /// §AL: the stats to draw at `date` (a snapshot from another day reads 0/N, 0 points).
    func dayStats(at date: Date) -> WidgetDayStats {
        WidgetStats.forDay(snapshotDay: day, today: localDay(date), played: done, total: total, points: points)
    }
}

/// The day's host: the character on that weekday's Leaderboard title art
/// (art-day-*: Mon D, Tue I, Wed U, Thu S, Fri O2, Sat O1, Sun O3).
private func dayHostAsset(_ date: Date) -> String {
    let hosts = ["o3", "d", "i", "u", "s", "o2", "o1"] // Calendar weekday 1 = Sunday
    let i = Calendar.current.component(.weekday, from: date) - 1
    return "mascot-\(hosts[max(0, min(hosts.count - 1, i))])"
}

/// The banner's tier palette (spec §2), with the widget's lighter "none" tints
/// from the approved widget mock (board V).
private func tierColor(_ t: BannerTier, none: String) -> Color {
    switch t {
    case .none: return Color(widgetHex: none)
    case .sweep: return Color(widgetHex: "#ebd6fd")
    case .flawless: return Color(widgetHex: "#fde68a")
    }
}

private func isDoubleFlawless(_ snap: WSnapshot) -> Bool {
    HomeBanner.groupTier(snap.word) == .flawless && HomeBanner.groupTier(snap.puzzleProgress) == .flawless
}

/// The 3D game icon for a daily (`game-<catalog id>`; the catalog ids are the DB
/// keys lowercased except Classic / Six / Seven).
private func gameIconAsset(_ key: String) -> String? {
    let ids = ["DUEL": "practice", "DUEL_6": "six", "DUEL_7": "seven"]
    let name = "game-\(ids[key] ?? key.lowercased())"
    return UIImage(named: name) != nil ? name : nil
}

/// The home-menu icon, rendered from the snapshot's flattened ModeIconKind —
/// a self-contained copy of ModeIconView's glyph logic (the widget links no
/// app code). The fallback when a game's 3D icon is missing.
private struct ModeGlyph: View {
    let mode: WSnapshot.Mode
    let accent: Color
    let box: CGFloat

    var body: some View {
        switch mode.iconKind {
        case "asset":
            if let name = mode.iconAsset {
                Image(name).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: box * 0.52, height: box * 0.52).foregroundStyle(accent)
            } else { textGlyph(mode.glyph) }
        case "original":
            if let name = mode.iconAsset {
                Image(name).resizable().scaledToFit()
                    .frame(width: box * 0.52, height: box * 0.57)
            } else { textGlyph(mode.glyph) }
        case "roman":
            textGlyph(mode.iconText ?? mode.glyph)
        case "hand":
            if let name = mode.iconAsset {
                ZStack(alignment: .center) {
                    Image(name).resizable().scaledToFit()
                        .frame(width: box * 0.62, height: box * 0.64)
                    Text(mode.iconText ?? mode.glyph)
                        .font(.system(size: box * 0.3, weight: .black, design: .rounded))
                        .foregroundStyle(accent)
                        .offset(y: box * 0.12)
                }
            } else { textGlyph(mode.glyph) }
        case "symbol":
            // An SF Symbol (the Puzzles titles), tinted like the home menu's.
            if let name = mode.iconAsset {
                Image(systemName: name).font(.system(size: box * 0.45, weight: .bold)).foregroundStyle(accent)
            } else { textGlyph(mode.glyph) }
        default:
            textGlyph(mode.glyph)
        }
    }

    private func textGlyph(_ t: String) -> some View {
        Text(t)
            .font(.system(size: t.count > 2 ? box * 0.32 : box * 0.42, weight: .black, design: .rounded))
            .minimumScaleFactor(0.5).lineLimit(1)
            .foregroundStyle(accent)
    }
}

/// §E2 one game as a mini game card: the 3D icon on a 13% accent wash, a 34%
/// border, a 4-pt accent top bar (inset), radius 9, a soft accent shadow; a solved
/// game wears a small purple ✓ badge (a missed one a slate ✕).
private struct GameTile: View {
    let mode: WSnapshot.Mode
    var size: CGFloat = 30
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        let accent = Color(widgetHex: mode.colorHex)
        let radius = max(6, size * 0.28)
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let bar = max(2.5, size * 0.12)
        ZStack {
            ZStack(alignment: .top) {
                if dark {
                    shape.fill(Color(widgetHex: "#241a3a"))
                    shape.fill(accent.opacity(0.24))
                } else {
                    shape.fill(mixHex(mode.colorHex, 0.13))
                }
                accent.frame(height: bar)
            }
            .clipShape(shape)
            shape.strokeBorder(dark ? accent.opacity(0.5) : mixHex(mode.colorHex, 0.34), lineWidth: 1.5)
            Group {
                if let icon = gameIconAsset(mode.key) {
                    Image(icon).resizable().interpolation(.high).scaledToFit()
                        .frame(width: size * 0.74, height: size * 0.74)
                } else {
                    ModeGlyph(mode: mode, accent: accent, box: size)
                }
            }
            .padding(.top, bar * 0.6)
        }
        .frame(width: size, height: size)
        .shadow(color: accent.opacity(dark ? 0 : 0.2), radius: 3, x: 0, y: 2)
        .overlay(alignment: .topTrailing) {
            if mode.played {
                let badge = max(11, min(14, size * 0.44))
                Text(mode.won ? "✓" : "✕")
                    .font(.system(size: badge * 0.66, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: badge, height: badge)
                    .background(RoundedRectangle(cornerRadius: badge * 0.36, style: .continuous)
                        .fill(mode.won ? WInk.check : WInk.missed))
                    .offset(x: 3, y: -3)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(mode.title), \(mode.played ? (mode.won ? "solved" : "played") : "not played, tap to play")")
    }
}

private func dailyURL(_ m: WSnapshot.Mode) -> URL? { URL(string: "wordocious://daily/\(m.key)") }

/// A tile that deep-links into its daily (DeepLink.swift handles wordocious://daily/<key>).
private struct LinkedTile: View {
    let mode: WSnapshot.Mode
    let size: CGFloat
    var body: some View {
        if let url = dailyURL(mode) {
            Link(destination: url) { GameTile(mode: mode, size: size) }
        } else {
            GameTile(mode: mode, size: size)
        }
    }
}

/// A row of tiles that shrink to fit the offered width (the mock's size is the ceiling).
private struct TileRow: View {
    let list: [WSnapshot.Mode]
    var maxSize: CGFloat
    var gap: CGFloat = 4
    var linked = true

    var body: some View {
        GeometryReader { geo in
            let n = CGFloat(max(list.count, 1))
            let tile = max(14, min(maxSize, (geo.size.width - gap * (n - 1) - 3) / n))
            HStack(spacing: gap) {
                ForEach(list, id: \.key) { m in
                    if linked { LinkedTile(mode: m, size: tile) } else { GameTile(mode: m, size: tile) }
                }
                Spacer(minLength: 0)
            }
            .frame(height: geo.size.height, alignment: .bottom)
        }
        .frame(height: maxSize + 3)
    }
}

// MARK: - Small: flame + streak, the eight tiles, "5 of 8 today"

struct SmallView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    /// The one tap a small widget is allowed, spent well: straight into the
    /// first unplayed daily (Wordocious first, then Puzzles); all done → plain app open.
    private var nextPlayableURL: URL? {
        (snap.modes + snap.puzzleModes).first(where: { !$0.played }).flatMap(dailyURL)
    }

    var body: some View {
        let stats = snap.dayStats(at: date)
        let midnight = nextLocalMidnight(after: date)
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                StatChip(icon: .flame, label: "DAY STREAK", tint: "#f97316",
                         phrase: "\(snap.streak) day streak", stacked: true) {
                    SoftNumber(text: "\(snap.streak)", size: 16)
                }
                .frame(maxWidth: 74)
                Spacer(minLength: 2)
                // The day's host in the corner (ART_SPEC §17).
                Image(dayHostAsset(date)).resizable().interpolation(.high).scaledToFit()
                    .frame(width: 28, height: 28)
                    .accessibilityHidden(true)
            }
            Spacer(minLength: 0)
            // §AL: the tile mini-grid shrinks to one row so the three stats always fit.
            TileRow(list: snap.modes, maxSize: 17, gap: 2, linked: false)
            if !snap.puzzleModes.isEmpty { dots(snap.puzzleModes) }
            Spacer(minLength: 0)
            // §AL addendum: two stat chips, then the full-width countdown chip.
            HStack(spacing: 4) {
                StatChip(icon: .check, label: "SOLVED", tint: "#7c3aed", phrase: WidgetStats.solvedPhrase(stats), stacked: true) {
                    SoftNumber(text: WidgetStats.solvedText(stats), size: 14)
                }
                StatChip(icon: .star, label: "PTS", tint: "#f5a524", phrase: WidgetStats.pointsPhrase(stats), stacked: true) {
                    SoftNumber(text: WidgetStats.pointsText(stats.points), size: 14)
                }
            }
            StatChip(icon: .clock, label: "NEW IN", tint: "#2563eb",
                     phrase: WidgetStats.countdownPhrase(seconds: Int(midnight.timeIntervalSince(date)))) {
                Text(timerInterval: date...midnight, countsDown: true)
                    .font(.system(size: 13, weight: .black, design: .rounded)).monospacedDigit()
                    .foregroundStyle(WInk.number(scheme == .dark))
                    .frame(maxWidth: 58)
            }
        }
        .padding(10)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(snap.headline(at: date)). \(WidgetStats.solvedPhrase(stats)). \(WidgetStats.pointsPhrase(stats)).")
        .widgetURL(nextPlayableURL)
    }

    /// The Puzzles row as a thin strip of accent dots (played = solid).
    private func dots(_ list: [WSnapshot.Mode]) -> some View {
        HStack(spacing: 3) {
            ForEach(list, id: \.key) { m in
                Capsule()
                    .fill(m.played ? (m.won ? Color(widgetHex: m.colorHex) : WInk.missed)
                                   : Color(widgetHex: m.colorHex).opacity(0.22))
                    .frame(height: 6)
            }
        }
        .accessibilityLabel("Puzzles \(snap.puzzleProgress.played) of \(snap.puzzleProgress.total)")
    }
}

// MARK: - Medium: the cast across the top, tiles + streak / rank, the next game

struct MediumView: View {
    let snap: WSnapshot
    let date: Date
    @Environment(\.colorScheme) private var scheme

    /// The first unplayed daily (Wordocious first, then Puzzles).
    private var next: WSnapshot.Mode? { (snap.modes + snap.puzzleModes).first(where: { !$0.played }) }

    var body: some View {
        let dark = scheme == .dark
        VStack(alignment: .leading, spacing: 6) {
            // The ten cast heroes spelling WORDOCIOUS (`.wcast`).
            HStack(spacing: 2) {
                ForEach(["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"], id: \.self) { id in
                    Image("mascot-\(id)").resizable().interpolation(.high).scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: 26)
                }
            }
            .frame(height: 26)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                TileRow(list: snap.modes, maxSize: 26)
                if !snap.puzzleModes.isEmpty {
                    TileRow(list: snap.puzzleModes, maxSize: 20, gap: 3)
                }
            }
            Spacer(minLength: 0)
            // §AL addendum: a row of four labeled chips — streak, solved, points, countdown.
            let stats = snap.dayStats(at: date)
            let midnight = nextLocalMidnight(after: date)
            HStack(spacing: 4) {
                StatChip(icon: .flame, label: "DAY STREAK", tint: "#f97316", phrase: "\(snap.streak) day streak", stacked: true) {
                    SoftNumber(text: "\(snap.streak)", size: 15)
                }
                StatChip(icon: .check, label: "SOLVED", tint: "#7c3aed", phrase: WidgetStats.solvedPhrase(stats), stacked: true) {
                    SoftNumber(text: WidgetStats.solvedText(stats), size: 15)
                }
                StatChip(icon: .star, label: "POINTS", tint: "#f5a524", phrase: WidgetStats.pointsPhrase(stats), stacked: true) {
                    SoftNumber(text: WidgetStats.pointsText(stats.points), size: 15)
                }
                StatChip(icon: .clock, label: "NEW PUZZLES IN", tint: "#2563eb",
                         phrase: WidgetStats.countdownPhrase(seconds: Int(midnight.timeIntervalSince(date))), stacked: true) {
                    Text(timerInterval: date...midnight, countsDown: true)
                        .font(.system(size: 13, weight: .black, design: .rounded)).monospacedDigit()
                        .foregroundStyle(WInk.number(scheme == .dark))
                        .frame(maxWidth: 56)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
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

struct WordociousDailyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WordociousDaily", provider: DailyProvider()) { entry in
            WidgetRootView(entry: entry)
                .containerBackgroundCompatAuto(snap: entry.snap)
        }
        .configurationDisplayName("Daily Puzzles")
        .description("Today's Wordocious dailies and Puzzles, and your streak.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
        // The frosted strip runs edge to edge; the views pad themselves.
        .contentMarginsDisabled()
    }
}

struct WidgetRootView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyEntry

    var body: some View {
        switch family {
        case .systemMedium: MediumView(snap: entry.snap, date: entry.date)
        case .accessoryRectangular: AccessoryRectangularView(snap: entry.snap, date: entry.date)
        default: SmallView(snap: entry.snap, date: entry.date)
        }
    }
}

private struct BGAuto: ViewModifier {
    @Environment(\.widgetFamily) private var family
    let snap: WSnapshot
    func body(content: Content) -> some View {
        content.containerBackgroundCompat(accessory: family == .accessoryRectangular,
                                          medium: family == .systemMedium, snap: snap)
    }
}
extension View {
    func containerBackgroundCompatAuto(snap: WSnapshot) -> some View {
        modifier(BGAuto(snap: snap))
    }

    /// iOS 17 requires containerBackground; iOS 16 draws the same background.
    /// The §E2 wallpaper (WidgetWallpaper); over it, one
    /// window, two colors: a SWEEP / FLAWLESS Wordocious row's tier color (top)
    /// blends into the Puzzles row's (bottom) — a row with no tier yet shows the
    /// tint — under a white sheen, inside the brand gradient frame; gold frame +
    /// gold halo on a Double Flawless. (containerBackground's builder wants a VIEW,
    /// which is why this isn't a ShapeStyle.)
    @ViewBuilder
    func containerBackgroundCompat(accessory: Bool, medium: Bool, snap: WSnapshot) -> some View {
        let wordTier = HomeBanner.groupTier(snap.word)
        let puzzleTier = snap.puzzleModes.isEmpty ? wordTier : HomeBanner.groupTier(snap.puzzleProgress)
        // A row without a tier fades to the OTHER row's color at 0% (not `.clear`, which
        // would gray the blend's midpoint), so only a Sweep / Flawless row paints.
        let topInk = tierColor(wordTier == BannerTier.none ? puzzleTier : wordTier, none: "#f3f1ff")
        let bottomInk = tierColor(puzzleTier == BannerTier.none ? wordTier : puzzleTier, none: "#eef0ff")
        let top = topInk.opacity(wordTier == BannerTier.none ? 0 : 1)
        let bottom = bottomInk.opacity(puzzleTier == BannerTier.none ? 0 : 1)
        // Where the blend sits: under the Wordocious row → into the Puzzles row.
        let from: CGFloat = medium ? 0.40 : 0.50
        let to: CGFloat = medium ? 0.58 : 0.75
        let double = isDoubleFlawless(snap)
        let bg = ZStack {
            WidgetWallpaper()
            LinearGradient(stops: [.init(color: top, location: 0), .init(color: top, location: from),
                                   .init(color: bottom, location: to), .init(color: bottom, location: 1)],
                           startPoint: .top, endPoint: .bottom)
            LinearGradient(stops: [.init(color: .white.opacity(0.3), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        let frame = double
            ? LinearGradient(colors: [Color(widgetHex: "#fbbf24"), Color(widgetHex: "#f59e0b")], startPoint: .topLeading, endPoint: .bottomTrailing)
            : LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")], startPoint: .topLeading, endPoint: .bottomTrailing)
        // A widget can't glow past its own edge, so the gold glow is an inner halo.
        let halo = double ? Color(widgetHex: "#f59e0b").opacity(0.45) : Color(widgetHex: "#8B5CF6").opacity(0.10)
        if #available(iOS 17.0, *) {
            // Lock-screen accessories tint themselves; a solid background would
            // render as an opaque slab there. Home-screen widgets get the frame:
            // a soft inner halo + a crisp gradient stroke on the widget's own
            // corner shape — drawn in the background so it reaches the true edge.
            containerBackground(for: .widget) {
                if accessory { AnyView(Color.clear) } else { AnyView(ZStack {
                    bg
                    ContainerRelativeShape().strokeBorder(halo, lineWidth: double ? 9 : 7)
                    ContainerRelativeShape().strokeBorder(frame, lineWidth: 2.5)
                }) }
            }
        } else {
            if accessory { self } else {
                background(ZStack {
                    bg
                    ContainerRelativeShape().strokeBorder(halo, lineWidth: double ? 9 : 7)
                    ContainerRelativeShape().strokeBorder(frame, lineWidth: 2.5)
                })
            }
        }
    }
}

@main
struct WordociousWidgetBundle: WidgetBundle {
    var body: some Widget {
        WordociousDailyWidget()
    }
}
