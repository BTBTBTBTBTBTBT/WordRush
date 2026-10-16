import SwiftUI
import Supabase
import WordociousCore
#if canImport(UIKit)
import UIKit
#endif

// LEADERBOARD SHARE — the daily-leaderboard share card (solo / VS / yesterday's
// podium) + its share flow. Mirrors web lib/leaderboard-share.ts (pure input
// builders) and lib/share-image.ts drawLeaderboardCard (a 1080-wide canvas
// sized to its rows). FINISH_SPEC §S1: the share sheet gets the IMAGE ONLY (the
// old linkOnly /s/ path and its upload are gone). Keep copy strings identical to web.

// MARK: - Card input model (web ShareLeaderboardInput parity)

struct LbShareRow {
    let rank: Int
    let name: String
    let scoreDisplay: String
    /// Full-stats subline ("4 guesses · 3:44 · Win" / "3-1 today"). Nil on the
    /// compressed top-5 rows of the sharer-below-top-5 layout.
    var subline: String? = nil
    /// Sharer's own row — gold "you" highlight + "· YOU" label.
    var isYou: Bool = false
    /// §249: the mode-dot strip, that day's sweep order — nil element =
    /// unplayed (hollow), -1 = loss (red), else 0..1 win intensity t.
    var dots: [Double?]? = nil
    /// Night frame (founder 10-16): who this row is, so the podium draws their real mascot — the same avatar the board
    /// shows (AvatarDirectory look) — and name colors. Nil on the brag cards (streak days, records).
    var userId: String? = nil
    var username: String? = nil
    var avatarUrl: String? = nil
    var accentHex: String? = nil
    var emoji: String? = nil
}

struct LbShareDelta {
    let text: String
    let improved: Bool
}

enum LbShareVariant: String {
    case solo, vs, podium
    // FRIENDS (§207): friends-only board + settled friends podium — same
    // geometry, indigo identity, dense friend ranks in rows/you/shareRank.
    case friends, friendsPodium
    // SWEEP (§231): the cross-mode Sweep board + its settled podium — same
    // geometry, the Daily Sweep violet/pink identity, rows from SweepEntry
    // (RPC tie-aware ranks, "time · X/N · Sweep|Flawless" sublines).
    case sweep, sweepPodium
    // WEEKLY RACE (§234): the friends panel's THIS WEEK'S RACE — me + friends
    // by the week's daily points, indigo identity, live "Nd HH:MM left" chip.
    case weeklyRace
    // §244/§245: the personal brag cards — gold identity.
    case flawlessStreak, trophyCase

    /// /s/ kind — also the storage-key prefix (web leaderboardKind()).
    var kind: String {
        switch self {
        case .solo: return "Leaderboard"
        case .vs: return "VsLeaderboard"
        case .podium: return "Podium"
        case .friends: return "FriendsBoard"
        case .friendsPodium: return "FriendsPodium"
        case .sweep: return "SweepBoard"
        case .sweepPodium: return "SweepPodium"
        case .weeklyRace: return "WeeklyRace"
        case .flawlessStreak: return "FlawlessStreak"
        case .trophyCase: return "TrophyCase"
        }
    }
}

struct LbShareInput {
    let variant: LbShareVariant
    /// Web ShareMode name ("Six", "Classic") — drives the URL `lm` param + key.
    let shareMode: String
    /// DB mode key ("DUEL_6") — share_events game_mode tag.
    let gameModeRaw: String
    /// Mode chip accent (VS teal on the VS variant, catalog accent otherwise).
    let modeAccent: Color
    /// Mode chip text ("Classic Six", "Classic Six VS").
    let modeChip: String
    /// Date chip text ("Aug 7, 2026 · #123 · as of 11:15 AM" / "Aug 6, 2026 · Final").
    let dateChip: String
    /// Top rows (≤5; podium ≤3), ordered by rank.
    let rows: [LbShareRow]
    /// Sharer's row when ranked below the top rows (after a "• • •" divider).
    var you: LbShareRow? = nil
    /// "#12 of 87" under the out-of-top you-row.
    var youRankLine: String? = nil
    /// Rank-vs-yesterday pill; nil = didn't play yesterday / unchanged.
    var delta: LbShareDelta? = nil
    /// Footer hook line.
    let footer: String
    /// Board day (yyyy-MM-dd) — the storage-key date.
    let day: String
    var shareRank: Int? = nil
    var sharePlayers: Int? = nil
}

// MARK: - Pure builders (web lib/leaderboard-share.ts parity)

enum LeaderboardShareBuilder {
    struct RankedEntry {
        let rank: Int
        let entry: LeaderboardEntry
    }

    /// Day #1 of the daily system (web DAILY_PUZZLE_EPOCH) — drives the "#123"
    /// puzzle number on the date chip.
    static let dailyPuzzleEpoch = (year: 2026, month: 4, day: 7)

