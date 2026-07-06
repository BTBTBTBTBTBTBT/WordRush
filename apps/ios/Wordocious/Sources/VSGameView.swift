import SwiftUI
import WordociousCore

/// The VS match UI — ports apps/web/components/vs/vs-game.tsx screens
/// (queue → countdown → match → waiting → result → rematch) for native.
struct VSGameView: View {
    @StateObject private var vm: VSMatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var adShown = false

    let mode: GameMode

    init(mode: GameMode, isDaily: Bool = false, inviteCode: String? = nil) {
        self.mode = mode
        _vm = StateObject(wrappedValue: VSMatchViewModel(mode: mode, isDaily: isDaily, inviteCode: inviteCode))
    }

    private var gradient: [Color] { ModeStyle.titleGradient(mode) }
    private var vsModeLabel: String {
        switch mode { case .duel6: return "SIX"; case .duel7: return "SEVEN"; default: return ModeStyle.title(mode) }
    }
    private var label: String { "VS \(vsModeLabel)" }

    // Non-Pro Rematch tap shows the Pro upsell modal (web parity — VsLimitModal).
    @State private var showRematchUpsell = false
    @State private var showCpuChooser = false
    @State private var cpuAutoOffer = false
    @State private var showCpuPro = false
    @State private var showInvite = false
    @State private var ghostRun: (guesses: Int, timeMs: Double)?
    // Leaving an in-progress match forfeits it (a recorded loss) — confirm first.
    @State private var confirmForfeit = false

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()

            switch vm.screen {
            case .notConfigured:     notConfigured
            case .entry:             entryScreen
            case .queue:             queueScreen
            case .match:             matchScreen
            case .waiting:           waitingScreen
            case .result:            resultScreen
            case .opponentLeft:      opponentLeftScreen
            case .alreadyPlayedDaily: DailyVsAlreadyPlayed(answer: vm.dailyAnswer, gradient: gradient, isPro: AuthService.shared.isProActive, won: vm.dailyWon, onHome: goHome)
            }

            // Don't stack the countdown UNDER the intro splash — it ticked behind
            // the dark overlay and then "popped" in color when the intro lifted.
            // Show it only once the intro is gone (clean dark intro → colored count).
            if vm.countdown != nil && !vm.showIntro {
                countdownOverlay
                    .transition(.opacity)
                    .zIndex(6)
            }

            // Match-intro splash — sits above the countdown for 2.5s (or until
            // tapped), web parity: MatchIntro renders only on the queue screen.
            if vm.showIntro, vm.screen == .queue {
                VSMatchIntroView(
                    me: .init(username: AuthService.shared.profile?.username ?? "You",
                              avatarUrl: AuthService.shared.profile?.avatarUrl,
                              level: AuthService.shared.profile?.level),
                    opponent: vm.opponentUserId != nil ? .init(username: vm.opponentInfo?.username ?? "…",
                                                               avatarUrl: vm.opponentInfo?.avatarUrl,
                                                               level: vm.opponentInfo?.level) : nil,
                    headToHead: vm.headToHead,
                    onDone: { vm.showIntro = false; vm.startCountdownTick() })
            }

            // Gauntlet stage-transition overlay — same auto-advancing overlay as
            // the solo run; covers the board while it re-lays-out for the next
            // stage so nothing visibly shifts (and no bare Continue button).
            if vm.screen == .match, let game = vm.game, game.stageCleared {
                StageTransitionOverlay(completedName: game.gauntletStageName,
                                       next: game.gauntletNextStageInfo,
                                       onAdvance: { game.nextStage() })
                    .transition(.opacity)
                    .zIndex(5)
            }

            // Moment callout — opponent milestones (greens / board solved / last guess).
            if let c = vm.callout, vm.screen == .match {
                VStack {
                    VSCalloutPill(text: c.text).id(c.id).padding(.top, 96)
                    Spacer()
                }
                .allowsHitTesting(false)
                .animation(Theme.animation(.easeOut(duration: 0.25)), value: c.id)
            }

            // Post-match XP/level-up toast (parity with solo + web VS result).
            if let xp = vm.xpResult, vm.screen == .result {
                XpToastView(result: xp) { vm.xpResult = nil }
            }

