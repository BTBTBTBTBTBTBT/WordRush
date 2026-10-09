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
        // 2.8 (items 28 + 48): every word daily WON today (the header trophy's flawless day) + the flawless-day
        // run the header trophy shows, so the widget ring reads FLAWLESS "x3" instead of SWEPT. And the
        // `season_halloween` off-switch (false = normal widgets) since the extension can't read flags.
        var flawless: Bool? = nil
        var flawlessStreak: Int? = nil
        var seasonHalloween: Bool? = nil
    }

    /// One widget chip per mode, with the home-menu icon spec flattened for JSON.
    @MainActor
    private static func entry(_ m: GenMode, _ byMode: [String: DailyCompletion]) -> ModeEntry {
        let c = m.dbKey.flatMap { byMode[$0] }
        // Home-menu icon for this mode (homeModes / moreModes key icons by catalog id).
        var kind: String?, asset: String?, text: String?
        // The widget draws the one-ink glyph (it has no game art): unwrap the 3D game icon.
        switch (homeModes + moreModes).first(where: { $0.id == m.id })?.icon.glyph {
        case .asset(let name):    kind = "asset";    asset = name
        case .original(let name): kind = "original"; asset = name
        case .roman(let t):       kind = "roman";    text = t
        case .hand(let name, let n): kind = "hand";  asset = name; text = n
        case .symbol(let name):   kind = "symbol";   asset = name   // SF Symbol name (the Puzzles titles)
        case .game, nil: break
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
        lastCompletions = byMode
        // The DAILY streak (play each day), same source as the header pill —
        // including its launch cache. This was `currentStreak`, the consecutive
        // -WIN streak, which resets on any loss: the founder's widget read 🔥1
        // while his header read 🔥19 the day after a lost game. Next to
        // "puzzles played today", the flame means the daily streak.
        let streak = AuthService.shared.headerStreak ?? 0
        // Item 35: the widget lists games in the player's own order (Classic first), same as Home.
        let sweepGen = ModeGen.sweep
        let sweepOrder = GameOrderStore.shared.orderedIds(sweepGen.map(\.id), section: .dailies)
        let modes = sweepOrder.compactMap { id in sweepGen.first { $0.id == id } }.map { entry($0, byMode) }
        // The Puzzles row: the More Games dailies this player can see (catalog order,
        // each behind its remote flag; menu.more switches the whole group off).
        let flags = FlagsService.shared
        let moreOn = flags.isOn(ModeGen.byId("more")?.flagKey)
        let puzzleAll = moreOn ? ModeGen.more.filter { $0.dailyEligible && $0.dbKey != nil && flags.isOn($0.flagKey) } : []
        let puzzleOrder = GameOrderStore.shared.orderedIds(puzzleAll.map(\.id), section: .puzzles)
        let puzzleGen = puzzleOrder.compactMap { id in puzzleAll.first { $0.id == id } }
        let puzzles = puzzleGen.map { entry($0, byMode) }
        // Same totals helpers as the banner/celebration/share cards. The footer's
        // points cover all eighteen dailies now (word + puzzles).
        let totals = DailyTotals(byMode)
        let more = moreTotals(byMode: byMode, modes: moreModes.filter { m in puzzleGen.contains { $0.id == m.id } })
        let auth = AuthService.shared
        let snap = Snapshot(day: LeaderboardService.todayLocal(), streak: streak, modes: modes,
                            // FINISH_SPEC §AL: the same points the app shows for today (core WidgetStats).
                            points: WidgetStats.points(wordScore: totals.totalScore, puzzleScore: more.totalScore),
                            seconds: Int(totals.totalTimeSeconds),
                            shields: auth.headerShields,
                            puzzles: puzzles,
                            username: auth.isAuthenticated ? auth.profile?.username : nil,
                            wordStreaks: HomeStreaksService.cachedStreaks(.word),
                            puzzleStreaks: HomeStreaksService.cachedStreaks(.puzzles),
                            flawless: !modes.isEmpty && modes.allSatisfy { $0.won },
                            flawlessStreak: MatchStatsService.cachedFlawlessStreak(),
                            seasonHalloween: flags.isLive("season_halloween"))
        guard let data = try? JSONEncoder().encode(snap) else { return }
        // FINISH_SPEC BJ3: Home calls this on every appear (each tab return, each game
        // closed); an unchanged snapshot is neither rewritten nor sent to WidgetKit
        // (the reload is an XPC round trip on the main thread, and it spends the
        // widget's daily reload budget).
        guard data != lastWritten, let defaults = UserDefaults(suiteName: appGroup) else { return }
        lastWritten = data
        defaults.set(data, forKey: snapshotKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// The completions of the last update (so a flawless-run change can re-write the snapshot on its own).
    @MainActor private static var lastCompletions: [String: DailyCompletion]?

    /// Item 48: the flawless run (a cache written after the daily-sweep stats compute) just changed —
    /// rewrite the snapshot and reload the widget the moment it lands. No-op until a first update.
    @MainActor
    static func refresh() {
        guard let c = lastCompletions else { return }
        update(completions: c)
    }

    /// BJ3: the last snapshot handed to the widget this launch.
    @MainActor private static var lastWritten: Data?
}
