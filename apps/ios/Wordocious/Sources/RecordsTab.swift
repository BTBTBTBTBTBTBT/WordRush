import SwiftUI
import Supabase
import WordociousCore

/// All-time "hall of records" from Supabase all_time_records.
/// Mirrors app/records/page.tsx. Records redesign (founder, 2026-10-01; spec
/// docs/RECORDS_REDESIGN_SPEC.md): the Records banner (ALL-TIME RECORDS, the
/// DAILY | ALL-TIME pill switch and the shared game rows) replaces the old header,
/// toggle row and mode picker; everything below wears the Leaderboard's look
/// (LeaderboardKit). Your own records fold into the Stats tab (D2 step 3).
struct RecordsTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var tab: RecordsSubTab = .daily   // web default
    @State private var showAuth = false
    // Each view keeps its own game pick (web parity: dailyMode / allTimeMode);
    // the banner shows the active view's.
    @State private var dailyMode: GameMode = .duel
    @State private var dailySweep = false
    @State private var allTimeMode: GameMode = .duel
    @State private var allTimeSweep = false
    @Environment(\.dismiss) private var dismiss
    /// The sheet's own navigation path (the podium's places push a profile on it).
    @State private var path: [String] = []

    enum RecordsSubTab { case daily, allTime }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                PageBackground(tint: .leaderboard)
                VStack(spacing: 0) {
                    AppHeaderView()
                    content
                }
            }
            .environment(\.pageTint, .leaderboard)
            .environment(\.lbOpenProfile, { path.append($0) })
            .toolbar(.hidden, for: .navigationBar)
            // Tapping a record holder / daily-row username opens their public profile
            // (web parity — Records links names to /profile/[id]).
            .navigationDestination(for: String.self) { PublicProfileView(userId: $0) }
        }
    }

    @ViewBuilder private var content: some View {
        if !auth.isAuthenticated {
            VStack(spacing: 16) {
                placeholder(icon: "crown.fill", title: "Sign in to see records",
                            subtitle: "Daily rankings and the all-time hall of records are available to signed-in players.")
                Button { showAuth = true } label: {
                    CandyLabel(title: "Sign in", symbol: "person.crop.circle.fill")
                }
                .buttonStyle(CandyButtonStyle(variant: .purple, size: .large, fullWidth: false))
            }
            .padding(.top, 24)
            .softSheet(isPresented: $showAuth) { AuthView() }
        } else {
            ScrollView {
                VStack(spacing: 10) {
                    switch tab {
                    case .daily:   DailyRecordsView(tab: $tab, mode: $dailyMode, isSweep: $dailySweep)
                    case .allTime: AllTimeRecordsView(tab: $tab, mode: $allTimeMode, isSweep: $allTimeSweep)
                    }

                    // D2 step 3 (2026-09-26): your own records live on the Stats tab now.
                    Button {
                        dismiss()
                        NotificationCenter.default.post(name: .openStats, object: nil)
                    } label: {
                        CandyLabel(title: "Your records → Stats", symbol: "chart.bar.fill")
                    }
                    .buttonStyle(CandyButtonStyle(variant: .peach, size: .medium, fullWidth: false))
                    .accessibilityLabel("Your personal records in Stats")
                    .padding(.top, 4)
                }
                .padding(.horizontal, 16).padding(.top, 8)
                // Nav clearance + the ad banner's height when it's mounted
                // (free accounts) — without the banner share, "Your Trophy
                // Shelf"'s last rows hid under the ad and couldn't scroll up.
                .padding(.bottom, 80)
            }
        }
    }
}

/// The Sweep board's accent on Records (matches the banner's gold SWEEP chip).
private let recordsSweepAccent = Color(hex: 0xF59E0B)

