import Foundation
import Supabase

/// Fire-and-forget share analytics → public.share_events (insert-only log; see
/// supabase/manual-migrations/20260722000001_share_events.sql).
///
/// Logged at the moment the user CHOOSES to share — the tap on a Share button
/// or a variant row in the chooser — never on render. Guests log with
/// user_id null (RLS allows anon inserts); signed-in users log as themselves.
///
/// `kind` (DB check constraint): 'text' | 'image' | 'link_invite' | 'other'.
/// The dual-share chooser's pick is encoded here — "Full results" → 'image',
/// "No spoilers" (colors only, the emoji-grid-style variant) → 'text'.
/// Invite links (VS private match / invite sheet) → 'link_invite'.
enum ShareEvents {
    private struct Insert: Encodable {
        let user_id: String?
        let platform: String
        let game_mode: String
        let kind: String
        let surface: String
    }

    /// Fire-and-forget: never blocks or surfaces errors to the share flow.
    static func log(kind: String, gameMode: String, surface: String) {
        Task {
            let client = AuthService.shared.client
            let uid = (try? await client.auth.session)?.user.id.uuidString
            try? await client.from("share_events").insert(Insert(
                user_id: uid,
                platform: "ios",
                game_mode: String(gameMode.prefix(32)),
                kind: kind,
                surface: String(surface.prefix(32)))).execute()
        }
    }
}
