import SwiftUI
import Combine
import Supabase
import WordociousCore

// FINISH_SPEC BJ5 (founder 10-03: "I updated my profile pic and it isn't populating on
// there"): the ONE avatar resolver every avatar on iOS goes through (AvatarView,
// LetterTileAvatar, the podium, Friends, VS, profiles, records, share images).
//
// Why the podium disagreed with the rows: PodiumView drew LetterTileAvatar, which only
// ever looked up a saved mascot by username — it ignored avatar_url and the Pro mark — while
// rows drew AvatarView with the photo. And the daily board query carried only
// (username, avatar_url, avatar_emoji), so another player's mascot / cast / frame was known
// only if a friends list or a public-profile visit had happened to record it.
//
// Now: the precedence is core `AvatarResolve.resolve` (custom photo if display = photo →
// saved mascot → worn cast hero → seeded mascot; avatar_frame fills a frameless config;
// an OAuth picture with no saved choice is never drawn). Inputs come from, in order: what
// the call site passes, this directory (filled by every board fetch and by a batched
// profiles lookup for any name it hasn't seen), and the MascotLooks / CastAvatars caches.
// The signed-in player's avatar ALWAYS comes from their live profile (+ MascotLooks /
// CastAvatars own copies), wherever it appears — cached boards and the optimistic own row
// included — so an edit shows everywhere at once with no refetch.

@MainActor
final class AvatarDirectory: ObservableObject {
    static let shared = AvatarDirectory()

    /// What a payload told us about one player.
    struct Entry: Equatable {
        var userId: String?
        var url: String?
        /// The raw avatar_config fields (nil = none saved / not carried).
        var config: [String: String]?
        var castId: String?
        var frame: String?
        var accent: String?
    }

    @Published private(set) var byName: [String: Entry] = [:]
    /// Bumped whenever the signed-in player's profile changes (photo, accent, Pro).
    @Published private(set) var ownVersion = 0

    private var ownKey: String?
    private var ownId: String?
    private var nameById: [String: String] = [:]
    private var requested: Set<String> = []
    private var pendingNames: [String: String] = [:]   // key → the spelling to query
    private var pendingIds: Set<String> = []
    private var flushTask: Task<Void, Never>?
    private var subs: Set<AnyCancellable> = []

    /// Labels that are never a real username (placeholders on VS / Friends surfaces).
    private static let placeholders: Set<String> = ["you", "anonymous", "guest", "?", "player", "opponent"]

    private init() {
        AuthService.shared.$profile
            .receive(on: DispatchQueue.main)
            .sink { [weak self] p in self?.recordOwn(p) }
            .store(in: &subs)
        // Founder 10-05: keep the last settled host look on the device (HostLookCache) — on every
        // profile load, avatar column read and Dressing Room / Edit Profile save.
        Publishers.Merge3($ownVersion.map { _ in () },
                          MascotLooks.shared.objectWillChange.map { _ in () },
                          CastAvatars.shared.objectWillChange.map { _ in () })
            .debounce(for: .milliseconds(250), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in self?.persistHostLook() }
            .store(in: &subs)
    }

    static func key(_ username: String?) -> String? {
        guard let k = username?.trimmingCharacters(in: CharacterSet(charactersIn: "@ \n\t")).lowercased(), !k.isEmpty else { return nil }
        return k
    }

    // MARK: Own

    private func recordOwn(_ p: Profile?) {
        let k = Self.key(p?.username)
        if let k { byName[k] = nil }
        ownKey = k
        ownId = p?.id.lowercased()
        ownVersion &+= 1
    }

    func isOwn(username: String?, userId: String?) -> Bool {
        if let id = userId?.lowercased(), let ownId { return id == ownId }
        guard let k = Self.key(username), let ownKey else { return false }
        return k == ownKey
    }

    // MARK: Recording

