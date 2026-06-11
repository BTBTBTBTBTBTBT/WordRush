import SwiftUI
import Charts
import WordociousCore

/// Profile data-visualization dashboard — ports the deferred /profile chart
/// sections (guess distribution, activity calendar, solve-time, time-of-day).
/// Pass `mode == nil` for the global "All" view, or a GameMode for per-mode.
struct ProfileDashboard: View {
    let mode: GameMode?

    var body: some View {
        VStack(spacing: 12) {
            GuessDistributionChart(mode: mode)
            ActivityCalendarView(mode: mode)
            SolveTimeChart(mode: mode)
            TimeOfDayHeatmap(mode: mode)
            TopWordsCard(mode: mode)
            // Per-mode Pro insights (selected mode) / global Pro Stats (All view)
            // — both always render and self-gate: a locked "Upgrade to Pro"
            // teaser for free users, real charts/stats for Pro. Mirrors the web
            // pro-insights-card (per-mode) and pro-stats (All view).
            if let mode { ProInsightsCard(mode: mode) } else { ProStatsCard() }
        }
    }
}

// MARK: - Shared card chrome

private struct ChartCard<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
            content
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }
}

private struct EmptyChart: View {
    /// Web parity: the two charts the web keeps visible when empty have
    /// chart-specific copy (guess-distribution.tsx / solve-time-chart.tsx).
    var copy = "No games yet — play to build your stats."
    var body: some View {
        Text(copy)
            .font(Brand.body(12)).foregroundStyle(Theme.textMuted)
            .frame(maxWidth: .infinity, minHeight: 80)
    }
}

// MARK: - Guess distribution

private struct GuessDistributionChart: View {
    let mode: GameMode?
    @State private var data: [MatchStatsService.GuessBucket] = []

    private func color(_ g: Int) -> Color {
        g <= 2 ? Color(hex: 0x22C55E) : g <= 4 ? Color(hex: 0xEAB308) : Color(hex: 0x9CA3AF)
    }
    private var totalWins: Int { data.reduce(0) { $0 + $1.count } }

    var body: some View {
        // Gauntlet runs can take up to 50 guesses across 21 boards — a guess
        // histogram is meaningless there, so the chart is hidden (all platforms).
        if mode == .gauntlet { EmptyView() } else {
        ChartCard(title: "GUESS DISTRIBUTION") {
            if totalWins == 0 {
                EmptyChart(copy: "Win a game to see your guess distribution")
            } else {
                Chart(data) { b in
                    BarMark(x: .value("Guesses", b.label.isEmpty ? "\(b.guesses)" : b.label), y: .value("Wins", b.count))
                        .foregroundStyle(color(b.guesses))
                        .annotation(position: .top) {
                            if b.count > 0 { Text("\(b.count)").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted) }
                        }
                }
                .chartYAxis(.hidden)
                .frame(height: 130)
                Text("\(totalWins) win\(totalWins == 1 ? "" : "s")").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .task(id: mode?.rawValue ?? "all") { data = await MatchStatsService.guessDistribution(mode: mode) }
        }
    }
}

// MARK: - Activity calendar

private struct ActivityCalendarView: View {
    let mode: GameMode?
    @State private var data: [MatchStatsService.DayActivity] = []

    var body: some View {
        // Web parity: DailyCalendar returns null when there are no games —
        // the card is hidden entirely, not shown with placeholder copy.
        Group {
            if data.contains(where: { $0.played > 0 }) {
                ChartCard(title: "ACTIVITY (LAST 90 DAYS)") {
                let weeks = makeWeeks()
                let maxPlayed = max(1, data.map(\.played).max() ?? 1)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 3) {
                        ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                            VStack(spacing: 3) {
                                ForEach(Array(week.enumerated()), id: \.offset) { _, cell in
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(cellColor(cell, maxPlayed: maxPlayed))
                                        .frame(width: 11, height: 11)
                                }
                            }
                        }
                    }
                }
                let totalDays = data.filter { $0.played > 0 }.count
                let totalGames = data.reduce(0) { $0 + $1.played }
                Text("\(totalDays) day\(totalDays == 1 ? "" : "s") played · \(totalGames) games")
                    .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
        }
        .task(id: mode?.rawValue ?? "all") { data = await MatchStatsService.activityCalendar(mode: mode) }
    }

