import SwiftUI
import WordociousCore

/// Themes as data (FRIDAY-QUEUE item 25): Default / Ocean / Forest / Dark read from `theme-registry.json` (the bundle
/// copy of packages/core/src/theme-registry.json; the web test checks the copies match), the way SeasonKit reads the
/// season registry. A theme skins the slots a season does: the wall (3 stops + a code-drawn glow), card, ink, accent,
/// tab bar and the living wallpaper (ambient). Season skins layer on top when Seasonal is on.
enum ThemeKit {
    struct Look: Decodable {
        let wall: [String]
        let glow: String
        let card: String
        let ink: String
        let inkSecondary: String
        let accent: String
        let tabBar: String
    }

    struct Ambient: Decodable {
        let kind: String            // tiles | bubbles | leaves
        let count: Int
        let sprites: [String]
        let size: [Double]
        let duration: [Double]
        let opacity: Double
    }

    struct Entry: Decodable {
        let id: String
        let title: String
        let subtitle: String
        let light: Look?
        let dark: Look
        let ambient: Ambient
    }

    struct Tile: Decodable { let letter: String; let color: String }

    struct SeasonalAmbient: Decodable {
        struct Bats: Decodable { let count: Int; let sprite: String; let size: [Double]; let duration: [Double] }
        struct Witch: Decodable { let sprite: String; let size: Double; let every: Double; let duration: Double }
        struct Fog: Decodable { let sprite: String; let opacity: Double; let duration: Double }
        struct Stars: Decodable { let count: Int; let color: String }
        let bats: Bats
        let witch: Witch
        let fog: Fog
        let stars: Stars
    }

    struct Seasonal: Decodable {
        let title: String
        let subtitle: String
        let previewWall: [String]
        let previewTiles: [Tile]
        let ambient: SeasonalAmbient
    }

    private struct File: Decodable { let themes: [Entry]; let seasonal: [String: Seasonal] }

    private static let file: File? = {
        guard let url = Bundle.main.url(forResource: "theme-registry", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(File.self, from: data)
    }()

    static var entries: [Entry] { file?.themes ?? [] }

    static func entry(_ id: String) -> Entry? { entries.first { $0.id == id } ?? entries.first }

    static func seasonal(_ season: String?) -> Seasonal? { season.flatMap { file?.seasonal[$0] } }

    /// The look a theme draws in a scheme (Dark is always night).
    static func look(_ id: String, dark: Bool) -> Look? {
        guard let e = entry(id) else { return nil }
        return dark || e.light == nil ? e.dark : e.light
    }

    /// The wall stops + glow to draw under a MENU page for the active theme, or nil when the page draws its own art
    /// (Default, a game screen, a season wall on top).
    static func wallLook(theme: String, seasonActive: Bool) -> Look? {
        guard theme != "default", !seasonActive else { return nil }
        return look(theme, dark: theme == "dark")
    }
}

extension ThemeKit.Look {
    var wallColors: [Color] { wall.compactMap { Color(hexString: $0) } }
    var glowColor: Color { Color(hexString: glow) ?? .white }
    var cardColor: Color { Color(hexString: card) ?? .white }
}

/// The wall drawn in code at full resolution: the registry's 3 stops top to bottom and a soft radial glow near the top.
struct ThemeWall: View {
    let look: ThemeKit.Look

    var body: some View {
        ZStack {
            LinearGradient(colors: look.wallColors, startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [look.glowColor.opacity(0.42), look.glowColor.opacity(0)],
                           center: UnitPoint(x: 0.5, y: -0.05), startRadius: 0, endRadius: 420)
        }
    }
}

/// Settings > Theme: a row's REAL mini preview (its wall + a small card with four tiles in the theme's accent).
struct ThemeWallPreview: View {
    let theme: String

    var body: some View {
        let look = ThemeKit.look(theme, dark: theme == "dark")
        let spec = SettingsPreviews.theme(theme)
        ZStack {
            if let look { ThemeWall(look: look) } else { Color.gray.opacity(0.2) }
            HStack(spacing: 2) {
                ForEach(Array(spec.tiles.enumerated()), id: \.offset) { _, t in
                    Text(t.letter)
                        .font(.system(size: 8, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .frame(width: 13, height: 13)
                        .background(RoundedRectangle(cornerRadius: 3.5, style: .continuous).fill(Color(hex: t.hex)))
                }
            }
            .padding(.horizontal, 6).padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(look?.cardColor ?? .white).shadow(color: .black.opacity(0.18), radius: 3, y: 2))
            .padding(.top, 8)
        }
        .frame(width: 74, height: 46)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// The Seasonal row's preview: the season's wall with W-O-R-D tiles in its colors.
struct SeasonalPreview: View {
    let entry: ThemeKit.Seasonal

    var body: some View {
        ZStack {
            LinearGradient(colors: entry.previewWall.compactMap { Color(hexString: $0) }, startPoint: .top, endPoint: .bottom)
            HStack(spacing: 2) {
                ForEach(Array(entry.previewTiles.enumerated()), id: \.offset) { _, t in
                    Text(t.letter)
                        .font(.system(size: 8.5, weight: .black, design: .rounded))
                        .foregroundColor(t.color.uppercased() == "#1F1030" ? Color(hexString: "#F97316") ?? .orange : .white)
                        .frame(width: 14, height: 14)
                        .background(RoundedRectangle(cornerRadius: 3.5, style: .continuous).fill(Color(hexString: t.color) ?? .orange))
                }
            }
        }
        .frame(width: 74, height: 46)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityHidden(true)
    }
}
