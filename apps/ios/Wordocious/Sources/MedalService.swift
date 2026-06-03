import Foundation
import Supabase

/// Client-side daily reward awarding — 1:1 port of the web's
/// checkAndAwardStreakMedals / checkAndAwardPerfectMedal /
/// awardDailyBonusesIfComplete (apps/web/lib/daily-service.ts). The daily
/// TOP-3 podium medals are awarded by a separate server cron
/// (apps/web/app/api/cron/daily-medals), so they already apply to native; only
/// these three were web-client-only and missing on native.
enum MedalService {
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
                try? await client.from("medals").insert(MedalInsert(
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
        try? await client.from("medals").insert(MedalInsert(
            user_id: userId, day: day, game_mode: gameMode, play_type: "solo",
            medal_type: "perfect", composite_score: guessCount)).execute()
    }

    /// Daily Sweep (+200 XP) / Flawless (+400 XP) bonuses, awarded once when all
    /// 9 daily solo results exist. Adds the XP to the profile and returns the
    /// bonus amount (0 = nothing awarded) so the caller can fold it into the toast.
    static func awardDailyBonusesIfComplete(_ client: SupabaseClient, userId: String) async -> Int {
        let day = LeaderboardService.todayLocal()
        struct B: Decodable { let sweep_awarded: Bool?; let flawless_awarded: Bool? }
        let existingRows: [B] = (try? await client.from("daily_bonuses")
            .select("sweep_awarded, flawless_awarded").eq("user_id", value: userId)
            .eq("day", value: day).limit(1).execute().value) ?? []
        let sweepAlready = existingRows.first?.sweep_awarded ?? false
        let flawlessAlready = existingRows.first?.flawless_awarded ?? false
        if sweepAlready && flawlessAlready { return 0 }

        struct R: Decodable { let completed: Bool }
        guard let results: [R] = try? await client.from("daily_results")
            .select("completed").eq("user_id", value: userId).eq("day", value: day)
            .eq("play_type", value: "solo").execute().value, results.count >= 9 else { return 0 }

        let wonAll = results.allSatisfy { $0.completed }
        let sweepNew = !sweepAlready
        let flawlessNew = wonAll && !flawlessAlready
        var bonus = 0
        if sweepNew { bonus += 200 }
        if flawlessNew { bonus += 400 }
        guard bonus > 0 else { return 0 }

        struct BonusUpsert: Encodable { let user_id, day: String; let sweep_awarded, flawless_awarded: Bool; let updated_at: String }
        try? await client.from("daily_bonuses").upsert(BonusUpsert(
            user_id: userId, day: day, sweep_awarded: sweepAlready || sweepNew,
            flawless_awarded: flawlessAlready || flawlessNew,
            updated_at: ISO8601DateFormatter().string(from: Date())), onConflict: "user_id,day").execute()

        struct PR: Decodable { let xp: Int?; let level: Int? }
        struct XpUpd: Encodable { let xp: Int; let level: Int }
        if let prof: [PR] = try? await client.from("profiles")
            .select("xp, level").eq("id", value: userId).limit(1).execute().value, let cur = prof.first {
            let newXp = (cur.xp ?? 0) + bonus
            try? await client.from("profiles").update(XpUpd(xp: newXp, level: newXp / 1000 + 1))
                .eq("id", value: userId).execute()
        }
        return bonus
    }
}
