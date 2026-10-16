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

// MARK: - The night frame (founder 10-16, option B)

/// Share cards wear the game's night style: the `#1A0E2E` → `#2E1440` gradient, title art up top, an info line in
/// `#E2D6FF`, dark chips and panels, the lit cast footer. Cards opt in through `.environment(\.shareNight, true)` so the
/// light-only pieces below (tiles, tray) switch with them.
enum ShareNight {
    static let top = Color(hex: 0x1A0E2E)
    static let bottom = Color(hex: 0x2E1440)
    /// The info line and soft pills.
    static let info = Color(hex: 0xE2D6FF)
    /// The status line under the info line (lavender).
    static let lavender = Color(hex: 0xC4B0FF)
    /// Bright, readable wordocious.com.
    static let link = Color(hex: 0xEDE6FF)
    /// Dark chip / panel fills and the gold rank ink.
    static let panel = Color(hex: 0x2A1850)
    static let panelDeep = Color(hex: 0x21113F)
    static let gold = Color(hex: 0xFFC83D)
    static let text = Color(hex: 0xF3EEFF)
    static let muted = Color(hex: 0xB9A9E0)
}

private struct ShareNightKey: EnvironmentKey { static let defaultValue = false }

extension EnvironmentValues {
    var shareNight: Bool {
        get { self[ShareNightKey.self] }
        set { self[ShareNightKey.self] = newValue }
    }
}

/// The night gradient, top to bottom.
struct ShareNightBackground: View {
    var body: some View {
        LinearGradient(colors: [ShareNight.top, ShareNight.bottom], startPoint: .top, endPoint: .bottom)
    }
}

/// The info line under the title: one line, caps tracking, `#E2D6FF`, heavy ~27 px. `pill` sits it in a soft white 10% pill
/// (the leaderboard cards).
struct ShareNightInfoLine: View {
    let text: String
    var size: CGFloat = 27
    var pill = false

    var body: some View {
        let t = Text(pill ? text : text.uppercased())
            .font(Brand.fixedFont(size, .heavy))
            .tracking(size * 0.06)
            .foregroundStyle(ShareNight.info)
            .lineLimit(1).minimumScaleFactor(0.5)
        if pill {
            t.padding(.horizontal, 26).frame(height: size * 2.1)
                .background(Capsule().fill(Color.white.opacity(0.10)))
        } else {
            t
        }
    }
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

    @Environment(\.shareNight) private var night

