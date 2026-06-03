import SwiftUI
import WordociousCore

/// Read-only public profile — ports app/profile/[id]/page.tsx: header (avatar,
/// gradient username, level badge + XP bar), 4 overall-stat cards, a Solo/VS
/// toggle + mode picker + per-mode stats card, top words, and recent matches.
/// Reachable by tapping a leaderboard row.
struct PublicProfileView: View {
    let userId: String
    @Environment(\.dismiss) private var dismiss

    @State private var profile: Profile?
    @State private var stats: [PublicProfileService.StatRow] = []
    @State private var matches: [PublicProfileService.RecentMatch] = []
    @State private var topWords: [MatchStatsService.TopWord] = []
    @State private var loading = true
    @State private var notFound = false
    @State private var tab = "solo"                 // "solo" | "vs"
    @State private var selectedMode: GameMode = .duel

    private let pickerModes: [HomeMode] = homeModes.filter { $0.mode != nil }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if loading {
                ProgressView().tint(Theme.primary)
            } else if notFound || profile == nil {
                notFoundView
            } else if let p = profile {
                content(p)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: userId) { await loadAll() }
        .task(id: "\(tab)-\(selectedMode.rawValue)") {
            topWords = await PublicProfileService.topWords(userId: userId, mode: selectedMode)
        }
    }

    private func loadAll() async {
        loading = true
        async let prof = PublicProfileService.fetchProfile(id: userId)
        async let st = PublicProfileService.stats(id: userId)
        async let mt = PublicProfileService.recentMatches(id: userId)
        let p = await prof
        if p == nil { notFound = true; loading = false; return }
        profile = p
        stats = await st
        matches = await mt
        // Default the mode picker to the player's first mode for this tab.
        if let firstMode = stats.first(where: { $0.playType == tab })?.gameMode,
           let gm = GameMode(rawValue: firstMode) { selectedMode = gm }
        loading = false
    }

    private var notFoundView: some View {
        VStack(spacing: 16) {
            Text("Player not found").font(Brand.title(28)).foregroundStyle(Theme.textPrimary)
            Text("This profile doesn't exist or may have been removed.")
                .font(Brand.body(13)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
            Button("Back") { dismiss() }.buttonStyle(.borderedProminent).tint(Theme.primary)
        }.padding(24)
    }

    // MARK: Content

    private func content(_ p: Profile) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                header(p)
                overallCards(p)
                modeSection
                if !topWords.isEmpty { topWordsCard }
                recentMatches(p)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
        }
    }

    // MARK: Header

    private func header(_ p: Profile) -> some View {
        let progress = Double(p.xp % 1000) / 10.0
        let toNext = 1000 - (p.xp % 1000)
        return VStack(spacing: 10) {
            HStack {
                Button { dismiss() } label: {
                    Label("Back", systemImage: "chevron.left").font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
                }.buttonStyle(.plain)
                Spacer()
            }
            AvatarView(url: p.avatarUrl, username: p.username, size: 96)
            Text(p.username).font(Brand.title(30))
                .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xEC4899), Color(hex: 0xA78BFA)], startPoint: .leading, endPoint: .trailing))
            HStack(spacing: 6) {
                Image(systemName: "star.fill").font(.system(size: 12)).foregroundStyle(Color(hex: 0xD97706))
                Text("Level \(p.level)").font(Brand.caption(12)).foregroundStyle(Color(hex: 0x92400E))
            }
            .padding(.horizontal, 12).padding(.vertical, 5)
            .background(Capsule().fill(Color(hex: 0xFEF9EC))).overlay(Capsule().stroke(Color(hex: 0xFDE68A), lineWidth: 1.5))
            VStack(spacing: 2) {
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(width: 160, height: 6)
                    Capsule().fill(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xF97316)], startPoint: .leading, endPoint: .trailing))
                        .frame(width: 160 * progress / 100, height: 6)
                }
                Text("\(toNext) XP to next level").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
    }

    // MARK: Overall stat cards

    private func overallCards(_ p: Profile) -> some View {
        let games = p.totalWins + p.totalLosses
        let winRate = games > 0 ? Int((Double(p.totalWins) / Double(games) * 100).rounded()) : 0
        return HStack(spacing: 8) {
            card("trophy.fill", Color(hex: 0x16A34A), "\(p.totalWins)", "Wins", "\(winRate)% win rate")
            card("flame.fill", Color(hex: 0xEA580C), "\(p.currentStreak)", "Win Streak", "Best: \(p.bestStreak)")
            card("bolt.fill", Theme.primary, "\(p.dailyLoginStreak)", "Daily", "Best: \(p.bestDailyLoginStreak)")
            card("target", Color(hex: 0x2563EB), "\(games)", "Games", "\(p.totalLosses) losses")
        }
    }

    private func card(_ icon: String, _ color: Color, _ value: String, _ label: String, _ sub: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 16)).foregroundStyle(color)
            Text(value).font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            Text(label.uppercased()).font(Brand.font(9, .bold)).tracking(0.4).foregroundStyle(Theme.textMuted)
            Text(sub).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
    }

    // MARK: Mode section (Solo/VS toggle + picker + stats card)

    private var modeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("GAME MODE STATISTICS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            HStack(spacing: 8) {
                tabButton("solo", "Solo", "person.fill")
                tabButton("vs", "VS", "bolt.horizontal.fill")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) { ForEach(pickerModes) { m in modeChip(m) } }.padding(.horizontal, 1)
            }
            modeStatsCard
        }
    }

    private func tabButton(_ value: String, _ label: String, _ icon: String) -> some View {
        let active = tab == value
        return Button { tab = value } label: {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 11))
                Text(label).font(Brand.font(12, .heavy))
            }
            .foregroundStyle(active ? Theme.primary : Theme.textMuted)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surface : Theme.surfaceHover))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
    }

    private func modeChip(_ m: HomeMode) -> some View {
        let active = selectedMode == m.mode
        return Button { if let gm = m.mode { selectedMode = gm } } label: {
            VStack(spacing: 4) {
                ModeIconView(icon: m.icon, accent: m.accent, box: 28)
                Text(m.title).font(Brand.font(10, .heavy)).foregroundStyle(active ? m.accent : Theme.textMuted).lineLimit(1)
            }
            .frame(minWidth: 58).padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(active ? m.accent.opacity(0.08) : Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? m.accent : Theme.border, lineWidth: 1.5))
        }.buttonStyle(.plain)
    }

    private var modeStatsCard: some View {
        let stat = stats.first { $0.gameMode == selectedMode.rawValue && $0.playType == tab }
        let accent = homeModes.first { $0.mode == selectedMode }?.accent ?? Theme.primary
        return VStack(spacing: 0) {
            Rectangle().fill(accent).frame(height: 3)
            HStack(spacing: 10) {
                ModeIconView(icon: homeModes.first { $0.mode == selectedMode }?.icon ?? .roman("?"), accent: accent, box: 28)
                Text(ModeStyle.title(selectedMode)).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .bottom)
            if let s = stat {
                let cells: [(String, String, Color)] = [
                    ("Wins", "\(s.wins)", Color(hex: 0x16A34A)),
                    ("Losses", "\(s.losses)", Color(hex: 0xDC2626)),
                    ("Best", s.bestScore > 0 ? "\(s.bestScore)" : "-", Color(hex: 0xD97706)),
                    ("Fastest", s.fastestTime > 0 ? fmtTime(s.fastestTime) : "-", Color(hex: 0x2563EB)),
                ]
                HStack(spacing: 12) {
                    ForEach(cells, id: \.0) { c in
                        VStack(spacing: 1) {
                            Text(c.1).font(Brand.font(17, .black)).foregroundStyle(Theme.textPrimary)
                            Text(c.0.uppercased()).font(Brand.font(9, .bold)).tracking(0.4).foregroundStyle(Theme.textMuted)
                        }.frame(maxWidth: .infinity)
                    }
                }.padding(16)
            } else {
                Text("No \(tab) games played in this mode yet")
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(24)
            }
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: Top words

    private var topWordsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TOP WORDS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            VStack(spacing: 6) {
                ForEach(topWords) { w in
                    HStack {
                        Text(w.word).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).tracking(1)
                        Spacer()
                        Text("\(w.count)×").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    // MARK: Recent matches

    private func recentMatches(_ p: Profile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "clock").font(.system(size: 14)).foregroundStyle(Color(hex: 0x2563EB))
                Text("Recent Matches").font(Brand.font(18, .black)).foregroundStyle(Theme.textPrimary)
            }
            if matches.isEmpty {
                Text("No matches played yet.").font(Brand.body(13)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
            } else {
                VStack(spacing: 8) { ForEach(matches) { m in RecentMatchRow(match: m, profileId: p.id) } }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    private func fmtTime(_ s: Int) -> String {
        s < 60 ? "\(s)s" : (s % 60 > 0 ? "\(s/60)m \(s%60)s" : "\(s/60)m")
    }
}

/// One row in a "Recent Matches" list — shared by the public profile and the
/// signed-in user's own profile tab so both render identically. Shows mode,
/// Solo/VS, win/loss, the player's time, and the date.
struct RecentMatchRow: View {
    let match: PublicProfileService.RecentMatch
    let profileId: String
    var body: some View {
        let won = match.isWinner(profileId)
        let modeTitle = GameMode(rawValue: match.game_mode).map { ModeStyle.title($0) } ?? match.game_mode
        let pt = match.playerTime(profileId)
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(won ? Color(hex: 0xDCFCE7) : Color(hex: 0xFEE2E2)).frame(width: 38, height: 38)
                Image(systemName: won ? "checkmark" : "xmark").font(.system(size: 16, weight: .bold))
                    .foregroundStyle(won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(modeTitle).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                Text(match.isSolo ? "Solo" : "VS Match").font(Brand.font(11, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(won ? "Win" : "Loss").font(Brand.font(12, .heavy))
                    .foregroundStyle(won ? Color(hex: 0x16A34A) : Color(hex: 0xDC2626))
                Text(pt > 0 ? "\(pt)s" : "-").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            if let d = match.date {
                Text(shortDate(d)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.background))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
    }

    private func shortDate(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f.string(from: d)
    }
}
