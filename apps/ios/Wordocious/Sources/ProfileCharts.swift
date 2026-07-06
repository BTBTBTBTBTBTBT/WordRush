import SwiftUI
import Charts
import WordociousCore

/// Profile data-visualization dashboard — ports the deferred /profile chart
/// sections (guess distribution, activity calendar, solve-time, time-of-day).
/// Pass `mode == nil` for the global "All" view, or a GameMode for per-mode.
struct ProfileDashboard: View {
    let mode: GameMode?
    /// All user_stats rows (both play_types) — passed down from ProfileTab so the
    /// All-view Pro Stats charts never depend on their own fetch timing (the old
    /// self-fetch could permanently early-return when auth.profile hydrated a
    /// frame late, silently emptying the charts). Empty for the per-mode view.
    var statRows: [UserStatRow] = []
    /// Page-level Solo/VS/VS-CPU toggle (restat B1) — scopes every per-game
    /// chart below; vs_cpu fetchers return empty and ProfileTab shows the
    /// "totals only" note instead. Activity/daily-points stay unscoped (web).
    var playType: String = "solo"

    var body: some View {
        VStack(spacing: 12) {
            if mode == nil {
                // Web All-view Trends order (restat R1): activity calendar →
                // last-7-days → guess distribution → solve time → daily points
                // → top words → opener lab → weekday form. The sweep-COUNTS
                // card moved to Records → You (single home); the points trend
                // stays here. Time-of-day is an iOS-only extra kept at the end.
                ActivityCalendarView(mode: nil)
                SevenDayActivityCard()
                GuessDistributionChart(mode: nil, playType: playType)
                SolveTimeChart(mode: nil, playType: playType)
                DailyPointsChartCard()
                TopWordsCard(mode: nil, playType: playType)
                OpenerLabCard(playType: playType)
                WeekdayFormCard(playType: playType)
                TimeOfDayHeatmap(mode: nil, playType: playType)
            } else {
                GuessDistributionChart(mode: mode, playType: playType)
                ActivityCalendarView(mode: mode)
                SolveTimeChart(mode: mode, playType: playType)
                TimeOfDayHeatmap(mode: mode, playType: playType)
                TopWordsCard(mode: mode, playType: playType)
                // Per-mode Pro insights (selected mode). On the All view the
                // global Pro Stats card is rendered by ProfileTab AFTER the
                // Insights section, to match the web All-view order.
                ProInsightsCard(mode: mode!, playType: playType)
            }
        }
    }
}

// MARK: - Shared card chrome

private struct LegacyChartCard<Content: View>: View {
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
    var playType: String = "solo"
    @State private var data: [MatchStatsService.GuessBucket] = []

    private func color(_ g: Int) -> Color {
        g <= 2 ? Color(hex: 0x7C3AED) : g <= 4 ? Color(hex: 0xF59E0B) : Color(hex: 0x9CA3AF)
    }
    private var totalWins: Int { data.reduce(0) { $0 + $1.count } }

