import SwiftUI
import UIKit
import LinkPresentation
import WordociousCore

// FINISH_SPEC §E1 — the share images' shared pieces (finishing-touches.html
// `.sharecard`, `.sc-*`). Every share card is rendered by ImageRenderer onto a
// 1080-px canvas, so everything here is STATIC (no animation, no async images)
// and ALWAYS LIGHT: a share image looks the same whatever theme the sharer uses,
// so nothing here reads `Theme.isDark` (the in-app kits flip in dark mode). The
// sizes are the mockup's 360-px card scaled ~×2.6–3 for the 1080 canvas.

enum ShareInk {
    /// Soft numbers (§A2): Nunito Black, dark purple.
    static let number = Color(hex: 0x3B1A78)
    static let heading = Color(hex: 0x2A1650)
    static let muted = Color(hex: 0x6F5F8F)
    /// The date line (`.sc-date`).
    static let date = Color(hex: 0x5B3C96)
    static let link = Color(hex: 0x6D28D9)
}

// MARK: - Wallpaper

/// The page wallpaper (`art-wall-*`, app target only) filling the card, falling
/// back to the tint's gradient + letter tiles (`ShareArt.Background`) when the
/// image doesn't ship.
struct ShareWall: View {
    let tint: PageTint

    var body: some View {
        let wall = tint.wallpaper
        if ArtAsset.exists(wall) {
            GeometryReader { geo in
                Image(wall)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFill()
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                    // A faint white veil so dark ink and soft numbers stay crisp.
                    .overlay(Color.white.opacity(0.12))
            }
        } else {
            ShareArt.Background(tint: tint)
        }
    }
}

// MARK: - Soft numbers (light only)

/// §A2 for the share canvas: Nunito Black, #3b1a78, tabular digits, the soft
/// white text-shadow — never the theme's dark variant.
struct ShareSoftNumber: ViewModifier {
    let size: CGFloat
    var color: Color = ShareInk.number

    func body(content: Content) -> some View {
        content
            .font(Brand.fixedFont(size, .black))
            .monospacedDigit()
            .foregroundStyle(color)
            .shadow(color: .white.opacity(0.85), radius: 0, x: 0, y: max(1, size * 0.04))
            .shadow(color: Color(hex: 0x4C1D95).opacity(0.18), radius: max(2, size * 0.12), x: 0, y: max(1, size * 0.08))
    }
}

extension View {
    func shareSoftNumber(_ size: CGFloat, color: Color = ShareInk.number) -> some View {
        modifier(ShareSoftNumber(size: size, color: color))
    }
}

// MARK: - Board tray (light-only §L tray at share scale)

/// FINISH_SPEC §L's game tray drawn for the share canvas (the light branch of
/// `GameTrayChrome`, scaled ×~2.2 for 1080 px): accent wash face (won → purple,
/// lost → slate), 1.5-pt-equivalent border, darker bottom lip, top gloss, soft
/// accent shadow.
struct ShareTrayChrome: ViewModifier {
    let accent: Color
    var state: GameTrayState = .normal
    var radius: CGFloat = 44
    var padding: CGFloat = 24
    var lip: CGFloat = 9

    private var ink: Color {
        switch state {
        case .won: return Color(hex: 0x7C3AED)
        case .lost: return Color(hex: 0x6B7891)
        default: return accent
        }
    }

    private var face: Color {
        switch state {
        case .won: return Color(hex: 0x7C3AED).wash(0.13)
        case .lost: return Color(hex: 0x6B7891).wash(0.14)
        case .active: return accent.wash(0.17)
        case .normal: return accent.wash(0.11)
        }
    }

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return content
            .padding(padding)
            .background {
                ZStack(alignment: .top) {
                    shape.fill(ink.wash(0.34)).offset(y: lip)
                    shape.fill(face)
                    shape.fill(LinearGradient(colors: [Color.white.opacity(0.55), Color.white.opacity(0)],
                                              startPoint: .top, endPoint: .center))
                        .padding(4)
                    shape.strokeBorder(ink.wash(state == .normal ? 0.30 : 0.55), lineWidth: 3.5)
                }
                .shadow(color: ink.opacity(0.16), radius: 20, x: 0, y: 14)
            }
            .padding(.bottom, lip)
    }
}

