import Foundation
import Supabase
import WordociousCore

/// Records a finished game's full progression, porting the core of
/// lib/stats-service.ts recordGameResult(): user_stats (wins/losses/games/
/// best/avg/fastest), profile XP + level + win-streak + daily-login-streak
/// (+ 7-day shield grant), and the daily_results leaderboard row.
///
/// Deferred vs web (best-effort / fire-and-forget there): all_time_records
/// checkAndUpdateRecord writes and the daily "sweep" bonus. See bible §7.
enum GameResultsService {
    private struct StatsRow: Decodable {
        let id: String
        let wins: Int
        let losses: Int
        let totalGames: Int
        let bestScore: Int
        let averageTime: Int
        let fastestTime: Int
        enum CodingKeys: String, CodingKey {
            case id, wins, losses
            case totalGames = "total_games"
            case bestScore = "best_score"
            case averageTime = "average_time"
            case fastestTime = "fastest_time"
        }
    }

    private struct StatsUpdate: Encodable {
        let wins: Int, losses: Int, total_games: Int
        let best_score: Int, average_time: Int, fastest_time: Int
    }

    /// A solo game as a `matches` row (player2_id = null) — ports
    /// lib/stats-service.ts recordSoloMatch. This is what powers the Profile
    /// charts (guess distribution, activity calendar, solve-time, etc.), which
    /// all query `matches`. Without it, native play wouldn't show up there.
    private struct SoloMatchInsert: Encodable {
        let game_mode: String
        let player1_id: String
        let winner_id: String?      // nil (omitted) on a loss
        let player1_score: Int      // guess count — buckets the distribution
        let player1_time: Int       // seconds
        let seed: String
        let solutions: [String]
        let player1_guesses: [String]
        let hints_used: Int
        let started_at: String
        let completed_at: String
    }

    /// Insert a solo match-history row for a finished game.
    static func recordSoloMatch(
        gameMode: GameMode, won: Bool, score: Int, timeSeconds: Int,
        seed: String, solutions: [String], guesses: [String], hintsUsed: Int = 0
    ) async {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        let userId = session.user.id.uuidString
        let now = Date()
        let iso = ISO8601DateFormatter()
        let row = SoloMatchInsert(
            game_mode: gameMode.rawValue, player1_id: userId,
            winner_id: won ? userId : nil, player1_score: score, player1_time: timeSeconds,
            seed: seed, solutions: solutions, player1_guesses: guesses, hints_used: hintsUsed,
            started_at: iso.string(from: now.addingTimeInterval(-Double(timeSeconds))),
            completed_at: iso.string(from: now))
        try? await client.from("matches").insert(row).execute()
    }

    /// Gauntlet per-stage breakdown stored on the matches row so the results
    /// screen renders cross-device (web ↔ native). Written as a SEPARATE
    /// best-effort update after the insert: if the `gauntlet_stages` column
    /// isn't present yet, this silently no-ops and the match row is unaffected
    /// (the social_links lesson — a missing column must never break recording).
    struct GauntletStagesPayload: Encodable {
        let stages: [GauntletStageConfig]
        let stageResults: [GauntletStageResult]
    }
    private struct GauntletStagesUpdate: Encodable { let gauntlet_stages: GauntletStagesPayload }

    static func recordGauntletStages(seed: String, payload: GauntletStagesPayload) async {
        let client = AuthService.shared.client
        guard let uid = try? await client.auth.session.user.id.uuidString else { return }
        try? await client.from("matches")
            .update(GauntletStagesUpdate(gauntlet_stages: payload))
            .eq("player1_id", value: uid)
            .eq("game_mode", value: "GAUNTLET")
            .eq("seed", value: seed)
            .execute()
    }
    private struct StatsInsert: Encodable {
        let user_id: String, game_mode: String, play_type: String
        let wins: Int, losses: Int, total_games: Int
        let best_score: Int, average_time: Int, fastest_time: Int
    }

