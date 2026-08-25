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
    @State private var inviteNote: String?
    @FocusState private var fieldFocused: Bool
    // Typeahead (Aug 11): 2+ letters → matching users, so invites go to the
    // right Carlie instead of a blind exact-match fire.
    @State private var suggestions: [FriendsService.FriendProfile] = []
    @State private var searchTask: Task<Void, Never>?
    // §212: one-tap taunts from friend rows (leaderboard sheet twin).
    @State private var tauntTarget: FriendsService.FriendProfile?
    @State private var tauntStatus: String?
    // §225: context-menu targets — Unfriend confirmation, and a programmatic
    // profile push (menu items can't be NavigationLinks).
    @State private var unfriendTarget: FriendsService.FriendProfile?
    @State private var profileTarget: String?
    // §234: double-tap guard for the weekly-race share card.
    @State private var sharingRace = false
    // §238: the "Last week" line unfolds into the settled-week history.
    @State private var showPastWeeks = false

    var body: some View {
        let _ = version
        let friends = FriendsService.friends
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles

        // Two cards (founder ask, Aug 17): requests in flight moved out of the
        // FRIENDS box into their own INVITES card — the roster reads finished
        // even while invites are pending.
        VStack(spacing: 14) {
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
                // §216: one-tap nudge for everyone who hasn't played today
                // (server still enforces 1 taunt per friend per day).
                let slackers = friends.filter { $0.playedToday == 0 && !isNewFriend($0) }
                if !slackers.isEmpty {
                    Button {
                        Task {
                            var n = 0
                            for f in slackers {
                                let outcome = await FriendsService.taunt(
                                    friendId: f.id, tauntId: "slowpoke",
                                    day: LeaderboardService.todayLocal())
                                if outcome == .sent { n += 1 }
                            }
                            note = n > 0 ? "Nudged \(n) friend\(n == 1 ? "" : "s") 🔔" : "Everyone already nudged today"
                        }
                    } label: {
                        Text("🔔 Nudge slackers").font(Brand.font(10, .bold))
                            .foregroundStyle(Color(hex: 0x7C3AED))
                            .padding(.horizontal, 8).padding(.vertical, 5)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0x7C3AED).opacity(0.09)))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
                    }.buttonStyle(.plain)
                }
            }

            // Weekly race podium (§212, always-on since §216) — who owns the
            // week among your circle; medals wait for the first score.
            if !podium.isEmpty {
                VStack(spacing: 4) {
                    // §218 (founder ask): the podium is the WEEKLY race, but
                    // bare "pts" read as today's score — name the window and
                    // when it closes.
                    HStack {
                        Text("THIS WEEK'S RACE").font(Brand.font(9, .black)).tracking(0.8)
                            .foregroundStyle(Theme.textMuted)
                        Spacer()
                        TimelineView(.periodic(from: .now, by: 1)) { ctx in
                            Text(FriendsPanelView.weekEndsLabel(at: ctx.date))
                                .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                                .monospacedDigit()
                        }
                        // §234: share the race — the sweep-board touchpoint
                        // (muted glyph at the header's trailing edge), only
                        // once someone has actually scored this week.
                        if raceStarted {
                            Button {
                                guard !sharingRace else { return }
                                sharingRace = true
                                LeaderboardShareFlow.shareWeeklyRace(
                                    friends: friends,
                                    meDigest: FriendsService.meDigest,
                                    username: AuthService.shared.profile?.username)
                                sharingRace = false
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Theme.textMuted)
                            }
                            .buttonStyle(.plain)
                            .opacity(sharingRace ? 0.4 : 1)
                            .accessibilityLabel("Share weekly race")
                        }
                    }
                    // §232: Monday's answer — last week's settled winner.
                    // §238: the line unfolds into the settled-week history.
                    if let lw = lastWeekWinner {
                        let history = pastWeeks
                        Button {
                            if history.count > 1 { withAnimation(.easeInOut(duration: 0.15)) { showPastWeeks.toggle() } }
                        } label: {
                            HStack(spacing: 3) {
                                Text("Last week: 👑 \(lw.name) · \(lw.pts.formatted()) pts")
                                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                                if history.count > 1 {
                                    Image(systemName: "chevron.down")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(Theme.textMuted)
                                        .rotationEffect(.degrees(showPastWeeks ? 180 : 0))
                                }
                                Spacer(minLength: 0)
                            }
                        }
                        .buttonStyle(.plain)
                        if showPastWeeks {
                            ForEach(history.filter { $0.k > 0 }, id: \.k) { wk in
                                Text("\(FriendsPanelView.pastWeekLabel(wk.k)): 👑 \(wk.name) · \(wk.pts.formatted()) pts")
                                    .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.leading, 4)
                            }
                        }
                    }
                    HStack(alignment: .bottom, spacing: 22) {
                        ForEach(podiumOrder, id: \.entry.id) { slot in
                            // §225: podium columns open profiles too — same door
                            // as the friend rows below.
                            NavigationLink(value: slot.entry.id) {
                                VStack(spacing: 2) {
                                    Text(raceStarted ? ["🥇", "🥈", "🥉"][slot.rank] : "🏁")
                                        .font(.system(size: slot.rank == 0 ? 20 : 14))
                                    AvatarView(url: slot.entry.avatarUrl, username: slot.entry.username, size: 34, emoji: slot.entry.avatarEmoji)
                                    // §225: 9pt + scale floor so ~14 characters fit
                                    // before truncation ("TheRealMich..." complaint).
                                    Text(slot.entry.username).font(Brand.font(9, .black)).lineLimit(1)
                                        .minimumScaleFactor(0.75)
                                        .foregroundStyle(slot.entry.isMe ? Color(hex: 0x7C3AED) : Theme.textPrimary)
                                        .frame(maxWidth: 76)
                                    Text("\(slot.entry.pts.formatted()) pts").font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                                }
                            }
                            .buttonStyle(.plain)
                            .padding(.top, slot.rank == 0 ? 0 : 8)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    // §238: everyone past the medals, ranked. Score stays
                    // fixedSize and the name truncates — the §236 lesson.
                    if standings.count > 3 {
                        VStack(spacing: 4) {
                            ForEach(Array(standings.dropFirst(3).enumerated()), id: \.element.id) { i, e in
                                NavigationLink(value: e.id) {
                                    HStack(spacing: 8) {
                                        Text(FriendsPanelView.ordinal(i + 4))
                                            .font(Brand.font(10, .black)).foregroundStyle(Theme.textMuted)
                                            .frame(width: 28, alignment: .trailing)
                                        Text(e.username)
                                            .font(Brand.font(10, .heavy)).lineLimit(1)
                                            .foregroundStyle(e.isMe ? Color(hex: 0x7C3AED) : Theme.textPrimary)
                                        Spacer(minLength: 4)
                                        Text("\(e.pts.formatted()) pts")
                                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                                            .fixedSize()
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.top, 2)
                        .padding(.horizontal, 8)
                    }
                    if !raceStarted {
                        Text("Race resets Mondays — first daily takes the lead.")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                }
                .padding(.vertical, 4)
            }

            // §216: today's race — how many friends you've topped so far.
            if let myToday = FriendsService.meDigest?.todayPoints, myToday > 0, !friends.isEmpty {
                let topped = friends.filter { ($0.todayPoints ?? 0) < myToday }.count
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("TODAY'S RACE").font(Brand.font(9, .black)).tracking(0.8)
                            .foregroundStyle(Theme.textMuted)
                        Spacer()
                        Text("topped \(topped) of \(friends.count) friend\(friends.count == 1 ? "" : "s")")
                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.surfaceAlt)
                            Capsule()
                                .fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                                .frame(width: geo.size.width * CGFloat(topped) / CGFloat(max(1, friends.count)))
                        }
                    }
                    .frame(height: 6)
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
                        // §225: the WHOLE row is the door to the profile — the
                        // old link stopped at the username, so most of the row
                        // animated on tap but went nowhere (founder screenshot).
                        // The bell/Say-hi Buttons nest inside the label; their
                        // taps win over the link, so taunting never navigates.
                        NavigationLink(value: f.id) {
                            HStack(spacing: 10) {
                                AvatarView(url: f.avatar_url, username: f.username, size: 30, emoji: f.avatar_emoji)
                                VStack(alignment: .leading, spacing: 1) {
                                    HStack(spacing: 6) {
                                        Text(f.username).font(Brand.font(12, .heavy))
                                            .foregroundStyle(Theme.textPrimary).lineLimit(1)
                                        // §216: the week's leader wears the crown.
                                        if f.id == crownId { Text("👑").font(.system(size: 11)) }
                                        if isNewFriend(f) {
                                            Text("NEW").font(Brand.font(8, .black))
                                                .foregroundStyle(Color(hex: 0x7C3AED))
                                                .padding(.horizontal, 4).padding(.vertical, 2)
                                                .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0x7C3AED).opacity(0.13)))
                                        }
                                        // §216: friendversary chip on milestone days.
                                        if let days = friendversary(f) {
                                            Text("🎉 \(days) DAYS").font(Brand.font(8, .black))
                                                .foregroundStyle(Color(hex: 0xEC4899))
                                                .padding(.horizontal, 4).padding(.vertical, 2)
                                                .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0xEC4899).opacity(0.13)))
                                        }
                                    }
                                    // §212: today's progress, streak, rivalry — the live row.
                                    if let played = f.playedToday {
                                        Text(statusLine(f, played: played))
                                            .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted).lineLimit(1)
                                    }
                                }
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
                                } else {
                                    // §225: fixed-width slot — bell or empty air —
                                    // so "Lvl N" hangs in one clean column (founder:
                                    // TheRealMichael's bell-less "Lvl 44" floated left).
                                    ZStack {
                                        if f.playedToday == 0 {
                                            // Slacker bell — one-tap taunt (§207 picker).
                                            Button { tauntTarget = f } label: {
                                                Image(systemName: "bell.fill").font(.system(size: 12, weight: .bold))
                                                    .foregroundStyle(Color(hex: 0x7C3AED))
                                                    .frame(width: 26, height: 26)
                                                    .background(Circle().fill(Theme.surfaceAlt))
                                                    .overlay(Circle().stroke(Theme.border, lineWidth: 1.5))
                                            }.buttonStyle(.plain)
                                        } else {
                                            Color.clear
                                        }
                                    }
                                    .frame(width: 32, height: 26)
                                }
                                Text("Lvl \(f.level)").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                                // §225: chevron so the row reads as tappable.
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Theme.textMuted)
                            }
                        }
                        .buttonStyle(.plain)
                        // §225: long-press menu — Unfriend used to live only on a
                        // profile page these rows couldn't even reach.
                        .contextMenu {
                            Button { profileTarget = f.id } label: {
                                Label("View Profile", systemImage: "person.crop.circle")
                            }
                            Button { tauntTarget = f } label: {
                                Label("Taunt", systemImage: "bell")
                            }
                            Button(role: .destructive) { unfriendTarget = f } label: {
                                Label("Unfriend", systemImage: "person.badge.minus")
                            }
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
            // §225: not everyone knows their username — hand them a profile
            // link instead. Message + separate URL, the ActivityShareSheet
            // convention, so the sheet previews the site icon.
            if let p = AuthService.shared.profile,
               let profileUrl = URL(string: "https://wordocious.com/profile/\(p.id)") {
                ShareLink(item: profileUrl, message: Text("Add me on Wordocious — I'm \(p.username)")) {
                    HStack(spacing: 5) {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 10, weight: .semibold))
                        Text("Share invite link").font(Brand.font(10, .bold))
                    }
                    .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
            }
            if let note {
                Text(note).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))

        if !incoming.isEmpty || !outgoing.isEmpty {
            invitesCard
        }
        }
        .task { await FriendsService.load() }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            version = FriendsService.version
        }
        .sheet(item: $tauntTarget) { target in tauntSheet(target) }
        // §225: Unfriend confirmation — the mutation was only reachable from a
        // profile page the rows couldn't open. remove() prunes the cache and
        // notifies, so the roster refreshes itself.
        .confirmationDialog(
            "Unfriend \(unfriendTarget?.username ?? "")?",
            isPresented: Binding(
                get: { unfriendTarget != nil },
                set: { if !$0 { unfriendTarget = nil } }),
            titleVisibility: .visible
        ) {
            Button("Unfriend", role: .destructive) {
                if let f = unfriendTarget {
                    Task { _ = await FriendsService.remove(friendId: f.id) }
                }
                unfriendTarget = nil
            }
            Button("Cancel", role: .cancel) { unfriendTarget = nil }
        } message: {
            Text("You can re-add them anytime.")
        }
        // §225: programmatic push for the context menu's View Profile — the
        // HomeView isPresented idiom (menu items can't be NavigationLinks).
        .navigationDestination(isPresented: Binding(
            get: { profileTarget != nil },
            set: { if !$0 { profileTarget = nil } })) {
            if let id = profileTarget { PublicProfileView(userId: id) }
        }
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

    /// INVITES card — requests in flight (incoming + sent), split out of the
    /// FRIENDS card so the roster reads finished (founder ask, Aug 17).
    /// Renders only when something is actually pending.
    @ViewBuilder private var invitesCard: some View {
        let incoming = FriendsService.incoming
        let outgoing = FriendsService.outgoingProfiles
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "paperplane.fill").font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color(hex: 0x7C3AED))
                Text("INVITES")
                    .font(Brand.font(16, .black)).tracking(0.3)
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                Text("\(incoming.count + outgoing.count)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted)
                Spacer()
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
                                    case .reminded: inviteNote = "Reminder sent to \(r.username) 🔔"
                                    case .already: inviteNote = "Already reminded today"
                                    case .failed: inviteNote = "Could not remind"
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

            if let inviteNote {
                // Transient confirmation — the row's "Reminded" pill carries the
                // durable state, so this clears itself (founder: it "just
                // lingered"). 2.5s matches the Android panel; tap dismisses.
                // .task(id:) restarts the timer per note and cancels on change.
                Text(inviteNote).font(Brand.font(12, .heavy)).foregroundStyle(Theme.textMuted)
                    .onTapGesture { self.inviteNote = nil }
                    .task(id: inviteNote) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        if !Task.isCancelled { self.inviteNote = nil }
                    }
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: 0xC4B5FD), lineWidth: 1.5))
    }

    /// "5/9 today · 2,116 pts · 🔥12 · you lead 7–4" — the row's engagement
    /// digest (§212; §238 wording).
    private func statusLine(_ f: FriendsService.FriendProfile, played: Int) -> String {
        var parts: [String] = []
        if played > 0 {
            var lead = "\(played)/9 today"
            // §225: show the score, not just the count — todayPoints already
            // rides the §216 digest. formatted() = grouping separators.
            // §238: points ride right after the count so "N pts" clearly
            // belongs to "today"; streak follows.
            if let pts = f.todayPoints, pts > 0 { lead += " · \(pts.formatted()) pts" }
            if let s = f.streak, s > 0 { lead += " · 🔥\(s)" }
            parts.append(lead)
        } else {
            parts.append("hasn't played today")
        }
        // §238 (founder: "18–7 you doesn't really make sense"): the rivalry
        // record now says who's ahead in plain words.
        let w = f.h2hW ?? 0, l = f.h2hL ?? 0
        if w + l > 0 {
            parts.append(w == l ? "tied \(w)–\(l)" : w > l ? "you lead \(w)–\(l)" : "they lead \(l)–\(w)")
        }
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

    /// Me + friends by this week's daily points, best first (§212/§238).
    private var standings: [PodiumEntry] {
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
        // Always on (§216): a Monday-morning zero-point podium still shows
        // the race — medals wait for the first score (see raceStarted).
        return entries
    }

    /// §238 (founder: "see the rankings of 4th, 5th, 6th"): the podium keeps
    /// its three medals; everyone else gets a ranked row beneath it.
    private var podium: [PodiumEntry] { Array(standings.prefix(3)) }

    private var raceStarted: Bool { standings.contains { $0.pts > 0 } }

    /// §232: Monday's question — "who won last week?" — answered in place.
    /// lastWeekPoints is the settled previous week (Mon–Sun) from the digest;
    /// nil (line hidden) when nobody scored.
    private var lastWeekWinner: (name: String, pts: Int)? {
        var entries = FriendsService.friends.map { (name: $0.username, pts: $0.lastWeekPoints ?? 0) }
        if AuthService.shared.profile != nil {
            entries.append((name: "You", pts: FriendsService.meDigest?.lastWeekPoints ?? 0))
        }
        entries.sort { $0.pts > $1.pts }
        guard let top = entries.first, top.pts > 0 else { return nil }
        return top
    }

    /// §238: winner per settled week — k indexes pastWeekPoints (0 = last
    /// week, 1 = two weeks ago …); weeks nobody scored in are dropped.
    private var pastWeeks: [(k: Int, name: String, pts: Int)] {
        let meArr = FriendsService.meDigest?.pastWeekPoints ?? []
        let len = max(meArr.count, FriendsService.friends.map { $0.pastWeekPoints?.count ?? 0 }.max() ?? 0)
        var out: [(k: Int, name: String, pts: Int)] = []
        for k in 0..<len {
            var entries = FriendsService.friends.map { f in
                (name: f.username, pts: (f.pastWeekPoints?.indices.contains(k) == true) ? f.pastWeekPoints![k] : 0)
            }
            if AuthService.shared.profile != nil {
                entries.append((name: "You", pts: k < meArr.count ? meArr[k] : 0))
            }
            entries.sort { $0.pts > $1.pts }
            if let top = entries.first, top.pts > 0 { out.append((k: k, name: top.name, pts: top.pts)) }
        }
        return out
    }

    /// §238: "Aug 10–16" — the local Mon–Sun range k+1 Mondays back (same
    /// local week boundary as weekStart everywhere else).
    private static func pastWeekLabel(_ k: Int) -> String {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let dow = (cal.component(.weekday, from: today) + 5) % 7 // 0 Mon … 6 Sun
        guard let mon = cal.date(byAdding: .day, value: -dow - 7 * (k + 1), to: today),
              let sun = cal.date(byAdding: .day, value: 6, to: mon) else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        return "\(f.string(from: mon))–\(f.string(from: sun))"
    }

    /// §238: 4th/5th/…/21st/22nd — the ranked rows under the podium.
    private static func ordinal(_ n: Int) -> String {
        let v = n % 100
        if (11...13).contains(v) { return "\(n)th" }
        switch n % 10 {
        case 1: return "\(n)st"; case 2: return "\(n)nd"; case 3: return "\(n)rd"
        default: return "\(n)th"
        }
    }

    /// §218/§226: when the weekly race closes — weeks run Mon–Sun, reset
    /// Monday 00:00 local (same boundary as weekStart in the friends digest).
    /// Live clock (founder: a static "4d" carried no urgency) — the Text is
    /// driven by a TimelineView so it ticks like the daily countdown.
    static func weekEndsLabel(at now: Date) -> String {
        let cal = Calendar.current
        let dow = cal.component(.weekday, from: now) // 1 Sun … 7 Sat
        let daysToMonday = dow == 1 ? 1 : 9 - dow // Mon→7 … Sat→2, Sun→1
        let end = cal.startOfDay(for: cal.date(byAdding: .day, value: daysToMonday, to: now)!)
        let secs = max(0, Int(end.timeIntervalSince(now)))
        let d = secs / 86400
        let clock = String(format: "%02d:%02d:%02d", (secs % 86400) / 3600, (secs % 3600) / 60, secs % 60)
        return d >= 1 ? "ends Sunday · \(d)d \(clock)" : "ends tonight · \(clock)"
    }

    /// §216: the week's leader wears the crown — only once someone scored.
    private var crownId: String? { raceStarted ? podium.first?.id : nil }

    /// §216: friendversary chip on milestone days.
    private func friendversary(_ f: FriendsService.FriendProfile) -> Int? {
        guard let since = f.since, let date = parseISO(since) else { return nil }
        let days = Int(Date().timeIntervalSince(date) / 86_400)
        return [7, 30, 100, 365].contains(days) ? days : nil
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
    // §218: pushed views don't inherit the root's safeAreaInset, so without
    // this the BottomNav covered the tail of the gift-Pro card (the same
    // cutoff PublicProfileView fixed) — pad by the reported chrome height.
    @ObservedObject private var chrome = ChromeVisibility.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                FriendsPanelView()
                // §212: recruiting and friending are the same motion — the
                // gift-Pro panel lives here too.
                InvitePanelView()
            }
            .padding(16)
            .padding(.bottom, chrome.bottomInset)
        }
        .background(Theme.background.ignoresSafeArea())
        // navigationTitle stays for the next push's back label; the principal
        // item is what renders. §225 (founder): the plain black system title
        // clashed with the chrome — wear the SETTINGS idiom instead (Brand
        // caps in the wordmark gradient).
        .navigationTitle("Friends")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("FRIENDS").font(Brand.font(17, .black)).foregroundStyle(Theme.wordmarkGradient)
            }
        }
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
