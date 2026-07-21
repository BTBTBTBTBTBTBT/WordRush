import Foundation
import Supabase

/// User-generated-content moderation (App Review 1.2): report + block.
/// Backed by the `reports` (insert-only) and `blocks` (own-rows) tables from
/// manual-migration 20260721000001_prelaunch_hardening.sql.
///
/// Blocked ids are cached in-memory per launch and applied as a client-side
/// filter wherever strangers' usernames render (leaderboards, records).
enum ModerationService {
    private struct ReportInsert: Encodable {
        let reporter_id: String
        let reported_user_id: String
        let reason: String
        let context: String
    }
    private struct BlockInsert: Encodable {
        let blocker_id: String
        let blocked_id: String
    }
    private struct BlockRow: Decodable { let blocked_id: String }

    /// In-memory cache of who the signed-in user has blocked. Loaded lazily,
    /// updated optimistically on block/unblock.
    private(set) static var blockedIds: Set<String> = []
    private static var loaded = false

    @discardableResult
    static func report(userId: String, reason: String, context: String) async -> Bool {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return false }
        do {
            try await client.from("reports").insert(ReportInsert(
                reporter_id: session.user.id.uuidString,
                reported_user_id: userId,
                reason: String(reason.prefix(500)),
                context: String(context.prefix(200)))).execute()
            return true
        } catch { return false }
    }

    @discardableResult
    static func block(userId: String) async -> Bool {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return false }
        blockedIds.insert(userId.lowercased())
        do {
            try await client.from("blocks").insert(BlockInsert(
                blocker_id: session.user.id.uuidString,
                blocked_id: userId)).execute()
            return true
        } catch { return true /* optimistic: duplicate PK = already blocked */ }
    }

    static func unblock(userId: String) async {
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        blockedIds.remove(userId.lowercased())
        try? await client.from("blocks").delete()
            .eq("blocker_id", value: session.user.id.uuidString)
            .eq("blocked_id", value: userId).execute()
    }

    /// Load (once per launch) the signed-in user's block list.
    static func loadBlockedIds() async {
        if loaded { return }
        let client = AuthService.shared.client
        guard let session = try? await client.auth.session else { return }
        do {
            let rows: [BlockRow] = try await client.from("blocks")
                .select("blocked_id")
                .eq("blocker_id", value: session.user.id.uuidString)
                .execute().value
            blockedIds = Set(rows.map { $0.blocked_id.lowercased() })
            loaded = true
        } catch { /* retry next call */ }
    }

    static func isBlocked(_ userId: String) -> Bool {
        blockedIds.contains(userId.lowercased())
    }
}
