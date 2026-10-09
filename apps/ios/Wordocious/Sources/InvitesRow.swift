import SwiftUI
import WordociousCore

/// The Invites row (FRIDAY-QUEUE 9f): everything waiting on you in one place: live VS invites sent to
/// you and race-my-run challenges, newest first, each with the sender's mascot, "Johnny challenges you
/// to CLASSIC", the run to beat, and family Accept / Decline. Renders nothing when there are none or
/// when `branded_invites` is off. Self-contained: the VS lobby and the Friends tab each place
/// `InvitesRow(onAccept:)` and handle the tap (live → the private match, race → the race flow).
/// Compact, symmetric, no bordered box (a soft wash only). Mirrors web components/invites/invites-row.tsx.
struct InvitesRow: View {
    /// The host opens the screen that accepts it (live: VSGameView(mode:inviteCode:); race: VSChallengeRaceView).
    var onAccept: (InviteRowItem) -> Void
    var shown = 3

    @ObservedObject private var auth = AuthService.shared
    @State private var rows: [InviteRowItem] = []

    var body: some View {
        Group {
            if FlagsService.shared.isLive(BrandedInvite.switchKey), !rows.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(rows.count > shown ? "INVITES · \(rows.count)" : "INVITES")
                        .font(Brand.font(11, .black)).tracking(0.8).foregroundStyle(VsLobbyKit.mutedInk)
                        .padding(.horizontal, 4)
                    ForEach(rows.prefix(shown)) { row in
                        card(row).transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Invites")
            }
        }
        .task(id: auth.profile?.id) { await load() }
    }

    private func card(_ r: InviteRowItem) -> some View {
        let mode = GameMode(rawValue: r.gameMode) ?? .duel
        return HStack(spacing: 10) {
            AvatarView(url: nil, username: r.sender, size: 38, userId: r.senderId)
            VStack(alignment: .leading, spacing: 2) {
                Text("@\(r.sender) challenges you to \(VsLobbyKit.modeName(mode))")
                    .font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.titleInk).lineLimit(2).minimumScaleFactor(0.8)
                Text(r.variant == .race ? "Beat: \(r.raceLine ?? "a run to beat")" : "Live match")
                    .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.mutedInk).lineLimit(1)
            }
            Spacer(minLength: 2)
            Button { decline(r) } label: { CandyLabel(title: "Decline") }
                .buttonStyle(CastButtonStyle(color: .slate, size: .small, fullWidth: false))
                .accessibilityLabel("Decline @\(r.sender)'s invite")
            Button { onAccept(r) } label: { CandyLabel(title: "Accept", symbol: "checkmark") }
                .buttonStyle(CastButtonStyle(color: .green, size: .small, fullWidth: false))
                .accessibilityLabel("Accept @\(r.sender)'s invite and play")
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(hex: 0x8B5CF6).opacity(0.10)))
    }

    private func decline(_ r: InviteRowItem) {
        withAnimation(.easeOut(duration: 0.2)) { rows.removeAll { $0.id == r.id } }
        if r.variant == .live, let id = r.inviteId {
            Task { await InviteService.decline(inviteId: id) }
        } else {
            var gone = UserDefaults.standard.stringArray(forKey: InvitesRowRules.dismissedKey) ?? []
            gone.append(r.code)
            UserDefaults.standard.set(Array(Set(gone).prefix(50)), forKey: InvitesRowRules.dismissedKey)
        }
    }

    private func load() async {
        guard let uid = auth.profile?.id else { rows = []; return }
        async let pending = InviteService.fetchPending(userId: uid)
        async let challenges = VsChallengeService.list()
        let live = await pending
        let races = (await challenges)?.incoming ?? []
        let names = await InviteService.inviterUsernames(Array(Set(live.map(\.inviter_id))))
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var items: [InviteRowItem] = live.map { l in
            InviteRowItem(variant: .live, code: l.invite_code, gameMode: l.game_mode, sender: names[l.inviter_id] ?? "A friend",
                          senderId: l.inviter_id, inviteId: l.id, createdAt: l.created_at.flatMap(iso.date) ?? Date())
        }
        items += races.map { c in
            InviteRowItem(variant: .race, code: c.code, gameMode: c.gameMode, sender: c.challenger.username, senderId: c.challenger.id,
                          raceLine: InvitesRowRules.raceLine(solved: c.run.solved, guesses: c.run.guesses, timeMs: c.run.timeMs),
                          createdAt: c.createdDate ?? Date())
        }
        let dismissed = UserDefaults.standard.stringArray(forKey: InvitesRowRules.dismissedKey) ?? []
        withAnimation { rows = InvitesRowRules.build(items, dismissed: dismissed) }
    }
}
