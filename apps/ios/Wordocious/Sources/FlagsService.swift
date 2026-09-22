import Foundation
import SwiftUI

/// Remote feature flags — the More Games kill switch + tester gate (plan §7).
/// Port of apps/web/lib/flags.ts `isFlagOn`; the rule is identical on the web
/// and Android:
///
///   no flagKey on the mode        → on   (nothing to gate)
///   flags unknown / unreachable   → on   (the catalog's `enabled` alone decides)
///   no row for the key            → OFF  (a gated mode needs its row — fail closed)
///   row.enabled = false           → OFF  (the kill switch)
///   row.audience = "all"          → on
///   row.audience = "testers"      → on for admins and testers only
///
/// Loaded at launch and on every foreground return (WordociousApp); the last
/// good table is cached in UserDefaults so a cold start offline shows the same
/// set the player saw last time. While the very first fetch is in flight with
/// nothing cached, flagged modes are HIDDEN (no flash of a tester game).
@MainActor
final class FlagsService: ObservableObject {
    static let shared = FlagsService()

    struct AppFlag: Codable, Equatable {
        let key: String
        let enabled: Bool
        let audience: String
    }

    /// nil = unknown (first load in flight, nothing cached); [:] = table empty.
    @Published private(set) var flags: [String: AppFlag]?
    /// True once a load has finished (success or failure) this launch.
    @Published private(set) var loaded = false

    private static let cacheKey = "app-flags-cache"

    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.cacheKey),
           let rows = try? JSONDecoder().decode([AppFlag].self, from: data) {
            flags = Dictionary(uniqueKeysWithValues: rows.map { ($0.key, $0) })
        }
    }

    /// Fetch the table. Any failure keeps the cached (or nil) set; a nil set
    /// after a finished load means "unreachable" → catalog decides.
    func load() async {
        let rows: [AppFlag]? = try? await AuthService.shared.client
            .from("app_flags")
            .select("key, enabled, audience")
            .execute().value
        if let rows {
            flags = Dictionary(uniqueKeysWithValues: rows.map { ($0.key, $0) })
            if let data = try? JSONEncoder().encode(rows) {
                UserDefaults.standard.set(data, forKey: Self.cacheKey)
            }
        }
        loaded = true
    }

    /// Admin or tester — the same set §228 exempts from ads.
    private var viewerIsTester: Bool {
        guard let p = AuthService.shared.profile else { return false }
        return p.isAdmin == true || p.role == "admin" || p.role == "tester"
    }

    /// The shared resolver (see the header).
    func isOn(_ flagKey: String?) -> Bool {
        guard let flagKey else { return true }
        guard let flags else { return loaded }   // in flight → hidden; unreachable → catalog decides
        guard let row = flags[flagKey] else { return false }
        if !row.enabled { return false }
        if row.audience == "all" { return true }
        return viewerIsTester
    }

    /// Pure form for tests and previews: same rule, explicit inputs.
    nonisolated static func resolve(_ flagKey: String?, flags: [String: AppFlag]?, isTester: Bool) -> Bool {
        guard let flagKey else { return true }
        guard let flags else { return true }
        guard let row = flags[flagKey] else { return false }
        if !row.enabled { return false }
        if row.audience == "all" { return true }
        return isTester
    }
}
