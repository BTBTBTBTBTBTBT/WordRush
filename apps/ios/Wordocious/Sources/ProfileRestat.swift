import SwiftUI
import Charts
import WordociousCore

/// Profile restructure cards (restat R1–R3) — ports snapshot-hero.tsx and the
/// new profile/page.tsx sections: SnapshotHero (lifetime stats + this-week
/// strip in ONE card), the "top X% today" standing strip, Opener Lab, Weekday
/// Form, and the Daily Points trend (split out of the old sweep-counts card —
/// the counts' single home is now Records → You).

// MARK: - Snapshot hero

/// Merges the old 4-card summary row + "This Week" recap into ONE card:
/// lifetime headline stats up top, the week strip underneath, and a Pro
/// upsell link for free users.
struct SnapshotHero: View {
    let profile: Profile
    let gamesThisWeek: Int
    let isPro: Bool
    @State private var showPro = false

    var body: some View {
        let totalGames = profile.totalWins + profile.totalLosses
        let winRate = totalGames > 0 ? Int((Double(profile.totalWins) / Double(totalGames) * 100).rounded()) : 0
        let xpToNext = 1000 - (profile.xp % 1000)
        KitCard {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    StatCell(icon: "trophy.fill", label: "Wins", value: "\(profile.totalWins)", color: Color(hex: 0x7C3AED), countUp: profile.totalWins)
                    StatCell(icon: "target", label: "Win Rate", value: "\(winRate)%", color: Color(hex: 0x2563EB), countUp: winRate, countSuffix: "%")
                    StatCell(icon: "bolt.fill", label: "Streak", value: "\(profile.currentStreak)", sub: "Best: \(profile.bestStreak)", color: Theme.primary, countUp: profile.currentStreak)
                    StatCell(icon: "flame.fill", label: "Daily", value: "\(profile.dailyLoginStreak)", sub: "Best: \(profile.bestDailyLoginStreak)", color: Color(hex: 0xF97316), countUp: profile.dailyLoginStreak)
                }
                HStack(spacing: 6) {
                    Image(systemName: "sparkles").font(.system(size: 13)).foregroundStyle(Theme.primary)
                    Text("THIS WEEK").font(Brand.font(10, .black)).tracking(0.5).foregroundStyle(Color(hex: 0x6D28D9))
                    Text("\(gamesThisWeek) \(gamesThisWeek == 1 ? "game" : "games")")
                        .font(Brand.font(11, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                    Spacer(minLength: 8)
                    Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 13)).foregroundStyle(Color(hex: 0x2563EB))
                    (Text("\(xpToNext) XP ").font(Brand.font(11, .heavy)).foregroundColor(Theme.textPrimary)
                     + Text("to Lvl \(profile.level + 1)").font(Brand.font(11, .heavy)).foregroundColor(Theme.textMuted))
                        .lineLimit(1)
                }
                .padding(.top, 12)
                .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
                .padding(.top, 12)
                if !isPro {
                    Button { showPro = true } label: {
                        HStack {
                            Text("Unlock your full insights with Pro").font(Brand.font(11, .heavy))
                            Spacer()
                            Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(Theme.primary)
                        .padding(.top, 10)
                        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)
                }
            }
        }
        .sheet(isPresented: $showPro) { ProView() }
    }
}

// MARK: - Daily standing strip

/// "You're in the top X% today · across N dailies" — where today's composite
/// scores sit in the field. Hidden when the user hasn't played a daily today.
struct DailyStandingStrip: View {
    @State private var standing: StatsDeepService.DailyStanding?
    /// Bump to refetch (daily completions change the standing).
    var reloadToken: Int = 0

