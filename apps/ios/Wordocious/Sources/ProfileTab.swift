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
    // Per-mode win streak for the mode-detail grid (computed from match history,
    // mirrors web mode-detail-panel's fetchModeWinStreak). Not stored in
    // user_stats, so it's fetched when the selected mode changes.
    @State private var modeWinStreak: (current: Int, best: Int) = (0, 0)
    // Solo/VS toggle (mirrors the web personal profile) — filters user_stats by play_type.
    @State private var activeTab = "solo"
    @State private var unlockedAchievements: Set<String> = []
    @StateObject private var achievementCatalog = AchievementCatalog.shared
    @State private var medals: [MedalRow] = []
    @State private var showAllMedals = false
    @State private var gamesThisWeek = 0
    @State private var socialLinks: [String: String] = [:]
    @State private var recentMatches: [PublicProfileService.RecentMatch] = []
    @State private var reloadToken = 0
    @State private var opponentNames: [String: String] = [:]
    @State private var recentLoading = true
    @State private var showEditProfile = false
    // Account section (web parity): notification toggle + Delete Account flow.
    @AppStorage("pref-daily-reminder") private var dailyReminder = false
    @State private var reminderDenied = false
    @State private var showDeleteConfirm = false
    @State private var deleting = false
    @State private var deleteError = false
    // Games played in the last 7 days — powers the Insights "this week" line.
    @State private var sevenDayTotal = 0

    // Mode-picker (per-mode stats) only covers modes backed by a GameMode enum.
    // Every daily mode with recorded stats — including ProperNoundle, whose
    // HomeMode has `mode: nil` (it launches its own view, not GameScreen) but
    // still has a GameMode case + stats rows. Only VS (dbKey nil) is excluded.
    private let dailyModes: [HomeMode] = homeModes.filter { $0.dbKey != nil }
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
            .onDailyCompletion { reloadToken += 1 }
            .task(id: "\(auth.profile?.id ?? "")-\(reloadToken)") {
                // P1: every independent fetch runs concurrently (was 8+ serial
                // round trips). Only the opponent-name lookup chains off
                // recentMatches; the 7-day activity calendar is fetched ONCE
                // and feeds both gamesThisWeek and sevenDayTotal.
                async let completionsLoad: Void = completions.load()
                async let catalogLoad: Void = achievementCatalog.load()
                if let uid = auth.profile?.id {
                    // P-cache: seed everything from the session memo so a tab
                    // return repaints instantly; the fresh fetches below swap
                    // in exactly as before.
                    let memo = StatsMemo.shared
                    if let v: [UserStatRow] = memo.get("statRows:\(uid)") { statRows = v }
                    if let v: Set<String> = memo.get("achievements:\(uid)") { unlockedAchievements = v }
                    if let v: [MedalRow] = memo.get("medals:\(uid)") { medals = v }
                    if let v: [String: String] = memo.get("socialLinks:\(uid)") { socialLinks = v }
                    if let v: [PublicProfileService.RecentMatch] = memo.get("recentMatches:\(uid)") {
                        recentMatches = v
                        if let n: [String: String] = memo.get("opponentNames:\(uid)") { opponentNames = n }
                        recentLoading = false
                    }
                    if let v: Int = memo.get("gamesThisWeek:\(uid)") { gamesThisWeek = v }
                    if let v: Int = memo.get("sevenDayTotal:\(uid)") { sevenDayTotal = v }
                    async let statsF = UserStatsService.fetch(userId: uid)
                    async let achievementsF = AchievementService.fetchUnlocked(userId: uid)
                    async let medalsF = MedalsService.recent(userId: uid, limit: 120)
                    async let weekF = MatchStatsService.activityCalendar(days: 7)
                    async let socialF = ProfileExtras.socialLinks(userId: uid)
                    async let matchesF = PublicProfileService.recentMatches(id: uid)
                    statRows = await statsF
                    unlockedAchievements = await achievementsF
                    medals = await medalsF
                    socialLinks = await socialF
                    recentMatches = await matchesF
                    let oppIds = Array(Set(recentMatches.compactMap { $0.opponentId(uid) }))
                    opponentNames = await PublicProfileService.usernames(ids: oppIds)
                    let week = await weekF
                    gamesThisWeek = week.reduce(0) { $0 + $1.played }
                    // Last-7-days game count for the Insights "this week" line.
                    let cal = Calendar.current
                    let today = cal.startOfDay(for: Date())
                    sevenDayTotal = week.filter {
                        guard let cutoff = cal.date(byAdding: .day, value: -6, to: today) else { return true }
                        return $0.day >= cutoff
                    }.reduce(0) { $0 + $1.played }
                    recentLoading = false
                    // Store the fresh results back into the session memo.
                    memo.set("statRows:\(uid)", statRows)
                    memo.set("achievements:\(uid)", unlockedAchievements)
                    memo.set("medals:\(uid)", medals)
                    memo.set("socialLinks:\(uid)", socialLinks)
                    memo.set("recentMatches:\(uid)", recentMatches)
                    memo.set("opponentNames:\(uid)", opponentNames)
                    memo.set("gamesThisWeek:\(uid)", gamesThisWeek)
                    memo.set("sevenDayTotal:\(uid)", sevenDayTotal)
                }
                _ = await (completionsLoad, catalogLoad)
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
        // Web order (restat R1, profile/page.tsx): header → Today's Dailies →
        // SnapshotHero → daily standing strip → Solo/VS/VS-CPU toggle + (VS
        // card + Rivalries | CPU card) + Mode Picker → [All view: Trends charts,
        // Insights, Pro Stats, Skill Radar | Mode view: mode header + stats +
        // per-mode dashboard + Deep Insights] → Progression (Daily Medals +
        // Achievements, BOTH views) → Recent Matches.
        ScrollView {
            VStack(spacing: 16) {
                header(p)
                todaysDailies
                SnapshotHero(profile: p, gamesThisWeek: gamesThisWeek, isPro: auth.isProActive)
                DailyStandingStrip(reloadToken: reloadToken)
                soloVsToggle
                // F1: the tab-specific cards fade+rise on each Solo/VS/VS CPU
                // swap (.id change → .transition) instead of snapping in.
                Group {
                    if activeTab == "vs" {
                        vsRecordCard
                        // Rivalries — most-faced opponents with head-to-head bars (Pro).
                        if UserStatsService.vsRecord(statRows).total > 0 {
                            RivalriesCard(isPro: auth.isProActive)
                        }
                    }
                    if activeTab == "vs_cpu" { cpuRecordCard }
                }
                .id("tabcards-\(activeTab)")
                .transition(.opacity.combined(with: .offset(y: 6)))
                ProfileModePicker(modes: dailyModes, games: UserStatsService.gamesPerMode(filteredStats), selected: $selectedMode)
                // F1: dashboard content eases in on mode / play-type swap.
                Group {
                if let mode = selectedMode {
                    // Mode-detail view — header row carries the read-only
                    // play-type chip (the page-level toggle drives it; the panel
                    // has no toggle of its own, matching mode-detail-panel.tsx).
                    // Every per-game chart is scoped to activeTab (restat B1).
                    modeDetailHeader(mode)
                    modeStats(p, mode: mode)
                    ProfileDashboard(mode: mode, playType: activeTab)
                    ProDeepModeCard(gameMode: mode.rawValue, isPro: auth.isProActive,
                                    accent: ModeStyle.accent(mode), playType: activeTab)
                    // CPU practice writes aggregate totals only — per-game charts
                    // have no data to draw from, so say so instead of blanks.
                    if activeTab == "vs_cpu" {
                        Text("CPU practice records totals only — per-game charts track Solo and VS matches.")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                            .padding(.vertical, 8)
                    }
                } else {
                    // "All" global view — Trends charts (web order inside
                    // ProfileDashboard), then Insights, Pro Stats, Skill Radar.
                    // CPU practice records totals only — the per-game charts
                    // below draw from match rows that CPU games never write.
                    if activeTab == "vs_cpu" {
                        Text("CPU practice records totals only — charts track Solo and VS matches.")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).multilineTextAlignment(.center)
                            .padding(.vertical, 4)
                    }
                    ProfileDashboard(mode: nil, playType: activeTab)
                    ProfileInsightsCard(insights: allViewInsights(p))
                    ProStatsCard(statRows: statRows)
                    SkillRadarCard(isPro: auth.isProActive)
                }
                }
                .id("dash-\(activeTab)-\(selectedMode?.rawValue ?? "all")")
                .transition(.opacity.combined(with: .offset(y: 6)))
                // Progression: medals + achievements under one banner, shown in
                // BOTH the All and per-mode views (web parity).
                SectionHeader("Progression", accent: Color(hex: 0xF59E0B))
                medalsSection(p)
                achievementsSection
                recentMatchesSection(p)
            }
            .padding(.horizontal, 12).padding(.top, 8)
            // Generous bottom clearance so the last section always sits above the
            // custom bottom nav and stays tappable (Account actions live in
            // Settings now, not here).
            .padding(.bottom, 72)
            // F1: drives the .id-swap transitions on the tab cards + dashboard.
            .animation(Theme.animation(.easeOut(duration: 0.22)), value: activeTab)
            .animation(Theme.animation(.easeOut(duration: 0.22)), value: selectedMode)
        }
    }

    /// Account actions — ports profile/page.tsx section H (notification toggle,
    /// Sign Out, Delete Account with confirm).
    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ACCOUNT").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            // Daily reminder toggle (web NotificationToggle).
            Toggle(isOn: $dailyReminder) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Daily Reminders").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    Text("A nudge to play today's puzzles").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
            .tint(Theme.primary).padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))

            Button { Task { await auth.signOut() } } label: {
                HStack(spacing: 12) {
                    Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 18)).foregroundStyle(Theme.textMuted)
                    Text("Sign Out").font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)

            Button(role: .destructive) { showDeleteConfirm = true } label: {
                HStack(spacing: 12) {
                    Image(systemName: "trash").font(.system(size: 18)).foregroundStyle(Color(hex: 0xDC2626))
                    Text("Delete Account").font(Brand.font(14, .heavy)).foregroundStyle(Color(hex: 0xDC2626))
                    Spacer()
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFECACA), lineWidth: 1.5))
            }.buttonStyle(.plain).disabled(deleting)
        }
        .onChange(of: dailyReminder) { on in
            if on {
                Task {
                    let granted = await NotificationService.requestAndSchedule()
                    if !granted { dailyReminder = false; reminderDenied = true }
                }
            } else {
                NotificationService.cancel()
            }
        }
        .alert("Notifications are off", isPresented: $reminderDenied) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Enable notifications for Wordocious in iOS Settings to get a daily reminder.")
        }
        .alert("Delete your account?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button(deleting ? "Deleting…" : "Delete Forever", role: .destructive) {
                deleting = true
                Task { let ok = await auth.deleteAccount(); deleting = false; if !ok { deleteError = true } }
            }.disabled(deleting)
        } message: {
            Text("This will permanently delete your profile, stats, streak, medals, achievements, and all game data. This action cannot be undone.")
        }
        .alert("Couldn't delete account", isPresented: $deleteError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Please try again or contact support@wordocious.com.")
        }
    }

    /// Insight strings for the All view — ports the web `insights` IIFE
    /// (profile/page.tsx): strongest mode, weekly volume, XP-to-next, dailies.
    /// Capped at 2, matching `.slice(0, 2)`.
    private func allViewInsights(_ p: Profile) -> [String] {
        var out: [String] = []
        // Strongest mode by win rate among modes with ≥3 games (all play types,
        // matching the web which uses the unfiltered `stats`).
        let qualifying = statRows.filter { $0.totalGames >= 3 }
        if let strongest = qualifying.max(by: {
            (Double($0.wins) / Double(max($0.totalGames, 1))) < (Double($1.wins) / Double(max($1.totalGames, 1)))
        }) {
            let name = GameMode(rawValue: strongest.gameMode).map { ModeStyle.title($0) } ?? strongest.gameMode
            let rate = Int((Double(strongest.wins) / Double(strongest.totalGames) * 100).rounded())
            out.append("Your strongest mode is \(name) at \(rate)% win rate.")
        }
        // Weekly volume.
        let weekTotal = sevenDayTotal
        if weekTotal >= 10 { out.append("You've played \(weekTotal) games this week — on a roll!") }
        else if weekTotal >= 1 && weekTotal < 5 { out.append("Only \(weekTotal) game\(weekTotal == 1 ? "" : "s") this week — warm up with a daily.") }
        // XP to next level.
        let toNext = 1000 - (p.xp % 1000)
        if toNext <= 300 { out.append("Just \(toNext) XP away from Level \(p.level + 1).") }
        // Dailies progress.
        let done = completions.completedCount
        let total = DailyCompletionsStore.totalDailyModes
        if done == total {
            out.append(completions.flawless ? "Flawless Victory — all \(total) dailies won today." : "All \(total) dailies done today. Legendary.")
        } else if done >= 3 {
            out.append("\(done)/\(total) dailies complete today — keep going.")
        }
        return Array(out.prefix(2))
    }

    // MARK: Header

    private func header(_ p: Profile) -> some View {
        let tier = levelTier(p.level)
        let progress = Double(p.xp % 1000) / 10.0
        let toNext = 1000 - (p.xp % 1000)
        return VStack(spacing: 10) {
            AvatarView(url: p.avatarUrl, username: p.username, size: 96, accentHex: p.accentColor, emoji: p.avatarEmoji)
            HStack(spacing: 6) {
                if ProfileAccent.isCustom(p.accentColor) {
                    Text(p.username).font(Brand.title(28)).foregroundStyle(ProfileAccent.color(p.accentColor))
                } else {
                    Text(p.username).font(Brand.title(28))
                        .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xEC4899), Color(hex: 0xA78BFA)], startPoint: .leading, endPoint: .trailing))
                }
                if auth.isProActive {
                    Text("PRO").font(Brand.font(10, .black)).tracking(0.6).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Capsule().fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }
            }
            ProfilePersonalizationRow(profile: p)
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
            .buttonStyle(PressableStyle())
            .padding(.top, 2)
            .sheet(isPresented: $showEditProfile) { EditProfileView() }
            Button {
                let total = p.totalWins + p.totalLosses
                ShareService.shareProfile(ProfileShareInput(
                    username: p.username, level: p.level, tier: levelTier(p.level).label,
                    accentHex: ProfileAccent.hex(p.accentColor),
                    totalWins: p.totalWins,
                    winRate: total > 0 ? Int((Double(p.totalWins) / Double(total) * 100).rounded()) : 0,
                    currentStreak: p.currentStreak, dailyStreak: p.dailyLoginStreak,
                    gold: p.goldMedals, silver: p.silverMedals, bronze: p.bronzeMedals,
                    achievementsUnlocked: unlockedAchievements.count, achievementsTotal: achievementCatalog.all.count))
            } label: {
                Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(12, .heavy)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .background(Capsule().fill(Theme.surfaceHover))
                    .overlay(Capsule().stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
            }
            .buttonStyle(PressableStyle())
            .padding(.top, 2)
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

    // (Global summary + "This Week" recap merged into SnapshotHero — restat R1.)

    // MARK: Daily Medals (ports the web profile medals section)

    /// The signed-in user's own recent matches (solo + VS), mirroring the web
    /// profile's Recent Matches list and the public-profile view. Shows up to 5;
    /// VS rows (player2 set) render as "VS Match". Shares RecentMatchRow with the
    /// public profile so both are pixel-identical.
    @ViewBuilder private func recentMatchesSection(_ p: Profile) -> some View {
        // Web parity (profile/page.tsx): skeleton rows while loading, then either
        // the matches or "No matches played yet." — the section never just vanishes.
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Recent Matches", accent: Color(hex: 0x2563EB))
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
        // Sits under the shared "PROGRESSION" banner (web parity): the card
        // carries its own small "Daily Medals" title instead of a section header.
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Daily Medals").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 12) {
                    medalCount("crown.fill", p.goldMedals, "Gold", Color(hex: 0xD97706))
                    medalCount("medal.fill", p.silverMedals, "Silver", Theme.textMuted)
                    medalCount("medal.fill", p.bronzeMedals, "Bronze", Color(hex: 0xB45309))
                }
                if !medals.isEmpty {
                    if showAllMedals {
                        ScrollView { VStack(spacing: 6) { ForEach(medals) { m in medalRow(m) } } }.frame(maxHeight: 320)
                    } else {
                        VStack(spacing: 6) { ForEach(Array(medals.prefix(5))) { m in medalRow(m) } }
                    }
                    if medals.count > 5 {
                        Button { showAllMedals.toggle() } label: {
                            Text(showAllMedals ? "Show less" : "View all \(medals.count) medals ›")
                                .font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary).frame(maxWidth: .infinity)
                        }.buttonStyle(.plain).padding(.top, 2)
                    }
                } else {
                    // Web parity: empty-state copy instead of a bare grid.
                    Text("Play daily challenges to earn medals!")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
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

    private let achCategories: [(key: String, label: String, color: UInt)] = [
        ("beginner", "Getting Started", 0x7C3AED), ("consistency", "Consistency", 0xF97316),
        ("skill", "Skill", 0x2563EB), ("social", "Social", 0x0D9488), ("collection", "Collection", 0xD97706),
    ]

    private var achievementsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                // Under the shared "PROGRESSION" banner (web parity): a plain
                // card-style title rather than an all-caps section header.
                Text("Achievements").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("\(unlockedAchievements.count)/\(achievementCatalog.all.count)").font(Brand.font(10, .black)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 8).padding(.vertical, 2).background(Capsule().fill(Color(hex: 0xF3F0FF)))
            }
            ForEach(achCategories, id: \.key) { cat in
                let items = achievementCatalog.all.filter { $0.category == cat.key }
                if !items.isEmpty {
                    let n = items.filter { unlockedAchievements.contains($0.key) }.count
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Text(cat.label.uppercased()).font(Brand.font(11, .black)).tracking(0.4).foregroundStyle(Color(hex: cat.color))
                            Text("\(n)/\(items.count)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                            ForEach(items) { achievementCell($0) }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func achievementCell(_ a: AchievementDef) -> some View {
        let on = unlockedAchievements.contains(a.key)
        let prog = on ? nil : achievementProgress(a.key)
        VStack(spacing: 2) {
            Text(on ? "✓" : "?").font(Brand.font(18, .black)).foregroundStyle(on ? Theme.primary : Theme.textMuted)
            Text(a.name).font(Brand.font(10, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            Text(a.description).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center).lineLimit(2)
            if let prog {
                GeometryReader { g in ZStack(alignment: .leading) { Capsule().fill(Theme.border); Capsule().fill(Theme.primary).frame(width: g.size.width * min(1, Double(prog.c) / Double(prog.t))) } }.frame(height: 4).padding(.top, 1)
                Text("\(prog.c)/\(prog.t)").font(Brand.font(8, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(10).frame(maxWidth: .infinity, minHeight: 84, alignment: .top)
        .background(RoundedRectangle(cornerRadius: 12).fill(on ? Color(hex: 0xF3F0FF) : Color(hex: 0xFAFAFA)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Color(hex: 0xC4B5FD) : Theme.border, lineWidth: 1.5))
        .opacity(on ? 1 : (prog != nil ? 0.8 : 0.4))
    }

    private func achievementProgress(_ key: String) -> (c: Int, t: Int)? {
        guard let p = auth.profile else { return nil }
        let medalsTotal = p.goldMedals + p.silverMedals + p.bronzeMedals
        let map: [String: (Int, Int)] = ["streak_7": (p.dailyLoginStreak, 7), "streak_30": (p.dailyLoginStreak, 30), "medal_10": (medalsTotal, 10), "medal_50": (medalsTotal, 50)]
        if let m = map[key], m.0 < m.1 { return (m.0, m.1) }
        return nil
    }

    // MARK: Solo/VS toggle + VS RECORD card (ports profile/page.tsx section D)

    /// Stats filtered to the active Solo/VS tab.
    private var filteredStats: [UserStatRow] { statRows.filter { $0.playType == activeTab } }

    private var soloVsToggle: some View {
        HStack(spacing: 8) {
            ForEach(["solo", "vs", "vs_cpu"], id: \.self) { t in
                let active = activeTab == t
                Button { activeTab = t } label: {
                    HStack(spacing: 6) {
                        if t == "solo" {
                            Image(systemName: "person.fill").font(.system(size: 12, weight: .bold))
                        } else if t == "vs" {
                            Image("swords").renderingMode(.template).resizable().scaledToFit()
                                .frame(width: 14, height: 14)
                        } else {
                            Image(systemName: "cpu").font(.system(size: 12, weight: .bold))
                        }
                        Text(t == "solo" ? "Solo" : t == "vs" ? "VS" : "VS CPU").font(Brand.font(12, .heavy))
                    }
                    .foregroundStyle(active ? Theme.primary : Theme.textMuted)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surface : Theme.surfaceHover))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
                }.buttonStyle(PressableStyle())
            }
            Spacer()
        }
    }

    /// "VS RECORD" summary card (VS tab only): aggregate W–L, win rate, total.
    /// Practice record vs the CPU — its own dashed box on the VS tab, clearly
    /// unranked. Best CPU streak comes from the client-side progression store.
    @ViewBuilder private var cpuRecordCard: some View {
        let rec = UserStatsService.cpuRecord(statRows)
        let bestStreak = CpuProgressionStore.load().bestStreak
        // Always shown on the VS tab (even at 0–0) so the practice record is
        // discoverable before your first bot match; it fills in once you play one.
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x64748B).opacity(0.10)).frame(width: 40, height: 40)
                Image(systemName: "cpu").font(.system(size: 18)).foregroundStyle(Color(hex: 0x64748B))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("VS CPU").font(Brand.font(10, .heavy)).tracking(0.8).foregroundStyle(Color(hex: 0x64748B))
                Text("\(rec.wins)–\(rec.losses)").font(Brand.font(20, .black)).foregroundStyle(Theme.textPrimary)
                if rec.total == 0 {
                    Text("Beat a bot to start your record").font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                } else if bestStreak > 0 {
                    Text("🔥 Best streak: \(bestStreak)").font(Brand.font(10, .heavy)).foregroundStyle(Color(hex: 0xF97316))
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(rec.total == 0 ? "—" : "\(rec.winRate)%").font(Brand.font(20, .black)).foregroundStyle(Color(hex: 0x64748B))
                Text(rec.total == 0 ? "NO GAMES YET" : "WIN RATE · \(rec.total) \(rec.total == 1 ? "MATCH" : "MATCHES")")
                    .font(Brand.font(9, .heavy)).tracking(0.4).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, style: StrokeStyle(lineWidth: 1.5, dash: [5])))
    }

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

    /// Mode-detail header — ports the mode-detail-panel.tsx header row: mode
    /// icon tile + title in the mode accent, and a read-only play-type chip that
    /// reflects the page-level Solo/VS/VS-CPU toggle (the panel no longer has a
    /// toggle of its own — restat).
    private func modeDetailHeader(_ mode: GameMode) -> some View {
        let m = dailyModes.first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        return HStack {
            HStack(spacing: 8) {
                if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                Text(m?.title ?? ModeStyle.title(mode)).font(Brand.font(14, .black)).foregroundStyle(accent)
            }
            Spacer()
            HStack(spacing: 4) {
                if activeTab == "solo" {
                    Image(systemName: "person.fill").font(.system(size: 10, weight: .bold))
                } else if activeTab == "vs" {
                    Image("swords").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 12, height: 12)
                } else {
                    Image(systemName: "cpu").font(.system(size: 10, weight: .bold))
                }
                Text(activeTab == "solo" ? "Solo" : activeTab == "vs" ? "VS" : "VS CPU")
                    .font(Brand.font(10, .heavy))
            }
            .foregroundStyle(accent)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 8).fill(accent.opacity(0.08)))
        }
    }

    private func modeStats(_ p: Profile, mode: GameMode) -> some View {
        let s = UserStatsService.aggregate(filteredStats, mode: mode.rawValue)
        let winRate = s.totalGames > 0 ? Int((Double(s.wins) / Double(s.totalGames) * 100).rounded()) : 0
        let cells: [(String, String)] = [
            ("Wins", "\(s.wins)"), ("Losses", "\(s.losses)"), ("Games", "\(s.totalGames)"), ("Win Rate", "\(winRate)%"),
            ("Best", s.bestScore > 0 ? "\(s.bestScore)" : "-"), ("Fastest", fmtTime(s.fastestTime)),
            ("Streak", "\(modeWinStreak.current)"), ("Best Streak", "\(modeWinStreak.best)"),
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
        // Fetch the per-mode win streak from match history whenever the selected
        // mode OR the play-type toggle changes (web mode-detail-panel parity —
        // restat B1 scopes the streak to the toggle). Reset first so a stale
        // value from the previous mode never flashes.
        .task(id: "\(mode.rawValue)-\(activeTab)") {
            modeWinStreak = (0, 0)
            if let uid = auth.profile?.id {
                modeWinStreak = await MatchStatsService.modeWinStreak(uid: uid, mode: mode, playType: activeTab)
            }
        }
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
        }.buttonStyle(PressableStyle())
    }

    private func modeChip(_ m: HomeMode) -> some View {
        // ProperNoundle's HomeMode carries mode: nil (own view, not GameScreen) —
        // derive its GameMode from the dbKey so the chip selects + counts.
        let gm = m.mode ?? m.dbKey.flatMap { GameMode(rawValue: $0) }
        let active = selected != nil && selected == gm
        let count = gm.flatMap { games[$0.rawValue] } ?? 0
        return Button { selected = active ? nil : gm } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: m.icon, accent: m.accent, box: 28)
                Text(shortTitles[m.id] ?? m.title).font(Brand.font(10, .heavy))
                    .foregroundStyle(active ? m.accent : Theme.textMuted).lineLimit(1)
                Text(count > 0 ? "\(count)" : " ").font(Brand.font(8, .bold)).foregroundStyle(Theme.textMuted)
            }
            .frame(minWidth: 62).padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(PressableStyle())
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
    @State private var reloadToken = 0
    @State private var userRank: (rank: Int, total: Int)?
    @State private var playerCount = 0
    @State private var loading = false
    @State private var showYesterday = false
    @State private var showAuth = false
    @State private var secondsLeft = secondsUntilLocalMidnight()
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    /// Today's completed dailies (seeded instantly from the on-device cache) so
    /// the Play CTA knows "View vs Play" with zero flash, before the per-mode
    /// leaderboard rank loads.
    @StateObject private var completions = DailyCompletionsStore()
    // Play CTA → launch the selected mode's daily (GameScreen, or ProperNoundle).
    @State private var lbGame: LbGame?
    @State private var lbSolved: LbGame?   // already-finished daily → read-only solved board
    @State private var showPNDaily = false
    struct LbGame: Identifiable { let id = UUID(); let mode: GameMode; let title: String }

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
            .fullScreenCover(item: $lbGame) { g in
                NavigationStack { GameScreen(seed: DailySeed.today(mode: g.mode), mode: g.mode, title: g.title) }
            }
            .fullScreenCover(item: $lbSolved) { g in
                // Read-only reconstruction (matches the home "View Solved Puzzle"),
                // so a finished daily never reopens as a fresh playable board.
                NavigationStack { SolvedPuzzleView(mode: g.mode, title: g.title) }
            }
            .fullScreenCover(isPresented: $showPNDaily) {
                NavigationStack { ProperNoundleView() }
            }
        }
    }

    /// "Play CTA" card (web /daily): mode icon + title + players-today + a Play
    /// button that launches today's daily for the selected mode.
    private var playCtaCard: some View {
        let m = homeModes.first { $0.dbKey == mode.rawValue }
        let accent = ModeStyle.accent(mode)
        return VStack(spacing: 0) {
            LinearGradient(colors: [accent, accent.opacity(0.5)], startPoint: .leading, endPoint: .trailing)
                .frame(height: 3)
            HStack(spacing: 10) {
                if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                VStack(alignment: .leading, spacing: 1) {
                    Text(m?.title ?? mode.rawValue).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 10))
                        Text("\(playerCount) player\(playerCount == 1 ? "" : "s") today").font(Brand.font(10, .bold))
                    }.foregroundStyle(Theme.textMuted)
                }
                Spacer()
                // Already finished today's daily for this mode → open the read-only
                // solved board, matching the home cards. The cached completions
                // answer instantly; userRank confirms once the leaderboard loads.
                let played = completions.byMode[mode.rawValue] != nil || userRank != nil
                Button {
                    let title = m?.title ?? mode.rawValue
                    if played { lbSolved = LbGame(mode: mode, title: title) }
                    else if mode == .propernoundle { showPNDaily = true }
                    else { lbGame = LbGame(mode: mode, title: title) }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: played ? "eye.fill" : "play.fill").font(.system(size: 11))
                        Text(played ? "View" : "Play").font(Brand.font(13, .black))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(Capsule().fill(accent))
                    .shadow(color: accent.opacity(0.3), radius: 4, x: 0, y: 2)
                }.buttonStyle(.plain)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
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
                playCtaCard
                // .id(mode) → a fresh card per mode so switching away from one mode
                // can't render the previous mode's board data (which trapped when a
                // board mode rendered stale ProperNoundle data mid-transition).
                CompletedDailyCard(mode: mode).id(mode)
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

                Button { showYesterday.toggle() } label: {
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
        .task(id: "\(mode.rawValue)-\(reloadToken)") { await load() }
        // Yesterday's Winners keys on the MODE too (web/Android parity) — it
        // used to fetch only on toggle-open, so switching chips while the
        // dropdown was expanded kept showing the previous mode's podium until
        // you closed and reopened it.
        .task(id: "yesterday-\(mode.rawValue)-\(showYesterday)") {
            guard showYesterday else { return }
            await loadYesterday()
        }
        .task { await completions.load() }
        .onDailyCompletion { Task { await completions.load() } }
        .onDailyCompletion { reloadToken += 1 }
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
        // Stale-while-revalidate (web parity: lbCache in app/daily/page.tsx) —
        // a cache hit paints the last-known rows instantly (no skeleton) while
        // the fresh fetch below swaps in silently. Skeleton = true first load only.
        let cacheKey = LeaderboardCache.key(mode: mode, userId: auth.profile?.id)
        if let cached = LeaderboardCache.shared[cacheKey] {
            entries = cached.entries
            playerCount = cached.playerCount
            userRank = cached.userRank
            loading = false
        } else {
            loading = true
            userRank = nil
            entries = []
        }

        async let e = try? LeaderboardService.fetch(gameMode: mode)
        async let pc = LeaderboardService.playerCount(gameMode: mode)
        let fetchedOpt = await e
        let count = await pc
        // .task(id:) cancels this on mode switch, but the awaits above aren't
        // cancellation-checked — bail before assigning so a slow prior-mode
        // response can't overwrite the new mode's rows.
        guard !Task.isCancelled else { return }
        // Network error (nil, not an empty day): keep whatever is showing —
        // cached rows beat clobbering them with a blank list, and never cache
        // the failure.
        guard let fetched = fetchedOpt else { loading = false; return }
        // Paint the rows the moment they arrive — the rank banner fills in on
        // its own instead of holding the whole list behind its extra queries.
        entries = fetched
        playerCount = count
        loading = false

        var rank: (rank: Int, total: Int)? = nil
        if let uid = auth.profile?.id {
            rank = await LeaderboardService.userRank(gameMode: mode, userId: uid, topEntries: fetched)
            guard !Task.isCancelled else { return }
            userRank = rank
        }
        LeaderboardCache.shared[cacheKey] = .init(entries: fetched, playerCount: count, userRank: rank)
    }

    private func loadYesterday() async {
        let rows = (try? await LeaderboardService.fetch(gameMode: mode, day: LeaderboardService.yesterdayLocal(), limit: 3)) ?? []
        // .task(id:) cancels this on a mode switch — don't let the previous
        // mode's slow response overwrite the new mode's podium.
        guard !Task.isCancelled else { return }
        yesterday = rows
    }
}

let HINT_MODES: Set<String> = ["DUEL_6", "DUEL_7", "PROPERNOUNDLE"]

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
