import SwiftUI
import WordociousCore

/// FINISH_SPEC §X: seasonal cast skins. During a season (Halloween: Oct 9 – Oct 31,
/// local date — core `Season.current`) the hero cast (`mascot-<id>`) is swapped for
/// that season's skins (`art-halloween-<id>`) in the living cast header row, the
/// cold-start intro + landing flourish, the share-image cast wordmark and the cast
/// loader. A skin that doesn't ship falls back to the hero image, so a partial art
/// drop never leaves a hole in the row.
///
/// Admin preview: Settings shows a "Season preview" picker to `is_admin` profiles only
/// (Off (by date) / every registry season); it writes `debug-season` (a season id | absent),
/// which wins over the date. What each season swaps lives in the registry (SeasonKit).
/// The skins, props and banner below read the registry slots.
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
        guard let s = calendarSeason(now) else { return nil }
        // Item 24: the player opted out of Seasonal for this season (Settings > Theme).
        if UserDefaults.standard.string(forKey: optOutKey) == ThemeChoiceRules.optOutKey(season: s.rawValue, date: localDay(now)) { return nil }
        return s
    }

    /// UserDefaults key of "no Seasonal for this season" ("<season>:<year>"; synced to the account).
    static let optOutKey = "pref-season-optout"

    /// The calendar's season on the local date, honoring the `season_halloween` off-switch (nil = none / switched off).
    static func calendarSeason(_ now: Date = Date()) -> Season? {
        guard switchOn else { return nil }
        let c = Calendar(identifier: .gregorian).dateComponents([.month, .day], from: now)
        guard let m = c.month, let d = c.day else { return nil }
        return Season.current(month: m, day: d)
    }

    static func localDay(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    // The `season_halloween` off-switch, as FlagsService last read it (fail-open: on until a row says off).
    private static var switchState = true
    static var switchOn: Bool { lock.lock(); defer { lock.unlock() }; return switchState }

    /// FlagsService calls this after every load: a flip re-resolves the season and rebuilds the UI.
    static func setSwitch(_ on: Bool) {
        lock.lock()
        let changed = switchState != on
        switchState = on
        if changed { cached = nil }
        lock.unlock()
        if changed { DispatchQueue.main.async { ThemeManager.shared.seasonEpoch += 1 } }
    }

    /// The image set to draw for a cast member: its season skin when one is active
    /// and ships, else the hero image (`mascot-<id>`).
    static func assetName(for id: MascotID) -> String {
        SeasonKit.cast(id.rawValue) ?? id.assetName
    }

    // MARK: Season art slots (hidden when the art is missing)

    /// The Halloween props (`art-halloween-prop-*`) for the day titles.
    private static let halloweenProps = ["pumpkin", "bat", "candy", "ghost"]

    /// A small seasonal prop for the day-title headline — the same prop all day
    /// (picked by the day of the year among the props that ship), nil out of season
    /// or when none ship.
    static func dayProp(_ date: Date = Date()) -> String? {
        let available = SeasonKit.props
        guard !available.isEmpty else { return nil }
        let day = Calendar(identifier: .gregorian).ordinality(of: .day, in: .year, for: date) ?? 0
        return available[day % available.count]
    }

    /// Every Halloween prop's image set name (shipped or not; for prewarm).
    static var halloweenPropAssets: [String] { halloweenProps.map { "art-halloween-prop-\($0)" } }

    /// Founder 10-05: the day title's props come in a PAIR — one per side, never a lone
    /// prop on one side. Two different props (picked by the day of the year among those
    /// that ship); nil out of season or when fewer than two ship.
    static func dayProps(_ date: Date = Date()) -> (left: String, right: String)? {
        let available = SeasonKit.props
        guard available.count >= 2 else { return nil }
        let day = Calendar(identifier: .gregorian).ordinality(of: .day, in: .year, for: date) ?? 0
        return (available[day % available.count], available[(day + 1) % available.count])
    }

    /// The seasonal Home banner art (`art-scene-banner-halloween`), nil out of season
    /// or when it doesn't ship.
    static var bannerArt: String? { SeasonKit.banner }
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
