import WidgetKit
import SwiftUI

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
// The cast (ART_SPEC §17): the background is the home page tint (no tiles at widget
// sizes) with the Sweep / Flawless tier colors blended over it, the day's host
// (the Leaderboard day title's character) stands in a corner, the 3D flame sits by
// the streak, and a played chip shows the W / L badge art. The images come from the
// app's asset catalog, compiled into this target (project.yml).

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
private let placeholderModes: [(title: String, glyph: String, hex: String, kind: String, asset: String?, text: String?)] = [
    ("Classic", "C", "#7c3aed", "original", "wordle-grid", nil),
    ("Quad", "IV", "#ec4899", "roman", nil, "IV"),
    ("Octo", "VIII", "#7e22ce", "roman", nil, "VIII"),
    ("Succ.", "S", "#2563eb", "asset", "trending-up", nil),
    ("Deliv.", "D", "#059669", "asset", "shield", nil),
    ("Six", "6", "#06b6d4", "hand", "six-hand", "6"),
    ("Seven", "7", "#84cc16", "hand", "seven-hand", "7"),
    ("Gauntlet", "G", "#d97706", "asset", "skull", nil),
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
              modes: placeholderModes.map { .init(key: $0.glyph, title: $0.title, glyph: $0.glyph, colorHex: $0.hex,
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

/// ART_SPEC §11's home tint (light stops), top-left → bottom-right.
private let homeTint = LinearGradient(colors: [Color(widgetHex: "#f3eeff"), Color(widgetHex: "#fbefff"), Color(widgetHex: "#fff1f7")],
                                      startPoint: .topLeading, endPoint: .bottomTrailing)

/// The day's host: the character on that weekday's Leaderboard title art
/// (art-day-*: Mon D, Tue I, Wed U, Thu S, Fri O2, Sat O1, Sun O3).
private func dayHostAsset(_ date: Date) -> String {
    let hosts = ["o3", "d", "i", "u", "s", "o2", "o1"] // Calendar weekday 1 = Sunday
    let i = Calendar.current.component(.weekday, from: date) - 1
    return "mascot-\(hosts[max(0, min(hosts.count - 1, i))])"
}

/// The day's host mascot, decorative.
private struct DayHost: View {
    let date: Date
    let size: CGFloat
    var body: some View {
        Image(dayHostAsset(date)).resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

private let brandGradient = LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                           startPoint: .leading, endPoint: .trailing)
private let lostGray = Color(widgetHex: "#9ca3af")

/// The banner's tier palette (spec §2), with the widget's lighter "none" tints
/// from the approved widget mock (board V).
private func tierColor(_ t: BannerTier, none: String) -> Color {
    switch t {
    case .none: return Color(widgetHex: none)
    case .sweep: return Color(widgetHex: "#ebd6fd")
    case .flawless: return Color(widgetHex: "#fde68a")
    }
}

private func tierInk(_ t: BannerTier) -> Color {
    switch t {
    case .none: return Color(widgetHex: "#6d28d9")
    case .sweep: return Color(widgetHex: "#7e22ce")
    case .flawless: return Color(widgetHex: "#92400e")
    }
}

/// A row's tag at the end of its chips: "3/8" mid-day, then SWEEP or FLAWLESS.
private func rowTag(_ g: GroupProgress) -> String {
    switch HomeBanner.groupTier(g) {
    case .none: return "\(g.played)/\(g.total)"
    case .sweep: return "SWEEP"
    case .flawless: return "FLAWLESS"
    }
}

private func isDoubleFlawless(_ snap: WSnapshot) -> Bool {
    HomeBanner.groupTier(snap.word) == .flawless && HomeBanner.groupTier(snap.puzzleProgress) == .flawless
}

private func groupedPoints(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

private struct StreakBadge: View {
    let streak: Int
    var body: some View {
        HStack(spacing: 3) {
            // The 3D streak buddy from the app's icon set (HEADER_SPEC §2).
            Image("icon3d-flame").resizable().interpolation(.high).scaledToFit()
                .frame(width: 16, height: 16)
            Text("\(streak)").font(.system(size: 14, weight: .black, design: .rounded))
                .foregroundStyle(.primary)
        }
        .accessibilityLabel("\(streak) day streak")
    }
}

/// The frosted strip across the top (white 50% over the blend), edge to edge.
private struct FrostedStrip<Content: View>: View {
    var top: CGFloat = 10
    @ViewBuilder let content: () -> Content
    var body: some View {
        HStack(spacing: 6, content: content)
            .padding(.horizontal, 12).padding(.top, top).padding(.bottom, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
            // FINISH_SPEC §A1: a lavender frost instead of plain white.
            .background(Color(widgetHex: "#F5EEFF").opacity(0.6))
    }
}

/// The home-menu icon, rendered from the snapshot's flattened ModeIconKind —
/// a self-contained copy of ModeIconView's glyph logic (the widget links no
/// app code). Falls back to the text glyph when icon fields are absent.
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

/// One mode chip. Won: solid accent + white check; lost: gray + white X.
/// Unplayed: a "door" — white tile, dashed accent border, the mode's own
/// home-menu icon — signalling it's a tap target that opens that puzzle.
private struct ModeCell: View {
    let mode: WSnapshot.Mode
    var size: CGFloat = 28

    var body: some View {
        let accent = Color(widgetHex: mode.colorHex)
        let shape = RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
        ZStack {
            if mode.played {
                // Today's result as the W / L badge art (ART_SPEC §17) on the chip's color.
                shape.fill(mode.won ? accent : lostGray)
                Image(mode.won ? "icon3d-badge-w" : "icon3d-badge-l")
                    .resizable().interpolation(.high).scaledToFit()
                    .frame(width: size * 0.78, height: size * 0.78)
            } else {
                // FINISH_SPEC §A1: a soft wash of the game's accent, not plain white.
                shape.fill(Color.white.opacity(0.72))
                shape.fill(accent.opacity(0.14))
                shape.strokeBorder(accent.opacity(0.55), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5]))
                ModeGlyph(mode: mode, accent: accent, box: size)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(mode.title), \(mode.played ? (mode.won ? "solved" : "played") : "not played, tap to play")")
    }
}

/// The footer strip: wordmark · "N/18 · points" · live countdown. The countdown
/// is WidgetKit timer text — it ticks every second natively, costing none of the
/// widget's refresh budget.
private struct FooterStrip: View {
    let snap: WSnapshot
    let date: Date

    private var statText: String { "\(snap.done)/\(snap.total) · \(groupedPoints(snap.points ?? 0)) pts" }

    var body: some View {
        HStack(spacing: 6) {
            Text("WORDOCIOUS").font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(1.1).foregroundStyle(brandGradient)
                .lineLimit(1).layoutPriority(1)
            Spacer(minLength: 4)
            Text(statText)
                .font(.system(size: 10.5, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color(widgetHex: "#374151"))
                .lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 4)
            // WidgetKit's live timer text GREEDILY claims all flexible width (found
            // on device: it shoved the stat text out entirely). Cap it to exactly
            // what "12:41:40" needs; trailing-aligned as it shrinks overnight.
            Text(timerInterval: date...nextLocalMidnight(after: date), countsDown: true)
                .font(.system(size: 10.5, weight: .black, design: .rounded))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 58, alignment: .trailing)
                .foregroundStyle(Color(widgetHex: "#7c3aed"))
                .layoutPriority(1)
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(RoundedRectangle(cornerRadius: 9).fill(Color(widgetHex: "#F5EEFF").opacity(0.7)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wordocious. \(statText). New puzzles at midnight.")
    }
}

private func dailyURL(_ m: WSnapshot.Mode) -> URL? { URL(string: "wordocious://daily/\(m.key)") }

// MARK: - Small: frosted header, big N/18, headline, two dot rows, countdown

struct SmallView: View {
    let snap: WSnapshot
    let date: Date

    /// The one tap a small widget is allowed, spent well: straight into the
    /// first unplayed daily (Wordocious first, then Puzzles); all done → plain app open.
    private var nextPlayableURL: URL? {
        (snap.modes + snap.puzzleModes).first(where: { !$0.played }).flatMap(dailyURL)
    }

    var body: some View {
        let headInk = isDoubleFlawless(snap) ? Color(widgetHex: "#78350f") : Color(widgetHex: "#4c1d95")
        VStack(alignment: .leading, spacing: 0) {
            FrostedStrip {
                Text("WORDOCIOUS").font(.system(size: 11, weight: .black, design: .rounded))
                    .tracking(1).foregroundStyle(brandGradient)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 2)
                StreakBadge(streak: snap.streak)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center, spacing: 0) {
                    HStack(alignment: .lastTextBaseline, spacing: 2) {
                        Text("\(snap.done)").font(.system(size: 30, weight: .black, design: .rounded))
                            .foregroundStyle(Color(widgetHex: "#1a1a2e"))
                        Text("/\(snap.total)").font(.system(size: 15, weight: .black, design: .rounded))
                            .foregroundStyle(Color(widgetHex: "#6b7280"))
                    }
                    Spacer(minLength: 2)
                    // The day's host in the corner (ART_SPEC §17).
                    DayHost(date: date, size: 34)
                }
                Text(snap.headline(at: date))
                    .font(.system(size: 10, weight: .black, design: .rounded)).tracking(0.3)
                    .foregroundStyle(headInk)
                    .lineLimit(2).minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                dots(snap.modes)
                if !snap.puzzleModes.isEmpty { dots(snap.puzzleModes) }
                Text(timerInterval: date...nextLocalMidnight(after: date), countsDown: true)
                    .font(.system(size: 10.5, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: 58, alignment: .leading)
                    .foregroundStyle(Color(widgetHex: "#7c3aed"))
            }
            .padding(.horizontal, 12).padding(.top, 6).padding(.bottom, 10)
        }
        .widgetURL(nextPlayableURL)
    }

    private func dots(_ list: [WSnapshot.Mode]) -> some View {
        HStack(spacing: 3) {
            ForEach(list, id: \.key) { m in
                Capsule()
                    .fill(m.played ? (m.won ? Color(widgetHex: m.colorHex) : lostGray)
                                   : Color(widgetHex: m.colorHex).opacity(0.18))
                    .frame(height: 8)
            }
        }
    }
}

// MARK: - Medium: frosted headline strip, two chip rows, footer strip

struct MediumView: View {
    let snap: WSnapshot
    let date: Date

    var body: some View {
        let headInk = isDoubleFlawless(snap) ? Color(widgetHex: "#78350f") : Color(widgetHex: "#4c1d95")
        VStack(alignment: .leading, spacing: 0) {
            FrostedStrip(top: 9) {
                // The day's host at the corner (ART_SPEC §17).
                DayHost(date: date, size: 22)
                Text(snap.headline(at: date))
                    .font(.system(size: 13, weight: .black, design: .rounded)).tracking(0.3)
                    .foregroundStyle(headInk)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Spacer(minLength: 4)
                StreakBadge(streak: snap.streak)
            }
            chipRow(snap.modes, progress: snap.word, size: 28, gap: 5)
                .padding(.horizontal, 12).padding(.top, 8)
            if !snap.puzzleModes.isEmpty {
                chipRow(snap.puzzleModes, progress: snap.puzzleProgress, size: 25, gap: 3)
                    .padding(.horizontal, 12).padding(.top, 7)
            }
            Spacer(minLength: 0)
            FooterStrip(snap: snap, date: date)
                .padding(.horizontal, 10).padding(.bottom, 8)
        }
    }

    /// A row of chips + its tag. Narrow widgets shrink the chips a little rather
    /// than squeeze the tag out (the mock's sizes are the ceiling).
    private func chipRow(_ list: [WSnapshot.Mode], progress: GroupProgress, size: CGFloat, gap: CGFloat) -> some View {
        let tier = HomeBanner.groupTier(progress)
        return GeometryReader { geo in
            let n = CGFloat(max(list.count, 1))
            let fit = (geo.size.width - 44 - gap * (n - 1)) / n
            let chip = max(18, min(size, fit))
            HStack(spacing: gap) {
                ForEach(list, id: \.key) { m in
                    // Deep link: tap a chip, land in that daily as today
                    // (DeepLink.swift handles wordocious://daily/<key>).
                    if let url = dailyURL(m) {
                        Link(destination: url) { ModeCell(mode: m, size: chip) }
                    } else {
                        ModeCell(mode: m, size: chip)
                    }
                }
                Spacer(minLength: 4)
                Text(rowTag(progress))
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(tierInk(tier))
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(height: geo.size.height)
        }
        .frame(height: size)
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
    /// The home page tint (ART_SPEC §17, no tiles at widget sizes); over it, one
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
            homeTint
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
