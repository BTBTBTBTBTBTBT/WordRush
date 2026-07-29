import Foundation
import SwiftUI
import WordociousCore

/// Universal-link router (applinks:wordocious.com — see Wordocious.entitlements
/// and apps/web/public/.well-known/apple-app-site-association).
///
/// v1 claims ONLY /vs/join/<code>: a VS invite's recipient usually has the app,
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
}
