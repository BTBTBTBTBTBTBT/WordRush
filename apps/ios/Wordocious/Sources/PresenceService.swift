import Foundation
import SwiftUI
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

    // MARK: Friends "On now" (Friends overhaul §1, founder 2026-10-01)

    /// The 60 s foreground heartbeat: profiles.last_seen_at = now and
    /// last_activity = the db key of the game on screen (or null).
    private var heartbeat: Task<Void, Never>?
    /// The db key of the game on screen (DUEL, SCRAMBLE…), nil off a game.
    private(set) var activity: String?

    /// A game screen appeared — stamp it right away (spec: "also update
    /// immediately on entering/leaving a game").
    func enterActivity(_ key: String) {
        guard activity != key else { return }
        activity = key
        beat()
    }

    /// A game screen left — clear it unless another game already replaced it.
    func leaveActivity(_ key: String) {
        guard activity == key else { return }
        activity = nil
        beat()
    }

    private func startHeartbeat() {
        guard heartbeat == nil, AuthService.shared.profile != nil else { return }
        heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                self?.beat()
                try? await Task.sleep(nanoseconds: 60_000_000_000)
            }
        }
        // Back in the foreground: the YOUR TURN list and the tab badge refresh too.
        Task { await FriendlyGamesService.load() }
    }

    /// One heartbeat write. The column only takes `^[A-Za-z0-9_]{1,24}$` (a key, never text).
    private func beat() {
        guard heartbeat != nil, let uid = AuthService.shared.profile?.id else { return }
        let key = activity.flatMap { k in
            k.count <= 24 && !k.isEmpty && k.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_") }) ? k : nil
        }
        struct Beat: Encodable {
            let last_seen_at: String
            let last_activity: String?
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(last_seen_at, forKey: .last_seen_at)
                try c.encode(last_activity, forKey: .last_activity)   // null clears it
            }
            enum CodingKeys: String, CodingKey { case last_seen_at, last_activity }
        }
        let row = Beat(last_seen_at: ISO8601DateFormatter().string(from: Date()), last_activity: key)
        Task {
            _ = try? await AuthService.shared.client.from("profiles").update(row).eq("id", value: uid).execute()
        }
    }

    /// Idempotent: no-ops if already connected or the user isn't loaded yet.
    func start() {
        startHeartbeat()
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
        heartbeat?.cancel()
        heartbeat = nil
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
    }
}

/// Marks the game on screen for the Friends "On now · in <game>" line.
private struct PresenceActivityModifier: ViewModifier {
    let key: String
    func body(content: Content) -> some View {
        content
            .onAppear { PresenceService.shared.enterActivity(key) }
            .onDisappear { PresenceService.shared.leaveActivity(key) }
    }
}

extension View {
    /// The db key of the game this screen plays (DUEL, SCRAMBLE…).
    func presenceActivity(_ key: String) -> some View { modifier(PresenceActivityModifier(key: key)) }
}
