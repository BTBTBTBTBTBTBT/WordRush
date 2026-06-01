import SwiftUI
import WordociousCore

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var comingSoon: String?
    @State private var showHelp = false

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 12) {
                        if completions.allDone { banner }
                        WordOfTheDayView()
                        sectionHeader
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(homeModes) { mode in
                                card(mode)
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 4)
                    .padding(.bottom, 16)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Wordmark(size: 22) }
                ToolbarItem(placement: .topBarTrailing) { headerPills }
            }
            .navigationBarTitleDisplayMode(.inline)
            .task(id: auth.isAuthenticated) { await completions.load() }
            .alert("Coming soon", isPresented: Binding(get: { comingSoon != nil }, set: { if !$0 { comingSoon = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("\(comingSoon ?? "This mode") is coming to the iOS app soon.")
            }
            .sheet(isPresented: $showHelp) {
                HelpView().presentationDetents([.large])
            }
        }
    }

    // MARK: - Header pills (help / streak / shield)

    private var headerPills: some View {
        HStack(spacing: 8) {
            Button { showHelp = true } label: {
                Image(systemName: "questionmark")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.textMuted)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Theme.surfaceAlt))
                    .overlay(Circle().stroke(Theme.borderAlt, lineWidth: 1.5))
            }
            if let p = auth.profile, p.dailyLoginStreak > 0 {
                pill(icon: .asset("flame"), iconColor: Color(hex: 0xF97316),
                     text: "\(p.dailyLoginStreak)", textColor: Color(hex: 0x92400E),
                     bg: LinearGradient(colors: [Color(hex: 0xFFFBEB), Color(hex: 0xFFF7ED)], startPoint: .topLeading, endPoint: .bottomTrailing),
                     border: Color(hex: 0xFDE68A))
            }
            if let p = auth.profile {
                pill(icon: .asset("shield"), iconColor: Color(hex: 0x8B5CF6),
                     text: "\(p.streakShields)", textColor: Color(hex: 0x6D28D9),
                     bg: LinearGradient(colors: [Theme.surfaceHover, Theme.surfaceHover], startPoint: .top, endPoint: .bottom),
                     border: Color(hex: 0xC4B5FD))
            }
        }
    }

    private func pill(icon: ModeIconKind, iconColor: Color, text: String, textColor: Color,
                      bg: LinearGradient, border: Color) -> some View {
        HStack(spacing: 4) {
            if case .asset(let name) = icon {
                Image(name).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 13, height: 13).foregroundStyle(iconColor)
            }
            Text(text).font(Brand.font(13, .heavy)).foregroundStyle(textColor)
        }
        .padding(.horizontal, 9).padding(.vertical, 5)
        .background(Capsule().fill(bg)).overlay(Capsule().stroke(border, lineWidth: 1.5))
    }

    // MARK: - Banner

    private var banner: some View {
        let flawless = completions.flawless
        return VStack(spacing: 3) {
            Text(flawless ? "🏆 Flawless Victory! 🏆" : "🎉 Daily Sweep!")
                .font(Brand.font(19, .black)).foregroundStyle(Color(hex: 0xB45309))
            Text(flawless ? "All \(DailyCompletionsStore.totalDailyModes) dailies won today · +600 XP earned"
                          : "All \(DailyCompletionsStore.totalDailyModes) dailies completed · +200 XP earned")
                .font(Brand.font(13, .bold)).foregroundStyle(Color(hex: 0xB45309))
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Text("Next puzzles in \(countdown())").font(Brand.font(12, .bold))
                    .foregroundStyle(Color(hex: 0xB45309).opacity(0.8))
            }
        }
        .padding(.vertical, 16).frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(
            LinearGradient(colors: [Color(hex: 0xFEF3C7), Color(hex: 0xFDE68A)], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xF59E0B), lineWidth: 2))
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

    @ViewBuilder
    private func card(_ mode: HomeMode) -> some View {
        if let gameMode = mode.mode {
            NavigationLink {
                GameScreen(seed: DailySeed.today(mode: gameMode), mode: gameMode, title: mode.title)
            } label: { cardBody(mode) }
            .buttonStyle(.plain)
        } else if mode.id == "propernoundle" {
            NavigationLink { ProperNoundleView() } label: { cardBody(mode) }
                .buttonStyle(.plain)
        } else if mode.id == "vs" {
            NavigationLink { VSLobbyView() } label: { cardBody(mode) }
                .buttonStyle(.plain)
        } else {
            Button { comingSoon = mode.title } label: { cardBody(mode) }
                .buttonStyle(.plain)
        }
    }

    private func cardBody(_ mode: HomeMode) -> some View {
        let done = mode.dbKey.flatMap { completions.byMode[$0] }
        let isDone = done != nil
        return VStack(alignment: .leading, spacing: 0) {
            RoundedRectangle(cornerRadius: 2).fill(mode.accent).frame(height: 3)
                .padding(.bottom, 10)
            HStack(alignment: .top) {
                ModeIconView(icon: mode.icon, accent: mode.accent, box: 40)
                Spacer()
                if isDone { winBadge }
            }
            Text(mode.title).font(Brand.font(17, .black)).foregroundStyle(Theme.textPrimary)
                .padding(.top, 8)
            Text(resultText(mode, done)).font(Brand.font(12, .bold)).foregroundStyle(Theme.textSecondary)
                .padding(.top, 1)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(isDone ? mode.accent.opacity(0.06) : Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(isDone ? mode.accent.opacity(0.4) : Theme.border, lineWidth: 1.5))
    }

    private func resultText(_ mode: HomeMode, _ done: DailyCompletion?) -> String {
        guard let done else { return mode.desc }
        return "\(done.guessCount) guesses · \(formatShortTime(Int(done.timeSeconds)))"
    }

    private var winBadge: some View {
        Text("W").font(Brand.font(13, .black)).foregroundStyle(.white)
            .frame(width: 26, height: 26)
            .background(RoundedRectangle(cornerRadius: 7).fill(Color(hex: 0x22C55E)))
    }
}
