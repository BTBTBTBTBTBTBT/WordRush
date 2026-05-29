import Foundation
import Supabase

struct AllTimeRecord: Identifiable, Decodable {
    let id: String
    let recordType: String
    let gameMode: String?
    let playType: String?
    let holderId: String
    let recordValue: Double
    let profiles: Ref

    struct Ref: Decodable {
        let username: String
        let avatarUrl: String?
        enum CodingKeys: String, CodingKey { case username; case avatarUrl = "avatar_url" }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case recordType = "record_type"
        case gameMode = "game_mode"
        case playType = "play_type"
        case holderId = "holder_id"
        case recordValue = "record_value"
        case profiles
    }

    var holderUsername: String { profiles.username }

    /// Formats the value per type — ported from RECORD_LABELS in app/records/page.tsx.
    var formattedValue: String {
        let v = Int(recordValue)
        switch recordType {
        case "fastest_win": return v < 60 ? "\(v)s" : "\(v / 60)m \(v % 60)s"
        case "fewest_guesses": return "\(v) guesses"
        case "most_games_played": return "\(v) games"
        case "longest_streak": return "\(v) wins"
        case "most_gold_medals": return "\(v) golds"
        case "highest_level": return "Level \(v)"
        case "most_daily_completions": return "\(v) dailies"
        default: return "\(v)"
        }
    }
}

/// Labels + the global/per-mode type lists, mirroring app/records/page.tsx.
enum RecordCatalog {
    static let labels: [String: (label: String, symbol: String)] = [
        "fastest_win": ("Fastest Win", "clock.fill"),
        "fewest_guesses": ("Fewest Guesses", "target"),
        "most_games_played": ("Most Games Played", "bolt.fill"),
        "longest_streak": ("Longest Streak", "flame.fill"),
        "most_gold_medals": ("Most Gold Medals", "crown.fill"),
        "highest_level": ("Highest Level", "trophy.fill"),
        "most_daily_completions": ("Most Dailies Completed", "target"),
    ]
    static let global = ["longest_streak", "highest_level", "most_gold_medals", "most_daily_completions"]
    static let perMode = ["fastest_win", "fewest_guesses", "most_games_played", "longest_streak"]
}

/// Reads the all-time "hall of records" — mirrors lib/daily-service.ts
/// fetchAllTimeRecords (all_time_records + profiles!inner join, ordered by type).
enum RecordsService {
    static func fetchAll() async throws -> [AllTimeRecord] {
        try await AuthService.shared.client
            .from("all_time_records")
            .select("id, record_type, game_mode, play_type, holder_id, record_value, profiles!inner(username, avatar_url)")
            .order("record_type")
            .execute()
            .value
    }
}
