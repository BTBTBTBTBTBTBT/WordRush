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

    /// Returns true when the URL is ours and was consumed (so the caller can
    /// skip handing it to other URL handlers like GoogleSignIn).
    func handle(url: URL) -> Bool {
        guard let host = url.host?.lowercased(),
              host == "wordocious.com" || host == "www.wordocious.com" else { return false }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count == 3, parts[0] == "vs", parts[1] == "join" else { return false }
        let code = parts[2].uppercased()

        Task {
            // Same resolution path as the lobby's join-by-code field.
            if let mode = await InviteService.lookupMode(code: code) {
                self.vsInvite = VSInviteLink(mode: mode, code: code)
            }
        }
        return true
    }
}