extension View {
    /// §L on the share canvas: sit this board on the light game tray.
    func shareTray(accent: Color, state: GameTrayState = .normal, radius: CGFloat = 44,
                   padding: CGFloat = 24) -> some View {
        modifier(ShareTrayChrome(accent: accent, state: state, radius: radius, padding: padding,
                                 lip: max(5, radius * 0.2)))
    }
}

// MARK: - Glossy tiles (light only)

/// A share tile: the §B1 glossy tile. Colored faces (right / wrong spot / not in
/// word) are the kit's `GlossyTile` itself (theme-independent); the frosted empty
/// tile and the custom-colored tiles (Sudoku cells, Starsweep regions, ladder
/// rungs, the Hubbub center…) use the same recipe with a fixed light palette.
struct ShareTile: View {
    enum Fill {
        /// A kit face (`.correct`, `.present`, `.absent`, `.hintUsed`, `.empty`).
        case face(GlossyFace)
        /// The glossy recipe in any color.
        case color(Color)
        /// Frosted glass (white ~58% with a faint lilac rim), optionally tinted.
        case frost(Color? = nil)
    }

    let fill: Fill
    var letter: String = ""
    var size: CGFloat
    var height: CGFloat? = nil
    var letterColor: Color? = nil

    var body: some View {
        switch fill {
        case .face(let f) where f == .correct || f == .present || f == .absent:
            GlossyTile(face: f, letter: letter, width: size, height: height)
        case .face:
            frost(nil)
        case .color(let c):
            painted(TilePalette.from(c))
        case .frost(let tint):
            frost(tint)
        }
    }

    private func painted(_ p: TilePalette) -> some View {
        let h = height ?? size
        let s = min(size, h)
        let lip = max(1.5, h * 0.07)
        let shape = RoundedRectangle(cornerRadius: s * 0.22, style: .continuous)
        return ZStack(alignment: .top) {
            shape.fill(p.edge)
            ZStack(alignment: .top) {
                shape.fill(p.faceGradient)
                gloss(width: size, height: h - lip, s: s, amount: 0.5)
                glyph(s: s, h: h - lip, ink: letterColor ?? .white, shadow: .black.opacity(0.25))
            }
            .frame(width: size, height: h - lip)
        }
        .frame(width: size, height: h)
    }

    private func frost(_ tint: Color?) -> some View {
        let h = height ?? size
        let s = min(size, h)
        let lip = max(1.5, h * 0.07)
        let shape = RoundedRectangle(cornerRadius: s * 0.22, style: .continuous)
        return ZStack(alignment: .top) {
            shape.fill((tint ?? Color(hex: 0xD8C8F3)).wash(tint == nil ? 1 : 0.45).opacity(0.6))
            ZStack(alignment: .top) {
                shape.fill(tint.map { $0.wash(0.12) } ?? Color.white.opacity(0.62))
                shape.strokeBorder((tint ?? Color(hex: 0x7C3AED)).opacity(tint == nil ? 0.16 : 0.32),
                                   lineWidth: max(1, s * 0.035))
                gloss(width: size, height: h - lip, s: s, amount: 0.35)
                glyph(s: s, h: h - lip, ink: letterColor ?? ShareInk.number, shadow: .clear)
            }
            .frame(width: size, height: h - lip)
        }
        .frame(width: size, height: h)
    }

    private func gloss(width: CGFloat, height: CGFloat, s: CGFloat, amount: Double) -> some View {
        RoundedRectangle(cornerRadius: s * 0.18, style: .continuous)
            .fill(LinearGradient(colors: [Color.white.opacity(amount), Color.white.opacity(0)],
                                 startPoint: .top, endPoint: .bottom))
            .frame(width: width * 0.84, height: height * 0.38)
            .padding(.top, height * 0.06)
    }

    @ViewBuilder
    private func glyph(s: CGFloat, h: CGFloat, ink: Color, shadow: Color) -> some View {
        if !letter.isEmpty {
            Text(letter)
                .font(Brand.fixedFont(s * 0.56, .black))
                .foregroundStyle(ink)
                .shadow(color: shadow, radius: s * 0.02, x: 0, y: s * 0.03)
                .lineLimit(1).minimumScaleFactor(0.5)
                .frame(width: size, height: h)
        }
    }
}

