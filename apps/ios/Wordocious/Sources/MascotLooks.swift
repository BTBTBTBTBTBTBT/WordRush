import SwiftUI
import Combine
import Supabase
import WordociousCore

// FINISH_SPEC §AN3 — who wears which build-your-own mascot (profiles.avatar_config
// jsonb null). Mirrors AH's CastAvatars: the column may not exist yet, so it is
// never in Profile.selectColumns; the signed-in player's config is read in a
// separate best-effort select and kept in UserDefaults while the server can't
// take it. Friends rows / public profiles carry it when the API returns it.
// AvatarView / LetterTileAvatar look configs up by username, so every no-photo
// avatar on every screen draws the player's mascot without callers threading
// the field through. Players with nothing saved get
// `AvatarCatalog.defaultAvatar(username, accent)` (Android MascotConfigRules parity:
// seeded by username, since most avatar call sites only know the name).

@MainActor
final class MascotLooks: ObservableObject {
    static let shared = MascotLooks()

    static let column = "avatar_config"

    @Published private(set) var byName: [String: AvatarConfig] = [:]

    private var ownKey: String?
    private var ownServer: (uid: String, config: AvatarConfig?)?
    private var fetchedOwn: String?
    private var fetchedOthers: Set<String> = []
    private var subs: Set<AnyCancellable> = []

