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
    @State private var selectedMode: GameMode? = nil   // nil == "All" (global view)
    // Solo/VS toggle (mirrors the web personal profile) — filters user_stats by play_type.
    @State private var activeTab = "solo"
    @State private var unlockedAchievements: Set<String> = []
    @State private var medals: [MedalRow] = []
    @State private var socialLinks: [String: String] = [:]
    @State private var recentMatches: [PublicProfileService.RecentMatch] = []
    @State private var opponentNames: [String: String] = [:]
    @State private var recentLoading = true
    @State private var showEditProfile = false

    // Mode-picker (per-mode stats) only covers modes backed by a GameMode enum.
    private let dailyModes: [HomeMode] = homeModes.filter { $0.dbKey != nil && $0.mode != nil }
    // Today's-Dailies grid covers all 9 daily-recordable modes — including
    // ProperNoundle, which has a dbKey but no GameMode (its own engine). VS is
    // excluded (no daily row).
    private let dailyTiles: [HomeMode] = homeModes.filter { $0.dbKey != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 0) {
                    AppHeaderView()   // shared header (settings now lives here)
                    if let profile = auth.profile { content(profile) } else { signedOut }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .task(id: auth.profile?.id) {
                await completions.load()
                if let uid = auth.profile?.id {
                    statRows = await UserStatsService.fetch(userId: uid)
                    unlockedAchievements = await AchievementService.fetchUnlocked(userId: uid)
                    medals = await MedalsService.recent(userId: uid)
                    socialLinks = await ProfileExtras.socialLinks(userId: uid)
                    recentMatches = await PublicProfileService.recentMatches(id: uid)
                    let oppIds = Array(Set(recentMatches.compactMap { $0.opponentId(uid) }))
                    opponentNames = await PublicProfileService.usernames(ids: oppIds)
                    recentLoading = false
                }
            }
            // Banner inside the NavigationStack so the ScrollView insets for it
            // (the Sign-out button stays scrollable above the banner) and it
            // doesn't leak onto pushed detail views.
            .adBanner()
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
                medalsSection(p)
                soloVsToggle
                if activeTab == "vs" { vsRecordCard }
                ProfileModePicker(modes: dailyModes, games: UserStatsService.gamesPerMode(filteredStats), selected: $selectedMode)
                if let mode = selectedMode { modeStats(p, mode: mode) }
                ProfileDashboard(mode: selectedMode)
                recentMatchesSection(p)
                achievementsSection
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
            AvatarView(url: p.avatarUrl, username: p.username, size: 96)
            HStack(spacing: 6) {
                Text(p.username).font(Brand.title(28)).foregroundStyle(Theme.textPrimary)
                if auth.isProActive {
                    Text("PRO").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
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
            Button { showEditProfile = true } label: {
                Label("Edit profile", systemImage: "pencil").font(Brand.font(12, .heavy)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .background(Capsule().fill(Theme.surfaceHover))
                    .overlay(Capsule().stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
            }
            .padding(.top, 2)
            .sheet(isPresented: $showEditProfile) { EditProfileView() }
            socialLinksRow()
            if !auth.isProActive {
                Button { showPro = true } label: {
                    Text("Go Pro").font(Brand.font(12, .heavy)).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 6)
                        .background(RoundedRectangle(cornerRadius: 8).fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .shadow(color: Color(hex: 0x92400E), radius: 0, x: 0, y: 2))
                }
                .padding(.top, 2)
                .sheet(isPresented: $showPro) { ProView() }
            }
            // DEV-ONLY: Simulate Pro toggle — flips is_pro so free-vs-Pro gating
            // can be exercised in testing. Gated on profiles.is_admin so it
            // renders ONLY for the developer's account (never for App Review or
            // real users; mirrors the web gate).
            if auth.profile?.isAdmin == true {
                let isPro = auth.isProActive
                Button { Task { await auth.setSimulatePro(!isPro) } } label: {
                    Text(isPro ? "Disable Pro" : "Simulate Pro").font(Brand.font(12, .heavy))
                        .foregroundStyle(isPro ? Color(hex: 0xDC2626) : Color(hex: 0x16A34A))
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(RoundedRectangle(cornerRadius: 8).fill(isPro ? Color(hex: 0xFEF2F2) : Color(hex: 0xF0FDF4)))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isPro ? Color(hex: 0xFCA5A5) : Color(hex: 0x86EFAC), lineWidth: 1.5))
                }
                .padding(.top, 2)
            }
        }
    }

    private let socialOrder = ["twitter", "instagram", "tiktok", "threads", "discord", "website"]

    @ViewBuilder
    private func socialLinksRow() -> some View {
        let links = socialLinks.filter { !$0.value.isEmpty }
        if !links.isEmpty {
            HStack(spacing: 8) {
                ForEach(socialOrder.filter { links[$0] != nil }, id: \.self) { key in
                    if let handle = links[key], let url = socialURL(key, handle) {
                        Link(destination: url) {
                            Image(systemName: key == "website" ? "globe" : (key == "discord" ? "message.fill" : "at"))
                                .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                                .frame(width: 30, height: 30)
                                .background(Circle().fill(Theme.surfaceHover))
                                .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                        }
                    }
                }
            }
            .padding(.top, 4)
        }
    }

    private func socialURL(_ key: String, _ handle: String) -> URL? {
        let h = handle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? handle
        switch key {
        case "twitter": return URL(string: "https://twitter.com/\(h)")
        case "instagram": return URL(string: "https://instagram.com/\(h)")
        case "tiktok": return URL(string: "https://tiktok.com/@\(h)")
        case "threads": return URL(string: "https://threads.net/@\(h)")
        case "discord": return URL(string: "https://discord.com/users/\(h)")
        case "website": return URL(string: handle.hasPrefix("http") ? handle : "https://\(handle)")
        default: return nil
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
                    HStack(spacing: 8) {
                        Image(systemName: flawless ? "trophy.fill" : "sparkles")
                            .font(.system(size: flawless ? 18 : 15)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0x7C3AED))
                        Text(flawless ? "Flawless Victory!" : "Daily Sweep!")
                            .font(Brand.font(16, .black))
                            .foregroundStyle(LinearGradient(colors: flawless ? [Color(hex: 0xD97706), Color(hex: 0xB45309)] : [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        Image(systemName: flawless ? "trophy.fill" : "sparkles")
                            .font(.system(size: flawless ? 18 : 15)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0xEC4899))
                    }
                }
                HStack(spacing: 12) { ForEach(Array(dailyTiles.prefix(5))) { m in dailyBadge(m) } }
                HStack(spacing: 12) { ForEach(Array(dailyTiles.dropFirst(5))) { m in dailyBadge(m) } }
                if allDone {
                    Text(flawless ? "All \(total) dailies won today · +600 XP earned" : "All \(total) dailies completed · +200 XP earned")
                        .font(Brand.font(11, .heavy)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0x6D28D9))
                }
            }
            .padding(12).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(allDone
                ? AnyShapeStyle(LinearGradient(colors: flawless ? [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)] : [Color(hex: 0xF5F3FF), Color(hex: 0xFCE7F3)], startPoint: .topLeading, endPoint: .bottomTrailing))
                : AnyShapeStyle(Theme.surface)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(allDone ? (flawless ? Color(hex: 0xF59E0B) : Color(hex: 0xC4B5FD)) : Theme.border, lineWidth: 1.5))
        }
    }

    private func dailyBadge(_ m: HomeMode) -> some View {
        let result = m.dbKey.flatMap { completions.byMode[$0] }
        let played = result != nil
        let won = result?.completed == true
        let bg: Color = !played ? Theme.background : won ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626)
        let border: Color = !played ? Theme.border : won ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626)
        // Tappable like the web: played → read-only solved board; not played → play it.
        return NavigationLink {
            if let gm = m.mode {
                if played { SolvedPuzzleView(mode: gm, title: m.title) }
                else { GameScreen(seed: DailySeed.today(mode: gm), mode: gm, title: m.title) }
            } else if m.id == "propernoundle" {
                // ProperNoundle has its own engine (no GameMode); the view
                // restores the completed daily board when already played.
                ProperNoundleView()
            }
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12).fill(bg).frame(width: 36, height: 36)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(border, lineWidth: 1.5))
                    if played {
                        Text(won ? "W" : "L").font(Brand.font(14, .black)).foregroundStyle(.white)
                    } else {
                        ModeIconView(icon: m.icon, accent: m.accent, box: 26)
                    }
                }
                .opacity(played ? 1 : 0.7)
                Text(m.title).font(Brand.font(8, .bold)).foregroundStyle(played ? Theme.textPrimary : Theme.textMuted)
                    .lineLimit(1)
            }
            .frame(width: 42)
        }
        .buttonStyle(.plain)
    }

    // MARK: Global summary (4 cards)

    private func globalSummary(_ p: Profile) -> some View {
        let games = p.totalWins + p.totalLosses
        let winRate = games > 0 ? Int((Double(p.totalWins) / Double(games) * 100).rounded()) : 0
        return HStack(spacing: 8) {
            summaryCard("trophy.fill", Color(hex: 0x7C3AED), "\(p.totalWins)", "Wins", nil)
            summaryCard("target", Color(hex: 0x2563EB), "\(winRate)%", "Win Rate", nil)
            summaryCard("bolt.fill", Theme.primary, "\(p.currentStreak)", "Streak", "Best: \(p.bestStreak)")
            summaryCard("flame.fill", Color(hex: 0xF97316), "\(p.dailyLoginStreak)", "Daily", "Best: \(p.bestDailyLoginStreak)")
        }
    }

    private func summaryCard(_ icon: String, _ color: Color, _ value: String, _ label: String, _ sub: String?) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 16)).foregroundStyle(color)
            Text(value).font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Text(label.uppercased()).font(Brand.font(9, .bold)).tracking(0.4).foregroundStyle(Theme.textMuted)
            // Always reserve the sub line so all four cards are the same height.
            Text(sub ?? " ").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    // MARK: Daily Medals (ports the web profile medals section)

    /// The signed-in user's own recent matches (solo + VS), mirroring the web
    /// profile's Recent Matches list and the public-profile view. Shows up to 5;
    /// VS rows (player2 set) render as "VS Match". Shares RecentMatchRow with the
    /// public profile so both are pixel-identical.
    @ViewBuilder private func recentMatchesSection(_ p: Profile) -> some View {
        // Web parity (profile/page.tsx): skeleton rows while loading, then either
        // the matches or "No matches played yet." — the section never just vanishes.
        VStack(alignment: .leading, spacing: 8) {
            Text("RECENT MATCHES").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            if recentLoading {
                VStack(spacing: 8) {
                    ForEach(0..<5, id: \.self) { _ in SkeletonBlock(height: 52, cornerRadius: 12) }
                }
            } else if recentMatches.isEmpty {
                Text("No matches played yet.").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(recentMatches.prefix(5)) { m in
                        RecentMatchRow(
                            match: m, profileId: p.id,
                            opponentName: m.opponentId(p.id).map { opponentNames[$0] ?? "Unknown" })
                    }
                }
            }
        }
    }

    private func medalsSection(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("DAILY MEDALS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    medalCount("crown.fill", p.goldMedals, "Gold", Color(hex: 0xD97706))
                    medalCount("medal.fill", p.silverMedals, "Silver", Theme.textMuted)
                    medalCount("medal.fill", p.bronzeMedals, "Bronze", Color(hex: 0xB45309))
                }
                if !medals.isEmpty {
                    VStack(spacing: 6) { ForEach(medals) { m in medalRow(m) } }
                }
            }
            .padding(12).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    private func medalCount(_ icon: String, _ count: Int, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 22)).foregroundStyle(color)
            Text("\(count)").font(Brand.font(18, .black)).foregroundStyle(color)
            Text(label).font(Brand.font(9, .heavy)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
    }

    private func medalRow(_ m: MedalRow) -> some View {
        let icon: String, color: Color, label: String
        switch m.medalType {
        case "gold":      (icon, color) = ("crown.fill", Color(hex: 0xD97706))
        case "silver":    (icon, color) = ("medal.fill", Theme.textMuted)
        case "bronze":    (icon, color) = ("medal.fill", Color(hex: 0xB45309))
        case "streak_7":  (icon, color) = ("flame.fill", Color(hex: 0xEA580C))
        case "streak_30": (icon, color) = ("flame.fill", Color(hex: 0xDC2626))
        case "streak_100":(icon, color) = ("flame.fill", Color(hex: 0x7C3AED))
        case "perfect":   (icon, color) = ("star.fill", Color(hex: 0x7C3AED))
        default:          (icon, color) = ("medal.fill", Theme.textMuted)
        }
        switch m.medalType {
        case "streak_7": label = "7-Day Streak"
        case "streak_30": label = "30-Day Streak"
        case "streak_100": label = "100-Day Streak"
        case "perfect": label = "Perfect!"
        default: label = m.gameMode.flatMap { GameMode(rawValue: $0).map { ModeStyle.title($0) } } ?? (m.gameMode ?? "")
        }
        return HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(color)
            Text(label).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
            Spacer()
            Text(shortMedalDate(m.day)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
        }
        .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
    }

    private func shortMedalDate(_ day: String) -> String {
        let inF = DateFormatter(); inF.dateFormat = "yyyy-MM-dd"
        guard let d = inF.date(from: day) else { return day }
        let outF = DateFormatter(); outF.dateFormat = "MMM d"
        return outF.string(from: d)
    }

    // MARK: Per-mode stats (8 stats)

    // MARK: Achievements (collapsible grid)

    private var achievementsSection: some View {
        CollapsibleSection(title: "ACHIEVEMENTS", badge: "\(unlockedAchievements.count)/\(AchievementService.all.count)") {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(AchievementService.all) { a in
                    let on = unlockedAchievements.contains(a.key)
                    VStack(spacing: 2) {
                        Text(on ? "✓" : "?").font(Brand.font(18, .black)).foregroundStyle(on ? Theme.primary : Theme.textMuted)
                        Text(a.name).font(Brand.font(10, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                        Text(a.description).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                            .multilineTextAlignment(.center).lineLimit(3)
                    }
                    .padding(10).frame(maxWidth: .infinity, minHeight: 84, alignment: .top)
                    .background(RoundedRectangle(cornerRadius: 12).fill(on ? Color(hex: 0xF3F0FF) : Color(hex: 0xFAFAFA)))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Color(hex: 0xC4B5FD) : Theme.border, lineWidth: 1.5))
                    .opacity(on ? 1 : 0.4)
                }
            }
        }
    }

    // MARK: Solo/VS toggle + VS RECORD card (ports profile/page.tsx section D)

    /// Stats filtered to the active Solo/VS tab.
    private var filteredStats: [UserStatRow] { statRows.filter { $0.playType == activeTab } }

    private var soloVsToggle: some View {
        HStack(spacing: 8) {
            ForEach(["solo", "vs"], id: \.self) { t in
                let active = activeTab == t
                Button { activeTab = t } label: {
                    HStack(spacing: 6) {
                        if t == "solo" {
                            Image(systemName: "person.fill").font(.system(size: 12, weight: .bold))
                        } else {
                            Image("swords").renderingMode(.template).resizable().scaledToFit()
                                .frame(width: 14, height: 14)
                        }
                        Text(t == "solo" ? "Solo" : "VS").font(Brand.font(12, .heavy))
                    }
                    .foregroundStyle(active ? Theme.primary : Theme.textMuted)
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surface : Theme.surfaceHover))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
            Spacer()
        }
    }

    /// "VS RECORD" summary card (VS tab only): aggregate W–L, win rate, total.
    private var vsRecordCard: some View {
        let rec = UserStatsService.vsRecord(statRows)
        return HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Theme.primary.opacity(0.08))
                    .frame(width: 40, height: 40)
                Image("swords").renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 20, height: 20).foregroundStyle(Theme.primary)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("VS RECORD").font(Brand.font(10, .heavy)).tracking(0.8)
                    .foregroundStyle(Color(hex: 0x6D28D9))
                Text("\(rec.wins)–\(rec.losses)").font(Brand.font(20, .black))
                    .foregroundStyle(Theme.textPrimary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(rec.winRate)%").font(Brand.font(20, .black)).foregroundStyle(Theme.primary)
                Text("WIN RATE · \(rec.total) \(rec.total == 1 ? "MATCH" : "MATCHES")")
                    .font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(
            colors: [Color(hex: 0xF5F3FF), Color(hex: 0xFCE7F3)],
            startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
    }

    private func modeStats(_ p: Profile, mode: GameMode) -> some View {
        let s = UserStatsService.aggregate(filteredStats, mode: mode.rawValue)
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

/// Profile mode picker — ports components/profile/mode-picker.tsx: a leading
/// "All" chip (global view) then a vertical chip per mode (icon tile on top,
/// short title, games-count badge). nil selection == All.
private struct ProfileModePicker: View {
    let modes: [HomeMode]
    let games: [String: Int]
    @Binding var selected: GameMode?

    private let shortTitles: [String: String] = [
        "practice": "Classic", "quordle": "Quad", "octordle": "Octo", "sequence": "Succ",
        "rescue": "Deliv", "six": "Six", "seven": "Seven", "gauntlet": "Gauntlet", "propernoundle": "Proper",
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                allChip
                ForEach(modes) { m in modeChip(m) }
            }
            .padding(.horizontal, 1)
        }
    }

    private var allChip: some View {
        let active = selected == nil
        return Button { selected = nil } label: {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(active ? Theme.primary.opacity(0.08) : Theme.surfaceAlt)
                        .frame(width: 28, height: 28)
                    Image(systemName: "chart.bar.fill").font(.system(size: 13)).foregroundStyle(active ? Theme.primary : Theme.textMuted)
                }
                Text("All").font(Brand.font(10, .heavy)).foregroundStyle(active ? Theme.primary : Theme.textMuted)
                Text(" ").font(Brand.font(8, .bold))   // reserve the games-count line so heights match
            }
            .frame(minWidth: 62).padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surfaceHover : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
    }

    private func modeChip(_ m: HomeMode) -> some View {
        let active = selected == m.mode
        let count = m.mode.flatMap { games[$0.rawValue] } ?? 0
        return Button { selected = active ? nil : m.mode } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: m.icon, accent: m.accent, box: 28)
                Text(shortTitles[m.id] ?? m.title).font(Brand.font(10, .heavy))
                    .foregroundStyle(active ? m.accent : Theme.textMuted).lineLimit(1)
                Text(count > 0 ? "\(count)" : " ").font(Brand.font(8, .bold)).foregroundStyle(Theme.textMuted)
            }
            .frame(minWidth: 62).padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
    }
}

