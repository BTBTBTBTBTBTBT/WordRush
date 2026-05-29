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
struct RecordsTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var records: [AllTimeRecord] = []
    @State private var loading = true
    @State private var error: String?
    @State private var showAuth = false

    private var globalRecords: [AllTimeRecord] {
        records.filter { $0.gameMode == nil && RecordCatalog.global.contains($0.recordType) }
    }
    private var classicRecords: [AllTimeRecord] {
        records.filter { $0.gameMode == "DUEL" && RecordCatalog.perMode.contains($0.recordType) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                if !auth.isAuthenticated {
                    VStack(spacing: 16) {
                        placeholder(icon: "crown.fill", title: "Sign in to see records",
                                    subtitle: "The all-time hall of records is available to signed-in players.")
                        Button("Sign in") { showAuth = true }
                            .buttonStyle(.borderedProminent).tint(Theme.primary)
                    }
                    .sheet(isPresented: $showAuth) { AuthView() }
                } else if loading {
                    ProgressView()
                } else if let error {
                    placeholder(icon: "exclamationmark.triangle", title: "Couldn't load", subtitle: error)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            section("Global Records", types: RecordCatalog.global, from: globalRecords)
                            section("Classic", types: RecordCatalog.perMode, from: classicRecords)
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Records")
            .task(id: auth.isAuthenticated) { if auth.isAuthenticated { await load() } }
        }
    }

    private func section(_ title: String, types: [String], from pool: [AllTimeRecord]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(Brand.title(18)).foregroundStyle(Theme.textPrimary)
            ForEach(types, id: \.self) { type in
                recordCard(type, record: pool.first { $0.recordType == type })
            }
        }
    }

    private func recordCard(_ type: String, record: AllTimeRecord?) -> some View {
        let meta = RecordCatalog.labels[type]
        return HStack(spacing: 12) {
            Image(systemName: meta?.symbol ?? "rosette")
                .font(.title3).foregroundStyle(Theme.primary)
                .frame(width: 38, height: 38)
                .background(RoundedRectangle(cornerRadius: 9).fill(Theme.surfaceAlt))
            VStack(alignment: .leading, spacing: 2) {
                Text(meta?.label ?? type).font(Brand.headline(15)).foregroundStyle(Theme.textPrimary)
                Text(record?.holderUsername ?? "No record yet")
                    .font(Brand.body(13)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Text(record?.formattedValue ?? "—")
                .font(Brand.title(16)).foregroundStyle(record == nil ? Theme.textMuted : Theme.primary)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }

    private func load() async {
        loading = true; error = nil
        do { records = try await RecordsService.fetchAll() }
        catch { self.error = error.localizedDescription }
        loading = false
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
