import Foundation
import Supabase
import WordociousCore

/// Live pocket games, iOS client (FRIDAY-QUEUE 9b; rules in Core/FriendlyLive.swift, TS twin
/// packages/core/src/friendly-live.ts). One Realtime channel per game:
///  - broadcast "move": the server sends the accepted move's view the instant it is saved
///  - postgres_changes on friendly_game_pings: the backup, it only says "refetch"
///  - presence: the friend is in the game / has left
///  - broadcast "react": live emoji from the fixed reaction set
/// The screen owns one of these while a game is open and `FriendlyLive.switchKey` is live.
/// Off, or the socket down: the screen's poll carries everything (FriendlyLive.pollIntervalMs).
@MainActor
final class FriendlyLiveChannel: ObservableObject {
    @Published private(set) var socketUp = false
    @Published private(set) var peerPresent = false
    @Published private(set) var peerEverSeen = false

    /// A view broadcast for ME (already the receiver's view; my own are filtered out).
    var onView: ((FriendlyGameView) -> Void)?
    /// The backup ping fired, or the socket just (re)connected: refetch through the API.
    var onRefetch: (() -> Void)?
    var onReaction: ((String) -> Void)?

    private var channel: RealtimeChannelV2?
    private var tasks: [Task<Void, Never>] = []
    private var myId = ""
    private var oppId = ""
    private var gameId = ""
    private var lastReact = Date.distantPast

    var isStarted: Bool { channel != nil }

    func start(gameId: String, userId: String, opponentId: String) {
        stop()
        self.gameId = gameId
        myId = userId.lowercased()
        oppId = opponentId.lowercased()
        let me = myId
        let ch = AuthService.shared.client.realtimeV2.channel(FriendlyLive.topic(gameId)) { cfg in
            cfg.broadcast.receiveOwnBroadcasts = false
            cfg.presence.key = me
        }
        channel = ch

        // Register every listener BEFORE subscribing (supabase-swift requirement).
        let moves = ch.broadcastStream(event: FriendlyLive.eventMove)
        let reacts = ch.broadcastStream(event: FriendlyLive.eventReact)
        let pings = ch.postgresChange(AnyAction.self, schema: "public", table: FriendlyLive.pingTable, filter: "game_id=eq.\(gameId)")
        let presence = ch.presenceChange()
        let status = ch.statusChange

        tasks = [
            Task { [weak self] in for await m in moves { self?.handleMove(m) } },
            Task { [weak self] in for await m in reacts { self?.handleReaction(m) } },
            Task { [weak self] in for await _ in pings { self?.onRefetch?() } },
            Task { [weak self] in for await p in presence { self?.handlePresence(p) } },
            Task { [weak self] in
                for await s in status {
                    guard let self else { return }
                    switch s {
                    case .subscribed:
                        self.socketUp = true
                        await ch.track(state: ["thinking": false])
                        self.onRefetch?()   // catch up on anything missed while connecting
                    case .unsubscribed:
                        self.socketUp = false
                    default:
                        break
                    }
                }
            },
            Task { await ch.subscribe() },
        ]
    }

    func stop() {
        tasks.forEach { $0.cancel() }
        tasks = []
        if let ch = channel {
            Task { await ch.unsubscribe(); await AuthService.shared.client.realtimeV2.removeChannel(ch) }
        }
        channel = nil
        socketUp = false
        peerPresent = false
        peerEverSeen = false
    }

    /// Send a live reaction (throttled). True if it went out.
    @discardableResult
    func sendReaction(_ key: String) -> Bool {
        guard let ch = channel, socketUp, FriendlyLive.isReaction(key),
              Date().timeIntervalSince(lastReact) * 1000 >= Double(FriendlyLive.reactCooldownMs) else { return false }
        lastReact = Date()
        let me = myId
        Task { await ch.broadcast(event: FriendlyLive.eventReact, message: ["from": .string(me), "reaction": .string(key)]) }
        return true
    }

    // MARK: Incoming

    private func handleMove(_ message: JSONObject) {
        guard let p = message["payload"]?.objectValue,
              p["by"]?.stringValue?.lowercased() != myId,
              let game = p["game"],
              let data = try? JSONEncoder().encode(game),
              let view = try? JSONDecoder().decode(FriendlyGameView.self, from: data),
              view.id == gameId else { return }
        onView?(view)
    }

    private func handleReaction(_ message: JSONObject) {
        guard let p = message["payload"]?.objectValue,
              p["from"]?.stringValue?.lowercased() != myId,
              let key = p["reaction"]?.stringValue, FriendlyLive.isReaction(key) else { return }
        onReaction?(key)
    }

    private func handlePresence(_ action: any PresenceAction) {
        if action.joins.keys.contains(where: { $0.lowercased() == oppId }) {
            peerPresent = true
            peerEverSeen = true
        }
        if action.leaves.keys.contains(where: { $0.lowercased() == oppId }),
           !action.joins.keys.contains(where: { $0.lowercased() == oppId }) {
            peerPresent = false
        }
    }
}
