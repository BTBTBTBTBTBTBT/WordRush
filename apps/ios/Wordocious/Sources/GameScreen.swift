import SwiftUI
import WordociousCore

struct GameScreen: View {
    /// Pro Unlimited "Play Again": HomeView swaps in a fresh non-daily seed.
    var onPlayAgain: (() -> Void)? = nil

    @StateObject private var vm: GameViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    @State private var showVictory = false
    @State private var showGuide = false
    // Holds the in-play board on screen after a win/loss until the final row has
    // finished flipping, then the finished screen + victory overlay spring in.
    @State private var revealComplete = false
    /// §AU3: the Gauntlet stage card is up (set one reveal after the stage clears).
    @State private var stageCardUp = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let mode: GameMode

    init(seed: String, mode: GameMode, title: String, onPlayAgain: (() -> Void)? = nil) {
        _vm = StateObject(wrappedValue: GameViewModel(seed: seed, mode: mode))
        self.mode = mode
        self.onPlayAgain = onPlayAgain
    }

    /// Web parity: Play Again only on non-daily (Unlimited) games for Pro.
    private var playAgainAction: (() -> Void)? {
        guard !vm.isDaily, AuthService.shared.isProActive else { return nil }
        return onPlayAgain
    }

    /// Time for the final row's flip to play out (flip duration + per-column
    /// stagger), matching BoardView's mini/full timing — used to delay the
    /// finished screen so the winning word animates first.
    private var revealDuration: Double {
        // FINISH_SPEC §BI5: the final row's whole reveal at the board's own pacing
        // (mini on multi-board), then a win's hop wave, then the 0.2 s beat — the
        // popup always waits for the row to finish.
        RevealTiming.finishHold(columns: vm.wordLength, winHop: vm.status == .won, mini: vm.isMultiBoard)
    }

