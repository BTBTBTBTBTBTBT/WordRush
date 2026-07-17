import Foundation
import Supabase
import UIKit

/// One mode's daily result for today (for the completed-card state).
/// Codable so the store can cache today's completions on-device (web parity:
/// daily-completions-context.tsx seeds first render from sessionStorage so
/// completed badges never flash in after a fetch).
struct DailyCompletion: Codable {
    let gameMode: String
    let completed: Bool
    let guessCount: Int
    let timeSeconds: Double
    /// Per-mode daily composite score (daily_results.composite_score). Optional in
    /// the on-device cache written before this field existed → defaults to 0.
    let score: Double
    enum CodingKeys: String, CodingKey {
        case gameMode = "game_mode"
        case completed
        case guessCount = "guess_count"
        case timeSeconds = "time_seconds"
        case score = "composite_score"
    }
    init(gameMode: String, completed: Bool, guessCount: Int, timeSeconds: Double, score: Double = 0) {
        self.gameMode = gameMode; self.completed = completed
        self.guessCount = guessCount; self.timeSeconds = timeSeconds; self.score = score
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        gameMode = try c.decode(String.self, forKey: .gameMode)
        completed = try c.decode(Bool.self, forKey: .completed)
        guessCount = try c.decode(Int.self, forKey: .guessCount)
        timeSeconds = try c.decode(Double.self, forKey: .timeSeconds)
        score = (try? c.decodeIfPresent(Double.self, forKey: .score)) ?? 0
    }
}

/// Summed totals across today's daily completions — one helper shared by the
/// banner, celebration modal, and share card so all three always agree.
struct DailyTotals {
    var completed: Int = 0
    var won: Int = 0
    let total: Int = DailyCompletionsStore.totalDailyModes
    var totalGuesses: Int = 0
    var totalTimeSeconds: Double = 0
    var totalScore: Double = 0
    var flawless: Bool { completed >= total && won >= total }

    init(_ byMode: [String: DailyCompletion]) {
        for c in byMode.values {
            completed += 1
            if c.completed { won += 1 }
            totalGuesses += c.guessCount
            totalTimeSeconds += c.timeSeconds
            // Web parity (daily-service.ts fetchTodayDailyCompletions): each
            // mode's score is rounded BEFORE summing — sum-of-rounds, not
            // round-of-sum, or the two platforms' sweep totals drift by ±1.
            totalScore += c.score.rounded()
        }
    }
}

/// Loads the signed-in player's own daily_results for today, keyed by mode.
/// Powers the home grid's completed states + the Flawless/Sweep banner.
/// Seeds the first render from an on-device cache (keyed by local day) so
/// cold launches don't flash unbadged cards while the network fetch runs.
@MainActor
final class DailyCompletionsStore: ObservableObject {
    @Published private(set) var byMode: [String: DailyCompletion] = [:]

    /// The 9 daily modes (VS excluded — no daily row).
    static let totalDailyModes = 9

    private static let cacheKey = "daily-completions-cache"

    var completedCount: Int { byMode.count }

    /// Today's cached completion count without spinning up a store — lets
    /// NotificationService decide whether tonight's reminder is still needed.
    /// The cache is day-keyed, so a stale (yesterday's) cache reads as 0.
    static func cachedTodayCount() -> Int { readCache()?.count ?? 0 }
    var wonCount: Int { byMode.values.filter { $0.completed }.count }
    var allDone: Bool { completedCount >= Self.totalDailyModes }
    var flawless: Bool { allDone && wonCount >= Self.totalDailyModes }

    /// Summed totals (points/time/guesses) across today's completions.
    var totals: DailyTotals { DailyTotals(byMode) }

    /// Posted by DailyResultsService the moment a daily finishes — the native
    /// analogue of the web's `daily-completion` window event, so the home grid
    /// flips to "completed" instantly instead of waiting for a refetch on the
    /// next tab switch.
    static let completionPosted = Notification.Name("wordocious.daily-completion")
    /// Posted AFTER the daily_results row is actually written to the server
    /// (completionPosted fires optimistically BEFORE the network call, so
    /// server-backed surfaces that refetch on it raced the insert and cached
    /// the pre-result leaderboard — the "rank doesn't show until I switch
    /// modes and back" bug).
    static let completionRecorded = Notification.Name("wordocious.daily-recorded")

    /// Finishes recorded during THIS session for the current local day (from the
    /// completionPosted note). Merged into a load() result to cover the
    /// read-after-write race where a just-INSERTed row isn't queryable yet.
    /// Day-scoped and cleared the moment the local day rolls over, so a finish
    /// from yesterday can never be carried into today — the bug that made a
    /// session left open across midnight show yesterday's sweep as today's.
    private var optimistic: [String: DailyCompletion] = [:]
    private var optimisticDay: String = LeaderboardService.todayLocal()

