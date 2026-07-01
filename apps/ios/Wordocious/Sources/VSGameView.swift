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
    // Leaving an in-progress match forfeits it (a recorded loss) — confirm first.
    @State private var confirmForfeit = false

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()

            switch vm.screen {
            case .notConfigured:     notConfigured
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
            if vm.countdown != nil && !vm.showIntro { countdownOverlay }

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
                    onDone: { vm.showIntro = false })
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
            Button(action: goHome) {
                Label("Cancel", systemImage: "xmark")
                    .font(Brand.font(14, .bold)).foregroundStyle(Theme.textMuted)
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .background(Capsule().fill(Theme.surface)).overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
            }.buttonStyle(.plain)
            if let m = vm.message { errorPill(m) }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 12) {
                Text("MATCH FOUND").font(Brand.font(15, .heavy)).tracking(3).foregroundStyle(.white.opacity(0.7))
                Text("\(vm.countdown ?? 0)")
                    .font(Brand.font(96, .black))
                    .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
                    .id(vm.countdown)
                    .transition(.scale.combined(with: .opacity))
            }
            .animation(Theme.animation(.easeOut(duration: 0.25)), value: vm.countdown)
        }
    }

    // MARK: - Match (playing)

    @ViewBuilder private var matchScreen: some View {
        if mode == .propernoundle, let pvm = vm.proper {
            VStack(spacing: 0) {
                matchHeader
                tugOfWarHeader
                    .padding(.horizontal, 10).padding(.top, 6)
                OpponentStrip(opponent: vm.opponent, gradient: gradient)
                    .padding(.horizontal, 10).padding(.top, 6)
                ProperNoundleVSBoard(vm: pvm)   // bespoke ProperNoundle board+keyboard
            }
            if let t = pvm.toast { toastView(t) }
        } else if let game = vm.game {
            VStack(spacing: 0) {
                matchHeader
                tugOfWarHeader
                    .padding(.horizontal, 10).padding(.top, 6)
                OpponentStrip(opponent: vm.opponent, gradient: gradient,
                              maxGuesses: game.maxGuesses, wordLength: game.wordLength)
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
                // Gauntlet: a cleared stage shows Continue (advance the run)
                // instead of the keyboard, mirroring the solo GameScreen.
                if game.stageCleared {
                    Button(game.isLastStage ? "Finish Gauntlet" : "Continue") { Haptics.success(); game.nextStage() }
                        .buttonStyle(.borderedProminent).tint(Theme.primary).controlSize(.large)
                        .padding(.bottom, 10)
                } else {
                    KeyboardView(vm: game).padding(.bottom, 6).layoutPriority(1)
                }
            }
            .frame(maxHeight: .infinity)
            if let t = game.toast { toastView(t) }
        }
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
                            Text("\(game.rowsUsed)/\(game.maxGuesses) guesses")
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
        let oppRowsUsed = vm.opponent.tiles.values.map(\.count).max() ?? 0
        // Cap rendered empty rows so Gauntlet's 50-guess budget doesn't blow up the layout.
        let spectatorRows = min(vm.modeMaxGuesses, max(6, oppRowsUsed + 1))

        return ScrollView {
            VStack(spacing: 18) {
                Text("\(oppName) is still playing...")
                    .font(Brand.font(24, .black))
                    .foregroundStyle(LinearGradient(colors: gradient, startPoint: .leading, endPoint: .trailing))
                    .multilineTextAlignment(.center)
                    .padding(.top, 32)

                // Opponent identity + live counters
                HStack(spacing: 10) {
                    AvatarView(url: vm.opponentInfo?.avatarUrl, username: oppName, size: 40)
                        .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
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

                // Opponent live board — scaled-up mini board, colors only
                Group {
                    if liveTotalBoards <= 1 {
                        OpponentMiniBoard(tiles: vm.opponent.tiles[0] ?? [],
                                          maxGuesses: spectatorRows, wordLength: vm.wordLen, cell: 16)
                    } else {
                        let columns = Array(repeating: GridItem(.flexible(), spacing: 8),
                                            count: min(liveTotalBoards, 4))
                        LazyVGrid(columns: columns, spacing: 8) {
                            ForEach(0..<liveTotalBoards, id: \.self) { i in
                                OpponentMiniBoard(tiles: vm.opponent.tiles[i] ?? [],
                                                  maxGuesses: spectatorRows, wordLength: vm.wordLen, cell: 16)
                            }
                        }
                    }
                }
                .padding(16).frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))

                // Your stats
                if let guesses = vm.myFinalGuesses {
                    statCard(title: "YOUR RESULT", rows: [
                        ("Guesses", "\(guesses)"),
                        ("Time", formatTime(Double(vm.playerTimeMs))),
                    ])
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

        return ZStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Headline + updated all-time head-to-head (refetched after
                    // the match was recorded).
                    VStack(spacing: 8) {
                        Text(headline).font(Brand.font(56, .black))
                            .foregroundStyle(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing))
                            .minimumScaleFactor(0.6).lineLimit(1)
                        if vm.opponentUserId != nil, let h2h = vm.headToHead {
                            Text(HeadToHeadService.headToHeadLine(opponentName: oppName, h2h))
                                .font(Brand.font(14, .heavy)).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .padding(.top, 40)

                    // Comparison bars: you (purple) vs them (pink), lower is better
                    if let r = vm.result {
                        VSComparisonBars(myName: myName, opponentName: oppName, metrics: [
                            .init(label: "Guesses", mine: Double(r.playerGuesses), theirs: Double(r.opponentGuesses),
                                  format: { "\(Int($0))" }),
                            .init(label: "Time", mine: r.playerTime, theirs: r.opponentTime,
                                  format: { [self] in formatTime($0) }),
                            .init(label: "Score (guesses + time penalty)", mine: r.playerScore, theirs: r.opponentScore,
                                  format: { String(format: "%.2f", $0) }),
                        ])
                    }

                    rematchSection
                    actions

                    // Final boards with letters — opponent's reconstructed from
                    // the match-end guess log + solutions.
                    if let r = vm.result, let solutions = r.solutions, !solutions.isEmpty {
                        VSFinalBoards(myName: myName, opponentName: oppName,
                                      myGuessLog: vm.myGuessLog,
                                      opponentGuessLog: r.opponentGuessLog ?? [],
                                      solutions: solutions)
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

                ShareLink(item: shareText) {
                    Label("Share", systemImage: "square.and.arrow.up").font(Brand.font(14, .bold)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
        }
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
private struct OpponentStrip: View {
    let opponent: VSMatchViewModel.OpponentProgress
    let gradient: [Color]
    var maxGuesses: Int = 6
    var wordLength: Int = 5

    private var hasTiles: Bool { opponent.tiles.values.contains { !$0.isEmpty } }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "person.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted)
                Text("Opponent").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textSecondary)
                Spacer()
                // Gauntlet VS: show how many stages the opponent has cleared.
                if opponent.stagesCleared > 0 {
                    Label("Stage \(opponent.stagesCleared + 1)", systemImage: "flag.fill")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
                } else if opponent.totalBoards > 1 {
                    Text("\(opponent.boardsSolved)/\(opponent.totalBoards) boards").font(Brand.font(12, .bold)).foregroundStyle(Theme.textPrimary)
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
            if hasTiles, opponent.totalBoards <= 4 {
                let boards = opponent.totalBoards > 1 ? Array(0..<opponent.totalBoards) : [0]
                HStack(spacing: 6) {
                    ForEach(boards, id: \.self) { i in
                        OpponentMiniBoard(tiles: opponent.tiles[i] ?? [], maxGuesses: maxGuesses, wordLength: wordLength, cell: 8)
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

    var body: some View {
        VStack(spacing: 1) {
            ForEach(0..<max(maxGuesses, 1), id: \.self) { r in
                HStack(spacing: 1) {
                    ForEach(0..<max(wordLength, 1), id: \.self) { c in
                        let st: TileState? = (r < tiles.count && c < tiles[r].count) ? tiles[r][c] : nil
                        RoundedRectangle(cornerRadius: 2)
                            .fill(color(st))
                            .frame(width: cell, height: cell)
                            .overlay(st == nil || st == .empty
                                     ? RoundedRectangle(cornerRadius: 2).stroke(Color(hex: 0xD1D5DB), lineWidth: 1) : nil)
                    }
                }
            }
        }
    }

    private func color(_ s: TileState?) -> Color {
        switch s {
        case .correct: return Color(hex: 0x7C3AED)
        case .present: return Color(hex: 0xF59E0B)
        case .absent:  return Theme.textMuted
        default:       return .clear
        }
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