/// All-Time records — Hall of Fame (global) + By Game Mode (the game picked in the banner).
struct AllTimeRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @Binding var tab: RecordsTab.RecordsSubTab
    @Binding var mode: GameMode
    // Sweep chip — the all-time sweep ranking (lifetime sweep totals).
    @Binding var isSweep: Bool
    /// Session copy of the last fetch: re-opening All-Time paints it in the first frame and
    /// revalidates underneath (founder, 2026-09-29: the card skeleton showed on every open).
    /// BI19: persisted through StatsMemo, so a cold launch paints the Hall of Fame too.
    private static var cachedRecords: [AllTimeRecord]? {
        get { StatsMemo.shared.get("allTimeRecords") }
        set { if let newValue, !newValue.isEmpty { StatsMemo.shared.set("allTimeRecords", newValue) } }
    }
    @State private var records: [AllTimeRecord] = Self.cachedRecords ?? []
    @State private var loading = Self.cachedRecords == nil
    @State private var sweepEntries: [AllTimeSweepEntry] = []
    @State private var sweepRank: (rank: Int, total: Int)?
    @State private var sweepLoading = false

    /// Every daily-recordable mode (sweep tiles + More Games titles) — lookup
    /// only, for the picked mode's title/icon/accent.
    private let pickerModes: [HomeMode] = (homeModes + moreModes).filter { $0.dbKey != nil }
    private var myId: String? { auth.profile?.id }

    private var modeSelection: Binding<GameMode> {
        Binding(get: { mode }, set: { new in instantly { mode = new } })
    }

    var body: some View {
        // BJ7: 10 between blocks, record cards that hug their content.
        VStack(alignment: .leading, spacing: 10) {
            RecordsBannerView(tab: $tab, selected: modeSelection, isSweep: sweepSelection,
                              recordsCount: loading ? nil : records.count)
            if loading { CardsSkeleton().padding(.horizontal, 12).lbCard() } else {   // web parity: AllTimeSkeleton card blocks
                // Hall of Fame — each record a soft card.
                LbSectionLabel("HALL OF FAME").padding(.top, 2)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(RecordCatalog.global, id: \.self) { rt in
                        RecordStatCell(type: rt, record: globalRecord(rt), accent: Color(hex: 0xD97706), isMe: globalRecord(rt)?.holderId == myId)
                    }
                }

                // By Game Mode — only the game picked in the banner.
                LbSectionLabel("BY GAME MODE").padding(.top, 4)
                if isSweep {
                    sweepSection
                } else {
                    let m = pickerModes.first { $0.dbKey == mode.rawValue }
                    let accent = m?.accent ?? ModeStyle.accent(mode)
                    LbGameHeaderCard(accent: accent, icon: m?.icon ?? .symbol("trophy"),
                                     title: m?.title ?? mode.rawValue, sub: "All-time bests", mode: mode,
                                     right: { EmptyView() }, extra: { EmptyView() })
                        .id(mode)
                    if RecordCatalog.perMode.contains(where: { modeRecord($0) != nil }) {
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                            ForEach(RecordCatalog.perMode, id: \.self) { rt in
                                RecordStatCell(type: rt, record: modeRecord(rt), accent: accent, isMe: modeRecord(rt)?.holderId == myId, gameMode: mode.rawValue)
                            }
                        }
                    } else {
                        // Web parity (records page): a host + "No records yet" instead of a dash grid.
                        emptyCard("No records yet", "Every daily you finish can set one. The board starts with you.")
                    }
                }
            }
        }
        // Re-entering All-Time with Sweep picked: the cached ranking in the first frame.
        .onAppear { if isSweep { paintCachedSweep() } }
        .task {
            // Same single fetch per open as before; a cached copy is already on screen.
            if let fresh = try? await RecordsService.fetchAll() { records = fresh; Self.cachedRecords = fresh }
            else if Self.cachedRecords == nil { records = [] }
            loading = false
        }
        .task(id: "sweep-\(isSweep)") { if isSweep { await loadSweep() } }
    }

    private func emptyCard(_ title: String, _ text: String) -> some View {
        // R, sleepy in the nightcap: "quiet in here" (MASCOT_SPEC §1); BI24: brand
        // headline over the voice line.
        BrandEmptyState(title: title, line: text, scene: .asleep, artHeight: 76)
        .frame(maxWidth: .infinity)
        .lbCard()
    }

    /// The Sweep chip paints the cached ranking in the same transaction as the selection
    /// (founder, 2026-09-29: one frame of "No sweeps yet" before loadSweep ran).
    private var sweepSelection: Binding<Bool> {
        Binding(get: { isSweep }, set: { on in instantly { isSweep = on; if on { paintCachedSweep() } } })
    }

    private func paintCachedSweep() {
        if let cached = SweepCache.shared.allTime {
            sweepEntries = cached.entries
            sweepRank = cached.userRank
            sweepLoading = false
        } else {
            sweepLoading = true
            sweepRank = nil
            sweepEntries = []
        }
    }

    /// The all-time sweep ranking — players ranked by lifetime sweep count
    /// (sweeps · flawless · best sweep time): header card, your rank, the board.
    @ViewBuilder private var sweepSection: some View {
        let total = sweepRank?.total ?? sweepEntries.count
        LbGameHeaderCard(accent: recordsSweepAccent, icon: .asset("broom"), title: "Sweep · All-Time",
                         sub: "Most daily sweeps ever · \(total) sweeper\(total == 1 ? "" : "s")", subSymbol: "person.2.fill",
                         art: "game-sweep")
        if let r = sweepRank {
            let mine = sweepEntries.first { $0.userId == myId }
            // §C2: the gold result card — your rank, your sweep record, your sweep count.
            LbResultCard(rank: r.rank, ofLine: "OF \(r.total) SWEEPERS",
                         line: mine.map { "\($0.flawlessCount) flawless · best \(formatShortTime($0.bestSweepTime))" },
                         points: mine.map { "\($0.sweepCount)" }, pointsLabel: "SWEEPS",
                         headline: "YOU\u{2019}RE #\(r.rank) ALL-TIME")
        }
        if sweepLoading {
            LeaderboardSkeleton().lbCard()
        } else if sweepEntries.isEmpty {
            emptyCard("No sweeps yet", "Finish every daily in one day and you top this board. Be the first!")
        } else {
            VStack(spacing: 0) {
                ForEach(Array(sweepEntries.enumerated()), id: \.element.id) { idx, e in
                    allTimeSweepRow(e.rank, e)
                        .stripedRow(idx, accent: LbStyle.gold)
                }
            }
            .lbCard()
        }
    }

    private func allTimeSweepRow(_ rank: Int, _ e: AllTimeSweepEntry) -> some View {
        let isMe = e.userId == myId
        // Doug's Aug-16 feedback (leaderboard row shape): stats under the
        // name so the name keeps the row's flexible width. §C2a: the empty W / L
        // slot keeps the sweep counts in one column.
        return LbBoardRow(rank: rank, userId: e.userId, username: e.username, avatarUrl: e.avatarUrl,
                          won: nil, points: "\(e.sweepCount)") {
            VStack(alignment: .leading, spacing: 1) {
                LbRowName(name: e.username, isMe: isMe, userId: e.userId)
                LbRowSub(text: "\(e.sweepCount) sweep\(e.sweepCount == 1 ? "" : "s") · \(e.flawlessCount) flawless · \(formatShortTime(e.bestSweepTime))")
            }
        }
        .youRow(isMe)
    }

    private func loadSweep() async {
        paintCachedSweep()

        let fetchedOpt = try? await SweepLeaderboardService.fetchAllTimeSweep()
        guard !Task.isCancelled else { return }
        guard let fetched = fetchedOpt else { sweepLoading = false; return }
        sweepEntries = fetched
        sweepLoading = false

        var rank: (rank: Int, total: Int)? = nil
        if let uid = myId {
            rank = await SweepLeaderboardService.allTimeSweepRank(userId: uid)
            guard !Task.isCancelled else { return }
            sweepRank = rank
        }
        SweepCache.shared.allTime = .init(entries: fetched, userRank: rank)
    }

    private func globalRecord(_ rt: String) -> AllTimeRecord? {
        records.first { $0.gameMode == nil && $0.recordType == rt }
    }
    private func modeRecord(_ rt: String) -> AllTimeRecord? {
        // A mode can have both a solo and a VS record per type; the per-mode
        // card represents solo play, so prefer the solo row (else fall back to
        // whatever exists). Without this, e.g. Classic "Most Games Played" could
        // show the tiny VS count instead of the solo total.
        let matches = records.filter { $0.gameMode == mode.rawValue && $0.recordType == rt }
        return matches.first { $0.playType == "solo" } ?? matches.first
    }
}