    /// 1-based daily puzzle number for a yyyy-MM-dd day; nil for bad input or
    /// pre-epoch days.
    static func puzzleNumber(forDay day: String) -> Int? {
        let parts = day.split(separator: "-")
        guard parts.count == 3,
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let epoch = cal.date(from: DateComponents(year: dailyPuzzleEpoch.year,
                                                        month: dailyPuzzleEpoch.month,
                                                        day: dailyPuzzleEpoch.day)),
              let date = cal.date(from: DateComponents(year: y, month: m, day: d)) else { return nil }
        let n = Int((date.timeIntervalSince(epoch) / 86400).rounded()) + 1
        return n >= 1 ? n : nil
    }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// "Aug 7, 2026" from a yyyy-MM-dd day string (no Date/timezone involved).
    static func formatBoardDate(_ day: String) -> String {
        let parts = day.split(separator: "-")
        guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]),
              m >= 1, m <= 12 else { return day }
        return "\(months[m - 1]) \(d), \(parts[0])"
    }

    /// "11:15 AM" — device-local clock time for the snapshot stamp.
    static func clockTime(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        let h24 = c.hour ?? 0
        let ampm = h24 >= 12 ? "PM" : "AM"
        let h = h24 % 12 == 0 ? 12 : h24 % 12
        return "\(h):\(String(format: "%02d", c.minute ?? 0)) \(ampm)"
    }

    /// The "▲3 vs yesterday" / "▼2 vs yesterday" pill. Nil when the sharer
    /// didn't play yesterday or their rank is unchanged.
    static func rankDelta(yesterdayRank: Int?, todayRank: Int) -> LbShareDelta? {
        guard let y = yesterdayRank else { return nil }
        let d = y - todayRank
        if d == 0 { return nil }
        return d > 0
            ? LbShareDelta(text: "▲\(d) vs yesterday", improved: true)
            : LbShareDelta(text: "▼\(-d) vs yesterday", improved: false)
    }

    private static func fmtClock(_ seconds: Double) -> String {
        let s = max(0, Int(seconds))
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }

    static func soloSubline(_ e: LeaderboardEntry) -> String { soloSubline(e, gameModeRaw: nil) }

    /// More Games §11: the row's guess stat through the mode's semantics
    /// ("0 mistakes", "Par", "Hubbub") — web leaderboard-share-flow guessLabelFor.
    static func soloSubline(_ e: LeaderboardEntry, gameModeRaw: String?) -> String {
        let meta = gameModeRaw.flatMap { ModeGen.byDbKey($0) }
        let g = formatGuessStat(semantics: meta?.guessSemantics ?? "guesses", guessBase: meta?.guessBase ?? 1, guessCount: e.guessCount)
        return "\(g) · \(fmtClock(e.timeSeconds)) · \(e.completed ? "Win" : "Loss")"
    }

    static func vsSubline(_ e: LeaderboardEntry) -> String {
        // W-L today. vs_losses excludes draws; rows without the column fall
        // back to games-minus-wins (web parity).
        let wins = e.vsWins ?? 0
        let losses = e.vsLosses ?? max(0, (e.vsGames ?? 0) - wins)
        return "\(wins)-\(losses) today"
    }

    private static func row(_ r: RankedEntry, userId: String?,
                            subline: ((LeaderboardEntry) -> String)?,
                            scoreLabels: [Double: String] = [:]) -> LbShareRow {
        LbShareRow(rank: r.rank,
                   name: r.entry.username,
                   scoreDisplay: scoreLabels[r.entry.compositeScore] ?? formatScore(r.entry.compositeScore),
                   subline: subline.map { $0(r.entry) },
                   isYou: userId != nil && r.entry.userId == userId,
                   userId: r.entry.userId, username: r.entry.username, avatarUrl: r.entry.profiles.avatarUrl,
                   accentHex: r.entry.profiles.accentColor, emoji: r.entry.profiles.avatarEmoji)
    }

    /// Today's-board card. Top 5 rows with full stats; a sharer below the top 5
    /// compresses the top rows to name+score and adds their highlighted
    /// full-stats row after a "• • •" divider with "#R of TOTAL". A sharer who
    /// hasn't played today gets no you-row. Nil for an empty board.
    static func buildDailyInput(
        variant: LbShareVariant, shareMode: String, modeLabel: String,
        gameModeRaw: String, modeAccent: Color,
        day: String, now: Date = Date(),
        ranked: [RankedEntry], userId: String?,
        userRank: (rank: Int, total: Int)?, userEntry: LeaderboardEntry?,
        yesterdayRank: Int?
    ) -> LbShareInput? {
        let top = Array(ranked.prefix(5))
        guard !top.isEmpty else { return nil }

        let subline: (LeaderboardEntry) -> String = variant == .vs ? vsSubline : { soloSubline($0, gameModeRaw: gameModeRaw) }
        let youInTop = userId != nil && top.contains { $0.entry.userId == userId }
        let belowTop = !youInTop && userId != nil && userRank != nil && userEntry != nil
        let delta = userRank.flatMap { rankDelta(yesterdayRank: yesterdayRank, todayRank: $0.rank) }

        let puzzle = puzzleNumber(forDay: day)
        // TIE-AWARE scores (board parity): rows sharing a whole number on THIS
        // card render the decimals that rank them — the sharer's below-fold
        // row joins the collision set.
        let cardLabels = tieAwareScoreLabels(
            top.map(\.entry.compositeScore) + (belowTop ? [userEntry!.compositeScore] : []))
        // "as of h:mm" marks the card as a SNAPSHOT of a live board — today's
        // standings keep moving. The settled Podium card says "· Final" instead.
        let dateChip = "\(formatBoardDate(day))\(puzzle.map { " · #\($0)" } ?? "") · as of \(clockTime(now))"

        var input = LbShareInput(
            variant: variant, shareMode: shareMode, gameModeRaw: gameModeRaw,
            modeAccent: modeAccent,
            modeChip: variant == .vs ? "\(modeLabel) VS" : modeLabel,
            dateChip: dateChip,
            // Sharer below the top 5 → compress top rows to name+score only.
            rows: top.map { row($0, userId: userId, subline: subline, scoreLabels: cardLabels) },
            footer: variant == .friends
                ? "Add your friends — play free at wordocious.com"
                : variant == .vs
                    ? "Think you can take them? wordocious.com"
                    : "Can you beat them? Play free at wordocious.com",
            day: day)
        input.delta = delta
        input.shareRank = userRank?.rank
        input.sharePlayers = userRank?.total

        if belowTop, let r = userRank, let e = userEntry {
            input.you = LbShareRow(rank: r.rank, name: e.username,
                                   scoreDisplay: cardLabels[e.compositeScore] ?? formatScore(e.compositeScore),
                                   subline: subline(e), isYou: true,
                                   userId: e.userId, username: e.username, avatarUrl: e.profiles.avatarUrl,
                                   accentHex: e.profiles.accentColor, emoji: e.profiles.avatarEmoji)
            input.youRankLine = "#\(r.rank) of \(r.total)"
        }
        return input
    }

    /// The settled variant for Yesterday's Winners / Podium: "YESTERDAY'S
    /// PODIUM" identity, "MMM D, YYYY · Final" chip, top-3 full-stats rows.
    /// Nil when yesterday had no finishers.
    static func buildPodiumInput(
        playType: LbShareVariant, friends: Bool = false,
        shareMode: String, modeLabel: String,
        gameModeRaw: String, modeAccent: Color,
        day: String, ranked: [RankedEntry], userId: String?,
        userRank: (rank: Int, total: Int)? = nil,
        userEntry: LeaderboardEntry? = nil
    ) -> LbShareInput? {
        // Top 5 + sharer's final rank — daily-card parity (founder, Aug 10).
        let top = Array(ranked.prefix(5))
        guard !top.isEmpty else { return nil }
        let subline: (LeaderboardEntry) -> String = playType == .vs ? vsSubline : { soloSubline($0, gameModeRaw: gameModeRaw) }
        let youInTop = userId != nil && top.contains { $0.entry.userId == userId }
        let belowTop = !youInTop && userId != nil && userRank != nil && userEntry != nil
        let cardLabels = tieAwareScoreLabels(
            top.map(\.entry.compositeScore) + (belowTop ? [userEntry!.compositeScore] : []))
        var input = LbShareInput(
            variant: friends ? .friendsPodium : .podium,
            shareMode: shareMode, gameModeRaw: gameModeRaw,
            modeAccent: modeAccent,
            modeChip: playType == .vs ? "\(modeLabel) VS" : modeLabel,
            dateChip: "\(formatBoardDate(day)) · Final",
            rows: top.map { row($0, userId: userId, subline: subline, scoreLabels: cardLabels) },
            footer: "Today’s board is open — wordocious.com",
            day: day)
        input.shareRank = userRank?.rank
        input.sharePlayers = userRank?.total
        if belowTop, let r = userRank, let e = userEntry {
            input.you = LbShareRow(rank: r.rank, name: e.username,
                                   scoreDisplay: cardLabels[e.compositeScore] ?? formatScore(e.compositeScore),
                                   subline: subline(e), isYou: true,
                                   userId: e.userId, username: e.username, avatarUrl: e.profiles.avatarUrl,
                                   accentHex: e.profiles.accentColor, emoji: e.profiles.avatarEmoji)
            input.youRankLine = "#\(r.rank) of \(r.total)"
        }
        return input
    }

    // MARK: Sweep (§231)

    /// Web ShareMode for the Daily Sweep — the `lm` URL param + key segment.
    static let sweepShareMode = "SWEEP"
    /// share_events game_mode tag — the existing Daily Sweep card's mode.
    static let sweepGameModeRaw = "DailySweep"
    static let sweepModeChip = "Daily Sweep"
    static let sweepAccent = Color(hex: 0x7C3AED)

    /// "12m 4s · 8/8 · Flawless" — the sweep row's full-stats subline. The
    /// sweep has no guess count; time + modes-won + the sweep tier are what
    /// the board itself shows. The denominator is that day's era size (More
    /// Games Stage 4/9), never a literal.
    static func sweepSubline(_ e: SweepEntry, day: String) -> String {
        "\(formatShortTime(e.totalTime)) · \(e.modesWon)/\(ModeGen.requiredSweepCount(for: day)) · \(e.isFlawless ? "Flawless" : "Sweep")"
    }


    /// §249: the mode-dot strip's order for a day — that day's sweep set in
    /// canonical catalog order, the same order the in-app SweepModeDots use.
    static func sweepDotOrder(day: String) -> [String] { ModeGen.sweepModes(for: day) }

    /// §249: per-dot values — nil = unplayed, -1 = loss, else win intensity t.
    static func sweepDotValues(_ det: LeaderboardService.SweepDetails?, day: String) -> [Double?]? {
        guard let det else { return nil }
        return sweepDotOrder(day: day).map { mode -> Double? in
            guard let d = det.modes[mode] else { return nil }
            if !d.completed { return -1 }
            let ratio = d.score / DailyScoring.modeScoreCeiling(gameMode: mode, dateKey: day)
            return min(1, max(0, (ratio - 0.35) / 0.55))
        }
    }

    private static func sweepRow(_ e: SweepEntry, userId: String?, day: String,
                                 scoreLabels: [Double: String],
                                 dots: [Double?]? = nil) -> LbShareRow {
        // Sublines stay on every row (web parity) — a sweep card is at most
        // 5 + 1 rows, so there's room without the daily card's compression.
        LbShareRow(rank: e.rank, name: e.username,
                   scoreDisplay: scoreLabels[e.totalScore] ?? formatScore(e.totalScore),
                   subline: sweepSubline(e, day: day),
                   isYou: userId != nil && e.userId == userId,
                   dots: dots, userId: e.userId, username: e.username, avatarUrl: e.avatarUrl)
    }

    /// Sweep board / sweep podium card from the page's SweepEntry rows. Ranks
    /// come from the entries themselves (the RPC is tie-aware), so no
    /// RankedEntry wrapping. `podium` → yesterday's settled top 3 with the
    /// "· Final" chip; otherwise today's top 5 "as of h:mm". The sharer below
    /// the top rows gets their you-row only when the board holds it (no extra
    /// window read — a sweep board is tiny) plus "#R of TOTAL" from the sweep
    /// rank; absent either, the card simply omits it. No delta pill: sweeping
    /// two days running is rare enough that "vs yesterday" would almost
    /// always be blank. Nil for an empty board.
    static func buildSweepInput(
        podium: Bool, day: String, now: Date = Date(),
        entries: [SweepEntry], userId: String?,
        userRank: (rank: Int, total: Int)?,
        details: [String: LeaderboardService.SweepDetails] = [:]
    ) -> LbShareInput? {
        let top = Array(entries.prefix(podium ? 3 : 5))
        guard !top.isEmpty else { return nil }
        let youInTop = userId != nil && top.contains { $0.userId == userId }
        let userEntry = userId.flatMap { uid in entries.first { $0.userId == uid } }
        let belowTop = !youInTop && userRank != nil && userEntry != nil
        let cardLabels = tieAwareScoreLabels(
            top.map(\.totalScore) + (belowTop ? [userEntry!.totalScore] : []))
        let puzzle = puzzleNumber(forDay: day)
        let dateChip = podium
            ? "\(formatBoardDate(day)) · Final"
            : "\(formatBoardDate(day))\(puzzle.map { " · #\($0)" } ?? "") · as of \(clockTime(now))"

        var input = LbShareInput(
            variant: podium ? .sweepPodium : .sweep,
            shareMode: sweepShareMode, gameModeRaw: sweepGameModeRaw,
            modeAccent: sweepAccent, modeChip: sweepModeChip,
            dateChip: dateChip,
            rows: top.map { sweepRow($0, userId: userId, day: day, scoreLabels: cardLabels,
                                     dots: sweepDotValues(details[$0.userId], day: day)) },
            footer: "Can you sweep all \(ModeGen.requiredSweepCount(for: day))? Play free at wordocious.com",
            day: day)
        input.shareRank = userRank?.rank
        input.sharePlayers = userRank?.total
        if belowTop, let r = userRank, let e = userEntry {
            input.you = sweepRow(e, userId: userId, day: day, scoreLabels: cardLabels,
                                 dots: sweepDotValues(details[e.userId], day: day))
            input.youRankLine = "#\(r.rank) of \(r.total)"
        }
        return input
    }

    // MARK: Weekly race (§234)

    /// Web ShareMode for the weekly race — the `lm` URL param + key segment.
    static let weeklyRaceShareMode = "WEEKLY"
    /// share_events game_mode tag.
    static let weeklyRaceGameModeRaw = "WeeklyRace"
    static let weeklyRaceModeChip = "Weekly Race"
    /// Chip accent = the variant's label indigo (the DailySweep convention).
    static let weeklyRaceAccent = Color(hex: 0x4F46E5)

    /// "3d 14:22" / "07:44:03" — compact time-to-Monday-midnight for the date
    /// chip. Same boundary as FriendsPanelView.weekEndsLabel (weeks run
    /// Mon–Sun, reset Monday 00:00 local); compact because it rides a chip
    /// that also carries the date and the as-of stamp.
    static func weeklyRaceTimeLeft(at now: Date) -> String {
        let cal = Calendar.current
        let dow = cal.component(.weekday, from: now) // 1 Sun … 7 Sat
        let daysToMonday = dow == 1 ? 1 : 9 - dow // Mon→7 … Sat→2, Sun→1
        let end = cal.startOfDay(for: cal.date(byAdding: .day, value: daysToMonday, to: now)!)
        let secs = max(0, Int(end.timeIntervalSince(now)))
        let d = secs / 86400
        return d >= 1
            ? "\(d)d " + String(format: "%02d:%02d", (secs % 86400) / 3600, (secs % 3600) / 60)
            : String(format: "%02d:%02d:%02d", secs / 3600, (secs % 3600) / 60, secs % 60)
    }

    /// Weekly-race card from the FriendsService cache — the panel's podium
    /// extended to the top 5. Me + all friends sorted by this week's points,
    /// dense ranks; a sharer below the top 5 gets the "• • •" you-row with
    /// "#R of N" (everyone is already in the list, so no window read). No
    /// delta pill — the race IS the week, there's no yesterday to compare.
    /// Nil until someone scores: a Monday-morning zero-point card would just
    /// be a list of names.
    static func buildWeeklyRaceInput(
        friends: [FriendsService.FriendProfile],
        me: (username: String, weekPoints: Int, todayPoints: Int)?,
        now: Date = Date()
    ) -> LbShareInput? {
        struct Entry { let name: String; let week: Int; let today: Int; let isYou: Bool }
        var entries = friends.map {
            Entry(name: $0.username, week: $0.weekPoints ?? 0,
                  today: $0.todayPoints ?? 0, isYou: false)
        }
        // Sharer's row wears their REAL username (the panel's "You" alias
        // would be meaningless on a card that leaves the phone).
        if let me {
            entries.append(Entry(name: me.username, week: me.weekPoints,
                                 today: me.todayPoints, isYou: true))
        }
        entries.sort { $0.week > $1.week }
        guard entries.contains(where: { $0.week > 0 }) else { return nil }

        func row(_ e: Entry, rank: Int) -> LbShareRow {
            LbShareRow(rank: rank, name: e.name,
                       scoreDisplay: "\(e.week.formatted()) pts",
                       subline: e.today > 0 ? "\(e.today.formatted()) today" : nil,
                       isYou: e.isYou)
        }

        let day = LeaderboardService.todayLocal()
        // Live board, but the horizon is the week — the chip carries the
        // countdown ("2d 14:22 left") alongside the snapshot stamp.
        let dateChip = "\(formatBoardDate(day)) · \(weeklyRaceTimeLeft(at: now)) left · as of \(clockTime(now))"

        var input = LbShareInput(
            variant: .weeklyRace,
            shareMode: weeklyRaceShareMode, gameModeRaw: weeklyRaceGameModeRaw,
            modeAccent: weeklyRaceAccent, modeChip: weeklyRaceModeChip,
            dateChip: dateChip,
            rows: entries.prefix(5).enumerated().map { row($0.element, rank: $0.offset + 1) },
            footer: "Think you can catch them? Play free at wordocious.com",
            day: day)
        if let youIdx = entries.firstIndex(where: { $0.isYou }) {
            input.shareRank = youIdx + 1
            input.sharePlayers = entries.count
            if youIdx >= 5 {
                input.you = row(entries[youIdx], rank: youIdx + 1)
                input.youRankLine = "#\(youIdx + 1) of \(entries.count)"
            }
        }
        return input
    }

    /// §248: per-day totals for the streak card's rows.
    struct FlawlessDayStats {
        let day: String
        let timeSeconds: Int
        let guesses: Int
        let hints: Int
        let points: Double
        /// §249: per-dot values for the row's mode strip.
        var dots: [Double?]? = nil
    }

    /// §244/§248 (founder: the first cut "doesn't make sense and looks ugly"):
    /// one row per streak day, OLDEST FIRST, each carrying the sweep-row stats
    /// (time · guesses · hints) and the day's points; today rides last with
    /// the gold you-treatment. Rows are numbered by day-of-streak — the
    /// renderer skips crown/medals for this variant. Nil when no streak.
    static func buildFlawlessStreakInput(streak: Int, bestStreak: Int,
                                         username: String?,
                                         days: [FlawlessDayStats] = [],
                                         now: Date = Date()) -> LbShareInput? {
        guard streak >= 1 else { return nil }
        let day = LeaderboardService.todayLocal()
        let statsByDay = Dictionary(uniqueKeysWithValues: days.map { ($0.day, $0) })
        let shown = min(streak, 5)
        let rows = (0..<shown).map { i -> LbShareRow in
            let dayNumber = streak - shown + i + 1
            let d = MatchStatsService.shiftLocalDay(day, dayNumber - streak)
            let st = statsByDay[d]
            var subline: String? = nil
            if let st {
                subline = "\(formatShortTime(st.timeSeconds)) · \(st.guesses) guess\(st.guesses == 1 ? "" : "es")"
                if st.hints > 0 { subline! += " · \(st.hints) hint\(st.hints == 1 ? "" : "s")" }
            }
            // "N/N won" reads the era of THAT day (a streak can straddle Stage 9).
            let n = ModeGen.requiredSweepCount(for: d)
            return LbShareRow(rank: dayNumber, name: formatBoardDate(d),
                              scoreDisplay: st.map { "\(Int($0.points.rounded()).formatted()) pts" } ?? "\(n)/\(n) won",
                              subline: subline, isYou: i == shown - 1,
                              dots: st?.dots)
        }
        let skipped = streak - shown
        var footer = "\(streak) straight day\(streak == 1 ? "" : "s") winning every daily"
        if skipped > 0 { footer += " (first \(skipped) not shown)" }
        if bestStreak > streak { footer += " · best \(bestStreak)" }
        footer += " · wordocious.com"
        return LbShareInput(
            variant: .flawlessStreak,
            shareMode: "FlawlessStreak", gameModeRaw: "FlawlessStreak",
            modeAccent: Color(hex: 0xD97706), modeChip: "Flawless ×\(streak)",
            dateChip: "\(formatBoardDate(day)) · as of \(clockTime(now))",
            rows: rows, footer: footer, day: day)
    }

    /// §245: the trophy-case brag — held records, most impressive first.
    static func buildTrophyCaseInput(records: [AllTimeRecord], username: String?,
                                     now: Date = Date()) -> LbShareInput? {
        guard !records.isEmpty else { return nil }
        let order = ["fastest_win", "fewest_guesses", "longest_streak", "most_gold_medals",
                     "highest_level", "most_games_played", "most_daily_completions"]
        let lowerIsBetter: Set<String> = ["fastest_win", "fewest_guesses"]
        let sorted = records.sorted { a, b in
            let oa = order.firstIndex(of: a.recordType) ?? 99
            let ob = order.firstIndex(of: b.recordType) ?? 99
            if oa != ob { return oa < ob }
            return lowerIsBetter.contains(a.recordType)
                ? a.recordValue < b.recordValue : a.recordValue > b.recordValue
        }
        func title(_ gm: String?) -> String {
            gm.flatMap { key in homeModes.first { $0.dbKey == key }?.title } ?? "Global"
        }
        let rows = sorted.prefix(5).enumerated().map { i, r in
            LbShareRow(rank: i + 1,
                       name: "\(title(r.gameMode)) · \(RecordCatalog.labels[r.recordType]?.label ?? r.recordType)",
                       scoreDisplay: r.formattedValue, subline: nil, isYou: false)
        }
        let extra = records.count - rows.count
        var footer = "\(records.count) all-time record\(records.count == 1 ? "" : "s") held"
        if extra > 0 { footer += " (+\(extra) more)" }
        footer += " · wordocious.com"
        let day = LeaderboardService.todayLocal()
        return LbShareInput(
            variant: .trophyCase,
            shareMode: "TrophyCase", gameModeRaw: "TrophyCase",
            modeAccent: Color(hex: 0xD97706),
            modeChip: username.map { "\($0)'s Records" } ?? "Trophy Case",
            dateChip: "\(formatBoardDate(day)) · as of \(clockTime(now))",
            rows: Array(rows), footer: footer, day: day)
    }
}