    var body: some View {
        GeometryReader { root in
        ZStack {
            PageBackground(tint: .forGame(mode))  // ART_SPEC §15 / §19: the game's wallpaper

            VStack(spacing: 0) {
                // Gauntlet finishes (win OR loss) show the dedicated animated
                // results screen — same component as the re-entry review.
                if vm.isFinished && vm.isGauntlet, let g = vm.state.gauntlet {
                    GauntletResultsView(progress: g, won: vm.status == .won, mode: mode, isDaily: vm.isDaily,
                                        showNextDaily: true,
                                        elapsedMsFallback: vm.elapsedSeconds * 1000,
                                        onHome: { dismiss() }, onShare: { share() },
                                        onPlayAgain: playAgainAction)
                // Other modes hold the in-play board until the winning row's flip completes.
                } else if vm.isFinished && revealComplete {
                    // FINISH_SPEC §R2: the finished screen fits ONE screen — the
                    // compact header + result strip, the board scaled to exactly the
                    // height left, then the dock (share + Next daily / Leaderboard +
                    // the Unlimited card). The breakdown, rank and definition sit
                    // below the dock, never above the buttons.
                    FinishedScreenLayout(header: {
                        FinishedCompactHeader(
                            mode: mode, won: vm.status == .won,
                            guessCount: vm.rowsUsed, maxGuesses: vm.maxGuesses,
                            timeSeconds: vm.elapsedSeconds,
                            boardsSolved: vm.boards.filter { $0.status == .won }.count,
                            totalBoards: vm.boardCount, points: scorePoints)
                    }, board: { size in
                        if vm.boardCount > 1 {
                            // The compact mini grid (2×2 / 4 across), scaled to fit.
                            FinishedMiniGrid(boards: vm.boards,
                                             rowCount: vm.boards.map(\.maxGuesses).max() ?? vm.maxGuesses,
                                             size: size, revealMissed: vm.status != .won)
                        } else {
                            // §L: the single board on the shared tray, fit to the area.
                            BoardLayout(vm: vm, availableWidth: size.width * 0.94, fitHeight: size.height, tray: true)
                        }
                    }, dock: {
                        finishedDock
                    }, extras: {
                        VStack(spacing: 8) {
                            if vm.isDaily { DailyRankBadge(gameMode: mode) }
                            ScoreBreakdownView(gameMode: mode.rawValue, completed: vm.status == .won,
                                               guessCount: vm.rowsUsed, timeSeconds: vm.elapsedSeconds,
                                               boardsSolved: vm.boards.filter { $0.status == .won }.count,
                                               totalBoards: vm.boardCount, hintsUsed: vm.hintsUsed,
                                               stagesCompleted: vm.stagesCompletedForScore,
                                               bestCorrectLetters: vm.bestCorrectLettersForScore,
                                               day: vm.isDaily ? getDailySeedDate(vm.state.seed) : nil)
                            // §B6: today's word (purple tiles on a soft green card).
                            if vm.boardCount == 1 {
                                DefinitionCard(solution: vm.boards[0].solution, showWord: true,
                                               label: vm.isDaily ? "TODAY'S WORD" : "THE WORD")
                            }
                        }
                        .padding(.horizontal, 2)
                        .padding(.top, 14).padding(.bottom, 16)
                    })
                } else {
                    header
                    // Greedy area between header and keyboard: size tiles to fit.
                    GeometryReader { geo in
                        BoardLayout(vm: vm, availableWidth: geo.size.width, fitHeight: geo.size.height)
                    }
                    .padding(.vertical, 6)
                    // Keep the hint bar's SLOT after the win/loss (the in-play
                    // board stays on screen until the final row's flip ends):
                    // removing it grew the greedy board area, so the centered
                    // board visibly jumped down at the finish moment — right as
                    // the "Solved!" toast appeared — then back up when the
                    // finished layout arrived. Fade it instead: same look, no
                    // reflow, the board never moves.
                    if vm.hasHints {
                        classicHintButtons
                            .opacity(vm.status == .playing ? 1 : 0)
                            .allowsHitTesting(vm.status == .playing)
                    }
                    // Stage-cleared shows the full-screen StageTransition overlay
                    // (below). §AU3: the keyboard keeps its slot (faded, inert) so the
                    // board never jumps while the winning row lands and the card fades in.
                    KeyboardView(vm: vm).padding(.bottom, 6)
                        .opacity(vm.stageCleared ? 0 : 1)
                        .allowsHitTesting(!vm.stageCleared)
                        .accessibilityHidden(vm.stageCleared)
                        // §BI9: "Not in word list" / "Solved!" hang from the keyboard's
                        // top edge, under the board — never over the title art or the board.
                        .gameFeedbackToast(vm.toast, alignment: .top, pose: toastPose)
                }
            }
            .padding(.horizontal, 10)
            .wideColumn(.game)   // §AG: iPad keeps the phone column, centered on the wallpaper

            // FINISH_SPEC §B4: the controls row tucked right under the status bar —
            // Home on the left; sound + help on the right (every game, Gauntlet too).
            GameCornerButton(kind: .home) { dismiss() }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, GameCornerButton.topInset).padding(.leading, GameCornerButton.sideInset)

            GameCornerButton(kind: .help) { showGuide = true }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.top, GameCornerButton.topInset).padding(.trailing, GameCornerButton.sideInset)
            .sheet(isPresented: $showGuide) { GuideSheet(mode: mode) }

            // XP toast (after recording) + one-time victory/game-over celebration.
            if let xp = vm.xpResult {
                XpToastView(result: xp) { vm.xpResult = nil }
            }
            if showVictory {
                VictoryOverlay(
                    won: vm.status == .won,
                    guesses: vm.rowsUsed, maxGuesses: vm.maxGuesses,
                    // Gauntlet: the overlay celebrates the FINAL STAGE (its boards/
                    // guesses are stage-scoped) — so its time must be the stage's
                    // time, not the whole run's (web parity: gauntlet-game feeds
                    // VictoryAnimation the last stageResult.timeMs).
                    timeSeconds: vm.isGauntlet
                        ? (vm.state.gauntlet?.stageResults.last.map { $0.timeMs / 1000 } ?? vm.elapsedSeconds)
                        : vm.elapsedSeconds,
                    boardsSolved: vm.boards.filter { $0.status == .won }.count, totalBoards: vm.boardCount,
                    solution: vm.boardCount == 1 ? vm.boards.first?.solution : nil,
                    solutions: vm.boardCount > 1 ? vm.boards.map(\.solution) : [],
                    // The run's composite score — the same inputs the breakdown card uses.
                    points: scorePoints,
                    // §242: unlimited games offer the next puzzle on the card
                    // (playAgainAction already carries the non-daily + Pro gate).
                    onPlayAgain: playAgainAction.map { action in
                        { showVictory = false; action() }
                    },
                    game: mode,
                    // §AZ: build the finished layout first (under the card), then fade the
                    // card out on the next frame — the exit never shares a frame with the build.
                    onDismiss: {
                        revealComplete = true
                        DispatchQueue.main.async {
                            withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showVictory = false }
                        }
                    })
                .transition(.scale(scale: 0.8).combined(with: .opacity))   // web fade-in-scale 0.8→1.0
            }
            // Gauntlet stage-transition overlay. §AU3: it fades in once the winning
            // row has landed (no flash over a half-flipped board), stays ≥ 5 s, and a
            // tap / Continue / Enter skips at once.
            if vm.stageCleared && stageCardUp {
                StageTransitionOverlay(completedName: vm.gauntletStageName,
                                       next: vm.gauntletNextStageInfo,
                                       clearedIndex: vm.gauntletCurrentIndex,
                                       totalStages: vm.gauntletStageCount,
                                       runningScore: gauntletRunningScore,
                                       onAdvance: { vm.nextStage() })
                .transition(.opacity)
            }
        }
        }
        // Custom on-screen KeyboardView only — never let a lingering SYSTEM
        // keyboard inset (e.g. from the share sheet) squeeze the board layout.
        .ignoresSafeArea(.keyboard)
        // Physical keys (founder, 2026-09-30) go quiet under the victory card
        // and the Gauntlet stage transition, like the on-screen keyboard.
        .hardwareKeyboardEnabled(!showVictory && !vm.stageCleared)
        .navigationBarBackButtonHidden(true)
        .navigationBarTitleDisplayMode(.inline)
        .hidesBottomNav()
        // BF2: unlocks never land over the finishing board or the win card — they
        // wait from the finish until the card has closed (or the game is left).
        .holdsAchievementPopups("game-finish", active: vm.isFinished && !revealComplete)
        // Cards on the game screen lift with the game's accent (ART_SPEC §15).
        .environment(\.pageTint, .forGame(mode))
        // Friends "On now · in <game>" (spec §1): the game on screen.
        .presenceActivity(mode.rawValue)
        // Left-edge swipe → back to Home (parity with the web back gesture).
        .swipeToGoBack { dismiss() }
        // Safety net: if the player leaves a fully-cleared Gauntlet run before
        // the final overlay auto-advances, record the win on the way out so the
        // daily result (and a Flawless sweep) isn't lost.
        .onDisappear { vm.finalizeGauntletIfCleared() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .animation(Theme.animation(.easeInOut(duration: 0.3)), value: stageCardUp)
        .onChange(of: vm.stageCleared) { cleared in
            guard cleared else { stageCardUp = false; return }
            let wait = Theme.reduceMotion ? 0 : RevealTiming.finishHold(columns: vm.wordLength, winHop: false, mini: vm.isMultiBoard)
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
                if vm.stageCleared { stageCardUp = true }
            }
        }
        .onChange(of: vm.status) { newValue in
            // Haptics fire instantly; the jingle waits for the overlay (below).
            if newValue == .won { Haptics.success() }
            else if newValue == .lost { Haptics.soft() }   // §U: lose · soft
            // Celebrate the moment of finishing. Gauntlet only celebrates a WON
            // run (web parity: a lost run goes straight to the results screen,
            // no overlay and no game-over sound). Wait out the final row's flip,
            // then fade in the victory overlay so the winning word animates first.
            if (newValue == .won || newValue == .lost) && (!vm.isGauntlet || newValue == .won) {
                let delay = Theme.reduceMotion ? 0 : revealDuration
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    // Web plays success/gameOver when the overlay mounts — i.e.
                    // AFTER the reveal — not at the instant the game finishes.
                    if newValue == .won { SoundManager.shared.playSuccess() }
                    else { SoundManager.shared.playGameOver() }
                    // Show the victory card + confetti over the (dimmed) finished
                    // board first. The heavier finished/stats layout is built only
                    // after the user taps to continue, so it never competes with
                    // the confetti for frames. Web entrance: fade-in-scale
                    // 0.8 → 1.0, 300ms ease-out.
                    // §AQ1: the popup springs in faster.
                    withAnimation(Theme.animation(Motion.spring)) {   // §AZ: the shared spring
                        showVictory = true
                    }
                    // High-point review ask: WIN path only (never a loss) —
                    // count the win, then maybe prompt (>=5 lifetime wins,
                    // 14-day cooldown, once per build, ~2s past the confetti).
                    if newValue == .won { RatingsPrompt.recordWin(); RatingsPrompt.maybeAsk() }
                }
            }
        }
        .onAppear {
            // A game resumed already-finished (status won't change) jumps straight
            // to the finished screen — no victory replay.
            if vm.isFinished { revealComplete = true }
            // Free users: show the game-start interstitial first (mirrors web AdGate),
            // then start the timer on dismiss so ad time isn't counted.
            if !adShown {
                adShown = true
                AdsManager.shared.showGameStartInterstitial { vm.resumeTimer() }
            } else {
                vm.resumeTimer()
            }
        }
        .onDisappear { vm.pauseTimer() }
        .onChange(of: scenePhase) { phase in
            if phase == .active && !showGuide { vm.resumeTimer() } else { vm.pauseTimer() }
        }
        // Reading the guide mid-game pauses the clock (resumes on close).
        .onChange(of: showGuide) { open in
            if open { vm.pauseTimer() } else { vm.resumeTimer() }
        }
    }

    // MARK: Header

    @ViewBuilder
    private var header: some View {
        if vm.isGauntlet { gauntletHeader } else { standardHeader }
    }

    /// The status line's ink (the mockup's #6a4fa0; themed in Dark).
    private static var statusInk: Color { Theme.isDark ? Theme.textMuted : Color(hex: 0x6A4FA0) }

    private var standardHeader: some View {
        VStack(spacing: 4) {
            // The game's title art (lettering + host, ART_SPEC §10); text + host when it's missing.
            Text(ModeStyle.title(mode))
                .font(Brand.font(28, .black))
                .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
                .lineLimit(1).minimumScaleFactor(0.7)
                .soloGameTitle(mode, fallbackInset: 52)
            // FINISH_SPEC §B4: the status line sits right under the title art.
            HStack(spacing: 12) {
                Text(progressLabel).font(Brand.font(12, .heavy)).foregroundStyle(Self.statusInk)
                if !vm.stageCleared {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 3) {
                            Image(systemName: "clock").font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: 0x60A5FA))
                            Text(timeString).font(Brand.font(12, .heavy)).monospacedDigit().foregroundStyle(Self.statusInk)
                        }
                    }
                }
            }
        }
    }

    // MARK: Gauntlet header — 1:1 with web GauntletProgress + GauntletStageHeader
    // (stage stepper · colored stage-name title · boards/guesses/time subtitle).

    private var gauntletHeader: some View {
        VStack(spacing: 3) {
            gauntletStepper
            Text(vm.gauntletStageName)
                .font(Brand.font(18, .black))
                .foregroundStyle(LinearGradient(colors: Self.gauntletStageGradient(vm.gauntletStageName),
                                                startPoint: .leading, endPoint: .trailing))
                .gameHost(mode, size: 24)
            if !vm.stageCleared {
                HStack(spacing: 12) {
                    if vm.boardCount > 1 {
                        let solved = vm.boards.filter { $0.status == .won }.count
                        HStack(spacing: 3) {
                            Icon3D(.trophy, size: 12)
                            Text("\(solved)/\(vm.boardCount)").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                        }
                    }
                    Text("\(vm.rowsUsed)/\(vm.maxGuesses) guesses").font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 3) {
                            Image(systemName: "clock").font(.system(size: 10)).foregroundStyle(Color(hex: 0x60A5FA))
                            Text(timeString).font(Brand.caption(11)).foregroundStyle(Theme.textMuted)
                        }
                    }
                }
            }
        }
        .padding(.top, 4)
    }

    private var gauntletStepper: some View {
        HStack(spacing: 0) {
            ForEach(0..<vm.gauntletStageCount, id: \.self) { i in
                if i > 0 {
                    Rectangle().fill(gauntletConnectorColor(i))
                        .frame(width: 16, height: 2).padding(.horizontal, 2)
                }
                gauntletStageNode(i)
            }
        }
        .padding(.top, 2)
    }

    @ViewBuilder
    private func gauntletStageNode(_ i: Int) -> some View {
        let completed = vm.gauntletCompletedIndices.contains(i)
        let active = i == vm.gauntletCurrentIndex
        // §A1: upcoming stages are a faint lilac wash, never grey / white.
        let bg = completed ? Color(hex: 0xEDE9FE) : active ? Color(hex: 0xF3E8FF) : Color(hex: 0xF6F2FF)
        let border = completed ? Color(hex: 0x8B5CF6) : active ? Color(hex: 0xC084FC) : Color(hex: 0xDDD0F7)
        let fg = completed ? Color(hex: 0x6D28D9) : active ? Color(hex: 0x9333EA) : Color(hex: 0x9A88BF)
        ZStack {
            Circle().fill(bg).overlay(Circle().stroke(border, lineWidth: 2)).frame(width: 20, height: 20)
                .modifier(StageGlow(active: active))
            if completed {
                Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(fg)
            } else if active {
                Image(systemName: "play.fill").font(.system(size: 8)).foregroundStyle(fg).offset(x: 1)
            } else {
                Text("\(i + 1)").font(.system(size: 10, weight: .bold)).foregroundStyle(fg)
            }
        }
    }

    /// A soft purple halo on the active gauntlet stage node (web `gauntlet-glow`'s
    /// color, held still on iOS — see below).
    private struct StageGlow: ViewModifier {
        let active: Bool
        private let glow = Color(hex: 0xA855F7)
        func body(content: Content) -> some View {
            // Perf audit: a STILL halo. The old forever-animated shadow radius re-rendered
            // two blurred shadows every frame of the whole Gauntlet run (main thread +
            // offscreen GPU passes under the board and keyboard).
            content
                .background {
                    if active {
                        Circle().fill(glow.opacity(0.32)).padding(-4)
                    }
                }
        }
    }

    private func gauntletConnectorColor(_ i: Int) -> Color {
        if vm.gauntletCompletedIndices.contains(i) { return Color(hex: 0x8B5CF6) }
        if i == vm.gauntletCurrentIndex { return Color(hex: 0xD8B4FE) }
        return Color(hex: 0xDDD0F7)
    }

    /// Per-stage title gradient — mirrors web STAGE_GRADIENTS.
    static func gauntletStageGradient(_ name: String) -> [Color] {
        switch name {
        case "QuadWord":    return [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)]
        case "Succession":  return [Color(hex: 0xFACC15), Color(hex: 0xFB923C), Color(hex: 0xF87171)]
        case "Deliverance": return [Color(hex: 0x818CF8), Color(hex: 0xC084FC), Color(hex: 0xE879F9)]
        case "OctoWord":    return [Color(hex: 0x22D3EE), Color(hex: 0xC084FC), Color(hex: 0xF472B6)]
        default:            return [Color(hex: 0xC084FC), Color(hex: 0xF472B6)] // The Opening / fallback
        }
    }

    private var timeString: String {
        let s = vm.elapsedSeconds
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }

    private var progressLabel: String {
        if let g = vm.gauntletStageLabel { return g }
        if vm.isMultiBoard {
            // Web parity (quordle-game.tsx): show both boards-solved AND the shared
            // guess count, not just the solved fraction.
            let solved = vm.boards.filter { $0.status == .won }.count
            return "\(solved)/\(vm.boardCount) solved · \(vm.rowsUsed)/\(vm.maxGuesses) guesses"
        }
        return "\(vm.rowsUsed)/\(vm.maxGuesses) guesses"
    }

    // MARK: Classic hints (Six / Seven) — vowel + consonant reveal buttons

    private var classicHintButtons: some View {
        HStack(spacing: 12) {
            hintPill(
                label: vm.vowelUsed ? (vm.vowelRevealed == "—" ? "No vowels left" : "Vowel: \(vm.vowelRevealed ?? "")") : "Vowel",
                used: vm.vowelUsed) { Haptics.success(); vm.revealVowel() }
            hintPill(
                label: vm.consonantUsed ? (vm.consonantRevealed == "—" ? "No consonants left" : "Consonant: \(vm.consonantRevealed ?? "")") : "Consonant",
                used: vm.consonantUsed) { Haptics.success(); vm.revealConsonant() }
        }
        .frame(maxWidth: 360)
        // 16pt bottom: keep the pills clear of the Q-row (fat-finger, Aug 11).
        .padding(.horizontal, 16).padding(.bottom, 16)
    }

    /// §A8: the hint buttons are small candy buttons (gold = the hint's glow);
    /// a used hint becomes the quiet peach showing the revealed letter.
    @ViewBuilder
    private func hintPill(label: String, used: Bool, action: @escaping () -> Void) -> some View {
        // BI25: a used hint is information — a soft filled pill, no outline (same footprint).
        if used { UsedHintPill(label: label) } else {
        Button(action: action) {
            // §BI22: both pills keep one equal width ("Vowel" → "Vowel: A" / "No
            // consonants left" no longer resizes them or nudges its neighbor).
            CandyLabel(title: label, symbol: used ? nil : "lightbulb.fill")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(CandyButtonStyle(variant: used ? .peach : .amber, size: .small))
        .disabled(used)
        }
    }

    /// The run's composite score — the same inputs the breakdown card uses (the
    /// victory card and the share image's gold POINTS window both show it).
    private var scorePoints: Int {
        Int(DailyScoring.breakdown(gameMode: mode.rawValue, completed: vm.status == .won,
                                   guessCount: vm.rowsUsed, timeSeconds: vm.elapsedSeconds,
                                   boardsSolved: vm.boards.filter { $0.status == .won }.count,
                                   totalBoards: vm.boardCount, hintsUsed: vm.hintsUsed,
                                   stagesCompleted: vm.stagesCompletedForScore,
                                   bestCorrectLetters: vm.bestCorrectLettersForScore,
                                   dateKey: vm.isDaily ? getDailySeedDate(vm.state.seed) : nil).total)
    }

    /// FINISH_SPEC §R2 / §R3: the finished screen's dock. A daily: the 3D share icon
    /// beside Next daily / Leaderboard (+ the Pro Unlimited card). After an
    /// UNLIMITED game (Pro): the KEEP PLAYING card is the primary action — NEW
    /// PUZZLE = the existing Play again, "Other games" = back Home to the picker.
    @ViewBuilder private var finishedDock: some View {
        // Founder 10-02: the SHARE RESULTS candy (the share icon no longer floats beside
        // the strip) rides IN the dock's action row — beside Next daily / Leaderboard, or
        // in the Unlimited card's row — with "Next <Game> in …" inside it on a daily.
        let shareCTA = AnyView(FinishedShareCTA(nextGame: vm.isDaily ? FinishedShareCTA.gameName(mode) : nil,
                                                onShare: { reveal in share(reveal: reveal) }))
        if vm.isDaily {
            NextDailyCTA(currentMode: mode.rawValue, compact: true, share: shareCTA)
                .padding(.bottom, 6)
        } else if let again = onPlayAgain {
            // §R3: the card shows for everyone (it gates free players itself).
            UnlimitedKeepPlayingCard(game: ModeGen.byDbKey(mode.rawValue)?.title ?? ModeStyle.title(mode).capitalized,
                                     afterUnlimited: true, action: again, onOtherGames: { dismiss() }, share: shareCTA)
                .padding(.bottom, 6)
        } else {
            shareCTA.padding(.bottom, 6)
        }
    }

    /// FINISH_SPEC §P: the score so far on the between-stage card — the Gauntlet
    /// scoring with the stages cleared up to (and including) the one just cleared.
    private var gauntletRunningScore: Int? {
        guard let g = vm.state.gauntlet, !g.stages.isEmpty else { return nil }
        let done = min(g.stages.count, g.currentStage + 1)
        return Int(DailyScoring.breakdown(gameMode: "GAUNTLET", completed: vm.isLastStage,
                                          guessCount: vm.gauntletTotalGuesses + vm.rowsUsed,
                                          timeSeconds: vm.elapsedSeconds,
                                          boardsSolved: g.stages.prefix(done).reduce(0) { $0 + $1.boardCount },
                                          totalBoards: max(1, g.stages.reduce(0) { $0 + $1.boardCount }),
                                          stagesCompleted: done,
                                          dateKey: vm.isDaily ? getDailySeedDate(vm.state.seed) : nil).total)
    }

    // MARK: Post-game share

    private func share(reveal: Bool = false) {
        // User-initiated share: chooser pick → text/image (Gauntlet's stage-chip
        // card skips the chooser and is always an image).
        ShareEvents.log(kind: vm.isGauntlet || reveal ? "image" : "text",
                        gameMode: mode.rawValue, surface: "post_game")
        let kind: ShareCardView.Kind
        if vm.isGauntlet {
            let stages = vm.gauntletStagesShare()
            kind = .gauntlet(stages: stages,
                             stagesCompleted: stages.filter { $0.won }.count,
                             totalStages: stages.count)
        } else if vm.boardCount > 1 {
            kind = .multi(boards: vm.shareBoards(), boardsSolved: vm.boardsSolvedCount, totalBoards: vm.boardCount)
        } else {
            kind = .single(grid: vm.shareGrid())
        }
        // Gauntlet shares the RUN-total guesses (web gauntlet-results.tsx passes
        // totalGuesses for both guesses and maxGuesses), not the last stage's.
        let shareGuesses = vm.isGauntlet ? vm.gauntletTotalGuesses : vm.rowsUsed
        let shareMax = vm.isGauntlet ? vm.gauntletTotalGuesses : vm.maxGuesses
        let single = !vm.isGauntlet && vm.boardCount == 1
        ShareService.share(kind: kind, mode: mode, modeLabel: ModeStyle.shareLabel(mode), accent: ModeStyle.accent(mode),
                           won: vm.status == .won, guesses: shareGuesses, maxGuesses: shareMax,
                           timeSeconds: vm.elapsedSeconds,
                           reveal: reveal,
                           letters: single ? vm.shareLetters() : nil,
                           solutionDisplay: single ? vm.state.boards[0].solution : nil,
                           points: scorePoints)
    }

    // MARK: Gauntlet stage-clear

    private var stageClearedBanner: some View {
        VStack(spacing: 10) {
            HStack(spacing: 6) {
                // §AM3: 3D art, never the check-mark emoji.
                Icon3D(vm.isLastStage ? .trophy : .badgeCheck, size: 22)
                Text(vm.isLastStage ? "Final stage cleared!" : "Stage cleared!")
                    .font(Brand.headline(18)).foregroundStyle(Theme.textPrimary)
            }
            Button { Haptics.success(); vm.nextStage() } label: {
                CandyLabel(title: vm.isLastStage ? "Finish Gauntlet" : "Continue", symbol: "play.fill")
            }
            .buttonStyle(CandyButtonStyle(variant: .purple, size: .large, fullWidth: false))
        }
        .padding(.vertical, 16).frame(maxWidth: .infinity)
    }

    /// FINISH_SPEC §K1 / §BI9: the candy toast's small cast pose that fits the
    /// event — never the game's host (§A7).
    private var toastPose: (MascotID, String)? {
        guard let toast = vm.toast else { return nil }
        return G5Toast.pose(for: G5Toast.tone(forGameMessage: toast), avoiding: Mascots.host(mode))
    }
}

