import SwiftUI
import WordociousCore

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var comingSoon: String?
    @State private var limitModal: HomeMode?     // free user tapped a completed daily
    @State private var solvedMode: HomeMode?      // "View Solved Puzzle"
    @State private var showProSheet = false

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
                            if completions.allDone { banner }
                            WordOfTheDayView()
                            sectionHeader
                            LazyVGrid(columns: columns, spacing: 8) {
                                ForEach(homeModes) { mode in
                                    card(mode)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 4)
                        .padding(.bottom, 16)
                    }
                }

                if let m = limitModal {
                    ModeLimitModal(mode: m,
                                   onClose: { limitModal = nil },
                                   onUpgrade: { limitModal = nil; showProSheet = true },
                                   onViewSolved: { let mode = m; limitModal = nil; solvedMode = mode })
                        .transition(.opacity)
                }
            }
            .animation(Theme.animation(.easeInOut(duration: 0.15)), value: limitModal != nil)
            .sheet(isPresented: $showProSheet) { ProView() }
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
            .task(id: auth.isAuthenticated) { await completions.load() }
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
        return VStack(spacing: 3) {
            HStack(spacing: 8) {
                Image(systemName: flawless ? "trophy.fill" : "sparkles")
                    .font(.system(size: flawless ? 20 : 16)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0x7C3AED))
                Text(flawless ? "Flawless Victory!" : "Daily Sweep!")
                    .font(Brand.font(flawless ? 18 : 16, .black))
                    .foregroundStyle(LinearGradient(colors: titleGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: flawless ? "trophy.fill" : "sparkles")
                    .font(.system(size: flawless ? 20 : 16)).foregroundStyle(flawless ? Color(hex: 0xB45309) : Color(hex: 0xEC4899))
            }
            Text(flawless ? "All \(DailyCompletionsStore.totalDailyModes) dailies won today · +600 XP earned"
                          : "All \(DailyCompletionsStore.totalDailyModes) dailies completed · +200 XP earned")
                .font(Brand.font(11, .heavy)).foregroundStyle(subtitleC)
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Text("Next puzzles in \(countdown())").font(Brand.font(10, .bold))
                    .foregroundStyle(subtitleC.opacity(0.75))
            }
        }
        .padding(.vertical, 10).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 14).fill(
            LinearGradient(colors: bg, startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(borderC, lineWidth: 1.5))
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

    // MARK: - Mode card

    /// Freemium lock: a free user who has already played today's daily for this
    /// mode can't replay it (Pro unlocks unlimited replays). Mirrors the web's
    /// `isLocked = !isPro && (isDailyDone || hasPlayedModeToday)`. VS has its own
    /// daily-VS gating in the lobby, so it's never locked here.
    private func isLocked(_ mode: HomeMode) -> Bool {
        guard !auth.isProActive, mode.id != "vs", let key = mode.dbKey else { return false }
        return completions.byMode[key] != nil
    }

    @ViewBuilder
    private func card(_ mode: HomeMode) -> some View {
        let locked = isLocked(mode)
        if locked {
            Button { limitModal = mode } label: { cardBody(mode, locked: true) }
                .buttonStyle(.plain)
        } else if let gameMode = mode.mode {
            NavigationLink {
                GameScreen(seed: DailySeed.today(mode: gameMode), mode: gameMode, title: mode.title)
            } label: { cardBody(mode, locked: false) }
            .buttonStyle(.plain)
        } else if mode.id == "propernoundle" {
            NavigationLink { ProperNoundleView() } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
        } else if mode.id == "vs" {
            NavigationLink { VSLobbyView() } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
        } else {
            Button { comingSoon = mode.title } label: { cardBody(mode, locked: false) }
                .buttonStyle(.plain)
        }
    }

    private func cardBody(_ mode: HomeMode, locked: Bool) -> some View {
        let done = mode.dbKey.flatMap { completions.byMode[$0] }
        let isDone = done != nil
        let lockGray = Color(hex: 0xD1D5DB)
        let barColors = locked ? [lockGray, lockGray] : [mode.accent, mode.accent.opacity(0.53)]
        let borderC = locked ? lockGray : (isDone ? mode.accent.opacity(0.4) : Theme.border)
        return VStack(spacing: 0) {
            // Full-width top accent bar (flush, gradient → accent@0x88; gray when locked).
            LinearGradient(colors: barColors, startPoint: .leading, endPoint: .trailing)
                .frame(height: 4)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    ModeIconView(icon: mode.icon, accent: mode.accent, box: 40)
                    Spacer()
                    if let done { winBadge(won: done.completed) }
                }
                Text(mode.title).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                    .padding(.top, 8)
                Text(resultText(mode, done)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
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
            .background(RoundedRectangle(cornerRadius: 6).fill(Color(hex: won ? 0x16A34A : 0xDC2626)))
    }
}

/// Freemium "Played Today" lock modal — ports modals/mode-limit-modal.tsx:
/// lock icon, "{mode} — Played Today", upsell copy, play-again countdown,
/// Upgrade to Pro (amber btn-3d), and View Solved Puzzle.
struct ModeLimitModal: View {
    let mode: HomeMode
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
                Text("You've used your free play of \(mode.title) for today. Upgrade to Pro for unlimited replays and ad-free gameplay across all 8 modes.")
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

                Button("View Solved Puzzle", action: onViewSolved)
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.primary)
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