/// A single record as a soft card (records redesign §2, web RecordCard): the game's
/// tile chip with the record glyph, the record name in caps, the value big, the holder's
/// avatar + name, and a small gold crown (plus your-row tint) on records you hold.
struct RecordStatCell: View {
    let type: String
    let record: AllTimeRecord?
    let accent: Color
    let isMe: Bool
    /// The card's mode (per-mode grid) — titles the fewest-guesses cell through
    /// its guess semantics even while the record itself is still nil.
    var gameMode: String? = nil
    var body: some View {
        let meta = RecordCatalog.labels[type]
        let has = record != nil
        let mine = isMe && has
        // BJ7: one top line (chip + name + crown, top-aligned), the value 4 under it,
        // the card hugs its content (no 110 floor; rows of the grid match by content).
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(accent.opacity(Theme.isDark ? 0.18 : 0.14))
                    SymbolGlyph(meta?.symbol ?? "rosette", size: 13, weight: .semibold)
                        .foregroundStyle(has ? accent : Theme.textMuted)
                }
                .frame(width: 28, height: 28)
                // Founder rule 10-10: the record's name is bubble lettering (wraps to two lines at most, shrinks to fit).
                BubbleTextView(text: RecordCatalog.label(type, gameMode: record?.gameMode ?? gameMode).uppercased(),
                               palette: .accent(has ? accent : Theme.textMuted), maxSize: 12, minSize: 8, animated: false, alignment: .leading)
                    .frame(minHeight: 30, alignment: .topLeading)
                Spacer(minLength: mine ? 16 : 0)
            }
            // §254: hints on the record, same wording as the leaderboard rows, set small.
            // §A2: the record value as a soft number.
            (Text(record?.valueText ?? "—").font(Brand.font(22, .black)).foregroundColor(has ? FinishInk.number : Theme.textMuted)
             + Text(record?.hintsSuffix ?? "").font(Brand.font(12, .bold)).foregroundColor(Theme.textMuted))
                .softNumber(22)
                .lineLimit(1).minimumScaleFactor(0.6)
            if let record {
                NavigationLink(value: record.holderId) {
                    HStack(spacing: 6) {
                        AvatarView(url: record.profiles.avatarUrl, username: record.holderUsername, size: 20)
                        BubbleOneLine(text: record.holderUsername.uppercased(),
                                      palette: .accent(mine ? Color(hex: 0xD97706)
                                                            : PlayerTint.nameColor(userId: record.holderId, username: record.holderUsername, onLight: !Theme.isDark)),
                                      size: 13, minScale: 0.45, alignment: .leading)
                    }
                }.buttonStyle(.squish)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        // §A1: a tinted card in the record's color with its top bar; a record you hold
        // is gold with a stronger tint.
        .tintedCard(accent: mine ? Color(hex: 0xF59E0B) : accent,
                    bar: mine ? [Color(hex: 0xF5A524), Color(hex: 0xFFD166)] : [accent, accent.wash(0.55)],
                    radius: 16, barHeight: 5, tint: mine ? 0.16 : 0.08, line: mine ? 0.45 : 0.24)
        .overlay(alignment: .topTrailing) {
            if mine {
                Icon3D(.crown, size: 16, label: "Your record")
                    .padding(.top, 11).padding(.trailing, 10)
            }
        }
    }
}

