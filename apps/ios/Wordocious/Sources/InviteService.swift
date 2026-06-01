import Foundation
import WordociousCore

/// Private-match invites — ports apps/web/lib/invite-service.ts. The socket
/// server pairs two clients purely on the `invite_code` string they pass to
/// join_queue; the `match_invites` row carries the game_mode so the joiner
/// knows which mode to launch (and powers cross-client web↔native invites).
enum InviteService {
    private static let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") // no 0/O/1/I/l

    static func generateCode(length: Int = 8) -> String {
        String((0..<length).map { _ in alphabet[Int.random(in: 0..<alphabet.count)] })
    }

    private struct InviteInsert: Encodable {
        let inviter_id: String; let invite_code: String; let game_mode: String
    }
    private struct InviteRow: Decodable { let game_mode: String }
    private struct AcceptUpdate: Encodable {
        let status: String; let accepted_at: String; let match_id: String?
    }

    /// Create an invite for a mode; returns the shareable code (nil on failure).
    /// Tries a few times on the unlikely unique-code collision.
    static func createInvite(gameMode: GameMode) async -> String? {
        let client = AuthService.shared.client
        guard let userId = try? await client.auth.session.user.id.uuidString else { return nil }
        for _ in 0..<3 {
            let code = generateCode()
            do {
                try await client.from("match_invites")
                    .insert(InviteInsert(inviter_id: userId, invite_code: code, game_mode: gameMode.rawValue))
                    .execute()
                return code
            } catch { continue }
        }
        return nil
    }

    /// Look up the mode for an invite code (so the joiner launches the right mode).
    static func lookupMode(code: String) async -> GameMode? {
        let client = AuthService.shared.client
        let row: InviteRow? = try? await client.from("match_invites")
            .select("game_mode")
            .eq("invite_code", value: code)
            .limit(1).single()
            .execute().value
        return row.flatMap { GameMode(rawValue: $0.game_mode) }
    }

    /// Flip the pending invite to accepted once the server pairs both sides.
    static func markAccepted(code: String, matchId: String?) async {
        let client = AuthService.shared.client
        let iso = ISO8601DateFormatter().string(from: Date())
        try? await client.from("match_invites")
            .update(AcceptUpdate(status: "accepted", accepted_at: iso, match_id: matchId))
            .eq("invite_code", value: code)
            .eq("status", value: "pending")
            .execute()
    }
}
