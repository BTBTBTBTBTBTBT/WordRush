import Foundation
import Supabase

/// Client-side daily reward awarding — 1:1 port of the web's
/// checkAndAwardStreakMedals / checkAndAwardPerfectMedal /
/// awardDailyBonusesIfComplete (apps/web/lib/daily-service.ts). The daily
/// TOP-3 podium medals are awarded by a separate server cron
/// (apps/web/app/api/cron/daily-medals), so they already apply to native; only
/// these three were web-client-only and missing on native.
enum MedalService {
    /// The number of solo daily modes a full sweep requires. Keep in sync with
    /// web daily-service.ts DAILY_MODE_COUNT and Android MedalService.kt — a
    /// hardcoded 9 here silently broke sweep detection when the mode count
    /// changed on only two of the three platforms.
    static let dailyModeCount = 9

    private struct MedalInsert: Encodable {
        let user_id, day, game_mode, play_type, medal_type: String
        let composite_score: Int
    }
    private struct IdRow: Decodable { let id: String }

    /// Streak-milestone medals (7 / 30 / 100 day daily-login streak), once ever.
    static func awardStreakMedals(_ client: SupabaseClient, userId: String, day: String) async {
        struct P: Decodable { let daily_login_streak: Int? }
        guard let rows: [P] = try? await client.from("profiles")
            .select("daily_login_streak").eq("id", value: userId).limit(1).execute().value,
            let streak = rows.first?.daily_login_streak else { return }

        let milestones: [(days: Int, type: String)] = [(7, "streak_7"), (30, "streak_30"), (100, "streak_100")]
        for m in milestones where streak >= m.days {
            let existing: [IdRow] = (try? await client.from("medals")
                .select("id").eq("user_id", value: userId).eq("medal_type", value: m.type)
                .limit(1).execute().value) ?? []
            if existing.isEmpty {
                _ = try? await client.from("medals").insert(MedalInsert(
                    user_id: userId, day: day, game_mode: "ALL", play_type: "solo",
                    medal_type: m.type, composite_score: streak)).execute()
            }
        }
    }

    /// Perfect-game medal (per-mode minimum) — once per day+mode.
    static func awardPerfectMedal(_ client: SupabaseClient, userId: String, gameMode: String,
                                  day: String, guessCount: Int, boardsSolved: Int,
                                  totalBoards: Int, completed: Bool) async {
        guard completed else { return }
        let perfect: Bool
        switch gameMode {
        case "DUEL", "PROPERNOUNDLE", "DUEL_6", "DUEL_7": perfect = guessCount == 1
        case "QUORDLE":  perfect = boardsSolved == 4 && guessCount <= 4
        case "OCTORDLE": perfect = boardsSolved == 8 && guessCount <= 8
        case "SEQUENCE": perfect = boardsSolved == 4 && guessCount <= 4
        case "RESCUE":   perfect = boardsSolved == 4 && guessCount <= 4
        case "GAUNTLET": perfect = boardsSolved == 21
        default: perfect = false
        }
        guard perfect else { return }
        let existing: [IdRow] = (try? await client.from("medals")
            .select("id").eq("user_id", value: userId).eq("day", value: day)
            .eq("game_mode", value: gameMode).eq("medal_type", value: "perfect")
            .limit(1).execute().value) ?? []
        guard existing.isEmpty else { return }
        _ = try? await client.from("medals").insert(MedalInsert(
            user_id: userId, day: day, game_mode: gameMode, play_type: "solo",
            medal_type: "perfect", composite_score: guessCount)).execute()
    }

    /// Daily Sweep (+200 XP) / Flawless (+400 XP) bonuses, awarded once when all
    /// 9 daily solo results exist. Adds the XP to the profile and returns the
    /// (sweep, flawless) split so the XP toast can render the distinct
    /// "+200 sweep" / "+400 flawless" chips (web xp-toast.tsx parity).
    static func awardDailyBonusesIfComplete(_ client: SupabaseClient, userId: String) async -> (sweep: Int, flawless: Int) {
        // Delegated to wordocious.com/api/daily/award-bonuses. The app used to
        // write the daily_bonuses row itself, but that row IS the all-time
        // sweep leaderboard (alltime_sweep_leaderboard counts rows with
        // sweep_awarded = true), so a client able to write the flag could award
        // itself sweeps for days it never played. The server recomputes the
        // award from daily_results and grants the XP.
        let day = LeaderboardService.todayLocal()
        guard let token = try? await client.auth.session.accessToken,
              let url = URL(string: "https://wordocious.com/api/daily/award-bonuses")
        else { return (0, 0) }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["day": day])

        struct AwardResponse: Decodable {
            let awarded: Bool?
            let sweepAwarded: Bool?
            let flawlessAwarded: Bool?
        }
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let res = try? JSONDecoder().decode(AwardResponse.self, from: data),
              res.awarded == true
        else { return (0, 0) }

        // XP values stay client-side ONLY to size the toast chips; the profile
        // XP itself was already written by the server.
        return (res.sweepAwarded == true ? 200 : 0,
                res.flawlessAwarded == true ? 400 : 0)
    }
}
