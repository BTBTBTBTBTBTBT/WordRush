import SwiftUI

/// The achievement display catalog (key/name/description/category/icon), fetched
/// from wordocious.com/api/achievements so the list stays single-sourced in web
/// lib/achievement-service.ts. Persists the last fetch to UserDefaults so the
/// profile grid renders offline after the first load. Unlock DETECTION stays in
/// AchievementService (key-string logic, independent of this list).
@MainActor
final class AchievementCatalog: ObservableObject {
    static let shared = AchievementCatalog()

    /// The visible catalog (hidden achievements stay hidden — FINISH_SPEC BE).
    @Published private(set) var all: [AchievementDef] = []
    /// Everything the API serves, hidden ones included (lookups by key).
    private var everything: [AchievementDef] = []

    func find(_ key: String) -> AchievementDef? { everything.first { $0.key == key } }

    private func set(_ list: [AchievementDef]) {
        everything = list
        all = list.filter { $0.hidden != true }
    }
    private static let cacheKey = "achievements-catalog-v2"
    private var loaded = false

    struct Payload: Decodable { let achievements: [AchievementDef] }

    /// The cached catalog, else the bundled snapshot (achievements-catalog.json, pinned to web
    /// ACHIEVEMENT_CATALOG by lib/achievements-catalog-snapshot.test.ts), so the Title Shelves and the
    /// badge grid are never bare on a first offline open; the live fetch replaces it.
    init() {
        if let cached = Self.readCache(), !cached.isEmpty { set(cached) }
        else if let bundled = Self.readBundled() { set(bundled) }
    }

    func load(force: Bool = false) async {
        if loaded && !force { return }
        guard let url = URL(string: "https://wordocious.com/api/achievements") else { return }
        // Bypass URLCache: the endpoint sends max-age=3600, so the default policy
        // would keep serving a stale catalog for up to an hour after new
        // achievements ship. Fetch fresh once per session.
        var req = URLRequest(url: url)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, _) = try? await Net.api.data(for: req),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        loaded = true
        set(payload.achievements)
        UserDefaults.standard.set(data, forKey: Self.cacheKey)
    }

    private static func readBundled() -> [AchievementDef]? {
        guard let url = Bundle.main.url(forResource: "achievements-catalog", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return payload.achievements
    }

    private static func readCache() -> [AchievementDef]? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return payload.achievements
    }
}