    var body: some View {
        Group {
            if let s = standing {
                HStack(spacing: 8) {
                    Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 14))
                        .foregroundStyle(Theme.primary)
                    (Text("You're in the ").font(Brand.font(11, .heavy)).foregroundColor(Theme.textPrimary)
                     + Text("top \(s.topPercent)%").font(Brand.font(11, .black)).foregroundColor(Theme.primary)
                     + Text(" today").font(Brand.font(11, .heavy)).foregroundColor(Theme.textPrimary)
                     + Text(" · across \(s.modesCounted) \(s.modesCounted == 1 ? "daily" : "dailies")")
                        .font(Brand.font(11, .heavy)).foregroundColor(Theme.textMuted))
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 14).fill(LinearGradient(
                    colors: [Color(hex: 0xF5F3FF), Color(hex: 0xFCE7F3)],
                    startPoint: .topLeading, endPoint: .bottomTrailing)))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xE9D5FF), lineWidth: 1.5))
            }
        }
        .task(id: reloadToken) { standing = await StatsDeepService.todayDailyStanding() }
    }
}

// MARK: - Opener Lab (basic)

/// Favorite starting words + how they convert (win rate of games opened with
/// each word). Free-tier card — the deep yield version lives in Deep Insights.
struct OpenerLabCard: View {
    /// Play-type scope from the page toggle (restat B1); vs_cpu → empty → hidden.
    var playType: String = "solo"
    @State private var openers: [StatsDeepService.OpenerStat] = []
    @State private var loaded = false

    var body: some View {
        Group {
            if openers.isEmpty, loaded, playType != "vs_cpu" {
                StatsEmptyCard(title: "Opener Lab", accent: Color(hex: 0x06B6D4),
                               hint: "Win a few games and your favorite starting words show up here.")
            } else if !openers.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Opener Lab", accent: Color(hex: 0x06B6D4))
                    KitCard {
                        VStack(alignment: .leading, spacing: 8) {
                            VStack(spacing: 6) {
                                ForEach(Array(openers.enumerated()), id: \.element.id) { i, o in
                                    HStack(spacing: 10) {
                                        Text("\(i + 1)").font(Brand.font(10, .black))
                                            .foregroundStyle(Theme.textMuted).frame(width: 16)
                                        Text(o.word).font(Brand.font(14, .black)).tracking(1.2)
                                            .foregroundStyle(Theme.textPrimary)
                                        Spacer()
                                        Text("\(o.count)×").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                                        Text("\(o.winRate)% W").font(Brand.font(12, .black))
                                            .foregroundStyle(o.winRate >= 50 ? Theme.primary : Color(hex: 0xDC2626))
                                            .frame(width: 48, alignment: .trailing)
                                    }
                                    .padding(8)
                                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                                }
                            }
                            Text("Win rate of games opened with each word")
                                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                                .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                        }
                    }
                }
            }
        }
        .task(id: playType) {
            // P-cache: seed from the session memo, then fetch fresh as before.
            let key = "openerLab:\(AuthService.shared.profile?.id ?? "anon"):\(playType)"
            if let cached: [StatsDeepService.OpenerStat] = StatsMemo.shared.get(key) { openers = cached }
            let fresh = await StatsDeepService.openerStats(limit: 5, playType: playType)
            openers = fresh
            loaded = true
            StatsMemo.shared.set(key, fresh)
        }
    }
}

// MARK: - Weekday form

/// Win rate by day of week — highlights your best day (gold bar).
struct WeekdayFormCard: View {
    /// Play-type scope from the page toggle (restat B1); vs_cpu → zero days → hidden.
    var playType: String = "solo"
    @State private var days: [StatsDeepService.WeekdayFormDay] = []
    @State private var loaded = false

    private let labels = ["S", "M", "T", "W", "T", "F", "S"]
    private let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    private var best: StatsDeepService.WeekdayFormDay? {
        days.filter { $0.played >= 3 }
            .max { Double($0.won) / Double($0.played) < Double($1.won) / Double($1.played) }
    }

