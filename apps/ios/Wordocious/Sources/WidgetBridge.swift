import Foundation
import WidgetKit

/// Writes the home-screen widget's data snapshot into the shared app-group
/// container. The widget is a dumb renderer: everything it shows (mode list,
/// colors, completion states, streak) comes from this JSON, so the catalog
/// stays single-sourced in the app and the extension needs no app code.
enum WidgetBridge {
    static let appGroup = "group.com.wordocious.app"
    static let snapshotKey = "widget-snapshot"

    struct ModeEntry: Codable {
        let key: String        // daily_results.game_mode
        let title: String      // shortTitle
        let glyph: String      // 1–4 char badge (C, IV, VIII, 6…)
        let colorHex: String   // accent, "#rrggbb"
        let played: Bool
        let won: Bool
    }

    struct Snapshot: Codable {
        let day: String        // local yyyy-MM-dd the data belongs to
        let streak: Int
        let modes: [ModeEntry]
    }

    /// Called whenever today's completions change (record, refetch, sign-out).
    @MainActor
    static func update(completions byMode: [String: DailyCompletion]) {
        // The DAILY streak (play each day), same source as the header pill —
        // including its launch cache. This was `currentStreak`, the consecutive
        // -WIN streak, which resets on any loss: the founder's widget read 🔥1
        // while his header read 🔥19 the day after a lost game. Next to
        // "puzzles played today", the flame means the daily streak.
        let streak = AuthService.shared.headerStreak ?? 0
        let modes = ModeGen.daily.map { m -> ModeEntry in
            let c = m.dbKey.flatMap { byMode[$0] }
            return ModeEntry(key: m.dbKey ?? m.id, title: m.shortTitle,
                             glyph: m.romanNumeral ?? m.glyph ?? String(m.title.prefix(1)),
                             colorHex: m.accentHex,
                             played: c != nil, won: c?.completed ?? false)
        }
        let snap = Snapshot(day: LeaderboardService.todayLocal(), streak: streak, modes: modes)
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = try? JSONEncoder().encode(snap) else { return }
        defaults.set(data, forKey: snapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