    private struct ProfileRow: Decodable {
        let totalWins: Int, totalLosses: Int
        let currentStreak: Int, bestStreak: Int
        let xp: Int
        let level: Int?
        let lastPlayedAt: String?
        let dailyLoginStreak: Int, bestDailyLoginStreak: Int
        let streakShields: Int
        enum CodingKeys: String, CodingKey {
            case xp
            case totalWins = "total_wins"
            case totalLosses = "total_losses"
            case currentStreak = "current_streak"
            case bestStreak = "best_streak"
            case level
            case lastPlayedAt = "last_played_at"
            case dailyLoginStreak = "daily_login_streak"
            case bestDailyLoginStreak = "best_daily_login_streak"
            case streakShields = "streak_shields"
        }
    }

    private struct ProfileUpdate: Encodable {
        let total_wins: Int, total_losses: Int
        let current_streak: Int, best_streak: Int
        let xp: Int, level: Int
        let last_played_at: String
        let daily_login_streak: Int, best_daily_login_streak: Int
        let streak_shields: Int
    }

    @discardableResult
    static func record(
        gameMode: GameMode,
        playType: String = "solo",
        won: Bool,
        guessCount: Int,
        timeSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        seed: String,
        hintsUsed: Int = 0
    ) async -> XpResult? {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return nil }
        let userId = session.user.id.uuidString
        let mode = gameMode.rawValue

        await updateUserStats(client, userId: userId, mode: mode, playType: playType,
                              won: won, guessCount: guessCount, timeSeconds: timeSeconds)
        let xp = await updateProfileProgression(client, userId: userId, won: won, seed: seed)