// MARK: - Card renderer: the night frame (founder 10-16, option B)
//
// docs/design/review/share-cards-1016/SPEC.md: the night gradient, the board day's title art (art-day-*) over the game's
// season-aware title art, an info pill, then the app's own stadium PODIUM drawn static (core PodiumArt: the stage art, the
// real mascots on the steps, bubble names above their heads, the crown hat on #1, the stats in the step panels, the open
// spot's sleeping R), rows for 4th and below plus the sharer's gold-tinted row, and the lit cast footer. The canvas is
// 4:5 … 3:4 (the iMessage fit): more rows grow the card, then the podium scales down — never the text.

#if canImport(UIKit)
struct LeaderboardShareCardView: View {
    let input: LbShareInput

    private static let rowH: CGFloat = 68
    private static let rowGap: CGFloat = 4
    private static let sidePad: CGFloat = 30
    /// Rows below the podium tighten the whole header (and the podium's headroom) so the podium stays big.
    private var compact: Bool { listCount > 0 }
    private var headroom: CGFloat { compact ? 0.11 : 0.14 }
    private var castW: CGFloat { CGFloat(ShareCardPlan.castW) }
    private var castH: CGFloat { ShareCastWordmark.height(castW) }

    // ── What the card shows ──────────────────────────────────────────────

