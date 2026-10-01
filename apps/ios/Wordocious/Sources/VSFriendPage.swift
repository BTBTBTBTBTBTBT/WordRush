import SwiftUI
import WordociousCore

/// The Friend page, `CHALLENGE` (VS overhaul, founder 2026-10-01; spec
/// docs/VS_REDESIGN_SPEC.md §3) — Pro to send, free to answer. RACE MY RUN: pick
/// friends (and/or a link), play a fresh puzzle, and they race your run any time
/// in 24 h. LIVE NOW: the existing live invite (link or @username). Once the
/// player taps PLAY, the game takes this page's place, so its VS HOME pops
/// straight back to the lobby.
struct VSFriendPage: View {
    let mode: GameMode
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var auth = AuthService.shared

    private enum Tab { case race, live }
    @State private var tab: Tab = .race
    @State private var selected: Set<String>
    @State private var link = false
    @State private var friends: [FriendsService.FriendProfile] = FriendsService.friends
    @State private var rivals: [String: StatsDeepService.Rivalry] = [:]
    @State private var loading = !FriendsService.loaded
    @State private var playing: VSIntent.SendTarget?
    @State private var showInvite = false

    init(mode: GameMode, preselected: [String] = []) {
        self.mode = mode
        _selected = State(initialValue: Set(preselected.map { $0.lowercased() }))
    }

    var body: some View {
        if let target = playing {
            VSGameView(mode: mode, intent: .sendChallenge(target))
        } else {
            page
        }
    }

