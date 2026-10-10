import SwiftUI
import WordociousCore

// Founder 10-10 (smoothness pass 4): the Leaderboard's ranks list and Yesterday's ledge as equality boundaries with
// plain-value inputs. A game switch runs LeaderboardTab.body several times (the cached paint, the load, yesterday's
// board, the completions) and every pass used to rebuild all ~50 rows (avatars, names, detail lines) and the compact
// yesterday podium although nothing they show had changed. Each block below re-evaluates only when a value it draws
// changes; the closures (taunt, share) are kept out of `==`, and a theme / season-preview change still reaches them.

/// A cheap content signature of a board's rows (what a row or a podium place draws), so `==` never walks 50 structs of
/// optionals. Stable within a process (Hasher seeds per launch, signatures are never persisted).
func lbRowsSignature(_ rows: [LeaderboardEntry]) -> Int {
    var h = Hasher()
    h.combine(rows.count)
    for r in rows {
        h.combine(r.userId); h.combine(r.compositeScore); h.combine(r.guessCount); h.combine(r.timeSeconds)
        h.combine(r.boardsSolved); h.combine(r.totalBoards); h.combine(r.hintsUsed); h.combine(r.completed)
        h.combine(r.profiles.username); h.combine(r.profiles.avatarUrl); h.combine(r.profiles.avatarEmoji)
        h.combine(r.profiles.accentColor); h.combine(r.profiles.avatarCastId); h.combine(r.profiles.avatarFrame)
    }
    return h.finalize()
}

func lbFriendsSignature(_ friends: [FriendsService.FriendProfile]) -> Int {
    var h = Hasher()
    h.combine(friends.count)
    for f in friends { h.combine(f.id); h.combine(f.username); h.combine(f.avatar_url) }
    return h.finalize()
}

/// Builds the board rows from plain values (the tab's old `row` / `ghostRow`, unchanged in what they draw).
struct LbRowMaker {
    let mode: GameMode
    let friendsOnly: Bool
    let meId: String?
    let crownId: String?
    /// The tie-aware point labels of the board being drawn (computed once, not once per row).
    let labels: [Double: String]
    let onTaunt: (FriendsService.FriendProfile) -> Void

    func row(rank: Int, entry: LeaderboardEntry, labels override: [Double: String]? = nil) -> some View {
        let isMe = entry.userId == meId
        return LbBoardRow(rank: rank, userId: entry.userId, username: entry.username,
                          avatarUrl: entry.profiles.avatarUrl, emoji: entry.profiles.avatarEmoji,
                          won: entry.completed,
                          points: (override ?? labels)[entry.compositeScore] ?? formatScore(entry.compositeScore)) {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    LbRowName(name: entry.username, isMe: isMe)
                    if entry.userId == crownId { Icon3D(.crown, size: 15, label: "This week's leader") }
                }
                LbRowSub(text: lbDetailLine(entry, mode: mode))
            }
        } trailing: {
            // Friends board: one-tap canned taunt on any friend's row (§207).
            if friendsOnly && !isMe {
                Button {
                    onTaunt(.init(id: entry.userId, username: entry.username,
                                  avatar_url: entry.profiles.avatarUrl, level: 0,
                                  since: nil, requestedAt: nil))
                } label: {
                    Icon3D(.bell, size: 18) // ART_SPEC §5
                        .frame(width: 30, height: 34).contentShape(Rectangle())
                }
                .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
                .accessibilityLabel("Taunt \(entry.username)")
            }
        }
        .youRow(isMe)
    }

    /// One ghost row (§C2a shell, no rank / points), muted, with the taunt bell.
    func ghostRow(_ f: FriendsService.FriendProfile) -> some View {
        LbBoardRow(rank: nil, userId: f.id, username: f.username, avatarUrl: f.avatar_url) {
            VStack(alignment: .leading, spacing: 1) {
                LbRowName(name: f.username)
                LbRowSub(text: "Hasn't played yet")
            }
        } trailing: {
            Button { onTaunt(f) } label: {
                Icon3D(.bell, size: 18) // ART_SPEC §5
                    .frame(width: 30, height: 34).contentShape(Rectangle())
            }
            .buttonStyle(RoundIconButtonStyle.compact)   // 2.8 item 23: the family round icon, compact (row-sized)
            .accessibilityLabel("Nudge \(f.username)")
        }
        .padding(.horizontal, 4)
        .opacity(0.55)
    }
}

