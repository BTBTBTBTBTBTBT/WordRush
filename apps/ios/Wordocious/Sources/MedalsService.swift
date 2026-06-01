import Foundation

/// A row from the `medals` table (daily podium finishes + streak/perfect medals).
struct MedalRow: Decodable, Identifiable {
    let id: String
    let medalType: String
    let gameMode: String?
    let day: String
    enum CodingKeys: String, CodingKey {
        case id, day
        case medalType = "medal_type"
        case gameMode = "game_mode"
    }
}

enum MedalsService {
    /// Most-recent medals for a user (powers the Profile "Daily Medals" list).
    static func recent(userId: String, limit: Int = 5) async -> [MedalRow] {
        (try? await AuthService.shared.client.from("medals")
            .select("id, medal_type, game_mode, day")
            .eq("user_id", value: userId)
            .order("day", ascending: false)
            .limit(limit)
            .execute().value) ?? []
    }
}
