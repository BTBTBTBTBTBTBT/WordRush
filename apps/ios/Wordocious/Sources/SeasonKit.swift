import SwiftUI
import WordociousCore

/// The season registry on iOS (docs/design/brand/seasons/README.md "How to add a season").
/// `season-registry.json` (the bundle copy of packages/core/src/season-registry.json; the web
/// test checks the copies match) says, per season, which shipped art replaces which normal art —
/// the cast, a title per game / screen, the walls, the props pair, the Home banner, extras — and
/// a palette (button tints, wall fallback stops). Which season is active is `CastSkin.season`
/// (the admin preview first, else core `Season.current` on the local date). Every lookup falls
/// back to the normal art when the slot is missing or the image set doesn't ship, so a partial
/// season never leaves a hole. Views that should flip live with the admin picker read
/// `@AppStorage(CastSkin.debugKey)` (it re-renders them).
enum SeasonKit {
    struct Palette: Decodable {
        let accent: String
        let buttonTint: String
        let quietTint: String
        let wallLight: [String]
        let wallDark: [String]
    }

    struct Slots: Decodable {
        let cast: String?
        let titles: [String: String]?
        let walls: [String: String]?
        let props: [String]?
        let banner: String?
        let extras: [String: String]?
    }

    struct Entry: Decodable {
        let id: String
        let title: String
        let palette: Palette
        let slots: Slots
        let surfaces: Surfaces?
        let surfaceVariants: [String: Surfaces]?
    }

    /// The season's windows (registry `surfaces`): the page cards, the Home hero card, the game
    /// cards' drip caps and the game board panel recolor so the whole screen reads seasonal, not
    /// just the wall. Every slot is optional — a missing one keeps the normal look.
    struct Surfaces: Decodable {
        let tone: String?
        let card: String?
        let cardOpacity: Double?
        let hero: String?
        let heroOpacity: Double?
        let raised: String?
        let cap: [String]?
        let capTint: Double?
        let glow: String?
        let text: String?
        let textMuted: String?
        let textSecondary: String?
        let headline: [String]?
        let bannerGlow: String?
        let cobweb: String?
    }

    /// The resolved surfaces, colors parsed once.
    struct Look {
        let dark: Bool
        let card: Color?
        let cardOpacity: Double
        let hero: Color?
        let heroOpacity: Double
        let raised: Color?
        let cap: [Color]?
        let capTint: Double
        let glow: Color?
        let text: Color?
        let textMuted: Color?
        let textSecondary: Color?
        let headline: [Color]?
        let bannerGlow: Color?
        let cobweb: Color?

        init(_ s: Surfaces) {
            func c(_ h: String?) -> Color? { h.flatMap { Color(hexString: $0) } }
            dark = s.tone == "dark"
            card = c(s.card); cardOpacity = s.cardOpacity ?? 1
            hero = c(s.hero); heroOpacity = s.heroOpacity ?? 1
            raised = c(s.raised)
            let caps = (s.cap ?? []).compactMap { Color(hexString: $0) }
            cap = caps.count == 3 ? caps : nil
            capTint = s.capTint ?? 0
            glow = c(s.glow)
            text = c(s.text); textMuted = c(s.textMuted); textSecondary = c(s.textSecondary)
            let h = (s.headline ?? []).compactMap { Color(hexString: $0) }
            headline = h.count == 5 ? h : nil
            bannerGlow = c(s.bannerGlow); cobweb = c(s.cobweb)
        }

        /// A card's translucent fill (nil = the normal fill).
        var cardFill: Color? { card.map { $0.opacity(cardOpacity) } }
        var heroFill: Color? { (hero ?? card).map { $0.opacity(hero != nil ? heroOpacity : cardOpacity) } }

        /// The drip cap's three stops for a game color (top lip, body with a hint of the
        /// game's own color, deep base).
        func capStops(_ game: Color) -> [Color]? {
            guard let cap else { return nil }
            return [cap[0], game.mixed(over: cap[1], capTint), cap[2]]
        }