    private var layout: (filled: Int, open: [Int]) { PodiumLayout.layout(input.rows.map(\.rank)) }
    /// The brag cards (streak days, records) are plain lists; every board wears the podium.
    private var usePodium: Bool {
        switch input.variant {
        case .flawlessStreak, .trophyCase: return false
        default: return layout.filled > 0
        }
    }
    private var podiumRows: [LbShareRow] { usePodium ? Array(input.rows.prefix(layout.filled)) : [] }
    private var listRows: [LbShareRow] { usePodium ? Array(input.rows.dropFirst(layout.filled)) : input.rows }
    /// The sharer's row below the shown rows (after a "• • •" gap).
    private var youRow: LbShareRow? { input.you }
    private var listCount: Int { listRows.count + (youRow != nil ? 1 : 0) }
    private var listH: CGFloat {
        guard listCount > 0 else { return 0 }
        return CGFloat(listCount) * Self.rowH + CGFloat(listCount - 1) * Self.rowGap + (youRow != nil ? 22 : 0)
    }

    private static let dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

    /// The board day's weekday index (0 = Sunday), from the yyyy-MM-dd day.
    private var weekday: Int? {
        let parts = input.day.split(separator: "-")
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let date = cal.date(from: DateComponents(year: y, month: m, day: d)) else { return nil }
        return cal.component(.weekday, from: date) - 1
    }