/// A Records board row — exactly the Leaderboard row (§C2a): medal disc, avatar, name
/// over the stats line (guesses · time · boards · hints), the W / L badge in its own
/// column, points at the right as a soft number, your row tinted with the amber ring.
/// Shared by the Daily board and yesterday's winners.
struct RecordsBoardRow: View {
    let rank: Int
    let entry: LeaderboardEntry
    let mode: GameMode
    let isMe: Bool
    let score: String

    private var line: String { lbDetailLine(entry, mode: mode) }

    var body: some View {
        // §C2a: the W / L badge in its own column immediately left of the points.
        LbBoardRow(rank: rank, userId: entry.userId, username: entry.username,
                   avatarUrl: entry.profiles.avatarUrl, emoji: entry.profiles.avatarEmoji,
                   won: entry.completed, points: score) {
            VStack(alignment: .leading, spacing: 1) {
                LbRowName(name: entry.username, isMe: isMe, userId: entry.userId)
                LbRowSub(text: line)
            }
        }
        .youRow(isMe)
    }
}

/// Daily records — today's board for the game picked in the banner, with Solo | VS and
/// Everyone | Friends.
struct DailyRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @Binding var tab: RecordsTab.RecordsSubTab
    @Binding var mode: GameMode
    // Sweep chip — the cross-mode "completed every sweep daily today" board.
    @Binding var isSweep: Bool
    @State private var playType = "solo"
    @State private var entries: [LeaderboardEntry] = []
    @State private var userRank: (rank: Int, total: Int)?
    // "Your neighborhood" rows when the user placed past the top-50 list
    // (e.g. #425 sees ~421–429 below a "···" separator, own row highlighted).
    @State private var rankWindow: (startRank: Int, entries: [LeaderboardEntry])?
    @State private var loading = false
    @State private var reloadToken = 0
    @State private var sweepEntries: [SweepEntry] = []
    @State private var sweepRank: (rank: Int, total: Int)?
    @State private var sweepLoading = false
    // §232: dot-strip + guess/hint detail — daily-board parity (founder ask,
    // Aug 24: Records' sweep rows must match the leaderboard's sweep section).
    @State private var sweepDetails: [String: LeaderboardService.SweepDetails] = [:]
    // §248: current flawless streaks for FLAWLESS rows — the ×N pills.
    @State private var flawlessStreaks: [String: Int] = [:]
    // FRIENDS (§207; records redesign, web/Android parity): Everyone | Friends —
    // the same query restricted to friends ∪ me, ranks 1…N, per-mode only (the
    // Sweep board, yesterday's podium and All-Time stay unfiltered).
    @State private var friendsOnly = false
    @State private var friendsVersion = 0
    // TIE-AWARE score display (web parity): rows sharing a whole number on the
    // same board render the decimals that rank them.
    private var lbScoreLabels: [Double: String] { tieAwareScoreLabels(entries.map(\.compositeScore)) }
    private var sweepScoreLabels: [Double: String] { tieAwareScoreLabels(sweepEntries.map(\.totalScore)) }
    // LEADERBOARD SHARE — this view owns the Solo/VS toggle, so its share
    // button is where the VS Battle card variant comes from. Sweep has no
    // card design (web records/page.tsx parity).
    @State private var sharingLb = false

    /// Every daily-recordable mode — lookup only (the picked mode's title/icon/accent).
    private let pickerModes: [HomeMode] = (homeModes + moreModes).filter { $0.dbKey != nil }
    private var accent: Color { pickerModes.first { $0.dbKey == mode.rawValue }?.accent ?? ModeStyle.accent(mode) }
    /// The Friends board is live only for a signed-in player.
    private var friends: Bool { friendsOnly && auth.profile?.id != nil }

    /// The picked board paints from the cache in the FIRST frame (founder, 2026-09-29: opening
    /// Records showed "No results yet today" for a frame before load() ran).
    init(tab: Binding<RecordsTab.RecordsSubTab>, mode: Binding<GameMode>, isSweep: Binding<Bool>) {
        _tab = tab
        _mode = mode
        _isSweep = isSweep
        let key = LeaderboardCache.key(mode: mode.wrappedValue, userId: AuthService.shared.profile?.id, playType: "solo")
        if let c = LeaderboardCache.shared[key] {
            _entries = State(initialValue: c.entries)
            _userRank = State(initialValue: c.userRank)
            _rankWindow = State(initialValue: c.rankWindow)
        } else {
            _loading = State(initialValue: true)
        }
    }

    /// Mode, Solo|VS, Everyone|Friends and Sweep selections paint their cached board in the
    /// same transaction as the selection (the LeaderboardTab fix, founder 2026-09-29) — never
    /// the previous board's rows and rank under the new header for a frame.
    private var modeSelection: Binding<GameMode> {
        Binding(get: { mode }, set: { new in instantly { mode = new; paintCached() } })
    }
    private var sweepSelection: Binding<Bool> {
        Binding(get: { isSweep }, set: { on in instantly { isSweep = on; if on { paintCachedSweep() } } })
    }

    private var cacheKey: String {
        LeaderboardCache.key(mode: mode, userId: auth.profile?.id, playType: playType) + (friends ? ":friends" : "")
    }

    private func paintCached() {
        if let cached = LeaderboardCache.shared[cacheKey] {
            entries = cached.entries
            userRank = cached.userRank
            rankWindow = cached.rankWindow
            loading = false
        } else {
            loading = true
            userRank = nil
            rankWindow = nil
            entries = []
        }
    }

    private func paintCachedSweep() {
        if let cached = SweepCache.shared.daily(SweepCache.dailyKey()) {
            sweepEntries = cached.entries
            sweepRank = cached.userRank
            sweepDetails = cached.details
            sweepLoading = false
        } else {
            sweepLoading = true
            sweepRank = nil
            sweepEntries = []
            sweepDetails = [:]
        }
    }

    private func share() {
        guard !sharingLb else { return }
        sharingLb = true
        Task {
            await LeaderboardShareFlow.shareDaily(
                mode: mode, playType: playType,
                entries: entries, rankWindow: rankWindow,
                userId: auth.profile?.id, userRank: userRank,
                friends: friends)
            sharingLb = false
        }
    }

    private func topPercent(_ r: (rank: Int, total: Int)) -> String {
        r.total > 1 ? " · TOP \(max(1, Int((Double(r.rank) / Double(r.total) * 100).rounded())))%" : ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            RecordsBannerView(tab: $tab, selected: modeSelection, isSweep: sweepSelection)
            if isSweep { sweepBoard } else { modeBoard }
        }
        // Re-entering Daily with Sweep picked: the cached board in the first frame.
        .onAppear { if isSweep { paintCachedSweep() } }
        .task(id: "\(mode.rawValue)-\(playType)-\(friendsOnly)-\(friendsVersion)-\(reloadToken)") { await load() }
        .task(id: "sweep-\(isSweep)-\(reloadToken)") { if isSweep { await loadSweep() } }
        .task { if auth.isAuthenticated { await FriendsService.load() } }
        .onReceive(NotificationCenter.default.publisher(for: FriendsService.changed)) { _ in
            friendsVersion = FriendsService.version
        }
        .onDailyRecorded { reloadToken += 1 }
    }

    // MARK: Per-game board

    @ViewBuilder private var modeBoard: some View {
        let m = pickerModes.first { $0.dbKey == mode.rawValue }
        let total = userRank?.total ?? entries.count
        // Per-game board card: the game-tile CARD header with the Solo | VS and
        // Everyone | Friends pills and a bare share icon.
        LbGameHeaderCard(
            accent: accent, icon: m?.icon ?? .symbol("trophy"), title: m?.title ?? mode.rawValue,
            sub: "\(total) player\(total == 1 ? "" : "s") today", subSymbol: "person.2.fill",
            mode: mode,
            right: {
                if !loading && !entries.isEmpty {
                    LbShareButton(busy: sharingLb, label: "Share leaderboard", action: share)
                }
            },
            extra: {
                // The soft segmented toggles (Solo | VS, Everyone | Friends); each paints its
                // cached board in the same transaction as the selection.
                HStack(spacing: 8) {
                    // The candy toggle (night art 10-03 sprites).
                    CandySegmented(options: [(key: "solo", label: "Solo"), (key: "vs", label: "VS")],
                                   selection: playType, accessibilityLabel: "Solo or VS", height: 34) { t in
                        instantly { playType = t; paintCached() }
                    }
                    .frame(width: 140)
                    if auth.isAuthenticated {
                        SoftSegmented(options: [(key: false, label: "Everyone"), (key: true, label: "Friends")],
                                      selection: Binding(get: { friendsOnly },
                                                         set: { f in instantly { friendsOnly = f; paintCached() } }),
                                      accent: accent, accessibilityLabel: "Everyone or Friends")
                    }
                }
            })
            .id(mode)

        // §C2: ONE result card — your rank (as on the Leaderboard; the friends board
        // keeps its own movement history, never compared against the global rank), how
        // you did and your points, with the §254 completed-daily dropdown as its footer.
        // No rank → the dropdown alone. .id(mode) → a fresh card per mode: never the
        // previous mode's board under a new header.
        if let r = userRank {
            let mine = (entries + (rankWindow?.entries ?? [])).first { $0.userId == auth.profile?.id }
            LbResultCard(rank: r.rank,
                         ofLine: friends ? "OF \(r.total) FRIENDS" : "OF \(r.total) TODAY\(topPercent(r))",
                         line: mine.map {
                             lbSolveLine(mode: mode, completed: $0.completed, guessCount: $0.guessCount,
                                         timeSeconds: $0.timeSeconds, boardsSolved: $0.boardsSolved, totalBoards: $0.totalBoards)
                         },
                         points: mine.map { lbScoreLabels[$0.compositeScore] ?? formatScore($0.compositeScore) },
                         headline: "YOU\u{2019}RE #\(r.rank) \(friends ? "OF FRIENDS" : "TODAY")",
                         delta: {
                             RankDeltaBadge(mode: mode.rawValue, playType: playType,
                                            pageKey: friends ? "records-daily-friends" : "records-daily", currentRank: r.rank)
                         },
                         footer: { LbResultFooter { completedCard } })
        } else {
            completedCard
        }

        HStack(spacing: 8) {
            LbSectionLabel("TODAY\u{2019}S BOARD")
            Spacer(minLength: 4)
        }
        .padding(.top, 4).padding(.leading, 4)
        if loading {
            LeaderboardSkeleton().lbCard()   // web parity: animate-pulse rows
        } else if entries.isEmpty {
            emptyCard(friends ? "Friends are still asleep" : "No results yet", friends ? "None of your friends have played yet today." : "Nobody has finished today. Be the first!")
        } else {
            VStack(spacing: 0) {
                ForEach(Array(entries.enumerated()), id: \.element.id) { idx, e in
                    boardRow(idx + 1, e)
                        .stripedRow(idx, accent: LbStyle.gold)
                }
                if let win = rankWindow {
                    Text("···").font(Brand.font(15, .black)).foregroundStyle(FinishInk.secondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 4)
                        .accessibilityLabel("More players")
                    ForEach(Array(win.entries.enumerated()), id: \.element.id) { idx, e in
                        boardRow(win.startRank + idx, e)
                            .stripedRow(entries.count + idx, accent: LbStyle.gold)
                    }
                }
            }
            .lbCard()
        }

        YesterdayPodiumCard(mode: mode, playType: playType)
    }

    /// §254: the completed-daily dropdown, mounted exactly as the daily leaderboard mounts it.
    @ViewBuilder private var completedCard: some View {
        if mode.isCustomEngine { CustomCompletedDailyCard(mode: mode).id(mode) } else { CompletedDailyCard(mode: mode).id(mode) }
    }

    private func boardRow(_ rank: Int, _ e: LeaderboardEntry) -> some View {
        RecordsBoardRow(rank: rank, entry: e, mode: mode, isMe: e.userId == auth.profile?.id,
                        score: lbScoreLabels[e.compositeScore] ?? formatScore(e.compositeScore))
    }

    private func emptyCard(_ title: String, _ text: String) -> some View {
        // R, sleepy in the nightcap: "quiet in here" (MASCOT_SPEC §1); BI24: brand
        // headline over the voice line.
        BrandEmptyState(title: title, line: text, scene: .asleep, artHeight: 76)
        .frame(maxWidth: .infinity)
        .lbCard()
    }

    // MARK: Sweep board

    /// The daily-sweep board — the same stack as the per-mode board (header card,
    /// your rank, TODAY'S BOARD), filled with sweep rows. Everyone only.
    @ViewBuilder private var sweepBoard: some View {
        let total = sweepRank?.total ?? sweepEntries.count
        LbGameHeaderCard(accent: recordsSweepAccent, icon: .asset("broom"), title: "Daily Sweep",
                         sub: "All \(ModeGen.sweep.count) modes today · \(total) sweeper\(total == 1 ? "" : "s")",
                         subSymbol: "person.2.fill", art: "game-sweep")
        if let r = sweepRank {
            let mine = sweepEntries.first { $0.userId == auth.profile?.id }
            let day = LeaderboardService.todayLocal()
            LbResultCard(rank: r.rank, ofLine: "OF \(r.total) TODAY\(topPercent(r))",
                         line: mine.map {
                             "\($0.isFlawless ? "Flawless" : "Swept") · \($0.modesWon)/\(ModeGen.requiredSweepCount(for: day)) won · \(formatShortTime($0.totalTime))"
                         },
                         points: mine.map { sweepScoreLabels[$0.totalScore] ?? formatScore($0.totalScore) },
                         headline: "YOU\u{2019}RE #\(r.rank) TODAY")
        }
        LbSectionLabel("TODAY\u{2019}S BOARD").padding(.top, 4).padding(.leading, 4)
        if sweepLoading {
            LeaderboardSkeleton().lbCard()
        } else if sweepEntries.isEmpty {
            emptyCard("No sweeps yet", "Nobody has swept today. Be the first!")
        } else {
            VStack(spacing: 0) {
                ForEach(Array(sweepEntries.enumerated()), id: \.element.id) { idx, e in
                    sweepRow(e.rank, e)
                        .stripedRow(idx, accent: LbStyle.gold)
                }
            }
            .lbCard()
        }
    }

    // §232: daily-board parity (founder ask, Aug 24) — the same shape as
    // ProfileTab's sweepRow: stats under the name, the SweepModeDots strip with
    // the FLAWLESS/SWEEP pill riding it (§227).
    private func sweepRow(_ rank: Int, _ e: SweepEntry) -> some View {
        let isMe = e.userId == auth.profile?.id
        // §C2a: the empty W / L slot keeps the totals in one column.
        return LbBoardRow(rank: rank, userId: e.userId, username: e.username, avatarUrl: e.avatarUrl,
                          won: nil, points: sweepScoreLabels[e.totalScore] ?? formatScore(e.totalScore)) {
            LbSweepRowInfo(entry: e, isMe: isMe, details: sweepDetails[e.userId],
                           day: LeaderboardService.todayLocal(),
                           streak: flawlessStreaks[e.userId] ?? 0)
        }
        .youRow(isMe)
    }

    private func loadSweep() async {
        let cacheKey = SweepCache.dailyKey()
        paintCachedSweep()

        let fetchedOpt = try? await SweepLeaderboardService.fetchDailySweep()
        guard !Task.isCancelled else { return }
        guard let fetched = fetchedOpt else { sweepLoading = false; return }
        sweepEntries = fetched
        sweepLoading = false

        // §232 (§223 pattern): dot-strip + guess/hint detail rides in behind
        // the rows — the board paints first, dots fill in when the fetch lands.
        let details = await LeaderboardService.fetchSweepModeDetails(
            day: LeaderboardService.todayLocal(), userIds: fetched.map(\.userId))
        guard !Task.isCancelled else { return }
        sweepDetails = details
        // §248: only rows already FLAWLESS can be on a live streak.
        let streaks = await LeaderboardService.fetchFlawlessStreaks(
            day: LeaderboardService.todayLocal(),
            userIds: fetched.filter(\.isFlawless).map(\.userId))
        guard !Task.isCancelled else { return }
        flawlessStreaks = streaks

        var rank: (rank: Int, total: Int)? = nil
        if let uid = auth.profile?.id {
            rank = await SweepLeaderboardService.dailySweepRank(userId: uid)
            guard !Task.isCancelled else { return }
            sweepRank = rank
        }
        SweepCache.shared.setDaily(cacheKey, .init(entries: fetched, userRank: rank, details: details))
    }

    private func load() async {
        // P3: same L1/L2/L3 treatment as LeaderboardTab.load() —
        // stale-while-revalidate cache paint, rows painted the moment the
        // fetch lands (rank banner fills in after), index fast-path rank.
        let cacheKey = self.cacheKey
        paintCached()

        // FRIENDS board: one fetch restricted to friends ∪ me holds the whole
        // board — ranks 1…N, no rank query or neighborhood window.
        if friends, let uid = auth.profile?.id {
            let ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
            let fetchedOpt = try? await LeaderboardService.fetch(gameMode: mode, playType: playType, userIds: ids)
            guard !Task.isCancelled else { return }
            guard let fetched = fetchedOpt else { loading = false; return }
            entries = fetched
            loading = false
            let rank: (rank: Int, total: Int)? = fetched
                .firstIndex { $0.userId.lowercased() == uid.lowercased() }
                .map { (rank: $0 + 1, total: fetched.count) }
            userRank = rank
            rankWindow = nil
            LeaderboardCache.shared[cacheKey] = .init(entries: fetched, playerCount: fetched.count, userRank: rank, rankWindow: nil)
            return
        }

        let fetchedOpt = try? await LeaderboardService.fetch(gameMode: mode, playType: playType)
        // .task(id:) cancels on mode/playType switch — bail before assigning
        // so a slow prior response can't overwrite the new selection's rows.
        guard !Task.isCancelled else { return }
        // Network error (nil, not an empty day): keep whatever is showing and
        // never cache the failure.
        guard let fetched = fetchedOpt else { loading = false; return }
        entries = fetched
        loading = false

        var rank: (rank: Int, total: Int)? = nil
        var win: (startRank: Int, entries: [LeaderboardEntry])? = nil
        if let uid = auth.profile?.id {
            rank = await LeaderboardService.userRank(gameMode: mode, userId: uid, playType: playType, topEntries: fetched)
            guard !Task.isCancelled else { return }
            userRank = rank
            // Ranked past the visible list → also show the rows around them.
            if let r = rank, r.rank > 50 {
                win = await LeaderboardService.fetchRankWindow(gameMode: mode, playType: playType, userRank: r.rank)
                guard !Task.isCancelled else { return }
            }
            rankWindow = win
        }
        // Records never shows playerCount — preserve any value the daily
        // leaderboard tab cached under the same (solo) key rather than zeroing it.
        let pc = LeaderboardCache.shared[cacheKey]?.playerCount ?? 0
        LeaderboardCache.shared[cacheKey] = .init(entries: fetched, playerCount: pc, userRank: rank, rankWindow: win)
    }
}