        var result = xp
        if isDailySeed(seed) {
            if playType == "vs" {
                // Daily Classic VS → daily_results (play_type='vs') so the player
                // shows on the VS daily leaderboard (web recordDailyVsResult parity).
                await DailyResultsService.recordVs(gameMode: gameMode, won: won)
            } else {
                await DailyResultsService.record(
                    gameMode: gameMode, completed: won, guessCount: guessCount,
                    timeSeconds: timeSeconds, boardsSolved: boardsSolved, totalBoards: totalBoards,
                    hintsUsed: hintsUsed
                )
                // Daily Sweep / Flawless bonus once all 9 dailies are in (web parity).
                // Fold the bonus into the XpResult so the post-game toast shows it.
                let bonus = await MedalService.awardDailyBonusesIfComplete(client, userId: userId)
                if bonus > 0, let x = result {
                    let newTotal = x.totalXp + bonus
                    result = XpResult(xpGain: x.xpGain, streakBonus: x.streakBonus,
                                      dailyBonus: x.dailyBonus + bonus, totalXp: newTotal,
                                      newLevel: newTotal / 1000 + 1,
                                      leveledUp: x.leveledUp || (newTotal / 1000 + 1) > x.newLevel)
                }
            }
        }
        // Refresh the in-memory profile so XP/streak/Pro reflect immediately.
        await AuthService.shared.refreshProfile()
        return result
    }

    private static func updateUserStats(
        _ client: SupabaseClient, userId: String, mode: String, playType: String,
        won: Bool, guessCount: Int, timeSeconds: Int
    ) async {
        do {
            let rows: [StatsRow] = try await client.from("user_stats")
                .select("id, wins, losses, total_games, best_score, average_time, fastest_time")
                .eq("user_id", value: userId).eq("game_mode", value: mode).eq("play_type", value: playType)
                .limit(1).execute().value

            if let s = rows.first {
                let newTotal = s.totalGames + 1
                let newAvg = s.averageTime > 0 ? Int((Double(s.averageTime * s.totalGames + timeSeconds) / Double(newTotal)).rounded()) : timeSeconds
                let newBest = (guessCount > 0 && (s.bestScore == 0 || guessCount < s.bestScore)) ? guessCount : s.bestScore
                let newFastest = (timeSeconds > 0 && (s.fastestTime == 0 || timeSeconds < s.fastestTime)) ? timeSeconds : s.fastestTime
                let upd = StatsUpdate(wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1),
                                      total_games: newTotal, best_score: newBest,
                                      average_time: newAvg, fastest_time: newFastest)
                try await client.from("user_stats").update(upd).eq("id", value: s.id).execute()
            } else {
                let ins = StatsInsert(user_id: userId, game_mode: mode, play_type: playType,
                                      wins: won ? 1 : 0, losses: won ? 0 : 1, total_games: 1,
                                      best_score: guessCount, average_time: timeSeconds, fastest_time: timeSeconds)
                try await client.from("user_stats").insert(ins).execute()
            }
        } catch { /* best-effort */ }
    }

    /// XP earned by a finished game — drives the post-game XP toast.
    struct XpResult {
        let xpGain: Int, streakBonus: Int, dailyBonus: Int
        let totalXp: Int, newLevel: Int, leveledUp: Bool
    }

    @discardableResult
    private static func updateProfileProgression(
        _ client: SupabaseClient, userId: String, won: Bool, seed: String
    ) async -> XpResult? {
        do {
            let rows: [ProfileRow] = try await client.from("profiles")
                .select("total_wins,total_losses,current_streak,best_streak,xp,level,last_played_at,daily_login_streak,best_daily_login_streak,streak_shields")
                .eq("id", value: userId).limit(1).execute().value
            guard let p = rows.first else { return nil }

            let newWinStreak = won ? p.currentStreak + 1 : 0
            let newBestWinStreak = max(p.bestStreak, newWinStreak)

            let xpGain = won ? 100 : 25
            let streakBonus = (won && newWinStreak > 1) ? 50 : 0
            let dailyBonus = isDailySeed(seed) ? 50 : 0
            let newXp = p.xp + xpGain + streakBonus + dailyBonus
            let newLevel = newXp / 1000 + 1

            // Daily-login streak (player-local days).
            let today = LeaderboardService.todayLocal()
            let yesterday = localDayString(daysAgo: 1)
            var newDailyStreak = p.dailyLoginStreak
            var grantShield = false
            if let last = p.lastPlayedAt, let lastDate = parseTimestamp(last) {
                let lastDay = localDayString(from: lastDate)
                if lastDay == today { /* same day, no change */ }
                else if lastDay == yesterday {
                    newDailyStreak += 1
                    if newDailyStreak % 7 == 0 { grantShield = true }
                } else { newDailyStreak = 1 }
            } else {
                newDailyStreak = 1
            }
            let newBestDaily = max(p.bestDailyLoginStreak, newDailyStreak)

            let upd = ProfileUpdate(
                total_wins: p.totalWins + (won ? 1 : 0),
                total_losses: p.totalLosses + (won ? 0 : 1),
                current_streak: newWinStreak, best_streak: newBestWinStreak,
                xp: newXp, level: newLevel,
                last_played_at: ISO8601DateFormatter().string(from: Date()),
                daily_login_streak: newDailyStreak, best_daily_login_streak: newBestDaily,
                streak_shields: p.streakShields + (grantShield ? 1 : 0)
            )
            try await client.from("profiles").update(upd).eq("id", value: userId).execute()
            return XpResult(xpGain: xpGain, streakBonus: streakBonus, dailyBonus: dailyBonus,
                            totalXp: xpGain + streakBonus + dailyBonus,
                            newLevel: newLevel, leveledUp: newLevel > (p.level ?? 1))
        } catch { return nil }
    }

    // MARK: - Local day helpers (match lib/daily-service.ts toLocalDayString)

    private static func localDayString(from date: Date = Date()) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        return f.string(from: date)
    }
    private static func localDayString(daysAgo: Int) -> String {
        localDayString(from: Calendar.current.date(byAdding: .day, value: -daysAgo, to: Date()) ?? Date())
    }
}
