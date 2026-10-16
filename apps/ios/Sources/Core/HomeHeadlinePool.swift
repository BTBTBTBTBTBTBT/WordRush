import Foundation

// Home headline POOL — a 1:1 port of packages/core/src/home-headline-pool.ts, pinned by
// Fixtures/home-headline-pool-fixtures.json (buckets / calendar / bank / 1,890 selections).
//
// The Home state picks a CONTEXT by priority (Double Flawless > fresh personal record > streak news > flawless row >
// all done > row done > last-played reaction > next-up nudge > holiday > season pack > weekday > time of day). Each
// context has a POOL of lines (HomeHeadlineBank, generated from the TS bank); a seasonal FLAVOR pool is mixed in at
// a set rate; a rare SURPRISE line replaces a non-celebration pick. Selection is deterministic — seeded by (user,
// date, time bucket, context) — and a small caller-persisted "recently shown" history keeps a line from repeating.
// Every line is checked against the bubble-lettering fit for the device's slot (two lines at >= 85% of full size,
// never clipped); the legacy `HomeBanner.bannerHeadline` line is the always-fitting fallback.

public enum HomeHeadlinePool {
    public enum TimeBucket: String, Codable, Equatable, Sendable {
        case lateNight, earlyMorning, morning, midday, afternoon, evening, night
    }

    /// Local hour 0-23 → the bucket. Late night 0-4, early 5-7, morning 8-11, midday 12-13, afternoon 14-16, evening 17-20, night 21-23.
    public static func timeBucket(_ hour: Int) -> TimeBucket {
        if hour < 5 { return .lateNight }
        if hour < 8 { return .earlyMorning }
        if hour < 12 { return .morning }
        if hour < 14 { return .midday }
        if hour < 17 { return .afternoon }
        if hour < 21 { return .evening }
        return .night
    }

    /// Headline packs: calendar windows for seasonal flavor (independent of the art seasons; wraps past Dec 31).
    public static let packs: [(id: String, start: (Int, Int), end: (Int, Int))] = [
        ("halloween", (10, 9), (10, 31)),
        ("thanksgiving", (11, 14), (11, 29)),
        ("winter", (12, 1), (12, 30)),
        ("newyear", (12, 31), (1, 6)),
        ("valentines", (2, 7), (2, 14)),
        ("spring", (3, 20), (4, 15)),
        ("summer", (6, 21), (7, 10)),
        ("fall", (9, 22), (10, 8)),
    ]

    /// The pack a local `YYYY-MM-DD` falls in (nil = none).
    public static func headlinePack(_ dateKey: String) -> String? {
        let parts = dateKey.split(separator: "-", omittingEmptySubsequences: false).map { Int($0) }
        guard parts.count >= 3, let m = parts[1], let d = parts[2] else { return nil }
        let k = m * 100 + d
        for p in packs {
            let a = p.start.0 * 100 + p.start.1
            let b = p.end.0 * 100 + p.end.1
            if a <= b ? (k >= a && k <= b) : (k >= a || k <= b) { return p.id }
        }
        return nil
    }

