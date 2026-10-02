import Foundation
import WordociousCore

/// The Friends pocket games over /api/friends/games (Friends overhaul, founder
/// 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md §4). The server runs the
/// rules (core friendly-games.ts) and stores the state; this client only
/// starts games, sends moves and renders what comes back. Bearer-authed like
/// FriendsService. The active list is cached for the YOUR TURN section and the
/// Friends tab badge (§5).
enum FriendlyGamesService {
    /// My games in play, my turn first (GET /api/friends/games `active`).
    private(set) static var active: [FriendlyGameView] = []
    /// Finished in the last 7 days.
    private(set) static var recent: [FriendlyGameView] = []
    private(set) static var loaded = false

    /// Posted whenever `active` changes (the panel and the badge re-read).
    static let changed = Notification.Name("wordocious.friendlyGamesChanged")

    /// Active games waiting on my move — half of the tab badge.
    static var yourTurnCount: Int { active.filter(\.yourTurn).count }

    private static let base = "https://wordocious.com/api/friends/games"

    enum Failure: Error, Equatable {
        /// 400 — a bad move or start; the server's message, shown inline.
        case message(String)
        /// 409 {retry: true} — the game moved on; refetch and try again.
        case retry
        case network
    }

    private static func notify() {
        NotificationCenter.default.post(name: changed, object: nil)
    }

    private static func request(_ path: String, method: String = "GET", body: [String: Any]? = nil) async -> (Int, Data)? {
        guard let url = URL(string: base + path) else { return nil }
        var req = await PublicProfileService.authedRequest(url)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        guard let (data, resp) = try? await Net.api.data(for: req),
              let http = resp as? HTTPURLResponse else { return nil }
        return (http.statusCode, data)
    }

    private struct GameBody: Decodable { let game: FriendlyGameView }

    private static func decodeGame(_ status: Int, _ data: Data) -> Result<FriendlyGameView, Failure> {
        if status == 200, let g = try? JSONDecoder().decode(GameBody.self, from: data) {
            upsert(g.game)
            return .success(g.game)
        }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        if status == 409, json?["retry"] as? Bool == true { return .failure(.retry) }
        return .failure(.message((json?["error"] as? String) ?? "Something went wrong — try again"))
    }

    /// Keep the cached lists in step with a game we just read or changed.
    private static func upsert(_ g: FriendlyGameView) {
        var a = active.filter { $0.id != g.id }
        if g.isActive { a.append(g) } else {
            recent.removeAll { $0.id == g.id }
            recent.insert(g, at: 0)
        }
        a.sort { ($0.yourTurn ? 1 : 0) > ($1.yourTurn ? 1 : 0) }
        if a != active { active = a; notify() }
    }

    /// GET /api/friends/games → {active, recent}. No-throw.
    static func load() async {
        struct Payload: Decodable { let active: [FriendlyGameView]; let recent: [FriendlyGameView] }
        guard let (status, data) = await request(""), status == 200,
              let p = try? JSONDecoder().decode(Payload.self, from: data) else { return }
        active = p.active
        recent = p.recent
        loaded = true
        notify()
    }

    /// POST /api/friends/games {kind, friendId, stake?} → the new (or already open) game.
    static func start(kind: FriendlyKind, friendId: String, stake: String? = nil) async -> Result<FriendlyGameView, Failure> {
        var body: [String: Any] = ["kind": kind.rawValue, "friendId": friendId]
        if let stake { body["stake"] = stake }
        guard let (status, data) = await request("", method: "POST", body: body) else { return .failure(.network) }
        return decodeGame(status, data)
    }

    /// GET /api/friends/games/<id> — polled every 2 s while the game screen is open.
    static func get(_ id: String) async -> Result<FriendlyGameView, Failure> {
        guard let (status, data) = await request("/\(id)") else { return .failure(.network) }
        return decodeGame(status, data)
    }

    /// POST /api/friends/games/<id>/move {move}.
    static func move(_ id: String, _ move: FriendlyMove) async -> Result<FriendlyGameView, Failure> {
        guard let encoded = try? JSONEncoder().encode(move),
              let obj = try? JSONSerialization.jsonObject(with: encoded) else { return .failure(.network) }
        guard let (status, data) = await request("/\(id)/move", method: "POST", body: ["move": obj]) else { return .failure(.network) }
        return decodeGame(status, data)
    }

    /// POST /api/friends/games/<id>/resign — the friend wins it.
    static func resign(_ id: String) async -> Result<FriendlyGameView, Failure> {
        guard let (status, data) = await request("/\(id)/resign", method: "POST", body: [:]) else { return .failure(.network) }
        return decodeGame(status, data)
    }
}