/// Yesterday's top finishers for the selected mode (collapsible) — Records daily view.
/// Identical to the Leaderboard's YESTERDAY'S WINNERS: the caps label + chevron chip,
/// the bare share icon, the top three on the podium and the rest as full rows (avatar,
/// stats line, W / L column, points) in the cream card. Unfiltered.
struct YesterdayPodiumCard: View {
    let mode: GameMode
    let playType: String
    @EnvironmentObject private var auth: AuthService
    @Environment(\.lbOpenProfile) private var openProfile
    /// Settled podiums by "day:mode:playType" — session-lived (yesterday never changes), so a
    /// mode switch shows THAT mode's podium at once, never the previous mode's rows under the
    /// new board until the fetch lands (founder, 2026-09-29).
    private static var podiums: [String: [LeaderboardEntry]] = [:]
    @State private var version = 0
    private var key: String { "\(LeaderboardService.yesterdayLocal()):\(mode.rawValue):\(playType)" }
    /// nil = this podium hasn't loaded yet this session.
    private var known: [LeaderboardEntry]? { _ = version; return Self.podiums[key] }
    private var top3: [LeaderboardEntry] { known ?? [] }
    @State private var open = false
    @State private var sharing = false
    private var podiumScoreLabels: [Double: String] { tieAwareScoreLabels(top3.map(\.compositeScore)) }

