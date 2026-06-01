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

/// Social links live in a `profiles.social_links` JSONB column. Fetched on its
/// own (not in the main profile select) so that if the column isn't present in
/// a given environment, profile loading still works — this just returns empty.
enum ProfileExtras {
    private struct SocialRow: Decodable {
        let socialLinks: [String: String]?
        enum CodingKeys: String, CodingKey { case socialLinks = "social_links" }
    }
    static func socialLinks(userId: String) async -> [String: String] {
        let row: SocialRow? = try? await AuthService.shared.client.from("profiles")
            .select("social_links").eq("id", value: userId).single().execute().value
        return row?.socialLinks ?? [:]
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
