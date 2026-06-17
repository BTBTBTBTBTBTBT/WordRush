import Foundation
import SwiftUI
import Supabase

/// One achievement definition — 1:1 with apps/web/lib/achievement-service.ts
/// ACHIEVEMENTS. Display-only on native: unlock detection runs server-side on
/// the web's recordGameResult and lands in the shared `achievements` table;
/// here we read which keys the user has unlocked. (Native-side unlock detection
/// is a deferred follow-up.)
struct AchievementDef: Identifiable, Decodable {
    let key: String, name: String, description: String, category: String
    var icon: String? = nil   // present in the /api/achievements payload; unused for rendering
    var id: String { key }
}

enum AchievementService {

    static func fetchUnlocked(userId: String) async -> Set<String> {
        struct Row: Decodable { let achievement_key: String }
        let rows: [Row] = (try? await AuthService.shared.client.from("achievements")
            .select("achievement_key")
            .eq("user_id", value: userId)
            .execute().value) ?? []
        return Set(rows.map { $0.achievement_key })
    }

    // MARK: - Unlock detection (port of checkAchievements)

    private struct AchProfile: Decodable {
        let total_wins: Int; let current_streak: Int; let best_streak: Int
        let daily_login_streak: Int; let level: Int
        let gold_medals: Int; let silver_medals: Int; let bronze_medals: Int
    }
    private struct StatRow: Decodable { let game_mode: String; let wins: Int; let total_games: Int; let play_type: String }
    private struct BonusRow: Decodable { let day: String; let sweep_awarded: Bool; let flawless_awarded: Bool }
    private struct DailyRow: Decodable { let game_mode: String; let time_seconds: Int?; let guess_count: Int?; let boards_solved: Int?; let total_boards: Int?; let vs_wins: Int?; let day: String? }
    private struct InsertRow: Encodable { let user_id: String; let achievement_key: String }