    var body: some View {
        Group {
            // Unknown yet → keep the header row in place (a skeleton under it when open) rather
            // than collapsing the section and popping it back in.
            if known == nil || !top3.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Button { open.toggle() } label: {
                            HStack(spacing: 6) {
                                LbSectionLabel("YESTERDAY\u{2019}S WINNERS")
                                Image(systemName: open ? "chevron.up" : "chevron.down")
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundStyle(Theme.isDark ? Theme.textMuted : Color(hex: 0x8A6A55))
                            }
                            .padding(.horizontal, 12).frame(height: 30)
                            .tintedPill(LbStyle.gold)
                            .contentShape(Capsule())
                        }
                        .buttonStyle(.squish)
                        Spacer(minLength: 4)
                        // Settled-podium share — only once the podium is open with rows.
                        if open && !top3.isEmpty {
                            LbShareButton(busy: sharing, label: "Share yesterday's podium") {
                                guard !sharing else { return }
                                sharing = true
                                Task {
                                    await LeaderboardShareFlow.sharePodium(
                                        mode: mode, playType: playType,
                                        top3: top3, userId: auth.profile?.id)
                                    sharing = false
                                }
                            }
                        }
                    }
                    if open && known == nil {
                        LeaderboardSkeleton().lbCard()
                    } else if open {
                        // BJ4: the leaders on the podium from one result up (open spots for
                        // the free places, the stage in the game's color; a place opens that
                        // player, as their row did), then the rest.
                        let ranks = top3.indices.map { LeaderboardService.competitionRank(top3, $0) }
                        let layout = PodiumLayout.layout(ranks)
                        let start = layout.filled
                        VStack(spacing: 0) {
                            if start > 0 {
                                PodiumView(entries: top3.prefix(start).enumerated().map { i, e in
                                    PodiumEntry(id: e.userId,
                                                name: e.userId == auth.profile?.id ? "You" : e.username,
                                                username: e.username, accentHex: e.profiles.accentColor,
                                                emoji: e.profiles.avatarEmoji,
                                                value: podiumScoreLabels[e.compositeScore] ?? formatScore(e.compositeScore),
                                                avatarUrl: e.profiles.avatarUrl, rank: ranks[i],
                                                detail: lbDetailLine(e, mode: mode))
                                }, open: layout.open, stage: ModeStyle.accent(mode), onTap: { e in openProfile?(e.id) })
                            }
                            ForEach(Array(top3.enumerated().dropFirst(start)), id: \.element.id) { i, e in
                                RecordsBoardRow(rank: i + 1, entry: e, mode: mode,
                                                isMe: e.userId == auth.profile?.id,
                                                score: podiumScoreLabels[e.compositeScore] ?? formatScore(e.compositeScore))
                                    .stripedRow(i - start, accent: LbStyle.gold)
                            }
                        }
                        .lbCard()
                    }
                }
                .padding(.top, 4)
            }
        }
        .task(id: key) {
            let k = key
            let rows = (try? await LeaderboardService.fetch(gameMode: mode, day: LeaderboardService.yesterdayLocal(), playType: playType, limit: 5)) ?? []
            guard !Task.isCancelled else { return }
            Self.podiums[k] = rows
            version += 1
        }
    }
}

/// Posted by the Records sheet's "Your personal records → Stats" link
/// (D2 step 3); RootTabView lands the player on the Stats tab.
extension Notification.Name {
    static let openStats = Notification.Name("wordocious.open-stats")
}
