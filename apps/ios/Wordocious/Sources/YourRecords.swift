import SwiftUI
import WordociousCore

// YOUR RECORDS, folded into the Stats tab (Stats + Friends redesign D2 step 3,
// founder 2026-09-26: the Records tab goes "so long as the information
// expected still populates elsewhere"). Every row the old Records → You view
// had lives here: Next Up (shield + record chases) and the Daily Sweeps
// window, Medals / Global Records held and the Trophy Shelf on the All-time
// page; the per-game bests (Fastest Win · Fewest Guesses · Games Played ·
// Win–Loss plus the records you hold in that game) on each game page.
// Mirrors apps/web/components/stats/your-records.tsx.

/// A beatable all-time record with your gap and progress toward it.
struct RecordChase: Identifiable {
    let label: String
    let gap: String
    let pct: Int
    let gameMode: String?
    var id: String { label }
}

/// The fetches the old Records → You view made, minus user_stats and the
/// daily-sweep stats (ProfileTab already has both). `fetch` runs the network
/// round trips concurrently; `resolved` folds the user_stats rows in.
struct YourRecordsData {
    var sweepRankToday: (rank: Int, total: Int)? = nil
    var sweepRankAllTime: (rank: Int, total: Int)? = nil
    var recordsHeld: [AllTimeRecord] = []
    /// EVERY beatable all-time record, closest first (NextUpCard takes three,
    /// each GameRecordsCard its own game's first).
    var chases: [RecordChase] = []
    var loaded = false

    /// The raw fetches, before user_stats are known.
    struct Raw {
        var records: [AllTimeRecord] = []
        var sweepRankToday: (rank: Int, total: Int)? = nil
        var sweepRankAllTime: (rank: Int, total: Int)? = nil

        /// Held records (one per type+mode, solo preferred) and the chase list.
        func resolved(userId uid: String, stats rows: [UserStatRow]) -> YourRecordsData {
            // One shelf row per (record type, mode): all_time_records keeps a
            // separate row per play_type ('solo' and 'vs'), and listing both made
            // e.g. "Six · Most Games Played" appear twice — the 54-game solo record
            // next to a 1-game VS record. Prefer the solo row, same rule as the
            // All-Time per-mode grid (modeRecord). Also drives the GLOBAL RECORDS
            // count, so held solo+vs pairs never double-count.
            var heldByKey: [String: AllTimeRecord] = [:]
            var heldOrder: [String] = []
            for r in records where r.holderId == uid {
                let key = "\(r.recordType)|\(r.gameMode ?? "global")"
                if let existing = heldByKey[key] {
                    if existing.playType != "solo" && r.playType == "solo" { heldByKey[key] = r }
                } else {
                    heldByKey[key] = r
                    heldOrder.append(key)
                }
            }
            // Record Chase: EVERY beatable all-time record with your gap, sorted by
            // how close you are (relative gap). Lower-is-better types only.
            // Mirrors the web useYourRecords chase loop exactly.
            var all: [(chase: RecordChase, rel: Double)] = []
            for r in records where r.holderId != uid && r.gameMode != nil && r.playType == "solo" {
                guard let gm = r.gameMode,
                      let mine = rows.first(where: { $0.gameMode == gm && $0.playType == "solo" }) else { continue }
                if r.recordType == "fastest_win", mine.fastestTime > 0, Double(mine.fastestTime) > r.recordValue {
                    let gap = Double(mine.fastestTime) - r.recordValue
                    all.append((RecordChase(label: "\(yourRecordsModeTitle(gm)) fastest win", gap: "\(Int(gap))s away",
                                            pct: Int((r.recordValue / Double(mine.fastestTime) * 100).rounded()), gameMode: gm),
                                gap / max(1, r.recordValue)))
                } else if r.recordType == "fewest_guesses", mine.bestScore > 0, Double(mine.bestScore) > r.recordValue {
                    let gap = Double(mine.bestScore) - r.recordValue
                    all.append((RecordChase(label: "\(yourRecordsModeTitle(gm)) \(RecordCatalog.label("fewest_guesses", gameMode: gm).lowercased())", gap: "\(Int(gap)) away",
                                            pct: Int((r.recordValue / Double(mine.bestScore) * 100).rounded()), gameMode: gm),
                                gap / max(1, r.recordValue)))
                }
            }
            return YourRecordsData(
                sweepRankToday: sweepRankToday,
                sweepRankAllTime: sweepRankAllTime,
                recordsHeld: heldOrder.compactMap { heldByKey[$0] },
                chases: all.sorted { $0.rel < $1.rel }.map(\.chase),
                loaded: true)
        }
    }

