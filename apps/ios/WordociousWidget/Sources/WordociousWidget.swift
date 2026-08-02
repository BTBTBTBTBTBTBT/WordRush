import WidgetKit
import SwiftUI

// Home-screen widget: today's daily-puzzle progress (9 mode chips) + play
// streak. Renders purely from the JSON snapshot the app writes into the
// app-group container (WidgetBridge) — no app code is linked, so the mode
// catalog stays single-sourced in the app. The app's Assets.xcassets is
// compiled into this target too (project.yml), so the chips can draw the
// SAME icons as the home menu (skull, shield, hands…), not text stand-ins.

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
}

/// Celebration tier once every daily is played — mirrors the home banner:
/// Daily Sweep (all played, purple/pink) / Flawless Victory (all won, amber).
enum CelebrationTier {
    case none, sweep, flawless

    static func from(_ snap: WSnapshot) -> CelebrationTier {
        guard !snap.modes.isEmpty, snap.modes.allSatisfy(\.played) else { return .none }
        return snap.modes.allSatisfy(\.won) ? .flawless : .sweep
    }
}

/// Fallback roster so the widget shows the real mode grid before the app has
/// ever written a snapshot (fresh install / not signed in). Icon specs match
/// ModeCatalog.swift's homeModes.
private let placeholderModes: [(title: String, glyph: String, hex: String, kind: String, asset: String?, text: String?)] = [
    ("Classic", "C", "#7c3aed", "original", "wordle-grid", nil),
    ("Quad", "IV", "#ec4899", "roman", nil, "IV"),
    ("Octo", "VIII", "#7e22ce", "roman", nil, "VIII"),
    ("Succ.", "S", "#2563eb", "asset", "trending-up", nil),
    ("Deliv.", "D", "#059669", "asset", "shield", nil),
    ("Six", "6", "#06b6d4", "hand", "six-hand", "6"),
    ("Seven", "7", "#84cc16", "hand", "seven-hand", "7"),
    ("Gauntlet", "G", "#d97706", "asset", "skull", nil),
    ("Proper", "P", "#dc2626", "asset", "crown", nil),
]

private func emptySnapshot() -> WSnapshot {
    WSnapshot(day: localDay(), streak: 0,
              modes: placeholderModes.map { .init(key: $0.glyph, title: $0.title, glyph: $0.glyph, colorHex: $0.hex,
                                                  played: false, won: false,
                                                  iconKind: $0.kind, iconAsset: $0.asset, iconText: $0.text) })
}

private func localDay(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

/// Read the app-written snapshot; a snapshot from a previous day keeps the
/// streak but resets every mode to unplayed (new puzzles dropped at midnight).
private func loadSnapshot(for date: Date = Date()) -> WSnapshot {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: snapshotKey),
          let snap = try? JSONDecoder().decode(WSnapshot.self, from: data) else { return emptySnapshot() }
    if snap.day == localDay(date) { return snap }
    return WSnapshot(day: localDay(date), streak: snap.streak,
                     modes: snap.modes.map { .init(key: $0.key, title: $0.title, glyph: $0.glyph, colorHex: $0.colorHex,
                                                   played: false, won: false,
                                                   iconKind: $0.iconKind, iconAsset: $0.iconAsset, iconText: $0.iconText) })
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
        // One entry now, one at midnight (grid resets to unplayed); the app
        // pushes reloads on every completion, so no mid-day polling needed.
        let midnight = nextLocalMidnight()
        let entries = [DailyEntry(date: Date(), snap: loadSnapshot()),
                       DailyEntry(date: midnight, snap: loadSnapshot(for: midnight.addingTimeInterval(1)))]
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

private let brandGradient = LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                           startPoint: .leading, endPoint: .trailing)
// Home banner palettes (HomeView.banner): Sweep purple/pink, Flawless amber.
private let sweepTitleGradient = LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                                startPoint: .topLeading, endPoint: .bottomTrailing)
private let flawlessTitleGradient = LinearGradient(colors: [Color(widgetHex: "#d97706"), Color(widgetHex: "#b45309")],
                                                   startPoint: .topLeading, endPoint: .bottomTrailing)

private struct StreakBadge: View {
    let streak: Int
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "flame.fill").font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(widgetHex: "#f59e0b"))
            Text("\(streak)").font(.system(size: 14, weight: .black, design: .rounded))
                .foregroundStyle(.primary)
        }
        .accessibilityLabel("\(streak) day streak")
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

/// One mode chip — accent-tinted square with the home-menu icon; a check
/// replaces it once played (accent solid = won, gray = played-but-lost).
private struct ModeCell: View {
    let mode: WSnapshot.Mode
    var size: CGFloat = 30

