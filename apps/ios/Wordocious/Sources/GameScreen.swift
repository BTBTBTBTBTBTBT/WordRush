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
        let mini = vm.isMultiBoard
        let dur = mini ? 0.3 : 0.5
        let stagger = mini ? 0.08 : 0.15
        return dur + Double(max(0, vm.wordLength - 1)) * stagger
    }

    var body: some View {
        GeometryReader { root in
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()

            VStack(spacing: 0) {
                // Gauntlet finishes (win OR loss) show the dedicated animated
                // results screen — same component as the re-entry review.
                if vm.isFinished && vm.isGauntlet, let g = vm.state.gauntlet {
                    GauntletResultsView(progress: g, won: vm.status == .won, mode: mode, isDaily: vm.isDaily,
                                        elapsedMsFallback: vm.elapsedSeconds * 1000,
                                        onHome: { dismiss() }, onShare: { share() },
                                        onPlayAgain: playAgainAction)
                // Other modes hold the in-play board until the winning row's flip completes.
                } else if vm.isFinished && revealComplete {
                    ScrollView {
                        VStack(spacing: 8) {
                            FinishedStatsHeader(
                                mode: mode, won: vm.status == .won,
                                guessCount: vm.rowsUsed, maxGuesses: vm.maxGuesses,
                                timeSeconds: vm.elapsedSeconds,
                                boardsSolved: vm.boards.filter { $0.status == .won }.count,
                                totalBoards: vm.boardCount,
                                onHome: { dismiss() }, onShare: { share() },
                                onPlayAgain: playAgainAction)
                            if vm.isDaily { DailyRankBadge(gameMode: mode) }
                            if vm.boardCount > 1 {
                                // Compact uniform recap (completed-daily-board
                                // sizing) — the in-play BoardLayout rendered
                                // 2-column modes (Quad/Deliverance) zoomed huge
                                // post-game while Octo's 4 columns looked right.
                                let tile = CompletedBoardLayout.tileSize(boardCount: vm.boardCount, wordLen: vm.wordLength)
                                let cols = CompletedBoardLayout.cols(vm.boardCount)
                                let rowCount = vm.boards.map(\.maxGuesses).max() ?? vm.maxGuesses
                                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: CompletedBoardLayout.gridSpacing), count: cols),
                                          spacing: CompletedBoardLayout.gridSpacing) {
                                    ForEach(vm.boards.indices, id: \.self) { i in
                                        CompletedMiniBoardView(board: vm.boards[i], tileSize: tile, rowCount: rowCount)
                                    }
                                }
                                .frame(maxWidth: CompletedBoardLayout.maxWidth(vm.boardCount))
                            } else {
                                BoardLayout(vm: vm, availableWidth: root.size.width - 20)
                            }
                            ScoreBreakdownView(gameMode: mode.rawValue, completed: vm.status == .won,
                                               guessCount: vm.rowsUsed, timeSeconds: vm.elapsedSeconds,
                                               boardsSolved: vm.boards.filter { $0.status == .won }.count,
                                               totalBoards: vm.boardCount, hintsUsed: vm.hintsUsed,
                                               stagesCompleted: vm.stagesCompletedForScore,
                                               bestCorrectLetters: vm.bestCorrectLettersForScore)
                            if vm.boardCount == 1 {
                                DefinitionCard(solution: vm.boards[0].solution, showWord: false)
                            }
                        }
                        .padding(.bottom, 16)
                    }
                } else {
                    header
                    // Greedy area between header and keyboard: size tiles to fit.
                    GeometryReader { geo in
                        BoardLayout(vm: vm, availableWidth: geo.size.width, fitHeight: geo.size.height)
                    }
                    .padding(.vertical, 6)
                    if vm.hasHints && vm.status == .playing { classicHintButtons }
                    // Stage-cleared shows the full-screen StageTransition overlay
                    // (below); the keyboard just hides while it's up.
                    if !vm.stageCleared { KeyboardView(vm: vm).padding(.bottom, 6) }
                }
            }
            .padding(.horizontal, 10)

            // Persistent corner Home button (matches the web GameHomeButton),
            // visible during play and post-game.
            Button { dismiss() } label: {
                Image(systemName: "house.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(ModeStyle.accent(mode))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.surface))
                    .overlay(Circle().stroke(ModeStyle.accent(mode), lineWidth: 2))
                    .shadow(color: ModeStyle.accent(mode).opacity(0.2), radius: 0, x: 0, y: 2)
                    .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, 8).padding(.leading, 8)

            // Help "?" button (top-right) — opens this mode's strategy guide.
            // Matches the Home button's size/aesthetic; shifts left of the
            // Gauntlet sound toggle so the two don't overlap.
            Button { showGuide = true } label: {
                Image(systemName: "questionmark")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(ModeStyle.accent(mode))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Theme.surface))
                    .overlay(Circle().stroke(ModeStyle.accent(mode), lineWidth: 2))
                    .shadow(color: ModeStyle.accent(mode).opacity(0.2), radius: 0, x: 0, y: 2)
                    .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.top, 8).padding(.trailing, vm.isGauntlet ? 60 : 8)
            .sheet(isPresented: $showGuide) { GuideSheet(mode: mode) }

            // Sound toggle (top-right) — mirrors the web SoundToggle on the
            // Gauntlet screen. Reads/writes the same `pref-sound` SoundManager key.
            if vm.isGauntlet {
                GauntletSoundToggle(accent: ModeStyle.accent(mode))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(.top, 8).padding(.trailing, 8)
            }

            if let toast = vm.toast { toastView(toast) }

            // XP toast (after recording) + one-time victory/game-over celebration.
            if let xp = vm.xpResult {
                XpToastView(result: xp) { vm.xpResult = nil }
            }
            if showVictory {
                VictoryOverlay(
                    won: vm.status == .won,
                    guesses: vm.rowsUsed, maxGuesses: vm.maxGuesses, timeSeconds: vm.elapsedSeconds,
                    boardsSolved: vm.boards.filter { $0.status == .won }.count, totalBoards: vm.boardCount,
                    solution: vm.boardCount == 1 ? vm.boards.first?.solution : nil,
                    solutions: vm.boardCount > 1 ? vm.boards.map(\.solution) : [],
                    onDismiss: { withAnimation(Theme.animation(.easeOut(duration: 0.25))) { showVictory = false; revealComplete = true } })
                .transition(.scale(scale: 0.8).combined(with: .opacity))   // web fade-in-scale 0.8→1.0
            }
            // Gauntlet stage-transition overlay (auto-advances after 2.5s, or tap).
            if vm.stageCleared {
                StageTransitionOverlay(completedName: vm.gauntletStageName,
                                       next: vm.gauntletNextStageInfo,
                                       onAdvance: { vm.nextStage() })
                .transition(.opacity)
            }
        }
        }
        // Custom on-screen KeyboardView only — never let a lingering SYSTEM
        // keyboard inset (e.g. from the share sheet) squeeze the board layout.
        .ignoresSafeArea(.keyboard)
        .navigationBarBackButtonHidden(true)
        .navigationBarTitleDisplayMode(.inline)
        .hidesBottomNav()
        // Left-edge swipe → back to Home (parity with the web back gesture).
        .swipeToGoBack { dismiss() }
        // Safety net: if the player leaves a fully-cleared Gauntlet run before
        // the final overlay auto-advances, record the win on the way out so the
        // daily result (and a Flawless sweep) isn't lost.
        .onDisappear { vm.finalizeGauntletIfCleared() }
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .onChange(of: vm.status) { newValue in
            // Haptics fire instantly; the jingle waits for the overlay (below).
            if newValue == .won { Haptics.success() }
            else if newValue == .lost { Haptics.error() }
            // Celebrate the moment of finishing. Gauntlet only celebrates a WON
            // run (web parity: a lost run goes straight to the results screen,
            // no overlay and no game-over sound). Wait out the final row's flip,
            // then fade in the victory overlay so the winning word animates first.
            if (newValue == .won || newValue == .lost) && (!vm.isGauntlet || newValue == .won) {
                let delay = Theme.reduceMotion ? 0 : revealDuration + 0.2
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
                    withAnimation(Theme.animation(.easeOut(duration: 0.3))) {
                        showVictory = true
                    }
                    // High-point review ask: win + streak ≥ 3, once per version,
                    // delayed past the confetti (no-ops otherwise).
                    if newValue == .won { ReviewPrompter.maybeAskAfterWin() }
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

    private var standardHeader: some View {
        VStack(spacing: 4) {
            Text(ModeStyle.title(mode))
                .font(Brand.font(28, .black))
                .foregroundStyle(LinearGradient(colors: ModeStyle.gradient(mode), startPoint: .leading, endPoint: .trailing))
            HStack(spacing: 12) {
                Text(progressLabel).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                if !vm.stageCleared {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 3) {
                            Image(systemName: "clock").font(.system(size: 11)).foregroundStyle(Color(hex: 0x60A5FA))
                            Text(timeString).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
                        }
                    }
                }
            }
        }
        .padding(.top, 6)
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
            if !vm.stageCleared {
                HStack(spacing: 12) {
                    if vm.boardCount > 1 {
                        let solved = vm.boards.filter { $0.status == .won }.count
                        HStack(spacing: 3) {
                            Image(systemName: "trophy.fill").font(.system(size: 10)).foregroundStyle(Color(hex: 0xD97706))
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
        let bg = completed ? Color(hex: 0xEDE9FE) : active ? Color(hex: 0xF3E8FF) : Color(hex: 0xF9FAFB)
        let border = completed ? Color(hex: 0x8B5CF6) : active ? Color(hex: 0xC084FC) : Color(hex: 0xE5E7EB)
        let fg = completed ? Color(hex: 0x6D28D9) : active ? Color(hex: 0x9333EA) : Color(hex: 0x9CA3AF)
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

    /// Pulsing purple halo on the active gauntlet stage node — mirrors web's
    /// `gauntlet-glow` (box-shadow 3px ↔ 8px+14px, #A855F7, 2.5s ease-in-out loop).
    private struct StageGlow: ViewModifier {
        let active: Bool
        @State private var on = false
        private let glow = Color(hex: 0xA855F7)
        func body(content: Content) -> some View {
            content
                .shadow(color: active ? glow.opacity(on ? 0.6 : 0.3) : .clear, radius: active ? (on ? 7 : 3) : 0)
                .shadow(color: active && on ? glow.opacity(0.25) : .clear, radius: active && on ? 12 : 0)
                .onAppear {
                    // Theme.reduceMotion covers BOTH the in-app toggle and the OS
                    // setting (the old env-only check ignored the in-app pref).
                    guard !Theme.reduceMotion else { return }
                    withAnimation(.easeInOut(duration: 1.25).repeatForever(autoreverses: true)) { on = true }
                }
        }
    }

    private func gauntletConnectorColor(_ i: Int) -> Color {
        if vm.gauntletCompletedIndices.contains(i) { return Color(hex: 0x8B5CF6) }
        if i == vm.gauntletCurrentIndex { return Color(hex: 0xD8B4FE) }
        return Color(hex: 0xE5E7EB)
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

    /// Six = cyan, Seven = lime (web mode accents).
    private var hintAccent: Color { mode == .duel7 ? Color(hex: 0x84CC16) : Color(hex: 0x06B6D4) }

    private var classicHintButtons: some View {
        HStack(spacing: 12) {
            hintPill(
                label: vm.vowelUsed ? (vm.vowelRevealed == "—" ? "No vowels left" : "Vowel: \(vm.vowelRevealed ?? "")") : "💡 Vowel",
                used: vm.vowelUsed) { Haptics.success(); vm.revealVowel() }
            hintPill(
                label: vm.consonantUsed ? (vm.consonantRevealed == "—" ? "No consonants left" : "Consonant: \(vm.consonantRevealed ?? "")") : "💡 Consonant",
                used: vm.consonantUsed) { Haptics.success(); vm.revealConsonant() }
        }
        .padding(.horizontal, 16).padding(.bottom, 4)
    }

    private func hintPill(label: String, used: Bool, action: @escaping () -> Void) -> some View {
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

    // MARK: Post-game share

    private func share() {
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
        ShareService.share(kind: kind, mode: mode, modeLabel: ModeStyle.shareLabel(mode), accent: ModeStyle.accent(mode),
                           won: vm.status == .won, guesses: shareGuesses, maxGuesses: shareMax,
                           timeSeconds: vm.elapsedSeconds)
    }

    // MARK: Gauntlet stage-clear

    private var stageClearedBanner: some View {
        VStack(spacing: 10) {
            Text(vm.isLastStage ? "🏆 Final stage cleared!" : "✅ Stage cleared!")
                .font(Brand.headline(18)).foregroundStyle(Theme.textPrimary)
            Button(vm.isLastStage ? "Finish Gauntlet" : "Continue") { Haptics.success(); vm.nextStage() }
                .buttonStyle(.borderedProminent).tint(Theme.primary).controlSize(.large)
        }
        .padding(.vertical, 16).frame(maxWidth: .infinity)
    }

    private func toastView(_ toast: String) -> some View {
        Text(toast).font(Brand.font(12, .bold)).foregroundStyle(.white)
            .padding(.horizontal, 12).padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 8).fill(Theme.textPrimary))
            .padding(.top, 90).frame(maxHeight: .infinity, alignment: .top).transition(.opacity)
    }
}

/// Gauntlet stage-transition overlay — 1:1 with web stage-transition.tsx.
/// Auto-advances to the next stage after 2.5s (or on tap).
// Non-private so the VS Gauntlet screen can reuse the exact same auto-advancing
// stage-transition overlay (parity with the solo run).
struct StageTransitionOverlay: View {
    let completedName: String
    let next: (name: String, boards: Int, guesses: Int, sequential: Bool, prefill: Bool)?
    let onAdvance: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.8).ignoresSafeArea()
            VStack(spacing: 26) {
                ZStack {
                    Circle().fill(Color(hex: 0x8B5CF6).opacity(0.3)).frame(width: 80, height: 80)
                        .overlay(Circle().stroke(Color(hex: 0xA78BFA), lineWidth: 4))
                    Image(systemName: "checkmark").font(.system(size: 34, weight: .bold)).foregroundStyle(Color(hex: 0xC4B5FD))
                }
                VStack(spacing: 4) {
                    Text("STAGE COMPLETE").font(Brand.font(12, .black)).tracking(1.2).foregroundStyle(Color(hex: 0xA78BFA))
                    Text(completedName).font(Brand.font(18, .bold)).foregroundStyle(.white.opacity(0.6))
                }
                // Final stage (no next): wait for a tap so the player can take in
                // the cleared run before the results screen, instead of the 2.5s
                // auto-advance used between stages.
                if next == nil {
                    Text("Tap to see your results")
                        .font(Brand.font(13, .black)).foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 16).padding(.vertical, 9)
                        .background(Capsule().fill(Color(hex: 0x8B5CF6).opacity(0.35)))
                        .overlay(Capsule().stroke(Color(hex: 0xA78BFA), lineWidth: 1.5))
                }
                if let n = next {
                    VStack(spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: "bolt.fill").font(.system(size: 12)).foregroundStyle(Color(hex: 0xFACC15))
                            Text("NEXT UP").font(Brand.font(12, .black)).tracking(1.2).foregroundStyle(Color(hex: 0xFACC15))
                            Image(systemName: "bolt.fill").font(.system(size: 12)).foregroundStyle(Color(hex: 0xFACC15))
                        }
                        Text(n.name).font(Brand.font(30, .black))
                            .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFACC15), Color(hex: 0xF472B6), Color(hex: 0xC084FC)],
                                                            startPoint: .leading, endPoint: .trailing))
                        Text("\(n.boards) board\(n.boards > 1 ? "s" : "") · \(n.guesses) guesses\(n.sequential ? " · sequential" : "")\(n.prefill ? " · pre-filled clues" : "")")
                            .font(Brand.caption(12)).foregroundStyle(.white.opacity(0.4))
                    }
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { onAdvance() }
        .task {
            // Between stages: auto-advance after 2.5s (web StageTransition).
            // After the FINAL stage: a longer 4s pause so the cleared run isn't
            // rushed — but it MUST still auto-advance (was: wait forever for a
            // tap). The win only records on advance, so leaving the screen first
            // dropped the daily result → a real Flawless showed as an 8/9 Sweep.
            try? await Task.sleep(nanoseconds: next == nil ? 4_000_000_000 : 2_500_000_000)
            onAdvance()
        }
    }
}

/// Corner sound toggle (mirrors the web SoundToggle). Persists to the same
/// `pref-sound` UserDefaults key SoundManager reads, so muting here also
/// silences win/loss jingles.
private struct GauntletSoundToggle: View {
    let accent: Color
    @AppStorage("pref-sound") private var soundOn = true
    var body: some View {
        Button { soundOn.toggle() } label: {
            Image(systemName: soundOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                .font(.system(size: 18))
                .foregroundStyle(accent)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.surface))
                .overlay(Circle().stroke(accent, lineWidth: 2))
                .shadow(color: accent.opacity(0.2), radius: 0, x: 0, y: 2)
                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }
}
