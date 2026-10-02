import SwiftUI
import WordociousCore

/// The VS match UI — ports apps/web/components/vs/vs-game.tsx screens
/// (queue → countdown → match → waiting → result → rematch) for native.
/// VS polish (founder, 2026-10-01; docs/VS_POLISH_SPEC.md): the match reuses
/// each mode's solo header, board layout, hints and keyboard exactly, plus a
/// compact opponent strip; every screen around it is in the home/VS aesthetic.
struct VSGameView: View {
    @StateObject private var vm: VSMatchViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false

    let mode: GameMode

    init(mode: GameMode, isDaily: Bool = false, inviteCode: String? = nil, intent: VSIntent = .live) {
        self.mode = mode
        _vm = StateObject(wrappedValue: VSMatchViewModel(mode: mode, isDaily: isDaily, inviteCode: inviteCode, intent: intent))
    }

    private var vsModeLabel: String {
        switch mode { case .duel6: return "SIX"; case .duel7: return "SEVEN"; default: return ModeStyle.title(mode) }
    }
    private var modeName: String { VsLobbyKit.modeName(mode) }
    /// "Rook" for "Rook · Bot" — the caps headlines name the bot plainly.
    private var opponentShortName: String {
        vm.opponentName.replacingOccurrences(of: " · Bot", with: "")
    }

    // Non-Pro Rematch tap shows the Pro upsell modal (web parity — VsLimitModal).
    @State private var showRematchUpsell = false
    /// Live search: people waiting in this mode's queue (from /vs/counts, minus you).
    @State private var waitingInMode: Int?
    // Leaving an in-progress match forfeits it (a recorded loss) — confirm first.
    @State private var confirmForfeit = false