/// Gauntlet stage-transition overlay — 1:1 with web stage-transition.tsx.
/// Auto-advances to the next stage after 2.5s (or on tap).
// Non-private so the VS Gauntlet screen can reuse the exact same auto-advancing
// stage-transition overlay (parity with the solo run).
struct StageTransitionOverlay: View {
    let completedName: String
    let next: (name: String, boards: Int, guesses: Int, sequential: Bool, prefill: Bool)?
    /// A VS run (founder: the card stays 5 s like solo and the player's race clock
    /// pauses while it's up; a tap / Continue / Enter skips at once).
    var isVersus: Bool = false
    /// FINISH_SPEC §P (optional, the solo run passes them): the just-cleared
    /// stage's index (0-based), the run length and the score so far. Without them
    /// (VS) the card simply omits the stage counter, dots and score.
    var clearedIndex: Int? = nil
    var totalStages: Int? = nil
    var runningScore: Int? = nil
    let onAdvance: () -> Void

    @State private var appeared = false
    @State private var pulse = false
    /// §AU3: advance exactly once (tap, Continue, Enter or the timer).
    @State private var advanced = false
    @Environment(\.accessibilityReduceMotion) private var envReduce
    private var still: Bool { envReduce || Theme.reduceMotion }

    private static let amber = Color(hex: 0xF59E0B)

