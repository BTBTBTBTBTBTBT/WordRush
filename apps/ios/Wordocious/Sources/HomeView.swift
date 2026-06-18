import SwiftUI
import WordociousCore

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var comingSoon: String?
    @State private var limitModal: HomeMode?     // free user tapped a completed daily
    @State private var solvedMode: HomeMode?      // "View Solved Puzzle"
    @State private var showProSheet = false
    @AppStorage("pref-play-mode") private var playMode: PlayMode = .daily
    @State private var showVSLobby = false
    @State private var vsDailyWon: Bool? = nil     // today's daily VS outcome (nil = not played) → card W/L badge
    @State private var pendingGame: ActiveGame?    // tap-time-resolved Unlimited game
    @State private var showInvite = false
    @StateObject private var livePlayers = LivePlayerCount()
    @State private var pendingInvites: [InviteService.PendingInvite] = []
    @State private var inviterNames: [String: String] = [:]

    /// An incoming invite the user accepted → launches the VS match.
    private struct AcceptedInvite: Identifiable { let mode: GameMode; let code: String; var id: String { code } }
    @State private var playInvite: AcceptedInvite?
    /// One-time Pro nudge once the daily-login streak hits 7 (ports pro-prompt-modal).
    /// Local flag instead of the web's profiles.pro_prompt_shown column (no migration).
    @AppStorage("pro-prompt-shown") private var proPromptShown = false
    @State private var showShieldModal = false
    @State private var shieldChecked = false

    /// One-time-per-day Daily Sweep / Flawless Victory celebration.
    @State private var showSweepCeleb = false
    @AppStorage("sweep-celebrated-day") private var sweepCelebratedDay = ""

    /// Show the celebration once per local day when all 9 dailies complete.
    /// Re-fires if the player upgrades a Sweep → Flawless.
    private func checkSweepCelebration() {
        guard auth.isAuthenticated, completions.allDone else { return }
        let day = LeaderboardService.todayLocal()
        let tier = completions.flawless ? "flawless" : "sweep"
        let token = "\(day):\(tier)"
        if sweepCelebratedDay == token || sweepCelebratedDay == "\(day):flawless" { return }
        sweepCelebratedDay = token
        showSweepCeleb = true
    }

    /// An Unlimited ProperNoundle run (PN has its own view, not GameScreen).
    struct PNGame: Identifiable {
        let seed: String
        var id: String { seed }
    }
    @State private var pnGame: PNGame?

    private func freshPNSeed() -> String {
        "unlimited-PROPERNOUNDLE-\(Int(Date().timeIntervalSince1970))"
    }

    /// A game whose seed was resolved at tap time (Unlimited play).
    struct ActiveGame: Identifiable, Equatable {
        let seed: String; let mode: GameMode; let title: String
        var id: String { "\(mode.rawValue)-\(seed)" }
    }

    /// Free users are forced to Daily (toggle is Pro-only).
    private var effectiveMode: PlayMode { auth.isProActive ? playMode : .daily }

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()

                VStack(spacing: 0) {
                    AppHeaderView()
                    ScrollView {
                        VStack(spacing: 8) {
                            pendingInvitesBanner
                            if auth.isProActive { PlayModeToggle(value: $playMode) }
                            // Always fill the hero slot so toggling Daily⇄Unlimited
                            // (or completing all dailies) never shifts the grid.
                            if effectiveMode == .unlimited {
                                UnlimitedHero()
                            } else if completions.allDone {
                                banner          // Daily Sweep / Flawless Victory
                            } else {
                                DailyChallengeHero()
                            }
                            WordOfTheDayView()
                            sectionHeader
                            LazyVGrid(columns: columns, spacing: 8) {
                                ForEach(homeModes) { mode in
                                    card(mode)
                                }
                            }
                            liveBar
                            signOutButton
                            footerLinks
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 4)
                        // Generous bottom clearance so the last items (Sign Out /
                        // footer) always sit above the custom bottom nav and stay
                        // tappable, regardless of safe-area-inset propagation.
                        .padding(.bottom, 72)
                    }
                }

                if let m = limitModal {
                    ModeLimitModal(mode: m,
                                   showViewSolved: m.id != "vs",   // VS has no solo solved-puzzle to review
                                   onClose: { limitModal = nil },
                                   onUpgrade: { limitModal = nil; showProSheet = true },
                                   onViewSolved: { let mode = m; limitModal = nil; solvedMode = mode })
                        .transition(.opacity)
                }

                if showProPrompt {
                    proPromptBanner
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                        .padding(.horizontal, 16).padding(.bottom, 12)
                }

                if showShieldModal, let p = auth.profile {
                    StreakShieldModal(
                        streak: p.dailyLoginStreak, shields: p.streakShields,
                        onUseShield: { await ShieldService.useShield(); closeShield() },
                        onDecline: { await ShieldService.declineStreak(); closeShield() },
                        onClose: { closeShield() })
                    .transition(.opacity)
                }
            }
            .animation(Theme.animation(.easeInOut(duration: 0.15)), value: limitModal != nil)
            .animation(Theme.animation(.easeInOut(duration: 0.2)), value: showProPrompt)
            .sheet(isPresented: $showProSheet) { ProView() }
            .navigationDestination(isPresented: $showVSLobby) { VSLobbyView() }
            // Games present full-screen OVER the tab bar (like the web's
            // full-screen game route) so the bottom nav is never behind them —
            // not on the board and not on the results/victory screen.
            .fullScreenCover(item: $pendingGame) { g in
                NavigationStack {
                    GameScreen(seed: g.seed, mode: g.mode, title: g.title, onPlayAgain: {
                        // Mint a fresh Unlimited seed for the same mode and swap it in
                        // (item change re-presents the cover with a new game).
                        let fresh = "unlimited-\(g.mode.rawValue)-\(Int(Date().timeIntervalSince1970))"
                        UserDefaults.standard.set(fresh, forKey: "unlimited-current-\(g.mode.rawValue)")
                        pendingGame = ActiveGame(seed: fresh, mode: g.mode, title: g.title)
                    })
                }
            }
            .fullScreenCover(item: $pnGame) { g in
                NavigationStack {
                    ProperNoundleView(seed: g.seed, onPlayAgain: { pnGame = PNGame(seed: freshPNSeed()) })
                }
            }
            .fullScreenCover(item: $solvedMode) { m in
                NavigationStack {
                    if let gm = m.mode {
                        // Reconstruct the solved board from the matches row (works
                        // cross-device, unlike the local-only GameScreen state).
                        SolvedPuzzleView(mode: gm, title: m.title)
                    } else if m.id == "propernoundle" {
                        ProperNoundleView()
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showInvite) { InviteSheet() }
            .navigationDestination(isPresented: Binding(
                get: { playInvite != nil },
                set: { if !$0 { playInvite = nil } })) {
                if let inv = playInvite {
                    VSGameView(mode: inv.mode, inviteCode: inv.code)
                }
            }
            .task(id: auth.isAuthenticated) { await completions.load(); await loadPendingInvites(); vsDailyWon = await DailyResultsService.dailyVSResult(); checkStreakAtRisk(); checkSweepCelebration() }
            .onAppear { livePlayers.start() }
            .onChange(of: completions.byMode.count) { _ in checkSweepCelebration() }
            .fullScreenCover(isPresented: $showSweepCeleb) {
                if #available(iOS 16.4, *) {
                    SweepCelebrationView(byMode: completions.byMode) { showSweepCeleb = false }
                        .presentationBackground(.clear)
                } else {
                    SweepCelebrationView(byMode: completions.byMode) { showSweepCeleb = false }
                }
            }
            .alert("Coming soon", isPresented: Binding(get: { comingSoon != nil }, set: { if !$0 { comingSoon = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("\(comingSoon ?? "This mode") is coming to the iOS app soon.")
            }
            // Banner lives on the Home root only — applying it here (inside the
            // NavigationStack) keeps it off pushed game screens (GameScreen /
            // ProperNoundle / VS), where it would otherwise cover the keyboard.
            .adBanner()
        }
    }

    // MARK: - Banner

    private var banner: some View {
        let flawless = completions.flawless
        // Per web: distinct Sweep (purple) vs Flawless (amber) designs; gradient
        // title text flanked by icons; no emoji.
        let bg: [Color] = flawless ? [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)] : [Color(hex: 0xF5F3FF), Color(hex: 0xFCE7F3)]
        let borderC = flawless ? Color(hex: 0xF59E0B) : Color(hex: 0xC4B5FD)
        let titleGradient: [Color] = flawless ? [Color(hex: 0xD97706), Color(hex: 0xB45309)] : [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)]
        let subtitleC = flawless ? Color(hex: 0xB45309) : Color(hex: 0x6D28D9)
        let totals = completions.totals
        let totalTime = "\(Int(totals.totalTimeSeconds) / 60):\(String(format: "%02d", Int(totals.totalTimeSeconds) % 60))"
        let score = Int(totals.totalScore.rounded())
        return Button {
            ShareService.shareDailySweep(byMode: completions.byMode)
        } label: {
            VStack(spacing: 3) {
                HStack(spacing: 8) {
                    Image(systemName: flawless ? "trophy.fill" : "sparkles")
                        .font(.system(size: flawless ? 20 : 16)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0x7C3AED))
                    Text(flawless ? "Flawless Victory!" : "Daily Sweep!")
                        .font(Brand.font(flawless ? 18 : 16, .black))
                        .foregroundStyle(LinearGradient(colors: titleGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: flawless ? "trophy.fill" : "sparkles")
                        .font(.system(size: flawless ? 20 : 16)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0xEC4899))
                }
                Text(flawless ? "All \(totals.total) won · \(totalTime) · \(score) pts"
                              : "All \(totals.total) done · \(totalTime) · \(score) pts")
                    .font(Brand.font(11, .heavy)).foregroundStyle(subtitleC)
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    Text("Tap to share · Next in \(countdown())").font(Brand.font(10, .bold))
                        .foregroundStyle(subtitleC.opacity(0.75))
                }
            }
            // Fixed height so swapping hero ⇄ banner ⇄ unlimited on the Daily/Unlimited
            // toggle never shifts the cards below (all three heroes share this height).
            .frame(maxWidth: .infinity).frame(height: heroHeight)
            .background(
                RoundedRectangle(cornerRadius: 14).fill(
                    LinearGradient(colors: bg, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay(BannerShimmer().clipShape(RoundedRectangle(cornerRadius: 14)))
            )
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(borderC, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func countdown() -> String {
        let s = secondsUntilLocalMidnight()
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    private var sectionHeader: some View {
        HStack {
            Text("GAME MODES").font(Brand.font(13, .heavy)).tracking(1).foregroundStyle(Theme.textMuted)
            Spacer()
        }
        .padding(.top, 2)
    }

    // MARK: - Pro prompt (ports pro-prompt-modal)

    private var showProPrompt: Bool {
        // Honor the server-persisted dismissal too (web parity — a user who
        // dismissed on web shouldn't see the one-time prompt again on iOS).
        !proPromptShown && !(auth.profile?.proPromptShown ?? false)
            && !auth.isProActive && (auth.profile?.dailyLoginStreak ?? 0) >= 7
    }

    /// Dismiss the one-time Pro prompt locally AND persist it to the profile
    /// row, mirroring web pro-prompt-modal.tsx's `pro_prompt_shown` update.
    private func dismissProPrompt() {
        proPromptShown = true
        Task {
            struct Upd: Encodable { let pro_prompt_shown: Bool }
            if let uid = auth.profile?.id {
                try? await auth.client.from("profiles").update(Upd(pro_prompt_shown: true))
                    .eq("id", value: uid).execute()
            }
        }
    }

    private var proPromptBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "crown.fill").font(.system(size: 26)).foregroundStyle(Color(hex: 0xD97706))
            VStack(alignment: .leading, spacing: 1) {
                Text("You're on a streak!").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                Text("Upgrade to Pro for ad-free play, stats, shields, and more.")
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(2)
            }
            Spacer(minLength: 4)
            Button { dismissProPrompt(); showProSheet = true } label: {
                Text("Go Pro").font(Brand.font(10, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(
                        LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            }.buttonStyle(.plain)
            Button { dismissProPrompt() } label: {
                Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
            }.buttonStyle(.plain)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.1), radius: 16, x: 0, y: 8)
    }

    // MARK: - Streak shield (ports StreakShieldProvider)

    private func checkStreakAtRisk() {
        guard !shieldChecked, let p = auth.profile else { return }
        shieldChecked = true
        if p.dailyLoginStreak > 0 && ShieldService.isStreakAtRisk(lastPlayedAt: p.lastPlayedAt) {
            withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { showShieldModal = true }
        }
    }

    private func closeShield() {
        withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { showShieldModal = false }
    }

    // MARK: - Incoming VS invites (ports PendingInvitesBanner)

    private func loadPendingInvites() async {
        guard let uid = auth.profile?.id else { return }
        let list = await InviteService.fetchPending(userId: uid)
        pendingInvites = list
        var names: [String: String] = [:]
        for inv in list where names[inv.inviter_id] == nil {
            if let n = await InviteService.inviterUsername(inv.inviter_id) { names[inv.inviter_id] = n }
        }
        inviterNames = names
    }

    @ViewBuilder private var pendingInvitesBanner: some View {
        if let top = pendingInvites.first {
            let name = inviterNames[top.inviter_id] ?? "A friend"
            let mode = GameMode(rawValue: top.game_mode) ?? .duel
            HStack(spacing: 12) {
                Image(systemName: "envelope.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Color(hex: 0xEC4899)))
                VStack(alignment: .leading, spacing: 2) {
                    Text("@\(name) invited you to \(ModeStyle.title(mode).capitalized)")
                        .font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                    if pendingInvites.count > 1 {
                        Text("+\(pendingInvites.count - 1) more pending").font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0xA21CAF))
                    }
                }
                Spacer(minLength: 4)
                Button { playInvite = .init(mode: mode, code: top.invite_code) } label: {
                    Text("Play").font(Brand.font(12, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0xEC4899)))
                }.buttonStyle(.plain)
                Button {
                    let id = top.id
                    pendingInvites.removeAll { $0.id == id }
                    Task { await InviteService.decline(inviteId: id) }
                } label: {
                    Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: 0xA21CAF))
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(Color(hex: 0xF5D0FE), lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14).fill(
                LinearGradient(colors: [Color(hex: 0xFDF4FF), Color(hex: 0xFCE7F3)], startPoint: .topLeading, endPoint: .bottomTrailing)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xF5D0FE), lineWidth: 1.5))
        }
    }

    // MARK: - LIVE banner + footer (ports the web home bottom)

    /// Real-time connected-player count + (Pro-only) Invite button.
    private var liveBar: some View {
        HStack {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    LivePulseDot()
                    Text("LIVE").font(Brand.font(12, .black)).foregroundStyle(Theme.textPrimary)
                }
                Text(liveCountLabel).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            if auth.isProActive {
                Button { showInvite = true } label: {
                    Text("Invite").font(Brand.font(10, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(RoundedRectangle(cornerRadius: 6).fill(
                            LinearGradient(colors: [Color(hex: 0xEC4899), Color(hex: 0xDB2777)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                        .shadow(color: Color(hex: 0x9F1239), radius: 0, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
        .padding(.top, 4)
    }

    private var liveCountLabel: String {
        guard let n = livePlayers.count else { return "Players online" }
        return "\(n) \(n == 1 ? "player" : "players") online"
    }

    private var signOutButton: some View {
        Button { Task { await auth.signOut() } } label: {
            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.top, 2)
    }

    /// About · How to Play · Privacy · Terms — same destinations as Settings, so
    /// the content is the single source of truth and stays aligned with the web.
    private var footerLinks: some View {
        HStack(spacing: 12) {
            NavigationLink { InfoPage(.about) } label: { footerLink("About") }
            NavigationLink { HelpView() } label: { footerLink("How to Play") }
            NavigationLink { InfoPage(.privacy) } label: { footerLink("Privacy") }
            NavigationLink { InfoPage(.terms) } label: { footerLink("Terms") }
        }
        .padding(.top, 2)
    }

    private func footerLink(_ t: String) -> some View {
        Text(t).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
    }

    // MARK: - Mode card

    /// Freemium lock: a free user who has already played today's daily for this
    /// mode can't replay it (Pro unlocks unlimited replays). Mirrors the web's
    /// `isLocked = !isPro && (isDailyDone || hasPlayedModeToday)`. The VS card
    /// greys out the same way once today's free daily VS is used (web parity) —
    /// gated by the local VSPlayLimit, the same gate the lobby uses.
    private func isLocked(_ mode: HomeMode) -> Bool {
        guard !auth.isProActive else { return false }
        if mode.id == "vs" { return VSPlayLimit.hasPlayedToday() }
        guard let key = mode.dbKey else { return false }
        return completions.byMode[key] != nil
    }

    @ViewBuilder
    private func card(_ mode: HomeMode) -> some View {
        // In Unlimited mode the VS swords button overlays each standard mode card
        // (Pro-only), matching the web. The card itself still navigates to play.
        ZStack(alignment: .bottomTrailing) {
            cardLink(mode)
            if showsVS(mode) {
                Button { showVSLobby = true } label: {
                    Image("swords").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 15, height: 15).foregroundStyle(mode.accent)
                        .frame(width: 28, height: 28)
                        .background(RoundedRectangle(cornerRadius: 8).fill(mode.accent.opacity(0.12)))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(10)
            }
        }
    }

    /// A daily this user has already finished (in Daily mode). Revisiting it
    /// should show the solved review, not silently start a replay.
    private func isCompletedDaily(_ mode: HomeMode) -> Bool {
        guard effectiveMode == .daily, mode.id != "vs", let key = mode.dbKey else { return false }
        return completions.byMode[key] != nil
    }

    @ViewBuilder
    private func cardLink(_ mode: HomeMode) -> some View {
        let locked = isLocked(mode)
        if locked {
            // Free user, completed daily → upsell + "View Solved Puzzle".
            Button { limitModal = mode } label: { cardBody(mode, locked: true) }
                .buttonStyle(.plain)
        } else if isCompletedDaily(mode) {
            // Pro user revisiting a finished daily → open the solved-puzzle review
            // (matches the web), instead of replaying the same daily seed.
            Button { solvedMode = mode } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
        } else if let gameMode = mode.mode {
            if effectiveMode == .unlimited {
                // Unlimited: resolve the seed at TAP time so an in-progress
                // puzzle resumes (persists until finished) and only a
                // finished/none case starts a fresh one — matching the web's
                // non-daily session behavior. (Resolving in the destination
                // builder would churn the seed on every render.)
                Button {
                    pendingGame = ActiveGame(seed: resolvedUnlimitedSeed(gameMode), mode: gameMode, title: mode.title)
                } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
            } else {
                Button {
                    pendingGame = ActiveGame(seed: DailySeed.today(mode: gameMode), mode: gameMode, title: mode.title)
                } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
            }
        } else if mode.id == "propernoundle" {
            if effectiveMode == .unlimited {
                // Unlimited PN: fresh random puzzle per tap (was wrongly
                // reopening the daily puzzle).
                Button { pnGame = PNGame(seed: freshPNSeed()) } label: { cardBody(mode, locked: false) }
                    .buttonStyle(.plain)
            } else {
                NavigationLink { ProperNoundleView() } label: { cardBody(mode, locked: false) }
                    .buttonStyle(.plain)
            }
        } else if mode.id == "vs" {
            if effectiveMode == .unlimited {
                // Unlimited VS (Pro): the mode-picker lobby — any-mode battles
                // + private matches.
                NavigationLink { VSLobbyView() } label: { cardBody(mode, locked: false) }
                    .buttonStyle(.plain)
            } else {
                // Daily VS: the shared once-a-day Classic match. Launch the VS
                // game directly — it shows the matchmaking queue, or the
                // already-played finished screen if today's daily VS is done
                // (Pro included). No more dropping into the lobby. (web parity)
                NavigationLink { VSGameView(mode: .duel, isDaily: true) } label: { cardBody(mode, locked: false) }
                    .buttonStyle(.plain)
            }
        } else {
            Button { comingSoon = mode.title } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
        }
    }

    /// Unlimited seed for a mode: resume the in-progress non-daily puzzle if one
    /// exists and isn't finished (web parity — the puzzle persists until solved);
    /// otherwise mint a fresh seed and remember it as the current one.
    private func resolvedUnlimitedSeed(_ gameMode: GameMode) -> String {
        let key = "unlimited-current-\(gameMode.rawValue)"
        // Resume an in-progress unlimited game only if it's <24h old (web purges
        // practice saves after 24h); otherwise start fresh.
        if let saved = UserDefaults.standard.string(forKey: key),
           let state = GamePersistence.shared.load(seed: saved, mode: gameMode),
           state.status == .playing,
           (Date().timeIntervalSince1970 * 1000 - state.startTime) < 24 * 3600 * 1000 {
            return saved
        }
        let fresh = "unlimited-\(gameMode.rawValue)-\(Int(Date().timeIntervalSince1970))"
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }

    /// VS swords overlay: Pro + Unlimited, for every VS-capable mode (all but
    /// the VS card itself). ProperNoundle has no GameMode on its HomeMode, so
    /// it's allowed through explicitly.
    private func showsVS(_ mode: HomeMode) -> Bool {
        auth.isProActive && effectiveMode == .unlimited && mode.id != "vs"
            && (mode.mode != nil || mode.id == "propernoundle")
    }

    private func cardBody(_ mode: HomeMode, locked: Bool) -> some View {
        // Daily completion (W/L badge, "N guesses · time", accent tint) is a
        // DAILY-only concept. In Unlimited mode the cards must show the static
        // mode description with no badge/tint — matching the web. (Pro parity #91.)
        let isVs = mode.id == "vs"
        let done = (!isVs && effectiveMode == .daily) ? mode.dbKey.flatMap { completions.byMode[$0] } : nil
        // VS has no solo daily_results row; reflect today's daily-VS outcome
        // (won/lost) so the card gets the same W/L badge + accent tint as the
        // other completed daily cards (greyed when locked for freemium).
        let vsWon: Bool? = (isVs && effectiveMode == .daily) ? vsDailyWon : nil
        let isDone = done != nil || vsWon != nil
        let lockGray = Color(hex: 0xD1D5DB)
        let barColors = locked ? [lockGray, lockGray] : [mode.accent, mode.accent.opacity(0.53)]
        let borderC = locked ? lockGray : (isDone ? mode.accent.opacity(0.4) : Theme.border)
        return VStack(spacing: 0) {
            // Full-width top accent bar (flush, gradient → accent@0x88; gray when locked).
            LinearGradient(colors: barColors, startPoint: .leading, endPoint: .trailing)
                .frame(height: 4)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    ModeIconView(icon: mode.icon, accent: mode.accent, box: 32)
                    Spacer()
                    if let done { winBadge(won: done.completed) }
                    else if let vsWon { winBadge(won: vsWon) }
                }
                Text(mode.title).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                    .padding(.top, 8)
                Text(isVs ? (vsWon != nil ? "Played today" : mode.desc) : resultText(mode, done))
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.top, 1)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(RoundedRectangle(cornerRadius: 14).fill(isDone ? mode.accent.opacity(0.06) : Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(borderC, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .opacity(locked ? 0.6 : 1)
    }

    private func resultText(_ mode: HomeMode, _ done: DailyCompletion?) -> String {
        guard let done else { return mode.desc }
        return "\(done.guessCount) guesses · \(formatShortTime(Int(done.timeSeconds)))"
    }

    private func winBadge(won: Bool) -> some View {
        Text(won ? "W" : "L").font(Brand.font(10, .black)).foregroundStyle(.white)
            .frame(width: 20, height: 20)
            .background(RoundedRectangle(cornerRadius: 6).fill(Color(hex: won ? 0x7C3AED : 0xDC2626)))
    }
}

/// Freemium "Played Today" lock modal — ports modals/mode-limit-modal.tsx:
/// lock icon, "{mode} — Played Today", upsell copy, play-again countdown,
/// Upgrade to Pro (amber btn-3d), and View Solved Puzzle.
struct ModeLimitModal: View {
    let mode: HomeMode
    var showViewSolved: Bool = true
    let onClose: () -> Void
    let onUpgrade: () -> Void
    let onViewSolved: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea().onTapGesture { onClose() }
            VStack(spacing: 0) {
                Image(systemName: "lock.fill").font(.system(size: 40)).foregroundStyle(Theme.textMuted)
                    .padding(.bottom, 12)
                Text("\(mode.title) — Played Today").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.center).padding(.bottom, 4)
                Text("You've used your free play of \(mode.title) for today. Upgrade to Pro for unlimited replays and ad-free gameplay across all 9 modes.")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center).padding(.bottom, 16)

                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    Text("Play again tomorrow in \(countdown())")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.primary)
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surfaceHover))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                .padding(.bottom, 16)

                Button(action: onUpgrade) {
                    HStack(spacing: 6) {
                        Image(systemName: "crown.fill").font(.system(size: 14))
                        Text("Upgrade to Pro").font(Brand.font(14, .black))
                    }
                    .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .shadow(color: Color(hex: 0x92400E), radius: 0, x: 0, y: 4))
                }.buttonStyle(.plain).padding(.bottom, 12)

                // Web parity: only show "View Solved Puzzle" when there IS a solved
                // puzzle to review (VS has none) — otherwise a muted dismiss.
                // Previously showViewSolved was never read, so the locked VS card
                // dead-ended into an empty fullScreenCover.
                if showViewSolved {
                    Button("View Solved Puzzle", action: onViewSolved)
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.primary)
                } else {
                    Button("Come back tomorrow", action: onClose)
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
            .padding(24)
            .frame(maxWidth: 360)
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
            .shadow(color: .black.opacity(0.15), radius: 30, x: 0, y: 20)
            .padding(.horizontal, 24)
        }
    }

    private func countdown() -> String {
        let s = secondsUntilLocalMidnight()
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}

/// LIVE pulse dot — self-contained so the live-count poll re-rendering the
/// banner can't disturb/displace its animation. Pulses opacity in place
/// (layout-neutral); respects Reduce Motion.
private struct LivePulseDot: View {
    @State private var dim = false
    var body: some View {
        Circle().fill(Color(hex: 0x22C55E)).frame(width: 8, height: 8)
            .opacity(dim ? 0.35 : 1)
            .onAppear {
                guard !ThemeManager.shared.reducedMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { dim = true }
            }
    }
}