/// Daily leaderboard — matches app/daily/page.tsx (full mode picker,
/// your-rank banner, rank icons, current-user highlight, win/loss pill,
/// yesterday toggle, player count).
struct LeaderboardTab: View {
    @EnvironmentObject private var auth: AuthService
    /// Owned by RootTabView so tab gestures can pop it to root.
    @Binding var path: [String]
    @State private var mode: GameMode = .duel
    @State private var entries: [LeaderboardEntry] = []
    @State private var yesterday: [LeaderboardEntry] = []
    @State private var userRank: (rank: Int, total: Int)?
    @State private var playerCount = 0
    @State private var loading = false
    @State private var showYesterday = false
    @State private var showAuth = false
    @State private var secondsLeft = secondsUntilLocalMidnight()
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    /// All 9 daily-recordable modes (incl. ProperNoundle, which has a dbKey but
    /// no GameMode enum on its HomeMode — its leaderboard keys off the dbKey).
    /// VS is excluded (no daily leaderboard).
    private let pickerModes: [HomeMode] = homeModes.filter { $0.dbKey != nil }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 0) {
                    AppHeaderView()
                    if !auth.isAuthenticated { signedOut } else { content }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            .adBanner()
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("DAILY CHALLENGE").font(Brand.font(28, .black)).tracking(-0.5)
                .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .topLeading, endPoint: .bottomTrailing))
            HStack(spacing: 12) {
                HStack(spacing: 4) {
                    Image(systemName: "calendar").font(.system(size: 11))
                    Text(Date().formatted(.dateTime.month(.abbreviated).day()))
                }
                HStack(spacing: 4) {
                    Image(systemName: "clock").font(.system(size: 11))
                    Text(String(format: "%02d:%02d:%02d", secondsLeft / 3600, (secondsLeft % 3600) / 60, secondsLeft % 60)).monospacedDigit()
                }
            }
            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.bottom, 4)
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
                header
                HModePicker(selected: $mode)
                CompletedDailyCard(mode: mode)
                if let r = userRank { rankBanner(r) }

                Text("LEADERBOARD").font(Brand.font(10, .black)).tracking(0.8)
                    .foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading)

                if loading {
                    LeaderboardSkeleton()   // web parity: animate-pulse rows, not a spinner
                } else if entries.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "trophy").font(.system(size: 32)).foregroundStyle(Theme.textMuted.opacity(0.4))
                        Text("No results yet. Be the first!").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
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
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 11))
                        Text("\(playerCount) player\(playerCount == 1 ? "" : "s") today").font(Brand.font(10, .bold))
                    }.foregroundStyle(Theme.textMuted)
                }

                Button { showYesterday.toggle(); if showYesterday { Task { await loadYesterday() } } } label: {
                    HStack(spacing: 6) {
                        Text("Yesterday's Winners").font(Brand.font(12, .heavy))
                        Image(systemName: showYesterday ? "chevron.up" : "chevron.down").font(.system(size: 11))
                    }.foregroundStyle(Theme.textMuted)
                }
                if showYesterday {
                    if yesterday.isEmpty {
                        Text("No results from yesterday")
                            .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).padding(24).multilineTextAlignment(.center)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(yesterday.enumerated()), id: \.element.id) { idx, entry in
                                yesterdayRow(rank: idx + 1, entry: entry)
                                if idx < yesterday.count - 1 { Divider().overlay(Theme.border) }
                            }
                        }
                        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
        }
        .task(id: mode) { await load() }
        .onReceive(ticker) { _ in secondsLeft = secondsUntilLocalMidnight() }
    }

    /// Compact yesterday row — RankIcon, name, small W/L pill, composite score (muted).
    private func yesterdayRow(rank: Int, entry: LeaderboardEntry) -> some View {
        HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            Text(entry.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            Spacer()
            Text(entry.completed ? "W" : "L").font(Brand.font(9, .heavy))
                .foregroundStyle(entry.completed ? Theme.winText : Theme.lossText)
                .padding(.horizontal, 5).padding(.vertical, 1)
                .background(RoundedRectangle(cornerRadius: 4).fill(entry.completed ? Theme.winBG : Theme.lossBG))
            Text("\(Int(entry.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(Theme.textMuted)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }


    private func rankBanner(_ r: (rank: Int, total: Int)) -> some View {
        HStack(spacing: 3) {
            (Text("You're ranked ").font(Brand.body(12)).foregroundColor(Theme.textMuted)
             + Text("#\(r.rank)").font(Brand.title(18)).foregroundColor(Color(hex: 0xD97706)))
            // Transient "+N/−N" movement pill since you last looked (web parity).
            RankDeltaBadge(mode: mode.rawValue, playType: "solo", pageKey: "daily", currentRank: r.rank)
            Text(" of \(r.total)").font(Brand.body(12)).foregroundColor(Theme.textMuted)
        }
            .frame(maxWidth: .infinity).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 16).fill(
                LinearGradient(colors: [Theme.highlightGold, Theme.surface], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.goldBorder, lineWidth: 1.5))
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
            // Only the username links to the public profile — matches the web,
            // where the leaderboard wraps just the name in <Link href=/profile/[id]>.
            NavigationLink(value: entry.userId) {
                (Text(entry.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                    .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            }.buttonStyle(.plain)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(entry.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 5) {
                    Text(detail(entry)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    Text(entry.completed ? "Win" : "Loss").font(Brand.font(9, .heavy))
                        .foregroundStyle(entry.completed ? Theme.winText : Theme.lossText)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 4).fill(entry.completed ? Theme.winBG : Theme.lossBG))
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func detail(_ e: LeaderboardEntry) -> String {
        // Web parity: time as "Ns" / "Nm Ns" (formatTime in app/daily/page.tsx), not M:SS.
        let t = formatShortTime(Int(e.timeSeconds))
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
                VStack(spacing: 0) {
                    AppHeaderView()
                    content
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            // Tapping a record holder / daily-row username opens their public profile
            // (web parity — Records links names to /profile/[id]).
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
            .adBanner()
        }
    }

    @ViewBuilder private var content: some View {
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

    private func toggleButton(_ label: String, _ value: RecordsSubTab) -> some View {
        let active = tab == value
        return Button { tab = value } label: {
            Text(label).font(Brand.font(12, .heavy))
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

    private let pickerModes: [HomeMode] = homeModes.filter { $0.dbKey != nil }
    private var myId: String? { auth.profile?.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if loading { CardsSkeleton() } else {   // web parity: AllTimeSkeleton card blocks
                // Hall of Fame
                Text("HALL OF FAME").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2).fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Theme.goldBorder], startPoint: .leading, endPoint: .trailing)).frame(height: 3)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        ForEach(RecordCatalog.global, id: \.self) { rt in
                            RecordStatCell(type: rt, record: globalRecord(rt), accent: Color(hex: 0xD97706), isMe: globalRecord(rt)?.holderId == myId)
                        }
                    }
                    .padding(16)
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                // Clip so the 3pt top accent bar's square corners don't poke
                // past the card's rounded corners.
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.goldBorder, lineWidth: 1.5))

                // By Game Mode
                Text("BY GAME MODE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                HModePicker(selected: $mode)
                let m = pickerModes.first { $0.dbKey == mode.rawValue }
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2).fill((m?.accent ?? Theme.primary)).frame(height: 3)
                    HStack(spacing: 10) {
                        if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                        Text(m?.title ?? mode.rawValue).font(Brand.headline(16)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                    }.padding(.horizontal, 12).padding(.top, 10)
                    if RecordCatalog.perMode.contains(where: { modeRecord($0) != nil }) {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(RecordCatalog.perMode, id: \.self) { rt in
                                RecordStatCell(type: rt, record: modeRecord(rt), accent: m?.accent ?? Theme.primary, isMe: modeRecord(rt)?.holderId == myId)
                            }
                        }
                        .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 16)
                    } else {
                        // Web parity (records page): trophy + "No records yet" instead of a dash grid.
                        VStack(spacing: 8) {
                            Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                            Text("No records yet").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 24)
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                // Clip the 3pt top accent bar to the card's rounded corners.
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }
        }
        .task { if loading { records = (try? await RecordsService.fetchAll()) ?? []; loading = false } }
    }

    private func globalRecord(_ rt: String) -> AllTimeRecord? {
        records.first { $0.gameMode == nil && $0.recordType == rt }
    }
    private func modeRecord(_ rt: String) -> AllTimeRecord? {
        // A mode can have both a solo and a VS record per type; the per-mode
        // card represents solo play, so prefer the solo row (else fall back to
        // whatever exists). Without this, e.g. Classic "Most Games Played" could
        // show the tiny VS count instead of the solo total.
        let matches = records.filter { $0.gameMode == mode.rawValue && $0.recordType == rt }
        return matches.first { $0.playType == "solo" } ?? matches.first
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
                    NavigationLink(value: record?.holderId ?? "") {
                        HStack(spacing: 3) {
                            Text(record?.holderUsername ?? "Unknown").font(Brand.font(10, .heavy)).lineLimit(1)
                                .foregroundStyle(isMe ? Color(hex: 0xD97706) : accent)
                            if isMe { Image(systemName: "crown.fill").font(.system(size: 8)).foregroundStyle(Color(hex: 0xD97706)) }
                        }.padding(.top, 2)
                    }.buttonStyle(.plain)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(isMe && has ? Theme.highlightGold : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isMe && has ? Theme.goldBorder : Color.clear, lineWidth: 1))
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

    private var accent: Color { homeModes.first { $0.dbKey == mode.rawValue }?.accent ?? Theme.primary }

    /// Custom inline Solo|VS toggle matching the web (icon + accent active state),
    /// replacing the iOS segmented control.
    private var soloVsToggle: some View {
        HStack(spacing: 0) {
            ForEach(["solo", "vs"], id: \.self) { t in
                let active = playType == t
                Button { playType = t } label: {
                    HStack(spacing: 4) {
                        Image(systemName: t == "solo" ? "person.fill" : "flag.2.crossed.fill").font(.system(size: 12))
                        Text(t == "solo" ? "Solo" : "VS").font(Brand.font(10, .heavy))
                    }
                    .foregroundStyle(active ? accent : Theme.textMuted)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .background(active ? accent.opacity(0.08) : Theme.surface)
                }.buttonStyle(.plain)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1.5))
        .fixedSize()
    }

    var body: some View {
        let m = homeModes.first { $0.dbKey == mode.rawValue }
        let total = userRank?.total ?? entries.count
        return VStack(spacing: 10) {
            HModePicker(selected: $mode)

            // Single leaderboard card: accent bar → header (mode + Today + toggle)
            // → player-count/your-rank row → rows. Mirrors records/page.tsx.
            VStack(spacing: 0) {
                LinearGradient(colors: [accent, accent.opacity(0.53)], startPoint: .leading, endPoint: .trailing).frame(height: 3)

                HStack(spacing: 10) {
                    if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(m?.title ?? mode.rawValue).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                        Text("Today").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                    soloVsToggle
                }
                .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 8)

                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 11))
                        Text("\(total) player\(total == 1 ? "" : "s") today").font(Brand.font(10, .bold))
                    }.foregroundStyle(Theme.textMuted)
                    Spacer()
                    if let r = userRank {
                        HStack(spacing: 3) {
                            (Text("Your rank: ").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                             + Text("#\(r.rank)").font(Brand.font(12, .black)).foregroundColor(Color(hex: 0xD97706)))
                            // Transient "+N/−N" movement pill (web parity, pageKey records-daily).
                            RankDeltaBadge(mode: mode.rawValue, playType: playType, pageKey: "records-daily", currentRank: r.rank)
                            Text(" of \(r.total)").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.bottom, 8)

                Divider().overlay(Theme.border)

                if loading {
                    LeaderboardSkeleton()   // web parity: animate-pulse rows
                } else if entries.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                        Text("No results yet today. Be the first!").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 30)
                } else {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { idx, e in
                        dailyRow(idx + 1, e)
                        if idx < entries.count - 1 { Divider().overlay(Theme.border) }
                    }
                }
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 16))
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
        // Web parity: "Ns"/"Nm Ns" time + multi-board fraction + a Win/Loss pill.
        let t = formatShortTime(Int(e.timeSeconds))
        var line = "\(e.guessCount) Guesses · \(t)"
        if e.totalBoards > 1 { line += " · \(e.boardsSolved)/\(e.totalBoards)" }
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            NavigationLink(value: e.userId) {
                (Text(e.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                    .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            }.buttonStyle(.plain)
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(Int(e.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 5) {
                    Text(line).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    Text(e.completed ? "Win" : "Loss").font(Brand.font(9, .heavy))
                        .foregroundStyle(e.completed ? Theme.winText : Theme.lossText)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 4).fill(e.completed ? Theme.winBG : Theme.lossBG))
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func load() async {
        loading = true
        entries = (try? await LeaderboardService.fetch(gameMode: mode, playType: playType)) ?? []
        if let uid = auth.profile?.id { userRank = await LeaderboardService.userRank(gameMode: mode, userId: uid, playType: playType) }
        loading = false
    }
}

/// Shared mode picker — all 9 daily modes laid out 5-on-top-of-4 on one screen
/// (no horizontal scroll), matching the Profile "Today's Dailies" arrangement.
/// Selecting a mode highlights it in the mode's accent color.
struct HModePicker: View {
    @Binding var selected: GameMode
    // All 9 daily-recordable modes incl. ProperNoundle (dbKey, no HomeMode.mode).
    private let modes: [HomeMode] = homeModes.filter { $0.dbKey != nil }
    private let spacing: CGFloat = 8

    // Short labels so each cell fits 5-across without truncating.
    private let shortTitles: [String: String] = [
        "practice": "Classic", "quordle": "Quad", "octordle": "Octo", "sequence": "Succ",
        "rescue": "Deliv", "six": "Six", "seven": "Seven", "gauntlet": "Gauntlet", "propernoundle": "Proper",
    ]

    var body: some View {
        GeometryReader { geo in
            let w = (geo.size.width - spacing * 4) / 5
            VStack(spacing: spacing) {
                HStack(spacing: spacing) { ForEach(Array(modes.prefix(5))) { cell($0, w) } }
                HStack(spacing: spacing) { ForEach(Array(modes.dropFirst(5))) { cell($0, w) } }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: 112)
    }

    private func cell(_ m: HomeMode, _ w: CGFloat) -> some View {
        let active = m.dbKey == selected.rawValue
        return Button { selected = m.mode ?? GameMode(rawValue: m.dbKey ?? "") ?? selected } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: m.icon, accent: m.accent, box: 26)
                Text(shortTitles[m.id] ?? m.title).font(Brand.font(9, .heavy))
                    .foregroundStyle(active ? m.accent : Theme.textMuted).lineLimit(1)
            }
            .frame(width: w, height: 52)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
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
