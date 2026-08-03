import WidgetKit
import SwiftUI

// Home-screen widget: today's daily-puzzle progress (9 mode chips) + play
// streak. Renders purely from the JSON snapshot the app writes into the
// app-group container (WidgetBridge) — no app code is linked, so the mode
// catalog stays single-sourced in the app. The app's Assets.xcassets is
// compiled into this target too (project.yml), so the chips can draw the
// SAME icons as the home menu (skull, shield, hands…), not text stand-ins.
//
// v2 (founder-approved mock, widget-footer-mock.html): a footer strip
// (wordmark · stats · live countdown) plus a four-state theme —
// swept/flawless, mid-day, streak-at-risk (evening, nothing played), and
// fresh-puzzles (post-midnight, nothing played).

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
}

/// Which of the widget's five looks applies right now. Flawless/sweep mirror
/// the home banner; at-risk and fresh are time-dependent, which is why the
/// timeline pre-schedules entries at 20:00 and midnight — the look flips on
/// time without the app ever waking up.
enum WidgetTheme {
    case flawless, sweep, midday, atRisk, fresh

    static func from(_ snap: WSnapshot, at date: Date) -> WidgetTheme {
        let played = snap.modes.filter(\.played).count
        if !snap.modes.isEmpty, played >= snap.modes.count {
            return snap.modes.allSatisfy(\.won) ? .flawless : .sweep
        }
        if played == 0 {
            // Evening with a live streak and zero plays → nag. A zero streak
            // has nothing to lose, so it stays on the invitation look.
            let hour = Calendar.current.component(.hour, from: date)
            return (hour >= 20 && snap.streak > 0) ? .atRisk : .fresh
        }
        return .midday
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
                                                  iconKind: $0.kind, iconAsset: $0.asset, iconText: $0.text) },
              points: nil, seconds: nil, shields: nil)
}

private func localDay(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

/// Read the app-written snapshot; a snapshot from a previous day keeps the
/// streak and shields but resets every mode (and the day's stats) to zero —
/// new puzzles dropped at midnight.
private func loadSnapshot(for date: Date = Date()) -> WSnapshot {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: snapshotKey),
          let snap = try? JSONDecoder().decode(WSnapshot.self, from: data) else { return emptySnapshot() }
    if snap.day == localDay(date) { return snap }
    return WSnapshot(day: localDay(date), streak: snap.streak,
                     modes: snap.modes.map { .init(key: $0.key, title: $0.title, glyph: $0.glyph, colorHex: $0.colorHex,
                                                   played: false, won: false,
                                                   iconKind: $0.iconKind, iconAsset: $0.iconAsset, iconText: $0.iconText) },
                     points: 0, seconds: 0, shields: snap.shields)
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
        // Entries at every point today where the LOOK can change without new
        // data: now, 20:00 (at-risk kicks in), each following hour (the
        // "2H LEFT" pill), and midnight (grid resets to fresh). The app pushes
        // reloads on every completion, so no data polling is needed.
        let now = Date()
        let snap = loadSnapshot()
        var dates: [Date] = [now]
        let cal = Calendar.current
        for hour in 20...23 {
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

private let brandGradient = LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                           startPoint: .leading, endPoint: .trailing)
// Home banner palettes (HomeView.banner): Sweep purple/pink, Flawless amber.
private let sweepTitleGradient = LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                                startPoint: .topLeading, endPoint: .bottomTrailing)
private let flawlessTitleGradient = LinearGradient(colors: [Color(widgetHex: "#d97706"), Color(widgetHex: "#b45309")],
                                                   startPoint: .topLeading, endPoint: .bottomTrailing)
private let riskTitleGradient = LinearGradient(colors: [Color(widgetHex: "#f59e0b"), Color(widgetHex: "#ef4444")],
                                               startPoint: .topLeading, endPoint: .bottomTrailing)
private let freshTitleGradient = LinearGradient(colors: [Color(widgetHex: "#10b981"), Color(widgetHex: "#3b82f6")],
                                                startPoint: .topLeading, endPoint: .bottomTrailing)

