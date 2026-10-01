import Foundation
import WidgetKit
import WordociousCore

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
        let glyph: String      // 1–4 char badge (C, IV, VIII, 6…) — fallback renderer
        let colorHex: String   // accent, "#rrggbb"
        let played: Bool
        let won: Bool
        // The home-menu icon spec (ModeIconKind flattened for JSON) so the
        // widget draws the SAME icons as the main menu. Optional: an old
        // snapshot without them falls back to the text glyph.
        let iconKind: String?  // "asset" | "original" | "roman" | "hand"
        let iconAsset: String? // imageset name for asset/original/hand
        let iconText: String?  // roman text, or the hand's digit
    }

    struct Snapshot: Codable {
        let day: String        // local yyyy-MM-dd the data belongs to
        let streak: Int
        let modes: [ModeEntry]
        // Footer stats (widget v2). Optional so a widget reading an old app's
        // snapshot — or vice versa — keeps decoding.
        let points: Int?       // today's summed composite score (sum-of-rounds)
        let seconds: Int?      // today's summed play time
        let shields: Int?      // streak shields (for the at-risk state)
        // Home redesign (founder, 2026-10-01; spec §5): the widget mirrors the home
        // banner — the ten Puzzles dailies, the player's username for the greeting,
        // and both rows' streaks. All optional so either side reads an older snapshot.
        var puzzles: [ModeEntry]? = nil
        var username: String? = nil
        var wordStreaks: GroupStreaks? = nil
        var puzzleStreaks: GroupStreaks? = nil
    }

    /// One widget chip per mode, with the home-menu icon spec flattened for JSON.
    @MainActor
    private static func entry(_ m: GenMode, _ byMode: [String: DailyCompletion]) -> ModeEntry {
        let c = m.dbKey.flatMap { byMode[$0] }
        // Home-menu icon for this mode (homeModes / moreModes key icons by catalog id).
        var kind: String?, asset: String?, text: String?
        switch (homeModes + moreModes).first(where: { $0.id == m.id })?.icon {
        case .asset(let name):    kind = "asset";    asset = name
        case .original(let name): kind = "original"; asset = name
        case .roman(let t):       kind = "roman";    text = t
        case .hand(let name, let n): kind = "hand";  asset = name; text = n
        case .symbol(let name):   kind = "symbol";   asset = name   // SF Symbol name (the Puzzles titles)
        case nil: break
        }
        return ModeEntry(key: m.dbKey ?? m.id, title: m.shortTitle,
                         glyph: m.romanNumeral ?? m.glyph ?? String(m.title.prefix(1)),
                         colorHex: m.accentHex,
                         played: c != nil, won: c?.completed ?? false,
                         iconKind: kind, iconAsset: asset, iconText: text)
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
        let modes = ModeGen.sweep.map { entry($0, byMode) }
        // The Puzzles row: the More Games dailies this player can see (catalog order,
        // each behind its remote flag; menu.more switches the whole group off).
        let flags = FlagsService.shared
        let moreOn = flags.isOn(ModeGen.byId("more")?.flagKey)
        let puzzleGen = moreOn ? ModeGen.more.filter { $0.dailyEligible && $0.dbKey != nil && flags.isOn($0.flagKey) } : []
        let puzzles = puzzleGen.map { entry($0, byMode) }
        // Same totals helpers as the banner/celebration/share cards. The footer's
        // points cover all eighteen dailies now (word + puzzles).
        let totals = DailyTotals(byMode)
        let more = moreTotals(byMode: byMode, modes: moreModes.filter { m in puzzleGen.contains { $0.id == m.id } })
        let auth = AuthService.shared
        let snap = Snapshot(day: LeaderboardService.todayLocal(), streak: streak, modes: modes,
                            points: Int(totals.totalScore + more.totalScore.rounded()), seconds: Int(totals.totalTimeSeconds),
                            shields: auth.headerShields,
                            puzzles: puzzles,
                            username: auth.isAuthenticated ? auth.profile?.username : nil,
                            wordStreaks: HomeStreaksService.cachedStreaks(.word),
                            puzzleStreaks: HomeStreaksService.cachedStreaks(.puzzles))
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = try? JSONEncoder().encode(snap) else { return }
        defaults.set(data, forKey: snapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