    /// Records one player from a payload. `carriesAvatarColumns` false (a select that fell
    /// back without avatar_config / cast / frame) only updates the photo + accent.
    func record(userId: String?, username: String?, url: String?, config: AvatarConfigRaw?, castId: String?, frame: String?,
                accent: String?, carriesAvatarColumns: Bool = true) {
        guard let k = Self.key(username), !isOwn(username: username, userId: userId) else { return }
        if let id = userId?.lowercased() { nameById[id] = k }
        requested.insert(k)
        var e = byName[k] ?? Entry()
        e.userId = userId?.lowercased() ?? e.userId
        e.url = url
        e.accent = accent ?? e.accent
        if carriesAvatarColumns {
            e.config = config.flatMap { $0.isObject && !$0.fields.isEmpty ? $0.fields : nil }
            e.castId = castId
            e.frame = frame
        }
        if byName[k] != e { byName[k] = e }
    }

    /// Records every row of a daily board (top list, rank window, Friends, yesterday).
    func record(_ rows: [LeaderboardEntry]) {
        for r in rows {
            record(userId: r.userId, username: r.username, url: r.profiles.avatarUrl, config: r.profiles.avatarConfig,
                   castId: r.profiles.avatarCastId, frame: r.profiles.avatarFrame, accent: r.profiles.accentColor,
                   carriesAvatarColumns: r.profiles.carriesAvatarColumns)
        }
    }

    // MARK: Batched lookups

    /// Ask for a player's full look by name (an avatar on screen we know nothing about).
    func want(username: String?) {
        guard let k = Self.key(username), k != ownKey, byName[k] == nil, !requested.contains(k),
              !Self.placeholders.contains(k), !k.contains(" · bot") else { return }
        requested.insert(k)
        pendingNames[k] = username?.trimmingCharacters(in: CharacterSet(charactersIn: "@ \n\t"))
        scheduleFlush()
    }

    /// Prefetch players by id (RPC boards, VS opponents) before their avatars draw.
    func want(userIds: [String]) {
        for raw in userIds {
            let id = raw.lowercased()
            guard id != ownId, nameById[id] == nil, !requested.contains("id:" + id) else { continue }
            requested.insert("id:" + id)
            pendingIds.insert(id)
        }
        if !pendingIds.isEmpty { scheduleFlush() }
    }

    private func scheduleFlush() {
        guard flushTask == nil else { return }
        flushTask = Task { [weak self] in
            // Coalesce one screen's worth of avatars into one request.
            try? await Task.sleep(nanoseconds: 120_000_000)
            await self?.flush()
        }
    }

    private struct Row: Decodable {
        let id: String
        let username: String
        let avatar_url: String?
        let accent_color: String?
        let avatar_config: AvatarConfigRaw?
        let avatar_cast_id: String?
        let avatar_frame: String?
    }

    private static let baseColumns = "id,username,avatar_url,accent_color"
    private static let avatarColumns = ",avatar_config,avatar_cast_id,avatar_frame"

    private func flush() async {
        flushTask = nil
        let batch = Array(pendingNames.prefix(100))
        for (k, _) in batch { pendingNames[k] = nil }
        let names = batch.map(\.value)
        let ids = Array(pendingIds.prefix(100)); pendingIds.subtract(ids)
        if !names.isEmpty { await fetch(column: "username", values: names) }
        if !ids.isEmpty { await fetch(column: "id", values: ids) }
        if !pendingNames.isEmpty || !pendingIds.isEmpty { scheduleFlush() }
    }

    private func fetch(column: String, values: [String]) async {
        let client = AuthService.shared.client
        func run(_ cols: String) async throws -> [Row] {
            try await client.from("profiles").select(cols).in(column, values: values).limit(values.count + 10).execute().value
        }
        var rows: [Row]? = try? await run(Self.baseColumns + Self.avatarColumns)
        var full = true
        if rows == nil { rows = try? await run(Self.baseColumns); full = false }
        guard let rows else {
            // Offline: let a later appearance ask again.
            for v in values { requested.remove(column == "id" ? "id:" + v : v.lowercased()) }
            return
        }
        for r in rows {
            record(userId: r.id, username: r.username, url: r.avatar_url, config: r.avatar_config,
                   castId: r.avatar_cast_id, frame: r.avatar_frame, accent: r.accent_color, carriesAvatarColumns: full)
        }
    }

    // MARK: Resolve

    struct Look {
        let resolved: AvatarResolve.Resolved
        let initial: String
        /// The signed-in player's active Pro (their own avatar wears the mark everywhere).
        let ownPro: Bool
    }

