import SwiftUI
import WordociousCore

/// FINISH_SPEC §AN (was ART_SPEC §20's letter tile): a player with NO photo
/// showing is their build-your-own MASCOT (MascotAvatar) with their initial as the
/// white body letter — the saved config (MascotLooks), else a worn AH cast hero's
/// preset, else the deterministic default in their accent color. The one view
/// every no-photo avatar draws, so it cannot drift. (§AM2: never an emoji.)
/// The name and parameters are kept so every call site compiles unchanged.
struct LetterTileAvatar: View {
    let username: String
    var size: CGFloat = 40
    /// The player's stored accent ("#RRGGBB"; nil = never set): colors the default mascot.
    var accentHex: String? = nil
    /// FINISH_SPEC §AM2: emoji avatars are retired — kept for call-site
    /// compatibility (the stored avatar_emoji is untouched) but NEVER drawn.
    var emoji: String? = nil
    /// FINISH_SPEC §AA2: Pro players get the gold frame + the tiny crown.
    var pro: Bool = false
    /// FINISH_SPEC §AH: the worn cast hero ("w" … "s") → its mascot preset, and the
    /// level-tier frame. nil = the player's recorded look (CastAvatars, by
    /// username) when `lookup`.
    var castId: String? = nil
    var frame: String? = nil
    /// false draws exactly what is passed (Edit Profile's live, unsaved choice).
    var lookup: Bool = true
    /// FINISH_SPEC §AN: an explicit mascot; nil = the saved one (MascotLooks) when `lookup`.
    var config: AvatarConfig? = nil

    @ObservedObject private var looks = CastAvatars.shared
    @ObservedObject private var mascots = MascotLooks.shared

    /// Corner radius as a fraction of the tile's side (rings match it).
    static let cornerFraction: CGFloat = 0.24

    /// The default mascot's accent: the player's stored accent as-is (nil when
    /// unset → core's default), exactly like web / Android `defaultAvatar(name, accent)`.
    static func defaultAccentHex(username: String, accentHex: String?) -> String? {
        guard let a = accentHex?.trimmingCharacters(in: .whitespaces), !a.isEmpty else { return nil }
        return a
    }

    var body: some View {
        let look = lookup && (castId == nil || frame == nil) ? looks.lookFor(username) : nil
        let cast = AvatarCastRules.normalize(castId ?? look?.castId)
        let ring = AvatarFrameRules.normalize(frame ?? look?.frame)
        let saved = config ?? (lookup ? mascots.configFor(username) : nil)
        let shown = MascotLooks.display(saved: saved, castId: cast, frame: ring, username: username,
                                        accentHex: Self.defaultAccentHex(username: username, accentHex: accentHex))
        return MascotAvatar(config: shown, initial: AvatarCatalog.initial(username), size: size)
            .frame(width: size, height: size)
            // §AN6: the Pro gold frame + crown follows the rounded square (a "pro" frame already wears it).
            .proAvatarMark(pro && shown.frame != "pro", size: size, tile: true)
    }
}

/// The outline an avatar's ring / border / pulse follows: a circle around a
/// photo, a rounded square (§20, same 24% radius) around a letter tile.
/// Insettable so `strokeBorder` stays concentric with the tile's corners.
struct AvatarOutline: InsettableShape {
    var tile: Bool
    var inset: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: inset, dy: inset)
        guard tile else { return Circle().path(in: r) }
        let radius = max(0, min(rect.width, rect.height) * LetterTileAvatar.cornerFraction - inset)
        // Drawn from 3 o'clock, clockwise — the same start and direction as
        // Circle's path, so `.trim` progress rings behave identically.
        var p = Path()
        p.move(to: CGPoint(x: r.maxX, y: r.midY))
        p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.maxY), tangent2End: CGPoint(x: r.minX, y: r.maxY), radius: radius)
        p.addArc(tangent1End: CGPoint(x: r.minX, y: r.maxY), tangent2End: CGPoint(x: r.minX, y: r.minY), radius: radius)
        p.addArc(tangent1End: CGPoint(x: r.minX, y: r.minY), tangent2End: CGPoint(x: r.maxX, y: r.minY), radius: radius)
        p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.minY), tangent2End: CGPoint(x: r.maxX, y: r.maxY), radius: radius)
        p.closeSubpath()
        return p
    }

    func inset(by amount: CGFloat) -> AvatarOutline {
        var s = self
        s.inset += amount
        return s
    }
}
