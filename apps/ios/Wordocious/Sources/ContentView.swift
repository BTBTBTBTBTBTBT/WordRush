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
    /// FINISH_SPEC §AO: the first-run flow picks the username itself; the old
    /// Welcome cover only shows once that flow is done (or was never needed).
    @AppStorage(Onboarding.flagKey) private var onboardedV2 = false

    var body: some View {
        // Show the app immediately when signed in/guest — OR optimistically while
        // the session is still restoring on launch IF the last run was signed in
        // (the common case), so returning players land straight on the home
        // instead of the loading skeleton. The home renders from cached/static
        // data and fills in as the session + profile load. If the restore turns
        // out to have no session (expired), the condition drops to AuthView.
        if auth.isAuthenticated || auth.isGuest || (auth.isLoading && AuthService.hadPersistedSession) {
            RootTabView()
                // First-run onboarding (ports the web WelcomeModal): shown once
                // when a new account hasn't onboarded yet.
                .fullScreenCover(isPresented: Binding(
                    get: { auth.profile?.hasOnboarded == false && onboardedV2 },
                    set: { _ in })) {
                    WelcomeView()
                }
        } else if auth.isLoading {
            LoadingSkeleton()
        } else {
            AuthView(showsCloseButton: false)
        }
    }
}

/// Seamless loading screen — matches the real app layout so the transition
/// from loading → authenticated is invisible. Ports the AuthGate `loading`
/// branch (header bar + hero banner + section header + 2×2 card grid, pulsing).
private struct LoadingSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            // Mimic the header row with the wordmark (FINISH_SPEC §A1: no white
            // header bar — it sits on the wallpaper like the real header).
            HStack {
                Wordmark(size: 16)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)

            // §G5: tinted shimmer placeholders matching the home page layout.
            VStack(alignment: .leading, spacing: 8) {
                SkeletonBlock(height: 68, cornerRadius: 14, accent: Color(hex: 0x7C3AED))           // hero banner
                SkeletonBlock(height: 14, width: 100, cornerRadius: 6, accent: Color(hex: 0x8B5CF6))
                    .padding(.top, 4)                                                                // section header
                let cols = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
                let accents: [UInt] = [0x7C3AED, 0xEC4899, 0x3B82F6, 0xF59E0B]
                LazyVGrid(columns: cols, spacing: 8) {
                    ForEach(0..<4, id: \.self) { i in
                        SkeletonBlock(height: 88, cornerRadius: 14, accent: Color(hex: accents[i]))  // mode cards
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pageBackground(.home)
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