    var body: some View {
        ZStack {
            // The match keeps the solo game's backdrop; every screen around it
            // sits on the VS page color.
            if vm.screen == .match {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            } else {
                PageBackground(tint: .vs, lightOnly: true)
            }

            switch vm.screen {
            case .notConfigured:     notConfigured
            case .queue:             queueScreen
            case .match:             matchScreen
            case .waiting:           waitingScreen
            case .result:            resultScreen
            case .opponentLeft:      opponentLeftScreen
            case .matchGone:         matchGoneScreen
            case .alreadyPlayedDaily: DailyVsAlreadyPlayed(answer: vm.dailyAnswer, isPro: AuthService.shared.isProActive, won: vm.dailyWon, onHome: goHome)
            case .challengeSent:     VSChallengeSentView(vm: vm, onHome: goHome)
            case .challengeResult:
                if let o = vm.challengeOutcome, let c = vm.raceChallenge {
                    VSChallengeResultView(mode: mode, code: c.code, outcome: o, opponentId: c.challenger.id,
                                          headToHead: vm.headToHead, xpGain: vm.xpResult?.xpGain,
                                          note: vm.challengeNote, onHome: goHome)
                } else {
                    VSLoadingView(mode: mode)
                }
            }

            // Don't stack the countdown UNDER the intro splash — it ticked behind
            // it and then "popped" in when the intro lifted. Show it only once
            // the intro is gone.
            if vm.countdown != nil && !vm.showIntro {
                countdownOverlay
                    // Instant IN, fade OUT: the intro splash drops the same frame
                    // the countdown mounts, so nothing behind can flash through.
                    .transition(.asymmetric(insertion: .identity, removal: .opacity))
                    .zIndex(6)
            }

            // Match-intro splash — sits above the countdown for 2.5s (or until
            // tapped), web parity: MatchIntro renders only on the queue screen.
            if vm.showIntro, vm.screen == .queue {
                VSMatchIntroView(
                    mode: mode,
                    me: .init(username: AuthService.shared.profile?.username ?? "You",
                              avatarUrl: AuthService.shared.profile?.avatarUrl,
                              level: AuthService.shared.profile?.level),
                    opponent: vm.opponentUserId != nil ? .init(username: vm.opponentInfo?.username ?? "…",
                                                               avatarUrl: vm.opponentInfo?.avatarUrl,
                                                               level: vm.isCpu || vm.isRace ? nil : vm.opponentInfo?.level,
                                                               botArt: vm.opponentInfo?.botArt,
                                                               // A challenge ghost is the challenger's run (bots carry "· Bot" in the name).
                                                               subtitle: vm.raceChallenge.map { "@\($0.challenger.username)’s run" }) : nil,
                    headToHead: vm.headToHead,
                    purple: vm.isRace,
                    onDone: { vm.showIntro = false; vm.startCountdownTick() })
            }

            // Gauntlet stage-transition overlay — same auto-advancing overlay as
            // the solo run; covers the board while it re-lays-out for the next
            // stage so nothing visibly shifts (and no bare Continue button).
            if vm.screen == .match, let game = vm.game, game.stageCleared {
                StageTransitionOverlay(completedName: game.gauntletStageName,
                                       next: game.gauntletNextStageInfo,
                                       isVersus: true,
                                       onAdvance: { game.nextStage() })
                    .transition(.opacity)
                    .zIndex(5)
            }

            // Opponent-disconnect countdown banner: their socket dropped and the
            // server holds the match open for its reconnect grace — if they don't
            // return by the deadline, the server forfeits them (win for us).
            if let deadline = vm.opponentDisconnectDeadline,
               vm.screen == .match || vm.screen == .waiting {
                VStack {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        let left = max(0, Int(((deadline - Date().timeIntervalSince1970 * 1000) / 1000).rounded()))
                        Label("\(vm.opponentName) disconnected — you win by forfeit in \(left)s unless they return",
                              systemImage: "wifi.slash")
                            .font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0xB91C1C))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xFEF2F2)))
                            .shadow(color: Color(hex: 0x7F1D1D).opacity(0.12), radius: 6, x: 0, y: 3)
                            .padding(.horizontal, 24)
                    }
                    .padding(.top, 52)
                    Spacer()
                }
                .allowsHitTesting(false)
                .transition(.opacity)
                .zIndex(4)
            }

            // Moment callout — opponent milestones (greens / board solved / last guess).
            if let c = vm.callout, vm.screen == .match {
                VStack {
                    VSCalloutPill(text: c.text).id(c.id).padding(.top, 172)
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

            // Pro upsell when a free user RECEIVES a rematch offer — the VM
            // auto-declined it (Rematch is Pro-only); explain why.
            if vm.rematchProUpsell {
                VSLobbyView.VSLimitModal(onClose: { vm.rematchProUpsell = false })
            }

            // Forfeit confirm — a soft VS card (spec §2), only during a live match.
            if confirmForfeit {
                VSConfirmCard(
                    title: "FORFEIT MATCH?",
                    message: "Leaving now forfeits the match — it counts as a loss" + (vm.isDaily ? " and uses today’s daily VS." : "."),
                    primary: "KEEP PLAYING",
                    secondary: "FORFEIT & LEAVE",
                    secondaryDestructive: true,
                    onPrimary: { confirmForfeit = false },
                    onSecondary: { confirmForfeit = false; goHome() })
                    .zIndex(8)
            }
        }
        // Fade the countdown overlay in/out — scoped to the overlay's visibility
        // so nothing else picks up this animation.
        .animation(Theme.animation(.easeInOut(duration: 0.3)), value: vm.countdown == nil)
        .animation(Theme.animation(.easeInOut(duration: 0.3)), value: vm.showIntro)
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: confirmForfeit)
        // The game renders its own KeyboardView — never let a lingering SYSTEM
        // keyboard inset (e.g. from the share sheet's iMessage compose) squeeze
        // the layout: post-rematch the board rendered tiny with a keyboard-sized
        // dead zone at the bottom.
        .ignoresSafeArea(.keyboard)
        // Physical keys (founder, 2026-09-30) stay off under the countdown,
        // the Gauntlet stage transition, the forfeit confirm and the upsell modals.
        .hardwareKeyboardEnabled(vm.screen == .match && vm.countdown == nil && !(vm.game?.stageCleared ?? false)
                                 && !showRematchUpsell && !vm.rematchProUpsell && !confirmForfeit)
        .navigationBarBackButtonHidden(true)
        .navigationBarTitleDisplayMode(.inline)
        // Every VS screen draws its own top row (home / close) like the other
        // VS pages — an empty system bar only stole board height.
        .toolbar(.hidden, for: .navigationBar)
        // Fullscreen like the solo games — hide the bottom tab bar (the VS game is
        // pushed inside the Home tab's nav stack, so the tab bar was overlapping
        // and clipping the keyboard's bottom row).
        .toolbar(.hidden, for: .tabBar)
        // The VS game is pushed inside the Home tab's nav stack, so the custom
        // BottomNav (Home/Leaderboard/Profile/Records) renders over it and eats
        // the bottom safe area — pushing the keyboard's bottom row off-screen.
        // Solo games hide it via fullScreenCover; mirror that here.
        .hidesBottomNav()
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity(mode.rawValue)
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
            // The confirm only belongs to a live match.
            if screen != .match { confirmForfeit = false }
        }
        .onDisappear { vm.leave() }
        // A backgrounded app drops the VS socket; past the server's reconnect
        // grace the match is gone server-side. Track the away time so the VM
        // can show the clean "match ended while you were away" state instead
        // of a zombie board looping "Not in a match" errors.
        .onChange(of: scenePhase) { phase in
            if phase == .background { vm.appDidEnterBackground() }
            else if phase == .active { vm.appDidBecomeActive() }
        }
    }

    private func goHome() { vm.forfeit(); dismiss() }

    /// Home during play: confirm only when leaving would TRULY forfeit (a
    /// recorded loss) — CPU practice and resolved matches just leave.
    private func homeTapped() { if vm.leaveWouldForfeit { confirmForfeit = true } else { goHome() } }

    // MARK: - Queue / live search (§6 — never a dead end)

    @ViewBuilder private var queueScreen: some View {
        if vm.isCpu {
            // A bot: a brief branded warmup while it spins up (the intro splash
            // covers it a beat later).
            VSLoadingView(mode: mode, botArt: vm.cpuPersona?.art,
                          line: vm.cpuPersona.map { "Matching you with \($0.name)…" })
        } else if vm.isRace || vm.isSend {
            VSLoadingView(mode: mode)
        } else {
            liveSearch
        }
    }

    private var liveSearch: some View {
        let waitingLine: String = {
            guard let n = waitingInMode else { return "Checking who’s around in \(modeName)…" }
            return n > 0 ? "\(n) waiting in \(modeName)" : "Nobody else is waiting in \(modeName) right now"
        }()
        return ScrollView {
            VStack(spacing: 18) {
                // Private match: surface the shareable code/link so the host can
                // actually invite a friend (the matchmaker buckets both by code).
                if let code = vm.inviteCode { invitePanel(code).padding(.top, 12) }
                // The ring and the step-in bar each run on their own 60 fps
                // animation timeline (founder, 2026-10-01: the 4 fps periodic
                // timeline made the 15 s countdown choppy). Only the digits tick.
                LiveSearchRing(startedAt: vm.searchStartedAt, paused: vm.showIntro || vm.countdown != nil)
                    .padding(.top, vm.inviteCode == nil ? 36 : 4)
                VStack(spacing: 6) {
                    Text("SEARCHING").font(Brand.font(11, .black)).tracking(1.2).foregroundStyle(VsLobbyKit.ink)
                    Text(vm.inviteCode == nil ? "LOOKING FOR A RIVAL" : "WAITING FOR YOUR FRIEND")
                        .font(Brand.font(22, .black)).foregroundStyle(VsLobbyKit.deep)
                        .multilineTextAlignment(.center)
                    if vm.inviteCode == nil {
                        Text(waitingLine).font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
                            .multilineTextAlignment(.center)
                    }
                }
                if vm.canStepIn && vm.countdown == nil && !vm.showIntro {
                    stepInCard
                    if vm.canPingLooking { VSLookingPingRow(mode: mode) }
                }
                VSGreyPill(title: "CANCEL", icon: "xmark", action: goHome)
                if let m = vm.message { errorPill(m) }
            }
            .padding(.horizontal, 20).padding(.bottom, 24)
            .frame(maxWidth: .infinity)
        }
        .pageBackground(.vs, lightOnly: true)
        .task {
            // This mode's queue, minus yourself, every 5 s while searching.
            while !Task.isCancelled && vm.screen == .queue {
                if let c = await VsLobbyKit.fetchCounts() {
                    waitingInMode = max(0, (c.waiting[mode.rawValue] ?? 0) - 1)
                }
                try? await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }
    }

    /// The step-in card: the bot that takes over at 0:15, a progress bar to it,
    /// PLAY NOW and KEEP WAITING (which turns the card into "We'll keep looking").
    private var stepInCard: some View {
        let bot = CpuOpponent.identity(vm.stepInKind)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                BotArtCircle(art: bot.art, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(vm.keepWaiting ? "We’ll keep looking" : "\(bot.name) steps in at 0:15")
                        .font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.deep)
                    Text(vm.keepWaiting ? "\(bot.name) is ready whenever you are." : "If a person joins first, you get them.")
                        .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub)
                }
                Spacer(minLength: 0)
            }
            if !vm.keepWaiting {
                StepInProgressBar(startedAt: vm.searchStartedAt)
            }
            HStack(spacing: 10) {
                VSPrimaryButton(title: "PLAY \(bot.name.uppercased()) NOW") { Haptics.tap(); vm.stepInNow() }
                if !vm.keepWaiting {
                    Button { Haptics.tap(); vm.keepWaitingTapped() } label: {
                        Text("KEEP WAITING").font(Brand.font(12, .black)).tracking(0.5).foregroundStyle(VsLobbyKit.ink)
                            .padding(.horizontal, 14).frame(height: 46)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.soft))
                    }.buttonStyle(PressableStyle())
                }
            }
            // KEEP WAITING pinged the opted-in players (§13).
            if vm.keepWaiting, let note = vm.lookingNote {
                Text(note).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16).frame(maxWidth: 380)
        .vsCard()
    }

    /// Private-match invite panel shown on the queue screen — the code + a
    /// share button so the host can send the join link. The match starts when
    /// the friend joins with the same code (server buckets by inviteCode).
    private func invitePanel(_ code: String) -> some View {
        VStack(spacing: 10) {
            Text("PRIVATE MATCH").font(Brand.font(10, .black)).tracking(2).foregroundStyle(VsLobbyKit.label)
            Text(code).font(Brand.font(30, .black)).tracking(6).foregroundStyle(VsLobbyKit.deep)
            Text("Share this code — the match starts when your friend joins.")
                .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            ShareLink(item: URL(string: "https://wordocious.com/vs/join/\(code)")!,
                      message: Text("Join my Wordocious VS match — code \(code)")) {
                Label { Text("SHARE INVITE") } icon: { Icon3D(.share, size: 17) }
                    .font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.ink))
            }.buttonStyle(.plain)
            // Logs alongside the ShareLink's own tap (share-sheet open = the
            // user's choice to share the invite link).
            .simultaneousGesture(TapGesture().onEnded {
                ShareEvents.log(kind: "link_invite", gameMode: mode.rawValue, surface: "vs_invite")
            })
        }
        .padding(16).frame(maxWidth: .infinity)
        .vsCard(radius: 16)
        .padding(.horizontal, 4)
    }

    /// 3-2-1-GO (spec §2): the number big in the mode color — solid, no
    /// gradient text — on the opaque VS page (an opaque backdrop so the queue
    /// screen can never ghost through between the intro and the board).
    private var countdownOverlay: some View {
        let accent = ModeStyle.accent(mode)
        return ZStack {
            PageBackground(tint: .vs, lightOnly: true)
            VSOverlayWordmark()
            VStack(spacing: 18) {
                Text(vm.countdownLabel)
                    .font(Brand.font(12, .black)).tracking(2).foregroundStyle(VsLobbyKit.label)
                HStack(spacing: 8) {
                    VSModeGlyphTile(mode: mode, selected: true, size: 30)
                    Text(modeName.uppercased()).font(Brand.font(22, .black)).tracking(0.4)
                        .foregroundStyle(VsLobbyKit.deep).lineLimit(1).minimumScaleFactor(0.6)
                    VSTagPill(size: 12)
                }
                ZStack {
                    Circle().fill(accent.opacity(0.10)).frame(width: 150, height: 150)
                    // A ring that pops on each tick, so the number pulses out of
                    // a burst instead of just swapping.
                    Circle().stroke(accent, lineWidth: 4)
                        .frame(width: 150, height: 150)
                        .id(vm.countdown)
                        .transition(.scale(scale: 0.4).combined(with: .opacity))
                    // Stays inside the 150 pt ring at every Dynamic Type size (Oliver's
                    // phone pushed the "!" outside it, 2026-09-26).
                    Text(vm.countdown == 0 ? "GO!" : "\(vm.countdown ?? 0)")
                        .font(Brand.font(vm.countdown == 0 ? 64 : 96, .black))
                        .lineLimit(1).minimumScaleFactor(0.5)
                        .frame(width: 118)
                        .foregroundStyle(accent)
                        .id(vm.countdown)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(Theme.animation(.spring(response: 0.35, dampingFraction: 0.6)), value: vm.countdown)
        }
    }

    // MARK: - Match (playing) — the solo screen + one compact opponent strip

    @ViewBuilder private var matchScreen: some View {
        if mode == .propernoundle, let pvm = vm.proper {
            // The solo ProperNoundle header, board, hints row and keyboard.
            ProperNoundleVSBoard(vm: pvm, onHome: homeTapped) { opponentStrip(maxGuesses: pvm.maxGuesses, wordLength: max(1, pvm.answerLen)) }
            if let t = pvm.toast { toastView(t) }
        } else if let game = vm.game {
            VStack(spacing: 0) {
                VSMatchHeader(game: game, mode: mode, onHome: homeTapped)
                opponentStrip(maxGuesses: game.maxGuesses, wordLength: game.wordLength)
                    .padding(.top, 8)
                // Board fills the slack BETWEEN header and keyboard — the solo
                // GameScreen's exact BoardLayout. The keyboard gets layout
                // priority so the VStack always reserves its full height first.
                GeometryReader { geo in
                    BoardLayout(vm: game, availableWidth: geo.size.width, fitHeight: geo.size.height)
                }
                .padding(.vertical, 6)
                .layoutPriority(0)
                // Gauntlet: a cleared stage hides the keyboard while the
                // auto-advancing StageTransitionOverlay covers the board — the solo run.
                if !game.stageCleared {
                    // Six/Seven expose the same vowel + consonant hints as solo (the
                    // reveal is added as a board row → counts as a guess, the VS cost).
                    // Keep the bar's SLOT when the game finishes (fade, don't
                    // remove) so the centered board never reflows at the finish.
                    if game.hasHints {
                        vsHintButtons(game)
                            .opacity(game.isFinished ? 0 : 1)
                            .allowsHitTesting(!game.isFinished)
                    }
                    KeyboardView(vm: game).padding(.bottom, 6).layoutPriority(1)
                }
            }
            .padding(.horizontal, 10)
            .frame(maxHeight: .infinity)
            if let t = game.toast { toastView(t) }
        } else {
            VSLoadingView(mode: mode)
        }
    }

    /// The single VS addition over the solo screen: who you're racing, in one
    /// row (a challenge send shows YOUR RUN — nobody is racing it live yet).
    @ViewBuilder private func opponentStrip(maxGuesses: Int, wordLength: Int) -> some View {
        if vm.isSend {
            yourRunPanel
        } else {
            let gauntlet = mode == .gauntlet
            VSOpponentStrip(name: vm.opponentName,
                            avatarUrl: vm.opponentInfo?.avatarUrl,
                            botArt: vm.opponentInfo?.botArt,
                            opponent: vm.opponent,
                            totalBoards: vm.totalBoards,
                            maxGuesses: maxGuesses,
                            wordLength: wordLength,
                            typing: vm.opponentTyping,
                            stageLine: gauntlet ? "Stage \(min(vm.opponent.stagesCleared + 1, gauntletStages.count)) · \(vm.game?.gauntletStageName(at: vm.opponent.stagesCleared) ?? "")" : nil,
                            stageProgress: gauntlet ? Double(vm.opponent.stagesCleared) / Double(max(1, gauntletStages.count)) : nil)
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
        // 16pt bottom: keeps the pills clear of the Q-row so reaching for the
        // keyboard can't fat-finger a hint (founder request, Aug 11).
        .padding(.horizontal, 16).padding(.bottom, 16)
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

    /// Challenge-send game: no opponent — the strip says who will race this run.
    private var yourRunPanel: some View {
        let n = vm.sendTarget?.friendIds.count ?? 0
        let who = n > 0 ? "\(n) \(n == 1 ? "friend" : "friends") will race it" : "Anyone with the link"
        return HStack(spacing: 10) {
            AvatarView(url: AuthService.shared.profile?.avatarUrl, username: AuthService.shared.profile?.username ?? "You", size: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text("YOUR RUN").font(Brand.font(12, .black)).tracking(1).foregroundStyle(VsLobbyKit.ink)
                Text(who).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub)
            }
            Spacer()
            Image(systemName: "paperplane.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(VsLobbyKit.ink)
        }
        .padding(.horizontal, 12).frame(height: VSOpponentStrip.height)
        .vsCard(radius: 14)
    }

    /// Bounced-guess toast — the solo GameScreen's toast (fixed dark fill so it
    /// reads in Dark too), just under the opponent strip.
    private func toastView(_ text: String) -> some View {
        Text(text).font(Brand.font(12, .bold)).foregroundStyle(.white)
            .padding(.horizontal, 12).padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0x1A1A2E)))
            .padding(.top, 132).frame(maxHeight: .infinity, alignment: .top).transition(.opacity)
    }

    // MARK: - Waiting (spectator: you finished, opponent still playing) —
    // ports the vs-game.tsx 'waiting' screen as a teal one-window card + their
    // live boards drawn with the solo tiles/frames, laid out to never overflow.

    private var waitingScreen: some View {
        let liveTotalBoards = vm.opponent.totalBoards > 0 ? vm.opponent.totalBoards : vm.totalBoards
        return GeometryReader { geo in
            // Card content width: page gutters (16) + card padding (14) per side.
            let boardsWidth = max(120, geo.size.width - 32 - 28)
            ScrollView {
                VStack(spacing: 14) {
                    waitingWindow(totalBoards: liveTotalBoards)

                    // Gauntlet spectates by STAGE (its 21 boards are meaningless as a
                    // flat wall) — a card per stage with its name, status, and boards.
                    if mode == .gauntlet {
                        GauntletSpectatorView(opponent: vm.opponent, wordLength: vm.wordLen, width: boardsWidth)
                    } else {
                        // Full frame from the start (all maxGuesses rows) so you can
                        // tell how many guesses the opponent has left.
                        OpponentBoardsGrid(opponent: vm.opponent, boards: liveTotalBoards,
                                           rows: vm.modeMaxGuesses, wordLength: vm.wordLen,
                                           width: boardsWidth, cap: liveTotalBoards <= 1 ? 40 : 26)
                            .padding(14).frame(maxWidth: .infinity)
                            .vsCard(radius: 14)
                    }

                    if let guesses = vm.myFinalGuesses { yourResultCard(guesses: guesses, totalBoards: liveTotalBoards) }

                    // CPU only: the bot's outcome is already fixed by its plan, so let
                    // the player skip watching it grind out its remaining boards.
                    // Win-locked → "Claim your win"; otherwise a neutral fast-forward
                    // (which may be a win OR a loss — whatever the plan resolves to).
                    if vm.isCpu {
                        if cpuWinLocked {
                            VSPrimaryButton(title: "CLAIM YOUR WIN") { Haptics.success(); vm.finishCpuNow() }
                        } else {
                            Button { Haptics.success(); vm.finishCpuNow() } label: {
                                Label("SKIP TO RESULT", systemImage: "forward.fill")
                                    .font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.ink)
                                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.soft))
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(PressableStyle())
                        }
                    }

                    VSGreyPill(title: "LEAVE", icon: "xmark", action: goHome)
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 24)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            HStack {
                Spacer()
                VSModeChip(mode: mode)
                Spacer()
            }
            .frame(height: 40)
            .frame(maxWidth: .infinity)
            // Opaque under the status bar: scrolled boards never show through it.
            .background(PageTint.vs.barColor.ignoresSafeArea(edges: .top))
        }
    }

    /// The teal one-window card: `<NAME> IS STILL PLAYING`, the stakes line,
    /// and their art/avatar with live guesses · clock · boards.
    private func waitingWindow(totalBoards: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                Text("\(opponentShortName.uppercased()) IS STILL PLAYING")
                    .font(Brand.font(16, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.deep)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                if let stakes = stakesCopy {
                    Text(stakes).font(Brand.font(11.5, .heavy)).foregroundStyle(VsLobbyKit.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.5))

            HStack(spacing: 12) {
                LivePulseAvatar(url: vm.opponentInfo?.avatarUrl, name: vm.opponentName, accent: VsLobbyKit.ink,
                                botArt: vm.opponentInfo?.botArt)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(vm.opponentName).font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.deep)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        TypingDots(dotSize: 5).opacity(vm.opponentTyping ? 1 : 0)
                    }
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        let secs = max(0, Int((Date().timeIntervalSince1970 * 1000 - vm.startTimeMs) / 1000))
                        Text("\(vm.opponent.attempts) \(vm.opponent.attempts == 1 ? "guess" : "guesses") · \(secs / 60):\(String(format: "%02d", secs % 60))"
                             + (totalBoards > 1 ? " · \(vm.opponent.boardsSolved)/\(totalBoards) boards" : ""))
                            .font(Brand.font(11.5, .heavy)).foregroundStyle(VsLobbyKit.ink).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                Spacer(minLength: 0)
                VSModeGlyphTile(mode: mode, selected: false, size: 32)
            }
            .padding(12)
        }
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xD5F5EE), Color(hex: 0xE0F2FE)], startPoint: .top, endPoint: .bottom)
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .clipShape(shape)
        .shadow(color: VsLobbyKit.deep.opacity(0.08), radius: 7, x: 0, y: 4)
    }

    /// YOUR RESULT in the soft card style: guesses, time, solved / boards.
    private func yourResultCard(guesses: Int, totalBoards: Int) -> some View {
        let solvedValue = totalBoards > 1
            ? "\(min(vm.myBoardsSolved, totalBoards))/\(totalBoards)"
            : (vm.myStatus == .won ? "Solved" : "Not solved")
        return VStack(alignment: .leading, spacing: 10) {
            VSSectionLabel(text: "YOUR RESULT")
            HStack(spacing: 0) {
                resultStat("GUESSES", "\(guesses)")
                resultStat("TIME", VsLobby.vsClock(vm.playerTimeMs))
                resultStat(totalBoards > 1 ? "BOARDS" : "RESULT", solvedValue)
            }
        }
        .padding(14).frame(maxWidth: .infinity)
        .vsCard(radius: 14)
    }

    private func resultStat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(Brand.font(18, .black)).monospacedDigit().foregroundStyle(VsLobbyKit.deep)
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(Brand.font(9.5, .black)).tracking(0.8).foregroundStyle(VsLobbyKit.label)
        }
        .frame(maxWidth: .infinity)
    }

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

    /// STAKES copy — ports the web waiting-screen IIFE. The real win rule is:
    /// solve, then tie-break on boardsSolved, then composite score = guesses +
    /// timeSeconds/45. We approximate the composite by guess count: the
    /// opponent is still playing, so they're almost always behind on time and
    /// need strictly FEWER guesses; if they're somehow still ahead of your
    /// clock, matching your guess count could win on time.
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

    // MARK: - Result — the home-palette window (like the challenge result)

    private var resultScreen: some View {
        let r = vm.result
        let winner = r?.winner
        let isWin = winner == "player", isDraw = winner == "draw"
        let isLoss = !isWin && !isDraw
        let myName = AuthService.shared.profile?.username ?? "You"
        let oppName = vm.opponentName
        // Solve status decides most matches (solving beats score), so spell it
        // out — the loser often has "better" numbers and it reads as a mistake.
        let mySolved = vm.myStatus == .won
        let oppSolved = VSResultBoards.solved(log: r?.opponentGuessLog ?? [],
                                              solutions: r?.solutions ?? [])
        let headline = isWin ? "YOU WIN!" : isDraw ? "IT’S A DRAW" : "\(opponentShortName.uppercased()) WINS"
        let whyLine: String? = {
            guard let r else { return nil }
            // A forfeit ended it — say so instead of pretending it was decided
            // on score ("Both solved — you won on score" read as a bug).
            if r.forfeit == true {
                return isWin ? "\(opponentShortName) left — you win by forfeit"
                             : "Match forfeited — \(opponentShortName) wins"
            }
            if isDraw { return "Dead even — identical scores" }
            if isWin {
                if mySolved && !oppSolved { return "You solved it — \(opponentShortName) didn’t" }
                if mySolved && oppSolved { return "Both solved — you won on score" }
                // Server timeout resolution: neither solved, board progress decided.
                return "Neither solved — you won on progress"
            }
            if oppSolved && !mySolved { return "\(opponentShortName) solved it — you didn’t" }
            if oppSolved && mySolved { return "Both solved — \(opponentShortName) won on score" }
            return "Neither solved — \(opponentShortName) won on progress"
        }()
        // The deciding margin (core vsMargin, the challenge result's wording)
        // when it agrees with the server's call; otherwise the why-line.
        let margin: String = {
            guard let r else { return "" }
            if r.forfeit == true { return (whyLine ?? "").uppercased() }
            let total = max(1, vm.totalBoards)
            let mine = VsRun(solved: mySolved, boardsSolved: total > 1 ? vm.myBoardsSolved : (mySolved ? 1 : 0),
                             guesses: r.playerGuesses, timeMs: Int(r.playerTime))
            let theirs = VsRun(solved: oppSolved, boardsSolved: total > 1 ? vm.opponent.boardsSolved : (oppSolved ? 1 : 0),
                               guesses: r.opponentGuesses, timeMs: Int(r.opponentTime))
            let expected: VsOutcome = isWin ? .win : (isDraw ? .draw : .loss)
            if VsLobby.vsOutcome(mine, theirs) == expected { return VsLobby.vsMargin(mine, theirs) }
            return (whyLine ?? "").uppercased()
        }()

        return ZStack {
            ScrollView {
                VStack(spacing: 14) {
                    if r != nil {
                        // YOU WIN → S pops in; a loss → R; a draw → U (MASCOT_SPEC §3).
                        ResultHost(outcome: isWin ? .win : (isDraw ? .draw : .loss))
                    }
                    if let r {
                        resultWindow(headline: headline, margin: margin, isWin: isWin, isDraw: isDraw, isLoss: isLoss,
                                     me: ResultSide(name: myName, avatarUrl: AuthService.shared.profile?.avatarUrl, botArt: nil,
                                                    score: r.playerScore, guesses: r.playerGuesses, timeMs: r.playerTime,
                                                    solved: mySolved, winner: isWin),
                                     them: ResultSide(name: oppName, avatarUrl: vm.opponentInfo?.avatarUrl, botArt: vm.opponentInfo?.botArt,
                                                      score: r.opponentScore, guesses: r.opponentGuesses, timeMs: r.opponentTime,
                                                      solved: oppSolved, winner: isLoss))
                        Text("Score = guesses + time (1 pt per 45s) · lowest score wins — but solving always beats not solving")
                            .font(Brand.font(10, .bold)).foregroundStyle(VsLobbyKit.label)
                            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 8)
                    } else {
                        Text(headline).font(Brand.font(22, .black)).foregroundStyle(VsLobbyKit.purpleInk)
                            .padding(.top, 24)
                    }

                    // Updated all-time head-to-head (refetched after the match was recorded).
                    if vm.opponentUserId != nil, !vm.isCpu, let h2h = vm.headToHead {
                        h2hCard(h2h)
                    }

                    rematchSection
                    actions

                    // CPU practice: photo-finish flourish + streak / milestone /
                    // cosmetic unlock / run-it-back session tally — below the
                    // window, inside the safe area.
                    if vm.isCpu { botExtras }

                    // Final boards with letters — opponent's reconstructed from
                    // the match-end guess log + solutions.
                    if let r, let solutions = r.solutions, !solutions.isEmpty {
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
                .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 32)
            }
            // Confetti for wins only (web parity).
            if isWin { ConfettiView().ignoresSafeArea().allowsHitTesting(false) }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            ZStack {
                Wordmark(size: 22)
                HStack {
                    HeaderCircleButton(.symbol("xmark"), label: "Close", action: goHome)
                    Spacer()
                }
            }
            .padding(.horizontal, 10).frame(height: 44)
            // Opaque under the status bar — nothing scrolls up behind the clock.
            .background(PageTint.vs.barColor.ignoresSafeArea(edges: .top))
        }
    }

    private struct ResultSide {
        let name: String
        let avatarUrl: String?
        let botArt: String?
        let score: Double
        let guesses: Int
        let timeMs: Double
        let solved: Bool
        let winner: Bool
    }

    /// Split halves (winner `#ebd6fd`, other `#e2e6ff`; a draw both `#ece8ff`)
    /// under a frosted strip with the caps headline + mode icon + margin.
    private func resultWindow(headline: String, margin: String, isWin: Bool, isDraw: Bool, isLoss: Bool,
                              me: ResultSide, them: ResultSide) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let mineBg = isDraw ? Color(hex: 0xECE8FF) : (isWin ? Color(hex: 0xEBD6FD) : Color(hex: 0xE2E6FF))
        let theirBg = isDraw ? Color(hex: 0xECE8FF) : (isLoss ? Color(hex: 0xEBD6FD) : Color(hex: 0xE2E6FF))
        // ART_SPEC §6: YOU WIN! / YOU LOSE / DRAW lettering in place of the text
        // headline (a loss or forfeit reads YOU LOSE); the text row is the fallback.
        let moment: MomentArt = isWin ? .youwin : (isDraw ? .draw : .youlose)
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                MomentLettering(moment) {
                    HStack(spacing: 8) {
                        Image("swords").renderingMode(.template).resizable().scaledToFit()
                            .frame(width: 18, height: 18).foregroundStyle(VsLobbyKit.purple)
                        Text(headline)
                            .font(Brand.font(18, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleInk)
                            .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .frame(maxWidth: .infinity)
                HStack(spacing: 6) {
                    if let h = VsLobbyKit.home(mode) {
                        BannerGlyph(icon: h.icon, ink: h.accent, accent: h.accent, solid: false, size: 18)
                    }
                    Text(margin.isEmpty ? modeName.uppercased() : "\(modeName.uppercased()) · \(margin)")
                        .font(Brand.font(10.5, .heavy)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleSub)
                        .lineLimit(2).minimumScaleFactor(0.7)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.5))

            HStack(alignment: .top, spacing: 0) {
                resultColumn(me, label: "YOU").frame(maxWidth: .infinity)
                resultColumn(them, label: (vm.isCpu ? opponentShortName : them.name).uppercased()).frame(maxWidth: .infinity)
            }
            .padding(.vertical, 14)
        }
        .background {
            ZStack {
                HStack(spacing: 0) { mineBg; theirBg }
                LinearGradient(stops: [.init(color: .white.opacity(0.35), location: 0), .init(color: .white.opacity(0), location: 0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                if isWin && !Theme.reduceMotion { BannerSweep().allowsHitTesting(false) }
            }
        }
        .clipShape(shape)
        .shadow(color: VsLobbyKit.purpleInk.opacity(0.08), radius: 7, x: 0, y: 4)
        .accessibilityElement(children: .combine)
    }

    private func resultColumn(_ p: ResultSide, label: String) -> some View {
        let penalty = max(0, p.score - Double(p.guesses))
        return VStack(spacing: 6) {
            VSPlayerAvatar(url: p.avatarUrl, username: p.name, botArt: p.botArt, size: 36)
            HStack(spacing: 4) {
                if p.winner { Icon3D(.trophy, size: 12) }
                Text(label).font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(VsLobbyKit.purpleSub)
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
            Text(String(format: "%.2f", p.score))
                .font(Brand.font(32, .black)).monospacedDigit().foregroundStyle(VsLobbyKit.purpleInk)
                .lineLimit(1).minimumScaleFactor(0.6)
            // The exact calculation, spelled out.
            Text("\(p.guesses) \(p.guesses == 1 ? "guess" : "guesses") + \(String(format: "%.2f", penalty)) time")
                .font(Brand.font(10, .bold)).foregroundStyle(VsLobbyKit.purpleSub)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(VsLobby.vsClock(Int(p.timeMs)))
                .font(Brand.font(10, .bold)).monospacedDigit().foregroundStyle(VsLobbyKit.purpleSub)
            // Solve chip — the tiebreak that actually decides most matches.
            Text(p.solved ? "SOLVED" : "NOT SOLVED")
                .font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(.white)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(Capsule().fill(p.solved ? VsLobbyKit.purple : Color(hex: 0x64748B)))
        }
        .padding(.horizontal, 8)
    }

    private func h2hCard(_ h2h: HeadToHeadRecord) -> some View {
        HStack(spacing: 12) {
            VSPlayerAvatar(url: vm.opponentInfo?.avatarUrl, username: vm.opponentName, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("YOU AND \(vm.opponentName.uppercased())").font(Brand.font(10, .black)).tracking(0.6)
                    .foregroundStyle(VsLobbyKit.label).lineLimit(1).minimumScaleFactor(0.7)
                Text(HeadToHeadService.headToHeadLine(opponentName: vm.opponentName, h2h))
                    .font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.purpleInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14).vsCard(radius: 14)
    }

    /// Bot extras in one soft card: photo finish, ladder clear, streak or
    /// milestone, badge unlock, the session tally and the Bots-record note.
    private var botExtras: some View {
        VStack(spacing: 6) {
            if let pf = vm.photoFinish {
                PhotoFinishStamp(clutch: pf == "clutch")
            }
            if let rung = vm.cpuClearedRung {
                Text("\(VsLobby.botName(rung).uppercased()) CLEARED ON THE LADDER!")
                    .font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.ink)
                    .multilineTextAlignment(.center)
            }
            if let m = vm.cpuMilestone {
                // ART_SPEC §6: the streak milestone gets the STREAK! lettering over
                // its count line (the flame + text alone is the fallback).
                if MomentArt.streak.isAvailable {
                    VStack(spacing: 2) {
                        MomentLettering(.streak, maxWidth: 200, maxHeight: 56) { EmptyView() }
                        Text("\(m)-win bot streak").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0xC2410C))
                    }
                } else {
                    HStack(spacing: 4) {
                        Icon3D(.flame, size: 18)
                        Text("\(m)-win bot streak!").font(Brand.font(14, .black)).foregroundStyle(Color(hex: 0xC2410C))
                    }
                }
            } else if vm.cpuStreak > 0 {
                Text("Bot win streak: \(vm.cpuStreak)").font(Brand.font(12, .heavy)).foregroundStyle(VsLobbyKit.sub)
            }
            if vm.cpuUnlock != nil {
                Text("🏅 Unlocked \(BotPersonas.persona(vm.cpuPersona?.tier ?? .hard).name)’s badge!")
                    .font(Brand.font(12, .black)).foregroundStyle(Color(hex: UInt(vm.cpuPersona?.color ?? 0xEF4444)))
            }
            if vm.cpuSessionWins + vm.cpuSessionLosses > 0 {
                Text("THIS SESSION · YOU \(vm.cpuSessionWins) · BOTS \(vm.cpuSessionLosses)")
                    .font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(VsLobbyKit.deep)
            }
            Text("Bot game — counts in your Bots record, not People")
                .font(Brand.font(10.5, .bold)).foregroundStyle(VsLobbyKit.label)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 14).padding(.vertical, 12).frame(maxWidth: .infinity)
        .vsCard(radius: 14)
    }

    @ViewBuilder private var rematchSection: some View {
        switch vm.rematch {
        case .received:
            VStack(spacing: 10) {
                Text("\(opponentShortName.uppercased()) WANTS A REMATCH")
                    .font(Brand.font(14, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.purpleInk)
                    .multilineTextAlignment(.center)
                HStack(spacing: 10) {
                    VSSoftPurpleButton(title: "DECLINE") { vm.declineRematch() }
                    VSPrimaryButton(title: "ACCEPT", color: VsLobbyKit.purple) { vm.acceptRematch() }
                }
            }
            .padding(14).frame(maxWidth: .infinity)
            .vsCard(radius: 14)
        default: EmptyView()
        }
    }

    /// Actions — solid purple REMATCH on top, soft HOME / SHARE below.
    private var actions: some View {
        VStack(spacing: 10) {
            switch vm.rematch {
            case .declined:
                Text("NO REMATCH").font(Brand.font(14, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.label)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xEEF0F3)))
            case .offered:
                HStack(spacing: 8) {
                    ProgressView().tint(.white).controlSize(.small)
                    Text("WAITING FOR \(opponentShortName.uppercased())…").font(Brand.font(14, .black)).tracking(0.6)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.purple.opacity(0.6)))
            case .received:
                EmptyView()   // the "wants a rematch" card carries the buttons
            case .idle:
                // Free users get the Pro upsell modal instead of an inline error
                // (web parity — Rematch opens VsLimitModal for non-Pro).
                VSPrimaryButton(title: "REMATCH", color: VsLobbyKit.purple) {
                    if vm.isPro { vm.offerRematch() } else { showRematchUpsell = true }
                }
            }

            HStack(spacing: 10) {
                VSSoftPurpleButton(title: "HOME", icon: "house.fill", action: goHome)
                VSSoftPurpleButton(title: "SHARE", icon: "square.and.arrow.up") { shareVSCard() }
            }
        }
    }

    /// Render + share the VS result card (same aesthetic as the daily share
    /// cards: wordmark, accent label, result pill, tinted color-only boards).
    /// Falls back to text-only when there's no result payload.
    private func shareVSCard() {
        guard let r = vm.result else {
            ShareEvents.log(kind: "text", gameMode: mode.rawValue, surface: "vs_result")
            #if canImport(UIKit)
            let av = UIActivityViewController(activityItems: [shareText], applicationActivities: nil)
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first?
                .windows.first(where: { $0.isKeyWindow })?.rootViewController?.present(av, animated: true)
            #endif
            return
        }
        ShareEvents.log(kind: "image", gameMode: mode.rawValue, surface: "vs_result")
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

    // MARK: - Opponent left / match gone / not configured (soft VS cards)

    private var opponentLeftScreen: some View {
        noticeCard(icon: "person.fill.xmark", title: "\(opponentShortName.uppercased()) LEFT THE MATCH", sub: nil)
    }

    /// The match no longer exists server-side — the app was backgrounded past
    /// the server's reconnect grace (or the server timed the match out). No
    /// local result is recorded from this screen (leaving here is NOT a forfeit).
    private var matchGoneScreen: some View {
        noticeCard(icon: "clock.badge.xmark", title: "MATCH ENDED WHILE YOU WERE AWAY",
                   sub: "The server couldn’t hold the match open that long.")
    }

    private var notConfigured: some View {
        noticeCard(icon: "bolt.horizontal.circle", title: "VS IS ALMOST READY",
                   sub: "Real-time matches turn on once the multiplayer server is connected.", button: "BACK")
    }

    private func noticeCard(icon: String, title: String, sub: String?, button: String = "VS HOME") -> some View {
        VStack(spacing: 14) {
            VSModeGlyphTile(mode: mode, selected: false, size: 44)
            Image(systemName: icon).font(.system(size: 30, weight: .bold)).foregroundStyle(VsLobbyKit.ink)
            Text(title).font(Brand.font(17, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.deep)
                .multilineTextAlignment(.center)
            if let sub {
                Text(sub).font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub).multilineTextAlignment(.center)
            }
            VSPrimaryButton(title: button, action: goHome).padding(.top, 4)
        }
        .padding(20).frame(maxWidth: 380)
        .vsCard(radius: 16)
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Shared bits

    private func errorPill(_ text: String) -> some View {
        Text(text).font(Brand.font(12, .bold)).foregroundStyle(Color(hex: 0xB91C1C))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(Capsule().fill(Color(hex: 0xFEF2F2)))
    }
}

/// The solo mode header for a VS board match (VS polish spec §1): the solo
/// home button, the mode title in its usual style with a small solid teal VS
/// pill beside it, and the solo progress line + clock. Gauntlet keeps the solo
/// stage stepper / stage title / stats header. Observes the game so the
/// guesses line updates on every guess.
struct VSMatchHeader: View {
    @ObservedObject var game: GameViewModel
    let mode: GameMode
    let onHome: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            VSGameHomeButton(accent: ModeStyle.accent(mode), action: onHome)
            Spacer(minLength: 0)
            Group {
                if mode == .gauntlet { gauntletHeader } else { standardHeader }
            }
            // ART_SPEC §14: the title art takes the whole width between the corners.
            .layoutPriority(1)
            Spacer(minLength: 0)
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.top, 6)
    }

    private var standardHeader: some View {
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                Text(ModeStyle.title(mode))
                    .font(Brand.font(28, .black))
                    .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .gameTitleArt(mode)
                VSTagPill()
            }
            HStack(spacing: 12) {
                Text(progressLabel).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                    .lineLimit(1).minimumScaleFactor(0.8)
                clock(12)
            }
        }
    }

    // Gauntlet — the solo stage stepper · colored stage-name title · stats.
    private var gauntletHeader: some View {
        VStack(spacing: 3) {
            HStack(spacing: 0) {
                ForEach(0..<max(game.gauntletStageCount, 1), id: \.self) { i in
                    if i > 0 {
                        Rectangle().fill(connector(i)).frame(width: 16, height: 2).padding(.horizontal, 2)
                    }
                    node(i)
                }
            }
            .padding(.top, 2)
            HStack(spacing: 8) {
                Text(game.gauntletStageName)
                    .font(Brand.font(18, .black))
                    .foregroundStyle(LinearGradient(colors: GameScreen.gauntletStageGradient(game.gauntletStageName),
                                                    startPoint: .leading, endPoint: .trailing))
                    .lineLimit(1).minimumScaleFactor(0.7)
                VSTagPill(size: 10)
            }
            if !game.stageCleared {
                HStack(spacing: 12) {
                    if game.boardCount > 1 {
                        HStack(spacing: 3) {
                            Icon3D(.trophy, size: 12)
                            Text("\(game.boardsSolvedCount)/\(game.boardCount)").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                        }
                    }
                    Text("\(game.rowsUsed)/\(game.maxGuesses) guesses").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                    clock(11)
                }
            }
        }
    }

    private func clock(_ size: CGFloat) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            HStack(spacing: 3) {
                Image(systemName: "clock").font(.system(size: size - 1)).foregroundStyle(Color(hex: 0x60A5FA))
                Text("\(game.elapsedSeconds / 60):\(String(format: "%02d", game.elapsedSeconds % 60))")
                    .font(Brand.caption(size)).foregroundStyle(Theme.textMuted).monospacedDigit()
            }
        }
    }

    /// Solo GameScreen.progressLabel.
    private var progressLabel: String {
        if let g = game.gauntletStageLabel { return g }
        if game.isMultiBoard {
            return "\(game.boardsSolvedCount)/\(game.boardCount) solved · \(game.rowsUsed)/\(game.maxGuesses) guesses"
        }
        return "\(game.rowsUsed)/\(game.maxGuesses) guesses"
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
                .shadow(color: active ? Color(hex: 0xA855F7).opacity(0.35) : .clear, radius: active ? 4 : 0)
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

/// The solo games' corner Home button (44 pt, mode-accent ring) — reused by
/// the VS match header and the ProperNoundle VS board.
struct VSGameHomeButton: View {
    let accent: Color
    let action: () -> Void
    var body: some View {
        // HEADER_SPEC §4: the soft white circle with the house in the header ink.
        GameCornerButton(kind: .home, action: action)
    }
}

/// The one-row opponent strip (VS polish spec §1, ≤ 64 pt): avatar or bot art,
/// name, a slim teal progress bar (boards solved / total; Gauntlet stages),
/// guess count, a typing dot, and on the right a tiny color-only board for
/// single-board modes or `2/4 boards` for multi-board modes — never a wall
/// of empty grids. Fixed height so the board below never jumps.
struct VSOpponentStrip: View {
    static let height: CGFloat = 56

    let name: String
    let avatarUrl: String?
    let botArt: String?
    let opponent: VSMatchViewModel.OpponentProgress
    /// The MODE's board count, known from match start (opponent.totalBoards is
    /// 0 until their first progress event).
    let totalBoards: Int
    let maxGuesses: Int
    let wordLength: Int
    let typing: Bool
    /// Gauntlet: "Stage 2 · QuadWord" replaces the boards count.
    var stageLine: String? = nil
    var stageProgress: Double? = nil

    private var total: Int { max(opponent.totalBoards, totalBoards) }

    var body: some View {
        let progress = min(1, max(0, stageProgress ?? Double(opponent.boardsSolved) / Double(max(1, total))))
        HStack(spacing: 10) {
            VSPlayerAvatar(url: avatarUrl, username: name, botArt: botArt, size: 34)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(name).font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    // Reserved slot: the dots fade, they never shift the row.
                    TypingDots(dotSize: 4).opacity(typing ? 1 : 0)
                        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: typing)
                    Spacer(minLength: 4)
                    Text("\(opponent.attempts) \(opponent.attempts == 1 ? "guess" : "guesses")")
                        .font(Brand.font(11, .heavy)).foregroundStyle(VsLobbyKit.sub).monospacedDigit()
                        .lineLimit(1).fixedSize()
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(VsLobbyKit.soft)
                        Capsule().fill(VsLobbyKit.ink).frame(width: geo.size.width * progress)
                    }
                }
                .frame(height: 5)
                .animation(Theme.animation(.easeInOut(duration: 0.4)), value: progress)
            }
            trailing
        }
        .padding(.horizontal, 12)
        .frame(height: Self.height)
        .frame(maxWidth: .infinity)
        .vsCard(radius: 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11y)
    }

    @ViewBuilder private var trailing: some View {
        if let stageLine {
            Text(stageLine).font(Brand.font(11, .black)).foregroundStyle(VsLobbyKit.ink)
                .lineLimit(1).minimumScaleFactor(0.7)
                .frame(maxWidth: 110, alignment: .trailing)
        } else if total > 1 {
            HStack(spacing: 3) {
                Text("\(opponent.boardsSolved)/\(total)").font(Brand.font(14, .black)).monospacedDigit()
                    .foregroundStyle(VsLobbyKit.deep)
                Text("boards").font(Brand.font(10.5, .heavy)).foregroundStyle(VsLobbyKit.sub)
            }
            .fixedSize()
        } else {
            // Tiny color-only board (≤ 44 pt tall, ≤ 72 pt wide).
            let rows = CGFloat(max(1, maxGuesses)), cols = CGFloat(max(1, wordLength))
            let cell = max(3, min(7, floor((44 - (rows - 1)) / rows), floor((72 - (cols - 1)) / cols)))
            OpponentMiniBoard(tiles: opponent.tiles[0] ?? [], maxGuesses: maxGuesses, wordLength: wordLength, cell: cell)
        }
    }

    private var a11y: String {
        var parts = ["\(name)", "\(opponent.attempts) \(opponent.attempts == 1 ? "guess" : "guesses")"]
        if let stageLine { parts.append(stageLine) }
        else if total > 1 { parts.append("\(opponent.boardsSolved) of \(total) boards solved") }
        else if opponent.solved { parts.append("solved") }
        if typing { parts.append("typing") }
        return parts.joined(separator: ", ")
    }
}