    /// The one resolution every avatar view draws. `lookup` false draws exactly what is
    /// passed (Edit Profile's live preview, the photo option tile).
    func look(username: String, userId: String? = nil, url: String?, castId: String?, frame: String?,
              mascot: AvatarConfig?, accentHex: String?, lookup: Bool) -> Look {
        let initial = AvatarCatalog.initial(username)
        guard lookup else {
            let trimmed = url?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let cfg: [String: Any]? = mascot?.jsonObject ?? (trimmed.isEmpty ? nil : ["display": "photo"])
            return Look(resolved: AvatarResolve.resolve(username: username, avatarUrl: url, config: cfg, castId: castId,
                                                         frame: frame, accentHex: accentHex),
                        initial: initial, ownPro: false)
        }
        _ = ownVersion
        if isOwn(username: username, userId: userId), let p = AuthService.shared.profile {
            let cfg = mascot ?? MascotLooks.shared.ownConfig(p) ?? MascotLooks.shared.configFor(p.username)
            let look = CastAvatars.shared.lookFor(p.username) ?? CastAvatars.shared.ownLook(p)
            return Look(resolved: AvatarResolve.resolve(username: p.username, avatarUrl: p.avatarUrl, config: cfg?.jsonObject,
                                                         castId: castId ?? look.castId, frame: frame ?? look.frame,
                                                         accentHex: p.accentColor ?? accentHex),
                        initial: AvatarCatalog.initial(p.username), ownPro: isProActive(p))
        }
        let k = Self.key(username)
        let e = k.flatMap { byName[$0] }
        let saved: [String: Any]? = mascot?.jsonObject ?? e?.config.map { $0 as [String: Any] }
            ?? MascotLooks.shared.configFor(username)?.jsonObject
        let cast = CastAvatars.shared.lookFor(username)
        let given = url?.trimmingCharacters(in: .whitespacesAndNewlines)
        let photo = (given?.isEmpty == false ? given : nil) ?? e?.url
        return Look(resolved: AvatarResolve.resolve(username: username, avatarUrl: photo, config: saved,
                                                     castId: castId ?? e?.castId ?? cast?.castId,
                                                     frame: frame ?? e?.frame ?? cast?.frame,
                                                     accentHex: accentHex ?? e?.accent),
                    initial: initial, ownPro: false)
    }

    /// BJ6: who hosts the Good Morning card — the player's uploaded photo as a framed
    /// portrait when their avatar shows it, else their custom mascot (a saved avatar_config
    /// or a worn cast hero), else W (guests, no custom look).
    /// Founder 10-05: until the own look has settled at launch, the last known look of this
    /// player (HostLookCache) hosts instead — never W first and a pop later.
    func ownHostChoice() -> HomeHostChoice {
        switch hostSource() {
        case .live: return liveHostChoice()
        case .unknown: return .w
        case .cached(let e):
            switch e.kind {
            case .photo: return .photo
            case .mascot: return e.config.map { .mascot($0) } ?? .w
            case .plain: return .w
            }
        }
    }

    /// Founder 10-05 (door 2): a signed-in player with no custom look sees their OWN plain seeded mascot
    /// as the Home host saying "Make me yours!" (instead of W) until they save a look or dismiss it.
    /// No invite while the look is still unknown (it may be a customized player).
    func ownHostInvite() -> AvatarConfig? {
        switch hostSource() {
        case .live: return liveHostInvite()
        case .unknown: return nil
        case .cached(let e):
            guard e.kind == .plain, !DressUp.shared.done(.hostInvite) else { return nil }
            return e.config
        }
    }

    /// What the photo host draws: the live profile, else (launch window) the cached look.
    func ownHostPhoto() -> (url: String?, username: String, userId: String?, frame: String?, pro: Bool, cached: Bool)? {
        if case .cached(let e) = hostSource(), e.kind == .photo {
            return (e.photoUrl, e.username ?? "", e.userId, e.frame, e.pro, true)
        }
        guard let p = AuthService.shared.profile else { return nil }
        return (p.avatarUrl, p.username, p.id, nil, false, false)
    }

    /// True once the host draws the live look (not the launch-window cache) — the widget snapshot
    /// waits for it so it never deletes / re-renders the widget figure from a half-loaded look.
    var ownHostIsLive: Bool { if case .live = hostSource() { return true } else { return false } }