    private var nightTray: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        let rim = state == .lost ? Color(hex: 0x5A5F78) : Color(hex: 0x6D3FD0)
        return ZStack(alignment: .top) {
            // A fill-only rim (no outline stroke): the lighter shape peeks out around the dark face.
            shape.fill(rim.opacity(0.85))
            shape.fill(LinearGradient(colors: [Color(hex: 0x2B1760), Color(hex: 0x21113F)], startPoint: .top, endPoint: .bottom))
                .padding(4)
        }
        .shadow(color: rim.opacity(0.35), radius: 26, x: 0, y: 12)
    }

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        if night {
            return AnyView(content.padding(padding).background { nightTray })
        }
        return AnyView(content
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
            .padding(.bottom, lip))
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
    @Environment(\.shareNight) private var night

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

    private func frost(_ tint: Color?) -> AnyView {
        let h = height ?? size
        let s = min(size, h)
        let lip = max(1.5, h * 0.07)
        let shape = RoundedRectangle(cornerRadius: s * 0.22, style: .continuous)
        if night {
            // Night: a soft lilac glass tile (white ~15% face over a deeper lip), light glyphs, no rim stroke.
            return AnyView(ZStack(alignment: .top) {
                shape.fill((tint ?? Color(hex: 0x7C5CD6)).opacity(0.30))
                ZStack(alignment: .top) {
                    shape.fill(tint.map { $0.opacity(0.42) } ?? Color.white.opacity(0.17))
                    gloss(width: size, height: h - lip, s: s, amount: 0.16)
                    glyph(s: s, h: h - lip, ink: letterColor ?? ShareNight.text, shadow: .clear)
                }
                .frame(width: size, height: h - lip)
            }
            .frame(width: size, height: h))
        }
        return AnyView(ZStack(alignment: .top) {
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
        .frame(width: size, height: h))
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

// MARK: - The title band (founder 10-06)

/// The card's title at the top: the WHOLE title art at exactly `size` (Core
/// ShareCardPlan.titleSize — the card width inside 90-px margins, never cropped),
/// or, when the art doesn't ship, `text` lettered in `color` in the same band.
struct ShareTitleBand: View {
    let asset: String?
    let size: CGSize
    let text: String
    var color: Color = Color(hex: 0x7C3AED)

    var body: some View {
        Group {
            if let asset, ArtAsset.exists(asset) {
                Image(asset)
                    .resizable()
                    .interpolation(.high)
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size.width, height: size.height)
            } else {
                Text(text)
                    .font(Brand.fixedFont(min(84, size.height * 0.8), .black)).foregroundStyle(color)
                    .shadow(color: .white.opacity(0.85), radius: 0, x: 0, y: 3)
                    .lineLimit(1).minimumScaleFactor(0.5)
                    .frame(width: CGFloat(ShareCardPlan.titleMaxW), height: size.height)
            }
        }
        .accessibilityHidden(true)
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
    var width: CGFloat = 994
    var linkSize: CGFloat = CGFloat(ShareCardPlan.castLinkSize)
    /// Night frame: a wide soft light under the row (white ~12%) so the cast reads on the dark gradient, and a bright,
    /// solid wordocious.com (`#EDE6FF`, black weight).
    @Environment(\.shareNight) private var night

    /// Clear space between the cast's feet (and shadow) and the link line.
    static let linkGap: CGFloat = 16

    /// One hero's side for a row of ten at `width` with the 6% overlap.
    static func heroSide(_ width: CGFloat) -> CGFloat { width / (10 - 9 * 0.06) }
    /// The block's full height (row + shadow + link line).
    static func height(_ width: CGFloat, linkSize: CGFloat = CGFloat(ShareCardPlan.castLinkSize)) -> CGFloat {
        heroSide(width) + linkGap + linkSize * 1.3
    }

    var body: some View {
        let side = Self.heroSide(width)
        VStack(spacing: Self.linkGap) {
            ZStack(alignment: .bottom) {
                if night {
                    // The soft light under the cast (a wide radial, white ~12%).
                    Ellipse()
                        .fill(RadialGradient(colors: [Color.white.opacity(0.12), Color.white.opacity(0)],
                                             center: .center, startRadius: 0, endRadius: width * 0.5))
                        .frame(width: width * 1.04, height: side * 1.0)
                }
                // The soft ground shadow they stand on.
                Ellipse()
                    .fill(RadialGradient(colors: [(night ? Color.black : Color(hex: 0x3C1E6E)).opacity(night ? 0.4 : 0.28),
                                                  Color.black.opacity(0)],
                                         center: .center, startRadius: 0, endRadius: width * 0.5))
                    .frame(width: width * 0.98, height: side * 0.2)
                    .offset(y: side * 0.01)
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
                .foregroundStyle(night ? ShareNight.link : ShareInk.link)
                .shadow(color: night ? Color(hex: 0xA78BFA).opacity(0.5) : .white.opacity(0.85),
                        radius: night ? 8 : 0, x: 0, y: night ? 0 : 2)
                .frame(height: linkSize * 1.3)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Night chips + score breakdown (finished-game cards)

/// One stat chip like the finished screen's: a dark pill, a colored top bar, the value in white heavy digits and its
/// small label beside it ("0 mistakes", "0:56 time", "2,319 pts"). Fills only, no outline.
struct ShareNightChip: View {
    let value: String
    let label: String
    let bar: Color
    var height: CGFloat = 92

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: height * 0.5, style: .continuous)
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(value).font(Brand.fixedFont(height * 0.48, .black)).monospacedDigit().foregroundStyle(.white)
            Text(label).font(Brand.fixedFont(height * 0.27, .heavy)).foregroundStyle(ShareNight.info)
        }
        .lineLimit(1).minimumScaleFactor(0.5)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background(
            ZStack(alignment: .top) {
                shape.fill(LinearGradient(colors: [Color(hex: 0x2D1B5E), Color(hex: 0x24144A)], startPoint: .top, endPoint: .bottom))
                // The colored bar rides the top edge, inset so it sits inside the pill's round ends.
                Capsule().fill(bar).frame(width: height * 2.0, height: 8).padding(.top, 2)
            }
            .clipShape(shape)
        )
    }
}

/// The three chips in a row.
struct ShareNightChipRow: View {
    let items: [(value: String, label: String, bar: Color)]
    var height: CGFloat = 92

    var body: some View {
        HStack(spacing: 18) {
            ForEach(0..<items.count, id: \.self) { i in
                ShareNightChip(value: items[i].value, label: items[i].label, bar: items[i].bar, height: height)
            }
        }
    }
}

/// The SCORE BREAKDOWN panel exactly like the finished screen: a purple top bar, the title row with the total, then each
/// line with its detail and value (ScoreBreakdownView.lines is the one source of the rows).
struct ShareNightBreakdown: View {
    let total: Int
    let lines: [ScoreBreakdownView.ScoreLine]

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 30, style: .continuous)
        VStack(spacing: 0) {
            Rectangle().fill(LinearGradient(colors: [Color(hex: 0x7C3AED), Color(hex: 0xA855F7)], startPoint: .leading, endPoint: .trailing))
                .frame(height: 9)
            VStack(spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    Text("SCORE BREAKDOWN").font(Brand.fixedFont(22, .black)).tracking(2)
                        .foregroundStyle(ShareNight.info)
                    Spacer()
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(total.formatted()).font(Brand.fixedFont(48, .black)).monospacedDigit().foregroundStyle(.white)
                        Text("PTS").font(Brand.fixedFont(22, .black)).tracking(2).foregroundStyle(ShareNight.info)
                    }
                }
                .frame(height: 64)
                ForEach(0..<lines.count, id: \.self) { i in
                    let l = lines[i]
                    let abs = Swift.abs((l.value * 100).rounded() / 100)
                    let sign = l.value > 0 ? "+" : l.value < 0 ? "−" : ""
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(l.label).font(Brand.fixedFont(29, .black))
                            .foregroundStyle(l.pure ? Color(hex: 0xB89BFF) : ShareNight.text)
                        if !l.detail.isEmpty {
                            Text(l.detail).font(Brand.fixedFont(24, .bold)).foregroundStyle(ShareNight.muted)
                                .lineLimit(1).minimumScaleFactor(0.6)
                        }
                        Spacer(minLength: 8)
                        Text("\(sign)\(Int(abs).formatted())").font(Brand.fixedFont(30, .black)).monospacedDigit()
                            .foregroundStyle(l.value < 0 ? Color(hex: 0xFF7A8A) : ShareNight.text)
                    }
                    .frame(height: 40)
                }
            }
            .padding(.horizontal, 30).padding(.top, 12).padding(.bottom, 16)
        }
        .background(shape.fill(LinearGradient(colors: [Color(hex: 0x2B1760), Color(hex: 0x21113F)], startPoint: .top, endPoint: .bottom)))
        .clipShape(shape)
    }

    /// The panel's natural height: bar + padding + title row + one row per line.
    static func height(lineCount: Int) -> CGFloat { 9 + 12 + 64 + CGFloat(lineCount) * 40 + 16 }
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
        // The custom share sheet renders a card by running the call site's share closure; keep the images, show nothing.
        if ShareCaptureState.active { ShareCapture.append(images); return }
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