    /// The board day's title (FRIDAY'S FINEST …) over the game's title, for the per-game and Sweep boards.
    private var dayArt: String? {
        switch input.variant {
        case .weeklyRace, .trophyCase, .flawlessStreak: return nil
        default:
            guard let w = weekday, w >= 0, w < Self.dayNames.count else { return nil }
            let name = "art-day-\(Self.dayNames[w])"
            return ArtAsset.exists(name) ? name : nil
        }
    }

    /// The game's title art in its season variant, or the page's title for the Sweep / race / brag cards.
    private var gameArt: String? {
        let name: String?
        switch input.variant {
        case .sweep, .sweepPodium: name = "art-titlecast-sweep"
        case .weeklyRace: name = "art-titlecast-friends"
        case .trophyCase: name = "art-titlecast-trophycase"
        case .flawlessStreak: name = "art-titlecast-onastreak"
        default: name = ModeGen.byDbKey(input.gameModeRaw).map { "art-game-\($0.id)" }
        }
        guard let n = name else { return nil }
        let shown = SeasonKit.title(n)
        return ArtAsset.exists(shown) ? shown : (ArtAsset.exists(n) ? n : nil)
    }

    private var labelText: String {
        switch input.variant {
        case .solo: return "DAILY LEADERBOARD"
        case .vs: return "VS BATTLE LEADERBOARD"
        case .podium: return "YESTERDAY’S PODIUM"
        case .friends: return "FRIENDS LEADERBOARD"
        case .friendsPodium: return "FRIENDS PODIUM"
        case .sweep: return "DAILY SWEEP BOARD"
        case .sweepPodium: return "YESTERDAY’S SWEEP PODIUM"
        case .weeklyRace: return "FRIENDS WEEKLY RACE"
        case .flawlessStreak: return "FLAWLESS STREAK"
        case .trophyCase: return "TROPHY CASE"
        }
    }