    /// The all-time record table + the user's sweep standings, concurrently.
    static func fetch(userId uid: String) async -> Raw {
        async let recs = (try? RecordsService.fetchAll()) ?? []
        async let dRank = SweepLeaderboardService.dailySweepRank(userId: uid)
        async let aRank = SweepLeaderboardService.allTimeSweepRank(userId: uid)
        return Raw(records: await recs, sweepRankToday: await dRank, sweepRankAllTime: await aRank)
    }
}

// MARK: - Shared chrome

/// Streak shields are granted every 7 days (web /api/shields/grant-milestone
/// MILESTONE_EVERY=7) — the "next shield" card counts toward the next
/// multiple of 7, NOT the [7, 30, 100] streak MEDAL milestones.
private let shieldEvery = 7
/// Sweep accent — indigo, matching the Daily/All-Time sweep boards.
private let sweepAccent = Color(hex: 0x4F46E5)
private let gold = Color(hex: 0xD97706)

/// Every mode with a records key — the sweep tiles and the More Games titles.
private let recordModes: [HomeMode] = (homeModes + moreModes).filter { $0.dbKey != nil }
private func recordMode(_ key: String?) -> HomeMode? { key.flatMap { k in recordModes.first { $0.dbKey == k } } }
fileprivate func yourRecordsModeTitle(_ key: String) -> String { recordMode(key)?.title ?? key }
private func recordAccent(_ gameMode: String?) -> Color { recordMode(gameMode)?.accent ?? gold }

/// The standard record card: 16pt radius, 1.5pt border, a 3pt gradient bar on top.
private struct RecordCardShell<Content: View>: View {
    let bar: [Color]
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: bar, startPoint: .leading, endPoint: .trailing).frame(height: 3)
            content
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

/// One personal record: icon, value, small label — dimmed when there is none yet.
/// Centered tile (mirrors the profile global-summary cards) so each cell sits
/// balanced in its grid column instead of hugging the left edge.
private func meCell(_ icon: String, _ value: String, _ label: String, _ color: Color, dim: Bool = false) -> some View {
    VStack(spacing: 3) {
        Image(systemName: icon).font(.system(size: 16)).foregroundStyle(dim ? Theme.textMuted : color)
        Text(value).font(Brand.font(15, .black)).foregroundStyle(dim ? Theme.textMuted : Theme.textPrimary)
            .lineLimit(1).minimumScaleFactor(0.7)
        Text(label).font(Brand.font(9, .bold)).foregroundStyle(Theme.textMuted)
            .multilineTextAlignment(.center).lineLimit(2)
    }
    .frame(maxWidth: .infinity).padding(.vertical, 10).padding(.horizontal, 4)
}

