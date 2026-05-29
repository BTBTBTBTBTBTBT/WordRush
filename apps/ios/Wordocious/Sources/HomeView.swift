import SwiftUI
import WordociousCore

struct ModeInfo: Identifiable {
    let id = UUID()
    let mode: GameMode
    let title: String
    let subtitle: String
    let symbol: String
}

let soloModes: [ModeInfo] = [
    ModeInfo(mode: .duel,          title: "Classic",       subtitle: "One word, 6 guesses",      symbol: "square.grid.3x3"),
    ModeInfo(mode: .duel6,         title: "Six",           subtitle: "6-letter word",            symbol: "6.square"),
    ModeInfo(mode: .duel7,         title: "Seven",         subtitle: "7-letter word",            symbol: "7.square"),
    ModeInfo(mode: .quordle,       title: "QuadWord",      subtitle: "4 boards at once",         symbol: "square.grid.2x2"),
    ModeInfo(mode: .octordle,      title: "OctoWord",      subtitle: "8 boards at once",         symbol: "square.grid.4x3.fill"),
    ModeInfo(mode: .sequence,      title: "Sequence",      subtitle: "4 boards in order",        symbol: "list.number"),
    ModeInfo(mode: .rescue,        title: "Deliverance",   subtitle: "4 boards, head start",     symbol: "lifepreserver"),
]

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var showAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(soloModes) { info in
                            NavigationLink {
                                GameScreen(
                                    seed: DailySeed.today(mode: info.mode),
                                    mode: info.mode,
                                    title: info.title
                                )
                            } label: {
                                modeCard(info)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Wordmark(size: 20)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if auth.profile != nil, auth.profile!.dailyLoginStreak > 0 {
                        streakPill(auth.profile!.dailyLoginStreak)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showAuth) { AuthView() }
        }
    }

    private func modeCard(_ info: ModeInfo) -> some View {
        HStack(spacing: 14) {
            Image(systemName: info.symbol)
                .font(.title2)
                .foregroundStyle(Theme.primary)
                .frame(width: 44, height: 44)
                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surfaceAlt))
            VStack(alignment: .leading, spacing: 2) {
                Text(info.title).font(Brand.headline(17)).foregroundStyle(Theme.textPrimary)
                Text(info.subtitle).font(Brand.body(14)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Theme.textMuted)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    /// Gold flame streak pill, matching the web app-header.
    private func streakPill(_ streak: Int) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill").font(.system(size: 13)).foregroundStyle(Color(hex: 0xF97316))
            Text("\(streak)").font(Brand.caption(14)).foregroundStyle(Color(hex: 0x92400E))
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(
            Capsule().fill(LinearGradient(colors: [Color(hex: 0xFFFBEB), Color(hex: 0xFFF7ED)],
                                          startPoint: .topLeading, endPoint: .bottomTrailing))
        )
        .overlay(Capsule().stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))
    }
}