    private func artBox(_ name: String?, maxH: CGFloat, maxW: CGFloat) -> CGSize {
        guard let name, let a = ArtAsset.aspect(name), a > 0 else { return .zero }
        let w = min(maxW, maxH * a)
        return CGSize(width: w, height: w / a)
    }
    private var dayBox: CGSize { artBox(dayArt, maxH: compact ? 130 : 190, maxW: 620) }
    private var gameBox: CGSize { artBox(gameArt, maxH: dayArt != nil ? (compact ? 100 : 140) : (compact ? 120 : 170), maxW: 800) }
    private static let pillH: CGFloat = 54

    private var topPad: CGFloat { compact ? 14 : 20 }
    private var pillGap: CGFloat { compact ? 8 : 12 }

    /// Everything above the podium / list.
    private var topH: CGFloat {
        topPad + dayBox.height + (dayBox.height > 0 ? 2 : 0) + (gameBox.height > 0 ? gameBox.height : 90) + pillGap + 6 + Self.pillH + pillGap
    }
    private var bottomH: CGFloat { 10 + castH + CGFloat(ShareCardPlan.bottomPad) }

    /// The plan: the canvas height (4:5 … 3:4) and the podium's drawn width (scaled down, never the text, when the card
    /// would pass 3:4).
    private var plan: (height: CGFloat, podiumW: CGFloat) {
        let maxH = CGFloat(ShareCardPlan.maxHeight), minH = CGFloat(ShareCardPlan.minHeight)
        // 2–3 players with no rows below: a 4:5 card (podium scaled to fit); rows grow it to 3:4.
        let cap = listCount == 0 ? minH : maxH
        let others = topH + (listH > 0 ? listH + 8 : 0) + bottomH
        var w: CGFloat = 1080 - Self.sidePad * 2
        if usePodium {
            let unit = headroom + 1 / CGFloat(PodiumArt.aspect)
            if others + w * unit > cap { w = max(480, (cap - others) / unit) }
            // The 4:5 floor: with few rows the podium may not need the full 3:4.
            return (min(cap, max(minH, others + w * unit)).rounded(), w.rounded(.down))
        }
        return (min(maxH, max(minH, others)).rounded(), 0)
    }

    var size: CGSize { CGSize(width: 1080, height: plan.height) }

    // ── The card ─────────────────────────────────────────────────────────

    var body: some View {
        let p = plan
        ZStack(alignment: .top) {
            ShareNightBackground()
            VStack(spacing: 0) {
                header
                if usePodium {
                    Spacer(minLength: 0)
                    podium(width: p.podiumW)
                    Spacer(minLength: 0)
                } else {
                    Spacer(minLength: 0)
                }
                if listCount > 0 {
                    rows.padding(.horizontal, Self.sidePad).padding(.top, usePodium ? 8 : 0)
                }
                Spacer(minLength: 0)
                ShareCastWordmark(width: castW)
                    .padding(.top, 10).padding(.bottom, CGFloat(ShareCardPlan.bottomPad))
            }
            .frame(width: 1080, height: p.height, alignment: .top)
        }
        .environment(\.shareNight, true)
        .frame(width: 1080, height: p.height, alignment: .top)
        .clipped()
    }

    private var header: some View {
        VStack(spacing: 0) {
            if let d = dayArt, dayBox.height > 0 {
                Image(d).resizable().interpolation(.high).scaledToFit()
                    .frame(width: dayBox.width, height: dayBox.height)
                    .padding(.top, topPad).padding(.bottom, 2)
            } else {
                Color.clear.frame(height: topPad)
            }
            if let g = gameArt, gameBox.height > 0 {
                Image(g).resizable().interpolation(.high).scaledToFit()
                    .frame(width: gameBox.width, height: gameBox.height)
            } else {
                Text(input.modeChip.uppercased()).font(Brand.fixedFont(72, .black)).foregroundStyle(ShareNight.gold)
                    .lineLimit(1).minimumScaleFactor(0.5).frame(height: 90).padding(.horizontal, 60)
            }
            ShareNightInfoLine(text: "\(labelText) · \(input.dateChip)", size: 26, pill: true)
                .frame(height: Self.pillH)
                .padding(.top, pillGap + 6).padding(.horizontal, 30)
            Color.clear.frame(height: pillGap)
        }
        .accessibilityHidden(true)
    }

    /// The app's stadium podium, static: core PodiumArt geometry through the live PodiumView's own scene.
    private func podium(width w: CGFloat) -> some View {
        let entries = podiumRows.map { r in
            PodiumEntry(id: r.userId ?? r.name, name: r.isYou ? "You" : r.name, username: r.username ?? r.name,
                        accentHex: r.accentHex, emoji: r.emoji, value: r.scoreDisplay, avatarUrl: r.avatarUrl,
                        rank: r.rank, detail: r.subline)
        }
        var v = PodiumView(entries: entries, open: layout.open)
        v.shareWidth = w
        v.shareHeadroom = headroom
        return v.frame(width: w, height: PodiumView.shareHeight(width: w, headroom: headroom))
    }

    // ── Rows: 4th and below, then the sharer's own ───────────────────────

    private var rows: some View {
        VStack(spacing: Self.rowGap) {
            ForEach(0..<listRows.count, id: \.self) { i in row(listRows[i]) }
            if let you = youRow {
                Text("• • •").font(Brand.fixedFont(26, .black)).foregroundStyle(ShareNight.muted).frame(height: 22)
                row(you, rankLine: input.youRankLine)
            }
        }
    }

    private func ordinal(_ n: Int) -> String {
        let v = n % 100
        if v >= 11 && v <= 13 { return "\(n)TH" }
        switch n % 10 { case 1: return "\(n)ST"; case 2: return "\(n)ND"; case 3: return "\(n)RD"; default: return "\(n)TH" }
    }

