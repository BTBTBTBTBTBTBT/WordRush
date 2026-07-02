import SwiftUI
import Supabase
import WordociousCore

/// All-time "hall of records" from Supabase all_time_records.
/// Mirrors app/records/page.tsx: RECORDS header + Daily | All-Time toggle.
struct RecordsTab: View {
    @EnvironmentObject private var auth: AuthService
    @State private var tab: RecordsSubTab = .daily   // web default
    @State private var showAuth = false

    enum RecordsSubTab { case daily, allTime, you }

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
            .adBanner()
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
                        toggleButton("You", .you)
                    }

                    switch tab {
                    case .daily:   DailyRecordsView()
                    case .allTime: AllTimeRecordsView()
                    case .you:     YourRecordsView()
                    }
                }
                .padding(.horizontal, 12).padding(.bottom, 80)
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

    private let pickerModes: [HomeMode] = homeModes.filter { $0.dbKey != nil }
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
                Text("BY GAME MODE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                HModePicker(selected: $mode)
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
                                RecordStatCell(type: rt, record: modeRecord(rt), accent: m?.accent ?? Theme.primary, isMe: modeRecord(rt)?.holderId == myId)
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
        .task { if loading { records = (try? await RecordsService.fetchAll()) ?? []; loading = false } }
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

    var body: some View {
        let meta = RecordCatalog.labels[type]
        let has = record != nil
        return HStack(alignment: .top, spacing: 8) {
            Image(systemName: meta?.symbol ?? "rosette").font(.system(size: 14))
                .foregroundStyle(has ? accent : Theme.textMuted).padding(.top, 2)
            VStack(alignment: .leading, spacing: 1) {
                Text(record?.formattedValue ?? "—").font(Brand.font(16, .black))
                    .foregroundStyle(has ? Theme.textPrimary : Theme.textMuted)
                Text(meta?.label ?? type).font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
                if has {
                    NavigationLink(value: record?.holderId ?? "") {
                        HStack(spacing: 3) {
                            Text(record?.holderUsername ?? "Unknown").font(Brand.font(10, .heavy)).lineLimit(1)
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
    @State private var loading = false
    @State private var reloadToken = 0

    private var accent: Color { homeModes.first { $0.dbKey == mode.rawValue }?.accent ?? Theme.primary }

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
            HModePicker(selected: $mode)

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
                }
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 16))

            YesterdayPodiumCard(mode: mode, playType: playType, accent: accent)
        }
        .task(id: "\(mode.rawValue)-\(playType)-\(reloadToken)") { await load() }
        .onDailyCompletion { reloadToken += 1 }
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
        var line = "\(e.guessCount) Guesses · \(t)"
        if e.totalBoards > 1 { line += " · \(e.boardsSolved)/\(e.totalBoards)" }
        return HStack(spacing: 12) {
            rankIcon(rank).frame(width: 22)
            NavigationLink(value: e.userId) {
                (Text(e.username) + (isMe ? Text(" (you)").foregroundColor(Color(hex: 0xD97706)) : Text("")))
                    .font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1)
            }.buttonStyle(.plain)
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(Int(e.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(Theme.textPrimary)
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
        loading = true
        entries = (try? await LeaderboardService.fetch(gameMode: mode, playType: playType)) ?? []
        if let uid = auth.profile?.id { userRank = await LeaderboardService.userRank(gameMode: mode, userId: uid, playType: playType) }
        loading = false
    }
}

/// Yesterday's top-3 for the selected mode (collapsible) — Records daily tab.
struct YesterdayPodiumCard: View {
    let mode: GameMode
    let playType: String
    let accent: Color
    @State private var top3: [LeaderboardEntry] = []
    @State private var open = false
    private let medalColors = [Color(hex: 0xD97706), Color(hex: 0x9CA3AF), Color(hex: 0xB45309)]

    var body: some View {
        Group {
            if !top3.isEmpty {
                VStack(spacing: 0) {
                    Button { withAnimation { open.toggle() } } label: {
                        HStack {
                            HStack(spacing: 5) {
                                Image(systemName: "crown.fill").font(.system(size: 11)).foregroundStyle(Color(hex: 0xD97706))
                                Text("YESTERDAY'S PODIUM").font(Brand.font(11, .black)).tracking(0.5).foregroundStyle(Theme.textPrimary)
                            }
                            Spacer()
                            Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.textMuted).rotationEffect(.degrees(open ? 180 : 0))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 10)
                    }.buttonStyle(.plain)
                    if open {
                        Divider().overlay(Theme.border)
                        ForEach(Array(top3.enumerated()), id: \.element.id) { i, e in
                            HStack(spacing: 12) {
                                Image(systemName: "medal.fill").foregroundStyle(medalColors[min(i, 2)]).frame(width: 20)
                                NavigationLink(value: e.userId) { Text(e.username).font(Brand.font(13, .heavy)).foregroundStyle(Theme.textPrimary).lineLimit(1) }.buttonStyle(.plain)
                                Spacer()
                                Text("\(Int(e.compositeScore))").font(Brand.font(13, .black)).foregroundStyle(accent)
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
            top3 = (try? await LeaderboardService.fetch(gameMode: mode, day: LeaderboardService.yesterdayLocal(), playType: playType, limit: 3)) ?? []
        }
    }
}

/// "You" tab — the player's own records: milestone progress, sweep totals,
/// per-mode personal bests, and medal/global-record summary. Mirrors the web
/// YourRecordsView (records/page.tsx). All from already-fetched data.
struct YourRecordsView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var stats: [UserStatRow] = []
    @State private var sweep = MatchStatsService.DailySweepStats()
    @State private var recordsHeld: [AllTimeRecord] = []
    /// Record Chase (restat R2): the top-3 beatable all-time records with the
    /// gap + a progress bar (was a single "closest" line).
    @State private var chases: [(label: String, gap: String, pct: Int)] = []
    @State private var mode: GameMode = .duel
    @State private var loading = true

    private let streakMilestones = [7, 30, 100]
    private var accent: Color { homeModes.first { $0.dbKey == mode.rawValue }?.accent ?? Theme.primary }
    private func modeTitle(_ key: String) -> String { homeModes.first { $0.dbKey == key }?.title ?? key }

    var body: some View {
        Group {
            if loading { CardsSkeleton() }
            else {
                VStack(spacing: 16) {
                    milestoneCard
                    if sweep.hasData { sweepCard }
                    bestsByMode
                    medalsAndRecords
                    // Trophy shelf — the specific records you hold, spelled out.
                    if !recordsHeld.isEmpty { trophyShelf }
                }
            }
        }
        .task { await load() }
    }

    // MARK: Cards

    @ViewBuilder private var milestoneCard: some View {
        let streak = auth.profile?.dailyLoginStreak ?? 0
        let next = streakMilestones.first { $0 > streak }
        if next != nil || !chases.isEmpty {
            VStack(spacing: 0) {
                LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)], startPoint: .leading, endPoint: .trailing).frame(height: 3)
                VStack(alignment: .leading, spacing: 10) {
                    Text("NEXT UP").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    if let next {
                        VStack(spacing: 4) {
                            HStack {
                                Label("\(next)-day streak shield", systemImage: "flame.fill").font(Brand.font(11, .heavy)).foregroundStyle(Theme.textPrimary)
                                    .labelStyle(.titleAndIcon)
                                Spacer()
                                Text("\(streak)/\(next)").font(Brand.font(11, .heavy)).foregroundStyle(Theme.textMuted)
                            }
                            GeometryReader { g in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Theme.border)
                                    Capsule().fill(LinearGradient(colors: [Color(hex: 0xF97316), Color(hex: 0xFBBF24)], startPoint: .leading, endPoint: .trailing))
                                        .frame(width: g.size.width * min(1, Double(streak) / Double(next)))
                                }
                            }.frame(height: 8)
                        }
                    }
                    // Record Chase: top-3 beatable records, each with a
                    // progress bar toward the record (web records/page.tsx).
                    if !chases.isEmpty {
                        VStack(spacing: 8) {
                            ForEach(Array(chases.enumerated()), id: \.offset) { _, c in
                                VStack(spacing: 3) {
                                    HStack(spacing: 5) {
                                        Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 12)).foregroundStyle(Theme.primary)
                                        (Text("You're ").font(Brand.font(11, .bold)).foregroundColor(Theme.textMuted)
                                         + Text(c.gap).font(Brand.font(11, .black)).foregroundColor(Theme.textPrimary)
                                         + Text(" from the \(c.label) record").font(Brand.font(11, .bold)).foregroundColor(Theme.textMuted))
                                            .lineLimit(1).minimumScaleFactor(0.85)
                                        Spacer(minLength: 0)
                                    }
                                    GeometryReader { g in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(Theme.border)
                                            Capsule().fill(LinearGradient(colors: [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)], startPoint: .leading, endPoint: .trailing))
                                                .frame(width: g.size.width * min(1, Double(c.pct) / 100))
                                        }
                                    }.frame(height: 6)
                                }
                            }
                        }
                    }
                }
                .padding(14)
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private var sweepCard: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xD97706)], startPoint: .leading, endPoint: .trailing).frame(height: 3)
            VStack(alignment: .leading, spacing: 6) {
                Text("DAILY SWEEPS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                    meCell("sparkles", "\(sweep.sweepCount)", "Daily Sweeps", Color(hex: 0x7C3AED))
                    meCell("trophy.fill", "\(sweep.flawlessCount)", "Flawless Victories", Color(hex: 0xD97706))
                    meCell("flame.fill", "\(sweep.currentSweepStreak)", "Current Sweep Streak", Color(hex: 0xF97316))
                    meCell("clock.fill", sweep.bestSweepSecs > 0 ? formatShortTime(sweep.bestSweepSecs) : "—", "Best Sweep Time", Color(hex: 0x2563EB), dim: sweep.bestSweepSecs == 0)
                }
            }
            .padding(14)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var bestsByMode: some View {
        let my = stats.first { $0.gameMode == mode.rawValue && $0.playType == "solo" }
        let m = homeModes.first { $0.dbKey == mode.rawValue }
        return VStack(alignment: .leading, spacing: 8) {
            Text("YOUR BESTS BY MODE").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
            HModePicker(selected: $mode)
            VStack(spacing: 0) {
                LinearGradient(colors: [accent, accent.opacity(0.53)], startPoint: .leading, endPoint: .trailing).frame(height: 3)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 10) {
                        if let m { ModeIconView(icon: m.icon, accent: m.accent, box: 32) }
                        Text(m?.title ?? mode.rawValue).font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    }
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                        meCell("clock.fill", (my?.fastestTime ?? 0) > 0 ? formatShortTime(my!.fastestTime) : "—", "Fastest Win", accent, dim: (my?.fastestTime ?? 0) == 0)
                        meCell("target", (my?.bestScore ?? 0) > 0 ? "\(my!.bestScore) guesses" : "—", "Fewest Guesses", accent, dim: (my?.bestScore ?? 0) == 0)
                        meCell("bolt.fill", my != nil ? "\(my!.totalGames) games" : "—", "Games Played", accent, dim: my == nil)
                        meCell("trophy.fill", my != nil ? "\(my!.wins)–\(my!.losses)" : "—", "Win–Loss", accent, dim: my == nil)
                    }
                }
                .padding(14)
            }
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private var medalsAndRecords: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("MEDALS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                HStack(spacing: 10) {
                    Label("\(auth.profile?.goldMedals ?? 0)", systemImage: "crown.fill").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0xD97706))
                    Label("\(auth.profile?.silverMedals ?? 0)", systemImage: "medal.fill").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0x9CA3AF))
                    Label("\(auth.profile?.bronzeMedals ?? 0)", systemImage: "medal.fill").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0xB45309))
                }.labelStyle(.titleAndIcon)
                Text("Daily top-3 finishes").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            VStack(alignment: .leading, spacing: 6) {
                Text("GLOBAL RECORDS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                Label("\(recordsHeld.count)", systemImage: "star.fill").font(Brand.font(13, .black))
                    .foregroundStyle(recordsHeld.isEmpty ? Theme.textMuted : Color(hex: 0xD97706)).labelStyle(.titleAndIcon)
                Text("all-time record\(recordsHeld.count == 1 ? "" : "s") held").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        }
    }

    /// Trophy shelf — mode · record label · value for every record held (web
    /// records/page.tsx "Your Trophy Shelf").
    private var trophyShelf: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0xFBBF24), Color(hex: 0xD97706)], startPoint: .leading, endPoint: .trailing).frame(height: 3)
            VStack(alignment: .leading, spacing: 6) {
                Text("YOUR TROPHY SHELF").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                VStack(spacing: 6) {
                    ForEach(recordsHeld) { r in
                        HStack(spacing: 10) {
                            Image(systemName: RecordCatalog.labels[r.recordType]?.symbol ?? "star.fill")
                                .font(.system(size: 14)).foregroundStyle(Color(hex: 0xD97706))
                            Text("\(r.gameMode.map(modeTitle) ?? "Global") · \(RecordCatalog.labels[r.recordType]?.label ?? r.recordType)")
                                .font(Brand.font(12, .heavy)).foregroundStyle(Theme.textPrimary)
                                .lineLimit(1).minimumScaleFactor(0.85)
                            Spacer()
                            Text(r.formattedValue).font(Brand.font(12, .black)).foregroundStyle(Color(hex: 0xD97706))
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.background))
                    }
                }
            }
            .padding(14)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func meCell(_ icon: String, _ value: String, _ label: String, _ color: Color, dim: Bool = false) -> some View {
        // Centered tile (mirrors the profile global-summary cards) so each cell
        // sits balanced in its grid column instead of hugging the left edge.
        VStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 16)).foregroundStyle(dim ? Theme.textMuted : color)
            Text(value).font(Brand.font(15, .black)).foregroundStyle(dim ? Theme.textMuted : Theme.textPrimary)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center).lineLimit(2)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10).padding(.horizontal, 4)
    }

    private func load() async {
        guard let uid = auth.profile?.id else { loading = false; return }
        async let s = UserStatsService.fetch(userId: uid)
        async let sw = MatchStatsService.dailySweepStats()
        async let recs = (try? RecordsService.fetchAll()) ?? []
        let (rows, sweepRes, allRecs) = await (s, sw, recs)
        stats = rows
        sweep = sweepRes
        recordsHeld = allRecs.filter { $0.holderId == uid }
        // Record Chase: EVERY beatable all-time record with your gap, sorted by
        // how close you are (relative gap), top 3. Lower-is-better types only.
        // Mirrors the web YourRecordsView chase loop exactly.
        var all: [(label: String, gap: String, pct: Int, rel: Double)] = []
        for r in allRecs where r.holderId != uid && r.gameMode != nil && r.playType == "solo" {
            guard let mine = rows.first(where: { $0.gameMode == r.gameMode && $0.playType == "solo" }) else { continue }
            if r.recordType == "fastest_win", mine.fastestTime > 0, Double(mine.fastestTime) > r.recordValue {
                let gap = Double(mine.fastestTime) - r.recordValue
                all.append(("\(modeTitle(r.gameMode!)) fastest win", "\(Int(gap))s away",
                            Int((r.recordValue / Double(mine.fastestTime) * 100).rounded()),
                            gap / max(1, r.recordValue)))
            } else if r.recordType == "fewest_guesses", mine.bestScore > 0, Double(mine.bestScore) > r.recordValue {
                let gap = Double(mine.bestScore) - r.recordValue
                all.append(("\(modeTitle(r.gameMode!)) fewest guesses", "\(Int(gap)) away",
                            Int((r.recordValue / Double(mine.bestScore) * 100).rounded()),
                            gap / max(1, r.recordValue)))
            }
        }
        chases = all.sorted { $0.rel < $1.rel }.prefix(3).map { ($0.label, $0.gap, $0.pct) }
        loading = false
    }
}
