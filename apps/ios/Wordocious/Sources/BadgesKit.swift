import SwiftUI
import WordociousCore

// FINISH_SPEC §V: the 3D achievement badges + the level-tier badges.
//   V1 — `AchievementBadgeArt` / `AchievementBadgeCell` / `AchievementDetailSheet`
//   V3 — `LevelBadge(level:size:)` and the Pro member mark `ProMark`.
// The unlock / level-up popups (V2) live in AchievementUnlockPopup.swift.

// MARK: - Achievement badge art

enum BadgeArt {
    /// The badge image for an achievement `icon` key (`art-badge-<icon>`); star when
    /// the key is missing or its art doesn't ship.
    static func achievementAsset(_ icon: String?) -> String {
        let name = "art-badge-\(icon ?? "star")"
        return ArtAsset.exists(name) ? name : "art-badge-star"
    }

    /// The tier's display color (the old chip colors) — popup accents and rings.
    static func tierAccent(_ tier: LevelTier) -> Color {
        switch tier {
        case .bronze: return Color(hex: 0xC2410C)
        case .silver: return Color(hex: 0x64748B)
        case .gold: return Color(hex: 0xD97706)
        case .platinum: return Color(hex: 0x7C3AED)
        case .diamond: return Color(hex: 0x2563EB)
        }
    }

    /// "Sep 12" (this year) / "Sep 12, 2025" from an `unlocked_at` timestamp.
    static func shortDate(_ stamp: String?) -> String? {
        guard let stamp, let d = parseTimestamp(stamp) else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US")
        let sameYear = Calendar.current.component(.year, from: d) == Calendar.current.component(.year, from: Date())
        f.dateFormat = sameYear ? "MMM d" : "MMM d, yyyy"
        return f.string(from: d)
    }

    static func longDate(_ stamp: String?) -> String? {
        guard let stamp, let d = parseTimestamp(stamp) else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "MMMM d, yyyy"
        return f.string(from: d)
    }
}