    /// The upcoming stage's number (1-based), when known.
    private var upcoming: Int? { clearedIndex.map { $0 + 2 } }

    /// §P: a big cast pose per upcoming stage; the cleared run (no next) is W, proud.
    private var pose: (MascotID, String) {
        guard next != nil else { return (.w, "proud") }
        switch upcoming {
        case 2: return (.o1, "cheer")
        case 3: return (.d, "eureka")
        case 4: return (.c, "telescope")
        case 5: return (.s, "flex")
        case nil: return (.o1, "cheer")
        default: return (.w, "proud")
        }
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()
            VStack(spacing: 12) {
                PoseImage(pose.0, pose.1, height: 140)
                    .scaleEffect(appeared || still ? 1 : 0.4)
                    .opacity(appeared || still ? 1 : 0)
                    .animation(still ? nil : .spring(response: 0.45, dampingFraction: 0.55), value: appeared)

                VStack(spacing: 4) {
                    FinishLabel("Stage complete", color: Color(hex: 0xB45309))
                    Text(completedName).font(Brand.font(17, .black)).foregroundStyle(FinishInk.heading)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    // A small W badge per cleared stage.
                    if let c = clearedIndex {
                        HStack(spacing: 4) {
                            ForEach(0...max(0, c), id: \.self) { _ in Icon3D(.badgeW, size: 18) }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(c + 1) stages cleared")
                    }
                }

                if let n = next {
                    if let u = upcoming, let total = totalStages, total > 0 {
                        // FINISH_SPEC §AR: the stage line in live lettering (gold numbers).
                        LiveHeadline(text: "STAGE \(u) OF \(total)", palette: .home, size: 24, maxLines: 1)
                            .accessibilityLabel("Stage \(u) of \(total)")
                        dots(total: total, upcoming: u)
                    } else {
                        FinishLabel("Next up", color: Color(hex: 0xB45309))
                    }
                    Text(n.name).font(Brand.font(26, .black)).foregroundStyle(FinishInk.heading)
                        .lineLimit(1).minimumScaleFactor(0.6)
                    // The stage's rule as a tinted pill.
                    Text("\(n.boards) board\(n.boards > 1 ? "s" : "") · \(n.guesses) guesses\(n.sequential ? " · sequential" : "")\(n.prefill ? " · pre-filled clues" : "")")
                        .font(Brand.font(12, .heavy)).foregroundStyle(FinishInk.heading)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 6)
                        .tintedPill(Self.amber, radius: 12)
                }

                if let score = runningScore {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("POINTS SO FAR").font(Brand.font(11, .black)).tracking(1).foregroundStyle(FinishInk.secondary)
                        Text(score.formatted()).softNumber(22)
                    }
                    .accessibilityElement(children: .combine)
                }

                Button(action: advance) {
                    CandyLabel(title: next == nil ? "See results" : "Continue", symbol: "play.fill")
                }
                .buttonStyle(CandyButtonStyle(variant: .amber, size: .large))
                .padding(.top, 2)

                // The overlay has ALWAYS been tap-to-skip; say so every time.
                Text(next == nil ? "Tap to see your results" : "Tap to continue")
                    .font(Brand.font(11, .black)).tracking(0.8)
                    .foregroundStyle(FinishInk.secondary)
            }
            .padding(20)
            .frame(maxWidth: 380)
            .tintedCard(accent: Self.amber, bar: [Color(hex: 0xFFC56B), Color(hex: 0xF97316)], radius: 24, barHeight: 10,
                        tint: 0.12, line: 0.32)
            .padding(.horizontal, 22)
            // §AU3: one smooth entrance — the card rises + settles (transform/opacity only).
            .scaleEffect(appeared || still ? 1 : 0.94)
            .offset(y: appeared || still ? 0 : 18)
            .animation(still ? nil : Motion.spring, value: appeared)
        }
        .onAppear {
            appeared = true
            if next != nil { Feedback.found() }   // §U: a Gauntlet stage cleared — notify @0.7 · light
            guard !still else { return }
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { pulse = true }
        }
        .contentShape(Rectangle())
        .onTapGesture { advance() }
        // §AU3: Enter / Return skips too (the board's keys are off under the card).
        .hardwareKeyboard { key in
            guard key == .enter || key == .space else { return false }
            advance()
            return true
        }
        // The screen turns the board's keys off under the card; this card's own
        // Enter handler is the exception.
        .environment(\.hardwareKeyboardEnabled, true)
        .task {
            // §AU3: the card stays up at least 5 s, then auto-advances (between
            // stages AND after the final one — the win only records on advance, so
            // it MUST still advance; leaving first dropped the daily result). Founder:
            // VS Gauntlet too — 5 s like solo, with the player's race clock paused.
            let nanos: UInt64 = 5_000_000_000
            try? await Task.sleep(nanoseconds: nanos)
            advance()
        }
    }

    private func advance() {
        guard !advanced else { return }
        advanced = true
        onAdvance()
    }

    /// §P: the run's progress dots — done stages filled amber, the upcoming one
    /// pulsing (Reduce Motion: still), the rest soft.
    private func dots(total: Int, upcoming: Int) -> some View {
        HStack(spacing: 8) {
            ForEach(1...max(1, total), id: \.self) { i in
                let done = i < upcoming
                let current = i == upcoming
                Circle()
                    .fill(done || current ? Self.amber : Self.amber.wash(0.22))
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(Color(hex: 0xB0650B).opacity(done ? 0.5 : 0.25), lineWidth: 1))
                    .scaleEffect(current && pulse && !still ? 1.3 : 1)
                    .opacity(current && pulse && !still ? 0.7 : 1)
            }
        }
        .accessibilityHidden(true)
    }
}
