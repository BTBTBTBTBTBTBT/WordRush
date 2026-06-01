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
    var body: some View {
        Text("No games yet — play to build your stats.")
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
        ChartCard(title: "GUESS DISTRIBUTION") {
            if totalWins == 0 {
                EmptyChart()
            } else {
                Chart(data) { b in
                    BarMark(x: .value("Guesses", "\(b.guesses)"), y: .value("Wins", b.count))
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

// MARK: - Activity calendar

private struct ActivityCalendarView: View {
    let mode: GameMode?
    @State private var data: [MatchStatsService.DayActivity] = []

    var body: some View {
        ChartCard(title: "ACTIVITY (LAST 90 DAYS)") {
            if data.isEmpty {
                EmptyChart()
            } else {
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
                EmptyChart()
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
        ChartCard(title: "WHEN YOU PLAY") {
            let maxPlayed = max(1, data.map(\.played).max() ?? 1)
            if data.allSatisfy({ $0.played == 0 }) {
                EmptyChart()
            } else {
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
        .task(id: mode?.rawValue ?? "all") { data = await MatchStatsService.timeOfDay(mode: mode) }
    }

    private func hourLabel(_ h: Int) -> String {
        let am = h < 12
        let twelve = h % 12 == 0 ? 12 : h % 12
        return "\(twelve)\(am ? "am" : "pm")"
    }
}
