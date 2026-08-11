import SwiftUI
import WordociousCore

/// FRIENDS (§207) — the Friends card on the OWN profile: friends list with
/// counts, incoming requests (accept/decline), and the Add-by-username field.
/// Native port of components/friends/friends-panel.tsx, wearing the same card
/// shell as the neighboring InvitePanelView.
struct FriendsPanelView: View {
    @State private var version = 0
    @State private var username = ""
    @State private var sending = false
    @State private var note: String?
    @FocusState private var fieldFocused: Bool
    // Typeahead (Aug 11): 2+ letters → matching users, so invites go to the
    // right Carlie instead of a blind exact-match fire.
    @State private var suggestions: [FriendsService.FriendProfile] = []
    @State private var searchTask: Task<Void, Never>?
    // §212: one-tap taunts from friend rows (leaderboard sheet twin).
    @State private var tauntTarget: FriendsService.FriendProfile?
    @State private var tauntStatus: String?

    var body: some View {
        let _ = version
        let friends = FriendsService.friends
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles

        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "person.2.fill").font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: 0x7C3AED))
                Text("FRIENDS")
                    .font(Brand.font(16, .black)).tracking(0.3)
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                if !friends.isEmpty {
                    Text("\(friends.count)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
            }

            // Weekly race podium (§212) — who owns the week among your circle.
            if !podium.isEmpty {
                HStack(alignment: .bottom, spacing: 22) {
                    ForEach(podiumOrder, id: \.entry.id) { slot in
                        VStack(spacing: 2) {
                            Text(["🥇", "🥈", "🥉"][slot.rank]).font(.system(size: slot.rank == 0 ? 20 : 14))
                            AvatarView(url: slot.entry.avatarUrl, username: slot.entry.username, size: 34, emoji: slot.entry.avatarEmoji)
                            Text(slot.entry.username).font(Brand.font(10, .black)).lineLimit(1)
                                .foregroundStyle(slot.entry.isMe ? Color(hex: 0x7C3AED) : Theme.textPrimary)
                                .frame(maxWidth: 76)
                            Text("\(slot.entry.pts.formatted()) pts").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        .padding(.top, slot.rank == 0 ? 0 : 8)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }

            // Incoming requests first — they're the actionable part.
            if !incoming.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("FRIEND REQUESTS").font(Brand.font(9, .black)).tracking(0.8)
                        .foregroundStyle(Theme.textMuted)
                    ForEach(incoming) { r in
                        HStack(spacing: 10) {
                            AvatarView(url: r.avatar_url, username: r.username, size: 30, emoji: r.avatar_emoji)
                            NavigationLink(value: r.id) {
                                Text(r.username).font(Brand.font(12, .heavy))
                                    .foregroundStyle(Theme.textPrimary).lineLimit(1)
                            }.buttonStyle(.plain)
                            Spacer()
                            Button { Task { await FriendsService.accept(requesterId: r.id) } } label: {
                                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(.white).frame(width: 26, height: 26)
                                    .background(Circle().fill(Color(hex: 0x7C3AED)))
                            }.buttonStyle(.plain)
                            Button { Task { await FriendsService.decline(requesterId: r.id) } } label: {
                                Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Theme.textMuted).frame(width: 26, height: 26)
                                    .background(Circle().fill(Theme.surfaceAlt))
                                    .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }

            // Sent requests — the loop's missing feedback (Tier 1, Aug 11).
            if !outgoing.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SENT — WAITING").font(Brand.font(9, .black)).tracking(0.8)
                        .foregroundStyle(Theme.textMuted)
                    ForEach(outgoing) { r in
                        HStack(spacing: 10) {
                            AvatarView(url: r.avatar_url, username: r.username, size: 30, emoji: r.avatar_emoji)
                            NavigationLink(value: r.id) {
                                // foregroundColor (not Style): Text concatenation
                                // needs the pre-iOS-17 modifier.
                                (Text(r.username).font(Brand.font(12, .heavy)).foregroundColor(Theme.textPrimary)
                                    + Text("  · \(agoShort(r.requestedAt))").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted))
                                    .lineLimit(1)
                            }.buttonStyle(.plain)
                            Spacer()
                            // §212: the invite usually died unseen — re-push, 1/24h.
                            Button {
                                Task {
                                    switch await FriendsService.remind(addresseeId: r.id) {
                                    case .reminded: note = "Reminder sent to \(r.username) 🔔"
                                    case .already: note = "Already reminded today"
                                    case .failed: note = "Could not remind"
                                    }
                                }
                            } label: {
                                Text(withinDay(r.remindedAt) ? "Reminded" : "Remind").font(Brand.font(10, .bold))
                                    .foregroundStyle(Color(hex: 0x7C3AED))
                                    .padding(.horizontal, 8).padding(.vertical, 5)
                                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0x7C3AED).opacity(0.09)))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
                            }
                            .buttonStyle(.plain)
                            .disabled(withinDay(r.remindedAt))
                            .opacity(withinDay(r.remindedAt) ? 0.55 : 1)
                            Button { Task { await FriendsService.decline(requesterId: r.id) } } label: {
                                Text("Cancel").font(Brand.font(10, .bold))
                                    .foregroundStyle(Theme.textMuted)
                                    .padding(.horizontal, 8).padding(.vertical, 5)
                                    .background(RoundedRectangle(cornerRadius: 8).fill(Theme.surfaceAlt))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1.5))
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }

            // Friends list — rows into their profiles (H2H lives there).
            if friends.isEmpty {
                if incoming.isEmpty && outgoing.isEmpty {
                    // Teaching empty state: explain the whole loop (Tier 1, Aug 11).
                    VStack(alignment: .leading, spacing: 5) {
                        Text("1. Add friends below by username, or with the Add Friend button on any player's profile.")
                        Text("2. Requests you send and receive land right here.")
                        Text("3. Once a friend accepts, flip the leaderboard to FRIENDS for your own private race.")
                    }
                    .font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(friends) { f in
                        HStack(spacing: 10) {
                            NavigationLink(value: f.id) {
                                HStack(spacing: 10) {
                                    AvatarView(url: f.avatar_url, username: f.username, size: 30, emoji: f.avatar_emoji)
                                    VStack(alignment: .leading, spacing: 1) {
                                        HStack(spacing: 6) {
                                            Text(f.username).font(Brand.font(12, .heavy))
                                                .foregroundStyle(Theme.textPrimary).lineLimit(1)
                                            if isNewFriend(f) {
                                                Text("NEW").font(Brand.font(8, .black))
                                                    .foregroundStyle(Color(hex: 0x7C3AED))
                                                    .padding(.horizontal, 4).padding(.vertical, 2)
                                                    .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0x7C3AED).opacity(0.13)))
                                            }
                                        }
                                        // §212: today's progress, streak, rivalry — the live row.
                                        if let played = f.playedToday {
                                            Text(statusLine(f, played: played))
                                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                                        }
                                    }
                                }
                            }.buttonStyle(.plain)
                            Spacer()
                            if isNewFriend(f) {
                                Button {
                                    Task {
                                        let outcome = await FriendsService.taunt(
                                            friendId: f.id, tauntId: "hi",
                                            day: LeaderboardService.todayLocal())
                                        note = outcome == .sent ? "👋 sent to \(f.username)!"
                                            : outcome == .alreadySent ? "Already said hi today" : "Could not send"
                                    }
                                } label: {
                                    Text("👋 Say hi").font(Brand.font(10, .bold))
                                        .foregroundStyle(Color(hex: 0x7C3AED))
                                        .padding(.horizontal, 8).padding(.vertical, 5)
                                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0x7C3AED).opacity(0.09)))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
                                }.buttonStyle(.plain)
                            } else if f.playedToday == 0 {
                                // Slacker bell — one-tap taunt (§207 picker).
                                Button { tauntTarget = f } label: {
                                    Image(systemName: "bell.fill").font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(Color(hex: 0x7C3AED))
                                        .frame(width: 26, height: 26)
                                        .background(Circle().fill(Theme.surfaceAlt))
                                        .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                                }.buttonStyle(.plain)
                            }
                            Text("Lvl \(f.level)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        }
                    }
                }
            }

            // Add by username — exact match, same lookup as VS invites.
            HStack(spacing: 8) {
                TextField("Add by username", text: $username)
                    .font(Brand.font(12, .bold))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($fieldFocused)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceAlt))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                    .onSubmit { add() }
                Button(action: add) {
                    HStack(spacing: 5) {
                        Image(systemName: "person.badge.plus").font(.system(size: 11, weight: .semibold))
                        Text("Add").font(Brand.font(12, .black))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 12)
                        .fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0x6D28D9)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                }
                .buttonStyle(.plain)
                .disabled(sending || username.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(sending || username.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
            }
            // Typeahead results — tap sends to that exact account (by id).
            if !suggestions.isEmpty {
                VStack(spacing: 6) {
                    ForEach(suggestions) { u in
                        Button {
                            guard !sending else { return }
                            sending = true
                            suggestions = []
                            Task {
                                let outcome = await FriendsService.request(addresseeId: u.id)
                                switch outcome {
                                case .accepted: note = "You're now friends! 🎉"; username = ""
                                case .pending: note = "Request sent to \(u.username) 🤝"; username = ""
                                case .failed(let msg): note = msg
                                }
                                sending = false
                            }
                        } label: {
                            HStack(spacing: 10) {
                                AvatarView(url: u.avatar_url, username: u.username, size: 30, emoji: u.avatar_emoji)
                                Text(u.username).font(Brand.font(12, .heavy))
                                    .foregroundStyle(Theme.textPrimary).lineLimit(1)
                                Spacer()
                                Text("Lvl \(u.level)").font(Brand.font(10, .bold))
                                    .foregroundStyle(Theme.textMuted)
                                Image(systemName: "person.badge.plus")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Color(hex: 0x7C3AED))
                            }
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surfaceAlt))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            if let note {
                Text(note).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
        .task { await FriendsService.load() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            version = FriendsService.version
        }
        .sheet(item: $tauntTarget) { target in tauntSheet(target) }
        .onChange(of: username) { q in
            searchTask?.cancel()
            let query = q.trimmingCharacters(in: .whitespaces)
            guard query.count >= 2 else { suggestions = []; return }
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 250_000_000)   // debounce
                guard !Task.isCancelled else { return }
                let users = await FriendsService.search(query)
                guard !Task.isCancelled else { return }
                suggestions = users.filter {
                    !FriendsService.isFriend($0.id) && !FriendsService.hasRequested($0.id)
                }
            }
        }
    }

    /// "5/9 today · 🔥12 · 7–4 you" — the row's engagement digest (§212).
    private func statusLine(_ f: FriendsService.FriendProfile, played: Int) -> String {
        var parts: [String] = []
        if played > 0 {
            var lead = "\(played)/9 today"
            if let s = f.streak, s > 0 { lead += " · 🔥\(s)" }
            parts.append(lead)
        } else {
            parts.append("hasn't played today")
        }
        let w = f.h2hW ?? 0, l = f.h2hL ?? 0
        if w + l > 0 { parts.append(w >= l ? "\(w)–\(l) you" : "\(l)–\(w) them") }
        return parts.joined(separator: " · ")
    }

    /// Taunt picker — the leaderboard sheet's twin (§207 fixed phrases).
    private func tauntSheet(_ target: FriendsService.FriendProfile) -> some View {
        VStack(spacing: 0) {
            Text("TAUNT \(target.username.uppercased())")
                .font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 14)
            Divider().overlay(Theme.border)
            if let status = tauntStatus {
                Text(status).font(Brand.font(14, .heavy)).foregroundStyle(Theme.textPrimary)
                    .frame(maxWidth: .infinity).padding(.vertical, 32)
            } else {
                ForEach(FriendTaunts.all) { taunt in
                    Button {
                        Task {
                            let outcome = await FriendsService.taunt(
                                friendId: target.id, tauntId: taunt.id,
                                day: LeaderboardService.todayLocal())
                            switch outcome {
                            case .sent: tauntStatus = "Sent 😈"
                            case .alreadySent: tauntStatus = "Already taunted them today"
                            case .failed: tauntStatus = "Could not send"
                            }
                            try? await Task.sleep(nanoseconds: 1_400_000_000)
                            tauntTarget = nil
                            tauntStatus = nil
                        }
                    } label: {
                        Text(taunt.text).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16).padding(.vertical, 13)
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(Theme.border)
                }
                Button { tauntTarget = nil } label: {
                    Text("Cancel").font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .background(Theme.surface)
        .presentationDetents([.medium])
    }

    struct PodiumEntry {
        let id: String; let username: String; let avatarUrl: String?
        let avatarEmoji: String?; let pts: Int; let isMe: Bool
    }

    /// Top 3 of me + friends by this week's daily points (§212).
    private var podium: [PodiumEntry] {
        let friends = FriendsService.friends
        guard !friends.isEmpty else { return [] }
        var entries = friends.map {
            PodiumEntry(id: $0.id, username: $0.username, avatarUrl: $0.avatar_url,
                        avatarEmoji: $0.avatar_emoji, pts: $0.weekPoints ?? 0, isMe: false)
        }
        if let p = AuthService.shared.profile {
            entries.append(PodiumEntry(id: p.id, username: "You", avatarUrl: p.avatarUrl,
                                       avatarEmoji: p.avatarEmoji,
                                       pts: FriendsService.meDigest?.weekPoints ?? 0, isMe: true))
        }
        entries.sort { $0.pts > $1.pts }
        guard entries.contains(where: { $0.pts > 0 }) else { return [] }
        return Array(entries.prefix(3))
    }

    /// Silver–gold–bronze display order, tagged with the medal rank.
    private var podiumOrder: [(rank: Int, entry: PodiumEntry)] {
        let p = podium
        return [1, 0, 2].compactMap { i in i < p.count ? (rank: i, entry: p[i]) : nil }
    }

    /// "2d" / "5h" / "now" — how long a sent invite has been waiting (§212).
    private func agoShort(_ iso: String?) -> String {
        guard let iso, let date = parseISO(iso) else { return "" }
        let h = Int(Date().timeIntervalSince(date) / 3600)
        if h < 1 { return "now" }
        if h < 24 { return "\(h)h" }
        return "\(h / 24)d"
    }

    private func withinDay(_ iso: String?) -> Bool {
        guard let iso, let date = parseISO(iso) else { return false }
        return Date().timeIntervalSince(date) < 24 * 3600
    }

    private func parseISO(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    /// Accepted within the last 24h — wears the NEW chip (Tier 2, Aug 11).
    private func isNewFriend(_ f: FriendsService.FriendProfile) -> Bool {
        guard let since = f.since else { return false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: since) ?? ISO8601DateFormatter().date(from: since)
        guard let date else { return false }
        return Date().timeIntervalSince(date) < 24 * 60 * 60
    }

    private func add() {
        let name = username.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, !sending else { return }
        sending = true
        fieldFocused = false
        Task {
            let outcome = await FriendsService.request(username: name)
            switch outcome {
            case .accepted: note = "You're now friends! 🎉"; username = ""
            case .pending: note = "Request sent 🤝"; username = ""
            case .failed(let msg): note = msg
            }
            sending = false
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            note = nil
        }
    }
}


/// FRIENDS (Tier 3, Aug 11) — the dedicated friends screen: the panel with a
/// whole screen to breathe. Pushed from the profile's compact row, and
/// presented as a sheet from the empty Friends board CTA.
struct FriendsScreenView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                FriendsPanelView()
                // §212: recruiting and friending are the same motion — the
                // gift-Pro panel lives here too.
                InvitePanelView()
            }
            .padding(16)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Friends")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Compact "FRIENDS (N) →" row for the profile page — the door to
/// FriendsScreenView, wearing the pending-request badge.
struct FriendsRowLink: View {
    @State private var version = 0
    var body: some View {
        let _ = version
        let count = FriendsService.friends.count
        let pending = FriendsService.incoming.count
        NavigationLink { FriendsScreenView() } label: {
            HStack(spacing: 10) {
                Image(systemName: "person.2.fill").font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: 0x7C3AED))
                Text("FRIENDS")
                    .font(Brand.font(16, .black)).tracking(0.3)
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                if count > 0 {
                    Text("\(count)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted)
                }
                if pending > 0 {
                    // Spelled out (web/Android parity) — a bare number here
                    // could read as the friend count sitting beside it.
                    Text(pending == 1 ? "1 request" : "\(pending) requests")
                        .font(Brand.font(10, .black)).foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Capsule().fill(Color(hex: 0xDC2626)))
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .black))
                    .foregroundStyle(Color(hex: 0x7C3AED))
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .task { await FriendsService.load() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            version = FriendsService.version
        }
    }
}
