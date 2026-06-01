import SwiftUI
import WordociousCore

/// Profile — core match of app/profile/page.tsx: header (avatar, level
/// tier + XP, member since), Today's Dailies grid, Global Summary Row,
/// mode picker + per-mode stats. (Deferred to later passes: activity
/// calendar, guess-distribution / solve-time charts, top words, time-of-day
/// heatmap, Pro insights, edit modal, social links, notification toggle.)
struct ProfileTab: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var showAuth = false
    @State private var showPro = false
    @State private var statRows: [UserStatRow] = []
    @State private var selectedMode: GameMode = .duel

    private let dailyModes: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.mode != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                if let profile = auth.profile { content(profile) } else { signedOut }
            }
            .navigationBarTitleDisplayMode(.inline)
            .task(id: auth.profile?.id) {
                await completions.load()
                if let uid = auth.profile?.id { statRows = await UserStatsService.fetch(userId: uid) }
            }
        }
    }

    private var signedOut: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle").font(.system(size: 64)).foregroundStyle(Theme.textMuted)
            Text("Sign in to track your stats").font(Brand.headline()).foregroundStyle(Theme.textPrimary)
            Button("Sign in") { showAuth = true }.buttonStyle(.borderedProminent).tint(Theme.primary)
        }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private func content(_ p: Profile) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                header(p)
                todaysDailies
                globalSummary(p)
                HModePicker(selected: $selectedMode)
                modeStats(p)
                Button { Task { await auth.signOut() } } label: {
                    Text("Sign out").font(Brand.body(15)).frame(maxWidth: .infinity).frame(height: 46)
                }
                .buttonStyle(.bordered).tint(Theme.textSecondary)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
        }
    }

    // MARK: Header

    private func header(_ p: Profile) -> some View {
        let tier = levelTier(p.level)
        let progress = Double(p.xp % 1000) / 10.0
        let toNext = 1000 - (p.xp % 1000)
        return VStack(spacing: 10) {
            Circle().fill(Theme.wordmarkGradient).frame(width: 96, height: 96)
                .overlay(Text(String(p.username.prefix(1)).uppercased()).font(Brand.title(38)).foregroundStyle(.white))
            HStack(spacing: 6) {
                Text(p.username).font(Brand.title(28)).foregroundStyle(Theme.textPrimary)
                if auth.isProActive {
                    Text("PRO").font(Brand.caption(11)).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(Theme.wordmarkGradient))
                }
            }
            HStack(spacing: 6) {
                Image(systemName: "star.fill").font(.system(size: 12))
                Text("Level \(p.level)").font(Brand.caption(12))
                Text("·").opacity(0.7)
                Text(tier.label).font(Brand.caption(12))
            }
            .foregroundStyle(tier.color)
            .padding(.horizontal, 12).padding(.vertical, 5)
            .background(Capsule().fill(tier.bg)).overlay(Capsule().stroke(tier.border, lineWidth: 1.5))
            VStack(spacing: 2) {
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(width: 160, height: 6)
                    Capsule().fill(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xF97316)], startPoint: .leading, endPoint: .trailing))
                        .frame(width: 160 * progress / 100, height: 6)
                }
                Text("\(toNext) XP to next").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            if let since = memberSince(p) {
                Text("Member since \(since)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            if !auth.isProActive {
                Button { showPro = true } label: {
                    Text("Go Pro").font(Brand.font(13, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 18).padding(.vertical, 8)
                        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }
                .padding(.top, 2)
                .sheet(isPresented: $showPro) { ProView() }
            }
        }
    }

    private func levelTier(_ lvl: Int) -> (label: String, bg: Color, border: Color, color: Color) {
        if lvl >= 100 { return ("Diamond", Color(hex: 0xEFF6FF), Color(hex: 0xBFDBFE), Color(hex: 0x1D4ED8)) }
        if lvl >= 51 { return ("Platinum", Color(hex: 0xF5F3FF), Color(hex: 0xC4B5FD), Color(hex: 0x6D28D9)) }
        if lvl >= 26 { return ("Gold", Color(hex: 0xFEF9EC), Color(hex: 0xFDE68A), Color(hex: 0x92400E)) }
        if lvl >= 11 { return ("Silver", Color(hex: 0xF3F4F6), Color(hex: 0xD1D5DB), Color(hex: 0x374151)) }
        return ("Bronze", Color(hex: 0xFEF2E8), Color(hex: 0xFED7AA), Color(hex: 0x9A3412))
    }

    private func memberSince(_ p: Profile) -> String? {
        guard let c = p.createdAt, let d = parseTimestamp(c) else { return nil }
        let f = DateFormatter(); f.dateFormat = "MMM yyyy"; f.locale = Locale(identifier: "en_US")
        return f.string(from: d)
    }

    // MARK: Today's Dailies (5 + 4 grid)

    private var todaysDailies: some View {
        let completed = completions.completedCount
        let total = DailyCompletionsStore.totalDailyModes
        let allDone = completions.allDone
        let flawless = completions.flawless
        return VStack(spacing: 8) {
            if !allDone {
                HStack {
                    Text("TODAY'S DAILIES").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    Spacer()
                    Text("\(completed)/\(total)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
            VStack(spacing: 8) {
                if allDone {
                    Text(flawless ? "🏆 Flawless Victory!" : "✨ Daily Sweep!")
                        .font(Brand.font(16, .black)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Theme.primary)
                }
                HStack(spacing: 12) { ForEach(Array(dailyModes.prefix(5))) { m in dailyBadge(m) } }
                HStack(spacing: 12) { ForEach(Array(dailyModes.dropFirst(5))) { m in dailyBadge(m) } }
                if allDone {
                    Text(flawless ? "All \(total) dailies won today · +600 XP earned" : "All \(total) dailies completed · +200 XP earned")
                        .font(Brand.font(11, .heavy)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0x6D28D9))
                }
            }
            .padding(12).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(allDone ? (flawless ? Color(hex: 0xFEF3C7) : Color(hex: 0xF5F3FF)) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(allDone ? (flawless ? Color(hex: 0xF59E0B) : Color(hex: 0xC4B5FD)) : Theme.border, lineWidth: 1.5))
        }
    }

    private func dailyBadge(_ m: HomeMode) -> some View {
        let result = m.dbKey.flatMap { completions.byMode[$0] }
        let played = result != nil
        let won = result?.completed == true
        let bg: Color = !played ? Theme.background : won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626)
        let border: Color = !played ? Theme.border : won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626)
        return VStack(spacing: 3) {
            ZStack {
                RoundedRectangle(cornerRadius: 9).fill(bg).frame(width: 38, height: 38)
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(border, lineWidth: 1.5))
                if played {
                    Text(won ? "W" : "L").font(Brand.font(15, .black)).foregroundStyle(.white)
                } else {
                    ModeIconView(icon: m.icon, accent: m.accent, box: 30)
                }
            }
            Text(m.title).font(Brand.font(8, .bold)).foregroundStyle(played ? Theme.textPrimary : Theme.textMuted)
                .lineLimit(1)
        }
        .frame(width: 46)
    }

    // MARK: Global summary (4 cards)

    private func globalSummary(_ p: Profile) -> some View {
        let games = p.totalWins + p.totalLosses
        let winRate = games > 0 ? Int((Double(p.totalWins) / Double(games) * 100).rounded()) : 0
        return HStack(spacing: 8) {
            summaryCard("trophy.fill", Color(hex: 0x16A34A), "\(p.totalWins)", "Wins", nil)
            summaryCard("target", Color(hex: 0x2563EB), "\(winRate)%", "Win Rate", nil)
            summaryCard("bolt.fill", Theme.primary, "\(p.currentStreak)", "Streak", "Best: \(p.bestStreak)")
            summaryCard("flame.fill", Color(hex: 0xF97316), "\(p.dailyLoginStreak)", "Daily", "Best: \(p.bestDailyLoginStreak)")
        }
    }

    private func summaryCard(_ icon: String, _ color: Color, _ value: String, _ label: String, _ sub: String?) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(color)
            Text(value).font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Text(label.uppercased()).font(Brand.font(9, .bold)).tracking(0.4).foregroundStyle(Theme.textMuted)
            if let sub { Text(sub).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted) }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    // MARK: Per-mode stats (8 stats)

    private func modeStats(_ p: Profile) -> some View {
        let s = UserStatsService.aggregate(statRows, mode: selectedMode.rawValue)
        let winRate = s.totalGames > 0 ? Int((Double(s.wins) / Double(s.totalGames) * 100).rounded()) : 0
        let cells: [(String, String)] = [
            ("Wins", "\(s.wins)"), ("Losses", "\(s.losses)"), ("Games", "\(s.totalGames)"), ("Win Rate", "\(winRate)%"),
            ("Best", s.bestScore > 0 ? "\(s.bestScore)" : "-"), ("Fastest", fmtTime(s.fastestTime)),
            ("Streak", "\(s.winStreakCurrent)"), ("Best Streak", "\(s.winStreakBest)"),
        ]
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
            ForEach(cells, id: \.0) { c in
                VStack(spacing: 1) {
                    Text(c.1).font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
                    Text(c.0.uppercased()).font(Brand.font(9, .bold)).tracking(0.4).foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func fmtTime(_ s: Int) -> String {
        s <= 0 ? "-" : (s < 60 ? "\(s)s" : (s % 60 > 0 ? "\(s/60)m \(s%60)s" : "\(s/60)m"))
    }
}

/// Daily leaderboard — matches app/daily/page.tsx (full mode picker,
/// your-rank banner, rank icons, current-user highlight, win/loss pill,
/// yesterday toggle, player count).
struct LeaderboardTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var mode: GameMode = .duel
    @State private var entries: [LeaderboardEntry] = []
    @State private var yesterday: [LeaderboardEntry] = []
    @State private var userRank: (rank: Int, total: Int)?
    @State private var playerCount = 0
    @State private var loading = false
    @State private var showYesterday = false
    @State private var showAuth = false

    /// The 9 daily modes, in PROFILE_MODES order.
    private let pickerModes: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.mode != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                if !auth.isAuthenticated { signedOut } else { content }
            }
            .navigationTitle("Leaderboard")
        }
    }

    private var signedOut: some View {
        VStack(spacing: 16) {
            placeholder(icon: "trophy.fill", title: "Sign in to see rankings",
                        subtitle: "Daily leaderboards are available to signed-in players.")
            Button("Sign in") { showAuth = true }.buttonStyle(.borderedProminent).tint(Theme.primary)
        }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 12) {
                modePicker
                if let r = userRank { rankBanner(r) }

                Text("LEADERBOARD").font(Brand.font(10, .black)).tracking(0.8)
                    .foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading)

                if loading {
                    ProgressView().padding(.vertical, 40)
                } else if entries.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "trophy").font(.system(size: 32)).foregroundStyle(Theme.textMuted.opacity(0.4))
                        Text("No results yet. Be the first!").font(Brand.body(13)).foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 40)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(entries.enumerated()), id: \.element.id) { idx, entry in
                            row(rank: idx + 1, entry: entry)
                            if idx < entries.count - 1 { Divider().overlay(Theme.border) }
                        }
                    }
                    .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                }

                if playerCount > 0 {
                    Text("\(playerCount) player\(playerCount == 1 ? "" : "s") today")
                        .font(Brand.body(12)).foregroundStyle(Theme.textMuted)
                }

                Button { showYesterday.toggle(); if showYesterday { Task { await loadYesterday() } } } label: {
                    HStack(spacing: 6) {
                        Text("Yesterday's Winners").font(Brand.font(12, .heavy))
                        Image(systemName: showYesterday ? "chevron.up" : "chevron.down").font(.system(size: 11))
                    }.foregroundStyle(Theme.textMuted)
                }
                if showYesterday {
                    VStack(spacing: 0) {
                        ForEach(Array(yesterday.enumerated()), id: \.element.id) { idx, entry in
                            row(rank: idx + 1, entry: entry)
                            if idx < yesterday.count - 1 { Divider().overlay(Theme.border) }
                        }
                    }
                    .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
        }
        .task(id: mode) { await load() }
    }

    private var modePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(pickerModes) { m in
                    let active = m.mode == mode
                    Button { mode = m.mode! } label: {
                        HStack(spacing: 6) {
                            ModeIconView(icon: m.icon, accent: m.accent, box: 22)
                            Text(m.title).font(Brand.font(13, .heavy))
                                .foregroundStyle(active ? m.accent : Theme.textMuted)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func rankBanner(_ r: (rank: Int, total: Int)) -> some View {
        (Text("You're ranked ").font(Brand.body(12)).foregroundColor(Theme.textMuted)
         + Text("#\(r.rank)").font(Brand.title(18)).foregroundColor(Color(hex: 0xD97706))
         + Text(" of \(r.total)").font(Brand.body(12)).foregroundColor(Theme.textMuted))
            .frame(maxWidth: .infinity).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 16).fill(
                LinearGradient(colors: [Color(hex: 0xFFFBEB), Theme.surface], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))
    }

    @ViewBuilder
    private func rankIcon(_ rank: Int) -> some View {
        switch rank {
        case 1: Image(systemName: "crown.fill").foregroundStyle(Color(hex: 0xD97706))
        case 2: Image(systemName: "medal.fill").foregroundStyle(Theme.textMuted)
        case 3: Image(systemName: "medal.fill").foregroundStyle(Color(hex: 0xB45309))
        default: Text("\(rank)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted).frame(width: 20)
        }
    }

    private func row(rank: Int, entry: LeaderboardEntry) -> some View {
        let isMe = entry.userId == auth.profile?.id
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            (Text(entry.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(entry.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 5) {
                    Text(detail(entry)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    Text(entry.completed ? "Win" : "Loss").font(Brand.font(9, .heavy))
                        .foregroundStyle(entry.completed ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 4).fill(entry.completed ? Color(hex: 0xDCFCE7) : Color(hex: 0xFEE2E2)))
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Color(hex: 0xFFFBEB) : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func detail(_ e: LeaderboardEntry) -> String {
        let t = "\(Int(e.timeSeconds) / 60):\(String(format: "%02d", Int(e.timeSeconds) % 60))"
        var s = "\(e.guessCount) Guesses · \(t)"
        if e.totalBoards > 1 { s += " · \(e.boardsSolved)/\(e.totalBoards)" }
        if HINT_MODES.contains(mode.rawValue), let h = e.hintsUsed { s += h > 0 ? " · \(h) hint\(h == 1 ? "" : "s")" : " · No hints" }
        return s
    }

    private func load() async {
        loading = true
        async let e = try? LeaderboardService.fetch(gameMode: mode)
        async let pc = LeaderboardService.playerCount(gameMode: mode)
        entries = (await e) ?? []
        playerCount = await pc
        if let uid = auth.profile?.id { userRank = await LeaderboardService.userRank(gameMode: mode, userId: uid) }
        loading = false
    }

    private func loadYesterday() async {
        yesterday = (try? await LeaderboardService.fetch(gameMode: mode, day: LeaderboardService.yesterdayLocal(), limit: 3)) ?? []
    }
}

let HINT_MODES: Set<String> = ["DUEL_6", "DUEL_7", "PROPERNOUNDLE"]

/// All-time "hall of records" from Supabase all_time_records.
/// Mirrors app/records/page.tsx: RECORDS header + Daily | All-Time toggle.
struct RecordsTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var tab: RecordsSubTab = .daily   // web default
    @State private var showAuth = false

    enum RecordsSubTab { case daily, allTime }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                if !auth.isAuthenticated {
                    VStack(spacing: 16) {
                        placeholder(icon: "crown.fill", title: "Sign in to see records",
                                    subtitle: "Daily rankings and the all-time hall of records are available to signed-in players.")
                        Button("Sign in") { showAuth = true }.buttonStyle(.borderedProminent).tint(Theme.primary)
                    }
                    .sheet(isPresented: $showAuth) { AuthView() }
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            VStack(spacing: 3) {
                                Text("RECORDS").font(Brand.font(28, .black))
                                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                                Text("The best of the best across Wordocious")
                                    .font(Brand.body(12)).foregroundStyle(Theme.textMuted)
                            }
                            .padding(.top, 6)

                            HStack(spacing: 8) {
                                toggleButton("Daily", .daily)
                                toggleButton("All-Time", .allTime)
                            }

                            if tab == .daily { DailyRecordsView() } else { AllTimeRecordsView() }
                        }
                        .padding(.horizontal, 12).padding(.bottom, 16)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func toggleButton(_ label: String, _ value: RecordsSubTab) -> some View {
        let active = tab == value
        return Button { tab = value } label: {
            Text(label).font(Brand.font(13, .heavy))
                .foregroundStyle(active ? Theme.primary : Theme.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surface : Theme.surfaceHover))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }
}

/// All-Time records — Hall of Fame (global) + By Game Mode (mode picker).
struct AllTimeRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var records: [AllTimeRecord] = []
    @State private var mode: GameMode = .duel
    @State private var loading = true

    private let pickerModes: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.mode != nil }
    private var myId: String? { auth.profile?.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if loading { ProgressView().frame(maxWidth: .infinity).padding(.vertical, 30) } else {
                // Hall of Fame
                Text("HALL OF FAME").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2).fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xFDE68A)], startPoint: .leading, endPoint: .trailing)).frame(height: 3)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        ForEach(RecordCatalog.global, id: \.self) { rt in
                            RecordStatCell(type: rt, record: globalRecord(rt), accent: Color(hex: 0xD97706), isMe: globalRecord(rt)?.holderId == myId)
                        }
                    }
                    .padding(12).background(Color(hex: 0xFFFBEB))
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))

                // By Game Mode
                Text("BY GAME MODE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                HModePicker(selected: $mode)
                let m = pickerModes.first { $0.mode == mode }
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2).fill((m?.accent ?? Theme.primary)).frame(height: 3)
                    HStack(spacing: 10) {
                        if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                        Text(m?.title ?? mode.rawValue).font(Brand.headline(16)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                    }.padding(.horizontal, 12).padding(.top, 10)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        ForEach(RecordCatalog.perMode, id: \.self) { rt in
                            RecordStatCell(type: rt, record: modeRecord(rt), accent: m?.accent ?? Theme.primary, isMe: modeRecord(rt)?.holderId == myId)
                        }
                    }.padding(12)
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }
        }
        .task { if loading { records = (try? await RecordsService.fetchAll()) ?? []; loading = false } }
    }

    private func globalRecord(_ rt: String) -> AllTimeRecord? {
        records.first { $0.gameMode == nil && $0.recordType == rt }
    }
    private func modeRecord(_ rt: String) -> AllTimeRecord? {
        records.first { $0.gameMode == mode.rawValue && $0.recordType == rt }
    }
}