    var body: some View {
        // Gauntlet runs can take up to 50 guesses across 21 boards — a guess
        // histogram is meaningless there, so the chart is hidden (all platforms).
        if mode == .gauntlet { EmptyView() } else {
        LegacyChartCard(title: "GUESS DISTRIBUTION") {
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
        .task(id: "\(mode?.rawValue ?? "all")-\(playType)") {
            // P-cache: seed from the session memo (instant repaint), then
            // fetch fresh exactly as before and store back.
            let key = "guessDist:\(AuthService.shared.profile?.id ?? "anon"):\(mode?.rawValue ?? "all"):\(playType)"
            if let cached: [MatchStatsService.GuessBucket] = StatsMemo.shared.get(key) { data = cached }
            let fresh = await MatchStatsService.guessDistribution(mode: mode, playType: playType)
            data = fresh
            StatsMemo.shared.set(key, fresh)
        }
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
                LegacyChartCard(title: "ACTIVITY (LAST 90 DAYS)") {
                let weeks = makeWeeks()
                let maxPlayed = max(1, data.map(\.played).max() ?? 1)
                // Cells scale to FILL the card's width (the fixed 11pt grid left
                // a big dead zone on the right). The whole 11pt-cell/3pt-gap
                // design scales uniformly, so the grid's aspect ratio is exact:
                // width units = 11n+3(n-1) = 14n−3, height units = 7·11+6·3 = 95.
                let n = max(1, CGFloat(weeks.count))
                GeometryReader { geo in
                    let unit = geo.size.width / (14 * n - 3)
                    let cell = 11 * unit
                    let spacing = 3 * unit
                    HStack(spacing: spacing) {
                        ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                            VStack(spacing: spacing) {
                                ForEach(Array(week.enumerated()), id: \.offset) { _, cellDay in
                                    RoundedRectangle(cornerRadius: 2 * unit)
                                        .fill(cellColor(cellDay, maxPlayed: maxPlayed))
                                        .frame(width: cell, height: cell)
                                }
                            }
                        }
                    }
                }
                .aspectRatio((14 * n - 3) / 95, contentMode: .fit)
                let totalDays = data.filter { $0.played > 0 }.count
                let totalGames = data.reduce(0) { $0 + $1.played }
                Text("\(totalDays) day\(totalDays == 1 ? "" : "s") played · \(totalGames) games")
                    .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                }
            } else {
                Color.clear.frame(height: 0)   // concrete child so .task fires when empty
            }
        }
        .task(id: mode?.rawValue ?? "all") {
            let key = "activityCal:\(AuthService.shared.profile?.id ?? "anon"):\(mode?.rawValue ?? "all")"
            if let cached: [MatchStatsService.DayActivity] = StatsMemo.shared.get(key) { data = cached }
            let fresh = await MatchStatsService.activityCalendar(mode: mode)
            data = fresh
            StatsMemo.shared.set(key, fresh)
        }
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
            return intensity > 0.6 ? Color(hex: 0x7C3AED) : intensity > 0.3 ? Color(hex: 0xA78BFA) : Color(hex: 0xDDD6FE)
        }
        return intensity > 0.6 ? Color(hex: 0x7C3AED) : intensity > 0.3 ? Color(hex: 0xA78BFA) : Color(hex: 0xC4B5FD)
    }
}

// MARK: - 7-day activity bars (web "LAST 7 DAYS")

/// Web parity (profile/page.tsx section: "LAST 7 DAYS"): seven day-of-week bars
/// of games played, with a header game count. Self-fetches the last 7 days from
/// the 90-day activity calendar so it never depends on parent state timing.
struct SevenDayActivityCard: View {
    @State private var data: [MatchStatsService.DayActivity] = []

    private var lastSeven: [MatchStatsService.DayActivity] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        return (0..<7).reversed().compactMap { offset -> MatchStatsService.DayActivity in
            let day = cal.date(byAdding: .day, value: -offset, to: today) ?? today
            return data.first { cal.isDate($0.day, inSameDayAs: day) }
                ?? MatchStatsService.DayActivity(day: day, played: 0, won: 0)
        }
    }

    var body: some View {
        let week = lastSeven
        let total = week.reduce(0) { $0 + $1.played }
        // Web parity: section hidden until there is activity to show.
        Group {
            if total > 0 {
                let maxCount = max(1, week.map(\.played).max() ?? 1)
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("LAST 7 DAYS").font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
                        Spacer()
                        Text("\(total) \(total == 1 ? "game" : "games")").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    HStack(alignment: .bottom, spacing: 6) {
                        ForEach(Array(week.enumerated()), id: \.offset) { _, d in
                            VStack(spacing: 4) {
                                ZStack(alignment: .bottom) {
                                    Color.clear.frame(height: 48)
                                    RoundedRectangle(cornerRadius: 3)
                                        .fill(d.played == 0 ? AnyShapeStyle(Theme.border)
                                              : AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)], startPoint: .top, endPoint: .bottom)))
                                        .frame(height: d.played == 0 ? 3 : 6 + CGFloat(d.played) / CGFloat(maxCount) * 42)
                                        .frame(maxWidth: .infinity)
                                }
                                Text(dow(d.day)).font(Brand.font(9, .heavy)).foregroundStyle(Theme.textMuted)
                            }
                        }
                    }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }
        }
        .task {
            let key = "activity7:\(AuthService.shared.profile?.id ?? "anon")"
            if let cached: [MatchStatsService.DayActivity] = StatsMemo.shared.get(key) { data = cached }
            let fresh = await MatchStatsService.activityCalendar(days: 7)
            data = fresh
            StatsMemo.shared.set(key, fresh)
        }
    }

    private func dow(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEEEE"; f.locale = Locale(identifier: "en_US")
        return f.string(from: d)
    }
}