            // Pro upsell when a free user taps Rematch (web parity — VsLimitModal).
            if showRematchUpsell {
                VSLobbyView.VSLimitModal(onClose: { showRematchUpsell = false })
            }
        }
        // Fade the countdown overlay in/out (it used to pop) — scoped to the
        // overlay's visibility so nothing else picks up this animation.
        .animation(Theme.animation(.easeInOut(duration: 0.3)), value: vm.countdown == nil)
        .animation(Theme.animation(.easeInOut(duration: 0.3)), value: vm.showIntro)
        // The game renders its own KeyboardView — never let a lingering SYSTEM
        // keyboard inset (e.g. from the share sheet's iMessage compose) squeeze
        // the layout: post-rematch the board rendered tiny with a keyboard-sized
        // dead zone at the bottom.
        .ignoresSafeArea(.keyboard)
        .navigationBarBackButtonHidden(true)
        .navigationBarTitleDisplayMode(.inline)
        // Fullscreen like the solo games — hide the bottom tab bar (the VS game is
        // pushed inside the Home tab's nav stack, so the tab bar was overlapping
        // and clipping the keyboard's bottom row).
        .toolbar(.hidden, for: .tabBar)
        // The VS game is pushed inside the Home tab's nav stack, so the custom
        // BottomNav (Home/Leaderboard/Profile/Records) renders over it and eats
        // the bottom safe area — pushing the keyboard's bottom row off-screen.
        // Solo games hide it via fullScreenCover; mirror that here.
        .hidesBottomNav()
        .onAppear {
            // Free users watch the game-start ad before matchmaking begins.
            if !adShown { adShown = true; AdsManager.shared.showGameStartInterstitial { vm.start() } }
            else { vm.start() }
        }
        // The game-start interstitial ad can leave a web-view text input as the
        // first responder, so iOS keeps the SYSTEM keyboard up over our custom
        // on-screen KeyboardView (the board uses no UITextField). Resign it the
        // moment the playable match screen appears so only KeyboardView shows.
        .onChange(of: vm.screen) { screen in
            if screen == .match {
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        }
        .onDisappear { vm.leave() }
        .confirmationDialog("Forfeit match?", isPresented: $confirmForfeit, titleVisibility: .visible) {
            Button("Forfeit & Leave", role: .destructive) { goHome() }
            Button("Keep Playing", role: .cancel) { }
        } message: {
            Text("Leaving now forfeits the match — it counts as a loss" + (vm.isDaily ? " and uses today's daily VS." : "."))
        }
    }

    private func goHome() { vm.forfeit(); dismiss() }

    private func vsTitle(_ size: CGFloat) -> some View {
        Text(label).font(Brand.font(size, .black))
            .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
    }

    // MARK: - Queue / searching

    private var queueScreen: some View {
        VStack(spacing: 22) {
            // CPU: no human matchmaking queue — show a brief branded warmup while
            // the bot spins up (the intro splash covers it a beat later).
            if vm.isCpu {
                vsTitle(36)
                ProgressView().controlSize(.large).tint(Theme.primary)
                Text(vm.cpuPersona.map { "Matching you with \($0.name) \($0.avatar)…" } ?? "Setting up your match…")
                    .font(Brand.font(14, .heavy)).foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
            } else {
                vsTitle(36)
                // Private match: surface the shareable code/link so the host can
                // actually invite a friend (the matchmaker buckets both by code).
                if let code = vm.inviteCode { invitePanel(code) }
                ProgressView().controlSize(.large).tint(Theme.primary)
                VStack(spacing: 6) {
                    CyclingStatus()
                    Text("Position in queue: \(vm.queuePosition + 1)")
                        .font(Brand.body(13)).foregroundStyle(Theme.textMuted)
                    if vm.queueSize > 1 {
                        Text("\(vm.queueSize) players waiting")
                            .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }
                // Auto-offer the CPU once the human queue sits quiet.
                if vm.countdown == nil && !vm.showIntro {
                    cpuChooserPanel
                }
                Button(action: goHome) {
                    Label("Cancel", systemImage: "xmark")
                        .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(Capsule().fill(Theme.surface)).overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
                if let m = vm.message { errorPill(m) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sheet(isPresented: $showCpuPro) { ProView() }
        .task {
            // Auto-offer the CPU after the queue sits empty for a bit.
            try? await Task.sleep(nanoseconds: 15_000_000_000)
            if vm.screen == .queue && !vm.isCpu { cpuAutoOffer = true }
        }
        .task {
            // Best recorded run for this mode → enables the "Beat Your Best" ghost.
            if vm.isPro, let uid = AuthService.shared.profile?.id {
                ghostRun = await MatchStatsService.ghostBestRun(uid: uid, mode: vm.mode)
            }
        }
    }

    // Difficulty/opponent grid — shared by the entry chooser's Bot Match and the
    // queue-screen auto-offer. Pro-gated (non-Pro sees an unlock CTA).
    @ViewBuilder private var cpuChooserBody: some View {
        if vm.isPro {
            HStack(spacing: 8) {
                ForEach([BotTier.easy, .medium, .hard], id: \.rawValue) { tier in
                    let p = BotPersonas.persona(tier)
                    Button { vm.startCpu(CpuKind(rawValue: tier.rawValue) ?? .medium) } label: {
                        VStack(spacing: 2) {
                            Text(p.avatar).font(.system(size: 20))
                            Text(BotPersonas.tierLabel(tier)).font(Brand.font(11, .black)).foregroundStyle(Color(hex: UInt(p.color)))
                            Text(p.name).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceHover))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: UInt(p.color)), lineWidth: 1.5))
                    }.buttonStyle(.plain)
                }
            }
            cpuSpecialButton("⚖️ Adaptive — matched to your form", 0x7C3AED) { vm.startCpu(.adaptive) }
            HStack(spacing: 8) {
                cpuSpecialButton(ghostRun == nil ? "👻 Beat Your Best (win first)" : "👻 Beat Your Best", 0x64748B) {
                    if let g = ghostRun { vm.startCpu(.ghost, ghost: g) }
                }
                .opacity(ghostRun == nil ? 0.45 : 1)
                .disabled(ghostRun == nil)
                cpuSpecialButton("📅 Bot of the Day", 0xF59E0B) {
                    vm.startCpu(.daily, fixedSeed: generateDailySeed(date: LeaderboardService.todayUTC(), gameMode: "\(vm.mode.rawValue)_CPU"))
                }
            }
            Text("Practice only — doesn’t affect your ranked stats")
                .font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
        } else {
            Button { showCpuPro = true } label: {
                Label("Unlock with Pro", systemImage: "lock.fill")
                    .font(Brand.font(13, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing)))
            }.buttonStyle(.plain)
        }
    }

    // Queue-screen auto-offer once the human queue sits quiet (the explicit Bot
    // Match choice now lives on the entry chooser).
    @ViewBuilder private var cpuChooserPanel: some View {
        if cpuAutoOffer {
            VStack(spacing: 10) {
                Label("No players right now — play the CPU?", systemImage: "cpu")
                    .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                cpuChooserBody
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .frame(maxWidth: 320)
        }
    }

    // MARK: - Entry chooser (Quick Match / Bot Match / Invite a Friend)

    private var entryScreen: some View {
        VStack(spacing: 20) {
            vsTitle(36)
            if showCpuChooser {
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Button { showCpuChooser = false } label: {
                            Image(systemName: "chevron.left").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.textMuted)
                        }.buttonStyle(.plain)
                        Label("Choose your opponent", systemImage: "cpu")
                            .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                    }
                    cpuChooserBody
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                .frame(maxWidth: 340)
            } else {
                VStack(spacing: 12) {
                    entryOption(icon: "bolt.fill", iconBg: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)],
                                title: "Quick Match", subtitle: "Get matched with a live opponent") {
                        vm.joinHumanQueue()
                    }
                    entryOption(icon: "cpu", iconBg: [Color(hex: 0x64748B), Color(hex: 0x64748B)],
                                title: "Bot Match", subtitle: "Practice vs the CPU — pick a difficulty", locked: !vm.isPro) {
                        if vm.isPro { showCpuChooser = true } else { showCpuPro = true }
                    }
                    entryOption(icon: "person.2.fill", iconBg: [Color(hex: 0x7C3AED), Color(hex: 0x7C3AED)],
                                title: "Invite a Friend", subtitle: "Send a private match link or @username") {
                        showInvite = true
                    }
                }
                .frame(maxWidth: 360)
                Button { dismiss() } label: {
                    Label("Cancel", systemImage: "xmark")
                        .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                }.buttonStyle(.plain).padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 24)
        .sheet(isPresented: $showCpuPro) { ProView() }
        .sheet(isPresented: $showInvite) { InviteSheet() }
        .task {
            // Preload the best run so Beat Your Best is enabled in the chooser.
            if vm.isPro, let uid = AuthService.shared.profile?.id {
                ghostRun = await MatchStatsService.ghostBestRun(uid: uid, mode: vm.mode)
            }
        }
    }

    private func entryOption(icon: String, iconBg: [Color], title: String, subtitle: String, locked: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(iconBg.count > 1 && iconBg[0] != iconBg[1]
                              ? AnyShapeStyle(LinearGradient(colors: iconBg, startPoint: .topLeading, endPoint: .bottomTrailing))
                              : AnyShapeStyle((iconBg.first ?? Theme.primary).opacity(0.12)))
                        .frame(width: 48, height: 48)
                    Image(systemName: icon).font(.system(size: 20, weight: .bold))
                        .foregroundStyle(iconBg.count > 1 && iconBg[0] != iconBg[1] ? .white : (iconBg.first ?? Theme.primary))
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(title).font(Brand.font(16, .black)).foregroundStyle(Theme.textPrimary)
                        if locked { Image(systemName: "lock.fill").font(.system(size: 11)).foregroundStyle(Theme.textMuted) }
                    }
                    Text(subtitle).font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
            }
            .padding(16).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
    }

    private func cpuSpecialButton(_ title: String, _ color: UInt, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(Brand.font(11, .black)).foregroundStyle(Color(hex: color))
                .frame(maxWidth: .infinity).padding(.vertical, 9)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceHover))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: color), lineWidth: 1.5))
        }.buttonStyle(.plain)
    }

    /// Private-match invite panel shown on the queue screen — the code + a
    /// share button so the host can send the join link. The match starts when
    /// the friend joins with the same code (server buckets by inviteCode).
    private func invitePanel(_ code: String) -> some View {
        VStack(spacing: 10) {
            Text("PRIVATE MATCH").font(Brand.font(10, .heavy)).tracking(2).foregroundStyle(Theme.textMuted)
            Text(code).font(Brand.font(30, .black)).tracking(6)
                .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
            Text("Share this code — the match starts when your friend joins.")
                .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            ShareLink(item: URL(string: "https://wordocious.com/vs/join/\(code)")!,
                      message: Text("Join my Wordocious VS match — code \(code)")) {
                Label("Share invite", systemImage: "square.and.arrow.up")
                    .font(Brand.font(14, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.primary))
            }.buttonStyle(.plain)
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .padding(.horizontal, 24)
    }

    private var countdownOverlay: some View {
        ZStack {
            // FULLY opaque vignette (the earlier 0.92–0.96 alphas still let the
            // bright queue screen ghost through) — nothing behind can show.
            RadialGradient(colors: [Color(hex: 0x1E1B3A), Color(hex: 0x0A0A12)],
                           center: .center, startRadius: 60, endRadius: 520)
                .ignoresSafeArea()
            VStack(spacing: 16) {
                Text(vm.countdownIsRematch ? "REMATCH STARTING IN" : "MATCH FOUND")
                    .font(Brand.font(15, .heavy)).tracking(3).foregroundStyle(.white.opacity(0.7))
                vsTitle(30)
                ZStack {
                    // A ring that expands + fades on each tick, so the number
                    // pulses out of a burst instead of just swapping.
                    Circle().stroke(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing), lineWidth: 3)
                        .frame(width: 150, height: 150)
                        .scaleEffect(1)
                        .id(vm.countdown)
                        .transition(.scale(scale: 0.4).combined(with: .opacity))
                    Text(vm.countdown == 0 ? "GO!" : "\(vm.countdown ?? 0)")
                        .font(Brand.font(vm.countdown == 0 ? 72 : 96, .black))
                        .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
                        .id(vm.countdown)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(Theme.animation(.spring(response: 0.35, dampingFraction: 0.6)), value: vm.countdown)
        }
    }

    // MARK: - Match (playing)

    @ViewBuilder private var matchScreen: some View {
        if mode == .propernoundle, let pvm = vm.proper {
            VStack(spacing: 0) {
                matchHeader
                tugOfWarHeader
                    .padding(.horizontal, 10).padding(.top, 6)
                OpponentStrip(opponent: vm.opponent, gradient: gradient, totalBoards: vm.totalBoards)
                    .padding(.horizontal, 10).padding(.top, 6)
                ProperNoundleVSBoard(vm: pvm)   // bespoke ProperNoundle board+keyboard
            }
            if let t = pvm.toast { toastView(t) }
        } else if let game = vm.game {
            VStack(spacing: 0) {
                matchHeader
                // Gauntlet: the same 5-node stage stepper as the solo run so you can
                // always tell which stage you're on.
                if mode == .gauntlet {
                    GauntletStepperBar(game: game).padding(.top, 6)
                }
                tugOfWarHeader
                    .padding(.horizontal, 10).padding(.top, 6)
                // Always the FULL empty frame (all maxGuesses rows) from match
                // start — a growing board hid what turn the opponent was on and
                // how many guesses they had left. Succession's 10-row frame fits
                // because the strip shrinks its cell for >9-row budgets.
                OpponentStrip(opponent: vm.opponent, gradient: gradient,
                              maxGuesses: game.maxGuesses,
                              wordLength: game.wordLength,
                              totalBoards: vm.totalBoards,
                              stageName: mode == .gauntlet ? game.gauntletStageName(at: vm.opponent.stagesCleared) : nil,
                              stageGradient: mode == .gauntlet ? GameScreen.gauntletStageGradient(game.gauntletStageName(at: vm.opponent.stagesCleared)) : [])
                    .padding(.horizontal, 10).padding(.top, 6)

                // Board fills the slack BETWEEN header and keyboard. The keyboard
                // gets layout priority so the VStack always reserves its full
                // height first and the greedy board yields — otherwise the board
                // ate the space and clipped the keyboard's bottom row.
                GeometryReader { geo in
                    BoardLayout(vm: game, availableWidth: geo.size.width, fitHeight: geo.size.height)
                }
                .padding(.horizontal, 10).padding(.vertical, 4)
                .layoutPriority(0)
                // Gauntlet: a cleared stage hides the keyboard while the
                // auto-advancing StageTransitionOverlay (rendered in the top-level
                // body ZStack) covers the board — matching the solo run, instead of
                // a bare Continue button.
                if !game.stageCleared {
                    // Six/Seven expose the same vowel + consonant hints as solo (the
                    // reveal is added as a board row → counts as a guess, the VS cost).
                    if game.hasHints && !game.isFinished { vsHintButtons(game) }
                    KeyboardView(vm: game).padding(.bottom, 6).layoutPriority(1)
                }
            }
            .frame(maxHeight: .infinity)
            if let t = game.toast { toastView(t) }
        }
    }

    // Six/Seven VS hint bar — same reveals + copy as solo GameScreen. Cyan for
    // Six, lime for Seven (web mode accents).
    private var hintAccent: Color { mode == .duel7 ? Color(hex: 0x84CC16) : Color(hex: 0x06B6D4) }

    private func vsHintButtons(_ game: GameViewModel) -> some View {
        HStack(spacing: 12) {
            vsHintPill(label: game.vowelUsed ? (game.vowelRevealed == "—" ? "No vowels left" : "Vowel: \(game.vowelRevealed ?? "")") : "💡 Vowel",
                       used: game.vowelUsed) { Haptics.success(); game.revealVowel() }
            vsHintPill(label: game.consonantUsed ? (game.consonantRevealed == "—" ? "No consonants left" : "Consonant: \(game.consonantRevealed ?? "")") : "💡 Consonant",
                       used: game.consonantUsed) { Haptics.success(); game.revealConsonant() }
        }
        .padding(.horizontal, 16).padding(.bottom, 4)
    }

    private func vsHintPill(label: String, used: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(Brand.font(13, .heavy))
                .foregroundStyle(used ? Theme.textMuted : hintAccent)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 10).fill(used ? Theme.surfaceHover : hintAccent.opacity(0.08)))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(used ? Theme.border : hintAccent, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(used)
    }

    private var matchHeader: some View {
        HStack {
            Button { confirmForfeit = true } label: {
                Image(systemName: "house.fill").font(.system(size: 15, weight: .bold))
                    .foregroundStyle(ModeStyle.accent(mode))
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Theme.surface)).overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
            }
            Spacer()
            VStack(spacing: 1) {
                vsTitle(20)
                // Live guesses + elapsed clock (web parity — vs-classic top stat row).
                if let game = vm.game {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 6) {
                            // Gauntlet's per-stage "1/6" is confusing next to the
                            // cumulative guess count in the tug-of-war, so show only
                            // the clock there (the stepper conveys the stage).
                            if mode != .gauntlet {
                                Text("\(game.rowsUsed)/\(game.maxGuesses) guesses")
                            }
                            HStack(spacing: 2) {
                                Image(systemName: "clock").font(.system(size: 9))
                                Text("\(game.elapsedSeconds / 60):\(String(format: "%02d", game.elapsedSeconds % 60))")
                            }
                        }
                        .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).monospacedDigit()
                    }
                }
            }
            Spacer()
            Color.clear.frame(width: 34, height: 34)
        }
        .padding(.horizontal, 10).padding(.top, 6)
    }

    /// Persistent VS header: you vs opponent + tug-of-war lead bar + typing
    /// indicator (ports vs-match-header.tsx, fed like vs-game.tsx does).
    private var tugOfWarHeader: some View {
        VSMatchHeaderBar(
            me: .init(username: AuthService.shared.profile?.username ?? "You",
                      avatarUrl: AuthService.shared.profile?.avatarUrl,
                      guesses: vm.myGuessLog.count,
                      progress: vm.myProgress),
            opponent: .init(username: vm.opponentName,
                            avatarUrl: vm.opponentInfo?.avatarUrl,
                            guesses: vm.opponent.attempts,
                            progress: vm.theirProgress),
            opponentTyping: vm.opponentTyping)
    }

    private func toastView(_ text: String) -> some View {
        Text(text).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
            .padding(.top, 120).frame(maxHeight: .infinity, alignment: .top).transition(.opacity)
    }

    // MARK: - Waiting (spectator: you finished, opponent still playing) —
    // ports the vs-game.tsx 'waiting' screen: opponent live board at ~2x tile
    // size (colors only), live guess counter + clock, and stakes copy.

    private var waitingScreen: some View {
        let oppName = vm.opponentName
        let liveTotalBoards = vm.opponent.totalBoards > 0 ? vm.opponent.totalBoards : vm.totalBoards
        // Full frame from the start (all maxGuesses rows) so you can tell how
        // many guesses the opponent has left; it's inside a ScrollView so even
        // OctoWord's 13-row frames are fine. Gauntlet (50-guess budget) never
        // reads this — it spectates via GauntletSpectatorView below.
        let spectatorRows = vm.modeMaxGuesses

        return ScrollView {
            VStack(spacing: 18) {
                Text("\(oppName) is still playing...")
                    .font(Brand.font(24, .black))
                    .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
                    .multilineTextAlignment(.center)
                    .padding(.top, 32)

                // Opponent identity + live counters
                HStack(spacing: 12) {
                    LivePulseAvatar(url: vm.opponentInfo?.avatarUrl, name: oppName, accent: gradient.first ?? Theme.primary)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(oppName).font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                        TimelineView(.periodic(from: .now, by: 1)) { _ in
                            let secs = max(0, Int((Date().timeIntervalSince1970 * 1000 - vm.startTimeMs) / 1000))
                            Text("\(vm.opponent.attempts) \(vm.opponent.attempts == 1 ? "guess" : "guesses") · \(secs / 60):\(String(format: "%02d", secs % 60))"
                                 + (liveTotalBoards > 1 ? " · \(vm.opponent.boardsSolved)/\(liveTotalBoards) boards" : ""))
                                .font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted).monospacedDigit()
                        }
                    }
                    if vm.opponentTyping { TypingDots(dotSize: 6) }
                }

                // Stakes copy
                if let stakes = stakesCopy {
                    Text(stakes)
                        .font(Brand.font(12, .heavy)).foregroundStyle(Theme.primary)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceHover))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                }

                // Gauntlet spectates by STAGE (its 21 boards are meaningless as a
                // flat wall) — a card per stage with its name, status, and boards.
                if mode == .gauntlet {
                    GauntletSpectatorView(opponent: vm.opponent, wordLength: vm.wordLen)
                } else {
                    // Opponent live board — bigger now, so it fills the space and the
                    // flip-in reveal reads clearly while you watch.
                    let specCell: CGFloat = liveTotalBoards <= 1 ? 34 : (liveTotalBoards <= 4 ? 24 : 14)
                    Group {
                        if liveTotalBoards <= 1 {
                            OpponentMiniBoard(tiles: vm.opponent.tiles[0] ?? [],
                                              maxGuesses: spectatorRows, wordLength: vm.wordLen, cell: specCell)
                        } else {
                            let columns = Array(repeating: GridItem(.flexible(), spacing: 10),
                                                count: min(liveTotalBoards, 4))
                            LazyVGrid(columns: columns, spacing: 12) {
                                ForEach(0..<liveTotalBoards, id: \.self) { i in
                                    OpponentMiniBoard(tiles: vm.opponent.tiles[i] ?? [],
                                                      maxGuesses: spectatorRows, wordLength: vm.wordLen, cell: specCell)
                                }
                            }
                        }
                    }
                    .padding(20).frame(maxWidth: .infinity)
                    .background(RoundedRectangle(cornerRadius: 18).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border, lineWidth: 1.5))
                }

                // Your stats
                if let guesses = vm.myFinalGuesses {
                    statCard(title: "YOUR RESULT", rows: [
                        ("Guesses", "\(guesses)"),
                        ("Time", formatTime(Double(vm.playerTimeMs))),
                    ])
                }

                // CPU only: the bot's outcome is already fixed by its plan, so let
                // the player skip watching it grind out its remaining boards.
                // Win-locked → celebratory "Claim your win"; otherwise a neutral
                // "Skip to result" fast-forward (which may be a win OR a loss —
                // whatever the bot's plan resolves to).
                if vm.isCpu {
                    Button { Haptics.success(); vm.finishCpuNow() } label: {
                        Label(cpuWinLocked ? "Claim your win" : "Skip to result",
                              systemImage: cpuWinLocked ? "flag.checkered" : "forward.fill")
                            .font(Brand.font(15, .black))
                            .foregroundStyle(cpuWinLocked ? .white : Theme.primary)
                            .frame(maxWidth: .infinity).padding(.vertical, 13)
                            .background(RoundedRectangle(cornerRadius: 14).fill(cpuWinLocked
                                ? AnyShapeStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
                                : AnyShapeStyle(Theme.surfaceHover)))
                            .overlay(cpuWinLocked ? nil : RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                    }.buttonStyle(.plain)
                }

                Button(action: goHome) {
                    Label("Leave", systemImage: "xmark")
                        .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(Capsule().fill(Theme.surface)).overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
            .padding(.horizontal, 24).padding(.bottom, 24)
        }
    }

    /// STAKES copy — ports the web waiting-screen IIFE. The real win rule is:
    /// solve, then tie-break on boardsSolved, then composite score = guesses +
    /// timeSeconds/45. We approximate the composite by guess count: the
    /// opponent is still playing, so they're almost always behind on time and
    /// need strictly FEWER guesses; if they're somehow still ahead of your
    /// clock, matching your guess count could win on time.
    /// True once the (CPU) opponent can no longer beat the player — mirrors the
    /// "can no longer beat your score!" branch of stakesCopy. Gates the
    /// "Claim your win" shortcut so it only appears when the result is locked.
    private var cpuWinLocked: Bool {
        guard let myGuesses = vm.myFinalGuesses, vm.myStatus != .lost else { return false }
        let liveTotalBoards = vm.opponent.totalBoards > 0 ? vm.opponent.totalBoards : vm.totalBoards
        let boardsLeft = liveTotalBoards - vm.opponent.boardsSolved
        if liveTotalBoards > 1, boardsLeft > 1 { return false }
        let opponentTimeBehind = Date().timeIntervalSince1970 * 1000 - vm.startTimeMs > Double(vm.playerTimeMs)
        let target = opponentTimeBehind ? myGuesses - 1 : myGuesses
        return target <= 0 || vm.opponent.attempts >= target
    }

    private var stakesCopy: String? {
        guard let myGuesses = vm.myFinalGuesses else { return nil }
        let oppName = vm.opponentName
        let liveTotalBoards = vm.opponent.totalBoards > 0 ? vm.opponent.totalBoards : vm.totalBoards
        let boardsLeft = liveTotalBoards - vm.opponent.boardsSolved
        if vm.myStatus == .lost {
            return liveTotalBoards > 1
                ? "\(oppName) needs \(boardsLeft) more board\(boardsLeft == 1 ? "" : "s") to win"
                : "\(oppName) just needs to solve to win"
        }
        if liveTotalBoards > 1, boardsLeft > 1 {
            return "\(oppName) needs \(boardsLeft) more boards to stay alive"
        }
        let opponentTimeBehind = Date().timeIntervalSince1970 * 1000 - vm.startTimeMs > Double(vm.playerTimeMs)
        let target = opponentTimeBehind ? myGuesses - 1 : myGuesses
        if target <= 0 || vm.opponent.attempts >= target {
            return "\(oppName) can no longer beat your score!"
        }
        return "\(oppName) must solve in \(target) or fewer to beat you"
    }

    // MARK: - Result

    private var resultScreen: some View {
        let winner = vm.result?.winner
        let isWin = winner == "player", isDraw = winner == "draw"
        let headline = isWin ? "WINNER" : isDraw ? "DRAW" : "DEFEAT"
        let colors: [Color] = isWin ? [Color(hex: 0xA78BFA), Color(hex: 0xC4B5FD)]
            : isDraw ? [Color(hex: 0xFACC15), Color(hex: 0xFDBA74)]
            : [Color(hex: 0xF87171), Color(hex: 0xFDA4AF)]
        let myName = AuthService.shared.profile?.username ?? "You"
        let oppName = vm.opponentName
        // Solve status decides most matches (solving beats score), so spell it
        // out — the loser often has "better" numbers and it reads as a mistake.
        let mySolved = vm.myStatus == .won
        let oppSolved = VSResultBoards.solved(log: vm.result?.opponentGuessLog ?? [],
                                              solutions: vm.result?.solutions ?? [])
        let whyLine: String? = {
            guard vm.result != nil else { return nil }
            if isDraw { return "Dead even — identical scores" }
            if isWin { return mySolved && !oppSolved ? "You solved it — \(oppName) didn’t" : "Both solved — you won on score" }
            return oppSolved && !mySolved ? "\(oppName) solved it — you didn’t" : "Both solved — \(oppName) won on score"
        }()

        return ZStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Headline + why-you-won/lost + updated all-time head-to-head
                    // (refetched after the match was recorded).
                    VStack(spacing: 8) {
                        Text(headline).font(Brand.font(56, .black))
                            .foregroundStyle(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
                            .minimumScaleFactor(0.6).lineLimit(1)
                        if let whyLine {
                            Text(whyLine).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textSecondary)
                        }
                        if vm.opponentUserId != nil, let h2h = vm.headToHead {
                            Text(HeadToHeadService.headToHeadLine(opponentName: oppName, h2h))
                                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        }
                    }
                    .padding(.top, 40)

                    // CPU practice: photo-finish flourish + streak / milestone /
                    // cosmetic unlock / run-it-back session tally.
                    if vm.isCpu {
                        VStack(spacing: 4) {
                            if let pf = vm.photoFinish {
                                PhotoFinishStamp(clutch: pf == "clutch")
                            }
                            if let m = vm.cpuMilestone {
                                Text("🔥 \(m)-win CPU streak!").font(Brand.font(14, .black)).foregroundStyle(Color(hex: 0xF97316))
                            } else if vm.cpuStreak > 0 {
                                Text("CPU win streak: \(vm.cpuStreak)").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                            }
                            if vm.cpuUnlock != nil {
                                Text("🏅 Unlocked \(BotPersonas.persona(vm.cpuPersona?.tier ?? .hard).name)’s badge!")
                                    .font(Brand.font(12, .black)).foregroundStyle(Color(hex: UInt(vm.cpuPersona?.color ?? 0xEF4444)))
                            }
                            if vm.cpuSessionWins + vm.cpuSessionLosses > 0 {
                                Text("This session — You \(vm.cpuSessionWins) · CPU \(vm.cpuSessionLosses)")
                                    .font(Brand.font(11, .heavy)).foregroundStyle(Theme.textMuted)
                            }
                            Text("Practice — not counted in ranked stats").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                        }
                    }

                    // Prominent head-to-head FINAL SCORE — big totals with the exact
                    // calculation + solve badges (replaces the inverted comparison
                    // bars, which read backwards for lower-is-better metrics).
                    if let r = vm.result {
                        VSScoreCard(
                            me: .init(name: myName, score: r.playerScore, guesses: r.playerGuesses,
                                      timeMs: r.playerTime, solved: mySolved, isWinner: isWin),
                            opponent: .init(name: oppName, score: r.opponentScore, guesses: r.opponentGuesses,
                                            timeMs: r.opponentTime, solved: oppSolved, isWinner: !isWin && !isDraw),
                            isDraw: isDraw)
                    }

                    rematchSection
                    actions

                    // Final boards with letters — opponent's reconstructed from
                    // the match-end guess log + solutions.
                    if let r = vm.result, let solutions = r.solutions, !solutions.isEmpty {
                        VSFinalBoards(myName: myName, opponentName: oppName,
                                      myGuessLog: vm.myGuessLog,
                                      opponentGuessLog: r.opponentGuessLog ?? [],
                                      solutions: solutions,
                                      mode: mode, seed: vm.seed,
                                      myTimeMs: Int(r.playerTime), opponentTimeMs: Int(r.opponentTime),
                                      // Final-state snapshots so MY side keeps its
                                      // hint rows (Six/Seven/PN) — the guess log
                                      // alone can't reproduce them.
                                      myFinalBoards: vm.myFinalBoards,
                                      myFinalPNRows: vm.myFinalPNRows)
                    }
                }
                .padding(.horizontal, 24).padding(.bottom, 24)
            }
            // Confetti for wins only (web parity).
            if isWin { ConfettiView().ignoresSafeArea() }
        }
    }

    @ViewBuilder private var rematchSection: some View {
        switch vm.rematch {
        case .received:
            VStack(spacing: 10) {
                Text("Opponent wants a rematch!").font(Brand.font(14, .bold)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 12) {
                    Button("Decline") { vm.declineRematch() }
                        .font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
                    Button("Accept") { vm.acceptRematch() }
                        .font(Brand.font(14, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
                }
            }
            .padding(14).background(RoundedRectangle(cornerRadius: 14).stroke(Theme.primary, lineWidth: 2))
        default: EmptyView()
        }
    }

    /// Actions — prominent Rematch on top, Home/Share below (web parity).
    private var actions: some View {
        VStack(spacing: 8) {
            switch vm.rematch {
            case .declined:
                Label("No Rematch", systemImage: "xmark").font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            case .offered:
                Label("Waiting…", systemImage: "hourglass").font(Brand.font(14, .black)).foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
            case .received:
                EmptyView()   // the "Opponent wants a rematch!" card carries the buttons
            case .idle:
                // Free users get the Pro upsell modal instead of an inline error
                // (web parity — Rematch opens VsLimitModal for non-Pro).
                Button { if vm.isPro { vm.offerRematch() } else { showRematchUpsell = true } } label: {
                    Label("Rematch", systemImage: "arrow.clockwise").font(Brand.font(14, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 12).fill(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing)))
                }.buttonStyle(.plain)
            }

            HStack(spacing: 12) {
                Button(action: goHome) {
                    Label("Home", systemImage: "house.fill").font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)

                Button { shareVSCard() } label: {
                    Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
        }
    }

    /// Render + share the VS result card (same aesthetic as the daily share
    /// cards: wordmark, accent label, result pill, tinted color-only boards).
    /// Falls back to text-only when there's no result payload.
    private func shareVSCard() {
        guard let r = vm.result else {
            #if canImport(UIKit)
            let av = UIActivityViewController(activityItems: [shareText], applicationActivities: nil)
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first?
                .windows.first(where: { $0.isKeyWindow })?.rootViewController?.present(av, animated: true)
            #endif
            return
        }
        let solutions = r.solutions ?? []
        func grids(_ log: [VSGuessLogEntry]) -> [[[TileState]]] {
            let byBoard = VSResultBoards.evaluate(log: log, solutions: solutions)
            return byBoard.keys.sorted().map { idx in (byBoard[idx] ?? []).map(\.states) }
        }
        let isWin = r.winner == "player", isDraw = r.winner == "draw"
        let card = VSShareCardView(
            modeLabel: "VS \(vsModeLabel.uppercased())",
            accent: ModeStyle.accent(mode),
            isWin: isWin, isDraw: isDraw,
            me: .init(name: AuthService.shared.profile?.username ?? "You",
                      score: r.playerScore, won: isWin,
                      solved: vm.myStatus == .won, grids: grids(vm.myGuessLog)),
            opponent: .init(name: vm.opponentName,
                            score: r.opponentScore, won: !isWin && !isDraw,
                            solved: VSResultBoards.solved(log: r.opponentGuessLog ?? [], solutions: solutions),
                            grids: grids(r.opponentGuessLog ?? [])),
            dateStr: {
                let f = DateFormatter(); f.dateFormat = "MMM d, yyyy"; return f.string(from: Date())
            }())
        VSShareService.share(card: card, text: shareText)
    }

    /// Share copy — ports the web result-screen handleShare strings.
    private var shareText: String {
        let oppName = vm.opponentName
        let winner = vm.result?.winner
        let text: String
        if winner == "player" {
            text = "I just beat \(oppName) in a Wordocious VS \(vsModeLabel) duel! ⚔️🏆"
        } else if winner == "draw" {
            text = "\(oppName) and I battled to a draw in VS \(vsModeLabel) on Wordocious! ⚔️"
        } else {
            text = "Epic VS \(vsModeLabel) duel against \(oppName) on Wordocious! ⚔️"
        }
        return "\(text)\nhttps://wordocious.com"
    }

    // MARK: - Opponent left / not configured

    private var opponentLeftScreen: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.fill.xmark").font(.system(size: 40)).foregroundStyle(Theme.textMuted)
            Text("Opponent left the match").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Button("Home", action: goHome).font(Brand.font(15, .black)).foregroundStyle(Theme.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var notConfigured: some View {
        VStack(spacing: 14) {
            vsTitle(30)
            Image(systemName: "bolt.horizontal.circle").font(.system(size: 44)).foregroundStyle(Theme.textMuted)
            Text("VS is almost ready").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Text("Real-time matches turn on once the multiplayer server is connected.")
                .font(Brand.body(13)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
            Button("Back", action: goHome).font(Brand.font(15, .black)).foregroundStyle(Theme.primary).padding(.top, 4)
        }
        .padding(.horizontal, 32).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Shared bits

    private func statCard(title: String?, rows: [(String, String)]) -> some View {
        VStack(spacing: 10) {
            if let title { Text(title).font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading) }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack {
                    Text(row.0).font(Brand.font(13, .bold)).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Text(row.1).font(Brand.font(13, .bold)).foregroundStyle(Theme.textPrimary)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func errorPill(_ text: String) -> some View {
        Text(text).font(Brand.font(13, .bold)).foregroundStyle(.white)
            .padding(.horizontal, 16).padding(.vertical, 8)
            .background(Capsule().fill(Theme.textPrimary.opacity(0.9)))
    }

    private func formatTime(_ ms: Double) -> String {
        let total = Int((ms / 1000).rounded())
        if total < 60 { return "\(total)s" }
        let m = total / 60, s = total % 60
        return s > 0 ? "\(m)m \(s)s" : "\(m)m"
    }
}

/// Compact opponent progress strip shown above the player's board during a match.
/// The 5-node Gauntlet stage stepper — a self-contained copy of the solo
/// GameScreen's stepper so the VS match screen shows the player's stage.
private struct GauntletStepperBar: View {
    @ObservedObject var game: GameViewModel

    var body: some View {
        VStack(spacing: 3) {
            HStack(spacing: 0) {
                ForEach(0..<max(game.gauntletStageCount, 1), id: \.self) { i in
                    if i > 0 {
                        Rectangle().fill(connector(i)).frame(width: 16, height: 2).padding(.horizontal, 2)
                    }
                    node(i)
                }
            }
            // Stage title (gradient) — parity with the solo Gauntlet header.
            Text(game.gauntletStageName)
                .font(Brand.font(17, .black))
                .foregroundStyle(LinearGradient(colors: GameScreen.gauntletStageGradient(game.gauntletStageName),
                                                startPoint: .leading, endPoint: .trailing))
        }
    }

    private func connector(_ i: Int) -> Color {
        if game.gauntletCompletedIndices.contains(i) { return Color(hex: 0x8B5CF6) }
        if i == game.gauntletCurrentIndex { return Color(hex: 0xD8B4FE) }
        return Color(hex: 0xE5E7EB)
    }

    @ViewBuilder private func node(_ i: Int) -> some View {
        let completed = game.gauntletCompletedIndices.contains(i)
        let active = i == game.gauntletCurrentIndex
        let bg = completed ? Color(hex: 0xEDE9FE) : active ? Color(hex: 0xF3E8FF) : Color(hex: 0xF9FAFB)
        let border = completed ? Color(hex: 0x8B5CF6) : active ? Color(hex: 0xC084FC) : Color(hex: 0xE5E7EB)
        let fg = completed ? Color(hex: 0x6D28D9) : active ? Color(hex: 0x9333EA) : Color(hex: 0x9CA3AF)
        ZStack {
            Circle().fill(bg).overlay(Circle().stroke(border, lineWidth: 2)).frame(width: 20, height: 20)
            if completed {
                Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(fg)
            } else if active {
                Image(systemName: "play.fill").font(.system(size: 8)).foregroundStyle(fg).offset(x: 1)
            } else {
                Text("\(i + 1)").font(.system(size: 10, weight: .bold)).foregroundStyle(fg)
            }
        }
    }
}

/// Gauntlet spectator — the opponent's 21 boards broken down by stage (name,
/// status, boards), instead of a meaningless flat wall. Cleared stages collapse
/// to their solved rows; the active stage shows live (with the flip-in reveal);
/// locked stages dim out.
private struct GauntletSpectatorView: View {
    let opponent: VSMatchViewModel.OpponentProgress
    let wordLength: Int

    private enum StageStatus { case cleared, active, locked }

    var body: some View {
        VStack(spacing: 12) {
            ForEach(Array(gauntletStages.enumerated()), id: \.offset) { idx, stage in
                stageCard(idx, stage)
            }
        }
    }

    private func boardOffset(_ idx: Int) -> Int {
        gauntletStages.prefix(idx).reduce(0) { $0 + $1.boardCount }
    }
    private func status(_ idx: Int) -> StageStatus {
        idx < opponent.stagesCleared ? .cleared : (idx == opponent.stagesCleared ? .active : .locked)
    }

    @ViewBuilder private func stageCard(_ idx: Int, _ stage: GauntletStageConfig) -> some View {
        let st = status(idx)
        let accent = GameScreen.gauntletStageGradient(stage.name)
        let offset = boardOffset(idx)
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill((accent.first ?? Theme.primary).opacity(st == .locked ? 0.10 : 0.18)).frame(width: 26, height: 26)
                    if st == .cleared {
                        Image(systemName: "checkmark").font(.system(size: 11, weight: .black)).foregroundStyle(accent.first ?? Theme.primary)
                    } else {
                        Text("\(idx + 1)").font(Brand.font(12, .black))
                            .foregroundStyle(st == .locked ? Theme.textMuted : (accent.first ?? Theme.primary))
                    }
                }
                Text(stage.name).font(Brand.font(15, .black))
                    .foregroundStyle(st == .locked
                                     ? AnyShapeStyle(Theme.textMuted)
                                     : AnyShapeStyle(LinearGradient(colors: accent, startPoint: .leading, endPoint: .trailing)))
                Spacer()
                statusChip(st)
            }
            if st != .locked { boardsGrid(stage, offset: offset, active: st == .active) }
        }
        .padding(14).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(st == .active ? (accent.first ?? Theme.border) : Theme.border,
                                                           lineWidth: st == .active ? 1.8 : 1.5))
        .opacity(st == .locked ? 0.55 : 1)
    }

    @ViewBuilder private func statusChip(_ st: StageStatus) -> some View {
        switch st {
        case .cleared:
            Label("Cleared", systemImage: "checkmark.seal.fill")
                .font(Brand.font(10, .heavy)).foregroundStyle(Color(hex: 0x16A34A))
        case .active:
            HStack(spacing: 5) {
                Text("PLAYING").font(Brand.font(10, .heavy)).foregroundStyle(Theme.primary)
                TypingDots(dotSize: 5)
            }
        case .locked:
            Image(systemName: "lock.fill").font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
    }

    @ViewBuilder private func boardsGrid(_ stage: GauntletStageConfig, offset: Int, active: Bool) -> some View {
        // The ACTIVE stage renders its full frame (all maxGuesses rows) so you
        // can tell how many guesses the opponent has left; CLEARED stages are
        // over, so they compact to the rows actually used — a cleared OctoWord
        // stage shouldn't render 8 towers of empty rows.
        let used = (0..<stage.boardCount).map { opponent.tiles[offset + $0]?.count ?? 0 }.max() ?? 0
        let rows = active ? stage.maxGuesses : min(stage.maxGuesses, max(1, used))
        let cell: CGFloat = stage.boardCount == 1 ? 22 : stage.boardCount <= 4 ? 16 : 11
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: min(stage.boardCount, 4))
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(0..<stage.boardCount, id: \.self) { b in
                OpponentMiniBoard(tiles: opponent.tiles[offset + b] ?? [], maxGuesses: rows, wordLength: wordLength, cell: cell)
            }
        }
    }
}

private struct OpponentStrip: View {
    let opponent: VSMatchViewModel.OpponentProgress
    let gradient: [Color]
    var maxGuesses: Int = 6
    var wordLength: Int = 5
    /// The MODE's board count, known from match start — opponent.totalBoards is
    /// 0 until their first progress event, which made Quad/Octo render a single
    /// tall placeholder board pre-typing.
    var totalBoards: Int = 1
    /// Gauntlet VS: the opponent's current stage name + its accent gradient.
    var stageName: String? = nil
    var stageGradient: [Color] = []

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "person.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
                Text("Opponent").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textSecondary)
                Spacer()
                // Gauntlet VS: the opponent's current stage — number, flag (tinted
                // to the stage accent), and the stage name in its gradient.
                if let stageName {
                    HStack(spacing: 5) {
                        Image(systemName: "flag.fill").font(.system(size: 11))
                            .foregroundStyle(stageGradient.first ?? Theme.textPrimary)
                        Text("Stage \(opponent.stagesCleared + 1)").font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
                        Text(stageName).font(Brand.font(12, .black))
                            .foregroundStyle(LinearGradient(colors: stageGradient.isEmpty ? gradient : stageGradient,
                                                            startPoint: .leading, endPoint: .trailing))
                            .lineLimit(1)
                    }
                } else if max(opponent.totalBoards, totalBoards) > 1 {
                    Text("\(opponent.boardsSolved)/\(max(opponent.totalBoards, totalBoards)) boards").font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
                }
                Text("\(opponent.attempts) guesses").font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
                if opponent.solved {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 13)).foregroundStyle(Color(hex: 0x7C3AED))
                }
            }
            // Live opponent tile preview (colors only, no letters) — ports the
            // web OpponentMiniBoard / OpponentMultiMiniBoard.
            // During your own play only render per-board grids for <=4 boards —
            // 8 tiny OctoWord grids over your own 8 boards are illegible and
            // steal space, so those stay summary-only (the count line above);
            // the spectator "still playing" screen renders all boards larger.
            // Gauntlet (21 boards) also falls out here — it shows Stage N.
            // Render the EMPTY grid from the start (no hasTiles gate) so the board
            // is visible the whole match and never flickers in on the first guess.
            if max(opponent.totalBoards, totalBoards) <= 4 {
                let total = max(opponent.totalBoards, totalBoards)
                let boards = total > 1 ? Array(0..<total) : [0]
                // Bigger cells so the opponent board uses the space around it and
                // the live flip-in reveal is easy to follow (single board gets the
                // most room; multi-board stays compact so 4 grids still fit).
                // Succession's 10-row full frame drops to cell 8 so its strip is
                // no taller than QuadWord's 9-row one (10×8+gaps ≈ 9×10+gaps).
                let cell: CGFloat = total > 1 ? (maxGuesses > 9 ? 8 : 10) : 14
                HStack(spacing: 8) {
                    ForEach(boards, id: \.self) { i in
                        OpponentMiniBoard(tiles: opponent.tiles[i] ?? [], maxGuesses: maxGuesses, wordLength: wordLength, cell: cell)
                    }
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }
}