    private init() {
        AuthService.shared.$profile
            .receive(on: DispatchQueue.main)
            .sink { [weak self] p in self?.recordOwn(p) }
            .store(in: &subs)
        NotificationCenter.default.publisher(for: FriendsService.changed)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.syncFriends() }
            .store(in: &subs)
        syncFriends()
    }

    private static func key(_ username: String?) -> String? {
        guard let k = username?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !k.isEmpty else { return nil }
        return k
    }

    static func localKey(userId: String) -> String { "avatar-config:\(userId.lowercased())" }

    /// True when a PostgREST / Postgres error says profiles.avatar_config does not exist yet.
    static func isMissingColumn(_ message: String?) -> Bool {
        guard let m = message, m.contains(column) else { return false }
        let l = m.lowercased()
        return m.contains("PGRST204") || m.contains("42703") || l.contains("schema cache")
            || l.contains("does not exist") || l.contains("could not find")
    }

    // MARK: Lookup

    /// The saved mascot for `username`, or nil (→ their cast preset / default).
    func configFor(_ username: String?) -> AvatarConfig? {
        guard let k = Self.key(username) else { return nil }
        return byName[k]
    }

    func record(_ username: String?, _ config: AvatarConfig?) {
        guard let k = Self.key(username) else { return }
        if let config {
            if byName[k] != config { byName[k] = config }
        } else if byName[k] != nil {
            byName[k] = nil
        }
    }

    /// A payload's raw avatar_config; absent / not an object never clears a known mascot.
    func recordRaw(_ username: String?, _ raw: AvatarConfigRaw?, hasPhoto: Bool = false) {
        guard let raw, raw.isObject, !raw.fields.isEmpty else { return }
        let fb = AvatarCatalog.defaultAvatar(userId: (username ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                                             hasPhoto: hasPhoto)
        record(username, AvatarCatalog.validate(raw: raw, fallback: fb))
    }

    /// What a no-photo avatar shows: a saved config, else a worn AH character's
    /// preset, else the deterministic default; an AH frame fills a config without one.
    static func display(saved: AvatarConfig?, castId: String?, frame: String?, username: String, accentHex: String?) -> AvatarConfig {
        var c = saved
            ?? AvatarCastRules.normalize(castId).map(AvatarCatalog.castPreset)
            ?? AvatarCatalog.defaultAvatar(userId: username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                                           accentHex: accentHex)
        if c.frame == "none", let f = AvatarFrameRules.normalize(frame) { c.frame = f }
        return c
    }

    // MARK: The signed-in player

    /// The signed-in player's saved mascot: the server column, else the local copy.
    func ownConfig(_ profile: Profile?) -> AvatarConfig? {
        guard let p = profile else { return nil }
        let fb = AvatarCatalog.defaultAvatar(userId: p.username.lowercased(), accentHex: p.accentColor, hasPhoto: Self.hasPhoto(p.avatarUrl))
        if let s = ownServer, s.uid == p.id, let c = s.config { return c }
        if let raw = p.avatarConfig, raw.isObject, !raw.fields.isEmpty { return AvatarCatalog.validate(raw: raw, fallback: fb) }
        if let text = UserDefaults.standard.string(forKey: Self.localKey(userId: p.id)), !text.isEmpty,
           let obj = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] {
            return AvatarCatalog.validate(obj, fallback: fb)
        }
        return nil
    }

    private func recordOwn(_ profile: Profile?) {
        let name = Self.key(profile?.username)
        if let old = ownKey, old != name { byName[old] = nil }
        ownKey = name
        guard let profile else { return }
        record(profile.username, ownConfig(profile))
        fetchOwn(profile)
    }

    /// One best-effort read of avatar_config per account per launch (any error —
    /// column missing, offline — leaves the local copy in charge).
    private func fetchOwn(_ profile: Profile) {
        guard fetchedOwn != profile.id else { return }
        fetchedOwn = profile.id
        let uid = profile.id
        Task {
            struct Row: Decodable { let avatar_config: AvatarConfigRaw? }
            guard let row: Row = try? await AuthService.shared.client.from("profiles")
                .select(Self.column).eq("id", value: uid).limit(1).single().execute().value else { return }
            guard let p = AuthService.shared.profile, p.id == uid else { return }
            let fb = AvatarCatalog.defaultAvatar(userId: p.username.lowercased(), accentHex: p.accentColor, hasPhoto: Self.hasPhoto(p.avatarUrl))
            let server = row.avatar_config.flatMap { $0.isObject && !$0.fields.isEmpty ? AvatarCatalog.validate(raw: $0, fallback: fb) : nil }
            // A null column with a local copy (saved while the column was missing) keeps the local copy.
            if server != nil || UserDefaults.standard.string(forKey: Self.localKey(userId: uid)).map({ $0.isEmpty }) ?? true {
                ownServer = (uid, server)
            }
            record(p.username, ownConfig(p))
        }
    }

    /// After Edit Profile saves: keep the local copy in step and show it right away.
    func applyOwn(userId: String, username: String, config: AvatarConfig?, serverAccepted: Bool) {
        let d = UserDefaults.standard
        if serverAccepted {
            ownServer = (userId, config)
            d.removeObject(forKey: Self.localKey(userId: userId))
        } else {
            if ownServer?.uid == userId { ownServer = (userId, config) }
            if let config, let data = try? JSONSerialization.data(withJSONObject: config.jsonObject),
               let text = String(data: data, encoding: .utf8) {
                d.set(text, forKey: Self.localKey(userId: userId))
            } else {
                d.removeObject(forKey: Self.localKey(userId: userId))
            }
        }
        if let old = ownKey, old != Self.key(username) { byName[old] = nil }
        ownKey = Self.key(username)
        record(username, config)
    }

    // MARK: Others

    private func syncFriends() {
        for f in FriendsService.friends + FriendsService.incoming + FriendsService.outgoingProfiles {
            recordRaw(f.username, f.avatar_config, hasPhoto: Self.hasPhoto(f.avatar_url))
        }
    }

    /// A best-effort read of another player's avatar_config (public profiles). Errors are ignored.
    func fetchConfig(userId: String) async {
        guard !fetchedOthers.contains(userId) else { return }
        fetchedOthers.insert(userId)
        struct Row: Decodable { let username: String; let avatar_url: String?; let avatar_config: AvatarConfigRaw? }
        guard let row: Row = try? await AuthService.shared.client.from("profiles")
            .select("username,avatar_url,\(Self.column)").eq("id", value: userId).limit(1).single().execute().value else { return }
        if row.username.lowercased() == ownKey { return }
        recordRaw(row.username, row.avatar_config, hasPhoto: Self.hasPhoto(row.avatar_url))
    }

    /// BJ5: a saved config without `display` defaults to the photo only for a CUSTOM (uploaded) photo
    /// — core resolveAvatar parity (an OAuth picture is never the default).
    static func hasPhoto(_ url: String?) -> Bool { AvatarResolve.isCustomPhotoUrl(url) }
}
