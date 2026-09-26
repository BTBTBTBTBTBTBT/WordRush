import SwiftUI
import Supabase
import WordociousCore

/// All-time "hall of records" from Supabase all_time_records.
/// Mirrors app/records/page.tsx: RECORDS header + Daily | All-Time toggle (the
/// global views only — your own records fold into the Stats tab, D2 step 3).
struct RecordsTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var tab: RecordsSubTab = .daily   // web default
    @State private var showAuth = false
    @Environment(\.dismiss) private var dismiss

    enum RecordsSubTab { case daily, allTime }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [Theme.background, Theme.backgroundGradientEnd],
                               startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                VStack(spacing: 0) {
                    AppHeaderView()
                    content
                }
            }
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
                Button("Sign in") { showAuth = true }.buttonStyle(.borderedProminent).tint(Theme.primary)
            }
            .sheet(isPresented: $showAuth) { AuthView() }
        } else {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(spacing: 3) {
                        Text("RECORDS").font(Brand.font(28, .black))
                            .foregroundStyle(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing))
                        Text("The best of the best across Wordocious")
                            .font(Brand.body(12)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 6)

                    HStack(spacing: 8) {
                        toggleButton("Daily", .daily)
                        toggleButton("All-Time", .allTime)
                    }

                    switch tab {
                    case .daily:   DailyRecordsView()
                    case .allTime: AllTimeRecordsView()
                    }

                    // D2 step 3 (2026-09-26): your own records live on the Stats tab now.
                    Button {
                        dismiss()
                        NotificationCenter.default.post(name: .openStats, object: nil)
                    } label: {
                        Text("Your personal records → Stats")
                            .font(Brand.font(11, .black)).foregroundStyle(Color(hex: 0x7C3AED))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 8)
                }
                .padding(.horizontal, 12)
                // Nav clearance + the ad banner's height when it's mounted
                // (free accounts) — without the banner share, "Your Trophy
                // Shelf"'s last rows hid under the ad and couldn't scroll up.
                .padding(.bottom, 80)
            }
        }
    }

    private func toggleButton(_ label: String, _ value: RecordsSubTab) -> some View {
        let active = tab == value
        return Button { tab = value } label: {
            Text(label).font(Brand.font(12, .heavy))
                .foregroundStyle(active ? Theme.primary : Theme.textMuted)
                .frame(maxWidth: .infinity).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.surface : Theme.surfaceHover))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }
}

