import Foundation

/// Decides whether the ads SDK may initialize at all, from the device region.
///
/// LevelPlay ships no consent-management platform (AppLovin MAX did; Google's
/// UMP lives inside the dead AdMob console). Until a CMP is integrated, users
/// in GDPR-style consent regions simply never see the SDK start — the region
/// stays ad-free rather than serving without a lawful consent record.
///
/// Phase 2 (docs/LEVELPLAY_SETUP.md): a Usercentrics App CMP account lifts the
/// gate for these regions; that is a separate task, and this type is where its
/// settings id will land.
enum ConsentGate {
    enum Decision: Equatable {
        /// Outside every consent region — the SDK may start.
        case allowed
        /// Inside the EEA / UK / Switzerland / EFTA — do not initialize ads.
        case blocked
    }

    /// EU-27 + the EEA EFTA states (Norway, Iceland, Liechtenstein) + UK +
    /// Switzerland. ISO 3166-1 alpha-2, as `Locale.Region.identifier` returns.
    static let consentRegions: Set<String> = [
        // EU-27
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
        "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
        "SI", "ES", "SE",
        // EEA (EFTA)
        "NO", "IS", "LI",
        // UK + Switzerland
        "GB", "CH",
    ]

    /// Decision for the current device region. An unknown region blocks — the
    /// failure mode of "no ads" is the safe one.
    static var decision: Decision { decision(forRegion: Locale.current.region?.identifier) }

    static func decision(forRegion code: String?) -> Decision {
        guard let code = code?.uppercased(), !code.isEmpty else { return .blocked }
        return consentRegions.contains(code) ? .blocked : .allowed
    }
}
