import Foundation

// FINISH_SPEC BJ5 (founder 10-03: "I updated my profile pic and it isn't populating"):
// ONE avatar precedence on every surface (boards, podiums, Friends, VS, profiles,
// records, shares) — packages/core avatar-config.ts `resolveAvatar`, pinned by
// Fixtures/avatar-resolve-fixtures.json:
//   1. the player's custom photo when display = "photo";
//   2. else their saved mascot (avatar_config);
//   3. else the cast hero they wear (avatar_cast_id) as its preset;
//   4. else the deterministic seeded mascot (defaultAvatar by lowercased username).
// avatar_frame fills a config without its own frame. A photo is "custom" when the
// player chose it: uploaded to our avatars bucket, or explicitly picked (a saved
// config with display = "photo"). An OAuth picture with no saved choice (Google's
// default is a plain colored letter) is never drawn — no avatar is a plain letter tile.

public enum AvatarResolve {
    /// The ten cast heroes a player can wear (avatar_cast_id), WORDOCIOUS order.
    public static let castIds = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]

    public enum Kind: String { case photo, config, cast, seeded }

    public struct Resolved: Equatable {
        public let kind: Kind
        /// The photo to draw (kind .photo only).
        public let photoUrl: String?
        /// The mascot (drawn when photoUrl is nil; its frame rings the photo otherwise).
        public let config: AvatarConfig
    }

    /// True for a photo the player uploaded (the public `avatars` storage bucket).
    public static func isCustomPhotoUrl(_ url: String?) -> Bool {
        url?.contains("/storage/v1/object/public/avatars/") ?? false
    }

    private static func knownFrame(_ v: Any?) -> String? {
        guard let k = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              k != "none", AvatarCatalog.frames.contains(k) else { return nil }
        return k
    }

    private static func knownCast(_ v: Any?) -> String? {
        guard let k = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), castIds.contains(k) else { return nil }
        return k
    }

    /// `config` is the raw avatar_config (a JSONSerialization value: [String: Any], or anything else = none).
    public static func resolve(username: String?, avatarUrl: String?, config: Any?, castId: Any? = nil,
                               frame: Any? = nil, accentHex: String? = nil) -> Resolved {
        let seed = (username ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let trimmed = avatarUrl?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let url: String? = trimmed.isEmpty ? nil : trimmed
        let custom = isCustomPhotoUrl(url)
        let ring = knownFrame(frame)
        let cast = knownCast(castId)
        func framed(_ c: AvatarConfig) -> AvatarConfig {
            var c = c
            if c.frame == "none", let ring { c.frame = ring }
            return c
        }
        if let raw = config as? [String: Any], !raw.isEmpty {
            let saved = framed(AvatarCatalog.validate(raw, fallback: AvatarCatalog.defaultAvatar(userId: seed, accentHex: accentHex, hasPhoto: custom)))
            if let url, saved.display == "photo" { return Resolved(kind: .photo, photoUrl: url, config: saved) }
            return Resolved(kind: .config, photoUrl: nil, config: saved)
        }
        if custom, let url {
            var base = cast.map(AvatarCatalog.castPreset) ?? AvatarCatalog.defaultAvatar(userId: seed, accentHex: accentHex, hasPhoto: true)
            base.display = "photo"
            return Resolved(kind: .photo, photoUrl: url, config: framed(base))
        }
        if let cast { return Resolved(kind: .cast, photoUrl: nil, config: framed(AvatarCatalog.castPreset(cast))) }
        return Resolved(kind: .seeded, photoUrl: nil, config: framed(AvatarCatalog.defaultAvatar(userId: seed, accentHex: accentHex)))
    }

    /// FINISH_SPEC BJ6 (founder 10-03: a photo is never "tacked on to a body"): a photo is a
    /// framed portrait — the chosen frame, else the Pro gold frame for a Pro player, else the
    /// level tier's frame (art-frame-<tier>) when the level is known, else none.
    public static func portraitFrame(chosen: String, pro: Bool, level: Int?) -> String? {
        if chosen != "none", AvatarCatalog.frames.contains(chosen) { return chosen }
        if pro { return "pro" }
        guard let level, level > 0 else { return nil }
        return AvatarFrameRules.normalize(LevelTier.forLevel(level).rawValue)
    }

    /// Typed-input convenience (a decoded payload's lenient avatar_config).
    public static func resolve(username: String?, avatarUrl: String?, raw: AvatarConfigRaw?, castId: String? = nil,
                               frame: String? = nil, accentHex: String? = nil) -> Resolved {
        resolve(username: username, avatarUrl: avatarUrl, config: raw?.jsonObject, castId: castId, frame: frame, accentHex: accentHex)
    }
}

// FINISH_SPEC BJ4 (founder 10-03: "The podium only appears on classic right now"):
// every board stands its leaders on the podium from ONE result — packages/core
// podium-layout.ts, pinned by Fixtures/podium-layout-fixtures.json.
public enum PodiumLayout {
    public static let size = 3

    /// `filled` leading rows (ranked within the top three, ties sharing steps) stand on
    /// the podium; `open` are the places (2, 3) still free. Empty board → (0, []).
    public static func layout(_ ranks: [Int], size: Int = PodiumLayout.size) -> (filled: Int, open: [Int]) {
        var filled = 0
        while filled < ranks.count && filled < size && ranks[filled] <= size { filled += 1 }
        guard filled > 0 else { return (0, []) }
        return (filled, filled < size ? Array((filled + 1)...size) : [])
    }

    /// The open spot's two lines.
    public static func openSpot(_ place: Int) -> (title: String, line: String) { ("Open spot", "Claim #\(place)") }
}
