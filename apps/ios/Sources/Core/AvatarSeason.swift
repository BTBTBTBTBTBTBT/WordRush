import Foundation

// Seasonal mascot-maker items — exact port of packages/core/src/avatar-season.ts (pinned by
// Tests/Fixtures/avatar-season-fixtures.json, AvatarSeasonTests). A part is seasonal when its avatar-parts.json
// item carries `season`. Rules (10-05): free while the season is on (its window or the admin Season preview); a
// SAVED seasonal part stays (never strip a look); out of season unsaved ones hide; Randomize never picks them;
// one Home nudge per season per year for players not already wearing one.

public struct AvatarPart: Equatable, Codable {
    public var field: String
    public var id: String
    public init(field: String, id: String) { self.field = field; self.id = id }
}

public enum AvatarSeason {
    /// The maker fields that can hold a seasonal part, in shelf order (hats first, the buddy last).
    public static let fields = ["head", "neck", "wrap", "held", "face", "feet", "pet", "extra"]

    static func options(_ field: String) -> [String] {
        switch field {
        case "head": return AvatarCatalog.heads
        case "neck": return AvatarCatalog.necks
        case "face": return AvatarCatalog.faces
        default: return AvatarCatalog.integratedFields.first { $0.field == field }?.options ?? []
        }
    }

    /// The season a part belongs to, or nil for an everyday part.
    public static func partSeason(field: String, id: String, manifest: AvatarManifest) -> String? {
        guard !id.isEmpty, id != "none" else { return nil }
        return manifest.items[AvatarFit.itemKey(field: field, id: id)]?.season
    }

    /// The season the maker dresses for: the preview ("none" = forced off), else the calendar's ("yyyy-MM-dd").
    public static func active(day: String, preview: String?) -> String? {
        if preview == "none" { return nil }
        if let preview, !preview.isEmpty { return preview }
        return Season.current(day: day)?.rawValue
    }

    /// May the maker show (and Randomize pick) this part? `saved` = the player's saved config's field -> id.
    public static func isPartAvailable(_ part: AvatarPart, day: String, preview: String?, saved: [String: String]?,
                                       manifest: AvatarManifest) -> Bool {
        guard let season = partSeason(field: part.field, id: part.id, manifest: manifest) else { return true }
        if let saved, saved[part.field] == part.id { return true }
        return active(day: day, preview: preview) == season
    }

    public static func isPartAvailable(_ part: AvatarPart, day: String, preview: String?, saved: AvatarConfig?,
                                       manifest: AvatarManifest) -> Bool {
        isPartAvailable(part, day: day, preview: preview, saved: saved.map(worn), manifest: manifest)
    }

    /// The season's shelf: every part of `season`, hats first, each field in its catalog order.
    public static func shelf(_ season: String?, manifest: AvatarManifest) -> [AvatarPart] {
        guard let season else { return [] }
        var out: [AvatarPart] = []
        for f in fields { for id in options(f) where partSeason(field: f, id: id, manifest: manifest) == season { out.append(AvatarPart(field: f, id: id)) } }
        return out
    }

    /// Does the config (field -> id) wear any seasonal part (of `season`, or any season when nil)?
    public static func wearsSeasonalPart(_ config: [String: String]?, season: String?, manifest: AvatarManifest) -> Bool {
        guard let config else { return false }
        for f in fields {
            guard let id = config[f], let s = partSeason(field: f, id: id, manifest: manifest) else { continue }
            if season == nil || s == season { return true }
        }
        return false
    }

    /// The nudge's "seen" key: one per season per year.
    public static func nudgeKey(_ season: String, day: String) -> String { "\(season)-\(day.prefix(4))" }

    /// The one-time Home nudge's season, or nil.
    public static func nudgeDue(day: String, preview: String?, config: [String: String]?, seen: [String],
                                manifest: AvatarManifest) -> String? {
        guard let season = active(day: day, preview: preview), !shelf(season, manifest: manifest).isEmpty else { return nil }
        if seen.contains(nudgeKey(season, day: day)) { return nil }
        if wearsSeasonalPart(config, season: season, manifest: manifest) { return nil }
        return season
    }

    /// The small tag on a seasonal tile (HALLOWEEN, WINTER HOLIDAYS).
    public static func tag(_ season: String) -> String { season.replacingOccurrences(of: "-", with: " ").uppercased() }

    /// A config's part fields as field -> id.
    public static func worn(_ c: AvatarConfig) -> [String: String] {
        var out: [String: String] = [:]
        for f in fields { out[f] = AvatarFit.value(c, f) }
        return out
    }

    /// Today as a local "yyyy-MM-dd".
    public static func today(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
}
