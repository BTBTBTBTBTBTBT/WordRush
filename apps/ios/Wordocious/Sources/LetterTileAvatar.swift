import SwiftUI
import WordociousCore

/// ART_SPEC §20 (founder, 2026-10-02): a player with NO uploaded photo is a
/// glossy letter tile matching the mascot letters — a rounded square with a
/// thick bottom lip, a top gloss and the initials (or chosen emoji) in white
/// Nunito Black. The one tile every no-photo avatar draws, so it cannot drift.
/// Uploaded photos stay circles (AvatarView); bots keep their own art.
struct LetterTileAvatar: View {
    let username: String
    var size: CGFloat = 40
    /// The player's stored accent ("#RRGGBB"; nil = never set). A real swatch
    /// from the personalization palette wins (web tileBaseColor parity).
    var accentHex: String? = nil
    var emoji: String? = nil

    /// Corner radius as a fraction of the tile's side (rings match it).
    static let cornerFraction: CGFloat = 0.24

    var body: some View {
        let s = size
        let accent = LetterTileColor.parseHex(accentHex)
            .flatMap { v in ProfileAccent.palette.contains { $0.hex == v } ? accentHex : nil }
        let base = LetterTileColor.baseHex(username: username, accentHex: accent)
        let edge = Color(hex: LetterTileColor.darken(base, 0.22))
        let radius = s * Self.cornerFraction
        let faceH = s * 0.93
        let emo = emoji?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let letters = LetterTileColor.initials(username)

        return ZStack(alignment: .top) {
            // Body — the tile's thickness, showing as the bottom lip.
            RoundedRectangle(cornerRadius: radius).fill(edge)
            // Face.
            RoundedRectangle(cornerRadius: radius)
                .fill(LinearGradient(stops: [
                    .init(color: Color(hex: LetterTileColor.lighten(base, 0.18)), location: 0),
                    .init(color: Color(hex: base), location: 0.7),
                    .init(color: Color(hex: LetterTileColor.darken(base, 0.06)), location: 1),
                ], startPoint: .top, endPoint: .bottom))
                .frame(width: s, height: faceH)
            // Gloss over the top of the face.
            RoundedRectangle(cornerRadius: s * 0.18)
                .fill(LinearGradient(colors: [.white.opacity(0.30), .white.opacity(0)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(width: s * 0.84, height: faceH * 0.42)
                .offset(y: s * 0.08)
            // Letters / emoji, centered on the FACE.
            Group {
                if !emo.isEmpty {
                    Text(emo).font(.system(size: s * 0.5))
                } else {
                    let fontSize = s * (letters.count > 1 ? 0.42 : 0.56)
                    Text(letters)
                        .font(Brand.fixedFont(fontSize, .black))
                        .tracking(-0.02 * fontSize)
                        .foregroundStyle(.white)
                        .shadow(color: edge.opacity(0.45), radius: s * 0.02, x: 0, y: s * 0.03)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .frame(width: s, height: faceH)
        }
        .frame(width: s, height: s)
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
