import SwiftUI
import WordociousCore

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

/// Live daily leaderboard from Supabase `daily_results`.
struct LeaderboardTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var mode: GameMode = .duel
    @State private var entries: [LeaderboardEntry] = []
    @State private var loading = false
    @State private var error: String?
    @State private var showAuth = false

    private let modes: [(GameMode, String)] = [
        (.duel, "Classic"), (.quordle, "Quad"), (.octordle, "Octo"), (.sequence, "Seq")
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                if !auth.isAuthenticated {
                    signedOut
                } else {
                    leaderboard
                }
            }
            .navigationTitle("Leaderboard")
        }
    }

    private var signedOut: some View {
        VStack(spacing: 16) {
            placeholder(icon: "trophy.fill", title: "Sign in to see rankings",
                        subtitle: "Daily leaderboards are available to signed-in players.")
            Button("Sign in") { showAuth = true }
                .buttonStyle(.borderedProminent).tint(Theme.primary)
        }
        .sheet(isPresented: $showAuth) { AuthView() }
    }

    private var leaderboard: some View {
        VStack(spacing: 10) {
                    Picker("Mode", selection: $mode) {
                        ForEach(modes, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    if loading {
                        Spacer(); ProgressView(); Spacer()
                    } else if let error {
                        Spacer(); placeholder(icon: "exclamationmark.triangle", title: "Couldn't load", subtitle: error); Spacer()
                    } else if entries.isEmpty {
                        Spacer(); placeholder(icon: "trophy.fill", title: "No entries yet", subtitle: "Be the first to finish today's \(mode.rawValue) puzzle."); Spacer()
                    } else {
                        List(Array(entries.enumerated()), id: \.element.id) { idx, entry in
                            row(rank: idx + 1, entry: entry)
                                .listRowBackground(Color.clear)
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
        }
        .task(id: mode) { await load() }
    }

    private func row(rank: Int, entry: LeaderboardEntry) -> some View {
        HStack(spacing: 12) {
            Text("\(rank)")
                .font(Brand.title(18))
                .foregroundStyle(rank <= 3 ? Theme.primary : Theme.textMuted)
                .frame(width: 30, alignment: .center)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.username).font(Brand.headline(16)).foregroundStyle(Theme.textPrimary)
                Text(detail(entry)).font(Brand.body(13)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Text("\(Int(entry.compositeScore))")
                .font(Brand.title(18)).foregroundStyle(Theme.textPrimary)
        }
        .padding(.vertical, 8).padding(.horizontal, 12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }

    private func detail(_ e: LeaderboardEntry) -> String {
        var parts = [e.completed ? "Win" : "Loss", "\(e.guessCount) guesses", "\(Int(e.timeSeconds))s"]
        if let h = e.hintsUsed, h > 0 { parts.append("\(h) hint\(h == 1 ? "" : "s")") }
        return parts.joined(separator: " · ")
    }

    private func load() async {
        loading = true; error = nil
        do { entries = try await LeaderboardService.fetch(gameMode: mode) }
        catch { self.error = error.localizedDescription; entries = [] }
        loading = false
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
