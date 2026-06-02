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
    private struct InviteInsertTargeted: Encodable {
        let inviter_id: String; let invitee_id: String?; let invite_code: String; let game_mode: String
    }
    private struct InviteRow: Decodable { let game_mode: String }
    private struct ProfileIdRow: Decodable { let id: String }
    private struct AcceptUpdate: Encodable {
        let status: String; let accepted_at: String; let match_id: String?
    }

    /// Result of the home Invite modal — a shareable code or a user-facing error.
    struct InviteResult { let code: String?; let error: String? }

    /// Create an invite, optionally targeted at a username (ports the web
    /// createInvite). A username is resolved to a profile id stored in
    /// `invitee_id` so that user sees it in their pending-invites badge; an
    /// empty username makes a public-link invite anyone can redeem.
    static func createInvite(gameMode: GameMode, inviteeUsername: String?) async -> InviteResult {
        let client = AuthService.shared.client
        guard let uid = (try? await client.auth.session.user.id.uuidString)?.lowercased() else {
            return InviteResult(code: nil, error: "You're not signed in")
        }
        var inviteeId: String?
        if let uname = inviteeUsername, !uname.isEmpty {
            let row: ProfileIdRow? = try? await client.from("profiles")
                .select("id").ilike("username", pattern: uname).limit(1).single().execute().value
            guard let row else { return InviteResult(code: nil, error: "User not found") }
            if row.id.lowercased() == uid { return InviteResult(code: nil, error: "You can't invite yourself") }
            inviteeId = row.id
        }
        for _ in 0..<3 {
            let code = generateCode()
            do {
                try await client.from("match_invites")
                    .insert(InviteInsertTargeted(inviter_id: uid, invitee_id: inviteeId, invite_code: code, game_mode: gameMode.rawValue))
                    .execute()
                return InviteResult(code: code, error: nil)
            } catch { continue }
        }
        return InviteResult(code: nil, error: "Could not generate a unique code")
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

    /// A pending invite targeted at the current user (powers the home banner).
    struct PendingInvite: Decodable, Identifiable {
        let id: String
        let inviter_id: String
        let invite_code: String
        let game_mode: String
    }

    /// Invites sent TO this user that are still pending + unexpired — ports
    /// fetchPendingInvitesForUser.
    static func fetchPending(userId: String) async -> [PendingInvite] {
        let now = ISO8601DateFormatter().string(from: Date())
        return (try? await AuthService.shared.client.from("match_invites")
            .select("id,inviter_id,invite_code,game_mode")
            .eq("invitee_id", value: userId)
            .eq("status", value: "pending")
            .gt("expires_at", value: now)
            .order("created_at", ascending: false)
            .execute().value) ?? []
    }

    /// The inviter's display name for the banner.
    static func inviterUsername(_ inviterId: String) async -> String? {
        struct Row: Decodable { let username: String? }
        let row: Row? = try? await AuthService.shared.client.from("profiles")
            .select("username").eq("id", value: inviterId).limit(1).single().execute().value
        return row?.username
    }

    /// Decline an invite (dismiss from the banner).
    static func decline(inviteId: String) async {
        struct DeclineUpdate: Encodable { let status: String }
        try? await AuthService.shared.client.from("match_invites")
            .update(DeclineUpdate(status: "declined")).eq("id", value: inviteId).execute()
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
