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
    enum CodingKeys: String, CodingKey {
        case gameMode = "game_mode"
        case completed
        case guessCount = "guess_count"
        case timeSeconds = "time_seconds"
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
                .select("game_mode, completed, guess_count, time_seconds")
                .eq("user_id", value: userId)
                .eq("day", value: LeaderboardService.todayLocal())
                .eq("play_type", value: "solo")
                .execute().value
            byMode = Dictionary(rows.map { ($0.gameMode, $0) }, uniquingKeysWith: { a, _ in a })
            Self.writeCache(byMode)
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
