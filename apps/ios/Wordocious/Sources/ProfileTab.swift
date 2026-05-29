import SwiftUI

struct ProfileTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var showAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                content
            }
            .navigationTitle("Profile")
        }
    }

    @ViewBuilder
    private var content: some View {
        if let profile = auth.profile {
            ScrollView {
                VStack(spacing: 18) {
                    avatar(profile)
                    HStack(spacing: 6) {
                        Text(profile.username)
                            .font(Brand.title(22))
                            .foregroundStyle(Theme.textPrimary)
                        if auth.isProActive { proBadge }
                    }

                    statRow(profile)
                    medalRow(profile)

                    Button {
                        Task { await auth.signOut() }
                    } label: {
                        Text("Sign out")
                            .font(Brand.body(15))
                            .frame(maxWidth: .infinity).frame(height: 48)
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.textSecondary)
                    .padding(.top, 8)
                }
                .padding()
            }
        } else {
            VStack(spacing: 16) {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 64)).foregroundStyle(Theme.textMuted)
                Text("Sign in to track your stats")
                    .font(Brand.headline())
                    .foregroundStyle(Theme.textPrimary)
                Button("Sign in") { showAuth = true }
                    .buttonStyle(.borderedProminent).tint(Theme.primary)
            }
            .sheet(isPresented: $showAuth) { AuthView() }
        }
    }

    private func avatar(_ p: Profile) -> some View {
        Circle()
            .fill(Theme.wordmarkGradient)
            .frame(width: 84, height: 84)
            .overlay(
                Text(String(p.username.prefix(1)).uppercased())
                    .font(Brand.title(34)).foregroundStyle(.white)
            )
    }

    private var proBadge: some View {
        Text("PRO")
            .font(Brand.caption(11))
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(Theme.wordmarkGradient))
    }

    private func statRow(_ p: Profile) -> some View {
        HStack(spacing: 12) {
            statCard("Level", "\(p.level)")
            statCard("Wins", "\(p.totalWins)")
            statCard("Streak", "\(p.dailyLoginStreak)")
        }
    }

    private func medalRow(_ p: Profile) -> some View {
        HStack(spacing: 12) {
            statCard("🥇", "\(p.goldMedals)")
            statCard("🥈", "\(p.silverMedals)")
            statCard("🥉", "\(p.bronzeMedals)")
        }
    }

    private func statCard(_ label: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(Brand.title(22)).foregroundStyle(Theme.textPrimary)
            Text(label).font(Brand.caption(12)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }
}

/// Placeholder tabs — wired to Supabase reads in the next pass.
struct LeaderboardTab: View {
    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                placeholder(icon: "trophy.fill", title: "Daily Leaderboard",
                            subtitle: "Today's rankings — wiring live data next.")
            }
            .navigationTitle("Leaderboard")
        }
    }
}

struct RecordsTab: View {
    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                placeholder(icon: "crown.fill", title: "Records",
                            subtitle: "Your personal bests and achievements — coming next.")
            }
            .navigationTitle("Records")
        }
    }
}

@ViewBuilder
func placeholder(icon: String, title: String, subtitle: String) -> some View {
    VStack(spacing: 12) {
        Image(systemName: icon).font(.system(size: 56)).foregroundStyle(Theme.primary.opacity(0.7))
        Text(title).font(Brand.headline()).foregroundStyle(Theme.textPrimary)
        Text(subtitle).font(Brand.body(14)).foregroundStyle(Theme.textSecondary)
            .multilineTextAlignment(.center).padding(.horizontal, 40)
    }
}