/// Compact grid of the opponent's guess tiles (colors only — no letters), one
/// per board. Ports apps/web/components/vs/opponent-mini-board.tsx.
private struct OpponentMiniBoard: View {
    let tiles: [[TileState]]
    let maxGuesses: Int
    let wordLength: Int
    var cell: CGFloat = 8

    private var gap: CGFloat { max(1, cell * 0.1) }

    var body: some View {
        VStack(spacing: gap) {
            ForEach(0..<max(maxGuesses, 1), id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<max(wordLength, 1), id: \.self) { c in
                        let st: TileState? = (r < tiles.count && c < tiles[r].count) ? tiles[r][c] : nil
                        OpponentTile(state: st, cell: cell, delay: Double(c) * 0.05)
                    }
                }
            }
        }
    }
}

/// A single opponent tile that flips in (3D rotate + scale + fade, staggered
/// left-to-right) the moment it fills — so each opponent guess reveals with a
/// fluid cascade instead of popping in flat. Empty tiles stay static.
private struct OpponentTile: View {
    let state: TileState?
    let cell: CGFloat
    let delay: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var revealed = false

    private var filled: Bool { state != nil && state != .empty }
    private var radius: CGFloat { max(2, cell * 0.16) }

    var body: some View {
        RoundedRectangle(cornerRadius: radius)
            .fill(color)
            .frame(width: cell, height: cell)
            .overlay(filled ? nil : RoundedRectangle(cornerRadius: radius).stroke(Color(hex: 0xD1D5DB), lineWidth: 1))
            .scaleEffect(filled && !revealed ? 0.5 : 1)
            .opacity(filled && !revealed ? 0 : 1)
            .rotation3DEffect(.degrees(filled && !revealed ? -85 : 0), axis: (x: 1, y: 0, z: 0), perspective: 0.4)
            .onAppear { revealed = true }
            .onChange(of: filled) { now in
                guard now else { return }
                if reduceMotion { revealed = true; return }
                revealed = false
                DispatchQueue.main.async {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.68).delay(delay)) { revealed = true }
                }
            }
    }

    private var color: Color {
        switch state {
        case .correct: return Color(hex: 0x7C3AED)
        case .present: return Color(hex: 0xF59E0B)
        case .absent:  return Theme.textMuted
        default:       return .clear
        }
    }
}

