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
    @State private var socials: [String: String] = [:]
    @State private var loading = true
    @State private var notFound = false
    @State private var tab = "solo"                 // "solo" | "vs"
    @State private var selectedMode: GameMode = .duel
    @State private var showAllRecent = false
    // Moderation (App Review 1.2): report + block from the stranger's profile.
    @State private var showReportDialog = false
    @State private var showBlockConfirm = false
    @State private var moderationToast: String?
    /// Profile-social redesign data (presence ring, persona chips, H2H, trophy
    /// case, highlights, Lately). Loads separately from the core profile so
    /// the page renders even if every social fetch fails.
    @State private var social = ProfileSocialData()
    // PRIVATE PROFILES: `gated` = viewer gets only the teaser card (target is
    // private and the viewer is neither the owner nor an admin — mirrors the
    // server gate, plus the typed-403 backstop). `deepAllowed` flips true only
    // after the gate opens, so no deep fetch ever fires for a gated profile
    // (spec §6: don't fire-then-discard, don't read the open tables).
    @State private var gated = false
    @State private var deepAllowed = false
    @ObservedObject private var chrome = ChromeVisibility.shared

    private let pickerModes: [HomeMode] = homeModes.filter { $0.mode != nil }

    private var isOwnProfile: Bool { AuthService.shared.profile?.id == userId }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if loading {
                PulsingLoadingText()   // web parity: pulsing "Loading..." text
            } else if notFound || profile == nil {
                notFoundView
            } else if let p = profile {
                if gated { teaser(p) } else { content(p) }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await ModerationService.loadBlockedIds() }
        .task(id: userId) { await loadAll() }
        // Social sections load on their own task — non-blocking, and the page
        // stays fully usable if any (or all) of these fetches fail. Keyed on
        // deepAllowed so nothing fires until the privacy gate has opened.
        .task(id: "social-\(userId)-\(deepAllowed)") {
            guard deepAllowed else { return }
            social = await ProfileSocialLoader.load(userId: userId)
        }
        .task(id: "\(tab)-\(selectedMode.rawValue)-\(deepAllowed)") {
            guard deepAllowed else { return }
            topWords = await PublicProfileService.topWords(userId: userId, mode: selectedMode, playType: tab)
        }
        // Moderation dialogs live on the container (not inside the header) so
        // the private-profile teaser branch can open them too.
        .confirmationDialog("Report this user?", isPresented: $showReportDialog, titleVisibility: .visible) {
            Button("Inappropriate username", role: .destructive) { fileReport("Inappropriate username") }
            Button("Inappropriate profile content", role: .destructive) { fileReport("Inappropriate profile content") }
            Button("Cheating / fake scores", role: .destructive) { fileReport("Cheating / fake scores") }
            Button("Other", role: .destructive) { fileReport("Other") }
            Button("Cancel", role: .cancel) {}
        } message: { Text("Reports are reviewed by the Wordocious team.") }
        .confirmationDialog("Block this user?", isPresented: $showBlockConfirm, titleVisibility: .visible) {
            Button("Block", role: .destructive) {
                Task { await ModerationService.block(userId: userId); moderationToast = "User blocked" }
            }
            Button("Cancel", role: .cancel) {}
        } message: { Text("You won't see this player on leaderboards or records.") }
    }

    private func loadAll() async {
        loading = true
        // PRIVATE PROFILES: let auth settle before deciding who the viewer is,
        // so the owner deep-linking into their own profile never flashes their
        // own teaser card (spec §6).
        while AuthService.shared.isLoading {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        guard let p = await PublicProfileService.fetchProfile(id: userId) else {
            notFound = true; loading = false; return
        }
        profile = p
        let viewer = AuthService.shared.profile
        // Client mirror of the server gate (open for public targets, the
        // owner, and admins). The endpoints enforce it regardless — mirroring
        // means no doomed requests and no direct reads of the still-open
        // tables (user_stats / daily_results / medals) for a private target.
        gated = (p.isPrivate == true) && viewer?.id != p.id && viewer?.isAdmin != true
        if gated { loading = false; return }   // teaser renders from the profiles row alone
        async let st = PublicProfileService.stats(id: userId)
        async let mt = PublicProfileService.recentMatchesGated(id: userId)
        stats = await st
        switch await mt {
        case .ok(let rows): matches = rows
        case .privateProfile:
            // The profiles row read said public but the server said private —
            // the row was stale (the flag just flipped). The typed 403 wins.
            gated = true; loading = false; return
        case .failed: matches = []
        }
        socials = await ProfileExtras.socialLinks(userId: userId)
        // Default the mode picker to the player's first mode for this tab.
        if let firstMode = stats.first(where: { $0.playType == tab })?.gameMode,
           let gm = GameMode(rawValue: firstMode) { selectedMode = gm }
        deepAllowed = true
        loading = false
    }

    private func fileReport(_ reason: String) {
        Task {
            let ok = await ModerationService.report(userId: userId, reason: reason, context: "public_profile")
            moderationToast = ok ? "Report submitted — thank you" : "Could not submit report"
        }
    }

    private var notFoundView: some View {
        VStack(spacing: 16) {
            Text("Player not found").font(Brand.title(28)).foregroundStyle(Theme.textPrimary)
            Text("This profile doesn't exist or may have been removed.")
                .font(Brand.body(13)).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
            Button("Back") { dismiss() }.buttonStyle(.borderedProminent).tint(Theme.primary)
        }.padding(24)
    }

    // MARK: Shared header bits (full page + teaser)

    /// App Review 1.2: users must be able to report/block each other wherever
    /// strangers' content renders — including a private profile's teaser card.
    private var moderationMenu: some View {
        Menu {
            Button(role: .destructive) { showReportDialog = true } label: {
                Label("Report User", systemImage: "flag")
            }
            if ModerationService.isBlocked(userId) {
                Button { Task { await ModerationService.unblock(userId: userId); moderationToast = "User unblocked" } } label: {
                    Label("Unblock User", systemImage: "person.crop.circle.badge.checkmark")
                }
            } else {
                Button(role: .destructive) { showBlockConfirm = true } label: {
                    Label("Block User", systemImage: "person.crop.circle.badge.xmark")
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle").font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.textMuted).padding(4)
        }
    }

    private func moderationToastView(_ toast: String) -> some View {
        Text(toast).font(Brand.caption(12)).foregroundStyle(Theme.textMuted)
            .padding(.horizontal, 12).padding(.vertical, 5)
            .background(Capsule().fill(Theme.surface))
            .task { try? await Task.sleep(nanoseconds: 2_500_000_000); moderationToast = nil }
    }

    /// Accent-colored (or wordmark-gradient) username — same on both branches.
    @ViewBuilder private func usernameText(_ p: Profile, size: CGFloat = 30) -> some View {
        if ProfileAccent.isCustom(p.accentColor) {
            Text(p.username).font(Brand.title(size)).foregroundStyle(ProfileAccent.color(p.accentColor))
        } else {
            Text(p.username).font(Brand.title(size))
                .foregroundStyle(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xEC4899), Color(hex: 0xA78BFA)], startPoint: .leading, endPoint: .trailing))
        }
    }

    // MARK: Private-profile teaser (spec §3)

    /// Same tier ladder as the own-profile page (Bronze <11 … Diamond 100+).
    private func teaserTier(_ lvl: Int) -> (label: String, bg: Color, border: Color, color: Color) {
        if lvl >= 100 { return ("Diamond", Color(hex: 0xEFF6FF), Color(hex: 0xBFDBFE), Color(hex: 0x1D4ED8)) }
        if lvl >= 51 { return ("Platinum", Color(hex: 0xF5F3FF), Color(hex: 0xC4B5FD), Color(hex: 0x6D28D9)) }
        if lvl >= 26 { return ("Gold", Color(hex: 0xFEF9EC), Color(hex: 0xFDE68A), Color(hex: 0x92400E)) }
        if lvl >= 11 { return ("Silver", Color(hex: 0xF3F4F6), Color(hex: 0xD1D5DB), Color(hex: 0x374151)) }
        return ("Bronze", Color(hex: 0xFEF2E8), Color(hex: 0xFED7AA), Color(hex: 0x9A3412))
    }

    private func teaserMemberSince(_ p: Profile) -> String? {
        guard let c = p.createdAt, let d = parseTimestamp(c) else { return nil }
        let f = DateFormatter(); f.dateFormat = "MMM yyyy"; f.locale = Locale(identifier: "en_US")
        return f.string(from: d)
    }

    /// One clean card styled like the profile header — identity + headline
    /// numbers, all from the world-readable profiles row. Nothing that reveals
    /// words or strategy renders; the deep endpoints 403 anyway, this is the
    /// face on that rule. Ports the web teaser (app/profile/[id]/page.tsx).
    private func teaser(_ p: Profile) -> some View {
        let tier = teaserTier(p.level)
        let medals: [(String, Int)] = [("🥇", p.goldMedals), ("🥈", p.silverMedals), ("🥉", p.bronzeMedals)]
        let stats: [(String, Int)] = [("Wins", p.totalWins),
                                      ("Games", p.totalWins + p.totalLosses),
                                      ("Daily Streak", p.dailyLoginStreak)]
        return ScrollView {
            VStack(spacing: 16) {
                HStack {
                    Button { dismiss() } label: {
                        Label("Back", systemImage: "chevron.left").font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
                    }.buttonStyle(.plain)
                    Spacer()
                    // Report / Block still works on private profiles.
                    if !isOwnProfile { moderationMenu }
                }
                if let toast = moderationToast { moderationToastView(toast) }

                VStack(spacing: 0) {
                    AvatarView(url: p.avatarUrl, username: p.username, size: 96,
                               accentHex: p.accentColor, emoji: p.avatarEmoji)
                    usernameText(p).padding(.top, 12)

                    // Lock badge — the notation the founder asked for.
                    HStack(spacing: 5) {
                        Image(systemName: "lock.fill").font(.system(size: 10, weight: .bold))
                        Text("This profile is private")
                            .font(Brand.font(11, .black)).tracking(0.5).textCase(.uppercase)
                    }
                    .foregroundStyle(Theme.textMuted)
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(Capsule().fill(Theme.surfaceHover))
                    .overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
                    .padding(.top, 8)

                    Text("\(p.username) keeps their words and strategies to themselves. You can still meet them on the daily leaderboards.")
                        .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center).frame(maxWidth: 240)
                        .padding(.top, 8)

                    // Level + tier chip, member since — same chips as the header.
                    HStack(spacing: 5) {
                        Image(systemName: "star.fill").font(.system(size: 11))
                        Text("Level \(p.level)").font(Brand.font(12, .heavy))
                        Text("·").opacity(0.7)
                        Text(tier.label).font(Brand.font(12, .heavy))
                    }
                    .foregroundStyle(tier.color)
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(Capsule().fill(tier.bg))
                    .overlay(Capsule().stroke(tier.border, lineWidth: 1.5))
                    .padding(.top, 16)

                    if let since = teaserMemberSince(p) {
                        Text("Member since \(since)")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            .padding(.top, 6)
                    }

                    // Medal counts
                    HStack(spacing: 16) {
                        ForEach(medals, id: \.0) { m in
                            HStack(spacing: 4) {
                                Text(m.0).font(.system(size: 17))
                                Text("\(m.1)").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                            }
                        }
                    }
                    .padding(.top, 16)

                    // Headline numbers
                    HStack(spacing: 12) {
                        ForEach(stats, id: \.0) { s in
                            VStack(spacing: 2) {
                                Text("\(s.1)").font(Brand.font(17, .black)).foregroundStyle(Theme.textPrimary)
                                Text(s.0.uppercased()).font(Brand.font(9, .bold)).tracking(0.6).foregroundStyle(Theme.textMuted)
                            }.frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.top, 12)
                    .overlay(Rectangle().fill(Theme.border).frame(height: 1), alignment: .top)
                    .padding(.top, 12)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))

                Button { dismiss() } label: {
                    Label("Back", systemImage: "chevron.left")
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.primary)
                        .padding(.horizontal, 18).padding(.vertical, 8)
                        .background(Capsule().fill(Theme.surfaceHover))
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
                }.buttonStyle(.plain)
            }
            .padding(.horizontal, 12).padding(.top, 8)
            .padding(.bottom, chrome.bottomInset)
        }
    }

    // MARK: Content

    private func content(_ p: Profile) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                header(p)
                socialSections(p)
                overallCards(p)
                modeSection
                if !topWords.isEmpty { topWordsCard }
                recentMatches(p)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            // This view is always PUSHED (leaderboard/records/profile rows),
            // and the root-level banner+nav safeAreaInset doesn't extend to
            // pushed destinations — without this the last rows sit under the
            // nav and can never be scrolled into view.
            .padding(.bottom, chrome.bottomInset)
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
                moderationMenu
            }
            if let toast = moderationToast { moderationToastView(toast) }
            // Social redesign: avatar wrapped in the today-progress ring.
            TodayRingAvatar(profile: p, completedToday: social.todayCount)
            usernameText(p)
            // PRIVATE PROFILES: the owner (and admins) still see the full page
            // — this muted pill is the reminder that everyone else doesn't.
            if p.isPrivate == true {
                HStack(spacing: 4) {
                    Image(systemName: "lock.fill").font(.system(size: 9, weight: .bold))
                    Text(isOwnProfile ? "Your profile is private" : "Private profile")
                        .font(Brand.font(10, .black)).tracking(0.4).textCase(.uppercase)
                }
                .foregroundStyle(Theme.textMuted)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Capsule().fill(Theme.surfaceHover))
                .overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
            }
            // Social redesign: presence line + level/archetype/percentile/opener
            // chips (the level badge moved into the chip row).
            if let seen = p.lastSeenAt {
                PresenceLine(lastSeenAt: seen)
            }
            ProfilePersonalizationRow(profile: p)
            ProfileIdentityChips(profile: p, persona: social.persona)
            VStack(spacing: 2) {
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(width: 160, height: 6)
                    Capsule().fill(LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xF97316)], startPoint: .leading, endPoint: .trailing))
                        .frame(width: 160 * progress / 100, height: 6)
                }
                Text("\(toNext) XP to next level").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            socialLinksRow()
        }
    }

    // Public-profile social links — web parity (SocialLinksDisplay on /profile/[id]).
    private let socialOrder = ["twitter", "instagram", "tiktok", "threads", "discord", "website"]

    @ViewBuilder
    private func socialLinksRow() -> some View {
        let links = socials.filter { !$0.value.isEmpty }
        if !links.isEmpty {
            HStack(spacing: 8) {
                ForEach(socialOrder.filter { links[$0] != nil }, id: \.self) { key in
                    if let handle = links[key], let url = socialURL(key, handle) {
                        Link(destination: url) {
                            Image(systemName: key == "website" ? "globe" : (key == "discord" ? "message.fill" : "at"))
                                .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                                .frame(width: 30, height: 30)
                                .background(Circle().fill(Theme.surfaceHover))
                                .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                        }
                    }
                }
            }.padding(.top, 2)
        }
    }

    private func socialURL(_ key: String, _ handle: String) -> URL? {
        let h = handle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? handle
        switch key {
        case "twitter": return URL(string: "https://twitter.com/\(h)")
        case "instagram": return URL(string: "https://instagram.com/\(h)")
        case "tiktok": return URL(string: "https://tiktok.com/@\(h)")
        case "threads": return URL(string: "https://threads.net/@\(h)")
        case "discord": return URL(string: "https://discord.com/users/\(h)")
        case "website": return URL(string: handle.hasPrefix("http") ? handle : "https://\(handle)")
        default: return nil
        }
    }

    // MARK: Social sections (profile-social redesign — above the stat cards)

    /// You-vs-Them, trophy case, highlights, and Lately. Every section guards
    /// on its own data and simply doesn't render without it, so the existing
    /// page below is untouched when the fetches fail or return nothing.
    @ViewBuilder private func socialSections(_ p: Profile) -> some View {
        if let h2h = social.h2h, !h2h.shared.isEmpty,
           let viewerId = social.viewerId, viewerId != p.id {
            YouVsThemCard(target: p, h2h: h2h)
        }
        TrophyCaseCard(profile: p, persona: social.persona, medals: social.medals)
        HighlightsReel(profile: p, persona: social.persona, stats: stats,
                       hasPerfectOcto: social.hasPerfectOcto, calendar: social.calendar)
        LatelyCard(profile: p, medals: social.medals, persona: social.persona)
    }

    // MARK: Overall stat cards

    private func overallCards(_ p: Profile) -> some View {
        let games = p.totalWins + p.totalLosses
        // Web parity: one-decimal win rate (e.g. "66.7%"), not rounded to whole.
        let winRate = games > 0 ? String(format: "%.1f", Double(p.totalWins) / Double(games) * 100) : "0.0"
        return HStack(spacing: 8) {
            card("trophy.fill", Color(hex: 0x7C3AED), "\(p.totalWins)", "Wins", "\(winRate)% win rate")
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
            .minimumScaleFactor(0.7)
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
                .minimumScaleFactor(0.7)
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
                    ("Wins", "\(s.wins)", Color(hex: 0x7C3AED)),
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
                // Show 5 collapsed; the toggle expands the rest in place (no
                // inner ScrollView — the rows render straight into the VStack).
                VStack(spacing: 8) {
                    ForEach(showAllRecent ? matches : Array(matches.prefix(5))) { m in
                        RecentMatchRow(match: m, profileId: p.id)
                    }
                }
                if matches.count > 5 {
                    Button { showAllRecent.toggle() } label: {
                        Text(showAllRecent ? "Show less" : "View all \(matches.count) ›")
                            .font(Brand.font(11, .heavy)).foregroundStyle(Theme.primary).frame(maxWidth: .infinity)
                    }.buttonStyle(.plain).padding(.top, 2)
                }
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

/// One row in a "Recent Matches" list — ports the web profile row exactly:
/// a mode-accent-tinted icon box (the mode's own glyph), proper-case title +
/// a Solo/VS pill, an "N guesses · time" line, and "Win/Loss" + "Mon D · h:mm a".
/// Shared by the public profile and the signed-in user's own profile tab.
struct RecentMatchRow: View {
    let match: PublicProfileService.RecentMatch
    let profileId: String
    /// VS opponent's username — renders "· vs <name>" inline (web profile parity).
    var opponentName: String? = nil

    private var mode: HomeMode? { homeModes.first { $0.dbKey == match.game_mode } }

    var body: some View {
        let won = match.isWinner(profileId)
        let guesses = match.guesses(profileId)
        let secs = match.playerTime(profileId)
        return HStack(spacing: 12) {
            // Mode icon in its accent-tinted box (matches web gameModeIcons).
            if let m = mode {
                ModeIconView(icon: m.icon, accent: m.accent, box: 36)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(Color(hex: 0xD97706).opacity(0.1)).frame(width: 36, height: 36)
                    Image(systemName: "bolt.fill").font(.system(size: 15)).foregroundStyle(Color(hex: 0xD97706))
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(mode?.title ?? match.game_mode)
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(match.isSolo ? "Solo" : "VS")
                        .font(Brand.font(9, .heavy))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 5)
                            .fill(match.isSolo ? Color(hex: 0xEFF6FF) : Color(hex: 0xEDE9F6)))
                        .foregroundStyle(match.isSolo ? Color(hex: 0x2563EB) : Color(hex: 0x7C3AED))
                    if match.forfeit == true {
                        Text("FORFEIT")
                            .font(Brand.font(9, .heavy))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(RoundedRectangle(cornerRadius: 5).fill(Color(hex: 0xFEF3C7)))
                            .foregroundStyle(Color(hex: 0xB45309))
                    }
                    if !match.isSolo, let opponentName {
                        Text("· vs \(opponentName)")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }
                Text("\(guesses) \(guesses == 1 ? "guess" : "guesses") · \(secs > 0 ? durationStr(secs) : "—")")
                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(won ? "Win" : "Loss").font(Brand.font(12, .heavy))
                    .foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626))
                if let d = match.date {
                    Text(dateTimeStr(d)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
    }

    private func durationStr(_ s: Int) -> String {
        s < 60 ? "\(s)s" : "\(s / 60)m \(s % 60)s"
    }

    private func dateTimeStr(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "MMM d · h:mm a"; return f.string(from: d)
    }
}


/// Pulsing "Loading..." text — web parity with /profile/[id]'s animate-pulse label.
private struct PulsingLoadingText: View {
    @State private var pulse = false
    var body: some View {
        Text("Loading...").font(Brand.body(14)).foregroundStyle(Theme.textMuted)
            .opacity(pulse ? 0.4 : 1)
            .onAppear {
                guard !Theme.reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
            }
    }
}
