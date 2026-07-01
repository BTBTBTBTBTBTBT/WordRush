import Foundation
import Supabase
import WordociousCore

struct AllTimeRecord: Identifiable, Decodable {
    let id: String
    let recordType: String
    let gameMode: String?
    let playType: String?
    let holderId: String
    let recordValue: Double
    let profiles: Ref

    struct Ref: Decodable {
        let username: String
        let avatarUrl: String?
        enum CodingKeys: String, CodingKey { case username; case avatarUrl = "avatar_url" }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case recordType = "record_type"
        case gameMode = "game_mode"
        case playType = "play_type"
        case holderId = "holder_id"
        case recordValue = "record_value"
        case profiles
    }

    var holderUsername: String { profiles.username }

    /// Formats the value per type — ported from RECORD_LABELS in app/records/page.tsx.
    var formattedValue: String {
        let v = Int(recordValue)
        switch recordType {
        case "fastest_win": return v < 60 ? "\(v)s" : "\(v / 60)m \(v % 60)s"
        case "fewest_guesses": return "\(v) guesses"
        case "most_games_played": return "\(v) games"
        case "longest_streak": return "\(v) wins"
        case "most_gold_medals": return "\(v) golds"
        case "highest_level": return "Level \(v)"
        case "most_daily_completions": return "\(v) dailies"
        default: return "\(v)"
        }
    }
}

/// Labels + the global/per-mode type lists, mirroring app/records/page.tsx.
enum RecordCatalog {
    static let labels: [String: (label: String, symbol: String)] = [
        "fastest_win": ("Fastest Win", "clock.fill"),
        "fewest_guesses": ("Fewest Guesses", "target"),
        "most_games_played": ("Most Games Played", "bolt.fill"),
        "longest_streak": ("Longest Streak", "flame.fill"),
        "most_gold_medals": ("Most Gold Medals", "crown.fill"),
        "highest_level": ("Highest Level", "trophy.fill"),
        "most_daily_completions": ("Most Dailies Completed", "target"),
    ]
    static let global = ["longest_streak", "highest_level", "most_gold_medals", "most_daily_completions"]
    static let perMode = ["fastest_win", "fewest_guesses", "most_games_played", "longest_streak"]
}

/// Reads the all-time "hall of records" — mirrors lib/daily-service.ts
/// fetchAllTimeRecords (all_time_records + profiles!inner join, ordered by type).
enum RecordsService {
    static func fetchAll() async throws -> [AllTimeRecord] {
        try await AuthService.shared.client
            .from("all_time_records")
            .select("id, record_type, game_mode, play_type, holder_id, record_value, profiles!inner(username, avatar_url)")
            .order("record_type")
            .execute()
            .value
    }

    // MARK: - Writing all-time records (web parity — previously deferred, bible §7)

    private struct RecordRow: Decodable { let id: String; let record_value: Double; let holder_id: String }
    private struct RecordInsert: Encodable {
        let record_type: String; let game_mode: String?; let play_type: String?
        let holder_id: String; let record_value: Double; let achieved_at: String; let updated_at: String
    }
    private struct RecordUpdate: Encodable {
        let holder_id: String; let record_value: Double; let updated_at: String; let achieved_at: String?
    }

    /// Compare a challenger value against the best existing record for
    /// (recordType, gameMode, playType) and update the canonical row / insert the
    /// first one. Fetch-then-update-by-id (like web `checkAndUpdateRecord`) so the
    /// NULL-unique global keys never accumulate duplicate rows. Best-effort.
    static func checkAndUpdateRecord(_ recordType: String, gameMode: String?, playType: String?,
                                     holderId: String, newValue: Int, higherIsBetter: Bool = true) async {
        let client = AuthService.shared.client
        do {
            var q: PostgrestFilterBuilder = client.from("all_time_records")
                .select("id, record_value, holder_id")
                .eq("record_type", value: recordType)
            q = gameMode != nil ? q.eq("game_mode", value: gameMode!) : q.is("game_mode", value: nil)
            q = playType != nil ? q.eq("play_type", value: playType!) : q.is("play_type", value: nil)
            let rows: [RecordRow] = try await q.order("record_value", ascending: !higherIsBetter).execute().value
            let best = rows.first
            let nv = Double(newValue)
            let challengerWins = best == nil ? true : (higherIsBetter ? nv > best!.record_value : nv < best!.record_value)
            let winnerValue = challengerWins ? nv : best!.record_value
            let winnerHolder = challengerWins ? holderId : best!.holder_id
            let now = ISO8601DateFormatter().string(from: Date())
            if let b = best {
                try await client.from("all_time_records").update(RecordUpdate(
                    holder_id: winnerHolder, record_value: winnerValue, updated_at: now,
                    achieved_at: challengerWins ? now : nil)).eq("id", value: b.id).execute()
            } else {
                try await client.from("all_time_records").insert(RecordInsert(
                    record_type: recordType, game_mode: gameMode, play_type: playType,
                    holder_id: winnerHolder, record_value: winnerValue, achieved_at: now, updated_at: now)).execute()
            }
        } catch { /* best-effort */ }
    }

    /// Run every post-game record check (web stats-service.ts parity). Call AFTER
    /// user_stats / profiles are updated so the fresh totals are readable.
    static func updateAfterGame(userId: String, gameMode: String, playType: String,
                                won: Bool, guessCount: Int, timeSeconds: Int, seed: String) async {
        let client = AuthService.shared.client

        if won && timeSeconds > 0 {
            await checkAndUpdateRecord("fastest_win", gameMode: gameMode, playType: playType, holderId: userId, newValue: timeSeconds, higherIsBetter: false)
        }
        if won && guessCount > 0 {
            await checkAndUpdateRecord("fewest_guesses", gameMode: gameMode, playType: playType, holderId: userId, newValue: guessCount, higherIsBetter: false)
        }

        struct TG: Decodable { let total_games: Int }
        if let tg: [TG] = try? await client.from("user_stats").select("total_games")
            .eq("user_id", value: userId).eq("game_mode", value: gameMode).eq("play_type", value: playType)
            .limit(1).execute().value, let g = tg.first?.total_games, g > 0 {
            await checkAndUpdateRecord("most_games_played", gameMode: gameMode, playType: playType, holderId: userId, newValue: g)
        }

        struct PR: Decodable { let best_streak: Int; let xp: Int; let gold_medals: Int? }
        if let pr: [PR] = try? await client.from("profiles").select("best_streak, xp, gold_medals")
            .eq("id", value: userId).limit(1).execute().value, let p = pr.first {
            if p.best_streak > 0 {
                await checkAndUpdateRecord("longest_streak", gameMode: nil, playType: nil, holderId: userId, newValue: p.best_streak)
            }
            await checkAndUpdateRecord("highest_level", gameMode: nil, playType: nil, holderId: userId, newValue: p.xp / 1000 + 1)
            if let gm = p.gold_medals, gm > 0 {
                await checkAndUpdateRecord("most_gold_medals", gameMode: nil, playType: nil, holderId: userId, newValue: gm)
            }
        }

        if isDailySeed(seed) {
            let c = (try? await client.from("daily_results").select("*", head: true, count: .exact)
                .eq("user_id", value: userId).eq("completed", value: true).execute().count) ?? 0
            if c > 0 {
                await checkAndUpdateRecord("most_daily_completions", gameMode: nil, playType: nil, holderId: userId, newValue: c)
            }
        }
    }
}
