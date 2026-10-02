import Foundation
import SwiftUI
import WordociousCore

/// Universal-link router (applinks:wordocious.com — see Wordocious.entitlements
/// and apps/web/public/.well-known/apple-app-site-association).
///
/// Push urls route here too (PushRegistration): /friends/games/<id> opens a
/// Friends pocket game, /friends the Friends tab (no universal link needed).
///
/// v1 claims /vs/join/<code> and (VS overhaul, 2026-10-01) /vs/challenge/<code>:
/// a VS invite's or challenge's recipient usually has the app,
/// so opening it natively beats Safari. Referral links (/join/<code>) are
/// deliberately NOT claimed — their audience is brand-new users without the
/// app, and redemption is a web flow; claiming them would strand invitees on
/// an app screen with no signup-attribution path.
///
/// The pending invite survives an auth gate: state is set immediately on link
/// receipt, and RootTabView's cover presents it whenever the tab shell is
/// (or becomes) on screen.
@MainActor
final class DeepLink: ObservableObject {
    static let shared = DeepLink()

    struct VSInviteLink: Identifiable {
        let id = UUID()
        let mode: GameMode
        let code: String
    }

    @Published var vsInvite: VSInviteLink?

    /// An async "race my run" challenge (/vs/challenge/<code>, from a link or a push).
    struct VSChallengeLink: Identifiable {
        let id = UUID()
        let code: String
    }
    @Published var vsChallenge: VSChallengeLink?

    /// "Someone's looking for a <Mode> match" (/vs/live/<MODE>, spec §13 push):
    /// straight into that mode's live search, like LIVE in the lobby.
    struct VSLiveLink: Identifiable {
        let id = UUID()
        let mode: GameMode
    }
    @Published var vsLive: VSLiveLink?
    /// A pocket game with a friend (/friends/games/<id>, the push url): the game screen.
    struct FriendlyGameLink: Identifiable {
        let id: String
    }
    @Published var friendlyGame: FriendlyGameLink?
    /// "/friends" (a reaction push): land on the Friends tab. A fresh id per request.
    @Published var friendsRequest: UUID?
    /// A widget tap: open TODAY'S daily for this mode (wordocious://daily/<MODE>).
    @Published var dailyMode: GameMode?
    /// "Show me the More Games" (wordocious://puzzles, legacy wordocious://more):
    /// the More Games sheet is gone (home redesign, founder 2026-10-01), so Home
    /// scrolls to its PUZZLES section instead. A fresh id per request.
    @Published var puzzlesRequest: UUID?
    /// A recovery link was consumed and a session established — show the
    /// native "set a new password" sheet.
    @Published var showNewPasswordSheet = false
    /// PKCE fallback: the auth link was requested by a DIFFERENT client (e.g.
    /// reset started on desktop, tapped on phone) so the in-app exchange can't
    /// work — finish in an in-app Safari sheet on the web page instead.
    @Published var safariFallbackURL: URL?

    /// Returns true when the URL is ours and was consumed (so the caller can
    /// skip handing it to other URL handlers like GoogleSignIn).
    func handle(url: URL) -> Bool {
        // Widget deep link: wordocious://daily/<GameMode.rawValue>. The custom
        // scheme exists ONLY for the widget — everything user-facing stays on
        // universal links. Set state and let HomeView launch the daily.
        if url.scheme == "wordocious", ["puzzles", "more"].contains(url.host?.lowercased() ?? "") {
            puzzlesRequest = UUID()
            return true
        }
        if url.scheme == "wordocious", url.host?.lowercased() == "daily",
           let key = url.pathComponents.filter({ $0 != "/" }).first,
           let mode = GameMode(rawValue: key.uppercased()) {
            dailyMode = mode
            return true
        }
        guard let host = url.host?.lowercased(),
              host == "wordocious.com" || host == "www.wordocious.com" else { return false }
        let parts = url.pathComponents.filter { $0 != "/" }

        // VS invite: wordocious.com/vs/join/<code>
        if parts.count == 3, parts[0] == "vs", parts[1] == "join" {
            let code = parts[2].uppercased()
            Task {
                // Same resolution path as the lobby's join-by-code field.
                if let mode = await InviteService.lookupMode(code: code) {
                    self.vsInvite = VSInviteLink(mode: mode, code: code)
                }
            }
            return true
        }

        // VS challenge: wordocious.com/vs/challenge/<code> → the race flow.
        if parts.count == 3, parts[0] == "vs", parts[1] == "challenge" {
            vsChallenge = VSChallengeLink(code: parts[2].uppercased())
            return true
        }

        // VS live ping: wordocious.com/vs/live/<MODE> → that mode's live search.
        if parts.count == 3, parts[0] == "vs", parts[1] == "live" {
            if let mode = GameMode(rawValue: parts[2].uppercased()) { vsLive = VSLiveLink(mode: mode) }
            return true
        }

        // Friends pocket game (push url /friends/games/<id>) → its game screen.
        if parts.count == 3, parts[0] == "friends", parts[1] == "games" {
            friendlyGame = FriendlyGameLink(id: parts[2])
            return true
        }
        // A Friends push (/friends) → the Friends tab.
        if parts.count == 1, parts[0] == "friends" {
            friendsRequest = UUID()
            return true
        }

        // Auth links: /auth/reset (password recovery) and /auth/confirm
        // (email confirmation). session(from:) exchanges the one-time code —
        // this works when THIS device requested the email (PKCE verifier is
        // in local auth storage). Cross-device links fall back to Safari.
        if parts.count == 2, parts[0] == "auth", parts[1] == "reset" || parts[1] == "confirm" {
            let isReset = parts[1] == "reset"
            Task {
                do {
                    _ = try await AuthService.shared.client.auth.session(from: url)
                    if isReset { self.showNewPasswordSheet = true }
                    // Confirm: the auth-state listener picks up the fresh
                    // session and the app lands signed in — nothing to show.
                } catch {
                    self.safariFallbackURL = url
                }
            }
            return true
        }

        return false
    }

    /// A push's `url` payload ("/vs/challenge/AB12CD34", "/vs/live/DUEL") routed like a universal link.
    @discardableResult
    func handle(pushPath path: String) -> Bool {
        let full = path.hasPrefix("/") ? "https://wordocious.com\(path)" : path
        guard let url = URL(string: full) else { return false }
        return handle(url: url)
    }
}
