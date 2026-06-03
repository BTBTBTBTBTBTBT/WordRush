import Foundation
import SocketIO

/// Always-on lightweight presence socket — the native counterpart to the web
/// `SitePresenceProvider`. Holds one Socket.IO connection while the app is
/// foregrounded so the signed-in user is counted in the server's `/presence`
/// total (what the home LIVE banner renders). Tagged with the SAME
/// `u:<userId>` presenceId the VS match socket uses (VSMatchViewModel), so the
/// server dedupes a person to 1 even while they're in a match. Kept separate
/// from VSMatchService so it never touches matchmaking state.
@MainActor
final class PresenceService {
    static let shared = PresenceService()
    private init() {}

    private var manager: SocketManager?
    private var socket: SocketIOClient?

    /// Matches web `getPresenceId()` + VSMatchViewModel: `u:<supabase-user-id>`.
    private var presenceId: String? {
        AuthService.shared.profile.map { "u:\($0.id)" }
    }

    /// Idempotent: no-ops if already connected or the user isn't loaded yet.
    func start() {
        guard socket == nil, VSConfig.isConfigured,
              let url = VSConfig.serverURL, let pid = presenceId else { return }
        let manager = SocketManager(socketURL: url, config: [
            .log(false), .compress, .reconnects(true), .reconnectWait(2), .reconnectWaitMax(10),
        ])
        self.manager = manager
        let socket = manager.defaultSocket
        self.socket = socket
        // No event handlers needed — the server counts the connection itself.
        socket.connect(withPayload: ["presenceId": pid])
    }

    func stop() {
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
    }
}