/// "You're <gap> from the <label> record" over a progress bar toward it.
private struct ChaseRow: View {
    let chase: RecordChase
    var bar: [Color] = [Color(hex: 0xA78BFA), Color(hex: 0x7C3AED)]
    var icon: Color = Theme.primary
    var body: some View {
        VStack(spacing: 3) {
            HStack(spacing: 5) {
                Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 12)).foregroundStyle(icon)
                (Text("You're ").font(Brand.font(11, .bold)).foregroundColor(Theme.textMuted)
                 + Text(chase.gap).font(Brand.font(11, .black)).foregroundColor(Theme.textPrimary)
                 + Text(" from the \(chase.label) record").font(Brand.font(11, .bold)).foregroundColor(Theme.textMuted))
                    .lineLimit(1).minimumScaleFactor(0.85)
                Spacer(minLength: 0)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border)
                    Capsule().fill(LinearGradient(colors: bar, startPoint: .leading, endPoint: .trailing))
                        .frame(width: g.size.width * min(1, Double(chase.pct) / 100))
                }
            }.frame(height: 6)
        }
    }
}

// MARK: - Next Up

/// Next Up — the next streak shield and your three closest record chases.
struct NextUpCard: View {
    let dailyStreak: Int
    let chases: [RecordChase]

    var body: some View {
        let next = (dailyStreak / shieldEvery + 1) * shieldEvery
        let top = Array(chases.prefix(3))
        RecordCardShell(bar: [Color(hex: 0xA78BFA), Color(hex: 0xEC4899)]) {
            VStack(alignment: .leading, spacing: 10) {
                Text("NEXT UP").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                VStack(spacing: 4) {
                    HStack {
                        Label("\(next)-day streak shield", systemImage: "flame.fill").font(Brand.font(11, .heavy)).foregroundStyle(Theme.textPrimary)
                            .labelStyle(.titleAndIcon)
                        Spacer()
                        Text("\(dailyStreak)/\(next)").font(Brand.font(11, .heavy)).foregroundStyle(Theme.textMuted)
                    }
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.border)
                            Capsule().fill(LinearGradient(colors: [Color(hex: 0xF97316), Color(hex: 0xFBBF24)], startPoint: .leading, endPoint: .trailing))
                                .frame(width: g.size.width * min(1, Double(dailyStreak) / Double(next)))
                        }
                    }.frame(height: 8)
                }
                // Record Chase: top-3 beatable records, each with a progress bar
                // toward the record.
                if !top.isEmpty {
                    VStack(spacing: 8) {
                        ForEach(top) { ChaseRow(chase: $0) }
                    }
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Daily Sweeps

/// Daily Sweeps — count, flawless, streak, best time, today's + all-time board
/// ranks (the old "Your Bests By Mode" Sweep window, on its own card now).
struct SweepRecordsCard: View {
    let sweep: MatchStatsService.DailySweepStats
    let sweepRankToday: (rank: Int, total: Int)?
    let sweepRankAllTime: (rank: Int, total: Int)?

    var body: some View {
        RecordCardShell(bar: [sweepAccent, sweepAccent.opacity(0.53)]) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    ModeIconView(icon: .asset("broom"), accent: sweepAccent, box: 32)
                    Text("Daily Sweeps").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                }
                if sweep.hasData {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                        meCell("sparkles", "\(sweep.sweepCount)", "Daily Sweeps", Color(hex: 0x7C3AED))
                        meCell("trophy.fill", "\(sweep.flawlessCount)", "Flawless Victories", gold)
                        meCell("flame.fill", "\(sweep.currentSweepStreak)", "Current Sweep Streak", Color(hex: 0xF97316))
                        meCell("clock.fill", sweep.bestSweepSecs > 0 ? formatShortTime(sweep.bestSweepSecs) : "—", "Best Sweep Time", Color(hex: 0x2563EB), dim: sweep.bestSweepSecs == 0)
                    }
                    // Your sweep standing on the sweep leaderboards (rank RPCs).
                    // §244: the flawless-streak notation rides the same row.
                    if sweepRankToday != nil || sweepRankAllTime != nil || sweep.currentFlawlessStreak > 0 {
                        HStack(spacing: 8) {
                            if let d = sweepRankToday { rankChip("Today", d) }
                            if let a = sweepRankAllTime { rankChip("All-Time", a) }
                            if sweep.currentFlawlessStreak > 0 { flawlessStreakChip }
                            Spacer(minLength: 0)
                        }
                    }
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "trophy").font(.system(size: 28)).foregroundStyle(Theme.textMuted.opacity(0.5))
                        Text("No sweeps yet").font(Brand.font(12, .bold)).foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
                }
            }
            .padding(14)
        }
    }

    /// §244: "🏆 Flawless: ×3 · best 5" — the streak notation beside the ranks.
    private var flawlessStreakChip: some View {
        HStack(spacing: 4) {
            Text("🏆").font(.system(size: 10))
            (Text("Flawless: ").font(Brand.font(9, .bold)).foregroundColor(Theme.textMuted)
             + Text("×\(sweep.currentFlawlessStreak)").font(Brand.font(11, .black)).foregroundColor(gold)
             + Text(sweep.bestFlawlessStreak > sweep.currentFlawlessStreak ? " · best \(sweep.bestFlawlessStreak)" : "")
                .font(Brand.font(9, .bold)).foregroundColor(Theme.textMuted))
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0xF59E0B).opacity(0.10)))
    }

    /// A compact "#rank of total" chip for the sweep card's standing row.
    private func rankChip(_ label: String, _ r: (rank: Int, total: Int)) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "sparkles").font(.system(size: 10)).foregroundStyle(sweepAccent)
            (Text("\(label): ").font(Brand.font(9, .bold)).foregroundColor(Theme.textMuted)
             + Text("#\(r.rank)").font(Brand.font(11, .black)).foregroundColor(gold)
             + Text(" of \(r.total)").font(Brand.font(9, .bold)).foregroundColor(Theme.textMuted))
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 8).fill(sweepAccent.opacity(0.08)))
    }
}