    var body: some View {
        let accent = Color(widgetHex: mode.colorHex)
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.27)
                .fill(mode.played ? (mode.won ? accent : Color.gray.opacity(0.55)) : accent.opacity(0.12))
            if mode.played {
                Image(systemName: mode.won ? "checkmark" : "xmark")
                    .font(.system(size: size * 0.42, weight: .black))
                    .foregroundStyle(.white)
            } else {
                ModeGlyph(mode: mode, accent: accent, box: size)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(mode.title), \(mode.played ? (mode.won ? "solved" : "played") : "not played")")
    }
}

// MARK: - Small: streak + big X/9 + dot strip (banner state when swept)

struct SmallView: View {
    let snap: WSnapshot
    private var done: Int { snap.modes.filter(\.played).count }
    private var tier: CelebrationTier { CelebrationTier.from(snap) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("WORDOCIOUS").font(.system(size: 11, weight: .black, design: .rounded))
                    .tracking(1).foregroundStyle(brandGradient)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer()
                StreakBadge(streak: snap.streak)
            }
            Spacer(minLength: 0)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text("\(done)").font(.system(size: 40, weight: .black, design: .rounded))
                    .foregroundStyle(.primary)
                Text("/\(snap.modes.count)").font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            switch tier {
            case .flawless:
                HStack(spacing: 3) {
                    Image(systemName: "trophy.fill").font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color(widgetHex: "#b45309"))
                    Text("FLAWLESS VICTORY!").font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(flawlessTitleGradient)
                        .minimumScaleFactor(0.7).lineLimit(1)
                }
            case .sweep:
                HStack(spacing: 3) {
                    Image(systemName: "sparkles").font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color(widgetHex: "#7c3aed"))
                    Text("DAILY SWEEP!").font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(sweepTitleGradient)
                        .minimumScaleFactor(0.7).lineLimit(1)
                }
            case .none:
                Text("puzzles played today")
                    .font(.system(size: 11, weight: .bold, design: .rounded)).foregroundStyle(.secondary)
                    .minimumScaleFactor(0.7).lineLimit(1)
            }
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                ForEach(snap.modes, id: \.key) { m in
                    Circle()
                        .fill(m.played ? (m.won ? Color(widgetHex: m.colorHex) : Color.gray.opacity(0.55))
                                       : Color(widgetHex: m.colorHex).opacity(0.18))
                        .frame(height: 9)
                }
            }
        }
    }
}

// MARK: - Medium: header + full mode-chip grid (banner header when swept)

struct MediumView: View {
    let snap: WSnapshot
    private var done: Int { snap.modes.filter(\.played).count }
    private var tier: CelebrationTier { CelebrationTier.from(snap) }
    private let cols = [GridItem](repeating: GridItem(.flexible(), spacing: 8), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            switch tier {
            case .flawless: banner(title: "FLAWLESS VICTORY!", gradient: flawlessTitleGradient,
                                   icon: "trophy.fill", iconColor: Color(widgetHex: "#b45309"))
            case .sweep: banner(title: "DAILY SWEEP!", gradient: sweepTitleGradient,
                                icon: "sparkles", iconColor: Color(widgetHex: "#7c3aed"))
            case .none:
                HStack {
                    Text("WORDOCIOUS").font(.system(size: 14, weight: .black, design: .rounded))
                        .tracking(1.6).foregroundStyle(brandGradient)
                    Spacer()
                    Text("\(done)/\(snap.modes.count) today")
                        .font(.system(size: 12, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                    StreakBadge(streak: snap.streak)
                }
            }
            Spacer(minLength: 0)
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(snap.modes, id: \.key) { m in
                    // Deep link: tap a chip, land in that daily (DeepLink.swift
                    // handles wordocious://daily/<key>). ProperNoundle's daily
                    // has no programmatic launch path, so its chip just opens
                    // the app (no Link).
                    let cell = VStack(spacing: 2) {
                        ModeCell(mode: m, size: 38)
                        Text(m.title).font(.system(size: 9.5, weight: .bold, design: .rounded))
                            .foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    if m.key != "PROPERNOUNDLE", let url = URL(string: "wordocious://daily/\(m.key)") {
                        Link(destination: url) { cell }
                    } else {
                        cell
                    }
                }
                // 10th cell: call-to-action / celebration.
                VStack(spacing: 2) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10).fill(Color(widgetHex: "#a78bfa").opacity(0.12))
                        Image(systemName: done >= snap.modes.count ? "party.popper.fill" : "play.fill")
                            .font(.system(size: 16, weight: .black))
                            .foregroundStyle(Color(widgetHex: "#7c3aed"))
                    }
                    .frame(width: 38, height: 38)
                    Text(done >= snap.modes.count ? "Done!" : "Play")
                        .font(.system(size: 9.5, weight: .bold, design: .rounded)).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
    }

    /// Header-row banner in the home celebration's language: flanking icons +
    /// gradient title (HomeView.banner), streak kept at the trailing edge.
    private func banner(title: String, gradient: LinearGradient, icon: String, iconColor: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 13, weight: .bold)).foregroundStyle(iconColor)
            Text(title).font(.system(size: 14, weight: .black, design: .rounded))
                .foregroundStyle(gradient)
                .lineLimit(1).minimumScaleFactor(0.6)
            Image(systemName: icon).font(.system(size: 13, weight: .bold)).foregroundStyle(iconColor)
            Spacer()
            StreakBadge(streak: snap.streak)
        }
    }
}

