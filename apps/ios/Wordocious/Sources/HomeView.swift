import SwiftUI
import WordociousCore

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var completions = DailyCompletionsStore()
    @State private var comingSoon: String?
    @State private var showHelp = false

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()

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
                Image(systemName: "questionmark.circle")
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.textMuted)
                    .frame(width: 32, height: 32)
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
                     text: "\(p.streakShields)", textColor: Color(hex: 0x5B21B6),
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
        return VStack(spacing: 0) {
            // Full-width top accent bar (flush, gradient → accent@0x88), like web.
            LinearGradient(colors: [mode.accent, mode.accent.opacity(0.53)], startPoint: .leading, endPoint: .trailing)
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
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(isDone ? mode.accent.opacity(0.4) : Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 14))
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
