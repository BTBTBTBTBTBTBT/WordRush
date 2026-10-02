import SwiftUI
import WordociousCore

/// FINISH_SPEC §X: seasonal cast skins. During a season (Halloween: Oct 24 – Nov 1,
/// local date — core `Season.current`) the hero cast (`mascot-<id>`) is swapped for
/// that season's skins (`art-halloween-<id>`) in the living cast header row, the
/// cold-start intro + landing flourish, the share-image cast wordmark and the cast
/// loader. A skin that doesn't ship falls back to the hero image, so a partial art
/// drop never leaves a hole in the row.
///
/// Admin preview: Settings shows a "Halloween preview" toggle to `is_admin` profiles
/// only; it writes `debug-season` ("halloween" | absent), which wins over the date.
enum CastSkin {
    /// UserDefaults key of the admin season preview ("halloween"; absent = by date).
    static let debugKey = "debug-season"

    private static let lock = NSLock()
    private static var cached: (at: Date, season: Season?)?

    /// The active season (the admin preview first, else today's local date). Cached
    /// for 30 s — it's read per figure per frame by the animated cast rows.
    static var season: Season? {
        lock.lock(); defer { lock.unlock() }
        let now = Date()
        if let c = cached, now.timeIntervalSince(c.at) < 30 { return c.season }
        let s = resolve(now)
        cached = (now, s)
        return s
    }

    /// Drop the cache (the admin toggle flips the preview live).
    static func invalidate() {
        lock.lock(); defer { lock.unlock() }
        cached = nil
    }

    private static func resolve(_ now: Date) -> Season? {
        if let o = UserDefaults.standard.string(forKey: debugKey), let s = Season(rawValue: o) { return s }
        let c = Calendar(identifier: .gregorian).dateComponents([.month, .day], from: now)
        guard let m = c.month, let d = c.day else { return nil }
        return Season.current(month: m, day: d)
    }

    /// The image set to draw for a cast member: its season skin when one is active
    /// and ships, else the hero image (`mascot-<id>`).
    static func assetName(for id: MascotID) -> String {
        if season == .halloween {
            let name = "art-halloween-\(id.rawValue)"
            if ArtAsset.exists(name) { return name }
        }
        return id.assetName
    }

    // MARK: Season art slots (hidden when the art is missing)

    /// The Halloween props (`art-halloween-prop-*`) for the day titles.
    private static let halloweenProps = ["pumpkin", "bat", "candy", "ghost"]

    /// A small seasonal prop for the day-title headline — the same prop all day
    /// (picked by the day of the year among the props that ship), nil out of season
    /// or when none ship.
    static func dayProp(_ date: Date = Date()) -> String? {
        guard season == .halloween else { return nil }
        let available = halloweenProps.map { "art-halloween-prop-\($0)" }.filter(ArtAsset.exists)
        guard !available.isEmpty else { return nil }
        let day = Calendar(identifier: .gregorian).ordinality(of: .day, in: .year, for: date) ?? 0
        return available[day % available.count]
    }

    /// The seasonal Home banner art (`art-scene-banner-halloween`), nil out of season
    /// or when it doesn't ship.
    static var bannerArt: String? {
        guard season == .halloween else { return nil }
        let name = "art-scene-banner-halloween"
        return ArtAsset.exists(name) ? name : nil
    }
}

/// §X: the small seasonal prop beside a day-title headline (decorative; nothing
/// out of season or when the art is missing).
struct SeasonDayProp: View {
    var size: CGFloat = 40

    var body: some View {
        if let prop = CastSkin.dayProp() {
            Image(prop).resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-8))
                .accessibilityHidden(true)
                .allowsHitTesting(false)
        }
    }
}