// MARK: - Stat windows (`.sc-stats`)

/// One tinted stat window: a 6-pt (×2.6) colored top bar, a soft number and a
/// small caps label in the window's ink.
struct ShareStatWindow: View {
    enum Tone {
        case purple, blue, gold, pink, teal, green

        var tint: Color {
            switch self {
            case .purple: return Color(hex: 0xF5EEFF)
            case .blue: return Color(hex: 0xEAF2FF)
            case .gold: return Color(hex: 0xFFF5DF)
            case .pink: return Color(hex: 0xFFEEF6)
            case .teal: return Color(hex: 0xE6FAF6)
            case .green: return Color(hex: 0xEDF9EA)
            }
        }
        var line: Color {
            switch self {
            case .purple: return Color(hex: 0xE2D3FF)
            case .blue: return Color(hex: 0xCFE0FF)
            case .gold: return Color(hex: 0xF8E2B4)
            case .pink: return Color(hex: 0xFBCFE3)
            case .teal: return Color(hex: 0xBDEDE3)
            case .green: return Color(hex: 0xCBEBC2)
            }
        }
        var bar: [Color] {
            switch self {
            case .purple: return [Color(hex: 0x7C3AED), Color(hex: 0xA855F7)]
            case .blue: return [Color(hex: 0x0A6CFF), Color(hex: 0x60A5FA)]
            case .gold: return [Color(hex: 0xF5A524), Color(hex: 0xFFD166)]
            case .pink: return [Color(hex: 0xEC4899), Color(hex: 0xF9A8D4)]
            case .teal: return [Color(hex: 0x0D9488), Color(hex: 0x5EEAD4)]
            case .green: return [Color(hex: 0x16A34A), Color(hex: 0x86EFAC)]
            }
        }
        var label: Color {
            switch self {
            case .purple: return Color(hex: 0x6D28D9)
            case .blue: return Color(hex: 0x2456A8)
            case .gold: return Color(hex: 0xA2560C)
            case .pink: return Color(hex: 0xBE185D)
            case .teal: return Color(hex: 0x0F766E)
            case .green: return Color(hex: 0x15803D)
            }
        }
    }

    let value: String
    let label: String
    let tone: Tone
    var height: CGFloat = 104

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 38, style: .continuous)
        let bar: CGFloat = 16
        VStack(spacing: height * 0.02) {
            Text(value)
                .shareSoftNumber(height * 0.44)
                .lineLimit(1).minimumScaleFactor(0.5)
            Text(label)
                .font(Brand.fixedFont(height * 0.2, .black))
                .tracking(height * 0.2 * 0.12)
                .foregroundStyle(tone.label)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .padding(.top, bar)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background(
            ZStack(alignment: .top) {
                shape.fill(tone.tint)
                LinearGradient(colors: tone.bar, startPoint: .leading, endPoint: .trailing).frame(height: bar)
            }
            .clipShape(shape)
        )
        .overlay(shape.strokeBorder(tone.line, lineWidth: 4))
        .shadow(color: Color(hex: 0x3C1E6E).opacity(0.12), radius: 18, x: 0, y: 14)
    }
}

/// The three windows in a row.
struct ShareStatRow: View {
    let items: [(value: String, label: String, tone: ShareStatWindow.Tone)]
    var height: CGFloat = 104

    var body: some View {
        HStack(spacing: 18) {
            ForEach(0..<items.count, id: \.self) { i in
                ShareStatWindow(value: items[i].value, label: items[i].label, tone: items[i].tone, height: height)
            }
        }
    }
}

// MARK: - The date line (`.sc-date`)

struct ShareDateLine: View {
    let text: String
    var size: CGFloat = 30

    var body: some View {
        Text(text.uppercased())
            .font(Brand.fixedFont(size, .black))
            .tracking(size * 0.14)
            .foregroundStyle(ShareInk.date)
            .shadow(color: .white.opacity(0.8), radius: 0, x: 0, y: 2)
            .lineLimit(1).minimumScaleFactor(0.5)
    }
}