    private func row(_ r: LbShareRow, rankLine: String? = nil) -> some View {
        let streak = input.variant == .flawlessStreak
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        return HStack(spacing: 0) {
            Text(streak ? "\(r.rank)" : ordinal(r.rank))
                .font(Brand.fixedFont(32, .black)).foregroundStyle(ShareNight.gold)
                .frame(width: 104, alignment: .leading)
            HStack(spacing: 10) {
                Text(r.name).font(Brand.fixedFont(36, .black)).foregroundStyle(ShareNight.text)
                    .lineLimit(1).minimumScaleFactor(0.55)
                if r.isYou && !streak {
                    Text("· YOU").font(Brand.fixedFont(28, .black)).foregroundStyle(ShareNight.gold).fixedSize()
                    if let d = input.delta {
                        Text(d.text).font(Brand.fixedFont(20, .heavy)).fixedSize()
                            .foregroundStyle(d.improved ? Color(hex: 0x6EE7A0) : Color(hex: 0xFF8A98))
                    }
                }
            }
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: -2) {
                Text(r.scoreDisplay).font(Brand.fixedFont(38, .black)).monospacedDigit().foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.6)
                if let sub = rankLine.map({ "\($0)\(r.subline.map { " · \($0)" } ?? "")" }) ?? r.subline {
                    Text(sub).font(Brand.fixedFont(23, .bold)).foregroundStyle(ShareNight.muted)
                        .lineLimit(1).minimumScaleFactor(0.6)
                }
            }
        }
        .padding(.horizontal, 28)
        .frame(height: Self.rowH)
        .background(shape.fill(r.isYou && !streak ? ShareNight.gold.opacity(0.17) : Color.white.opacity(0.07)))
    }
}
#endif

// MARK: - Share flow (web leaderboard-share-flow.ts + shareResult linkOnly)

extension ShareService {
    /// Render the leaderboard card and share it — FINISH_SPEC §S1: the IMAGE ONLY
    /// (no hosted /s link, no upload; old links keep working on web).
    @MainActor
    static func shareLeaderboard(_ input: LbShareInput) {
        #if canImport(UIKit)
        // `share_sheet_v2`: the custom sheet (carousel preview, season / Normal look, the channels row) instead of the system sheet.
        if ShareSheetFlag.on { ShareSheetPresenter.present(.leaderboard(input)); return }
        let card = LeaderboardShareCardView(input: input)
        guard let image = renderCard(card, size: card.size) else { return }
        ShareEvents.log(kind: "image", gameMode: input.gameModeRaw, surface: "leaderboard")
        presentImages([image], game: input.shareMode)
        #endif
    }
}

/// Fetch-and-share glue for the leaderboard Share buttons (daily tab + Records
/// daily view). Pure card assembly lives in LeaderboardShareBuilder; this adds
/// the two cheap lookups the card needs beyond the page's own state — the
/// sharer's row when they rank below the visible list, and yesterday's final
/// rank for the "▲N vs yesterday" delta pill (web leaderboard-share-flow.ts).
enum LeaderboardShareFlow {
    /// Share today's board (solo or VS per the page's toggle). `entries` /
    /// `rankWindow` / `userRank` are the page's already-fetched state.
    @MainActor
    static func shareDaily(mode: GameMode, playType: String,
                           entries: [LeaderboardEntry],
                           rankWindow: (startRank: Int, entries: [LeaderboardEntry])?,
                           userId: String?,
                           userRank: (rank: Int, total: Int)?,
                           friends: Bool = false) async {
        guard let meta = ModeGen.byDbKey(mode.rawValue), !entries.isEmpty else { return }
        // FRIENDS (§207): friends identity + dense friend ranks; the page's
        // `entries` already IS the whole friends board.
        let variant: LbShareVariant = friends ? .friends : (playType == "vs" ? .vs : .solo)
        let ranked = entries.enumerated().map {
            LeaderboardShareBuilder.RankedEntry(rank: $0.offset + 1, entry: $0.element)
        }

        let inTop5 = userId != nil && entries.prefix(5).contains { $0.userId == userId }

        // Sharer's row when they rank below the top 5 — from the page's rank
        // window if it holds it, else a small window read around their offset
        // (ties can shift the exact offset — the window absorbs that). Not
        // found → the card simply omits the you-row.
        var userEntry = userId.flatMap { uid in
            entries.first { $0.userId == uid } ?? rankWindow?.entries.first { $0.userId == uid }
        }
        if let uid = userId, let rank = userRank, !inTop5, userEntry == nil, !friends {
            // Global board only — a friends board is entirely in `entries`.
            let offset = max(0, rank.rank - 6)
            let windowRows = (try? await LeaderboardService.fetch(
                gameMode: mode, playType: playType, limit: 11, offset: offset)) ?? []
            userEntry = windowRows.first { $0.userId == uid }
        }

        // Yesterday's final rank for the delta pill — only meaningful when the
        // sharer is on today's board at all; nil = didn't play yesterday.
        // Friends mode compares friend-rank to friend-rank (dense index into
        // yesterday's friends-filtered board).
        var yesterdayRank: Int? = nil
        if let uid = userId, userRank != nil {
            if friends {
                let ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
                let yRows = (try? await LeaderboardService.fetch(
                    gameMode: mode, day: LeaderboardService.yesterdayLocal(),
                    playType: playType, userIds: ids)) ?? []
                yesterdayRank = yRows.firstIndex { $0.userId == uid }.map { $0 + 1 }
            } else {
                yesterdayRank = await LeaderboardService.userRank(
                    gameMode: mode, userId: uid, playType: playType,
                    day: LeaderboardService.yesterdayLocal())?.rank
            }
        }

        guard let input = LeaderboardShareBuilder.buildDailyInput(
            variant: variant, shareMode: meta.title, modeLabel: meta.shareLabel,
            gameModeRaw: mode.rawValue,
            modeAccent: variant == .vs ? Color(hex: 0x0D9488) : meta.accent,
            day: LeaderboardService.todayLocal(),
            ranked: ranked, userId: userId,
            userRank: userRank, userEntry: userEntry,
            yesterdayRank: yesterdayRank) else { return }
        ShareService.shareLeaderboard(input)
    }

