import SwiftUI

/// The achievement display catalog (key/name/description/category/icon), fetched
/// from wordocious.com/api/achievements so the list stays single-sourced in web
/// lib/achievement-service.ts. Persists the last fetch to UserDefaults so the
/// profile grid renders offline after the first load. Unlock DETECTION stays in
/// AchievementService (key-string logic, independent of this list).
@MainActor
final class AchievementCatalog: ObservableObject {
    static let shared = AchievementCatalog()

    @Published private(set) var all: [AchievementDef] = []
    private static let cacheKey = "achievements-catalog-v2"
    private var loaded = false

    struct Payload: Decodable { let achievements: [AchievementDef] }

    init() { if let cached = Self.readCache() { all = cached } }

    func load() async {
        if loaded { return }
        guard let url = URL(string: "https://wordocious.com/api/achievements") else { return }
        // Bypass URLCache: the endpoint sends max-age=3600, so the default policy
        // would keep serving a stale catalog for up to an hour after new
        // achievements ship. Fetch fresh once per session.
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        loaded = true
        all = payload.achievements
        UserDefaults.standard.set(data, forKey: Self.cacheKey)
    }

    private static func readCache() -> [AchievementDef]? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return payload.achievements
    }
}