// MARK: - Footer (`.sc-foot`)

/// A cast pose with NO bubble behind it + "Can you beat me?" / "wordocious.com".
struct ShareFooter: View {
    let character: MascotID
    var pose: String = "victory"
    var line: String = "Can you beat me?"
    var height: CGFloat = 110

    var body: some View {
        HStack(spacing: 26) {
            PoseImage(character, pose, height: height)
                .shadow(color: Color(hex: 0x3C1E6E).opacity(0.22), radius: 9, x: 0, y: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(line)
                    .font(Brand.fixedFont(height * 0.36, .black))
                    .foregroundStyle(ShareInk.heading)
                    .shadow(color: .white.opacity(0.8), radius: 0, x: 0, y: 2)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text("wordocious.com")
                    .font(Brand.fixedFont(height * 0.28, .black))
                    .foregroundStyle(ShareInk.link)
                    .shadow(color: .white.opacity(0.8), radius: 0, x: 0, y: 2)
            }
        }
    }
}

// MARK: - Character choice (§A7)

enum ShareCast {
    /// A cast member that is NOT `avoid` (the game's / page's host), rotated
    /// deterministically by `salt` (the mode), so each game's card has its own
    /// footer character and never repeats its title host.
    static func footer(avoiding avoid: [MascotID], salt: String) -> MascotID {
        let cast = Mascots.cast
        var h: UInt32 = 2166136261
        for b in salt.utf8 { h = (h ^ UInt32(b)) &* 16777619 }
        let start = Int(h % UInt32(cast.count))
        for k in 0..<cast.count {
            let m = cast[(start + k) % cast.count]
            if !avoid.contains(m) { return m }
        }
        return .w
    }

    /// The pose for a result: a win cheers, a loss is a good sport.
    static func pose(won: Bool) -> String { won ? "victory" : "goodgame" }

    /// "FRIDAY, OCT 2" — the weekday of today plus the card's short date.
    static func dateLine(_ dateStr: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEEE"
        return "\(f.string(from: Date())), \(dateStr)"
    }

    /// The 3D game icon (`game-<catalog id>`) for a DB mode key, when it ships.
    static func gameIcon(dbKey: String) -> String? {
        guard let id = ModeGen.byDbKey(dbKey)?.id else { return nil }
        let name = "game-\(id)"
        return ArtAsset.exists(name) ? name : nil
    }
}

/// A mini game-card icon tile (§A1): 13% accent wash, 34% border, a 4-pt (×2.4)
/// inset accent top bar, soft accent shadow; the 3D game icon inside.
struct ShareIconTile: View {
    let accent: Color
    let icon: String?
    var fallback: String = ""
    var size: CGFloat = 72

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
        ZStack {
            ZStack(alignment: .top) {
                shape.fill(accent.wash(0.13))
                accent.frame(height: max(4, size * 0.12))
            }
            .clipShape(shape)
            shape.strokeBorder(accent.wash(0.34), lineWidth: max(1.5, size * 0.04))
            if let icon {
                Image(icon).resizable().interpolation(.high).scaledToFit()
                    .frame(width: size * 0.74, height: size * 0.74)
                    .padding(.top, size * 0.06)
            } else {
                Text(fallback).font(Brand.fixedFont(size * 0.4, .black)).foregroundStyle(accent)
                    .lineLimit(1).minimumScaleFactor(0.5)
            }
        }
        .frame(width: size, height: size)
        .shadow(color: accent.opacity(0.2), radius: size * 0.1, x: 0, y: size * 0.05)
    }
}

/// The W / L / ✓ badge art (icon3d-badge-*), falling back to a ✓ / ✗ glyph.
struct ShareResultBadge: View {
    let won: Bool
    var size: CGFloat = 56

    var body: some View {
        let name = won ? "icon3d-badge-w" : "icon3d-badge-l"
        if ArtAsset.exists(name) {
            Image(name).resizable().interpolation(.high).scaledToFit().frame(width: size, height: size)
        } else {
            Text(won ? "✓" : "✗").font(Brand.fixedFont(size * 0.86, .black))
                .foregroundStyle(won ? Color(hex: 0x7C3AED) : Color(hex: 0xDC2626))
        }
    }
}