    /// Group the last 90 days into Sunday-aligned week columns of 7 cells.
    private func makeWeeks() -> [[MatchStatsService.DayActivity?]] {
        let cal = Calendar.current
        let byDay = Dictionary(uniqueKeysWithValues: data.map { (cal.startOfDay(for: $0.day), $0) })
        let today = cal.startOfDay(for: Date())
        guard let start = cal.date(byAdding: .day, value: -89, to: today) else { return [] }
        // Back up to the start of that week (weekday 1 = Sunday).
        let weekdayOffset = cal.component(.weekday, from: start) - 1
        guard let gridStart = cal.date(byAdding: .day, value: -weekdayOffset, to: start) else { return [] }

        var weeks: [[MatchStatsService.DayActivity?]] = []
        var current: [MatchStatsService.DayActivity?] = []
        var day = gridStart
        while day <= today {
            current.append(byDay[day])
            if current.count == 7 { weeks.append(current); current = [] }
            day = cal.date(byAdding: .day, value: 1, to: day) ?? today.addingTimeInterval(86_400)
        }
        if !current.isEmpty { while current.count < 7 { current.append(nil) }; weeks.append(current) }
        return weeks
    }

    private func cellColor(_ cell: MatchStatsService.DayActivity?, maxPlayed: Int) -> Color {
        guard let cell, cell.played > 0 else { return Theme.border.opacity(0.6) }
        let ratio = Double(cell.won) / Double(cell.played)
        let intensity = Double(cell.played) / Double(maxPlayed)
        if ratio >= 0.8 {
            return intensity > 0.6 ? Color(hex: 0x16A34A) : intensity > 0.3 ? Color(hex: 0x4ADE80) : Color(hex: 0x86EFAC)
        }
        return intensity > 0.6 ? Color(hex: 0x7C3AED) : intensity > 0.3 ? Color(hex: 0xA78BFA) : Color(hex: 0xC4B5FD)
    }
}

// MARK: - Solve time

private struct SolveTimeChart: View {
    let mode: GameMode?
    @State private var data: [MatchStatsService.SolvePoint] = []

    private func modeColor(_ raw: String) -> Color {
        GameMode(rawValue: raw).map { ModeStyle.accent($0) } ?? Theme.primary
    }
    private var avg: Double { data.isEmpty ? 0 : Double(data.reduce(0) { $0 + $1.seconds }) / Double(data.count) }

    var body: some View {
        ChartCard(title: "SOLVE TIME — LAST \(data.count) WINS") {
            if data.count < 2 {
                EmptyChart(copy: "Win more games to see your solve time trend")
            } else {
                Chart {
                    ForEach(data) { p in
                        LineMark(x: .value("#", p.index), y: .value("Seconds", p.seconds))
                            .foregroundStyle(Theme.primary)
                            .interpolationMethod(.catmullRom)
                        AreaMark(x: .value("#", p.index), y: .value("Seconds", p.seconds))
                            .foregroundStyle(LinearGradient(colors: [Theme.primary.opacity(0.25), .clear], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.catmullRom)
                        PointMark(x: .value("#", p.index), y: .value("Seconds", p.seconds))
                            .foregroundStyle(modeColor(p.mode))
                    }
                    RuleMark(y: .value("Average", avg))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .foregroundStyle(Theme.textMuted.opacity(0.6))
                }
                .chartXAxis(.hidden)
                .frame(height: 140)
                HStack {
                    timeStat("Fastest", data.map(\.seconds).min() ?? 0, Color(hex: 0x22C55E))
                    Spacer()
                    timeStat("Average", Int(avg.rounded()), Theme.textPrimary)
                    Spacer()
                    timeStat("Slowest", data.map(\.seconds).max() ?? 0, Color(hex: 0xEF4444))
                }
            }
        }
        .task(id: mode?.rawValue ?? "all") { data = await MatchStatsService.solveTimes(mode: mode) }
    }

    private func timeStat(_ label: String, _ seconds: Int, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label).font(Brand.font(9, .heavy)).foregroundStyle(Theme.textMuted)
            Text(fmt(seconds)).font(Brand.font(13, .black)).foregroundStyle(color)
        }
    }
    private func fmt(_ s: Int) -> String { s < 60 ? "\(s)s" : "\(s/60):\(String(format: "%02d", s%60))" }
}

