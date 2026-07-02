import WidgetKit
import SwiftUI

// Home-screen widget: today's daily-puzzle progress (9 mode chips) + play
// streak. Renders purely from the JSON snapshot the app writes into the
// app-group container (WidgetBridge) — no app code is linked, so the mode
// catalog stays single-sourced in the app.

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
    }
    let day: String
    let streak: Int
    let modes: [Mode]
}

/// Fallback roster so the widget shows the real mode grid before the app has
/// ever written a snapshot (fresh install / not signed in).
private let placeholderModes: [(String, String, String)] = [
    ("Classic", "C", "#7c3aed"), ("Quad", "IV", "#ec4899"), ("Octo", "VIII", "#7e22ce"),
    ("Succ.", "S", "#2563eb"), ("Deliv.", "D", "#059669"), ("Six", "6", "#06b6d4"),
    ("Seven", "7", "#84cc16"), ("Gauntlet", "G", "#d97706"), ("Proper", "P", "#dc2626"),
]

private func emptySnapshot() -> WSnapshot {
    WSnapshot(day: localDay(), streak: 0,
              modes: placeholderModes.map { .init(key: $0.1, title: $0.0, glyph: $0.1, colorHex: $0.2, played: false, won: false) })
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
                     modes: snap.modes.map { .init(key: $0.key, title: $0.title, glyph: $0.glyph, colorHex: $0.colorHex, played: false, won: false) })
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

private struct StreakBadge: View {
    let streak: Int
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "flame.fill").font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color(widgetHex: "#f59e0b"))
            Text("\(streak)").font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(.primary)
        }
        .accessibilityLabel("\(streak) day streak")
    }
}

/// One mode chip — accent-tinted square with the mode glyph; a check replaces
/// the glyph once played (accent solid = won, gray = played-but-lost).
private struct ModeCell: View {
    let mode: WSnapshot.Mode
    var size: CGFloat = 24

    var body: some View {
        let accent = Color(widgetHex: mode.colorHex)
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.27)
                .fill(mode.played ? (mode.won ? accent : Color.gray.opacity(0.55)) : accent.opacity(0.14))
            if mode.played {
                Image(systemName: mode.won ? "checkmark" : "xmark")
                    .font(.system(size: size * 0.42, weight: .black))
                    .foregroundStyle(.white)
            } else {
                Text(mode.glyph)
                    .font(.system(size: mode.glyph.count > 2 ? size * 0.3 : size * 0.42, weight: .black, design: .rounded))
                    .minimumScaleFactor(0.5).lineLimit(1)
                    .foregroundStyle(accent)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(mode.title), \(mode.played ? (mode.won ? "solved" : "played") : "not played")")
    }
}

// MARK: - Small: streak + big X/9 + 3×3 dot grid

struct SmallView: View {
    let snap: WSnapshot
    private var done: Int { snap.modes.filter(\.played).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("DAILIES").font(.system(size: 10, weight: .black, design: .rounded))
                    .tracking(1).foregroundStyle(brandGradient)
                Spacer()
                StreakBadge(streak: snap.streak)
            }
            Spacer(minLength: 0)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text("\(done)").font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(.primary)
                Text("/\(snap.modes.count)").font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            Text(done >= snap.modes.count ? "All done — new at midnight" : "puzzles played today")
                .font(.system(size: 10, weight: .bold, design: .rounded)).foregroundStyle(.secondary)
                .minimumScaleFactor(0.7).lineLimit(1)
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                ForEach(snap.modes, id: \.key) { m in
                    Circle()
                        .fill(m.played ? (m.won ? Color(widgetHex: m.colorHex) : Color.gray.opacity(0.55))
                                       : Color(widgetHex: m.colorHex).opacity(0.18))
                        .frame(height: 8)
                }
            }
        }
    }
}

// MARK: - Medium: header + full mode-chip grid

struct MediumView: View {
    let snap: WSnapshot
    private var done: Int { snap.modes.filter(\.played).count }
    private let cols = [GridItem](repeating: GridItem(.flexible(), spacing: 6), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("WORDOCIOUS").font(.system(size: 12, weight: .black, design: .rounded))
                    .tracking(1.5).foregroundStyle(brandGradient)
                Spacer()
                Text("\(done)/\(snap.modes.count) today")
                    .font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundStyle(.secondary)
                StreakBadge(streak: snap.streak)
            }
            Spacer(minLength: 0)
            LazyVGrid(columns: cols, spacing: 6) {
                ForEach(snap.modes, id: \.key) { m in
                    VStack(spacing: 2) {
                        ModeCell(mode: m, size: 26)
                        Text(m.title).font(.system(size: 7.5, weight: .bold, design: .rounded))
                            .foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                // 10th cell: call-to-action / celebration.
                VStack(spacing: 2) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 7).fill(Color(widgetHex: "#a78bfa").opacity(0.14))
                        Image(systemName: done >= snap.modes.count ? "party.popper.fill" : "play.fill")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(Color(widgetHex: "#7c3aed"))
                    }
                    .frame(width: 26, height: 26)
                    Text(done >= snap.modes.count ? "Done!" : "Play")
                        .font(.system(size: 7.5, weight: .bold, design: .rounded)).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Widget

struct WordociousDailyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WordociousDaily", provider: DailyProvider()) { entry in
            WidgetRootView(entry: entry)
                .containerBackgroundCompat()
        }
        .configurationDisplayName("Daily Puzzles")
        .description("Today's daily progress and your streak.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct WidgetRootView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyEntry

    var body: some View {
        switch family {
        case .systemMedium: MediumView(snap: entry.snap)
        default: SmallView(snap: entry.snap)
        }
    }
}

extension View {
    /// iOS 17 requires containerBackground; iOS 16 uses plain padding.
    @ViewBuilder
    func containerBackgroundCompat() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { Color(widgetHex: "#f8f7ff") }
        } else {
            padding(12).background(Color(widgetHex: "#f8f7ff"))
        }
    }
}

@main
struct WordociousWidgetBundle: WidgetBundle {
    var body: some Widget {
        WordociousDailyWidget()
    }
}