    var body: some View {
        Group {
            if !days.contains(where: { $0.played > 0 }), loaded, playType != "vs_cpu" {
                StatsEmptyCard(title: "Weekday Form", accent: Color(hex: 0xF97316),
                               hint: "Play across the week to see your win rate by day.")
            } else if days.contains(where: { $0.played > 0 }) {
                let maxPlayed = max(1, days.map(\.played).max() ?? 1)
                let hint = best.map { "Best: \(dayNames[$0.dow]) (\(Int((Double($0.won) / Double($0.played) * 100).rounded()))%)" }
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Weekday Form", accent: Color(hex: 0xF97316))
                    ChartCard(title: "Win rate by day", hint: hint) {
                        HStack(alignment: .bottom, spacing: 6) {
                            ForEach(days) { d in
                                let rate = d.played > 0 ? Double(d.won) / Double(d.played) : 0
                                VStack(spacing: 4) {
                                    Text(d.played > 0 ? "\(Int((rate * 100).rounded()))%" : " ")
                                        .font(Brand.font(8, .bold)).foregroundStyle(Theme.textMuted)
                                    ZStack(alignment: .bottom) {
                                        Color.clear.frame(height: 44)
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(d.played == 0 ? AnyShapeStyle(Theme.border)
                                                  : best?.dow == d.dow
                                                  ? AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xF97316)], startPoint: .top, endPoint: .bottom))
                                                  : AnyShapeStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)], startPoint: .top, endPoint: .bottom)))
                                            .frame(height: d.played == 0 ? 2 : 4.4 + rate * 39.6)
                                            .frame(maxWidth: .infinity)
                                            .opacity(d.played == 0 ? 1 : 0.5 + 0.5 * Double(d.played) / Double(maxPlayed))
                                    }
                                    Text(labels[d.dow]).font(Brand.font(9, .heavy)).foregroundStyle(Theme.textMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
        .task(id: playType) {
            let key = "weekdayForm:\(AuthService.shared.profile?.id ?? "anon"):\(playType)"
            if let cached: [StatsDeepService.WeekdayFormDay] = StatsMemo.shared.get(key) { days = cached }
            let fresh = await StatsDeepService.weekdayForm(playType: playType)
            days = fresh
            loaded = true
            StatsMemo.shared.set(key, fresh)
        }
    }
}

// MARK: - Daily points trend

/// Points-per-day line (sweep/flawless days marked) — split out of the old
/// sweep-counts card; the counts moved to Records → You (single home).
struct DailyPointsChartCard: View {
    @State private var points: [MatchStatsService.DailyPointsPoint] = []
    @State private var loaded = false

    var body: some View {
        Group {
            if points.count < 2, loaded {
                StatsEmptyCard(title: "Daily Points", accent: Color(hex: 0xEC4899),
                               hint: "Finish dailies on a few different days to chart your points.")
            } else if points.count >= 2 {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader("Daily Points", accent: Color(hex: 0xEC4899))
                    ChartCard(title: "Points per day", hint: "Last 30 days · ● sweep · ● flawless") {
                        Chart {
                            ForEach(points) { p in
                                LineMark(x: .value("Day", p.day), y: .value("Points", p.totalPoints))
                                    .foregroundStyle(Color(hex: 0x7C3AED)).interpolationMethod(.catmullRom)
                                AreaMark(x: .value("Day", p.day), y: .value("Points", p.totalPoints))
                                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA).opacity(0.3), .clear], startPoint: .top, endPoint: .bottom))
                                    .interpolationMethod(.catmullRom)
                                if p.swept || p.flawless {
                                    PointMark(x: .value("Day", p.day), y: .value("Points", p.totalPoints))
                                        .foregroundStyle(p.flawless ? Color(hex: 0xF59E0B) : Color(hex: 0xEC4899))
                                }
                            }
                        }
                        .chartXAxis(.hidden)
                        .frame(height: 110)
                    }
                }
            }
        }
        .task {
            let key = "dailyPoints:\(AuthService.shared.profile?.id ?? "anon")"
            if let cached: [MatchStatsService.DailyPointsPoint] = StatsMemo.shared.get(key) { points = cached }
            let fresh = await MatchStatsService.dailyPointsOverTime(days: 30)
            points = fresh
            loaded = true
            StatsMemo.shared.set(key, fresh)
        }
    }
}
