import SwiftUI
import WordociousCore

/// Everything the VS lobby reads, refreshed on appear and polled for the live
/// counts. The RECORD row sums user_stats exactly like the Stats page's VS
/// section (People = 'vs', Bots = 'vs_cpu'), so the two always agree.
@MainActor
final class VSLobbyModel: ObservableObject {
    @Published var battle: VsDayResult = .open
    @Published var battleOpponent: String?
    @Published var progression = CpuProgressionStore.load()
    @Published var people = WinLoss(wins: 0, losses: 0)
    @Published var bots = WinLoss(wins: 0, losses: 0)
    @Published var incoming: [VsChallenge] = []
    @Published var sent: [VsSentChallenge] = []
    @Published var counts: VsLobbyKit.Counts?
    @Published var online: Int?
    @Published var rivals: [StatsDeepService.Rivalry] = []
    /// Free: today's Daily Battle is spent (this device, or a person row).
    @Published var dailyUsed = false

    var botOfDay: VsDayResult { progression.botOfDay(todayUtc: LeaderboardService.todayUTC()) }

    func refresh(isPro: Bool) async {
        progression = CpuProgressionStore.load()
        guard let uid = AuthService.shared.profile?.id else { return }
        async let rows = UserStatsService.fetch(userId: uid)
        async let lists = VsChallengeService.list()
        async let day = VsLobbyKit.dailyBattle()
        async let rivalRows: [StatsDeepService.Rivalry] = isPro ? StatsDeepService.rivalries(limit: 3) : []
        let r = await rows
        let vs = UserStatsService.vsRecord(r), cpu = UserStatsService.cpuRecord(r)
        people = WinLoss(wins: vs.wins, losses: vs.losses)
        bots = WinLoss(wins: cpu.wins, losses: cpu.losses)
        if let l = await lists {
            incoming = l.incoming.sorted { ($0.createdDate ?? .distantPast) > ($1.createdDate ?? .distantPast) }
            sent = l.sent
        }
        let d = await day
        battle = d.result
        battleOpponent = d.opponent
        dailyUsed = VSPlayLimit.hasPlayedToday() || battle != .open
        rivals = await rivalRows
    }

    /// The nav's honest count, every 5 s while the lobby is on screen.
    func pollCounts() async {
        while !Task.isCancelled {
            if let c = await VsLobbyKit.fetchCounts() { counts = c }
            if (counts?.totalWaiting ?? 0) == 0, let n = await VsLobbyKit.fetchOnline() { online = n }
            try? await Task.sleep(nanoseconds: 5_000_000_000)
        }
    }
}

/// The VS lobby (VS overhaul, founder 2026-10-01; spec docs/VS_REDESIGN_SPEC.md
/// §2): the VS banner, incoming challenges, PLAY (mode strip + LIVE / FRIEND /
/// BOTS), RIVALS, YOUR CHALLENGES and the code field. Every tap ends in a game:
/// a live search hands off to a bot at 0:15, friends race your run any time in
/// 24 h. Free players get the Daily Battle, the Bot of the Day and answering
/// challenges; guests keep the sign-in card.
struct VSLobbyView: View {
    @ObservedObject private var auth = AuthService.shared
    @StateObject private var model = VSLobbyModel()
    @Environment(\.dismiss) private var dismiss

    struct PendingInvite: Identifiable { let id = UUID(); let mode: GameMode; let code: String }

    @State private var mode: GameMode = VsLobbyKit.selectedMode
    @State private var joinCode = ""
    @State private var lookupError: String?
    @State private var joining = false
    @State private var pendingInvite: PendingInvite?
    @State private var raceCode: String?
    @State private var launch: Launch?
    @State private var showVSLimit = false
    @State private var showAuth = false
    @State private var showPro = false

    /// A game started from the banner's tiles.
    struct Launch: Identifiable { let id = UUID(); let mode: GameMode; let isDaily: Bool; let intent: VSIntent }

