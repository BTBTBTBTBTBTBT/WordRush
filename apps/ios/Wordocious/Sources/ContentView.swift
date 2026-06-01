import SwiftUI
import WordociousCore

/// App-wide auth gate — mirrors apps/web/components/auth/auth-gate.tsx.
/// The web has ZERO unauthenticated gameplay: a signed-out visitor sees the
/// login screen, never the app. We replicate that here.
///   loading  → branded skeleton matching the home layout
///   no user  → AuthView (login)
///   signed-in → RootTabView (the app)
struct ContentView: View {
    @EnvironmentObject private var auth: AuthService

    var body: some View {
        if auth.isLoading {
            LoadingSkeleton()
        } else if !auth.isAuthenticated {
            AuthView(showsCloseButton: false)
        } else {
            RootTabView()
        }
    }
}

/// Seamless loading screen — matches the real app layout so the transition
/// from loading → authenticated is invisible. Ports the AuthGate `loading`
/// branch (header bar + hero banner + section header + 2×2 card grid, pulsing).
private struct LoadingSkeleton: View {
    @State private var pulse = false

    var body: some View {
        VStack(spacing: 0) {
            // Mimic AppHeader (52px, bottom border, surface bg) with the wordmark.
            HStack {
                Wordmark(size: 16)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Theme.surface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.border).frame(height: 1.5)
            }

            // Skeleton placeholders matching the home page layout.
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 14).fill(Theme.border).frame(height: 68)        // hero banner
                RoundedRectangle(cornerRadius: 6).fill(Theme.border)
                    .frame(width: 100, height: 14).padding(.top, 4)                            // section header
                let cols = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
                LazyVGrid(columns: cols, spacing: 8) {
                    ForEach(0..<4, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 14).fill(Theme.border).frame(height: 88)  // mode cards
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
            .opacity(pulse ? 0.25 : 0.45)
            .animation(Theme.animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)), value: pulse)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        .onAppear { pulse = true }
    }
}

/// Computes today's daily seed using the player's LOCAL date, matching the
/// web app's generateDailySeed(getTodayLocal(), mode) — puzzles reset at
/// local midnight (and daily_results.day is local too).
enum DailySeed {
    static func today(mode: GameMode) -> String {
        generateDailySeed(date: LeaderboardService.todayLocal(), gameMode: mode.rawValue)
    }
}
