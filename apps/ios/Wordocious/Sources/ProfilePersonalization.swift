import SwiftUI

/// Accent palette + helpers for profile personalization — mirrors the web
/// `lib/profile-personalization.ts` so a profile looks identical everywhere.
/// `accentColor` stores the hex; nil = default brand purple.
enum ProfileAccent {
    /// (id, hex) — id "purple" is the default / "none".
    static let palette: [(id: String, hex: UInt)] = [
        ("purple", 0x7C3AED), ("blue", 0x2563EB), ("teal", 0x0D9488), ("green", 0x059669),
        ("amber", 0xD97706), ("pink", 0xEC4899), ("red", 0xDC2626), ("slate", 0x475569),
    ]
    static let defaultHex: UInt = 0x7C3AED

    /// Resolve a stored hex string ("#7C3AED" or nil) to a Color, falling back to brand.
    static func color(_ stored: String?) -> Color { Color(hex: hex(stored)) }

    static func hex(_ stored: String?) -> UInt {
        guard let s = stored?.trimmingCharacters(in: CharacterSet(charactersIn: "# ")), !s.isEmpty,
              let v = UInt(s, radix: 16) else { return defaultHex }
        return palette.contains { $0.hex == v } ? v : defaultHex
    }

    /// A darker shade for gradients (avatar fallback).
    static func darker(_ h: UInt) -> UInt {
        let map: [UInt: UInt] = [
            0x7C3AED: 0x6D28D9, 0x2563EB: 0x1D4ED8, 0x0D9488: 0x0F766E, 0x059669: 0x047857,
            0xD97706: 0xB45309, 0xEC4899: 0xBE185D, 0xDC2626: 0xB91C1C, 0x475569: 0x334155,
        ]
        return map[h] ?? h
    }

    /// `true` when the user picked a non-default accent (so we tint vs. use brand styling).
    static func isCustom(_ stored: String?) -> Bool {
        guard let s = stored, !s.isEmpty else { return false }
        return hex(s) != defaultHex
    }
}

/// Featured-title pill + bio + favorite-mode chip — rendered under the username on
/// the profile header (own + public). Mirrors the web profile-header personalization.
struct ProfilePersonalizationRow: View {
    let profile: Profile
    @ObservedObject private var catalog = AchievementCatalog.shared

    private var accent: Color { ProfileAccent.color(profile.accentColor) }
    private var titleName: String? {
        guard let key = profile.featuredAchievement else { return nil }
        return catalog.all.first(where: { $0.key == key })?.name
    }
    private var favMode: HomeMode? {
        guard let dk = profile.favoriteMode else { return nil }
        return homeModes.first(where: { $0.dbKey == dk })
    }

    var body: some View {
        VStack(spacing: 6) {
            if let name = titleName {
                HStack(spacing: 4) {
                    Image(systemName: "star.fill").font(.system(size: 9, weight: .bold))
                    Text(name.uppercased()).font(Brand.font(10, .black)).tracking(0.4)
                }
                .foregroundStyle(accent).padding(.horizontal, 9).padding(.vertical, 3)
                .background(Capsule().fill(accent.opacity(0.12)))
            }
            if let bio = profile.bio?.trimmingCharacters(in: .whitespaces), !bio.isEmpty {
                Text(bio).font(Brand.font(13, .bold)).foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center).frame(maxWidth: 300)
            }
            if let m = favMode {
                HStack(spacing: 5) {
                    ModeIconView(icon: m.icon, accent: m.accent, box: 16)
                    Text(m.title).font(Brand.font(11, .bold)).foregroundStyle(m.accent)
                }
                .padding(.horizontal, 9).padding(.vertical, 3)
                .background(Capsule().fill(m.accent.opacity(0.12)))
            }
        }
        .task { await catalog.load() }
    }
}