// MARK: - §S3 The cast IS the wordmark

/// The ten hero images standing together in WORDOCIOUS order (each overlapping its
/// neighbor by ~6%, like the Home cast header row), spanning `width`, on a soft
/// ground shadow, with one tiny "wordocious.com" line under it. The only wordmark
/// on a share image.
struct ShareCastWordmark: View {
    var width: CGFloat = 972
    var linkSize: CGFloat = 26

    /// One hero's side for a row of ten at `width` with the 6% overlap.
    static func heroSide(_ width: CGFloat) -> CGFloat { width / (10 - 9 * 0.06) }
    /// The block's full height (row + shadow + link line).
    static func height(_ width: CGFloat, linkSize: CGFloat = 26) -> CGFloat {
        heroSide(width) + 10 + linkSize * 1.3
    }

    var body: some View {
        let side = Self.heroSide(width)
        VStack(spacing: 10) {
            ZStack(alignment: .bottom) {
                // The soft ground shadow they stand on.
                Ellipse()
                    .fill(RadialGradient(colors: [Color(hex: 0x3C1E6E).opacity(0.28), Color(hex: 0x3C1E6E).opacity(0)],
                                         center: .center, startRadius: 0, endRadius: width * 0.5))
                    .frame(width: width * 0.98, height: side * 0.30)
                    .offset(y: side * 0.10)
                HStack(spacing: -side * 0.06) {
                    ForEach(Mascots.cast, id: \.self) { m in
                        // FINISH_SPEC §X: the season's skins (Halloween) when active.
                        Image(CastSkin.assetName(for: m))
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: side, height: side)
                    }
                }
            }
            .frame(width: width, height: side)
            Text("wordocious.com")
                .font(Brand.fixedFont(linkSize, .black))
                .tracking(linkSize * 0.04)
                .foregroundStyle(ShareInk.link)
                .shadow(color: .white.opacity(0.85), radius: 0, x: 0, y: 2)
                .frame(height: linkSize * 1.3)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - §S1 Image-only share sheet

#if canImport(UIKit)
/// One share image for the activity sheet: the PNG as a UIImage (so Messages /
/// WhatsApp send a picture, never a link card), with sheet metadata naming it
/// "Wordocious-<Game>.png".
final class ShareImageItem: NSObject, UIActivityItemSource {
    let image: UIImage
    let name: String

    init(image: UIImage, game: String) {
        self.image = image
        let slug = game.components(separatedBy: CharacterSet.alphanumerics.inverted).joined()
        self.name = "Wordocious-\(slug.isEmpty ? "Share" : slug).png"
    }

    func activityViewControllerPlaceholderItem(_ vc: UIActivityViewController) -> Any { image }

    func activityViewController(_ vc: UIActivityViewController, itemForActivityType type: UIActivity.ActivityType?) -> Any? {
        image
    }

    func activityViewControllerLinkMetadata(_ vc: UIActivityViewController) -> LPLinkMetadata? {
        let meta = LPLinkMetadata()
        meta.title = name
        meta.imageProvider = NSItemProvider(object: image)
        return meta
    }
}

extension ShareService {
    /// §S1: present the share sheet with the image(s) ONLY — no URL, no text.
    @MainActor
    static func presentImages(_ images: [UIImage], game: String) {
        present(items: images.map { ShareImageItem(image: $0, game: game) })
    }

    /// Render a share card at its own size (scale 1, a 1080-px canvas).
    @MainActor
    static func renderCard<V: View>(_ view: V, size: CGSize) -> UIImage? {
        let renderer = ImageRenderer(content: view)
        renderer.proposedSize = .init(size)
        renderer.scale = 1
        return renderer.uiImage
    }

    /// A view's natural (ideal) size, for fitting a board block to the canvas (§S2).
    @MainActor
    static func naturalSize<V: View>(_ view: V) -> CGSize {
        let host = UIHostingController(rootView: view.fixedSize())
        return host.sizeThatFits(in: CGSize(width: 20_000, height: 20_000))
    }
}
#endif