        /// The theme palette under the season (on-card ink + the opaque card color for sheets).
        func palette(over base: ThemePalette) -> ThemePalette {
            var p = ThemePalette(
                background: base.background, backgroundGradientEnd: base.backgroundGradientEnd,
                surface: card ?? base.surface, border: base.border, borderAlt: base.borderAlt,
                borderLight: base.borderLight, divider: base.divider,
                surfaceAlt: raised ?? base.surfaceAlt, surfaceHover: raised ?? base.surfaceHover,
                textPrimary: text ?? base.textPrimary, textMuted: textMuted ?? base.textMuted,
                textSecondary: textSecondary ?? base.textSecondary)
            p.winBG = base.winBG; p.lossBG = base.lossBG; p.winText = base.winText; p.lossText = base.lossText
            p.highlightGold = base.highlightGold; p.goldBorder = base.goldBorder; p.goldBorderLight = base.goldBorderLight
            return p
        }
    }

    /// UserDefaults key of the admin surfaces preview: absent = the registry's `surfaces`, a
    /// `surfaceVariants` id (e.g. "parchment"), or "off". Read at launch (the theme root
    /// rebuilds then), so flipping it takes a relaunch.
    static let surfacesKey = "debug-season-surfaces"
    private static let surfacesChoice = UserDefaults.standard.string(forKey: surfacesKey) ?? ""
    private static let lookLock = NSLock()
    private static var lookCache: (id: String?, look: Look?)?

    /// The active season's windows (nil out of season / none / preview off).
    static var surfaces: Look? {
        let entry = current
        lookLock.lock(); defer { lookLock.unlock() }
        if let c = lookCache, c.id == entry?.id { return c.look }
        var look: Look?
        if let entry, surfacesChoice != "off" {
            let s = surfacesChoice.isEmpty ? entry.surfaces : (entry.surfaceVariants?[surfacesChoice] ?? entry.surfaces)
            look = s.map(Look.init)
        }
        lookCache = (entry?.id, look)
        return look
    }

    private struct File: Decodable { let seasons: [Entry] }

    /// Every registry season (bundle order = calendar order).
    static let registry: [Entry] = {
        guard let url = Bundle.main.url(forResource: "season-registry", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(File.self, from: data) else { return [] }
        return file.seasons
    }()

    static func entry(_ id: String?) -> Entry? {
        guard let id else { return nil }
        return registry.first { $0.id == id }
    }

    /// The active season's entry (nil out of season).
    static var current: Entry? { entry(CastSkin.season?.rawValue) }

    /// A slot map lookup: the exact name first, then the longest `prefix*` key.
    static func lookup(_ map: [String: String]?, _ name: String) -> String? {
        guard let map else { return nil }
        if let hit = map[name] { return hit }
        var best: (len: Int, value: String)?
        for (k, v) in map where k.hasSuffix("*") {
            let prefix = String(k.dropLast())
            if name.hasPrefix(prefix), prefix.count > (best?.len ?? -1) { best = (prefix.count, v) }
        }
        return best?.value
    }

    /// The title image set to draw for a normal title (`art-titlecast-*` / `art-game-*`): the
    /// season's lettering when it ships, else the name itself.
    static func title(_ name: String) -> String {
        guard let swap = lookup(current?.slots.titles, name), ArtAsset.exists(swap) else { return name }
        return swap
    }

    /// The seasonal wallpaper for a normal wall (nil = keep the normal one). Light mode takes the
    /// `<wall>-light` twin when it ships, so dark-on-light text keeps reading.
    static func wall(_ name: String, dark: Bool) -> String? {
        guard let swap = lookup(current?.slots.walls, name) else { return nil }
        if !dark, ArtAsset.exists(swap + "-light") { return swap + "-light" }
        return ArtAsset.exists(swap) ? swap : nil
    }

    /// The season's helper-pill tint (nil out of season).
    static var buttonTint: Color? { current.flatMap { Color(hexString: $0.palette.buttonTint) } }
    /// The season's quiet-pill tint (nil out of season).
    static var quietTint: Color? { current.flatMap { Color(hexString: $0.palette.quietTint) } }

    /// The season's cast skin image set for a cast id (nil when none / not shipped).
    static func cast(_ id: String) -> String? {
        guard let pattern = current?.slots.cast else { return nil }
        let name = pattern.replacingOccurrences(of: "{id}", with: id)
        return ArtAsset.exists(name) ? name : nil
    }

    /// The season's props (shipped ones only).
    static var props: [String] { (current?.slots.props ?? []).filter(ArtAsset.exists) }

    /// The season's Home banner (nil when none / not shipped).
    static var banner: String? {
        guard let b = current?.slots.banner, ArtAsset.exists(b) else { return nil }
        return b
    }
}
