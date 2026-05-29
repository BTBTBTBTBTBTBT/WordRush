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
            .navigationTitle("Wordocious")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        if auth.isAuthenticated { Task { await auth.signOut() } }
                        else { showAuth = true }
                    } label: {
                        Image(systemName: auth.isProActive ? "crown.fill" :
                              (auth.isAuthenticated ? "person.crop.circle.fill" : "person.crop.circle"))
                            .foregroundStyle(auth.isProActive ? Theme.present : Theme.textPrimary)
                    }
                }
            }
            .sheet(isPresented: $showAuth) { AuthView() }
        }
    }

    private func modeCard(_ info: ModeInfo) -> some View {
        HStack(spacing: 14) {
            Image(systemName: info.symbol)
                .font(.title2)
                .foregroundStyle(Theme.correct)
                .frame(width: 44, height: 44)
                .background(RoundedRectangle(cornerRadius: 10).fill(.white.opacity(0.7)))
            VStack(alignment: .leading, spacing: 2) {
                Text(info.title).font(.headline).foregroundStyle(Theme.textPrimary)
                Text(info.subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.secondary)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.55)))
    }
}