    /// Weekday 0 (Sunday) – 6 for a `YYYY-MM-DD` (calendar math in UTC, no time zones).
    public static func weekdayOf(_ dateKey: String) -> Int {
        let parts = dateKey.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return 0 }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        // Like JS Date.UTC, an out-of-range day rolls into the neighboring month/year.
        guard let base = utc.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)),
              let t = utc.date(byAdding: .day, value: parts[2] - 1, to: base) else { return 0 }
        return utc.component(.weekday, from: t) - 1
    }

    public struct LastGame: Equatable {
        /// The game's title as shown on its card ("Muddle").
        public var title: String
        public var won: Bool
        /// Minutes since it finished (the reaction fades after `lastGameFreshMinutes`).
        public var minutesAgo: Int
        /// A personal best landed with it (best time / score / guesses for that game).
        public var record: Bool
        public init(title: String, won: Bool, minutesAgo: Int, record: Bool = false) {
            self.title = title; self.won = won; self.minutesAgo = minutesAgo; self.record = record
        }
    }

    public struct Streaks: Equatable {
        public var word: GroupStreaks
        public var puzzles: GroupStreaks
        public init(word: GroupStreaks, puzzles: GroupStreaks) { self.word = word; self.puzzles = puzzles }
    }

    public struct Context: Equatable {
        public var name: String
        public var hour: Int
        /// Local day `YYYY-MM-DD`.
        public var dateKey: String
        public var word: GroupProgress
        public var puzzles: GroupProgress
        public var streaks: Streaks?
        public var unlimited: Bool
        /// The next unplayed daily's title in the player's own order (nil when none).
        public var nextGame: String?
        public var lastGame: LastGame?
        /// Today's holiday key from the bundled table (holidayKeyForDay), nil when none.
        public var holiday: String?
        /// The headline slot's text width in px (the platform's measured slot; nil = a 390 phone).
        public var slotWidth: Double?
        /// A stable per-user salt (user id; "" for guests) so two players at the same table read different lines.
        public var userSeed: String?
        /// Recently shown line ids (the templates), caller-persisted locally; see `historyDays`.
        public var history: [String]
        public init(name: String, hour: Int, dateKey: String, word: GroupProgress, puzzles: GroupProgress,
                    streaks: Streaks? = nil, unlimited: Bool = false, nextGame: String? = nil, lastGame: LastGame? = nil,
                    holiday: String? = nil, slotWidth: Double? = nil, userSeed: String? = nil, history: [String] = []) {
            self.name = name; self.hour = hour; self.dateKey = dateKey; self.word = word; self.puzzles = puzzles
            self.streaks = streaks; self.unlimited = unlimited; self.nextGame = nextGame; self.lastGame = lastGame
            self.holiday = holiday; self.slotWidth = slotWidth; self.userSeed = userSeed; self.history = history
        }
    }

    public enum ContextKind: String, Codable, Equatable, Sendable {
        case unlimited, doubleFlawless, streak, flawlessRow, newRecord, allDone, rowDone
        case lastPlayed, nextUp, holiday, pack, weekday, timeOfDay, surprise, legacy
    }

    public struct Choice: Equatable {
        public let text: String
        /// The line's stable id (its template) — push it on the caller's history when it is SHOWN.
        public let id: String
        public let context: ContextKind
        /// The time bucket the pick was seeded with (recompute when it changes, i.e. at most 7 times a day).
        public let bucket: TimeBucket
        public init(text: String, id: String, context: ContextKind, bucket: TimeBucket) {
            self.text = text; self.id = id; self.context = context; self.bucket = bucket
        }
    }

    /// A last-played reaction lives this long after the game ends.
    public static let lastGameFreshMinutes = 20
    /// The caller keeps ids shown in the last N days (one entry per shown line).
    public static let historyDays = 10
    /// Seasonal flavor replaces the base pick this often during a pack (1 in SEASON_RATE picks are base).
    public static let seasonRate = 3
    /// The rare surprise: 1 in SURPRISE_RATE non-celebration picks.
    public static let surpriseRate = 12
    /// A pool line must keep at least this share of the device's full lettering size.
    public static let minFitScale = 0.85
    public static let defaultSlotWidth: Double = 294

    // MARK: Selection

    private static let slotKeys: Set<String> = ["name", "next", "last", "n", "left", "played", "total"]

    /// Fill `{slot}`s; nil when a required slot is empty. Upper case on the way out (TS parity).
    public static func fillHeadline(_ template: String, slots: [String: String]) -> String? {
        var out = ""
        var missing = false
        var i = template.startIndex
        while i < template.endIndex {
            let ch = template[i]
            if ch == "{", let close = template[i...].firstIndex(of: "}") {
                let key = String(template[template.index(after: i)..<close])
                if slotKeys.contains(key) {
                    if let v = slots[key], !v.isEmpty { out += v } else { missing = true }
                    i = template.index(after: close)
                    continue
                }
            }
            out.append(ch)
            i = template.index(after: i)
        }
        return missing ? nil : out.uppercased()
    }

    /// Does `text` keep two near-full-size bubble lines in a `slotWidth` slot? A stacked name (BJ6) keeps its hero
    /// line(s) with at most one line of words beside it; any other line must fit on one line, or on a balanced
    /// two-line wrap, at >= minFitScale of the device's full size.
    public static func headlineFitsSlot(_ text: String, name: String, slotWidth: Double) -> Bool {
        let full = HeadlineLayout.fontSize(availableWidth: slotWidth)
        let minSize = (full * minFitScale).rounded(.up)
        let fit = BubbleText.homeFit(text, name: name, slotWidth: slotWidth)
        if !fit.nameLines.isEmpty { return fit.size >= minSize && fit.lines.count - fit.nameLines.count <= 1 }
        if !fit.wrapped && fit.size >= minSize { return true }
        let two = BubbleText.fit(text, slotWidth: slotWidth, maxSize: full, minSize: minSize, maxLines: 2)
        return two.lines.count <= 2 && two.size >= minSize
    }

    /// The renderer's fit for a pool line: the same rule `headlineFitsSlot` checked (homeFit when it keeps the name
    /// stacked or fits one line at >= 85%, else a balanced two-line wrap at >= 85% of full) so a pool line wraps
    /// instead of shrinking.
    public static func poolFit(_ text: String, name: String, slotWidth: Double) -> BubbleText.Fit {
        let full = HeadlineLayout.fontSize(availableWidth: slotWidth)
        let minSize = (full * minFitScale).rounded(.up)
        let fit = BubbleText.homeFit(text, name: name, slotWidth: slotWidth)
        if !fit.nameLines.isEmpty || (!fit.wrapped && fit.size >= minSize) { return fit }
        return BubbleText.fit(text, slotWidth: slotWidth, maxSize: full, minSize: minSize, maxLines: 2)
    }

    private static func pickFrom(_ pool: [String], seed: String, slots: [String: String], name: String,
                                 slotWidth: Double, history: [String]) -> (id: String, text: String)? {
        var fitted: [(id: String, text: String)] = []
        for id in pool {
            guard let text = fillHeadline(id, slots: slots), headlineFitsSlot(text, name: name, slotWidth: slotWidth) else { continue }
            fitted.append((id, text))
        }
        if fitted.isEmpty { return nil }
        let fresh = fitted.filter { !history.contains($0.id) }
        let candidates = fresh.isEmpty ? fitted : fresh
        return candidates[StreakHeadline.dayHash(seed) % candidates.count]
    }

    private static func flavored(_ base: [String], pack: String?, packTag: String?, seed: String) -> [String] {
        guard let pack, let packTag else { return base }
        let extra = HomeHeadlineBank.pool("\(packTag)/\(pack)")
        if extra.isEmpty { return base }
        // seasonRate: most picks in a pack wear the season; one in seasonRate stays plain so the season never saturates.
        return StreakHeadline.dayHash("\(seed)|flavor") % seasonRate == 0 ? base : extra
    }

    /// The Home headline from the pool. Deterministic for (user, date, time bucket, state); the caller re-runs it when
    /// the bucket, progress, last game or history changes (never per frame). Falls back to the legacy
    /// `bannerHeadline` line, which always fits.
    public static func select(_ ctx: Context) -> Choice {
        let name = ctx.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let bucket = timeBucket(ctx.hour)
        let slotWidth = ctx.slotWidth ?? defaultSlotWidth
        let history = ctx.history
        let seedBase = "\(ctx.userSeed ?? "")|\(ctx.dateKey)|\(bucket.rawValue)"
        func legacy() -> Choice {
            Choice(text: HomeBanner.bannerHeadline(ctx.word, ctx.puzzles, hour: ctx.hour, name: name, unlimited: ctx.unlimited,
                                                   wordStreaks: ctx.streaks?.word, puzzleStreaks: ctx.streaks?.puzzles,
                                                   dateKey: ctx.dateKey),
                   id: "legacy", context: .legacy, bucket: bucket)
        }

        let a = HomeBanner.groupTier(ctx.word)
        let b = HomeBanner.groupTier(ctx.puzzles)
        let total = ctx.word.total + ctx.puzzles.total
        let played = min(ctx.word.played, ctx.word.total) + min(ctx.puzzles.played, ctx.puzzles.total)
        let left = max(0, total - played)
        let pack = headlinePack(ctx.dateKey)
        var slots: [String: String] = ["played": String(played), "total": String(total)]
        if !name.isEmpty { slots["name"] = name }
        if let next = ctx.nextGame?.trimmingCharacters(in: .whitespacesAndNewlines), !next.isEmpty { slots["next"] = next }
        if let last = ctx.lastGame?.title.trimmingCharacters(in: .whitespacesAndNewlines), !last.isEmpty { slots["last"] = last }
        if left > 0 { slots["left"] = String(left) }

        func choose(_ kind: ContextKind, _ pool: [String], packTag: String? = nil) -> Choice? {
            let seed = "\(seedBase)|\(kind.rawValue)"
            guard let hit = pickFrom(flavored(pool, pack: pack, packTag: packTag, seed: seed), seed: seed, slots: slots,
                                     name: name, slotWidth: slotWidth, history: history) else { return nil }
            return Choice(text: hit.text, id: hit.id, context: kind, bucket: bucket)
        }
        func choose(_ kind: ContextKind, tag: String, flavor: Bool = false) -> Choice? {
            choose(kind, HomeHeadlineBank.pool(tag), packTag: flavor ? tag : nil)
        }

        if ctx.unlimited { return choose(.unlimited, tag: "unlimited") ?? legacy() }

        func streakLine(_ s: GroupStreaks?, _ t: BannerTier) -> String? {
            guard let s, t != .none else { return nil }
            return t == .flawless
                ? StreakHeadline.line(kind: .flawless, days: s.flawless, best: s.bestFlawless, dateKey: ctx.dateKey)
                : StreakHeadline.line(kind: .sweep, days: s.sweep, best: s.bestSweep, dateKey: ctx.dateKey)
        }
        func streakChoice(_ line: String?) -> Choice? {
            guard let line, headlineFitsSlot(line, name: name, slotWidth: slotWidth) else { return nil }
            return Choice(text: line, id: "streak:\(line)", context: .streak, bucket: bucket)
        }

        let lastFresh = ctx.lastGame.map { $0.minutesAgo >= 0 && $0.minutesAgo <= lastGameFreshMinutes } ?? false
        // The streak line leads in two buckets of three and yields to the pool in the third.
        let streakLeads = StreakHeadline.dayHash("\(seedBase)|streakSwap") % 3 != 0
        // 1. Double Flawless beats everything; the Wordocious streak line gets one bucket in three.
        if a == .flawless && b == .flawless {
            let streakNews = !streakLeads ? streakChoice(streakLine(ctx.streaks?.word, a)) : nil
            return streakNews ?? choose(.doubleFlawless, tag: "doubleFlawless", flavor: true) ?? legacy()
        }
        // 2. A personal record in the game just played (fresh for lastGameFreshMinutes).
        if lastFresh, ctx.lastGame?.record == true, let c = choose(.newRecord, tag: "newRecord") { return c }
        // 3. Streak news on a finished row.
        if streakLeads, let news = streakChoice(streakLine(ctx.streaks?.word, a)) ?? streakChoice(streakLine(ctx.streaks?.puzzles, b)) {
            return news
        }
        // 4. One row flawless while the other is open.
        if (a == .flawless) != (b == .flawless) && left > 0 { return choose(.flawlessRow, tag: "flawlessRow", flavor: true) ?? legacy() }
        // 5. Everything finished (double sweep, or sweep + flawless).
        if a != .none && b != .none { return choose(.allDone, tag: "allDone", flavor: true) ?? legacy() }
        // 6. One row swept, the other open.
        if a != .none || b != .none { return choose(.rowDone, tag: "rowDone") ?? legacy() }

        // The rare surprise, only where there is nothing to celebrate.
        if StreakHeadline.dayHash("\(seedBase)|surprise") % surpriseRate == 0, let s = choose(.surprise, tag: "surprise") { return s }

        // 7. A reaction to the game just played (fades after lastGameFreshMinutes).
        if lastFresh, played > 0, let last = ctx.lastGame,
           let c = choose(.lastPlayed, tag: last.won ? "lastPlayed/won" : "lastPlayed/lost") { return c }
        // 8. Mid-day: the next game up in the player's order.
        if played > 0 { return choose(.nextUp, tag: "nextUp", flavor: true) ?? legacy() }

        // Nothing played yet: the greeting — holiday day > season pack (at its rate) > weekday (1 in 3) > time of day.
        if let holiday = ctx.holiday, !HomeHeadlineBank.pool("holiday/\(holiday)").isEmpty,
           let c = choose(.holiday, tag: "holiday/\(holiday)") { return c }
        if let pack, StreakHeadline.dayHash("\(seedBase)|pack") % seasonRate != 0, let c = choose(.pack, tag: "pack/\(pack)") { return c }
        if StreakHeadline.dayHash("\(seedBase)|weekday") % 3 == 0, let c = choose(.weekday, tag: "weekday/\(weekdayOf(ctx.dateKey))") { return c }
        return choose(.timeOfDay, tag: "time/\(bucket.rawValue)") ?? legacy()
    }
}