/// Fits the opponent's live boards into `width` with the solo completed-board
/// geometry (1 / 2 / 4 columns, tile*0.1 gaps, the multi-board frame), so
/// boards can never overlap or overflow horizontally (founder screenshot: a
/// 4-across grid of 24 pt boards spilled off a phone).
enum SpectatorLayout {
    static let gap: CGFloat = 8
    static func tile(width: CGFloat, boards: Int, wordLength: Int, cap: CGFloat) -> CGFloat {
        let cols = CompletedBoardLayout.cols(boards)
        let framePad: CGFloat = boards > 1 ? 12 : 0
        let cellW = (width - CGFloat(cols - 1) * gap) / CGFloat(cols) - framePad
        let wl = CGFloat(max(1, wordLength))
        return max(6, min(cap, floor(cellW / (wl + (wl - 1) * 0.1))))
    }
}

/// The opponent's boards on the spectator screen, rows of 1 / 2 / 4.
private struct OpponentBoardsGrid: View {
    let opponent: VSMatchViewModel.OpponentProgress
    let boards: Int
    let rows: Int
    let wordLength: Int
    let width: CGFloat
    var cap: CGFloat = 26
    var offset: Int = 0

    var body: some View {
        let n = max(1, boards)
        let cols = CompletedBoardLayout.cols(n)
        let tile = SpectatorLayout.tile(width: width, boards: n, wordLength: wordLength, cap: cap)
        VStack(spacing: SpectatorLayout.gap) {
            ForEach(0..<((n + cols - 1) / cols), id: \.self) { r in
                HStack(alignment: .top, spacing: SpectatorLayout.gap) {
                    ForEach(0..<cols, id: \.self) { c in
                        let i = r * cols + c
                        if i < n {
                            OpponentLiveBoard(tiles: opponent.tiles[offset + i] ?? [], rows: rows,
                                              wordLength: wordLength, tile: tile, framed: n > 1)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// One opponent board drawn with the solo tiles (TileView, color only — the
/// letters stay hidden until match end) inside the solo multi-board frame;
/// rows that land while you watch flip in with the solo FlipRevealTile.
private struct OpponentLiveBoard: View {
    let tiles: [[TileState]]
    let rows: Int
    let wordLength: Int
    let tile: CGFloat
    let framed: Bool
    /// Rows present on first appear never flip; only rows that land live do.
    @State private var seen = -1

    private var solved: Bool { tiles.contains { !$0.isEmpty && $0.allSatisfy { $0 == .correct } } }

    var body: some View {
        let gap = tile * 0.1
        VStack(spacing: gap) {
            ForEach(0..<max(rows, tiles.count, 1), id: \.self) { r in
                HStack(spacing: gap) {
                    ForEach(0..<max(wordLength, 1), id: \.self) { c in
                        let st: TileState? = (r < tiles.count && c < tiles[r].count) ? tiles[r][c] : nil
                        if let st, st != .empty {
                            if seen >= 0 && r >= seen {
                                FlipRevealTile(letter: "", state: st, size: tile, delay: Double(c) * 0.08, duration: 0.3)
                            } else {
                                TileView(letter: "", state: st, revealed: true, size: tile)
                            }
                        } else {
                            TileView(letter: "", state: .empty, revealed: false, size: tile)
                        }
                    }
                }
            }
        }
        .modifier(SolvedBoardFrame(won: framed && solved, lost: false, active: framed, tileSize: tile))
        .onAppear { if seen < 0 { seen = tiles.count } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(solved ? "Board solved" : "\(tiles.count) \(tiles.count == 1 ? "guess" : "guesses") on this board")
    }
}

/// Gauntlet spectator — the opponent's 21 boards broken down by stage (name,
/// status, boards), instead of a meaningless flat wall. Cleared stages collapse
/// to their solved rows; the active stage shows live; locked stages dim out.
private struct GauntletSpectatorView: View {
    let opponent: VSMatchViewModel.OpponentProgress
    let wordLength: Int
    /// The card content width (boards are fitted to it, never overflow).
    let width: CGFloat

    private enum StageStatus { case cleared, active, locked }

    var body: some View {
        VStack(spacing: 10) {
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
            if st != .locked {
                // The ACTIVE stage renders its full frame (all maxGuesses rows) so
                // you can tell how many guesses the opponent has left; CLEARED
                // stages compact to the rows actually used.
                let used = (0..<stage.boardCount).map { opponent.tiles[offset + $0]?.count ?? 0 }.max() ?? 0
                let rows = st == .active ? stage.maxGuesses : min(stage.maxGuesses, max(1, used))
                OpponentBoardsGrid(opponent: opponent, boards: stage.boardCount, rows: rows,
                                   wordLength: wordLength, width: width, cap: stage.boardCount == 1 ? 26 : 18,
                                   offset: offset)
            }
        }
        .padding(14).frame(maxWidth: .infinity)
        .vsCard(radius: 14)
        .opacity(st == .locked ? 0.55 : 1)
    }

    @ViewBuilder private func statusChip(_ st: StageStatus) -> some View {
        switch st {
        case .cleared:
            Text("CLEARED").font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(.white)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(VsLobbyKit.purple))
        case .active:
            HStack(spacing: 5) {
                Text("PLAYING").font(Brand.font(9.5, .black)).tracking(0.6).foregroundStyle(VsLobbyKit.ink)
                TypingDots(dotSize: 4)
            }
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(VsLobbyKit.soft))
        case .locked:
            Icon3D(.lock, size: 14) // ART_SPEC §5
        }
    }
}

/// Compact grid of the opponent's guess tiles (colors only — no letters) — the
/// strip's tiny single-board preview. Ports opponent-mini-board.tsx.
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

/// A single opponent tile that flips in (staggered left-to-right) the moment it
/// fills. Empty tiles are flat soft gray — no outline at this size.
private struct OpponentTile: View {
    let state: TileState?
    let cell: CGFloat
    let delay: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var revealed = false

    private var filled: Bool { state != nil && state != .empty }
    private var radius: CGFloat { max(1.5, cell * 0.2) }

    var body: some View {
        RoundedRectangle(cornerRadius: radius)
            .fill(color)
            .frame(width: cell, height: cell)
            .scaleEffect(filled && !revealed ? 0.5 : 1)
            .opacity(filled && !revealed ? 0 : 1)
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
        case .correct, .present, .absent: return Theme.tileColor(for: state ?? .empty)
        default: return Color(hex: 0xE5E7EB)
        }
    }
}

/// Opponent avatar with a breathing accent ring — signals a "live" opponent on
/// the spectator screen so it doesn't feel static while you wait.
private struct LivePulseAvatar: View {
    let url: String?
    let name: String
    let accent: Color
    var botArt: String? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle().stroke(accent, lineWidth: 2.5).frame(width: 56, height: 56)
                .scaleEffect(pulse ? 1.45 : 0.95).opacity(pulse ? 0 : 0.7)
            VSPlayerAvatar(url: url, username: name, botArt: botArt, size: 52)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2.5))
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
            .font(Brand.font(26, .black)).tracking(0.6)
            .foregroundStyle(VsLobbyKit.purple)
            .rotationEffect(.degrees(-6))
            .scaleEffect(shown ? 1 : 0.3)
            .opacity(shown ? 1 : 0)
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

/// Freemium "already played today" screen — ports DailyVsAlreadyPlayed, in
/// the VS aesthetic: a teal one-window card (caps headline, YOU WIN! / YOU LOSE
/// lettering, U's all-done scene, the
/// answer in solo tiles, the next-battle clock), then the actions.
private struct DailyVsAlreadyPlayed: View {
    let answer: String
    var isPro: Bool = false
    var won: Bool? = nil
    let onHome: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                window
                Text(isPro
                     ? "Want more? Jump into unlimited VS battles with fresh puzzles."
                     : "Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.")
                    .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
                    .multilineTextAlignment(.center).padding(.horizontal, 16)
                if isPro {
                    // Pro: back to the VS lobby (where the Daily Battle launched from,
                    // VS overhaul 2026-10-01) for unlimited any-mode battles
                    // (web parity — DailyVsAlreadyPlayed's "Play Unlimited VS").
                    VSPrimaryButton(title: "PLAY UNLIMITED VS", action: onHome)
                } else {
                    // Gold "Upgrade to Pro" CTA (web parity — links to the Pro page).
                    NavigationLink { ProView() } label: {
                        Label { Text("UPGRADE TO PRO") } icon: { Icon3D(.crown, size: 18) }.font(Brand.font(14, .black)).tracking(0.6)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xD97706)))
                    }.buttonStyle(PressableStyle())
                }
                VSGreyPill(title: "VS HOME", icon: "house.fill", action: onHome)
            }
            .padding(.horizontal, 16).padding(.top, 24).padding(.bottom, 32)
        }
        .pageBackground(.vs, lightOnly: true)
    }

    private var window: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("TODAY’S DAILY BATTLE").font(Brand.font(10, .black)).tracking(1).foregroundStyle(VsLobbyKit.ink)
                    Text("ALREADY PLAYED").font(Brand.font(18, .black)).tracking(0.4).foregroundStyle(VsLobbyKit.deep)
                }
                Spacer(minLength: 6)
                // Today's daily VS outcome as moment lettering (ART_SPEC §6/§10: YOU WIN! /
                // YOU LOSE, ≈28 pt); the W/L chip (purple win, slate loss) without the art.
                if let won {
                    MomentLettering(won ? .youwin : .youlose, maxWidth: 140, maxHeight: 28) {
                        Text(won ? "YOU WON" : "YOU LOST")
                            .font(Brand.font(11, .black)).tracking(0.6).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(won ? VsLobbyKit.purple : Color(hex: 0x64748B)))
                    }
                }
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.5))

            VStack(spacing: 14) {
                // Played today: U's all-done scene (ART_SPEC §7; §10 parity with Android).
                SceneArt(.allDone, height: 110, fallbackSize: 72)
                if !answer.isEmpty {
                    HStack(spacing: 5) {
                        ForEach(Array(answer.uppercased().enumerated()), id: \.offset) { _, ch in
                            TileView(letter: String(ch), state: .correct, revealed: true, size: 44)
                        }
                    }
                }
                // Live "next daily VS" countdown (web parity — getSecondsUntilMidnight pill).
                TimelineView(.periodic(from: Date(), by: 1)) { _ in
                    let s = secondsUntilLocalMidnight()
                    Text("NEXT DAILY BATTLE IN \(cd(s))")
                        .font(Brand.font(10.5, .black)).tracking(0.5).monospacedDigit().foregroundStyle(VsLobbyKit.ink)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(Color.white.opacity(0.75)))
                }
            }
            .padding(16)
        }
        .background(LinearGradient(colors: [Color(hex: 0xD5F5EE), Color(hex: 0xE0F2FE)], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: VsLobbyKit.deep.opacity(0.08), radius: 7, x: 0, y: 4)
    }

    private func cd(_ s: Int) -> String {
        String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}