/// Ranks 4+ (plus your neighborhood and the friends' ghost rows) below the stage.
struct EquatableRanksBlock: View, Equatable {
    let entries: [LeaderboardEntry]
    let rankWindow: (startRank: Int, entries: [LeaderboardEntry])?
    let ghosts: [FriendsService.FriendProfile]
    let loading: Bool
    let maker: LbRowMaker
    // Equality inputs (the values above, folded).
    let key: Key
    @ObservedObject private var theme = ThemeManager.shared
    @AppStorage(CastSkin.debugKey) private var debugSeason = ""

    struct Key: Equatable {
        let mode: GameMode
        let friendsOnly: Bool
        let loading: Bool
        let meId: String?
        let crownId: String?
        let rows: Int
        let window: Int
        let windowStart: Int?
        let ghosts: Int
    }

    init(entries: [LeaderboardEntry], rankWindow: (startRank: Int, entries: [LeaderboardEntry])?,
         ghosts: [FriendsService.FriendProfile], loading: Bool, maker: LbRowMaker) {
        self.entries = entries; self.rankWindow = rankWindow; self.ghosts = ghosts; self.loading = loading; self.maker = maker
        key = Key(mode: maker.mode, friendsOnly: maker.friendsOnly, loading: loading, meId: maker.meId, crownId: maker.crownId,
                  rows: lbRowsSignature(entries), window: lbRowsSignature(rankWindow?.entries ?? []),
                  windowStart: rankWindow?.startRank, ghosts: lbFriendsSignature(ghosts))
    }

    static func == (a: EquatableRanksBlock, b: EquatableRanksBlock) -> Bool { a.key == b.key }

    var body: some View {
        if !loading {
            if entries.isEmpty {
                if maker.friendsOnly && !ghosts.isEmpty {
                    // Nobody's played yet — the friends list still renders as ghost rows so the board feels alive (and tauntable).
                    VStack(spacing: 0) {
                        ForEach(Array(ghosts.enumerated()), id: \.element.id) { idx, f in
                            maker.ghostRow(f).stripedRow(idx, accent: LbStyle.gold)
                        }
                    }
                    .lbCard()
                }
            } else {
                let ranks = entries.indices.map { LeaderboardService.competitionRank(entries, $0) }
                let start = PodiumLayout.layout(ranks).filled
                let shown = entries.count - start
                let windowCount = rankWindow?.entries.count ?? 0
                if shown > 0 || rankWindow != nil || (maker.friendsOnly && !ghosts.isEmpty) {
                    LbRankStack {
                        ForEach(Array(entries.enumerated().dropFirst(start)), id: \.element.id) { idx, entry in
                            maker.row(rank: ranks[idx], entry: entry)
                                .stripedRow(idx - start, accent: LbStyle.gold)
                        }
                        // "Your neighborhood" — rows around the user's rank when they placed past the top 50 (web daily page parity).
                        if let win = rankWindow {
                            Text("···").font(Brand.font(15, .black)).foregroundStyle(FinishInk.secondary)
                                .frame(maxWidth: .infinity).padding(.vertical, 4)
                                .accessibilityLabel("More players")
                            ForEach(Array(win.entries.enumerated()), id: \.element.id) { idx, entry in
                                maker.row(rank: win.startRank + idx, entry: entry)
                                    .stripedRow(shown + idx, accent: LbStyle.gold)
                            }
                        }
                        // FRIENDS ghost rows — friends who haven't played this mode today, muted, with the taunt bell (§207).
                        if maker.friendsOnly {
                            ForEach(Array(ghosts.enumerated()), id: \.element.id) { idx, f in
                                maker.ghostRow(f).stripedRow(shown + windowCount + idx, accent: LbStyle.gold)
                            }
                        }
                    }
                    .lbCard()
                }
            }
        }
    }
}

