import Foundation
import Supabase

/// All-time head-to-head record + minimal opponent profile for the VS
/// intro/header/result UI — ports apps/web/lib/head-to-head.ts.
struct HeadToHeadRecord: Equatable {
    var myWins = 0
    var theirWins = 0
    var draws = 0
}

/// Minimal public profile bits needed by the VS intro/header/result UI.
struct VsProfile: Equatable {
    let username: String
    let avatarUrl: String?
    let level: Int
}

enum HeadToHeadService {
    private struct MatchRow: Decodable {
        let player1_id: String
        let player2_id: String?
        let winner_id: String?
    }

    /// All-time head-to-head record between two players, counted from the
    /// `matches` table (rows where the two ids occupy player1/player2 in
    /// either order). A draw is a VS row (player2_id set) with no winner_id.
    static func fetchHeadToHead(myId: String, opponentId: String) async -> HeadToHeadRecord {
        let rows: [MatchRow] = (try? await AuthService.shared.client.from("matches")
            .select("player1_id, player2_id, winner_id")
            .or("and(player1_id.eq.\(myId),player2_id.eq.\(opponentId)),and(player1_id.eq.\(opponentId),player2_id.eq.\(myId))")
            .limit(1000)
            .execute().value) ?? []

        var record = HeadToHeadRecord()
        for row in rows {
            if row.winner_id == myId { record.myWins += 1 }
            else if row.winner_id == opponentId { record.theirWins += 1 }
            else if row.player2_id != nil { record.draws += 1 }
        }
        return record
    }

    private struct ProfileBits: Decodable {
        let username: String?
        let avatar_url: String?
        let level: Int?
    }

    /// Minimal public profile for the VS UI — ports fetchVsProfile.
    static func fetchVsProfile(userId: String) async -> VsProfile? {
        let rows: [ProfileBits] = (try? await AuthService.shared.client.from("profiles")
            .select("username, avatar_url, level")
            .eq("id", value: userId)
            .limit(1)
            .execute().value) ?? []
        guard let row = rows.first else { return nil }
        return VsProfile(username: row.username ?? "Player", avatarUrl: row.avatar_url, level: row.level ?? 1)
    }

    /// "You lead 3–1" / "<name> leads 2–1" / "Tied 1–1" / "First meeting!" —
    /// ports match-intro.tsx headToHeadLine.
    static func headToHeadLine(opponentName: String, _ h2h: HeadToHeadRecord) -> String {
        if h2h.myWins == 0 && h2h.theirWins == 0 && h2h.draws == 0 { return "First meeting!" }
        if h2h.myWins > h2h.theirWins { return "You lead \(h2h.myWins)–\(h2h.theirWins)" }
        if h2h.theirWins > h2h.myWins { return "\(opponentName) leads \(h2h.theirWins)–\(h2h.myWins)" }
        return "Tied \(h2h.myWins)–\(h2h.theirWins)"
    }
}
