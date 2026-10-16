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
        /// 10-16 time of day: each wall is a name OR {night, morning, day, evening} (night = base art).
        let walls: [String: TimedName]?
        let props: [String]?
        let banner: String?
        /// 10-16: the Home curtain-stage card art (core CelebrationStage geometry); absent / unshipped = the plain card.
        let stage: TimedName?
        let extras: [String: String]?
        /// Item 49: the season's sound slots (names of `sfx-<name>.m4a` in Resources/Sounds).
        let sounds: Sounds?
    }

    /// 10-16 time of day: a slot value that is either one image-set name (every time) or `{night, morning, day, evening}`.
    /// `night` is the base art and the fallback whenever a time's key is missing or its image set doesn't ship.
    struct TimedName: Decodable {
        let night: String
        let byTime: [TimeOfDay: String]

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let one = try? c.decode(String.self) { night = one; byTime = [:]; return }
            let m = try c.decode([String: String].self)
            guard let n = m["night"] else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "timed name without night") }
            night = n
            var by: [TimeOfDay: String] = [:]
            for t in TimeOfDay.allCases where t != .night { if let v = m[t.rawValue] { by[t] = v } }
            byTime = by
        }

        /// The name to draw at `slot`: that time's image set when it ships, else night's.
        func resolved(_ slot: TimeOfDay, light: Bool = false) -> String? {
            if slot != .night, let n = byTime[slot] {
                if light, ArtAsset.exists(n + "-light") { return n + "-light" }
                if ArtAsset.exists(n) { return n }
            }
            if light, ArtAsset.exists(night + "-light") { return night + "-light" }
            return ArtAsset.exists(night) ? night : nil
        }
    }

    /// `slots.sounds`: `intro` = the cold-start jingle's sample name, `note` = the musical cast's note pattern (`{id}` = the
    /// cast id). A future season adds its own here (plus the samples and their SoundManager.Effect cases).
    struct Sounds: Decodable {
        let intro: String?
        let note: String?
    }

    struct Entry: Decodable {
        let id: String
        let title: String
        let palette: Palette
        let slots: Slots
        let surfaces: Surfaces?
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
        /// The accent as TEXT on a light surface (the palette accent is a fill; docs/review/a11y-1016.md #11).
        let accentText: String?
        /// 10-16 time of day: a PARTIAL override of the above per time (night = the base). Any key present replaces the base value
        /// for that time; `tone == "light"` here only flips the ON-WALL ink dark (`Look.wallInkDark`), never the card tone.
        let tod: [String: Surfaces]?

        /// The base with `o`'s present keys replacing it (`tone` stays the base's: see `Look.wallInkDark`).
        func merged(_ o: Surfaces) -> Surfaces {
            Surfaces(tone: tone, card: o.card ?? card, cardOpacity: o.cardOpacity ?? cardOpacity,
                     hero: o.hero ?? hero, heroOpacity: o.heroOpacity ?? heroOpacity, raised: o.raised ?? raised,
                     cap: o.cap ?? cap, capTint: o.capTint ?? capTint, glow: o.glow ?? glow,
                     text: o.text ?? text, textMuted: o.textMuted ?? textMuted, textSecondary: o.textSecondary ?? textSecondary,
                     headline: o.headline ?? headline, bannerGlow: o.bannerGlow ?? bannerGlow, cobweb: o.cobweb ?? cobweb,
                     accentText: o.accentText ?? accentText, tod: nil)
        }
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
        /// The season accent as ink on a light surface (nil = the caller's own ink).
        let accentText: Color?
        /// 10-16 time of day: the ON-WALL chrome ink (stats-row streak / shield digits, on-wall labels) is dark here (the
        /// time's `tone == "light"`); the cards keep their own tone and ink.
        let wallInkDark: Bool

        init(_ s: Surfaces, wallInkDark: Bool = false) {
            self.wallInkDark = wallInkDark
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
            accentText = c(s.accentText)
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

    /// DEBUG UserDefaults key: "off" turns the season's surfaces off (the wall + art stay) for an
    /// A/B of perf or contrast; absent = the registry's `surfaces`. Read at launch (the theme root
    /// rebuilds then), so flipping it takes a relaunch.
    static let surfacesKey = "debug-season-surfaces"
    private static let surfacesChoice = UserDefaults.standard.string(forKey: surfacesKey) ?? ""
    private static let lookLock = NSLock()
    private static var lookCache: (key: String, look: Look?)?

    /// The active season's windows at the APPLIED time slot (nil out of season / none / preview off). Base merged with
    /// `surfaces.tod[slot]`; cached per (season, slot).
    static var surfaces: Look? {
        let entry = current
        let slot = TimeOfDayState.appliedSlot
        let key = "\(entry?.id ?? "-")|\(slot.rawValue)"
        lookLock.lock(); defer { lookLock.unlock() }
        if let c = lookCache, c.key == key { return c.look }
        var look: Look?
        if let entry, surfacesChoice != "off", let base = entry.surfaces {
            if slot != .night, let o = base.tod?[slot.rawValue] {
                look = Look(base.merged(o), wallInkDark: o.tone == "light")
            } else {
                look = Look(base)
            }
        }
        lookCache = (key, look)
        return look
    }

    /// One bad season entry never empties the registry: each entry decodes on its own (a failure drops only that one).
    private struct File: Decodable {
        let seasons: [Entry]
        private struct Lossy: Decodable {
            let entry: Entry?
            init(from decoder: Decoder) throws { entry = try? Entry(from: decoder) }
        }
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Key.self)
            seasons = try c.decode([Lossy].self, forKey: .seasons).compactMap(\.entry)
        }
        private enum Key: String, CodingKey { case seasons }
    }

    /// Decode registry JSON (tests call this on the real file).
    static func decodeRegistry(_ data: Data) -> [Entry] {
        (try? JSONDecoder().decode(File.self, from: data))?.seasons ?? []
    }

    /// Every registry season (bundle order = calendar order).
    static let registry: [Entry] = {
        guard let url = Bundle.main.url(forResource: "season-registry", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        return decodeRegistry(data)
    }()

    static func entry(_ id: String?) -> Entry? {
        guard let id else { return nil }
        return registry.first { $0.id == id }
    }

    /// The active season's entry (nil out of season).
    static var current: Entry? { entry(CastSkin.season?.rawValue) }

    /// A slot map lookup: the exact name first, then the longest `prefix*` key.
    static func lookup<V>(_ map: [String: V]?, _ name: String) -> V? {
        guard let map else { return nil }
        if let hit = map[name] { return hit }
        var best: (len: Int, value: V)?
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
        wall(name, dark: dark, slot: TimeOfDayState.appliedSlot)
    }

    /// The wall at a given time slot (night / a missing or unshipped time = the base art).
    static func wall(_ name: String, dark: Bool, slot: TimeOfDay) -> String? {
        guard let swap = lookup(current?.slots.walls, name) else { return nil }
        return swap.resolved(slot, light: !dark)
    }

    /// The season's helper-pill tint (nil out of season).
    static var buttonTint: Color? { current.flatMap { Color(hexString: $0.palette.buttonTint) } ?? ThemeKit.buttonTint }
    /// The season's quiet-pill tint (nil out of season).
    static var quietTint: Color? { current.flatMap { Color(hexString: $0.palette.quietTint) } ?? ThemeKit.quietTint }

    /// The season's cast skin image set for a cast id (nil when none / not shipped).
    static func cast(_ id: String) -> String? {
        guard let pattern = current?.slots.cast else { return nil }
        let name = pattern.replacingOccurrences(of: "{id}", with: id)
        return ArtAsset.exists(name) ? name : nil
    }

    /// 2.8 item 7: a celebration-kit prop's image set — the season's swap (registry `extras`) when it ships, else the normal one.
    /// `float-1` / `float-2` have no normal counterpart: nil out of season.
    static func extra(_ name: String) -> String? {
        if let swap = current?.slots.extras?[name], ArtAsset.exists(swap) { return swap }
        return name.hasPrefix("celebrate-float") ? nil : name
    }

    /// Item 49: the season's cold-start jingle sample name (nil out of season = the normal jingle).
    static var introSound: String? { current?.slots.sounds?.intro }

    /// Item 49: the season's musical-cast note sample for a cast id (the spooky voicing), nil out of season = the normal voice.
    static func noteSound(_ id: String) -> String? {
        current?.slots.sounds?.note?.replacingOccurrences(of: "{id}", with: id)
    }

    /// The season's props (shipped ones only).
    static var props: [String] { (current?.slots.props ?? []).filter(ArtAsset.exists) }

    /// The season's Home banner (nil when none / not shipped).
    static var banner: String? {
        guard let b = current?.slots.banner, ArtAsset.exists(b) else { return nil }
        return b
    }

    /// The season's Home curtain-stage art (registry `stage`; nil when none / not shipped = the plain card).
    static var stage: String? { stage(slot: TimeOfDayState.appliedSlot) }

    /// The stage art at a given time slot (night / a missing or unshipped time = the base art).
    static func stage(slot: TimeOfDay) -> String? { current?.slots.stage?.resolved(slot) }

    /// The podium stadium (10-16): inside a season, morning / day / evening use `art-podium-stage-<slot>` (when it ships); night,
    /// out of season, or a missing file = the night stadium `art-podium-stage`. Share cards always use the night one.
    static var podiumStage: String { podiumStage(slot: TimeOfDayState.appliedSlot) }

    static func podiumStage(slot: TimeOfDay) -> String {
        guard current != nil, slot != .night else { return "art-podium-stage" }
        let n = "art-podium-stage-\(slot.rawValue)"
        return ArtAsset.exists(n) ? n : "art-podium-stage"
    }
}