/// All-Time records — Hall of Fame (global) + By Game Mode (mode picker).
struct AllTimeRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var records: [AllTimeRecord] = []
    @State private var mode: GameMode = .duel
    @State private var loading = true
    // Sweep tile — the all-time sweep ranking (lifetime sweep totals).
    @State private var isSweep = false
    @State private var sweepEntries: [AllTimeSweepEntry] = []
    @State private var sweepRank: (rank: Int, total: Int)?
    @State private var sweepLoading = false
    private let sweepAccent = Color(hex: 0x4F46E5)

    /// Every daily-recordable mode (sweep tiles + More Games titles) — lookup
    /// only, for the picked mode's title/icon/accent.
    private let pickerModes: [HomeMode] = (homeModes + moreModes).filter { $0.dbKey != nil }
    private var myId: String? { auth.profile?.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if loading { CardsSkeleton() } else {   // web parity: AllTimeSkeleton card blocks
                // Hall of Fame
                Text("HALL OF FAME").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2).fill(LinearGradient(colors: [Color(hex: 0xF59E0B), Theme.goldBorder], startPoint: .leading, endPoint: .trailing)).frame(height: 3)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        ForEach(RecordCatalog.global, id: \.self) { rt in
                            RecordStatCell(type: rt, record: globalRecord(rt), accent: Color(hex: 0xD97706), isMe: globalRecord(rt)?.holderId == myId)
                        }
                    }
                    .padding(16)
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                // Clip so the 3pt top accent bar's square corners don't poke
                // past the card's rounded corners.
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.goldBorder, lineWidth: 1.5))

                // By Game Mode
                Text(isSweep ? "SWEEP RANKING" : "BY GAME MODE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                HModePicker(selected: $mode, isSweep: $isSweep)
                if isSweep {
                    sweepCard
                } else {
                let m = pickerModes.first { $0.dbKey == mode.rawValue }
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2).fill((m?.accent ?? Theme.primary)).frame(height: 3)
                    HStack(spacing: 10) {
                        if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                        Text(m?.title ?? mode.rawValue).font(Brand.headline(16)).foregroundStyle(Theme.textPrimary)
                        Spacer()
                    }.padding(.horizontal, 12).padding(.top, 10)
                    if RecordCatalog.perMode.contains(where: { modeRecord($0) != nil }) {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(RecordCatalog.perMode, id: \.self) { rt in
                                RecordStatCell(type: rt, record: modeRecord(rt), accent: m?.accent ?? Theme.primary, isMe: modeRecord(rt)?.holderId == myId, gameMode: mode.rawValue)
                            }
                        }
                        .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 16)
                    } else {
                        // Web parity (records page): trophy + "No records yet" instead of a dash grid.
                        VStack(spacing: 8) {
                            Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                            Text("No records yet").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 24)
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                // Clip the 3pt top accent bar to the card's rounded corners.
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                }
            }
        }
        .task { if loading { records = (try? await RecordsService.fetchAll()) ?? []; loading = false } }
        .task(id: "sweep-\(isSweep)") { if isSweep { await loadSweep() } }
    }

    /// The all-time sweep-ranking card — players ranked by lifetime sweep count
    /// (sweeps · flawless · best sweep time). Same indigo card shell as daily.
    private var sweepCard: some View {
        let total = sweepRank?.total ?? sweepEntries.count
        return VStack(spacing: 0) {
            LinearGradient(colors: [sweepAccent, sweepAccent.opacity(0.53)], startPoint: .leading, endPoint: .trailing).frame(height: 3)

            HStack(spacing: 10) {
                ModeIconView(icon: .asset("broom"), accent: sweepAccent, box: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text("All-Time Sweeps").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    Text("Most daily sweeps ever").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 8)

            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.2.fill").font(.system(size: 11))
                    Text("\(total) sweeper\(total == 1 ? "" : "s")").font(Brand.font(10, .bold))
                }.foregroundStyle(Theme.textMuted)
                Spacer()
                if let r = sweepRank {
                    (Text("Your rank: ").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                     + Text("#\(r.rank)").font(Brand.font(12, .black)).foregroundColor(Color(hex: 0xD97706))
                     + Text(" of \(r.total)").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted))
                }
            }
            .padding(.horizontal, 14).padding(.bottom, 8)

            Divider().overlay(Theme.border)

            if sweepLoading {
                LeaderboardSkeleton()
            } else if sweepEntries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                    Text("No sweeps yet. Be the first!").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                ForEach(Array(sweepEntries.enumerated()), id: \.element.id) { idx, e in
                    allTimeSweepRow(e.rank, e)
                    if idx < sweepEntries.count - 1 { Divider().overlay(Theme.border) }
                }
            }
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
    }

    @ViewBuilder private func allTimeRankIcon(_ rank: Int) -> some View {
        switch rank {
        case 1: Image(systemName: "crown.fill").foregroundStyle(Color(hex: 0xD97706))
        case 2: Image(systemName: "medal.fill").foregroundStyle(Theme.textMuted)
        case 3: Image(systemName: "medal.fill").foregroundStyle(Color(hex: 0xB45309))
        default: Text("\(rank)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted).frame(width: 20)
        }
    }

    private func allTimeSweepRow(_ rank: Int, _ e: AllTimeSweepEntry) -> some View {
        let isMe = e.userId == myId
        return HStack(spacing: 12) {
            allTimeRankIcon(rank).frame(width: 22)
            // Doug's Aug-16 feedback (leaderboard row shape): stats under the
            // name so the name keeps the row's flexible width.
            NavigationLink(value: e.userId) {
                VStack(alignment: .leading, spacing: 1) {
                    (Text(e.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                        .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text("\(e.flawlessCount) flawless · \(formatShortTime(e.bestSweepTime))")
                        .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
            }.buttonStyle(.plain)
            Spacer()
            Text("\(e.sweepCount) sweep\(e.sweepCount == 1 ? "" : "s")").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func loadSweep() async {
        if let cached = SweepCache.shared.allTime {
            sweepEntries = cached.entries
            sweepRank = cached.userRank
            sweepLoading = false
        } else {
            sweepLoading = true
            sweepRank = nil
            sweepEntries = []
        }

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

/// A single record stat — ports StatCell in records/page.tsx.
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
        return HStack(alignment: .top, spacing: 8) {
            Image(systemName: meta?.symbol ?? "rosette").font(.system(size: 14))
                .foregroundStyle(has ? accent : Theme.textMuted).padding(.top, 2)
            VStack(alignment: .leading, spacing: 1) {
                Text(record?.formattedValue ?? "—").font(Brand.font(16, .black))
                    .foregroundStyle(has ? Theme.textPrimary : Theme.textMuted)
                Text(RecordCatalog.label(type, gameMode: record?.gameMode ?? gameMode)).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                if has {
                    NavigationLink(value: record?.holderId ?? "") {
                        HStack(spacing: 3) {
                            Text(record?.holderUsername ?? "Unknown").font(Brand.font(10, .heavy)).lineLimit(1)
                            .minimumScaleFactor(0.7)
                                .foregroundStyle(isMe ? Color(hex: 0xD97706) : accent)
                            if isMe { Image(systemName: "crown.fill").font(.system(size: 8)).foregroundStyle(Color(hex: 0xD97706)) }
                        }.padding(.top, 2)
                    }.buttonStyle(.plain)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(isMe && has ? Theme.highlightGold : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isMe && has ? Theme.goldBorder : Color.clear, lineWidth: 1))
    }
}

/// Daily records — leaderboard with mode picker + solo/vs toggle.
struct DailyRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var mode: GameMode = .duel
    @State private var playType = "solo"
    @State private var entries: [LeaderboardEntry] = []
    @State private var userRank: (rank: Int, total: Int)?
    // "Your neighborhood" rows when the user placed past the top-50 list
    // (e.g. #425 sees ~421–429 below a "···" separator, own row highlighted).
    @State private var rankWindow: (startRank: Int, entries: [LeaderboardEntry])?
    @State private var loading = false
    @State private var reloadToken = 0
    // Sweep tile — the cross-mode "completed every sweep daily today" board.
    @State private var isSweep = false
    @State private var sweepEntries: [SweepEntry] = []
    @State private var sweepRank: (rank: Int, total: Int)?
    @State private var sweepLoading = false
    // §232: dot-strip + guess/hint detail — daily-board parity (founder ask,
    // Aug 24: Records' sweep rows must match the leaderboard's sweep section).
    @State private var sweepDetails: [String: LeaderboardService.SweepDetails] = [:]
    // §248: current flawless streaks for FLAWLESS rows — the ×N pills.
    @State private var flawlessStreaks: [String: Int] = [:]
    // TIE-AWARE score display (web parity): rows sharing a whole number on the
    // same board render the decimals that rank them.
    private var lbScoreLabels: [Double: String] { tieAwareScoreLabels(entries.map(\.compositeScore)) }
    private var sweepScoreLabels: [Double: String] { tieAwareScoreLabels(sweepEntries.map(\.totalScore)) }
    // LEADERBOARD SHARE — this view owns the Solo/VS toggle, so its share
    // button is where the VS Battle card variant comes from. Sweep has no
    // card design (web records/page.tsx parity).
    @State private var sharingLb = false
    private let sweepAccent = Color(hex: 0x4F46E5)

    private var accent: Color { homeModes.first { $0.dbKey == mode.rawValue }?.accent ?? Theme.primary }

    private var shareButton: some View {
        Button {
            guard !sharingLb else { return }
            sharingLb = true
            Task {
                await LeaderboardShareFlow.shareDaily(
                    mode: mode, playType: playType,
                    entries: entries, rankWindow: rankWindow,
                    userId: auth.profile?.id, userRank: userRank)
                sharingLb = false
            }
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
        }
        .buttonStyle(.plain)
        .opacity(sharingLb ? 0.4 : 1)
        .accessibilityLabel("Share leaderboard")
    }

    /// Custom inline Solo|VS toggle matching the web (icon + accent active state),
    /// replacing the iOS segmented control.
    private var soloVsToggle: some View {
        HStack(spacing: 0) {
            ForEach(["solo", "vs"], id: \.self) { t in
                let active = playType == t
                Button { playType = t } label: {
                    HStack(spacing: 4) {
                        Image(systemName: t == "solo" ? "person.fill" : "flag.2.crossed.fill").font(.system(size: 12))
                        Text(t == "solo" ? "Solo" : "VS").font(Brand.font(10, .heavy))
                    }
                    .foregroundStyle(active ? accent : Theme.textMuted)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .background(active ? accent.opacity(0.08) : Theme.surface)
                }.buttonStyle(.plain)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1.5))
        .fixedSize()
    }

    var body: some View {
        let m = homeModes.first { $0.dbKey == mode.rawValue }
        let total = userRank?.total ?? entries.count
        return VStack(spacing: 10) {
            HModePicker(selected: $mode, isSweep: $isSweep)

            // §254: the completed-daily dropdown, mounted exactly as the daily
            // leaderboard (ProfileTab) mounts it — the founder wants Records to
            // mirror that page. .id(mode) → a fresh card per mode, same reason
            // as there: never the previous mode's board under a new header.
            if !isSweep { if mode.isCustomEngine { CustomCompletedDailyCard(mode: mode).id(mode) } else { CompletedDailyCard(mode: mode).id(mode) } }

            if isSweep {
                sweepCard
            } else {
            // Single leaderboard card: accent bar → header (mode + Today + toggle)
            // → player-count/your-rank row → rows. Mirrors records/page.tsx.
            VStack(spacing: 0) {
                LinearGradient(colors: [accent, accent.opacity(0.53)], startPoint: .leading, endPoint: .trailing).frame(height: 3)

                HStack(spacing: 10) {
                    if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(m?.title ?? mode.rawValue).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                        Text("Today").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                    if !loading && !entries.isEmpty { shareButton }
                    soloVsToggle
                }
                .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 8)

                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill").font(.system(size: 11))
                        Text("\(total) player\(total == 1 ? "" : "s") today").font(Brand.font(10, .bold))
                    }.foregroundStyle(Theme.textMuted)
                    Spacer()
                    if let r = userRank {
                        HStack(spacing: 3) {
                            (Text("Your rank: ").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                             + Text("#\(r.rank)").font(Brand.font(12, .black)).foregroundColor(Color(hex: 0xD97706)))
                            // Transient "+N/−N" movement pill (web parity, pageKey records-daily).
                            RankDeltaBadge(mode: mode.rawValue, playType: playType, pageKey: "records-daily", currentRank: r.rank)
                            Text(r.total > 1 ? " of \(r.total) · top \(max(1, Int((Double(r.rank) / Double(r.total) * 100).rounded())))%" : " of \(r.total)")
                                .font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.bottom, 8)

                Divider().overlay(Theme.border)

                if loading {
                    LeaderboardSkeleton()   // web parity: animate-pulse rows
                } else if entries.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                        Text("No results yet today. Be the first!").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 30)
                } else {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { idx, e in
                        dailyRow(idx + 1, e)
                        if idx < entries.count - 1 { Divider().overlay(Theme.border) }
                    }
                    if let win = rankWindow {
                        Divider().overlay(Theme.border)
                        Text("···").font(Brand.font(14, .black)).foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity).padding(.vertical, 4)
                        Divider().overlay(Theme.border)
                        ForEach(Array(win.entries.enumerated()), id: \.element.id) { idx, e in
                            dailyRow(win.startRank + idx, e)
                            if idx < win.entries.count - 1 { Divider().overlay(Theme.border) }
                        }
                    }
                }
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 16))

            YesterdayPodiumCard(mode: mode, playType: playType, accent: accent)
            }
        }
        .task(id: "\(mode.rawValue)-\(playType)-\(reloadToken)") { await load() }
        .task(id: "sweep-\(isSweep)-\(reloadToken)") { if isSweep { await loadSweep() } }
        .onDailyRecorded { reloadToken += 1 }
    }

    /// The daily-sweep card — same card shell as the per-mode leaderboard (accent
    /// bar → header → your-rank row → rows), but indigo and filled with sweep rows.
    private var sweepCard: some View {
        let total = sweepRank?.total ?? sweepEntries.count
        return VStack(spacing: 0) {
            LinearGradient(colors: [sweepAccent, sweepAccent.opacity(0.53)], startPoint: .leading, endPoint: .trailing).frame(height: 3)

            HStack(spacing: 10) {
                ModeIconView(icon: .asset("broom"), accent: sweepAccent, box: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Daily Sweep").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    Text("All \(ModeGen.sweep.count) modes today").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
            }
            .padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 8)

            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.2.fill").font(.system(size: 11))
                    Text("\(total) sweeper\(total == 1 ? "" : "s") today").font(Brand.font(10, .bold))
                }.foregroundStyle(Theme.textMuted)
                Spacer()
                if let r = sweepRank {
                    HStack(spacing: 3) {
                        (Text("Your rank: ").font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                         + Text("#\(r.rank)").font(Brand.font(12, .black)).foregroundColor(Color(hex: 0xD97706)))
                        Text(r.total > 1 ? " of \(r.total) · top \(max(1, Int((Double(r.rank) / Double(r.total) * 100).rounded())))%" : " of \(r.total)")
                            .font(Brand.font(10, .bold)).foregroundColor(Theme.textMuted)
                    }
                }
            }
            .padding(.horizontal, 14).padding(.bottom, 8)

            Divider().overlay(Theme.border)

            if sweepLoading {
                LeaderboardSkeleton()
            } else if sweepEntries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                    Text("No sweeps yet today. Be the first!").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                ForEach(Array(sweepEntries.enumerated()), id: \.element.id) { idx, e in
                    sweepRow(e.rank, e)
                    if idx < sweepEntries.count - 1 { Divider().overlay(Theme.border) }
                }
            }
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // §232: daily-board parity (founder ask, Aug 24) — this row wore a bare
    // "time · X/9" while the leaderboard's sweep section had the §223 words +
    // dot strip. Same shape as ProfileTab's sweepRow now: stats under the name,
    // the SweepModeDots strip with the FLAWLESS/SWEEP pill riding it (§227).
    private func sweepRow(_ rank: Int, _ e: SweepEntry) -> some View {
        let isMe = e.userId == auth.profile?.id
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            // §236: score rides the name line; the stats line owns the width.
            NavigationLink(value: e.userId) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        (Text(e.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                            .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 6)
                        Text(sweepScoreLabels[e.totalScore] ?? formatScore(e.totalScore))
                            .font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                            .lineLimit(1).fixedSize()
                    }
                    Text(sweepStatsLine(e, details: sweepDetails[e.userId], day: LeaderboardService.todayLocal()))
                        .font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                        // §246 (founder screenshot: "86 guesses ·…"): the hints
                        // segment fell off the row's end — wrap, never truncate.
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        SweepModeDots(details: sweepDetails[e.userId],
                                      day: LeaderboardService.todayLocal())
                        sweepPill(isFlawless: e.isFlawless,
                                  streak: flawlessStreaks[e.userId] ?? 0)
                    }
                }
            }.buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func loadSweep() async {
        let cacheKey = SweepCache.dailyKey()
        if let cached = SweepCache.shared.daily(cacheKey) {
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

    @ViewBuilder private func rankIcon(_ rank: Int) -> some View {
        switch rank {
        case 1: Image(systemName: "crown.fill").foregroundStyle(Color(hex: 0xD97706))
        case 2: Image(systemName: "medal.fill").foregroundStyle(Theme.textMuted)
        case 3: Image(systemName: "medal.fill").foregroundStyle(Color(hex: 0xB45309))
        default: Text("\(rank)").font(Brand.font(12, .black)).foregroundStyle(Theme.textMuted).frame(width: 20)
        }
    }

    private func dailyRow(_ rank: Int, _ e: LeaderboardEntry) -> some View {
        let isMe = e.userId == auth.profile?.id
        // Web parity: "Ns"/"Nm Ns" time + multi-board fraction + a Win/Loss pill.
        let t = formatShortTime(Int(e.timeSeconds))
        // Through the mode's guess semantics (ModeStats.guessRowLabel — the same
        // call the daily leaderboard row in ProfileTab makes): "0 Mistakes", "Par".
        let meta = ModeGen.byDbKey(mode.rawValue)
        var line = "\(WordociousCore.ModeStats.guessRowLabel(semantics: meta?.guessSemantics ?? "guesses", guessBase: meta?.guessBase ?? 1, guessCount: e.guessCount)) · \(t)"
        if e.totalBoards > 1 { line += " · \(e.boardsSolved)/\(e.totalBoards)" }
        // §254: hints ride this row exactly as on the daily leaderboard row
        // (ProfileTab) — the founder wants the two pages to match.
        if HINT_MODES.contains(mode.rawValue), let h = e.hintsUsed {
            line += h > 0 ? " · \(h) hint\(h == 1 ? "" : "s")" : " · No hints"
        }
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            NavigationLink(value: e.userId) {
                (Text(e.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                    .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
                    .minimumScaleFactor(0.7)
            }.buttonStyle(.plain)
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(lbScoreLabels[e.compositeScore] ?? formatScore(e.compositeScore)).font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 5) {
                    Text(line).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                    Text(e.completed ? "Win" : "Loss").font(Brand.font(9, .heavy))
                        .foregroundStyle(e.completed ? Theme.winText : Theme.lossText)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 4).fill(e.completed ? Theme.winBG : Theme.lossBG))
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(isMe ? Theme.highlightGold : rank <= 3 ? Theme.surfaceAlt : Color.clear)
    }

    private func load() async {
        // P3: same L1/L2/L3 treatment as LeaderboardTab.load() —
        // stale-while-revalidate cache paint, rows painted the moment the
        // fetch lands (rank banner fills in after), index fast-path rank.
        let cacheKey = LeaderboardCache.key(mode: mode, userId: auth.profile?.id, playType: playType)
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

/// Yesterday's top-3 for the selected mode (collapsible) — Records daily tab.
struct YesterdayPodiumCard: View {
    let mode: GameMode
    let playType: String
    let accent: Color
    @EnvironmentObject private var auth: AuthService
    @State private var top3: [LeaderboardEntry] = []
    @State private var open = false
    @State private var sharing = false
    private var podiumScoreLabels: [Double: String] { tieAwareScoreLabels(top3.map(\.compositeScore)) }
    private let medalColors = [Color(hex: 0xD97706), Color(hex: 0x9CA3AF), Color(hex: 0xB45309)]

    var body: some View {
        Group {
            if !top3.isEmpty {
                VStack(spacing: 0) {
                    // Header split into sibling buttons (web parity) so the
                    // share icon is independently tappable next to the toggle.
                    HStack {
                        Button { withAnimation { open.toggle() } } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "crown.fill").font(.system(size: 11)).foregroundStyle(Color(hex: 0xD97706))
                                Text("YESTERDAY'S PODIUM").font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(Theme.textPrimary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }.buttonStyle(.plain)
                        // Settled-podium share — only once the podium is open.
                        if open {
                            Button {
                                guard !sharing else { return }
                                sharing = true
                                Task {
                                    await LeaderboardShareFlow.sharePodium(
                                        mode: mode, playType: playType,
                                        top3: top3, userId: auth.profile?.id)
                                    sharing = false
                                }
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Theme.textMuted)
                            }
                            .buttonStyle(.plain)
                            .opacity(sharing ? 0.4 : 1)
                            .accessibilityLabel("Share yesterday's podium")
                            .padding(.trailing, 6)
                        }
                        Button { withAnimation { open.toggle() } } label: {
                            Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted).rotationEffect(.degrees(open ? 180 : 0))
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    if open {
                        Divider().overlay(Theme.border)
                        ForEach(Array(top3.enumerated()), id: \.element.id) { i, e in
                            HStack(spacing: 12) {
                                Image(systemName: "medal.fill").foregroundStyle(medalColors[min(i, 2)]).frame(width: 20)
                                NavigationLink(value: e.userId) { Text(e.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1).minimumScaleFactor(0.7) }.buttonStyle(.plain)
                                Spacer()
                                Text(podiumScoreLabels[e.compositeScore] ?? formatScore(e.compositeScore)).font(Brand.font(13, .black)).foregroundStyle(accent)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            if i < top3.count - 1 { Divider().overlay(Theme.border) }
                        }
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .task(id: "\(mode.rawValue)-\(playType)") {
            top3 = (try? await LeaderboardService.fetch(gameMode: mode, day: LeaderboardService.yesterdayLocal(), playType: playType, limit: 5)) ?? []
        }
    }
}

/// Posted by the Records sheet's "Your personal records → Stats" link
/// (D2 step 3); RootTabView lands the player on the Stats tab.
extension Notification.Name {
    static let openStats = Notification.Name("wordocious.open-stats")
}