/// §V1: one achievement badge. Unlocked = full color with a soft glow; locked =
/// grayscale at 45% opacity with the small 3D lock in the corner.
struct AchievementBadgeArt: View {
    let icon: String?
    let unlocked: Bool
    var size: CGFloat = 56
    var glow: Color = Color(hex: 0x7C3AED)

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if unlocked {
                RadialGradient(colors: [glow.opacity(Theme.isDark ? 0.45 : 0.32), glow.opacity(0)],
                               center: .center, startRadius: 2, endRadius: size * 0.62)
                    .frame(width: size * 1.25, height: size * 1.25)
                    .offset(x: size * 0.125, y: -size * 0.125)
                    .allowsHitTesting(false)
            }
            Image(BadgeArt.achievementAsset(icon))
                .resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
                .grayscale(unlocked ? 0 : 1)
                .opacity(unlocked ? 1 : 0.45)
                .shadow(color: unlocked ? glow.opacity(0.35) : .clear, radius: size * 0.12, x: 0, y: size * 0.05)
            if !unlocked {
                Icon3D(.lock, size: max(14, size * 0.3))
                    .offset(x: size * 0.06, y: -size * 0.04)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A soft progress bar with the "37/50" count in soft numbers.
struct BadgeProgressBar: View {
    let current: Int
    let target: Int
    var accent: Color
    var numberSize: CGFloat = 10

    var body: some View {
        VStack(spacing: 2) {
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(accent.opacity(Theme.isDark ? 0.25 : 0.16))
                    Capsule().fill(LinearGradient(colors: [accent.wash(0.6), accent], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(4, g.size.width * min(1, Double(current) / Double(max(1, target)))))
                }
            }
            .frame(height: 5)
            Text("\(current.formatted())/\(target.formatted())").softNumber(numberSize)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(current) of \(target)")
    }
}

/// §V1: an achievements-grid cell — the badge art, the name, and the unlock date
/// (unlocked) or the progress bar (locked, when progress is known). Tap opens the
/// detail sheet (the caller's button wraps it).
struct AchievementBadgeCell: View {
    let def: AchievementDef
    let unlocked: Bool
    var unlockedAt: String? = nil
    var progress: (c: Int, t: Int)? = nil
    let accent: Color

    var body: some View {
        let dark = Theme.isDark
        VStack(spacing: 4) {
            AchievementBadgeArt(icon: def.icon, unlocked: unlocked, size: 54, glow: accent)
                .padding(.top, 2)
            Text(def.name).font(Brand.font(10, .heavy)).foregroundStyle(FinishInk.heading)
                .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.75)
                .fixedSize(horizontal: false, vertical: true)
            if unlocked {
                if let d = BadgeArt.shortDate(unlockedAt) {
                    Text(d).font(Brand.font(9, .bold)).foregroundStyle(FinishInk.secondary).lineLimit(1)
                }
            } else if let progress {
                BadgeProgressBar(current: progress.c, target: progress.t, accent: accent)
                    .padding(.horizontal, 2)
            }
        }
        .padding(.horizontal, 6).padding(.vertical, 8)
        .frame(maxWidth: .infinity, minHeight: 108, alignment: .top)
        // §A1: tinted in the category color (stronger when unlocked), never plain white.
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(dark ? (unlocked ? accent.opacity(0.18) : Theme.surface) : accent.wash(unlocked ? 0.14 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
            .stroke(dark ? (unlocked ? accent.opacity(0.5) : Theme.border) : accent.wash(unlocked ? 0.40 : 0.20), lineWidth: 1.5))
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityHint("Shows the badge")
    }

    private var accessibilityText: String {
        if unlocked {
            return "\(def.name), unlocked" + (BadgeArt.longDate(unlockedAt).map { " \($0)" } ?? "") + ". \(def.description)"
        }
        return "\(def.name), locked" + (progress.map { ", \($0.c) of \($0.t)" } ?? "") + ". \(def.description)"
    }
}

/// §V1: the big-badge detail sheet — a tinted card with the badge on a soft stage,
/// its name and description, the unlock date or the progress, and a candy close.
struct AchievementDetailSheet: View {
    let def: AchievementDef
    let unlocked: Bool
    var unlockedAt: String? = nil
    var progress: (c: Int, t: Int)? = nil
    let accent: Color
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let dark = Theme.isDark
        VStack(spacing: 14) {
            ZStack {
                RadialGradient(colors: [accent.opacity(unlocked ? 0.30 : 0.12), accent.opacity(0)],
                               center: .center, startRadius: 6, endRadius: 120)
                    .frame(width: 240, height: 200)
                BadgeRays(color: accent.opacity(unlocked ? 0.12 : 0.05))
                    .frame(width: 220, height: 220)
                    .mask(RadialGradient(colors: [.black, .clear], center: .center, startRadius: 12, endRadius: 110))
                AchievementBadgeArt(icon: def.icon, unlocked: unlocked, size: 150, glow: accent)
            }
            .frame(height: 190)
            .accessibilityHidden(true)
            VStack(spacing: 6) {
                Text(def.name).font(Brand.font(24, .black)).foregroundStyle(FinishInk.heading)
                    .multilineTextAlignment(.center)
                Text(def.description).font(Brand.font(14, .bold)).foregroundStyle(FinishInk.secondary)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 20)
            Group {
                if unlocked {
                    HStack(spacing: 6) {
                        Icon3D(.badgeCheck, size: 18)
                        Text(BadgeArt.longDate(unlockedAt).map { "Unlocked \($0)" } ?? "Unlocked")
                            .font(Brand.font(13, .black)).foregroundStyle(FinishInk.heading)
                    }
                    .padding(.horizontal, 14).padding(.top, 9).padding(.bottom, 7)
                    .tintedPill(accent)
                } else if let progress {
                    BadgeProgressBar(current: progress.c, target: progress.t, accent: accent, numberSize: 16)
                        .frame(maxWidth: 220)
                } else {
                    HStack(spacing: 6) {
                        Icon3D(.lock, size: 16)
                        Text("Not unlocked yet").font(Brand.font(13, .black)).foregroundStyle(FinishInk.secondary)
                    }
                }
            }
            Button { dismiss() } label: { CandyLabel(title: unlocked ? "Nice!" : "Close") }
                .buttonStyle(CandyButtonStyle(variant: unlocked ? .purple : .peach, size: .medium, fullWidth: false))
                .padding(.top, 4)
        }
        .padding(.top, 30).padding(.bottom, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            ZStack(alignment: .top) {
                if dark {
                    Theme.surface
                    LinearGradient(colors: [accent.opacity(0.22), accent.opacity(0.06)], startPoint: .top, endPoint: .bottom)
                } else {
                    LinearGradient(colors: [accent.mixed(over: Color(hex: 0xFFF8F1), 0.12), accent.mixed(over: Color(hex: 0xFFF8F1), 0.04)],
                                   startPoint: .top, endPoint: .bottom)
                }
                LinearGradient(colors: [accent, accent.wash(0.55)], startPoint: .leading, endPoint: .trailing)
                    .frame(height: 8)
            }
            .ignoresSafeArea()
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

/// Twelve soft light rays from the center (the badge stage; the popup turns them).
struct BadgeRays: View {
    let color: Color
    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let r = max(size.width, size.height) / 2
            for k in 0..<12 {
                let a = Double(k) / 12 * 2 * .pi
                var p = Path()
                p.move(to: c)
                p.addLine(to: CGPoint(x: c.x + r * cos(a - 0.09), y: c.y + r * sin(a - 0.09)))
                p.addLine(to: CGPoint(x: c.x + r * cos(a + 0.09), y: c.y + r * sin(a + 0.09)))
                p.closeSubpath()
                ctx.fill(p, with: .color(color))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - §V3 Level badge

/// §V3: the level-tier badge (`art-badge-level-<tier>`, 16–64 pt by context) with
/// the level number beside it in soft numbers; `showTier` adds the tier name in
/// small caps ("12 SILVER").
struct LevelBadge: View {
    let level: Int
    var size: CGFloat = 22
    var showTier = false
    /// Override the number color (share images are always light).
    var numberColor: Color? = nil

    var body: some View {
        let tier = LevelTier.forLevel(level)
        HStack(spacing: max(3, size * 0.16)) {
            Image(tier.assetName)
                .resizable().interpolation(.high).scaledToFit()
                .frame(width: size, height: size)
            Text("\(level)").softNumber(max(11, size * 0.62), color: numberColor)
                .lineLimit(1).fixedSize()
            if showTier {
                Text(tier.label.uppercased())
                    .font(Brand.font(max(9, size * 0.4), .black)).tracking(0.8)
                    .foregroundStyle(numberColor?.opacity(0.75) ?? FinishInk.secondary)
                    .lineLimit(1).fixedSize()
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Level \(level), \(tier.label)")
    }
}

/// §V3 / §AA: the small Pro member mark (`art-badge-level-pro`, crown on a purple
/// gem) next to a Pro player's name, where the PRO pill used to be.
struct ProMark: View {
    var size: CGFloat = 20

    var body: some View {
        Image("art-badge-level-pro")
            .resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .shadow(color: Color(hex: 0xF5A524).opacity(0.35), radius: size * 0.15, x: 0, y: 1)
            .accessibilityLabel("Pro member")
    }
}
