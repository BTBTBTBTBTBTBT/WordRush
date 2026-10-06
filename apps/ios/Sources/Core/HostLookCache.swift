import Foundation

// Founder 10-05 (2.7.1): "the purple guy populates the main square during the intro and then it
// just changes suddenly to your mascot. Can that always just be populated by your mascot?"
//
// The Home host's look (photo / mascot / plain) needs the profile row AND the own avatar columns
// (avatar_config, avatar_cast_id, avatar_frame — fetched separately after launch). At cold start
// none of it is in hand, so the host drew W and then popped. The app now keeps the signed-in
// player's last resolved host look on the device, keyed by user id, and draws it until the live
// look has settled. Web (home-host-cache) and Android (HostLookCache) follow the same rules.

/// One cached host look. `userId` is lowercased.
public struct HostLookEntry: Codable, Equatable {
    public enum Kind: String, Codable { case photo, mascot, plain }

    public var userId: String
    public var kind: Kind
    /// mascot: the full-body config. plain: the player's seeded mascot (the "Make me yours!" invite).
    public var config: AvatarConfig?
    /// photo: what the framed portrait needs before the profile row arrives.
    public var photoUrl: String?
    public var username: String?
    public var frame: String?
    public var pro: Bool

    public init(userId: String, kind: Kind, config: AvatarConfig? = nil, photoUrl: String? = nil,
                username: String? = nil, frame: String? = nil, pro: Bool = false) {
        self.userId = userId.lowercased()
        self.kind = kind
        self.config = config
        self.photoUrl = photoUrl
        self.username = username
        self.frame = frame
        self.pro = pro
    }
}

public enum HostLookRules {
    /// What the host should draw right now.
    public enum Source: Equatable {
        /// The live resolution (guests, signed out, or the own look has settled).
        case live
        /// The last known look of this player.
        case cached(HostLookEntry)
        /// A signed-in player whose look isn't known yet and nothing is cached: the plain host,
        /// with NO "Make me yours!" bubble (it may be a customized player).
        case unknown
    }

    /// - Parameters:
    ///   - entry: the stored entry (nil = none).
    ///   - sessionExpected: the last run had a real session (it is being restored).
    ///   - isGuest: guest mode.
    ///   - profileUserId: the signed-in profile's id, once the row is in hand.
    ///   - liveSettled: the own avatar columns have been read (or failed) for that profile.
    public static func source(entry: HostLookEntry?, sessionExpected: Bool, isGuest: Bool,
                              profileUserId: String?, liveSettled: Bool) -> Source {
        if isGuest { return .live }
        guard let uid = profileUserId?.lowercased() else {
            guard sessionExpected else { return .live }
            return entry.map(Source.cached) ?? .unknown
        }
        if liveSettled { return .live }
        // Keyed by user: another account's look is never shown.
        if let entry, entry.userId == uid { return .cached(entry) }
        return .unknown
    }

    /// Whether a settled live look should be written over what is stored.
    public static func shouldWrite(stored: HostLookEntry?, live: HostLookEntry) -> Bool { stored != live }

    /// A host change crossfades (~200 ms) only when the look actually differs — the cached look
    /// matching the live one changes nothing.
    public static func crossfades<T: Equatable>(from old: T, to new: T) -> Bool { old != new }

    public static let crossfadeSeconds: Double = 0.2
}