/// Yesterday's ledge (top three on small steps; tap to open the full list) for a game's board.
struct EquatableYesterdayBlock: View, Equatable {
    let yesterday: [LeaderboardEntry]
    /// nil = not loaded yet (the ledge shows its skeleton, never "No results").
    let known: Bool
    @Binding var open: Bool
    let sharing: Bool
    let maker: LbRowMaker
    let labels: [Double: String]
    let onShare: () -> Void
    let key: Key
    @ObservedObject private var theme = ThemeManager.shared
    @AppStorage(CastSkin.debugKey) private var debugSeason = ""

    struct Key: Equatable {
        let mode: GameMode
        let friendsOnly: Bool
        let known: Bool
        let open: Bool
        let sharing: Bool
        let meId: String?
        let rows: Int
    }

    init(yesterday: [LeaderboardEntry], known: Bool, open: Binding<Bool>, sharing: Bool, maker: LbRowMaker,
         labels: [Double: String], onShare: @escaping () -> Void) {
        self.yesterday = yesterday; self.known = known; _open = open; self.sharing = sharing
        self.maker = maker; self.labels = labels; self.onShare = onShare
        key = Key(mode: maker.mode, friendsOnly: maker.friendsOnly, known: known, open: open.wrappedValue, sharing: sharing,
                  meId: maker.meId, rows: lbRowsSignature(yesterday))
    }

    static func == (a: EquatableYesterdayBlock, b: EquatableYesterdayBlock) -> Bool { a.key == b.key }

    var body: some View {
        // The stage's base: Yesterday's top three on the ledge; tap to expand the full list in place.
        let yRanks = yesterday.indices.map { LeaderboardService.competitionRank(yesterday, $0) }
        let yLayout = PodiumLayout.layout(yRanks)
        StageYesterdayLedge(
            minis: yesterday.prefix(yLayout.filled).enumerated().map { podiumPlace($1, rank: yRanks[$0]) },
            open: $open, loading: !known,
            share: {
                // Settled-podium share — only with rows.
                if !yesterday.isEmpty {
                    LbShareButton(busy: sharing, label: "Share yesterday's podium", action: onShare)
                }
            },
            expanded: {
                if !known {
                    LeaderboardSkeleton().lbCard()
                } else if yesterday.isEmpty {
                    BrandEmptyState(title: "Quiet yesterday", line: "No results from yesterday. Today's board is wide open.",
                                    scene: .asleep, artHeight: 90)
                        .lbCard()
                } else {
                    // Full daily rows (founder ask, Aug 11): profile links, guesses + time detail, W/L badge.
                    VStack(spacing: 0) {
                        ForEach(Array(yesterday.enumerated().dropFirst(yLayout.filled)), id: \.element.id) { idx, entry in
                            maker.row(rank: yRanks[idx], entry: entry, labels: labels)
                                .stripedRow(idx - yLayout.filled, accent: LbStyle.gold)
                        }
                    }
                    .lbCard()
                }
            })
    }

    /// One podium place from a board row (tie-aware points) — the tab's `podiumEntry`, for yesterday's mini podium.
    private func podiumPlace(_ e: LeaderboardEntry, rank: Int) -> PodiumEntry {
        let isMe = e.userId.lowercased() == maker.meId?.lowercased()
        let bell: (() -> Void)? = maker.friendsOnly && !isMe ? {
            maker.onTaunt(.init(id: e.userId, username: e.username, avatar_url: e.profiles.avatarUrl, level: 0,
                                since: nil, requestedAt: nil))
        } : nil
        return PodiumEntry(id: e.userId, name: isMe ? "You" : e.username, username: e.username,
                           accentHex: e.profiles.accentColor, emoji: e.profiles.avatarEmoji,
                           value: labels[e.compositeScore] ?? formatScore(e.compositeScore),
                           avatarUrl: e.profiles.avatarUrl, rank: rank, bell: bell, detail: lbDetailLine(e, mode: maker.mode))
    }
}

/// The ranked rows' stack (A/B: `-perfFlag lazyRanks` builds only the rows near the viewport).
struct LbRankStack<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        #if DEBUG
        if PerfTour.flag("lazyRanks") { LazyVStack(spacing: 0) { content() } } else { VStack(spacing: 0) { content() } }
        #else
        VStack(spacing: 0) { content() }
        #endif
    }
}