// MARK: - Lock screen (accessoryRectangular): count + streak at a glance

struct AccessoryRectangularView: View {
    let snap: WSnapshot
    private var done: Int { snap.modes.filter(\.played).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("WORDOCIOUS").font(.system(size: 11, weight: .black, design: .rounded))
                .widgetAccentable()
            switch CelebrationTier.from(snap) {
            case .flawless: Text("Flawless victory! 9/9 won")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            case .sweep: Text("Daily sweep! \(done)/\(snap.modes.count) played")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            case .none: Text("\(done)/\(snap.modes.count) dailies played")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            }
            if snap.streak > 0 {
                Label("\(snap.streak) day streak", systemImage: "flame.fill")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Widget

struct WordociousDailyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WordociousDaily", provider: DailyProvider()) { entry in
            WidgetRootView(entry: entry)
                .containerBackgroundCompatAuto(tier: CelebrationTier.from(entry.snap))
        }
        .configurationDisplayName("Daily Puzzles")
        .description("Today's daily progress and your streak.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

struct WidgetRootView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyEntry

    var body: some View {
        switch family {
        case .systemMedium: MediumView(snap: entry.snap)
        case .accessoryRectangular: AccessoryRectangularView(snap: entry.snap)
        default: SmallView(snap: entry.snap)
        }
    }
}

private struct BGAuto: ViewModifier {
    @Environment(\.widgetFamily) private var family
    let tier: CelebrationTier
    func body(content: Content) -> some View {
        content.containerBackgroundCompat(accessory: family == .accessoryRectangular, tier: tier)
    }
}
extension View {
    func containerBackgroundCompatAuto(tier: CelebrationTier = .none) -> some View {
        modifier(BGAuto(tier: tier))
    }

    /// iOS 17 requires containerBackground; iOS 16 uses plain padding.
    /// Sweep/Flawless tint the whole widget with the home banner's gradient.
    /// (containerBackground's builder wants a VIEW — LinearGradient/Color both
    /// are; AnyShapeStyle is not, which is why this isn't a ShapeStyle.)
    @ViewBuilder
    func containerBackgroundCompat(accessory: Bool = false, tier: CelebrationTier = .none) -> some View {
        let bg: AnyView = {
            switch tier {
            case .flawless:
                return AnyView(LinearGradient(colors: [Color(widgetHex: "#fef3c7"), Color(widgetHex: "#fde68a")],
                                              startPoint: .topLeading, endPoint: .bottomTrailing))
            case .sweep:
                return AnyView(LinearGradient(colors: [Color(widgetHex: "#f5f3ff"), Color(widgetHex: "#fce7f3")],
                                              startPoint: .topLeading, endPoint: .bottomTrailing))
            case .none:
                return AnyView(Color(widgetHex: "#f8f7ff"))
            }
        }()
        if #available(iOS 17.0, *) {
            // Lock-screen accessories tint themselves; a solid brand background
            // would render as an opaque slab there. Home-screen widgets get the
            // brand frame: a soft inner halo + a crisp violet→pink gradient
            // stroke on the widget's own corner shape — drawn in the background
            // (not an overlay) so it reaches the true edge past content margins.
            containerBackground(for: .widget) {
                if accessory { AnyView(Color.clear) } else { AnyView(ZStack {
                    bg
                    ContainerRelativeShape()
                        .strokeBorder(Color(widgetHex: "#8B5CF6").opacity(0.10), lineWidth: 7)
                    ContainerRelativeShape()
                        .strokeBorder(
                            LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                           startPoint: .topLeading, endPoint: .bottomTrailing),
                            lineWidth: 2.5)
                }) }
            }
        } else {
            if accessory { self } else { padding(12).background(bg) }
        }
    }
}

@main
struct WordociousWidgetBundle: WidgetBundle {
    var body: some Widget {
        WordociousDailyWidget()
    }
}
