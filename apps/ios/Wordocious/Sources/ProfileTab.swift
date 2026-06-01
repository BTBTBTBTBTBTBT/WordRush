import SwiftUI
import WordociousCore

struct ProfileTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var showAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                content
            }
            .navigationTitle("Profile")
        }
    }

    @ViewBuilder
    private var content: some View {
        if let profile = auth.profile {
            ScrollView {
                VStack(spacing: 18) {
                    avatar(profile)
                    HStack(spacing: 6) {
                        Text(profile.username)
                            .font(Brand.title(22))
                            .foregroundStyle(Theme.textPrimary)
                        if auth.isProActive { proBadge }
                    }

                    statRow(profile)
                    medalRow(profile)

                    Button {
                        Task { await auth.signOut() }
                    } label: {
                        Text("Sign out")
                            .font(Brand.body(15))
                            .frame(maxWidth: .infinity).frame(height: 48)
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.textSecondary)
                    .padding(.top, 8)
                }
                .padding()
            }
        } else {
            VStack(spacing: 16) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 64)).foregroundStyle(Theme.textMuted)
                Text("Sign in to track your stats")
                    .font(Brand.headline())
                    .foregroundStyle(Theme.textPrimary)
                Button("Sign in") { showAuth = true }
                    .buttonStyle(.borderedProminent).tint(Theme.primary)
            }
            .sheet(isPresented: $showAuth) { AuthView() }
        }
    }

    private func avatar(_ p: Profile) -> some View {
        Circle()
            .fill(Theme.wordmarkGradient)
            .frame(width: 84, height: 84)
            .overlay(
                Text(String(p.username.prefix(1)).uppercased())
                    .font(Brand.title(34)).foregroundStyle(.white)
            )
    }

    private var proBadge: some View {
        Text("PRO")
            .font(Brand.caption(11))
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(Theme.wordmarkGradient))
    }

    private func statRow(_ p: Profile) -> some View {
        HStack(spacing: 12) {
            statCard("Level", "\(p.level)")
            statCard("Wins", "\(p.totalWins)")
            statCard("Streak", "\(p.dailyLoginStreak)")
        }
    }

    private func medalRow(_ p: Profile) -> some View {
        HStack(spacing: 12) {
            statCard("🥇", "\(p.goldMedals)")
            statCard("🥈", "\(p.silverMedals)")
            statCard("🥉", "\(p.bronzeMedals)")
        }
    }

    private func statCard(_ label: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(Brand.title(22)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.caption(12)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
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
