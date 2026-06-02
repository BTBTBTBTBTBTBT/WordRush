import SwiftUI
import WordociousCore

struct GameScreen: View {
    @StateObject private var vm: GameViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var adShown = false
    let mode: GameMode

    init(seed: String, mode: GameMode, title: String) {
        _vm = StateObject(wrappedValue: GameViewModel(seed: seed, mode: mode))
        self.mode = mode
    }

    var body: some View {
        GeometryReader { root in
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()

            VStack(spacing: 0) {
                if vm.isFinished {
                    ScrollView {
                        VStack(spacing: 8) {
                            FinishedStatsHeader(
                                mode: mode, won: vm.status == .won,
                                guessCount: vm.rowsUsed, maxGuesses: vm.maxGuesses,
                                timeSeconds: vm.elapsedSeconds,
                                boardsSolved: vm.boards.filter { $0.status == .won }.count,
                                totalBoards: vm.boardCount,
                                onHome: { dismiss() }, onShare: { share() })
                            if vm.isDaily { DailyRankBadge(gameMode: mode) }
                            BoardLayout(vm: vm, availableWidth: root.size.width - 20)
                            ScoreBreakdownView(gameMode: mode.rawValue, completed: vm.status == .won,
                                               guessCount: vm.rowsUsed, timeSeconds: vm.elapsedSeconds,
                                               boardsSolved: vm.boards.filter { $0.status == .won }.count,
                                               totalBoards: vm.boardCount)
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
                    if vm.stageCleared { stageClearedBanner } else { KeyboardView(vm: vm).padding(.bottom, 6) }
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

            if let toast = vm.toast { toastView(toast) }
        }
        }
        .navigationBarBackButtonHidden(true)
        .navigationBarTitleDisplayMode(.inline)
        .hidesBottomNav()
        .animation(Theme.animation(.easeInOut(duration: 0.2)), value: vm.toast)
        .onChange(of: vm.status) { newValue in
            if newValue == .won { Haptics.success(); SoundManager.shared.playSuccess() }
            else if newValue == .lost { Haptics.error(); SoundManager.shared.playGameOver() }
        }
        .onAppear {
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
            if phase == .active { vm.resumeTimer() } else { vm.pauseTimer() }
        }
    }

    // MARK: Header

    private var header: some View {
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

    private var timeString: String {
        let s = vm.elapsedSeconds
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }

    private var progressLabel: String {
        if let g = vm.gauntletStageLabel { return g }
        if vm.isMultiBoard {
            let solved = vm.boards.filter { $0.status == .won }.count
            return "\(solved)/\(vm.boardCount) solved"
        }
        return "\(vm.rowsUsed)/\(vm.maxGuesses) guesses"
    }

    // MARK: Post-game share

    private func share() {
        let kind: ShareCardView.Kind
        if vm.isGauntlet {
            kind = .gauntlet(stages: vm.gauntletStagesShare(),
                             stagesCompleted: vm.gauntletStagesShare().filter { $0.won }.count,
                             totalStages: vm.gauntletStagesShare().count)
        } else if vm.boardCount > 1 {
            kind = .multi(boards: vm.shareBoards(), boardsSolved: vm.boardsSolvedCount, totalBoards: vm.boardCount)
        } else {
            kind = .single(grid: vm.shareGrid())
        }
        ShareService.share(kind: kind, modeLabel: ModeStyle.shareLabel(mode), accent: ModeStyle.accent(mode),
                           won: vm.status == .won, guesses: vm.rowsUsed, maxGuesses: vm.maxGuesses,
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