/// Opponent avatar with a breathing accent ring — signals a "live" opponent on
/// the spectator screen so it doesn't feel static while you wait.
private struct LivePulseAvatar: View {
    let url: String?
    let name: String
    let accent: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle().stroke(accent, lineWidth: 2.5).frame(width: 56, height: 56)
                .scaleEffect(pulse ? 1.45 : 0.95).opacity(pulse ? 0 : 0.7)
            AvatarView(url: url, username: name, size: 52)
                .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 1.5).repeatForever(autoreverses: false)) { pulse = true }
        }
    }
}

/// Photo-finish flourish — a spring-in stamp for a CPU close/last-guess win,
/// distinct from the normal win overlay. Animates on appear.
private struct PhotoFinishStamp: View {
    let clutch: Bool
    @State private var shown = false
    var body: some View {
        Text(clutch ? "CLUTCH!" : "PHOTO FINISH!")
            .font(Brand.font(30, .black))
            .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFACC15), Color(hex: 0xF97316), Color(hex: 0xEC4899)],
                                            startPoint: .leading, endPoint: .trailing))
            .rotationEffect(.degrees(-6))
            .scaleEffect(shown ? 1 : 0.3)
            .opacity(shown ? 1 : 0)
            .shadow(color: .black.opacity(0.22), radius: 8, y: 3)
            .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.55)) { shown = true } }
    }
}