    private func hostSource() -> HostLookRules.Source {
        _ = ownVersion
        let auth = AuthService.shared
        let uid = auth.profile?.id
        let settled = uid != nil && MascotLooks.shared.ownSettled == uid && CastAvatars.shared.ownSettled == uid
        return HostLookRules.source(entry: HostLookCache.load(), sessionExpected: AuthService.hadPersistedSession,
                                    isGuest: auth.isGuest, profileUserId: uid, liveSettled: settled)
    }

    private func liveHostChoice() -> HomeHostChoice {
        _ = ownVersion
        guard let p = AuthService.shared.profile, !AuthService.shared.isGuest else { return .w }
        let r = look(username: p.username, userId: p.id, url: p.avatarUrl, castId: nil, frame: nil,
                     mascot: nil, accentHex: p.accentColor, lookup: true).resolved
        switch r.kind {
        case .photo: return .photo
        case .config, .cast:
            var c = r.config
            c.display = "mascot"
            return .mascot(c)
        case .seeded: return .w
        }
    }

    private func liveHostInvite() -> AvatarConfig? {
        _ = ownVersion
        guard let p = AuthService.shared.profile, !AuthService.shared.isGuest, !DressUp.shared.done(.hostInvite) else { return nil }
        let r = look(username: p.username, userId: p.id, url: p.avatarUrl, castId: nil, frame: nil,
                     mascot: nil, accentHex: p.accentColor, lookup: true).resolved
        guard r.kind == .seeded else { return nil }
        var c = r.config
        c.display = "mascot"
        return c
    }

    /// Writes the settled live host look (keyed by user id). Never while unsettled, never for guests.
    private func persistHostLook() {
        let auth = AuthService.shared
        guard let p = auth.profile, !auth.isGuest, case .live = hostSource() else { return }
        let lk = look(username: p.username, userId: p.id, url: p.avatarUrl, castId: nil, frame: nil,
                      mascot: nil, accentHex: p.accentColor, lookup: true)
        let entry: HostLookEntry
        switch liveHostChoice() {
        case .photo:
            let pro = lk.ownPro
            entry = HostLookEntry(userId: p.id, kind: .photo, photoUrl: lk.resolved.photoUrl ?? p.avatarUrl, username: p.username,
                                  frame: Self.portraitFrame(lk.resolved, level: p.level, pro: pro), pro: pro)
        case .mascot(let c):
            entry = HostLookEntry(userId: p.id, kind: .mascot, config: c, username: p.username)
        case .w:
            var c = lk.resolved.config
            c.display = "mascot"
            entry = HostLookEntry(userId: p.id, kind: .plain, config: c, username: p.username)
        }
        if HostLookRules.shouldWrite(stored: HostLookCache.load(), live: entry) { HostLookCache.save(entry) }
    }

    /// FINISH_SPEC BJ6 (founder 10-03): a photo is a framed PORTRAIT — the chosen frame,
    /// else the player's level-tier frame (art-frame-<tier>) — never pasted onto a body.
    /// Order (web / Android parity): chosen frame → the Pro gold frame for a Pro player →
    /// the level tier's frame when the level is known → none.
    static func portraitFrame(_ resolved: AvatarResolve.Resolved, level: Int?, pro: Bool = false) -> String? {
        AvatarResolve.portraitFrame(chosen: resolved.config.frame, pro: pro, level: level)
    }
}

/// Founder 10-05: the signed-in player's last settled Home host look, in UserDefaults (one entry,
/// keyed by its user id inside; HostLookRules only honors it for that id). Cleared on sign-out.
@MainActor
enum HostLookCache {
    static let key = "wordocious.host-look"
    private static var memo: HostLookEntry??

    static func load() -> HostLookEntry? {
        if let memo { return memo }
        let e = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(HostLookEntry.self, from: $0) }
        memo = .some(e)
        return e
    }

    static func save(_ entry: HostLookEntry) {
        memo = .some(entry)
        if let data = try? JSONEncoder().encode(entry) { UserDefaults.standard.set(data, forKey: key) }
    }

    static func clear() {
        memo = .some(nil)
        UserDefaults.standard.removeObject(forKey: key)
    }
}
