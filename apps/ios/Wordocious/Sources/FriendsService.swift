import Foundation
import Supabase

/// FRIENDS (bible §207) — iOS twin of apps/web/lib/friends-service.ts.
///
/// All mutations go through the /api/friends/* web routes (friendships has
/// NO client write policies — the pair-block check and pushes live server-
/// side); the one GET brings friends + requests with profile chrome in a
/// single round trip. Caches are in-memory per launch, the ModerationService
/// shape: synchronous accessors for render-time filtering, optimistic
/// mutations, everything no-throw.
enum FriendsService {
    struct FriendProfile: Decodable, Identifiable, Equatable {
        let id: String
        let username: String
        let avatar_url: String?
        let level: Int
        var since: String?
        var requestedAt: String?
    }

    private struct FriendsPayload: Decodable {
        let friends: [FriendProfile]
        let incoming: [FriendProfile]
        let outgoing: [String]
        // Tier 1 (Aug 11): outgoing WITH profile chrome — additive server field.
        var outgoingProfiles: [FriendProfile] = []
    }

    /// Accepted friend ids (lowercased) — the leaderboard filter set.
    private(set) static var friendIds: Set<String> = []
    private(set) static var friends: [FriendProfile] = []
    private(set) static var incoming: [FriendProfile] = []
    private(set) static var outgoing: Set<String> = []
    private(set) static var outgoingProfiles: [FriendProfile] = []
    private(set) static var loaded = false

    /// Bumped on every cache change; views observe `friendsChanged` to re-derive.
    static var version = 0
    static let changed = Notification.Name("wordocious.friendsChanged")

    private static func notify() {
        version += 1
        NotificationCenter.default.post(name: changed, object: nil)
    }

    static func isFriend(_ userId: String) -> Bool { friendIds.contains(userId.lowercased()) }
    static func hasRequested(_ userId: String) -> Bool { outgoing.contains(userId.lowercased()) }
    static func hasIncomingFrom(_ userId: String) -> Bool {
        incoming.contains { $0.id.lowercased() == userId.lowercased() }
    }

    /// Load once per launch (force to refresh). No-throw; on failure the
    /// cache stays unloaded so a later call retries.
    static func load(force: Bool = false) async {
        if loaded && !force { return }
        guard let url = URL(string: "https://wordocious.com/api/friends") else { return }
        let req = await PublicProfileService.authedRequest(url)
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let payload = try? JSONDecoder().decode(FriendsPayload.self, from: data)
        else { return }
        friends = payload.friends
        incoming = payload.incoming
        friendIds = Set(payload.friends.map { $0.id.lowercased() })
        outgoing = Set(payload.outgoing.map { $0.lowercased() })
        outgoingProfiles = payload.outgoingProfiles
        loaded = true
        notify()
    }

    // MARK: mutations (POST /api/friends/…)

    private static func post(_ path: String, body: [String: String]) async -> (Int, Data)? {
        guard let url = URL(string: "https://wordocious.com/api/friends/\(path)") else { return nil }
        var req = await PublicProfileService.authedRequest(url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { return nil }
        return (http.statusCode, data)
    }

    enum RequestOutcome { case pending, accepted, failed(String) }

    /// Send a friend request by id or exact username (mutual → auto-accept).
    static func request(addresseeId: String? = nil, username: String? = nil) async -> RequestOutcome {
        var body: [String: String] = [:]
        if let addresseeId { body["addresseeId"] = addresseeId }
        if let username { body["username"] = username }
        guard let (status, data) = await post("request", body: body) else { return .failed("Network error") }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard status == 200 else {
            return .failed((json?["error"] as? String) ?? "Could not send request")
        }
        let friendId = (json?["friendId"] as? String) ?? ""
        if (json?["status"] as? String) == "accepted" {
            friendIds.insert(friendId.lowercased())
            incoming.removeAll { $0.id.lowercased() == friendId.lowercased() }
            Task { await load(force: true) } // pull profile chrome
            notify()
            return .accepted
        }
        outgoing.insert(friendId.lowercased())
        Task { await load(force: true) } // pull profile chrome for the Sent row
        notify()
        return .pending
    }

    @discardableResult
    static func accept(requesterId: String) async -> Bool {
        if let req = incoming.first(where: { $0.id == requesterId }) {
            var f = req
            f.since = ISO8601DateFormatter().string(from: Date())
            friends.append(f)
        }
        incoming.removeAll { $0.id == requesterId }
        friendIds.insert(requesterId.lowercased())
        notify()
        let r = await post("accept", body: ["requesterId": requesterId])
        return r?.0 == 200
    }

    @discardableResult
    static func decline(requesterId: String) async -> Bool {
        incoming.removeAll { $0.id == requesterId }
        outgoing.remove(requesterId.lowercased())
        outgoingProfiles.removeAll { $0.id.caseInsensitiveCompare(requesterId) == .orderedSame }
        notify()
        let r = await post("decline", body: ["requesterId": requesterId])
        return r?.0 == 200
    }

    @discardableResult
    static func remove(friendId: String) async -> Bool {
        friendIds.remove(friendId.lowercased())
        friends.removeAll { $0.id == friendId }
        outgoing.remove(friendId.lowercased())
        outgoingProfiles.removeAll { $0.id.caseInsensitiveCompare(friendId) == .orderedSame }
        notify()
        let r = await post("remove", body: ["friendId": friendId])
        return r?.0 == 200
    }

    /// Fire-and-forget overtake check after a daily result saves — the server
    /// re-reads the trusted score and pushes any friends we just passed.
    static func beatCheck(day: String, gameMode: String, playType: String = "solo") {
        Task.detached(priority: .background) {
            _ = await post("beat-check", body: ["day": day, "gameMode": gameMode, "playType": playType])
        }
    }

    enum TauntOutcome { case sent, alreadySent, failed }

    /// One-tap canned taunt (ids from FriendTaunts.all; 1/friend/day).
    static func taunt(friendId: String, tauntId: String, day: String) async -> TauntOutcome {
        guard let (status, _) = await post("taunt", body: ["friendId": friendId, "tauntId": tauntId, "day": day]) else {
            return .failed
        }
        if status == 429 { return .alreadySent }
        return status == 200 ? .sent : .failed
    }
}

/// The canned taunt list — MUST mirror apps/web/lib/friends-taunts.ts (ids
/// are validated server-side; unknown ids 400).
enum FriendTaunts {
    struct Taunt: Identifiable { let id: String; let text: String }
    static let all: [Taunt] = [
        .init(id: "sweep", text: "🧹 Swept it. Your move."),
        .init(id: "silver", text: "🥈 Silver looks good on you"),
        .init(id: "slowpoke", text: "🐢 Still waiting on you today…"),
        .init(id: "scoreboard", text: "👀 The scoreboard has spoken"),
        .init(id: "warmup", text: "📈 Cute score. Was that a warm-up?"),
        .init(id: "crown", text: "👑 The crown stays here"),
        .init(id: "rentfree", text: "🏠 Top of the board — rent free"),
        .init(id: "alarm", text: "⏰ Your daily puzzles miss you"),
    ]
}
