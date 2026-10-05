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