    /// Award achievements after a finished game — 1:1 port of
    /// apps/web/lib/achievement-service.ts checkAchievements. Inserts newly
    /// unlocked keys into the shared `achievements` table. Fire-and-forget.
    @discardableResult
    static func checkAchievements(userId: String, gameMode: String, playType: String,
                                  won: Bool, guessCount: Int, timeSeconds: Int,
                                  seed: String?, hintsUsed: Int = 0) async -> [String] {
        let client = AuthService.shared.client
        var unlocked: [String] = []
        let already = await fetchUnlocked(userId: userId)
        var awarded = already

        func tryUnlock(_ key: String) async {
            guard !awarded.contains(key) else { return }
            do {
                try await client.from("achievements").insert(InsertRow(user_id: userId, achievement_key: key)).execute()
                awarded.insert(key); unlocked.append(key)
            } catch { /* unique-violation or transient — ignore */ }
        }
        func has(_ k: String) -> Bool { awarded.contains(k) }
        let isDaily = seed?.hasPrefix("daily-") ?? false
        let today = LeaderboardService.todayLocal()

        // Count helper.
        func count(_ table: String, _ build: (PostgrestFilterBuilder) -> PostgrestFilterBuilder) async -> Int {
            let q = build(client.from(table).select("*", head: true, count: .exact))
            return (try? await q.execute().count) ?? 0
        }

        if won { await tryUnlock("first_win") }
        if isDaily { await tryUnlock("daily_debut") }
        if gameMode == "DUEL" && won && timeSeconds < 30 { await tryUnlock("speed_demon") }
        if won && guessCount == 1 { await tryUnlock("perfectionist") }
        if gameMode == "GAUNTLET" && won { await tryUnlock("gauntlet_master") }
        if gameMode == "DUEL" && won && guessCount <= 2 { await tryUnlock("no_sweat") }
        if won && timeSeconds < 15 { await tryUnlock("blitz") }

        // Close Call (win on final guess)
        let finalGuess = ["DUEL": 6, "DUEL_6": 7, "DUEL_7": 8, "PROPERNOUNDLE": 6, "QUORDLE": 9, "OCTORDLE": 13]
        if won, let fg = finalGuess[gameMode], guessCount == fg { await tryUnlock("close_call") }

        // Profile-derived (single fetch).
        let profile: AchProfile? = try? await client.from("profiles")
            .select("total_wins,current_streak,best_streak,daily_login_streak,level,gold_medals,silver_medals,bronze_medals")
            .eq("id", value: userId).single().execute().value
        if let p = profile {
            if won && p.total_wins >= 100 { await tryUnlock("century_club") }
            if won && p.total_wins >= 1000 { await tryUnlock("thousand_words") }
            if won && p.total_wins >= 500 { await tryUnlock("wordsmith") }
            if won && p.current_streak >= 5 { await tryUnlock("unstoppable") }
            if won && (p.current_streak >= 25 || p.best_streak >= 25) { await tryUnlock("unbreakable") }
            if p.daily_login_streak >= 7 { await tryUnlock("streak_7") }
            if p.daily_login_streak >= 30 { await tryUnlock("streak_30") }
            if p.daily_login_streak >= 50 { await tryUnlock("streak_master") }
            if p.daily_login_streak >= 365 { await tryUnlock("year_one") }
            if p.level >= 10 { await tryUnlock("rising_star") }
            if p.level >= 50 { await tryUnlock("elite") }
            let medals = p.gold_medals + p.silver_medals + p.bronze_medals
            if medals >= 10 { await tryUnlock("medal_10") }
            if medals >= 50 { await tryUnlock("medal_50") }
            if medals >= 100 { await tryUnlock("medal_wall") }
            if p.gold_medals >= 10 { await tryUnlock("golden_touch") }
            if p.gold_medals >= 50 { await tryUnlock("gold_rush") }
            if p.gold_medals >= 100 { await tryUnlock("diamond_hands") }
            if playType == "vs" && won && p.total_wins >= 10 { await tryUnlock("vs_veteran") }
            if playType == "vs" && won && p.current_streak >= 10 { await tryUnlock("untouchable") }
        }

        // user_stats (single fetch).
        let stats: [StatRow] = (try? await client.from("user_stats")
            .select("game_mode,wins,total_games,play_type").eq("user_id", value: userId).execute().value) ?? []
        if !stats.isEmpty {
            let modes = Set(stats.map { $0.game_mode })
            let allModes = ["DUEL","QUORDLE","OCTORDLE","SEQUENCE","RESCUE","DUEL_6","DUEL_7","GAUNTLET","PROPERNOUNDLE"]
            if allModes.allSatisfy({ modes.contains($0) }) { await tryUnlock("all_modes") }

            let soloWinsByMode: (String) -> Int = { m in stats.filter { $0.game_mode == m && $0.play_type == "solo" }.reduce(0) { $0 + $1.wins } }
            let mastery: [(String, String, Int)] = [
                ("quad_king","QUORDLE",50), ("octo_boss","OCTORDLE",50), ("sequence_ace","SEQUENCE",50),
                ("rescue_hero","RESCUE",50), ("six_shooter","DUEL_6",50), ("lucky_seven","DUEL_7",50),
                ("proper_scholar","PROPERNOUNDLE",50), ("classic_master","DUEL",100),
            ]
            for (key, mode, thresh) in mastery where soloWinsByMode(mode) >= thresh { await tryUnlock(key) }

            let totalPlayed = stats.reduce(0) { $0 + $1.total_games }
            if totalPlayed >= 500 { await tryUnlock("dedicated") }
            if totalPlayed >= 1000 { await tryUnlock("endurance") }
            if totalPlayed >= 2000 { await tryUnlock("obsessed") }

            let vs = stats.filter { $0.play_type == "vs" }
            if playType == "vs" {
                if vs.reduce(0, { $0 + $1.total_games }) >= 50 { await tryUnlock("rival") }
                if vs.reduce(0, { $0 + $1.wins }) >= 50 { await tryUnlock("dominant") }
                if vs.filter({ $0.wins > 0 }).count >= 5 { await tryUnlock("versatile_victor") }
            }
        }

        // daily_bonuses (single fetch) — sweep/flawless flags, streaks, counts.
        let bonuses: [BonusRow] = (try? await client.from("daily_bonuses")
            .select("day,sweep_awarded,flawless_awarded").eq("user_id", value: userId)
            .order("day", ascending: false).execute().value) ?? []
        if !bonuses.isEmpty {
            if bonuses.contains(where: { $0.sweep_awarded }) { await tryUnlock("daily_sweep") }
            if bonuses.contains(where: { $0.flawless_awarded }) { await tryUnlock("flawless_victory") }
            let sweepCount = bonuses.filter { $0.sweep_awarded }.count
            if sweepCount >= 50 { await tryUnlock("daily_devotee") }
            if sweepCount >= 100 { await tryUnlock("centurion") }
            let sweepDays = bonuses.filter { $0.sweep_awarded }.map { $0.day }
            let sweepRun = consecutiveRun(sweepDays)
            if sweepRun >= 7 { await tryUnlock("sweep_streak_7") }
            if sweepRun >= 30 { await tryUnlock("iron_will") }
            if sweepRun >= 60 { await tryUnlock("sweep_streak_60") }
            let flawlessDays = bonuses.filter { $0.flawless_awarded }.map { $0.day }
            let flawlessCount = flawlessDays.count
            if flawlessCount >= 5 { await tryUnlock("flawless_5") }
            if flawlessCount >= 25 { await tryUnlock("flawless_25") }
            let flawlessRun = consecutiveRun(flawlessDays)
            if flawlessRun >= 3 { await tryUnlock("flawless_streak") }
            if flawlessRun >= 5 { await tryUnlock("flawless_streak_5") }
        }

        // Pure ladder (matches counts) — only after a hintless win in a pure mode.
        let pureModes = ["DUEL_6","DUEL_7","PROPERNOUNDLE"]
        if won && hintsUsed == 0 && pureModes.contains(gameMode) {
            let slug = gameMode == "DUEL_6" ? "six" : gameMode == "DUEL_7" ? "seven" : "proper"
            let c = await count("matches") { $0.eq("player1_id", value: userId).is("player2_id", value: nil)
                .eq("winner_id", value: userId).eq("game_mode", value: gameMode).eq("hints_used", value: 0) }
            if c >= 1 { await tryUnlock("pure_\(slug)_initiate") }
            if c >= 10 { await tryUnlock("pure_\(slug)_adept") }
            if c >= 50 { await tryUnlock("pure_\(slug)_master") }
            if !has("pure_player") {
                let all = await count("matches") { $0.eq("player1_id", value: userId).is("player2_id", value: nil)
                    .eq("winner_id", value: userId).in("game_mode", values: pureModes).eq("hints_used", value: 0) }
                if all >= 50 { await tryUnlock("pure_player") }
            }
        }

        // Lifetime daily_results counts.
        if won && guessCount == 1 && !has("eagle_eye") {
            if await count("daily_results", { $0.eq("user_id", value: userId).eq("guess_count", value: 1).eq("completed", value: true) }) >= 10 { await tryUnlock("eagle_eye") }
        }
        if won && timeSeconds < 30 && !has("the_natural") {
            if await count("daily_results", { $0.eq("user_id", value: userId).eq("completed", value: true).lt("time_seconds", value: 30).gt("boards_solved", value: 0) }) >= 10 { await tryUnlock("the_natural") }
        }

        // Daily-only, today-scoped + lifetime-day checks.
        if isDaily {
            let todays: [DailyRow] = (try? await client.from("daily_results")
                .select("game_mode,time_seconds,guess_count,boards_solved,total_boards,vs_wins,day")
                .eq("user_id", value: userId).eq("day", value: today).eq("completed", value: true)
                .execute().value) ?? []
            let fastWins = todays.filter { ($0.time_seconds ?? 0) < 60 }
            if fastWins.count >= 3 { await tryUnlock("hat_trick") }
            let todayModes = Set(todays.map { $0.game_mode })
            let allModes = ["DUEL","QUORDLE","OCTORDLE","SEQUENCE","RESCUE","DUEL_6","DUEL_7","GAUNTLET","PROPERNOUNDLE"]
            if todays.count >= 9 && allModes.allSatisfy({ todayModes.contains($0) }) {
                let totalTime = todays.reduce(0) { $0 + ($1.time_seconds ?? 0) }
                if totalTime < 1200 { await tryUnlock("lightning_round") }
                if totalTime < 900 { await tryUnlock("speed_sweep") }
                // todays is filtered completed=true, so all 9 present == Flawless day.
                if totalTime < 1080 { await tryUnlock("flawless_speed") }
            }
            if playType == "vs" && won && !has("triple_threat") {
                if todays.reduce(0, { $0 + ($1.vs_wins ?? 0) }) >= 3 { await tryUnlock("triple_threat") }
            }
            if (gameMode == "DUEL_6" || gameMode == "DUEL_7") && won && !has("extended_vocab") {
                if todayModes.contains("DUEL_6") && todayModes.contains("DUEL_7") { await tryUnlock("extended_vocab") }
            }
            if ["DUEL","DUEL_6","DUEL_7"].contains(gameMode) && won && !has("linguist") {
                if todayModes.contains("DUEL") && todayModes.contains("DUEL_6") && todayModes.contains("DUEL_7") { await tryUnlock("linguist") }
            }
            if gameMode == "GAUNTLET" && won && !has("gauntlet_god") {
                if let g = todays.first(where: { $0.game_mode == "GAUNTLET" }), let s = g.boards_solved, let t = g.total_boards, s == t {
                    await tryUnlock("gauntlet_god")
                }
            }
            // Lifetime distinct days + total time.
            if !has("daily_regular") || !has("marathon_runner") {
                let allDaily: [DailyRow] = (try? await client.from("daily_results")
                    .select("day,time_seconds").eq("user_id", value: userId).eq("completed", value: true)
                    .execute().value) ?? []
                if Set(allDaily.compactMap { $0.day }).count >= 100 { await tryUnlock("daily_regular") }
                if allDaily.reduce(0, { $0 + ($1.time_seconds ?? 0) }) >= 18000 { await tryUnlock("marathon_runner") }
            }
        }

        return unlocked
    }

