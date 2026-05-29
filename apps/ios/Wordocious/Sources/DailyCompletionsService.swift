import Foundation
import Supabase

/// One mode's daily result for today (for the completed-card state).
struct DailyCompletion: Decodable {
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
@MainActor
final class DailyCompletionsStore: ObservableObject {
    @Published private(set) var byMode: [String: DailyCompletion] = [:]

    /// The 9 daily modes (VS excluded — no daily row).
    static let totalDailyModes = 9

    var completedCount: Int { byMode.count }
    var wonCount: Int { byMode.values.filter { $0.completed }.count }
    var allDone: Bool { completedCount >= Self.totalDailyModes }
    var flawless: Bool { allDone && wonCount >= Self.totalDailyModes }

    func load() async {
        let client = AuthService.shared.client
        guard (try? await client.auth.session) != nil,
              let userId = try? await client.auth.session.user.id.uuidString else {
            byMode = [:]; return
        }
        do {
            let rows: [DailyCompletion] = try await client.from("daily_results")
                .select("game_mode, completed, guess_count, time_seconds")
                .eq("user_id", value: userId)
                .eq("day", value: LeaderboardService.todayLocal())
                .eq("play_type", value: "solo")
                .execute().value
            byMode = Dictionary(rows.map { ($0.gameMode, $0) }, uniquingKeysWith: { a, _ in a })
        } catch {
            byMode = [:]
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