    private var page: some View {
        VStack(spacing: 0) {
            VSNavBar(title: "CHALLENGE", onBack: { dismiss() }) { VSModeChip(mode: mode).padding(.trailing, 6) }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    segmented
                    if !auth.isProActive {
                        proGate
                    } else if tab == .race {
                        raceTab
                    } else {
                        liveTab
                    }
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 120)
            }
            if auth.isProActive && tab == .race { cta }
        }
        .background(VsLobbyKit.page.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .swipeToGoBack { dismiss() }
        .sheet(isPresented: $showInvite) { InviteSheet(mode: mode) }
        .task {
            await FriendsService.load()
            friends = FriendsService.friends.sorted { $0.username.localizedCaseInsensitiveCompare($1.username) == .orderedAscending }
            loading = false
            let r = await StatsDeepService.rivalries(limit: 50)
            rivals = Dictionary(r.map { ($0.opponentId.lowercased(), $0) }, uniquingKeysWith: { a, _ in a })
        }
    }

    // MARK: - RACE MY RUN | LIVE NOW

    private var segmented: some View {
        HStack(spacing: 4) {
            segment(.race, "RACE MY RUN", "they play any time in 24 h")
            segment(.live, "LIVE NOW", "both online")
        }
        .padding(4)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(VsLobbyKit.soft))
    }

    private func segment(_ t: Tab, _ title: String, _ sub: String) -> some View {
        let on = tab == t
        return Button { Haptics.tap(); tab = t } label: {
            VStack(spacing: 1) {
                Text(title).font(Brand.font(12, .black)).tracking(0.5)
                Text(sub).font(Brand.font(9.5, .bold)).opacity(0.8)
            }
            .foregroundStyle(on ? VsLobbyKit.deep : VsLobbyKit.ink)
            .frame(maxWidth: .infinity).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(on ? Color.white : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: RACE MY RUN

    private var raceTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            VSSectionLabel(text: "FRIENDS")
            VStack(spacing: 0) {
                if loading {
                    ProgressView().tint(VsLobbyKit.ink).padding(20)
                } else if friends.isEmpty {
                    Text("No friends yet — add some from the Friends tab, or send a link.")
                        .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
                        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                }
                ForEach(friends) { f in
                    friendRow(f)
                    Divider().padding(.leading, 60)
                }
                linkRow
            }
            .vsCard()
            Text("They get a notification with your time to beat.")
                .font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.label)
                .frame(maxWidth: .infinity).multilineTextAlignment(.center).padding(.top, 4)
        }
    }

    private func h2hLine(_ f: FriendsService.FriendProfile) -> String {
        if let r = rivals[f.id.lowercased()] {
            return VsLobbyKit.rivalLine(wins: r.wins, losses: r.losses, lastMode: r.lastMode)
        }
        let w = f.h2hW ?? 0, l = f.h2hL ?? 0
        if w + l > 0 { return VsLobbyKit.rivalLine(wins: w, losses: l, lastMode: nil) }
        return "Never played · new friend"
    }

    private func friendRow(_ f: FriendsService.FriendProfile) -> some View {
        let on = selected.contains(f.id.lowercased())
        return Button {
            Haptics.tap()
            if on { selected.remove(f.id.lowercased()) } else { selected.insert(f.id.lowercased()) }
        } label: {
            HStack(spacing: 12) {
                AvatarView(url: f.avatar_url, username: f.username, size: 36, emoji: f.avatar_emoji)
                VStack(alignment: .leading, spacing: 2) {
                    Text("@\(f.username)").font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep).lineLimit(1)
                    Text(h2hLine(f)).font(Brand.font(11, .bold)).foregroundStyle(VsLobbyKit.sub).lineLimit(1)
                }
                Spacer(minLength: 4)
                check(on)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 12).strokeBorder(on ? VsLobbyKit.ink : .clear, lineWidth: 2))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var linkRow: some View {
        Button { Haptics.tap(); link.toggle() } label: {
            HStack(spacing: 12) {
                Image(systemName: "link").font(.system(size: 14, weight: .bold)).foregroundStyle(VsLobbyKit.ink)
                    .frame(width: 36, height: 36).background(Circle().fill(VsLobbyKit.soft))
                Text("Send a link instead").font(Brand.font(13, .black)).foregroundStyle(VsLobbyKit.deep)
                Spacer(minLength: 4)
                check(link)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 12).strokeBorder(link ? VsLobbyKit.ink : .clear, lineWidth: 2))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(link ? .isSelected : [])
    }

    private func check(_ on: Bool) -> some View {
        ZStack {
            Circle().strokeBorder(on ? VsLobbyKit.ink : Color(hex: 0xD1D5DB), lineWidth: 2)
            if on {
                Circle().fill(VsLobbyKit.ink)
                Image(systemName: "checkmark").font(.system(size: 11, weight: .black)).foregroundStyle(.white)
            }
        }
        .frame(width: 24, height: 24)
    }

    /// PLAY, THEN SEND TO N FRIENDS / … TO 1 FRIEND / PLAY, THEN SHARE A LINK.
    private var cta: some View {
        let ids = friends.map(\.id).filter { selected.contains($0.lowercased()) }
        let n = ids.count
        let title = n > 0 ? "PLAY, THEN SEND TO \(n) \(n == 1 ? "FRIEND" : "FRIENDS")"
            : (link ? "PLAY, THEN SHARE A LINK" : "PICK A FRIEND OR A LINK")
        return VSPrimaryButton(title: title, disabled: n == 0 && !link) {
            Haptics.tap()
            playing = VSIntent.SendTarget(friendIds: ids, link: link)
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
        .background(VsLobbyKit.page.opacity(0.96).ignoresSafeArea(edges: .bottom))
    }

    // MARK: LIVE NOW

    private var liveTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PLAY RIGHT NOW").font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.deep)
            Text("You’re both online: send a private match link or an @username invite, and the match starts when they join.")
                .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
                .fixedSize(horizontal: false, vertical: true)
            VSPrimaryButton(title: "INVITE TO A LIVE MATCH") { showInvite = true }
        }
        .padding(16).vsCard()
    }

    private var proGate: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SENDING CHALLENGES IS PRO").font(Brand.font(14, .black)).foregroundStyle(VsLobbyKit.purpleInk)
            Text("Answering a friend’s challenge is always free.")
                .font(Brand.font(12, .bold)).foregroundStyle(VsLobbyKit.sub)
            NavigationLink { ProView() } label: {
                Text("SEE PRO").font(Brand.font(12, .black)).tracking(0.6).foregroundStyle(.white)
                    .padding(.horizontal, 18).frame(height: 34)
                    .background(Capsule().fill(VsLobbyKit.purple))
            }
            .buttonStyle(PressableStyle())
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).vsCard()
    }
}