// MARK: - Insights (web All-view INSIGHTS card)

/// Web parity (profile/page.tsx "INSIGHTS"): up to 2 sparkle-prefixed insight
/// lines. The strings are computed by ProfileTab (which holds profile + stats +
/// dailies state) and passed in; the card hides when there are none.
struct ProfileInsightsCard: View {
    let insights: [String]
    var body: some View {
        if !insights.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("INSIGHTS").font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(insights.enumerated()), id: \.offset) { _, text in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "sparkles").font(.system(size: 13)).foregroundStyle(Color(hex: 0x7C3AED))
                            Text(text).font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [Color(hex: 0xF5F3FF), Color(hex: 0xEEF2FF)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xDDD6FE), lineWidth: 1.5))
            }
        }
    }
}

// MARK: - Solve time

private struct SolveTimeChart: View {
    let mode: GameMode?
    var playType: String = "solo"
    @State private var data: [MatchStatsService.SolvePoint] = []

    private func modeColor(_ raw: String) -> Color {
        GameMode(rawValue: raw).map { ModeStyle.accent($0) } ?? Theme.primary
    }
    private var avg: Double { data.isEmpty ? 0 : Double(data.reduce(0) { $0 + $1.seconds }) / Double(data.count) }

    var body: some View {
        LegacyChartCard(title: "SOLVE TIME — LAST \(data.count) WINS") {
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
                    timeStat("Fastest", data.map(\.seconds).min() ?? 0, Color(hex: 0x7C3AED))
                    Spacer()
                    timeStat("Average", Int(avg.rounded()), Theme.textPrimary)
                    Spacer()
                    timeStat("Slowest", data.map(\.seconds).max() ?? 0, Color(hex: 0xEF4444))
                }
            }
        }
        .task(id: "\(mode?.rawValue ?? "all")-\(playType)") {
            let key = "solveTimes:\(AuthService.shared.profile?.id ?? "anon"):\(mode?.rawValue ?? "all"):\(playType)"
            if let cached: [MatchStatsService.SolvePoint] = StatsMemo.shared.get(key) { data = cached }
            let fresh = await MatchStatsService.solveTimes(mode: mode, playType: playType)
            data = fresh
            StatsMemo.shared.set(key, fresh)
        }
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
    var playType: String = "solo"
    @State private var data: [MatchStatsService.HourBucket] = []

    var body: some View {
        // Web parity: time-of-day-heatmap.tsx returns null when empty — hide.
        Group {
            if data.contains(where: { $0.played > 0 }) {
                LegacyChartCard(title: "WHEN YOU PLAY") {
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
            } else {
                Color.clear.frame(height: 0)   // concrete child so .task fires when empty
            }
        }
        .task(id: "\(mode?.rawValue ?? "all")-\(playType)") {
            let key = "timeOfDay:\(AuthService.shared.profile?.id ?? "anon"):\(mode?.rawValue ?? "all"):\(playType)"
            if let cached: [MatchStatsService.HourBucket] = StatsMemo.shared.get(key) { data = cached }
            let fresh = await MatchStatsService.timeOfDay(mode: mode, playType: playType)
            data = fresh
            StatsMemo.shared.set(key, fresh)
        }
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
    var playType: String = "solo"
    @State private var data: [MatchStatsService.TopWord] = []

    var body: some View {
        // Web parity: top-words-card.tsx returns null when empty — hide.
        Group {
            if !data.isEmpty {
                LegacyChartCard(title: "TOP WORDS") {
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
            } else {
                Color.clear.frame(height: 0)   // concrete child so .task fires when empty
            }
        }
        .task(id: "\(mode?.rawValue ?? "all")-\(playType)") {
            let key = "topWords:\(AuthService.shared.profile?.id ?? "anon"):\(mode?.rawValue ?? "all"):\(playType)"
            if let cached: [MatchStatsService.TopWord] = StatsMemo.shared.get(key) { data = cached }
            let fresh = await MatchStatsService.topWords(mode: mode, playType: playType)
            data = fresh
            StatsMemo.shared.set(key, fresh)
        }
    }
}

// MARK: - Pro insights (per-mode, Pro-gated)

private struct ProInsightsCard: View {
    let mode: GameMode
    var playType: String = "solo"
    @ObservedObject private var auth = AuthService.shared
    @State private var s = MatchStatsService.ProInsights()
    @State private var showPro = false
    private let gold = Color(hex: 0xD97706)

    var body: some View {
        // Web parity: the insights section renders nothing when a Pro user has
        // no data — only the free-user locked teaser always shows.
        Group {
            if !auth.isProActive || s.hasData {
                LegacyChartCard(title: "PRO INSIGHTS") {
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
        .task(id: "\(mode.rawValue)-\(auth.isProActive)-\(playType)") {
            s = MatchStatsService.ProInsights()
            if auth.isProActive {
                let key = "proInsights:\(auth.profile?.id ?? "anon"):\(mode.rawValue):\(playType)"
                if let cached: MatchStatsService.ProInsights = StatsMemo.shared.get(key) { s = cached }
                let fresh = await MatchStatsService.proInsights(mode: mode, playType: playType)
                s = fresh
                StatsMemo.shared.set(key, fresh)
            }
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
struct ProStatsCard: View {
    /// user_stats rows handed down from ProfileTab (already fetched once for the
    /// whole profile). Computing bars from these instead of a private fetch fixes
    /// the All-view Pro Stats showing nothing for a Pro user with data.
    let statRows: [UserStatRow]
    @ObservedObject private var auth = AuthService.shared
    @State private var showPro = false
    // Tap-to-reveal (web-parity tooltip): the selected bar's label per chart.
    @State private var selectedWin: String?
    @State private var selectedTime: String?

    struct ModeBar: Identifiable { var id: String { label }; let label: String; let winRate: Double; let avgTime: Int }

    // game_mode (dbKey) → short label, mirroring the web MODE_LABELS.
    private static let order = ["DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "DUEL_6", "DUEL_7", "GAUNTLET", "PROPERNOUNDLE"]
    private static let label = ["DUEL": "Classic", "QUORDLE": "Quad", "OCTORDLE": "Octo", "SEQUENCE": "Succ",
                                "RESCUE": "Deliv", "DUEL_6": "Six", "DUEL_7": "Seven", "GAUNTLET": "Gaunt", "PROPERNOUNDLE": "Proper"]

    /// Derived synchronously from statRows — no async, no fetch-timing race.
    /// Web parity (pro-stats.tsx): Pro Stats compute from SOLO rows only.
    private var bars: [ModeBar] {
        let rows = statRows.filter { $0.playType == "solo" }
        return Self.order.compactMap { mode in
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

    var body: some View {
        // Web parity: pro-stats.tsx returns null for a Pro user with no data —
        // only the free-user locked teaser always shows.
        Group {
            if !auth.isProActive || !bars.isEmpty {
                LegacyChartCard(title: "PRO STATS") {
            if !auth.isProActive {
                locked
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Win Rate by Mode").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        // Web-parity tooltip line: tap a bar → mode + exact value.
                        if let sel = selectedWin, let b = bars.first(where: { $0.label == sel }) {
                            Text("\(fullName(sel)) · \(Int(b.winRate.rounded()))%")
                                .font(Brand.font(11, .black)).foregroundStyle(Color(hex: 0xD97706))
                        }
                    }
                    Chart(bars) { b in
                        BarMark(x: .value("Mode", b.label), y: .value("Win %", b.winRate))
                            .foregroundStyle(Color(hex: 0xFACC15)).cornerRadius(3)
                            .opacity(selectedWin == nil || selectedWin == b.label ? 1 : 0.35)
                    }
                    .chartYScale(domain: 0...100)
                    // Web parity (pro-stats.tsx): no gridlines — labels only.
                    .chartXAxis { AxisMarks { _ in AxisValueLabel() } }
                    .chartYAxis { AxisMarks(values: [0, 50, 100]) { v in
                        AxisValueLabel { if let i = v.as(Int.self) { Text("\(i)%").font(Brand.font(9, .bold)) } } } }
                    .frame(height: 150)
                    .chartTapSelection(bars: bars.map(\.label), selection: $selectedWin)

                    HStack {
                        Text("Avg Solve Time by Mode").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        if let sel = selectedTime, let b = bars.first(where: { $0.label == sel }) {
                            Text("\(fullName(sel)) · \(fmt(b.avgTime))")
                                .font(Brand.font(11, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                        }
                    }
                    Chart(bars) { b in
                        BarMark(x: .value("Mode", b.label), y: .value("Seconds", b.avgTime))
                            .foregroundStyle(Color(hex: 0xA78BFA)).cornerRadius(3)
                            .opacity(selectedTime == nil || selectedTime == b.label ? 1 : 0.35)
                    }
                    .chartXAxis { AxisMarks { _ in AxisValueLabel() } }
                    .chartYAxis { AxisMarks { v in
                        AxisValueLabel { if let s = v.as(Int.self) { Text(fmt(s)).font(Brand.font(9, .bold)) } } } }
                    .frame(height: 150)
                    .chartTapSelection(bars: bars.map(\.label), selection: $selectedTime)
                }
            }
                }
            }
        }
        .sheet(isPresented: $showPro) { ProView() }
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

    /// Short bar label → full mode title for the tooltip line.
    private func fullName(_ short: String) -> String {
        ["Classic": "Classic", "Quad": "QuadWord", "Octo": "OctoWord", "Succ": "Succession",
         "Deliv": "Deliverance", "Six": "Six", "Seven": "Seven", "Gaunt": "Gauntlet",
         "Proper": "ProperNoundle"][short] ?? short
    }
}

private extension View {
    /// Tap a bar to select it (tap again to clear) — the Swift Charts analogue
    /// of the web chart's tap/hover tooltip. Maps the tap's x position to the
    /// categorical value via the chart proxy.
    func chartTapSelection(bars: [String], selection: Binding<String?>) -> some View {
        chartOverlay { proxy in
            GeometryReader { geo in
                Rectangle().fill(.clear).contentShape(Rectangle())
                    .gesture(SpatialTapGesture().onEnded { value in
                        let origin = geo[proxy.plotAreaFrame].origin
                        if let label: String = proxy.value(atX: value.location.x - origin.x) {
                            selection.wrappedValue = (selection.wrappedValue == label) ? nil : label
                        } else {
                            selection.wrappedValue = nil
                        }
                    })
            }
        }
    }
}
