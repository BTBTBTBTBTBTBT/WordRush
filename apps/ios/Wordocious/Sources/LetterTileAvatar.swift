import SwiftUI
import WordociousCore

/// FINISH_SPEC §AN / BJ5 (was ART_SPEC §20's letter tile): a player's avatar when the
/// call site knows only their name — drawn by AvatarView through the one resolver
/// (AvatarDirectory), so it shows the same photo / mascot / frame as their rows. Never a
/// plain letter tile, never an emoji (§AM2). The name and parameters are kept so every
/// call site compiles unchanged.
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

    /// Corner radius as a fraction of the tile's side (rings match it).
    static let cornerFraction: CGFloat = 0.24

    /// The default mascot's accent: the player's stored accent as-is (nil when
    /// unset → core's default), exactly like web / Android `defaultAvatar(name, accent)`.
    static func defaultAccentHex(username: String, accentHex: String?) -> String? {
        guard let a = accentHex?.trimmingCharacters(in: .whitespaces), !a.isEmpty else { return nil }
        return a
    }

    var body: some View {
        // FINISH_SPEC BJ5: name-only call sites resolve through the same one resolver as
        // AvatarView (the directory knows the player's photo / mascot / frame; the own
        // avatar comes from the live profile) — so a name-only avatar can never disagree
        // with the same player's row.
        AvatarView(url: nil, username: username, size: size, accentHex: accentHex, emoji: emoji, pro: pro,
                   castId: castId, frame: frame, lookup: lookup, mascot: config)
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