// MARK: - Time of day

private struct TimeOfDayHeatmap: View {
    let mode: GameMode?
    @State private var data: [MatchStatsService.HourBucket] = []

    var body: some View {
        // Web parity: time-of-day-heatmap.tsx returns null when empty — hide.
        Group {
            if data.contains(where: { $0.played > 0 }) {
                ChartCard(title: "WHEN YOU PLAY") {
                    let maxPlayed = max(1, data.map(\.played).max() ?? 1)
                    HStack(alignment: .bottom, spacing: 2) {
                        ForEach(data) { h in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Theme.primary.opacity(h.played == 0 ? 0.08 : 0.2 + (Double(h.played) / Double(maxPlayed)) * 0.8))
                                .frame(height: 40)
                        }
                    }
                    HStack(spacing: 0) {
                        ForEach(Array(["12a", "6a", "12p", "6p", "12a"].enumerated()), id: \.offset) { i, l in
                            Text(l).font(Brand.font(8, .bold)).foregroundStyle(Theme.textMuted)
                            if i < 4 { Spacer() }
                        }
                    }
                    if let peak = data.max(by: { $0.played < $1.played }), peak.played > 0 {
                        Text("Peak: \(hourLabel(peak.hour)) · \(peak.played) games")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
        .task(id: mode?.rawValue ?? "all") { data = await MatchStatsService.timeOfDay(mode: mode) }
    }

    private func hourLabel(_ h: Int) -> String {
        let am = h < 12
        let twelve = h % 12 == 0 ? 12 : h % 12
        return "\(twelve)\(am ? "am" : "pm")"
    }
}

// MARK: - Top words

private struct TopWordsCard: View {
    let mode: GameMode?
    @State private var data: [MatchStatsService.TopWord] = []

    var body: some View {
        // Web parity: top-words-card.tsx returns null when empty — hide.
        Group {
            if !data.isEmpty {
                ChartCard(title: "TOP WORDS") {
                let maxCount = max(1, data.map(\.count).max() ?? 1)
                VStack(spacing: 8) {
                    ForEach(Array(data.enumerated()), id: \.element.id) { i, w in
                        HStack(spacing: 8) {
                            Text("\(i + 1)").font(Brand.font(11, .black)).foregroundStyle(Theme.textMuted).frame(width: 14)
                            HStack(spacing: 2) {
                                ForEach(Array(w.word.prefix(7).enumerated()), id: \.offset) { _, ch in
                                    Text(String(ch)).font(Brand.font(11, .black)).foregroundStyle(Theme.textPrimary)
                                        .frame(width: 18, height: 18)
                                        .background(RoundedRectangle(cornerRadius: 3).fill(Theme.surfaceAlt))
                                }
                            }
                            GeometryReader { geo in
                                RoundedRectangle(cornerRadius: 3).fill(Theme.primary.opacity(0.25))
                                    .frame(width: geo.size.width * CGFloat(w.count) / CGFloat(maxCount))
                                    .frame(maxHeight: .infinity, alignment: .leading)
                            }.frame(height: 6)
                            Text("\(w.count)x").font(Brand.font(11, .bold)).foregroundStyle(Theme.textSecondary)
                            Text("\(w.count > 0 ? w.wins * 100 / w.count : 0)%").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).frame(width: 34, alignment: .trailing)
                        }
                    }
                }
                }
            }
        }
        .task(id: mode?.rawValue ?? "all") { data = await MatchStatsService.topWords(mode: mode) }
    }
}

// MARK: - Pro insights (per-mode, Pro-gated)

private struct ProInsightsCard: View {
    let mode: GameMode
    @ObservedObject private var auth = AuthService.shared
    @State private var s = MatchStatsService.ProInsights()
    @State private var showPro = false
    private let gold = Color(hex: 0xD97706)

    var body: some View {
        // Web parity: the insights section renders nothing when a Pro user has
        // no data — only the free-user locked teaser always shows.
        Group {
            if !auth.isProActive || s.hasData {
                ChartCard(title: "PRO INSIGHTS") {
            if !auth.isProActive {
                locked
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    statCell("Fastest Win", s.fastestTime.map(fmt) ?? "—", "bolt.fill", gold)
                    statCell("Fewest Guesses", s.fewestGuesses.map { "\($0)" } ?? "—", "target", gold)
                    statCell("Perfect Games", "\(s.perfectGames)", "star.fill", gold)
                    statCell("Consistency", s.consistencySample >= 3 ? "\(s.consistency)" : "—", "waveform.path.ecg", gold)
                    if s.currentStreak > 0 { statCell("Win Streak", "\(s.currentStreak)", "flame.fill", gold) }
                    if s.avgGuesses > 0 { statCell("Avg Guesses", String(format: "%g", s.avgGuesses), "number", gold) }
                    if s.firstTryRate > 0 { statCell("First Try Rate", "\(s.firstTryRate)%", "1.circle.fill", gold) }
                    if let h = s.peakHour { statCell("Peak Hour", hourLabel(h), "clock.fill", gold) }
                    if let w = s.luckyWord { statCell("Lucky Word", w, "sparkles", gold) }
                }
                if let nem = s.nemesisWord, s.nemesisLosses >= 2 {
                    HStack(spacing: 8) {
                        Image(systemName: "skull.fill").font(.system(size: 13)).foregroundStyle(gold)
                        Text("Nemesis: ").font(Brand.font(12, .bold)).foregroundColor(Theme.textSecondary)
                            + Text(nem).font(Brand.font(12, .black)).foregroundColor(gold)
                        Spacer()
                        Text("Lost \(s.nemesisLosses)×").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 2)
                }
                if s.vsTotal > 0 {
                    HStack(spacing: 8) {
                        Image(systemName: "flag.checkered").font(.system(size: 13)).foregroundStyle(gold)
                        Text("VS Record").font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text("\(s.vsWins)W · \(s.vsLosses)L · \(s.vsWinRate)%")
                            .font(Brand.font(11, .black)).foregroundStyle(Theme.textPrimary)
                    }
                    .padding(.top, 2)
                }
                if s.recentAvg > 0 {
                    HStack(spacing: 6) {
                        Image(systemName: s.improving ? "arrow.down.right" : "arrow.up.right")
                            .font(.system(size: 12)).foregroundStyle(s.improving ? Color(hex: 0x16A34A) : Color(hex: 0xEF4444))
                        Text(s.improving ? "Trending faster" : "Trending slower")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text("\(abs(s.percentChange))% · last 10 avg \(fmt(s.recentAvg))")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 2)
                }
            }
                }
            }
        }
        .task(id: "\(mode.rawValue)-\(auth.isProActive)") {
            if auth.isProActive { s = await MatchStatsService.proInsights(mode: mode) }
        }
        .sheet(isPresented: $showPro) { ProView() }
    }

    /// Free-user locked teaser — frosted placeholder + lock + Upgrade button,
    /// mirroring the web pro-insights-card lock overlay.
    private var locked: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceHover).frame(height: 150)
            VStack(spacing: 8) {
                Image(systemName: "lock.fill").font(.system(size: 26)).foregroundStyle(Color(hex: 0xC4B5FD))
                Text("Deep Insights").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                Button { showPro = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "crown.fill").font(.system(size: 12))
                        Text("Upgrade to Pro").font(Brand.font(12, .black))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 10).fill(
                        LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    .shadow(color: Color(hex: 0x92400E), radius: 0, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func statCell(_ label: String, _ value: String, _ icon: String, _ color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(color).frame(width: 18)
            VStack(alignment: .leading, spacing: 1) {
                Text(value).font(Brand.font(15, .black)).foregroundStyle(Theme.textPrimary)
                Text(label).font(Brand.font(9, .heavy)).foregroundStyle(Theme.textMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(10).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }

    private func fmt(_ s: Int) -> String { s < 60 ? "\(s)s" : "\(s/60):\(String(format: "%02d", s%60))" }

    /// "1 PM" / "12 AM" — matches the web peakHourLabel format.
    private func hourLabel(_ h: Int) -> String {
        let ampm = h >= 12 ? "PM" : "AM"
        let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
        return "\(h12) \(ampm)"
    }
}

// MARK: - Pro Stats (global "All" view, Pro-gated)

/// Aggregate per-mode bar charts shown on the All view — Win Rate by Mode and
/// Avg Solve Time by Mode. Ports the web pro-stats.tsx (locked teaser for free
/// users, the two charts for Pro). Data from user_stats (combined solo+vs, the
/// native convention).
private struct ProStatsCard: View {
    @ObservedObject private var auth = AuthService.shared
    @State private var bars: [ModeBar] = []
    @State private var showPro = false

    struct ModeBar: Identifiable { var id: String { label }; let label: String; let winRate: Double; let avgTime: Int }

    // game_mode (dbKey) → short label, mirroring the web MODE_LABELS.
    private static let order = ["DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "DUEL_6", "DUEL_7", "GAUNTLET", "PROPERNOUNDLE"]
    private static let label = ["DUEL": "Classic", "QUORDLE": "Quad", "OCTORDLE": "Octo", "SEQUENCE": "Succ",
                                "RESCUE": "Deliv", "DUEL_6": "Six", "DUEL_7": "Seven", "GAUNTLET": "Gaunt", "PROPERNOUNDLE": "Proper"]

    var body: some View {
        // Web parity: pro-stats.tsx returns null for a Pro user with no data —
        // only the free-user locked teaser always shows.
        Group {
            if !auth.isProActive || !bars.isEmpty {
                ChartCard(title: "PRO STATS") {
            if !auth.isProActive {
                locked
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Win Rate by Mode").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                    Chart(bars) { b in
                        BarMark(x: .value("Mode", b.label), y: .value("Win %", b.winRate))
                            .foregroundStyle(Color(hex: 0xFACC15)).cornerRadius(3)
                    }
                    .chartYScale(domain: 0...100)
                    .chartYAxis { AxisMarks(values: [0, 50, 100]) { v in
                        AxisGridLine(); AxisValueLabel { if let i = v.as(Int.self) { Text("\(i)%").font(Brand.font(9, .bold)) } } } }
                    .frame(height: 150)

                    Text("Avg Solve Time by Mode").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                    Chart(bars) { b in
                        BarMark(x: .value("Mode", b.label), y: .value("Seconds", b.avgTime))
                            .foregroundStyle(Color(hex: 0xA78BFA)).cornerRadius(3)
                    }
                    .chartYAxis { AxisMarks { v in
                        AxisGridLine(); AxisValueLabel { if let s = v.as(Int.self) { Text(fmt(s)).font(Brand.font(9, .bold)) } } } }
                    .frame(height: 150)
                }
            }
                }
            }
        }
        .task(id: auth.isProActive) { if auth.isProActive { await load() } }
        .sheet(isPresented: $showPro) { ProView() }
    }

    private func load() async {
        guard let uid = auth.profile?.id else { return }
        let rows = await UserStatsService.fetch(userId: uid)
        bars = Self.order.compactMap { mode in
            let mRows = rows.filter { $0.gameMode == mode }
            let games = mRows.reduce(0) { $0 + $1.totalGames }
            guard games > 0 else { return nil }
            let wins = mRows.reduce(0) { $0 + $1.wins }
            // Games-weighted average solve time across this mode's rows.
            let weighted = mRows.reduce(0) { $0 + $1.averageTime * $1.totalGames }
            return ModeBar(label: Self.label[mode] ?? mode,
                           winRate: Double(wins) / Double(games) * 100,
                           avgTime: weighted / games)
        }
    }

    private var locked: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceHover).frame(height: 160)
            VStack(spacing: 8) {
                Image(systemName: "lock.fill").font(.system(size: 28)).foregroundStyle(Color(hex: 0xC4B5FD))
                Text("Pro Feature").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                Button { showPro = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "crown.fill").font(.system(size: 12))
                        Text("Upgrade to Pro").font(Brand.font(12, .black))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 10).fill(
                        LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    .shadow(color: Color(hex: 0x92400E), radius: 0, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func fmt(_ s: Int) -> String { s < 60 ? "\(s)s" : "\(s/60)m \(s%60)s" }
}
