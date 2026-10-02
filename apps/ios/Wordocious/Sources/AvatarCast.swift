import SwiftUI
import Combine
import Supabase
import WordociousCore

// FINISH_SPEC §AH — pick-a-character avatars + level-tier frames (iOS half; the
// pure rules live in core AvatarLook.swift, Android twin data/AvatarCast.kt +
// ui/CastAvatar.kt).
//
// The player can wear one of the ten WORDOCIOUS heroes as their avatar (drawn on
// a tinted circle in the character's own color) and a ring frame for any level
// tier they have reached. Stored on profiles (avatar_cast_id, avatar_frame); the
// columns may not exist yet, so the choice also lives in UserDefaults per account
// and the app never depends on them. AvatarView / LetterTileAvatar look the look
// up by username here, so every avatar on every screen wears it without each
// caller threading the fields through.

/// What an avatar wears: a character and / or a frame (both optional).
struct AvatarLook: Equatable {
    var castId: String?
    var frame: String?
}

/// Who wears what, by lowercased username. Fed by the signed-in profile (+ its
/// local fallback) and the friends payload when it carries the fields.
@MainActor
final class CastAvatars: ObservableObject {
    static let shared = CastAvatars()

    @Published private(set) var byName: [String: AvatarLook] = [:]

    private var ownKey: String?
    /// The signed-in player's columns as the server returned them (or as a save
    /// the server accepted wrote them). nil = not known (missing columns / not loaded).
    private var ownServer: (uid: String, look: AvatarLook)?
    private var fetchedFor: String?
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

    /// The look for `username`, or nil when they wear neither.
    func lookFor(_ username: String?) -> AvatarLook? {
        guard let k = Self.key(username) else { return nil }
        return byName[k]
    }

    func record(_ username: String?, castId: String?, frame: String?) {
        guard let k = Self.key(username) else { return }
        let look = AvatarLook(castId: AvatarCastRules.normalize(castId), frame: AvatarFrameRules.normalize(frame))
        if look.castId == nil && look.frame == nil {
            if byName[k] != nil { byName[k] = nil }
        } else if byName[k] != look {
            byName[k] = look
        }
    }

    // MARK: The signed-in player

    /// The signed-in player's look: the server columns, else the local copy.
    func ownLook(_ profile: Profile?) -> AvatarLook {
        guard let p = profile else { return AvatarLook() }
        let server = ownServer?.uid == p.id ? ownServer?.look : nil
        let d = UserDefaults.standard
        let cast = AvatarSaveRules.resolve(server: server?.castId ?? p.avatarCastId,
                                           local: d.string(forKey: AvatarSaveRules.castKey(userId: p.id)))
        let frame = AvatarSaveRules.resolve(server: server?.frame ?? p.avatarFrame,
                                            local: d.string(forKey: AvatarSaveRules.frameKey(userId: p.id)))
        return AvatarLook(castId: AvatarCastRules.normalize(cast),
                          frame: AvatarFrameRules.effective(frame, level: p.level))
    }

    private func recordOwn(_ profile: Profile?) {
        let name = Self.key(profile?.username)
        if let old = ownKey, old != name { byName[old] = nil }
        ownKey = name
        guard let profile else { return }
        let look = ownLook(profile)
        record(profile.username, castId: look.castId, frame: look.frame)
        fetchOwnColumns(profile)
    }

    /// One best-effort read of the two columns per account per launch (they are
    /// not in Profile.selectColumns, so a missing column never breaks the profile
    /// load). Any error (column missing, offline) leaves the local copy in charge.
    private func fetchOwnColumns(_ profile: Profile) {
        guard fetchedFor != profile.id else { return }
        fetchedFor = profile.id
        let uid = profile.id
        Task {
            struct Row: Decodable { let avatar_cast_id: String?; let avatar_frame: String? }
            guard let row: Row = try? await AuthService.shared.client.from("profiles")
                .select("\(AvatarSaveRules.castColumn),\(AvatarSaveRules.frameColumn)")
                .eq("id", value: uid).limit(1).single().execute().value else { return }
            ownServer = (uid, AvatarLook(castId: row.avatar_cast_id, frame: row.avatar_frame))
            if let p = AuthService.shared.profile, p.id == uid {
                let look = ownLook(p)
                record(p.username, castId: look.castId, frame: look.frame)
            }
        }
    }