    init() {
        byMode = Self.readCache() ?? [:]
        NotificationCenter.default.addObserver(forName: Self.completionPosted, object: nil, queue: .main) { [weak self] note in
            guard let self, let c = note.object as? DailyCompletion else { return }
            // Best-result semantics: never downgrade a recorded win on replay.
            if let existing = self.byMode[c.gameMode], existing.completed && !c.completed { return }
            self.byMode[c.gameMode] = c
            self.optimistic[c.gameMode] = c
            self.optimisticDay = LeaderboardService.todayLocal()
            Self.writeCache(self.byMode)
            WidgetBridge.update(completions: self.byMode)
        }
        // A session left open across LOCAL midnight must refresh to the new day's
        // (empty) completions. Without this, yesterday's byMode lingered and — via
        // the old in-memory merge — got re-stamped onto today, so the home grid
        // showed yesterday's sweep as done with no board behind it. Reload on
        // foreground + on the system day change, mirroring web daily-boundary-reload.
        let reload: (Notification) -> Void = { [weak self] _ in Task { await self?.load() } }
        NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main, using: reload)
        NotificationCenter.default.addObserver(forName: .NSCalendarDayChanged, object: nil, queue: .main, using: reload)
    }

    func load() async {
        let today = LeaderboardService.todayLocal()
        // Day rolled over since our last optimistic finish → those finishes are
        // yesterday's; drop them before they can be re-merged onto today.
        if optimisticDay != today { optimistic = [:]; optimisticDay = today }

        let client = AuthService.shared.client
        guard (try? await client.auth.session) != nil,
              let userId = try? await client.auth.session.user.id.uuidString else {
            byMode = [:]; optimistic = [:]; Self.writeCache(nil); return
        }
        do {
            let rows: [DailyCompletion] = try await client.from("daily_results")
                .select("game_mode, completed, guess_count, time_seconds, composite_score")
                .eq("user_id", value: userId)
                .eq("day", value: today)
                .eq("play_type", value: "solo")
                .execute().value
            // The SERVER is authoritative for today. Re-add ONLY this-session
            // optimistic finishes the server hasn't surfaced yet (the read-after-
            // write race: `.onDailyCompletion` calls load() the instant a daily
            // finishes, before the INSERT is queryable — a blind replace would drop
            // it and show a real Flawless as N-1/9). Crucially we NO LONGER merge
            // stale in-memory/cached state, which is how yesterday's completions
            // leaked into today. A day rollover clears `optimistic`, so a fetch
            // that returns nothing correctly yields an empty (fresh) board.
            var merged = Dictionary(rows.map { ($0.gameMode, $0) }, uniquingKeysWith: { a, _ in a })
            for (k, v) in optimistic where merged[k] == nil { merged[k] = v }
            byMode = merged
            Self.writeCache(byMode)
            WidgetBridge.update(completions: byMode)
        } catch {
            // Keep the cached state on a transient failure instead of blanking.
        }
    }

    // MARK: Day-keyed cache (the iOS analogue of the web's sessionStorage seed)

    private struct Cache: Codable { let day: String; let byMode: [String: DailyCompletion] }

    private static func readCache() -> [String: DailyCompletion]? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let cache = try? JSONDecoder().decode(Cache.self, from: data),
              cache.day == LeaderboardService.todayLocal() else { return nil }
        return cache.byMode
    }

    private static func writeCache(_ byMode: [String: DailyCompletion]?) {
        guard let byMode else { UserDefaults.standard.removeObject(forKey: cacheKey); return }
        if let data = try? JSONEncoder().encode(Cache(day: LeaderboardService.todayLocal(), byMode: byMode)) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }
}

// formatShortTime now comes from WordociousCore (Format.swift) — the local
// copy rendered "—" at 0s where web/Android render "0s".

/// Seconds until the next LOCAL midnight (puzzles reset locally).
func secondsUntilLocalMidnight() -> Int {
    let cal = Calendar.current
    guard let next = cal.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 0, second: 0), matchingPolicy: .nextTime) else {
        return 0
    }
    return max(0, Int(next.timeIntervalSinceNow))
}

import SwiftUI

extension View {
    /// Re-run `action` the instant a daily game is recorded (the
    /// `DailyCompletionsStore.completionPosted` notification), so completed-state
    /// surfaces — leaderboard, profile, records, home — refresh immediately
    /// instead of only on the next tab switch / re-navigation. The notification
    /// fires even when the view is in a backgrounded tab (its body stays alive),
    /// so by the time the user navigates over, the data is already current.
    func onDailyCompletion(_ action: @escaping () -> Void) -> some View {
        onReceive(NotificationCenter.default.publisher(for: DailyCompletionsStore.completionPosted)) { _ in action() }
    }

    /// Re-run `action` once the daily result row has LANDED on the server —
    /// the right trigger for surfaces that refetch server data (leaderboard
    /// rows/rank, records, completed-daily card). Listening to the optimistic
    /// completionPosted instead re-fetched BEFORE the insert and cached stale
    /// pre-result data.
    func onDailyRecorded(_ action: @escaping () -> Void) -> some View {
        onReceive(NotificationCenter.default.publisher(for: DailyCompletionsStore.completionRecorded)) { _ in action() }
    }
}
