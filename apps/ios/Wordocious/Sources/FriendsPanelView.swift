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

            // Incoming requests first — they're the actionable part.
            if !incoming.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("FRIEND REQUESTS").font(Brand.font(9, .black)).tracking(0.8)
                        .foregroundStyle(Theme.textMuted)
                    ForEach(incoming) { r in
                        HStack(spacing: 10) {
                            AvatarView(url: r.avatar_url, username: r.username, size: 30)
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
                            AvatarView(url: r.avatar_url, username: r.username, size: 30)
                            NavigationLink(value: r.id) {
                                Text(r.username).font(Brand.font(12, .heavy))
                                    .foregroundStyle(Theme.textPrimary).lineLimit(1)
                            }.buttonStyle(.plain)
                            Spacer()
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
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(friends) { f in
                        NavigationLink(value: f.id) {
                            HStack(spacing: 10) {
                                AvatarView(url: f.avatar_url, username: f.username, size: 30)
                                Text(f.username).font(Brand.font(12, .heavy))
                                    .foregroundStyle(Theme.textPrimary).lineLimit(1)
                                if isNewFriend(f) {
                                    Text("NEW").font(Brand.font(8, .black))
                                        .foregroundStyle(Color(hex: 0x7C3AED))
                                        .padding(.horizontal, 4).padding(.vertical, 2)
                                        .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0x7C3AED).opacity(0.13)))
                                }
                                Spacer()
                                Text("Lvl \(f.level)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                            }
                        }.buttonStyle(.plain)
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
            FriendsPanelView().padding(16)
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