    /// After Edit Profile saves: keep the local copy in step (cleared when the
    /// server took the columns, so a change on another device wins) and show the
    /// choice right away under `username`.
    func applyOwnChoice(userId: String, username: String, castId: String?, frame: String?, serverAccepted: Bool) {
        let cast = AvatarCastRules.normalize(castId)
        let ring = AvatarFrameRules.normalize(frame)
        let d = UserDefaults.standard
        if serverAccepted {
            ownServer = (userId, AvatarLook(castId: cast, frame: ring))
            d.removeObject(forKey: AvatarSaveRules.castKey(userId: userId))
            d.removeObject(forKey: AvatarSaveRules.frameKey(userId: userId))
        } else {
            // "" = chose none (keeps a stale server value from winning on this device).
            if ownServer?.uid == userId { ownServer = (userId, AvatarLook(castId: cast, frame: ring)) }
            d.set(cast ?? "", forKey: AvatarSaveRules.castKey(userId: userId))
            d.set(ring ?? "", forKey: AvatarSaveRules.frameKey(userId: userId))
        }
        if let old = ownKey, old != Self.key(username) { byName[old] = nil }
        ownKey = Self.key(username)
        record(username, castId: cast, frame: ring)
    }

    // MARK: Friends

    private func syncFriends() {
        for f in FriendsService.friends + FriendsService.incoming + FriendsService.outgoingProfiles {
            // Only rows that carry the fields: an older payload never clears a known look.
            guard f.avatar_cast_id != nil || f.avatar_frame != nil else { continue }
            record(f.username, castId: f.avatar_cast_id,
                   frame: AvatarFrameRules.effective(f.avatar_frame, level: f.level > 0 ? f.level : nil))
        }
    }
}

// MARK: - Drawing

enum AvatarCastArt {
    /// The character's own color (BotCast), purple for an unknown id.
    static func color(_ castId: String?) -> Color { Color(hex: AvatarCastRules.colorHex(castId) ?? 0x7C3AED) }

    static func mascot(_ castId: String?) -> MascotID? { AvatarCastRules.normalize(castId).flatMap(MascotID.init(rawValue:)) }

    /// The ring thickness of a frame on a `size` avatar (the face is inset by it).
    static func frameWidth(_ size: CGFloat) -> CGFloat { min(8, max(2, size * 0.075)) }
}

/// The character's hero art on a tinted rounded square in its own color (§AN6: the
/// tile shape, never a circle). Decorative: the caller's row / button carries the name.
struct CastAvatarFace: View {
    let castId: String
    let size: CGFloat
    /// Share images are always light (ShareKit).
    var alwaysLight: Bool = false

    var body: some View {
        let c = AvatarCastArt.color(castId)
        let dark = Theme.isDark && !alwaysLight
        let top = dark ? c.mixed(over: Theme.surface, 0.42) : c.wash(0.22)
        let bottom = dark ? c.mixed(over: Theme.surface, 0.62) : c.wash(0.42)
        let shape = AvatarOutline(tile: true)
        ZStack {
            shape.fill(LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom))
            if let m = AvatarCastArt.mascot(castId) {
                // The hero stands a touch low so the face sits in the middle of the tile.
                Image(m.assetName)
                    .resizable().interpolation(.high).scaledToFit()
                    .frame(width: size * 0.86, height: size * 0.86)
                    .offset(y: size * 0.06)
            }
        }
        .frame(width: size, height: size)
        .clipShape(shape)
        .overlay(shape.strokeBorder(c.opacity(0.55), lineWidth: max(1, size * 0.04)))
        .accessibilityHidden(true)
    }
}

/// A level-tier frame filling a `size` box: `art-frame-<tier>` when the art has
/// shipped, else a code-drawn metallic frame in the tier color. §AN6: frames are
/// rounded SQUARES (the tile shape) around every avatar; `circle` stays only for API
/// stability (the coming mascot renderer) and is false by default.
struct AvatarFrameRing: View {
    let frame: String
    let size: CGFloat
    var circle: Bool = false