private func groupedPoints(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

private func mmss(_ seconds: Int) -> String {
    "\(seconds / 60):" + String(format: "%02d", seconds % 60)
}

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

/// One mode chip. Played: solid accent + check (gray + xmark when lost).
/// Unplayed: a "door" — white tile, dashed accent border, the mode's own
/// home-menu icon — signalling it's a tap target that opens that puzzle.
private struct ModeCell: View {
    let mode: WSnapshot.Mode
    var size: CGFloat = 30

    var body: some View {
        let accent = Color(widgetHex: mode.colorHex)
        ZStack {
            if mode.played {
                RoundedRectangle(cornerRadius: size * 0.27)
                    .fill(mode.won ? accent : Color.gray.opacity(0.55))
                Image(systemName: mode.won ? "checkmark" : "xmark")
                    .font(.system(size: size * 0.42, weight: .black))
                    .foregroundStyle(.white)
            } else {
                RoundedRectangle(cornerRadius: size * 0.27)
                    .fill(Color.white.opacity(0.72))
                RoundedRectangle(cornerRadius: size * 0.27)
                    .strokeBorder(accent.opacity(0.55), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                ModeGlyph(mode: mode, accent: accent, box: size)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(mode.title), \(mode.played ? (mode.won ? "solved" : "played") : "not played — tap to play")")
    }
}

/// The footer strip from the approved mock: wordmark · stats · live countdown.
/// The countdown is WidgetKit timer text — it ticks every second natively,
/// costing none of the widget's refresh budget.
private struct FooterStrip: View {
    let snap: WSnapshot
    let theme: WidgetTheme
    let date: Date

    private var done: Int { snap.modes.filter(\.played).count }

    private var statText: String {
        switch theme {
        case .flawless, .sweep:
            let time = mmss(snap.seconds ?? 0)
            return "\(time) · \(groupedPoints(snap.points ?? 0)) pts"
        case .midday:
            return "\(done)/\(snap.modes.count) · \(groupedPoints(snap.points ?? 0)) pts"
        case .atRisk:
            return "Play 1 to keep the streak"
        case .fresh:
            return "A brand-new board awaits"
        }
    }

    var body: some View {
        let countdownTint = theme == .atRisk ? Color(widgetHex: "#d97706") : Color(widgetHex: "#7c3aed")
        HStack(spacing: 6) {
            Text("WORDOCIOUS").font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(1.1).foregroundStyle(brandGradient)
                .lineLimit(1).layoutPriority(1)
            Spacer(minLength: 4)
            Text(statText)
                .font(.system(size: 10.5, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.primary.opacity(0.8))
                .lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 4)
            HStack(spacing: 2) {
                Image(systemName: "hourglass").font(.system(size: 8.5, weight: .bold))
                Text(timerInterval: date...nextLocalMidnight(after: date), countsDown: true)
                    .font(.system(size: 10.5, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
            }
            .foregroundStyle(countdownTint)
            .layoutPriority(1)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 9)
                .fill(Color.white.opacity(0.55))
                .overlay(RoundedRectangle(cornerRadius: 9)
                    .strokeBorder(Color(widgetHex: "#a78bfa").opacity(0.35), lineWidth: 1))
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wordocious. \(statText). New puzzles at midnight.")
    }
}

// MARK: - Small: streak + big X/9 + dot strip

struct SmallView: View {
    let snap: WSnapshot
    let theme: WidgetTheme
    private var done: Int { snap.modes.filter(\.played).count }

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
            switch theme {
            case .flawless:
                statusLine("FLAWLESS VICTORY!", icon: "trophy.fill",
                           iconColor: Color(widgetHex: "#b45309"), gradient: flawlessTitleGradient)
            case .sweep:
                statusLine("DAILY SWEEP!", icon: "sparkles",
                           iconColor: Color(widgetHex: "#7c3aed"), gradient: sweepTitleGradient)
            case .atRisk:
                statusLine("STREAK AT RISK", icon: "exclamationmark.triangle.fill",
                           iconColor: Color(widgetHex: "#f59e0b"), gradient: riskTitleGradient)
            case .fresh:
                statusLine("FRESH PUZZLES!", icon: "sparkles",
                           iconColor: Color(widgetHex: "#10b981"), gradient: freshTitleGradient)
            case .midday:
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

    private func statusLine(_ title: String, icon: String, iconColor: Color, gradient: LinearGradient) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 10, weight: .bold)).foregroundStyle(iconColor)
            Text(title).font(.system(size: 11, weight: .black, design: .rounded))
                .foregroundStyle(gradient)
                .minimumScaleFactor(0.7).lineLimit(1)
        }
    }
}

// MARK: - Medium: themed header + mode-chip grid + footer strip

struct MediumView: View {
    let snap: WSnapshot
    let theme: WidgetTheme
    let date: Date
    private var done: Int { snap.modes.filter(\.played).count }
    private let cols = [GridItem](repeating: GridItem(.flexible(), spacing: 6), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            header
            Spacer(minLength: 0)
            LazyVGrid(columns: cols, spacing: 6) {
                ForEach(snap.modes, id: \.key) { m in
                    // Deep link: tap a chip, land in that daily (DeepLink.swift
                    // handles wordocious://daily/<key>). ProperNoundle's daily
                    // has no programmatic launch path, so its chip just opens
                    // the app (no Link).
                    let cell = VStack(spacing: 2) {
                        ModeCell(mode: m, size: 34)
                        Text(m.title).font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    if m.key != "PROPERNOUNDLE", let url = URL(string: "wordocious://daily/\(m.key)") {
                        Link(destination: url) { cell }
                    } else {
                        cell
                    }
                }
                tenthCell
            }
            Spacer(minLength: 0)
            FooterStrip(snap: snap, theme: theme, date: date)
        }
    }

    /// 10th grid slot, by theme: celebration when swept, remaining count
    /// mid-day, the shield stash when the streak's on the line, sparkle at dawn.
    @ViewBuilder
    private var tenthCell: some View {
        switch theme {
        case .flawless, .sweep:
            extraCell(icon: "party.popper.fill", tint: Color(widgetHex: "#7c3aed"), label: "Done!")
        case .midday:
            extraCell(icon: "hourglass", tint: Color(widgetHex: "#7c3aed"),
                      label: "\(snap.modes.count - done) left")
        case .atRisk:
            extraCell(icon: "shield.fill", tint: Color(widgetHex: "#d97706"),
                      label: (snap.shields ?? 0) > 0 ? "\(snap.shields ?? 0) shields" : "No shields")
        case .fresh:
            extraCell(icon: "sparkles", tint: Color(widgetHex: "#10b981"),
                      label: "\(snap.modes.count) to play")
        }
    }

    private func extraCell(icon: String, tint: Color, label: String) -> some View {
        VStack(spacing: 2) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(tint.opacity(0.12))
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(tint)
            }
            .frame(width: 34, height: 34)
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .rounded)).foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
    }

    @ViewBuilder
    private var header: some View {
        switch theme {
        case .flawless:
            banner(title: "FLAWLESS VICTORY!", gradient: flawlessTitleGradient,
                   icon: "trophy.fill", iconColor: Color(widgetHex: "#b45309"))
        case .sweep:
            banner(title: "DAILY SWEEP!", gradient: sweepTitleGradient,
                   icon: "sparkles", iconColor: Color(widgetHex: "#7c3aed"))
        case .fresh:
            banner(title: "FRESH PUZZLES!", gradient: freshTitleGradient,
                   icon: "sparkles", iconColor: Color(widgetHex: "#10b981"))
        case .midday:
            banner(title: "DAILY PUZZLES", gradient: sweepTitleGradient,
                   icon: "sparkles", iconColor: Color(widgetHex: "#c4a9fb"))
        case .atRisk:
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(Color(widgetHex: "#f59e0b"))
                Text("STREAK AT RISK").font(.system(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(riskTitleGradient)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Spacer()
                StreakBadge(streak: snap.streak)
                Text(hoursLeftLabel)
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2.5)
                    .background(Capsule().fill(riskTitleGradient))
            }
        }
    }

    /// "3H LEFT" for the at-risk pill; the hourly 20–23h timeline entries keep
    /// it honest without any widget refresh budget.
    private var hoursLeftLabel: String {
        let s = max(0, Int(nextLocalMidnight(after: date).timeIntervalSince(date)))
        let h = Int((Double(s) / 3600).rounded(.up))
        return h <= 1 ? "LAST HOUR" : "\(h)H LEFT"
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
    let theme: WidgetTheme
    private var done: Int { snap.modes.filter(\.played).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("WORDOCIOUS").font(.system(size: 11, weight: .black, design: .rounded))
                .widgetAccentable()
            switch theme {
            case .flawless: Text("Flawless victory! 9/9 won")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            case .sweep: Text("Daily sweep! \(done)/\(snap.modes.count) played")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            case .atRisk: Text("Streak at risk — play 1")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            case .fresh: Text("\(snap.modes.count) fresh puzzles")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
            case .midday: Text("\(done)/\(snap.modes.count) dailies played")
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
                .containerBackgroundCompatAuto(theme: WidgetTheme.from(entry.snap, at: entry.date))
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
        let theme = WidgetTheme.from(entry.snap, at: entry.date)
        switch family {
        case .systemMedium: MediumView(snap: entry.snap, theme: theme, date: entry.date)
        case .accessoryRectangular: AccessoryRectangularView(snap: entry.snap, theme: theme)
        default: SmallView(snap: entry.snap, theme: theme)
        }
    }
}

private struct BGAuto: ViewModifier {
    @Environment(\.widgetFamily) private var family
    let theme: WidgetTheme
    func body(content: Content) -> some View {
        content.containerBackgroundCompat(accessory: family == .accessoryRectangular, theme: theme)
    }
}
extension View {
    func containerBackgroundCompatAuto(theme: WidgetTheme = .midday) -> some View {
        modifier(BGAuto(theme: theme))
    }

    /// iOS 17 requires containerBackground; iOS 16 uses plain padding.
    /// Each theme tints the whole widget: sweep purple/pink, flawless amber,
    /// at-risk warm amber, fresh mint — with a matching gradient frame.
    /// (containerBackground's builder wants a VIEW — LinearGradient/Color both
    /// are; AnyShapeStyle is not, which is why this isn't a ShapeStyle.)
    @ViewBuilder
    func containerBackgroundCompat(accessory: Bool = false, theme: WidgetTheme = .midday) -> some View {
        let bg: AnyView = {
            switch theme {
            case .flawless:
                return AnyView(LinearGradient(colors: [Color(widgetHex: "#fef3c7"), Color(widgetHex: "#fde68a")],
                                              startPoint: .topLeading, endPoint: .bottomTrailing))
            case .sweep:
                return AnyView(LinearGradient(colors: [Color(widgetHex: "#f5f3ff"), Color(widgetHex: "#fce7f3")],
                                              startPoint: .topLeading, endPoint: .bottomTrailing))
            case .atRisk:
                return AnyView(LinearGradient(colors: [Color(widgetHex: "#fef6ec"), Color(widgetHex: "#fbf0f3")],
                                              startPoint: .topLeading, endPoint: .bottomTrailing))
            case .fresh:
                return AnyView(LinearGradient(colors: [Color(widgetHex: "#f2fbf6"), Color(widgetHex: "#f0f5fe")],
                                              startPoint: .topLeading, endPoint: .bottomTrailing))
            case .midday:
                return AnyView(Color(widgetHex: "#f8f7ff"))
            }
        }()
        let frame: LinearGradient = {
            switch theme {
            case .atRisk:
                return LinearGradient(colors: [Color(widgetHex: "#f7c77e"), Color(widgetHex: "#f397c8")],
                                      startPoint: .topLeading, endPoint: .bottomTrailing)
            case .fresh:
                return LinearGradient(colors: [Color(widgetHex: "#7ee0b8"), Color(widgetHex: "#8fb8f7")],
                                      startPoint: .topLeading, endPoint: .bottomTrailing)
            default:
                return LinearGradient(colors: [Color(widgetHex: "#a78bfa"), Color(widgetHex: "#ec4899")],
                                      startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }()
        let halo: Color = {
            switch theme {
            case .atRisk: return Color(widgetHex: "#f59e0b").opacity(0.10)
            case .fresh: return Color(widgetHex: "#10b981").opacity(0.10)
            default: return Color(widgetHex: "#8B5CF6").opacity(0.10)
            }
        }()
        if #available(iOS 17.0, *) {
            // Lock-screen accessories tint themselves; a solid brand background
            // would render as an opaque slab there. Home-screen widgets get the
            // brand frame: a soft inner halo + a crisp gradient stroke on the
            // widget's own corner shape — drawn in the background (not an
            // overlay) so it reaches the true edge past content margins.
            containerBackground(for: .widget) {
                if accessory { AnyView(Color.clear) } else { AnyView(ZStack {
                    bg
                    ContainerRelativeShape().strokeBorder(halo, lineWidth: 7)
                    ContainerRelativeShape().strokeBorder(frame, lineWidth: 2.5)
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
