import Foundation
import Supabase
import UIKit
import WordociousCore

/// One mode's daily result for today (for the completed-card state).
/// Codable so the store can cache today's completions on-device (web parity:
/// daily-completions-context.tsx seeds first render from sessionStorage so
/// completed badges never flash in after a fetch).
struct DailyCompletion: Codable, Equatable {
    let gameMode: String
    let completed: Bool
    let guessCount: Int
    let timeSeconds: Double
    /// Per-mode daily composite score (daily_results.composite_score). Optional in
    /// the on-device cache written before this field existed → defaults to 0.
    let score: Double
    /// Boards and hints (optional: older caches and older call sites lack them) — let the
    /// leaderboard draw the player's own row before the server's rows include it.
    var boardsSolved: Int? = nil
    var totalBoards: Int? = nil
    var hintsUsed: Int? = nil
    enum CodingKeys: String, CodingKey {
        case gameMode = "game_mode"
        case completed
        case guessCount = "guess_count"
        case timeSeconds = "time_seconds"
        case score = "composite_score"
        case boardsSolved = "boards_solved"
        case totalBoards = "total_boards"
        case hintsUsed = "hints_used"
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
        boardsSolved = try? c.decodeIfPresent(Int.self, forKey: .boardsSolved)
        totalBoards = try? c.decodeIfPresent(Int.self, forKey: .totalBoards)
        hintsUsed = try? c.decodeIfPresent(Int.self, forKey: .hintsUsed)
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
        for (key, c) in byMode where DailyCompletionsStore.sweepKeys.contains(key) {
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

    /// The LOCAL day `byMode` belongs to. Surfaces that treat `allDone` as
    /// "today is swept" (the celebration modal) MUST check this equals
    /// `todayLocal()`: after a warm resume across midnight the in-memory set is
    /// still yesterday's until a load() succeeds — and load()'s transient-
    /// failure path deliberately keeps cached state, so without a day stamp
    /// yesterday's 9/9 read as today's (the widget-launch "0/9 DAILY SWEEP"
    /// modal: fired off the stale set, then rendered today's empty truth).
    @Published private(set) var dataDay: String = LeaderboardService.todayLocal()

    /// The Daily Sweep set, from the catalog (More Games Stage 4) — never a
    /// literal. Only these keys count toward N/total, the celebration, the ring
    /// and the widget; a More Games result on the map is ignored here.
    /// nonisolated: immutable constants, safely readable from the non-isolated
    /// `DailyTotals` struct and any context.
    nonisolated static let sweepKeys: Set<String> = Set(ModeGen.sweep.compactMap { $0.dbKey })
    nonisolated static let totalDailyModes = ModeGen.sweep.count

    private static let cacheKey = "daily-completions-cache"

    var completedCount: Int { byMode.keys.filter { Self.sweepKeys.contains($0) }.count }

    /// Today's cached completion count without spinning up a store — lets
    /// NotificationService decide whether tonight's reminder is still needed.
    /// The cache is day-keyed, so a stale (yesterday's) cache reads as 0.
    static func cachedTodayCount() -> Int { readCache()?.count ?? 0 }
    var wonCount: Int { byMode.filter { Self.sweepKeys.contains($0.key) && $0.value.completed }.count }
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
            // Delivered on `.main` (queue: .main above), so we are genuinely on the
            // main actor — assumeIsolated lets us touch main-actor state synchronously
            // without deferring into a Task (which would change ordering).
            MainActor.assumeIsolated {
                guard let self, let c = note.object as? DailyCompletion else { return }
                // A finish landing after LOCAL midnight with yesterday's set
                // still in memory (session alive across the boundary) starts a
                // fresh day — yesterday's entries must never count toward
                // today's sweep.
                // BI19: core CompletionLedger (unit tested) — day-scoped, best-result
                // (a replay never downgrades a recorded win), applied synchronously
                // so Home's W/L is there the moment the finish lands.
                let today = LeaderboardService.todayLocal()
                var ledger = CompletionLedger(day: self.dataDay, byMode: self.byMode, isWin: { $0.completed })
                let dayRolled = self.dataDay != today
                let changed = ledger.apply(mode: c.gameMode, result: c, today: today)
                if dayRolled { self.optimistic = [:]; self.dataDay = today; self.byMode = ledger.byMode }
                guard changed else { return }
                self.byMode = ledger.byMode
                self.optimistic[c.gameMode] = c
                self.optimisticDay = today
                Self.writeCache(self.byMode)
                WidgetBridge.update(completions: self.byMode)
            }
        }
        // A session left open across LOCAL midnight must refresh to the new day's
        // (empty) completions. Without this, yesterday's byMode lingered and — via
        // the old in-memory merge — got re-stamped onto today, so the home grid
        // showed yesterday's sweep as done with no board behind it. Reload on
        // foreground + on the system day change, mirroring web daily-boundary-reload.
        let reload: @Sendable (Notification) -> Void = { [weak self] _ in Task { await self?.load() } }
        NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main, using: reload)
        NotificationCenter.default.addObserver(forName: .NSCalendarDayChanged, object: nil, queue: .main, using: reload)
    }

    func load() async {
        let today = LeaderboardService.todayLocal()
        // Day rolled over since our last optimistic finish → those finishes are
        // yesterday's; drop them before they can be re-merged onto today.
        if optimisticDay != today { optimistic = [:]; optimisticDay = today }

        let client = AuthService.shared.client
        // BI15: "signed out" is decided from the LOCAL session. The refreshing
        // `client.auth.session` throws whenever the token refresh can't reach
        // the server (offline, or the 2026-10-02 outage) — and this branch then
        // WIPED today's completions and their cache, so every finished card on
        // Home read as unplayed until the network came back.
        guard let userId = localUserId() else {
            byMode = [:]; optimistic = [:]; dataDay = today; Self.writeCache(nil)
            WidgetBridge.update(completions: byMode)   // §AL: a fresh 0/N, ⭐ 0 widget
            return
        }
        do {
            let rows: [DailyCompletion] = try await client.from("daily_results")
                .select("game_mode, completed, guess_count, time_seconds, composite_score, boards_solved, total_boards, hints_used")
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
            var stillPending = optimistic
            // BI15: finishes still in the pending-write queue (outage, offline
            // finish, killed mid-write — possibly a previous launch) count as
            // done on this device; the queue retries the row in the background.
            for c in PendingRecords.pendingTodayCompletions(day: today) where stillPending[c.gameMode] == nil {
                stillPending[c.gameMode] = c
            }
            // BI19: core CompletionLedger.reconcile — the server's rows win silently.
            var ledger = CompletionLedger<DailyCompletion>(day: today, isWin: { $0.completed })
            ledger.reconcile(server: Dictionary(rows.map { ($0.gameMode, $0) }, uniquingKeysWith: { a, _ in a }),
                             stillPending: stillPending, today: today)
            if ledger.byMode != byMode { byMode = ledger.byMode }   // swap in only what changed
            dataDay = today
            Self.writeCache(byMode)
            WidgetBridge.update(completions: byMode)
        } catch {
            // Keep the cached state on a transient failure instead of blanking —
            // but ONLY if it belongs to today. A failed fetch right after a warm
            // resume across midnight (radio still waking) must not leave
            // yesterday's set posing as today's: that stale 9/9 is what fired
            // the widget-launch "0/9 DAILY SWEEP" celebration.
            if dataDay != today {
                byMode = [:]
                optimistic = [:]
                dataDay = today
            }
            // BI15: the server is unreachable — today's queued finishes still show.
            for c in PendingRecords.pendingTodayCompletions(day: today) where byMode[c.gameMode] == nil {
                byMode[c.gameMode] = c
            }
            Self.writeCache(byMode)
            WidgetBridge.update(completions: byMode)
        }
    }

    // MARK: Day-keyed cache (the iOS analogue of the web's sessionStorage seed)

    // BI19: the CompletionLedger's persisted form ({day, byMode} — the same JSON
    // this cache always had, so an upgrade keeps today's map).
    private static func readCache() -> [String: DailyCompletion]? {
        CompletionLedger<DailyCompletion>.load(from: .standard, key: cacheKey, today: LeaderboardService.todayLocal())
    }

    private static func writeCache(_ byMode: [String: DailyCompletion]?) {
        guard let byMode else { UserDefaults.standard.removeObject(forKey: cacheKey); return }
        CompletionLedger(day: LeaderboardService.todayLocal(), byMode: byMode, isWin: { $0.completed })
            .save(to: .standard, key: cacheKey)
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