// MARK: - Per-game records

/// One game's personal bests + the all-time records you hold in it + your
/// closest chase (the old "Your Bests By Mode" card, on the game's own page).
struct GameRecordsCard: View {
    let dbKey: String
    let my: UserStatRow?
    let recordsHeld: [AllTimeRecord]
    let chases: [RecordChase]

    var body: some View {
        let accent = recordAccent(dbKey)
        let held = recordsHeld.filter { $0.gameMode == dbKey }
        let chase = chases.first { $0.gameMode == dbKey }
        RecordCardShell(bar: [accent, accent.opacity(0.53)]) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Your Records").font(Brand.font(14, .black)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                    if !held.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: "crown.fill").font(.system(size: 9))
                            Text("\(held.count) all-time record\(held.count == 1 ? "" : "s")").font(Brand.font(10, .black))
                        }
                        .foregroundStyle(gold)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(Theme.highlightGold))
                    }
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                    meCell("clock.fill", (my?.fastestTime ?? 0) > 0 ? formatShortTime(my!.fastestTime) : "—", "Fastest Win", accent, dim: (my?.fastestTime ?? 0) == 0)
                    meCell("target", (my?.bestScore ?? 0) > 0 ? RecordCatalog.fewestValue(my!.bestScore, gameMode: dbKey) : "—",
                           RecordCatalog.label("fewest_guesses", gameMode: dbKey), accent, dim: (my?.bestScore ?? 0) == 0)
                    meCell("bolt.fill", my != nil ? "\(my!.totalGames) games" : "—", "Games Played", accent, dim: my == nil)
                    meCell("trophy.fill", my != nil ? "\(my!.wins)–\(my!.losses)" : "—", "Win–Loss", accent, dim: my == nil)
                }
                if !held.isEmpty || chase != nil {
                    Divider().overlay(Theme.border)
                    VStack(spacing: 8) {
                        ForEach(held) { r in
                            HStack(spacing: 6) {
                                Image(systemName: "crown.fill").font(.system(size: 12)).foregroundStyle(gold)
                                (Text("You hold the all-time ").font(Brand.font(11, .bold)).foregroundColor(Theme.textMuted)
                                 + Text(RecordCatalog.labels[r.recordType]?.label ?? r.recordType).font(Brand.font(11, .black)).foregroundColor(Theme.textPrimary)
                                 + Text(" record").font(Brand.font(11, .bold)).foregroundColor(Theme.textMuted))
                                    .lineLimit(1).minimumScaleFactor(0.8)
                                Spacer(minLength: 4)
                                Text(r.formattedValue).font(Brand.font(11, .black)).foregroundStyle(gold)
                            }
                        }
                        if let chase {
                            ChaseRow(chase: chase, bar: [accent.opacity(0.53), accent], icon: accent)
                        }
                    }
                    .padding(.top, 2)
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Medals + Global Records

/// Medals tally + count of global records held, side by side. The records
/// tile is the door to the global Records screen (Hall of Fame), presented as
/// a sheet because RecordsTab owns a NavigationStack of its own.
struct RecordsHeldRow: View {
    @EnvironmentObject private var auth: AuthService
    let recordsHeld: [AllTimeRecord]
    /// Override for the records tile's tap; nil presents RecordsTab here.
    var onOpenRecords: (() -> Void)? = nil
    @State private var showRecords = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("MEDALS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                HStack(spacing: 10) {
                    Label("\(auth.profile?.goldMedals ?? 0)", systemImage: "crown.fill").font(Brand.font(13, .black)).foregroundStyle(gold)
                    Label("\(auth.profile?.silverMedals ?? 0)", systemImage: "medal.fill").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0x9CA3AF))
                    Label("\(auth.profile?.bronzeMedals ?? 0)", systemImage: "medal.fill").font(Brand.font(13, .black)).foregroundStyle(Color(hex: 0xB45309))
                }.labelStyle(.titleAndIcon)
                Text("Daily top-3 finishes").font(Brand.font(10, .bold)).foregroundStyle(Theme.textMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))

            Button {
                if let onOpenRecords { onOpenRecords() } else { showRecords = true }
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("GLOBAL RECORDS").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    Label("\(recordsHeld.count)", systemImage: "star.fill").font(Brand.font(13, .black))
                        .foregroundStyle(recordsHeld.isEmpty ? Theme.textMuted : gold).labelStyle(.titleAndIcon)
                    Text("all-time record\(recordsHeld.count == 1 ? "" : "s") held · Hall of Fame →")
                        .font(Brand.font(10, .bold)).foregroundStyle(Color(hex: 0x7C3AED))
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(14)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1.5))
            }
            .buttonStyle(PressableStyle())
        }
        .sheet(isPresented: $showRecords) { RecordsTab().presentationDetents([.large]) }
    }
}