    /// Share yesterday's settled podium (top 5 + sharer's final rank,
    /// "· Final" chip — daily-card parity, founder ask 2026-08-10).
    @MainActor
    static func sharePodium(mode: GameMode, playType: String,
                            top3: [LeaderboardEntry], userId: String?,
                            friends: Bool = false) async {
        guard let meta = ModeGen.byDbKey(mode.rawValue) else { return }
        let variant: LbShareVariant = playType == "vs" ? .vs : .solo
        let day = LeaderboardService.yesterdayLocal()
        let ranked = top3.enumerated().map {
            LeaderboardShareBuilder.RankedEntry(rank: $0.offset + 1, entry: $0.element)
        }
        // Sharer's FINAL rank yesterday + their own row for the below-top-5
        // treatment. Friends mode dense-ranks the friends-filtered board.
        var userRank: (rank: Int, total: Int)? = nil
        var userEntry: LeaderboardEntry? = userId.flatMap { uid in top3.first { $0.userId == uid } }
        if let uid = userId {
            if friends {
                let ids = Array(Set(FriendsService.friendIds).union([uid.lowercased()]))
                if let board = try? await LeaderboardService.fetch(
                    gameMode: mode, day: day, playType: playType, userIds: ids),
                   let idx = board.firstIndex(where: { $0.userId == uid }) {
                    userRank = (rank: idx + 1, total: board.count)
                    if userEntry == nil { userEntry = board[idx] }
                }
            } else {
                userRank = await LeaderboardService.userRank(
                    gameMode: mode, userId: uid, playType: playType, day: day,
                    topEntries: top3, topLimit: 5)
                if userRank != nil, userEntry == nil {
                    userEntry = (try? await LeaderboardService.fetch(
                        gameMode: mode, day: day, playType: playType, limit: 1, userIds: [uid]))?.first
                }
            }
        }
        guard let input = LeaderboardShareBuilder.buildPodiumInput(
            playType: variant, friends: friends,
            shareMode: meta.title, modeLabel: meta.shareLabel,
            gameModeRaw: mode.rawValue,
            // Web parity: the podium chip keeps the catalog accent even for a
            // VS podium — teal + swords belong to the live VS variant only.
            modeAccent: meta.accent,
            day: day,
            ranked: ranked, userId: userId,
            userRank: userRank, userEntry: userEntry) else { return }
        ShareService.shareLeaderboard(input)
    }

    /// SWEEP (§231): share today's Sweep board or yesterday's sweep podium.
    /// Everything the card needs is already on the page (entries carry RPC
    /// ranks; the sweep rank banner's tuple is the sharer's rank), so unlike
    /// the per-mode flows there are no extra lookups.
    @MainActor
    static func shareSweep(podium: Bool, entries: [SweepEntry],
                           userId: String?, userRank: (rank: Int, total: Int)? = nil) {
        Task { @MainActor in
            let day = podium ? LeaderboardService.yesterdayLocal() : LeaderboardService.todayLocal()
            // §249: one cheap details read for the rows the card shows, so
            // each row carries the in-app mode-dot strip.
            var ids = Set(entries.prefix(podium ? 3 : 5).map(\.userId))
            if let userId { ids.insert(userId) }
            let details = await LeaderboardService.fetchSweepModeDetails(day: day, userIds: Array(ids))
            guard let input = LeaderboardShareBuilder.buildSweepInput(
                podium: podium, day: day,
                entries: entries, userId: userId, userRank: userRank,
                details: details) else { return }
            ShareService.shareLeaderboard(input)
        }
    }

    /// WEEKLY RACE (§234): share the friends panel's THIS WEEK'S RACE. The
    /// whole race already rides the FriendsService cache (weekPoints /
    /// todayPoints come with the friends digest), so this is pure assembly —
    /// no lookups at all.
    @MainActor
    static func shareWeeklyRace(friends: [FriendsService.FriendProfile],
                                meDigest: FriendsService.MeDigest?,
                                username: String?) {
        guard let input = LeaderboardShareBuilder.buildWeeklyRaceInput(
            friends: friends,
            me: username.map { (username: $0,
                                weekPoints: meDigest?.weekPoints ?? 0,
                                todayPoints: meDigest?.todayPoints ?? 0) }) else { return }
        ShareService.shareLeaderboard(input)
    }

    /// §244/§248: the flawless-streak brag card — fetches the sharer's own
    /// per-day stats (time · guesses · hints · points) before building.
    @MainActor
    static func shareFlawlessStreak(streak: Int, bestStreak: Int, username: String?) {
        Task { @MainActor in
            let days = await fetchFlawlessDayStats(streak: streak)
            guard let input = LeaderboardShareBuilder.buildFlawlessStreakInput(
                streak: streak, bestStreak: bestStreak, username: username, days: days) else { return }
            ShareService.shareLeaderboard(input)
        }
    }

    private static func fetchFlawlessDayStats(streak: Int) async -> [LeaderboardShareBuilder.FlawlessDayStats] {
        guard let uid = try? await AuthService.shared.client.auth.session.user.id.uuidString.lowercased() else { return [] }
        let today = LeaderboardService.todayLocal()
        let days = (0..<min(streak, 5)).map { MatchStatsService.shiftLocalDay(today, -$0) }
        struct Row: Decodable {
            let day: String; let game_mode: String?; let completed: Bool?
            let time_seconds: Int?; let guess_count: Int?
            let hints_used: Int?; let composite_score: Double?
        }
        let rows: [Row] = (try? await AuthService.shared.client.from("daily_results")
            .select("day, game_mode, completed, time_seconds, guess_count, hints_used, composite_score")
            .eq("user_id", value: uid)
            .eq("play_type", value: "solo")
            .in("day", values: days)
            .execute().value) ?? []
        var byDay: [String: (t: Int, g: Int, h: Int, p: Double)] = [:]
        var modesByDay: [String: LeaderboardService.SweepDetails] = [:]
        // A flawless day is judged on that day's SWEEP modes only — a More Games
        // row (ProperNoundle after Stage 9) never pads its time, guesses or points.
        for r in rows where ModeGen.sweepModes(for: r.day).contains(r.game_mode ?? "") {
            var d = byDay[r.day] ?? (0, 0, 0, 0)
            d.t += r.time_seconds ?? 0; d.g += r.guess_count ?? 0
            d.h += r.hints_used ?? 0; d.p += r.composite_score ?? 0
            byDay[r.day] = d
            var det = modesByDay[r.day] ?? LeaderboardService.SweepDetails()
            det.modes[r.game_mode ?? ""] = .init(score: r.composite_score ?? 0,
                                                 completed: r.completed ?? false)
            modesByDay[r.day] = det
        }
        // §249: each day-row wears the in-app mode-dot strip.
        return byDay.map { .init(day: $0.key, timeSeconds: $0.value.t, guesses: $0.value.g,
                                 hints: $0.value.h, points: $0.value.p,
                                 dots: LeaderboardShareBuilder.sweepDotValues(modesByDay[$0.key], day: $0.key)) }
    }

    /// §245: the trophy-case brag card.
    @MainActor
    static func shareTrophyCase(records: [AllTimeRecord], username: String?) {
        guard let input = LeaderboardShareBuilder.buildTrophyCaseInput(
            records: records, username: username) else { return }
        ShareService.shareLeaderboard(input)
    }
}
