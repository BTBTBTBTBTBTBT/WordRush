import Foundation
import Supabase

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
            totalScore += c.score
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

    init() {
        byMode = Self.readCache() ?? [:]
        NotificationCenter.default.addObserver(forName: Self.completionPosted, object: nil, queue: .main) { [weak self] note in
            guard let self, let c = note.object as? DailyCompletion else { return }
            // Best-result semantics: never downgrade a recorded win on replay.
            if let existing = self.byMode[c.gameMode], existing.completed && !c.completed { return }
            self.byMode[c.gameMode] = c
            Self.writeCache(self.byMode)
            WidgetBridge.update(completions: self.byMode)
        }
    }

    func load() async {
        let client = AuthService.shared.client
        guard (try? await client.auth.session) != nil,
              let userId = try? await client.auth.session.user.id.uuidString else {
            byMode = [:]; Self.writeCache(nil); return
        }
        do {
            let rows: [DailyCompletion] = try await client.from("daily_results")
                .select("game_mode, completed, guess_count, time_seconds, composite_score")
                .eq("user_id", value: userId)
                .eq("day", value: LeaderboardService.todayLocal())
                .eq("play_type", value: "solo")
                .execute().value
            var merged = Dictionary(rows.map { ($0.gameMode, $0) }, uniquingKeysWith: { a, _ in a })
            // Read-after-write race: `.onDailyCompletion` calls load() the instant
            // a daily finishes, but the row we just INSERTed may not be queryable
            // yet — a blind replace would drop the just-finished mode, making a
            // real Flawless show as an N-1/9 Sweep with that mode missing. Keep any
            // locally-known finish (from the optimistic completionPosted note) the
            // server response is still missing — won OR lost, since the all-9 count
            // needs losses too; daily rows are permanent once written.
            for (k, v) in byMode where merged[k] == nil { merged[k] = v }
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

func formatShortTime(_ seconds: Int) -> String {
    if seconds <= 0 { return "—" }
    if seconds < 60 { return "\(seconds)s" }
    let m = seconds / 60, s = seconds % 60
    return s == 0 ? "\(m)m" : "\(m)m \(s)s"
}

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
}