    /// RootTabView ignores the keyboard safe area for the whole tab shell (the
    /// bottom nav must never ride a keyboard inset — real or latched by a
    /// covered-hierarchy dismissal). This lobby hosts the ONE text field that
    /// lives in tab content (join code), so it restores its own avoidance:
    /// inset the scroll content by the keyboard's height while it's up.
    @State private var kbInset: CGFloat = 0

    private var isPro: Bool { auth.isProActive }
    private var free: Bool { !isPro }
    private var branded: Bool { FlagsService.shared.isLive(BrandedInvite.switchKey) }

    var body: some View {
        VStack(spacing: 0) {
            nav
            ScrollView {
                // BJ7: 12 between sections, a shorter title art.
                VStack(alignment: .leading, spacing: 12) {
                    // FINISH_SPEC §A6: the VS title art as the page headline, edge to edge.
                    PageHeadline(.vs, label: "VS Battle", bleed: 16, maxHeight: 96)
                    if !auth.isAuthenticated {
                        guestPrompt
                    } else {
                        banner
                        if branded {
                            // 9f: ONE Invites row (live invites + race challenges, Accept / Decline) and ONE obvious
                            // Have a code? button replace the incoming notices and the code field at the bottom.
                            InvitesRow { item in
                                switch item.variant {
                                case .race: raceCode = item.code
                                case .live:
                                    if let m = GameMode(rawValue: item.gameMode) { pendingInvite = PendingInvite(mode: m, code: item.code) }
                                }
                            }
                            HaveACodeButton { result in
                                switch result {
                                case .race(let code): raceCode = code
                                case .live(let mode, let code): pendingInvite = PendingInvite(mode: mode, code: code)
                                case .friend(let code): if let u = URL(string: "https://wordocious.com/join/\(code)") { UIApplication.shared.open(u) }
                                }
                            }
                        } else if !model.incoming.isEmpty { incomingSection }
                        playSection
                        if isPro { rivalsSection } else { proCard }
                        yourChallenges
                        if !branded { codeSection }
                    }
                }
                // Generous bottom inset so the code row clears the tab bar (the
                // lobby is pushed inside the Home tab's nav stack) and the ad banner.
                .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 100)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: kbInset) }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { note in
            guard let f = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            withAnimation(.easeOut(duration: 0.25)) { kbInset = f.height }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.easeOut(duration: 0.25)) { kbInset = 0 }
        }
        .pageBackground(.vs, lightOnly: true)
        .toolbar(.hidden, for: .navigationBar)
        .swipeToGoBack { dismiss() }
        .softSheet(isPresented: $showAuth) { AuthView() }
        .softSheet(isPresented: $showPro) { ProView(reason: "VS bots") }
        // Launch a private match once a live code resolves.
        .gameCover(item: $pendingInvite) { inv in
            NavigationStack { VSGameView(mode: inv.mode, inviteCode: inv.code) }
        }
        .navigationDestination(isPresented: Binding(get: { raceCode != nil }, set: { if !$0 { raceCode = nil } })) {
            if let code = raceCode { VSChallengeRaceView(code: code) }
        }
        .navigationDestination(isPresented: Binding(get: { launch != nil }, set: { if !$0 { launch = nil } })) {
            if let l = launch { VSGameView(mode: l.mode, isDaily: l.isDaily, intent: l.intent) }
        }
        // Back from a game (or any page): fresh results, ladder and challenges.
        .onAppear {
            guard auth.isAuthenticated else { return }
            Task { await model.refresh(isPro: isPro) }
            // Race results that couldn't be sent (offline / 5xx) go out now (§14);
            // a recorded one changes the banner's record, so refresh again.
            Task { if await VsPendingRaces.retryAll() { await model.refresh(isPro: isPro) } }
        }
        .onChange(of: auth.profile?.id) { _ in Task { await model.refresh(isPro: isPro) } }
        .task { await model.pollCounts() }
        .onChange(of: mode) { VsLobbyKit.selectedMode = $0 }
        .overlay { if showVSLimit { VSLimitModal { showVSLimit = false } } }
    }

    // MARK: - Nav (back, VS BATTLE, the honest count)

    /// The controls row: the bare 3D back icon and the honest count (the title is
    /// the §A6 headline below it).
    private var nav: some View {
        HStack(spacing: 8) {
            HeaderCircleButton(.symbol("chevron.left"), label: "Back", action: { dismiss() })
            Spacer(minLength: 0)
            let looking = model.counts?.totalWaiting ?? 0
            if looking > 0 || model.online != nil {
                HStack(spacing: 5) {
                    Circle().fill(looking > 0 ? Color(hex: 0x22C55E) : Color(hex: 0x9CA3AF)).frame(width: 7, height: 7)
                    Text("\(looking > 0 ? looking : (model.online ?? 0))").vsNumber(13)
                    Text(looking > 0 ? "looking" : "online")
                        .font(Brand.font(11, .heavy)).foregroundStyle(VsLobbyKit.mutedInk)
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Capsule().fill(VsLobbyKit.ink.vsWash(0.16)))
                .accessibilityElement(children: .combine)
                .padding(.trailing, 8)
            }
        }
        .padding(.horizontal, 10).padding(.top, 4).frame(height: 48)
    }

    // MARK: - Banner (§1)

    private var banner: some View {
        VSBannerView(
            name: auth.profile?.username ?? "",
            battle: model.battle, battleOpponent: model.battleOpponent,
            botOfDay: model.botOfDay, incoming: model.incoming.first,
            streak: model.progression.streak, people: model.people, bots: model.bots,
            ladder: free ? nil : model.progression.ladderCleared, free: free,
            onBattle: startDailyBattle, onBotOfDay: startBotOfDay)
    }

    private func startDailyBattle() {
        guard model.battle == .open else { return }
        if free && model.dailyUsed { showVSLimit = true; return }
        launch = Launch(mode: .duel, isDaily: true, intent: .live)
    }

    /// Free: once per UTC day, Classic. Pro: the selected mode.
    private func startBotOfDay() {
        guard model.botOfDay == .open else { return }
        launch = Launch(mode: free ? .duel : mode, isDaily: false, intent: .bot(.daily))
    }

    // MARK: - Incoming challenges

    private var incomingSection: some View {
        VStack(spacing: 6) {
            ForEach(model.incoming.prefix(3)) { c in
                NavigationLink { VSChallengeRaceView(code: c.code) } label: { incomingCard(c) }
                    .buttonStyle(.squish)
            }
        }
    }

    private func incomingCard(_ c: VsChallenge) -> some View {
        let line = c.run.solved
            ? "\(VsLobbyKit.modeName(c.mode)) · solved in \(c.run.guesses) · \(VsLobby.vsClock(c.run.timeMs)) · \(c.hoursLeft)h left"
            : "\(VsLobbyKit.modeName(c.mode)) · not solved · \(c.hoursLeft)h left"
        // BJ7: one top line — avatar, title and the Race tag top-aligned; detail 4 under.
        return HStack(alignment: .top, spacing: 10) {
            VSInitialAvatar(name: c.challenger.username, size: 36)
            VStack(alignment: .leading, spacing: 4) {
                Text("CHALLENGE FROM @\(c.challenger.username.uppercased())")
                    .font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(VsLobbyKit.titleInk).lineLimit(1)
                Text(line).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.mutedInk).lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 4)
            VSCandyTag(title: "Race", symbol: "play.fill", variant: .pink)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .vsTinted(Color(hex: 0xEC4899), bar: [Color(hex: 0xF472B6), Color(hex: 0xA21CAF)], radius: 18, barHeight: 5, tint: 0.09)
    }

    // MARK: - PLAY

    private var playSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VSSectionLabel(text: "PLAY")
                Spacer()
                Text(VsLobbyKit.modeName(mode).uppercased()).font(Brand.font(11, .black)).tracking(0.8)
                    .foregroundStyle(VsLobbyKit.accent(mode))
            }
            modeStrip
            // BJ7: the three tiles hug the longest one (equal heights, no 112 floor).
            HStack(alignment: .top, spacing: 8) {
                if isPro { liveTile } else { dailyTile }
                friendTile
                botsTile
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// The nine VS modes. Free: every icon shows, only Classic is selectable.
    private var modeStrip: some View {
        // Square game tiles at strip size, icon only (docs/GAME_TILE_STYLE.md).
        HStack(spacing: 5) {
            ForEach(VsLobbyKit.modes, id: \.self) { m in
                let locked = free && m != .duel
                let accent = VsLobbyKit.accent(m)
                Button {
                    if locked { showPro = true } else { Haptics.tap(); mode = m }
                } label: {
                    // Under a dark season the chips take the night surface (Android parity), else the light page's white wash.
                    GameTileSquare(accent: accent, selected: (free ? .duel : mode) == m, radius: 10, light: !VsLobbyKit.darkSeason) { chip in
                        if let h = VsLobbyKit.home(m) { ModeIconView(icon: h.icon, accent: accent, box: chip) }
                    }
                    .opacity(locked ? 0.35 : 1)
                }
                .buttonStyle(.squish)
                .accessibilityLabel(VsLobbyKit.modeName(m) + (locked ? ", Pro" : ""))
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 4)
    }

    /// A PLAY tile as a §A1 mini game card in its own color (top bar, soft wash);
    /// `art` tiles (the BOTS character) draw their icon without the chip behind.
    private func playTile(icon: some View, title: String, sub: String, accent: Color,
                          locked: Bool = false, art: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                if art {
                    icon.frame(height: 36)
                } else {
                    icon
                        .frame(width: 30, height: 30)
                        .background(RoundedRectangle(cornerRadius: 9).fill(accent.vsWash(0.24)))
                }
                Spacer(minLength: 0)
                if locked { VSLockBadge() }
            }
            Text(title).font(Brand.font(12, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.titleInk)
            Text(sub).font(Brand.font(10.5, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .vsTinted(accent, bar: [accent.vsWash(0.7), accent], radius: 16, barHeight: 5, tint: 0.10, line: 0.32)
    }

    private var liveTile: some View {
        let waiting = model.counts?.waiting[mode.rawValue] ?? 0
        let sub = waiting > 0
            ? "\(waiting) waiting now in \(VsLobbyKit.modeName(mode))."
            : "0 waiting now. A bot steps in at 0:15."
        return NavigationLink { VSGameView(mode: mode, intent: .live) } label: {
            playTile(icon: Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 13, weight: .bold)).foregroundStyle(VsLobbyKit.ink),
                     title: "LIVE", sub: sub, accent: VsLobbyKit.ink)
        }
        .buttonStyle(.squish)
    }

    /// Free: today's Daily Battle (a bot steps in if nobody is on).
    private var dailyTile: some View {
        Button {
            if model.dailyUsed { showVSLimit = true } else { launch = Launch(mode: .duel, isDaily: true, intent: .live) }
        } label: {
            playTile(icon: Image("swords").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 14, height: 14).foregroundStyle(VsLobbyKit.ink),
                     title: "DAILY",
                     sub: model.dailyUsed ? "Played today. Pro plays live any time." : "Today’s battle. A bot steps in if nobody is on.",
                     accent: VsLobbyKit.ink)
        }
        .buttonStyle(.squish)
    }

    private var friendTile: some View {
        NavigationLink {
            if isPro { VSFriendPage(mode: mode) } else { ProView() }
        } label: {
            playTile(icon: Image(systemName: "person.2.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(Color(hex: 0xEC4899)),
                     title: "FRIEND",
                     sub: isPro ? "You play first. They race your run." : "Send with Pro. Answering is free.",
                     accent: Color(hex: 0xEC4899), locked: free)
        }
        .buttonStyle(.squish)
    }

    private var botsTile: some View {
        let cleared = model.progression.ladderCleared
        let sub: String = free
            ? "Bot of the Day is free. Ladder is Pro."
            : (cleared >= VsLobby.ladderBots.count
               ? "Ladder cleared!"
               : "Ladder \(cleared) of \(VsLobby.ladderBots.count). \(VsLobby.botName(model.progression.nextLadderBot)) is next.")
        // §D3: the ladder tile shows the NEXT cast bot in character (its "ready"
        // pose — the Bot of the Day tile above uses the hero image, §A7); a cleared
        // ladder shows the trophy.
        let next = BotPersonas.persona(model.progression.nextLadderBot)
        let allClear = !free && cleared >= VsLobby.ladderBots.count
        return NavigationLink { VSBotsView(mode: free ? .duel : mode) } label: {
            playTile(icon: Group {
                        if allClear && ArtAsset.exists("art-medal-trophy") {
                            VSArt("art-medal-trophy", height: 40)
                        } else {
                            PoseImage(next.mascot, "ready", height: 40)
                        }
                     },
                     title: "BOTS", sub: sub, accent: allClear ? VsLobbyKit.gold : Color(hex: UInt(next.color)), art: true)
        }
        .buttonStyle(.squish)
    }

    // MARK: - RIVALS (Pro) / Go Pro (free)

    @ViewBuilder private var rivalsSection: some View {
        if !model.rivals.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    VSSectionLabel(text: "RIVALS")
                    Spacer()
                    Button {
                        StatsJump.requestVS()
                    } label: {
                        CandyLabel(title: "See all")
                    }
                    .buttonStyle(CastButtonStyle(color: .teal, size: .small, fullWidth: false))
                }
                VStack(spacing: 0) {
                    ForEach(Array(model.rivals.prefix(3).enumerated()), id: \.element.id) { i, r in
                        rivalRow(r).vsStripedRow(i)
                    }
                }
                .vsTinted(VsLobbyKit.ink, bar: VsLobbyKit.tealBar, radius: 18, barHeight: 5)
            }
        }
    }

    private func rivalRow(_ r: StatsDeepService.Rivalry) -> some View {
        // BJ7: top-aligned row, detail 4 under the name.
        HStack(alignment: .top, spacing: 10) {
            VSInitialAvatar(name: r.username, size: 36)
            VStack(alignment: .leading, spacing: 4) {
                Text("@\(r.username)").font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.titleInk).lineLimit(1)
                Text(VsLobbyKit.rivalLine(wins: r.wins, losses: r.losses, lastMode: r.lastMode))
                    .font(Brand.font(11, .heavy))
                    .foregroundStyle(r.wins == r.losses ? VsLobbyKit.mutedInk : VsLobbyKit.ink)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 4)
            NavigationLink { VSFriendPage(mode: mode, preselected: [r.opponentId]) } label: {
                CandyLabel(title: "Challenge")
            }
            .buttonStyle(CastButtonStyle(color: .pink, size: .small, fullWidth: false))
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
    }

    /// Go Pro (free): the gold card family (§G1) with the trophy and an amber candy CTA.
    private var proCard: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Icon3D(.crown, size: 20)
                    Text("GO PRO FOR ALL OF VS").font(Brand.font(14, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.titleInk)
                }
                Text("All 9 modes, live matches any time, challenge any friend, the bot ladder, rematches and your rivals.")
                    .font(Brand.font(11.5, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)
                NavigationLink { ProView() } label: {
                    CandyLabel(title: "See Pro", symbol: "crown.fill")
                }
                .buttonStyle(CastButtonStyle(color: .gold, size: .medium, fullWidth: false))
            }
            if ArtAsset.exists("art-medal-trophy") {
                VSArt("art-medal-trophy", height: 60).frame(width: 56)
            }
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .vsTinted(VsLobbyKit.gold, bar: VsLobbyKit.goldBar, radius: 18, barHeight: 6, tint: 0.12, line: 0.34)
    }

    // MARK: - YOUR CHALLENGES (sent in the last 24 h)

    @ViewBuilder private var yourChallenges: some View {
        let recent = model.sent.filter { ($0.createdDate ?? .distantPast) > Date().addingTimeInterval(-24 * 3600) }
        if !recent.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                VSSectionLabel(text: "YOUR CHALLENGES")
                VStack(spacing: 0) {
                    ForEach(Array(recent.prefix(3).enumerated()), id: \.element.id) { i, c in
                        NavigationLink { VSChallengeRaceView(code: c.code) } label: { sentRow(c).vsStripedRow(i, accent: VsLobbyKit.purple) }
                            .buttonStyle(.squish)
                    }
                }
                .vsTinted(VsLobbyKit.purple, bar: VsLobbyKit.purpleBar, radius: 18, barHeight: 5)
            }
        }
    }

    private func sentRow(_ c: VsSentChallenge) -> some View {
        let status: String = {
            guard let r = c.results.last else { return "waiting" }
            switch r.outcome {
            case "loss": return "@\(r.username) beat it"
            case "win": return "@\(r.username) lost"
            default: return "@\(r.username) tied"
            }
        }()
        let sentTo = c.invitees > 0 ? "sent to \(c.invitees)" : "link"
        return HStack(spacing: 10) {
            VSModeGlyphTile(mode: c.mode, selected: false, size: 26)
            Text("\(VsLobbyKit.modeName(c.mode)) · \(sentTo)").font(Brand.font(12, .heavy)).foregroundStyle(VsLobbyKit.titleInk)
            Spacer(minLength: 4)
            Text(status).font(Brand.font(11, .heavy))
                .foregroundStyle(status == "waiting" ? VsLobbyKit.mutedInk : VsLobbyKit.purpleSub).lineLimit(1)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    // MARK: - HAVE A CODE?

    private var codeSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            VSSectionLabel(text: "HAVE A CODE?")
            HStack(spacing: 8) {
                TextField("CODE", text: $joinCode)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .font(Brand.font(15, .heavy)).tracking(3)
                    .onChange(of: joinCode) { v in
                        let clean = String(v.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8))
                        if clean != v { joinCode = clean }
                    }
                    .foregroundStyle(VsLobbyKit.numberInk)
                    .padding(.horizontal, 12).frame(height: 42)
                    // BI23 / BJ7: a soft filled field, no outline.
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(VsLobbyKit.ink.vsWash(0.16)))
                Button { joinWithCode() } label: {
                    CandyLabel(title: "Join") {
                        if joining { ProgressView().controlSize(.small).tint(.white) }
                    }
                }
                .buttonStyle(CastButtonStyle(color: .teal, size: .medium, fullWidth: false))
                .disabled(joinCode.count < 4 || joining)
            }
            .padding(10)
            .vsTinted(VsLobbyKit.ink, radius: 18)
            if let e = lookupError { Text(e).font(Brand.body(12)).foregroundStyle(Color(hex: 0xDC2626)) }
        }
    }

    /// A challenge code first (GET /api/vs/challenges/<code>); otherwise a live
    /// private-match code (the existing join path).
    private func joinWithCode() {
        let code = joinCode.trimmingCharacters(in: .whitespaces).uppercased()
        lookupError = nil
        joining = true
        Task {
            defer { joining = false }
            if case .success = await VsChallengeService.get(code: code) {
                raceCode = code
            } else if let mode = await InviteService.lookupMode(code: code) {
                pendingInvite = PendingInvite(mode: mode, code: code)
            } else {
                lookupError = "No match or challenge found for that code."
            }
        }
    }

    // VS is account-based (live opponents, recorded results) — guests sign in first.
    // Founder: no plain-text headings — the Friends guest pitch (cast scene, the VS
    // BATTLE heading art, one line, the SIGN IN cast button). Web / Android parity.
    private var guestPrompt: some View {
        // The page's VS BATTLE title art already names it: no second heading in the pitch.
        GuestPitch(hosts: [Mascots.vs, Mascots.home], title: "VS Battle", showsTitle: false,
                   subtitle: "Sign in to battle live opponents, bots and your friends' runs, and keep your results.",
                   colors: [Color(hex: 0x0D9488), Color(hex: 0x7C3AED)],
                   preview: .none, onSignIn: { showAuth = true })
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
    }

    // MARK: - Daily VS limit modal (ports vs-limit-modal.tsx)
    // Internal (not private) so VSGameView can reuse it for the non-Pro
    // Rematch upsell — web parity: the Rematch button opens VsLimitModal.

    struct VSLimitModal: View {
        var onClose: () -> Void
        @State private var secondsLeft = secondsUntilLocalMidnight()
        private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

        private var countdown: String {
            String(format: "%02d:%02d:%02d", secondsLeft / 3600, (secondsLeft % 3600) / 60, secondsLeft % 60)
        }

        var body: some View {
            ZStack {
                Color.black.opacity(0.5).ignoresSafeArea().onTapGesture { onClose() }
                VStack(spacing: 14) {
                    // ART_SPEC §7: the played-today limit is U's all-done scene.
                    if ArtScene.allDone.isAvailable {
                        SceneArt(.allDone, height: 120)
                    } else {
                        Image("swords").renderingMode(.template).resizable().scaledToFit()
                            .frame(width: 44, height: 44).foregroundStyle(Theme.textMuted)
                    }
                    HeadingArtView(.vsused)   // BJ16
                    Text("You've played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.")
                        .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.mutedInk)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 6) {
                        // The gold clock sprite (night art 10-03); no outline on the pill.
                        Image("art-badge-icon-clock-sprite").resizable().interpolation(.high)
                            .frame(width: 18, height: 18).accessibilityHidden(true)
                        Text("Resets in").font(Brand.font(12, .heavy)).foregroundStyle(VsLobbyKit.mutedInk)
                        Text(countdown).vsNumber(16)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 7)
                    .background(Capsule().fill(VsLobbyKit.purple.vsWash(0.12)))
                    .accessibilityElement(children: .combine)
                    NavigationLink { ProView() } label: {
                        CandyLabel(title: "Go Pro")   // the GO PRO lettering says it: no small crown
                    }
                    .buttonStyle(CastButtonStyle(color: .gold, size: .large))
                    .simultaneousGesture(TapGesture().onEnded { onClose() })
                    Button { onClose() } label: { CandyLabel(title: "Maybe later") }
                        .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium))
                }
                .padding(24).frame(maxWidth: 340)
                .vsTinted(VsLobbyKit.gold, bar: VsLobbyKit.goldBar, tint: 0.10, line: 0.32)
                .shadow(color: .black.opacity(0.12), radius: 30, x: 0, y: 20)
                .padding(.horizontal, 24)
            }
            .onReceive(ticker) { _ in secondsLeft = secondsUntilLocalMidnight() }
        }
    }
}

/// "See all" on the lobby's Rivals: land on Stats, scrolled to All-time's VS
/// section. The flag survives a Stats tab that isn't built yet (read on appear).
enum StatsJump {
    static let openVS = Notification.Name("wordocious.open-stats-vs")
    private(set) static var pendingVS = false

    static func requestVS() {
        pendingVS = true
        NotificationCenter.default.post(name: .openStats, object: nil)
        NotificationCenter.default.post(name: openVS, object: nil)
    }

    /// FINISH_SPEC BF2 "See all": Stats → All-time (the achievements grid).
    static let openAchievements = Notification.Name("wordocious.open-stats-achievements")
    private(set) static var pendingAchievements = false

    static func requestAchievements() {
        pendingAchievements = true
        NotificationCenter.default.post(name: .openStats, object: nil)
        NotificationCenter.default.post(name: openAchievements, object: nil)
    }

    static func consumeAchievements() -> Bool {
        defer { pendingAchievements = false }
        return pendingAchievements
    }

    /// The Stats tab handled it.
    static func consumeVS() -> Bool {
        defer { pendingVS = false }
        return pendingVS
    }
}