    var body: some View {
        if let key = AvatarFrameRules.normalize(frame) {
            let art = AvatarFrameRules.artName(key)
            if ArtAsset.exists(art) {
                Image(art).resizable().interpolation(.high).scaledToFit()
                    .frame(width: size, height: size)
                    .allowsHitTesting(false).accessibilityHidden(true)
            } else if let hex = AvatarFrameRules.ringHex(key) {
                let base = Color(hex: hex)
                let light = Color.white.mixed(over: base, 0.55)
                let deep = Color.black.mixed(over: base, 0.28)
                let w = AvatarCastArt.frameWidth(size)
                let gradient = LinearGradient(colors: [light, base, deep, base, light],
                                              startPoint: .topLeading, endPoint: .bottomTrailing)
                ZStack {
                    AvatarOutline(tile: !circle).strokeBorder(gradient, lineWidth: w)
                    // A thin bright inner edge reads as polished metal.
                    AvatarOutline(tile: !circle, inset: w).strokeBorder(Color.white.opacity(0.45), lineWidth: max(0.5, w * 0.18))
                }
                .frame(width: size, height: size)
                .allowsHitTesting(false).accessibilityHidden(true)
            }
        }
    }
}

// MARK: - Edit Profile pickers

/// The pick-a-character grid: the player's own photo / initials first, then the
/// ten heroes in WORDOCIOUS order, each on its tinted circle in a mini tinted tile
/// (§A1) that squishes (§A9). `selected` nil = photo / initials.
struct CastPickerGrid: View {
    let username: String
    let photoUrl: String?
    var accentHex: String?
    var emoji: String?
    @Binding var selected: String?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        let sel = AvatarCastRules.normalize(selected)
        LazyVGrid(columns: columns, spacing: 8) {
            cell(nil, sel == nil)
            ForEach(AvatarCastRules.ids, id: \.self) { id in cell(id, sel == id) }
        }
    }

    private func cell(_ id: String?, _ isOn: Bool) -> some View {
        let accent = id == nil ? G5Accent.purple : AvatarCastArt.color(id)
        let hasPhoto = !(photoUrl?.trimmingCharacters(in: .whitespaces).isEmpty ?? true)
        let name = id.flatMap(AvatarCastRules.name) ?? (hasPhoto ? "Photo" : "Initials")
        return Button { selected = id } label: {
            VStack(spacing: 4) {
                Group {
                    if let id { CastAvatarFace(castId: id, size: 46) }
                    else { AvatarView(url: photoUrl, username: username, size: 46, accentHex: accentHex, emoji: emoji, lookup: false) }
                }
                .frame(width: 46, height: 46)
                Text(name)
                    .font(Brand.font(10, .black)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8).padding(.horizontal, 2)
            .g5Option(active: isOn, accent: accent, radius: 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name) avatar")
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

/// The frame picker: None + the five level-tier rings. Tiers above the player's
/// `level` stay locked (dimmed, a lock, "Lv N") and can't be picked.
struct AvatarFramePicker: View {
    let level: Int
    @Binding var selected: String?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)

    var body: some View {
        let sel = AvatarFrameRules.normalize(selected)
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: columns, spacing: 8) {
                cell(nil, sel == nil)
                ForEach(AvatarFrameRules.keys, id: \.self) { k in cell(k, sel == k) }
            }
            Text("Reach a new level tier to unlock its ring.")
                .font(Brand.font(10, .bold)).foregroundStyle(FinishInk.secondary)
        }
    }

    private func cell(_ key: String?, _ isOn: Bool) -> some View {
        let tier = AvatarFrameRules.tier(key)
        let unlocked = key == nil || AvatarFrameRules.isUnlocked(key, level: level)
        let accent = AvatarFrameRules.ringHex(key).map { Color(hex: $0) } ?? G5Accent.purple
        let label = tier?.label ?? "None"
        let a11y: String = {
            guard let tier else { return "No frame" }
            return unlocked ? "\(tier.label) frame" : "\(tier.label) frame, locked, reach level \(tier.minLevel)"
        }()
        return Button { if unlocked { selected = key } } label: {
            VStack(spacing: 4) {
                ZStack {
                    AvatarOutline(tile: true).fill(Theme.isDark ? accent.opacity(0.25) : accent.wash(0.14)).frame(width: 30, height: 30)
                    if let key { AvatarFrameRing(frame: key, size: 38) }
                    else { AvatarOutline(tile: true).strokeBorder(FinishInk.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [4, 3])).frame(width: 38, height: 38) }
                    if !unlocked {
                        Image(systemName: "lock.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(FinishInk.secondary)
                    }
                }
                .frame(width: 40, height: 40)
                Text(unlocked ? label : "Lv \(tier?.minLevel ?? 1)")
                    .font(Brand.font(10, .black)).foregroundStyle(FinishInk.heading)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .g5Option(active: isOn, accent: accent, radius: 14)
            .opacity(unlocked ? 1 : 0.5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.squish)
        .disabled(!unlocked)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11y)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}