#if DEBUG && canImport(UIKit)
// MARK: - DEBUG: render the sample share cards (`-shareCardRender`)

/// Founder 10-16 night frame: with the `-shareCardRender` launch argument the app renders sample cards (the leaderboard
/// podium cards and finished-game cards) to `Documents/share-renders/<name>.png` two seconds after launch. Debug only;
/// copy them out with `xcrun simctl get_app_container <udid> <bundle> data`.
enum ShareCardDemo {
    static var requested: Bool { ProcessInfo.processInfo.arguments.contains("-shareCardRender") }

    @MainActor
    static func runIfRequested() {
        guard requested else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { run() }
    }

    @MainActor
    static func run() {
        let saved = UserDefaults.standard.string(forKey: CastSkin.debugKey)
        for (suffix, season) in [("halloween", "halloween"), ("standard", "off")] {
            UserDefaults.standard.set(season, forKey: CastSkin.debugKey)
            CastSkin.invalidate()
            renderSet(suffix: suffix)
        }
        if let saved { UserDefaults.standard.set(saved, forKey: CastSkin.debugKey) } else { UserDefaults.standard.removeObject(forKey: CastSkin.debugKey) }
        CastSkin.invalidate()
    }

    @MainActor
    private static func renderSet(suffix: String) {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("share-renders")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        func save(_ name: String, _ image: UIImage?) {
            guard let data = image?.pngData() else { print("ShareCardDemo: \(name) FAILED"); return }
            try? data.write(to: dir.appendingPathComponent("ios-\(name)-\(suffix).png"))
            print("ShareCardDemo: \(name) \(Int(image!.size.width))x\(Int(image!.size.height))")
        }
        let day = "2026-10-16"
        let chip = "Oct 16, 2026 · #193 · as of 9:53 AM"
        func lb(_ rows: [LbShareRow], you: LbShareRow? = nil, youLine: String? = nil, variant: LbShareVariant = .solo) -> LbShareInput {
            LbShareInput(variant: variant, shareMode: "Starsweep", gameModeRaw: GameMode.regions.rawValue,
                         modeAccent: Color(hex: 0x7C3AED), modeChip: "Starsweep", dateChip: chip, rows: rows, you: you,
                         youRankLine: youLine, delta: nil, footer: "", day: day)
        }
        func r(_ rank: Int, _ name: String, _ score: String, _ sub: String, you: Bool = false) -> LbShareRow {
            LbShareRow(rank: rank, name: name, scoreDisplay: score, subline: sub, isYou: you, userId: "demo-\(name)", username: name)
        }
        // Leaderboards
        let two = lb([r(1, "MJT", "2,320", "0 mistakes · 0:55 · Win"), r(2, "BMT", "2,319", "0 mistakes · 0:56 · Win", you: true)])
        let cardTwo = LeaderboardShareCardView(input: two)
        save("leaderboard-2-players", ShareService.renderCard(cardTwo, size: cardTwo.size))
        let six = lb([r(1, "MJT", "2,320", "0 mistakes · 0:55 · Win"), r(2, "WordWizard", "2,301", "0 mistakes · 1:02 · Win"),
                      r(3, "VowelMaven", "2,255", "1 mistake · 1:12 · Win"), r(4, "Jasson", "2,201", "1 mistake · 1:30 · Win"),
                      r(5, "Cloud9", "2,188", "2 mistakes · 1:24 · Win")],
                     you: r(7, "BMT", "1,980", "2 mistakes · 1:48 · Win", you: true), youLine: "#7 of 23")
        let cardSix = LeaderboardShareCardView(input: six)
        save("leaderboard-6-players-you-outside", ShareService.renderCard(cardSix, size: cardSix.size))

        // Finished games
        func finished(_ kind: ShareCardView.Kind, mode: GameMode, label: String, accent: Color, won: Bool = true,
                      guesses: Int, maxGuesses: Int, time: Int, points: Int?, number: Int? = 24, reveal: Bool = true,
                      letters: [[String]]? = nil, hints: Int? = 0) -> (ShareCardView) {
            var c = ShareCardView(kind: kind, modeLabel: label, accent: accent, won: won, guesses: guesses, maxGuesses: maxGuesses,
                                  timeSeconds: time, dateStr: "Oct 16", reveal: reveal, letters: letters, mode: mode, points: points)
            c.puzzleNumber = number
            c.hintsUsed = hints
            c.boardNatural = ShareService.naturalSize(c.boardBody)
            return c
        }
        func saveCard(_ name: String, _ c: ShareCardView) { save(name, ShareService.renderCard(c, size: c.size)) }

        if let p = generateRegions("demo-starsweep", n: 8) {
            let sol = Array(p.solution)
            var board = ""
            for rr in 0..<8 { for cc in 0..<8 { board += (String(cc) == String(sol[rr])) ? "*" : "0" } }
            let c = finished(.regions(n: 8, regions: p.regions, board: board, hintMask: String(repeating: "0", count: 64),
                                      mistakes: 0, sizeLabel: "8 × 8", puzzleNumber: 24),
                             mode: .regions, label: "STARSWEEP", accent: Color(hex: 0x7C3AED), guesses: 1, maxGuesses: 4,
                             time: 56, points: 2319)
            saveCard("starsweep-finished", c)
        }
        let word = Array("CRANE")
        let grid: [[TileState]] = [[.absent, .present, .absent, .absent, .correct], [.absent, .correct, .present, .absent, .correct],
                                   [.correct, .correct, .correct, .correct, .correct]]
        let rowsL = [Array("SLATE"), Array("BRAKE"), word].map { $0.map(String.init) }
        let classic = finished(.single(grid: grid), mode: .duel, label: "CLASSIC", accent: Color(hex: 0x7C3AED),
                               guesses: 3, maxGuesses: 6, time: 74, points: 2140, letters: rowsL)
        saveCard("classic-finished", classic)
        let kindred = finished(.groups(solvedTiers: [1, 2, 3, 4], mistakes: 1, maxMistakes: 4, puzzleNumber: 24),
                               mode: .groups, label: "KINDRED", accent: Color(hex: 0x9F1239), guesses: 5, maxGuesses: 8,
                               time: 131, points: 1880)
        saveCard("kindred-finished", kindred)
        let hub = finished(.hub(rankName: "Genius", pct: 78, wordsFound: 41, wordCount: 52, pangramsFound: 2, puzzleNumber: 24),
                           mode: .hub, label: "HUBBUB", accent: Color(hex: 0xC026D3), guesses: 41, maxGuesses: 52,
                           time: 600, points: 1750)
        saveCard("hubbub-finished", hub)
        let stages = [GauntletStageShare(name: "Classic", won: true, guesses: 4, boardsSolved: 1, totalBoards: 1),
                      GauntletStageShare(name: "QuadWord", won: true, guesses: 7, boardsSolved: 4, totalBoards: 4),
                      GauntletStageShare(name: "Six", won: true, guesses: 5, boardsSolved: 1, totalBoards: 1),
                      GauntletStageShare(name: "Seven", won: false, guesses: 8, boardsSolved: 0, totalBoards: 1)]
        saveCard("gauntlet-finished", finished(.gauntlet(stages: stages, stagesCompleted: 3, totalStages: 4), mode: .gauntlet,
                                               label: "GAUNTLET", accent: Color(hex: 0x7C3AED), won: false, guesses: 24, maxGuesses: 24,
                                               time: 412, points: 640))
        let givens = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
        let solved = "534678912672195348198342567859761423426853791713924856961537284287419635345286179"
        saveCard("sudoku-finished", finished(.sudoku(givens: givens, board: solved, hintMask: String(repeating: "0", count: 81),
                                                     mistakes: 1, difficulty: "Medium", puzzleNumber: 24),
                                             mode: .sudoku, label: "SUDOCIOUS", accent: Color(hex: 0x2563EB), guesses: 2, maxGuesses: 4,
                                             time: 421, points: 1780))
    }
}
#endif