/// A single record stat — ports StatCell in records/page.tsx.
struct RecordStatCell: View {
    let type: String
    let record: AllTimeRecord?
    let accent: Color
    let isMe: Bool

    var body: some View {
        let meta = RecordCatalog.labels[type]
        let has = record != nil
        return HStack(alignment: .top, spacing: 8) {
            Image(systemName: meta?.symbol ?? "rosette").font(.system(size: 14))
                .foregroundStyle(has ? accent : Theme.textMuted).padding(.top, 2)
            VStack(alignment: .leading, spacing: 1) {
                Text(record?.formattedValue ?? "—").font(Brand.font(16, .black))
                    .foregroundStyle(has ? Theme.textPrimary : Theme.textMuted)
                Text(meta?.label ?? type).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                if has {
                    HStack(spacing: 3) {
                        Text(record?.holderUsername ?? "Unknown").font(Brand.font(10, .heavy)).lineLimit(1)
                            .foregroundStyle(isMe ? Color(hex: 0xD97706) : accent)
                        if isMe { Image(systemName: "crown.fill").font(.system(size: 8)).foregroundStyle(Color(hex: 0xD97706)) }
                    }.padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(isMe && has ? Color(hex: 0xFFFBEB) : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isMe && has ? Color(hex: 0xFDE68A) : Color.clear, lineWidth: 1))
    }
}

/// Daily records — leaderboard with mode picker + solo/vs toggle.
struct DailyRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var mode: GameMode = .duel
    @State private var playType = "solo"
    @State private var entries: [LeaderboardEntry] = []
    @State private var userRank: (rank: Int, total: Int)?
    @State private var loading = false

    var body: some View {
        VStack(spacing: 10) {
            HModePicker(selected: $mode)
            Picker("", selection: $playType) {
                Text("Solo").tag("solo"); Text("VS").tag("vs")
            }.pickerStyle(.segmented)

            if let r = userRank {
                (Text("You're ranked ").font(Brand.body(12)).foregroundColor(Theme.textMuted)
                 + Text("#\(r.rank)").font(Brand.title(18)).foregroundColor(Color(hex: 0xD97706))
                 + Text(" of \(r.total)").font(Brand.body(12)).foregroundColor(Theme.textMuted))
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color(hex: 0xFFFBEB)))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))
            }

            if loading {
                ProgressView().padding(.vertical, 30)
            } else if entries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.4))
                    Text("No results yet. Be the first!").font(Brand.body(13)).foregroundStyle(Theme.textMuted)
                }.frame(maxWidth: .infinity).padding(.vertical, 30)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { idx, e in
                        dailyRow(idx + 1, e)
                        if idx < entries.count - 1 { Divider().overlay(Theme.border) }
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }
        }
        .task(id: "\(mode.rawValue)-\(playType)") { await load() }
    }

    @ViewBuilder private func rankIcon(_ rank: Int) -> some View {
        switch rank {
        case 1: Image(systemName: "crown.fill").foregroundStyle(Color(hex: 0xD97706))
        case 2: Image(systemName: "medal.fill").foregroundStyle(Theme.textMuted)
        case 3: Image(systemName: "medal.fill").foregroundStyle(Color(hex: 0xB45309))
        default: Text("\(rank)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted).frame(width: 20)
        }
    }

    private func dailyRow(_ rank: Int, _ e: LeaderboardEntry) -> some View {
        let isMe = e.userId == auth.profile?.id
        let t = "\(Int(e.timeSeconds) / 60):\(String(format: "%02d", Int(e.timeSeconds) % 60))"
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            (Text(e.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(Int(e.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                Text("\(e.guessCount) Guesses · \(t)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Color(hex: 0xFFFBEB) : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func load() async {
        loading = true
        entries = (try? await LeaderboardService.fetch(gameMode: mode, playType: playType)) ?? []
        if let uid = auth.profile?.id { userRank = await LeaderboardService.userRank(gameMode: mode, userId: uid, playType: playType) }
        loading = false
    }
}

/// Shared horizontal mode picker (9 daily modes).
struct HModePicker: View {
    @Binding var selected: GameMode
    private let modes: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.mode != nil }
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(modes) { m in
                    let active = m.mode == selected
                    Button { selected = m.mode! } label: {
                        HStack(spacing: 6) {
                            ModeIconView(icon: m.icon, accent: m.accent, box: 22)
                            Text(m.title).font(Brand.font(13, .heavy)).foregroundStyle(active ? m.accent : Theme.textMuted)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
                    }.buttonStyle(.plain)
                }
            }
        }
    }
}

@ViewBuilder
func placeholder(icon: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 12) {
        Image(systemName: icon).font(.system(size: 56)).foregroundStyle(Theme.primary.opacity(0.7))
        Text(title).font(Brand.headline()).foregroundStyle(Theme.textPrimary)
        Text(subtitle).font(Brand.body(14)).foregroundStyle(Theme.textSecondary)
            .multilineTextAlignment(.center).padding(.horizontal, 40)
    }
}
