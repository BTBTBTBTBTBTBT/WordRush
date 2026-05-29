import SwiftUI
import WordociousCore

struct ContentView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var showAuth = false

    init() {
        DictionaryLoader.ensureInitialized()
    }

    var body: some View {
        NavigationStack {
            GameScreen(
                seed: DailySeed.today(mode: .duel),
                mode: .duel,
                title: "Wordocious"
            )
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        if auth.isAuthenticated {
                            Task { await auth.signOut() }
                        } else {
                            showAuth = true
                        }
                    } label: {
                        if auth.isAuthenticated {
                            Label(auth.isProActive ? "Pro" : "Account",
                                  systemImage: auth.isProActive ? "crown.fill" : "person.crop.circle")
                        } else {
                            Image(systemName: "person.crop.circle")
                        }
                    }
                    .tint(auth.isProActive ? Theme.present : Theme.textPrimary)
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $showAuth) {
            AuthView()
        }
    }
}

/// Computes today's daily seed in UTC, matching the web app's
/// generateDailySeed(date, mode) convention.
enum DailySeed {
    static func today(mode: GameMode) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        let date = f.string(from: Date())
        return generateDailySeed(date: date, gameMode: mode.rawValue)
    }
}