/// "Ping me when someone's looking for <Mode>" (spec §13): the row under the
/// live search's step-in card (Pro, live random queue). The switch is bound to
/// profiles.notification_prefs.vsLooking — a missing key is OFF — and writes
/// it the way the notification-prefs toggles do (merge, then refresh the profile).
private struct VSLookingPingRow: View {
    let mode: GameMode
    @ObservedObject private var auth = AuthService.shared
    @State private var saving = false

    var body: some View {
        let on = VsLookingService.isOn(auth.profile?.notificationPrefs)
        HStack(spacing: 10) {
            Image(systemName: on ? "bell.fill" : "bell")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(on ? Color(hex: 0x0F766E) : VsLobbyKit.sub)
                .frame(width: 22)
            Text("Ping me when someone’s looking for \(VsLobbyKit.modeName(mode))")
                .font(Brand.font(12, .heavy)).foregroundStyle(VsLobbyKit.deep)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Toggle("", isOn: Binding(get: { on }, set: { NotificationPrefsWriter.set(VsLookingService.prefKey, $0, saving: $saving) }))
                .labelsHidden()
                .tint(Color(hex: 0x0F766E))
                .disabled(saving || auth.profile == nil)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: 380)
        .vsCard()
        .opacity(saving ? 0.6 : 1)
    }
}