    /// Longest consecutive-day run from a list of yyyy-MM-dd strings (sorted desc),
    /// counting back from the most recent. Mirrors the web's ~23–25h diff check.
    private static func consecutiveRun(_ daysDesc: [String]) -> Int {
        guard !daysDesc.isEmpty else { return 0 }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "UTC")
        let dates = daysDesc.compactMap { f.date(from: $0) }
        guard !dates.isEmpty else { return 0 }
        var run = 1
        for i in 1..<dates.count {
            let diff = dates[i - 1].timeIntervalSince(dates[i])
            if diff >= 82_800 && diff <= 90_000 { run += 1 } else { break }
        }
        return run
    }
}

/// Reusable collapsible section (title + count badge + chevron) — ports
/// components/profile/collapsible-section.tsx.
struct CollapsibleSection<Content: View>: View {
    let title: String
    var badge: String? = nil
    @State private var open = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            Button { withAnimation(Theme.animation(.easeInOut(duration: 0.2))) { open.toggle() } } label: {
                HStack(spacing: 8) {
                    Text(title).font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    if let badge {
                        Text(badge).font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Capsule().fill(Theme.surfaceAlt))
                    }
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.textMuted).rotationEffect(.degrees(open ? 180 : 0))
                }
                .padding(.vertical, 4)
                .contentShape(Rectangle())   // whole row tappable, not just the text/chevron
            }.buttonStyle(.plain)
            if open { content.padding(.top, 8) }
        }
    }
}