/// Cycling "Searching…/Scanning…/…" status line — ports vs-game.tsx WAITING_PHRASES.
struct CyclingStatus: View {
    private static let phrases = ["Searching", "Scanning", "Seeking", "Matching", "Pairing",
                                  "Connecting", "Locating", "Scouting", "Hunting", "Queuing",
                                  "Polling", "Awaiting", "Preparing", "Loading", "Syncing",
                                  "Summoning", "Fetching", "Probing", "Browsing", "Rallying"]
    @State private var index = 0
    var body: some View {
        Text("\(Self.phrases[index])…")
            .font(Brand.font(18, .bold)).foregroundStyle(Theme.textSecondary)
            .id(index)
            .onReceive(Timer.publish(every: 2.5, on: .main, in: .common).autoconnect()) { _ in
                index = (index + 1) % Self.phrases.count
            }
    }
}

/// Freemium "already played today" screen — ports DailyVsAlreadyPlayed.
private struct DailyVsAlreadyPlayed: View {
    let answer: String
    let gradient: [Color]
    var isPro: Bool = false
    var won: Bool? = nil
    let onHome: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            VStack(spacing: 4) {
                Text("TODAY'S VS PUZZLE").font(Brand.font(10, .heavy)).tracking(2).foregroundStyle(Theme.textMuted)
                Text("Already Played").font(Brand.font(32, .black))
                    .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
            }
            // Today's daily VS outcome — W/L pill (web shows just the answer;
            // the user asked for an explicit result indicator here).
            if let won {
                Text(won ? "YOU WON" : "YOU LOST")
                    .font(Brand.font(13, .black)).foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .background(Capsule().fill(Color(hex: won ? 0x7C3AED : 0xDC2626)))
            }
            if !answer.isEmpty {
                HStack(spacing: 6) {
                    ForEach(Array(answer.uppercased().enumerated()), id: \.offset) { _, ch in
                        Text(String(ch)).font(Brand.font(18, .black)).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(RoundedRectangle(cornerRadius: 6).fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }
                }
            }
            // Live "next daily VS" countdown (web parity — getSecondsUntilMidnight pill).
            TimelineView(.periodic(from: Date(), by: 1)) { _ in
                let s = secondsUntilLocalMidnight()
                Text("Next daily VS in \(cd(s))")
                    .font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Theme.primary.opacity(0.12)))
            }
            Text(isPro
                 ? "Want more? Jump into unlimited VS battles with fresh puzzles."
                 : "Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.")
                .font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center).padding(.horizontal, 16)
            if isPro {
                // Pro: route to the VS lobby for unlimited (any-mode) battles
                // (web parity — DailyVsAlreadyPlayed's "Play Unlimited VS").
                NavigationLink { VSLobbyView() } label: {
                    HStack(spacing: 8) {
                        Image("swords").renderingMode(.template).resizable().scaledToFit().frame(width: 16, height: 16)
                        Text("Play Unlimited VS")
                    }
                    .font(Brand.font(14, .black)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(
                        LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }.buttonStyle(.plain)
            } else {
                // Gold "Upgrade to Pro" CTA (web parity — links to the Pro page).
                NavigationLink { ProView() } label: {
                    Label("Upgrade to Pro", systemImage: "crown.fill").font(Brand.font(14, .black)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(
                            LinearGradient(colors: [Color(hex: 0xF59E0B), Color(hex: 0xD97706)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }.buttonStyle(.plain)
            }
            Button(action: onHome) {
                Label("Home", systemImage: "house.fill").font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 24).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func cd(_ s: Int) -> String {
        String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}