// MARK: - Trophy Shelf

/// Trophy shelf (§245, founder: "it is an eyesore as it sits today") —
/// marquee jewels up top (most impressive records, auto-picked), then
/// type-grouped shelves of mode-accented glyph tiles; the repeated record
/// label becomes the shelf header, said once. Empty when you hold nothing.
struct TrophyShelf: View {
    @EnvironmentObject private var auth: AuthService
    let recordsHeld: [AllTimeRecord]
    // §245: one trophy-case card render/upload at a time.
    @State private var sharingShelf = false

    var body: some View {
        if !recordsHeld.isEmpty { shelf }
    }

    private var shelf: some View {
        let marquee = marqueeRecords
        let marqueeIds = Set(marquee.map(\.id))
        let shelfOrder = ["fastest_win", "fewest_guesses", "longest_streak", "most_games_played",
                          "most_gold_medals", "highest_level", "most_daily_completions"]
        let groups = shelfOrder
            .map { t in (type: t, rows: recordsHeld.filter { $0.recordType == t && !marqueeIds.contains($0.id) }) }
            .filter { !$0.rows.isEmpty }
        return RecordCardShell(bar: [Color(hex: 0xFBBF24), gold]) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("YOUR TROPHY SHELF").font(Brand.font(10, .black)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    Spacer()
                    Button {
                        guard !sharingShelf else { return }
                        sharingShelf = true
                        LeaderboardShareFlow.shareTrophyCase(records: recordsHeld,
                                                             username: auth.profile?.username)
                        sharingShelf = false
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMuted)
                    }
                    .buttonStyle(.plain)
                    .opacity(sharingShelf ? 0.4 : 1)
                    .accessibilityLabel("Share trophy shelf")
                }
                // Marquee jewels — the records worth a plinth of their own.
                ForEach(marquee) { r in marqueeCard(r) }
                // Type-grouped shelves.
                ForEach(groups, id: \.type) { g in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 4) {
                            Image(systemName: RecordCatalog.labels[g.type]?.symbol ?? "star.fill")
                                .font(.system(size: 9)).foregroundStyle(gold)
                            Text((RecordCatalog.labels[g.type]?.label ?? g.type).uppercased())
                                .font(Brand.font(9, .black)).tracking(0.7).foregroundStyle(Theme.textMuted)
                        }
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 6)], alignment: .leading, spacing: 6) {
                            ForEach(g.rows) { r in trophyTile(r) }
                        }
                        Rectangle().fill(Color(hex: 0xFDE68A).opacity(0.33)).frame(height: 1)
                    }
                }
            }
            .padding(14)
        }
    }

    /// §245: the auto-picked crown jewels — best fastest-win, best fewest-guesses.
    private var marqueeRecords: [AllTimeRecord] {
        func bestOf(_ type: String) -> AllTimeRecord? {
            recordsHeld.filter { $0.recordType == type && $0.gameMode != nil }
                .min { $0.recordValue < $1.recordValue }
        }
        return [bestOf("fastest_win"), bestOf("fewest_guesses")].compactMap { $0 }
    }

    @ViewBuilder private func recordGlyph(_ gameMode: String?, box: CGFloat) -> some View {
        if let m = recordMode(gameMode) {
            ModeIconView(icon: m.icon, accent: m.accent, box: box)
        } else {
            RoundedRectangle(cornerRadius: box * 0.27)
                .fill(gold.opacity(0.08))
                .frame(width: box, height: box)
                .overlay(Image(systemName: "star.fill").font(.system(size: box * 0.42)).foregroundStyle(gold))
        }
    }

    private func heldSince(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let withFrac = ISO8601DateFormatter(); withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let date = withFrac.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "MMM d"
        return f.string(from: date)
    }

    private func marqueeCard(_ r: AllTimeRecord) -> some View {
        HStack(spacing: 12) {
            recordGlyph(r.gameMode, box: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(r.gameMode.map(yourRecordsModeTitle) ?? "Global") · \(RecordCatalog.label(r.recordType, gameMode: r.gameMode))")
                    .font(Brand.font(9, .black)).tracking(0.6).foregroundStyle(Color(hex: 0x92400E))
                    .lineLimit(1).minimumScaleFactor(0.8)
                Text(r.formattedValue).font(Brand.font(22, .black)).foregroundStyle(gold)
            }
            Spacer(minLength: 4)
            if let since = heldSince(r.achievedAt) {
                VStack(alignment: .trailing, spacing: 0) {
                    Text("held since").font(Brand.font(9, .bold)).foregroundStyle(Color(hex: 0xB45309))
                    Text(since).font(Brand.font(10, .black)).foregroundStyle(Color(hex: 0xB45309))
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12)
            .fill(LinearGradient(colors: [Color(hex: 0xFFFBEB), Color(hex: 0xFEF3C7)], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xFDE68A), lineWidth: 1))
    }

    private func trophyTile(_ r: AllTimeRecord) -> some View {
        HStack(spacing: 6) {
            recordGlyph(r.gameMode, box: 20)
            Text(r.formattedValue).font(Brand.font(11, .black)).foregroundStyle(recordAccent(r.gameMode))
                .lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 6).padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 9).fill(Theme.background))
    }
}
