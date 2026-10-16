import Foundation
import WordociousCore

/// The Home headline POOL wiring (founder 10-16), behind the `home_headlines_v2` app flag — admins + testers only until
/// its row opens it, FAIL CLOSED (no row / flags unknown = off), so a player without the flag sees today's
/// `HomeBanner.bannerHeadline` line byte-for-byte. Core does the choosing (`HomeHeadlinePool.select`, parity-pinned);
/// this file holds the two tiny local stores it needs (the last finished daily, the recently-shown history) and the
/// memo so the pick is computed only when its inputs change (bucket, progress, streaks, last game, history) — never
/// per frame.
///
/// DEBUG: launch with the argument `-home_headlines_v2 on` (UserDefaults reads `-key value` launch arguments) to force
/// the flag on for simulator captures.
enum HomeHeadlinesV2 {
    static let flagKey = "home_headlines_v2"

    static var enabled: Bool {
        #if DEBUG
        if UserDefaults.standard.string(forKey: flagKey) == "on" { return true }
        #endif
        // Read from Home's view body (main thread), like HomeBannerView.atlasDrawn reads the atlas switch.
        return MainActor.assumeIsolated { FlagsService.shared.isOn(flagKey) }
    }

    // MARK: Last finished daily (for `{last}` / won / record)

    /// The last daily finished on this device: written by DailyResultsService.postLocalCompletion the moment a daily
    /// lands (local, no network). `mode` = daily_results.game_mode (the card's dbKey); the title is resolved on Home.
    struct LastGame: Codable, Equatable {
        let mode: String
        let won: Bool
        /// Unix ms.
        let finishedAt: Int
        /// A personal best landed with it (no local signal yet → false).
        let record: Bool
    }
    private static let lastGameKey = "home_headlines_v2.lastGame"

    static func recordFinish(mode: String, won: Bool, record: Bool = false, now: Date = Date()) {
        let g = LastGame(mode: mode, won: won, finishedAt: Int(now.timeIntervalSince1970 * 1000), record: record)
        if let data = try? JSONEncoder().encode(g) { UserDefaults.standard.set(data, forKey: lastGameKey) }
    }

    static func lastGame() -> LastGame? {
        guard let data = UserDefaults.standard.data(forKey: lastGameKey) else { return nil }
        return try? JSONDecoder().decode(LastGame.self, from: data)
    }

    // MARK: Recently shown history (one entry per shown line, pruned past HISTORY_DAYS)

    struct Shown: Codable, Equatable { let id: String; let day: String }
    private static let historyKey = "home_headlines_v2.history"
    private static var historyCache: [Shown]?

    /// The ids shown in the last `historyDays` days (read once, then kept in memory).
    static func history(today: String) -> [String] {
        loadHistory(today: today).map(\.id)
    }

    private static func loadHistory(today: String) -> [Shown] {
        if let h = historyCache { return h }
        var h: [Shown] = []
        if let data = UserDefaults.standard.data(forKey: historyKey), let d = try? JSONDecoder().decode([Shown].self, from: data) { h = d }
        let floor = HomeBanner.shiftDay(today, -HomeHeadlinePool.historyDays)
        h = h.filter { $0.day > floor }
        historyCache = h
        return h
    }

    /// Append a line id the first time it is shown (pool lines only; the legacy / streak lines are not pooled).
    static func noteShown(_ choice: HomeHeadlinePool.Choice, today: String) {
        guard isPoolLine(choice.id) else { return }
        var h = loadHistory(today: today)
        if h.last?.id == choice.id { return }
        h.append(Shown(id: choice.id, day: today))
        historyCache = h
        if let data = try? JSONEncoder().encode(h) { UserDefaults.standard.set(data, forKey: historyKey) }
    }

    static func isPoolLine(_ id: String) -> Bool { id != "legacy" && !id.hasPrefix("streak:") }

    // MARK: The memoized pick

    private static var memo: [String: HomeHeadlinePool.Choice] = [:]

    /// The pooled headline for Home's current state. `ctx.history` is filled here; the result is memoized on every
    /// input that can change the pick (the 60 s timeline re-runs this but only a bucket / freshness change recomputes).
    /// `shown` = this line is the visible one (the hidden mode's line is laid out too but never enters the history).
    static func headline(_ ctx: HomeHeadlinePool.Context, shown: Bool) -> String {
        let today = ctx.dateKey
        let bucket = HomeHeadlinePool.timeBucket(ctx.hour)
        let lastFresh = ctx.lastGame.map { $0.minutesAgo >= 0 && $0.minutesAgo <= HomeHeadlinePool.lastGameFreshMinutes } ?? false
        let key = [
            ctx.userSeed ?? "", today, bucket.rawValue, ctx.name, String(ctx.unlimited),
            "\(ctx.word.played)/\(ctx.word.won)/\(ctx.word.total)", "\(ctx.puzzles.played)/\(ctx.puzzles.won)/\(ctx.puzzles.total)",
            ctx.streaks.map { "\($0.word.sweep)/\($0.word.flawless)/\($0.word.bestSweep)/\($0.word.bestFlawless)|\($0.puzzles.sweep)/\($0.puzzles.flawless)/\($0.puzzles.bestSweep)/\($0.puzzles.bestFlawless)" } ?? "-",
            ctx.nextGame ?? "-", lastFresh ? "\(ctx.lastGame!.title)/\(ctx.lastGame!.won)/\(ctx.lastGame!.record)" : "-",
            ctx.holiday ?? "-", String(Int(ctx.slotWidth ?? HomeHeadlinePool.defaultSlotWidth)),
        ].joined(separator: "|")
        if let m = memo[key] {
            if shown { noteShown(m, today: today) }
            return m.text
        }
        var c = ctx
        c.history = history(today: today)
        let choice = HomeHeadlinePool.select(c)
        if memo.count > 16 { memo.removeAll() }
        memo[key] = choice
        if shown { noteShown(choice, today: today) }
        return choice.text
    }

    /// Whether `text` is a pooled line (the renderer then uses the pool fit: two lines at >= 85% of full size instead
    /// of today's 72% shrink).
    static func isPooled(_ text: String) -> Bool {
        memo.values.contains { $0.text == text && isPoolLine($0.id) }
    }
}
